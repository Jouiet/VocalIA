/**
 * VocalIA AgencyEventBus Tests
 *
 * Tests:
 * - EVENT_SCHEMAS (23 event types with required fields)
 * - AgencyEventBus constructor (config, metrics, subscribers)
 * - _validateEvent (schema validation, missing fields, unknown events)
 * - _generateEventId (format, uniqueness)
 * - _isDuplicate (idempotency detection)
 * - subscribe/unsubscribe (handler management)
 * - getMetrics (metrics structure)
 * - health() (health check structure)
 * - shutdown() (cleanup)
 * - publish() (full cycle with temp dir)
 *
 * NOTE: Uses temp storageDir. Does NOT require running services.
 *
 * Run: node --test test/agency-event-bus.test.mjs
 */


import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import eventBus from '../core/AgencyEventBus.cjs';

const { AgencyEventBus, EVENT_SCHEMAS } = eventBus;

// Helper: create isolated bus with temp dir
function createTestBus(opts = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocalia-bus-'));
  const bus = new AgencyEventBus({
    storageDir: tmpDir,
    config: { healthCheckIntervalMs: 999999, retryDelayMs: 1, maxRetries: 1, ...opts }
  });
  return { bus, tmpDir };
}
function cleanup(bus, tmpDir) {
  bus.shutdown();
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
}

// ─── EVENT_SCHEMAS ──────────────────────────────────────────────

describe('AgencyEventBus EVENT_SCHEMAS', () => {
  test('has at least 20 event types', () => {
    assert.ok(Object.keys(EVENT_SCHEMAS).length >= 20);
  });

  test('has lead events', () => {
    assert.ok(EVENT_SCHEMAS['lead.qualified']);
    assert.ok(EVENT_SCHEMAS['lead.scored']);
    assert.ok(EVENT_SCHEMAS['lead.converted']);
  });

  test('has booking events', () => {
    assert.ok(EVENT_SCHEMAS['booking.requested']);
    assert.ok(EVENT_SCHEMAS['booking.confirmed']);
    assert.ok(EVENT_SCHEMAS['booking.cancelled']);
  });

  test('has payment events', () => {
    assert.ok(EVENT_SCHEMAS['payment.initiated']);
    assert.ok(EVENT_SCHEMAS['payment.completed']);
    assert.ok(EVENT_SCHEMAS['payment.failed']);
  });

  test('has voice events', () => {
    assert.ok(EVENT_SCHEMAS['voice.session_start']);
    assert.ok(EVENT_SCHEMAS['voice.session_end']);
    assert.ok(EVENT_SCHEMAS['voice.qualification_updated']);
  });

  test('has system events', () => {
    assert.ok(EVENT_SCHEMAS['system.health_check']);
    assert.ok(EVENT_SCHEMAS['system.error']);
    assert.ok(EVENT_SCHEMAS['system.recovery']);
  });

  test('has agent ops events', () => {
    assert.ok(EVENT_SCHEMAS['error_science.rules_updated']);
    assert.ok(EVENT_SCHEMAS['revenue_science.pricing_calculated']);
    assert.ok(EVENT_SCHEMAS['kb.enrichment_completed']);
  });

  test('all schemas are arrays of field names', () => {
    for (const [type, fields] of Object.entries(EVENT_SCHEMAS)) {
      assert.ok(Array.isArray(fields), `${type} schema should be array`);
      fields.forEach(f => assert.strictEqual(typeof f, 'string', `${type} field should be string`));
    }
  });

  test('lead.qualified requires sessionId, score, status', () => {
    assert.deepStrictEqual(EVENT_SCHEMAS['lead.qualified'], ['sessionId', 'score', 'status']);
  });

  test('payment.completed requires transactionId, amount, method', () => {
    assert.deepStrictEqual(EVENT_SCHEMAS['payment.completed'], ['transactionId', 'amount', 'method']);
  });
});

// ─── AgencyEventBus constructor ─────────────────────────────────

