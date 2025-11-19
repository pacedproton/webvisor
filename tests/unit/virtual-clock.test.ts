/**
 * Virtual Clock Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createVirtualClock } from '../../src/core/virtual-platform/virtual-clock.js';

describe('VirtualClock', () => {
  let clock: ReturnType<typeof createVirtualClock>;

  beforeEach(() => {
    clock = createVirtualClock(0);
  });

  describe('Basic Time Operations', () => {
    it('should start at specified initial time', () => {
      const c = createVirtualClock(1000);
      expect(c.now().value).toBe(1000);
    });

    it('should advance time', () => {
      clock.advance(100);
      expect(clock.now().value).toBe(100);

      clock.advance(50);
      expect(clock.now().value).toBe(150);
    });

    it('should set absolute time', () => {
      clock.setTime(5000);
      expect(clock.now().value).toBe(5000);
    });

    it('should throw error when advancing negative time', () => {
      expect(() => clock.advance(-100)).toThrow();
    });

    it('should increment sequence number', () => {
      const t1 = clock.now();
      const t2 = clock.now();

      expect(t2.sequence).toBeGreaterThan(t1.sequence);
    });
  });

  describe('Timeouts', () => {
    it('should schedule and execute timeouts', () => {
      let executed = false;

      clock.setTimeout(() => {
        executed = true;
      }, 100);

      expect(executed).toBe(false);

      clock.advance(100);
      expect(executed).toBe(true);
    });

    it('should execute timeouts in order', () => {
      const order: number[] = [];

      clock.setTimeout(() => order.push(1), 100);
      clock.setTimeout(() => order.push(2), 50);
      clock.setTimeout(() => order.push(3), 150);

      clock.advance(200);

      expect(order).toEqual([2, 1, 3]);
    });

    it('should cancel timeouts', () => {
      let executed = false;

      const id = clock.setTimeout(() => {
        executed = true;
      }, 100);

      clock.clearTimeout(id);
      clock.advance(100);

      expect(executed).toBe(false);
    });

    it('should not execute timeout before scheduled time', () => {
      let executed = false;

      clock.setTimeout(() => {
        executed = true;
      }, 100);

      clock.advance(50);
      expect(executed).toBe(false);

      clock.advance(50);
      expect(executed).toBe(true);
    });
  });

  describe('Intervals', () => {
    it('should execute intervals repeatedly', () => {
      let count = 0;

      clock.setInterval(() => {
        count++;
      }, 100);

      clock.advance(350);

      expect(count).toBe(3);
    });

    it('should cancel intervals', () => {
      let count = 0;

      const id = clock.setInterval(() => {
        count++;
      }, 100);

      clock.advance(250);
      expect(count).toBe(2);

      clock.clearInterval(id);
      clock.advance(200);
      expect(count).toBe(2);
    });
  });

  describe('Animation Frames', () => {
    it('should execute animation frames', () => {
      let executed = false;

      clock.requestAnimationFrame(() => {
        executed = true;
      });

      expect(executed).toBe(false);

      clock.advance(17); // ~60fps
      expect(executed).toBe(true);
    });

    it('should cancel animation frames', () => {
      let executed = false;

      const id = clock.requestAnimationFrame(() => {
        executed = true;
      });

      clock.cancelAnimationFrame(id);
      clock.advance(17);

      expect(executed).toBe(false);
    });
  });

  describe('Freeze/Unfreeze', () => {
    it('should freeze time advancement', () => {
      clock.freeze();
      clock.advance(100);

      expect(clock.now().value).toBe(0);
    });

    it('should unfreeze time', () => {
      clock.freeze();
      clock.unfreeze();
      clock.advance(100);

      expect(clock.now().value).toBe(100);
    });

    it('should report frozen state', () => {
      expect(clock.isFrozen()).toBe(false);

      clock.freeze();
      expect(clock.isFrozen()).toBe(true);

      clock.unfreeze();
      expect(clock.isFrozen()).toBe(false);
    });
  });

  describe('State Management', () => {
    it('should get state', () => {
      clock.setTimeout(() => {}, 100);
      const state = clock.getState();

      expect(state.currentTime.value).toBe(0);
      expect(state.scheduled.length).toBe(1);
    });

    it('should restore state', () => {
      clock.setTimeout(() => {}, 100);
      const state1 = clock.getState();

      clock.advance(200);
      clock.setState(state1);

      const state2 = clock.getState();
      expect(state2.currentTime.value).toBe(state1.currentTime.value);
    });

    it('should export clock data', () => {
      clock.setTimeout(() => {}, 100);
      const exported = clock.export();

      expect(exported).toContain('currentTime');
      expect(exported).toContain('scheduled');
    });
  });

  describe('Statistics', () => {
    it('should provide statistics', () => {
      clock.setTimeout(() => {}, 100);
      clock.setInterval(() => {}, 200);

      const stats = clock.getStats();

      expect(stats.currentTime).toBe(0);
      expect(stats.scheduledCallbacks).toBe(2);
      expect(stats.callbacksByType.timeout).toBe(1);
      expect(stats.callbacksByType.interval).toBe(1);
    });

    it('should report next scheduled time', () => {
      clock.setTimeout(() => {}, 100);
      clock.setTimeout(() => {}, 50);

      const stats = clock.getStats();
      expect(stats.nextScheduledTime).toBe(50);
    });
  });

  describe('Clear All', () => {
    it('should clear all scheduled callbacks', () => {
      clock.setTimeout(() => {}, 100);
      clock.setInterval(() => {}, 200);

      expect(clock.getScheduledCount()).toBe(2);

      clock.clearAll();
      expect(clock.getScheduledCount()).toBe(0);
    });
  });
});
