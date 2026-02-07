/**
 * VocalIA Audit Store Tests
 *
 * Tests:
 * - Audit event logging with integrity hash
 * - Query with filters (action, actor, date range)
 * - Stats aggregation
 * - Resource type inference
 * - ACTION_CATEGORIES constant
 *
 * Run: node --test test/audit-store.test.mjs
 */



import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { AuditStore, ACTION_CATEGORIES } from '../core/audit-store.cjs';

const TEST_DIR = path.join(import.meta.dirname, '../data/audit/__test__');
const TENANT = '__test_audit_tenant__';

describe('ACTION_CATEGORIES', () => {
  test('has auth actions', () => {
    assert.strictEqual(ACTION_CATEGORIES.AUTH_LOGIN, 'auth.login');
    assert.strictEqual(ACTION_CATEGORIES.AUTH_LOGOUT, 'auth.logout');
    assert.strictEqual(ACTION_CATEGORIES.AUTH_FAILED, 'auth.failed');
  });

  test('has data actions', () => {
    assert.strictEqual(ACTION_CATEGORIES.DATA_READ, 'data.read');
    assert.strictEqual(ACTION_CATEGORIES.DATA_CREATE, 'data.create');
    assert.strictEqual(ACTION_CATEGORIES.DATA_UPDATE, 'data.update');
    assert.strictEqual(ACTION_CATEGORIES.DATA_DELETE, 'data.delete');
  });

  test('has voice actions', () => {
    assert.strictEqual(ACTION_CATEGORIES.VOICE_SESSION_START, 'voice.session_start');
    assert.strictEqual(ACTION_CATEGORIES.VOICE_SESSION_END, 'voice.session_end');
  });

  test('has HITL actions', () => {
    assert.strictEqual(ACTION_CATEGORIES.HITL_APPROVE, 'hitl.approve');
    assert.strictEqual(ACTION_CATEGORIES.HITL_REJECT, 'hitl.reject');
    assert.strictEqual(ACTION_CATEGORIES.HITL_ESCALATE, 'hitl.escalate');
  });

  test('has at least 20 action categories', () => {
    assert.ok(Object.keys(ACTION_CATEGORIES).length >= 20);
  });
});

describe('AuditStore Logging', () => {
  let store;

  beforeEach(() => {
    store = new AuditStore({ baseDir: TEST_DIR });
  });

  afterEach(() => {
    const tenantDir = path.join(TEST_DIR, TENANT);
    if (fs.existsSync(tenantDir)) {
      fs.rmSync(tenantDir, { recursive: true, force: true });
    }
  });

  test('log creates audit entry with all fields', () => {
    const entry = store.log(TENANT, {
      action: 'auth.login',
      actor: 'user_001',
      resource: 'session:abc123',
      ip: '192.168.1.1',
      outcome: 'success',
      details: { method: 'password' }
    });

    assert.ok(entry.id);
    assert.ok(entry.id.startsWith('audit_'));
    assert.ok(entry.timestamp);
    assert.strictEqual(entry.tenant_id, TENANT);
    assert.strictEqual(entry.action, 'auth.login');
    assert.strictEqual(entry.actor, 'user_001');
    assert.strictEqual(entry.resource, 'session:abc123');
    assert.strictEqual(entry.ip, '192.168.1.1');
    assert.strictEqual(entry.outcome, 'success');
    assert.strictEqual(entry.details.method, 'password');
  });

  test('log generates integrity hash', () => {
    const entry = store.log(TENANT, {
      action: 'data.read',
      actor: 'user_002'
    });
    assert.ok(entry.hash);
    assert.strictEqual(typeof entry.hash, 'string');
    assert.strictEqual(entry.hash.length, 16);
  });

  test('log defaults actor to system', () => {
    const entry = store.log(TENANT, { action: 'system.startup', actor: 'system' });
    assert.strictEqual(entry.actor, 'system');
    assert.strictEqual(entry.actor_type, 'system');
  });

  test('log defaults outcome to success', () => {
    const entry = store.log(TENANT, {
      action: 'data.read',
      actor: 'user_003'
    });
    assert.strictEqual(entry.outcome, 'success');
  });

  test('log writes to JSONL file', () => {
    store.log(TENANT, { action: 'auth.login', actor: 'u1' });
    store.log(TENANT, { action: 'auth.logout', actor: 'u1' });

    const auditPath = store.getAuditPath(TENANT);
    assert.ok(fs.existsSync(auditPath));
    const lines = fs.readFileSync(auditPath, 'utf8').trim().split('\n').filter(Boolean);
    assert.strictEqual(lines.length, 2);
  });

  test('inferResourceType extracts type from resource string', () => {
    assert.strictEqual(store.inferResourceType('session:abc'), 'session');
    assert.strictEqual(store.inferResourceType('user:123'), 'user');
    assert.strictEqual(store.inferResourceType(null), null);
  });
});

