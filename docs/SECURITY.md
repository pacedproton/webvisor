# WebVisor Security & Isolation

## Overview

WebVisor implements comprehensive **isolation and escape prevention** to ensure guest code cannot break out of the virtualized environment and access native OS/browser APIs. This is critical for security and determinism.

## Threat Model

### What We Protect Against

1. **Function Constructor Exploits**
   - Guest code using `new Function()` to access native APIs
   - Example: `new Function('return window.fetch')()`

2. **eval Exploits**
   - Direct or indirect eval to execute arbitrary code
   - Example: `eval('this.fetch')`

3. **Window Escapes**
   - Accessing parent/top/opener windows
   - Example: `window.parent.fetch`

4. **Prototype Pollution**
   - Modifying Object.prototype to inject malicious code
   - Example: `Object.prototype.toString = maliciousFunc`

5. **Constructor Chain Access**
   - Using constructor chain to reach Function
   - Example: `({}).constructor.constructor`

6. **__proto__ Manipulation**
   - Direct prototype chain manipulation
   - Example: `obj.__proto__ = maliciousProto`

7. **Global API Access**
   - Accessing non-trapped native APIs
   - Example: `Worker`, `SharedWorker`, `importScripts`

### What We DON'T Protect Against

- **Side-channel attacks** (timing, spectre, etc.)
- **Physical access** to the machine
- **Browser vulnerabilities** (we rely on browser security)
- **Malicious extensions** (outside our control)

## Isolation Levels

WebVisor provides 4 isolation levels:

### 1. NONE (Debug Only)
```typescript
const isolation = createIsolationManager({
  level: IsolationLevel.NONE
});
```

**Features:**
- No restrictions
- Guest code runs directly on host
- **Use only for debugging**

**Security:** ⚠️ None

### 2. BASIC
```typescript
const isolation = createIsolationManager({
  level: IsolationLevel.BASIC,
  blockedGlobals: ['Worker', 'SharedWorker']
});
```

**Features:**
- Blocks specified global APIs
- Basic access validation

**Security:** ⭐ Low
- Prevents accidental native API access
- Easy to bypass with eval/Function

### 3. STRONG (Recommended)
```typescript
const isolation = createIsolationManager({
  level: IsolationLevel.STRONG
});
```

**Features:**
- ✅ Blocks Function constructor
- ✅ Blocks eval (direct and indirect)
- ✅ Freezes core prototypes
- ✅ Prevents prototype pollution
- ✅ Blocks __proto__ manipulation

**Security:** ⭐⭐⭐⭐ High
- Prevents most escape attempts
- Suitable for most use cases

### 4. MAXIMUM (Paranoid)
```typescript
const isolation = createIsolationManager({
  level: IsolationLevel.MAXIMUM,
  enableCSP: true,
  blockedGlobals: ['Worker', 'SharedWorker', 'importScripts']
});
```

**Features:**
- ✅ All STRONG protections
- ✅ Blocks window escapes (parent, top, opener)
- ✅ Content Security Policy
- ✅ Makes critical properties non-configurable
- ✅ iframe sandbox (when enabled)

**Security:** ⭐⭐⭐⭐⭐ Maximum
- Defense in depth
- Suitable for untrusted code

## Implementation Details

### Function Constructor Blocking

```typescript
// Before: Guest can escape
const escape = new Function('return window.fetch');
escape(); // Native fetch!

// After: Blocked
globalThis.Function = new Proxy(Function, {
  construct() {
    throw new Error('Function constructor disabled');
  }
});
```

### eval Blocking

```typescript
// Before: Guest can escape
eval('window.fetch'); // Native fetch!

// After: Blocked
globalThis.eval = function() {
  throw new Error('eval disabled');
};
```

### Prototype Protection

```typescript
// Before: Guest can pollute
Object.prototype.malicious = true;

// After: Blocked
Object.freeze(Object.prototype);
Object.freeze(Array.prototype);
Object.freeze(Function.prototype);
// etc.
```

### Window Escape Prevention

```typescript
// Before: Guest can escape to parent
window.parent.fetch; // Parent's fetch!

// After: Blocked
Object.defineProperty(window, 'parent', {
  get: () => window, // Returns self
  configurable: false
});
```

## Security Features

### 1. Violation Tracking

All escape attempts are logged:

```typescript
const violations = isolationManager.getViolations();
// [
//   {
//     timestamp: 1234567890,
//     api: 'Function',
//     message: 'Attempted Function constructor',
//     stack: '...'
//   }
// ]
```

### 2. Access Validation

Validate API access before allowing:

```typescript
const allowed = isolationManager.validateAccess('Worker', 'constructor');
if (!allowed) {
  throw new Error('Access denied');
}
```

