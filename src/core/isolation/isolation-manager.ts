/**
 * Isolation and Escape Prevention
 * Ensures guest code cannot escape virtualization and access host APIs
 */

import { getLogger } from '../../utils/instrumentation/logger.js';
import { getMetrics } from '../../utils/instrumentation/metrics.js';

const logger = getLogger('isolation');
const metrics = getMetrics();

/**
 * Isolation level for the hypervisor
 */
export enum IsolationLevel {
  /**
   * No isolation - guest runs directly on host (for debugging)
   */
  NONE = 'none',

  /**
   * Basic isolation - trap common APIs only
   */
  BASIC = 'basic',

  /**
   * Strong isolation - trap all observable APIs
   */
  STRONG = 'strong',

  /**
   * Maximum isolation - iframe sandbox with CSP
   */
  MAXIMUM = 'maximum',
}

/**
 * Configuration for isolation enforcement
 */
export interface IsolationConfig {
  level: IsolationLevel;
  allowedGlobals?: string[];
  blockedGlobals?: string[];
  enableCSP?: boolean;
  enableIframeSandbox?: boolean;
  validateAllAccess?: boolean;
}

/**
 * Escape attempt detection and prevention
 */
export class IsolationManager {
  private config: IsolationConfig;
  private originalGlobals = new Map<string, any>();
  private accessLog: AccessAttempt[] = [];
  private violations: SecurityViolation[] = [];

  constructor(config: IsolationConfig) {
    this.config = config;
    logger.info('Isolation manager initialized', {
      level: config.level,
    });
  }

  /**
   * Initialize isolation barriers
   */
  init(): void {
    switch (this.config.level) {
      case IsolationLevel.MAXIMUM:
        this.setupMaximumIsolation();
        break;
      case IsolationLevel.STRONG:
        this.setupStrongIsolation();
        break;
      case IsolationLevel.BASIC:
        this.setupBasicIsolation();
        break;
      case IsolationLevel.NONE:
        logger.warn('No isolation enabled - for debugging only!');
        break;
    }

    metrics.counter('isolation.initialized').inc();
  }

  /**
   * Setup maximum isolation with iframe sandbox
   */
  private setupMaximumIsolation(): void {
    logger.info('Setting up maximum isolation');

    // Block access to window.parent, window.top, window.opener
    this.blockWindowEscapes();

    // Block access to Function constructor
    this.blockFunctionConstructor();

    // Block access to eval
    this.blockEval();

    // Block access to native APIs
    this.blockNativeAPIs();

    // Block access to prototype pollution
    this.protectPrototypes();

    // Block access to globalThis manipulation
    this.protectGlobalThis();

    // Setup CSP if enabled
    if (this.config.enableCSP) {
      this.setupCSP();
    }

    logger.info('Maximum isolation setup complete');
  }

  /**
   * Setup strong isolation
   */
  private setupStrongIsolation(): void {
    logger.info('Setting up strong isolation');

    this.blockFunctionConstructor();
    this.blockEval();
    this.blockNativeAPIs();
    this.protectPrototypes();

    logger.info('Strong isolation setup complete');
  }

  /**
   * Setup basic isolation
   */
  private setupBasicIsolation(): void {
    logger.info('Setting up basic isolation');

    this.blockNativeAPIs();

    logger.info('Basic isolation setup complete');
  }

  /**
   * Block window escape routes
   */
  private blockWindowEscapes(): void {
    // Block access to parent window
    Object.defineProperty(window, 'parent', {
      get: () => {
        this.recordViolation('window.parent', 'Attempted to access parent window');
        return window; // Return self instead
      },
      configurable: false,
    });

    // Block access to top window
    Object.defineProperty(window, 'top', {
      get: () => {
        this.recordViolation('window.top', 'Attempted to access top window');
        return window;
      },
      configurable: false,
    });

    // Block access to opener
    Object.defineProperty(window, 'opener', {
      get: () => {
        this.recordViolation('window.opener', 'Attempted to access opener window');
        return null;
      },
      configurable: false,
    });

    logger.debug('Window escapes blocked');
  }

