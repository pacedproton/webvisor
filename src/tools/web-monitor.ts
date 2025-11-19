/**
 * Web Monitor for WebVisor
 * Provides real-time monitoring and control interface for the hypervisor
 */

import { getLogger } from '../utils/instrumentation/logger.js';
import { getMetrics } from '../utils/instrumentation/metrics.js';
import type { VirtualClock } from '../core/virtual-platform/types.js';
import type { VirtualDOM } from '../core/virtual-platform/types.js';
import type { VirtualRNG } from '../core/virtual-platform/types.js';
import type { VirtualNetwork } from '../core/virtual-platform/types.js';
import type { VirtualStorage } from '../core/virtual-platform/types.js';
import type { ExecutionRuntime } from '../core/runtime/types.js';
import type { StateManager } from '../core/state/types.js';

const logger = getLogger('web-monitor');

/**
 * Monitor configuration
 */
export interface WebMonitorConfig {
  /**
   * Update interval in milliseconds
   */
  updateInterval?: number;

  /**
   * Port for HTTP server (if applicable)
   */
  port?: number;

  /**
   * Enable auto-refresh
   */
  autoRefresh?: boolean;

  /**
   * Maximum log entries to keep
   */
  maxLogEntries?: number;
}

/**
 * Monitor state snapshot
 */
export interface MonitorSnapshot {
  timestamp: number;
  uptime: number;

  // Clock state
  clock: {
    currentTime: number;
    frozen: boolean;
    scheduledCount: number;
    tickCount: number;
  };

  // RNG state
  rng: {
    seed: number;
    algorithm: string;
    callCount: number;
  };

  // DOM state
  dom: {
    elementCount: number;
    eventListenerCount: number;
    depth: number;
  };

  // Network state
  network: {
    requestCount: number;
    mockCount: number;
    pendingRequests: number;
    cacheSize: number;
  };

  // Storage state
  storage: {
    localStorageSize: number;
    sessionStorageSize: number;
    localStorageKeys: number;
    sessionStorageKeys: number;
  };

  // Graphics state
  graphics: {
    canvasCount: number;
    totalDrawCalls: number;
    totalCommands: number;
  };

  // Runtime state
  runtime: {
    eventCount: number;
    queuedEvents: number;
    executedEvents: number;
  };

  // State snapshots
  stateManager: {
    snapshotCount: number;
    currentIndex: number;
  };

  // Metrics
  metrics: {
    counters: Record<string, number>;
    gauges: Record<string, number>;
  };

  // Logs
  logs: LogEntry[];
}

/**
 * Log entry
 */
export interface LogEntry {
  timestamp: number;
  level: string;
  module: string;
  message: string;
  data?: any;
}

/**
 * Control command
 */
export interface ControlCommand {
  action: 'pause' | 'resume' | 'step' | 'reset' | 'advance' | 'snapshot' | 'restore';
  params?: any;
}

/**
 * Web monitor for WebVisor
 */
export class WebMonitor {
  private config: Required<WebMonitorConfig>;
  private startTime: number;
  private updateTimer?: ReturnType<typeof setInterval>;
  private logBuffer: LogEntry[] = [];
  private subscribers = new Set<(snapshot: MonitorSnapshot) => void>();

  // Component references
  private clock?: VirtualClock;
  private rng?: VirtualRNG;
  private dom?: VirtualDOM;
  private network?: VirtualNetwork;
  private storage?: VirtualStorage;
  private runtime?: ExecutionRuntime;
  private stateManager?: StateManager;
  private graphicsHandler?: any;

  constructor(config: WebMonitorConfig = {}) {
    this.config = {
      updateInterval: config.updateInterval ?? 1000,
      port: config.port ?? 3000,
      autoRefresh: config.autoRefresh ?? true,
      maxLogEntries: config.maxLogEntries ?? 1000,
    };

    this.startTime = Date.now();

    logger.info('Web monitor created', {
      config: this.config,
    });
  }

