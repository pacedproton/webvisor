/**
 * Profiler tool for WebVisor
 * Analyzes performance and provides optimization insights
 */

import type { APICallTrace } from '../core/types.js';
import { getLogger } from '../utils/instrumentation/logger.js';
import { getMetrics } from '../utils/instrumentation/metrics.js';

const logger = getLogger('profiler');

/**
 * Profiler for performance analysis
 */
export class Profiler {
  private traces: APICallTrace[] = [];
  private maxTraces: number;
  private recording: boolean = false;
  private startTime: number = 0;

  constructor(maxTraces: number = 100000) {
    this.maxTraces = maxTraces;

    logger.info('Profiler initialized', {
      operation: 'constructor',
      maxTraces,
    });
  }

  /**
   * Start recording
   */
  start(): void {
    this.recording = true;
    this.startTime = performance.now();
    this.traces = [];

    logger.info('Profiling started', { operation: 'start' });
  }

  /**
   * Stop recording
   */
  stop(): void {
    this.recording = false;

    logger.info('Profiling stopped', {
      operation: 'stop',
      traces: this.traces.length,
      duration: performance.now() - this.startTime,
    });
  }

  /**
   * Check if recording
   */
  isRecording(): boolean {
    return this.recording;
  }

  /**
   * Record API call trace
   */
  recordTrace(trace: APICallTrace): void {
    if (!this.recording) return;

    this.traces.push(trace);

    if (this.traces.length > this.maxTraces) {
      this.traces.shift();
    }
  }

  /**
   * Get all traces
   */
  getTraces(): APICallTrace[] {
    return [...this.traces];
  }

  /**
   * Clear traces
   */
  clear(): void {
    this.traces = [];
    logger.info('Traces cleared', { operation: 'clear' });
  }

  /**
   * Analyze API usage
   */
  analyzeAPIUsage(): APIUsageAnalysis {
    const callCounts = new Map<string, number>();
    const totalDurations = new Map<string, number>();
    const errors = new Map<string, number>();

    for (const trace of this.traces) {
      // Count calls
      const count = callCounts.get(trace.api) || 0;
      callCounts.set(trace.api, count + 1);

      // Sum durations
      if (trace.duration) {
        const duration = totalDurations.get(trace.api) || 0;
        totalDurations.set(trace.api, duration + trace.duration);
      }

      // Count errors
      if (trace.error) {
        const errorCount = errors.get(trace.api) || 0;
        errors.set(trace.api, errorCount + 1);
      }
    }

    const analysis: APIUsageAnalysis = {
      totalCalls: this.traces.length,
      byAPI: [],
    };

    for (const [api, count] of callCounts) {
      const totalDuration = totalDurations.get(api) || 0;
      const errorCount = errors.get(api) || 0;

      analysis.byAPI.push({
        api,
        callCount: count,
        totalDuration,
        averageDuration: totalDuration / count,
        errorCount,
        errorRate: errorCount / count,
      });
    }

    // Sort by total duration descending
    analysis.byAPI.sort((a, b) => b.totalDuration - a.totalDuration);

    return analysis;
  }

  /**
   * Find performance hotspots
   */
  findHotspots(threshold: number = 1000): Hotspot[] {
    const hotspots: Hotspot[] = [];

    for (const trace of this.traces) {
      if (trace.duration && trace.duration > threshold) {
        hotspots.push({
          api: trace.api,
          duration: trace.duration,
          timestamp: trace.timestamp.value,
          stack: trace.stack,
        });
      }
    }

    // Sort by duration descending
    hotspots.sort((a, b) => b.duration - a.duration);

    return hotspots;
  }

  /**
   * Analyze DOM operations
   */
  analyzeDOMOperations(): DOMAnalysis {
    const domTraces = this.traces.filter((t) => t.api.startsWith('dom.'));

    const operations = new Map<string, number>();
    let totalDuration = 0;

    for (const trace of domTraces) {
      const op = trace.api.replace('dom.', '');
      const count = operations.get(op) || 0;
      operations.set(op, count + 1);

      if (trace.duration) {
        totalDuration += trace.duration;
      }
    }

    return {
      totalOperations: domTraces.length,
      totalDuration,
      averageDuration: domTraces.length > 0 ? totalDuration / domTraces.length : 0,
      byOperation: Array.from(operations.entries()).map(([op, count]) => ({
        operation: op,
        count,
      })),
    };
  }

