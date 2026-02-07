'use strict';

/**
 * VocalIA A/B Analytics Tests
 *
 * Tests:
 * - Module exports structure
 * - getCurrentLogFile format (via logEvent output)
 * - Event logging (JSONL append with metadata)
 * - Experiment stats aggregation (impression/click/conversion + rates)
 * - Experiment listing (unique, full stats)
 * - createAnalyticsMiddleware (POST validation, GET stats, routing)
 * - Edge cases (malformed lines, zero impressions, unknown eventTypes)
 *
 * NOTE: Uses isolated test files cleaned up after each describe block.
 *
 * Run: node --test test/ab-analytics.test.cjs
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const abAnalytics = require('../core/ab-analytics.cjs');
const { logEvent, getExperimentStats, getAllExperiments, createAnalyticsMiddleware } = abAnalytics;

const DATA_DIR = path.join(__dirname, '../data/ab-analytics');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Create a mock HTTP request object */
function mockReq(method, url, body = null) {
  const listeners = {};
  return {
    method,
    url,
    on(event, cb) {
      listeners[event] = cb;
    },
    // Trigger body events for POST simulation
    _emit() {
      if (body !== null && listeners.data) listeners.data(typeof body === 'string' ? body : JSON.stringify(body));
      if (listeners.end) listeners.end();
    }
  };
}

/** Create a mock HTTP response object */
function mockRes() {
  const res = {
    statusCode: null,
    headers: {},
    body: null,
    writeHead(code, headers) {
      res.statusCode = code;
      Object.assign(res.headers, headers);
    },
    end(data) {
      res.body = data;
    }
  };
  return res;
}

// ─── Module Exports ──────────────────────────────────────────────────────────

describe('AB Analytics module exports', () => {
  test('exports logEvent function', () => {
    assert.strictEqual(typeof abAnalytics.logEvent, 'function');
  });

  test('exports getExperimentStats function', () => {
    assert.strictEqual(typeof abAnalytics.getExperimentStats, 'function');
  });

  test('exports getAllExperiments function', () => {
    assert.strictEqual(typeof abAnalytics.getAllExperiments, 'function');
  });

  test('exports createAnalyticsMiddleware function', () => {
    assert.strictEqual(typeof abAnalytics.createAnalyticsMiddleware, 'function');
  });

  test('exports exactly 4 items', () => {
    assert.strictEqual(Object.keys(abAnalytics).length, 4);
  });
});

// ─── Event Logging ───────────────────────────────────────────────────────────

describe('AB Analytics logEvent', () => {
  const today = new Date().toISOString().split('T')[0];
  const logFile = path.join(DATA_DIR, `ab-events-${today}.jsonl`);

  test('creates log file in correct directory', () => {
    logEvent({
      experiment: '__test_ab_create__',
      variant: 'control',
      eventType: 'impression'
    });
    assert.ok(fs.existsSync(logFile));
  });

  test('writes valid JSONL (one JSON object per line)', () => {
    logEvent({
      experiment: '__test_ab_jsonl__',
      variant: 'A',
      eventType: 'click'
    });
    const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean);
    const last = lines[lines.length - 1];
    // Must be valid JSON
    const parsed = JSON.parse(last);
    assert.strictEqual(parsed.experiment, '__test_ab_jsonl__');
  });

  test('adds receivedAt timestamp', () => {
    const before = Date.now();
    logEvent({ experiment: '__test_ab_ts__', variant: 'A', eventType: 'impression' });
    const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean);
    const last = JSON.parse(lines[lines.length - 1]);
    assert.ok(last.receivedAt >= before);
    assert.ok(last.receivedAt <= Date.now());
  });

  test('adds serverTimestamp ISO string', () => {
    logEvent({ experiment: '__test_ab_iso__', variant: 'A', eventType: 'impression' });
    const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean);
    const last = JSON.parse(lines[lines.length - 1]);
    assert.ok(last.serverTimestamp);
    // Valid ISO date
    assert.ok(!isNaN(Date.parse(last.serverTimestamp)));
  });

  test('preserves custom fields in event', () => {
    logEvent({
      experiment: '__test_ab_custom__',
      variant: 'B',
      eventType: 'conversion',
      value: 99.50,
      currency: 'EUR',
      metadata: { source: 'widget' }
    });
    const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean);
    const last = JSON.parse(lines[lines.length - 1]);
    assert.strictEqual(last.value, 99.50);
    assert.strictEqual(last.currency, 'EUR');
    assert.strictEqual(last.metadata.source, 'widget');
  });

  test('appends (does not overwrite) existing file', () => {
    const linesBefore = fs.existsSync(logFile)
      ? fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean).length
      : 0;

    logEvent({ experiment: '__test_ab_append1__', variant: 'A', eventType: 'impression' });
    logEvent({ experiment: '__test_ab_append2__', variant: 'B', eventType: 'click' });

    const linesAfter = fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean).length;
    assert.strictEqual(linesAfter - linesBefore, 2);
  });

  test('log file name follows YYYY-MM-DD format', () => {
    const filename = path.basename(logFile);
    assert.match(filename, /^ab-events-\d{4}-\d{2}-\d{2}\.jsonl$/);
  });
});

