/**
 * TokenBudgetManager — Per-tenant token usage tracking & budget enforcement
 * VocalIA — Session 250.245 (Inspired by Perplexity Computer credit system)
 *
 * Tracks token consumption per tenant, enforces monthly budgets by plan,
 * and provides alerts at configurable thresholds.
 *
 * Usage:
 *   const budget = require('./token-budget.cjs');
 *   budget.recordUsage('tenant_123', 500, 1200);  // input, output tokens
 *   const check = budget.checkBudget('tenant_123', 'pro');
 *   if (!check.allowed) { // degrade response }
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { sanitizeTenantId } = require('./voice-api-utils.cjs');

// ─────────────────────────────────────────────────────────────────────────────
// PLAN BUDGETS (aligned with PLAN_PRICES in voice-api-resilient.cjs)
// ─────────────────────────────────────────────────────────────────────────────

const PLAN_BUDGETS = {
  starter:   { monthlyTokens: 500_000,   alertAt: 0.8, label: 'Starter (49€)' },
  pro:       { monthlyTokens: 2_000_000,  alertAt: 0.8, label: 'Pro (99€)' },
  ecommerce: { monthlyTokens: 2_000_000,  alertAt: 0.8, label: 'E-commerce (99€)' },
  expert:    { monthlyTokens: 5_000_000,  alertAt: 0.8, label: 'Expert Clone (149€)' },
  telephony: { monthlyTokens: 10_000_000, alertAt: 0.8, label: 'Telephony (199€)' },
};

// Estimated tokens per provider call (for providers that don't return usage)
const ESTIMATED_TOKENS = {
  grok: { input: 800, output: 400 },
  gemini: { input: 1000, output: 600 },
  anthropic: { input: 1200, output: 800 },
  atlasChat: { input: 600, output: 300 },
};

class TokenBudgetManager {
  constructor(dataDir) {
    this._dataDir = dataDir || path.join(__dirname, '..', 'data', 'usage');
    this._usage = {};  // tenantId → { month, inputTokens, outputTokens, calls }
    this._loaded = false;
  }

  /**
   * Get the current month key (YYYY-MM)
   */
  _currentMonth() {
    return new Date().toISOString().slice(0, 7);
  }

  /**
   * Ensure usage data is loaded for a tenant
   */
  _ensureLoaded(tenantId) {
    const safeId = sanitizeTenantId(tenantId);
    if (this._usage[safeId]?.month === this._currentMonth()) return;

    // Reset to new month or init
    this._usage[safeId] = {
      month: this._currentMonth(),
      inputTokens: 0,
      outputTokens: 0,
      calls: 0,
    };

    // Try to load persisted data
    try {
      const filePath = path.join(this._dataDir, `${safeId}.json`);
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (data.month === this._currentMonth()) {
          this._usage[safeId] = data;
        }
      }
    } catch (e) {
      // File not found or corrupt — start fresh
    }
  }

  /**
   * Record token usage for a tenant
   * @param {string} tenantId
   * @param {number} inputTokens - Input tokens consumed
   * @param {number} outputTokens - Output tokens consumed
   * @param {string} [provider] - Provider name (for estimation if tokens unknown)
   */
  recordUsage(tenantId, inputTokens, outputTokens, provider) {
    const safeId = sanitizeTenantId(tenantId);
    this._ensureLoaded(safeId);

    // If no exact tokens provided, use estimates
    if (!inputTokens && !outputTokens && provider) {
      const est = ESTIMATED_TOKENS[provider] || ESTIMATED_TOKENS.grok;
      inputTokens = est.input;
      outputTokens = est.output;
    }

    this._usage[safeId].inputTokens += (inputTokens || 0);
    this._usage[safeId].outputTokens += (outputTokens || 0);
    this._usage[safeId].calls += 1;

    // Persist asynchronously (non-blocking)
    this._persistAsync(safeId);
  }

  /**
   * Check if a tenant has budget remaining
   * @param {string} tenantId
   * @param {string} plan - Plan name (starter, pro, ecommerce, expert, telephony)
   * @returns {{ allowed: boolean, remaining: number, percentUsed: number, alert: boolean, plan: string }}
   */
  checkBudget(tenantId, plan) {
    const safeId = sanitizeTenantId(tenantId);
    this._ensureLoaded(safeId);

    const budget = PLAN_BUDGETS[plan] || PLAN_BUDGETS.starter;
    const usage = this._usage[safeId];
    const totalUsed = usage.inputTokens + usage.outputTokens;
    const remaining = budget.monthlyTokens - totalUsed;
    const ratio = totalUsed / budget.monthlyTokens;

    return {
      allowed: remaining > 0,
      remaining: Math.max(0, remaining),
      totalUsed,
      percentUsed: Math.round(ratio * 100),
      alert: ratio >= budget.alertAt,
      plan: budget.label,
      calls: usage.calls,
    };
  }

  /**
   * Get usage stats for a tenant
   */
  getUsage(tenantId) {
    const safeId = sanitizeTenantId(tenantId);
    this._ensureLoaded(safeId);
    return { ...this._usage[safeId] };
  }

  /**
   * Get usage for all tenants (for admin dashboard)
   */
  getAllUsage() {
    const result = {};
    for (const [tenantId, usage] of Object.entries(this._usage)) {
      if (usage.month === this._currentMonth()) {
        result[tenantId] = { ...usage };
      }
    }
    return result;
  }

  /**
   * Persist usage data to disk (async, non-blocking)
   */
  _persistAsync(tenantId) {
    try {
      const safeId = sanitizeTenantId(tenantId);
      if (!fs.existsSync(this._dataDir)) {
        fs.mkdirSync(this._dataDir, { recursive: true });
      }
      const filePath = path.join(this._dataDir, `${safeId}.json`);
      const content = JSON.stringify(this._usage[safeId], null, 2);
      fs.writeFileSync(filePath, content);
    } catch (e) {
      // Non-blocking — persistence failure is not critical
    }
  }
}

// Singleton
const instance = new TokenBudgetManager();

module.exports = instance;
module.exports.TokenBudgetManager = TokenBudgetManager;
module.exports.PLAN_BUDGETS = PLAN_BUDGETS;
module.exports.ESTIMATED_TOKENS = ESTIMATED_TOKENS;