  /**
   * Register components to monitor
   */
  registerComponents(components: {
    clock?: VirtualClock;
    rng?: VirtualRNG;
    dom?: VirtualDOM;
    network?: VirtualNetwork;
    storage?: VirtualStorage;
    runtime?: ExecutionRuntime;
    stateManager?: StateManager;
    graphicsHandler?: any;
  }): void {
    this.clock = components.clock;
    this.rng = components.rng;
    this.dom = components.dom;
    this.network = components.network;
    this.storage = components.storage;
    this.runtime = components.runtime;
    this.stateManager = components.stateManager;
    this.graphicsHandler = components.graphicsHandler;

    logger.info('Components registered', {
      components: Object.keys(components),
    });
  }

  /**
   * Start monitoring
   */
  start(): void {
    if (this.config.autoRefresh) {
      this.updateTimer = setInterval(() => {
        this.update();
      }, this.config.updateInterval);

      logger.info('Monitor started', {
        interval: this.config.updateInterval,
      });
    }
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = undefined;

      logger.info('Monitor stopped');
    }
  }

  /**
   * Update and notify subscribers
   */
  update(): void {
    const snapshot = this.getSnapshot();

    for (const subscriber of this.subscribers) {
      try {
        subscriber(snapshot);
      } catch (error) {
        logger.error('Error in subscriber', { error });
      }
    }
  }

  /**
   * Subscribe to updates
   */
  subscribe(callback: (snapshot: MonitorSnapshot) => void): () => void {
    this.subscribers.add(callback);

    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Get current state snapshot
   */
  getSnapshot(): MonitorSnapshot {
    const now = Date.now();
    const metrics = getMetrics();

    return {
      timestamp: now,
      uptime: now - this.startTime,

      clock: this.getClockState(),
      rng: this.getRNGState(),
      dom: this.getDOMState(),
      network: this.getNetworkState(),
      storage: this.getStorageState(),
      graphics: this.getGraphicsState(),
      runtime: this.getRuntimeState(),
      stateManager: this.getStateManagerState(),

      metrics: {
        counters: this.getCounters(),
        gauges: this.getGauges(),
      },

      logs: this.getRecentLogs(),
    };
  }

  /**
   * Execute control command
   */
  async executeCommand(command: ControlCommand): Promise<void> {
    logger.info('Executing command', { command });

    switch (command.action) {
      case 'pause':
        // Freeze clock
        if (this.clock && typeof (this.clock as any).freeze === 'function') {
          (this.clock as any).freeze();
        }
        break;

      case 'resume':
        // Unfreeze clock
        if (this.clock && typeof (this.clock as any).unfreeze === 'function') {
          (this.clock as any).unfreeze();
        }
        break;

      case 'step':
        // Advance by one tick
        if (this.clock) {
          this.clock.advance(command.params?.ms ?? 16);
        }
        break;

      case 'reset':
        // Reset all components
        this.logBuffer = [];
        if (this.stateManager && typeof (this.stateManager as any).clear === 'function') {
          (this.stateManager as any).clear();
        }
        break;

      case 'advance':
        // Advance clock
        if (this.clock && command.params?.ms) {
          this.clock.advance(command.params.ms);
        }
        break;

      case 'snapshot':
        // Create state snapshot
        if (this.stateManager) {
          await this.stateManager.createSnapshot();
        }
        break;

      case 'restore':
        // Restore to snapshot
        if (this.stateManager && command.params?.id) {
          await this.stateManager.restoreSnapshot(command.params.id);
        }
        break;

      default:
        logger.warn('Unknown command', { command });
    }

    // Trigger update
    this.update();
  }

  /**
   * Add log entry
   */
  addLog(entry: LogEntry): void {
    this.logBuffer.push(entry);

    // Trim buffer
    if (this.logBuffer.length > this.config.maxLogEntries) {
      this.logBuffer = this.logBuffer.slice(-this.config.maxLogEntries);
    }
  }

  /**
   * Get HTML monitor page
   */
  getMonitorHTML(): string {
    return generateMonitorHTML();
  }

  /**
   * Get state as JSON
   */
  getStateJSON(): string {
    return JSON.stringify(this.getSnapshot(), null, 2);
  }

  // Private helper methods

  private getClockState(): MonitorSnapshot['clock'] {
    if (!this.clock) {
      return {
        currentTime: 0,
        frozen: false,
        scheduledCount: 0,
        tickCount: 0,
      };
    }

    const state = this.clock.getState();
    return {
      currentTime: state.currentTime.value,
      frozen: false, // Would need to track this
      scheduledCount: state.scheduled.length,
      tickCount: state.tickCount,
    };
  }

  private getRNGState(): MonitorSnapshot['rng'] {
    if (!this.rng) {
      return {
        seed: 0,
        algorithm: 'none',
        callCount: 0,
      };
    }

    const state = this.rng.getState();
    return {
      seed: state.seed,
      algorithm: state.algorithm,
      callCount: state.callCount,
    };
  }

  private getDOMState(): MonitorSnapshot['dom'] {
    if (!this.dom) {
      return {
        elementCount: 0,
        eventListenerCount: 0,
        depth: 0,
      };
    }

    const state = this.dom.getState();
    return {
      elementCount: state.elementCount,
      eventListenerCount: state.eventListenerCount,
      depth: this.calculateDOMDepth(state.root),
    };
  }

  private calculateDOMDepth(node: any, depth: number = 0): number {
    if (!node || !node.children || node.children.length === 0) {
      return depth;
    }

    let maxDepth = depth;
    for (const child of node.children) {
      const childDepth = this.calculateDOMDepth(child, depth + 1);
      maxDepth = Math.max(maxDepth, childDepth);
    }

    return maxDepth;
  }

  private getNetworkState(): MonitorSnapshot['network'] {
    if (!this.network) {
      return {
        requestCount: 0,
        mockCount: 0,
        pendingRequests: 0,
        cacheSize: 0,
      };
    }

    const state = this.network.getState();
    return {
      requestCount: state.requests?.length ?? 0,
      mockCount: state.mocks?.length ?? 0,
      pendingRequests: state.requests?.filter((r: any) => r.status === 'pending').length ?? 0,
      cacheSize: state.cache?.size ?? 0,
    };
  }

  private getStorageState(): MonitorSnapshot['storage'] {
    if (!this.storage) {
      return {
        localStorageSize: 0,
        sessionStorageSize: 0,
        localStorageKeys: 0,
        sessionStorageKeys: 0,
      };
    }

    const state = this.storage.getState();
    return {
      localStorageSize: state.localStorage.size,
      sessionStorageSize: state.sessionStorage.size,
      localStorageKeys: state.localStorage.keys,
      sessionStorageKeys: state.sessionStorage.keys,
    };
  }

  private getGraphicsState(): MonitorSnapshot['graphics'] {
    if (!this.graphicsHandler || typeof this.graphicsHandler.getState !== 'function') {
      return {
        canvasCount: 0,
        totalDrawCalls: 0,
        totalCommands: 0,
      };
    }

    const state = this.graphicsHandler.getState();
    return {
      canvasCount: state.canvases.size,
      totalDrawCalls: state.totalDrawCalls,
      totalCommands: state.totalCommands,
    };
  }

  private getRuntimeState(): MonitorSnapshot['runtime'] {
    if (!this.runtime) {
      return {
        eventCount: 0,
        queuedEvents: 0,
        executedEvents: 0,
      };
    }

    const state = this.runtime.getState();
    return {
      eventCount: state.events?.length ?? 0,
      queuedEvents: state.queuedEvents ?? 0,
      executedEvents: state.executedEvents ?? 0,
    };
  }

  private getStateManagerState(): MonitorSnapshot['stateManager'] {
    if (!this.stateManager) {
      return {
        snapshotCount: 0,
        currentIndex: 0,
      };
    }

    const state = this.stateManager.getState();
    return {
      snapshotCount: state.snapshots.length,
      currentIndex: state.currentIndex,
    };
  }

  private getCounters(): Record<string, number> {
    const metrics = getMetrics();
    const counters: Record<string, number> = {};

    for (const [name, counter] of (metrics as any).counters?.entries() ?? []) {
      counters[name] = counter.value;
    }

    return counters;
  }

  private getGauges(): Record<string, number> {
    const metrics = getMetrics();
    const gauges: Record<string, number> = {};

    for (const [name, gauge] of (metrics as any).gauges?.entries() ?? []) {
      gauges[name] = gauge.value;
    }

    return gauges;
  }

  private getRecentLogs(): LogEntry[] {
    return this.logBuffer.slice(-100);
  }
}

