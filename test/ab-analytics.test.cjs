'use strict';

/**
 * VocalIA A/B Analytics Tests
 *
 * Tests:
 * - Event logging (JSONL append)
 * - Experiment stats aggregation (impression/click/conversion)
 * - Experiment listing
 *
 * Run: node --test test/ab-analytics.test.cjs
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { logEvent, getExperimentStats, getAllExperiments } = require('../core/ab-analytics.cjs');

const DATA_DIR = path.join(__dirname, '../data/ab-analytics');

describe('A/B Analytics Event Logging', () => {
  const today = new Date().toISOString().split('T')[0];
  const logFile = path.join(DATA_DIR, `ab-events-${today}.jsonl`);

  test('logEvent writes to JSONL file', () => {
    const linesBefore = fs.existsSync(logFile)
      ? fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean).length
      : 0;

    logEvent({
      experiment: '__test_log__',
      variant: 'control',
      eventType: 'impression',
      tenantId: '__test__'
    });

    assert.ok(fs.existsSync(logFile), 'Log file should exist');
    const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean);
    assert.ok(lines.length > linesBefore, 'Should have more lines after logging');

    const lastLine = JSON.parse(lines[lines.length - 1]);
    assert.strictEqual(lastLine.experiment, '__test_log__');
    assert.strictEqual(lastLine.variant, 'control');
    assert.ok(lastLine.receivedAt);
    assert.ok(lastLine.serverTimestamp);
  });

  test('logEvent preserves event data', () => {
    logEvent({
      experiment: '__test_preserve__',
      variant: 'A',
      eventType: 'conversion',
      value: 49.99,
      metadata: { product: 'widget' }
    });

    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(DATA_DIR, `ab-events-${today}.jsonl`);
    const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean);
    const lastLine = JSON.parse(lines[lines.length - 1]);
    assert.strictEqual(lastLine.value, 49.99);
    assert.strictEqual(lastLine.metadata.product, 'widget');
  });

  test('logEvent appends multiple events', () => {
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(DATA_DIR, `ab-events-${today}.jsonl`);
    const before = fs.existsSync(logFile)
      ? fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean).length
      : 0;

    logEvent({ experiment: '__test_multi__', variant: 'A', eventType: 'impression' });
    logEvent({ experiment: '__test_multi__', variant: 'B', eventType: 'impression' });
    logEvent({ experiment: '__test_multi__', variant: 'A', eventType: 'click' });

    const after = fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean).length;
    assert.strictEqual(after - before, 3, 'Should have 3 more lines');
  });
});

describe('A/B Analytics Experiment Stats', () => {
  beforeEach(() => {
    // Log test events with correct eventType field
    logEvent({ experiment: '__test_stats__', variant: 'control', eventType: 'impression' });
    logEvent({ experiment: '__test_stats__', variant: 'control', eventType: 'impression' });
    logEvent({ experiment: '__test_stats__', variant: 'control', eventType: 'conversion' });
    logEvent({ experiment: '__test_stats__', variant: 'variant_A', eventType: 'impression' });
    logEvent({ experiment: '__test_stats__', variant: 'variant_A', eventType: 'click' });
    logEvent({ experiment: '__test_stats__', variant: 'variant_A', eventType: 'conversion' });
  });

  test('getExperimentStats returns experiment data', () => {
    const stats = getExperimentStats('__test_stats__');
    assert.strictEqual(stats.experiment, '__test_stats__');
    assert.ok(stats.variants);
    assert.ok(stats.totalImpressions > 0, 'Should have impressions');
  });

  test('getExperimentStats tracks variants separately', () => {
    const stats = getExperimentStats('__test_stats__');
    assert.ok(stats.variants.control, 'Should have control variant');
    assert.ok(stats.variants.variant_A, 'Should have variant_A');
    assert.ok(stats.variants.control.impressions > 0);
  });

  test('getExperimentStats calculates conversion rates', () => {
    const stats = getExperimentStats('__test_stats__');
    assert.ok(stats.totalConversions > 0);
    // conversionRate is a string with 2 decimals when impressions > 0
    if (stats.totalImpressions > 0) {
      assert.ok(parseFloat(stats.conversionRate) >= 0);
    }
  });

  test('getExperimentStats returns zero for unknown experiment', () => {
    const stats = getExperimentStats('__nonexistent_experiment__');
    assert.strictEqual(stats.totalImpressions, 0);
    assert.strictEqual(stats.totalClicks, 0);
    assert.strictEqual(stats.totalConversions, 0);
  });
});

describe('A/B Analytics Experiment Listing', () => {
  beforeEach(() => {
    logEvent({ experiment: '__test_list_A__', variant: 'v1', eventType: 'impression' });
    logEvent({ experiment: '__test_list_B__', variant: 'v1', eventType: 'impression' });
  });

  test('getAllExperiments returns array of stats objects', () => {
    const experiments = getAllExperiments();
    assert.ok(Array.isArray(experiments));
    // Each entry is a stats object with experiment field
    const names = experiments.map(e => e.experiment);
    assert.ok(names.includes('__test_list_A__'), 'Should include test_list_A');
    assert.ok(names.includes('__test_list_B__'), 'Should include test_list_B');
  });

  test('getAllExperiments returns unique experiments', () => {
    const experiments = getAllExperiments();
    const names = experiments.map(e => e.experiment);
    const unique = [...new Set(names)];
    assert.strictEqual(names.length, unique.length);
  });
});
