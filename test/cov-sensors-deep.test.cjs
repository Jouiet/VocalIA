'use strict';

/**
 * cov-sensors-deep.test.cjs
 * Deep coverage for sensors — CJS format for proper c8 tracking.
 * Tests main(), health check, all branches.
 */
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
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
  else if (fs.existsSync(GPM_PATH)) fs.unlinkSync(GPM_PATH);
  if (originalLeads !== null) fs.writeFileSync(LEADS_PATH, originalLeads);
  else if (fs.existsSync(LEADS_PATH)) fs.unlinkSync(LEADS_PATH);
});

// ─── Lead Velocity Sensor ───────────────────────────────────────────────────

describe('LeadVelocitySensor deep', () => {
  const lvs = require('../sensors/lead-velocity-sensor.cjs');

  test('main() with leads file', async () => {
    fs.writeFileSync(GPM_PATH, JSON.stringify({ sectors: {} }));
    fs.writeFileSync(LEADS_PATH, JSON.stringify([
      { timestamp: new Date().toISOString() },
      { timestamp: new Date().toISOString() },
      { timestamp: new Date().toISOString() },
    ]));
    await lvs.main();
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.ok(gpm.sectors.sales.lead_velocity);
    assert.ok(gpm.sectors.sales.lead_velocity.pressure >= 0);
  });

  test('main() without leads file = 90 pressure', async () => {
    if (fs.existsSync(LEADS_PATH)) fs.unlinkSync(LEADS_PATH);
    fs.writeFileSync(GPM_PATH, JSON.stringify({ sectors: {} }));
    await lvs.main();
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.sales.lead_velocity.pressure, 90);
  });

  test('main() with {scores: [...]} format', async () => {
    fs.writeFileSync(GPM_PATH, JSON.stringify({ sectors: {} }));
    fs.writeFileSync(LEADS_PATH, JSON.stringify({
      scores: Array.from({ length: 7 }, () => ({ timestamp: new Date().toISOString() }))
    }));
    await lvs.main();
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.sales.lead_velocity.pressure, 62);
  });

  test('main() with corrupted leads file catches error', async () => {
    fs.writeFileSync(LEADS_PATH, 'not valid json!');
    fs.writeFileSync(GPM_PATH, JSON.stringify({ sectors: {} }));
    // Should not throw — error caught internally
    await lvs.main();
  });

  test('calculatePressure edge cases', () => {
    assert.equal(lvs.calculatePressure(null), 90);
    assert.equal(lvs.calculatePressure(undefined), 90);
    assert.equal(lvs.calculatePressure([]), 90);

    // 1 lead → continuous: 90 - 4 = 86
    const one = [{ timestamp: new Date().toISOString() }];
    assert.equal(lvs.calculatePressure(one), 86);

    // 5 leads → continuous: 90 - 20 = 70
    const five = Array.from({ length: 5 }, () => ({ timestamp: new Date().toISOString() }));
    assert.equal(lvs.calculatePressure(five), 70);

    // 20+ leads
    const twenty = Array.from({ length: 20 }, () => ({ timestamp: new Date().toISOString() }));
    assert.equal(lvs.calculatePressure(twenty), 10);
  });

  test('updateGPM creates structure', () => {
    fs.writeFileSync(GPM_PATH, JSON.stringify({}));
    lvs.updateGPM(50, 5);
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.sales.lead_velocity.pressure, 50);
    assert.equal(gpm.sectors.sales.lead_velocity.sensor_data.leads_last_24h, 5);
  });

  test('updateGPM trend DOWN', () => {
    fs.writeFileSync(GPM_PATH, JSON.stringify({
      sectors: { sales: { lead_velocity: { pressure: 90 } } }
    }));
    lvs.updateGPM(10, 15);
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.sales.lead_velocity.trend, 'DOWN');
  });

  test('updateGPM trend STABLE', () => {
    fs.writeFileSync(GPM_PATH, JSON.stringify({
      sectors: { sales: { lead_velocity: { pressure: 40 } } }
    }));
    lvs.updateGPM(40, 7);
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.sales.lead_velocity.trend, 'STABLE');
  });

  test('updateGPM with corrupted GPM file', () => {
    fs.writeFileSync(GPM_PATH, 'bad json');
    lvs.updateGPM(60, 3);
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.sales.lead_velocity.pressure, 60);
  });
});

// ─── Retention Sensor ───────────────────────────────────────────────────────

