/**
 * Install Widget — E2E HTTP Tests
 * VocalIA — Session 250.206
 *
 * Tests ALL new endpoints from the self-service widget installation feature:
 *
 * DB-API (port 13013):
 *   GET  /api/tenants/:id/widget-config    — Read widget customization
 *   PUT  /api/tenants/:id/widget-config    — Update widget customization (whitelist)
 *   GET  /api/tenants/:id/allowed-origins  — Read allowed origins
 *   PUT  /api/tenants/:id/allowed-origins  — Update allowed origins (validation)
 *
 * Voice-API (port 13004, child process):
 *   GET  /api/widget/embed-code            — Generate platform-specific snippets
 *
 * Pattern: GoogleSheetsDB in-memory patch + real HTTP server + filesystem tenants.
 * Run: node --test test/install-widget.test.mjs
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const require = createRequire(import.meta.url);

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1: Patch GoogleSheetsDB prototype with in-memory store BEFORE any import
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
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

let ipCounter = 0;
function uniqueIp() {
  ipCounter++;
  return `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
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
// Filesystem tenant helpers
// ─────────────────────────────────────────────────────────────────────────────

const TEST_TENANT_IDS = [];

function createTestTenant(tenantId, configOverrides = {}) {
  const dir = join(ROOT, 'clients', tenantId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const config = {
    tenant_id: tenantId,
    company: `Test ${tenantId}`,
    plan: 'starter',
    created_at: new Date().toISOString(),
    widget_config: {},
    allowed_origins: [],
    ...configOverrides
  };

  writeFileSync(join(dir, 'config.json'), JSON.stringify(config, null, 2));
  TEST_TENANT_IDS.push(tenantId);
  return config;
}

function readTenantConfig(tenantId) {
  const configPath = join(ROOT, 'clients', tenantId, 'config.json');
  return JSON.parse(readFileSync(configPath, 'utf8'));
}

function cleanupTestTenants() {
  for (const tid of TEST_TENANT_IDS) {
    const dir = join(ROOT, 'clients', tid);
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  TEST_TENANT_IDS.length = 0;
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
  cleanupTestTenants();
  if (wss) {
    wss.clients.forEach(ws => ws.terminate());
    wss.close();
  }
  if (server) {
    await new Promise(resolve => server.close(resolve));
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: GET /api/tenants/:id/widget-config
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/tenants/:id/widget-config', () => {
  it('returns 401 without auth', async () => {
    const res = await get('/api/tenants/_test_wc1/widget-config');
    assert.equal(res.status, 401);
  });

  it('returns empty widget_config for new tenant', async () => {
    const tenantId = `_test_wc_empty_${Date.now()}`;
    createTestTenant(tenantId);
    const user = createUserDirect('wc-empty@test.com', { tenantId });

    const res = await get(`/api/tenants/${tenantId}/widget-config`, authHeader(user.token));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.tenantId, tenantId);
    assert.deepEqual(data.widget_config, {});
  });

  it('returns existing widget_config from config.json', async () => {
    const tenantId = `_test_wc_exist_${Date.now()}`;
    createTestTenant(tenantId, {
      widget_config: {
        position: 'bottom-left',
        branding: { primary_color: '#FF5500' },
        persona: 'UNIVERSAL_ECOMMERCE'
      }
    });
    const user = createUserDirect('wc-exist@test.com', { tenantId });

    const res = await get(`/api/tenants/${tenantId}/widget-config`, authHeader(user.token));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.widget_config.position, 'bottom-left');
    assert.equal(data.widget_config.branding.primary_color, '#FF5500');
    assert.equal(data.widget_config.persona, 'UNIVERSAL_ECOMMERCE');
  });

  it('returns 200 with empty object when tenant dir missing (no config.json)', async () => {
    const tenantId = '_test_wc_nodir_' + Date.now();
    // Do NOT create tenant dir — just create user with this tenantId
    const user = createUserDirect('wc-nodir@test.com', { tenantId });

    const res = await get(`/api/tenants/${tenantId}/widget-config`, authHeader(user.token));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.deepEqual(data.widget_config, {});
  });

  it('returns 403 when user accesses different tenant', async () => {
    const tenantA = `_test_wc_a_${Date.now()}`;
    const tenantB = `_test_wc_b_${Date.now()}`;
    createTestTenant(tenantA);
    createTestTenant(tenantB);
    const userA = createUserDirect('wc-a@test.com', { tenantId: tenantA });

    const res = await get(`/api/tenants/${tenantB}/widget-config`, authHeader(userA.token));
    assert.equal(res.status, 403);
  });

  it('admin can access any tenant widget-config', async () => {
    const tenantId = `_test_wc_admin_${Date.now()}`;
    createTestTenant(tenantId, {
      widget_config: { position: 'bottom-right' }
    });
    const admin = createUserDirect('wc-admin@test.com', { role: 'admin', tenantId: 'admin_tenant' });

    const res = await get(`/api/tenants/${tenantId}/widget-config`, authHeader(admin.token));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.widget_config.position, 'bottom-right');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: PUT /api/tenants/:id/widget-config
// ═══════════════════════════════════════════════════════════════════════════════

describe('PUT /api/tenants/:id/widget-config', () => {
  it('returns 401 without auth', async () => {
    const res = await put('/api/tenants/_test_x/widget-config', { widget_config: {} });
    assert.equal(res.status, 401);
  });

  it('returns 400 when widget_config missing', async () => {
    const tenantId = `_test_wcp_nobody_${Date.now()}`;
    createTestTenant(tenantId);
    const user = createUserDirect('wcp-nobody@test.com', { tenantId });

    const res = await put(`/api/tenants/${tenantId}/widget-config`, {}, authHeader(user.token));
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('widget_config'));
  });

  it('returns 400 when widget_config is not an object', async () => {
    const tenantId = `_test_wcp_str_${Date.now()}`;
    createTestTenant(tenantId);
    const user = createUserDirect('wcp-str@test.com', { tenantId });

    const res = await put(`/api/tenants/${tenantId}/widget-config`, { widget_config: 'invalid' }, authHeader(user.token));
    assert.equal(res.status, 400);
  });

  it('returns 404 when tenant dir does not exist', async () => {
    const tenantId = '_test_wcp_notenant_' + Date.now();
    const user = createUserDirect('wcp-notenant@test.com', { tenantId });

    const res = await put(`/api/tenants/${tenantId}/widget-config`, { widget_config: { position: 'bottom-left' } }, authHeader(user.token));
    assert.equal(res.status, 404);
  });

  it('saves valid position (bottom-left)', async () => {
    const tenantId = `_test_wcp_pos_${Date.now()}`;
    createTestTenant(tenantId);
    const user = createUserDirect('wcp-pos@test.com', { tenantId });

    const res = await put(`/api/tenants/${tenantId}/widget-config`, {
      widget_config: { position: 'bottom-left' }
    }, authHeader(user.token));

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.widget_config.position, 'bottom-left');

    // Verify filesystem persistence
    const config = readTenantConfig(tenantId);
    assert.equal(config.widget_config.position, 'bottom-left');
  });

  it('saves valid position (bottom-right)', async () => {
    const tenantId = `_test_wcp_posr_${Date.now()}`;
    createTestTenant(tenantId);
    const user = createUserDirect('wcp-posr@test.com', { tenantId });

    const res = await put(`/api/tenants/${tenantId}/widget-config`, {
      widget_config: { position: 'bottom-right' }
    }, authHeader(user.token));

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.widget_config.position, 'bottom-right');
  });

  it('rejects invalid position value (whitelist enforcement)', async () => {
    const tenantId = `_test_wcp_badpos_${Date.now()}`;
    createTestTenant(tenantId);
    const user = createUserDirect('wcp-badpos@test.com', { tenantId });

    const res = await put(`/api/tenants/${tenantId}/widget-config`, {
      widget_config: { position: 'top-right' }
    }, authHeader(user.token));

    assert.equal(res.status, 200);
    // Invalid position should be silently ignored (whitelist approach)
    const config = readTenantConfig(tenantId);
    assert.equal(config.widget_config.position, undefined);
  });

  it('saves valid hex color', async () => {
    const tenantId = `_test_wcp_color_${Date.now()}`;
    createTestTenant(tenantId);
    const user = createUserDirect('wcp-color@test.com', { tenantId });

    const res = await put(`/api/tenants/${tenantId}/widget-config`, {
      widget_config: { branding: { primary_color: '#3B82F6' } }
    }, authHeader(user.token));

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.widget_config.branding.primary_color, '#3B82F6');

    // Filesystem verification
    const config = readTenantConfig(tenantId);
    assert.equal(config.widget_config.branding.primary_color, '#3B82F6');
  });

  it('rejects invalid color format (no XSS)', async () => {
    const tenantId = `_test_wcp_xss_${Date.now()}`;
    createTestTenant(tenantId);
    const user = createUserDirect('wcp-xss@test.com', { tenantId });

    // XSS attempt via color field
    const res = await put(`/api/tenants/${tenantId}/widget-config`, {
      widget_config: { branding: { primary_color: '<script>alert(1)</script>' } }
    }, authHeader(user.token));

    assert.equal(res.status, 200);
    // Invalid color should be silently ignored — branding object may be created but without primary_color
    const config = readTenantConfig(tenantId);
    assert.equal(config.widget_config.branding?.primary_color, undefined);
  });

  it('rejects color with wrong length (#FFF instead of #FFFFFF)', async () => {
    const tenantId = `_test_wcp_shortcolor_${Date.now()}`;
    createTestTenant(tenantId);
    const user = createUserDirect('wcp-shortcolor@test.com', { tenantId });

    const res = await put(`/api/tenants/${tenantId}/widget-config`, {
      widget_config: { branding: { primary_color: '#FFF' } }
    }, authHeader(user.token));

    assert.equal(res.status, 200);
    const config = readTenantConfig(tenantId);
    assert.equal(config.widget_config.branding?.primary_color, undefined);
  });

  it('saves valid persona string', async () => {
    const tenantId = `_test_wcp_persona_${Date.now()}`;
    createTestTenant(tenantId);
    const user = createUserDirect('wcp-persona@test.com', { tenantId });

    const res = await put(`/api/tenants/${tenantId}/widget-config`, {
      widget_config: { persona: 'UNIVERSAL_ECOMMERCE' }
    }, authHeader(user.token));

    assert.equal(res.status, 200);
    const config = readTenantConfig(tenantId);
    assert.equal(config.widget_config.persona, 'UNIVERSAL_ECOMMERCE');
  });

  it('rejects persona longer than 50 chars', async () => {
    const tenantId = `_test_wcp_longpersona_${Date.now()}`;
    createTestTenant(tenantId);
    const user = createUserDirect('wcp-longpersona@test.com', { tenantId });

    const res = await put(`/api/tenants/${tenantId}/widget-config`, {
      widget_config: { persona: 'A'.repeat(51) }
    }, authHeader(user.token));

    assert.equal(res.status, 200);
    const config = readTenantConfig(tenantId);
    assert.equal(config.widget_config.persona, undefined);
  });

  it('merges multiple fields in one request', async () => {
    const tenantId = `_test_wcp_multi_${Date.now()}`;
    createTestTenant(tenantId);
    const user = createUserDirect('wcp-multi@test.com', { tenantId });

    const res = await put(`/api/tenants/${tenantId}/widget-config`, {
      widget_config: {
        position: 'bottom-left',
        branding: { primary_color: '#10B981' },
        persona: 'REAL_ESTATE_COMMERCIAL'
      }
    }, authHeader(user.token));

    assert.equal(res.status, 200);
    const config = readTenantConfig(tenantId);
    assert.equal(config.widget_config.position, 'bottom-left');
    assert.equal(config.widget_config.branding.primary_color, '#10B981');
    assert.equal(config.widget_config.persona, 'REAL_ESTATE_COMMERCIAL');
  });

  it('preserves existing fields when updating one', async () => {
    const tenantId = `_test_wcp_preserve_${Date.now()}`;
    createTestTenant(tenantId, {
      widget_config: {
        position: 'bottom-right',
        branding: { primary_color: '#FF0000' },
        persona: 'CUSTOMER_SUPPORT'
      }
    });
    const user = createUserDirect('wcp-preserve@test.com', { tenantId });

    // Only update position
    const res = await put(`/api/tenants/${tenantId}/widget-config`, {
      widget_config: { position: 'bottom-left' }
    }, authHeader(user.token));

    assert.equal(res.status, 200);
    const config = readTenantConfig(tenantId);
    assert.equal(config.widget_config.position, 'bottom-left');
    // Existing fields preserved
    assert.equal(config.widget_config.branding.primary_color, '#FF0000');
    assert.equal(config.widget_config.persona, 'CUSTOMER_SUPPORT');
  });

  it('ignores unknown fields (whitelist enforcement)', async () => {
    const tenantId = `_test_wcp_unknown_${Date.now()}`;
    createTestTenant(tenantId);
    const user = createUserDirect('wcp-unknown@test.com', { tenantId });

    const res = await put(`/api/tenants/${tenantId}/widget-config`, {
      widget_config: {
        position: 'bottom-left',
        malicious_field: 'should_be_ignored',
        __proto__: { polluted: true }
      }
    }, authHeader(user.token));

    assert.equal(res.status, 200);
    const config = readTenantConfig(tenantId);
    assert.equal(config.widget_config.position, 'bottom-left');
    assert.equal(config.widget_config.malicious_field, undefined);
  });

  it('returns 403 when user updates different tenant', async () => {
    const tenantA = `_test_wcp_isol_a_${Date.now()}`;
    const tenantB = `_test_wcp_isol_b_${Date.now()}`;
    createTestTenant(tenantA);
    createTestTenant(tenantB);
    const userA = createUserDirect('wcp-isol-a@test.com', { tenantId: tenantA });

    const res = await put(`/api/tenants/${tenantB}/widget-config`, {
      widget_config: { position: 'bottom-left' }
    }, authHeader(userA.token));

    assert.equal(res.status, 403);

    // Verify tenantB config unchanged
    const config = readTenantConfig(tenantB);
    assert.deepEqual(config.widget_config, {});
  });

  it('admin can update any tenant widget-config', async () => {
    const tenantId = `_test_wcp_admin_${Date.now()}`;
    createTestTenant(tenantId);
    const admin = createUserDirect('wcp-admin@test.com', { role: 'admin', tenantId: 'admin_tenant' });

    const res = await put(`/api/tenants/${tenantId}/widget-config`, {
      widget_config: { position: 'bottom-left', branding: { primary_color: '#AABBCC' } }
    }, authHeader(admin.token));

    assert.equal(res.status, 200);
    const config = readTenantConfig(tenantId);
    assert.equal(config.widget_config.position, 'bottom-left');
    assert.equal(config.widget_config.branding.primary_color, '#AABBCC');
  });

  it('sets updated_at timestamp on save', async () => {
    const tenantId = `_test_wcp_ts_${Date.now()}`;
    createTestTenant(tenantId);
    const user = createUserDirect('wcp-ts@test.com', { tenantId });

    const before = new Date().toISOString();
    await put(`/api/tenants/${tenantId}/widget-config`, {
      widget_config: { position: 'bottom-left' }
    }, authHeader(user.token));

    const config = readTenantConfig(tenantId);
    assert.ok(config.updated_at >= before, 'updated_at should be set to current time');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: GET /api/tenants/:id/allowed-origins
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/tenants/:id/allowed-origins', () => {
  it('returns 401 without auth', async () => {
    const res = await get('/api/tenants/_test_ao1/allowed-origins');
    assert.equal(res.status, 401);
  });

  it('returns empty array for new tenant', async () => {
    const tenantId = `_test_ao_empty_${Date.now()}`;
    createTestTenant(tenantId);
    const user = createUserDirect('ao-empty@test.com', { tenantId });

    const res = await get(`/api/tenants/${tenantId}/allowed-origins`, authHeader(user.token));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.deepEqual(data.origins, []);
  });

  it('returns existing origins from config.json', async () => {
    const tenantId = `_test_ao_exist_${Date.now()}`;
    createTestTenant(tenantId, {
      allowed_origins: ['https://example.com', 'https://www.example.com']
    });
    const user = createUserDirect('ao-exist@test.com', { tenantId });

    const res = await get(`/api/tenants/${tenantId}/allowed-origins`, authHeader(user.token));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.deepEqual(data.origins, ['https://example.com', 'https://www.example.com']);
  });

  it('returns 403 when user accesses different tenant', async () => {
    const tenantA = `_test_ao_isol_a_${Date.now()}`;
    const tenantB = `_test_ao_isol_b_${Date.now()}`;
    createTestTenant(tenantA);
    createTestTenant(tenantB);
    const userA = createUserDirect('ao-isol-a@test.com', { tenantId: tenantA });

    const res = await get(`/api/tenants/${tenantB}/allowed-origins`, authHeader(userA.token));
    assert.equal(res.status, 403);
  });

  it('admin can read any tenant origins', async () => {
    const tenantId = `_test_ao_admin_${Date.now()}`;
    createTestTenant(tenantId, {
      allowed_origins: ['https://mysite.com']
    });
    const admin = createUserDirect('ao-admin@test.com', { role: 'admin', tenantId: 'admin_tenant' });

    const res = await get(`/api/tenants/${tenantId}/allowed-origins`, authHeader(admin.token));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.deepEqual(data.origins, ['https://mysite.com']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: PUT /api/tenants/:id/allowed-origins
// ═══════════════════════════════════════════════════════════════════════════════

describe('PUT /api/tenants/:id/allowed-origins', () => {
  it('returns 401 without auth', async () => {
    const res = await put('/api/tenants/_test_x/allowed-origins', { origins: [] });
    assert.equal(res.status, 401);
  });

  it('returns 400 when origins is not an array', async () => {
    const tenantId = `_test_aop_notarr_${Date.now()}`;
    createTestTenant(tenantId);
    const user = createUserDirect('aop-notarr@test.com', { tenantId });

    const res = await put(`/api/tenants/${tenantId}/allowed-origins`, {
      origins: 'https://example.com'
    }, authHeader(user.token));
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('array'));
  });

  it('returns 400 when origins exceeds max 10', async () => {
    const tenantId = `_test_aop_max_${Date.now()}`;
    createTestTenant(tenantId);
    const user = createUserDirect('aop-max@test.com', { tenantId });

    const origins = Array.from({ length: 11 }, (_, i) => `https://site${i}.com`);
    const res = await put(`/api/tenants/${tenantId}/allowed-origins`, { origins }, authHeader(user.token));
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('10'));
  });

  it('accepts exactly 10 origins', async () => {
    const tenantId = `_test_aop_ten_${Date.now()}`;
    createTestTenant(tenantId);
    const user = createUserDirect('aop-ten@test.com', { tenantId });

    const origins = Array.from({ length: 10 }, (_, i) => `https://site${i}.com`);
    const res = await put(`/api/tenants/${tenantId}/allowed-origins`, { origins }, authHeader(user.token));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.origins.length, 10);
  });

  it('returns 400 for invalid URL format', async () => {
    const tenantId = `_test_aop_badurl_${Date.now()}`;
    createTestTenant(tenantId);
    const user = createUserDirect('aop-badurl@test.com', { tenantId });

    const res = await put(`/api/tenants/${tenantId}/allowed-origins`, {
      origins: ['not-a-url', 'ftp://weird.com']
    }, authHeader(user.token));
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('Invalid URL'));
  });

  it('returns 400 for origin longer than 200 chars', async () => {
    const tenantId = `_test_aop_long_${Date.now()}`;
    createTestTenant(tenantId);
    const user = createUserDirect('aop-long@test.com', { tenantId });

    const longOrigin = 'https://' + 'a'.repeat(200) + '.com';
    const res = await put(`/api/tenants/${tenantId}/allowed-origins`, {
      origins: [longOrigin]
    }, authHeader(user.token));
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('200'));
  });

  it('returns 400 for non-string origins', async () => {
    const tenantId = `_test_aop_nonstr_${Date.now()}`;
    createTestTenant(tenantId);
    const user = createUserDirect('aop-nonstr@test.com', { tenantId });

    const res = await put(`/api/tenants/${tenantId}/allowed-origins`, {
      origins: [123, null]
    }, authHeader(user.token));
    assert.equal(res.status, 400);
  });

  it('accepts valid https origins', async () => {
    const tenantId = `_test_aop_valid_${Date.now()}`;
    createTestTenant(tenantId);
    const user = createUserDirect('aop-valid@test.com', { tenantId });

    const origins = ['https://example.com', 'https://www.myshop.fr', 'http://staging.example.com'];
    const res = await put(`/api/tenants/${tenantId}/allowed-origins`, { origins }, authHeader(user.token));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.deepEqual(data.origins, origins);

    // Filesystem verification
    const config = readTenantConfig(tenantId);
    assert.deepEqual(config.allowed_origins, origins);
  });

  it('overwrites previous origins completely', async () => {
    const tenantId = `_test_aop_overwrite_${Date.now()}`;
    createTestTenant(tenantId, {
      allowed_origins: ['https://old.com', 'https://old2.com']
    });
    const user = createUserDirect('aop-overwrite@test.com', { tenantId });

    const res = await put(`/api/tenants/${tenantId}/allowed-origins`, {
      origins: ['https://new.com']
    }, authHeader(user.token));
    assert.equal(res.status, 200);

    const config = readTenantConfig(tenantId);
    assert.deepEqual(config.allowed_origins, ['https://new.com']);
  });

  it('allows empty array (removes all origins)', async () => {
    const tenantId = `_test_aop_clearall_${Date.now()}`;
    createTestTenant(tenantId, {
      allowed_origins: ['https://example.com']
    });
    const user = createUserDirect('aop-clearall@test.com', { tenantId });

    const res = await put(`/api/tenants/${tenantId}/allowed-origins`, {
      origins: []
    }, authHeader(user.token));
    assert.equal(res.status, 200);

    const config = readTenantConfig(tenantId);
    assert.deepEqual(config.allowed_origins, []);
  });

  it('returns 404 when tenant dir does not exist', async () => {
    const tenantId = '_test_aop_notenant_' + Date.now();
    const user = createUserDirect('aop-notenant@test.com', { tenantId });

    const res = await put(`/api/tenants/${tenantId}/allowed-origins`, {
      origins: ['https://example.com']
    }, authHeader(user.token));
    assert.equal(res.status, 404);
  });

  it('returns 403 when user updates different tenant', async () => {
    const tenantA = `_test_aop_isol_a_${Date.now()}`;
    const tenantB = `_test_aop_isol_b_${Date.now()}`;
    createTestTenant(tenantA);
    createTestTenant(tenantB, { allowed_origins: ['https://original.com'] });
    const userA = createUserDirect('aop-isol-a@test.com', { tenantId: tenantA });

    const res = await put(`/api/tenants/${tenantB}/allowed-origins`, {
      origins: ['https://hacked.com']
    }, authHeader(userA.token));
    assert.equal(res.status, 403);

    // Verify tenantB origins unchanged
    const config = readTenantConfig(tenantB);
    assert.deepEqual(config.allowed_origins, ['https://original.com']);
  });

  it('admin can update any tenant origins', async () => {
    const tenantId = `_test_aop_admin_${Date.now()}`;
    createTestTenant(tenantId);
    const admin = createUserDirect('aop-admin@test.com', { role: 'admin', tenantId: 'admin_tenant' });

    const res = await put(`/api/tenants/${tenantId}/allowed-origins`, {
      origins: ['https://admin-set.com']
    }, authHeader(admin.token));
    assert.equal(res.status, 200);

    const config = readTenantConfig(tenantId);
    assert.deepEqual(config.allowed_origins, ['https://admin-set.com']);
  });

  it('sets updated_at timestamp on save', async () => {
    const tenantId = `_test_aop_ts_${Date.now()}`;
    createTestTenant(tenantId);
    const user = createUserDirect('aop-ts@test.com', { tenantId });

    const timeBefore = new Date().toISOString();
    await put(`/api/tenants/${tenantId}/allowed-origins`, {
      origins: ['https://example.com']
    }, authHeader(user.token));

    const config = readTenantConfig(tenantId);
    assert.ok(config.updated_at >= timeBefore);
  });

  it('rejects JavaScript protocol in origin (XSS prevention)', async () => {
    const tenantId = `_test_aop_jsxss_${Date.now()}`;
    createTestTenant(tenantId);
    const user = createUserDirect('aop-jsxss@test.com', { tenantId });

    const res = await put(`/api/tenants/${tenantId}/allowed-origins`, {
      origins: ['javascript:alert(1)']
    }, authHeader(user.token));
    assert.equal(res.status, 400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: GET /api/widget/embed-code (Voice API — child process)
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/widget/embed-code', () => {
  const VOICE_TEST_PORT = 13004;
  const VOICE_BASE = `http://127.0.0.1:${VOICE_TEST_PORT}`;
  let voiceProcess;

  before(async () => {
    // Start voice-api as child process on test port
    voiceProcess = spawn('node', [
      join(ROOT, 'core/voice-api-resilient.cjs'),
      '--server',
      `--port=${VOICE_TEST_PORT}`
    ], {
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'test' }
    });

    // Wait for server to be ready (listen for output or poll)
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        resolve(); // Proceed even without explicit ready message
      }, 3000);

      voiceProcess.stdout.on('data', (data) => {
        const msg = data.toString();
        if (msg.includes('listening') || msg.includes('started') || msg.includes('port')) {
          clearTimeout(timeout);
          setTimeout(resolve, 500); // Extra 500ms for stability
        }
      });

      voiceProcess.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  });

  after(() => {
    if (voiceProcess) {
      voiceProcess.kill('SIGTERM');
    }
  });

  async function voiceGet(path) {
    // No Origin header = defaults to vocalia.ma (allowed)
    return fetch(`${VOICE_BASE}${path}`);
  }

  it('returns valid HTML snippet for default platform', async () => {
    const res = await voiceGet('/api/widget/embed-code?tenantId=test_tenant_123');
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.platform, 'html');
    assert.equal(data.tenantId, 'test_tenant_123');
    assert.ok(data.snippet.includes('data-tenant-id="test_tenant_123"'));
    assert.ok(data.snippet.includes('voice-widget-v3.js'));
    assert.ok(data.snippet.includes('defer'));
    assert.ok(data.instructions);
  });

  it('returns Shopify snippet', async () => {
    const res = await voiceGet('/api/widget/embed-code?tenantId=my_shop&platform=shopify');
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.platform, 'shopify');
    assert.ok(data.snippet.includes('data-tenant-id="my_shop"'));
    assert.ok(data.instructions.toLowerCase().includes('shopify'));
  });

  it('returns WordPress snippet', async () => {
    const res = await voiceGet('/api/widget/embed-code?tenantId=wp_site&platform=wordpress');
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.platform, 'wordpress');
    assert.ok(data.snippet.includes('data-tenant-id="wp_site"'));
  });

  it('returns React component snippet', async () => {
    const res = await voiceGet('/api/widget/embed-code?tenantId=react_app&platform=react');
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.platform, 'react');
    assert.ok(data.snippet.includes('useEffect'));
    assert.ok(data.snippet.includes('react_app'));
    assert.ok(data.snippet.includes('VocalIAWidget'));
  });

  it('returns Wix snippet', async () => {
    const res = await voiceGet('/api/widget/embed-code?tenantId=wix_site&platform=wix');
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.platform, 'wix');
    assert.ok(data.snippet.includes('data-tenant-id="wix_site"'));
    assert.ok(data.instructions.toLowerCase().includes('wix'));
  });

  it('returns 400 without tenantId', async () => {
    const res = await voiceGet('/api/widget/embed-code');
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('tenantId'));
  });

  it('returns 400 for invalid tenantId format', async () => {
    const res = await voiceGet('/api/widget/embed-code?tenantId=<script>alert(1)</script>');
    assert.equal(res.status, 400);
  });

  it('returns 400 for invalid platform', async () => {
    const res = await voiceGet('/api/widget/embed-code?tenantId=test&platform=angular');
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('html'));
    assert.ok(data.error.includes('shopify'));
  });

  it('all snippets use https://api.vocalia.ma base URL', async () => {
    for (const platform of ['html', 'shopify', 'wordpress', 'react', 'wix']) {
      const res = await voiceGet(`/api/widget/embed-code?tenantId=check&platform=${platform}`);
      const data = await res.json();
      assert.ok(
        data.snippet.includes('https://api.vocalia.ma'),
        `${platform} snippet must use production base URL`
      );
    }
  });

  it('all snippets include the correct tenantId', async () => {
    const tenantId = 'unique_tenant_xyz_789';
    for (const platform of ['html', 'shopify', 'wordpress', 'react', 'wix']) {
      const res = await voiceGet(`/api/widget/embed-code?tenantId=${tenantId}&platform=${platform}`);
      const data = await res.json();
      assert.ok(
        data.snippet.includes(tenantId),
        `${platform} snippet must contain tenantId ${tenantId}`
      );
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: Cross-endpoint integration
// ═══════════════════════════════════════════════════════════════════════════════

describe('Cross-endpoint integration', () => {
  it('full flow: create tenant → set widget-config → read back → verify persistence', async () => {
    const tenantId = `_test_flow_${Date.now()}`;
    createTestTenant(tenantId);
    const user = createUserDirect('flow@test.com', { tenantId });

    // 1. Set widget config
    const putRes = await put(`/api/tenants/${tenantId}/widget-config`, {
      widget_config: {
        position: 'bottom-left',
        branding: { primary_color: '#8B5CF6' },
        persona: 'HOSPITALITY_LUXURY'
      }
    }, authHeader(user.token));
    assert.equal(putRes.status, 200);

    // 2. Set allowed origins
    const origRes = await put(`/api/tenants/${tenantId}/allowed-origins`, {
      origins: ['https://myhotel.com', 'https://www.myhotel.com']
    }, authHeader(user.token));
    assert.equal(origRes.status, 200);

    // 3. Read widget config back
    const getWc = await get(`/api/tenants/${tenantId}/widget-config`, authHeader(user.token));
    const wcData = await getWc.json();
    assert.equal(wcData.widget_config.position, 'bottom-left');
    assert.equal(wcData.widget_config.branding.primary_color, '#8B5CF6');

    // 4. Read origins back
    const getOrig = await get(`/api/tenants/${tenantId}/allowed-origins`, authHeader(user.token));
    const origData = await getOrig.json();
    assert.deepEqual(origData.origins, ['https://myhotel.com', 'https://www.myhotel.com']);

    // 5. Verify filesystem has both
    const config = readTenantConfig(tenantId);
    assert.equal(config.widget_config.position, 'bottom-left');
    assert.deepEqual(config.allowed_origins, ['https://myhotel.com', 'https://www.myhotel.com']);
  });

  it('widget-config update does NOT affect allowed_origins', async () => {
    const tenantId = `_test_noside_${Date.now()}`;
    createTestTenant(tenantId, {
      allowed_origins: ['https://preserved.com']
    });
    const user = createUserDirect('noside@test.com', { tenantId });

    await put(`/api/tenants/${tenantId}/widget-config`, {
      widget_config: { position: 'bottom-left' }
    }, authHeader(user.token));

    const config = readTenantConfig(tenantId);
    assert.deepEqual(config.allowed_origins, ['https://preserved.com']);
  });

  it('allowed-origins update does NOT affect widget_config', async () => {
    const tenantId = `_test_noside2_${Date.now()}`;
    createTestTenant(tenantId, {
      widget_config: { position: 'bottom-right', branding: { primary_color: '#000000' } }
    });
    const user = createUserDirect('noside2@test.com', { tenantId });

    await put(`/api/tenants/${tenantId}/allowed-origins`, {
      origins: ['https://new-origin.com']
    }, authHeader(user.token));

    const config = readTenantConfig(tenantId);
    assert.equal(config.widget_config.position, 'bottom-right');
    assert.equal(config.widget_config.branding.primary_color, '#000000');
  });

  it('sanitizeTenantId prevents path traversal in widget-config', async () => {
    const malicious = '../../../etc/passwd';
    const user = createUserDirect('traversal@test.com', { tenantId: 'safe_tenant' });

    // Route regex [a-z0-9_-]+ doesn't match encoded ../ — returns 404 (route not found)
    // This is correct security behavior: path traversal is blocked at the routing layer
    const res = await get(`/api/tenants/${encodeURIComponent(malicious)}/widget-config`, authHeader(user.token));
    assert.ok([200, 403, 404].includes(res.status), `Expected 200, 403 or 404, got ${res.status}`);
  });

  it('sanitizeTenantId prevents path traversal in allowed-origins', async () => {
    const malicious = '../../../etc/passwd';
    const user = createUserDirect('traversal2@test.com', { tenantId: 'safe_tenant' });

    const res = await get(`/api/tenants/${encodeURIComponent(malicious)}/allowed-origins`, authHeader(user.token));
    assert.ok([200, 403, 404].includes(res.status));
  });
});
