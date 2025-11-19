/**
 * Virtual Random Number Generator (RNG) for deterministic randomness
 * Implements multiple PRNG algorithms with state management
 */

import type { VirtualRNG, RNGState } from './types.js';
import { getLogger } from '../../utils/instrumentation/logger.js';
import { getMetrics } from '../../utils/instrumentation/metrics.js';

const logger = getLogger('virtual-rng');
const metrics = getMetrics();

/**
 * PRNG Algorithm types
 */
export enum PRNGAlgorithm {
  /**
   * Linear Congruential Generator (fast, simple)
   */
  LCG = 'lcg',

  /**
   * Xorshift128+ (fast, good quality)
   */
  XORSHIFT128 = 'xorshift128',

  /**
   * Mersenne Twister (high quality, slower)
   */
  MT19937 = 'mt19937',

  /**
   * PCG (Permuted Congruential Generator - modern, fast, high quality)
   */
  PCG = 'pcg',
}

/**
 * Base PRNG interface
 */
interface PRNG {
  /**
   * Generate next random number [0, 1)
   */
  next(): number;

  /**
   * Generate next 32-bit unsigned integer
   */
  nextInt32(): number;

  /**
   * Get algorithm name
   */
  getAlgorithm(): PRNGAlgorithm;

  /**
   * Get internal state
   */
  getState(): number[];

  /**
   * Set internal state
   */
  setState(state: number[]): void;
}

/**
 * Linear Congruential Generator
 * Fast but lower quality, good for testing
 */
class LCG implements PRNG {
  private static readonly A = 1664525;
  private static readonly C = 1013904223;
  private static readonly M = 2 ** 32;

  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0; // Ensure 32-bit unsigned
  }

  next(): number {
    this.state = (LCG.A * this.state + LCG.C) % LCG.M;
    return this.state / LCG.M;
  }

  nextInt32(): number {
    this.next();
    return this.state >>> 0;
  }

  getAlgorithm(): PRNGAlgorithm {
    return PRNGAlgorithm.LCG;
  }

  getState(): number[] {
    return [this.state];
  }

  setState(state: number[]): void {
    if (state.length !== 1) {
      throw new Error('LCG state must have 1 element');
    }
    this.state = state[0]!;
  }
}

/**
 * Xorshift128+ PRNG
 * Fast and good quality, commonly used in browsers
 */
class Xorshift128 implements PRNG {
  private s0: number;
  private s1: number;

  constructor(seed: number) {
    // Initialize with seed
    this.s0 = seed >>> 0;
    this.s1 = (seed * 0x9e3779b9) >>> 0;

    // Warm up
    for (let i = 0; i < 10; i++) {
      this.next();
    }
  }

  next(): number {
    return this.nextInt32() / 0x100000000;
  }

  nextInt32(): number {
    let s1 = this.s0;
    const s0 = this.s1;
    this.s0 = s0;

    s1 ^= s1 << 23;
    s1 ^= s1 >>> 17;
    s1 ^= s0;
    s1 ^= s0 >>> 26;

    this.s1 = s1 >>> 0;

    return (this.s0 + this.s1) >>> 0;
  }

  getAlgorithm(): PRNGAlgorithm {
    return PRNGAlgorithm.XORSHIFT128;
  }

  getState(): number[] {
    return [this.s0, this.s1];
  }

  setState(state: number[]): void {
    if (state.length !== 2) {
      throw new Error('Xorshift128 state must have 2 elements');
    }
    this.s0 = state[0]!;
    this.s1 = state[1]!;
  }
}

/**
 * PCG (Permuted Congruential Generator)
 * Modern, fast, high-quality PRNG
 */
class PCG implements PRNG {
  private state: bigint;
  private inc: bigint;

  constructor(seed: number) {
    this.state = BigInt(seed);
    this.inc = BigInt(1);

    // Warm up
    for (let i = 0; i < 10; i++) {
      this.nextInt32();
    }
  }

  next(): number {
    return this.nextInt32() / 0x100000000;
  }

  nextInt32(): number {
    const oldState = this.state;
    // LCG step
    this.state =
      (oldState * 6364136223846793005n + this.inc) & 0xffffffffffffffffn;

    // XSH-RR output function
    const xorshifted = Number(
      ((oldState >> 18n) ^ oldState) >> 27n
    ) >>> 0;
    const rot = Number(oldState >> 59n);

    return ((xorshifted >>> rot) | (xorshifted << ((-rot) & 31))) >>> 0;
  }

  getAlgorithm(): PRNGAlgorithm {
    return PRNGAlgorithm.PCG;
  }

  getState(): number[] {
    // Convert BigInt to two 32-bit numbers
    const low = Number(this.state & 0xffffffffn);
    const high = Number(this.state >> 32n);
    return [low, high, Number(this.inc)];
  }

  setState(state: number[]): void {
    if (state.length !== 3) {
      throw new Error('PCG state must have 3 elements');
    }
    this.state = (BigInt(state[1]!) << 32n) | BigInt(state[0]!);
    this.inc = BigInt(state[2]!);
  }
}

/**
 * Virtual RNG implementation
 */
export class VirtualRNGImpl implements VirtualRNG {
  private prng: PRNG;
  private currentSeed: number;
  private algorithm: PRNGAlgorithm;

