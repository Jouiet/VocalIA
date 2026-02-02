'use strict';

/**
 * VocalIA WebSocket Server E2E Test
 * Session 250.52
 */

const http = require('http');
const WebSocket = require('ws');

const API_URL = 'http://localhost:3013';
let accessToken = null;
let testUserId = null;

// Colors for output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function log(msg, type = 'info') {
  const color = type === 'pass' ? GREEN : type === 'fail' ? RED : YELLOW;
  const symbol = type === 'pass' ? '✅' : type === 'fail' ? '❌' : '🔄';
  console.log(`${color}${symbol} ${msg}${RESET}`);
}

// HTTP helper
function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Test cases
const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('   VocalIA WebSocket E2E Tests');
  console.log('='.repeat(60) + '\n');

  // Setup: Create admin user and login
  log('Setting up test environment...');

  try {
    // Register admin user
    const registerRes = await request('POST', '/api/auth/register', {
      email: `wstest-${Date.now()}@test.com`,
      password: 'TestPass123!',
      name: 'WS Test Admin'
    });

    if (registerRes.status === 201 || registerRes.status === 429) {
      log('Test user created or rate limited', 'info');
    }

    // Login
    const loginRes = await request('POST', '/api/auth/login', {
      email: `wstest-${Date.now()}@test.com`,
      password: 'TestPass123!'
    });

    if (loginRes.status === 200 && loginRes.data.access_token) {
      accessToken = loginRes.data.access_token;
      testUserId = loginRes.data.user?.id;
      log('Logged in successfully', 'pass');
    } else {
      // Try with existing admin credentials from .env
      log('Using default test credentials...', 'info');
      // We'll test without auth for now - connection should be rejected
    }
  } catch (e) {
    log('Setup error: ' + e.message, 'info');
  }

  // Run tests
  for (const { name, fn } of tests) {
    try {
      await fn();
      log(name, 'pass');
      passed++;
    } catch (error) {
      log(`${name}: ${error.message}`, 'fail');
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`   Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

// ==================== WEBSOCKET TESTS ====================

test('WS: Connection without token should be rejected', async () => {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://localhost:3013/ws');

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Timeout - connection not rejected'));
    }, 3000);

    ws.on('close', (code, reason) => {
      clearTimeout(timeout);
      if (code === 4001) {
        resolve();
      } else {
        reject(new Error(`Expected close code 4001, got ${code}`));
      }
    });

    ws.on('error', () => {
      clearTimeout(timeout);
      resolve(); // Connection refused is also acceptable
    });
  });
});

test('WS: Connection with invalid token should be rejected', async () => {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://localhost:3013/ws?token=invalid_token');

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Timeout - connection not rejected'));
    }, 3000);

    ws.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 4002) {
        resolve();
      } else {
        reject(new Error(`Expected close code 4002, got ${code}`));
      }
    });

    ws.on('error', () => {
      clearTimeout(timeout);
      resolve(); // Connection error is acceptable
    });
  });
});

test('WS: Connection with valid token should succeed', async () => {
  if (!accessToken) {
    throw new Error('No access token available - skipping');
  }

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:3013/ws?token=${accessToken}`);

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Timeout waiting for connection'));
    }, 5000);

    ws.on('message', (raw) => {
      clearTimeout(timeout);
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'connected' && msg.user) {
        ws.close();
        resolve();
      } else {
        ws.close();
        reject(new Error('Unexpected welcome message'));
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
});

test('WS: Subscribe to channel', async () => {
  if (!accessToken) {
    throw new Error('No access token available - skipping');
  }

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:3013/ws?token=${accessToken}`);

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Timeout'));
    }, 5000);

    let gotConnected = false;

    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'connected') {
        gotConnected = true;
        ws.send(JSON.stringify({ type: 'subscribe', channels: ['tenants', 'sessions'] }));
      }

      if (msg.type === 'subscribed' && gotConnected) {
        clearTimeout(timeout);
        if (msg.channels.includes('tenants') && msg.channels.includes('sessions')) {
          ws.close();
          resolve();
        } else {
          ws.close();
          reject(new Error('Subscription failed'));
        }
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
});

test('WS: Ping-pong heartbeat', async () => {
  if (!accessToken) {
    throw new Error('No access token available - skipping');
  }

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:3013/ws?token=${accessToken}`);

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Timeout'));
    }, 5000);

    let gotConnected = false;

    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'connected') {
        gotConnected = true;
        ws.send(JSON.stringify({ type: 'ping' }));
      }

      if (msg.type === 'pong' && gotConnected) {
        clearTimeout(timeout);
        ws.close();
        resolve();
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
});

// Run all tests
runTests();
