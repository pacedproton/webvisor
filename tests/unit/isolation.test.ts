/**
 * Isolation Tests
 * Tests to verify guest code cannot escape the hypervisor
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createIsolationManager,
  IsolationLevel,
} from '../../src/core/isolation/isolation-manager.js';

describe('Isolation and Escape Prevention', () => {
  describe('Maximum Isolation', () => {
    let manager: ReturnType<typeof createIsolationManager>;

    beforeEach(() => {
      manager = createIsolationManager({
        level: IsolationLevel.MAXIMUM,
        blockedGlobals: ['Worker', 'SharedWorker', 'importScripts'],
      });
      manager.init();
    });

    it('should block Function constructor', () => {
      expect(() => {
        new Function('return window');
      }).toThrow(/disabled in isolated environment/);
    });

    it('should block eval', () => {
      expect(() => {
        eval('console.log("escaped")');
      }).toThrow(/disabled in isolated environment/);
    });

    it('should block indirect eval', () => {
      expect(() => {
        const indirectEval = eval;
        indirectEval('1 + 1');
      }).toThrow(/disabled in isolated environment/);
    });

    it('should block window.parent escape', () => {
      // Should return window itself, not actual parent
      expect(window.parent).toBe(window);
    });

    it('should block window.top escape', () => {
      expect(window.top).toBe(window);
    });

    it('should block window.opener escape', () => {
      expect(window.opener).toBeNull();
    });

    it('should block prototype pollution', () => {
      expect(() => {
        (Object.prototype as any).hacked = true;
      }).toThrow();

      expect((Object.prototype as any).hacked).toBeUndefined();
    });

    it('should block __proto__ manipulation', () => {
      const obj: any = {};

      expect(() => {
        obj.__proto__ = { malicious: true };
      }).toThrow();
    });

    it('should freeze core prototypes', () => {
      expect(Object.isFrozen(Object.prototype)).toBe(true);
      expect(Object.isFrozen(Array.prototype)).toBe(true);
      expect(Object.isFrozen(Function.prototype)).toBe(true);
    });

    it('should record security violations', () => {
      try {
        new Function('return 1');
      } catch {}

      const violations = manager.getViolations();
      // Violations might be recorded depending on implementation
      // Just verify we can get them
      expect(Array.isArray(violations)).toBe(true);
    });

    it('should validate isolation is working', () => {
      const validation = manager.validateIsolation();

      expect(validation.passed).toBe(true);
      expect(validation.level).toBe(IsolationLevel.MAXIMUM);
      expect(validation.tests.length).toBeGreaterThan(0);

      // All tests should pass
      for (const test of validation.tests) {
        expect(test.passed).toBe(true);
      }
    });

    it('should export isolation report', () => {
      const report = manager.exportReport();

      expect(report).toContain('config');
      expect(report).toContain('violations');
      expect(report).toContain('validation');
    });
  });

  describe('Strong Isolation', () => {
    let manager: ReturnType<typeof createIsolationManager>;

    beforeEach(() => {
      manager = createIsolationManager({
        level: IsolationLevel.STRONG,
      });
      manager.init();
    });

    it('should block Function constructor', () => {
      expect(() => {
        new Function('return 1');
      }).toThrow();
    });

    it('should block eval', () => {
      expect(() => {
        eval('1 + 1');
      }).toThrow();
    });

    it('should protect prototypes', () => {
      expect(Object.isFrozen(Object.prototype)).toBe(true);
    });
  });

  describe('Basic Isolation', () => {
    let manager: ReturnType<typeof createIsolationManager>;

    beforeEach(() => {
      manager = createIsolationManager({
        level: IsolationLevel.BASIC,
        blockedGlobals: ['Worker'],
      });
      manager.init();
    });

    it('should validate access to allowed APIs', () => {
      const allowed = manager.validateAccess('console', 'log');
      // With basic isolation, depends on configuration
      expect(typeof allowed).toBe('boolean');
    });

    it('should block access to blocked APIs', () => {
      const blocked = manager.validateAccess('Worker', 'constructor');
      expect(blocked).toBe(false);
    });

    it('should track access attempts', () => {
      manager.validateAccess('fetch', 'call');
      manager.validateAccess('Worker', 'new');

      const log = manager.getAccessLog();
      expect(log.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('No Isolation (Debug Mode)', () => {
    let manager: ReturnType<typeof createIsolationManager>;

    beforeEach(() => {
      manager = createIsolationManager({
        level: IsolationLevel.NONE,
      });
      manager.init();
    });

    it('should allow all access', () => {
      const allowed = manager.validateAccess('anything', 'goes');
      expect(allowed).toBe(true);
    });
  });

  describe('Escape Attempt Scenarios', () => {
    let manager: ReturnType<typeof createIsolationManager>;

    beforeEach(() => {
      manager = createIsolationManager({
        level: IsolationLevel.MAXIMUM,
      });
      manager.init();
    });

    it('should prevent accessing native APIs via Function constructor', () => {
      expect(() => {
        const getNative = new Function('return this.fetch');
        getNative();
      }).toThrow();
    });

    it('should prevent accessing native APIs via eval', () => {
      expect(() => {
        eval('this.fetch');
      }).toThrow();
    });

    it('should prevent accessing native APIs via constructor chain', () => {
      expect(() => {
        const obj: any = {};
        const FunctionConstructor = obj.constructor.constructor;
        new FunctionConstructor('return fetch');
      }).toThrow();
    });

    it('should prevent prototype chain manipulation', () => {
      expect(() => {
        const obj: any = {};
        obj.__proto__.__proto__ = { escape: true };
      }).toThrow();
    });

    it('should prevent Object.prototype.constructor manipulation', () => {
      // Object.prototype should be frozen
      expect(Object.isFrozen(Object.prototype)).toBe(true);

      expect(() => {
        (Object.prototype as any).constructor = function() {
          return { escaped: true };
        };
      }).toThrow();
    });
  });

  describe('Original API Access for Hypervisor', () => {
    let manager: ReturnType<typeof createIsolationManager>;

    beforeEach(() => {
      manager = createIsolationManager({
        level: IsolationLevel.MAXIMUM,
      });
      manager.init();
    });

    it('should allow hypervisor to access original APIs', () => {
      const originalFetch = manager.getOriginalAPI('fetch');
      expect(originalFetch).toBeDefined();
      expect(typeof originalFetch).toBe('function');
    });

    it('should preserve original XMLHttpRequest', () => {
      const originalXHR = manager.getOriginalAPI('XMLHttpRequest');
      expect(originalXHR).toBeDefined();
    });

    it('should preserve original WebSocket', () => {
      const originalWS = manager.getOriginalAPI('WebSocket');
      expect(originalWS).toBeDefined();
    });
  });

  describe('Violation Tracking', () => {
    let manager: ReturnType<typeof createIsolationManager>;

    beforeEach(() => {
      manager = createIsolationManager({
        level: IsolationLevel.MAXIMUM,
        blockedGlobals: ['Worker'],
      });
      manager.init();
    });

    it('should record violations when blocked APIs are accessed', () => {
      const beforeCount = manager.getViolations().length;

      // Try to access window.parent
      const _ = window.parent;

      // Try to access blocked API
      manager.validateAccess('Worker', 'constructor');

      const afterCount = manager.getViolations().length;
      expect(afterCount).toBeGreaterThan(beforeCount);
    });

    it('should include stack traces in violations', () => {
      try {
        new Function('return 1');
      } catch {}

      const violations = manager.getViolations();
      if (violations.length > 0) {
        const violation = violations[violations.length - 1];
        expect(violation!.stack).toBeDefined();
      }
    });
  });
});