  // Metrics
  private randomCallsCounter = metrics.counter(
    'vrng.random_calls',
    'Number of random() calls'
  );
  private randomValuesCallsCounter = metrics.counter(
    'vrng.random_values_calls',
    'Number of getRandomValues() calls'
  );
  private bytesGeneratedCounter = metrics.counter(
    'vrng.bytes_generated',
    'Total random bytes generated'
  );

  constructor(seed: number = Date.now(), algorithm: PRNGAlgorithm = PRNGAlgorithm.XORSHIFT128) {
    this.currentSeed = seed;
    this.algorithm = algorithm;
    this.prng = this.createPRNG(algorithm, seed);

    logger.info('Virtual RNG initialized', {
      operation: 'constructor',
      seed,
      algorithm,
    });
  }

  /**
   * Create PRNG based on algorithm
   */
  private createPRNG(algorithm: PRNGAlgorithm, seed: number): PRNG {
    switch (algorithm) {
      case PRNGAlgorithm.LCG:
        return new LCG(seed);
      case PRNGAlgorithm.XORSHIFT128:
        return new Xorshift128(seed);
      case PRNGAlgorithm.PCG:
        return new PCG(seed);
      case PRNGAlgorithm.MT19937:
        // TODO: Implement MT19937
        logger.warn('MT19937 not yet implemented, falling back to Xorshift128');
        return new Xorshift128(seed);
      default:
        throw new Error(`Unknown algorithm: ${algorithm}`);
    }
  }

  /**
   * Generate random number [0, 1)
   */
  random(): number {
    this.randomCallsCounter.inc();
    const value = this.prng.next();

    logger.trace('Random number generated', {
      operation: 'random',
      value,
    });

    return value;
  }

  /**
   * Fill array with random values (crypto.getRandomValues compatible)
   */
  getRandomValues<T extends ArrayBufferView>(array: T): T {
    this.randomValuesCallsCounter.inc();
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);

    // Fill with random bytes
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = (this.prng.nextInt32() & 0xff);
    }

    this.bytesGeneratedCounter.inc(bytes.length);

    logger.trace('Random values generated', {
      operation: 'getRandomValues',
      bytes: bytes.length,
    });

    return array;
  }

  /**
   * Generate random integer in range [min, max)
   */
  randomInt(min: number, max: number): number {
    if (min >= max) {
      throw new Error('min must be less than max');
    }

    const range = max - min;
    return min + Math.floor(this.random() * range);
  }

  /**
   * Generate random boolean
   */
  randomBool(probability: number = 0.5): boolean {
    return this.random() < probability;
  }

  /**
   * Shuffle array in place (Fisher-Yates)
   */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.randomInt(0, i + 1);
      [array[i], array[j]] = [array[j]!, array[i]!];
    }
    return array;
  }

  /**
   * Pick random element from array
   */
  choice<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    return array[this.randomInt(0, array.length)]!;
  }

  /**
   * Generate random bytes
   */
  randomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    return this.getRandomValues(bytes);
  }

  /**
   * Set seed for deterministic behavior
   */
  seed(value: number): void {
    this.currentSeed = value;
    this.prng = this.createPRNG(this.algorithm, value);

    logger.info('RNG seed set', {
      operation: 'seed',
      seed: value,
      algorithm: this.algorithm,
    });
  }

  /**
   * Set algorithm
   */
  setAlgorithm(algorithm: PRNGAlgorithm): void {
    this.algorithm = algorithm;
    this.prng = this.createPRNG(algorithm, this.currentSeed);

    logger.info('RNG algorithm changed', {
      operation: 'setAlgorithm',
      algorithm,
    });
  }

  /**
   * Get current algorithm
   */
  getAlgorithm(): PRNGAlgorithm {
    return this.algorithm;
  }

  /**
   * Get RNG state
   */
  getState(): RNGState {
    return {
      seed: this.currentSeed,
      internalState: this.prng.getState(),
    };
  }

  /**
   * Set RNG state
   */
  setState(state: RNGState): void {
    this.currentSeed = state.seed;
    this.prng.setState(state.internalState);

    logger.info('RNG state restored', {
      operation: 'setState',
      seed: state.seed,
      stateSize: state.internalState.length,
    });
  }

  /**
   * Get statistics
   */
  getStats(): RNGStats {
    return {
      algorithm: this.algorithm,
      seed: this.currentSeed,
      randomCalls: this.randomCallsCounter.getValue(),
      randomValuesCalls: this.randomValuesCallsCounter.getValue(),
      bytesGenerated: this.bytesGeneratedCounter.getValue(),
    };
  }

  /**
   * Export RNG data
   */
  export(): string {
    return JSON.stringify(
      {
        algorithm: this.algorithm,
        seed: this.currentSeed,
        state: this.getState(),
        stats: this.getStats(),
      },
      null,
      2
    );
  }
}

export interface RNGStats {
  algorithm: PRNGAlgorithm;
  seed: number;
  randomCalls: number;
  randomValuesCalls: number;
  bytesGenerated: number;
}

/**
 * Create a new virtual RNG
 */
export function createVirtualRNG(
  seed?: number,
  algorithm?: PRNGAlgorithm
): VirtualRNG {
  return new VirtualRNGImpl(seed, algorithm);
}
