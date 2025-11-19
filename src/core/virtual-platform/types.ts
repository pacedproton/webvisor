/**
 * Type definitions for the virtual platform layer
 */

import type { VirtualTimestamp } from '../types.js';

/**
 * Virtual platform - provides virtualized implementations of web APIs
 */
export interface VirtualPlatform {
  /**
   * Virtual DOM
   */
  vDOM: VirtualDOM;

  /**
   * Virtual network stack
   */
  vNetwork: VirtualNetwork;

  /**
   * Virtual storage layer
   */
  vStorage: VirtualStorage;

  /**
   * Virtual clock
   */
  vClock: VirtualClock;

  /**
   * Virtual random number generator
   */
  vRNG: VirtualRNG;

  /**
   * Initialize the virtual platform
   */
  init(): void;

  /**
   * Reset the virtual platform
   */
  reset(): void;

  /**
   * Get current state
   */
  getState(): VirtualPlatformState;

  /**
   * Restore state
   */
  setState(state: VirtualPlatformState): void;
}

/**
 * Virtual platform state for snapshots
 */
export interface VirtualPlatformState {
  dom: SerializedDOM;
  network: NetworkState;
  storage: StorageState;
  clock: ClockState;
  rng: RNGState;
}

/**
 * Virtual DOM interface
 */
export interface VirtualDOM {
  /**
   * Create element
   */
  createElement(tagName: string): VirtualElement;

  /**
   * Create text node
   */
  createTextNode(data: string): VirtualText;

  /**
   * Query selector
   */
  querySelector(selector: string): VirtualElement | null;

  /**
   * Query selector all
   */
  querySelectorAll(selector: string): VirtualElement[];

  /**
   * Get document element
   */
  getDocument(): VirtualDocument;

  /**
   * Serialize DOM to JSON
   */
  serialize(): SerializedDOM;

  /**
   * Deserialize DOM from JSON
   */
  deserialize(data: SerializedDOM): void;
}

/**
 * Virtual element
 */
export interface VirtualElement {
  tagName: string;
  attributes: Map<string, string>;
  children: VirtualNode[];
  eventListeners: Map<string, EventListener[]>;

  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
  appendChild(child: VirtualNode): void;
  removeChild(child: VirtualNode): void;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}

/**
 * Virtual text node
 */
export interface VirtualText {
  data: string;
}

/**
 * Virtual node (element or text)
 */
export type VirtualNode = VirtualElement | VirtualText;

/**
 * Virtual document
 */
export interface VirtualDocument extends VirtualElement {
  body: VirtualElement;
  head: VirtualElement;
}

/**
 * Serialized DOM for snapshots
 */
export interface SerializedDOM {
  nodes: SerializedNode[];
  rootId: string;
}

/**
 * Serialized DOM node
 */
export interface SerializedNode {
  id: string;
  type: 'element' | 'text';
  tagName?: string;
  attributes?: Record<string, string>;
  data?: string;
  children?: string[];
}

/**
 * Virtual network stack
 */
export interface VirtualNetwork {
  /**
   * Virtual fetch implementation
   */
  fetch: VirtualFetch;

  /**
   * Virtual XMLHttpRequest
   */
  xhr: VirtualXMLHttpRequest;

  /**
   * Virtual WebSocket
   */
  ws: VirtualWebSocket;

  /**
   * Get network state
   */
  getState(): NetworkState;

  /**
   * Set network state
   */
  setState(state: NetworkState): void;
}

/**
 * Virtual fetch implementation
 */
export interface VirtualFetch {
  (input: RequestInfo, init?: RequestInit): Promise<Response>;

  /**
   * Mock a request
   */
  mock(pattern: string | RegExp, handler: MockHandler): void;

  /**
   * Clear all mocks
   */
  clearMocks(): void;
}

/**
 * Mock handler for network requests
 */
export type MockHandler = (
  request: Request
) => Response | Promise<Response> | MockResponse;

/**
 * Mock response definition
 */
export interface MockResponse {
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: string | object;
  delay?: number;
}

/**
 * Virtual XMLHttpRequest (stub for now)
 */
export type VirtualXMLHttpRequest = typeof XMLHttpRequest;

