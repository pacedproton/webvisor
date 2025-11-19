/**
 * State Manager for snapshots and time-travel
 * Enables recording and restoring complete application state
 */

import type {
  StateManager,
  StateSnapshot,
  SnapshotMetadata,
  IncrementalSnapshot,
  StateDelta,
  TimeTravelOperations,
  SnapshotCriteria,
  SnapshotStorage,
} from './types.js';
import type { VirtualTimestamp, ExecutionState } from '../types.js';
import type { VirtualPlatformState } from '../virtual-platform/types.js';
import type { RuntimeState } from '../runtime/types.js';
import { getLogger } from '../../utils/instrumentation/logger.js';
import { getMetrics } from '../../utils/instrumentation/metrics.js';
import { getTracer } from '../../utils/instrumentation/tracer.js';

const logger = getLogger('state-manager');
const metrics = getMetrics();
const tracer = getTracer();

/**
 * State Manager implementation
 */
export class StateManagerImpl implements StateManager, TimeTravelOperations {
  private snapshots: StateSnapshot[] = [];
  private currentPosition: number = -1;
  private maxSnapshots: number;
  private storage?: SnapshotStorage;

  // For providing state to snapshot
  private platformStateProvider?: () => VirtualPlatformState;
  private runtimeStateProvider?: () => RuntimeState;
  private executionStateProvider?: () => ExecutionState;

  // For restoring state
  private platformStateRestorer?: (state: VirtualPlatformState) => void;
  private runtimeStateRestorer?: (state: RuntimeState) => void;
  private executionStateRestorer?: (state: ExecutionState) => void;

  // Metrics
  private snapshotCounter = metrics.counter('state.snapshots_created');
  private restoreCounter = metrics.counter('state.snapshots_restored');
  private snapshotTimer = metrics.timer('state.snapshot_time');
  private restoreTimer = metrics.timer('state.restore_time');
  private snapshotSizeHistogram = metrics.histogram(
    'state.snapshot_size_bytes',
    [1024, 10240, 102400, 1024000, 10240000],
    'Snapshot size in bytes',
    'bytes'
  );

  constructor(config: StateManagerConfig = {}) {
    this.maxSnapshots = config.maxSnapshots ?? 1000;
    this.storage = config.storage;

    logger.info('State manager initialized', {
      operation: 'constructor',
      maxSnapshots: this.maxSnapshots,
      hasStorage: !!this.storage,
    });
  }

  /**
   * Register state providers
   */
  registerProviders(providers: {
    platform?: () => VirtualPlatformState;
    runtime?: () => RuntimeState;
    execution?: () => ExecutionState;
  }): void {
    this.platformStateProvider = providers.platform;
    this.runtimeStateProvider = providers.runtime;
    this.executionStateProvider = providers.execution;

    logger.debug('State providers registered', {
      operation: 'registerProviders',
      hasPlatform: !!providers.platform,
      hasRuntime: !!providers.runtime,
      hasExecution: !!providers.execution,
    });
  }

  /**
   * Register state restorers
   */
  registerRestorers(restorers: {
    platform?: (state: VirtualPlatformState) => void;
    runtime?: (state: RuntimeState) => void;
    execution?: (state: ExecutionState) => void;
  }): void {
    this.platformStateRestorer = restorers.platform;
    this.runtimeStateRestorer = restorers.runtime;
    this.executionStateRestorer = restorers.execution;

    logger.debug('State restorers registered', {
      operation: 'registerRestorers',
    });
  }

  /**
   * Create snapshot of current state
   */
  snapshot(metadata?: Partial<SnapshotMetadata>): StateSnapshot {
    return this.snapshotTimer.time(() => {
      return tracer.trace('state.snapshot', (span) => {
        // Collect state from providers
        const platform = this.platformStateProvider?.() ?? ({} as VirtualPlatformState);
        const runtime = this.runtimeStateProvider?.() ?? ({} as RuntimeState);
        const execution = this.executionStateProvider?.() ?? ({} as ExecutionState);

        const snapshot: StateSnapshot = {
          id: this.generateSnapshotId(),
          timestamp: this.getCurrentTimestamp(),
          platform,
          runtime,
          execution,
          custom: {},
          metadata: {
            size: 0, // Will be calculated
            incremental: false,
            ...metadata,
          },
        };

        // Calculate size
        const serialized = JSON.stringify(snapshot);
        snapshot.metadata.size = serialized.length;

        // Add to history
        this.addToHistory(snapshot);

        // Update metrics
        this.snapshotCounter.inc();
        this.snapshotSizeHistogram.observe(snapshot.metadata.size);

        span.setAttribute('snapshotId', snapshot.id);
        span.setAttribute('size', snapshot.metadata.size);
        span.setAttribute('position', this.currentPosition);

        logger.info('Snapshot created', {
          operation: 'snapshot',
          id: snapshot.id,
          size: snapshot.metadata.size,
          position: this.currentPosition,
        });

        return snapshot;
      }) as StateSnapshot;
    }) as StateSnapshot;
  }

