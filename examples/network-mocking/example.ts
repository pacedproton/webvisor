/**
 * Example: Network Mocking with WebVisor
 * Demonstrates how to mock network requests for testing
 */

import { WebVisor } from '../../src/index.js';
import { createVirtualNetwork } from '../../src/core/virtual-platform/virtual-network.js';

console.log('=== WebVisor Network Mocking Example ===\n');

// Create virtual network
const vNetwork = createVirtualNetwork();

console.log('1. Setting up network mocks\n');

// Mock successful API response
vNetwork.fetch.mock('https://api.example.com/users', (request) => {
  console.log('  ✓ Mock intercepted:', request.url);

  return {
    status: 200,
    body: {
      users: [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ],
    },
  };
});

// Mock error response
vNetwork.fetch.mock('https://api.example.com/error', () => {
  return {
    status: 500,
    body: { error: 'Internal Server Error' },
  };
});

// Mock with delay to simulate slow network
vNetwork.fetch.mock('https://api.example.com/slow', () => {
  return {
    status: 200,
    body: { message: 'This was slow' },
    delay: 1000, // 1 second delay
  };
});

// Mock with regex pattern
vNetwork.fetch.mock(/\/api\/posts\/\d+/, (request) => {
  const postId = request.url.match(/\/api\/posts\/(\d+)/)?.[1];

  return {
    status: 200,
    body: {
      id: postId,
      title: `Post ${postId}`,
      content: 'Lorem ipsum dolor sit amet',
    },
  };
});

console.log('  ✓ 4 mocks registered\n');

console.log('2. Making mocked requests\n');

// Test successful response
const testSuccessful = async () => {
  const response = await vNetwork.fetch.fetch('https://api.example.com/users');
  const data = await response.json();

  console.log('  Request 1: GET /users');
  console.log('  Status:', response.status);
  console.log('  Data:', JSON.stringify(data));
};

// Test error response
const testError = async () => {
  const response = await vNetwork.fetch.fetch('https://api.example.com/error');
  const data = await response.json();

  console.log('\n  Request 2: GET /error');
  console.log('  Status:', response.status);
  console.log('  Error:', JSON.stringify(data));
};

// Test regex pattern match
const testPattern = async () => {
  const response = await vNetwork.fetch.fetch('https://api.example.com/api/posts/42');
  const data = await response.json();

  console.log('\n  Request 3: GET /api/posts/42');
  console.log('  Status:', response.status);
  console.log('  Post:', JSON.stringify(data));
};

// Test slow request
const testSlow = async () => {
  console.log('\n  Request 4: GET /slow (with 1s delay)');
  const start = Date.now();

  const response = await vNetwork.fetch.fetch('https://api.example.com/slow');
  const data = await response.json();

  const duration = Date.now() - start;

  console.log('  Status:', response.status);
  console.log('  Duration:', duration + 'ms');
  console.log('  Message:', JSON.stringify(data));
};

// Run all tests
(async () => {
  await testSuccessful();
  await testError();
  await testPattern();
  await testSlow();

  console.log('\n3. Network state inspection\n');

  const state = vNetwork.getState();
  console.log('  Cached responses:', state.cache.length);
  console.log('  Active mocks:', state.mocks.length);

  console.log('\n4. Clearing mocks\n');

  vNetwork.fetch.clearMocks();
  console.log('  ✓ All mocks cleared');

  console.log('\n=== Example Complete ===');
})();