  /**
   * Analyze network operations
   */
  analyzeNetworkOperations(): NetworkAnalysis {
    const networkTraces = this.traces.filter((t) => t.api.startsWith('network.'));

    let totalRequests = 0;
    let totalDuration = 0;
    let cacheHits = 0;
    let cacheMisses = 0;

    for (const trace of networkTraces) {
      totalRequests++;

      if (trace.duration) {
        totalDuration += trace.duration;
      }

      // Simple heuristic: fast requests might be cached
      if (trace.duration && trace.duration < 10) {
        cacheHits++;
      } else {
        cacheMisses++;
      }
    }

    return {
      totalRequests,
      totalDuration,
      averageDuration: totalRequests > 0 ? totalDuration / totalRequests : 0,
      cacheHits,
      cacheMisses,
      cacheHitRate: totalRequests > 0 ? cacheHits / totalRequests : 0,
    };
  }

  /**
   * Generate optimization suggestions
   */
  generateSuggestions(): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    const apiUsage = this.analyzeAPIUsage();
    const domAnalysis = this.analyzeDOMOperations();
    const networkAnalysis = this.analyzeNetworkOperations();

    // Check for excessive DOM operations
    if (domAnalysis.totalOperations > 1000) {
      suggestions.push({
        severity: 'high',
        category: 'dom',
        message: `High number of DOM operations detected (${domAnalysis.totalOperations}). Consider batching operations.`,
        metric: domAnalysis.totalOperations,
      });
    }

    // Check for slow API calls
    for (const api of apiUsage.byAPI) {
      if (api.averageDuration > 100) {
        suggestions.push({
          severity: 'medium',
          category: 'performance',
          message: `API "${api.api}" has high average duration (${api.averageDuration.toFixed(2)}ms). Consider optimization.`,
          metric: api.averageDuration,
        });
      }
    }

    // Check for high error rates
    for (const api of apiUsage.byAPI) {
      if (api.errorRate > 0.1) {
        suggestions.push({
          severity: 'high',
          category: 'reliability',
          message: `API "${api.api}" has high error rate (${(api.errorRate * 100).toFixed(1)}%). Investigate failures.`,
          metric: api.errorRate,
        });
      }
    }

    // Check network cache efficiency
    if (networkAnalysis.cacheHitRate < 0.5 && networkAnalysis.totalRequests > 10) {
      suggestions.push({
        severity: 'medium',
        category: 'network',
        message: `Low cache hit rate (${(networkAnalysis.cacheHitRate * 100).toFixed(1)}%). Consider caching more responses.`,
        metric: networkAnalysis.cacheHitRate,
      });
    }

    return suggestions;
  }

  /**
   * Export profiling report
   */
  exportReport(): string {
    const report = {
      recordingDuration: this.recording ? performance.now() - this.startTime : 0,
      totalTraces: this.traces.length,
      apiUsage: this.analyzeAPIUsage(),
      domAnalysis: this.analyzeDOMOperations(),
      networkAnalysis: this.analyzeNetworkOperations(),
      hotspots: this.findHotspots(100),
      suggestions: this.generateSuggestions(),
      metrics: getMetrics().getSummary(),
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * Get statistics
   */
  getStats(): ProfilerStats {
    return {
      recording: this.recording,
      totalTraces: this.traces.length,
      recordingDuration: this.recording ? performance.now() - this.startTime : 0,
      maxTraces: this.maxTraces,
    };
  }
}

export interface APIUsageAnalysis {
  totalCalls: number;
  byAPI: Array<{
    api: string;
    callCount: number;
    totalDuration: number;
    averageDuration: number;
    errorCount: number;
    errorRate: number;
  }>;
}

export interface Hotspot {
  api: string;
  duration: number;
  timestamp: number;
  stack: any[];
}

export interface DOMAnalysis {
  totalOperations: number;
  totalDuration: number;
  averageDuration: number;
  byOperation: Array<{
    operation: string;
    count: number;
  }>;
}

export interface NetworkAnalysis {
  totalRequests: number;
  totalDuration: number;
  averageDuration: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
}

export interface OptimizationSuggestion {
  severity: 'low' | 'medium' | 'high';
  category: 'dom' | 'network' | 'performance' | 'reliability';
  message: string;
  metric: number;
}

export interface ProfilerStats {
  recording: boolean;
  totalTraces: number;
  recordingDuration: number;
  maxTraces: number;
}

/**
 * Create a new profiler
 */
export function createProfiler(maxTraces?: number): Profiler {
  return new Profiler(maxTraces);
}