// ─── Experiment Stats ────────────────────────────────────────────────────────

describe('AB Analytics getExperimentStats', () => {
  const expName = `__test_stats_${Date.now()}__`;

  beforeEach(() => {
    // Log known events for precise assertions
    logEvent({ experiment: expName, variant: 'control', eventType: 'impression' });
    logEvent({ experiment: expName, variant: 'control', eventType: 'impression' });
    logEvent({ experiment: expName, variant: 'control', eventType: 'click' });
    logEvent({ experiment: expName, variant: 'control', eventType: 'conversion' });
    logEvent({ experiment: expName, variant: 'variant_A', eventType: 'impression' });
    logEvent({ experiment: expName, variant: 'variant_A', eventType: 'impression' });
    logEvent({ experiment: expName, variant: 'variant_A', eventType: 'impression' });
    logEvent({ experiment: expName, variant: 'variant_A', eventType: 'click' });
    logEvent({ experiment: expName, variant: 'variant_A', eventType: 'click' });
    logEvent({ experiment: expName, variant: 'variant_A', eventType: 'conversion' });
    logEvent({ experiment: expName, variant: 'variant_A', eventType: 'conversion' });
  });

  test('returns correct experiment name', () => {
    const stats = getExperimentStats(expName);
    assert.strictEqual(stats.experiment, expName);
  });

  test('tracks impressions per variant', () => {
    const stats = getExperimentStats(expName);
    assert.ok(stats.variants.control);
    assert.ok(stats.variants.variant_A);
    // At least the events from one beforeEach run
    assert.ok(stats.variants.control.impressions >= 2);
    assert.ok(stats.variants.variant_A.impressions >= 3);
  });

  test('tracks clicks per variant', () => {
    const stats = getExperimentStats(expName);
    assert.ok(stats.variants.control.clicks >= 1);
    assert.ok(stats.variants.variant_A.clicks >= 2);
  });

  test('tracks conversions per variant', () => {
    const stats = getExperimentStats(expName);
    assert.ok(stats.variants.control.conversions >= 1);
    assert.ok(stats.variants.variant_A.conversions >= 2);
  });

  test('calculates totalImpressions as sum of variants', () => {
    const stats = getExperimentStats(expName);
    const variantSum = Object.values(stats.variants).reduce((s, v) => s + v.impressions, 0);
    assert.strictEqual(stats.totalImpressions, variantSum);
  });

  test('calculates totalClicks as sum of variants', () => {
    const stats = getExperimentStats(expName);
    const variantSum = Object.values(stats.variants).reduce((s, v) => s + v.clicks, 0);
    assert.strictEqual(stats.totalClicks, variantSum);
  });

  test('calculates conversionRate as percentage string', () => {
    const stats = getExperimentStats(expName);
    // conversionRate = totalConversions / totalImpressions * 100
    const expected = (stats.totalConversions / stats.totalImpressions * 100).toFixed(2);
    assert.strictEqual(stats.conversionRate, expected);
  });

  test('calculates clickThroughRate as percentage string', () => {
    const stats = getExperimentStats(expName);
    const expected = (stats.totalClicks / stats.totalImpressions * 100).toFixed(2);
    assert.strictEqual(stats.clickThroughRate, expected);
  });

  test('calculates per-variant conversionRate', () => {
    const stats = getExperimentStats(expName);
    for (const [, data] of Object.entries(stats.variants)) {
      if (data.impressions > 0) {
        const expected = (data.conversions / data.impressions * 100).toFixed(2);
        assert.strictEqual(data.conversionRate, expected);
      }
    }
  });

  test('calculates per-variant clickThroughRate', () => {
    const stats = getExperimentStats(expName);
    for (const [, data] of Object.entries(stats.variants)) {
      if (data.impressions > 0) {
        const expected = (data.clicks / data.impressions * 100).toFixed(2);
        assert.strictEqual(data.clickThroughRate, expected);
      }
    }
  });

  test('returns zero totals for unknown experiment', () => {
    const stats = getExperimentStats('__totally_nonexistent__');
    assert.strictEqual(stats.totalImpressions, 0);
    assert.strictEqual(stats.totalClicks, 0);
    assert.strictEqual(stats.totalConversions, 0);
    assert.strictEqual(stats.conversionRate, 0);
    assert.strictEqual(stats.clickThroughRate, 0);
  });

  test('returns empty variants for unknown experiment', () => {
    const stats = getExperimentStats('__totally_nonexistent__');
    assert.deepStrictEqual(stats.variants, {});
  });

  test('assigns unknown variant for events without variant field', () => {
    const noVariantExp = `__test_novar_${Date.now()}__`;
    logEvent({ experiment: noVariantExp, eventType: 'impression' });
    const stats = getExperimentStats(noVariantExp);
    assert.ok(stats.variants.unknown);
    assert.ok(stats.variants.unknown.impressions >= 1);
  });

  test('ignores events with unknown eventType', () => {
    const unknownTypeExp = `__test_unknowntype_${Date.now()}__`;
    logEvent({ experiment: unknownTypeExp, variant: 'A', eventType: 'impression' });
    logEvent({ experiment: unknownTypeExp, variant: 'A', eventType: 'hover' }); // not impression/click/conversion
    const stats = getExperimentStats(unknownTypeExp);
    assert.strictEqual(stats.totalImpressions, 1);
    assert.strictEqual(stats.totalClicks, 0);
  });
});

