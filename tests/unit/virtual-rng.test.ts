/**
 * Virtual RNG Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createVirtualRNG, PRNGAlgorithm } from '../../src/core/virtual-platform/virtual-rng.js';

describe('VirtualRNG', () => {
  describe('Determinism', () => {
    it('should produce same sequence with same seed', () => {
      const rng1 = createVirtualRNG(12345);
      const rng2 = createVirtualRNG(12345);

      const sequence1 = [rng1.random(), rng1.random(), rng1.random()];
      const sequence2 = [rng2.random(), rng2.random(), rng2.random()];

      expect(sequence1).toEqual(sequence2);
    });

    it('should produce different sequences with different seeds', () => {
      const rng1 = createVirtualRNG(12345);
      const rng2 = createVirtualRNG(54321);

      const sequence1 = [rng1.random(), rng1.random(), rng1.random()];
      const sequence2 = [rng2.random(), rng2.random(), rng2.random()];

      expect(sequence1).not.toEqual(sequence2);
    });

    it('should reset to same sequence when re-seeded', () => {
      const rng = createVirtualRNG(12345);
      const sequence1 = [rng.random(), rng.random(), rng.random()];

      rng.seed(12345);
      const sequence2 = [rng.random(), rng.random(), rng.random()];

      expect(sequence1).toEqual(sequence2);
    });
  });

  describe('Random Values', () => {
    it('should generate values in [0, 1) range', () => {
      const rng = createVirtualRNG();

      for (let i = 0; i < 100; i++) {
        const value = rng.random();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    it('should fill typed arrays', () => {
      const rng = createVirtualRNG(42);
      const array = new Uint8Array(10);

      rng.getRandomValues(array);

      // Check that values were filled
      let allZero = true;
      for (let i = 0; i < array.length; i++) {
        if (array[i] !== 0) {
          allZero = false;
          break;
        }
      }

      expect(allZero).toBe(false);
    });

    it('should produce consistent random bytes with same seed', () => {
      const rng1 = createVirtualRNG(999);
      const rng2 = createVirtualRNG(999);

      const bytes1 = rng1.randomBytes(16);
      const bytes2 = rng2.randomBytes(16);

      expect(Array.from(bytes1)).toEqual(Array.from(bytes2));
    });
  });

  describe('Utility Functions', () => {
    it('should generate random integers in range', () => {
      const rng = createVirtualRNG(123);

      for (let i = 0; i < 100; i++) {
        const value = rng.randomInt(10, 20);
        expect(value).toBeGreaterThanOrEqual(10);
        expect(value).toBeLessThan(20);
        expect(Number.isInteger(value)).toBe(true);
      }
    });

    it('should generate random booleans', () => {
      const rng = createVirtualRNG(456);
      let trueCount = 0;
      let falseCount = 0;

      for (let i = 0; i < 100; i++) {
        const value = rng.randomBool();
        if (value) trueCount++;
        else falseCount++;
      }

      // Both should occur
      expect(trueCount).toBeGreaterThan(0);
      expect(falseCount).toBeGreaterThan(0);
    });

    it('should shuffle arrays deterministically', () => {
      const rng1 = createVirtualRNG(789);
      const rng2 = createVirtualRNG(789);

      const arr1 = [1, 2, 3, 4, 5];
      const arr2 = [1, 2, 3, 4, 5];

      rng1.shuffle(arr1);
      rng2.shuffle(arr2);

      expect(arr1).toEqual(arr2);
      expect(arr1).not.toEqual([1, 2, 3, 4, 5]); // Should be shuffled
    });

    it('should pick random elements', () => {
      const rng = createVirtualRNG(321);
      const array = ['a', 'b', 'c', 'd', 'e'];

      const chosen = rng.choice(array);
      expect(array).toContain(chosen);
    });

    it('should throw when picking from empty array', () => {
      const rng = createVirtualRNG();
      expect(() => rng.choice([])).toThrow();
    });
  });

  describe('Algorithms', () => {
    it('should support multiple PRNG algorithms', () => {
      const algorithms = [
        PRNGAlgorithm.LCG,
        PRNGAlgorithm.XORSHIFT128,
        PRNGAlgorithm.PCG,
      ];

      for (const algo of algorithms) {
        const rng = createVirtualRNG(12345, algo);
        const value = rng.random();

        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
        expect(rng.getAlgorithm()).toBe(algo);
      }
    });

    it('should allow algorithm switching', () => {
      const rng = createVirtualRNG(12345, PRNGAlgorithm.LCG);
      expect(rng.getAlgorithm()).toBe(PRNGAlgorithm.LCG);

      rng.setAlgorithm(PRNGAlgorithm.XORSHIFT128);
      expect(rng.getAlgorithm()).toBe(PRNGAlgorithm.XORSHIFT128);
    });
  });

  describe('State Management', () => {
    it('should get state', () => {
      const rng = createVirtualRNG(12345);
      rng.random();

      const state = rng.getState();

      expect(state.seed).toBe(12345);
      expect(state.internalState).toBeDefined();
      expect(state.internalState.length).toBeGreaterThan(0);
    });

    it('should restore state', () => {
      const rng = createVirtualRNG(12345);
      const val1 = rng.random();
      const state = rng.getState();

      const val2 = rng.random();
      const val3 = rng.random();

      rng.setState(state);
      const val4 = rng.random();

      expect(val4).toBe(val2);
    });

    it('should export RNG data', () => {
      const rng = createVirtualRNG(12345);
      const exported = rng.export();

      expect(exported).toContain('algorithm');
      expect(exported).toContain('seed');
      expect(exported).toContain('state');
    });
  });

  describe('Statistics', () => {
    it('should track random calls', () => {
      const rng = createVirtualRNG();

      rng.random();
      rng.random();
      rng.random();

      const stats = rng.getStats();
      expect(stats.randomCalls).toBe(3);
    });

    it('should track random values calls', () => {
      const rng = createVirtualRNG();

      const array = new Uint8Array(10);
      rng.getRandomValues(array);

      const stats = rng.getStats();
      expect(stats.randomValuesCalls).toBe(1);
      expect(stats.bytesGenerated).toBe(10);
    });
  });
});
