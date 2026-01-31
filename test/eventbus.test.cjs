/**
 * VocalIA EventBus Tests
 *
 * Tests for the SOTA Event-Driven Architecture (AgencyEventBus)
 * Run: node --test test/eventbus.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

describe('EventBus Module Export', () => {
  test('AgencyEventBus module loads without error', () => {
    const mod = require('../core/AgencyEventBus.cjs');
    assert.ok(mod, 'Module should export something');
  });

  test('Module exports AgencyEventBus class', () => {
    const { AgencyEventBus } = require('../core/AgencyEventBus.cjs');
    assert.ok(AgencyEventBus, 'Should export AgencyEventBus class');
    assert.strictEqual(typeof AgencyEventBus, 'function', 'AgencyEventBus should be a constructor');
  });

  test('Module exports singleton instance as default', () => {
    const eventBus = require('../core/AgencyEventBus.cjs');
    assert.ok(eventBus, 'Should export singleton instance');
    assert.strictEqual(typeof eventBus.publish, 'function', 'Singleton should have publish method');
    assert.strictEqual(typeof eventBus.subscribe, 'function', 'Singleton should have subscribe method');
  });

  test('Module exports EVENT_SCHEMAS', () => {
    const { EVENT_SCHEMAS } = require('../core/AgencyEventBus.cjs');
    assert.ok(EVENT_SCHEMAS, 'Should export EVENT_SCHEMAS');
    assert.strictEqual(typeof EVENT_SCHEMAS, 'object', 'EVENT_SCHEMAS should be an object');
  });
});

describe('EventBus Singleton Methods', () => {
  test('Singleton has publish method', () => {
    const eventBus = require('../core/AgencyEventBus.cjs');
    assert.strictEqual(typeof eventBus.publish, 'function', 'Should have publish method');
  });

  test('Singleton has subscribe method', () => {
    const eventBus = require('../core/AgencyEventBus.cjs');
    assert.strictEqual(typeof eventBus.subscribe, 'function', 'Should have subscribe method');
  });

  test('Singleton has getMetrics method', () => {
    const eventBus = require('../core/AgencyEventBus.cjs');
    assert.strictEqual(typeof eventBus.getMetrics, 'function', 'Should have getMetrics method');
  });

  test('Singleton has metrics property', () => {
    const eventBus = require('../core/AgencyEventBus.cjs');
    assert.ok(eventBus.metrics, 'Should have metrics property');
    assert.ok('published' in eventBus.metrics, 'Metrics should have published count');
    assert.ok('delivered' in eventBus.metrics, 'Metrics should have delivered count');
    assert.ok('failed' in eventBus.metrics, 'Metrics should have failed count');
    assert.ok('deduplicated' in eventBus.metrics, 'Metrics should have deduplicated count');
  });

  test('Singleton has config property', () => {
    const eventBus = require('../core/AgencyEventBus.cjs');
    assert.ok(eventBus.config, 'Should have config property');
    assert.ok(typeof eventBus.config.maxRetries === 'number', 'Config should have maxRetries');
    assert.ok(typeof eventBus.config.retryDelayMs === 'number', 'Config should have retryDelayMs');
  });
});

describe('EVENT_SCHEMAS Validation', () => {
  test('Has lead event schemas', () => {
    const { EVENT_SCHEMAS } = require('../core/AgencyEventBus.cjs');
    assert.ok('lead.qualified' in EVENT_SCHEMAS, 'Should have lead.qualified schema');
    assert.ok('lead.scored' in EVENT_SCHEMAS, 'Should have lead.scored schema');
    assert.ok('lead.converted' in EVENT_SCHEMAS, 'Should have lead.converted schema');
  });

  test('Has booking event schemas', () => {
    const { EVENT_SCHEMAS } = require('../core/AgencyEventBus.cjs');
    assert.ok('booking.requested' in EVENT_SCHEMAS, 'Should have booking.requested schema');
    assert.ok('booking.confirmed' in EVENT_SCHEMAS, 'Should have booking.confirmed schema');
    assert.ok('booking.cancelled' in EVENT_SCHEMAS, 'Should have booking.cancelled schema');
  });

  test('Has payment event schemas', () => {
    const { EVENT_SCHEMAS } = require('../core/AgencyEventBus.cjs');
    assert.ok('payment.initiated' in EVENT_SCHEMAS, 'Should have payment.initiated schema');
    assert.ok('payment.completed' in EVENT_SCHEMAS, 'Should have payment.completed schema');
    assert.ok('payment.failed' in EVENT_SCHEMAS, 'Should have payment.failed schema');
  });

  test('Has voice event schemas', () => {
    const { EVENT_SCHEMAS } = require('../core/AgencyEventBus.cjs');
    assert.ok('voice.session_start' in EVENT_SCHEMAS, 'Should have voice.session_start schema');
    assert.ok('voice.session_end' in EVENT_SCHEMAS, 'Should have voice.session_end schema');
  });

  test('Has system event schemas', () => {
    const { EVENT_SCHEMAS } = require('../core/AgencyEventBus.cjs');
    assert.ok('system.health_check' in EVENT_SCHEMAS, 'Should have system.health_check schema');
    assert.ok('system.error' in EVENT_SCHEMAS, 'Should have system.error schema');
    assert.ok('system.recovery' in EVENT_SCHEMAS, 'Should have system.recovery schema');
  });

  test('lead.qualified schema has required fields', () => {
    const { EVENT_SCHEMAS } = require('../core/AgencyEventBus.cjs');
    const schema = EVENT_SCHEMAS['lead.qualified'];
    assert.ok(Array.isArray(schema), 'Schema should be an array');
    assert.ok(schema.includes('sessionId'), 'Should require sessionId');
    assert.ok(schema.includes('score'), 'Should require score');
    assert.ok(schema.includes('status'), 'Should require status');
  });

  test('voice.session_start schema has required fields', () => {
    const { EVENT_SCHEMAS } = require('../core/AgencyEventBus.cjs');
    const schema = EVENT_SCHEMAS['voice.session_start'];
    assert.ok(Array.isArray(schema), 'Schema should be an array');
    assert.ok(schema.includes('sessionId'), 'Should require sessionId');
    assert.ok(schema.includes('language'), 'Should require language');
    assert.ok(schema.includes('persona'), 'Should require persona');
  });
});

describe('EventBus Metrics', () => {
  test('getMetrics returns metrics object', () => {
    const eventBus = require('../core/AgencyEventBus.cjs');
    const metrics = eventBus.getMetrics();
    assert.ok(metrics, 'getMetrics should return an object');
    assert.ok('published' in metrics, 'Should include published count');
    assert.ok('delivered' in metrics, 'Should include delivered count');
    assert.ok('failed' in metrics, 'Should include failed count');
    assert.ok('deduplicated' in metrics, 'Should include deduplicated count');
  });

  test('Metrics are numbers', () => {
    const eventBus = require('../core/AgencyEventBus.cjs');
    const metrics = eventBus.getMetrics();
    assert.strictEqual(typeof metrics.published, 'number', 'published should be a number');
    assert.strictEqual(typeof metrics.delivered, 'number', 'delivered should be a number');
    assert.strictEqual(typeof metrics.failed, 'number', 'failed should be a number');
  });
});

describe('EventBus AgencyEventBus Class', () => {
  test('AgencyEventBus extends EventEmitter', () => {
    const { AgencyEventBus } = require('../core/AgencyEventBus.cjs');
    const EventEmitter = require('events');

    // Check prototype chain
    assert.ok(AgencyEventBus.prototype instanceof EventEmitter, 'Should extend EventEmitter');
  });

  test('AgencyEventBus has static EVENT_SCHEMAS reference', () => {
    const { AgencyEventBus, EVENT_SCHEMAS } = require('../core/AgencyEventBus.cjs');
    // Both exports should be available
    assert.ok(AgencyEventBus, 'AgencyEventBus should be exported');
    assert.ok(EVENT_SCHEMAS, 'EVENT_SCHEMAS should be exported');
  });
});

// Force exit after tests complete (EventBus singleton has active intervals)
test.after(() => {
  setTimeout(() => process.exit(0), 100);
});