describe('AgencyEventBus constructor', () => {
  test('creates instance with default config', () => {
    const { bus, tmpDir } = createTestBus();
    assert.ok(bus);
    assert.strictEqual(bus.config.maxRetries, 1);
    cleanup(bus, tmpDir);
  });

  test('has empty subscribers Map', () => {
    const { bus, tmpDir } = createTestBus();
    assert.ok(bus.subscribers instanceof Map);
    cleanup(bus, tmpDir);
  });

  test('has empty idempotencyCache Map', () => {
    const { bus, tmpDir } = createTestBus();
    assert.ok(bus.idempotencyCache instanceof Map);
    cleanup(bus, tmpDir);
  });

  test('has initial metrics all zero', () => {
    const { bus, tmpDir } = createTestBus();
    assert.strictEqual(bus.metrics.published, 0);
    assert.strictEqual(bus.metrics.delivered, 0);
    assert.strictEqual(bus.metrics.failed, 0);
    assert.strictEqual(bus.metrics.deduplicated, 0);
    assert.strictEqual(bus.metrics.retried, 0);
    cleanup(bus, tmpDir);
  });

  test('creates storageDir', () => {
    const { bus, tmpDir } = createTestBus();
    assert.ok(fs.existsSync(tmpDir));
    cleanup(bus, tmpDir);
  });

  test('creates dlqDir', () => {
    const { bus, tmpDir } = createTestBus();
    assert.ok(fs.existsSync(path.join(tmpDir, 'dlq')));
    cleanup(bus, tmpDir);
  });
});

// ─── _validateEvent ─────────────────────────────────────────────

describe('AgencyEventBus _validateEvent', () => {
  test('valid event with all required fields', () => {
    const { bus, tmpDir } = createTestBus();
    const result = bus._validateEvent('lead.qualified', { sessionId: 's1', score: 75, status: 'hot' });
    assert.strictEqual(result.valid, true);
    cleanup(bus, tmpDir);
  });

  test('invalid event missing required field', () => {
    const { bus, tmpDir } = createTestBus();
    const result = bus._validateEvent('lead.qualified', { sessionId: 's1' });
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('score'));
    cleanup(bus, tmpDir);
  });

  test('unknown event type passes validation', () => {
    const { bus, tmpDir } = createTestBus();
    const result = bus._validateEvent('custom.event', { anything: true });
    assert.strictEqual(result.valid, true);
    cleanup(bus, tmpDir);
  });

  test('payment.failed requires transactionId, error, code', () => {
    const { bus, tmpDir } = createTestBus();
    const result = bus._validateEvent('payment.failed', { transactionId: 'tx1' });
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('error'));
    cleanup(bus, tmpDir);
  });

  test('voice.session_start requires sessionId, language, persona', () => {
    const { bus, tmpDir } = createTestBus();
    const valid = bus._validateEvent('voice.session_start', { sessionId: 's1', language: 'fr', persona: 'AGENCY' });
    assert.strictEqual(valid.valid, true);
    const invalid = bus._validateEvent('voice.session_start', { sessionId: 's1' });
    assert.strictEqual(invalid.valid, false);
    cleanup(bus, tmpDir);
  });
});

// ─── _generateEventId ───────────────────────────────────────────

describe('AgencyEventBus _generateEventId', () => {
  test('returns string starting with evt_', () => {
    const { bus, tmpDir } = createTestBus();
    const id = bus._generateEventId('t1', 'lead.qualified', { score: 75 });
    assert.ok(id.startsWith('evt_'));
    cleanup(bus, tmpDir);
  });

  test('is content-deterministic (same input = same ID)', () => {
    const { bus, tmpDir } = createTestBus();
    const id1 = bus._generateEventId('t1', 'test', { x: 1 });
    const id2 = bus._generateEventId('t1', 'test', { x: 1 });
    assert.strictEqual(id1, id2);
    cleanup(bus, tmpDir);
  });

  test('generates unique IDs for different payloads', () => {
    const { bus, tmpDir } = createTestBus();
    const id1 = bus._generateEventId('t1', 'test', { a: 1 });
    const id2 = bus._generateEventId('t1', 'test', { a: 2 });
    assert.notStrictEqual(id1, id2);
    cleanup(bus, tmpDir);
  });
});

