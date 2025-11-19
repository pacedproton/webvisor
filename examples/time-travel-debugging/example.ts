/**
 * Example: Time-Travel Debugging with WebVisor
 * Demonstrates rewinding and replaying execution
 */

import { WebVisor } from '../../src/index.js';

console.log('=== WebVisor Time-Travel Debugging Example ===\n');

const visor = new WebVisor({
  mode: 'strict',
  apis: ['dom', 'timing', 'storage'],
  enableSnapshots: true,
  snapshotInterval: 100,
  maxHistory: 10,
  enableProfiling: true,
  enableTracing: true,
});

console.log('1. Creating virtual DOM state\n');

const dom = visor.getDOM();
const document = dom.getDocument();

// Create some DOM elements
const div1 = dom.createElement('div');
div1.setAttribute('id', 'container');
div1.setAttribute('class', 'main');

const text = dom.createTextNode('Hello, WebVisor!');
div1.appendChild(text);

document.body.appendChild(div1);

console.log('  Created DOM:');
console.log('  ', dom.exportHTML().substring(0, 100) + '...');

// Take snapshot 1
const snap1 = visor.snapshot({ label: 'initial-dom', tags: ['dom', 'test'] });
console.log('  ✓ Snapshot 1:', snap1.id);

console.log('\n2. Modifying state\n');

// Add more elements
const div2 = dom.createElement('div');
div2.textContent = 'Second element';
document.body.appendChild(div2);

const div3 = dom.createElement('div');
div3.textContent = 'Third element';
document.body.appendChild(div3);

const stats1 = dom.getStats();
console.log('  DOM nodes:', stats1.totalNodes);
console.log('  DOM depth:', stats1.maxDepth);

// Take snapshot 2
const snap2 = visor.snapshot({ label: 'added-elements', tags: ['dom', 'test'] });
console.log('  ✓ Snapshot 2:', snap2.id);

console.log('\n3. Time travel - rewind to snapshot 1\n');

visor.restore(snap1);

const stats2 = dom.getStats();
console.log('  After rewind:');
console.log('  DOM nodes:', stats2.totalNodes);
console.log('  DOM depth:', stats2.maxDepth);

console.log('\n4. Time travel - forward to snapshot 2\n');

visor.restore(snap2);

const stats3 = dom.getStats();
console.log('  After forward:');
console.log('  DOM nodes:', stats3.totalNodes);
console.log('  DOM depth:', stats3.maxDepth);

console.log('\n5. Snapshot history\n');

const history = visor.getHistory();
console.log('  Total snapshots:', history.length);

for (const snap of history) {
  console.log(`  - ${snap.id}`);
  console.log(`    Label: ${snap.metadata.label || 'none'}`);
  console.log(`    Tags: ${snap.metadata.tags?.join(', ') || 'none'}`);
  console.log(`    Size: ${snap.metadata.size} bytes`);
}

console.log('\n6. Inspector analysis\n');

const inspector = visor.getInspector();
const domInspection = inspector.inspectDOM();

console.log('  DOM inspection:');
console.log('    Node count:', domInspection.nodeCount);
console.log('    Max depth:', domInspection.maxDepth);
console.log('    Elements:', domInspection.nodes.filter(n => n.type === 'element').length);
console.log('    Text nodes:', domInspection.nodes.filter(n => n.type === 'text').length);

console.log('\n7. Profiler analysis\n');

const profiler = visor.getProfiler();
const profilerStats = profiler.getStats();

console.log('  Profiler stats:');
console.log('    Recording:', profilerStats.recording);
console.log('    Total traces:', profilerStats.totalTraces);
console.log('    Max traces:', profilerStats.maxTraces);

console.log('\n=== Example Complete ===');
