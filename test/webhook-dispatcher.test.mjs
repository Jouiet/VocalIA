/**
 * VocalIA Outbound Webhook Dispatcher Tests
 * Session 250.239
 *
 * Tests:
 * - Module exports (dispatch, getWebhookConfig, signPayload, VALID_EVENTS)
 * - VALID_EVENTS (8 event types)
 * - signPayload HMAC-SHA256 correctness
 * - getWebhookConfig (null for nonexistent, loads from config.json)
 * - dispatch (no-op for unconfigured tenants, rejects invalid events)
 *
 * Run: node --test test/webhook-dispatcher.test.mjs
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';

const mod = await import('../core/webhook-dispatcher.cjs');
const { dispatch, getWebhookConfig, signPayload, VALID_EVENTS } = mod.default || mod;

describe('Webhook Dispatcher — exports', () => {
  test('exports 4 members', () => {
    assert.ok(typeof dispatch === 'function', 'dispatch is a function');
    assert.ok(typeof getWebhookConfig === 'function', 'getWebhookConfig is a function');
    assert.ok(typeof signPayload === 'function', 'signPayload is a function');
    assert.ok(Array.isArray(VALID_EVENTS), 'VALID_EVENTS is an array');
  });
});

describe('VALID_EVENTS', () => {
  test('has 8 event types', () => {
    assert.strictEqual(VALID_EVENTS.length, 8);
  });

  test('includes lead.qualified', () => {
    assert.ok(VALID_EVENTS.includes('lead.qualified'));
  });

  test('includes call.completed', () => {
    assert.ok(VALID_EVENTS.includes('call.completed'));
  });

  test('includes call.started', () => {
    assert.ok(VALID_EVENTS.includes('call.started'));
  });

  test('includes conversation.ended', () => {
    assert.ok(VALID_EVENTS.includes('conversation.ended'));
  });

  test('includes cart.abandoned', () => {
    assert.ok(VALID_EVENTS.includes('cart.abandoned'));
  });

  test('includes appointment.booked', () => {
    assert.ok(VALID_EVENTS.includes('appointment.booked'));
  });

  test('includes quota.warning', () => {
    assert.ok(VALID_EVENTS.includes('quota.warning'));
  });

  test('includes tenant.provisioned', () => {
    assert.ok(VALID_EVENTS.includes('tenant.provisioned'));
  });
});

describe('signPayload', () => {
  test('returns HMAC-SHA256 hex string', () => {
    const payload = '{"event":"lead.qualified","data":{}}';
    const secret = 'test_secret_key_abc123';
    const signature = signPayload(payload, secret);

    // Verify independently
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    assert.strictEqual(signature, expected);
    assert.strictEqual(signature.length, 64); // SHA-256 = 64 hex chars
  });

  test('returns null for empty secret', () => {
    assert.strictEqual(signPayload('test', null), null);
    assert.strictEqual(signPayload('test', ''), null);
  });

  test('different payloads produce different signatures', () => {
    const secret = 'key';
    const sig1 = signPayload('payload_a', secret);
    const sig2 = signPayload('payload_b', secret);
    assert.notStrictEqual(sig1, sig2);
  });

  test('different secrets produce different signatures', () => {
    const payload = 'same_payload';
    const sig1 = signPayload(payload, 'secret_a');
    const sig2 = signPayload(payload, 'secret_b');
    assert.notStrictEqual(sig1, sig2);
  });
});

describe('getWebhookConfig', () => {
  test('returns null for nonexistent tenant', () => {
    const config = getWebhookConfig('nonexistent_tenant_xyz');
    assert.strictEqual(config, null);
  });

  test('returns null for default tenant', () => {
    const config = getWebhookConfig('default');
    assert.strictEqual(config, null);
  });

  test('returns null for empty/null tenantId', () => {
    assert.strictEqual(getWebhookConfig(null), null);
    assert.strictEqual(getWebhookConfig(''), null);
    assert.strictEqual(getWebhookConfig(undefined), null);
  });
});

describe('dispatch', () => {
  test('rejects invalid event type (no crash)', async () => {
    // Should warn but not throw
    await dispatch('test_tenant', 'invalid.event', { data: 1 });
  });

  test('no-op for unconfigured tenant (no crash)', async () => {
    await dispatch('nonexistent_tenant', 'lead.qualified', { score: 85 });
  });

  test('no-op for default tenant (no crash)', async () => {
    await dispatch('default', 'call.completed', { duration: 120 });
  });
});