describe('RetentionSensor deep', () => {
  const rs = require('../sensors/retention-sensor.cjs');

  test('main() without credentials', async () => {
    const origShop = process.env.SHOPIFY_SHOP_NAME;
    const origToken = process.env.SHOPIFY_ACCESS_TOKEN;
    delete process.env.SHOPIFY_SHOP_NAME;
    delete process.env.SHOPIFY_SHOP;
    delete process.env.SHOPIFY_STORE;
    delete process.env.SHOPIFY_STORE_DOMAIN;
    delete process.env.SHOPIFY_ACCESS_TOKEN;
    delete process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

    await rs.main();

    if (origShop) process.env.SHOPIFY_SHOP_NAME = origShop;
    if (origToken) process.env.SHOPIFY_ACCESS_TOKEN = origToken;
  });

  test('fetchShopifyOrders throws without credentials', async () => {
    await assert.rejects(() => rs.fetchShopifyOrders(null, null), /required/i);
    await assert.rejects(() => rs.fetchShopifyOrders('', ''), /required/i);
  });

  test('calculateChurnPressure edge cases', () => {
    assert.equal(rs.calculateChurnPressure(null), 0);
    assert.equal(rs.calculateChurnPressure([]), 0);
    assert.equal(rs.calculateChurnPressure(undefined), 0);
  });

  test('calculateChurnPressure with customers', () => {
    const now = new Date();
    const recent = now.toISOString();
    const old60 = new Date(now - 60 * 86400000).toISOString();
    const old120 = new Date(now - 120 * 86400000).toISOString();

    // All recent = low pressure
    const p1 = rs.calculateChurnPressure([
      { email: 'a@t.com', created_at: recent },
      { email: 'b@t.com', created_at: recent },
    ]);
    assert.ok(p1 < 50);

    // All old = high pressure
    const p2 = rs.calculateChurnPressure([
      { email: 'a@t.com', created_at: old120 },
      { email: 'b@t.com', created_at: old120 },
    ]);
    assert.ok(p2 > 50);

    // Mixed
    const p3 = rs.calculateChurnPressure([
      { email: 'a@t.com', created_at: recent },
      { email: 'b@t.com', created_at: old120 },
    ]);
    assert.ok(p3 >= 0 && p3 <= 100);

    // Orders without email are skipped
    assert.equal(rs.calculateChurnPressure([{ created_at: recent }]), 0);

    // Multiple orders same customer → uses latest
    const p4 = rs.calculateChurnPressure([
      { email: 'a@t.com', created_at: recent },
      { email: 'a@t.com', created_at: old60 },
    ]);
    assert.ok(p4 >= 0);
  });

  test('updateGPM all trends', () => {
    // UP
    fs.writeFileSync(GPM_PATH, JSON.stringify({ sectors: { marketing: { retention: { pressure: 10 } } } }));
    rs.updateGPM(60, { order_count: 5 });
    let gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.marketing.retention.trend, 'UP');

    // DOWN
    fs.writeFileSync(GPM_PATH, JSON.stringify({ sectors: { marketing: { retention: { pressure: 80 } } } }));
    rs.updateGPM(20, { order_count: 50 });
    gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.marketing.retention.trend, 'DOWN');

    // STABLE
    fs.writeFileSync(GPM_PATH, JSON.stringify({ sectors: { marketing: { retention: { pressure: 40 } } } }));
    rs.updateGPM(40, { order_count: 10 });
    gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.marketing.retention.trend, 'STABLE');
  });

  test('updateGPM with corrupted file', () => {
    fs.writeFileSync(GPM_PATH, '{invalid');
    rs.updateGPM(55, { order_count: 8 });
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.marketing.retention.pressure, 55);
  });
});

// ─── Cost Tracking Sensor ───────────────────────────────────────────────────

