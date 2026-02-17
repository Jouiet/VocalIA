/**
 * VocalIA KB Quotas Tests
 *
 * Tests:
 * - PLAN_QUOTAS constants
 * - KBQuotaManager: plan resolution, alias mapping
 * - Quota checks (entries, storage, languages, imports, crawls)
 * - Usage tracking (create, save, reset monthly)
 * - formatBytes helper
 * - getAllPlans listing
 * - Quota alerts (warning at 80%, critical at 95%)
 *
 * Run: node --test test/kb-quotas.test.mjs
 */



import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { KBQuotaManager, PLAN_QUOTAS } from '../core/kb-quotas.cjs';

const TEST_USAGE_DIR = path.join(import.meta.dirname, '../data/kb-usage');
const TEST_TENANT = '__test_kb_quota__';

describe('PLAN_QUOTAS Constants', () => {
  test('has 5 plans', () => {
    assert.strictEqual(Object.keys(PLAN_QUOTAS).length, 5);
  });

  test('has free, starter, pro, expert_clone, enterprise plans', () => {
    assert.ok(PLAN_QUOTAS.free);
    assert.ok(PLAN_QUOTAS.starter);
    assert.ok(PLAN_QUOTAS.pro);
    assert.ok(PLAN_QUOTAS.expert_clone);
    assert.ok(PLAN_QUOTAS.enterprise);
  });

  test('free plan has lowest limits', () => {
    assert.strictEqual(PLAN_QUOTAS.free.max_entries, 50);
    assert.strictEqual(PLAN_QUOTAS.free.max_languages, 1);
    assert.strictEqual(PLAN_QUOTAS.free.max_storage_bytes, 102400);
  });

  test('enterprise plan has highest limits', () => {
    assert.strictEqual(PLAN_QUOTAS.enterprise.max_entries, 100000);
    assert.strictEqual(PLAN_QUOTAS.enterprise.max_languages, 5);
    assert.strictEqual(PLAN_QUOTAS.enterprise.max_crawls_month, -1); // Unlimited
    assert.strictEqual(PLAN_QUOTAS.enterprise.max_imports_month, -1); // Unlimited
  });

  test('plans are in ascending order of limits', () => {
    assert.ok(PLAN_QUOTAS.free.max_entries < PLAN_QUOTAS.starter.max_entries);
    assert.ok(PLAN_QUOTAS.starter.max_entries < PLAN_QUOTAS.pro.max_entries);
    assert.ok(PLAN_QUOTAS.pro.max_entries < PLAN_QUOTAS.enterprise.max_entries);
  });

  test('each plan has all required fields', () => {
    const requiredFields = ['max_entries', 'max_storage_bytes', 'max_languages', 'max_crawls_month', 'max_imports_month', 'max_file_size_bytes'];
    for (const [name, plan] of Object.entries(PLAN_QUOTAS)) {
      for (const field of requiredFields) {
        assert.ok(field in plan, `${name} missing ${field}`);
      }
    }
  });
});

describe('KBQuotaManager Plan Resolution', () => {
  let manager;

  beforeEach(() => {
    manager = new KBQuotaManager();
  });

  afterEach(() => {
    // Cleanup test usage file
    const usagePath = path.join(TEST_USAGE_DIR, `${TEST_TENANT}.json`);
    if (fs.existsSync(usagePath)) fs.unlinkSync(usagePath);
  });

  test('unknown tenant defaults to starter plan', () => {
    const plan = manager.getTenantPlan(TEST_TENANT);
    assert.strictEqual(plan, 'starter');
  });

  test('getQuotaLimits returns plan and limits', () => {
    const result = manager.getQuotaLimits(TEST_TENANT);
    assert.ok(result.plan);
    assert.ok(result.limits);
    assert.strictEqual(result.plan, 'starter');
    assert.strictEqual(result.limits.max_entries, 500);
  });
});

describe('KBQuotaManager Usage Tracking', () => {
  let manager;

  beforeEach(() => {
    manager = new KBQuotaManager();
  });

  afterEach(() => {
    const usagePath = path.join(TEST_USAGE_DIR, `${TEST_TENANT}.json`);
    if (fs.existsSync(usagePath)) fs.unlinkSync(usagePath);
  });

  test('getUsage creates default usage for new tenant', () => {
    const usage = manager.getUsage(TEST_TENANT);
    assert.ok(usage);
    assert.strictEqual(usage.tenant_id, TEST_TENANT);
    assert.strictEqual(usage.entries, 0);
    assert.strictEqual(usage.storage_bytes, 0);
    assert.deepStrictEqual(usage.languages_used, []);
    assert.strictEqual(usage.crawls_this_month, 0);
    assert.strictEqual(usage.imports_this_month, 0);
  });

  test('usage is persisted to file', () => {
    manager.getUsage(TEST_TENANT);
    const usagePath = path.join(TEST_USAGE_DIR, `${TEST_TENANT}.json`);
    assert.ok(fs.existsSync(usagePath));
    const saved = JSON.parse(fs.readFileSync(usagePath, 'utf8'));
    assert.strictEqual(saved.tenant_id, TEST_TENANT);
  });

  test('incrementUsage tracks crawls', () => {
    manager.getUsage(TEST_TENANT); // Initialize
    manager.incrementUsage(TEST_TENANT, 'crawl');
    manager.incrementUsage(TEST_TENANT, 'crawl');
    const usage = manager.getUsage(TEST_TENANT);
    assert.strictEqual(usage.crawls_this_month, 2);
  });

  test('incrementUsage tracks imports', () => {
    manager.getUsage(TEST_TENANT); // Initialize
    manager.incrementUsage(TEST_TENANT, 'import');
    const usage = manager.getUsage(TEST_TENANT);
    assert.strictEqual(usage.imports_this_month, 1);
  });
});

