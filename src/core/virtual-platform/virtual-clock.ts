/**
 * Virtual Clock implementation for deterministic time
 * Provides complete control over time progression
 */

import type {
  VirtualClock,
  ClockState,
  ScheduledCallback,
} from './types.js';
import type { VirtualTimestamp } from '../types.js';
import { getLogger } from '../../utils/instrumentation/logger.js';
import { getMetrics } from '../../utils/instrumentation/metrics.js';
import { getTracer } from '../../utils/instrumentation/tracer.js';

const logger = getLogger('virtual-clock');
const metrics = getMetrics();
const tracer = getTracer();

/**
 * Virtual clock for deterministic time control
 */
export class VirtualClockImpl implements VirtualClock {
  private currentTime: VirtualTimestamp;
  private scheduled: Map<number, ScheduledCallback> = new Map();
  private nextCallbackId = 1;
  private frozen = false;

  // Metrics
  private timeAdvancedCounter = metrics.counter(
    'vclock.time_advanced',
    'Total time advanced in ms'
  );
  private callbacksScheduledCounter = metrics.counter(
    'vclock.callbacks_scheduled',
    'Number of callbacks scheduled'
  );
  private callbacksExecutedCounter = metrics.counter(
    'vclock.callbacks_executed',
    'Number of callbacks executed'
  );
  private callbacksCancelledCounter = metrics.counter(
    'vclock.callbacks_cancelled',
    'Number of callbacks cancelled'
  );

  constructor(initialTime?: number) {
    this.currentTime = {
      value: initialTime ?? Date.now(),
      sequence: 0,
    };

    logger.info('Virtual clock initialized', {
      operation: 'constructor',
      initialTime: this.currentTime.value,
    });
  }

  /**
   * Get current virtual time
   */
  now(): VirtualTimestamp {
    return {
      value: this.currentTime.value,
      sequence: this.currentTime.sequence++,
    };
  }

  /**
   * Advance clock by milliseconds
   */
  advance(ms: number): void {
    return tracer.trace(
      'vclock.advance',
      (span) => {
        span.setAttribute('ms', ms);

        if (this.frozen) {
          logger.warn('Cannot advance frozen clock', {
            operation: 'advance',
            ms,
          });
          return;
        }

        if (ms < 0) {
          throw new Error('Cannot advance time backwards');
        }

        const oldTime = this.currentTime.value;
        this.currentTime.value += ms;
        this.currentTime.sequence++;

        this.timeAdvancedCounter.inc(ms);

        logger.debug('Clock advanced', {
          operation: 'advance',
          from: oldTime,
          to: this.currentTime.value,
          delta: ms,
        });

        // Execute any callbacks that should fire
        this.executeScheduledCallbacks();

        span.setAttribute('newTime', this.currentTime.value);
      },
      { ms }
    ) as void;
  }

  /**
   * Set absolute time
   */
  setTime(time: number): void {
    if (this.frozen) {
      logger.warn('Cannot set time on frozen clock', { operation: 'setTime' });
      return;
    }

    const oldTime = this.currentTime.value;
    const delta = time - oldTime;

    this.currentTime.value = time;
    this.currentTime.sequence++;

    logger.info('Clock time set', {
      operation: 'setTime',
      from: oldTime,
      to: time,
      delta,
    });

    if (delta > 0) {
      this.executeScheduledCallbacks();
    }
  }

  /**
   * Schedule callback at specific time
   */
  schedule(callback: () => void, time: VirtualTimestamp): number {
    return tracer.trace(
      'vclock.schedule',
      (span) => {
        const id = this.nextCallbackId++;

        const scheduled: ScheduledCallback = {
          id,
          callback,
          time,
          type: 'timeout',
        };

        this.scheduled.set(id, scheduled);
        this.callbacksScheduledCounter.inc();

        span.setAttribute('callbackId', id);
        span.setAttribute('scheduledTime', time.value);

        logger.trace('Callback scheduled', {
          operation: 'schedule',
          id,
          time: time.value,
          currentTime: this.currentTime.value,
          delay: time.value - this.currentTime.value,
        });

        return id;
      },
      { time: time.value }
    ) as number;
  }

