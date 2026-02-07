'use strict';

/**
 * VocalIA EventBus Tests
 *
 * Tests for the SOTA Event-Driven Architecture (AgencyEventBus)
 * Tests REAL pub/sub behavior, schema validation, deduplication, and metrics.
 *
 * Run: node --test test/eventbus.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

// Use a fresh instance for testing (not the singleton which has active intervals)
const { AgencyEventBus, EVENT_SCHEMAS } = require('../core/AgencyEventBus.cjs');

// ─── Publish/Subscribe Integration ────────────────────────────────

describe('EventBus publish/subscribe', () => {
  test('subscribe receives published events', async () => {
    const bus = new AgencyEventBus({ config: { healthCheckIntervalMs: 999999 } });
    const received = [];

    bus.subscribe('test.event', (event) => {
      received.push(event);
    });

    await bus.publish('test.event', { data: 'hello' }, { tenantId: 'test-tenant' });

    assert.strictEqual(received.length, 1, 'Handler should receive 1 event');
    assert.strictEqual(received[0].payload.data, 'hello');
    assert.strictEqual(received[0].tenantId, 'test-tenant');
    clearInterval(bus._healthCheckTimer);
  });

  test('publish returns eventId', async () => {
    const bus = new AgencyEventBus({ config: { healthCheckIntervalMs: 999999 } });
    const result = await bus.publish('test.event', { x: 1 }, { tenantId: 'test' });

    assert.strictEqual(result.published, true);
    assert.ok(result.eventId, 'Should return eventId');
    assert.ok(result.eventId.startsWith('evt_'), 'eventId should start with evt_');
    clearInterval(bus._healthCheckTimer);
  });

  test('unsubscribe stops receiving events', async () => {
    const bus = new AgencyEventBus({ config: { healthCheckIntervalMs: 999999 } });
    const received = [];

    const unsubscribe = bus.subscribe('test.unsub', (event) => {
      received.push(event);
    });

    await bus.publish('test.unsub', { n: 1 }, { tenantId: 'test' });
    unsubscribe();
    await bus.publish('test.unsub', { n: 2 }, { tenantId: 'test' });

    assert.strictEqual(received.length, 1, 'Should only receive 1 event after unsubscribe');
    clearInterval(bus._healthCheckTimer);
  });

  test('wildcard subscriber receives all events', async () => {
    const bus = new AgencyEventBus({ config: { healthCheckIntervalMs: 999999 } });
    const received = [];

    bus.subscribe('*', (event) => {
      received.push(event.type);
    });

    await bus.publish('type.a', { x: 1 }, { tenantId: 'test' });
    await bus.publish('type.b', { x: 2 }, { tenantId: 'test' });

    assert.ok(received.includes('type.a'), 'Should receive type.a');
    assert.ok(received.includes('type.b'), 'Should receive type.b');
    clearInterval(bus._healthCheckTimer);
  });

  test('multiple subscribers all receive the event', async () => {
    const bus = new AgencyEventBus({ config: { healthCheckIntervalMs: 999999 } });
    let count = 0;

    bus.subscribe('multi.test', () => { count++; });
    bus.subscribe('multi.test', () => { count++; });
    bus.subscribe('multi.test', () => { count++; });

    await bus.publish('multi.test', { x: 1 }, { tenantId: 'test' });

    assert.strictEqual(count, 3, 'All 3 subscribers should be called');
    clearInterval(bus._healthCheckTimer);
  });
});

// ─── Schema Validation ────────────────────────────────────────────

describe('EventBus schema validation', () => {
  test('publish rejects event with missing required fields', async () => {
    const bus = new AgencyEventBus({ config: { healthCheckIntervalMs: 999999 } });
    // lead.qualified requires: sessionId, score, status
    const result = await bus.publish('lead.qualified', { sessionId: 'abc' }, { tenantId: 'test' });

    assert.strictEqual(result.published, false, 'Should reject event with missing fields');
    assert.ok(result.reason.includes('Missing fields'), 'Should mention missing fields');
    clearInterval(bus._healthCheckTimer);
  });

  test('publish accepts event with all required fields', async () => {
    const bus = new AgencyEventBus({ config: { healthCheckIntervalMs: 999999 } });
    const result = await bus.publish('lead.qualified', {
      sessionId: 'abc',
      score: 85,
      status: 'hot'
    }, { tenantId: 'test' });

    assert.strictEqual(result.published, true, 'Should accept valid event');
    clearInterval(bus._healthCheckTimer);
  });

  test('publish allows unknown event types (no schema)', async () => {
    const bus = new AgencyEventBus({ config: { healthCheckIntervalMs: 999999 } });
    const result = await bus.publish('custom.event', { anything: true }, { tenantId: 'test' });

    assert.strictEqual(result.published, true, 'Unknown event types should pass through');
    clearInterval(bus._healthCheckTimer);
  });
});

// ─── Deduplication ────────────────────────────────────────────────

describe('EventBus deduplication', () => {
  test('rejects duplicate events with same eventId', async () => {
    const bus = new AgencyEventBus({ config: { healthCheckIntervalMs: 999999 } });
    const eventId = 'evt_test_dedup_123';

    const r1 = await bus.publish('test.dedup', { x: 1 }, { tenantId: 'test', eventId });
    const r2 = await bus.publish('test.dedup', { x: 1 }, { tenantId: 'test', eventId });

    assert.strictEqual(r1.published, true, 'First should succeed');
    assert.strictEqual(r2.published, false, 'Second should be deduplicated');
    assert.strictEqual(r2.reason, 'duplicate');
    clearInterval(bus._healthCheckTimer);
  });

  test('metrics.deduplicated increments on dedup', async () => {
    const bus = new AgencyEventBus({ config: { healthCheckIntervalMs: 999999 } });
    const eventId = 'evt_test_dedup_metric';

    await bus.publish('test.dedup', { x: 1 }, { tenantId: 'test', eventId });
    const before = bus.metrics.deduplicated;
    await bus.publish('test.dedup', { x: 1 }, { tenantId: 'test', eventId });
    const after = bus.metrics.deduplicated;

    assert.strictEqual(after, before + 1, 'deduplicated counter should increment');
    clearInterval(bus._healthCheckTimer);
  });
});

// ─── Metrics ──────────────────────────────────────────────────────

describe('EventBus metrics', () => {
  test('getMetrics returns all counters', () => {
    const bus = new AgencyEventBus({ config: { healthCheckIntervalMs: 999999 } });
    const metrics = bus.getMetrics();

    assert.ok('published' in metrics, 'Should have published counter');
    assert.ok('delivered' in metrics, 'Should have delivered counter');
    assert.ok('failed' in metrics, 'Should have failed counter');
    assert.ok('deduplicated' in metrics, 'Should have deduplicated counter');
    assert.ok('retried' in metrics, 'Should have retried counter');
    clearInterval(bus._healthCheckTimer);
  });

  test('metrics.published increments after publish', async () => {
    const bus = new AgencyEventBus({ config: { healthCheckIntervalMs: 999999 } });
    const before = bus.metrics.published;

    await bus.publish('test.metrics', { x: 1 }, { tenantId: 'test' });

    assert.strictEqual(bus.metrics.published, before + 1, 'published counter should increment');
    clearInterval(bus._healthCheckTimer);
  });

  test('metrics.delivered increments when handler succeeds', async () => {
    const bus = new AgencyEventBus({ config: { healthCheckIntervalMs: 999999 } });
    bus.subscribe('test.delivered', () => { /* success */ });

    const before = bus.metrics.delivered;
    await bus.publish('test.delivered', { x: 1 }, { tenantId: 'test' });

    assert.strictEqual(bus.metrics.delivered, before + 1, 'delivered counter should increment');
    clearInterval(bus._healthCheckTimer);
  });
});

