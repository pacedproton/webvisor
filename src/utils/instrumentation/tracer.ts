/**
 * Distributed tracing system for WebVisor
 * Tracks execution flow, timing, and causality
 */

import { getLogger } from './logger.js';

const logger = getLogger('tracer');

export interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

export interface Span {
  context: SpanContext;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  attributes: Map<string, unknown>;
  events: SpanEvent[];
  status: SpanStatus;
  error?: Error;
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, unknown>;
}

export enum SpanStatus {
  UNSET = 'unset',
  OK = 'ok',
  ERROR = 'error',
}

export interface TracerConfig {
  enabled: boolean;
  sampleRate: number;
  maxSpans: number;
  exportInterval: number;
}

/**
 * Active span that can be modified
 */
export class ActiveSpan {
  private span: Span;
  private tracer: Tracer;

  constructor(span: Span, tracer: Tracer) {
    this.span = span;
    this.tracer = tracer;
  }

  /**
   * Set attribute on span
   */
  setAttribute(key: string, value: unknown): this {
    this.span.attributes.set(key, value);
    return this;
  }

  /**
   * Set multiple attributes
   */
  setAttributes(attributes: Record<string, unknown>): this {
    for (const [key, value] of Object.entries(attributes)) {
      this.span.attributes.set(key, value);
    }
    return this;
  }

  /**
   * Add event to span
   */
  addEvent(name: string, attributes?: Record<string, unknown>): this {
    this.span.events.push({
      name,
      timestamp: performance.now(),
      attributes,
    });
    return this;
  }

  /**
   * Set span status
   */
  setStatus(status: SpanStatus, error?: Error): this {
    this.span.status = status;
    if (error) {
      this.span.error = error;
    }
    return this;
  }

  /**
   * End the span
   */
  end(): void {
    if (this.span.endTime) {
      logger.warn('Span already ended', { spanId: this.span.context.spanId });
      return;
    }

    this.span.endTime = performance.now();
    this.span.duration = this.span.endTime - this.span.startTime;

    this.tracer.endSpan(this.span);
  }

  /**
   * Get span context
   */
  getContext(): SpanContext {
    return this.span.context;
  }

  /**
   * Get span data
   */
  getSpan(): Span {
    return { ...this.span };
  }
}

/**
 * Tracer for creating and managing spans
 */
export class Tracer {
  private config: TracerConfig;
  private spans: Map<string, Span> = new Map();
  private activeSpans: Map<string, Span> = new Map();
  private completedSpans: Span[] = [];
  private currentContext: SpanContext | null = null;

  constructor(config: Partial<TracerConfig> = {}) {
    this.config = {
      enabled: true,
      sampleRate: 1.0,
      maxSpans: 100000,
      exportInterval: 60000,
      ...config,
    };
  }

  /**
   * Start a new span
   */
  startSpan(name: string, attributes?: Record<string, unknown>): ActiveSpan {
    if (!this.config.enabled || Math.random() > this.config.sampleRate) {
      // Return no-op span
      return this.createNoOpSpan(name);
    }

    const parentSpanId = this.currentContext?.spanId;
    const traceId = this.currentContext?.traceId || this.generateTraceId();

    const context: SpanContext = {
      traceId,
      spanId: this.generateSpanId(),
      parentSpanId,
    };

    const span: Span = {
      context,
      name,
      startTime: performance.now(),
      attributes: new Map(Object.entries(attributes || {})),
      events: [],
      status: SpanStatus.UNSET,
    };

    this.spans.set(context.spanId, span);
    this.activeSpans.set(context.spanId, span);

    logger.trace('Span started', {
      operation: 'startSpan',
      spanId: context.spanId,
      traceId: context.traceId,
      name,
    });

    return new ActiveSpan(span, this);
  }

