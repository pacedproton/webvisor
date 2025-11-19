/**
 * Main WebVisor class
 * Hypervisor for the web platform
 */

import type {
  WebVisorConfig,
  GuestCode,
  WebVisorPlugin,
  PerformanceMetrics,
} from './core/types.js';
import type { StateSnapshot } from './core/state/types.js';
import type { VirtualPlatformState } from './core/virtual-platform/types.js';
import { createVirtualClock } from './core/virtual-platform/virtual-clock.js';
import { createVirtualRNG, PRNGAlgorithm } from './core/virtual-platform/virtual-rng.js';
import { createVirtualDOM } from './core/virtual-platform/virtual-dom.js';
import { createStateManager } from './core/state/state-manager.js';
import { createInspector } from './tools/inspector.js';
import { createProfiler } from './tools/profiler.js';
import { getLogger, LogLevel } from './utils/instrumentation/logger.js';
import { getMetrics } from './utils/instrumentation/metrics.js';
import { getTracer } from './utils/instrumentation/tracer.js';

const logger = getLogger('webvisor');

/**
 * Main WebVisor hypervisor class
 */
export class WebVisor {
  private config: WebVisorConfig;
  private plugins: WebVisorPlugin[] = [];

  // Virtual platform components
  private vClock = createVirtualClock();
  private vRNG = createVirtualRNG(Date.now(), PRNGAlgorithm.XORSHIFT128);
  private vDOM = createVirtualDOM();

  // Core systems
  private stateManager = createStateManager({ maxSnapshots: 1000 });
  private inspector = createInspector();
  private profiler = createProfiler(100000);

  // State
  private running = false;
  private paused = false;
  private guestCode: GuestCode | null = null;

  constructor(config: WebVisorConfig) {
    this.config = this.validateConfig(config);

    // Configure logging
    if (this.config.enableTracing) {
      logger.setLevel(LogLevel.TRACE);
    }

    // Register state providers/restorers
    this.stateManager.registerProviders({
      platform: () => this.getPlatformState(),
    });

    this.stateManager.registerRestorers({
      platform: (state) => this.setPlatformState(state),
    });

    // Register inspector state provider
    this.inspector.registerStateProvider(() => this.stateManager.snapshot());

    // Start profiling if enabled
    if (this.config.enableProfiling) {
      this.profiler.start();
    }

    logger.info('WebVisor initialized', {
      operation: 'constructor',
      mode: this.config.mode,
      apis: this.config.apis,
    });

    // Record initialization metric
    getMetrics().counter('webvisor.initialized').inc();
  }

  /**
   * Validate configuration
   */
  private validateConfig(config: WebVisorConfig): WebVisorConfig {
    if (!config.mode) {
      throw new Error('Execution mode is required');
    }

    if (!config.apis || config.apis.length === 0) {
      throw new Error('At least one API must be specified');
    }

    return {
      enableSnapshots: true,
      snapshotInterval: 1000,
      maxHistory: 1000,
      enableProfiling: false,
      enableTracing: false,
      ...config,
    };
  }

  /**
   * Load guest code
   */
  async load(code: GuestCode): Promise<void> {
    return getTracer().trace('webvisor.load', async (span) => {
      this.guestCode = code;

      span.setAttribute('codeLength', code.code.length);
      span.setAttribute('type', code.type || 'script');

      logger.info('Guest code loaded', {
        operation: 'load',
        codeLength: code.code.length,
        type: code.type,
        url: code.url,
      });

      getMetrics().counter('webvisor.code_loaded').inc();
    }) as Promise<void>;
  }

  /**
   * Run guest code
   */
  async run(): Promise<void> {
    if (!this.guestCode) {
      throw new Error('No guest code loaded');
    }

    if (this.running) {
      throw new Error('Already running');
    }

    return getTracer().trace('webvisor.run', async (span) => {
      this.running = true;
      this.paused = false;

      logger.info('Execution started', { operation: 'run' });

      try {
        // Create initial snapshot if enabled
        if (this.config.enableSnapshots) {
          this.stateManager.snapshot({ label: 'initial' });
        }

        // Start automatic snapshots
        if (this.config.enableSnapshots && this.config.snapshotInterval) {
          this.startAutoSnapshots();
        }

        // TODO: Actually execute the guest code
        // This would involve setting up the trap layer and running the code
        // in the virtualized environment

        logger.info('Guest code executed', {
          operation: 'run',
        });

        span.setAttribute('success', true);
      } catch (error) {
        logger.error('Execution failed', error);
        span.setStatus('error' as any, error as Error);
        throw error;
      }
    }) as Promise<void>;
  }

  /**
   * Pause execution
   */
  pause(): void {
    if (!this.running) {
      throw new Error('Not running');
    }

    if (this.paused) {
      return;
    }

    this.paused = true;
    this.vClock.freeze();

    logger.info('Execution paused', { operation: 'pause' });
    getMetrics().counter('webvisor.paused').inc();
  }

  /**
   * Resume execution
   */
  resume(): void {
    if (!this.paused) {
      return;
    }

    this.paused = false;
    this.vClock.unfreeze();

    logger.info('Execution resumed', { operation: 'resume' });
    getMetrics().counter('webvisor.resumed').inc();
  }

  /**
   * Step one operation
   */
  async step(): Promise<void> {
    if (!this.running) {
      throw new Error('Not running');
    }

    // TODO: Implement single-step execution
    logger.info('Stepped one operation', { operation: 'step' });
  }