/**
 * Generate HTML monitor page
 */
function generateMonitorHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WebVisor Monitor</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      padding: 24px;
      border-radius: 12px;
      margin-bottom: 24px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    }
    .header h1 {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .header p {
      opacity: 0.9;
      font-size: 14px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 24px;
    }
    .card {
      background: #1e293b;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      border: 1px solid #334155;
    }
    .card h2 {
      font-size: 18px;
      margin-bottom: 16px;
      color: #3b82f6;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .stat {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #334155;
    }
    .stat:last-child {
      border-bottom: none;
    }
    .stat-label {
      color: #94a3b8;
      font-size: 14px;
    }
    .stat-value {
      font-weight: 600;
      font-size: 16px;
      color: #e2e8f0;
    }
    .controls {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }
    .btn {
      background: #3b82f6;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
    }
    .btn:hover {
      background: #2563eb;
      transform: translateY(-1px);
    }
    .btn:active {
      transform: translateY(0);
    }
    .btn-secondary {
      background: #64748b;
    }
    .btn-secondary:hover {
      background: #475569;
    }
    .btn-success {
      background: #10b981;
    }
    .btn-success:hover {
      background: #059669;
    }
    .btn-warning {
      background: #f59e0b;
    }
    .btn-warning:hover {
      background: #d97706;
    }
    .logs {
      background: #1e293b;
      border-radius: 8px;
      padding: 20px;
      border: 1px solid #334155;
      max-height: 400px;
      overflow-y: auto;
    }
    .logs h2 {
      margin-bottom: 16px;
      color: #3b82f6;
    }
    .log-entry {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      padding: 6px 0;
      border-bottom: 1px solid #334155;
    }
    .log-entry:last-child {
      border-bottom: none;
    }
    .log-time {
      color: #64748b;
      margin-right: 8px;
    }
    .log-level {
      margin-right: 8px;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: 600;
    }
    .log-level.info { background: #3b82f6; }
    .log-level.warn { background: #f59e0b; }
    .log-level.error { background: #ef4444; }
    .log-level.debug { background: #64748b; }
    .status-indicator {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 8px;
    }
    .status-active { background: #10b981; }
    .status-paused { background: #f59e0b; }
    .status-error { background: #ef4444; }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
      margin-top: 12px;
    }
    .metric-item {
      background: #0f172a;
      padding: 12px;
      border-radius: 6px;
      border: 1px solid #334155;
    }
    .metric-name {
      font-size: 12px;
      color: #94a3b8;
      margin-bottom: 4px;
    }
    .metric-value {
      font-size: 20px;
      font-weight: 700;
      color: #3b82f6;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .updating {
      animation: pulse 1s ease-in-out infinite;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🚀 WebVisor Monitor</h1>
    <p>Real-time hypervisor runtime monitoring</p>
  </div>

  <div class="controls">
    <button class="btn btn-success" onclick="sendCommand('resume')">▶️ Resume</button>
    <button class="btn btn-warning" onclick="sendCommand('pause')">⏸️ Pause</button>
    <button class="btn" onclick="sendCommand('step')">⏭️ Step</button>
    <button class="btn btn-secondary" onclick="sendCommand('snapshot')">📸 Snapshot</button>
    <button class="btn btn-secondary" onclick="sendCommand('reset')">🔄 Reset</button>
    <button class="btn" onclick="window.location.reload()">🔃 Refresh</button>
  </div>

  <div class="grid">
    <div class="card">
      <h2><span class="status-indicator status-active"></span>System</h2>
      <div class="stat">
        <span class="stat-label">Uptime</span>
        <span class="stat-value" id="uptime">0ms</span>
      </div>
      <div class="stat">
        <span class="stat-label">Timestamp</span>
        <span class="stat-value" id="timestamp">0</span>
      </div>
    </div>

    <div class="card">
      <h2>⏰ Virtual Clock</h2>
      <div class="stat">
        <span class="stat-label">Current Time</span>
        <span class="stat-value" id="clock-time">0</span>
      </div>
      <div class="stat">
        <span class="stat-label">Scheduled</span>
        <span class="stat-value" id="clock-scheduled">0</span>
      </div>
      <div class="stat">
        <span class="stat-label">Ticks</span>
        <span class="stat-value" id="clock-ticks">0</span>
      </div>
    </div>

    <div class="card">
      <h2>🎲 Random Number Generator</h2>
      <div class="stat">
        <span class="stat-label">Seed</span>
        <span class="stat-value" id="rng-seed">0</span>
      </div>
      <div class="stat">
        <span class="stat-label">Algorithm</span>
        <span class="stat-value" id="rng-algo">none</span>
      </div>
      <div class="stat">
        <span class="stat-label">Calls</span>
        <span class="stat-value" id="rng-calls">0</span>
      </div>
    </div>

    <div class="card">
      <h2>🌳 Virtual DOM</h2>
      <div class="stat">
        <span class="stat-label">Elements</span>
        <span class="stat-value" id="dom-elements">0</span>
      </div>
      <div class="stat">
        <span class="stat-label">Event Listeners</span>
        <span class="stat-value" id="dom-listeners">0</span>
      </div>
      <div class="stat">
        <span class="stat-label">Depth</span>
        <span class="stat-value" id="dom-depth">0</span>
      </div>
    </div>

    <div class="card">
      <h2>🌐 Network</h2>
      <div class="stat">
        <span class="stat-label">Total Requests</span>
        <span class="stat-value" id="net-requests">0</span>
      </div>
      <div class="stat">
        <span class="stat-label">Mocks</span>
        <span class="stat-value" id="net-mocks">0</span>
      </div>
      <div class="stat">
        <span class="stat-label">Pending</span>
        <span class="stat-value" id="net-pending">0</span>
      </div>
      <div class="stat">
        <span class="stat-label">Cache Size</span>
        <span class="stat-value" id="net-cache">0</span>
      </div>
    </div>

    <div class="card">
      <h2>💾 Storage</h2>
      <div class="stat">
        <span class="stat-label">localStorage</span>
        <span class="stat-value" id="storage-local">0 bytes</span>
      </div>
      <div class="stat">
        <span class="stat-label">sessionStorage</span>
        <span class="stat-value" id="storage-session">0 bytes</span>
      </div>
      <div class="stat">
        <span class="stat-label">Total Keys</span>
        <span class="stat-value" id="storage-keys">0</span>
      </div>
    </div>

    <div class="card">
      <h2>🎨 Graphics</h2>
      <div class="stat">
        <span class="stat-label">Canvases</span>
        <span class="stat-value" id="graphics-canvases">0</span>
      </div>
      <div class="stat">
        <span class="stat-label">Draw Calls</span>
        <span class="stat-value" id="graphics-draws">0</span>
      </div>
      <div class="stat">
        <span class="stat-label">Commands</span>
        <span class="stat-value" id="graphics-commands">0</span>
      </div>
    </div>

    <div class="card">
      <h2>⚙️ Runtime</h2>
      <div class="stat">
        <span class="stat-label">Events</span>
        <span class="stat-value" id="runtime-events">0</span>
      </div>
      <div class="stat">
        <span class="stat-label">Queued</span>
        <span class="stat-value" id="runtime-queued">0</span>
      </div>
      <div class="stat">
        <span class="stat-label">Executed</span>
        <span class="stat-value" id="runtime-executed">0</span>
      </div>
    </div>

    <div class="card">
      <h2>📸 State Manager</h2>
      <div class="stat">
        <span class="stat-label">Snapshots</span>
        <span class="stat-value" id="state-snapshots">0</span>
      </div>
      <div class="stat">
        <span class="stat-label">Current Index</span>
        <span class="stat-value" id="state-index">0</span>
      </div>
    </div>
  </div>

  <div class="logs">
    <h2>📝 Recent Logs</h2>
    <div id="logs-container">
      <div class="log-entry">
        <span class="log-time">00:00:00</span>
        <span class="log-level info">INFO</span>
        <span>Monitor initialized</span>
      </div>
    </div>
  </div>

  <script>
    let monitorData = null;

    // Update display
    function updateDisplay(data) {
      monitorData = data;

      // System
      document.getElementById('uptime').textContent = formatTime(data.uptime);
      document.getElementById('timestamp').textContent = new Date(data.timestamp).toLocaleTimeString();

      // Clock
      document.getElementById('clock-time').textContent = data.clock.currentTime + 'ms';
      document.getElementById('clock-scheduled').textContent = data.clock.scheduledCount;
      document.getElementById('clock-ticks').textContent = data.clock.tickCount;

      // RNG
      document.getElementById('rng-seed').textContent = data.rng.seed;
      document.getElementById('rng-algo').textContent = data.rng.algorithm;
      document.getElementById('rng-calls').textContent = data.rng.callCount;

      // DOM
      document.getElementById('dom-elements').textContent = data.dom.elementCount;
      document.getElementById('dom-listeners').textContent = data.dom.eventListenerCount;
      document.getElementById('dom-depth').textContent = data.dom.depth;

      // Network
      document.getElementById('net-requests').textContent = data.network.requestCount;
      document.getElementById('net-mocks').textContent = data.network.mockCount;
      document.getElementById('net-pending').textContent = data.network.pendingRequests;
      document.getElementById('net-cache').textContent = data.network.cacheSize;

      // Storage
      document.getElementById('storage-local').textContent = data.storage.localStorageSize + ' bytes';
      document.getElementById('storage-session').textContent = data.storage.sessionStorageSize + ' bytes';
      document.getElementById('storage-keys').textContent =
        data.storage.localStorageKeys + data.storage.sessionStorageKeys;

      // Graphics
      document.getElementById('graphics-canvases').textContent = data.graphics.canvasCount;
      document.getElementById('graphics-draws').textContent = data.graphics.totalDrawCalls;
      document.getElementById('graphics-commands').textContent = data.graphics.totalCommands;

      // Runtime
      document.getElementById('runtime-events').textContent = data.runtime.eventCount;
      document.getElementById('runtime-queued').textContent = data.runtime.queuedEvents;
      document.getElementById('runtime-executed').textContent = data.runtime.executedEvents;

      // State Manager
      document.getElementById('state-snapshots').textContent = data.stateManager.snapshotCount;
      document.getElementById('state-index').textContent = data.stateManager.currentIndex;

      // Logs
      updateLogs(data.logs);
    }

    function updateLogs(logs) {
      const container = document.getElementById('logs-container');
      container.innerHTML = logs.slice(-20).reverse().map(log => {
        const time = new Date(log.timestamp).toLocaleTimeString();
        return \`
          <div class="log-entry">
            <span class="log-time">\${time}</span>
            <span class="log-level \${log.level.toLowerCase()}">\${log.level}</span>
            <span>[\${log.module}] \${log.message}</span>
          </div>
        \`;
      }).join('');
    }

    function formatTime(ms) {
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);

      if (hours > 0) {
        return \`\${hours}h \${minutes % 60}m \${seconds % 60}s\`;
      } else if (minutes > 0) {
        return \`\${minutes}m \${seconds % 60}s\`;
      } else {
        return \`\${seconds}s\`;
      }
    }

    // Send command to monitor
    function sendCommand(action, params = {}) {
      // This would be implemented by the parent application
      if (window.webvisorMonitor) {
        window.webvisorMonitor.executeCommand({ action, params });
      } else {
        console.log('Command:', action, params);
      }
    }

    // Auto-refresh
    if (window.webvisorMonitor) {
      window.webvisorMonitor.subscribe(updateDisplay);
    }

    // Initial update
    if (window.webvisorMonitorData) {
      updateDisplay(window.webvisorMonitorData);
    }
  </script>
</body>
</html>`;
}

/**
 * Create web monitor
 */
export function createWebMonitor(config?: WebMonitorConfig): WebMonitor {
  return new WebMonitor(config);
}