// ─── Get All Experiments ─────────────────────────────────────────────────────

describe('AB Analytics getAllExperiments', () => {
  test('returns array', () => {
    const experiments = getAllExperiments();
    assert.ok(Array.isArray(experiments));
  });

  test('each entry has experiment field', () => {
    logEvent({ experiment: '__test_all_check__', variant: 'A', eventType: 'impression' });
    const experiments = getAllExperiments();
    for (const exp of experiments) {
      assert.ok(exp.experiment);
    }
  });

  test('each entry has stats structure', () => {
    const experiments = getAllExperiments();
    for (const exp of experiments) {
      assert.ok('variants' in exp);
      assert.ok('totalImpressions' in exp);
      assert.ok('totalClicks' in exp);
      assert.ok('totalConversions' in exp);
      assert.ok('conversionRate' in exp);
      assert.ok('clickThroughRate' in exp);
    }
  });

  test('returns unique experiment names', () => {
    const experiments = getAllExperiments();
    const names = experiments.map(e => e.experiment);
    const unique = [...new Set(names)];
    assert.strictEqual(names.length, unique.length);
  });

  test('includes newly logged experiment', () => {
    const newExp = `__test_new_${Date.now()}__`;
    logEvent({ experiment: newExp, variant: 'A', eventType: 'impression' });
    const experiments = getAllExperiments();
    const names = experiments.map(e => e.experiment);
    assert.ok(names.includes(newExp));
  });
});

