/**
 * Example: Web Monitor
 * Demonstrates the real-time web monitoring interface
 */

import { WebVisor } from '../../src/webvisor.js';
import { createWebMonitor } from '../../src/tools/web-monitor.js';
import { createGraphicsTrapHandler } from '../../src/core/trap-layer/graphics-trap.js';
import * as fs from 'fs';
import * as path from 'path';

console.log('=== WebVisor Web Monitor Example ===\n');

//Create WebVisor instance
const visor = new WebVisor({
  mode: 'deterministic',
  apis: ['timing', 'random', 'storage', 'network'],
  clock: {
    startTime: 0,
    tickInterval: 16,
  },
  rng: {
    seed: 12345,
    algorithm: 'pcg',
  },
  isolation: {
    level: 'strong',
  },
});

console.log('✓ WebVisor instance created\n');

// Initialize graphics handler (skip in Node.js environment)
let graphicsHandler: any = null;
if (typeof HTMLCanvasElement !== 'undefined') {
  graphicsHandler = createGraphicsTrapHandler({
    recordCommands: true,
  });
  graphicsHandler.init();
  console.log('✓ Graphics handler initialized\n');
} else {
  console.log('⊘ Graphics handler skipped (Node.js environment)\n');
}

// Create web monitor
const monitor = createWebMonitor({
  updateInterval: 500, // Update every 500ms
  autoRefresh: true,
  maxLogEntries: 1000,
});

console.log('✓ Web monitor created\n');

// Register all components with the monitor
monitor.registerComponents({
  clock: visor.clock,
  rng: visor.rng,
  network: visor.network,
  storage: visor.storage,
  graphicsHandler: graphicsHandler,
});

console.log('✓ Components registered with monitor\n');

// Subscribe to updates
let updateCount = 0;
monitor.subscribe((snapshot) => {
  updateCount++;

  if (updateCount % 10 === 0) {
    console.log(`Update #${updateCount}:`);
    console.log(`  Clock: ${snapshot.clock.currentTime}ms`);
    console.log(`  RNG Calls: ${snapshot.rng.callCount}`);
    console.log(`  Storage Keys: ${snapshot.storage.localStorageKeys + snapshot.storage.sessionStorageKeys}`);
    console.log();
  }
});

console.log('✓ Subscribed to monitor updates\n');

// Start the monitor
monitor.start();

console.log('✓ Monitor started\n');

// ============================================================================
// Simulate Application Activity
// ============================================================================

console.log('Simulating application activity...\n');

// Use localStorage
console.log('1. Using localStorage...');
visor.storage.localStorage.setItem('user', 'Alice');
visor.storage.localStorage.setItem('theme', 'dark');
visor.storage.localStorage.setItem('settings', JSON.stringify({ notifications: true, language: 'en' }));

console.log(`   ✓ Stored ${visor.storage.localStorage.length} items\n`);

// Use sessionStorage
console.log('2. Using sessionStorage...');
visor.storage.sessionStorage.setItem('token', 'abc123');
visor.storage.sessionStorage.setItem('sessionId', 'xyz789');

console.log(`   ✓ Stored ${visor.storage.sessionStorage.length} session items\n`);

