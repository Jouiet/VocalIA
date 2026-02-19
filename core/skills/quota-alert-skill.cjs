/**
 * SOTA Pattern: Quota Alert Skill (Session 250.221)
 *
 * Logic:
 * 1. Daily cron via ProactiveScheduler
 * 2. Scan all tenant quota usage
 * 3. If usage > 80% of plan limit → emit alert event
 * 4. Alert lands in dashboard notifications + optional email
 *
 * Moat: Proactive churn prevention — client sees "upgrade" before hitting wall.
 */

const fs = require('fs');
const path = require('path');
const AgencyEventBus = require('../AgencyEventBus.cjs');
const { sanitizeTenantId } = require('../voice-api-utils.cjs');

const USAGE_DIR = path.join(__dirname, '..', '..', 'data', 'quotas');
const PLAN_LIMITS = {
  starter: { entries: 50, crawls: 5, imports: 10 },
  pro: { entries: 200, crawls: 20, imports: 50 },
  ecom: { entries: 200, crawls: 20, imports: 50 },
  telephony: { entries: 500, crawls: 50, imports: 100 },
  expert_clone: { entries: 300, crawls: 30, imports: 60 }
};

class QuotaAlertSkill {
  constructor() {
    this.initialized = false;
    this.alertThreshold = 0.8; // 80%
  }

  init() {
    if (this.initialized) return;

    AgencyEventBus.subscribe('scheduler.task_executed', async (event) => {
      if (event.taskType !== 'quota_alert_check') return;
      await this.checkAllTenants();
    });

    this.initialized = true;
    console.log('✅ [Skill] Quota Alert Skill Worker ACTIVE');
  }

  async checkAllTenants() {
    if (!fs.existsSync(USAGE_DIR)) return;

    const files = fs.readdirSync(USAGE_DIR).filter(f => f.endsWith('.json'));
    let alertCount = 0;

    for (const file of files) {
      try {
        const usage = JSON.parse(fs.readFileSync(path.join(USAGE_DIR, file), 'utf8'));
        const tenantId = usage.tenant_id || file.replace('.json', '');
        const plan = usage.plan || 'starter';
        const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;

        const checks = [
          { metric: 'entries', current: usage.entries || 0, limit: limits.entries },
          { metric: 'crawls', current: usage.crawls_this_month || 0, limit: limits.crawls },
          { metric: 'imports', current: usage.imports_this_month || 0, limit: limits.imports }
        ];

        for (const check of checks) {
          if (check.limit > 0 && (check.current / check.limit) >= this.alertThreshold) {
            const pct = Math.round((check.current / check.limit) * 100);
            AgencyEventBus.publish('quota.threshold_reached', {
              tenantId: sanitizeTenantId(tenantId),
              metric: check.metric,
              current: check.current,
              limit: check.limit,
              percentage: pct,
              plan: plan,
              severity: pct >= 100 ? 'critical' : 'warning'
            });
            alertCount++;
          }
        }
      } catch (e) {
        // Skip corrupt files
      }
    }

    if (alertCount > 0) {
      console.log(`[Skill] Quota Alert: ${alertCount} threshold alerts sent`);
    }
  }
}

module.exports = new QuotaAlertSkill();
