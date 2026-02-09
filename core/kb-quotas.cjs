#!/usr/bin/env node
/**
 * VocalIA - Knowledge Base Quotas
 *
 * Quota management for multi-tenant KB:
 * - Per-plan limits (entries, storage, languages)
 * - Usage tracking
 * - Quota enforcement
 *
 * Version: 1.0.0 | Session 250.45 | 02/02/2026
 */

const fs = require('fs');
const path = require('path');
const { sanitizeTenantId } = require('./voice-api-utils.cjs');

// Quota limits per plan (industry-aligned)
// Optimal balance: enough for useful KB, not excessive to overload system
const PLAN_QUOTAS = {
  free: {
    max_entries: 50,         // 50 KB entries - basic FAQ
    max_storage_bytes: 102400,  // 100 KB
    max_languages: 1,        // Single language
    max_crawls_month: 5,
    max_imports_month: 10,
    max_file_size_bytes: 51200  // 50 KB per file
  },
  starter: {
    max_entries: 500,
    max_storage_bytes: 1048576,  // 1 MB
    max_languages: 3,
    max_crawls_month: 50,
    max_imports_month: 100,
    max_file_size_bytes: 512000  // 500 KB per file
  },
  pro: {
    max_entries: 5000,
    max_storage_bytes: 10485760,  // 10 MB
    max_languages: 5,
    max_crawls_month: 500,
    max_imports_month: 1000,
    max_file_size_bytes: 5242880  // 5 MB per file
  },
  enterprise: {
    max_entries: 100000,
    max_storage_bytes: 104857600,  // 100 MB
    max_languages: 5,
    max_crawls_month: -1,  // Unlimited
    max_imports_month: -1,
    max_file_size_bytes: 52428800  // 50 MB per file
  }
};

// Default plan
const DEFAULT_PLAN = 'starter';

// Plan aliases (map external plan names to internal)
const PLAN_ALIASES = {
  growth: 'starter',
  scale: 'pro',
  startup: 'starter',
  business: 'pro',
  unlimited: 'enterprise',
  custom: 'enterprise'
};

// Usage tracking file
const USAGE_DIR = path.join(__dirname, '../data/kb-usage');

/**
 * KB Quota Manager
 */
class KBQuotaManager {
  constructor() {
    this.ensureUsageDir();
  }

  /**
   * Ensure usage directory exists
   */
  ensureUsageDir() {
    if (!fs.existsSync(USAGE_DIR)) {
      fs.mkdirSync(USAGE_DIR, { recursive: true });
    }
  }

