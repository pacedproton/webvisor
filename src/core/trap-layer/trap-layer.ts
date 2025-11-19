/**
 * Trap Layer Implementation
 * Intercepts all web API calls using proxies and method wrapping
 */

import type {
  TrapLayer,
  DOMTrapHandler,
  NetworkTrapHandler,
  StorageTrapHandler,
  TimingTrapHandler,
  RandomTrapHandler,
  TrapPolicy,
  TrapContext,
  TrapEvent,
} from './types.js';
import type { VirtualClock } from '../virtual-platform/types.js';
import type { VirtualDOM } from '../virtual-platform/types.js';
import type { VirtualRNG } from '../virtual-platform/types.js';
import { getLogger } from '../../utils/instrumentation/logger.js';
import { getMetrics } from '../../utils/instrumentation/metrics.js';
import { getTracer } from '../../utils/instrumentation/tracer.js';

const logger = getLogger('trap-layer');
const metrics = getMetrics();
const tracer = getTracer();

/**
 * Timing trap handler implementation
 */
export class TimingTrapHandlerImpl implements TimingTrapHandler {
  private vClock: VirtualClock;
  private originalSetTimeout?: typeof setTimeout;
  private originalSetInterval?: typeof setInterval;
  private originalClearTimeout?: typeof clearTimeout;
  private originalClearInterval?: typeof clearInterval;
  private originalDateNow?: typeof Date.now;
  private originalPerformanceNow?: typeof performance.now;
  private originalRAF?: typeof requestAnimationFrame;
  private originalCAF?: typeof cancelAnimationFrame;

  constructor(vClock: VirtualClock) {
    this.vClock = vClock;
  }

  intercept(target: unknown, thisArg: unknown, args: unknown[]): unknown {
    // Route to appropriate method
    if (target === setTimeout) {
      return this.trapSetTimeout(args[0] as () => void, args[1] as number);
    }
    return undefined;
  }

  canHandle(api: string): boolean {
    return api.startsWith('timing.');
  }

  init(): void {
    // Save originals
    this.originalSetTimeout = globalThis.setTimeout;
    this.originalSetInterval = globalThis.setInterval;
    this.originalClearTimeout = globalThis.clearTimeout;
    this.originalClearInterval = globalThis.clearInterval;
    this.originalDateNow = Date.now;
    this.originalPerformanceNow = performance.now;
    this.originalRAF = requestAnimationFrame;
    this.originalCAF = cancelAnimationFrame;

    // Override globals
    const self = this;

    globalThis.setTimeout = function (callback: () => void, delay: number): number {
      return self.trapSetTimeout(callback, delay);
    } as any;

    globalThis.setInterval = function (callback: () => void, delay: number): number {
      return self.trapSetInterval(callback, delay);
    } as any;

    globalThis.clearTimeout = function (id: number): void {
      return self.trapClearTimeout(id);
    };

    globalThis.clearInterval = function (id: number): void {
      return self.trapClearInterval(id);
    };

    Date.now = (): number => {
      return self.trapDateNow();
    };

    performance.now = (): number => {
      return self.trapPerformanceNow();
    };

    globalThis.requestAnimationFrame = (callback: FrameRequestCallback): number => {
      return self.trapRequestAnimationFrame(callback);
    };

    globalThis.cancelAnimationFrame = (id: number): void => {
      return self.trapCancelAnimationFrame(id);
    };

    logger.info('Timing trap handler initialized');
    metrics.counter('trap.timing.initialized').inc();
  }

  cleanup(): void {
    if (this.originalSetTimeout) globalThis.setTimeout = this.originalSetTimeout;
    if (this.originalSetInterval) globalThis.setInterval = this.originalSetInterval;
    if (this.originalClearTimeout) globalThis.clearTimeout = this.originalClearTimeout;
    if (this.originalClearInterval) globalThis.clearInterval = this.originalClearInterval;
    if (this.originalDateNow) Date.now = this.originalDateNow;
    if (this.originalPerformanceNow) performance.now = this.originalPerformanceNow;
    if (this.originalRAF) globalThis.requestAnimationFrame = this.originalRAF;
    if (this.originalCAF) globalThis.cancelAnimationFrame = this.originalCAF;

    logger.info('Timing trap handler cleaned up');
  }

  trapSetTimeout(callback: () => void, delay: number): number {
    metrics.counter('trap.setTimeout').inc();
    logger.trace('setTimeout trapped', { delay });
    return this.vClock.setTimeout(callback, delay);
  }

  trapSetInterval(callback: () => void, delay: number): number {
    metrics.counter('trap.setInterval').inc();
    logger.trace('setInterval trapped', { delay });
    return this.vClock.setInterval(callback, delay);
  }