  /**
   * Cancel scheduled callback
   */
  cancel(id: number): void {
    const callback = this.scheduled.get(id);

    if (callback) {
      this.scheduled.delete(id);
      this.callbacksCancelledCounter.inc();

      logger.trace('Callback cancelled', {
        operation: 'cancel',
        id,
      });
    } else {
      logger.trace('Callback not found for cancellation', {
        operation: 'cancel',
        id,
      });
    }
  }

  /**
   * Execute callbacks that should fire at current time
   */
  private executeScheduledCallbacks(): void {
    const callbacksToExecute: ScheduledCallback[] = [];

    // Find callbacks that should execute
    for (const callback of this.scheduled.values()) {
      if (callback.time.value <= this.currentTime.value) {
        callbacksToExecute.push(callback);
      }
    }

    // Sort by scheduled time and sequence
    callbacksToExecute.sort((a, b) => {
      if (a.time.value !== b.time.value) {
        return a.time.value - b.time.value;
      }
      return a.time.sequence - b.time.sequence;
    });

    // Execute callbacks
    for (const callback of callbacksToExecute) {
      this.executeCallback(callback);
    }
  }

  /**
   * Execute a single callback
   */
  private executeCallback(scheduledCallback: ScheduledCallback): void {
    return tracer.trace(
      'vclock.executeCallback',
      (span) => {
        span.setAttribute('callbackId', scheduledCallback.id);
        span.setAttribute('type', scheduledCallback.type);

        // Remove from scheduled (unless it's an interval)
        if (scheduledCallback.type !== 'interval') {
          this.scheduled.delete(scheduledCallback.id);
        }

        try {
          scheduledCallback.callback();
          this.callbacksExecutedCounter.inc();

          logger.trace('Callback executed', {
            operation: 'executeCallback',
            id: scheduledCallback.id,
            type: scheduledCallback.type,
          });

          // Reschedule intervals
          if (
            scheduledCallback.type === 'interval' &&
            scheduledCallback.interval
          ) {
            const nextTime: VirtualTimestamp = {
              value: scheduledCallback.time.value + scheduledCallback.interval,
              sequence: this.currentTime.sequence++,
            };

            scheduledCallback.time = nextTime;
          }
        } catch (error) {
          logger.error('Callback execution failed', error, {
            operation: 'executeCallback',
            id: scheduledCallback.id,
          });

          span.setStatus('error' as any, error as Error);

          // Remove failed callback
          this.scheduled.delete(scheduledCallback.id);
        }
      },
      { callbackId: scheduledCallback.id }
    ) as void;
  }

  /**
   * Schedule timeout (convenience method)
   */
  setTimeout(callback: () => void, delay: number): number {
    const scheduledTime: VirtualTimestamp = {
      value: this.currentTime.value + delay,
      sequence: this.currentTime.sequence++,
    };

    const id = this.schedule(callback, scheduledTime);
    const scheduled = this.scheduled.get(id);
    if (scheduled) {
      scheduled.type = 'timeout';
    }

    return id;
  }

  /**
   * Schedule interval (convenience method)
   */
  setInterval(callback: () => void, interval: number): number {
    const scheduledTime: VirtualTimestamp = {
      value: this.currentTime.value + interval,
      sequence: this.currentTime.sequence++,
    };

    const id = this.schedule(callback, scheduledTime);
    const scheduled = this.scheduled.get(id);
    if (scheduled) {
      scheduled.type = 'interval';
      scheduled.interval = interval;
    }

    return id;
  }

  /**
   * Schedule animation frame
   */
  requestAnimationFrame(callback: () => void): number {
    // Animation frames fire on next "tick" (typically 16.67ms for 60fps)
    const frameTime = 1000 / 60;
    const scheduledTime: VirtualTimestamp = {
      value: this.currentTime.value + frameTime,
      sequence: this.currentTime.sequence++,
    };

    const id = this.schedule(callback, scheduledTime);
    const scheduled = this.scheduled.get(id);
    if (scheduled) {
      scheduled.type = 'animationFrame';
    }

    return id;
  }