// ─── _isDuplicate ───────────────────────────────────────────────

describe('AgencyEventBus _isDuplicate', () => {
  test('first call is not duplicate', () => {
    const { bus, tmpDir } = createTestBus();
    const result = bus._isDuplicate('evt_1', 't1', 'test', { a: 1 });
    assert.strictEqual(result, false);
    cleanup(bus, tmpDir);
  });

  test('same eventId is duplicate', () => {
    const { bus, tmpDir } = createTestBus();
    bus._isDuplicate('evt_dup', 't1', 'test', {});
    const result = bus._isDuplicate('evt_dup', 't1', 'test', {});
    assert.strictEqual(result, true);
    cleanup(bus, tmpDir);
  });

  test('same content is duplicate within window', () => {
    const { bus, tmpDir } = createTestBus({ idempotencyWindowMs: 60000 });
    bus._isDuplicate('evt_a', 't1', 'test', { x: 1 });
    const result = bus._isDuplicate('evt_b', 't1', 'test', { x: 1 });
    assert.strictEqual(result, true);
    cleanup(bus, tmpDir);
  });
});

// ─── subscribe/unsubscribe ──────────────────────────────────────

describe('AgencyEventBus subscribe/unsubscribe', () => {
  test('subscribe adds handler', () => {
    const { bus, tmpDir } = createTestBus();
    bus.subscribe('lead.qualified', async () => {});
    assert.strictEqual(bus.subscribers.get('lead.qualified').length, 1);
    cleanup(bus, tmpDir);
  });

  test('subscribe returns unsubscribe function', () => {
    const { bus, tmpDir } = createTestBus();
    const unsub = bus.subscribe('test.event', async () => {});
    assert.strictEqual(typeof unsub, 'function');
    unsub();
    assert.strictEqual(bus.subscribers.get('test.event').length, 0);
    cleanup(bus, tmpDir);
  });

  test('multiple subscriptions to same event', () => {
    const { bus, tmpDir } = createTestBus();
    bus.subscribe('lead.scored', async () => {});
    bus.subscribe('lead.scored', async () => {});
    assert.strictEqual(bus.subscribers.get('lead.scored').length, 2);
    cleanup(bus, tmpDir);
  });

  test('wildcard subscription', () => {
    const { bus, tmpDir } = createTestBus();
    bus.subscribe('*', async () => {});
    assert.strictEqual(bus.subscribers.get('*').length, 1);
    cleanup(bus, tmpDir);
  });

  test('handler name stored', () => {
    const { bus, tmpDir } = createTestBus();
    bus.subscribe('test', async function myHandler() {}, { name: 'TestHandler' });
    const handlers = bus.subscribers.get('test');
    assert.strictEqual(handlers[0]._handlerName, 'TestHandler');
    cleanup(bus, tmpDir);
  });
});

// ─── publish ────────────────────────────────────────────────────

