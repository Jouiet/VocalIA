/**
 * VocalIA GoogleSheetsDB Tests
 *
 * Tests:
 * - SCHEMAS (7 tables: tenants, sessions, logs, users, auth_sessions, hitl_pending, hitl_history)
 * - Schema structure (columns, required, defaults)
 * - GoogleSheetsDB constructor (cache, cacheTTL, maxRetries, initialized, locks)
 * - generateId() (format, uniqueness)
 * - timestamp() (ISO format)
 * - cacheKey() (sheet + query serialization)
 * - getCache() / setCache() (cache hit, miss, TTL expiry)
 * - invalidateCache() (prefix-based deletion)
 * - validate() (required fields, unknown sheet)
 * - applyDefaults() (merge defaults, auto-ID, auto-timestamps)
 * - rowToObject() / objectToRow() (bidirectional conversion)
 * - getDB() singleton
 *
 * NOTE: Does NOT call Google Sheets API. Tests pure logic only.
 *
 * Run: node --test test/google-sheets-db.test.mjs
 */



import { test, describe } from 'node:test';
import assert from 'node:assert';
import { GoogleSheetsDB, getDB, SCHEMAS, columnLetter, sheetRange } from '../core/GoogleSheetsDB.cjs';

// ─── SCHEMAS ────────────────────────────────────────────────────

describe('GoogleSheetsDB SCHEMAS', () => {
  test('has 7 table schemas', () => {
    assert.strictEqual(Object.keys(SCHEMAS).length, 7);
  });

  test('has tenants schema', () => {
    assert.ok(SCHEMAS.tenants);
    assert.ok(Array.isArray(SCHEMAS.tenants.columns));
    assert.ok(Array.isArray(SCHEMAS.tenants.required));
    assert.ok(typeof SCHEMAS.tenants.defaults === 'object');
  });

  test('has sessions schema', () => {
    assert.ok(SCHEMAS.sessions);
    assert.ok(SCHEMAS.sessions.columns.includes('tenant_id'));
  });

  test('has logs schema', () => {
    assert.ok(SCHEMAS.logs);
    assert.ok(SCHEMAS.logs.columns.includes('level'));
    assert.ok(SCHEMAS.logs.columns.includes('message'));
  });

  test('has users schema', () => {
    assert.ok(SCHEMAS.users);
    assert.ok(SCHEMAS.users.columns.includes('email'));
    assert.ok(SCHEMAS.users.columns.includes('password_hash'));
  });

  test('has auth_sessions schema', () => {
    assert.ok(SCHEMAS.auth_sessions);
    assert.ok(SCHEMAS.auth_sessions.columns.includes('user_id'));
    assert.ok(SCHEMAS.auth_sessions.columns.includes('refresh_token_hash'));
  });

  test('has hitl_pending schema', () => {
    assert.ok(SCHEMAS.hitl_pending);
    assert.ok(SCHEMAS.hitl_pending.columns.includes('type'));
    assert.ok(SCHEMAS.hitl_pending.columns.includes('tenant'));
  });

  test('has hitl_history schema', () => {
    assert.ok(SCHEMAS.hitl_history);
    assert.ok(SCHEMAS.hitl_history.columns.includes('decision'));
    assert.ok(SCHEMAS.hitl_history.columns.includes('decided_by'));
  });
});

// ─── Schema structure details ───────────────────────────────────

