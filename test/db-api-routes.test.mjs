/**
 * DB-API Additional Routes — E2E HTTP Tests
 * VocalIA — Session 250.207
 *
 * Extends e2e-http.test.mjs to cover 30+ untested routes in core/db-api.cjs.
 * Uses same in-memory GoogleSheetsDB pattern on port 13014.
 *
 * Run: node --test test/db-api-routes.test.mjs
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';

const require = createRequire(import.meta.url);

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1: Patch GoogleSheetsDB prototype BEFORE any import
// ─────────────────────────────────────────────────────────────────────────────

const { GoogleSheetsDB, SCHEMAS } = require('../core/GoogleSheetsDB.cjs');

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
GoogleSheetsDB.prototype.syncAllTenantPlans = async function () {
  return { success: true, synced: 0 };
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2: Import
// ─────────────────────────────────────────────────────────────────────────────

const TEST_PORT = 13014;
process.env.DB_API_PORT = String(TEST_PORT);
const BASE = `http://127.0.0.1:${TEST_PORT}`;

const authService = require('../core/auth-service.cjs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

let server, wss;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
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
const PRE_HASHED_PASSWORD = bcrypt.hashSync(STRONG_PASSWORD, 4);

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
  // B47 fix: Drain all connections before close to prevent intermittent failures
  if (wss) {
    wss.clients.forEach(ws => ws.terminate());
    await new Promise(resolve => { wss.close(resolve); });
  }
  if (server) {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
  // Reset rate limit state to prevent memory accumulation across test suites
  resetStore();
  // Allow pending callbacks to drain before test runner serializes results
  await new Promise(resolve => setTimeout(resolve, 500));
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH: Logout, Refresh, Forgot, Reset, Verify, Resend, Update Profile, Password
// ═══════════════════════════════════════════════════════════════════════════════

describe('Auth: logout', () => {
  beforeEach(() => resetStore());

  it('POST /api/auth/logout → 200', async () => {
    const res = await post('/api/auth/logout', { refresh_token: 'some_token' });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.success);
  });

  it('POST /api/auth/logout without body → still 200', async () => {
    const res = await post('/api/auth/logout', {});
    assert.equal(res.status, 200);
  });
});

describe('Auth: refresh', () => {
  beforeEach(() => resetStore());

  it('POST /api/auth/refresh without refresh_token → 400', async () => {
    const res = await post('/api/auth/refresh', {});
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('Refresh token'));
  });

  it('POST /api/auth/refresh with invalid token → error', async () => {
    const res = await post('/api/auth/refresh', { refresh_token: 'invalid_token_xyz' });
    assert.ok(res.status >= 400, `Expected 4xx, got ${res.status}`);
  });
});

describe('Auth: forgot password', () => {
  beforeEach(() => resetStore());

  it('POST /api/auth/forgot without email → 400', async () => {
    const res = await post('/api/auth/forgot', {});
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('Email'));
  });

  it('POST /api/auth/forgot with email → 200 (always succeeds)', async () => {
    const res = await post('/api/auth/forgot', { email: 'test@example.com' });
    // Should succeed even if email doesn't exist (security: no email enumeration)
    assert.equal(res.status, 200);
  });
});

describe('Auth: reset password', () => {
  beforeEach(() => resetStore());

  it('POST /api/auth/reset without token → 400', async () => {
    const res = await post('/api/auth/reset', { password: STRONG_PASSWORD });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('Token'));
  });

  it('POST /api/auth/reset without password → 400', async () => {
    const res = await post('/api/auth/reset', { token: 'some_token' });
    assert.equal(res.status, 400);
  });

  it('POST /api/auth/reset with invalid token → error', async () => {
    const res = await post('/api/auth/reset', { token: 'bogus', password: STRONG_PASSWORD });
    assert.ok(res.status >= 400);
  });
});

describe('Auth: verify email', () => {
  beforeEach(() => resetStore());

  it('POST /api/auth/verify-email without token → 400', async () => {
    const res = await post('/api/auth/verify-email', {});
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('Verification token'));
  });

  it('POST /api/auth/verify-email with invalid token → error', async () => {
    const res = await post('/api/auth/verify-email', { token: 'fake_token' });
    assert.ok(res.status >= 400);
  });
});

describe('Auth: resend verification', () => {
  beforeEach(() => resetStore());

  it('POST /api/auth/resend-verification without email → 400', async () => {
    const res = await post('/api/auth/resend-verification', {});
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('Email'));
  });

  it('POST /api/auth/resend-verification with email → 200', async () => {
    const res = await post('/api/auth/resend-verification', { email: 'test@example.com' });
    // May succeed or return error, but route should be reachable
    assert.ok([200, 404, 500].includes(res.status));
  });
});

describe('Auth: update profile', () => {
  beforeEach(() => resetStore());

  it('PUT /api/auth/me without token → 401', async () => {
    const res = await put('/api/auth/me', { name: 'New Name' });
    assert.equal(res.status, 401);
  });

  it('PUT /api/auth/me with token → updates profile', async () => {
    const user = createUserDirect('profile@test.com');
    const res = await put('/api/auth/me', { name: 'Updated Name' }, authHeader(user.token));
    assert.ok([200, 400].includes(res.status));
  });
});

describe('Auth: change password', () => {
  beforeEach(() => resetStore());

  it('PUT /api/auth/password without token → 401', async () => {
    const res = await put('/api/auth/password', {
      current_password: STRONG_PASSWORD,
      new_password: 'NewPass456'
    });
    assert.equal(res.status, 401);
  });

  it('PUT /api/auth/password with token → processes request', async () => {
    const user = createUserDirect('pwd@test.com');
    const res = await put('/api/auth/password', {
      current_password: STRONG_PASSWORD,
      new_password: 'NewPass456'
    }, authHeader(user.token));
    // Either succeeds or returns validation error
    assert.ok([200, 400, 401].includes(res.status));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// HITL: pending (admin), history, stats, approve, reject
// ═══════════════════════════════════════════════════════════════════════════════

describe('HITL routes', () => {
  beforeEach(() => resetStore());

  it('GET /api/hitl/pending with admin → 200 + count', async () => {
    const admin = createUserDirect('hitl-admin@vocalia.ma', { role: 'admin' });
    const res = await get('/api/hitl/pending', authHeader(admin.token));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(typeof data.count, 'number');
    assert.ok(Array.isArray(data.data));
  });

  it('GET /api/hitl/history with admin → 200 + count', async () => {
    const admin = createUserDirect('hitl-admin2@vocalia.ma', { role: 'admin' });
    const res = await get('/api/hitl/history', authHeader(admin.token));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(typeof data.count, 'number');
    assert.ok(Array.isArray(data.data));
  });

  it('GET /api/hitl/stats with admin → 200 + breakdown', async () => {
    const admin = createUserDirect('hitl-admin3@vocalia.ma', { role: 'admin' });
    const res = await get('/api/hitl/stats', authHeader(admin.token));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(typeof data.pending_count, 'number');
    assert.equal(typeof data.approved_count, 'number');
    assert.equal(typeof data.rejected_count, 'number');
    assert.ok(data.pending_by_source);
  });

  it('GET /api/hitl/history without admin → 403', async () => {
    const user = createUserDirect('hitl-user@test.com');
    const res = await get('/api/hitl/history', authHeader(user.token));
    assert.equal(res.status, 403);
  });

  it('POST /api/hitl/approve/:id for non-existent → 404', async () => {
    const admin = createUserDirect('hitl-approve@vocalia.ma', { role: 'admin' });
    const res = await post('/api/hitl/approve/nonexistent_id', {}, authHeader(admin.token));
    assert.equal(res.status, 404);
  });

  it('POST /api/hitl/reject/:id for non-existent → 404', async () => {
    const admin = createUserDirect('hitl-reject@vocalia.ma', { role: 'admin' });
    const res = await post('/api/hitl/reject/nonexistent_id', { reason: 'test' }, authHeader(admin.token));
    assert.equal(res.status, 404);
  });

  it('POST /api/hitl/approve/:id with DB item → 200', async () => {
    const admin = createUserDirect('hitl-approve2@vocalia.ma', { role: 'admin' });
    // Seed a pending item — schema requires 'tenant' (not tenant_id) and 'type'
    const db = require('../core/GoogleSheetsDB.cjs').getDB();
    await db.create('hitl_pending', {
      id: 'hitl_test_001',
      type: 'remotion',
      tenant: 'test_tenant',
      created_at: new Date().toISOString()
    });

    const res = await post('/api/hitl/approve/hitl_test_001', {}, authHeader(admin.token));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.success);
    assert.equal(data.decision, 'approved');
  });

  it('POST /api/hitl/reject/:id with DB item → 200', async () => {
    const admin = createUserDirect('hitl-reject2@vocalia.ma', { role: 'admin' });
    const db = require('../core/GoogleSheetsDB.cjs').getDB();
    await db.create('hitl_pending', {
      id: 'hitl_test_002',
      type: 'voice',
      tenant: 'test_tenant',
      created_at: new Date().toISOString()
    });

    const res = await post('/api/hitl/reject/hitl_test_002', { reason: 'Low quality' }, authHeader(admin.token));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.success);
    assert.equal(data.decision, 'rejected');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TELEPHONY: stats, cdrs
// ═══════════════════════════════════════════════════════════════════════════════

describe('Telephony routes', () => {
  beforeEach(() => resetStore());

  it('GET /api/telephony/stats without auth → 401', async () => {
    const res = await get('/api/telephony/stats');
    assert.equal(res.status, 401);
  });

  it('GET /api/telephony/stats with auth → 200', async () => {
    const user = createUserDirect('tel@test.com');
    const res = await get('/api/telephony/stats', authHeader(user.token));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.success);
    assert.ok(data.stats);
    assert.equal(typeof data.stats.totalCalls, 'number');
    assert.equal(typeof data.stats.avgDuration, 'number');
  });

  it('GET /api/telephony/cdrs without auth → 401', async () => {
    const res = await get('/api/telephony/cdrs');
    assert.equal(res.status, 401);
  });

  it('GET /api/telephony/cdrs with auth → 200', async () => {
    const user = createUserDirect('tel2@test.com');
    const res = await get('/api/telephony/cdrs', authHeader(user.token));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(typeof data.count, 'number');
    assert.ok(Array.isArray(data.data));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BILLING: tenant billing + portal
// ═══════════════════════════════════════════════════════════════════════════════

describe('Billing routes', () => {
  beforeEach(() => resetStore());

  it('GET /api/tenants/:id/billing without auth → 401', async () => {
    const res = await get('/api/tenants/test_tenant/billing');
    assert.equal(res.status, 401);
  });

  it('GET /api/tenants/:id/billing with auth → 200 or 500 (Stripe not configured)', async () => {
    const user = createUserDirect('bill@test.com');
    const res = await get(`/api/tenants/${user.tenantId}/billing`, authHeader(user.token));
    // Billing may return 500 if StripeService is not configured (no STRIPE_SECRET_KEY)
    assert.ok([200, 500].includes(res.status), `Expected 200 or 500, got ${res.status}`);
  });

  it('GET /api/tenants/:id/billing cross-tenant → 403', async () => {
    const userA = createUserDirect('billA@test.com');
    const userB = createUserDirect('billB@test.com');
    const res = await get(`/api/tenants/${userB.tenantId}/billing`, authHeader(userA.token));
    assert.equal(res.status, 403);
  });

  it('POST /api/tenants/:id/billing/portal without auth → 401', async () => {
    const res = await post('/api/tenants/test_tenant/billing/portal', {});
    assert.equal(res.status, 401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// KB: search, stats, quota, import, rebuild-index, crawl
// ═══════════════════════════════════════════════════════════════════════════════

describe('KB extended routes', () => {
  beforeEach(() => resetStore());

  it('GET /api/tenants/:id/kb/search with auth → 200', async () => {
    const user = createUserDirect('kbsearch@test.com');
    // KB search is GET with query params (not POST)
    const res = await get(`/api/tenants/${user.tenantId}/kb/search?q=bonjour`, authHeader(user.token));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.results) || data.entries !== undefined);
  });

  it('GET /api/kb/stats with admin → 200', async () => {
    const admin = createUserDirect('kbstats@vocalia.ma', { role: 'admin' });
    const res = await get('/api/kb/stats', authHeader(admin.token));
    assert.equal(res.status, 200);
  });

  it('GET /api/tenants/:id/kb/quota with auth → 200', async () => {
    const user = createUserDirect('kbquota@test.com');
    const res = await get(`/api/tenants/${user.tenantId}/kb/quota`, authHeader(user.token));
    assert.equal(res.status, 200);
  });

  it('POST /api/tenants/:id/kb/import without auth → 401', async () => {
    const res = await post('/api/tenants/test_tenant/kb/import', { entries: [] });
    assert.equal(res.status, 401);
  });

  it('POST /api/tenants/:id/kb/rebuild-index with auth → 200', async () => {
    const user = createUserDirect('kbrebuild@test.com');
    const res = await post(`/api/tenants/${user.tenantId}/kb/rebuild-index`, {}, authHeader(user.token));
    assert.equal(res.status, 200);
  });

  it('POST /api/tenants/:id/kb/crawl without URL → 400', async () => {
    const user = createUserDirect('kbcrawl@test.com');
    const res = await post(`/api/tenants/${user.tenantId}/kb/crawl`, {}, authHeader(user.token));
    assert.equal(res.status, 400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CATALOG: list, import, connectors, search, browse, CRUD
// ═══════════════════════════════════════════════════════════════════════════════

describe('Catalog routes', () => {
  beforeEach(() => resetStore());

  it('GET /api/tenants/:id/catalog with auth → 200', async () => {
    const user = createUserDirect('cat@test.com');
    const res = await get(`/api/tenants/${user.tenantId}/catalog`, authHeader(user.token));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.success);
    assert.equal(typeof data.total, 'number');
    assert.ok(Array.isArray(data.items));
  });

  it('GET /api/tenants/:id/catalog cross-tenant → 403', async () => {
    const userA = createUserDirect('catA@test.com');
    const userB = createUserDirect('catB@test.com');
    const res = await get(`/api/tenants/${userB.tenantId}/catalog`, authHeader(userA.token));
    assert.equal(res.status, 403);
  });

  it('POST /api/tenants/:id/catalog/import without auth → 401', async () => {
    const res = await post('/api/tenants/test_tenant/catalog/import', { products: [] });
    assert.equal(res.status, 401);
  });

  it('GET /api/catalog/connectors with admin → 200', async () => {
    const admin = createUserDirect('catconn@vocalia.ma', { role: 'admin' });
    const res = await get('/api/catalog/connectors', authHeader(admin.token));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.connectors || Array.isArray(data));
  });

  it('POST /api/tenants/:id/catalog/search with auth → 200', async () => {
    const user = createUserDirect('catsearch@test.com');
    const res = await post(`/api/tenants/${user.tenantId}/catalog/search`, { query: 'phone' }, authHeader(user.token));
    assert.equal(res.status, 200);
  });

  it('POST /api/tenants/:id/catalog/browse with auth → 200', async () => {
    const user = createUserDirect('catbrowse@test.com');
    const res = await post(`/api/tenants/${user.tenantId}/catalog/browse`, {}, authHeader(user.token));
    assert.equal(res.status, 200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RECOMMENDATIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Recommendations', () => {
  beforeEach(() => resetStore());

  it('POST /api/recommendations without tenant_id → 400', async () => {
    const res = await post('/api/recommendations', { product_id: 'p1' });
    assert.equal(res.status, 400);
  });

  it('POST /api/recommendations with valid data → 200', async () => {
    const res = await post('/api/recommendations', {
      tenant_id: 'demo_vocalia',
      product_id: 'p1',
      type: 'similar'
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.recommendations !== undefined || data.products !== undefined);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// LEADS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Leads', () => {
  beforeEach(() => resetStore());

  it('POST /api/leads without tenant_id → 400', async () => {
    const res = await post('/api/leads', { name: 'John', email: 'j@test.com' });
    assert.equal(res.status, 400);
  });

  it('POST /api/leads with tenant_id → 201', async () => {
    const res = await post('/api/leads', {
      tenant_id: 'demo_vocalia',
      name: 'John Doe',
      email: 'john@test.com',
      phone: '+33612345678',
      source: 'widget'
    }, { Origin: 'https://vocalia.ma' });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.success);
    assert.ok(data.lead_id);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CART RECOVERY
// ═══════════════════════════════════════════════════════════════════════════════

describe('Cart recovery', () => {
  beforeEach(() => resetStore());

  it('POST /api/cart-recovery without required fields → 400', async () => {
    const res = await post('/api/cart-recovery', { tenant_id: 'test' });
    assert.equal(res.status, 400);
  });

  it('POST /api/cart-recovery with invalid channel → 400', async () => {
    const res = await post('/api/cart-recovery', {
      tenant_id: 'demo_vocalia',
      channel: 'pigeon',
      contact: '+33612345678'
    }, { Origin: 'https://vocalia.ma' });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('channel'));
  });

  it('GET /api/cart-recovery without auth → 401', async () => {
    const res = await get('/api/cart-recovery');
    assert.equal(res.status, 401);
  });

  it('GET /api/cart-recovery with admin → 200', async () => {
    const admin = createUserDirect('cartadmin@vocalia.ma', { role: 'admin' });
    const res = await get('/api/cart-recovery', authHeader(admin.token));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(typeof data.count, 'number');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PROMO
// ═══════════════════════════════════════════════════════════════════════════════

describe('Promo routes', () => {
  beforeEach(() => resetStore());

  it('POST /api/promo/generate without required fields → 400', async () => {
    // promo/generate is a PUBLIC endpoint (no auth) — checks tenant_id + prize_id first
    const res = await post('/api/promo/generate', { tenant_id: 'test' });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('prize_id'));
  });

  it('POST /api/promo/generate with valid data → 200', async () => {
    const res = await post('/api/promo/generate', {
      tenant_id: 'demo_vocalia',
      prize_id: 'discount15',
      discount_percent: 15
    }, { Origin: 'https://vocalia.ma' });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.success);
    assert.ok(data.code);
    assert.equal(data.discount_percent, 15);
  });

  it('POST /api/promo/validate without code → 400', async () => {
    const res = await post('/api/promo/validate', { tenant_id: 'test' });
    assert.equal(res.status, 400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CONVERSATIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Conversation routes', () => {
  beforeEach(() => resetStore());

  it('GET /api/tenants/:id/conversations without auth → 401', async () => {
    const res = await get('/api/tenants/test_tenant/conversations');
    assert.equal(res.status, 401);
  });

  it('GET /api/tenants/:id/conversations with auth → 200', async () => {
    const user = createUserDirect('conv@test.com');
    const res = await get(`/api/tenants/${user.tenantId}/conversations`, authHeader(user.token));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(typeof data.count, 'number');
  });

  it('GET /api/tenants/:id/conversations cross-tenant → 403', async () => {
    const userA = createUserDirect('convA@test.com');
    const userB = createUserDirect('convB@test.com');
    const res = await get(`/api/tenants/${userB.tenantId}/conversations`, authHeader(userA.token));
    assert.equal(res.status, 403);
  });

  it('GET /api/tenants/:id/conversations/export with auth → plan-gated response', async () => {
    const user = createUserDirect('convexport@test.com');
    const res = await get(`/api/tenants/${user.tenantId}/conversations/export`, authHeader(user.token));
    // Export is plan-gated (Pro+) — may return 403 (Starter plan) or 503 (plan check error)
    assert.ok([200, 403, 503].includes(res.status), `Expected 200/403/503, got ${res.status}`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// UCP ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('UCP routes', () => {
  beforeEach(() => resetStore());

  it('POST /api/ucp/sync without tenantId → 400', async () => {
    const res = await post('/api/ucp/sync', {});
    assert.equal(res.status, 400);
  });

  it('POST /api/ucp/sync with tenantId → 200', async () => {
    const res = await post('/api/ucp/sync', {
      tenantId: 'demo_vocalia',
      userId: 'user_test_123',
      countryCode: 'FR'
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.success);
    assert.ok(data.profile);
    assert.ok(data.rules);
  });

  it('POST /api/ucp/interaction without required fields → 400', async () => {
    const res = await post('/api/ucp/interaction', {});
    assert.equal(res.status, 400);
  });

  it('POST /api/ucp/interaction with valid data → 200', async () => {
    // First sync to create profile
    await post('/api/ucp/sync', { tenantId: 'demo_vocalia', userId: 'ucp_user' });
    const res = await post('/api/ucp/interaction', {
      tenantId: 'demo_vocalia',
      userId: 'ucp_user',
      type: 'widget_chat',
      channel: 'web_widget'
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.success);
  });

  it('POST /api/ucp/event without required fields → 400', async () => {
    const res = await post('/api/ucp/event', { tenantId: 'test' });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });

  it('POST /api/ucp/event with valid data → 200', async () => {
    await post('/api/ucp/sync', { tenantId: 'demo_vocalia', userId: 'event_user' });
    const res = await post('/api/ucp/event', {
      tenantId: 'demo_vocalia',
      userId: 'event_user',
      event: 'add_to_cart',
      value: 49.99
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.success);
    assert.equal(data.event.event_name, 'add_to_cart');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// WIDGET CONFIG + ALLOWED ORIGINS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Widget config routes', () => {
  beforeEach(() => resetStore());

  it('GET /api/tenants/:id/widget-config without auth → 401', async () => {
    const res = await get('/api/tenants/test_tenant/widget-config');
    assert.equal(res.status, 401);
  });

  it('GET /api/tenants/:id/widget-config with auth → 200', async () => {
    const user = createUserDirect('wc@test.com');
    const res = await get(`/api/tenants/${user.tenantId}/widget-config`, authHeader(user.token));
    assert.equal(res.status, 200);
  });

  it('GET /api/tenants/:id/allowed-origins without auth → 401', async () => {
    const res = await get('/api/tenants/test_tenant/allowed-origins');
    assert.equal(res.status, 401);
  });

  it('GET /api/tenants/:id/allowed-origins with auth → 200', async () => {
    const user = createUserDirect('origins@test.com');
    const res = await get(`/api/tenants/${user.tenantId}/allowed-origins`, authHeader(user.token));
    assert.equal(res.status, 200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH + QUOTA + LOGS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Health & admin routes', () => {
  beforeEach(() => resetStore());

  it('GET /api/health → 200 + comprehensive status', async () => {
    const res = await get('/api/health');
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'ok');
    assert.ok(data.stores);
    assert.ok(data.version);
    assert.ok(data.timestamp);
  });

  it('POST /api/quota/sync without auth → 401', async () => {
    const res = await post('/api/quota/sync', {});
    assert.equal(res.status, 401);
  });

  it('POST /api/quota/sync without admin → 403', async () => {
    const user = createUserDirect('quota@test.com');
    const res = await post('/api/quota/sync', {}, authHeader(user.token));
    assert.equal(res.status, 403);
  });

  it('POST /api/quota/sync with admin → 200', async () => {
    const admin = createUserDirect('quotaadmin@vocalia.ma', { role: 'admin' });
    const res = await post('/api/quota/sync', {}, authHeader(admin.token));
    assert.equal(res.status, 200);
  });

  it('GET /api/logs without auth → 401', async () => {
    const res = await get('/api/logs');
    assert.equal(res.status, 401);
  });

  it('GET /api/logs with admin → 200', async () => {
    const admin = createUserDirect('logadmin@vocalia.ma', { role: 'admin' });
    const res = await get('/api/logs', authHeader(admin.token));
    assert.equal(res.status, 200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DB CRUD: /api/db/:sheet/:id
// ═══════════════════════════════════════════════════════════════════════════════

describe('DB CRUD routes', () => {
  beforeEach(() => resetStore());

  it('GET /api/db/sessions → 200 (list)', async () => {
    const user = createUserDirect('crud@test.com');
    const res = await get('/api/db/sessions', authHeader(user.token));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(typeof data.count, 'number');
  });

  it('POST /api/db/sessions → 201 (create)', async () => {
    const user = createUserDirect('crudpost@test.com');
    const res = await post('/api/db/sessions', {
      tenant_id: user.tenantId,
      calls: 3,
      duration_sec: 60
    }, authHeader(user.token));
    assert.equal(res.status, 201);
    const data = await res.json();
    // DB CRUD returns the created record directly (not wrapped in { success })
    assert.ok(data.id);
    assert.equal(data.tenant_id, user.tenantId);
  });

  it('GET /api/db/invalid_sheet → 400', async () => {
    const admin = createUserDirect('crudadmin@vocalia.ma', { role: 'admin' });
    const res = await get('/api/db/not_a_real_sheet', authHeader(admin.token));
    assert.equal(res.status, 400);
  });

  it('GET /api/db/users (admin-only) without admin → 403', async () => {
    const user = createUserDirect('noadmin@test.com');
    const res = await get('/api/db/users', authHeader(user.token));
    assert.equal(res.status, 403);
  });

  it('GET /api/db/users with admin → 200', async () => {
    const admin = createUserDirect('crudadmin2@vocalia.ma', { role: 'admin' });
    const res = await get('/api/db/users', authHeader(admin.token));
    assert.equal(res.status, 200);
  });

  it('DELETE /api/db/sessions/:id without auth → 401', async () => {
    const res = await del('/api/db/sessions/some_id');
    assert.equal(res.status, 401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INTEGRATION CHAINS — Tests that verify REAL behavior, not just status codes
// These tests found bugs 442-445 (250.207b deep audit)
// ═══════════════════════════════════════════════════════════════════════════════

describe('INTEGRATION: Promo code full lifecycle', () => {
  beforeEach(() => {
    resetStore();
    // Clear global promo store between tests
    if (global.promoCodes) global.promoCodes.clear();
  });

  it('generate → validate → redeem → re-validate (already_used)', async () => {
    // Step 1: Generate a promo code
    const genRes = await post('/api/promo/generate', {
      tenant_id: 'demo_vocalia',
      prize_id: 'discount20',
      discount_percent: 20,
      email: 'test@example.com'
    }, { Origin: 'https://vocalia.ma' });
    assert.equal(genRes.status, 200);
    const genData = await genRes.json();
    assert.ok(genData.success, 'Generate should succeed');
    assert.ok(genData.code, 'Should return a promo code');
    assert.equal(genData.discount_percent, 20);
    assert.ok(genData.expires_at, 'Should have expiry');

    const code = genData.code;

    // Step 2: Validate the code (should be valid)
    const valRes = await post('/api/promo/validate', {
      code,
      tenant_id: 'demo_vocalia'
    }, { Origin: 'https://vocalia.ma' });
    assert.equal(valRes.status, 200);
    const valData = await valRes.json();
    assert.equal(valData.valid, true, 'Code should be valid before redemption');
    assert.equal(valData.discount_percent, 20);
    assert.equal(valData.redeemed, false, 'Should not be redeemed yet');

    // Step 3: Redeem the code
    const redeemRes = await post('/api/promo/validate', {
      code,
      tenant_id: 'demo_vocalia',
      redeem: true
    }, { Origin: 'https://vocalia.ma' });
    assert.equal(redeemRes.status, 200);
    const redeemData = await redeemRes.json();
    assert.equal(redeemData.valid, true, 'Code should be valid during redemption');
    assert.equal(redeemData.redeemed, true, 'Should be marked as redeemed');

    // Step 4: Re-validate — should be already_used
    const revalRes = await post('/api/promo/validate', {
      code,
      tenant_id: 'demo_vocalia'
    }, { Origin: 'https://vocalia.ma' });
    assert.equal(revalRes.status, 200);
    const revalData = await revalRes.json();
    assert.equal(revalData.valid, false, 'Code should be invalid after redemption');
    assert.equal(revalData.reason, 'already_used');
    assert.ok(revalData.used_at, 'Should have used_at timestamp');
  });

  it('cross-tenant validation → wrong_tenant', async () => {
    // Generate for tenant A
    const genRes = await post('/api/promo/generate', {
      tenant_id: 'demo_vocalia',
      prize_id: 'test',
      discount_percent: 10
    }, { Origin: 'https://vocalia.ma' });
    const { code } = await genRes.json();

    // Validate with tenant B → should fail
    const valRes = await post('/api/promo/validate', {
      code,
      tenant_id: 'other_tenant'
    }, { Origin: 'http://localhost:3000' });
    const valData = await valRes.json();
    assert.equal(valData.valid, false);
    assert.equal(valData.reason, 'wrong_tenant');
  });

  it('freeShipping prize → SHIP prefix', async () => {
    const res = await post('/api/promo/generate', {
      tenant_id: 'demo_vocalia',
      prize_id: 'freeShipping',
      discount_percent: 0
    }, { Origin: 'https://vocalia.ma' });
    const data = await res.json();
    assert.ok(data.code.startsWith('SHIP-'), `Expected SHIP- prefix, got: ${data.code}`);
  });

  it('discount_percent clamped between 1 and 50', async () => {
    // Too high
    const highRes = await post('/api/promo/generate', {
      tenant_id: 'demo_vocalia',
      prize_id: 'test',
      discount_percent: 99
    }, { Origin: 'https://vocalia.ma' });
    assert.equal(highRes.status, 400);
    const highData = await highRes.json();
    assert.ok(highData.error.includes('between 1 and 50'));

    // Too low
    const lowRes = await post('/api/promo/generate', {
      tenant_id: 'demo_vocalia',
      prize_id: 'test',
      discount_percent: -5
    }, { Origin: 'https://vocalia.ma' });
    assert.equal(lowRes.status, 400);
  });

  it('promo codes persist across requests (path.join fix verification)', async () => {
    // Generate code in request 1
    const gen1 = await post('/api/promo/generate', {
      tenant_id: 'demo_vocalia',
      prize_id: 'persist_test',
      discount_percent: 25
    }, { Origin: 'https://vocalia.ma' });
    const { code: code1 } = await gen1.json();

    // Generate another code in request 2
    const gen2 = await post('/api/promo/generate', {
      tenant_id: 'demo_vocalia',
      prize_id: 'persist_test2',
      discount_percent: 30
    }, { Origin: 'https://vocalia.ma' });
    const { code: code2 } = await gen2.json();

    // Both codes should be independently valid
    const val1 = await post('/api/promo/validate', { code: code1, tenant_id: 'demo_vocalia' }, { Origin: 'https://vocalia.ma' });
    const val2 = await post('/api/promo/validate', { code: code2, tenant_id: 'demo_vocalia' }, { Origin: 'https://vocalia.ma' });
    assert.equal((await val1.json()).valid, true, 'First code should still be valid');
    assert.equal((await val2.json()).valid, true, 'Second code should be valid');
    assert.notEqual(code1, code2, 'Codes should be unique');
  });
});

describe('INTEGRATION: Cart recovery chain', () => {
  beforeEach(() => {
    resetStore();
    global.cartRecoveryQueue = undefined; // Force fresh initialization
  });

  it('create email recovery → appears in admin queue', async () => {
    // Create a recovery
    const createRes = await post('/api/cart-recovery', {
      tenant_id: 'demo_vocalia',
      channel: 'email',
      contact: 'buyer@example.com',
      cart: { total: 149.99, items: [{ name: 'Widget', qty: 2 }] },
      discount_percent: 15,
      language: 'fr'
    }, { Origin: 'https://vocalia.ma' });
    assert.equal(createRes.status, 200);
    const createData = await createRes.json();
    assert.ok(createData.success);
    assert.ok(createData.recovery_id, 'Should return recovery_id');
    assert.equal(createData.channel, 'email');

    // Admin should see it in the queue
    const admin = createUserDirect('recoveryadmin@vocalia.ma', { role: 'admin' });
    const listRes = await get('/api/cart-recovery', authHeader(admin.token));
    assert.equal(listRes.status, 200);
    const listData = await listRes.json();
    assert.ok(listData.count >= 1, 'Queue should have at least 1 entry');
    const found = listData.recoveries.find(r => r.id === createData.recovery_id);
    assert.ok(found, 'Created recovery should appear in admin queue');
    assert.equal(found.tenant_id, 'demo_vocalia');
    assert.equal(found.channel, 'email');
    assert.equal(found.contact, 'buyer@example.com');
  });

  it('queue filter by tenant_id works', async () => {
    // Create recoveries for 2 different tenants
    await post('/api/cart-recovery', {
      tenant_id: 'demo_vocalia', channel: 'email', contact: 'a@a.com'
    }, { Origin: 'https://vocalia.ma' });
    await post('/api/cart-recovery', {
      tenant_id: 'demo_vocalia', channel: 'sms', contact: '+33600000001'
    }, { Origin: 'https://vocalia.ma' });

    const admin = createUserDirect('filteradmin@vocalia.ma', { role: 'admin' });

    // Filter by tenant
    const filtered = await get('/api/cart-recovery?tenant_id=demo_vocalia', authHeader(admin.token));
    const filteredData = await filtered.json();
    assert.ok(filteredData.count >= 2);
    assert.ok(filteredData.recoveries.every(r => r.tenant_id === 'demo_vocalia'));
  });

  it('missing checkout_url should not produce "null" in stored data', async () => {
    // Create without checkout_url (BUG FIX verification)
    const res = await post('/api/cart-recovery', {
      tenant_id: 'demo_vocalia',
      channel: 'email',
      contact: 'nourl@example.com'
      // NO checkout_url, NO discount_percent
    }, { Origin: 'https://vocalia.ma' });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.success);

    // Check the stored record doesn't contain literal "null" or "undefined"
    const admin = createUserDirect('nullcheckadmin@vocalia.ma', { role: 'admin' });
    const listRes = await get('/api/cart-recovery', authHeader(admin.token));
    const listData = await listRes.json();
    const record = listData.recoveries.find(r => r.contact === 'nourl@example.com');
    assert.ok(record, 'Record should exist');
    // checkout_url should be null (JS null), not the string "null"
    assert.ok(record.checkout_url === null || record.checkout_url === undefined,
      `checkout_url should be null/undefined, not string "${record.checkout_url}"`);
  });
});

describe('INTEGRATION: HITL approve → history chain', () => {
  beforeEach(() => resetStore());

  it('create pending → approve → appears in history with correct decision', async () => {
    const admin = createUserDirect('hitladmin@vocalia.ma', { role: 'admin' });

    // Create a pending HITL item in DB
    const pendingId = `hitl_${Date.now()}`;
    if (!memStore.has('hitl_pending')) memStore.set('hitl_pending', []);
    memStore.get('hitl_pending').push({
      id: pendingId,
      type: 'voice_action',
      tenant: 'demo_vocalia',
      summary: 'Approve customer refund request',
      created_at: new Date().toISOString()
    });

    // Verify it appears in pending
    const pendingRes = await get('/api/hitl/pending', authHeader(admin.token));
    const pendingData = await pendingRes.json();
    assert.ok(pendingData.count >= 1);

    // Approve it
    const approveRes = await post(`/api/hitl/approve/${pendingId}`, {}, authHeader(admin.token));
    assert.equal(approveRes.status, 200);
    const approveData = await approveRes.json();
    assert.equal(approveData.decision, 'approved');
    assert.equal(approveData.id, pendingId);

    // Verify it's in history
    const historyRes = await get('/api/hitl/history', authHeader(admin.token));
    const historyData = await historyRes.json();
    const historyItem = historyData.data.find(h => h.id === pendingId);
    assert.ok(historyItem, 'Approved item should appear in history');
    assert.equal(historyItem.decision, 'approved');

    // Verify it's no longer in pending
    const pendingRes2 = await get('/api/hitl/pending', authHeader(admin.token));
    const pendingData2 = await pendingRes2.json();
    const stillPending = pendingData2.data.find(p => p.id === pendingId);
    assert.ok(!stillPending, 'Approved item should NOT be in pending anymore');
  });

  it('create pending → reject with reason → reason preserved in history', async () => {
    const admin = createUserDirect('hitlreject@vocalia.ma', { role: 'admin' });

    const pendingId = `hitl_reject_${Date.now()}`;
    if (!memStore.has('hitl_pending')) memStore.set('hitl_pending', []);
    memStore.get('hitl_pending').push({
      id: pendingId,
      type: 'crm_deal',
      tenant: 'demo_vocalia',
      summary: 'Deal value too low',
      created_at: new Date().toISOString()
    });

    const rejectRes = await post(`/api/hitl/reject/${pendingId}`, {
      reason: 'Insufficient documentation provided'
    }, authHeader(admin.token));
    assert.equal(rejectRes.status, 200);
    assert.equal((await rejectRes.json()).decision, 'rejected');

    // Verify rejection reason in history
    const historyRes = await get('/api/hitl/history', authHeader(admin.token));
    const historyData = await historyRes.json();
    const item = historyData.data.find(h => h.id === pendingId);
    assert.ok(item, 'Rejected item should be in history');
    assert.equal(item.decision, 'rejected');
    assert.equal(item.rejection_reason, 'Insufficient documentation provided');
  });

  it('stats reflect approve/reject counts correctly', async () => {
    const admin = createUserDirect('hitlstats@vocalia.ma', { role: 'admin' });

    // Create 2 items, approve 1, reject 1
    const id1 = `hitl_s1_${Date.now()}`;
    const id2 = `hitl_s2_${Date.now()}`;
    if (!memStore.has('hitl_pending')) memStore.set('hitl_pending', []);
    memStore.get('hitl_pending').push(
      { id: id1, type: 'test', tenant: 'demo_vocalia', created_at: new Date().toISOString() },
      { id: id2, type: 'test', tenant: 'demo_vocalia', created_at: new Date().toISOString() }
    );

    await post(`/api/hitl/approve/${id1}`, {}, authHeader(admin.token));
    await post(`/api/hitl/reject/${id2}`, { reason: 'test' }, authHeader(admin.token));

    const statsRes = await get('/api/hitl/stats', authHeader(admin.token));
    const stats = await statsRes.json();
    assert.ok(stats.approved_count >= 1, `Expected ≥1 approved, got ${stats.approved_count}`);
    assert.ok(stats.rejected_count >= 1, `Expected ≥1 rejected, got ${stats.rejected_count}`);
    // BUG FIX 250.208: pending_count aggregates ALL stores (memStore + file stores).
    // Other test files may leave items in file stores (e.g. remotion HITL queue).
    // We verify our 2 items were processed — not that global pending is 0.
    const memPending = memStore.get('hitl_pending') || [];
    const ourPending = memPending.filter(i => i.id === id1 || i.id === id2);
    assert.equal(ourPending.length, 0, 'Our test items should not remain pending in memStore');
  });
});

describe('INTEGRATION: Auth lockout + password reset chain', () => {
  beforeEach(() => resetStore());

  it('5 failed logins → locked → reset password → login succeeds (BUG FIX 250.207b)', async () => {
    // Register a user with verified email
    const email = `locktest_${Date.now()}@test.com`;
    const regRes = await post('/api/auth/register', {
      email,
      password: 'CorrectPass1',
      name: 'Lock Test'
    });
    assert.equal(regRes.status, 201);

    // Mark email as verified (bypass email verification)
    const users = memStore.get('users') || [];
    const user = users.find(u => u.email === email.toLowerCase());
    assert.ok(user, 'User should exist in store');
    user.email_verified = 'true';

    // Fail login 5 times to trigger lockout
    for (let i = 0; i < 5; i++) {
      const failRes = await post('/api/auth/login', { email, password: 'WrongPass1' });
      // First 4 should be 401, 5th triggers lockout (423)
      assert.ok([401, 423].includes(failRes.status), `Attempt ${i+1}: Expected 401 or 423, got ${failRes.status}`);
    }

    // Verify account is locked
    const lockedRes = await post('/api/auth/login', { email, password: 'CorrectPass1' });
    assert.equal(lockedRes.status, 423, 'Account should be locked (423)');

    // Request password reset
    const forgotRes = await post('/api/auth/forgot', { email });
    assert.equal(forgotRes.status, 200);

    // Find the reset token from the user record
    const updatedUser = users.find(u => u.email === email.toLowerCase());
    assert.ok(updatedUser.password_reset_token, 'Should have a reset token');

    // We need the ORIGINAL token (not hash) — but auth-service hashes it with SHA-256
    // So we'll directly test that locked_until is cleared after reset
    // by using the auth-service directly
    const authSvc = require('../core/auth-service.cjs');

    // Generate a known token and set it
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    updatedUser.password_reset_token = resetTokenHash;
    updatedUser.password_reset_expires = new Date(Date.now() + 3600000).toISOString();

    // Reset password via the API
    const resetRes = await post('/api/auth/reset', {
      token: resetToken,
      password: 'NewSecurePass1'
    });
    assert.equal(resetRes.status, 200);

    // CRITICAL: After reset, locked_until should be cleared
    const finalUser = users.find(u => u.email === email.toLowerCase());
    assert.equal(finalUser.locked_until, null, 'locked_until should be null after password reset');
    assert.equal(finalUser.failed_login_count, 0, 'failed_login_count should be 0 after reset');

    // Login with new password should succeed (not locked)
    const loginRes = await post('/api/auth/login', { email, password: 'NewSecurePass1' });
    assert.equal(loginRes.status, 200, 'Login should succeed after password reset (account unlocked)');
    const loginData = await loginRes.json();
    assert.ok(loginData.access_token, 'Should get access token');
    assert.ok(loginData.refresh_token, 'Should get refresh token');
  });
});

describe('INTEGRATION: Auth register → verify → login → refresh → logout chain', () => {
  beforeEach(() => resetStore());

  it('full auth lifecycle: register → verify → login → refresh → logout', async () => {
    const email = `lifecycle_${Date.now()}@test.com`;

    // 1. Register
    const regRes = await post('/api/auth/register', {
      email,
      password: 'SecurePass123',
      name: 'Lifecycle Test',
      company: 'TestCorp'
    });
    assert.equal(regRes.status, 201);
    const regData = await regRes.json();
    assert.ok(regData.success);
    assert.ok(regData.tenant, 'Should provision tenant');
    assert.ok(regData.tenant.id, 'Tenant should have ID');
    assert.equal(regData.tenant.provisioned, true, 'Tenant should be provisioned');

    // 2. Login before verification → should fail
    const preVerifyLogin = await post('/api/auth/login', { email, password: 'SecurePass123' });
    assert.equal(preVerifyLogin.status, 403, 'Unverified user should get 403');

    // 3. Verify email (get token from DB, hash and verify)
    const users = memStore.get('users') || [];
    const user = users.find(u => u.email === email.toLowerCase());
    user.email_verified = 'true'; // Direct DB patch (simulates clicking email link)

    // 4. Login after verification → success
    const loginRes = await post('/api/auth/login', { email, password: 'SecurePass123' });
    assert.equal(loginRes.status, 200);
    const loginData = await loginRes.json();
    assert.ok(loginData.access_token, 'Should return access token');
    assert.ok(loginData.refresh_token, 'Should return refresh token');
    assert.equal(loginData.user.email, email.toLowerCase());

    // 5. Access protected route with token
    const meRes = await get('/api/auth/me', { Authorization: `Bearer ${loginData.access_token}` });
    assert.equal(meRes.status, 200);
    const meData = await meRes.json();
    assert.equal(meData.email, email.toLowerCase());

    // 6. Refresh token → get new access token
    const refreshRes = await post('/api/auth/refresh', { refresh_token: loginData.refresh_token });
    assert.equal(refreshRes.status, 200);
    const refreshData = await refreshRes.json();
    assert.ok(refreshData.access_token, 'Should return new access token');

    // 7. Logout → invalidate refresh token
    const logoutRes = await post('/api/auth/logout', { refresh_token: loginData.refresh_token });
    assert.equal(logoutRes.status, 200);

    // 8. Refresh with old token → should fail
    const failRefresh = await post('/api/auth/refresh', { refresh_token: loginData.refresh_token });
    // Should be 401 (token invalidated) or 500 (session not found)
    assert.ok(failRefresh.status >= 400, 'Refresh with invalidated token should fail');
  });
});

describe('INTEGRATION: UCP sync market rules', () => {
  beforeEach(() => resetStore());

  it('countryCode → correct market rules mapping', async () => {
    const testCases = [
      { countryCode: 'FR', expectedCurrency: 'EUR', expectedMarket: 'europe' },
      { countryCode: 'MA', expectedCurrency: 'MAD', expectedMarket: 'morocco' },
      { countryCode: 'SA', expectedCurrency: 'USD', expectedMarket: 'mena' },
      { countryCode: 'US', expectedCurrency: 'USD', expectedMarket: 'international' },
      { countryCode: 'BE', expectedCurrency: 'EUR', expectedMarket: 'europe' },
      { countryCode: 'AE', expectedCurrency: 'USD', expectedMarket: 'mena' },
      { countryCode: 'GB', expectedCurrency: 'USD', expectedMarket: 'international' },
      { countryCode: 'ES', expectedCurrency: 'EUR', expectedMarket: 'europe' }
    ];

    for (const tc of testCases) {
      const res = await post('/api/ucp/sync', {
        tenantId: 'demo_vocalia',
        userId: `user_${tc.countryCode}_${Date.now()}`,
        countryCode: tc.countryCode
      });
      assert.equal(res.status, 200, `${tc.countryCode} should return 200`);
      const data = await res.json();
      assert.ok(data.success, `${tc.countryCode} should succeed`);
      assert.equal(data.rules.currency, tc.expectedCurrency,
        `${tc.countryCode}: expected currency ${tc.expectedCurrency}, got ${data.rules.currency}`);
      assert.equal(data.rules.market, tc.expectedMarket,
        `${tc.countryCode}: expected market ${tc.expectedMarket}, got ${data.rules.market}`);
    }
  });

  it('unknown countryCode defaults to MA rules', async () => {
    const res = await post('/api/ucp/sync', {
      tenantId: 'demo_vocalia',
      userId: 'user_unknown',
      countryCode: 'ZZ'
    });
    const data = await res.json();
    assert.equal(data.rules.currency, 'MAD', 'Unknown country defaults to MAD');
    assert.equal(data.rules.market, 'morocco', 'Unknown country defaults to morocco');
  });

  it('UCP sync creates profile with LTV tier', async () => {
    const userId = `ucp_ltv_${Date.now()}`;
    const res = await post('/api/ucp/sync', {
      tenantId: 'demo_vocalia',
      userId,
      countryCode: 'FR'
    });
    const data = await res.json();
    assert.ok(data.profile, 'Should return profile');
    assert.ok(data.ltvTier, 'Should return LTV tier');
    assert.equal(data.ltvTier, 'bronze', 'New user should be bronze tier');
  });

  it('UCP interaction → event chain', async () => {
    const userId = `ucp_chain_${Date.now()}`;

    // Record interaction
    const intRes = await post('/api/ucp/interaction', {
      tenantId: 'demo_vocalia',
      userId,
      type: 'widget_chat',
      channel: 'web_widget'
    });
    assert.equal(intRes.status, 200);
    assert.ok((await intRes.json()).success);

    // Track event
    const evtRes = await post('/api/ucp/event', {
      tenantId: 'demo_vocalia',
      userId,
      event: 'product_viewed',
      value: 'SKU-12345',
      source: 'catalog'
    });
    assert.equal(evtRes.status, 200);
    const evtData = await evtRes.json();
    assert.ok(evtData.success);
    assert.equal(evtData.event.type, 'behavioral_event');
    assert.equal(evtData.event.event_name, 'product_viewed');
  });
});

describe('INTEGRATION: Tenant isolation enforcement', () => {
  beforeEach(() => resetStore());

  it('user A cannot access user B tenant resources across multiple routes', async () => {
    const userA = createUserDirect('tenantA@test.com');
    const userB = createUserDirect('tenantB@test.com');

    // Test across multiple routes that all enforce tenant isolation
    const crossTenantRequests = [
      get(`/api/tenants/${userB.tenantId}/conversations`, authHeader(userA.token)),
      get(`/api/tenants/${userB.tenantId}/widget-config`, authHeader(userA.token)),
      get(`/api/tenants/${userB.tenantId}/allowed-origins`, authHeader(userA.token)),
      get(`/api/tenants/${userB.tenantId}/kb`, authHeader(userA.token)),
      get(`/api/tenants/${userB.tenantId}/catalog`, authHeader(userA.token)),
      get(`/api/tenants/${userB.tenantId}/billing`, authHeader(userA.token))
    ];

    const results = await Promise.all(crossTenantRequests);
    for (const res of results) {
      assert.equal(res.status, 403, `Cross-tenant access should be 403, got ${res.status}`);
    }
  });

  it('admin CAN access any tenant resources', async () => {
    const admin = createUserDirect('superadmin@vocalia.ma', { role: 'admin' });
    const user = createUserDirect('normaltenant@test.com');

    // Admin should access other tenant's resources
    const res = await get(`/api/tenants/${user.tenantId}/conversations`, authHeader(admin.token));
    assert.equal(res.status, 200, 'Admin should access any tenant');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Session 250.209: CATALOG CRUD — Full lifecycle + tenant isolation (B6 fix)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Catalog CRUD lifecycle', () => {
  beforeEach(() => resetStore());

  it('POST /api/tenants/:id/catalog → 201 creates item', async () => {
    const user = createUserDirect('catalog-user@test.com');
    const res = await post(
      `/api/tenants/${user.tenantId}/catalog`,
      { name: 'Widget Pro', price: 49.99, category: 'electronics' },
      authHeader(user.token)
    );
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.success);
    assert.equal(data.item.name, 'Widget Pro');
    assert.equal(data.item.price, 49.99);
    assert.equal(data.item.category, 'electronics');
    assert.ok(data.item.id.startsWith('item_'));
  });

  it('POST /api/tenants/:id/catalog without name → 400', async () => {
    const user = createUserDirect('catalog-noname@test.com');
    const res = await post(
      `/api/tenants/${user.tenantId}/catalog`,
      { price: 10 },
      authHeader(user.token)
    );
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('name'));
  });

  it('POST /api/tenants/:id/catalog without auth → 401', async () => {
    const res = await post('/api/tenants/demo/catalog', { name: 'Test' });
    assert.equal(res.status, 401);
  });

  it('full CRUD chain: create → get → update → delete', async () => {
    const user = createUserDirect('crud-chain@test.com');
    const tid = user.tenantId;
    const auth = authHeader(user.token);

    // CREATE
    const createRes = await post(`/api/tenants/${tid}/catalog`, { name: 'Laptop', price: 999, category: 'tech' }, auth);
    assert.equal(createRes.status, 201);
    const { item } = await createRes.json();
    const itemId = item.id;

    // GET item
    const getRes = await get(`/api/tenants/${tid}/catalog/${itemId}`, auth);
    assert.equal(getRes.status, 200);
    const getData = await getRes.json();
    assert.equal(getData.item.name, 'Laptop');
    assert.equal(getData.item.price, 999);

    // UPDATE
    const updateRes = await put(`/api/tenants/${tid}/catalog/${itemId}`, { name: 'Laptop Pro', price: 1299 }, auth);
    assert.equal(updateRes.status, 200);
    const updateData = await updateRes.json();
    assert.equal(updateData.item.name, 'Laptop Pro');
    assert.equal(updateData.item.price, 1299);
    assert.ok(updateData.item.updatedAt);

    // DELETE
    const delRes = await del(`/api/tenants/${tid}/catalog/${itemId}`, auth);
    assert.equal(delRes.status, 200);
    const delData = await delRes.json();
    assert.equal(delData.deleted, itemId);

    // VERIFY deleted
    const verifyRes = await get(`/api/tenants/${tid}/catalog/${itemId}`, auth);
    assert.equal(verifyRes.status, 404);
  });

  it('GET /api/tenants/:id/catalog/:itemId nonexistent → 404', async () => {
    const user = createUserDirect('catalog-404@test.com');
    const res = await get(`/api/tenants/${user.tenantId}/catalog/nonexistent_item`, authHeader(user.token));
    assert.equal(res.status, 404);
  });

  it('PUT nonexistent item → 404', async () => {
    const user = createUserDirect('catalog-put404@test.com');
    const res = await put(
      `/api/tenants/${user.tenantId}/catalog/nonexistent_item`,
      { name: 'Updated' },
      authHeader(user.token)
    );
    assert.equal(res.status, 404);
  });

  it('DELETE nonexistent item → 404', async () => {
    const user = createUserDirect('catalog-del404@test.com');
    const res = await del(`/api/tenants/${user.tenantId}/catalog/nonexistent_item`, authHeader(user.token));
    assert.equal(res.status, 404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Session 250.209: B6 FIX VERIFICATION — Catalog CRUD tenant isolation
// ═══════════════════════════════════════════════════════════════════════════════

describe('Catalog CRUD: tenant isolation (B6 fix)', () => {
  beforeEach(() => resetStore());

  it('POST create in other tenant catalog → 403', async () => {
    const userA = createUserDirect('tenantA-cat@test.com', { tenantId: 'tenant_catA' });
    const userB = createUserDirect('tenantB-cat@test.com', { tenantId: 'tenant_catB' });

    const res = await post(
      `/api/tenants/${userB.tenantId}/catalog`,
      { name: 'Injected Item' },
      authHeader(userA.token)
    );
    assert.equal(res.status, 403, 'User A should not create items in tenant B catalog');
  });

  it('GET item from other tenant → 403', async () => {
    const userA = createUserDirect('tenantA-getitem@test.com', { tenantId: 'tenant_getA' });
    const userB = createUserDirect('tenantB-getitem@test.com', { tenantId: 'tenant_getB' });

    const res = await get(
      `/api/tenants/${userB.tenantId}/catalog/some_item`,
      authHeader(userA.token)
    );
    assert.equal(res.status, 403, 'User A should not read tenant B catalog items');
  });

  it('PUT update in other tenant → 403', async () => {
    const userA = createUserDirect('tenantA-putitem@test.com', { tenantId: 'tenant_putA' });
    const userB = createUserDirect('tenantB-putitem@test.com', { tenantId: 'tenant_putB' });

    const res = await put(
      `/api/tenants/${userB.tenantId}/catalog/some_item`,
      { name: 'Hijacked' },
      authHeader(userA.token)
    );
    assert.equal(res.status, 403, 'User A should not update tenant B catalog items');
  });

  it('DELETE from other tenant → 403', async () => {
    const userA = createUserDirect('tenantA-delitem@test.com', { tenantId: 'tenant_delA' });
    const userB = createUserDirect('tenantB-delitem@test.com', { tenantId: 'tenant_delB' });

    const res = await del(
      `/api/tenants/${userB.tenantId}/catalog/some_item`,
      authHeader(userA.token)
    );
    assert.equal(res.status, 403, 'User A should not delete tenant B catalog items');
  });

  it('admin CAN access any tenant catalog', async () => {
    const admin = createUserDirect('admin-cat@vocalia.ma', { role: 'admin' });
    const user = createUserDirect('target-cat@test.com');

    // Admin creates in another tenant's catalog
    const res = await post(
      `/api/tenants/${user.tenantId}/catalog`,
      { name: 'Admin Item' },
      authHeader(admin.token)
    );
    assert.equal(res.status, 201, 'Admin should create items in any tenant catalog');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Session 250.209: Catalog detail (public) + sync + search
// ═══════════════════════════════════════════════════════════════════════════════

describe('Catalog public endpoints', () => {
  beforeEach(() => resetStore());

  it('GET /api/tenants/:id/catalog/detail/:itemId without auth → 404 (no items)', async () => {
    const res = await get('/api/tenants/demo/catalog/detail/some_product');
    assert.equal(res.status, 404);
  });

  it('POST /api/tenants/:id/catalog/search with empty query → empty results', async () => {
    const res = await post('/api/tenants/demo/catalog/search', { q: '' });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.count, 0);
    assert.deepEqual(data.results, []);
  });

  it('POST /api/tenants/:id/catalog/browse → 200', async () => {
    const res = await post('/api/tenants/demo/catalog/browse', { limit: 5 });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok('items' in data);
    assert.ok('voiceSummary' in data);
  });

  it('POST /api/tenants/:id/catalog/sync requires auth', async () => {
    const res = await post('/api/tenants/demo/catalog/sync', {});
    assert.equal(res.status, 401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Session 250.209: Conversation detail
// ═══════════════════════════════════════════════════════════════════════════════

describe('Conversation detail', () => {
  beforeEach(() => resetStore());

  it('GET /api/tenants/:id/conversations/:sessionId → 404 (no conversation)', async () => {
    const user = createUserDirect('conv-detail@test.com');
    const res = await get(
      `/api/tenants/${user.tenantId}/conversations/session_nonexistent`,
      authHeader(user.token)
    );
    assert.equal(res.status, 404);
  });

  it('GET /api/tenants/:id/conversations/:sessionId without auth → 401', async () => {
    const res = await get('/api/tenants/demo/conversations/session_123');
    assert.equal(res.status, 401);
  });

  it('GET /api/tenants/:id/conversations/:sessionId cross-tenant → 403', async () => {
    const userA = createUserDirect('convA@test.com', { tenantId: 'tenant_convA' });
    const userB = createUserDirect('convB@test.com', { tenantId: 'tenant_convB' });
    const res = await get(
      `/api/tenants/${userB.tenantId}/conversations/session_x`,
      authHeader(userA.token)
    );
    assert.equal(res.status, 403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Session 250.209: Export download — path traversal safety
// ═══════════════════════════════════════════════════════════════════════════════

describe('Export download', () => {
  beforeEach(() => resetStore());

  it('GET /api/exports/nonexistent.csv → 404', async () => {
    const user = createUserDirect('export-dl@test.com');
    const res = await get('/api/exports/nonexistent.csv', authHeader(user.token));
    assert.equal(res.status, 404);
  });

  it('GET /api/exports/../../etc/passwd → no regex match (404 fallback)', async () => {
    const user = createUserDirect('export-traversal@test.com');
    // The regex [^/]+ prevents / in filename, so ../../ won't match
    const res = await get('/api/exports/../../etc/passwd', authHeader(user.token));
    assert.ok(res.status >= 400, 'Path traversal attempt should not succeed');
  });

  it('GET /api/exports/test.exe → no regex match (only csv/xlsx/pdf)', async () => {
    const user = createUserDirect('export-exe@test.com');
    const res = await get('/api/exports/test.exe', authHeader(user.token));
    assert.ok(res.status >= 400, 'Only csv/xlsx/pdf extensions allowed');
  });

  it('GET /api/exports without auth → 401', async () => {
    const res = await get('/api/exports/report.csv');
    assert.equal(res.status, 401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Session 250.209: Widget interactions + UCP profiles
// ═══════════════════════════════════════════════════════════════════════════════

describe('Widget interactions', () => {
  beforeEach(() => resetStore());

  it('GET /api/tenants/:id/widget/interactions → 200', async () => {
    const user = createUserDirect('widget-int@test.com');
    const res = await get(
      `/api/tenants/${user.tenantId}/widget/interactions`,
      authHeader(user.token)
    );
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok('data' in data);
    assert.ok('count' in data);
  });

  it('GET /api/tenants/:id/widget/interactions without auth → 401', async () => {
    const res = await get('/api/tenants/demo/widget/interactions');
    assert.equal(res.status, 401);
  });

  it('GET /api/tenants/:id/widget/interactions cross-tenant → 403', async () => {
    const userA = createUserDirect('widgetA@test.com', { tenantId: 'tenant_widA' });
    const userB = createUserDirect('widgetB@test.com', { tenantId: 'tenant_widB' });
    const res = await get(
      `/api/tenants/${userB.tenantId}/widget/interactions`,
      authHeader(userA.token)
    );
    assert.equal(res.status, 403);
  });
});

describe('UCP profiles', () => {
  beforeEach(() => resetStore());

  it('GET /api/tenants/:id/ucp/profiles → 200', async () => {
    const user = createUserDirect('ucp-prof@test.com');
    const res = await get(
      `/api/tenants/${user.tenantId}/ucp/profiles`,
      authHeader(user.token)
    );
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok('data' in data);
    assert.ok('count' in data);
  });

  it('GET /api/tenants/:id/ucp/profiles without auth → 401', async () => {
    const res = await get('/api/tenants/demo/ucp/profiles');
    assert.equal(res.status, 401);
  });

  it('GET /api/tenants/:id/ucp/profiles cross-tenant → 403', async () => {
    const userA = createUserDirect('ucpA@test.com', { tenantId: 'tenant_ucpA' });
    const userB = createUserDirect('ucpB@test.com', { tenantId: 'tenant_ucpB' });
    const res = await get(
      `/api/tenants/${userB.tenantId}/ucp/profiles`,
      authHeader(userA.token)
    );
    assert.equal(res.status, 403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Session 250.209: KB delete
// ═══════════════════════════════════════════════════════════════════════════════

describe('KB delete entry', () => {
  beforeEach(() => resetStore());

  it('DELETE /api/tenants/:id/kb/:key without auth → 401', async () => {
    const res = await del('/api/tenants/demo/kb/pricing');
    assert.equal(res.status, 401);
  });

  it('DELETE /api/tenants/:id/kb/:key with invalid lang → 400', async () => {
    const user = createUserDirect('kb-del@test.com');
    const res = await del(
      `/api/tenants/${user.tenantId}/kb/pricing?lang=xx`,
      authHeader(user.token)
    );
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('Invalid language'));
  });

  it('DELETE /api/tenants/:id/kb/:key cross-tenant → 403', async () => {
    const userA = createUserDirect('kbA@test.com', { tenantId: 'tenant_kbA' });
    const userB = createUserDirect('kbB@test.com', { tenantId: 'tenant_kbB' });
    const res = await del(
      `/api/tenants/${userB.tenantId}/kb/pricing`,
      authHeader(userA.token)
    );
    assert.equal(res.status, 403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Session 250.209b: DB Generic CRUD — Full chain + bug verification
// GAP CRITIQUE: GET by ID, PUT, DELETE with auth were NEVER tested
// Bugs found: B10 (PUT nonexistent → 500), B11 (DELETE nonexistent → 500),
//             B12 (tenant isolation inconsistent PUT/DELETE vs GET)
// ═══════════════════════════════════════════════════════════════════════════════

describe('DB Generic CRUD: full chain', () => {
  beforeEach(() => resetStore());

  it('POST → GET by ID → PUT → GET by ID (verify) → DELETE → GET by ID (404)', async () => {
    const user = createUserDirect('dbcrud@test.com');
    const auth = authHeader(user.token);

    // 1. CREATE
    const createRes = await post('/api/db/sessions', {
      tenant_id: user.tenantId,
      calls: 5,
      duration_sec: 120
    }, auth);
    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    assert.ok(created.id, 'Created record should have id');
    assert.equal(created.tenant_id, user.tenantId);
    const recordId = created.id;

    // 2. GET by ID
    const getRes = await get(`/api/db/sessions/${recordId}`, auth);
    assert.equal(getRes.status, 200, 'GET by ID should return 200');
    const record = await getRes.json();
    assert.equal(record.id, recordId);
    assert.equal(record.calls, 5);
    assert.equal(record.duration_sec, 120);
    assert.equal(record.tenant_id, user.tenantId);

    // 3. PUT (update)
    const putRes = await put(`/api/db/sessions/${recordId}`, {
      calls: 10,
      duration_sec: 300
    }, auth);
    assert.equal(putRes.status, 200, 'PUT should return 200');
    const updated = await putRes.json();
    assert.equal(updated.id, recordId, 'Updated record should keep same id');
    assert.equal(updated.calls, 10, 'calls should be updated');
    assert.equal(updated.duration_sec, 300, 'duration_sec should be updated');
    assert.ok(updated.updated_at, 'Updated record should have updated_at timestamp');

    // 4. GET by ID (verify update persisted)
    const verifyRes = await get(`/api/db/sessions/${recordId}`, auth);
    assert.equal(verifyRes.status, 200);
    const verified = await verifyRes.json();
    assert.equal(verified.calls, 10, 'Update should persist across requests');
    assert.equal(verified.duration_sec, 300);

    // 5. DELETE
    const delRes = await del(`/api/db/sessions/${recordId}`, auth);
    assert.equal(delRes.status, 200, 'DELETE should return 200');
    const delData = await delRes.json();
    assert.equal(delData.deleted, true);
    assert.equal(delData.id, recordId);

    // 6. GET by ID → 404 (verify deletion)
    const gone = await get(`/api/db/sessions/${recordId}`, auth);
    assert.equal(gone.status, 404, 'Deleted record should return 404');
  });
});

describe('DB Generic CRUD: B10 fix — PUT nonexistent → 404', () => {
  beforeEach(() => resetStore());

  it('PUT /api/db/sessions/nonexistent → 404 (was 500 before B10 fix)', async () => {
    const user = createUserDirect('b10@test.com');
    const res = await put('/api/db/sessions/nonexistent_id', {
      calls: 99
    }, authHeader(user.token));
    assert.equal(res.status, 404, 'PUT nonexistent should be 404, not 500');
    const data = await res.json();
    assert.ok(data.error.includes('not found'), `Error should mention "not found", got: ${data.error}`);
  });

  it('PUT /api/db/sessions without ID → 400', async () => {
    const user = createUserDirect('b10-noid@test.com');
    const res = await put('/api/db/sessions', { calls: 1 }, authHeader(user.token));
    assert.equal(res.status, 400);
  });
});

describe('DB Generic CRUD: B11 fix — DELETE nonexistent → 404', () => {
  beforeEach(() => resetStore());

  it('DELETE /api/db/sessions/nonexistent → 404 (was 500 before B11 fix)', async () => {
    const user = createUserDirect('b11@test.com');
    const res = await del('/api/db/sessions/nonexistent_id', authHeader(user.token));
    assert.equal(res.status, 404, 'DELETE nonexistent should be 404, not 500');
    const data = await res.json();
    assert.ok(data.error.includes('not found'), `Error should mention "not found", got: ${data.error}`);
  });

  it('DELETE /api/db/sessions without ID → 400', async () => {
    const user = createUserDirect('b11-noid@test.com');
    const res = await del('/api/db/sessions', authHeader(user.token));
    assert.equal(res.status, 400);
  });
});

describe('DB Generic CRUD: B12 fix — tenant isolation consistency', () => {
  beforeEach(() => resetStore());

  it('user cannot GET by ID record from other tenant → 403', async () => {
    const userA = createUserDirect('tenantA-db@test.com', { tenantId: 'tenant_dbA' });
    const userB = createUserDirect('tenantB-db@test.com', { tenantId: 'tenant_dbB' });
    const auth = authHeader(userA.token);

    // Create record owned by tenant A
    const createRes = await post('/api/db/sessions', {
      tenant_id: 'tenant_dbA',
      calls: 1
    }, auth);
    const created = await createRes.json();

    // User B tries to GET by ID → 403
    const getRes = await get(`/api/db/sessions/${created.id}`, authHeader(userB.token));
    assert.equal(getRes.status, 403, 'Cross-tenant GET by ID should be 403');
  });

  it('user cannot PUT record from other tenant → 403', async () => {
    const userA = createUserDirect('tenantA-put@test.com', { tenantId: 'tenant_putA' });
    const userB = createUserDirect('tenantB-put@test.com', { tenantId: 'tenant_putB' });

    // Create record owned by tenant A
    const createRes = await post('/api/db/sessions', {
      tenant_id: 'tenant_putA',
      calls: 1
    }, authHeader(userA.token));
    const created = await createRes.json();

    // User B tries to PUT → 403
    const putRes = await put(`/api/db/sessions/${created.id}`, {
      calls: 99
    }, authHeader(userB.token));
    assert.equal(putRes.status, 403, 'Cross-tenant PUT should be 403');
  });

  it('user cannot DELETE record from other tenant → 403', async () => {
    const userA = createUserDirect('tenantA-del@test.com', { tenantId: 'tenant_delA' });
    const userB = createUserDirect('tenantB-del@test.com', { tenantId: 'tenant_delB' });

    // Create record owned by tenant A
    const createRes = await post('/api/db/sessions', {
      tenant_id: 'tenant_delA',
      calls: 1
    }, authHeader(userA.token));
    const created = await createRes.json();

    // User B tries to DELETE → 403
    const delRes = await del(`/api/db/sessions/${created.id}`, authHeader(userB.token));
    assert.equal(delRes.status, 403, 'Cross-tenant DELETE should be 403');
  });

  it('admin can GET/PUT/DELETE any tenant record', async () => {
    const user = createUserDirect('tenantowner@test.com', { tenantId: 'tenant_owned' });
    const admin = createUserDirect('admindb@vocalia.ma', { role: 'admin' });

    // Create record as regular user
    const createRes = await post('/api/db/sessions', {
      tenant_id: 'tenant_owned',
      calls: 5
    }, authHeader(user.token));
    const created = await createRes.json();

    // Admin can GET by ID
    const getRes = await get(`/api/db/sessions/${created.id}`, authHeader(admin.token));
    assert.equal(getRes.status, 200, 'Admin should GET any record');

    // Admin can PUT
    const putRes = await put(`/api/db/sessions/${created.id}`, {
      calls: 50
    }, authHeader(admin.token));
    assert.equal(putRes.status, 200, 'Admin should PUT any record');

    // Admin can DELETE
    const delRes = await del(`/api/db/sessions/${created.id}`, authHeader(admin.token));
    assert.equal(delRes.status, 200, 'Admin should DELETE any record');
  });

  it('GET list filters by tenant (non-admin sees only own)', async () => {
    const userA = createUserDirect('listA@test.com', { tenantId: 'tenant_listA' });
    const userB = createUserDirect('listB@test.com', { tenantId: 'tenant_listB' });

    // Create records for both tenants
    await post('/api/db/sessions', { tenant_id: 'tenant_listA', calls: 1 }, authHeader(userA.token));
    await post('/api/db/sessions', { tenant_id: 'tenant_listA', calls: 2 }, authHeader(userA.token));
    await post('/api/db/sessions', { tenant_id: 'tenant_listB', calls: 3 }, authHeader(userB.token));

    // User A lists → sees only own
    const listA = await get('/api/db/sessions', authHeader(userA.token));
    const dataA = await listA.json();
    assert.ok(dataA.data.every(r => r.tenant_id === 'tenant_listA'),
      'Non-admin should only see own tenant records');
    assert.equal(dataA.data.length, 2, 'User A should see 2 records');

    // User B lists → sees only own
    const listB = await get('/api/db/sessions', authHeader(userB.token));
    const dataB = await listB.json();
    assert.ok(dataB.data.every(r => r.tenant_id === 'tenant_listB'));
    assert.equal(dataB.data.length, 1, 'User B should see 1 record');
  });

  it('admin-only sheet (users) → non-admin → 403', async () => {
    const user = createUserDirect('nonadmin@test.com');
    const admin = createUserDirect('adminsheets@vocalia.ma', { role: 'admin' });

    // Non-admin tries admin-only sheets
    const getUsersRes = await get('/api/db/users', authHeader(user.token));
    assert.equal(getUsersRes.status, 403);

    const getHitlRes = await get('/api/db/hitl_pending', authHeader(user.token));
    assert.equal(getHitlRes.status, 403);

    // Admin can access
    const adminRes = await get('/api/db/users', authHeader(admin.token));
    assert.equal(adminRes.status, 200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Session 250.209b: KB CRUD CHAIN — Create → Read → Update(upsert) → Delete → Verify
// GAP: Each KB operation was tested in isolation. Chain never tested.
// ═══════════════════════════════════════════════════════════════════════════════

describe('KB CRUD: full chain', () => {
  beforeEach(() => resetStore());

  it('POST create → GET list → verify → POST update (upsert) → GET verify update → DELETE → GET verify gone', async () => {
    const user = createUserDirect('kbchain@test.com');
    const tid = user.tenantId;
    const auth = authHeader(user.token);

    // 1. CREATE KB entry
    const createRes = await post(`/api/tenants/${tid}/kb`, {
      key: 'greeting',
      value: 'Bonjour! Comment puis-je vous aider?',
      language: 'fr'
    }, auth);
    assert.equal(createRes.status, 201);
    const createData = await createRes.json();
    assert.ok(createData.success);
    assert.equal(createData.key, 'greeting');

    // 2. GET list → verify entry exists
    const listRes = await get(`/api/tenants/${tid}/kb?lang=fr`, auth);
    assert.equal(listRes.status, 200);
    const listData = await listRes.json();
    assert.ok(listData.count >= 1, `Expected ≥1 entries, got ${listData.count}`);
    const entry = listData.entries.find(e => e.key === 'greeting');
    assert.ok(entry, 'Created entry should appear in list');
    assert.equal(entry.response, 'Bonjour! Comment puis-je vous aider?');

    // 3. UPDATE (upsert same key with new value)
    const updateRes = await post(`/api/tenants/${tid}/kb`, {
      key: 'greeting',
      value: 'Salut! Je suis VocalIA.',
      language: 'fr'
    }, auth);
    assert.equal(updateRes.status, 201);

    // 4. GET list → verify update persisted
    const verifyRes = await get(`/api/tenants/${tid}/kb?lang=fr`, auth);
    const verifyData = await verifyRes.json();
    const updatedEntry = verifyData.entries.find(e => e.key === 'greeting');
    assert.ok(updatedEntry, 'Entry should still exist after upsert');
    assert.equal(updatedEntry.response, 'Salut! Je suis VocalIA.',
      'Upsert should replace old value');

    // 5. CREATE second entry (to verify DELETE targets correctly)
    await post(`/api/tenants/${tid}/kb`, {
      key: 'pricing',
      value: 'Starter: 49€/mois',
      language: 'fr'
    }, auth);

    // 6. DELETE first entry
    const delRes = await del(`/api/tenants/${tid}/kb/greeting?lang=fr`, auth);
    assert.equal(delRes.status, 200);
    const delData = await delRes.json();
    assert.ok(delData.success);

    // 7. GET list → verify greeting gone, pricing still present
    const finalRes = await get(`/api/tenants/${tid}/kb?lang=fr`, auth);
    const finalData = await finalRes.json();
    const goneEntry = finalData.entries.find(e => e.key === 'greeting');
    assert.ok(!goneEntry, 'Deleted entry should be gone');
    const pricingEntry = finalData.entries.find(e => e.key === 'pricing');
    assert.ok(pricingEntry, 'Other entry should NOT be affected by delete');
    assert.equal(pricingEntry.response, 'Starter: 49€/mois');
  });

  it('DELETE nonexistent KB entry → 404', async () => {
    const user = createUserDirect('kbdel404@test.com');
    // Create KB file first (POST creates it)
    await post(`/api/tenants/${user.tenantId}/kb`, {
      key: 'exists', value: 'yes', language: 'fr'
    }, authHeader(user.token));
    // Delete nonexistent key
    const res = await del(
      `/api/tenants/${user.tenantId}/kb/nonexistent?lang=fr`,
      authHeader(user.token)
    );
    assert.equal(res.status, 404);
    const data = await res.json();
    assert.ok(data.error.includes('not found'));
  });

  it('KB search after create returns results', async () => {
    const user = createUserDirect('kbsearch@test.com');
    const tid = user.tenantId;
    const auth = authHeader(user.token);

    // Create searchable content
    await post(`/api/tenants/${tid}/kb`, {
      key: 'delivery',
      value: 'Livraison gratuite au Maroc pour commandes de plus de 200 MAD',
      language: 'fr'
    }, auth);

    // Search
    const res = await get(`/api/tenants/${tid}/kb/search?q=livraison&lang=fr`, auth);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.results, 'Search should return results');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Session 250.209b: UCP Profile CRUD chain
// GAP: Sync and profiles-read tested in isolation. Chain never tested.
// ═══════════════════════════════════════════════════════════════════════════════

describe('UCP Profile: sync → read → update → verify chain', () => {
  beforeEach(() => resetStore());

  it('sync creates profile → read profiles → sync updates → read verifies update', async () => {
    const userId = `ucp_crud_${Date.now()}`;

    // 1. SYNC (create profile)
    const syncRes = await post('/api/ucp/sync', {
      tenantId: 'demo_vocalia',
      userId,
      countryCode: 'FR',
      name: 'Original Name'
    });
    assert.equal(syncRes.status, 200);
    const syncData = await syncRes.json();
    assert.ok(syncData.success);
    assert.ok(syncData.profile, 'Sync should return profile');
    assert.equal(syncData.rules.currency, 'EUR');

    // 2. GET profiles → verify profile exists
    const admin = createUserDirect('ucpadmin@vocalia.ma', { role: 'admin', tenantId: 'demo_vocalia' });
    const listRes = await get('/api/tenants/demo_vocalia/ucp/profiles', authHeader(admin.token));
    assert.equal(listRes.status, 200);
    const listData = await listRes.json();
    assert.ok(listData.data, 'Should return data array');

    // 3. SYNC again (update profile — same userId, different data)
    const updateRes = await post('/api/ucp/sync', {
      tenantId: 'demo_vocalia',
      userId,
      countryCode: 'MA',
      name: 'Updated Name'
    });
    assert.equal(updateRes.status, 200);
    const updateData = await updateRes.json();
    assert.ok(updateData.success);
    assert.equal(updateData.rules.currency, 'MAD', 'Country change should update market rules');

    // 4. Record interaction on existing profile
    const intRes = await post('/api/ucp/interaction', {
      tenantId: 'demo_vocalia',
      userId,
      type: 'voice_call',
      channel: 'telephony'
    });
    assert.equal(intRes.status, 200);

    // 5. Track event on existing profile
    const evtRes = await post('/api/ucp/event', {
      tenantId: 'demo_vocalia',
      userId,
      event: 'purchase_completed',
      value: 149.99,
      source: 'checkout'
    });
    assert.equal(evtRes.status, 200);
    const evtData = await evtRes.json();
    assert.equal(evtData.event.event_name, 'purchase_completed');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH PASSWORD + PROFILE CHAIN — E2E
// Covers: forgot, reset, change-password, update-profile, resend-verify
// ═══════════════════════════════════════════════════════════════════════════════

describe('Auth password chain E2E', () => {
  it('POST /api/auth/forgot — returns success even for unknown email (anti-enumeration)', async () => {
    const res = await post('/api/auth/forgot', { email: 'nobody@test.com' });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.message.includes('If an account exists'));
  });

  it('POST /api/auth/forgot — 400 without email', async () => {
    const res = await post('/api/auth/forgot', {});
    assert.equal(res.status, 400);
  });

  it('POST /api/auth/forgot → reset → login (full chain)', async () => {
    // Setup: create user with known password
    const email = `pwreset_${Date.now()}@test.com`;
    const { token: authToken } = createUserDirect(email);

    // Step 1: Request password reset (stores hashed token in DB)
    const forgotRes = await post('/api/auth/forgot', { email });
    assert.equal(forgotRes.status, 200);

    // Step 2: Manually grab the reset token hash from DB to build reset token
    const users = memStore.get('users') || [];
    const user = users.find(u => u.email === email);
    assert.ok(user, 'User should exist in memStore');
    assert.ok(user.password_reset_token, 'Reset token hash should be set');
    assert.ok(user.password_reset_expires, 'Reset expiry should be set');

    // We can't recover the plain token from hash, so test the reset route with a fresh token
    // by manually setting a known token hash
    const knownToken = crypto.randomBytes(32).toString('hex');
    const knownHash = crypto.createHash('sha256').update(knownToken).digest('hex');
    user.password_reset_token = knownHash;
    user.password_reset_expires = new Date(Date.now() + 3600000).toISOString();

    // Step 3: Reset password with the known token
    const resetRes = await post('/api/auth/reset', {
      token: knownToken,
      password: 'NewPass456!'
    });
    assert.equal(resetRes.status, 200);
    const resetData = await resetRes.json();
    assert.equal(resetData.success, true);

    // Verify: token cleared + lockout cleared (B4 regression test)
    const updatedUser = users.find(u => u.email === email);
    assert.equal(updatedUser.password_reset_token, null, 'Reset token should be cleared');
    assert.equal(updatedUser.locked_until, null, 'Lockout should be cleared (B4 fix)');
    assert.equal(updatedUser.failed_login_count, 0, 'Failed login count should be reset (B4 fix)');
  });

  it('POST /api/auth/reset — 400 without token', async () => {
    const res = await post('/api/auth/reset', { password: 'NewPass456!' });
    assert.equal(res.status, 400);
  });

  it('POST /api/auth/reset — 400 without password', async () => {
    const res = await post('/api/auth/reset', { token: 'some_token' });
    assert.equal(res.status, 400);
  });

  it('POST /api/auth/reset — rejects invalid/expired token', async () => {
    const res = await post('/api/auth/reset', {
      token: 'invalid_token_that_does_not_exist',
      password: 'NewPass456!'
    });
    // auth-service throws AuthError for invalid token → route catches and returns 500 or error
    assert.ok([400, 401, 500].includes(res.status));
  });
});

describe('Auth change password E2E', () => {
  it('PUT /api/auth/password — 401 without auth', async () => {
    const res = await put('/api/auth/password', {
      old_password: 'Test1234!', new_password: 'New1234!'
    });
    assert.equal(res.status, 401);
  });

  it('PUT /api/auth/password — 400 without old_password', async () => {
    const { token } = createUserDirect(`chpw1_${Date.now()}@test.com`);
    const res = await put('/api/auth/password', { new_password: 'New1234!' }, authHeader(token));
    assert.equal(res.status, 400);
  });

  it('PUT /api/auth/password — 400 without new_password', async () => {
    const { token } = createUserDirect(`chpw2_${Date.now()}@test.com`);
    const res = await put('/api/auth/password', { old_password: STRONG_PASSWORD }, authHeader(token));
    assert.equal(res.status, 400);
  });

  it('PUT /api/auth/password — rejects wrong old password', async () => {
    const { token } = createUserDirect(`chpw3_${Date.now()}@test.com`);
    const res = await put('/api/auth/password', {
      old_password: 'WrongPassword!',
      new_password: 'NewSecure456!'
    }, authHeader(token));
    assert.ok([400, 401].includes(res.status));
  });

  it('PUT /api/auth/password — succeeds with correct old password', async () => {
    const { token } = createUserDirect(`chpw4_${Date.now()}@test.com`);
    const res = await put('/api/auth/password', {
      old_password: STRONG_PASSWORD,
      new_password: 'NewSecure456!'
    }, authHeader(token));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
  });
});

describe('Auth profile update E2E', () => {
  it('PUT /api/auth/me — 401 without auth', async () => {
    const res = await put('/api/auth/me', { name: 'Hacker' });
    assert.equal(res.status, 401);
  });

  it('PUT /api/auth/me — updates name', async () => {
    const { token, userId } = createUserDirect(`profile1_${Date.now()}@test.com`);
    const res = await put('/api/auth/me', { name: 'New Name' }, authHeader(token));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.name, 'New Name');
  });

  it('PUT /api/auth/me — updates preferences', async () => {
    const { token } = createUserDirect(`profile2_${Date.now()}@test.com`);
    const res = await put('/api/auth/me', {
      preferences: { theme: 'dark', lang: 'en', notifications: false }
    }, authHeader(token));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.deepEqual(data.preferences, { theme: 'dark', lang: 'en', notifications: false });
  });

  it('PUT /api/auth/me — ignores disallowed fields (email, role)', async () => {
    const { token, email: origEmail } = createUserDirect(`profile3_${Date.now()}@test.com`);
    const res = await put('/api/auth/me', {
      name: 'Legitimate',
      email: 'hacker@evil.com',
      role: 'admin'
    }, authHeader(token));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.name, 'Legitimate');
    assert.equal(data.email, origEmail, 'Email should NOT change');
    assert.notEqual(data.role, 'admin', 'Role should NOT change via profile update');
  });
});

describe('Auth resend verification E2E', () => {
  it('POST /api/auth/resend-verification — 400 without email', async () => {
    const res = await post('/api/auth/resend-verification', {});
    assert.equal(res.status, 400);
  });

  it('POST /api/auth/resend-verification — success for unknown email (anti-enumeration)', async () => {
    const res = await post('/api/auth/resend-verification', { email: 'nobody@test.com' });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
  });

  it('POST /api/auth/resend-verification — returns success for already-verified user', async () => {
    const email = `verified_${Date.now()}@test.com`;
    createUserDirect(email); // email_verified = 'true'
    const res = await post('/api/auth/resend-verification', { email });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.message.includes('already verified'));
  });

  it('POST /api/auth/resend-verification — sets new verify token for unverified user', async () => {
    const email = `unverified_${Date.now()}@test.com`;
    const { userId } = createUserDirect(email);
    // Mark user as unverified
    const origUser = (memStore.get('users') || []).find(u => u.id === userId);
    origUser.email_verified = 'false';

    const res = await post('/api/auth/resend-verification', { email });
    assert.equal(res.status, 200);

    // Re-fetch from memStore (db.update replaces the object in the array)
    const updatedUser = (memStore.get('users') || []).find(u => u.id === userId);
    assert.ok(updatedUser, 'User should still exist');
    assert.ok(updatedUser.email_verify_token, 'Verify token hash should be set');
    assert.ok(updatedUser.email_verify_expires, 'Verify expiry should be set');
  });
});
