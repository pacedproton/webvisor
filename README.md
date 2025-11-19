# WebVisor

> A systems programming architecture for virtualizing the web platform

WebVisor is a hypervisor for the web. Like traditional hypervisors that virtualize CPU instructions, WebVisor intercepts and virtualizes web platform APIs (DOM, fetch, storage, timing, etc.) to enable powerful development, debugging, and runtime capabilities.

## Overview

WebVisor applies hypervisor design patterns to the web platform, enabling:

- **Time-travel debugging**: Step backward and forward through execution
- **Deterministic testing**: Eliminate flaky tests by controlling all non-determinism
- **Performance profiling**: Deep insights into API usage and performance
- **Offline-first development**: Build apps that work seamlessly offline
- **Advanced testing**: Mock network, inject faults, simulate conditions
- **Hot module replacement**: Update code while preserving state

## Architecture

```
┌─────────────────────────────────────────────────────┐
│           Application Code (Guest)                  │
├─────────────────────────────────────────────────────┤
│              WebVisor Trap Layer                    │
│         (Intercepts all web API calls)              │
├─────────────────────────────────────────────────────┤
│          Virtual Web Platform                       │
│    (Virtualized DOM, Network, Storage, etc.)        │
├─────────────────────────────────────────────────────┤
│           WebVisor Runtime & Scheduler              │
├─────────────────────────────────────────────────────┤
│              Host Web Platform                      │
└─────────────────────────────────────────────────────┘
```

## Quick Start

```typescript
import { WebVisor } from 'webvisor';

// Create hypervisor instance
const visor = new WebVisor({
  mode: 'strict',
  apis: ['dom', 'network', 'storage', 'timing'],
});

// Load and run guest code
await visor.load({ code: myAppCode });
await visor.run();

// Time travel
const snapshot = visor.snapshot();
visor.pause();
// ... make changes ...
await visor.restore(snapshot);
```

## Use Cases

### Time-Travel Debugging

Debug issues by rewinding execution and exploring different code paths:

```typescript
// Take snapshots automatically
visor.enableAutoSnapshot({ interval: 1000 });

// Rewind to debug
await visor.rewind(5000); // Go back 5000 operations
visor.step(); // Step forward one operation
```

### Deterministic Testing

Eliminate flaky tests by controlling time, randomness, and network:

```typescript
const visor = new WebVisor({ mode: 'strict' });

// Control time
visor.timing.advance(30 * 24 * 60 * 60 * 1000); // 30 days instantly

// Mock network
visor.intercept('fetch', (req) => ({
  status: 200,
  body: JSON.stringify({ data: 'mocked' })
}));

// Deterministic random
visor.random.seed(12345);
```

### Performance Profiling

Get deep insights into API usage:

```typescript
await visor.run();
const profile = visor.exportProfile();

// Analyze:
// - Which APIs are called most frequently
// - Where time is spent
// - Resource usage patterns
```

## Non-Security Use Cases

WebVisor is designed for legitimate development, debugging, and testing purposes:

- Development tools (debuggers, profilers, inspectors)
- Testing infrastructure (deterministic tests, mocks, scenarios)
- Analytics and observability (API usage, performance monitoring)
- Compatibility layers (polyfills, feature flags)
- Offline-first applications
- Experimentation infrastructure (A/B tests, feature flags)
- Educational tools (interactive tutorials, code exploration)
- Quality assurance (error detection, chaos engineering)
- Build optimization (dead code elimination, bundle analysis)

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed use cases.

## Project Status

🚧 **Early Development** - WebVisor is in active development. The architecture is defined but core implementation is in progress.

### Roadmap

- [ ] Phase 1: Foundation (Core trap layer, basic virtualization)
- [ ] Phase 2: Core Platform (Complete DOM, storage, events)
- [ ] Phase 3: Advanced Features (Workers, WebGL, optimization)
- [ ] Phase 4: Developer Tools (Time-travel debugger UI, profiler)

## Documentation

- [Architecture](./ARCHITECTURE.md) - Detailed system design and architecture
- API Documentation (coming soon)
- User Guide (coming soon)
- Contributing Guide (coming soon)

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Core Concepts

### Trap Layer

Intercepts all web API calls before they reach the browser:

- DOM operations
- Network requests (fetch, XHR, WebSocket)
- Storage access (localStorage, IndexedDB)
- Timing APIs (setTimeout, Date.now)
- Random number generation
- Canvas/WebGL rendering

### Virtual Platform

Provides virtualized implementations that can be controlled:

- Virtual DOM
- Virtual network stack
- Virtual storage layer
- Virtual clock (deterministic time)
- Virtual RNG (deterministic randomness)

### State Management

Enables snapshots and time-travel:

- Capture complete application state
- Restore to any previous state
- Delta-based snapshots for efficiency
- Configurable history limits

## Performance

Design goals:

- < 5% overhead for typical applications
- < 100ms snapshot time for 10MB state
- < 200ms restore time
- < 2x memory overhead

## License

MIT

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) (coming soon) for guidelines.

## Acknowledgments

Inspired by:
- Traditional hypervisors (Xen, KVM, VMware)
- Time-travel debuggers (rr, UndoDB)
- Deterministic replay systems
- Browser DevTools architecture
