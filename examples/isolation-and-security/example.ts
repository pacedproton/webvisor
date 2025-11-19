/**
 * Example: Isolation and Escape Prevention
 * Demonstrates how WebVisor prevents guest code from escaping virtualization
 */

import { createIsolationManager, IsolationLevel } from '../../src/core/isolation/isolation-manager.js';

console.log('=== WebVisor Isolation & Escape Prevention Example ===\n');

console.log('1. Testing Maximum Isolation\n');

const maxIsolation = createIsolationManager({
  level: IsolationLevel.MAXIMUM,
  blockedGlobals: ['Worker', 'SharedWorker', 'importScripts'],
  enableCSP: false, // Disable for this example
});

maxIsolation.init();

console.log('  ✓ Maximum isolation initialized');

console.log('\n2. Attempting Common Escape Techniques\n');

// Escape Attempt 1: Function constructor
console.log('  Attempt 1: Function constructor to access native window');
try {
  const getNativeWindow = new Function('return window');
  const nativeWindow = getNativeWindow();
  console.log('  ✗ ESCAPED! Got native window:', !!nativeWindow);
} catch (error) {
  console.log('  ✓ BLOCKED:', (error as Error).message);
}

// Escape Attempt 2: eval
console.log('\n  Attempt 2: eval to execute arbitrary code');
try {
  const result = eval('window.fetch');
  console.log('  ✗ ESCAPED! Got native fetch:', !!result);
} catch (error) {
  console.log('  ✓ BLOCKED:', (error as Error).message);
}

// Escape Attempt 3: Indirect eval
console.log('\n  Attempt 3: Indirect eval via variable');
try {
  const indirectEval = eval;
  const result = indirectEval('globalThis');
  console.log('  ✗ ESCAPED! Got globalThis:', !!result);
} catch (error) {
  console.log('  ✓ BLOCKED:', (error as Error).message);
}

// Escape Attempt 4: window.parent
console.log('\n  Attempt 4: Access parent window');
try {
  const parent = window.parent;
  if (parent !== window) {
    console.log('  ✗ ESCAPED! Got different window');
  } else {
    console.log('  ✓ BLOCKED: window.parent returns self');
  }
} catch (error) {
  console.log('  ✓ BLOCKED:', (error as Error).message);
}

// Escape Attempt 5: window.top
console.log('\n  Attempt 5: Access top window');
try {
  const top = window.top;
  if (top !== window) {
    console.log('  ✗ ESCAPED! Got different window');
  } else {
    console.log('  ✓ BLOCKED: window.top returns self');
  }
} catch (error) {
  console.log('  ✓ BLOCKED:', (error as Error).message);
}

// Escape Attempt 6: Prototype pollution
console.log('\n  Attempt 6: Prototype pollution');
try {
  (Object.prototype as any).malicious = true;
  console.log('  ✗ ESCAPED! Polluted Object.prototype');
} catch (error) {
  console.log('  ✓ BLOCKED:', (error as Error).message);
}

// Verify prototype wasn't polluted
if ((Object.prototype as any).malicious) {
  console.log('  ✗ WARNING: Prototype pollution succeeded!');
} else {
  console.log('  ✓ VERIFIED: Object.prototype is clean');
}

// Escape Attempt 7: __proto__ manipulation
console.log('\n  Attempt 7: __proto__ manipulation');
try {
  const obj: any = {};
  obj.__proto__ = { hacked: true };
  console.log('  ✗ ESCAPED! Modified __proto__');
} catch (error) {
  console.log('  ✓ BLOCKED:', (error as Error).message);
}

// Escape Attempt 8: Constructor chain access
console.log('\n  Attempt 8: Access Function via constructor chain');
try {
  const obj: any = {};
  const FunctionConstructor = obj.constructor.constructor;
  const escape = new FunctionConstructor('return fetch');
  console.log('  ✗ ESCAPED! Got Function constructor');
} catch (error) {
  console.log('  ✓ BLOCKED:', (error as Error).message);
}

console.log('\n3. Checking Security Violations\n');

const violations = maxIsolation.getViolations();
console.log('  Total violations detected:', violations.length);

if (violations.length > 0) {
  console.log('\n  Recent violations:');
  violations.slice(-3).forEach((v, i) => {
    console.log(`    ${i + 1}. ${v.api}: ${v.message}`);
  });
}

console.log('\n4. Validating Isolation Integrity\n');

const validation = maxIsolation.validateIsolation();

console.log('  Isolation status:', validation.passed ? '✓ SECURE' : '✗ COMPROMISED');
console.log('  Isolation level:', validation.level);
console.log('\n  Security tests:');

for (const test of validation.tests) {
  const icon = test.passed ? '✓' : '✗';
  console.log(`    ${icon} ${test.name}`);
}

console.log('\n5. Testing Access Control\n');

console.log('  Attempting to access blocked APIs:');

const blockedAPIs = ['Worker', 'SharedWorker', 'importScripts'];
for (const api of blockedAPIs) {
  const allowed = maxIsolation.validateAccess(api, 'constructor');
  const status = allowed ? '✗ ALLOWED' : '✓ BLOCKED';
  console.log(`    ${status}: ${api}`);
}

console.log('\n6. Hypervisor Internal Access\n');

console.log('  Hypervisor can still access native APIs:');

const nativeFetch = maxIsolation.getOriginalAPI('fetch');
const nativeXHR = maxIsolation.getOriginalAPI('XMLHttpRequest');
const nativeWS = maxIsolation.getOriginalAPI('WebSocket');

console.log('    ✓ Native fetch:', typeof nativeFetch);
console.log('    ✓ Native XMLHttpRequest:', typeof nativeXHR);
console.log('    ✓ Native WebSocket:', typeof nativeWS);

console.log('\n7. Frozen Prototypes Check\n');

console.log('  Checking critical prototypes:');
console.log('    Object.prototype frozen:', Object.isFrozen(Object.prototype) ? '✓' : '✗');
console.log('    Array.prototype frozen:', Object.isFrozen(Array.prototype) ? '✓' : '✗');
console.log('    Function.prototype frozen:', Object.isFrozen(Function.prototype) ? '✓' : '✗');
console.log('    String.prototype frozen:', Object.isFrozen(String.prototype) ? '✓' : '✗');

console.log('\n8. Exporting Security Report\n');

const report = maxIsolation.exportReport();
const reportObj = JSON.parse(report);

console.log('  Report contains:');
console.log('    - Configuration: ✓');
console.log('    - Violations:', reportObj.violations.length);
console.log('    - Access log entries:', reportObj.accessLog.length);
console.log('    - Validation results: ✓');

console.log('\n=== Summary ===\n');

console.log('WebVisor Isolation Features:');
console.log('  ✓ Blocks Function constructor (prevents arbitrary code execution)');
console.log('  ✓ Blocks eval (prevents code injection)');
console.log('  ✓ Blocks window escapes (parent, top, opener)');
console.log('  ✓ Prevents prototype pollution');
console.log('  ✓ Freezes core prototypes');
console.log('  ✓ Blocks __proto__ manipulation');
console.log('  ✓ Records all escape attempts');
console.log('  ✓ Validates isolation integrity');
console.log('  ✓ Preserves native APIs for hypervisor use');

console.log('\nSecurity Levels Available:');
console.log('  • NONE: No isolation (debug only)');
console.log('  • BASIC: Block native API access');
console.log('  • STRONG: Block eval, Function, protect prototypes');
console.log('  • MAXIMUM: All protections + window escapes + CSP');

console.log('\n=== Example Complete ===');