describe('GoogleSheetsDB schema details', () => {
  test('tenants requires name and email', () => {
    assert.deepStrictEqual(SCHEMAS.tenants.required, ['name', 'email']);
  });

  test('tenants has multi-tenant persona fields', () => {
    const cols = SCHEMAS.tenants.columns;
    assert.ok(cols.includes('business_name'));
    assert.ok(cols.includes('sector'));
    assert.ok(cols.includes('widget_type'));
    assert.ok(cols.includes('currency'));
    assert.ok(cols.includes('knowledge_base_id'));
  });

  test('tenants defaults include plan=trial, status=active', () => {
    assert.strictEqual(SCHEMAS.tenants.defaults.plan, 'trial');
    assert.strictEqual(SCHEMAS.tenants.defaults.status, 'active');
  });

  test('tenants defaults include widget_type=B2C, currency=EUR', () => {
    assert.strictEqual(SCHEMAS.tenants.defaults.widget_type, 'B2C');
    assert.strictEqual(SCHEMAS.tenants.defaults.currency, 'EUR');
  });

  test('tenants defaults include sector=UNIVERSAL_SME', () => {
    assert.strictEqual(SCHEMAS.tenants.defaults.sector, 'UNIVERSAL_SME');
  });

  test('sessions requires tenant_id', () => {
    assert.deepStrictEqual(SCHEMAS.sessions.required, ['tenant_id']);
  });

  test('sessions defaults include calls=1, lang=fr', () => {
    assert.strictEqual(SCHEMAS.sessions.defaults.calls, 1);
    assert.strictEqual(SCHEMAS.sessions.defaults.lang, 'fr');
  });

  test('logs requires level and message', () => {
    assert.deepStrictEqual(SCHEMAS.logs.required, ['level', 'message']);
  });

  test('users requires email and password_hash', () => {
    assert.deepStrictEqual(SCHEMAS.users.required, ['email', 'password_hash']);
  });

  test('users defaults include role=user, email_verified=false', () => {
    assert.strictEqual(SCHEMAS.users.defaults.role, 'user');
    assert.strictEqual(SCHEMAS.users.defaults.email_verified, false);
  });

  test('hitl_pending defaults include score=0', () => {
    assert.strictEqual(SCHEMAS.hitl_pending.defaults.score, 0);
  });

  test('all schemas have columns array', () => {
    for (const [name, schema] of Object.entries(SCHEMAS)) {
      assert.ok(Array.isArray(schema.columns), `${name} missing columns`);
      assert.ok(schema.columns.length > 0, `${name} has empty columns`);
    }
  });

  test('all schemas have required array', () => {
    for (const [name, schema] of Object.entries(SCHEMAS)) {
      assert.ok(Array.isArray(schema.required), `${name} missing required`);
    }
  });

  test('all schemas have defaults object', () => {
    for (const [name, schema] of Object.entries(SCHEMAS)) {
      assert.strictEqual(typeof schema.defaults, 'object', `${name} missing defaults`);
    }
  });
});

// ─── Constructor ────────────────────────────────────────────────

describe('GoogleSheetsDB constructor', () => {
  test('creates instance with default options', () => {
    const db = new GoogleSheetsDB();
    assert.ok(db);
    assert.strictEqual(db.cacheTTL, 60000);
    assert.strictEqual(db.maxRetries, 3);
    assert.strictEqual(db.initialized, false);
  });

  test('accepts custom cacheTTL', () => {
    const db = new GoogleSheetsDB({ cacheTTL: 30000 });
    assert.strictEqual(db.cacheTTL, 30000);
  });

  test('accepts custom maxRetries', () => {
    const db = new GoogleSheetsDB({ maxRetries: 5 });
    assert.strictEqual(db.maxRetries, 5);
  });

  test('has empty cache Map', () => {
    const db = new GoogleSheetsDB();
    assert.ok(db.cache instanceof Map);
    assert.strictEqual(db.cache.size, 0);
  });

  test('has empty locks Map', () => {
    const db = new GoogleSheetsDB();
    assert.ok(db.locks instanceof Map);
    assert.strictEqual(db.locks.size, 0);
  });

  test('config is null before init', () => {
    const db = new GoogleSheetsDB();
    assert.strictEqual(db.config, null);
  });

  test('auth is null before init', () => {
    const db = new GoogleSheetsDB();
    assert.strictEqual(db.auth, null);
  });

  test('sheets is null before init', () => {
    const db = new GoogleSheetsDB();
    assert.strictEqual(db.sheets, null);
  });
});

// ─── generateId ─────────────────────────────────────────────────

describe('GoogleSheetsDB generateId', () => {
  test('returns a string', () => {
    const db = new GoogleSheetsDB();
    assert.strictEqual(typeof db.generateId(), 'string');
  });

  test('returns non-empty string', () => {
    const db = new GoogleSheetsDB();
    assert.ok(db.generateId().length > 0);
  });

  test('returns 8-character hex string (UUID first segment)', () => {
    const db = new GoogleSheetsDB();
    const id = db.generateId();
    assert.strictEqual(id.length, 8);
    assert.ok(/^[0-9a-f]{8}$/.test(id));
  });

  test('generates unique IDs', () => {
    const db = new GoogleSheetsDB();
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      ids.add(db.generateId());
    }
    assert.strictEqual(ids.size, 100);
  });
});

