/**
 * Core type definitions for WebVisor hypervisor
 */

/**
 * Execution mode for the hypervisor
 * - strict: Full determinism, higher overhead
 * - relaxed: Best-effort determinism, lower overhead
 * - native: Pass-through, zero overhead
 */
export type ExecutionMode = 'strict' | 'relaxed' | 'native';

/**
 * Web APIs that can be virtualized
 */
export type VirtualizableAPI =
  | 'dom'
  | 'network'
  | 'storage'
  | 'timing'
  | 'random'
  | 'graphics'
  | 'concurrency';

/**
 * Configuration for WebVisor instance
 */
export interface WebVisorConfig {
  /**
   * Execution mode
   */
  mode: ExecutionMode;

  /**
   * Which APIs to virtualize
   */
  apis: VirtualizableAPI[];

  /**
   * Enable automatic snapshots
   */
  enableSnapshots?: boolean;

  /**
   * Snapshot interval in milliseconds (if auto-snapshots enabled)
   */
  snapshotInterval?: number;

  /**
   * Maximum number of snapshots to keep
   */
  maxHistory?: number;

  /**
   * Enable performance profiling
   */
  enableProfiling?: boolean;

  /**
   * Enable API call tracing
   */
  enableTracing?: boolean;

  /**
   * Resource limits for guest code
   */
  resourceLimits?: ResourceLimits;
}

/**
 * Resource limits for guest execution
 */
export interface ResourceLimits {
  /**
   * Maximum memory usage in bytes
   */
  maxMemory?: number;

  /**
   * Maximum CPU time in milliseconds
   */
  maxCPUTime?: number;

  /**
   * Maximum storage usage in bytes
   */
  maxStorage?: number;

  /**
   * Maximum number of concurrent network requests
   */
  maxConcurrentRequests?: number;
}

/**
 * Guest code to be executed
 */
export interface GuestCode {
  /**
   * The code to execute
   */
  code: string;

  /**
   * URL for the code (used for source maps, errors)
   */
  url?: string;

  /**
   * Code type
   */
  type?: 'module' | 'script';

  /**
   * Source map
   */
  sourceMap?: string;
}

/**
 * Virtual timestamp (controlled by hypervisor)
 */
export interface VirtualTimestamp {
  /**
   * Virtual time in milliseconds since epoch
   */
  value: number;

  /**
   * Monotonic counter for ordering
   */
  sequence: number;
}

/**
 * Stack frame for execution state
 */
export interface StackFrame {
  /**
   * Function name
   */
  functionName: string;

  /**
   * File URL
   */
  url: string;

  /**
   * Line number
   */
  line: number;

  /**
   * Column number
   */
  column: number;

  /**
   * Local variables
   */
  locals?: Record<string, unknown>;
}

/**
 * Execution state
 */
export interface ExecutionState {
  /**
   * Call stack
   */
  callStack: StackFrame[];

  /**
   * Current instruction pointer
   */
  instructionPointer: number;

  /**
   * Event loop state
   */
  eventLoop: EventLoopState;
}

/**
 * Event loop state
 */
export interface EventLoopState {
  /**
   * Pending macrotasks
   */
  macrotasks: Task[];

  /**
   * Pending microtasks
   */
  microtasks: Task[];

  /**
   * Current phase
   */
  phase: 'idle' | 'macrotask' | 'microtask' | 'render';
}

/**
 * Scheduled task
 */
export interface Task {
  /**
   * Task ID
   */
  id: number;

  /**
   * Task type
   */
  type: 'timeout' | 'interval' | 'immediate' | 'promise' | 'observer';

  /**
   * Callback function
   */
  callback: () => void;

  /**
   * Scheduled time (for timeouts/intervals)
   */
  scheduledTime?: VirtualTimestamp;

  /**
   * Interval duration (for intervals)
   */
  interval?: number;
}

/**
 * Trap handler for API interception
 */
export interface TrapHandler<T = unknown> {
  /**
   * Intercept API call
   */
  intercept(target: unknown, thisArg: unknown, args: unknown[]): T;

  /**
   * Check if this handler can handle the given API
   */
  canHandle(api: string): boolean;

  /**
   * Initialize the trap handler
   */
  init?(): void;

  /**
   * Cleanup the trap handler
   */
  cleanup?(): void;
}

/**
 * API call metadata for tracing
 */
export interface APICallTrace {
  /**
   * API name
   */
  api: string;

  /**
   * Arguments
   */
  args: unknown[];

  /**
   * Return value
   */
  returnValue?: unknown;

  /**
   * Error (if thrown)
   */
  error?: Error;

  /**
   * Call stack
   */
  stack: StackFrame[];

  /**
   * Timestamp
   */
  timestamp: VirtualTimestamp;

  /**
   * Duration in microseconds
   */
  duration?: number;
}

/**
 * Plugin interface for extending WebVisor
 */
export interface WebVisorPlugin {
  /**
   * Plugin name
   */
  name: string;

  /**
   * Plugin version
   */
  version: string;

  /**
   * Initialize plugin
   */
  onInit?(visor: unknown): void;

  /**
   * Transform guest code before loading
   */
  onLoad?(code: string): string;

  /**
   * Called when API is trapped
   */
  onTrap?(api: string, args: unknown[]): void;

  /**
   * Called when snapshot is created
   */
  onSnapshot?(state: unknown): void;

  /**
   * Custom API handlers
   */
  apis?: Record<string, TrapHandler>;

  /**
   * Custom tools
   */
  tools?: Record<string, unknown>;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  /**
   * API call counts
   */
  apiCalls: Record<string, number>;

  /**
   * API call durations (total microseconds)
   */
  apiDurations: Record<string, number>;

  /**
   * Memory usage samples
   */
  memoryUsage: Array<{ timestamp: VirtualTimestamp; bytes: number }>;

  /**
   * Snapshot statistics
   */
  snapshots: {
    count: number;
    totalSize: number;
    averageTime: number;
  };

  /**
   * Total execution time
   */
  totalExecutionTime: number;

  /**
   * Overhead percentage
   */
  overhead: number;
}