  /**
   * Get tenant's current plan (with alias resolution)
   */
  getTenantPlan(tenantId) {
    const configPath = path.join(__dirname, '../clients', sanitizeTenantId(tenantId), 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const rawPlan = (config.plan || DEFAULT_PLAN).toLowerCase();
        // Resolve aliases
        return PLAN_ALIASES[rawPlan] || (PLAN_QUOTAS[rawPlan] ? rawPlan : DEFAULT_PLAN);
      } catch (e) {
        return DEFAULT_PLAN;
      }
    }
    return DEFAULT_PLAN;
  }

  /**
   * Get quota limits for a tenant
   */
  getQuotaLimits(tenantId) {
    const plan = this.getTenantPlan(tenantId);
    return {
      plan,
      limits: PLAN_QUOTAS[plan] || PLAN_QUOTAS[DEFAULT_PLAN]
    };
  }

  /**
   * Get current usage for a tenant
   */
  getUsage(tenantId) {
    const usagePath = path.join(USAGE_DIR, `${sanitizeTenantId(tenantId)}.json`);

    if (fs.existsSync(usagePath)) {
      try {
        const usage = JSON.parse(fs.readFileSync(usagePath, 'utf8'));
        // Reset monthly counters if needed
        return this.resetMonthlyIfNeeded(tenantId, usage);
      } catch (e) {
        return this.createDefaultUsage(tenantId);
      }
    }

    return this.createDefaultUsage(tenantId);
  }

  /**
   * Create default usage record
   */
  createDefaultUsage(tenantId) {
    const usage = {
      tenant_id: tenantId,
      current_month: new Date().toISOString().slice(0, 7),
      entries: 0,
      storage_bytes: 0,
      languages_used: [],
      crawls_this_month: 0,
      imports_this_month: 0,
      last_updated: new Date().toISOString()
    };

    this.saveUsage(tenantId, usage);
    return usage;
  }

  /**
   * Reset monthly counters if new month
   */
  resetMonthlyIfNeeded(tenantId, usage) {
    const currentMonth = new Date().toISOString().slice(0, 7);

    if (usage.current_month !== currentMonth) {
      usage.current_month = currentMonth;
      usage.crawls_this_month = 0;
      usage.imports_this_month = 0;
      this.saveUsage(tenantId, usage);
    }

    return usage;
  }

  /**
   * Save usage data
   */
  saveUsage(tenantId, usage) {
    usage.last_updated = new Date().toISOString();
    const usagePath = path.join(USAGE_DIR, `${sanitizeTenantId(tenantId)}.json`);
    fs.writeFileSync(usagePath, JSON.stringify(usage, null, 2));
  }

  /**
   * Calculate actual KB storage and entries
   */
  calculateKBUsage(tenantId) {
    const kbDir = path.join(__dirname, '../clients', sanitizeTenantId(tenantId), 'knowledge_base');
    let totalBytes = 0;
    let totalEntries = 0;
    const languagesUsed = new Set();

    if (fs.existsSync(kbDir)) {
      const files = fs.readdirSync(kbDir).filter(f => f.endsWith('.json'));

      for (const file of files) {
        const filePath = path.join(kbDir, file);
        const stats = fs.statSync(filePath);
        totalBytes += stats.size;

        // Extract language from filename (kb_fr.json -> fr)
        const langMatch = file.match(/kb_(\w+)\.json/);
        if (langMatch) {
          languagesUsed.add(langMatch[1]);
        }

        // Count entries
        try {
          const kb = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          totalEntries += Object.keys(kb).filter(k => k !== '__meta').length;
        } catch (e) {
          // Skip invalid files
        }
      }
    }

    return {
      storage_bytes: totalBytes,
      entries: totalEntries,
      languages_used: [...languagesUsed]
    };
  }

  /**
   * Update usage from actual KB data
   */
  syncUsage(tenantId) {
    const usage = this.getUsage(tenantId);
    const actual = this.calculateKBUsage(tenantId);

    usage.storage_bytes = actual.storage_bytes;
    usage.entries = actual.entries;
    usage.languages_used = actual.languages_used;

    this.saveUsage(tenantId, usage);
    return usage;
  }

  /**
   * Check if action is allowed under quota
   * @returns {object} { allowed: boolean, reason?: string }
   */
  checkQuota(tenantId, action, params = {}) {
    const usage = this.syncUsage(tenantId);
    const { limits } = this.getQuotaLimits(tenantId);

    switch (action) {
      case 'add_entry':
        if (usage.entries >= limits.max_entries) {
          return {
            allowed: false,
            reason: `Quota dépassé: ${usage.entries}/${limits.max_entries} entrées`,
            code: 'QUOTA_ENTRIES_EXCEEDED'
          };
        }
        break;

      case 'add_entries':
        const newTotal = usage.entries + (params.count || 1);
        if (newTotal > limits.max_entries) {
          return {
            allowed: false,
            reason: `Import dépasserait le quota: ${newTotal}/${limits.max_entries} entrées`,
            code: 'QUOTA_ENTRIES_EXCEEDED'
          };
        }
        break;

      case 'add_language':
        if (params.language && !usage.languages_used.includes(params.language)) {
          if (usage.languages_used.length >= limits.max_languages) {
            return {
              allowed: false,
              reason: `Quota langues dépassé: ${usage.languages_used.length}/${limits.max_languages}`,
              code: 'QUOTA_LANGUAGES_EXCEEDED'
            };
          }
        }
        break;

      case 'import':
        if (limits.max_imports_month !== -1 && usage.imports_this_month >= limits.max_imports_month) {
          return {
            allowed: false,
            reason: `Quota imports mensuels dépassé: ${usage.imports_this_month}/${limits.max_imports_month}`,
            code: 'QUOTA_IMPORTS_EXCEEDED'
          };
        }
        if (params.file_size && params.file_size > limits.max_file_size_bytes) {
          return {
            allowed: false,
            reason: `Fichier trop volumineux: ${this.formatBytes(params.file_size)} > ${this.formatBytes(limits.max_file_size_bytes)}`,
            code: 'QUOTA_FILE_SIZE_EXCEEDED'
          };
        }
        break;

      case 'crawl':
        if (limits.max_crawls_month !== -1 && usage.crawls_this_month >= limits.max_crawls_month) {
          return {
            allowed: false,
            reason: `Quota crawls mensuels dépassé: ${usage.crawls_this_month}/${limits.max_crawls_month}`,
            code: 'QUOTA_CRAWLS_EXCEEDED'
          };
        }
        break;

      case 'storage':
        const newStorage = usage.storage_bytes + (params.bytes || 0);
        if (newStorage > limits.max_storage_bytes) {
          return {
            allowed: false,
            reason: `Quota stockage dépassé: ${this.formatBytes(newStorage)} > ${this.formatBytes(limits.max_storage_bytes)}`,
            code: 'QUOTA_STORAGE_EXCEEDED'
          };
        }
        break;
    }

    return { allowed: true };
  }

  /**
   * Increment usage counter
   */
  incrementUsage(tenantId, action) {
    const usage = this.getUsage(tenantId);

    switch (action) {
      case 'crawl':
        usage.crawls_this_month++;
        break;
      case 'import':
        usage.imports_this_month++;
        break;
    }

    this.saveUsage(tenantId, usage);
    return usage;
  }

  /**
   * Get quota status for display
   */
  getQuotaStatus(tenantId) {
    const usage = this.syncUsage(tenantId);
    const { plan, limits } = this.getQuotaLimits(tenantId);

    return {
      tenant_id: tenantId,
      plan,
      usage: {
        entries: {
          used: usage.entries,
          max: limits.max_entries,
          percent: Math.round((usage.entries / limits.max_entries) * 100)
        },
        storage: {
          used: usage.storage_bytes,
          used_formatted: this.formatBytes(usage.storage_bytes),
          max: limits.max_storage_bytes,
          max_formatted: this.formatBytes(limits.max_storage_bytes),
          percent: Math.round((usage.storage_bytes / limits.max_storage_bytes) * 100)
        },
        languages: {
          used: usage.languages_used.length,
          max: limits.max_languages,
          languages: usage.languages_used
        },
        crawls: {
          used: usage.crawls_this_month,
          max: limits.max_crawls_month,
          unlimited: limits.max_crawls_month === -1
        },
        imports: {
          used: usage.imports_this_month,
          max: limits.max_imports_month,
          unlimited: limits.max_imports_month === -1
        }
      },
      alerts: this.getQuotaAlerts(usage, limits)
    };
  }

  /**
   * Get quota alerts (warnings at 80%, critical at 95%)
   */
  getQuotaAlerts(usage, limits) {
    const alerts = [];

    const entriesPercent = (usage.entries / limits.max_entries) * 100;
    if (entriesPercent >= 95) {
      alerts.push({ type: 'critical', metric: 'entries', message: 'Quota entrées quasi-atteint' });
    } else if (entriesPercent >= 80) {
      alerts.push({ type: 'warning', metric: 'entries', message: 'Quota entrées bientôt atteint' });
    }

    const storagePercent = (usage.storage_bytes / limits.max_storage_bytes) * 100;
    if (storagePercent >= 95) {
      alerts.push({ type: 'critical', metric: 'storage', message: 'Quota stockage quasi-atteint' });
    } else if (storagePercent >= 80) {
      alerts.push({ type: 'warning', metric: 'storage', message: 'Quota stockage bientôt atteint' });
    }

    return alerts;
  }

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
    if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${(bytes / 1073741824).toFixed(1)} GB`;
  }

  /**
   * Get all plan details
   */
  getAllPlans() {
    return Object.entries(PLAN_QUOTAS).map(([name, limits]) => ({
      name,
      limits: {
        ...limits,
        max_storage_formatted: this.formatBytes(limits.max_storage_bytes),
        max_file_size_formatted: this.formatBytes(limits.max_file_size_bytes)
      }
    }));
  }
}

// Singleton
let instance = null;

function getInstance() {
  if (!instance) {
    instance = new KBQuotaManager();
  }
  return instance;
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.length === 0) {
    console.log(`
