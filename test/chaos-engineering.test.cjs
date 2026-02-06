'use strict';

/**
 * VocalIA Chaos Engineering Tests
 *
 * Tests:
 * - CONFIG structure (URLs, durations, safe mode)
 * - EXPERIMENTS registry (10 experiments with metadata)
 * - Experiment categories and risk levels
 * - runExperiment with unknown experiment
 *
 * NOTE: Does NOT execute experiments against running services.
 * Tests structure and metadata only.
 *
 * Run: node --test test/chaos-engineering.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const { EXPERIMENTS, runExperiment, runAllSafe, CONFIG } = require('../core/chaos-engineering.cjs');

// ─── CONFIG ─────────────────────────────────────────────────────────

describe('ChaosEngineering CONFIG', () => {
  test('has voice API URL', () => {
    assert.ok(CONFIG.voiceApiUrl.includes('3004'));
  });

  test('has grok realtime URL', () => {
    assert.ok(CONFIG.grokRealtimeUrl.includes('3007'));
  });

  test('has telephony URL', () => {
    assert.ok(CONFIG.telephonyUrl.includes('3009'));
  });

  test('has experiment duration default', () => {
    assert.strictEqual(typeof CONFIG.experimentDuration, 'number');
    assert.ok(CONFIG.experimentDuration > 0);
  });

  test('safe mode defaults to true', () => {
    assert.strictEqual(CONFIG.safeMode, true);
  });
});

// ─── EXPERIMENTS registry ───────────────────────────────────────────

describe('ChaosEngineering EXPERIMENTS', () => {
  test('has 10 experiments', () => {
    assert.strictEqual(Object.keys(EXPERIMENTS).length, 10);
  });

  test('all experiments have required fields', () => {
    for (const [key, exp] of Object.entries(EXPERIMENTS)) {
      assert.ok(exp.name, `${key} missing name`);
      assert.ok(exp.description, `${key} missing description`);
      assert.ok(exp.category, `${key} missing category`);
      assert.ok(exp.riskLevel, `${key} missing riskLevel`);
      assert.strictEqual(typeof exp.execute, 'function', `${key} missing execute`);
    }
  });

  test('has latency-injection experiment', () => {
    assert.ok(EXPERIMENTS['latency-injection']);
    assert.strictEqual(EXPERIMENTS['latency-injection'].category, 'network');
    assert.strictEqual(EXPERIMENTS['latency-injection'].riskLevel, 'low');
  });

  test('has connection-timeout experiment', () => {
    assert.ok(EXPERIMENTS['connection-timeout']);
    assert.strictEqual(EXPERIMENTS['connection-timeout'].category, 'network');
  });

  test('has rate-limit-surge experiment', () => {
    assert.ok(EXPERIMENTS['rate-limit-surge']);
    assert.strictEqual(EXPERIMENTS['rate-limit-surge'].category, 'load');
  });

  test('has provider-failover experiment', () => {
    assert.ok(EXPERIMENTS['provider-failover']);
    assert.strictEqual(EXPERIMENTS['provider-failover'].category, 'service');
    assert.strictEqual(EXPERIMENTS['provider-failover'].riskLevel, 'low');
  });

  test('has circuit-breaker-trip experiment', () => {
    assert.ok(EXPERIMENTS['circuit-breaker-trip']);
    assert.strictEqual(EXPERIMENTS['circuit-breaker-trip'].category, 'resilience');
  });

  test('has graceful-degradation experiment', () => {
    assert.ok(EXPERIMENTS['graceful-degradation']);
    assert.strictEqual(EXPERIMENTS['graceful-degradation'].category, 'resilience');
  });

  test('has memory-pressure experiment (high risk)', () => {
    assert.ok(EXPERIMENTS['memory-pressure']);
    assert.strictEqual(EXPERIMENTS['memory-pressure'].riskLevel, 'high');
  });

  test('has cpu-stress experiment (high risk)', () => {
    assert.ok(EXPERIMENTS['cpu-stress']);
    assert.strictEqual(EXPERIMENTS['cpu-stress'].riskLevel, 'high');
  });

  test('has malformed-input experiment', () => {
    assert.ok(EXPERIMENTS['malformed-input']);
    assert.strictEqual(EXPERIMENTS['malformed-input'].category, 'data');
    assert.strictEqual(EXPERIMENTS['malformed-input'].riskLevel, 'low');
  });

  test('has large-payload experiment', () => {
    assert.ok(EXPERIMENTS['large-payload']);
    assert.strictEqual(EXPERIMENTS['large-payload'].category, 'data');
  });

  test('risk levels are valid', () => {
    const validLevels = ['low', 'medium', 'high'];
    for (const [key, exp] of Object.entries(EXPERIMENTS)) {
      assert.ok(validLevels.includes(exp.riskLevel), `${key} has invalid risk level: ${exp.riskLevel}`);
    }
  });

  test('categories are valid', () => {
    const validCategories = ['network', 'load', 'service', 'resilience', 'resource', 'data'];
    for (const [key, exp] of Object.entries(EXPERIMENTS)) {
      assert.ok(validCategories.includes(exp.category), `${key} has invalid category: ${exp.category}`);
    }
  });

  test('has at least 4 low-risk experiments', () => {
    const lowRisk = Object.values(EXPERIMENTS).filter(e => e.riskLevel === 'low');
    assert.ok(lowRisk.length >= 4);
  });
});

// ─── exports ────────────────────────────────────────────────────────

describe('ChaosEngineering exports', () => {
  test('exports runExperiment function', () => {
    assert.strictEqual(typeof runExperiment, 'function');
  });

  test('exports runAllSafe function', () => {
    assert.strictEqual(typeof runAllSafe, 'function');
  });
});
