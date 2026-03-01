/**
 * Tests for TokenBudgetManager — Per-tenant token usage tracking
 * VocalIA — Session 250.245
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'module';
import os from 'os';
import path from 'path';
import fs from 'fs';
const require = createRequire(import.meta.url);

const { TokenBudgetManager, PLAN_BUDGETS, ESTIMATED_TOKENS } = require('../core/token-budget.cjs');

// ─────────────────────────────────────────────────────────────────────────────
// PLAN_BUDGETS integrity
// ─────────────────────────────────────────────────────────────────────────────

describe('TokenBudget PLAN_BUDGETS', () => {
  test('all plans defined', () => {
    const plans = ['starter', 'pro', 'ecommerce', 'expert', 'telephony'];
    for (const plan of plans) {
      assert.ok(PLAN_BUDGETS[plan], `Missing budget for plan: ${plan}`);
      assert.ok(PLAN_BUDGETS[plan].monthlyTokens > 0, `Budget for ${plan} must be positive`);
      assert.ok(PLAN_BUDGETS[plan].alertAt > 0 && PLAN_BUDGETS[plan].alertAt < 1, `alertAt must be 0-1`);
    }
  });

  test('starter has lowest budget', () => {
    assert.ok(PLAN_BUDGETS.starter.monthlyTokens < PLAN_BUDGETS.pro.monthlyTokens);
  });

  test('telephony has highest budget', () => {
    assert.ok(PLAN_BUDGETS.telephony.monthlyTokens > PLAN_BUDGETS.expert.monthlyTokens);
  });

  test('pro and ecommerce have same budget', () => {
    assert.strictEqual(PLAN_BUDGETS.pro.monthlyTokens, PLAN_BUDGETS.ecommerce.monthlyTokens);
  });

  test('budget hierarchy: starter < pro < expert < telephony', () => {
    assert.ok(PLAN_BUDGETS.starter.monthlyTokens < PLAN_BUDGETS.pro.monthlyTokens);
    assert.ok(PLAN_BUDGETS.pro.monthlyTokens < PLAN_BUDGETS.expert.monthlyTokens);
    assert.ok(PLAN_BUDGETS.expert.monthlyTokens < PLAN_BUDGETS.telephony.monthlyTokens);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ESTIMATED_TOKENS
// ─────────────────────────────────────────────────────────────────────────────

describe('TokenBudget ESTIMATED_TOKENS', () => {
  test('all providers have estimates', () => {
    const providers = ['grok', 'gemini', 'anthropic', 'atlasChat'];
    for (const p of providers) {
      assert.ok(ESTIMATED_TOKENS[p], `Missing estimate for: ${p}`);
      assert.ok(ESTIMATED_TOKENS[p].input > 0);
      assert.ok(ESTIMATED_TOKENS[p].output > 0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TokenBudgetManager
// ─────────────────────────────────────────────────────────────────────────────

describe('TokenBudgetManager', { concurrency: false }, () => {
  let manager;
  let tmpDir;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `vocalia-budget-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    manager = new TokenBudgetManager(tmpDir);
  });

  test('recordUsage increments tokens', () => {
    manager.recordUsage('tenant_a', 500, 1000);
    const usage = manager.getUsage('tenant_a');
    assert.strictEqual(usage.inputTokens, 500);
    assert.strictEqual(usage.outputTokens, 1000);
    assert.strictEqual(usage.calls, 1);
  });

  test('recordUsage accumulates across calls', () => {
    manager.recordUsage('tenant_a', 500, 1000);
    manager.recordUsage('tenant_a', 300, 600);
    const usage = manager.getUsage('tenant_a');
    assert.strictEqual(usage.inputTokens, 800);
    assert.strictEqual(usage.outputTokens, 1600);
    assert.strictEqual(usage.calls, 2);
  });

  test('recordUsage uses estimates when tokens are 0', () => {
    manager.recordUsage('tenant_a', 0, 0, 'grok');
    const usage = manager.getUsage('tenant_a');
    assert.strictEqual(usage.inputTokens, ESTIMATED_TOKENS.grok.input);
    assert.strictEqual(usage.outputTokens, ESTIMATED_TOKENS.grok.output);
  });

  test('checkBudget returns allowed for fresh tenant', () => {
    const check = manager.checkBudget('tenant_new', 'pro');
    assert.strictEqual(check.allowed, true);
    assert.strictEqual(check.percentUsed, 0);
    assert.strictEqual(check.alert, false);
  });

  test('checkBudget detects exhausted budget', () => {
    // Starter = 500k tokens. Exhaust it.
    manager.recordUsage('tenant_a', 300_000, 250_000);
    const check = manager.checkBudget('tenant_a', 'starter');
    assert.strictEqual(check.allowed, false);
    assert.strictEqual(check.remaining, 0);
    assert.ok(check.percentUsed >= 100);
  });

  test('checkBudget triggers alert at 80%', () => {
    // Starter = 500k tokens. Use 400k (80%)
    manager.recordUsage('tenant_a', 200_000, 200_000);
    const check = manager.checkBudget('tenant_a', 'starter');
    assert.strictEqual(check.alert, true);
    assert.strictEqual(check.allowed, true);
  });

  test('checkBudget no alert below threshold', () => {
    // Starter = 500k tokens. Use 100k (20%)
    manager.recordUsage('tenant_a', 50_000, 50_000);
    const check = manager.checkBudget('tenant_a', 'starter');
    assert.strictEqual(check.alert, false);
    assert.strictEqual(check.allowed, true);
  });

  test('checkBudget defaults to starter for unknown plan', () => {
    const check = manager.checkBudget('tenant_a', 'nonexistent_plan');
    assert.strictEqual(check.plan, PLAN_BUDGETS.starter.label);
  });

  test('getAllUsage returns all tracked tenants', () => {
    manager.recordUsage('t1', 100, 200);
    manager.recordUsage('t2', 300, 400);
    const all = manager.getAllUsage();
    assert.ok(all.t1);
    assert.ok(all.t2);
    assert.strictEqual(all.t1.inputTokens, 100);
    assert.strictEqual(all.t2.inputTokens, 300);
  });

  test('getUsage returns copy (not reference)', () => {
    manager.recordUsage('t1', 100, 200);
    const usage = manager.getUsage('t1');
    usage.inputTokens = 999;
    const usage2 = manager.getUsage('t1');
    assert.strictEqual(usage2.inputTokens, 100);
  });

  test('persists usage to disk', async () => {
    manager.recordUsage('persist_test', 1000, 2000);
    // Wait for async write to complete
    await new Promise(r => setTimeout(r, 100));
    const filePath = path.join(tmpDir, 'persist_test.json');
    assert.ok(fs.existsSync(filePath), 'Usage file should exist');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.strictEqual(data.inputTokens, 1000);
    assert.strictEqual(data.outputTokens, 2000);
  });

  test('separate tenants have independent budgets', () => {
    manager.recordUsage('t1', 500_000, 100_000);
    manager.recordUsage('t2', 1_000, 500);
    const check1 = manager.checkBudget('t1', 'starter');
    const check2 = manager.checkBudget('t2', 'starter');
    assert.strictEqual(check1.allowed, false); // t1 exhausted
    assert.strictEqual(check2.allowed, true);  // t2 fine
  });
});