  /**
   * Stop execution
   */
  stop(): void {
    this.running = false;
    this.paused = false;

    logger.info('Execution stopped', { operation: 'stop' });
    getMetrics().counter('webvisor.stopped').inc();
  }

  /**
   * Create snapshot
   */
  snapshot(metadata?: { label?: string; tags?: string[] }): StateSnapshot {
    const snapshot = this.stateManager.snapshot(metadata);

    logger.info('Snapshot created', {
      operation: 'snapshot',
      id: snapshot.id,
      size: snapshot.metadata.size,
    });

    return snapshot;
  }

  /**
   * Restore from snapshot
   */
  async restore(snapshot: StateSnapshot): Promise<void> {
    return this.stateManager.restore(snapshot);
  }

  /**
   * Rewind execution
   */
  async rewind(steps: number): Promise<void> {
    return this.stateManager.rewind(steps);
  }

  /**
   * Forward execution
   */
  async forward(steps: number): Promise<void> {
    return this.stateManager.forward(steps);
  }

  /**
   * Use a plugin
   */
  use(plugin: WebVisorPlugin): void {
    this.plugins.push(plugin);

    if (plugin.onInit) {
      plugin.onInit(this);
    }

    logger.info('Plugin registered', {
      operation: 'use',
      plugin: plugin.name,
      version: plugin.version,
    });
  }

  /**
   * Intercept API calls
   */
  intercept(api: string, handler: (...args: any[]) => any): void {
    // TODO: Add to trap layer
    logger.info('Intercept registered', {
      operation: 'intercept',
      api,
    });
  }

  /**
   * Get virtual clock
   */
  getClock() {
    return this.vClock;
  }

  /**
   * Get virtual RNG
   */
  getRNG() {
    return this.vRNG;
  }

  /**
   * Get virtual DOM
   */
  getDOM() {
    return this.vDOM;
  }

  /**
   * Get inspector
   */
  getInspector() {
    return this.inspector;
  }

  /**
   * Get profiler
   */
  getProfiler() {
    return this.profiler;
  }

  /**
   * Get DOM tree
   */
  getDOMTree() {
    return this.vDOM.getDocument();
  }

  /**
   * Get network activity
   */
  getNetworkActivity() {
    // TODO: Implement network activity tracking
    return [];
  }

  /**
   * Export trace
   */
  async exportTrace(): Promise<string> {
    return getTracer().export();
  }

  /**
   * Export profile
   */
  async exportProfile(): Promise<string> {
    return this.profiler.exportReport();
  }

  /**
   * Get performance metrics
   */
  getMetrics(): PerformanceMetrics {
    const metricsRegistry = getMetrics();
    const summary = metricsRegistry.getSummary();

    return {
      apiCalls: {},
      apiDurations: {},
      memoryUsage: [],
      snapshots: {
        count: this.stateManager.getHistory().length,
        totalSize: 0,
        averageTime: 0,
      },
      totalExecutionTime: 0,
      overhead: 0,
    };
  }

  /**
   * Get platform state
   */
  private getPlatformState(): VirtualPlatformState {
    return {
      dom: this.vDOM.serialize(),
      network: {
        inFlightRequests: [],
        cache: [],
        mocks: [],
      },
      storage: {
        localStorage: {},
        sessionStorage: {},
        indexedDB: { databases: [] },
      },
      clock: this.vClock.getState(),
      rng: this.vRNG.getState(),
    };
  }

  /**
   * Set platform state
   */
  private setPlatformState(state: VirtualPlatformState): void {
    if (state.dom) {
      this.vDOM.deserialize(state.dom);
    }

    if (state.clock) {
      this.vClock.setState(state.clock);
    }

    if (state.rng) {
      this.vRNG.setState(state.rng);
    }
  }

  /**
   * Start automatic snapshots
   */
  private startAutoSnapshots(): void {
    if (!this.config.snapshotInterval) return;

    setInterval(() => {
      if (this.running && !this.paused) {
        this.snapshot({ label: 'auto' });
      }
    }, this.config.snapshotInterval);
  }

  /**
   * Get statistics
   */
  getStats(): WebVisorStats {
    return {
      running: this.running,
      paused: this.paused,
      clock: this.vClock.getStats?.() || {
        currentTime: 0,
        sequence: 0,
        frozen: false,
        scheduledCallbacks: 0,
        callbacksByType: { timeout: 0, interval: 0, animationFrame: 0 },
        nextScheduledTime: null,
      },
      rng: this.vRNG.getStats?.() || {
        algorithm: 'xorshift128',
        seed: 0,
        randomCalls: 0,
        randomValuesCalls: 0,
        bytesGenerated: 0,
      },
      dom: this.vDOM.getStats?.() || {
        elementCount: 0,
        textCount: 0,
        totalNodes: 0,
        maxDepth: 0,
      },
      state: this.stateManager.getStats?.() || {
        totalSnapshots: 0,
        currentPosition: 0,
        totalSize: 0,
        averageSize: 0,
        maxSize: 0,
        minSize: 0,
      },
      profiler: this.profiler.getStats(),
    };
  }

  /**
   * Export full report
   */
  exportReport(): string {
    const report = {
      config: this.config,
      stats: this.getStats(),
      inspector: this.inspector.exportReport(),
      profiler: this.profiler.exportReport(),
      metrics: getMetrics().export(),
      traces: getTracer().export(),
      logs: logger.export(),
    };

    return JSON.stringify(report, null, 2);
  }
}

export interface WebVisorStats {
  running: boolean;
  paused: boolean;
  clock: any;
  rng: any;
  dom: any;
  state: any;
  profiler: any;
}