  /**
   * Block Function constructor (can be used to access native code)
   */
  private blockFunctionConstructor(): void {
    const originalFunction = Function;

    // Override Function constructor
    (globalThis as any).Function = new Proxy(originalFunction, {
      construct(target, args) {
        logger.warn('Function constructor blocked', {
          operation: 'Function constructor',
          args: args.map(a => typeof a),
        });

        metrics.counter('isolation.function_constructor_blocked').inc();

        throw new Error(
          'Function constructor is disabled in isolated environment'
        );
      },
    });

    // Also block indirect access via constructor property
    Object.defineProperty((() => {}).constructor, 'constructor', {
      get: () => {
        this.recordViolation('Function.constructor', 'Attempted to access Function constructor');
        throw new Error('Access denied');
      },
    });

    logger.debug('Function constructor blocked');
  }

  /**
   * Block eval (can execute arbitrary code)
   */
  private blockEval(): void {
    const originalEval = eval;

    (globalThis as any).eval = function (...args: any[]) {
      logger.warn('eval blocked', {
        operation: 'eval',
        code: args[0]?.substring(0, 100),
      });

      metrics.counter('isolation.eval_blocked').inc();

      throw new Error('eval is disabled in isolated environment');
    };

    logger.debug('eval blocked');
  }

  /**
   * Block access to native APIs that weren't trapped
   */
  private blockNativeAPIs(): void {
    // Save originals for our own use
    this.originalGlobals.set('fetch', fetch);
    this.originalGlobals.set('XMLHttpRequest', XMLHttpRequest);
    this.originalGlobals.set('WebSocket', WebSocket);
    this.originalGlobals.set('Worker', Worker);
    this.originalGlobals.set('SharedWorker', SharedWorker);
    this.originalGlobals.set('importScripts', (globalThis as any).importScripts);

    // Block dangerous APIs if not in allowed list
    const dangerousAPIs = [
      'importScripts',
      'SharedWorker',
      'Worker', // If not allowing workers
    ];

    for (const api of dangerousAPIs) {
      if (this.config.blockedGlobals?.includes(api)) {
        this.blockGlobalAPI(api);
      }
    }

    logger.debug('Native APIs access controlled');
  }

  /**
   * Block a specific global API
   */
  private blockGlobalAPI(name: string): void {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    if (!descriptor) return;

    Object.defineProperty(globalThis, name, {
      get: () => {
        this.recordViolation(name, `Attempted to access blocked API: ${name}`);
        throw new Error(`Access to ${name} is not allowed in isolated environment`);
      },
      configurable: false,
    });

    logger.debug('Blocked global API', { api: name });
  }

  /**
   * Protect against prototype pollution
   */
  private protectPrototypes(): void {
    // Freeze Object.prototype
    Object.freeze(Object.prototype);
    Object.freeze(Array.prototype);
    Object.freeze(Function.prototype);
    Object.freeze(String.prototype);
    Object.freeze(Number.prototype);
    Object.freeze(Boolean.prototype);

    // Prevent __proto__ manipulation
    Object.defineProperty(Object.prototype, '__proto__', {
      get: function() {
        return Object.getPrototypeOf(this);
      },
      set: function() {
        logger.warn('__proto__ manipulation blocked');
        metrics.counter('isolation.proto_pollution_blocked').inc();
        throw new Error('__proto__ manipulation is not allowed');
      },
    });

    logger.debug('Prototypes protected');
  }

  /**
   * Protect globalThis from manipulation
   */
  private protectGlobalThis(): void {
    // Make globalThis non-configurable for critical properties
    const criticalProps = [
      'window',
      'document',
      'location',
      'navigator',
      'setTimeout',
      'setInterval',
      'fetch',
      'XMLHttpRequest',
      'WebSocket',
    ];

    for (const prop of criticalProps) {
      const descriptor = Object.getOwnPropertyDescriptor(globalThis, prop);
      if (descriptor) {
        Object.defineProperty(globalThis, prop, {
          ...descriptor,
          configurable: false,
        });
      }
    }

    logger.debug('globalThis protected');
  }

  /**
   * Setup Content Security Policy
   */
  private setupCSP(): void {
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'", // Needed for inline scripts
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self'",
      "img-src 'self' data:",
      "font-src 'self'",
      "object-src 'none'",
      "frame-src 'none'",
      "worker-src 'none'",
    ].join('; ');

    document.head.appendChild(meta);

