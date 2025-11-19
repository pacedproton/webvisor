/**
 * Type definitions for the trap layer
 */

import type { TrapHandler, VirtualTimestamp } from '../types.js';

/**
 * Trap layer interface - intercepts all web API calls
 */
export interface TrapLayer {
  /**
   * DOM API trap handler
   */
  dom: DOMTrapHandler;

  /**
   * Network API trap handler
   */
  network: NetworkTrapHandler;

  /**
   * Storage API trap handler
   */
  storage: StorageTrapHandler;

  /**
   * Timing API trap handler
   */
  timing: TimingTrapHandler;

  /**
   * Random API trap handler
   */
  random: RandomTrapHandler;

  /**
   * Graphics API trap handler (Canvas/WebGL)
   */
  graphics: GraphicsTrapHandler;

  /**
   * Concurrency API trap handler (Workers)
   */
  concurrency: ConcurrencyTrapHandler;

  /**
   * Initialize all trap handlers
   */
  init(): void;

  /**
   * Cleanup all trap handlers
   */
  cleanup(): void;

  /**
   * Enable/disable specific trap handler
   */
  setEnabled(api: string, enabled: boolean): void;
}

/**
 * DOM API trap handler
 */
export interface DOMTrapHandler extends TrapHandler {
  /**
   * Trap createElement
   */
  trapCreateElement(tagName: string): Element;

  /**
   * Trap appendChild
   */
  trapAppendChild(parent: Node, child: Node): Node;

  /**
   * Trap removeChild
   */
  trapRemoveChild(parent: Node, child: Node): Node;

  /**
   * Trap setAttribute
   */
  trapSetAttribute(element: Element, name: string, value: string): void;

  /**
   * Trap addEventListener
   */
  trapAddEventListener(
    target: EventTarget,
    type: string,
    listener: EventListener,
    options?: AddEventListenerOptions
  ): void;
}

/**
 * Network API trap handler
 */
export interface NetworkTrapHandler extends TrapHandler {
  /**
   * Trap fetch
   */
  trapFetch(input: RequestInfo, init?: RequestInit): Promise<Response>;

  /**
   * Trap XMLHttpRequest
   */
  trapXHR(): XMLHttpRequest;

  /**
   * Trap WebSocket
   */
  trapWebSocket(url: string, protocols?: string | string[]): WebSocket;
}

/**
 * Storage API trap handler
 */
export interface StorageTrapHandler extends TrapHandler {
  /**
   * Trap localStorage
   */
  trapLocalStorage(): Storage;

  /**
   * Trap sessionStorage
   */
  trapSessionStorage(): Storage;

  /**
   * Trap indexedDB
   */
  trapIndexedDB(): IDBFactory;

  /**
   * Trap Cache API
   */
  trapCaches(): CacheStorage;
}

/**
 * Timing API trap handler
 */
export interface TimingTrapHandler extends TrapHandler {
  /**
   * Trap setTimeout
   */
  trapSetTimeout(callback: () => void, delay: number): number;

  /**
   * Trap setInterval
   */
  trapSetInterval(callback: () => void, delay: number): number;

  /**
   * Trap clearTimeout
   */
  trapClearTimeout(id: number): void;

  /**
   * Trap clearInterval
   */
  trapClearInterval(id: number): void;

  /**
   * Trap Date.now
   */
  trapDateNow(): number;

  /**
   * Trap performance.now
   */
  trapPerformanceNow(): number;

  /**
   * Trap requestAnimationFrame
   */
  trapRequestAnimationFrame(callback: () => void): number;

  /**
   * Trap cancelAnimationFrame
   */
  trapCancelAnimationFrame(id: number): void;
}

/**
 * Random API trap handler
 */
export interface RandomTrapHandler extends TrapHandler {
  /**
   * Trap Math.random
   */
  trapMathRandom(): number;

  /**
   * Trap crypto.getRandomValues
   */
  trapGetRandomValues<T extends ArrayBufferView>(array: T): T;

  /**
   * Set random seed for deterministic behavior
   */
  setSeed(seed: number): void;
}

/**
 * Graphics API trap handler
 */
export interface GraphicsTrapHandler extends TrapHandler {
  /**
   * Trap getContext for canvas
   */
  trapGetContext(
    canvas: HTMLCanvasElement,
    contextType: string,
    options?: unknown
  ): RenderingContext | null;

  /**
   * Trap WebGL operations
   */
  trapWebGL(gl: WebGLRenderingContext): WebGLRenderingContext;
}

/**
 * Concurrency API trap handler
 */
export interface ConcurrencyTrapHandler extends TrapHandler {
  /**
   * Trap Worker constructor
   */
  trapWorker(scriptURL: string, options?: WorkerOptions): Worker;

  /**
   * Trap ServiceWorker registration
   */
  trapServiceWorker(
    scriptURL: string,
    options?: RegistrationOptions
  ): Promise<ServiceWorkerRegistration>;
}

/**
 * Trap policy - determines how to handle trapped calls
 */
export type TrapPolicy = 'allow' | 'deny' | 'virtualize' | 'passthrough';

/**
 * Trap context - metadata about trapped call
 */
export interface TrapContext {
  /**
   * API being called
   */
  api: string;

  /**
   * Method being called
   */
  method: string;

  /**
   * Arguments
   */
  args: unknown[];

  /**
   * Call stack
   */
  stack: string;

  /**
   * Timestamp
   */
  timestamp: VirtualTimestamp;

  /**
   * Policy to apply
   */
  policy: TrapPolicy;
}

/**
 * Trap event - emitted when API is trapped
 */
export interface TrapEvent {
  /**
   * Event type
   */
  type: 'before' | 'after' | 'error';

  /**
   * Trap context
   */
  context: TrapContext;

  /**
   * Return value (for 'after' events)
   */
  returnValue?: unknown;

  /**
   * Error (for 'error' events)
   */
  error?: Error;

  /**
   * Duration in microseconds (for 'after' events)
   */
  duration?: number;
}
