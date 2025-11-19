/**
 * Example: Deterministic Testing with WebVisor
 * Demonstrates how WebVisor eliminates flaky tests
 */

import { WebVisor, createVirtualClock, createVirtualRNG, PRNGAlgorithm } from '../../src/index.js';

console.log('=== WebVisor Deterministic Testing Example ===\n');

// Example 1: Deterministic Time
console.log('1. Testing time-dependent code deterministically\n');

const clock = createVirtualClock(0); // Start at epoch

// Schedule some timeouts
clock.setTimeout(() => {
  console.log('  ✓ Timeout 1 fired (100ms)');
}, 100);

clock.setTimeout(() => {
  console.log('  ✓ Timeout 2 fired (200ms)');
}, 200);

console.log('  Current time:', clock.now().value);

// Advance time instantly
clock.advance(100);
console.log('  Advanced 100ms, time:', clock.now().value);

clock.advance(100);
console.log('  Advanced 100ms more, time:', clock.now().value);

console.log('\n2. Testing randomness deterministically\n');

// Example 2: Deterministic Random
const rng1 = createVirtualRNG(12345, PRNGAlgorithm.XORSHIFT128);
const rng2 = createVirtualRNG(12345, PRNGAlgorithm.XORSHIFT128);

console.log('  RNG 1 values:');
const values1 = [rng1.random(), rng1.random(), rng1.random()];
console.log('  ', values1.map(v => v.toFixed(6)).join(', '));

console.log('\n  RNG 2 values (same seed):');
const values2 = [rng2.random(), rng2.random(), rng2.random()];
console.log('  ', values2.map(v => v.toFixed(6)).join(', '));

console.log('\n  Values match:', JSON.stringify(values1) === JSON.stringify(values2) ? '✓' : '✗');

// Example 3: Snapshot and Restore
console.log('\n3. Snapshot and restore state\n');

const rng3 = createVirtualRNG(42);
const snapshot = rng3.getState();

console.log('  Before snapshot:');
const before = [rng3.random(), rng3.random()];
console.log('  ', before.map(v => v.toFixed(6)).join(', '));

console.log('\n  After more calls:');
const after = [rng3.random(), rng3.random()];
console.log('  ', after.map(v => v.toFixed(6)).join(', '));

// Restore to snapshot
rng3.setState(snapshot);

console.log('\n  After restore:');
const restored = [rng3.random(), rng3.random()];
console.log('  ', restored.map(v => v.toFixed(6)).join(', '));

console.log('\n  Restored values match:', JSON.stringify(before) === JSON.stringify(restored) ? '✓' : '✗');

// Example 4: Full WebVisor instance
console.log('\n4. Full WebVisor with time-travel\n');

const visor = new WebVisor({
  mode: 'strict',
  apis: ['dom', 'timing', 'random'],
  enableSnapshots: true,
  enableProfiling: true,
});

// Create some state
const visorClock = visor.getClock();
const visorRNG = visor.getRNG();

console.log('  Initial time:', visorClock.now().value);
console.log('  Initial random:', visorRNG.random().toFixed(6));

// Take snapshot
const snap1 = visor.snapshot({ label: 'checkpoint1' });
console.log('  ✓ Snapshot 1 created:', snap1.id);

// Advance time and generate random numbers
visorClock.advance(1000);
const rand1 = visorRNG.random();
console.log('\n  After changes:');
console.log('    Time:', visorClock.now().value);
console.log('    Random:', rand1.toFixed(6));

// Take another snapshot
const snap2 = visor.snapshot({ label: 'checkpoint2' });
console.log('  ✓ Snapshot 2 created:', snap2.id);

// Restore to first snapshot
console.log('\n  Restoring to snapshot 1...');
visor.restore(snap1);

console.log('  After restore:');
console.log('    Time:', visorClock.now().value);
console.log('    Random:', visorRNG.random().toFixed(6));

// Get stats
const stats = visor.getStats();
console.log('\n5. WebVisor Statistics:\n');
console.log('  State snapshots:', stats.state.totalSnapshots);
console.log('  Clock callbacks:', stats.clock.scheduledCallbacks);
console.log('  RNG calls:', stats.rng.randomCalls);

console.log('\n=== Example Complete ===');