// ─── timestamp ──────────────────────────────────────────────────

describe('GoogleSheetsDB timestamp', () => {
  test('returns ISO string', () => {
    const db = new GoogleSheetsDB();
    const ts = db.timestamp();
    assert.ok(new Date(ts).getTime() > 0);
  });

  test('contains T separator', () => {
    const db = new GoogleSheetsDB();
    assert.ok(db.timestamp().includes('T'));
  });

  test('ends with Z (UTC)', () => {
    const db = new GoogleSheetsDB();
    assert.ok(db.timestamp().endsWith('Z'));
  });
});

// ─── cacheKey ───────────────────────────────────────────────────

describe('GoogleSheetsDB cacheKey', () => {
  test('returns sheet:all for no query', () => {
    const db = new GoogleSheetsDB();
    assert.strictEqual(db.cacheKey('tenants'), 'tenants:all');
  });

  test('returns sheet:null for null query', () => {
    const db = new GoogleSheetsDB();
    assert.strictEqual(db.cacheKey('tenants', null), 'tenants:all');
  });

  test('serializes query to JSON', () => {
    const db = new GoogleSheetsDB();
    const key = db.cacheKey('tenants', { email: 'test@test.com' });
    assert.strictEqual(key, 'tenants:{"email":"test@test.com"}');
  });
});

// ─── getCache / setCache ────────────────────────────────────────

describe('GoogleSheetsDB cache operations', () => {
  test('returns null for missing key', () => {
    const db = new GoogleSheetsDB();
    assert.strictEqual(db.getCache('nonexistent'), null);
  });

  test('setCache + getCache round-trip', () => {
    const db = new GoogleSheetsDB();
    const data = [{ id: '1', name: 'Test' }];
    db.setCache('test-key', data);
    const result = db.getCache('test-key');
    assert.deepStrictEqual(result, data);
  });

  test('cache expires after TTL', () => {
    const db = new GoogleSheetsDB({ cacheTTL: 1 }); // 1ms TTL
    db.setCache('expire-key', [1, 2, 3]);
    // Wait for TTL to expire
    const start = Date.now();
    while (Date.now() - start < 5) {} // busy-wait 5ms
    assert.strictEqual(db.getCache('expire-key'), null);
  });

  test('cache valid within TTL', () => {
    const db = new GoogleSheetsDB({ cacheTTL: 60000 }); // 60s TTL
    db.setCache('valid-key', { test: true });
    assert.deepStrictEqual(db.getCache('valid-key'), { test: true });
  });
});

// ─── invalidateCache ────────────────────────────────────────────

describe('GoogleSheetsDB invalidateCache', () => {
  test('removes all cache entries for sheet', () => {
    const db = new GoogleSheetsDB();
    db.setCache('tenants:all', [1]);
    db.setCache('tenants:{"email":"a@b"}', [2]);
    db.setCache('sessions:all', [3]);

    db.invalidateCache('tenants');

    assert.strictEqual(db.getCache('tenants:all'), null);
    assert.strictEqual(db.getCache('tenants:{"email":"a@b"}'), null);
    // sessions untouched
    assert.deepStrictEqual(db.getCache('sessions:all'), [3]);
  });
});

// ─── validate ───────────────────────────────────────────────────

describe('GoogleSheetsDB validate', () => {
  test('passes when required fields present', () => {
    const db = new GoogleSheetsDB();
    assert.strictEqual(db.validate('tenants', { name: 'Test', email: 'a@b.com' }), true);
  });

  test('throws on missing required field', () => {
    const db = new GoogleSheetsDB();
    assert.throws(() => {
      db.validate('tenants', { name: 'Test' }); // missing email
    }, /Missing required field: email/);
  });

  test('throws on empty string required field', () => {
    const db = new GoogleSheetsDB();
    assert.throws(() => {
      db.validate('tenants', { name: 'Test', email: '' });
    }, /Missing required field: email/);
  });

  test('throws on null required field', () => {
    const db = new GoogleSheetsDB();
    assert.throws(() => {
      db.validate('tenants', { name: 'Test', email: null });
    }, /Missing required field: email/);
  });

  test('throws for unknown sheet', () => {
    const db = new GoogleSheetsDB();
    assert.throws(() => {
      db.validate('nonexistent', { foo: 'bar' });
    }, /Unknown sheet: nonexistent/);
  });

  test('validates sessions with tenant_id', () => {
    const db = new GoogleSheetsDB();
    assert.strictEqual(db.validate('sessions', { tenant_id: 'abc' }), true);
  });

  test('validates users with email and password_hash', () => {
    const db = new GoogleSheetsDB();
    assert.strictEqual(db.validate('users', { email: 'a@b.com', password_hash: 'hash123' }), true);
  });
});