  /**
   * Restore from snapshot
   */
  async restore(snapshot: StateSnapshot): Promise<void> {
    return this.restoreTimer.time(async () => {
      return tracer.trace('state.restore', async (span) => {
        span.setAttribute('snapshotId', snapshot.id);

        // Restore state to providers
        if (this.platformStateRestorer && snapshot.platform) {
          this.platformStateRestorer(snapshot.platform);
        }

        if (this.runtimeStateRestorer && snapshot.runtime) {
          this.runtimeStateRestorer(snapshot.runtime);
        }

        if (this.executionStateRestorer && snapshot.execution) {
          this.executionStateRestorer(snapshot.execution);
        }

        // Update position
        const index = this.snapshots.findIndex((s) => s.id === snapshot.id);
        if (index !== -1) {
          this.currentPosition = index;
        }

        // Update metrics
        this.restoreCounter.inc();

        logger.info('Snapshot restored', {
          operation: 'restore',
          id: snapshot.id,
          position: this.currentPosition,
        });
      }) as void;
    }) as Promise<void>;
  }

  /**
   * Get snapshot history
   */
  getHistory(): StateSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Clear snapshot history
   */
  clearHistory(): void {
    const count = this.snapshots.length;
    this.snapshots = [];
    this.currentPosition = -1;

    logger.info('History cleared', {
      operation: 'clearHistory',
      cleared: count,
    });
  }

  /**
   * Rewind to earlier state
   */
  async rewind(steps: number): Promise<void> {
    if (steps <= 0) {
      throw new Error('Steps must be positive');
    }

    const targetPosition = this.currentPosition - steps;

    if (targetPosition < 0) {
      logger.warn('Cannot rewind beyond first snapshot', {
        operation: 'rewind',
        steps,
        currentPosition: this.currentPosition,
      });
      return;
    }

    const snapshot = this.snapshots[targetPosition];
    if (!snapshot) {
      throw new Error('Snapshot not found');
    }

    await this.restore(snapshot);

    logger.info('Rewound state', {
      operation: 'rewind',
      steps,
      from: this.currentPosition + steps,
      to: this.currentPosition,
    });
  }

  /**
   * Forward to later state
   */
  async forward(steps: number): Promise<void> {
    if (steps <= 0) {
      throw new Error('Steps must be positive');
    }

    const targetPosition = this.currentPosition + steps;

    if (targetPosition >= this.snapshots.length) {
      logger.warn('Cannot forward beyond last snapshot', {
        operation: 'forward',
        steps,
        currentPosition: this.currentPosition,
        total: this.snapshots.length,
      });
      return;
    }

    const snapshot = this.snapshots[targetPosition];
    if (!snapshot) {
      throw new Error('Snapshot not found');
    }

    await this.restore(snapshot);

    logger.info('Forwarded state', {
      operation: 'forward',
      steps,
      from: this.currentPosition - steps,
      to: this.currentPosition,
    });
  }

  /**
   * Get current position in history
   */
  getCurrentPosition(): number {
    return this.currentPosition;
  }

  /**
   * Export state as JSON
   */
  export(snapshot: StateSnapshot): string {
    return JSON.stringify(snapshot, null, 2);
  }

  /**
   * Import state from JSON
   */
  import(data: string): StateSnapshot {
    const snapshot = JSON.parse(data) as StateSnapshot;

    logger.info('Snapshot imported', {
      operation: 'import',
      id: snapshot.id,
      size: data.length,
    });

    return snapshot;
  }

  /**
   * Go to specific snapshot
   */
  async goto(snapshotId: string): Promise<void> {
    const snapshot = this.snapshots.find((s) => s.id === snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }

    await this.restore(snapshot);
  }

  /**
   * Step backward one operation
   */
  async stepBack(): Promise<void> {
    await this.rewind(1);
  }

  /**
   * Step forward one operation
   */
  async stepForward(): Promise<void> {
    await this.forward(1);
  }

  /**
   * Continue backward until condition
   */
  async continueBack(
    condition: (snapshot: StateSnapshot) => boolean
  ): Promise<void> {
    let position = this.currentPosition;

    while (position >= 0) {
      const snapshot = this.snapshots[position];
      if (!snapshot) break;

      if (condition(snapshot)) {
        await this.restore(snapshot);
        return;
      }

      position--;
    }

    logger.warn('Condition not met while going back', {
      operation: 'continueBack',
    });
  }

