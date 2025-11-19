/**
 * WebVisor - A hypervisor for the web platform
 *
 * @packageDocumentation
 */

export type {
  // Core types
  ExecutionMode,
  VirtualizableAPI,
  WebVisorConfig,
  ResourceLimits,
  GuestCode,
  VirtualTimestamp,
  StackFrame,
  ExecutionState,
  EventLoopState,
  Task,
  TrapHandler,
  APICallTrace,
  WebVisorPlugin,
  PerformanceMetrics,
} from './core/types.js';

export type {
  // Trap layer types
  TrapLayer,
  DOMTrapHandler,
  NetworkTrapHandler,
  StorageTrapHandler,
  TimingTrapHandler,
  RandomTrapHandler,
  GraphicsTrapHandler,
  ConcurrencyTrapHandler,
  TrapPolicy,
  TrapContext,
  TrapEvent,
} from './core/trap-layer/types.js';

export type {
  // Virtual platform types
  VirtualPlatform,
  VirtualPlatformState,
  VirtualDOM,
  VirtualElement,
  VirtualText,
  VirtualNode,
  VirtualDocument,
  SerializedDOM,
  VirtualNetwork,
  VirtualFetch,
  MockHandler,
  MockResponse,
  NetworkState,
  VirtualStorage,
  VirtualLocalStorage,
  StorageState,
  VirtualClock,
  ClockState,
  VirtualRNG,
  RNGState,
} from './core/virtual-platform/types.js';

export type {
  // Runtime types
  ExecutionRuntime,
  RuntimeState,
  EventScheduler,
  SchedulerState,
  DeterministicQueue,
  MicrotaskQueue,
  QueueState,
  ResourceManager,
  ResourceLimitStatus,
  ResourceStats,
  ResourceState,
  ExecutionControl,
  BreakpointCondition,
} from './core/runtime/types.js';

export type {
  // State management types
  StateManager,
  StateSnapshot,
  SnapshotMetadata,
  IncrementalSnapshot,
  StateDelta,
  CompressionStrategy,
  SnapshotStorage,
  TimeTravelOperations,
  SnapshotCriteria,
} from './core/state/types.js';

/**
 * Main WebVisor class (to be implemented)
 */
export class WebVisor {
  constructor(config: WebVisorConfig) {
    throw new Error('WebVisor is not yet implemented');
  }

  async load(code: GuestCode): Promise<void> {
    throw new Error('Not implemented');
  }

  async run(): Promise<void> {
    throw new Error('Not implemented');
  }

  pause(): void {
    throw new Error('Not implemented');
  }

  resume(): void {
    throw new Error('Not implemented');
  }

  snapshot(): StateSnapshot {
    throw new Error('Not implemented');
  }

  async restore(snapshot: StateSnapshot): Promise<void> {
    throw new Error('Not implemented');
  }

  use(plugin: WebVisorPlugin): void {
    throw new Error('Not implemented');
  }
}

// Re-export types for convenience
import type {
  WebVisorConfig,
  GuestCode,
  WebVisorPlugin,
} from './core/types.js';
import type { StateSnapshot } from './core/state/types.js';
