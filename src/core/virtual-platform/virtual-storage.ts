/**
 * Virtual Storage Implementation
 * Provides virtualized localStorage, sessionStorage, and IndexedDB
 */

import type {
  VirtualStorage,
  VirtualLocalStorage,
  StorageState,
} from './types.js';
import { getLogger } from '../../utils/instrumentation/logger.js';
import { getMetrics } from '../../utils/instrumentation/metrics.js';

const logger = getLogger('virtual-storage');
const metrics = getMetrics();

/**
 * Virtual localStorage/sessionStorage implementation
 */
export class VirtualLocalStorageImpl implements VirtualLocalStorage {
  private data = new Map<string, string>();
  private name: string;

  constructor(name: string = 'localStorage') {
    this.name = name;
    logger.info(`Virtual ${name} initialized`);
  }

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    const count = this.data.size;
    this.data.clear();

    metrics.counter(`vstorage.${this.name}.clear`).inc();

    logger.debug(`${this.name} cleared`, {
      operation: 'clear',
      clearedItems: count,
    });
  }

  getItem(key: string): string | null {
    const value = this.data.get(key) ?? null;

    metrics.counter(`vstorage.${this.name}.getItem`).inc();

    logger.trace(`${this.name} getItem`, {
      operation: 'getItem',
      key,
      found: value !== null,
    });

    return value;
  }

  key(index: number): string | null {
    const keys = Array.from(this.data.keys());
    return keys[index] ?? null;
  }

  removeItem(key: string): void {
    const existed = this.data.has(key);
    this.data.delete(key);

    metrics.counter(`vstorage.${this.name}.removeItem`).inc();

    logger.debug(`${this.name} removeItem`, {
      operation: 'removeItem',
      key,
      existed,
    });
  }

  setItem(key: string, value: string): void {
    const isUpdate = this.data.has(key);
    this.data.set(key, value);

    metrics.counter(`vstorage.${this.name}.setItem`).inc();

    logger.debug(`${this.name} setItem`, {
      operation: 'setItem',
      key,
      valueLength: value.length,
      isUpdate,
    });
  }

  serialize(): Record<string, string> {
    return Object.fromEntries(this.data);
  }

  deserialize(data: Record<string, string>): void {
    this.data.clear();

    for (const [key, value] of Object.entries(data)) {
      this.data.set(key, value);
    }

    logger.info(`${this.name} deserialized`, {
      operation: 'deserialize',
      itemCount: this.data.size,
    });
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.data.keys());
  }

  /**
   * Get all values
   */
  values(): string[] {
    return Array.from(this.data.values());
  }

  /**
   * Get all entries
   */
  entries(): [string, string][] {
    return Array.from(this.data.entries());
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    return this.data.has(key);
  }

  /**
   * Get storage size in bytes (approximate)
   */
  getSize(): number {
    let size = 0;

    for (const [key, value] of this.data) {
      size += key.length + value.length;
    }

    return size * 2; // UTF-16 characters = 2 bytes each
  }
}

/**
 * Virtual storage implementation
 */
export class VirtualStorageImpl implements VirtualStorage {
  localStorage: VirtualLocalStorage;
  sessionStorage: VirtualLocalStorage;
  indexedDB: IDBFactory | null; // Use native for now

  constructor() {
    this.localStorage = new VirtualLocalStorageImpl('localStorage');
    this.sessionStorage = new VirtualLocalStorageImpl('sessionStorage');
    // Check if indexedDB is available (not available in Node.js)
    this.indexedDB = typeof indexedDB !== 'undefined' ? indexedDB : null;

    logger.info('Virtual storage initialized');
  }

  getState(): StorageState {
    return {
      localStorage: this.localStorage.serialize(),
      sessionStorage: this.sessionStorage.serialize(),
      indexedDB: {
        databases: [], // TODO: Serialize IndexedDB
      },
    };
  }

  setState(state: StorageState): void {
    this.localStorage.deserialize(state.localStorage);
    this.sessionStorage.deserialize(state.sessionStorage);

    logger.info('Storage state restored', {
      operation: 'setState',
      localStorageItems: Object.keys(state.localStorage).length,
      sessionStorageItems: Object.keys(state.sessionStorage).length,
    });
  }

  /**
   * Clear all storage
   */
  clear(): void {
    this.localStorage.clear();
    this.sessionStorage.clear();

    logger.info('All storage cleared');
  }

  /**
   * Get total storage size
   */
  getTotalSize(): number {
    return this.localStorage.getSize() + this.sessionStorage.getSize();
  }

  /**
   * Export storage data as JSON
   */
  export(): string {
    return JSON.stringify(this.getState(), null, 2);
  }

  /**
   * Import storage data from JSON
   */
  import(data: string): void {
    const state = JSON.parse(data) as StorageState;
    this.setState(state);
  }
}

/**
 * Create virtual storage
 */
export function createVirtualStorage(): VirtualStorage {
  return new VirtualStorageImpl();
}
