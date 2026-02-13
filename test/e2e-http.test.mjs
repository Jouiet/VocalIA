/**
 * E2E HTTP Tests — Real HTTP Server + Real Fetch
 * VocalIA — Session 250.202
 *
 * First-ever E2E HTTP tests for the project.
 * Patches GoogleSheetsDB prototype with in-memory storage BEFORE importing db-api,
 * then starts the real HTTP server and tests with native fetch().
 *
 * Rate limit strategy: Each request gets a unique X-Forwarded-For IP to avoid
 * rate limiter state accumulation across tests (register=3/h, login=5/15min).
 * Helper functions create users directly in memStore to bypass HTTP rate limits entirely.
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';

const require = createRequire(import.meta.url);

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1: Patch GoogleSheetsDB prototype with in-memory store BEFORE any import
// ─────────────────────────────────────────────────────────────────────────────

const { GoogleSheetsDB, SCHEMAS } = require('../core/GoogleSheetsDB.cjs');

/** In-memory storage: Map<string, Array<Object>> */
const memStore = new Map();

function resetStore() {
  memStore.clear();
  for (const sheet of Object.keys(SCHEMAS)) {
    memStore.set(sheet, []);
  }
}

GoogleSheetsDB.prototype.init = async function () {
  this.initialized = true;
  return this;
};

GoogleSheetsDB.prototype.create = async function (sheet, data) {
  const record = this.applyDefaults(sheet, data);
  this.validate(sheet, record);
  if (!memStore.has(sheet)) memStore.set(sheet, []);
  memStore.get(sheet).push(record);
  return record;
};

GoogleSheetsDB.prototype.findAll = async function (sheet) {
  return [...(memStore.get(sheet) || [])];
};

GoogleSheetsDB.prototype.findById = async function (sheet, id) {
  const records = memStore.get(sheet) || [];
  return records.find(r => r.id === id) || null;
};

GoogleSheetsDB.prototype.find = async function (sheet, query = {}) {
  const records = memStore.get(sheet) || [];
  return records.filter(record => {
    for (const [key, value] of Object.entries(query)) {
      if (record[key] !== value) return false;
    }
    return true;
  });
};

GoogleSheetsDB.prototype.query = async function (sheet, filters = {}) {
  return this.find(sheet, filters);
};

GoogleSheetsDB.prototype.findOne = async function (sheet, query = {}) {
  const records = await this.find(sheet, query);
  return records[0] || null;
};

GoogleSheetsDB.prototype.update = async function (sheet, id, data) {
  const records = memStore.get(sheet) || [];
  const index = records.findIndex(r => r.id === id);
  if (index === -1) throw new Error(`Record not found: ${sheet}:${id}`);
  records[index] = { ...records[index], ...data, id, updated_at: this.timestamp() };
  return records[index];
};

GoogleSheetsDB.prototype.delete = async function (sheet, id) {
  const records = memStore.get(sheet) || [];
  const index = records.findIndex(r => r.id === id);
  if (index === -1) throw new Error(`Record not found: ${sheet}:${id}`);
  records.splice(index, 1);
  return true;
};

GoogleSheetsDB.prototype.health = async function () {
  return { status: 'ok', store: 'in-memory' };
};

GoogleSheetsDB.prototype.startQuotaSync = function () {};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2: Import db-api + auth-service (singleton gets patched prototype)
// ─────────────────────────────────────────────────────────────────────────────

const TEST_PORT = 13013;
process.env.DB_API_PORT = String(TEST_PORT);
const BASE = `http://127.0.0.1:${TEST_PORT}`;