// ─── applyDefaults ──────────────────────────────────────────────

describe('GoogleSheetsDB applyDefaults', () => {
  test('merges schema defaults', () => {
    const db = new GoogleSheetsDB();
    const result = db.applyDefaults('tenants', { name: 'Test', email: 'a@b.com' });
    assert.strictEqual(result.plan, 'trial');
    assert.strictEqual(result.status, 'active');
    assert.strictEqual(result.currency, 'EUR');
  });

  test('user data overrides defaults', () => {
    const db = new GoogleSheetsDB();
    const result = db.applyDefaults('tenants', { name: 'Test', email: 'a@b.com', plan: 'pro' });
    assert.strictEqual(result.plan, 'pro');
  });

  test('auto-generates ID if not provided', () => {
    const db = new GoogleSheetsDB();
    const result = db.applyDefaults('tenants', { name: 'Test', email: 'a@b.com' });
    assert.ok(result.id);
    assert.strictEqual(result.id.length, 8);
  });

  test('preserves provided ID', () => {
    const db = new GoogleSheetsDB();
    const result = db.applyDefaults('tenants', { id: 'custom-id', name: 'Test', email: 'a@b.com' });
    assert.strictEqual(result.id, 'custom-id');
  });

  test('auto-sets created_at', () => {
    const db = new GoogleSheetsDB();
    const result = db.applyDefaults('tenants', { name: 'Test', email: 'a@b.com' });
    assert.ok(result.created_at);
    assert.ok(new Date(result.created_at).getTime() > 0);
  });

  test('auto-sets updated_at', () => {
    const db = new GoogleSheetsDB();
    const result = db.applyDefaults('tenants', { name: 'Test', email: 'a@b.com' });
    assert.ok(result.updated_at);
  });

  test('auto-sets timestamp for sessions', () => {
    const db = new GoogleSheetsDB();
    const result = db.applyDefaults('sessions', { tenant_id: 'abc' });
    assert.ok(result.timestamp);
  });

  test('sessions defaults: calls=1, lang=fr', () => {
    const db = new GoogleSheetsDB();
    const result = db.applyDefaults('sessions', { tenant_id: 'abc' });
    assert.strictEqual(result.calls, 1);
    assert.strictEqual(result.lang, 'fr');
  });
});

// ─── rowToObject / objectToRow ──────────────────────────────────

describe('GoogleSheetsDB rowToObject', () => {
  test('converts row array to object', () => {
    const db = new GoogleSheetsDB();
    const cols = SCHEMAS.logs.columns; // ['timestamp', 'level', 'service', 'message', 'details']
    const row = ['2026-02-06T00:00:00Z', 'info', 'vocalia', 'Test message', '{}'];
    const obj = db.rowToObject('logs', row);
    assert.strictEqual(obj.timestamp, '2026-02-06T00:00:00Z');
    assert.strictEqual(obj.level, 'info');
    assert.strictEqual(obj.service, 'vocalia');
    assert.strictEqual(obj.message, 'Test message');
  });

  test('fills missing columns with null', () => {
    const db = new GoogleSheetsDB();
    const row = ['2026-02-06T00:00:00Z', 'error']; // only 2 values for 5 columns
    const obj = db.rowToObject('logs', row);
    assert.strictEqual(obj.service, null);
    assert.strictEqual(obj.message, null);
    assert.strictEqual(obj.details, null);
  });
});