  /**
   * Continue forward until condition
   */
  async continueForward(
    condition: (snapshot: StateSnapshot) => boolean
  ): Promise<void> {
    let position = this.currentPosition;

    while (position < this.snapshots.length) {
      const snapshot = this.snapshots[position];
      if (!snapshot) break;

      if (condition(snapshot)) {
        await this.restore(snapshot);
        return;
      }

      position++;
    }

    logger.warn('Condition not met while going forward', {
      operation: 'continueForward',
    });
  }

  /**
   * Find snapshots matching criteria
   */
  find(criteria: SnapshotCriteria): StateSnapshot[] {
    return this.snapshots.filter((snapshot) => {
      // Time range check
      if (criteria.timeRange) {
        const time = snapshot.timestamp.value;
        if (
          time < criteria.timeRange.start.value ||
          time > criteria.timeRange.end.value
        ) {
          return false;
        }
      }

      // Tags check
      if (criteria.tags) {
        const snapshotTags = snapshot.metadata.tags || [];
        if (!criteria.tags.every((tag) => snapshotTags.includes(tag))) {
          return false;
        }
      }

      // Label check
      if (criteria.label) {
        const label = snapshot.metadata.label || '';
        if (typeof criteria.label === 'string') {
          if (label !== criteria.label) return false;
        } else {
          if (!criteria.label.test(label)) return false;
        }
      }

      // Custom predicate
      if (criteria.predicate) {
        if (!criteria.predicate(snapshot)) return false;
      }

      return true;
    });
  }

  /**
   * Compare two snapshots
   */
  compare(a: StateSnapshot, b: StateSnapshot): StateDelta {
    // Simple comparison - just note what's different
    // More sophisticated diff could be implemented
    const delta: StateDelta = {};

    if (JSON.stringify(a.platform) !== JSON.stringify(b.platform)) {
      delta.dom = { added: [], removed: [], modified: [] };
      delta.network = { newRequests: [], completedRequests: [], cacheChanges: [] };
      delta.storage = { localStorage: {}, sessionStorage: {}, indexedDB: [] };
    }

    if (JSON.stringify(a.runtime) !== JSON.stringify(b.runtime)) {
      delta.runtime = { newTasks: [], completedTasks: [], resourceChanges: {} };
    }

    return delta;
  }

  /**
   * Add snapshot to history
   */
  private addToHistory(snapshot: StateSnapshot): void {
    // If we're not at the end, truncate future snapshots
    if (this.currentPosition < this.snapshots.length - 1) {
      this.snapshots = this.snapshots.slice(0, this.currentPosition + 1);
    }

    // Add new snapshot
    this.snapshots.push(snapshot);
    this.currentPosition = this.snapshots.length - 1;

    // Enforce max snapshots limit
    if (this.snapshots.length > this.maxSnapshots) {
      const removed = this.snapshots.shift();
      this.currentPosition--;

      logger.debug('Snapshot evicted due to limit', {
        operation: 'addToHistory',
        evicted: removed?.id,
        limit: this.maxSnapshots,
      });
    }
  }

  /**
   * Generate unique snapshot ID
   */
  private generateSnapshotId(): string {
    return `snapshot-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Get current timestamp
   */
  private getCurrentTimestamp(): VirtualTimestamp {
    return {
      value: Date.now(),
      sequence: 0,
    };
  }

  /**
   * Get statistics
   */
  getStats(): StateManagerStats {
    const sizes = this.snapshots.map((s) => s.metadata.size);
    const totalSize = sizes.reduce((a, b) => a + b, 0);

    return {
      totalSnapshots: this.snapshots.length,
      currentPosition: this.currentPosition,
      totalSize,
      averageSize: sizes.length > 0 ? totalSize / sizes.length : 0,
      maxSize: sizes.length > 0 ? Math.max(...sizes) : 0,
      minSize: sizes.length > 0 ? Math.min(...sizes) : 0,
    };
  }
}

export interface StateManagerConfig {
  maxSnapshots?: number;
  storage?: SnapshotStorage;
  enableCompression?: boolean;
  enableIncrementalSnapshots?: boolean;
}

export interface StateManagerStats {
  totalSnapshots: number;
  currentPosition: number;
  totalSize: number;
  averageSize: number;
  maxSize: number;
  minSize: number;
}

/**
 * Create a new state manager
 */
export function createStateManager(
  config?: StateManagerConfig
): StateManager {
  return new StateManagerImpl(config);
}