  trapClearTimeout(id: number): void {
    metrics.counter('trap.clearTimeout').inc();
    this.vClock.clearTimeout(id);
  }

  trapClearInterval(id: number): void {
    metrics.counter('trap.clearInterval').inc();
    this.vClock.clearInterval(id);
  }

  trapDateNow(): number {
    metrics.counter('trap.Date.now').inc();
    return this.vClock.now().value;
  }

  trapPerformanceNow(): number {
    metrics.counter('trap.performance.now').inc();
    return this.vClock.now().value;
  }

  trapRequestAnimationFrame(callback: FrameRequestCallback): number {
    metrics.counter('trap.requestAnimationFrame').inc();
    return this.vClock.requestAnimationFrame(callback as any);
  }

  trapCancelAnimationFrame(id: number): void {
    metrics.counter('trap.cancelAnimationFrame').inc();
    this.vClock.cancelAnimationFrame(id);
  }
}

/**
 * Random trap handler implementation
 */
export class RandomTrapHandlerImpl implements RandomTrapHandler {
  private vRNG: VirtualRNG;
  private originalMathRandom?: typeof Math.random;
  private originalCryptoGetRandomValues?: typeof crypto.getRandomValues;

  constructor(vRNG: VirtualRNG) {
    this.vRNG = vRNG;
  }

  intercept(target: unknown, thisArg: unknown, args: unknown[]): unknown {
    if (target === Math.random) {
      return this.trapMathRandom();
    }
    return undefined;
  }

  canHandle(api: string): boolean {
    return api.startsWith('random.');
  }

  init(): void {
    this.originalMathRandom = Math.random;
    this.originalCryptoGetRandomValues = crypto.getRandomValues.bind(crypto);

    const self = this;

    Math.random = (): number => {
      return self.trapMathRandom();
    };

    crypto.getRandomValues = <T extends ArrayBufferView>(array: T): T => {
      return self.trapGetRandomValues(array);
    };

    logger.info('Random trap handler initialized');
    metrics.counter('trap.random.initialized').inc();
  }

  cleanup(): void {
    if (this.originalMathRandom) Math.random = this.originalMathRandom;
    if (this.originalCryptoGetRandomValues) {
      crypto.getRandomValues = this.originalCryptoGetRandomValues;
    }

    logger.info('Random trap handler cleaned up');
  }

  trapMathRandom(): number {
    metrics.counter('trap.Math.random').inc();
    return this.vRNG.random();
  }

  trapGetRandomValues<T extends ArrayBufferView>(array: T): T {
    metrics.counter('trap.crypto.getRandomValues').inc();
    return this.vRNG.getRandomValues(array);
  }

  setSeed(seed: number): void {
    this.vRNG.seed(seed);
    logger.info('RNG seed set via trap', { seed });
  }
}

/**
 * DOM trap handler implementation
 */
export class DOMTrapHandlerImpl implements DOMTrapHandler {
  private vDOM: VirtualDOM;

  constructor(vDOM: VirtualDOM) {
    this.vDOM = vDOM;
  }

  intercept(target: unknown, thisArg: unknown, args: unknown[]): unknown {
    // This would route based on what DOM method is being called
    return undefined;
  }

  canHandle(api: string): boolean {
    return api.startsWith('dom.');
  }

  init(): void {
    // In a real implementation, we'd intercept document.createElement, etc.
    logger.info('DOM trap handler initialized');
    metrics.counter('trap.dom.initialized').inc();
  }

  cleanup(): void {
    logger.info('DOM trap handler cleaned up');
  }

  trapCreateElement(tagName: string): Element {
    metrics.counter('trap.createElement').inc();
    logger.trace('createElement trapped', { tagName });
    return this.vDOM.createElement(tagName) as any;
  }

  trapAppendChild(parent: Node, child: Node): Node {
    metrics.counter('trap.appendChild').inc();
    return child; // Simplified
  }

  trapRemoveChild(parent: Node, child: Node): Node {
    metrics.counter('trap.removeChild').inc();
    return child; // Simplified
  }

  trapSetAttribute(element: Element, name: string, value: string): void {
    metrics.counter('trap.setAttribute').inc();
    logger.trace('setAttribute trapped', { name, value });
  }

  trapAddEventListener(
    target: EventTarget,
    type: string,
    listener: EventListener,
    options?: AddEventListenerOptions
  ): void {
    metrics.counter('trap.addEventListener').inc();
    logger.trace('addEventListener trapped', { type });
  }
}

/**
 * Network trap handler stub
 */
export class NetworkTrapHandlerImpl implements NetworkTrapHandler {
  private originalFetch?: typeof fetch;

  intercept(target: unknown, thisArg: unknown, args: unknown[]): unknown {
    return undefined;
  }

  canHandle(api: string): boolean {
    return api.startsWith('network.');
  }

