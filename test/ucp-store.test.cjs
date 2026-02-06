'use strict';

/**
 * VocalIA UCP Store Tests
 *
 * Tests:
 * - LTV tier calculation
 * - UCPStore profile CRUD
 * - Interaction recording
 * - LTV tracking
 * - RGPD deletion
 * - Search and insights
 *
 * Run: node --test test/ucp-store.test.cjs
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { UCPStore, getLTVTier, LTV_TIERS } = require('../core/ucp-store.cjs');

const TEST_DIR = path.join(__dirname, '../data/ucp/__test__');
const TENANT = '__test_ucp_tenant__';

describe('LTV Tiers', () => {
  test('getLTVTier returns bronze for 0', () => {
    const result = getLTVTier(0);
    assert.strictEqual(result.tier, 'bronze');
  });

  test('getLTVTier returns silver for 100', () => {
    const result = getLTVTier(100);
    assert.strictEqual(result.tier, 'silver');
  });

  test('getLTVTier returns gold for 500', () => {
    const result = getLTVTier(500);
    assert.strictEqual(result.tier, 'gold');
  });

  test('getLTVTier returns platinum for 2000', () => {
    const result = getLTVTier(2000);
    assert.strictEqual(result.tier, 'platinum');
  });

  test('getLTVTier returns diamond for 10000', () => {
    const result = getLTVTier(10000);
    assert.strictEqual(result.tier, 'diamond');
  });

  test('getLTVTier returns diamond for 99999', () => {
    const result = getLTVTier(99999);
    assert.strictEqual(result.tier, 'diamond');
  });

  test('getLTVTier handles boundary 99 → bronze', () => {
    const result = getLTVTier(99);
    assert.strictEqual(result.tier, 'bronze');
  });

  test('getLTVTier handles boundary 499 → silver', () => {
    const result = getLTVTier(499);
    assert.strictEqual(result.tier, 'silver');
  });

  test('LTV_TIERS has 5 tiers', () => {
    assert.strictEqual(Object.keys(LTV_TIERS).length, 5);
  });
});

describe('UCPStore Profile CRUD', () => {
  let store;

  beforeEach(() => {
    store = new UCPStore({ baseDir: TEST_DIR });
  });

  afterEach(() => {
    const tenantDir = path.join(TEST_DIR, TENANT);
    if (fs.existsSync(tenantDir)) {
      fs.rmSync(tenantDir, { recursive: true, force: true });
    }
  });

  test('upsertProfile creates new profile', () => {
    const profile = store.upsertProfile(TENANT, 'cust_001', {
      name: 'Ahmed',
      email: 'ahmed@test.com',
      phone: '+212600000000'
    });
    assert.strictEqual(profile.name, 'Ahmed');
    assert.strictEqual(profile.customer_id, 'cust_001');
    assert.strictEqual(profile.tenant_id, TENANT);
    assert.ok(profile.created_at);
    assert.ok(profile.updated_at);
  });

  test('getProfile retrieves existing profile', () => {
    store.upsertProfile(TENANT, 'cust_002', { name: 'Fatima' });
    const result = store.getProfile(TENANT, 'cust_002');
    assert.strictEqual(result.name, 'Fatima');
  });

  test('getProfile returns null for nonexistent', () => {
    const result = store.getProfile(TENANT, 'nonexistent');
    assert.strictEqual(result, null);
  });

  test('upsertProfile updates existing profile', () => {
    store.upsertProfile(TENANT, 'cust_003', { name: 'Ali', city: 'Casablanca' });
    store.upsertProfile(TENANT, 'cust_003', { city: 'Rabat' });
    const result = store.getProfile(TENANT, 'cust_003');
    assert.strictEqual(result.name, 'Ali');
    assert.strictEqual(result.city, 'Rabat');
  });

  test('deleteProfile removes profile and returns true', () => {
    store.upsertProfile(TENANT, 'cust_del', { name: 'ToDelete' });
    const deleted = store.deleteProfile(TENANT, 'cust_del');
    assert.strictEqual(deleted, true);
    assert.strictEqual(store.getProfile(TENANT, 'cust_del'), null);
  });

  test('deleteProfile returns false for nonexistent', () => {
    const deleted = store.deleteProfile(TENANT, 'nonexistent');
    assert.strictEqual(deleted, false);
  });

  test('searchProfiles filters by criteria', () => {
    store.upsertProfile(TENANT, 'c1', { name: 'A', city: 'Casa' });
    store.upsertProfile(TENANT, 'c2', { name: 'B', city: 'Rabat' });
    store.upsertProfile(TENANT, 'c3', { name: 'C', city: 'Casa' });
    const results = store.searchProfiles(TENANT, { city: 'Casa' });
    assert.strictEqual(results.length, 2);
  });

  test('listProfiles returns sorted by updated_at desc', () => {
    store.upsertProfile(TENANT, 'p1', { name: 'First' });
    store.upsertProfile(TENANT, 'p2', { name: 'Second' });
    const list = store.listProfiles(TENANT);
    assert.ok(list.length >= 2);
    assert.ok(new Date(list[0].updated_at) >= new Date(list[1].updated_at));
  });

  test('listProfiles respects limit option', () => {
    store.upsertProfile(TENANT, 'l1', { name: 'A' });
    store.upsertProfile(TENANT, 'l2', { name: 'B' });
    store.upsertProfile(TENANT, 'l3', { name: 'C' });
    const list = store.listProfiles(TENANT, { limit: 2 });
    assert.strictEqual(list.length, 2);
  });

  test('loadProfiles returns empty object for new tenant', () => {
    const profiles = store.loadProfiles('__nonexistent_tenant__');
    assert.deepStrictEqual(profiles, {});
    // Cleanup
    const dir = path.join(TEST_DIR, '__nonexistent_tenant__');
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('UCPStore Interactions', () => {
  let store;

  beforeEach(() => {
    store = new UCPStore({ baseDir: TEST_DIR });
  });

  afterEach(() => {
    const tenantDir = path.join(TEST_DIR, TENANT);
    if (fs.existsSync(tenantDir)) {
      fs.rmSync(tenantDir, { recursive: true, force: true });
    }
  });

  test('recordInteraction creates entry', () => {
    store.upsertProfile(TENANT, 'int_cust', { name: 'Test' });
    const entry = store.recordInteraction(TENANT, 'int_cust', {
      type: 'call',
      duration: 120,
      channel: 'telephony'
    });
    assert.ok(entry.id);
    assert.strictEqual(entry.customer_id, 'int_cust');
    assert.strictEqual(entry.type, 'call');
    assert.strictEqual(entry.duration, 120);
    assert.ok(entry.timestamp);
  });

  test('recordInteraction updates profile interaction_count', () => {
    store.upsertProfile(TENANT, 'count_cust', { name: 'Counter' });
    store.recordInteraction(TENANT, 'count_cust', { type: 'call' });
    store.recordInteraction(TENANT, 'count_cust', { type: 'chat' });
    const profile = store.getProfile(TENANT, 'count_cust');
    assert.strictEqual(profile.interaction_count, 2);
  });

  test('getInteractions returns customer interactions', () => {
    store.upsertProfile(TENANT, 'get_int', { name: 'Test' });
    store.recordInteraction(TENANT, 'get_int', { type: 'call' });
    store.recordInteraction(TENANT, 'get_int', { type: 'chat' });
    store.recordInteraction(TENANT, 'other_cust', { type: 'call' });

    const interactions = store.getInteractions(TENANT, 'get_int');
    assert.strictEqual(interactions.length, 2);
  });

  test('getInteractions returns empty for nonexistent', () => {
    const interactions = store.getInteractions(TENANT, 'nobody');
    assert.deepStrictEqual(interactions, []);
  });

  test('getInteractions respects limit', () => {
    store.upsertProfile(TENANT, 'lim_cust', { name: 'Test' });
    for (let i = 0; i < 5; i++) {
      store.recordInteraction(TENANT, 'lim_cust', { type: 'call', num: i });
    }
    const limited = store.getInteractions(TENANT, 'lim_cust', { limit: 3 });
    assert.strictEqual(limited.length, 3);
  });
});

describe('UCPStore LTV Tracking', () => {
  let store;

  beforeEach(() => {
    store = new UCPStore({ baseDir: TEST_DIR });
  });

  afterEach(() => {
    const tenantDir = path.join(TEST_DIR, TENANT);
    if (fs.existsSync(tenantDir)) {
      fs.rmSync(tenantDir, { recursive: true, force: true });
    }
  });

  test('updateLTV creates LTV record', () => {
    store.upsertProfile(TENANT, 'ltv_cust', { name: 'Buyer' });
    const ltv = store.updateLTV(TENANT, 'ltv_cust', 250, 'purchase');
    assert.strictEqual(ltv.total_value, 250);
    assert.strictEqual(ltv.transaction_count, 1);
    assert.strictEqual(ltv.tier.tier, 'silver');
  });

  test('updateLTV accumulates value', () => {
    store.upsertProfile(TENANT, 'acc_cust', { name: 'Accumulator' });
    store.updateLTV(TENANT, 'acc_cust', 100, 'purchase');
    store.updateLTV(TENANT, 'acc_cust', 200, 'purchase');
    store.updateLTV(TENANT, 'acc_cust', 300, 'purchase');
    const ltv = store.getLTV(TENANT, 'acc_cust');
    assert.strictEqual(ltv.total_value, 600);
    assert.strictEqual(ltv.transaction_count, 3);
    assert.strictEqual(ltv.tier.tier, 'gold');
  });

  test('updateLTV updates profile ltv_tier', () => {
    store.upsertProfile(TENANT, 'tier_cust', { name: 'Tiered' });
    store.updateLTV(TENANT, 'tier_cust', 2500, 'purchase');
    const profile = store.getProfile(TENANT, 'tier_cust');
    assert.strictEqual(profile.ltv_tier, 'platinum');
    assert.strictEqual(profile.ltv_value, 2500);
  });

  test('getLTV returns null for nonexistent', () => {
    const ltv = store.getLTV(TENANT, 'nobody');
    assert.strictEqual(ltv, null);
  });

  test('updateLTV keeps max 100 transactions in history', () => {
    store.upsertProfile(TENANT, 'hist_cust', { name: 'History' });
    for (let i = 0; i < 110; i++) {
      store.updateLTV(TENANT, 'hist_cust', 1, 'purchase');
    }
    const ltv = store.getLTV(TENANT, 'hist_cust');
    assert.strictEqual(ltv.history.length, 100);
    assert.strictEqual(ltv.total_value, 110);
  });
});

describe('UCPStore Insights', () => {
  let store;

  beforeEach(() => {
    store = new UCPStore({ baseDir: TEST_DIR });
  });

  afterEach(() => {
    const tenantDir = path.join(TEST_DIR, TENANT);
    if (fs.existsSync(tenantDir)) {
      fs.rmSync(tenantDir, { recursive: true, force: true });
    }
  });

  test('getInsights returns full customer view', () => {
    store.upsertProfile(TENANT, 'ins_cust', {
      name: 'Insight Customer',
      email: 'insight@test.com',
      phone: '+212600000000'
    });
    store.recordInteraction(TENANT, 'ins_cust', { type: 'call' });
    store.updateLTV(TENANT, 'ins_cust', 500, 'purchase');

    const insights = store.getInsights(TENANT, 'ins_cust');
    assert.ok(insights);
    assert.strictEqual(insights.customer_id, 'ins_cust');
    assert.strictEqual(insights.profile.name, 'Insight Customer');
    assert.strictEqual(insights.ltv.total_value, 500);
    assert.ok(insights.recent_interactions.length >= 1);
  });

  test('getInsights returns null for nonexistent', () => {
    const insights = store.getInsights(TENANT, 'nobody');
    assert.strictEqual(insights, null);
  });
});
