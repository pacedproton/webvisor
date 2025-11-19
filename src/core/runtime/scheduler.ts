/**
 * Event Scheduler Implementation
 * Manages deterministic execution of async operations
 */

import type {
  EventScheduler,
  SchedulerState,
  DeterministicQueue,
  MicrotaskQueue,
  QueueState,
} from './types.js';
import type { Task, VirtualTimestamp } from '../types.js';
import { getLogger } from '../../utils/instrumentation/logger.js';
import { getMetrics } from '../../utils/instrumentation/metrics.js';
import { getTracer } from '../../utils/instrumentation/tracer.js';

const logger = getLogger('scheduler');
const metrics = getMetrics();
const tracer = getTracer();

/**
 * Deterministic queue implementation
 */
export class DeterministicQueueImpl implements DeterministicQueue {
  private tasks: Task[] = [];

  enqueue(task: Task): void {
    this.tasks.push(task);
    metrics.counter('scheduler.queue.enqueued').inc();

    logger.trace('Task enqueued', {
      operation: 'enqueue',
      taskId: task.id,
      type: task.type,
    });
  }

  dequeue(): Task | null {
    const task = this.tasks.shift() ?? null;

    if (task) {
      metrics.counter('scheduler.queue.dequeued').inc();

      logger.trace('Task dequeued', {
        operation: 'dequeue',
        taskId: task.id,
        type: task.type,
      });
    }

    return task;
  }

  peek(): Task | null {
    return this.tasks[0] ?? null;
  }

  length(): number {
    return this.tasks.length;
  }

  isEmpty(): boolean {
    return this.tasks.length === 0;
  }

  clear(): void {
    const count = this.tasks.length;
    this.tasks = [];

    logger.info('Queue cleared', {
      operation: 'clear',
      clearedCount: count,
    });
  }

  getState(): QueueState {
    return {
      tasks: [...this.tasks],
    };
  }

  setState(state: QueueState): void {
    this.tasks = [...state.tasks];

    logger.info('Queue state restored', {
      operation: 'setState',
      taskCount: this.tasks.length,
    });
  }
}

/**
 * Microtask queue implementation
 */
export class MicrotaskQueueImpl extends DeterministicQueueImpl implements MicrotaskQueue {
  async drain(): Promise<void> {
    return tracer.trace('microtask.drain', async (span) => {
      let count = 0;

      while (!this.isEmpty()) {
        const task = this.dequeue();
        if (!task) break;

        try {
          await task.callback();
          count++;
        } catch (error) {
          logger.error('Microtask execution failed', error, {
            operation: 'drain',
            taskId: task.id,
          });
        }
      }

      span.setAttribute('tasksExecuted', count);

      logger.debug('Microtask queue drained', {
        operation: 'drain',
        executed: count,
      });
    }) as Promise<void>;
  }
}

/**
 * Event scheduler implementation
 */
export class EventSchedulerImpl implements EventScheduler {
  private nextTaskId = 1;
  private tasks = new Map<number, Task>();
  private currentTask: Task | null = null;
  private running = false;

  schedule(task: Task): void {
    if (!task.id) {
      task.id = this.nextTaskId++;
    }

    this.tasks.set(task.id, task);
    metrics.counter('scheduler.tasks.scheduled').inc();

    logger.trace('Task scheduled', {
      operation: 'schedule',
      taskId: task.id,
      type: task.type,
      scheduledTime: task.scheduledTime?.value,
    });
  }

  cancel(taskId: number): void {
    const task = this.tasks.get(taskId);

    if (task) {
      this.tasks.delete(taskId);
      metrics.counter('scheduler.tasks.cancelled').inc();

      logger.trace('Task cancelled', {
        operation: 'cancel',
        taskId,
        type: task.type,
      });
    }
  }

  async processNext(): Promise<void> {
    return tracer.trace('scheduler.processNext', async (span) => {
      if (this.tasks.size === 0) {
        return;
      }

      // Find next task to execute (earliest scheduled time)
      let nextTask: Task | null = null;
      let earliestTime = Infinity;

      for (const task of this.tasks.values()) {
        const time = task.scheduledTime?.value ?? 0;
        if (time < earliestTime) {
          earliestTime = time;
          nextTask = task;
        }
      }

      if (!nextTask) {
        return;
      }

      // Remove from pending tasks
      this.tasks.delete(nextTask.id);
      this.currentTask = nextTask;

      span.setAttribute('taskId', nextTask.id);
      span.setAttribute('taskType', nextTask.type);

      try {
        await nextTask.callback();
        metrics.counter('scheduler.tasks.executed').inc();

        logger.trace('Task executed', {
          operation: 'processNext',
          taskId: nextTask.id,
          type: nextTask.type,
        });
      } catch (error) {
        metrics.counter('scheduler.tasks.failed').inc();

        logger.error('Task execution failed', error, {
          operation: 'processNext',
          taskId: nextTask.id,
          type: nextTask.type,
        });

        span.setStatus('error' as any, error as Error);
      } finally {
        this.currentTask = null;
      }
    }) as Promise<void>;
  }

  getTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  clear(): void {
    const count = this.tasks.size;
    this.tasks.clear();
    this.currentTask = null;

    logger.info('Scheduler cleared', {
      operation: 'clear',
      clearedCount: count,
    });
  }

  getState(): SchedulerState {
    return {
      nextTaskId: this.nextTaskId,
      tasks: Array.from(this.tasks.values()),
      currentTask: this.currentTask,
    };
  }

  setState(state: SchedulerState): void {
    this.nextTaskId = state.nextTaskId;
    this.tasks.clear();

    for (const task of state.tasks) {
      this.tasks.set(task.id, task);
    }

    this.currentTask = state.currentTask;

    logger.info('Scheduler state restored', {
      operation: 'setState',
      taskCount: this.tasks.size,
      nextTaskId: this.nextTaskId,
    });
  }

  /**
   * Run scheduler loop
   */
  async run(): Promise<void> {
    if (this.running) {
      logger.warn('Scheduler already running');
      return;
    }

    this.running = true;

    logger.info('Scheduler started');

    while (this.running && this.tasks.size > 0) {
      await this.processNext();
    }

    this.running = false;

    logger.info('Scheduler stopped');
  }

  /**
   * Stop scheduler
   */
  stop(): void {
    this.running = false;
    logger.info('Scheduler stop requested');
  }

  /**
   * Check if scheduler is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get statistics
   */
  getStats(): SchedulerStats {
    return {
      pendingTasks: this.tasks.size,
      currentTask: this.currentTask?.id ?? null,
      running: this.running,
      nextTaskId: this.nextTaskId,
    };
  }
}

export interface SchedulerStats {
  pendingTasks: number;
  currentTask: number | null;
  running: boolean;
  nextTaskId: number;
}

/**
 * Create event scheduler
 */
export function createEventScheduler(): EventScheduler {
  return new EventSchedulerImpl();
}

/**
 * Create deterministic queue
 */
export function createDeterministicQueue(): DeterministicQueue {
  return new DeterministicQueueImpl();
}

/**
 * Create microtask queue
 */
export function createMicrotaskQueue(): MicrotaskQueue {
  return new MicrotaskQueueImpl();
}