/**
 * Virtual WebSocket (stub for now)
 */
export type VirtualWebSocket = typeof WebSocket;

/**
 * Network state for snapshots
 */
export interface NetworkState {
  /**
   * In-flight requests
   */
  inFlightRequests: InFlightRequest[];

  /**
   * Request/response cache
   */
  cache: CachedResponse[];

  /**
   * Mock configurations
   */
  mocks: MockConfiguration[];
}

/**
 * In-flight request
 */
export interface InFlightRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timestamp: VirtualTimestamp;
}

/**
 * Cached response
 */
export interface CachedResponse {
  url: string;
  status: number;
  headers: Record<string, string>;
  body: string;
  timestamp: VirtualTimestamp;
}

/**
 * Mock configuration
 */
export interface MockConfiguration {
  pattern: string;
  response: MockResponse;
}

/**
 * Virtual storage layer
 */
export interface VirtualStorage {
  /**
   * Virtual localStorage
   */
  localStorage: VirtualLocalStorage;

  /**
   * Virtual sessionStorage
   */
  sessionStorage: VirtualLocalStorage;

  /**
   * Virtual IndexedDB
   */
  indexedDB: VirtualIndexedDB;

  /**
   * Get storage state
   */
  getState(): StorageState;

  /**
   * Set storage state
   */
  setState(state: StorageState): void;
}

/**
 * Virtual localStorage/sessionStorage
 */
export interface VirtualLocalStorage extends Storage {
  serialize(): Record<string, string>;
  deserialize(data: Record<string, string>): void;
}

/**
 * Virtual IndexedDB (stub for now)
 */
export type VirtualIndexedDB = IDBFactory;

/**
 * Storage state for snapshots
 */
export interface StorageState {
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  indexedDB: SerializedIndexedDB;
}

/**
 * Serialized IndexedDB state
 */
export interface SerializedIndexedDB {
  databases: SerializedDatabase[];
}

/**
 * Serialized database
 */
export interface SerializedDatabase {
  name: string;
  version: number;
  objectStores: SerializedObjectStore[];
}

/**
 * Serialized object store
 */
export interface SerializedObjectStore {
  name: string;
  keyPath: string | string[];
  autoIncrement: boolean;
  data: Array<{ key: unknown; value: unknown }>;
}

/**
 * Virtual clock for deterministic time
 */
export interface VirtualClock {
  /**
   * Get current virtual time
   */
  now(): VirtualTimestamp;

  /**
   * Advance clock by milliseconds
   */
  advance(ms: number): void;

  /**
   * Set absolute time
   */
  setTime(time: number): void;

  /**
   * Schedule callback at specific time
   */
  schedule(callback: () => void, time: VirtualTimestamp): number;

  /**
   * Cancel scheduled callback
   */
  cancel(id: number): void;

  /**
   * Get clock state
   */
  getState(): ClockState;

  /**
   * Set clock state
   */
  setState(state: ClockState): void;
}

/**
 * Clock state for snapshots
 */
export interface ClockState {
  /**
   * Current virtual time
   */
  currentTime: VirtualTimestamp;

  /**
   * Scheduled callbacks
   */
  scheduled: ScheduledCallback[];
}

/**
 * Scheduled callback
 */
export interface ScheduledCallback {
  id: number;
  callback: () => void;
  time: VirtualTimestamp;
  type: 'timeout' | 'interval' | 'animationFrame';
  interval?: number;
}

/**
 * Virtual random number generator
 */
export interface VirtualRNG {
  /**
   * Generate random number [0, 1)
   */
  random(): number;

  /**
   * Fill array with random values
   */
  getRandomValues<T extends ArrayBufferView>(array: T): T;

  /**
   * Set seed for deterministic randomness
   */
  seed(value: number): void;

  /**
   * Get RNG state
   */
  getState(): RNGState;

  /**
   * Set RNG state
   */
  setState(state: RNGState): void;
}

/**
 * RNG state for snapshots
 */
export interface RNGState {
  /**
   * Current seed
   */
  seed: number;

  /**
   * Internal state (algorithm-specific)
   */
  internalState: number[];
}