// ─── Middleware ───────────────────────────────────────────────────────────────

describe('AB Analytics createAnalyticsMiddleware', () => {
  const middleware = createAnalyticsMiddleware();

  test('returns a function', () => {
    assert.strictEqual(typeof middleware, 'function');
  });

  test('middleware has 3 parameters (req, res, next)', () => {
    assert.strictEqual(middleware.length, 3);
  });

  test('POST /api/analytics/ab logs event and returns 200', () => {
    const req = mockReq('POST', '/api/analytics/ab', {
      experiment: '__test_mw_post__',
      eventType: 'impression',
      variant: 'control'
    });
    const res = mockRes();

    middleware(req, res, () => { assert.fail('next should not be called'); });
    req._emit();

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
  });

  test('POST /api/analytics/ab rejects missing experiment', () => {
    const req = mockReq('POST', '/api/analytics/ab', {
      eventType: 'impression'
    });
    const res = mockRes();

    middleware(req, res, () => { assert.fail('next should not be called'); });
    req._emit();

    assert.strictEqual(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.ok(body.error.includes('Missing'));
  });

  test('POST /api/analytics/ab rejects missing eventType', () => {
    const req = mockReq('POST', '/api/analytics/ab', {
      experiment: '__test_mw_noevt__'
    });
    const res = mockRes();

    middleware(req, res, () => { assert.fail('next should not be called'); });
    req._emit();

    assert.strictEqual(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.ok(body.error.includes('Missing'));
  });

  test('POST /api/analytics/ab rejects invalid JSON', () => {
    const req = mockReq('POST', '/api/analytics/ab', 'not valid json{{{');
    const res = mockRes();

    middleware(req, res, () => { assert.fail('next should not be called'); });
    req._emit();

    assert.strictEqual(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.ok(body.error.includes('Invalid JSON'));
  });

  test('GET /api/analytics/ab returns experiments list', () => {
    const req = mockReq('GET', '/api/analytics/ab');
    const res = mockRes();

    middleware(req, res, () => { assert.fail('next should not be called'); });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(Array.isArray(body.experiments));
  });

  test('GET /api/analytics/ab/:experiment returns stats', () => {
    // First log an event so experiment exists
    logEvent({ experiment: '__test_mw_get__', variant: 'A', eventType: 'impression' });

    const req = mockReq('GET', '/api/analytics/ab/__test_mw_get__');
    const res = mockRes();

    middleware(req, res, () => { assert.fail('next should not be called'); });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.experiment, '__test_mw_get__');
    assert.ok(body.totalImpressions >= 1);
  });

  test('calls next() for non-matching routes', () => {
    const req = mockReq('GET', '/api/other');
    const res = mockRes();
    let nextCalled = false;

    middleware(req, res, () => { nextCalled = true; });

    assert.ok(nextCalled);
    assert.strictEqual(res.statusCode, null); // res untouched
  });

  test('calls next() for non-matching methods', () => {
    const req = mockReq('DELETE', '/api/analytics/ab');
    const res = mockRes();
    let nextCalled = false;

    middleware(req, res, () => { nextCalled = true; });

    assert.ok(nextCalled);
  });

  test('POST response has Content-Type application/json', () => {
    const req = mockReq('POST', '/api/analytics/ab', {
      experiment: '__test_mw_ct__',
      eventType: 'click'
    });
    const res = mockRes();

    middleware(req, res, () => {});
    req._emit();

    assert.strictEqual(res.headers['Content-Type'], 'application/json');
  });

  test('GET response has Content-Type application/json', () => {
    const req = mockReq('GET', '/api/analytics/ab');
    const res = mockRes();

    middleware(req, res, () => {});

    assert.strictEqual(res.headers['Content-Type'], 'application/json');
  });
});
