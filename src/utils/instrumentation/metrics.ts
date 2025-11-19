/**
 * Metrics collection and reporting system
 * Provides counters, gauges, histograms, and timers
 */

import { getLogger } from './logger.js';

const logger = getLogger('metrics');

export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  TIMER = 'timer',
}

export interface MetricMetadata {
  name: string;
  type: MetricType;
  description?: string;
  unit?: string;
  labels: Map<string, string>;
}

export interface MetricValue {
  value: number;
  timestamp: number;
  labels: Map<string, string>;
}

export interface HistogramBucket {
  le: number; // Less than or equal to
  count: number;
}

export interface HistogramSnapshot {
  count: number;
  sum: number;
  buckets: HistogramBucket[];
  quantiles: Map<number, number>; // p50, p90, p95, p99
}

/**
 * Base metric class
 */
abstract class Metric {
  protected metadata: MetricMetadata;
  protected values: MetricValue[] = [];

  constructor(
    name: string,
    type: MetricType,
    description?: string,
    unit?: string
  ) {
    this.metadata = {
      name,
      type,
      description,
      unit,
      labels: new Map(),
    };
  }

  getName(): string {
    return this.metadata.name;
  }

  getType(): MetricType {
    return this.metadata.type;
  }

  getMetadata(): MetricMetadata {
    return { ...this.metadata };
  }

  abstract getValue(): number | HistogramSnapshot;
  abstract reset(): void;
}

/**
 * Counter metric (monotonically increasing)
 */
export class Counter extends Metric {
  private count = 0;

  constructor(name: string, description?: string) {
    super(name, MetricType.COUNTER, description);
  }

  /**
   * Increment counter
   */
  inc(value: number = 1, labels?: Record<string, string>): void {
    if (value < 0) {
      throw new Error('Counter can only increase');
    }

    this.count += value;
    this.values.push({
      value: this.count,
      timestamp: Date.now(),
      labels: new Map(Object.entries(labels || {})),
    });

    logger.trace('Counter incremented', {
      operation: 'inc',
      metric: this.metadata.name,
      value,
      total: this.count,
    });
  }

  getValue(): number {
    return this.count;
  }

  reset(): void {
    this.count = 0;
    this.values = [];
  }
}

/**
 * Gauge metric (can go up or down)
 */
export class Gauge extends Metric {
  private value = 0;

  constructor(name: string, description?: string, unit?: string) {
    super(name, MetricType.GAUGE, description, unit);
  }

  /**
   * Set gauge value
   */
  set(value: number, labels?: Record<string, string>): void {
    this.value = value;
    this.values.push({
      value,
      timestamp: Date.now(),
      labels: new Map(Object.entries(labels || {})),
    });
  }

  /**
   * Increment gauge
   */
  inc(value: number = 1): void {
    this.set(this.value + value);
  }

  /**
   * Decrement gauge
   */
  dec(value: number = 1): void {
    this.set(this.value - value);
  }

  getValue(): number {
    return this.value;
  }

  reset(): void {
    this.value = 0;
    this.values = [];
  }
}

/**
 * Histogram metric (distribution of values)
 */
export class Histogram extends Metric {
  private observations: number[] = [];
  private buckets: number[];
  private sum = 0;
  private count = 0;

  constructor(
    name: string,
    buckets: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    description?: string,
    unit?: string
  ) {
    super(name, MetricType.HISTOGRAM, description, unit);
    this.buckets = [...buckets].sort((a, b) => a - b);
  }

  /**
   * Observe a value
   */
  observe(value: number, labels?: Record<string, string>): void {
    this.observations.push(value);
    this.sum += value;
    this.count++;

    this.values.push({
      value,
      timestamp: Date.now(),
      labels: new Map(Object.entries(labels || {})),
    });

    logger.trace('Histogram observation', {
      operation: 'observe',
      metric: this.metadata.name,
      value,
      count: this.count,
    });
  }

  getValue(): HistogramSnapshot {
    const sorted = [...this.observations].sort((a, b) => a - b);

    // Calculate bucket counts
    const bucketCounts = this.buckets.map((le) => ({
      le,
      count: sorted.filter((v) => v <= le).length,
    }));

    // Calculate quantiles
    const quantiles = new Map<number, number>();
    const percentiles = [0.5, 0.9, 0.95, 0.99];

    for (const p of percentiles) {
      const index = Math.ceil(sorted.length * p) - 1;
      quantiles.set(p, sorted[index] || 0);
    }

    return {
      count: this.count,
      sum: this.sum,
      buckets: bucketCounts,
      quantiles,
    };
  }

  reset(): void {
    this.observations = [];
    this.sum = 0;
    this.count = 0;
    this.values = [];
  }
}

/**
 * Timer metric (specialized histogram for timing)
 */
