/**
 * Virtual Network Implementation
 * Provides mocked and controlled network layer
 */

import type {
  VirtualNetwork,
  VirtualFetch,
  MockHandler,
  MockResponse,
  NetworkState,
  InFlightRequest,
  CachedResponse,
  MockConfiguration,
} from './types.js';
import type { VirtualTimestamp } from '../types.js';
import { getLogger } from '../../utils/instrumentation/logger.js';
import { getMetrics } from '../../utils/instrumentation/metrics.js';
import { getTracer } from '../../utils/instrumentation/tracer.js';

const logger = getLogger('virtual-network');
const metrics = getMetrics();
const tracer = getTracer();

/**
 * Virtual fetch implementation
 */
export class VirtualFetchImpl implements VirtualFetch {
  private mocks = new Map<string | RegExp, MockHandler>();
  private cache = new Map<string, CachedResponse>();
  private inFlight = new Map<string, InFlightRequest>();

  async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    return tracer.trace('vfetch.fetch', async (span) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method || 'GET';

      span.setAttribute('url', url);
      span.setAttribute('method', method);

      metrics.counter('vnetwork.fetch.requests').inc();

      logger.debug('Fetch intercepted', {
        operation: 'fetch',
        url,
        method,
      });

      // Track in-flight request
      const requestId = this.generateRequestId();
      const inFlightReq: InFlightRequest = {
        id: requestId,
        url,
        method,
        headers: this.extractHeaders(init),
        body: init?.body?.toString(),
        timestamp: this.getCurrentTimestamp(),
      };

      this.inFlight.set(requestId, inFlightReq);

      try {
        // Check for mock
        const mockHandler = this.findMock(url);
        if (mockHandler) {
          metrics.counter('vnetwork.fetch.mocked').inc();

          const request = new Request(input, init);
          const response = await this.executeMock(mockHandler, request);

          this.inFlight.delete(requestId);
          this.cacheResponse(url, response);

          return response;
        }

        // Check cache
        const cached = this.cache.get(url);
        if (cached && method === 'GET') {
          metrics.counter('vnetwork.fetch.cache_hit').inc();

          logger.trace('Cache hit', { url });

          this.inFlight.delete(requestId);

          return new Response(cached.body, {
            status: cached.status,
            headers: cached.headers,
          });
        }

        metrics.counter('vnetwork.fetch.cache_miss').inc();

        // Pass through to real fetch
        const response = await fetch(input, init);

        this.inFlight.delete(requestId);
        this.cacheResponse(url, response.clone());

        return response;
      } catch (error) {
        this.inFlight.delete(requestId);
        metrics.counter('vnetwork.fetch.errors').inc();

        logger.error('Fetch failed', error, { url, method });
        throw error;
      }
    }) as Promise<Response>;
  }

  mock(pattern: string | RegExp, handler: MockHandler): void {
    this.mocks.set(pattern, handler);

    logger.info('Mock registered', {
      operation: 'mock',
      pattern: pattern.toString(),
    });

    metrics.counter('vnetwork.mocks.registered').inc();
  }

  clearMocks(): void {
    const count = this.mocks.size;
    this.mocks.clear();

    logger.info('Mocks cleared', {
      operation: 'clearMocks',
      count,
    });
  }

  private findMock(url: string): MockHandler | null {
    for (const [pattern, handler] of this.mocks) {
      if (typeof pattern === 'string') {
        if (url === pattern || url.includes(pattern)) {
          return handler;
        }
      } else if (pattern.test(url)) {
        return handler;
      }
    }

    return null;
  }

  private async executeMock(handler: MockHandler, request: Request): Promise<Response> {
    const result = await handler(request);

    if (result instanceof Response) {
      return result;
    }

    // Convert MockResponse to Response
    const mockResp = result as MockResponse;
    const body = typeof mockResp.body === 'object' ? JSON.stringify(mockResp.body) : mockResp.body;

    // Simulate delay if specified
    if (mockResp.delay) {
      await new Promise(resolve => setTimeout(resolve, mockResp.delay));
    }

    return new Response(body, {
      status: mockResp.status || 200,
      statusText: mockResp.statusText || 'OK',
      headers: mockResp.headers,
    });
  }

  private cacheResponse(url: string, response: Response): void {
    const cached: CachedResponse = {
      url,
      status: response.status,
      headers: this.responseHeadersToRecord(response.headers),
      body: '', // Would need to read body
      timestamp: this.getCurrentTimestamp(),
    };

    this.cache.set(url, cached);
    metrics.counter('vnetwork.responses.cached').inc();
  }

  private extractHeaders(init?: RequestInit): Record<string, string> {
    const headers: Record<string, string> = {};

    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (Array.isArray(init.headers)) {
        for (const [key, value] of init.headers) {
          headers[key] = value;
        }
      } else {
        Object.assign(headers, init.headers);
      }
    }

    return headers;
  }

  private responseHeadersToRecord(headers: Headers): Record<string, string> {
    const record: Record<string, string> = {};
    headers.forEach((value, key) => {
      record[key] = value;
    });
    return record;
  }

  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private getCurrentTimestamp(): VirtualTimestamp {
    return {
      value: Date.now(),
      sequence: 0,
    };
  }

  getState(): Partial<NetworkState> {
    return {
      inFlightRequests: Array.from(this.inFlight.values()),
      cache: Array.from(this.cache.values()),
      mocks: Array.from(this.mocks.entries()).map(([pattern, _]) => ({
        pattern: pattern.toString(),
        response: {},
      })),
    };
  }
}

/**
 * Virtual network implementation
 */
export class VirtualNetworkImpl implements VirtualNetwork {
  fetch: VirtualFetch;
  xhr: any; // Stub
  ws: any; // Stub

  constructor() {
    this.fetch = new VirtualFetchImpl();
    this.xhr = null; // TODO: Implement
    this.ws = null; // TODO: Implement

    logger.info('Virtual network initialized');
  }

  getState(): NetworkState {
    const fetchState = this.fetch.getState?.() as NetworkState;
    return fetchState || {
      inFlightRequests: [],
      cache: [],
      mocks: [],
    };
  }

  setState(state: NetworkState): void {
    // TODO: Restore network state
    logger.info('Network state restored', {
      operation: 'setState',
      inFlightRequests: state.inFlightRequests.length,
      cachedResponses: state.cache.length,
    });
  }

  /**
   * Clear all caches and mocks
   */
  clear(): void {
    this.fetch.clearMocks();
    logger.info('Virtual network cleared');
  }
}

/**
 * Create virtual network
 */
export function createVirtualNetwork(): VirtualNetwork {
  return new VirtualNetworkImpl();
}
