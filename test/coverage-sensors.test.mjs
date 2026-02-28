/**
 * coverage-sensors.test.mjs
 * Dedicated sensor coverage — isolated file for proper c8 tracking.
 */
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const GPM_PATH = path.join(ROOT, 'data', 'pressure-matrix.json');

let originalGPM = null;

before(() => {
  if (fs.existsSync(GPM_PATH)) originalGPM = fs.readFileSync(GPM_PATH, 'utf8');
  fs.writeFileSync(GPM_PATH, JSON.stringify({ sectors: {} }, null, 2));
});

after(() => {
  if (originalGPM !== null) fs.writeFileSync(GPM_PATH, originalGPM);
});

describe('RetentionSensor', () => {
  const { calculateChurnPressure, updateGPM } = require('../sensors/retention-sensor.cjs');

  test('empty orders', () => assert.equal(calculateChurnPressure([]), 0));
  test('null orders', () => assert.equal(calculateChurnPressure(null), 0));
  test('recent orders low pressure', () => {
    const p = calculateChurnPressure([
      { email: 'a@t.com', created_at: new Date().toISOString() },
      { email: 'b@t.com', created_at: new Date().toISOString() },
    ]);
    assert.ok(p < 50);
  });
  test('stale orders high pressure', () => {
    const old = new Date(Date.now() - 120 * 86400000).toISOString();
    const p = calculateChurnPressure([
      { email: 'a@t.com', created_at: old },
      { email: 'b@t.com', created_at: old },
    ]);
    assert.ok(p > 50);
  });
  test('single order >60 days', () => {
    const old = new Date(Date.now() - 70 * 86400000).toISOString();
    const p = calculateChurnPressure([{ email: 'a@t.com', created_at: old }]);
    assert.ok(p > 0);
  });
  test('orders without email skipped', () => {
    assert.equal(calculateChurnPressure([{ created_at: new Date().toISOString() }]), 0);
  });
  test('multiple orders same customer', () => {
    const now = new Date();
    const p = calculateChurnPressure([
      { email: 'a@t.com', created_at: now.toISOString() },
      { email: 'a@t.com', created_at: new Date(now - 30 * 86400000).toISOString() },
    ]);
    assert.ok(p >= 0);
  });
  test('updateGPM writes', () => {
    updateGPM(42, { order_count: 10 });
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.marketing.retention.pressure, 42);
  });
  test('updateGPM corrupted file', () => {
    fs.writeFileSync(GPM_PATH, 'not json!');
    updateGPM(50, { c: 5 });
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.marketing.retention.pressure, 50);
  });
  test('updateGPM trend UP', () => {
    fs.writeFileSync(GPM_PATH, JSON.stringify({
      sectors: { marketing: { retention: { pressure: 10 } } }
    }));
    updateGPM(60, { c: 5 });
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.marketing.retention.trend, 'UP');
  });
});

describe('LeadVelocitySensor', () => {
  const { calculatePressure, updateGPM } = require('../sensors/lead-velocity-sensor.cjs');

  test('0 leads = 90 pressure', () => assert.equal(calculatePressure([]), 90));
  test('15 recent leads = 30', () => {
    const leads = Array.from({ length: 15 }, () => ({ timestamp: new Date().toISOString() }));
    assert.equal(calculatePressure(leads), 30);
  });
  test('3 leads = 78', () => {
    const leads = Array.from({ length: 3 }, () => ({ timestamp: new Date().toISOString() }));
    assert.equal(calculatePressure(leads), 78);
  });
  test('7 leads = 62', () => {
    const leads = Array.from({ length: 7 }, () => ({ timestamp: new Date().toISOString() }));
    assert.equal(calculatePressure(leads), 62);
  });
  test('updateGPM writes', () => {
    fs.writeFileSync(GPM_PATH, JSON.stringify({ sectors: {} }));
    updateGPM(75, 3);
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.sales.lead_velocity.pressure, 75);
  });
  test('updateGPM corrupted', () => {
    fs.writeFileSync(GPM_PATH, 'broken');
    updateGPM(40, 7);
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.sales.lead_velocity.pressure, 40);
  });
  test('updateGPM trend UP', () => {
    fs.writeFileSync(GPM_PATH, JSON.stringify({
      sectors: { sales: { lead_velocity: { pressure: 20 } } }
    }));
    updateGPM(80, 2);
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.sales.lead_velocity.trend, 'UP');
  });
});