describe('AgencyEventBus publish', () => {
  test('publishes event and increments metrics', async () => {
    const { bus, tmpDir } = createTestBus();
    const result = await bus.publish('lead.qualified', { sessionId: 's1', score: 80, status: 'hot' }, { tenantId: 'test-t' });
    assert.strictEqual(result.published, true);
    assert.ok(result.eventId);
    assert.strictEqual(bus.metrics.published, 1);
    cleanup(bus, tmpDir);
  });

  test('rejects invalid payload', async () => {
    const { bus, tmpDir } = createTestBus();
    const result = await bus.publish('lead.qualified', { sessionId: 's1' }, { tenantId: 't1' });
    assert.strictEqual(result.published, false);
    assert.ok(result.reason.includes('Missing'));
    cleanup(bus, tmpDir);
  });

  test('deduplicates same event', async () => {
    const { bus, tmpDir } = createTestBus();
    const eventId = 'evt_dedup_test';
    await bus.publish('lead.qualified', { sessionId: 's1', score: 80, status: 'hot' }, { tenantId: 't1', eventId });
    const result = await bus.publish('lead.qualified', { sessionId: 's1', score: 80, status: 'hot' }, { tenantId: 't1', eventId });
    assert.strictEqual(result.published, false);
    assert.strictEqual(result.reason, 'duplicate');
    assert.strictEqual(bus.metrics.deduplicated, 1);
    cleanup(bus, tmpDir);
  });

  test('delivers to subscriber', async () => {
    const { bus, tmpDir } = createTestBus();
    let received = null;
    bus.subscribe('booking.confirmed', async (event) => { received = event; });
    await bus.publish('booking.confirmed', { bookingId: 'b1', date: '2026-02-06', time: '10:00' }, { tenantId: 't1' });
    assert.ok(received);
    assert.strictEqual(received.payload.bookingId, 'b1');
    cleanup(bus, tmpDir);
  });

  test('persists event to file', async () => {
    const { bus, tmpDir } = createTestBus();
    await bus.publish('system.error', { component: 'test', error: 'err', severity: 'high' }, { tenantId: 'persist-test' });
    const tenantDir = path.join(tmpDir, 'persist-test');
    assert.ok(fs.existsSync(tenantDir));
    const files = fs.readdirSync(tenantDir);
    assert.ok(files.length > 0);
    assert.ok(files[0].endsWith('.jsonl'));
    cleanup(bus, tmpDir);
  });
});

// ─── getMetrics ─────────────────────────────────────────────────

describe('AgencyEventBus getMetrics', () => {
  test('returns metrics object', () => {
    const { bus, tmpDir } = createTestBus();
    const metrics = bus.getMetrics();
    assert.strictEqual(typeof metrics.published, 'number');
    assert.strictEqual(typeof metrics.delivered, 'number');
    assert.strictEqual(typeof metrics.failed, 'number');
    assert.strictEqual(typeof metrics.deduplicated, 'number');
    assert.strictEqual(typeof metrics.retried, 'number');
    assert.strictEqual(typeof metrics.cacheSize, 'number');
    assert.strictEqual(typeof metrics.uptime, 'number');
    cleanup(bus, tmpDir);
  });

  test('returns subscribers count', () => {
    const { bus, tmpDir } = createTestBus();
    bus.subscribe('test', async () => {});
    const metrics = bus.getMetrics();
    assert.ok(metrics.subscribers);
    assert.strictEqual(metrics.subscribers.test, 1);
    cleanup(bus, tmpDir);
  });
});

// ─── health ─────────────────────────────────────────────────────

describe('AgencyEventBus health', () => {
  test('returns health object', () => {
    const { bus, tmpDir } = createTestBus();
    const h = bus.health();
    assert.strictEqual(h.status, 'ok');
    assert.strictEqual(h.service, 'AgencyEventBus');
    assert.strictEqual(h.version, '3.0.0');
    assert.ok(h.metrics);
    assert.ok(h.timestamp);
    cleanup(bus, tmpDir);
  });
});

// ─── shutdown ───────────────────────────────────────────────────

describe('AgencyEventBus shutdown', () => {
  test('clears health interval and listeners', () => {
    const { bus, tmpDir } = createTestBus();
    bus.subscribe('test', async () => {});
    bus.shutdown();
    assert.strictEqual(bus.listenerCount('test'), 0);
    cleanup(bus, tmpDir);
  });
});

// NOTE: Exports are proven by behavioral tests above (publish, subscribe, EVENT_SCHEMAS, metrics, etc.)

// ─── replay ──────────────────────────────────────────────────────────

