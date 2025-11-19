/**
 * Inspector tool for WebVisor
 * Provides real-time visibility into hypervisor state
 */

import type { StateSnapshot } from '../core/state/types.js';
import { getLogger } from '../utils/instrumentation/logger.js';
import { getMetrics } from '../utils/instrumentation/metrics.js';
import { getTracer } from '../utils/instrumentation/tracer.js';

const logger = getLogger('inspector');

/**
 * Inspector for examining WebVisor state
 */
export class Inspector {
  private stateProvider?: () => StateSnapshot;
  private updateHandlers: Set<(state: InspectorState) => void> = new Set();
  private updateInterval: number = 1000; // ms
  private intervalId?: ReturnType<typeof setInterval>;

  constructor() {
    logger.info('Inspector initialized');
  }

  /**
   * Register state provider
   */
  registerStateProvider(provider: () => StateSnapshot): void {
    this.stateProvider = provider;
  }

  /**
   * Start real-time updates
   */
  startUpdates(intervalMs: number = 1000): void {
    this.updateInterval = intervalMs;

    if (this.intervalId) {
      this.stopUpdates();
    }

    this.intervalId = setInterval(() => {
      this.update();
    }, this.updateInterval);

    logger.info('Inspector updates started', {
      operation: 'startUpdates',
      interval: intervalMs,
    });
  }

  /**
   * Stop real-time updates
   */
  stopUpdates(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;

      logger.info('Inspector updates stopped', {
        operation: 'stopUpdates',
      });
    }
  }

  /**
   * Manually trigger update
   */
  update(): void {
    const state = this.getInspectorState();

    for (const handler of this.updateHandlers) {
      try {
        handler(state);
      } catch (error) {
        logger.error('Update handler error', error);
      }
    }
  }

  /**
   * Subscribe to state updates
   */
  onUpdate(handler: (state: InspectorState) => void): () => void {
    this.updateHandlers.add(handler);

    return () => {
      this.updateHandlers.delete(handler);
    };
  }

  /**
   * Get current inspector state
   */
  getInspectorState(): InspectorState {
    const snapshot = this.stateProvider?.();

    return {
      timestamp: Date.now(),
      snapshot,
      metrics: this.getMetricsSnapshot(),
      traces: this.getTracesSnapshot(),
      logs: this.getLogsSnapshot(),
    };
  }

  /**
   * Get metrics snapshot
   */
  private getMetricsSnapshot(): MetricsSnapshot {
    const metricsRegistry = getMetrics();
    const summary = metricsRegistry.getSummary();

    return {
      totalMetrics: summary.totalMetrics,
      byType: summary.byType,
      metrics: summary.metrics.map((m) => ({
        name: m.name,
        type: m.type,
        value: m.value,
      })),
    };
  }

  /**
   * Get traces snapshot
   */
  private getTracesSnapshot(): TracesSnapshot {
    const tracer = getTracer();
    const stats = tracer.getStats();
    const completed = tracer.getCompletedSpans();

    return {
      stats,
      recentSpans: completed.slice(-100).map((span) => ({
        name: span.name,
        duration: span.duration,
        status: span.status,
        startTime: span.startTime,
      })),
    };
  }

  /**
   * Get logs snapshot
   */
  private getLogsSnapshot(): LogsSnapshot {
    const loggerInstance = logger;
    const buffer = loggerInstance.getBuffer();

    return {
      totalLogs: buffer.length,
      recentLogs: buffer.slice(-100).map((entry) => ({
        level: entry.level,
        message: entry.message,
        timestamp: entry.timestamp,
        component: entry.context.component,
      })),
    };
  }

  /**
   * Inspect DOM state
   */
  inspectDOM(): DOMInspection {
    const snapshot = this.stateProvider?.();
    if (!snapshot?.platform?.dom) {
      return {
        nodeCount: 0,
        maxDepth: 0,
        nodes: [],
      };
    }

    const dom = snapshot.platform.dom;

    return {
      nodeCount: dom.nodes.length,
      maxDepth: this.calculateDOMDepth(dom),
      nodes: dom.nodes.map((node) => ({
        id: node.id,
        type: node.type,
        tagName: node.tagName,
        attributes: node.attributes,
      })),
    };
  }

  /**
   * Inspect network state
   */
  inspectNetwork(): NetworkInspection {
    const snapshot = this.stateProvider?.();
    if (!snapshot?.platform?.network) {
      return {
        inFlightRequests: 0,
        cachedResponses: 0,
        requests: [],
      };
    }

    const network = snapshot.platform.network;

    return {
      inFlightRequests: network.inFlightRequests.length,
      cachedResponses: network.cache.length,
      requests: network.inFlightRequests.map((req) => ({
        id: req.id,
        url: req.url,
        method: req.method,
        timestamp: req.timestamp.value,
      })),
    };
  }

  /**
   * Inspect storage state
   */
  inspectStorage(): StorageInspection {
    const snapshot = this.stateProvider?.();
    if (!snapshot?.platform?.storage) {
      return {
        localStorageSize: 0,
        sessionStorageSize: 0,
        indexedDBSize: 0,
      };
    }

    const storage = snapshot.platform.storage;

    return {
      localStorageSize: Object.keys(storage.localStorage).length,
      sessionStorageSize: Object.keys(storage.sessionStorage).length,
      indexedDBSize: storage.indexedDB.databases.length,
      localStorage: storage.localStorage,
      sessionStorage: storage.sessionStorage,
    };
  }

  /**
   * Inspect timing state
   */
  inspectTiming(): TimingInspection {
    const snapshot = this.stateProvider?.();
    if (!snapshot?.platform?.clock) {
      return {
        currentTime: 0,
        scheduledCallbacks: 0,
        callbacks: [],
      };
    }

    const clock = snapshot.platform.clock;

    return {
      currentTime: clock.currentTime.value,
      scheduledCallbacks: clock.scheduled.length,
      callbacks: clock.scheduled.map((cb) => ({
        id: cb.id,
        type: cb.type,
        scheduledTime: cb.time.value,
      })),
    };
  }

  /**
   * Calculate DOM depth
   */
  private calculateDOMDepth(dom: any): number {
    let maxDepth = 0;

    const traverse = (nodeId: string, depth: number): void => {
      maxDepth = Math.max(maxDepth, depth);

      const node = dom.nodes.find((n: any) => n.id === nodeId);
      if (node && node.children) {
        for (const childId of node.children) {
          traverse(childId, depth + 1);
        }
      }
    };

    traverse(dom.rootId, 0);
    return maxDepth;
  }

  /**
   * Export inspection report
   */
  exportReport(): string {
    const state = this.getInspectorState();

    const report = {
      timestamp: state.timestamp,
      dom: this.inspectDOM(),
      network: this.inspectNetwork(),
      storage: this.inspectStorage(),
      timing: this.inspectTiming(),
      metrics: state.metrics,
      traces: state.traces,
      logs: state.logs,
    };

    return JSON.stringify(report, null, 2);
  }
}

