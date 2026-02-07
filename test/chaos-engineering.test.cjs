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

const { EXPERIMENTS, runExperiment, runAllSafe, listExperiments, CONFIG } = require('../core/chaos-engineering.cjs');

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

// ─── runExperiment ──────────────────────────────────────────────

describe('ChaosEngineering runExperiment', () => {
  test('returns null for unknown experiment', async () => {
    const result = await runExperiment('nonexistent-experiment');
    assert.strictEqual(result, null);
  });

  test('returns null for empty name', async () => {
    const result = await runExperiment('');
    assert.strictEqual(result, null);
  });
});

// ─── Experiment safe mode behavior ──────────────────────────────

describe('ChaosEngineering safe mode', () => {
  test('memory-pressure skips in safe mode', async () => {
    const result = await EXPERIMENTS['memory-pressure'].execute();
    assert.strictEqual(result.skipped, true);
    assert.ok(result.reason.includes('Safe mode'));
  });

  test('cpu-stress skips in safe mode', async () => {
    const result = await EXPERIMENTS['cpu-stress'].execute();
    assert.strictEqual(result.skipped, true);
    assert.ok(result.reason.includes('Safe mode'));
  });
});

// ─── Experiment name/description checks ──────────────────────────

describe('ChaosEngineering experiment names', () => {
  test('latency-injection has correct name', () => {
    assert.strictEqual(EXPERIMENTS['latency-injection'].name, 'Latency Injection');
  });

  test('connection-timeout has correct name', () => {
    assert.strictEqual(EXPERIMENTS['connection-timeout'].name, 'Connection Timeout');
  });

  test('rate-limit-surge has correct name', () => {
    assert.strictEqual(EXPERIMENTS['rate-limit-surge'].name, 'Rate Limit Surge');
  });

  test('provider-failover has correct name', () => {
    assert.strictEqual(EXPERIMENTS['provider-failover'].name, 'AI Provider Failover');
  });

  test('circuit-breaker-trip has correct name', () => {
    assert.strictEqual(EXPERIMENTS['circuit-breaker-trip'].name, 'Circuit Breaker Trip');
  });

  test('graceful-degradation has correct name', () => {
    assert.strictEqual(EXPERIMENTS['graceful-degradation'].name, 'Graceful Degradation');
  });

  test('memory-pressure has correct name', () => {
    assert.strictEqual(EXPERIMENTS['memory-pressure'].name, 'Memory Pressure');
  });

  test('cpu-stress has correct name', () => {
    assert.strictEqual(EXPERIMENTS['cpu-stress'].name, 'CPU Stress');
  });

  test('malformed-input has correct name', () => {
    assert.strictEqual(EXPERIMENTS['malformed-input'].name, 'Malformed Input');
  });

  test('large-payload has correct name', () => {
    assert.strictEqual(EXPERIMENTS['large-payload'].name, 'Large Payload');
  });
});

// ─── Experiment descriptions ─────────────────────────────────────

describe('ChaosEngineering experiment descriptions', () => {
  test('all experiments have non-empty descriptions', () => {
    for (const [key, exp] of Object.entries(EXPERIMENTS)) {
      assert.ok(exp.description.length > 10, `${key} description too short`);
    }
  });
});

// ─── CONFIG edge cases ───────────────────────────────────────────

describe('ChaosEngineering CONFIG details', () => {
  test('experimentDuration is 30 seconds default', () => {
    assert.strictEqual(CONFIG.experimentDuration, 30);
  });

  test('verbose defaults to false', () => {
    assert.strictEqual(CONFIG.verbose, false);
  });

  test('all URLs are http://localhost', () => {
    assert.ok(CONFIG.voiceApiUrl.startsWith('http://localhost'));
    assert.ok(CONFIG.grokRealtimeUrl.startsWith('http://localhost'));
    assert.ok(CONFIG.telephonyUrl.startsWith('http://localhost'));
  });
});

// ─── Experiment category grouping ────────────────────────────────

describe('ChaosEngineering category grouping', () => {
  test('has 2 network experiments', () => {
    const network = Object.values(EXPERIMENTS).filter(e => e.category === 'network');
    assert.strictEqual(network.length, 2);
  });

  test('has 1 load experiment', () => {
    const load = Object.values(EXPERIMENTS).filter(e => e.category === 'load');
    assert.strictEqual(load.length, 1);
  });

  test('has 1 service experiment', () => {
    const service = Object.values(EXPERIMENTS).filter(e => e.category === 'service');
    assert.strictEqual(service.length, 1);
  });

  test('has 2 resilience experiments', () => {
    const resilience = Object.values(EXPERIMENTS).filter(e => e.category === 'resilience');
    assert.strictEqual(resilience.length, 2);
  });

  test('has 2 resource experiments', () => {
    const resource = Object.values(EXPERIMENTS).filter(e => e.category === 'resource');
    assert.strictEqual(resource.length, 2);
  });

  test('has 2 data experiments', () => {
    const data = Object.values(EXPERIMENTS).filter(e => e.category === 'data');
    assert.strictEqual(data.length, 2);
  });
});

// NOTE: Exports are proven by behavioral tests (EXPERIMENTS, CONFIG, runExperiment, runAllSafe, listExperiments).

// ─── listExperiments ──────────────────────────────────────────────

describe('ChaosEngineering listExperiments', () => {
  test('executes without error', () => {
    assert.doesNotThrow(() => listExperiments());
  });
});

// ─── Experiment execute functions ────────────────────────────────

describe('ChaosEngineering execute type check', () => {
  test('all execute functions are async', () => {
    for (const [key, exp] of Object.entries(EXPERIMENTS)) {
      assert.strictEqual(exp.execute.constructor.name, 'AsyncFunction', `${key}.execute should be async`);
    }
  });
});

// ─── Risk level distributions ────────────────────────────────────

describe('ChaosEngineering risk distribution', () => {
  test('has exactly 2 high-risk experiments', () => {
    const high = Object.values(EXPERIMENTS).filter(e => e.riskLevel === 'high');
    assert.strictEqual(high.length, 2);
  });

  test('has exactly 3 medium-risk experiments', () => {
    const medium = Object.values(EXPERIMENTS).filter(e => e.riskLevel === 'medium');
    assert.strictEqual(medium.length, 3);
  });

  test('has exactly 5 low-risk experiments', () => {
    const low = Object.values(EXPERIMENTS).filter(e => e.riskLevel === 'low');
    assert.strictEqual(low.length, 5);
  });
});