describe('KBQuotaManager Quota Checks', () => {
  let manager;

  beforeEach(() => {
    manager = new KBQuotaManager();
  });

  afterEach(() => {
    const usagePath = path.join(TEST_USAGE_DIR, `${TEST_TENANT}.json`);
    if (fs.existsSync(usagePath)) fs.unlinkSync(usagePath);
  });

  test('add_entry allowed when under limit', () => {
    const result = manager.checkQuota(TEST_TENANT, 'add_entry');
    assert.strictEqual(result.allowed, true);
  });

  test('crawl allowed when under limit', () => {
    const result = manager.checkQuota(TEST_TENANT, 'crawl');
    assert.strictEqual(result.allowed, true);
  });

  test('import allowed when under limit', () => {
    const result = manager.checkQuota(TEST_TENANT, 'import');
    assert.strictEqual(result.allowed, true);
  });

  test('import rejected when file too large', () => {
    // starter max_file_size_bytes = 512000 (500 KB)
    const result = manager.checkQuota(TEST_TENANT, 'import', { file_size: 600000 });
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.code, 'QUOTA_FILE_SIZE_EXCEEDED');
  });

  test('storage check with bytes param', () => {
    // starter max_storage_bytes = 1048576 (1 MB)
    const result = manager.checkQuota(TEST_TENANT, 'storage', { bytes: 500000 });
    assert.strictEqual(result.allowed, true);
  });

  test('storage check rejects over limit', () => {
    const result = manager.checkQuota(TEST_TENANT, 'storage', { bytes: 2000000 });
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.code, 'QUOTA_STORAGE_EXCEEDED');
  });
});

describe('KBQuotaManager formatBytes', () => {
  let manager;

  beforeEach(() => {
    manager = new KBQuotaManager();
  });

  test('formats bytes', () => {
    assert.strictEqual(manager.formatBytes(500), '500 B');
  });

  test('formats kilobytes', () => {
    assert.strictEqual(manager.formatBytes(5120), '5 KB');
  });

  test('formats megabytes', () => {
    assert.strictEqual(manager.formatBytes(5242880), '5.0 MB');
  });

  test('formats gigabytes', () => {
    assert.strictEqual(manager.formatBytes(1073741824), '1.0 GB');
  });
});

describe('KBQuotaManager Alerts', () => {
  let manager;

  beforeEach(() => {
    manager = new KBQuotaManager();
  });

  test('no alerts when usage is low', () => {
    const alerts = manager.getQuotaAlerts(
      { entries: 10, storage_bytes: 1000 },
      PLAN_QUOTAS.starter
    );
    assert.strictEqual(alerts.length, 0);
  });

  test('warning alert at 80% entries', () => {
    const alerts = manager.getQuotaAlerts(
      { entries: 420, storage_bytes: 0 },
      PLAN_QUOTAS.starter // max_entries = 500
    );
    const entryAlert = alerts.find(a => a.metric === 'entries');
    assert.ok(entryAlert);
    assert.strictEqual(entryAlert.type, 'warning');
  });

  test('critical alert at 95% entries', () => {
    const alerts = manager.getQuotaAlerts(
      { entries: 490, storage_bytes: 0 },
      PLAN_QUOTAS.starter // max_entries = 500
    );
    const entryAlert = alerts.find(a => a.metric === 'entries');
    assert.ok(entryAlert);
    assert.strictEqual(entryAlert.type, 'critical');
  });

  test('warning alert at 80% storage', () => {
    const alerts = manager.getQuotaAlerts(
      { entries: 0, storage_bytes: 850000 },
      PLAN_QUOTAS.starter // max_storage_bytes = 1048576
    );
    const storageAlert = alerts.find(a => a.metric === 'storage');
    assert.ok(storageAlert);
    assert.strictEqual(storageAlert.type, 'warning');
  });

  test('critical alert at 95% storage', () => {
    const alerts = manager.getQuotaAlerts(
      { entries: 0, storage_bytes: 1000000 },
      PLAN_QUOTAS.starter // max_storage_bytes = 1048576
    );
    const storageAlert = alerts.find(a => a.metric === 'storage');
    assert.ok(storageAlert);
    assert.strictEqual(storageAlert.type, 'critical');
  });
});

describe('KBQuotaManager getAllPlans', () => {
  let manager;

  beforeEach(() => {
    manager = new KBQuotaManager();
  });

  test('returns all 5 plans', () => {
    const plans = manager.getAllPlans();
    assert.strictEqual(plans.length, 5);
  });

  test('each plan has formatted storage', () => {
    const plans = manager.getAllPlans();
    for (const plan of plans) {
      assert.ok(plan.limits.max_storage_formatted);
      assert.ok(plan.limits.max_file_size_formatted);
    }
  });

  test('plan names match PLAN_QUOTAS keys', () => {
    const plans = manager.getAllPlans();
    const names = plans.map(p => p.name);
    assert.deepStrictEqual(names.sort(), Object.keys(PLAN_QUOTAS).sort());
  });
});