export interface InspectorState {
  timestamp: number;
  snapshot?: StateSnapshot;
  metrics: MetricsSnapshot;
  traces: TracesSnapshot;
  logs: LogsSnapshot;
}

export interface MetricsSnapshot {
  totalMetrics: number;
  byType: Record<string, number>;
  metrics: Array<{
    name: string;
    type: string;
    value: any;
  }>;
}

export interface TracesSnapshot {
  stats: any;
  recentSpans: Array<{
    name: string;
    duration?: number;
    status: string;
    startTime: number;
  }>;
}

export interface LogsSnapshot {
  totalLogs: number;
  recentLogs: Array<{
    level: number;
    message: string;
    timestamp: number;
    component: string;
  }>;
}

export interface DOMInspection {
  nodeCount: number;
  maxDepth: number;
  nodes: Array<{
    id: string;
    type: string;
    tagName?: string;
    attributes?: Record<string, string>;
  }>;
}

export interface NetworkInspection {
  inFlightRequests: number;
  cachedResponses: number;
  requests: Array<{
    id: string;
    url: string;
    method: string;
    timestamp: number;
  }>;
}

export interface StorageInspection {
  localStorageSize: number;
  sessionStorageSize: number;
  indexedDBSize: number;
  localStorage?: Record<string, string>;
  sessionStorage?: Record<string, string>;
}

export interface TimingInspection {
  currentTime: number;
  scheduledCallbacks: number;
  callbacks: Array<{
    id: number;
    type: string;
    scheduledTime: number;
  }>;
}

/**
 * Create a new inspector
 */
export function createInspector(): Inspector {
  return new Inspector();
}
