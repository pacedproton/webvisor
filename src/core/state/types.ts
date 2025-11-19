/**
 * Type definitions for state management
 */

import type { VirtualTimestamp, ExecutionState } from '../types.js';
import type { VirtualPlatformState } from '../virtual-platform/types.js';
import type { RuntimeState } from '../runtime/types.js';

/**
 * State manager for snapshots and time-travel
 */
export interface StateManager {
  /**
   * Create snapshot of current state
   */
  snapshot(): StateSnapshot;

  /**
   * Restore from snapshot
   */
  restore(snapshot: StateSnapshot): Promise<void>;

  /**
   * Get snapshot history
   */
  getHistory(): StateSnapshot[];

  /**
   * Clear snapshot history
   */
  clearHistory(): void;

  /**
   * Rewind to earlier state
   */
  rewind(steps: number): Promise<void>;

  /**
   * Forward to later state
   */
  forward(steps: number): Promise<void>;

  /**
   * Get current position in history
   */
  getCurrentPosition(): number;

  /**
   * Export state as JSON
   */
  export(snapshot: StateSnapshot): string;

  /**
   * Import state from JSON
   */
  import(data: string): StateSnapshot;
}

/**
 * Complete state snapshot
 */
export interface StateSnapshot {
  /**
   * Snapshot ID
   */
  id: string;

  /**
   * Timestamp when snapshot was created
   */
  timestamp: VirtualTimestamp;

  /**
   * Virtual platform state
   */
  platform: VirtualPlatformState;

  /**
   * Runtime state
   */
  runtime: RuntimeState;

  /**
   * Execution state
   */
  execution: ExecutionState;

  /**
   * Custom application state
   */
  custom?: Record<string, unknown>;

  /**
   * Metadata
   */
  metadata: SnapshotMetadata;
}

/**
 * Snapshot metadata
 */
export interface SnapshotMetadata {
  /**
   * Size in bytes
   */
  size: number;

  /**
   * Compression used
   */
  compression?: 'none' | 'gzip' | 'lzma';

  /**
   * Hash for integrity checking
   */
  hash?: string;

  /**
   * User-provided label
   */
  label?: string;

  /**
   * Tags for categorization
   */
  tags?: string[];

  /**
   * Parent snapshot ID (for incremental snapshots)
   */
  parent?: string;

  /**
   * Whether this is an incremental snapshot
   */
  incremental: boolean;
}

/**
 * Incremental snapshot (only changes)
 */
export interface IncrementalSnapshot {
  /**
   * Base snapshot ID
   */
  base: string;

  /**
   * Changes since base
   */
  delta: StateDelta;

  /**
   * Timestamp
   */
  timestamp: VirtualTimestamp;
}

/**
 * State delta for incremental snapshots
 */
export interface StateDelta {
  /**
   * DOM changes
   */
  dom?: DOMDelta;

  /**
   * Network changes
   */
  network?: NetworkDelta;

  /**
   * Storage changes
   */
  storage?: StorageDelta;

  /**
   * Clock changes
   */
  clock?: ClockDelta;

  /**
   * Runtime changes
   */
  runtime?: RuntimeDelta;
}

/**
 * DOM delta
 */
export interface DOMDelta {
  /**
   * Added nodes
   */
  added: Array<{ id: string; node: unknown }>;

  /**
   * Removed nodes
   */
  removed: string[];

  /**
   * Modified nodes
   */
  modified: Array<{ id: string; changes: unknown }>;
}

/**
 * Network delta
 */
export interface NetworkDelta {
  /**
   * New requests
   */
  newRequests: unknown[];

  /**
   * Completed requests
   */
  completedRequests: string[];

  /**
   * Cache changes
   */
  cacheChanges: unknown[];
}

/**
 * Storage delta
 */
export interface StorageDelta {
  /**
   * localStorage changes
   */
  localStorage: Record<string, string | null>;

  /**
   * sessionStorage changes
   */
  sessionStorage: Record<string, string | null>;

  /**
   * IndexedDB changes
   */
  indexedDB: unknown[];
}

/**
 * Clock delta
 */
export interface ClockDelta {
  /**
   * Time advanced
   */
  timeAdvanced: number;

  /**
   * New scheduled callbacks
   */
  newCallbacks: unknown[];

  /**
   * Cancelled callbacks
   */
  cancelledCallbacks: number[];
}

/**
 * Runtime delta
 */
export interface RuntimeDelta {
  /**
   * New tasks
   */
  newTasks: unknown[];

  /**
   * Completed tasks
   */
  completedTasks: number[];

  /**
   * Resource changes
   */
  resourceChanges: unknown;
}

/**
 * Snapshot compression strategy
 */
export interface CompressionStrategy {
  /**
   * Compress snapshot
   */
  compress(data: StateSnapshot): Promise<Uint8Array>;

  /**
   * Decompress snapshot
   */
  decompress(data: Uint8Array): Promise<StateSnapshot>;

  /**
   * Estimated compression ratio
   */
  estimateRatio(data: StateSnapshot): number;
}

/**
 * Snapshot storage backend
 */
export interface SnapshotStorage {
  /**
   * Save snapshot
   */
  save(snapshot: StateSnapshot): Promise<void>;

  /**
   * Load snapshot
   */
  load(id: string): Promise<StateSnapshot>;

  /**
   * Delete snapshot
   */
  delete(id: string): Promise<void>;

  /**
   * List all snapshots
   */
  list(): Promise<SnapshotMetadata[]>;

  /**
   * Get storage usage
   */
  getUsage(): Promise<number>;

  /**
   * Clear all snapshots
   */
  clear(): Promise<void>;
}

/**
 * Time-travel operations
 */
export interface TimeTravelOperations {
  /**
   * Go to specific snapshot
   */
  goto(snapshotId: string): Promise<void>;

  /**
   * Step backward one operation
   */
  stepBack(): Promise<void>;

  /**
   * Step forward one operation
   */
  stepForward(): Promise<void>;

  /**
   * Continue backward until condition
   */
  continueBack(condition: (snapshot: StateSnapshot) => boolean): Promise<void>;

  /**
   * Continue forward until condition
   */
  continueForward(
    condition: (snapshot: StateSnapshot) => boolean
  ): Promise<void>;

  /**
   * Find snapshots matching criteria
   */
  find(criteria: SnapshotCriteria): StateSnapshot[];

  /**
   * Compare two snapshots
   */
  compare(a: StateSnapshot, b: StateSnapshot): StateDelta;
}

/**
 * Snapshot search criteria
 */
export interface SnapshotCriteria {
  /**
   * Time range
   */
  timeRange?: {
    start: VirtualTimestamp;
    end: VirtualTimestamp;
  };

  /**
   * Tags
   */
  tags?: string[];

  /**
   * Label pattern
   */
  label?: string | RegExp;

  /**
   * Custom predicate
   */
  predicate?: (snapshot: StateSnapshot) => boolean;
}