  /**
   * Clear timeout/interval
   */
  clearTimeout(id: number): void {
    this.cancel(id);
  }

  clearInterval(id: number): void {
    this.cancel(id);
  }

  cancelAnimationFrame(id: number): void {
    this.cancel(id);
  }

  /**
   * Freeze clock (prevent time advancement)
   */
  freeze(): void {
    this.frozen = true;
    logger.info('Clock frozen', { operation: 'freeze' });
  }

  /**
   * Unfreeze clock
   */
  unfreeze(): void {
    this.frozen = false;
    logger.info('Clock unfrozen', { operation: 'unfreeze' });
  }

  /**
   * Check if clock is frozen
   */
  isFrozen(): boolean {
    return this.frozen;
  }

  /**
   * Get number of scheduled callbacks
   */
  getScheduledCount(): number {
    return this.scheduled.size;
  }

  /**
   * Get all scheduled callbacks (for debugging)
   */
  getScheduled(): ScheduledCallback[] {
    return Array.from(this.scheduled.values());
  }

  /**
   * Clear all scheduled callbacks
   */
  clearAll(): void {
    const count = this.scheduled.size;
    this.scheduled.clear();

    logger.info('All callbacks cleared', {
      operation: 'clearAll',
      count,
    });
  }

  /**
   * Get clock state for snapshots
   */
  getState(): ClockState {
    return {
      currentTime: { ...this.currentTime },
      scheduled: Array.from(this.scheduled.values()).map((cb) => ({
        ...cb,
        // Serialize callback as string for snapshot
        callback: cb.callback.toString(),
      })) as ScheduledCallback[],
    };
  }

  /**
   * Restore clock state from snapshot
   */
  setState(state: ClockState): void {
    return tracer.trace('vclock.setState', (span) => {
      this.currentTime = { ...state.currentTime };
      this.scheduled.clear();

      for (const callback of state.scheduled) {
        this.scheduled.set(callback.id, callback);
      }

      span.setAttribute('scheduledCount', this.scheduled.size);
      span.setAttribute('time', this.currentTime.value);

      logger.info('Clock state restored', {
        operation: 'setState',
        time: this.currentTime.value,
        scheduledCount: this.scheduled.size,
      });
    }) as void;
  }

  /**
   * Get clock statistics
   */
  getStats(): ClockStats {
    const scheduled = Array.from(this.scheduled.values());

    return {
      currentTime: this.currentTime.value,
      sequence: this.currentTime.sequence,
      frozen: this.frozen,
      scheduledCallbacks: scheduled.length,
      callbacksByType: {
        timeout: scheduled.filter((cb) => cb.type === 'timeout').length,
        interval: scheduled.filter((cb) => cb.type === 'interval').length,
        animationFrame: scheduled.filter((cb) => cb.type === 'animationFrame')
          .length,
      },
      nextScheduledTime:
        scheduled.length > 0
          ? Math.min(...scheduled.map((cb) => cb.time.value))
          : null,
    };
  }

  /**
   * Export clock data for debugging
   */
  export(): string {
    return JSON.stringify(
      {
        currentTime: this.currentTime,
        frozen: this.frozen,
        scheduled: Array.from(this.scheduled.values()).map((cb) => ({
          id: cb.id,
          type: cb.type,
          time: cb.time,
          interval: cb.interval,
        })),
        stats: this.getStats(),
      },
      null,
      2
    );
  }
}

export interface ClockStats {
  currentTime: number;
  sequence: number;
  frozen: boolean;
  scheduledCallbacks: number;
  callbacksByType: {
    timeout: number;
    interval: number;
    animationFrame: number;
  };
  nextScheduledTime: number | null;
}

/**
 * Create a new virtual clock
 */
export function createVirtualClock(initialTime?: number): VirtualClock {
  return new VirtualClockImpl(initialTime);
}