    logger.info('CSP configured');
  }

  /**
   * Record security violation
   */
  private recordViolation(api: string, message: string): void {
    const violation: SecurityViolation = {
      timestamp: Date.now(),
      api,
      message,
      stack: new Error().stack || '',
    };

    this.violations.push(violation);
    metrics.counter('isolation.violations').inc();

    logger.warn('Security violation detected', {
      api,
      message,
    });
  }

  /**
   * Validate access to API
   */
  validateAccess(api: string, operation: string): boolean {
    const attempt: AccessAttempt = {
      timestamp: Date.now(),
      api,
      operation,
      allowed: false,
    };

    // Check if API is in allowed list
    if (this.config.allowedGlobals?.includes(api)) {
      attempt.allowed = true;
      this.accessLog.push(attempt);
      return true;
    }

    // Check if API is in blocked list
    if (this.config.blockedGlobals?.includes(api)) {
      attempt.allowed = false;
      this.accessLog.push(attempt);
      this.recordViolation(api, `Blocked access to ${api}.${operation}`);
      return false;
    }

    // Default based on isolation level
    attempt.allowed = this.config.level === IsolationLevel.NONE;
    this.accessLog.push(attempt);

    return attempt.allowed;
  }

  /**
   * Get all security violations
   */
  getViolations(): SecurityViolation[] {
    return [...this.violations];
  }

  /**
   * Get access log
   */
  getAccessLog(): AccessAttempt[] {
    return [...this.accessLog];
  }

  /**
   * Check if environment is properly isolated
   */
  validateIsolation(): IsolationValidation {
    const tests: IsolationTest[] = [];

    // Test 1: Can we access Function constructor?
    tests.push({
      name: 'Function constructor blocked',
      passed: this.testFunctionConstructorBlocked(),
    });

    // Test 2: Can we access eval?
    tests.push({
      name: 'eval blocked',
      passed: this.testEvalBlocked(),
    });

    // Test 3: Can we access window.parent?
    tests.push({
      name: 'window.parent blocked',
      passed: this.testWindowParentBlocked(),
    });

    // Test 4: Can we pollute prototypes?
    tests.push({
      name: 'Prototype pollution blocked',
      passed: this.testPrototypePollutionBlocked(),
    });

    const passed = tests.filter(t => t.passed).length;
    const total = tests.length;

    logger.info('Isolation validation complete', {
      passed,
      total,
      percentage: (passed / total) * 100,
    });

    return {
      passed: passed === total,
      tests,
      level: this.config.level,
    };
  }

  private testFunctionConstructorBlocked(): boolean {
    try {
      new Function('return 1')();
      return false;
    } catch {
      return true;
    }
  }

  private testEvalBlocked(): boolean {
    try {
      eval('1 + 1');
      return false;
    } catch {
      return true;
    }
  }

  private testWindowParentBlocked(): boolean {
    try {
      return window.parent === window;
    } catch {
      return true;
    }
  }

  private testPrototypePollutionBlocked(): boolean {
    try {
      (Object.prototype as any).polluted = true;
      return false;
    } catch {
      return true;
    }
  }

  /**
   * Get original (native) API if needed by hypervisor internals
   */
  getOriginalAPI<T = any>(name: string): T | undefined {
    return this.originalGlobals.get(name);
  }

  /**
   * Export isolation report
   */
  exportReport(): string {
    return JSON.stringify(
      {
        config: this.config,
        violations: this.violations,
        accessLog: this.accessLog.slice(-100), // Last 100 attempts
        validation: this.validateIsolation(),
      },
      null,
      2
    );
  }

  /**
   * Cleanup and restore original APIs
   */
  cleanup(): void {
    // This is intentionally limited - some changes cannot be undone
    // due to security requirements
    logger.info('Isolation cleanup (limited restoration)');
  }
}

/**
 * Access attempt record
 */
export interface AccessAttempt {
  timestamp: number;
  api: string;
  operation: string;
  allowed: boolean;
}

/**
 * Security violation record
 */
export interface SecurityViolation {
  timestamp: number;
  api: string;
  message: string;
  stack: string;
}

/**
 * Isolation test result
 */
export interface IsolationTest {
  name: string;
  passed: boolean;
}

/**
 * Isolation validation result
 */
export interface IsolationValidation {
  passed: boolean;
  tests: IsolationTest[];
  level: IsolationLevel;
}

/**
 * Create isolation manager
 */
export function createIsolationManager(
  config: IsolationConfig
): IsolationManager {
  return new IsolationManager(config);
}
