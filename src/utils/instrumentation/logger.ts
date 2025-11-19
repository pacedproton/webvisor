/**
 * Comprehensive logging system for WebVisor
 * Provides structured logging with levels, contexts, and formatting
 */

export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5,
}

export interface LogContext {
  component: string;
  operation?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  context: LogContext;
  error?: Error;
  data?: unknown;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableBuffer: boolean;
  bufferSize: number;
  formatters: LogFormatter[];
  transports: LogTransport[];
}

export interface LogFormatter {
  format(entry: LogEntry): string;
}

export interface LogTransport {
  log(entry: LogEntry): void;
}

/**
 * Structured logger with context support
 */
export class Logger {
  private config: LoggerConfig;
  private buffer: LogEntry[] = [];
  private contexts: Map<string, LogContext> = new Map();

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      enableConsole: true,
      enableBuffer: true,
      bufferSize: 10000,
      formatters: [new DefaultFormatter()],
      transports: [new ConsoleTransport()],
      ...config,
    };
  }

  /**
   * Create child logger with additional context
   */
  child(context: Partial<LogContext>): Logger {
    const childLogger = new Logger(this.config);
    childLogger.contexts = new Map(this.contexts);
    const currentContext = this.getCurrentContext();
    childLogger.setContext({ ...currentContext, ...context });
    return childLogger;
  }

  /**
   * Set logging context
   */
  setContext(context: LogContext): void {
    this.contexts.set('default', context);
  }

  /**
   * Add context that merges with existing
   */
  addContext(context: Partial<LogContext>): void {
    const current = this.getCurrentContext();
    this.contexts.set('default', { ...current, ...context });
  }

  /**
   * Get current context
   */
  getCurrentContext(): LogContext {
    return this.contexts.get('default') || { component: 'unknown' };
  }

  /**
   * Log at TRACE level
   */
  trace(message: string, data?: unknown): void {
    this.log(LogLevel.TRACE, message, data);
  }

  /**
   * Log at DEBUG level
   */
  debug(message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Log at INFO level
   */
  info(message: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Log at WARN level
   */
  warn(message: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Log at ERROR level
   */
  error(message: string, error?: Error | unknown, data?: unknown): void {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level: LogLevel.ERROR,
      message,
      context: this.getCurrentContext(),
      error: error instanceof Error ? error : undefined,
      data: error instanceof Error ? data : error,
    };
    this.processLog(entry);
  }

  /**
   * Log at FATAL level
   */
  fatal(message: string, error?: Error | unknown, data?: unknown): void {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level: LogLevel.FATAL,
      message,
      context: this.getCurrentContext(),
      error: error instanceof Error ? error : undefined,
      data: error instanceof Error ? data : error,
    };
    this.processLog(entry);
  }

  /**
   * Core log method
   */
  private log(level: LogLevel, message: string, data?: unknown): void {
    if (level < this.config.level) {
      return;
    }

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      context: this.getCurrentContext(),
      data,
    };

    this.processLog(entry);
  }

  /**
   * Process log entry
   */
  private processLog(entry: LogEntry): void {
    // Add to buffer
    if (this.config.enableBuffer) {
      this.buffer.push(entry);
      if (this.buffer.length > this.config.bufferSize) {
        this.buffer.shift();
      }
    }

    // Send to transports
    for (const transport of this.config.transports) {
      try {
        transport.log(entry);
      } catch (err) {
        // Avoid infinite loop if transport logging fails
        console.error('Transport error:', err);
      }
    }
  }

  /**
   * Get log buffer
   */
  getBuffer(): LogEntry[] {
    return [...this.buffer];
  }

  /**
   * Clear log buffer
   */
  clearBuffer(): void {
    this.buffer = [];
  }

  /**
   * Export logs as JSON
   */
  export(): string {
    return JSON.stringify(this.buffer, null, 2);
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * Get log level
   */
  getLevel(): LogLevel {
    return this.config.level;
  }
}

/**
 * Default log formatter
 */
export class DefaultFormatter implements LogFormatter {
  format(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const level = LogLevel[entry.level].padEnd(5);
    const component = entry.context.component.padEnd(20);
    const operation = entry.context.operation
      ? `[${entry.context.operation}]`
      : '';

    let msg = `${timestamp} ${level} ${component} ${operation} ${entry.message}`;

    if (entry.data) {
      msg += `\n  Data: ${JSON.stringify(entry.data)}`;
    }

    if (entry.error) {
      msg += `\n  Error: ${entry.error.message}`;
      if (entry.error.stack) {
        msg += `\n  Stack: ${entry.error.stack}`;
      }
    }

    return msg;
  }
}

/**
 * JSON formatter
 */
export class JSONFormatter implements LogFormatter {
  format(entry: LogEntry): string {
    return JSON.stringify({
      timestamp: entry.timestamp,
      level: LogLevel[entry.level],
      message: entry.message,
      context: entry.context,
      data: entry.data,
      error: entry.error
        ? {
            message: entry.error.message,
            stack: entry.error.stack,
          }
        : undefined,
    });
  }
}

/**
 * Console transport
 */
export class ConsoleTransport implements LogTransport {
  private formatter = new DefaultFormatter();

  log(entry: LogEntry): void {
    const formatted = this.formatter.format(entry);

    switch (entry.level) {
      case LogLevel.TRACE:
      case LogLevel.DEBUG:
        console.debug(formatted);
        break;
      case LogLevel.INFO:
        console.info(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(formatted);
        break;
    }
  }
}

/**
 * Buffer transport (stores in memory)
 */
export class BufferTransport implements LogTransport {
  private buffer: LogEntry[] = [];
  private maxSize: number;

  constructor(maxSize: number = 10000) {
    this.maxSize = maxSize;
  }

  log(entry: LogEntry): void {
    this.buffer.push(entry);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  getBuffer(): LogEntry[] {
    return [...this.buffer];
  }

  clear(): void {
    this.buffer = [];
  }
}

/**
 * Create default logger instance
 */
export function createLogger(
  component: string,
  config?: Partial<LoggerConfig>
): Logger {
  const logger = new Logger(config);
  logger.setContext({ component });
  return logger;
}

/**
 * Global logger registry
 */
class LoggerRegistry {
  private loggers = new Map<string, Logger>();
  private defaultConfig: Partial<LoggerConfig> = {
    level: LogLevel.INFO,
  };

  setDefaultConfig(config: Partial<LoggerConfig>): void {
    this.defaultConfig = config;
  }

  getLogger(component: string): Logger {
    if (!this.loggers.has(component)) {
      const logger = createLogger(component, this.defaultConfig);
      this.loggers.set(component, logger);
    }
    return this.loggers.get(component)!;
  }

  getAllLoggers(): Logger[] {
    return Array.from(this.loggers.values());
  }

  setGlobalLevel(level: LogLevel): void {
    for (const logger of this.loggers.values()) {
      logger.setLevel(level);
    }
  }
}

export const loggerRegistry = new LoggerRegistry();

/**
 * Get logger for component
 */
export function getLogger(component: string): Logger {
  return loggerRegistry.getLogger(component);
}