describe('CostTrackingSensor deep', () => {
  const cts = require('../sensors/cost-tracking-sensor.cjs');

  test('main() without API keys', async () => {
    fs.writeFileSync(GPM_PATH, JSON.stringify({ sectors: {} }));
    await cts.main();
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.ok(gpm.sectors.finance.api_costs);
  });

  test('calculatePressure edge cases', () => {
    // No costs, no tracking = blind spending (30)
    const p1 = cts.calculatePressure([null], { totalThisMonth: 0 });
    assert.equal(p1, 30);

    // Warning threshold
    const p2 = cts.calculatePressure(
      [{ provider: 'test', totalCost: cts.BUDGET.warning }],
      { totalThisMonth: cts.BUDGET.warning * 2 }
    );
    assert.ok(p2 >= 25);

    // Critical threshold
    const p3 = cts.calculatePressure(
      [{ provider: 'test', totalCost: cts.BUDGET.critical }],
      { totalThisMonth: cts.BUDGET.critical * 2 }
    );
    assert.ok(p3 >= 50);

    // With costs but under warning
    const p4 = cts.calculatePressure(
      [{ provider: 'test', totalCost: 1 }],
      { totalThisMonth: 1 }
    );
    assert.ok(p4 <= 30);
  });

  test('loadLocalCostLog returns object', () => {
    const log = cts.loadLocalCostLog();
    assert.ok(typeof log === 'object');
    assert.ok('totalThisMonth' in log);
  });

  test('BUDGET thresholds', () => {
    assert.ok(cts.BUDGET.warning > 0);
    assert.ok(cts.BUDGET.critical > cts.BUDGET.warning);
  });

  test('updateGPM with all budget statuses', () => {
    // OK status
    fs.writeFileSync(GPM_PATH, JSON.stringify({ sectors: {} }));
    cts.updateGPM(10, [{ provider: 'test', totalCost: 1 }], { totalThisMonth: 1, entries: [] });
    let gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.finance.api_costs.sensor_data.budget_status, 'OK');

    // CRITICAL status
    fs.writeFileSync(GPM_PATH, JSON.stringify({ sectors: {} }));
    cts.updateGPM(80, [{ provider: 'test', totalCost: cts.BUDGET.critical * 2 }],
      { totalThisMonth: cts.BUDGET.critical * 2, entries: [] });
    gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.finance.api_costs.sensor_data.budget_status, 'CRITICAL');
  });

  test('updateGPM trends', () => {
    // UP
    fs.writeFileSync(GPM_PATH, JSON.stringify({ sectors: { finance: { api_costs: { pressure: 5 } } } }));
    cts.updateGPM(60, [{ provider: 'x', totalCost: 30 }], { totalThisMonth: 30, entries: [] });
    let gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.finance.api_costs.trend, 'UP');

    // DOWN
    fs.writeFileSync(GPM_PATH, JSON.stringify({ sectors: { finance: { api_costs: { pressure: 80 } } } }));
    cts.updateGPM(10, [{ provider: 'x', totalCost: 1 }], { totalThisMonth: 1, entries: [] });
    gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.finance.api_costs.trend, 'DOWN');

    // STABLE
    fs.writeFileSync(GPM_PATH, JSON.stringify({ sectors: { finance: { api_costs: { pressure: 25 } } } }));
    cts.updateGPM(25, [{ provider: 'x', totalCost: 5 }], { totalThisMonth: 5, entries: [] });
    gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.finance.api_costs.trend, 'STABLE');
  });

  test('updateGPM with corrupted GPM', () => {
    fs.writeFileSync(GPM_PATH, 'broken json');
    cts.updateGPM(40, [{ provider: 'test', totalCost: 10 }], { totalThisMonth: 10, entries: [] });
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.finance.api_costs.pressure, 40);
  });

  test('updateGPM with no GPM file returns early', () => {
    const bk = fs.readFileSync(GPM_PATH, 'utf8');
    fs.unlinkSync(GPM_PATH);
    // Should not throw
    cts.updateGPM(50, [{ provider: 'x', totalCost: 10 }], { totalThisMonth: 10, entries: [] });
    fs.writeFileSync(GPM_PATH, bk);
  });

  test('updateGPM with null cost entries', () => {
    fs.writeFileSync(GPM_PATH, JSON.stringify({ sectors: {} }));
    cts.updateGPM(15, [null, { provider: 'test', totalCost: 5 }, null], { totalThisMonth: 5, entries: [] });
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.finance.api_costs.sensor_data.providers_tracked, 1);
  });
});

// ─── Voice Quality Sensor ───────────────────────────────────────────────────

