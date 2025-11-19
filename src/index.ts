/**
 * WebVisor - A hypervisor for the web platform
 *
 * @packageDocumentation
 */

// Main exports
export { WebVisor } from './webvisor.js';

// Core types
export type {
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

// Trap layer types
export type {
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

// Virtual platform types and implementations
export type {
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

export { createVirtualClock } from './core/virtual-platform/virtual-clock.js';
export { createVirtualRNG, PRNGAlgorithm } from './core/virtual-platform/virtual-rng.js';
export { createVirtualDOM } from './core/virtual-platform/virtual-dom.js';

// Runtime types
export type {
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

// State management types and implementations
export type {
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

export { createStateManager } from './core/state/state-manager.js';

// Instrumentation
export {
  Logger,
  LogLevel,
  type LoggerConfig,
  type LogEntry,
  type LogContext,
  createLogger,
  getLogger,
} from './utils/instrumentation/logger.js';

export {
  Tracer,
  ActiveSpan,
  type Span,
  type SpanContext,
  SpanStatus,
  getTracer,
  setTracer,
  trace,
} from './utils/instrumentation/tracer.js';

export {
  MetricsRegistry,
  Counter,
  Gauge,
  Histogram,
  Timer,
  MetricType,
  getMetrics,
  setMetrics,
} from './utils/instrumentation/metrics.js';

// Tools
export { Inspector, createInspector } from './tools/inspector.js';
export { Profiler, createProfiler } from './tools/profiler.js';

export type {
  InspectorState,
  DOMInspection,
  NetworkInspection,
  StorageInspection,
  TimingInspection,
} from './tools/inspector.js';

export type {
  APIUsageAnalysis,
  Hotspot,
  DOMAnalysis,
  NetworkAnalysis,
  OptimizationSuggestion,
  ProfilerStats,
} from './tools/profiler.js';