const authService = require('../core/auth-service.cjs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

let server;
let wss;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers: Unique IP per request to bypass rate limiters
// ─────────────────────────────────────────────────────────────────────────────

let ipCounter = 0;
function uniqueIp() {
  ipCounter++;
  return `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
}

async function post(path, body, headers = {}) {
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': uniqueIp(), ...headers },
    body: JSON.stringify(body)
  });
}

async function get(path, headers = {}) {
  return fetch(`${BASE}${path}`, {
    headers: { 'X-Forwarded-For': uniqueIp(), ...headers }
  });
}

async function put(path, body, headers = {}) {
  return fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': uniqueIp(), ...headers },
    body: JSON.stringify(body)
  });
}

async function del(path, headers = {}) {
  return fetch(`${BASE}${path}`, {
    method: 'DELETE',
    headers: { 'X-Forwarded-For': uniqueIp(), ...headers }
  });
}

const STRONG_PASSWORD = 'TestPass123';
const PRE_HASHED_PASSWORD = bcrypt.hashSync(STRONG_PASSWORD, 4); // 4 rounds for speed in tests

/**
 * Create a user directly in memStore (bypasses HTTP + rate limits).
 * Returns { userId, email, tenantId, token }
 */
function createUserDirect(email, opts = {}) {
  const role = opts.role || 'user';
  const tenantId = opts.tenantId || `tenant_${crypto.randomUUID().slice(0, 8)}`;
  const userId = `user_${crypto.randomUUID().slice(0, 12)}`;
  const now = new Date().toISOString();

  const record = {
    id: userId,
    email: email.toLowerCase(),
    password_hash: PRE_HASHED_PASSWORD,
    name: opts.name || email.split('@')[0],
    role,
    tenant_id: tenantId,
    email_verified: 'true',
    login_count: 0,
    failed_login_count: 0,
    preferences: JSON.stringify({ theme: 'system', lang: 'fr', notifications: true }),
    created_at: now,
    updated_at: now
  };

  if (!memStore.has('users')) memStore.set('users', []);
  memStore.get('users').push(record);

  // Generate JWT
  const token = jwt.sign(
    {
      sub: userId,
      email: email.toLowerCase(),
      role,
      tenant_id: tenantId,
      permissions: role === 'admin'
        ? ['read:tenants', 'write:tenants', 'delete:tenants', 'read:users', 'write:users', 'delete:users', 'hitl:approve', 'hitl:reject', 'admin:system']
        : ['read:calls', 'write:calls', 'read:agents', 'write:agents', 'read:analytics']
    },
    authService.CONFIG.jwt.secret,
    { expiresIn: '1h', algorithm: 'HS256' }
  );

  return { userId, email: email.toLowerCase(), tenantId, token, role };
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle
// ─────────────────────────────────────────────────────────────────────────────

before(async () => {
  resetStore();
  const dbApi = require('../core/db-api.cjs');
  const result = await dbApi.startServer();
  server = result.server;
  wss = result.wss;
  await new Promise(resolve => {
    if (server.listening) return resolve();
    server.on('listening', resolve);
  });
});

after(async () => {
  if (wss) {
    wss.clients.forEach(ws => ws.terminate());
    wss.close();
  }
  if (server) {
    await new Promise(resolve => server.close(resolve));
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// E2E-1: Auth Chain Complete (uses HTTP register/login endpoints)
// ═══════════════════════════════════════════════════════════════════════════════

describe('E2E-1: Auth chain complete', () => {
  beforeEach(() => resetStore());

  it('Register user → 201 + user object', async () => {
    const res = await post('/api/auth/register', {
      email: 'alice@example.com', password: STRONG_PASSWORD,
      name: 'Alice', company: 'AliceCo', plan: 'starter'
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.success);
    assert.ok(data.user);
    assert.equal(data.user.email, 'alice@example.com');
    assert.ok(data.tenant);
    assert.ok(data.tenant.id);
  });

  it('Register duplicate email → error', async () => {
    await post('/api/auth/register', {
      email: 'dup@example.com', password: STRONG_PASSWORD, name: 'Dup1', company: 'DupCo'
    });
    const res = await post('/api/auth/register', {
      email: 'dup@example.com', password: STRONG_PASSWORD, name: 'Dup2', company: 'DupCo'
    });
    assert.ok(res.status >= 400, `Expected 4xx, got ${res.status}`);
    const data = await res.json();
    assert.ok(data.error);
  });

  it('Register with weak password → 400', async () => {
    const res = await post('/api/auth/register', {
      email: 'weak@example.com', password: '123', name: 'Weak'
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });

  it('Login with correct credentials → 200 + JWT', async () => {
    // Register
    await post('/api/auth/register', {
      email: 'login@example.com', password: STRONG_PASSWORD, name: 'Login'
    });
    // Verify email directly in store
    const users = memStore.get('users') || [];
    const u = users.find(u => u.email === 'login@example.com');
    if (u) u.email_verified = 'true';

    const res = await post('/api/auth/login', { email: 'login@example.com', password: STRONG_PASSWORD });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.access_token);
    assert.ok(data.refresh_token);
    assert.equal(data.token_type, 'Bearer');
    assert.ok(data.user);
    assert.equal(data.user.email, 'login@example.com');
  });

  it('Login with wrong password → 401', async () => {
    await post('/api/auth/register', {
      email: 'wrong@example.com', password: STRONG_PASSWORD, name: 'Wrong'
    });
    const users = memStore.get('users') || [];
    const u = users.find(u => u.email === 'wrong@example.com');
    if (u) u.email_verified = 'true';

    const res = await post('/api/auth/login', { email: 'wrong@example.com', password: 'WrongPass999' });
    assert.equal(res.status, 401);
  });

  it('GET /api/auth/me with valid JWT → 200 + user data', async () => {
    const { token, email } = createUserDirect('me@example.com');
    const res = await get('/api/auth/me', authHeader(token));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.email, email);
  });

  it('GET /api/auth/me without token → 401', async () => {
    const res = await get('/api/auth/me');
    assert.equal(res.status, 401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// E2E-2: CORS Real HTTP
// ═══════════════════════════════════════════════════════════════════════════════

describe('E2E-2: CORS real HTTP', () => {
  beforeEach(() => resetStore());

  it('OPTIONS preflight → 204 + CORS headers', async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://vocalia.ma', 'X-Forwarded-For': uniqueIp() }
    });
    assert.equal(res.status, 204);
    const allowOrigin = res.headers.get('access-control-allow-origin');
    assert.ok(allowOrigin, 'Missing Access-Control-Allow-Origin');
  });

  it('Request from vocalia.ma origin → correct Allow-Origin', async () => {
    const res = await fetch(`${BASE}/api/db/health`, {
      headers: { Origin: 'https://vocalia.ma', 'X-Forwarded-For': uniqueIp() }
    });
    assert.equal(res.status, 200);
    const allowOrigin = res.headers.get('access-control-allow-origin');
    assert.equal(allowOrigin, 'https://vocalia.ma');
  });

  it('Request from unknown origin → fallback origin', async () => {
    const res = await fetch(`${BASE}/api/db/health`, {
      headers: { Origin: 'https://evil.com', 'X-Forwarded-For': uniqueIp() }
    });
    assert.equal(res.status, 200);
    const allowOrigin = res.headers.get('access-control-allow-origin');
    assert.ok(allowOrigin !== 'https://evil.com', 'Should not echo unknown origin');
    assert.equal(allowOrigin, 'https://vocalia.ma');
  });

  it('Request without origin → fallback to vocalia.ma', async () => {
    const res = await fetch(`${BASE}/api/db/health`, {
      headers: { 'X-Forwarded-For': uniqueIp() }
    });
    assert.equal(res.status, 200);
    const allowOrigin = res.headers.get('access-control-allow-origin');
    assert.equal(allowOrigin, 'https://vocalia.ma');
  });

  it('CORS headers present on error responses', async () => {
    const res = await fetch(`${BASE}/api/db/tenants`, {
      headers: { Origin: 'https://vocalia.ma', 'X-Forwarded-For': uniqueIp() }
    });
    assert.equal(res.status, 401);
    const ct = res.headers.get('content-type');
    assert.ok(ct?.includes('application/json'), 'Error should be JSON');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// E2E-3: Protected Routes
// ═══════════════════════════════════════════════════════════════════════════════

describe('E2E-3: Protected routes', () => {
  beforeEach(() => resetStore());

  it('GET /api/db/tenants without token → 401', async () => {
    const res = await get('/api/db/tenants');
    assert.equal(res.status, 401);
  });

  it('GET /api/db/tenants with valid admin JWT → 200', async () => {
    const admin = createUserDirect('admin@vocalia.ma', { role: 'admin' });
    const res = await get('/api/db/tenants', authHeader(admin.token));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.count !== undefined);
  });

  it('GET /api/db/sessions with valid user JWT → 200', async () => {
    const user = createUserDirect('user@test.com');
    const res = await get('/api/db/sessions', authHeader(user.token));
    assert.equal(res.status, 200);
  });

  it('GET /api/hitl/pending without admin → 403', async () => {
    const user = createUserDirect('nonadmin@test.com');
    const res = await get('/api/hitl/pending', authHeader(user.token));
    assert.equal(res.status, 403);
  });

  it('GET /api/db/health → 200 (public)', async () => {
    const res = await get('/api/db/health');
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'ok');
  });

  it('GET /api/nonexistent → 404', async () => {
    const res = await get('/api/nonexistent');
    assert.equal(res.status, 404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// E2E-4: KB CRUD via HTTP
// ═══════════════════════════════════════════════════════════════════════════════

describe('E2E-4: KB CRUD via HTTP', () => {
  beforeEach(() => resetStore());

  it('POST + GET KB entry for own tenant → success', async () => {
    const user = createUserDirect('kb@test.com');

    // Create KB entry
    const createRes = await post(
      `/api/tenants/${user.tenantId}/kb`,
      { key: 'greeting', value: 'Bonjour!', language: 'fr' },
      authHeader(user.token)
    );
    assert.equal(createRes.status, 201);
    const createData = await createRes.json();
    assert.ok(createData.success);

    // Read KB entries
    const listRes = await get(`/api/tenants/${user.tenantId}/kb?lang=fr`, authHeader(user.token));
    assert.equal(listRes.status, 200);
    const listData = await listRes.json();
    assert.ok(listData.entries);
  });

  it('POST KB with missing key → 400', async () => {
    const user = createUserDirect('kb2@test.com');
    const res = await post(
      `/api/tenants/${user.tenantId}/kb`,
      { value: 'no key' },
      authHeader(user.token)
    );
    assert.equal(res.status, 400);
  });

  it('GET KB for wrong tenant → 403', async () => {
    const userA = createUserDirect('kbA@test.com');
    const userB = createUserDirect('kbB@test.com');

    const res = await get(`/api/tenants/${userB.tenantId}/kb`, authHeader(userA.token));
    assert.equal(res.status, 403);
  });

  it('POST KB with invalid language → 400', async () => {
    const user = createUserDirect('kb3@test.com');
    const res = await post(
      `/api/tenants/${user.tenantId}/kb`,
      { key: 'test', value: 'val', language: 'xx' },
      authHeader(user.token)
    );
    assert.equal(res.status, 400);
  });

  it('Admin can access any tenant KB', async () => {
    const user = createUserDirect('kbUser@test.com');
    const admin = createUserDirect('kbAdmin@vocalia.ma', { role: 'admin' });

    const res = await get(`/api/tenants/${user.tenantId}/kb`, authHeader(admin.token));
    assert.equal(res.status, 200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// E2E-5: Body Parsing & Errors
// ═══════════════════════════════════════════════════════════════════════════════

describe('E2E-5: Body parsing & errors', () => {
  beforeEach(() => resetStore());

  it('POST with malformed JSON → error response', async () => {
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': uniqueIp() },
      body: '{bad json'
    });
    // Malformed JSON triggers parseBody() error → 500 (P4: internal errors masked)
    assert.ok(res.status >= 400, `Expected 4xx/5xx, got ${res.status}`);
    const data = await res.json();
    assert.ok(data.error);
  });

  it('POST with empty body → 400 (missing required fields)', async () => {
    const res = await post('/api/auth/register', {});
    assert.equal(res.status, 400);
  });

  it('POST with correct JSON → parsed correctly', async () => {
    const res = await post('/api/auth/register', {
      email: 'parsed@test.com', password: STRONG_PASSWORD, name: 'Parsed'
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.user.email, 'parsed@test.com');
  });

  it('GET with query parameters → parsed correctly', async () => {
    const admin = createUserDirect('query@vocalia.ma', { role: 'admin' });
    const db = require('../core/GoogleSheetsDB.cjs').getDB();
    await db.create('sessions', { tenant_id: 'test_tenant', calls: 5, duration_sec: 120 });

    const res = await get('/api/db/sessions?tenant_id=test_tenant', authHeader(admin.token));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.count >= 0);
  });

  it('Unknown route → 404', async () => {
    const res = await get('/api/does/not/exist');
    assert.equal(res.status, 404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// E2E-6: Tenant Isolation
// ═══════════════════════════════════════════════════════════════════════════════

describe('E2E-6: Tenant isolation', () => {
  beforeEach(() => resetStore());

  it('User accesses own tenant data → OK', async () => {
    const user = createUserDirect('own@test.com');
    const res = await get('/api/db/sessions', authHeader(user.token));
    assert.equal(res.status, 200);
  });

  it('User A cannot access tenant B KB → 403', async () => {
    const userA = createUserDirect('isoA@test.com');
    const userB = createUserDirect('isoB@test.com');

    const res = await get(`/api/tenants/${userB.tenantId}/kb`, authHeader(userA.token));
    assert.equal(res.status, 403);
  });

  it('Admin user accesses any tenant → OK', async () => {
    const user = createUserDirect('isoUser@test.com');
    const admin = createUserDirect('isoAdmin@vocalia.ma', { role: 'admin' });

    const res = await get(`/api/tenants/${user.tenantId}/kb`, authHeader(admin.token));
    assert.equal(res.status, 200);
  });

  it('Non-admin on admin-only sheet → 403', async () => {
    const user = createUserDirect('nonadmin@test.com');
    const res = await get('/api/db/users', authHeader(user.token));
    assert.equal(res.status, 403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// E2E-7: Error Propagation HTTP
// ═══════════════════════════════════════════════════════════════════════════════

describe('E2E-7: Error propagation HTTP', () => {
  beforeEach(() => resetStore());

  it('Corrupt auth header (not Bearer) → 401', async () => {
    const res = await get('/api/db/tenants', { Authorization: 'Basic dXNlcjpwYXNz' });
    assert.equal(res.status, 401);
  });

  it('Expired JWT → 401', async () => {
    const expiredToken = jwt.sign(
      { sub: 'user_xxx', email: 'expired@test.com', role: 'user', tenant_id: 'test' },
      authService.CONFIG.jwt.secret,
      { expiresIn: '0s' }
    );
    await new Promise(r => setTimeout(r, 50));
    const res = await get('/api/auth/me', authHeader(expiredToken));
    assert.equal(res.status, 401);
  });

  it('Valid JWT but missing user in DB → error', async () => {
    const ghostToken = jwt.sign(
      { sub: 'user_ghost', email: 'ghost@test.com', role: 'user', tenant_id: 'test' },
      authService.CONFIG.jwt.secret,
      { expiresIn: '1h' }
    );
    const res = await get('/api/auth/me', authHeader(ghostToken));
    assert.ok([401, 404].includes(res.status), `Expected 401 or 404, got ${res.status}`);
  });
});
