/**
 * VocalIA Meta CAPI Gateway Tests
 *
 * Tests:
 * - _hash (SHA256 normalization)
 * - _generateEventId (deterministic dedup)
 * - _getRetryDelay (exponential backoff)
 * - _buildPayload (full payload construction)
 * - healthCheck (credential status)
 * - _send guard (missing credentials)
 *
 * NOTE: No real Meta API calls. Only tests offline logic.
 *
 * Run: node --test test/meta-capi.test.mjs
 */



import { test, describe } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import metaCapi from '../core/gateways/meta-capi-gateway.cjs';

describe('MetaCAPI _hash', () => {
  test('hashes lowercase trimmed string with SHA256', () => {
    const result = metaCapi._hash('Test@Example.COM ');
    const expected = crypto.createHash('sha256').update('test@example.com').digest('hex');
    assert.strictEqual(result, expected);
  });

  test('returns null for falsy value', () => {
    assert.strictEqual(metaCapi._hash(null), null);
    assert.strictEqual(metaCapi._hash(''), null);
    assert.strictEqual(metaCapi._hash(undefined), null);
  });

  test('produces 64-char hex string', () => {
    const result = metaCapi._hash('test');
    assert.strictEqual(result.length, 64);
    assert.ok(/^[a-f0-9]+$/.test(result));
  });

  test('is deterministic', () => {
    const h1 = metaCapi._hash('user@test.com');
    const h2 = metaCapi._hash('user@test.com');
    assert.strictEqual(h1, h2);
  });

  test('different inputs produce different hashes', () => {
    const h1 = metaCapi._hash('a@test.com');
    const h2 = metaCapi._hash('b@test.com');
    assert.notStrictEqual(h1, h2);
  });
});

describe('MetaCAPI _generateEventId', () => {
  test('returns 36-char hex string', () => {
    const id = metaCapi._generateEventId('Lead', { email: 'test@test.com' }, 1234567890);
    assert.strictEqual(id.length, 36);
    assert.ok(/^[a-f0-9]+$/.test(id));
  });

  test('is deterministic for same inputs', () => {
    const ts = Date.now();
    const id1 = metaCapi._generateEventId('Lead', { email: 'a@test.com' }, ts);
    const id2 = metaCapi._generateEventId('Lead', { email: 'a@test.com' }, ts);
    assert.strictEqual(id1, id2);
  });

  test('different event names produce different IDs', () => {
    const ts = Date.now();
    const id1 = metaCapi._generateEventId('Lead', { email: 'a@test.com' }, ts);
    const id2 = metaCapi._generateEventId('Purchase', { email: 'a@test.com' }, ts);
    assert.notStrictEqual(id1, id2);
  });

  test('uses phone when email absent', () => {
    const ts = Date.now();
    const id1 = metaCapi._generateEventId('Lead', { phone: '+212600000000' }, ts);
    const id2 = metaCapi._generateEventId('Lead', { phone: '+212600000001' }, ts);
    assert.notStrictEqual(id1, id2);
  });

  test('uses anon when no email or phone', () => {
    const ts = Date.now();
    const id = metaCapi._generateEventId('Lead', {}, ts);
    assert.ok(id.length > 0);
  });
});

describe('MetaCAPI _getRetryDelay', () => {
  test('attempt 0 returns ~1000ms base', () => {
    const delay = metaCapi._getRetryDelay(0);
    // 1000 * 2^0 = 1000, + jitter up to 500
    assert.ok(delay >= 1000 && delay <= 1500);
  });

  test('attempt 1 returns ~2000ms', () => {
    const delay = metaCapi._getRetryDelay(1);
    // 1000 * 2^1 = 2000, + jitter up to 500
    assert.ok(delay >= 2000 && delay <= 2500);
  });

  test('attempt 2 returns ~4000ms', () => {
    const delay = metaCapi._getRetryDelay(2);
    // 1000 * 2^2 = 4000, + jitter up to 500
    assert.ok(delay >= 4000 && delay <= 4500);
  });

  test('caps at maxDelayMs (10000)', () => {
    const delay = metaCapi._getRetryDelay(10);
    // min(1000 * 2^10, 10000) + jitter = 10000 + up to 500
    assert.ok(delay <= 10500);
  });

  test('includes jitter (not perfectly deterministic)', () => {
    // Run multiple times, at least one should differ
    const delays = [];
    for (let i = 0; i < 10; i++) {
      delays.push(metaCapi._getRetryDelay(0));
    }
    const unique = new Set(delays);
    // With random jitter, very unlikely all 10 are identical
    assert.ok(unique.size > 1, 'Expected jitter to produce varying delays');
  });
});