describe('AuditStore Query', () => {
  let store;

  beforeEach(() => {
    store = new AuditStore({ baseDir: TEST_DIR });
    // Seed test data
    store.log(TENANT, { action: 'auth.login', actor: 'admin', outcome: 'success' });
    store.log(TENANT, { action: 'auth.failed', actor: 'hacker', outcome: 'failure' });
    store.log(TENANT, { action: 'data.read', actor: 'admin', resource: 'user:001' });
    store.log(TENANT, { action: 'data.update', actor: 'manager', resource: 'user:001' });
    store.log(TENANT, { action: 'voice.session_start', actor: 'system' });
  });

  afterEach(() => {
    const tenantDir = path.join(TEST_DIR, TENANT);
    if (fs.existsSync(tenantDir)) {
      fs.rmSync(tenantDir, { recursive: true, force: true });
    }
  });

  test('query returns all entries without filters', () => {
    const entries = store.query(TENANT);
    assert.strictEqual(entries.length, 5);
  });

  test('query filters by action', () => {
    const entries = store.query(TENANT, { action: 'auth.login' });
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].action, 'auth.login');
  });

  test('query filters by actor', () => {
    const entries = store.query(TENANT, { actor: 'admin' });
    assert.strictEqual(entries.length, 2);
  });

  test('query filters by outcome', () => {
    const entries = store.query(TENANT, { outcome: 'failure' });
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].actor, 'hacker');
  });

  test('query filters by resource', () => {
    const entries = store.query(TENANT, { resource: 'user:001' });
    assert.strictEqual(entries.length, 2);
  });

  test('query respects limit', () => {
    const entries = store.query(TENANT, { limit: 3 });
    assert.strictEqual(entries.length, 3);
  });

  test('query returns newest first', () => {
    const entries = store.query(TENANT);
    for (let i = 1; i < entries.length; i++) {
      assert.ok(
        new Date(entries[i - 1].timestamp) >= new Date(entries[i].timestamp),
        'Should be sorted newest first'
      );
    }
  });

  test('query returns empty for nonexistent tenant', () => {
    const entries = store.query('__nobody__');
    assert.deepStrictEqual(entries, []);
    // Cleanup created dir
    const dir = path.join(TEST_DIR, '__nobody__');
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('AuditStore Stats', () => {
  let store;

  beforeEach(() => {
    store = new AuditStore({ baseDir: TEST_DIR });
    store.log(TENANT, { action: 'auth.login', actor: 'user1', outcome: 'success' });
    store.log(TENANT, { action: 'auth.login', actor: 'user2', outcome: 'success' });
    store.log(TENANT, { action: 'auth.failed', actor: 'hacker', outcome: 'failure' });
    store.log(TENANT, { action: 'data.read', actor: 'user1', outcome: 'success' });
  });

  afterEach(() => {
    const tenantDir = path.join(TEST_DIR, TENANT);
    if (fs.existsSync(tenantDir)) {
      fs.rmSync(tenantDir, { recursive: true, force: true });
    }
  });

  test('getStats returns total event count', () => {
    const stats = store.getStats(TENANT);
    assert.strictEqual(stats.total_events, 4);
    assert.strictEqual(stats.tenant_id, TENANT);
  });

  test('getStats aggregates by action', () => {
    const stats = store.getStats(TENANT);
    assert.strictEqual(stats.by_action['auth.login'], 2);
    assert.strictEqual(stats.by_action['auth.failed'], 1);
    assert.strictEqual(stats.by_action['data.read'], 1);
  });

  test('getStats aggregates by actor', () => {
    const stats = store.getStats(TENANT);
    assert.strictEqual(stats.by_actor['user1'], 2);
    assert.strictEqual(stats.by_actor['user2'], 1);
    assert.strictEqual(stats.by_actor['hacker'], 1);
  });

  test('getStats aggregates by outcome', () => {
    const stats = store.getStats(TENANT);
    assert.strictEqual(stats.by_outcome.success, 3);
    assert.strictEqual(stats.by_outcome.failure, 1);
  });

  test('getStats includes date range', () => {
    const stats = store.getStats(TENANT);
    assert.ok(stats.oldest);
    assert.ok(stats.newest);
  });
});