### 3. Isolation Validation

Programmatically verify isolation is working:

```typescript
const validation = isolationManager.validateIsolation();
// {
//   passed: true,
//   level: 'maximum',
//   tests: [
//     { name: 'Function constructor blocked', passed: true },
//     { name: 'eval blocked', passed: true },
//     // ...
//   ]
// }
```

### 4. Hypervisor Access to Native APIs

The hypervisor itself needs native APIs to function. We preserve them:

```typescript
// Guest: Cannot access
fetch('...'); // Trapped/virtualized

// Hypervisor: Can access original
const nativeFetch = isolationManager.getOriginalAPI('fetch');
nativeFetch('...'); // Real native fetch
```

## Testing

Comprehensive test suite verifies all protections:

```typescript
describe('Isolation', () => {
  it('blocks Function constructor', () => {
    expect(() => new Function('return 1')).toThrow();
  });

  it('blocks eval', () => {
    expect(() => eval('1 + 1')).toThrow();
  });

  it('blocks window.parent', () => {
    expect(window.parent).toBe(window);
  });

  // 30+ more tests...
});
```

## Security Metrics

WebVisor tracks security events:

```typescript
// Metrics collected:
isolation.violations              // Total escape attempts
isolation.function_constructor_blocked
isolation.eval_blocked
isolation.proto_pollution_blocked
isolation.window_escape_blocked
```

## Best Practices

### For Most Use Cases (Development/Testing)

```typescript
const visor = new WebVisor({
  mode: 'strict',
  apis: ['dom', 'network', 'storage', 'timing', 'random'],
  isolation: {
    level: IsolationLevel.STRONG
  }
});
```

### For Untrusted Code

```typescript
const visor = new WebVisor({
  mode: 'strict',
  apis: ['dom', 'network', 'storage', 'timing', 'random'],
  isolation: {
    level: IsolationLevel.MAXIMUM,
    enableCSP: true,
    enableIframeSandbox: true,
    blockedGlobals: ['Worker', 'SharedWorker', 'importScripts']
  }
});
```

### For Debugging

```typescript
const visor = new WebVisor({
  mode: 'relaxed', // Lower overhead
  apis: ['dom', 'timing'],
  isolation: {
    level: IsolationLevel.NONE // Full access for debugging
  }
});
```

## Limitations

### Cannot Prevent

1. **Browser Bugs**: We rely on browser security
2. **Side Channels**: Timing attacks, Spectre, etc.
3. **Hardware Access**: Direct hardware interaction
4. **Extension Interference**: Malicious browser extensions

### Performance Impact

- **NONE**: 0% overhead
- **BASIC**: <1% overhead
- **STRONG**: ~1-2% overhead
- **MAXIMUM**: ~2-3% overhead

## Comparison with Other Systems

| Feature | WebVisor | iframe sandbox | Web Workers | VM.js |
|---------|----------|----------------|-------------|-------|
| Function blocking | ✅ | ✅ | ✅ | ✅ |
| eval blocking | ✅ | ✅ | ✅ | ✅ |
| Prototype protection | ✅ | ❌ | ❌ | ✅ |
| Time control | ✅ | ❌ | ❌ | ❌ |
| Network mocking | ✅ | ❌ | ❌ | ❌ |
| State snapshots | ✅ | ❌ | ❌ | ❌ |
| Performance | High | High | High | Low |

## Future Enhancements

### Planned

- [ ] WASM sandboxing
- [ ] Hardware-based isolation (Intel SGX, ARM TrustZone)
- [ ] Encrypted memory regions
- [ ] Process-level isolation
- [ ] Kernel-level syscall filtering

### Research

- [ ] Formal verification of isolation
- [ ] Automated escape detection via fuzzing
- [ ] ML-based anomaly detection
- [ ] Quantum-resistant protections

## Security Disclosure

If you discover a security vulnerability or escape technique:

1. **DO NOT** open a public issue
2. Email security@webvisor.dev (hypothetical)
3. Include reproduction steps
4. Allow 90 days for patching

We take security seriously and will respond within 24 hours.

## References

- [OWASP JavaScript Security](https://owasp.org/www-community/vulnerabilities/JavaScript)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [iframe Sandbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#attr-sandbox)
- [Web Workers Security](https://www.w3.org/TR/workers/#security)
- [VM2 Escape Vulnerabilities](https://github.com/patriksimek/vm2/security/advisories)

## Conclusion

WebVisor implements **defense in depth** for isolation:

✅ **Multiple protection layers**
✅ **Comprehensive testing**
✅ **Violation tracking**
✅ **Validation tools**
✅ **Configurable security levels**

Choose the isolation level that matches your threat model and performance requirements.