describe('VoiceQualitySensor deep', () => {
  const vqs = require('../sensors/voice-quality-sensor.cjs');

  test('calculatePressure all healthy', () => {
    const p = vqs.calculatePressure(
      [{ name: 'a', status: 'HEALTHY', latency: 50 }],
      [{ name: 'b', status: 'HEALTHY', latency: 100 }]
    );
    assert.ok(p <= 10);
  });

  test('calculatePressure all down endpoints', () => {
    const p = vqs.calculatePressure(
      [{ name: 'a', status: 'DOWN', latency: 0 }],
      [{ name: 'b', status: 'HEALTHY', latency: 100 }]
    );
    assert.ok(p >= 50); // All endpoints down = +50
  });

  test('calculatePressure all providers down', () => {
    const p = vqs.calculatePressure(
      [{ name: 'a', status: 'HEALTHY', latency: 50 }],
      [{ name: 'b', status: 'DOWN', latency: 0 }]
    );
    assert.ok(p >= 40); // All providers failing = +40
  });

  test('calculatePressure NO_CREDENTIALS = no configured providers', () => {
    const p = vqs.calculatePressure(
      [{ name: 'a', status: 'HEALTHY', latency: 50 }],
      [{ name: 'b', status: 'NO_CREDENTIALS', latency: 0 }]
    );
    assert.ok(p >= 30); // No configured providers = +30
  });

  test('calculatePressure high latency penalty', () => {
    const p = vqs.calculatePressure(
      [{ name: 'a', status: 'HEALTHY', latency: 3000 }],
      [{ name: 'b', status: 'HEALTHY', latency: 100 }]
    );
    assert.ok(p >= 5); // High latency = +5 per endpoint
  });

  test('calculatePressure partial endpoints down', () => {
    const p = vqs.calculatePressure(
      [
        { name: 'a', status: 'HEALTHY', latency: 50 },
        { name: 'b', status: 'DOWN', latency: 0 },
        { name: 'c', status: 'HEALTHY', latency: 80 },
      ],
      [{ name: 'd', status: 'HEALTHY', latency: 100 }]
    );
    // 1/3 endpoints down = round(0.33 * 30) = 10
    assert.ok(p >= 5 && p <= 30);
  });

  test('updateGPM creates structure from scratch', () => {
    fs.writeFileSync(GPM_PATH, JSON.stringify({}));
    vqs.updateGPM(25,
      [{ name: 'a', status: 'HEALTHY', latency: 50 }],
      [{ name: 'b', status: 'HEALTHY', latency: 100 }]
    );
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.technology.voice_quality.pressure, 25);
    assert.ok(gpm.sectors.technology.voice_quality.sensor_data);
    assert.ok(gpm.sectors.technology.voice_quality.sensor_data.endpoint_details);
    assert.ok(gpm.sectors.technology.voice_quality.sensor_data.provider_details);
  });

  test('updateGPM trends', () => {
    const eps = [{ name: 'a', status: 'HEALTHY', latency: 50 }];
    const prvs = [{ name: 'b', status: 'HEALTHY', latency: 100 }];

    // UP
    fs.writeFileSync(GPM_PATH, JSON.stringify({ sectors: { technology: { voice_quality: { pressure: 10 } } } }));
    vqs.updateGPM(50, eps, prvs);
    let gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.technology.voice_quality.trend, 'UP');

    // DOWN
    fs.writeFileSync(GPM_PATH, JSON.stringify({ sectors: { technology: { voice_quality: { pressure: 90 } } } }));
    vqs.updateGPM(20, eps, prvs);
    gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.technology.voice_quality.trend, 'DOWN');

    // STABLE
    fs.writeFileSync(GPM_PATH, JSON.stringify({ sectors: { technology: { voice_quality: { pressure: 30 } } } }));
    vqs.updateGPM(30, eps, prvs);
    gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.technology.voice_quality.trend, 'STABLE');
  });

  test('updateGPM with corrupted GPM file', () => {
    fs.writeFileSync(GPM_PATH, 'bad json');
    vqs.updateGPM(40,
      [{ name: 'a', status: 'HEALTHY', latency: 50 }],
      [{ name: 'b', status: 'HEALTHY', latency: 100 }]
    );
    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));
    assert.equal(gpm.sectors.technology.voice_quality.pressure, 40);
  });

  test('updateGPM with no GPM file', () => {
    const bk = fs.readFileSync(GPM_PATH, 'utf8');
    fs.unlinkSync(GPM_PATH);
    // Should log 'GPM file not found' and return
    vqs.updateGPM(50,
      [{ name: 'a', status: 'HEALTHY', latency: 50 }],
      [{ name: 'b', status: 'HEALTHY', latency: 100 }]
    );
    fs.writeFileSync(GPM_PATH, bk);
  });
});

// ─── sync-to-3a ─────────────────────────────────────────────────────────────

describe('sync-to-3a deep', () => {
  const sync = require('../sensors/sync-to-3a.cjs');

  test('syncToCentral with missing local GPM', () => {
    const bk = fs.readFileSync(GPM_PATH, 'utf8');
    fs.unlinkSync(GPM_PATH);
    const result = sync.syncToCentral();
    assert.equal(result.success, false);
    assert.ok(result.error.includes('Local GPM'));
    fs.writeFileSync(GPM_PATH, bk);
  });

  test('syncToCentral with corrupted local GPM', () => {
    fs.writeFileSync(GPM_PATH, 'broken json');
    const result = sync.syncToCentral();
    assert.equal(result.success, false);
    fs.writeFileSync(GPM_PATH, JSON.stringify({ sectors: {} }));
  });

  test('syncToCentral with missing central GPM', () => {
    fs.writeFileSync(GPM_PATH, JSON.stringify({ sectors: { sales: { lead_velocity: { pressure: 50 } } }, overall_pressure: 50 }));
    const result = sync.syncToCentral();
    // Central GPM likely doesn't exist in test env
    if (!result.success) {
      assert.ok(result.error.includes('Central GPM') || result.error.includes('not found'));
    }
  });
});