describe('VoiceQualitySensor', () => {
  const { calculatePressure, updateGPM } = require('../sensors/voice-quality-sensor.cjs');

  test('all healthy = low', () => {
    const p = calculatePressure(
      [{ name: 'a', status: 'HEALTHY', latency: 50 }],
      [{ name: 'b', status: 'HEALTHY', latency: 100 }]
    );
    assert.ok(p <= 30);
  });
  test('mixed = medium', () => {
    const p = calculatePressure(
      [{ name: 'a', status: 'HEALTHY', latency: 50 }, { name: 'b', status: 'DOWN', latency: 0 }],
      [{ name: 'c', status: 'HEALTHY', latency: 100 }]
    );
    assert.ok(p > 0, `Expected some pressure for mixed health, got ${p}`);
  });
  test('all down = high', () => {
    const p = calculatePressure(
      [{ name: 'a', status: 'DOWN', latency: 0 }],
      [{ name: 'b', status: 'DOWN', latency: 0 }]
    );
    assert.ok(p >= 80);
  });
  test('updateGPM writes', () => {
    fs.writeFileSync(GPM_PATH, JSON.stringify({ sectors: {} }));
    updateGPM(30, [{ name: 't', status: 'HEALTHY', latency: 50 }], [{ name: 'g', status: 'HEALTHY', latency: 100 }]);
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.technology.voice_quality.pressure, 30);
    assert.ok(gpm.sectors.technology.voice_quality.sensor_data.endpoint_details);
  });
  test('updateGPM corrupted', () => {
    fs.writeFileSync(GPM_PATH, '{bad');
    updateGPM(90, [{ name: 't', status: 'DOWN', latency: 0 }], [{ name: 'g', status: 'DOWN', latency: 0 }]);
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.technology.voice_quality.pressure, 90);
  });
  test('updateGPM trend', () => {
    fs.writeFileSync(GPM_PATH, JSON.stringify({
      sectors: { technology: { voice_quality: { pressure: 10 } } }
    }));
    updateGPM(50, [{ name: 'a', status: 'HEALTHY', latency: 50 }], [{ name: 'b', status: 'DOWN', latency: 0 }]);
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.technology.voice_quality.trend, 'UP');
  });
});

describe('CostTrackingSensor', () => {
  const { calculatePressure, updateGPM, BUDGET, loadLocalCostLog } = require('../sensors/cost-tracking-sensor.cjs');

  test('no costs = low', () => {
    const p = calculatePressure([], { totalThisMonth: 0 });
    assert.ok(p <= 30);
  });
  test('high costs', () => {
    const p = calculatePressure(
      [{ provider: 'openai', totalCost: BUDGET.critical }],
      { totalThisMonth: BUDGET.critical * 2 }
    );
    assert.ok(p >= 50, `Expected elevated pressure for high costs, got ${p}`);
  });
  test('loadLocalCostLog returns object', () => {
    const log = loadLocalCostLog();
    assert.ok(typeof log === 'object');
  });
  test('updateGPM writes', () => {
    fs.writeFileSync(GPM_PATH, JSON.stringify({ sectors: {} }));
    updateGPM(25, [{ provider: 'test', totalCost: 5 }], { totalThisMonth: 5, entries: [] });
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.finance.api_costs.pressure, 25);
  });
  test('updateGPM corrupted', () => {
    fs.writeFileSync(GPM_PATH, 'broken json');
    updateGPM(10, [{ provider: 'x', totalCost: 1 }], { totalThisMonth: 1, entries: [] });
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.finance.api_costs.pressure, 10);
  });
  test('updateGPM trend', () => {
    fs.writeFileSync(GPM_PATH, JSON.stringify({
      sectors: { finance: { api_costs: { pressure: 5 } } }
    }));
    updateGPM(60, [{ provider: 'x', totalCost: 30 }], { totalThisMonth: 30, entries: [] });
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.finance.api_costs.trend, 'UP');
  });
  test('BUDGET has thresholds', () => {
    assert.ok(typeof BUDGET.warning === 'number');
    assert.ok(typeof BUDGET.critical === 'number');
    assert.ok(BUDGET.critical > BUDGET.warning);
  });
});
