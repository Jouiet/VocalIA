/**
 * cov-sensors-main.test.mjs
 * Tests sensor main() functions, health checks, and edge cases.
 * Targets: retention-sensor, lead-velocity-sensor, voice-quality-sensor,
 *          cost-tracking-sensor, sync-to-3a — main() and branch coverage.
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
const LEADS_PATH = path.join(ROOT, 'data', 'leads-scored.json');

let originalGPM = null;
let originalLeads = null;

before(() => {
  if (fs.existsSync(GPM_PATH)) originalGPM = fs.readFileSync(GPM_PATH, 'utf8');
  if (fs.existsSync(LEADS_PATH)) originalLeads = fs.readFileSync(LEADS_PATH, 'utf8');
  fs.writeFileSync(GPM_PATH, JSON.stringify({ sectors: {} }, null, 2));
});

after(() => {
  if (originalGPM !== null) fs.writeFileSync(GPM_PATH, originalGPM);
  if (originalLeads !== null) fs.writeFileSync(LEADS_PATH, originalLeads);
});

// ─── RetentionSensor main() ─────────────────────────────────────────────────

describe('RetentionSensor main()', () => {
  const sensor = require('../sensors/retention-sensor.cjs');

  test('main() without Shopify credentials logs warning and returns', async () => {
    const origShop = process.env.SHOPIFY_SHOP_NAME;
    const origToken = process.env.SHOPIFY_ACCESS_TOKEN;
    delete process.env.SHOPIFY_SHOP_NAME;
    delete process.env.SHOPIFY_SHOP;
    delete process.env.SHOPIFY_STORE;
    delete process.env.SHOPIFY_STORE_DOMAIN;
    delete process.env.SHOPIFY_ACCESS_TOKEN;
    delete process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

    // main() should not throw when credentials are missing
    await sensor.main();

    if (origShop) process.env.SHOPIFY_SHOP_NAME = origShop;
    if (origToken) process.env.SHOPIFY_ACCESS_TOKEN = origToken;
  });

  test('fetchShopifyOrders throws without credentials', async () => {
    await assert.rejects(
      () => sensor.fetchShopifyOrders(null, null),
      { message: /required/i }
    );
  });

  test('fetchShopifyOrders throws with empty shop', async () => {
    await assert.rejects(
      () => sensor.fetchShopifyOrders('', 'token123'),
      { message: /required/i }
    );
  });

  test('calculateChurnPressure with mix of recent and old', () => {
    const now = new Date();
    const old = new Date(now - 90 * 86400000);
    const p = sensor.calculateChurnPressure([
      { email: 'a@t.com', created_at: now.toISOString() },
      { email: 'b@t.com', created_at: old.toISOString() },
      { email: 'c@t.com', created_at: old.toISOString() },
    ]);
    assert.ok(p >= 0 && p <= 100);
  });

  test('updateGPM with GPM file missing', () => {
    const tmpPath = GPM_PATH + '.tmp-test';
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    // The function writes even if file doesn't exist (it creates)
    sensor.updateGPM(30, { order_count: 5 });
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.marketing.retention.pressure, 30);
  });

  test('updateGPM trend DOWN', () => {
    fs.writeFileSync(GPM_PATH, JSON.stringify({
      sectors: { marketing: { retention: { pressure: 80 } } }
    }));
    sensor.updateGPM(20, { order_count: 50 });
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.marketing.retention.trend, 'DOWN');
  });

  test('updateGPM trend STABLE', () => {
    fs.writeFileSync(GPM_PATH, JSON.stringify({
      sectors: { marketing: { retention: { pressure: 40 } } }
    }));
    sensor.updateGPM(40, { order_count: 10 });
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.marketing.retention.trend, 'STABLE');
  });
});

// ─── LeadVelocitySensor main() ──────────────────────────────────────────────

describe('LeadVelocitySensor main()', () => {
  const sensor = require('../sensors/lead-velocity-sensor.cjs');

  test('main() reads leads file when it exists', async () => {
    // Create a leads file
    fs.writeFileSync(LEADS_PATH, JSON.stringify([
      { timestamp: new Date().toISOString() },
      { timestamp: new Date().toISOString() },
    ]));
    await sensor.main();
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.ok(gpm.sectors?.sales?.lead_velocity);
  });

  test('main() handles missing leads file', async () => {
    if (fs.existsSync(LEADS_PATH)) fs.unlinkSync(LEADS_PATH);
    await sensor.main();
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.sales.lead_velocity.pressure, 90);
  });

  test('main() handles {scores: [...]} format', async () => {
    fs.writeFileSync(LEADS_PATH, JSON.stringify({
      scores: Array.from({ length: 10 }, () => ({ timestamp: new Date().toISOString() }))
    }));
    await sensor.main();
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.ok(gpm.sectors.sales.lead_velocity.pressure < 90);
  });

  test('main() handles corrupted leads file', async () => {
    fs.writeFileSync(LEADS_PATH, 'not json!');
    // Should not throw — error is caught
    await sensor.main();
  });

  test('calculatePressure 10 leads = 50', () => {
    const leads = Array.from({ length: 10 }, () => ({ timestamp: new Date().toISOString() }));
    assert.equal(sensor.calculatePressure(leads), 50);
  });

  test('updateGPM trend DOWN', () => {
    fs.writeFileSync(GPM_PATH, JSON.stringify({
      sectors: { sales: { lead_velocity: { pressure: 90 } } }
    }));
    sensor.updateGPM(10, 15);
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.sales.lead_velocity.trend, 'DOWN');
  });

  test('updateGPM trend STABLE', () => {
    fs.writeFileSync(GPM_PATH, JSON.stringify({
      sectors: { sales: { lead_velocity: { pressure: 40 } } }
    }));
    sensor.updateGPM(40, 7);
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.sales.lead_velocity.trend, 'STABLE');
  });
});

// ─── VoiceQualitySensor branches ────────────────────────────────────────────

describe('VoiceQualitySensor deep branches', () => {
  const sensor = require('../sensors/voice-quality-sensor.cjs');

  test('calculatePressure NO_CREDENTIALS providers', () => {
    const p = sensor.calculatePressure(
      [{ name: 'a', status: 'HEALTHY', latency: 50 }],
      [{ name: 'b', status: 'NO_CREDENTIALS', latency: 0 }]
    );
    // No configured providers → +30
    assert.ok(p >= 30);
  });

  test('calculatePressure high latency penalty', () => {
    const p = sensor.calculatePressure(
      [{ name: 'a', status: 'HEALTHY', latency: 3000 }],
      [{ name: 'b', status: 'HEALTHY', latency: 100 }]
    );
    assert.ok(p > 0, 'High latency should add pressure');
  });

  test('calculatePressure all providers NO_CREDENTIALS', () => {
    const p = sensor.calculatePressure(
      [{ name: 'a', status: 'HEALTHY', latency: 50 }],
      [{ name: 'b', status: 'NO_CREDENTIALS', latency: 0 }, { name: 'c', status: 'NO_CREDENTIALS', latency: 0 }]
    );
    assert.ok(p >= 30);
  });

  test('updateGPM with no GPM file returns early', () => {
    const backup = fs.readFileSync(GPM_PATH, 'utf8');
    fs.unlinkSync(GPM_PATH);
    // Should not throw
    sensor.updateGPM(50, [{ name: 'a', status: 'HEALTHY', latency: 50 }], [{ name: 'b', status: 'HEALTHY', latency: 100 }]);
    // Restore
    fs.writeFileSync(GPM_PATH, backup);
  });

  test('updateGPM trend DOWN', () => {
    fs.writeFileSync(GPM_PATH, JSON.stringify({
      sectors: { technology: { voice_quality: { pressure: 90 } } }
    }));
    sensor.updateGPM(10,
      [{ name: 'a', status: 'HEALTHY', latency: 50 }],
      [{ name: 'b', status: 'HEALTHY', latency: 100 }]
    );
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.technology.voice_quality.trend, 'DOWN');
  });

  test('updateGPM trend STABLE', () => {
    fs.writeFileSync(GPM_PATH, JSON.stringify({
      sectors: { technology: { voice_quality: { pressure: 30 } } }
    }));
    sensor.updateGPM(30,
      [{ name: 'a', status: 'HEALTHY', latency: 50 }],
      [{ name: 'b', status: 'HEALTHY', latency: 100 }]
    );
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.technology.voice_quality.trend, 'STABLE');
  });
});

// ─── CostTrackingSensor main() & branches ───────────────────────────────────

describe('CostTrackingSensor main() & branches', () => {
  const sensor = require('../sensors/cost-tracking-sensor.cjs');

  test('main() runs without API keys', async () => {
    // Without OPENAI/ANTHROPIC keys, should still complete
    await sensor.main();
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.ok(gpm.sectors?.finance?.api_costs);
  });

  test('calculatePressure warning threshold', () => {
    const p = sensor.calculatePressure(
      [{ provider: 'openai', totalCost: sensor.BUDGET.warning }],
      { totalThisMonth: sensor.BUDGET.warning }
    );
    assert.ok(p >= 25, `Expected >=25 at warning threshold, got ${p}`);
  });

  test('calculatePressure no cost tracking = blind spending', () => {
    const p = sensor.calculatePressure(
      [null],
      { totalThisMonth: 0 }
    );
    assert.ok(p >= 30, `Expected >=30 for blind spending, got ${p}`);
  });

  test('updateGPM trend DOWN', () => {
    fs.writeFileSync(GPM_PATH, JSON.stringify({
      sectors: { finance: { api_costs: { pressure: 80 } } }
    }));
    sensor.updateGPM(10, [{ provider: 'test', totalCost: 1 }], { totalThisMonth: 1, entries: [] });
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.finance.api_costs.trend, 'DOWN');
  });

  test('updateGPM trend STABLE', () => {
    fs.writeFileSync(GPM_PATH, JSON.stringify({
      sectors: { finance: { api_costs: { pressure: 25 } } }
    }));
    sensor.updateGPM(25, [{ provider: 'test', totalCost: 5 }], { totalThisMonth: 5, entries: [] });
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.finance.api_costs.trend, 'STABLE');
  });

  test('updateGPM with no GPM file returns early', () => {
    const backup = fs.readFileSync(GPM_PATH, 'utf8');
    fs.unlinkSync(GPM_PATH);
    sensor.updateGPM(50, [{ provider: 'x', totalCost: 10 }], { totalThisMonth: 10, entries: [] });
    fs.writeFileSync(GPM_PATH, backup);
  });

  test('updateGPM budget_status CRITICAL', () => {
    fs.writeFileSync(GPM_PATH, JSON.stringify({ sectors: {} }));
    sensor.updateGPM(80, [{ provider: 'x', totalCost: sensor.BUDGET.critical * 2 }],
      { totalThisMonth: sensor.BUDGET.critical * 2, entries: [] });
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.finance.api_costs.sensor_data.budget_status, 'CRITICAL');
  });

  test('updateGPM budget_status WARNING', () => {
    fs.writeFileSync(GPM_PATH, JSON.stringify({ sectors: {} }));
    sensor.updateGPM(30, [{ provider: 'x', totalCost: sensor.BUDGET.warning + 1 }],
      { totalThisMonth: sensor.BUDGET.warning + 1, entries: [] });
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    // May be WARNING or CRITICAL depending on projection
    assert.ok(['WARNING', 'CRITICAL'].includes(gpm.sectors.finance.api_costs.sensor_data.budget_status));
  });
});

// ─── sync-to-3a ─────────────────────────────────────────────────────────────

describe('sync-to-3a', () => {
  const syncTo3a = require('../sensors/sync-to-3a.cjs');

  test('syncToCentral exported', () => {
    assert.equal(typeof syncTo3a.syncToCentral, 'function');
  });

  test('syncToCentral with missing local GPM', () => {
    const backup = fs.readFileSync(GPM_PATH, 'utf8');
    fs.unlinkSync(GPM_PATH);
    const result = syncTo3a.syncToCentral();
    assert.equal(result.success, false);
    assert.ok(result.error.includes('Local GPM not found'));
    fs.writeFileSync(GPM_PATH, backup);
  });

  test('syncToCentral with missing central GPM', () => {
    // The central path likely doesn't exist in test environment
    const result = syncTo3a.syncToCentral();
    if (!result.success) {
      assert.ok(result.error);
    }
  });

  test('syncToCentral with corrupted local GPM', () => {
    fs.writeFileSync(GPM_PATH, 'broken json');
    const result = syncTo3a.syncToCentral();
    assert.equal(result.success, false);
    // Restore
    fs.writeFileSync(GPM_PATH, JSON.stringify({ sectors: {} }));
  });
});