describe('GoogleSheetsDB objectToRow', () => {
  test('converts object to row array', () => {
    const db = new GoogleSheetsDB();
    const obj = { timestamp: '2026-02-06', level: 'info', service: 'vocalia', message: 'test', details: '{}' };
    const row = db.objectToRow('logs', obj);
    assert.strictEqual(row.length, SCHEMAS.logs.columns.length);
    assert.strictEqual(row[0], '2026-02-06');
    assert.strictEqual(row[1], 'info');
    assert.strictEqual(row[3], 'test');
  });

  test('fills missing fields with empty string', () => {
    const db = new GoogleSheetsDB();
    const obj = { level: 'warn' };
    const row = db.objectToRow('logs', obj);
    assert.strictEqual(row[0], ''); // timestamp not set
    assert.strictEqual(row[1], 'warn');
    assert.strictEqual(row[2], ''); // service not set
  });

  test('round-trip preserves data', () => {
    const db = new GoogleSheetsDB();
    const original = { timestamp: 'ts1', level: 'info', service: 'svc', message: 'msg', details: 'det' };
    const row = db.objectToRow('logs', original);
    const restored = db.rowToObject('logs', row);
    assert.deepStrictEqual(restored, original);
  });
});

// ─── getDB singleton ────────────────────────────────────────────

describe('GoogleSheetsDB getDB', () => {
  test('returns a GoogleSheetsDB instance', () => {
    const db = getDB();
    assert.ok(db instanceof GoogleSheetsDB);
  });

  test('returns same instance on multiple calls', () => {
    const db1 = getDB();
    const db2 = getDB();
    assert.strictEqual(db1, db2);
  });
});

// ─── getUrl ──────────────────────────────────────────────────────

describe('GoogleSheetsDB getUrl', () => {
  test('returns null when config not set', () => {
    const db = new GoogleSheetsDB();
    assert.strictEqual(db.getUrl(), null);
  });

  test('returns url from config', () => {
    const db = new GoogleSheetsDB();
    db.config = { url: 'https://docs.google.com/spreadsheets/d/abc' };
    assert.strictEqual(db.getUrl(), 'https://docs.google.com/spreadsheets/d/abc');
  });

  test('returns null when config has no url', () => {
    const db = new GoogleSheetsDB();
    db.config = { spreadsheetId: 'abc' };
    assert.strictEqual(db.getUrl(), null);
  });
});

// ─── acquireLock ─────────────────────────────────────────────────

describe('GoogleSheetsDB acquireLock', () => {
  test('returns a release function', async () => {
    const db = new GoogleSheetsDB();
    const release = await db.acquireLock('tenants');
    assert.strictEqual(typeof release, 'function');
    release();
  });

  test('sets lock on sheet', async () => {
    const db = new GoogleSheetsDB();
    const release = await db.acquireLock('tenants');
    assert.ok(db.locks.has('tenants'));
    release();
  });

  test('clears lock on release', async () => {
    const db = new GoogleSheetsDB();
    const release = await db.acquireLock('tenants');
    release();
    assert.strictEqual(db.locks.has('tenants'), false);
  });

  test('different sheets can lock independently', async () => {
    const db = new GoogleSheetsDB();
    const release1 = await db.acquireLock('tenants');
    const release2 = await db.acquireLock('sessions');
    assert.ok(db.locks.has('tenants'));
    assert.ok(db.locks.has('sessions'));
    release1();
    release2();
  });
});

// ─── withRetry ──────────────────────────────────────────────────

describe('GoogleSheetsDB withRetry', () => {
  test('returns result on success', async () => {
    const db = new GoogleSheetsDB();
    const result = await db.withRetry(async () => 'success');
    assert.strictEqual(result, 'success');
  });

  test('throws on non-429 error immediately', async () => {
    const db = new GoogleSheetsDB();
    await assert.rejects(
      () => db.withRetry(async () => { throw new Error('bad request'); }),
      /bad request/
    );
  });
});

// ─── checkQuota (pure logic, no FS) ─────────────────────────────

describe('GoogleSheetsDB checkQuota (no config)', () => {
  test('denies unknown tenants (C10 security fix)', () => {
    const db = new GoogleSheetsDB();
    const result = db.checkQuota('nonexistent_tenant', 'calls');
    // C10 fix: Unknown tenants MUST be denied, not allowed with infinite quota
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.limit, 0);
    assert.ok(result.error);
  });

  test('denies unknown tenant even for invalid quota type', () => {
    const db = new GoogleSheetsDB();
    const result = db.checkQuota('nonexistent_tenant', 'invalid_type');
    // Unknown tenant is denied before quota type validation
    assert.strictEqual(result.allowed, false);
  });
});

