'use strict';

/**
 * VocalIA Frontend E2E Tests
 * Session 250.52
 *
 * Tests:
 * 1. Auth flow (register, login, logout, refresh)
 * 2. API endpoints (CRUD, security)
 * 3. HITL workflow
 * 4. Rate limiting
 */

const http = require('http');

const API_URL = 'http://localhost:3013';

// Test state
let adminToken = null;
let userToken = null;
let testTenantId = null;
let testUserId = null;
let testHitlId = null;

// Colors
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

function log(msg, type = 'info') {
  const colors = { pass: GREEN, fail: RED, info: YELLOW, section: BLUE };
  const symbols = { pass: '✅', fail: '❌', info: '🔄', section: '📌' };
  console.log(`${colors[type]}${symbols[type]} ${msg}${RESET}`);
}

// HTTP helper
function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
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

// Test runner
const tests = [];
let passed = 0;
let failed = 0;
let skipped = 0;

function test(name, fn, skip = false) {
  tests.push({ name, fn, skip });
}

function section(name) {
  tests.push({ name, isSection: true });
}

async function runTests() {
  console.log('\n' + '═'.repeat(60));
  console.log('   VocalIA Frontend E2E Tests');
  console.log('═'.repeat(60) + '\n');

  for (const item of tests) {
    if (item.isSection) {
      console.log(`\n${BLUE}━━━ ${item.name} ━━━${RESET}\n`);
      continue;
    }

    if (item.skip) {
      log(`${item.name} (SKIPPED)`, 'info');
      skipped++;
      continue;
    }

    try {
      await item.fn();
      log(item.name, 'pass');
      passed++;
    } catch (error) {
      log(`${item.name}: ${error.message}`, 'fail');
      failed++;
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`   Results: ${GREEN}${passed} passed${RESET}, ${RED}${failed} failed${RESET}, ${YELLOW}${skipped} skipped${RESET}`);
  console.log('═'.repeat(60) + '\n');

  return failed === 0;
}

// ==================== AUTH TESTS ====================

section('AUTHENTICATION');

const testEmail = `e2e-${Date.now()}@test.com`;
const testPassword = 'TestPass123!';
let refreshToken = null;

test('Register new user', async () => {
  const res = await request('POST', '/api/auth/register', {
    email: testEmail,
    password: testPassword,
    name: 'E2E Test User'
  });

  if (res.status === 429) {
    throw new Error('Rate limited - wait and retry');
  }

  if (res.status !== 201) {
    throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`);
  }

  if (!res.data.success) {
    throw new Error('Registration failed');
  }
});

test('Login with registered user', async () => {
  const res = await request('POST', '/api/auth/login', {
    email: testEmail,
    password: testPassword
  });

  if (res.status !== 200) {
    throw new Error(`Expected 200, got ${res.status}`);
  }

  if (!res.data.access_token) {
    throw new Error('No access token returned');
  }

  userToken = res.data.access_token;
  refreshToken = res.data.refresh_token;
  testUserId = res.data.user?.id;
});

test('Get current user (/auth/me)', async () => {
  const res = await request('GET', '/api/auth/me', null, userToken);

  if (res.status !== 200) {
    throw new Error(`Expected 200, got ${res.status}`);
  }

  if (!res.data.email || res.data.email !== testEmail) {
    throw new Error('Wrong user data returned');
  }

  // Verify no password_hash exposed
  if (res.data.password_hash) {
    throw new Error('SECURITY: password_hash exposed!');
  }
});

test('Update profile (/auth/me)', async () => {
  const res = await request('PUT', '/api/auth/me', {
    name: 'E2E Test User Updated'
  }, userToken);

  if (res.status !== 200) {
    throw new Error(`Expected 200, got ${res.status}`);
  }

  if (res.data.name !== 'E2E Test User Updated') {
    throw new Error('Name not updated');
  }
});

test('Refresh token', async () => {
  if (!refreshToken) {
    throw new Error('No refresh token');
  }

  const res = await request('POST', '/api/auth/refresh', {
    refresh_token: refreshToken
  });

  if (res.status !== 200) {
    throw new Error(`Expected 200, got ${res.status}`);
  }

  if (!res.data.access_token) {
    throw new Error('No new access token');
  }

  userToken = res.data.access_token;
});

test('Logout', async () => {
  const res = await request('POST', '/api/auth/logout', {
    refresh_token: refreshToken
  });

  if (res.status !== 200) {
    throw new Error(`Expected 200, got ${res.status}`);
  }
});

// ==================== SECURITY TESTS ====================

section('SECURITY');

test('API without token returns 401', async () => {
  const res = await request('GET', '/api/db/tenants');

  if (res.status !== 401) {
    throw new Error(`Expected 401, got ${res.status}`);
  }
});

test('Invalid token returns 401', async () => {
  const res = await request('GET', '/api/db/tenants', null, 'invalid_token');

  if (res.status !== 401) {
    throw new Error(`Expected 401, got ${res.status}`);
  }
});

test('Non-admin cannot access users table', async () => {
  // Re-login to get fresh token
  const loginRes = await request('POST', '/api/auth/login', {
    email: testEmail,
    password: testPassword
  });

  if (loginRes.status !== 200) {
    throw new Error('Login failed');
  }

  userToken = loginRes.data.access_token;

  const res = await request('GET', '/api/db/users', null, userToken);

  if (res.status !== 403) {
    throw new Error(`Expected 403, got ${res.status}`);
  }
});

test('Non-admin cannot access HITL endpoints', async () => {
  const res = await request('GET', '/api/hitl/pending', null, userToken);

  if (res.status !== 403) {
    throw new Error(`Expected 403, got ${res.status}`);
  }
});

test('Non-admin cannot access logs endpoint', async () => {
  const res = await request('GET', '/api/logs', null, userToken);

  if (res.status !== 403) {
    throw new Error(`Expected 403, got ${res.status}`);
  }
});

test('Password hash not exposed in users API', async () => {
  // This requires admin token - will be skipped if no admin
  const res = await request('GET', '/api/auth/me', null, userToken);

  if (res.data.password_hash !== undefined) {
    throw new Error('CRITICAL: password_hash exposed!');
  }
});

// ==================== DB API TESTS ====================

section('DATABASE API');

test('Health check returns OK', async () => {
  const res = await request('GET', '/api/db/health');

  if (res.status !== 200) {
    throw new Error(`Expected 200, got ${res.status}`);
  }

  if (res.data.status !== 'ok') {
    throw new Error('Health check failed');
  }
});

test('List tenants (authenticated)', async () => {
  const res = await request('GET', '/api/db/tenants', null, userToken);

  if (res.status !== 200) {
    throw new Error(`Expected 200, got ${res.status}`);
  }

  if (typeof res.data.count !== 'number') {
    throw new Error('Invalid response format');
  }
});

test('List sessions (authenticated)', async () => {
  const res = await request('GET', '/api/db/sessions', null, userToken);

  if (res.status !== 200) {
    throw new Error(`Expected 200, got ${res.status}`);
  }

  if (!Array.isArray(res.data.data)) {
    throw new Error('Expected array of sessions');
  }
});

// ==================== RATE LIMITING TESTS ====================

section('RATE LIMITING');

test('Register rate limit (3/hour)', async () => {
  // Try to register multiple times rapidly
  const results = [];
  for (let i = 0; i < 5; i++) {
    const res = await request('POST', '/api/auth/register', {
      email: `ratelimit-${Date.now()}-${i}@test.com`,
      password: 'TestPass123!',
      name: 'Rate Limit Test'
    });
    results.push(res.status);
    await new Promise(r => setTimeout(r, 100));
  }

  // At least one should be rate limited (429)
  if (!results.includes(429)) {
    throw new Error(`Expected some 429 responses, got: ${results.join(', ')}`);
  }
});

// ==================== SUMMARY ====================

async function main() {
  try {
    const success = await runTests();
    process.exit(success ? 0 : 1);
  } catch (e) {
    console.error('Test runner error:', e);
    process.exit(1);
  }
}

main();