// Make some network requests (these will be mocked)
console.log('3. Setting up network mocks...');
visor.network.fetch.mock(/api\.example\.com/, async (request) => {
  return new Response(JSON.stringify({ message: 'Hello from mock API!' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

visor.network.fetch.mock(/users/, async (request) => {
  return new Response(JSON.stringify({ users: ['Alice', 'Bob', 'Charlie'] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

console.log(`   ✓ Added 2 network mocks\n`);

// Advance time and trigger events
console.log('4. Scheduling timers...');
visor.clock.setTimeout(() => {
  console.log('   ⏰ Timer fired at 1000ms');
}, 1000);

visor.clock.setTimeout(() => {
  console.log('   ⏰ Timer fired at 2000ms');
}, 2000);

visor.clock.setTimeout(() => {
  console.log('   ⏰ Timer fired at 3000ms');
}, 3000);

console.log(`   ✓ Scheduled 3 timers\n`);

// Generate some random numbers
console.log('5. Generating random numbers...');
const randomValues: number[] = [];
for (let i = 0; i < 100; i++) {
  randomValues.push(visor.rng.random());
}

console.log(`   ✓ Generated ${visor.rng.getState().callCount} random numbers\n`);
console.log(`   First 10: [${randomValues.slice(0, 10).map(n => n.toFixed(4)).join(', ')}]\n`);

// Advance time
console.log('6. Advancing time...');
visor.clock.advance(1500);
console.log(`   ✓ Advanced to ${visor.clock.getState().currentTime.value}ms\n`);

// ============================================================================
// Display Monitor State
// ============================================================================

setTimeout(() => {
  console.log('\n=== Current Monitor State ===\n');

  const snapshot = monitor.getSnapshot();

  console.log('System:');
  console.log(`  Uptime: ${snapshot.uptime}ms`);
  console.log(`  Timestamp: ${new Date(snapshot.timestamp).toISOString()}\n`);

  console.log('Virtual Clock:');
  console.log(`  Current Time: ${snapshot.clock.currentTime}ms`);
  console.log(`  Scheduled: ${snapshot.clock.scheduledCount}`);
  console.log(`  Ticks: ${snapshot.clock.tickCount}\n`);

  console.log('RNG:');
  console.log(`  Seed: ${snapshot.rng.seed}`);
  console.log(`  Algorithm: ${snapshot.rng.algorithm}`);
  console.log(`  Calls: ${snapshot.rng.callCount}\n`);

  console.log('Network:');
  console.log(`  Total Requests: ${snapshot.network.requestCount}`);
  console.log(`  Mocks: ${snapshot.network.mockCount}`);
  console.log(`  Pending: ${snapshot.network.pendingRequests}`);
  console.log(`  Cache Size: ${snapshot.network.cacheSize}\n`);

  console.log('Storage:');
  console.log(`  localStorage: ${snapshot.storage.localStorageSize} bytes (${snapshot.storage.localStorageKeys} keys)`);
  console.log(`  sessionStorage: ${snapshot.storage.sessionStorageSize} bytes (${snapshot.storage.sessionStorageKeys} keys)\n`);

  console.log('Graphics:');
  console.log(`  Canvases: ${snapshot.graphics.canvasCount}`);
  console.log(`  Draw Calls: ${snapshot.graphics.totalDrawCalls}`);
  console.log(`  Commands: ${snapshot.graphics.totalCommands}\n`);

  // ============================================================================
  // Test Control Commands
  // ============================================================================

  console.log('=== Testing Control Commands ===\n');

  console.log('1. Advancing time by 1000ms...');
  monitor.executeCommand({ action: 'advance', params: { ms: 1000 } }).then(() => {
    console.log(`   ✓ Time advanced to ${visor.clock.getState().currentTime.value}ms\n`);

    console.log('2. Stepping forward by 16ms...');
    return monitor.executeCommand({ action: 'step' });
  }).then(() => {
    console.log(`   ✓ Stepped to ${visor.clock.getState().currentTime.value}ms\n`);

    // ============================================================================
    // Generate HTML Monitor
    // ============================================================================

    console.log('=== Generating HTML Monitor ===\n');

    const html = monitor.getMonitorHTML();
    const outputPath = path.join(process.cwd(), 'examples', 'web-monitor', 'monitor.html');

    // Inject current state
    const stateScript = `
<script>
window.webvisorMonitorData = ${JSON.stringify(monitor.getSnapshot(), null, 2)};
window.webvisorMonitor = {
  subscribe: function(callback) {
    // This would be connected to the actual monitor
    console.log('Subscribed to monitor updates');
    return function() { console.log('Unsubscribed'); };
  },
  executeCommand: function(command) {
    console.log('Execute command:', command);
    alert('Command executed: ' + command.action);
  }
};
</script>
</body>`;

    const finalHTML = html.replace('</body>', stateScript);

    fs.writeFileSync(outputPath, finalHTML);

    console.log(`✓ HTML monitor saved to: ${outputPath}`);
    console.log('  Open this file in a web browser to view the interactive monitor\n');

    // Also save JSON state
    const jsonPath = path.join(process.cwd(), 'examples', 'web-monitor', 'state.json');
    fs.writeFileSync(jsonPath, monitor.getStateJSON());

    console.log(`✓ State JSON saved to: ${jsonPath}\n`);

    // ============================================================================
    // Summary
    // ============================================================================

    console.log('=== Summary ===\n');

    console.log('WebVisor Web Monitor Features:');
    console.log('  ✓ Real-time state monitoring');
    console.log('  ✓ All subsystems tracked (clock, RNG, network, storage, graphics)');
    console.log('  ✓ Subscription-based updates');
    console.log('  ✓ Control commands (pause, resume, step, snapshot, reset, advance)');
    console.log('  ✓ Beautiful web-based UI with live data');
    console.log('  ✓ Log viewing and filtering');
    console.log('  ✓ Metrics tracking and display');
    console.log('  ✓ Export to HTML and JSON');

    console.log('\nUse Cases:');
    console.log('  • Real-time debugging of hypervisor state');
    console.log('  • Performance monitoring and profiling');
    console.log('  • Visual inspection of virtual platform');
    console.log('  • Interactive control of execution');
    console.log('  • State persistence and sharing');
    console.log('  • Integration testing dashboards');

    console.log('\nTo view the monitor:');
    console.log(`  1. Open ${outputPath} in your browser`);
    console.log('  2. Use the control buttons to interact with the hypervisor');
    console.log('  3. Monitor real-time state updates\n');

    console.log('=== Example Complete ===');

    // Stop monitor
    monitor.stop();
    console.log('\n✓ Monitor stopped');

    process.exit(0);
  }).catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
}, 1000);
