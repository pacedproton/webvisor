/**
 * Type definitions for the execution runtime
 */

import type { Task, VirtualTimestamp, ExecutionState } from '../types.js';

/**
 * Execution runtime - manages the execution environment
 */
export interface ExecutionRuntime {
  /**
   * Event scheduler
   */
  scheduler: EventScheduler;

  /**
   * Task queue
   */
  taskQueue: DeterministicQueue;

  /**
   * Microtask queue
   */
  microtaskQueue: MicrotaskQueue;

  /**
   * Resource manager
   */
  resourceManager: ResourceManager;

  /**
   * Initialize runtime
   */
  init(): void;

  /**
   * Start execution
   */
  start(): Promise<void>;

  /**
   * Pause execution
   */
  pause(): void;

  /**
   * Resume execution
   */
  resume(): void;

  /**
   * Step one task
   */
  step(): Promise<void>;

  /**
   * Stop execution
   */
  stop(): void;

  /**
   * Get runtime state
   */
  getState(): RuntimeState;

  /**
   * Set runtime state
   */
  setState(state: RuntimeState): void;
}

/**
 * Runtime state for snapshots
 */
export interface RuntimeState {
  /**
   * Scheduler state
   */
  scheduler: SchedulerState;

  /**
   * Task queue state
   */
  taskQueue: QueueState;

  /**
   * Microtask queue state
   */
  microtaskQueue: QueueState;

  /**
   * Resource manager state
   */
  resources: ResourceState;

  /**
   * Execution state
   */
  execution: ExecutionState;
}

/**
 * Event scheduler for managing async operations
 */
export interface EventScheduler {
  /**
   * Schedule a task
   */
  schedule(task: Task): void;

  /**
   * Cancel a task
   */
  cancel(taskId: number): void;

  /**
   * Process next scheduled task
   */
  processNext(): Promise<void>;

  /**
   * Get all scheduled tasks
   */
  getTasks(): Task[];

  /**
   * Clear all tasks
   */
  clear(): void;

  /**
   * Get scheduler state
   */
  getState(): SchedulerState;

  /**
   * Set scheduler state
   */
  setState(state: SchedulerState): void;
}

/**
 * Scheduler state
 */
export interface SchedulerState {
  /**
   * Next task ID
   */
  nextTaskId: number;

  /**
   * All scheduled tasks
   */
  tasks: Task[];

  /**
   * Currently executing task
   */
  currentTask: Task | null;
}

/**
 * Deterministic queue for tasks
 */
export interface DeterministicQueue {
  /**
   * Enqueue a task
   */
  enqueue(task: Task): void;

  /**
   * Dequeue next task
   */
  dequeue(): Task | null;

  /**
   * Peek at next task without removing
   */
  peek(): Task | null;

  /**
   * Get queue length
   */
  length(): number;

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean;

  /**
   * Clear queue
   */
  clear(): void;

  /**
   * Get queue state
   */
  getState(): QueueState;

  /**
   * Set queue state
   */
  setState(state: QueueState): void;
}

/**
 * Queue state
 */
export interface QueueState {
  /**
   * Tasks in queue
   */
  tasks: Task[];
}

/**
 * Microtask queue
 */
export interface MicrotaskQueue extends DeterministicQueue {
  /**
   * Drain all microtasks
   */
  drain(): Promise<void>;
}

/**
 * Resource manager for tracking resource usage
 */
export interface ResourceManager {
  /**
   * Track memory allocation
   */
  allocate(bytes: number, label?: string): void;

  /**
   * Track memory deallocation
   */
  deallocate(bytes: number, label?: string): void;

  /**
   * Get current memory usage
   */
  getMemoryUsage(): number;

  /**
   * Track CPU time
   */
  trackCPUTime(ms: number): void;

  /**
   * Get total CPU time used
   */
  getCPUTime(): number;

  /**
   * Check if resource limits exceeded
   */
  checkLimits(): ResourceLimitStatus;

  /**
   * Get resource usage statistics
   */
  getStats(): ResourceStats;

  /**
   * Get resource state
   */
  getState(): ResourceState;

  /**
   * Set resource state
   */
  setState(state: ResourceState): void;
}

/**
 * Resource limit status
 */
export interface ResourceLimitStatus {
  /**
   * Whether any limit is exceeded
   */
  exceeded: boolean;

  /**
   * Which limits are exceeded
   */
  limits: {
    memory?: boolean;
    cpu?: boolean;
    storage?: boolean;
    network?: boolean;
  };

  /**
   * Current usage
   */
  usage: {
    memory: number;
    cpu: number;
    storage: number;
    network: number;
  };
}

/**
 * Resource usage statistics
 */
export interface ResourceStats {
  /**
   * Memory allocations
   */
  allocations: Array<{
    bytes: number;
    label?: string;
    timestamp: VirtualTimestamp;
  }>;

  /**
   * Memory deallocations
   */
  deallocations: Array<{
    bytes: number;
    label?: string;
    timestamp: VirtualTimestamp;
  }>;

  /**
   * Peak memory usage
   */
  peakMemory: number;

  /**
   * Total CPU time
   */
  totalCPUTime: number;

  /**
   * Network bytes sent
   */
  networkBytesSent: number;

  /**
   * Network bytes received
   */
  networkBytesReceived: number;

  /**
   * Storage bytes used
   */
  storageBytesUsed: number;
}

/**
 * Resource state for snapshots
 */
export interface ResourceState {
  /**
   * Current memory usage
   */
  memoryUsage: number;

  /**
   * Current CPU time
   */
  cpuTime: number;

  /**
   * Resource statistics
   */
  stats: ResourceStats;
}

/**
 * Execution control interface
 */
export interface ExecutionControl {
  /**
   * Check if execution is paused
   */
  isPaused(): boolean;

  /**
   * Check if execution is running
   */
  isRunning(): boolean;

  /**
   * Wait for execution to pause
   */
  waitForPause(): Promise<void>;

  /**
   * Wait for execution to complete
   */
  waitForComplete(): Promise<void>;

  /**
   * Set breakpoint
   */
  setBreakpoint(condition: BreakpointCondition): number;

  /**
   * Remove breakpoint
   */
  removeBreakpoint(id: number): void;

  /**
   * Check if should break
   */
  shouldBreak(): boolean;
}

/**
 * Breakpoint condition
 */
export type BreakpointCondition =
  | { type: 'api'; api: string }
  | { type: 'time'; time: VirtualTimestamp }
  | { type: 'memory'; threshold: number }
  | { type: 'custom'; predicate: () => boolean };