// ─── EVENT_SCHEMAS ────────────────────────────────────────────────

describe('EVENT_SCHEMAS content', () => {
  test('has lead event schemas', () => {
    assert.ok('lead.qualified' in EVENT_SCHEMAS);
    assert.ok('lead.scored' in EVENT_SCHEMAS);
    assert.ok('lead.converted' in EVENT_SCHEMAS);
  });

  test('has booking event schemas', () => {
    assert.ok('booking.requested' in EVENT_SCHEMAS);
    assert.ok('booking.confirmed' in EVENT_SCHEMAS);
    assert.ok('booking.cancelled' in EVENT_SCHEMAS);
  });

  test('has payment event schemas', () => {
    assert.ok('payment.initiated' in EVENT_SCHEMAS);
    assert.ok('payment.completed' in EVENT_SCHEMAS);
    assert.ok('payment.failed' in EVENT_SCHEMAS);
  });

  test('has voice event schemas', () => {
    assert.ok('voice.session_start' in EVENT_SCHEMAS);
    assert.ok('voice.session_end' in EVENT_SCHEMAS);
  });

  test('has system event schemas', () => {
    assert.ok('system.health_check' in EVENT_SCHEMAS);
    assert.ok('system.error' in EVENT_SCHEMAS);
    assert.ok('system.recovery' in EVENT_SCHEMAS);
  });

  test('lead.qualified schema requires sessionId, score, status', () => {
    const schema = EVENT_SCHEMAS['lead.qualified'];
    assert.ok(Array.isArray(schema));
    assert.ok(schema.includes('sessionId'));
    assert.ok(schema.includes('score'));
    assert.ok(schema.includes('status'));
  });

  test('voice.session_start schema requires sessionId, language, persona', () => {
    const schema = EVENT_SCHEMAS['voice.session_start'];
    assert.ok(Array.isArray(schema));
    assert.ok(schema.includes('sessionId'));
    assert.ok(schema.includes('language'));
    assert.ok(schema.includes('persona'));
  });
});