export class Timer extends Metric {
  private histogram: Histogram;
  private activeTimers = new Map<string, number>();

  constructor(name: string, description?: string) {
    super(name, MetricType.TIMER, description, 'milliseconds');
    this.histogram = new Histogram(
      name,
      [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]
    );
  }

  /**
   * Start timing
   */
  start(label: string = 'default'): void {
    this.activeTimers.set(label, performance.now());
  }

  /**
   * End timing and record duration
   */
  end(label: string = 'default', labels?: Record<string, string>): number {
    const startTime = this.activeTimers.get(label);
    if (!startTime) {
      logger.warn('Timer not started', {
        operation: 'end',
        metric: this.metadata.name,
        label,
      });
      return 0;
    }

    const duration = performance.now() - startTime;
    this.activeTimers.delete(label);
    this.histogram.observe(duration, labels);

    return duration;
  }

  /**
   * Time a function execution
   */
  async time<T>(
    fn: () => T | Promise<T>,
    labels?: Record<string, string>
  ): Promise<T> {
    const label = Math.random().toString(36);
    this.start(label);

    try {
      const result = await fn();
      return result;
    } finally {
      this.end(label, labels);
    }
  }

  getValue(): HistogramSnapshot {
    return this.histogram.getValue();
  }

  reset(): void {
    this.histogram.reset();
    this.activeTimers.clear();
    this.values = [];
  }
}

/**
 * Metrics registry
 */
export class MetricsRegistry {
  private metrics = new Map<string, Metric>();

  /**
   * Register a metric
   */
  register(metric: Metric): void {
    const name = metric.getName();
    if (this.metrics.has(name)) {
      logger.warn('Metric already registered', { metric: name });
      return;
    }

    this.metrics.set(name, metric);
    logger.debug('Metric registered', { metric: name, type: metric.getType() });
  }

  /**
   * Get or create counter
   */
  counter(name: string, description?: string): Counter {
    let metric = this.metrics.get(name);
    if (!metric) {
      metric = new Counter(name, description);
      this.register(metric);
    }
    return metric as Counter;
  }

  /**
   * Get or create gauge
   */
  gauge(name: string, description?: string, unit?: string): Gauge {
    let metric = this.metrics.get(name);
    if (!metric) {
      metric = new Gauge(name, description, unit);
      this.register(metric);
    }
    return metric as Gauge;
  }

  /**
   * Get or create histogram
   */
  histogram(
    name: string,
    buckets?: number[],
    description?: string,
    unit?: string
  ): Histogram {
    let metric = this.metrics.get(name);
    if (!metric) {
      metric = new Histogram(name, buckets, description, unit);
      this.register(metric);
    }
    return metric as Histogram;
  }

  /**
   * Get or create timer
   */
  timer(name: string, description?: string): Timer {
    let metric = this.metrics.get(name);
    if (!metric) {
      metric = new Timer(name, description);
      this.register(metric);
    }
    return metric as Timer;
  }

  /**
   * Get metric by name
   */
  get(name: string): Metric | undefined {
    return this.metrics.get(name);
  }

  /**
   * Get all metrics
   */
  getAll(): Metric[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Remove metric
   */
  unregister(name: string): void {
    this.metrics.delete(name);
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    for (const metric of this.metrics.values()) {
      metric.reset();
    }
  }

  /**
   * Export metrics as JSON
   */
  export(): string {
    const data: Record<string, unknown> = {};

    for (const [name, metric] of this.metrics.entries()) {
      data[name] = {
        type: metric.getType(),
        metadata: metric.getMetadata(),
        value: metric.getValue(),
      };
    }

    return JSON.stringify(data, null, 2);
  }

  /**
   * Get summary statistics
   */
  getSummary(): MetricsSummary {
    const summary: MetricsSummary = {
      totalMetrics: this.metrics.size,
      byType: {
        counter: 0,
        gauge: 0,
        histogram: 0,
        timer: 0,
      },
      metrics: [],
    };

    for (const metric of this.metrics.values()) {
      const type = metric.getType();
      summary.byType[type]++;

      summary.metrics.push({
        name: metric.getName(),
        type,
        value: metric.getValue(),
      });
    }

    return summary;
  }
}

export interface MetricsSummary {
  totalMetrics: number;
  byType: Record<MetricType, number>;
  metrics: Array<{
    name: string;
    type: MetricType;
    value: number | HistogramSnapshot;
  }>;
}

/**
 * Global metrics registry
 */
let globalRegistry: MetricsRegistry | null = null;

/**
 * Get global metrics registry
 */
export function getMetrics(): MetricsRegistry {
  if (!globalRegistry) {
    globalRegistry = new MetricsRegistry();
  }
  return globalRegistry;
}

/**
 * Set global metrics registry
 */
export function setMetrics(registry: MetricsRegistry): void {
  globalRegistry = registry;
}