  init(): void {
    this.originalFetch = globalThis.fetch;

    const self = this;
    globalThis.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      return self.trapFetch(input, init);
    };

    logger.info('Network trap handler initialized');
    metrics.counter('trap.network.initialized').inc();
  }

  cleanup(): void {
    if (this.originalFetch) globalThis.fetch = this.originalFetch;
    logger.info('Network trap handler cleaned up');
  }

  trapFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    metrics.counter('trap.fetch').inc();
    logger.trace('fetch trapped', { url: input.toString() });

    // For now, pass through to original
    return this.originalFetch!(input, init);
  }

  trapXHR(): XMLHttpRequest {
    metrics.counter('trap.XMLHttpRequest').inc();
    return new XMLHttpRequest();
  }

  trapWebSocket(url: string, protocols?: string | string[]): WebSocket {
    metrics.counter('trap.WebSocket').inc();
    return new WebSocket(url, protocols);
  }
}

/**
 * Storage trap handler stub
 */
export class StorageTrapHandlerImpl implements StorageTrapHandler {
  intercept(target: unknown, thisArg: unknown, args: unknown[]): unknown {
    return undefined;
  }

  canHandle(api: string): boolean {
    return api.startsWith('storage.');
  }

  init(): void {
    logger.info('Storage trap handler initialized');
    metrics.counter('trap.storage.initialized').inc();
  }

  cleanup(): void {
    logger.info('Storage trap handler cleaned up');
  }

  trapLocalStorage(): Storage {
    metrics.counter('trap.localStorage').inc();
    return localStorage;
  }

  trapSessionStorage(): Storage {
    metrics.counter('trap.sessionStorage').inc();
    return sessionStorage;
  }

  trapIndexedDB(): IDBFactory {
    metrics.counter('trap.indexedDB').inc();
    return indexedDB;
  }

  trapCaches(): CacheStorage {
    metrics.counter('trap.caches').inc();
    return caches;
  }
}

/**
 * Main Trap Layer implementation
 */
export class TrapLayerImpl implements TrapLayer {
  dom: DOMTrapHandler;
  network: NetworkTrapHandler;
  storage: StorageTrapHandler;
  timing: TimingTrapHandler;
  random: RandomTrapHandler;
  graphics: any; // Stub
  concurrency: any; // Stub

  private enabled = new Map<string, boolean>();
  private eventListeners = new Set<(event: TrapEvent) => void>();

  constructor(
    vClock: VirtualClock,
    vRNG: VirtualRNG,
    vDOM: VirtualDOM
  ) {
    this.timing = new TimingTrapHandlerImpl(vClock);
    this.random = new RandomTrapHandlerImpl(vRNG);
    this.dom = new DOMTrapHandlerImpl(vDOM);
    this.network = new NetworkTrapHandlerImpl();
    this.storage = new StorageTrapHandlerImpl();
    this.graphics = {}; // Stub
    this.concurrency = {}; // Stub

    logger.info('Trap layer created');
  }

  init(): void {
    return tracer.trace('trap-layer.init', (span) => {
      this.timing.init?.();
      this.random.init?.();
      this.dom.init?.();
      this.network.init?.();
      this.storage.init?.();

      // Enable all by default
      this.enabled.set('timing', true);
      this.enabled.set('random', true);
      this.enabled.set('dom', true);
      this.enabled.set('network', true);
      this.enabled.set('storage', true);

      logger.info('Trap layer initialized');
      metrics.counter('trap.layer.initialized').inc();

      span.setAttribute('handlers', 5);
    }) as void;
  }

  cleanup(): void {
    this.timing.cleanup?.();
    this.random.cleanup?.();
    this.dom.cleanup?.();
    this.network.cleanup?.();
    this.storage.cleanup?.();

    this.enabled.clear();
    this.eventListeners.clear();

    logger.info('Trap layer cleaned up');
  }

  setEnabled(api: string, enabled: boolean): void {
    this.enabled.set(api, enabled);
    logger.info('Trap handler enabled state changed', { api, enabled });
  }

  isEnabled(api: string): boolean {
    return this.enabled.get(api) ?? false;
  }

  /**
   * Add event listener for trap events
   */
  addEventListener(listener: (event: TrapEvent) => void): void {
    this.eventListeners.add(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: (event: TrapEvent) => void): void {
    this.eventListeners.delete(listener);
  }

  /**
   * Emit trap event
   */
  private emitEvent(event: TrapEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        logger.error('Trap event listener error', error);
      }
    }
  }
}

/**
 * Create trap layer
 */
export function createTrapLayer(
  vClock: VirtualClock,
  vRNG: VirtualRNG,
  vDOM: VirtualDOM
): TrapLayer {
  return new TrapLayerImpl(vClock, vRNG, vDOM);
}