// ─── AgencyEventBus Class ─────────────────────────────────────────

describe('AgencyEventBus class', () => {
  test('extends EventEmitter', () => {
    const EventEmitter = require('events');
    assert.ok(AgencyEventBus.prototype instanceof EventEmitter);
  });

  test('config has expected defaults', () => {
    const bus = new AgencyEventBus({ config: { healthCheckIntervalMs: 999999 } });
    assert.strictEqual(bus.config.maxRetries, 3);
    assert.ok(bus.config.retryDelayMs > 0);
    assert.ok(bus.config.eventTTLHours > 0);
    assert.ok(bus.config.idempotencyWindowMs > 0);
    clearInterval(bus._healthCheckTimer);
  });

  test('constructor creates storage directories', () => {
    const fs = require('fs');
    const bus = new AgencyEventBus({ config: { healthCheckIntervalMs: 999999 } });
    assert.ok(fs.existsSync(bus.storageDir), 'Storage dir should exist');
    assert.ok(fs.existsSync(bus.dlqDir), 'DLQ dir should exist');
    clearInterval(bus._healthCheckTimer);
  });
});

// ─── Event Envelope ───────────────────────────────────────────────

describe('EventBus event envelope', () => {
  test('published event has correct envelope structure', async () => {
    const bus = new AgencyEventBus({ config: { healthCheckIntervalMs: 999999 } });
    let receivedEvent = null;

    bus.subscribe('test.envelope', (event) => {
      receivedEvent = event;
    });

    await bus.publish('test.envelope', { key: 'value' }, {
      tenantId: 'tenant-x',
      priority: 'high',
      correlationId: 'corr-123'
    });

    assert.ok(receivedEvent, 'Should receive event');
    assert.ok(receivedEvent.id, 'Should have id');
    assert.strictEqual(receivedEvent.type, 'test.envelope');
    assert.strictEqual(receivedEvent.tenantId, 'tenant-x');
    assert.strictEqual(receivedEvent.payload.key, 'value');
    assert.ok(receivedEvent.metadata, 'Should have metadata');
    assert.strictEqual(receivedEvent.metadata.priority, 'high');
    assert.strictEqual(receivedEvent.metadata.correlationId, 'corr-123');
    assert.ok(receivedEvent.metadata.timestamp, 'Should have timestamp');
    clearInterval(bus._healthCheckTimer);
  });
});

// Force exit after tests (EventBus has active intervals)
test.after(() => {
  setTimeout(() => process.exit(0), 100);
});