// ─── incrementUsage (pure logic, no FS) ─────────────────────────

describe('GoogleSheetsDB incrementUsage (no config)', () => {
  test('returns success=false when no config found', () => {
    const db = new GoogleSheetsDB();
    const result = db.incrementUsage('nonexistent_tenant', 'calls');
    assert.strictEqual(result.success, false);
    assert.ok(result.error);
  });

  test('returns success=false for invalid usage type', () => {
    const db = new GoogleSheetsDB();
    const result = db.incrementUsage('nonexistent_tenant', 'invalid');
    assert.strictEqual(result.success, false);
  });
});

// ─── getQuotaStatus (pure logic, no FS) ─────────────────────────

describe('GoogleSheetsDB getQuotaStatus (no config)', () => {
  test('returns error when config not found', () => {
    const db = new GoogleSheetsDB();
    const result = db.getQuotaStatus('nonexistent_tenant');
    assert.ok(result.error);
    assert.strictEqual(result.tenantId, 'nonexistent_tenant');
  });
});

// ─── resetUsage ─────────────────────────────────────────────────

describe('GoogleSheetsDB resetUsage (no config)', () => {
  test('returns false when no config found', () => {
    const db = new GoogleSheetsDB();
    const result = db.resetUsage('nonexistent_tenant');
    assert.strictEqual(result, false);
  });
});

// ─── Schema column counts ───────────────────────────────────────

describe('GoogleSheetsDB schema column counts', () => {
  test('tenants has 27 columns (C8: +stripe_customer_id)', () => {
    assert.strictEqual(SCHEMAS.tenants.columns.length, 27);
    assert.ok(SCHEMAS.tenants.columns.includes('stripe_customer_id'));
  });

  test('sessions has 8 columns', () => {
    assert.strictEqual(SCHEMAS.sessions.columns.length, 8);
  });

  test('logs has 5 columns', () => {
    assert.strictEqual(SCHEMAS.logs.columns.length, 5);
  });

  test('users has 20 columns', () => {
    assert.strictEqual(SCHEMAS.users.columns.length, 20);
  });

  test('auth_sessions has 7 columns', () => {
    assert.strictEqual(SCHEMAS.auth_sessions.columns.length, 7);
  });

  test('hitl_pending has 8 columns', () => {
    assert.strictEqual(SCHEMAS.hitl_pending.columns.length, 8);
  });

  test('hitl_history has 11 columns', () => {
    assert.strictEqual(SCHEMAS.hitl_history.columns.length, 11);
  });
});

// ─── columnLetter / sheetRange (H7 fix) ──────────────────────────

describe('columnLetter (H7 fix: >26 column support)', () => {
  test('converts 1 to A', () => {
    assert.strictEqual(columnLetter(1), 'A');
  });

  test('converts 26 to Z', () => {
    assert.strictEqual(columnLetter(26), 'Z');
  });

  test('converts 27 to AA', () => {
    assert.strictEqual(columnLetter(27), 'AA');
  });

  test('converts 28 to AB', () => {
    assert.strictEqual(columnLetter(28), 'AB');
  });

  test('converts 52 to AZ', () => {
    assert.strictEqual(columnLetter(52), 'AZ');
  });

  test('converts 53 to BA', () => {
    assert.strictEqual(columnLetter(53), 'BA');
  });
});

describe('sheetRange', () => {
  test('tenants range covers 27 columns (A:AA)', () => {
    const range = sheetRange('tenants');
    assert.strictEqual(range, 'tenants!A:AA');
  });

  test('sessions range covers 8 columns (A:H)', () => {
    const range = sheetRange('sessions');
    assert.strictEqual(range, 'sessions!A:H');
  });

  test('unknown sheet falls back to A:Z', () => {
    const range = sheetRange('nonexistent');
    assert.strictEqual(range, 'nonexistent!A:Z');
  });
});

// NOTE: Exports are proven by behavioral tests above (GoogleSheetsDB, getDB, SCHEMAS,
// generateId, timestamp, cacheKey, validate, applyDefaults, acquireLock, checkQuota, columnLetter, sheetRange)