describe('MetaCAPI _buildPayload', () => {
  test('builds valid Lead payload', () => {
    const payload = metaCapi._buildPayload('Lead', {
      email: 'user@test.com',
      phone: '+212600000000'
    }, { value: 100, currency: 'MAD' });

    assert.ok(payload.data);
    assert.strictEqual(payload.data.length, 1);
    assert.strictEqual(payload.data[0].event_name, 'Lead');
    assert.strictEqual(payload.data[0].action_source, 'website');
  });

  test('hashes user data (em, ph)', () => {
    const payload = metaCapi._buildPayload('Lead', {
      email: 'user@test.com',
      phone: '+212600000000'
    });

    const userData = payload.data[0].user_data;
    assert.ok(userData.em);
    assert.ok(Array.isArray(userData.em));
    assert.strictEqual(userData.em[0].length, 64); // SHA256 hex
    assert.ok(userData.ph);
    assert.strictEqual(userData.ph[0].length, 64);
  });

  test('includes event_id for deduplication', () => {
    const payload = metaCapi._buildPayload('Purchase', { email: 'a@test.com' });
    assert.ok(payload.data[0].event_id);
    assert.strictEqual(payload.data[0].event_id.length, 36);
  });

  test('uses custom event_id when provided', () => {
    const payload = metaCapi._buildPayload('Lead', { email: 'a@test.com' }, {
      event_id: 'custom-event-id-12345'
    });
    assert.strictEqual(payload.data[0].event_id, 'custom-event-id-12345');
  });

  test('defaults currency to EUR', () => {
    const payload = metaCapi._buildPayload('Lead', { email: 'a@test.com' });
    assert.strictEqual(payload.data[0].custom_data.currency, 'EUR');
  });

  test('excludes undefined user_data fields', () => {
    const payload = metaCapi._buildPayload('Lead', { email: 'a@test.com' });
    const userData = payload.data[0].user_data;
    // phone not provided → should not be in payload
    assert.strictEqual('ph' in userData, false);
  });

  test('includes test_event_code when set', () => {
    const originalCode = metaCapi.testEventCode;
    metaCapi.testEventCode = 'TEST123';
    const payload = metaCapi._buildPayload('Lead', { email: 'a@test.com' });
    assert.strictEqual(payload.test_event_code, 'TEST123');
    metaCapi.testEventCode = originalCode;
  });

  test('includes fbc when fbclid provided', () => {
    const payload = metaCapi._buildPayload('Lead', {
      email: 'a@test.com',
      fbclid: 'abc123'
    });
    const userData = payload.data[0].user_data;
    assert.ok(userData.fbc);
    assert.ok(userData.fbc.startsWith('fb.1.'));
    assert.ok(userData.fbc.endsWith('.abc123'));
  });
});

describe('MetaCAPI healthCheck', () => {
  test('returns gateway info', () => {
    const health = metaCapi.healthCheck();
    assert.strictEqual(health.gateway, 'meta-capi');
    assert.ok(health.version);
    assert.ok(health.apiVersion);
  });

  test('reports credentials status', () => {
    const health = metaCapi.healthCheck();
    assert.ok('credentials' in health);
    assert.ok(['set', 'missing'].includes(health.credentials.META_PIXEL_ID));
    assert.ok(['set', 'missing'].includes(health.credentials.META_ACCESS_TOKEN));
  });

  test('includes SOTA features', () => {
    const health = metaCapi.healthCheck();
    assert.ok(Array.isArray(health.sota_features));
    assert.ok(health.sota_features.includes('event_id_deduplication'));
    assert.ok(health.sota_features.includes('retry_with_backoff'));
  });

  test('includes retry config', () => {
    const health = metaCapi.healthCheck();
    assert.ok(health.retryConfig);
    assert.strictEqual(health.retryConfig.maxAttempts, 3);
  });
});

describe('MetaCAPI _send guard', () => {
  test('returns error without credentials', async () => {
    const result = await metaCapi._send({ data: [{ event_name: 'test' }] });
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'missing_credentials');
  });
});
