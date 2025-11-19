/**
 * Example: Performance Analysis with WebVisor
 * Demonstrates profiling and performance optimization insights
 */

import { WebVisor } from '../../src/index.js';

console.log('=== WebVisor Performance Analysis Example ===\n');

const visor = new WebVisor({
  mode: 'strict',
  apis: ['dom', 'timing', 'random'],
  enableProfiling: true,
  enableTracing: true,
});

console.log('1. Simulating application workload\n');

// Simulate DOM operations
const dom = visor.getDOM();
const doc = dom.getDocument();

console.log('  Creating DOM elements...');

// Create many elements (simulate inefficient code)
for (let i = 0; i < 100; i++) {
  const div = dom.createElement('div');
  div.setAttribute('id', `element-${i}`);
  div.setAttribute('class', 'box');
  div.textContent = `Element ${i}`;

  doc.body.appendChild(div);
}

console.log('  ✓ Created 100 DOM elements');

// Simulate timing operations
const clock = visor.getClock();

console.log('  Scheduling timers...');

for (let i = 0; i < 50; i++) {
  clock.setTimeout(() => {
    // Some work
  }, i * 10);
}

console.log('  ✓ Scheduled 50 timeouts');

// Simulate random operations
const rng = visor.getRNG();

console.log('  Generating random numbers...');

for (let i = 0; i < 1000; i++) {
  rng.random();
}

console.log('  ✓ Generated 1000 random numbers\n');

console.log('2. Analyzing performance\n');

const profiler = visor.getProfiler();

// Get API usage analysis
const apiUsage = profiler.analyzeAPIUsage();

console.log('  API Usage Summary:');
console.log('  Total API calls:', apiUsage.totalCalls);

if (apiUsage.byAPI.length > 0) {
  console.log('\n  Top APIs by call count:');
  const top5 = apiUsage.byAPI.slice(0, 5);

  for (const api of top5) {
    console.log(`    - ${api.api}: ${api.callCount} calls`);
  }
}

// Get DOM analysis
const domAnalysis = profiler.analyzeDOMOperations();

console.log('\n  DOM Operations:');
console.log('  Total operations:', domAnalysis.totalOperations);
console.log('  Avg duration:', domAnalysis.averageDuration.toFixed(2) + 'ms');

if (domAnalysis.byOperation.length > 0) {
  console.log('\n  By operation type:');
  for (const op of domAnalysis.byOperation) {
    console.log(`    - ${op.operation}: ${op.count}`);
  }
}

// Get optimization suggestions
console.log('\n3. Optimization suggestions\n');

const suggestions = profiler.generateSuggestions();

if (suggestions.length === 0) {
  console.log('  ✓ No major issues detected');
} else {
  for (const suggestion of suggestions) {
    const icon = suggestion.severity === 'high' ? '⚠️' : suggestion.severity === 'medium' ? '⚡' : 'ℹ️';
    console.log(`  ${icon} [${suggestion.severity.toUpperCase()}] ${suggestion.message}`);
  }
}

console.log('\n4. System metrics\n');

const stats = visor.getStats();

console.log('  Clock:');
console.log('    - Current time:', stats.clock.currentTime);
console.log('    - Scheduled callbacks:', stats.clock.scheduledCallbacks);

console.log('\n  RNG:');
console.log('    - Algorithm:', stats.rng.algorithm);
console.log('    - Random calls:', stats.rng.randomCalls);
console.log('    - Bytes generated:', stats.rng.bytesGenerated);

console.log('\n  DOM:');
console.log('    - Total nodes:', stats.dom.totalNodes);
console.log('    - Elements:', stats.dom.elementCount);
console.log('    - Max depth:', stats.dom.maxDepth);

console.log('\n  Profiler:');
console.log('    - Recording:', stats.profiler.recording);
console.log('    - Total traces:', stats.profiler.totalTraces);

console.log('\n5. Exporting profiling report\n');

const report = profiler.exportReport();
const reportObj = JSON.parse(report);

console.log('  Report contains:');
console.log('    - API usage analysis: ✓');
console.log('    - DOM analysis: ✓');
console.log('    - Network analysis: ✓');
console.log('    - Hotspots: ✓');
console.log('    - Suggestions:', reportObj.suggestions.length);
console.log('    - Metrics: ✓');

console.log('\n  Report size:', (report.length / 1024).toFixed(2) + ' KB');

console.log('\n=== Example Complete ===');