  /**
   * Create a no-op span (when tracing disabled/sampled out)
   */
  private createNoOpSpan(name: string): ActiveSpan {
    const context: SpanContext = {
      traceId: 'noop',
      spanId: 'noop',
    };

    const span: Span = {
      context,
      name,
      startTime: 0,
      attributes: new Map(),
      events: [],
      status: SpanStatus.UNSET,
    };

    return new ActiveSpan(span, {
      endSpan: () => {},
    } as Tracer);
  }

  /**
   * End a span (called by ActiveSpan)
   */
  endSpan(span: Span): void {
    this.activeSpans.delete(span.context.spanId);
    this.completedSpans.push(span);

    if (this.completedSpans.length > this.config.maxSpans) {
      this.completedSpans.shift();
    }

    logger.trace('Span ended', {
      operation: 'endSpan',
      spanId: span.context.spanId,
      duration: span.duration,
    });
  }

  /**
   * Start span and run function within context
   */
  async trace<T>(
    name: string,
    fn: (span: ActiveSpan) => T | Promise<T>,
    attributes?: Record<string, unknown>
  ): Promise<T> {
    const span = this.startSpan(name, attributes);
    const previousContext = this.currentContext;
    this.currentContext = span.getContext();

    try {
      const result = await fn(span);
      span.setStatus(SpanStatus.OK);
      return result;
    } catch (error) {
      span.setStatus(SpanStatus.ERROR, error as Error);
      throw error;
    } finally {
      span.end();
      this.currentContext = previousContext;
    }
  }

  /**
   * Get all completed spans
   */
  getCompletedSpans(): Span[] {
    return [...this.completedSpans];
  }

  /**
   * Get active spans
   */
  getActiveSpans(): Span[] {
    return Array.from(this.activeSpans.values());
  }

  /**
   * Get span by ID
   */
  getSpan(spanId: string): Span | undefined {
    return this.spans.get(spanId);
  }

  /**
   * Get current trace context
   */
  getCurrentContext(): SpanContext | null {
    return this.currentContext;
  }

  /**
   * Set trace context (for distributed tracing)
   */
  setContext(context: SpanContext | null): void {
    this.currentContext = context;
  }

  /**
   * Clear all spans
   */
  clear(): void {
    this.spans.clear();
    this.activeSpans.clear();
    this.completedSpans = [];
  }

  /**
   * Export spans as JSON
   */
  export(): string {
    const data = {
      spans: this.completedSpans.map((span) => ({
        context: span.context,
        name: span.name,
        startTime: span.startTime,
        endTime: span.endTime,
        duration: span.duration,
        attributes: Object.fromEntries(span.attributes),
        events: span.events,
        status: span.status,
        error: span.error
          ? {
              message: span.error.message,
              stack: span.error.stack,
            }
          : undefined,
      })),
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Generate trace ID
   */
  private generateTraceId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Generate span ID
   */
  private generateSpanId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  /**
   * Get statistics
   */
  getStats(): TracerStats {
    const durations = this.completedSpans
      .filter((s) => s.duration !== undefined)
      .map((s) => s.duration!);

    return {
      totalSpans: this.spans.size,
      activeSpans: this.activeSpans.size,
      completedSpans: this.completedSpans.length,
      averageDuration:
        durations.length > 0
          ? durations.reduce((a, b) => a + b, 0) / durations.length
          : 0,
      minDuration: durations.length > 0 ? Math.min(...durations) : 0,
      maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
    };
  }
}

export interface TracerStats {
  totalSpans: number;
  activeSpans: number;
  completedSpans: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
}

/**
 * Global tracer instance
 */
let globalTracer: Tracer | null = null;

/**
 * Get global tracer
 */
export function getTracer(): Tracer {
  if (!globalTracer) {
    globalTracer = new Tracer();
  }
  return globalTracer;
}

/**
 * Set global tracer
 */
export function setTracer(tracer: Tracer): void {
  globalTracer = tracer;
}

/**
 * Convenience function for tracing
 */
export async function trace<T>(
  name: string,
  fn: (span: ActiveSpan) => T | Promise<T>,
  attributes?: Record<string, unknown>
): Promise<T> {
  return getTracer().trace(name, fn, attributes);
}