VocalIA KB Quota Manager

Usage:
  node kb-quotas.cjs [options] <tenant_id>

Options:
  --help              Show this help
  --status            Show quota status for tenant
  --plans             List all plans and limits
  --check <action>    Check if action is allowed (add_entry, import, crawl)

Examples:
  node kb-quotas.cjs --status client_demo
  node kb-quotas.cjs --plans
  node kb-quotas.cjs --check import client_demo
`);
    process.exit(0);
  }

  const manager = getInstance();

  if (args.includes('--plans')) {
    console.log('\n📊 Available Plans:\n');
    for (const plan of manager.getAllPlans()) {
      console.log(`  ${plan.name.toUpperCase()}`);
      console.log(`    Entries: ${plan.limits.max_entries}`);
      console.log(`    Storage: ${plan.limits.max_storage_formatted}`);
      console.log(`    Languages: ${plan.limits.max_languages}`);
      console.log(`    Crawls/month: ${plan.limits.max_crawls_month === -1 ? 'Unlimited' : plan.limits.max_crawls_month}`);
      console.log(`    Imports/month: ${plan.limits.max_imports_month === -1 ? 'Unlimited' : plan.limits.max_imports_month}`);
      console.log('');
    }
    process.exit(0);
  }

  const tenantId = args.find(a => !a.startsWith('--'));
  if (!tenantId) {
    console.error('Error: tenant_id required');
    process.exit(1);
  }

  if (args.includes('--status')) {
    const status = manager.getQuotaStatus(tenantId);
    console.log('\n📊 Quota Status:\n');
    console.log(JSON.stringify(status, null, 2));
    process.exit(0);
  }

  const checkIdx = args.indexOf('--check');
  if (checkIdx !== -1 && args[checkIdx + 1]) {
    const action = args[checkIdx + 1];
    const result = manager.checkQuota(tenantId, action);
    console.log(`\n🔍 Check "${action}" for ${tenantId}:`);
    console.log(`  Allowed: ${result.allowed}`);
    if (result.reason) console.log(`  Reason: ${result.reason}`);
    process.exit(result.allowed ? 0 : 1);
  }

  // Default: show status
  const status = manager.getQuotaStatus(tenantId);
  console.log('\n📊 Quota Status:\n');
  console.log(JSON.stringify(status, null, 2));
}

module.exports = {
  KBQuotaManager,
  getInstance,
  PLAN_QUOTAS
};