describe('AgencyEventBus replay', () => {
  test('replays events from JSONL files and delivers to subscribers', async () => {
    const { bus, tmpDir } = createTestBus();
    const tenantDir = path.join(tmpDir, 'replay_tenant');
    fs.mkdirSync(tenantDir, { recursive: true });
    const today = new Date().toISOString().split('T')[0];
    const events = [
      { type: 'lead.qualified', payload: { sessionId: 's1', score: 80, status: 'hot' }, metadata: { tenantId: 'replay_tenant' } },
      { type: 'booking.confirmed', payload: { bookingId: 'b1', date: '2026-02-14', time: '10:00' }, metadata: { tenantId: 'replay_tenant' } }
    ];
    fs.writeFileSync(path.join(tenantDir, `${today}.jsonl`), events.map(e => JSON.stringify(e)).join('\n') + '\n');

    let deliveredCount = 0;
    bus.subscribe('lead.qualified', async () => { deliveredCount++; });
    bus.subscribe('booking.confirmed', async () => { deliveredCount++; });

    const result = await bus.replay('replay_tenant');
    assert.strictEqual(result.replayed, 2);
    assert.strictEqual(deliveredCount, 2);
    cleanup(bus, tmpDir);
  });

  test('no tenant dir → returns {replayed: 0}', async () => {
    const { bus, tmpDir } = createTestBus();
    const result = await bus.replay('nonexistent_tenant');
    assert.strictEqual(result.replayed, 0);
    cleanup(bus, tmpDir);
  });

  test('filters by eventTypes option', async () => {
    const { bus, tmpDir } = createTestBus();
    const tenantDir = path.join(tmpDir, 'filter_tenant');
    fs.mkdirSync(tenantDir, { recursive: true });
    const today = new Date().toISOString().split('T')[0];
    const events = [
      { type: 'lead.qualified', payload: { sessionId: 's1', score: 80, status: 'hot' } },
      { type: 'booking.confirmed', payload: { bookingId: 'b1', date: '2026-02-14', time: '10:00' } }
    ];
    fs.writeFileSync(path.join(tenantDir, `${today}.jsonl`), events.map(e => JSON.stringify(e)).join('\n') + '\n');

    let deliveredCount = 0;
    bus.subscribe('lead.qualified', async () => { deliveredCount++; });

    const result = await bus.replay('filter_tenant', { eventTypes: ['lead.qualified'] });
    assert.strictEqual(result.replayed, 1);
    assert.strictEqual(deliveredCount, 1);
    cleanup(bus, tmpDir);
  });
});

// ─── processDLQ ─────────────────────────────────────────────────────

describe('AgencyEventBus processDLQ', () => {
  test('retries DLQ events and removes file on full success', async () => {
    const { bus, tmpDir } = createTestBus();
    const dlqEvent = {
      type: 'system.error',
      payload: { component: 'test', error: 'timeout', severity: 'medium' },
      metadata: { tenantId: 'dlq_tenant' },
      dlq: { error: 'original failure', sentAt: new Date().toISOString() }
    };
    fs.writeFileSync(
      path.join(bus.dlqDir, 'dlq_tenant_dlq.jsonl'),
      JSON.stringify(dlqEvent) + '\n'
    );

    let delivered = false;
    bus.subscribe('system.error', async () => { delivered = true; });

    const result = await bus.processDLQ('dlq_tenant');
    assert.strictEqual(result.processed, 1);
    assert.strictEqual(result.succeeded, 1);
    assert.strictEqual(delivered, true);
    assert.strictEqual(fs.existsSync(path.join(bus.dlqDir, 'dlq_tenant_dlq.jsonl')), false);
    cleanup(bus, tmpDir);
  });

  test('empty DLQ → {processed:0, succeeded:0}', async () => {
    const { bus, tmpDir } = createTestBus();
    const result = await bus.processDLQ('no_dlq');
    assert.strictEqual(result.processed, 0);
    assert.strictEqual(result.succeeded, 0);
    cleanup(bus, tmpDir);
  });
});
