'use strict';

/**
 * VocalIA Monthly Maintenance Script
 *
 * Runs on the 1st of each month to:
 * 1. Purge telephony conversations >60 days
 * 2. Rotate audit logs to monthly archives
 * 3. Reset quota usage counters
 *
 * Usage:
 *   node scripts/monthly-maintenance.cjs
 *
 * Cron setup (run at 00:01 on 1st of each month):
 *   1 0 1 * * cd /path/to/VocalIA && node scripts/monthly-maintenance.cjs >> logs/maintenance.log 2>&1
 *
 * @version 1.0.0
 * Session 250.57bis
 */

const fs = require('fs');
const path = require('path');

// Ensure we're in the right directory
process.chdir(path.join(__dirname, '..'));

console.log('═══════════════════════════════════════════════════════════════');
console.log('  VocalIA Monthly Maintenance');
console.log(`  Started: ${new Date().toISOString()}`);
console.log('═══════════════════════════════════════════════════════════════\n');

const results = {
  started: new Date().toISOString(),
  tasks: [],
  errors: []
};

// Task 1: Purge old telephony conversations (>60 days)
try {
  console.log('📞 [1/4] Purging telephony conversations >60 days...');
  const { getInstance: getConversationStore } = require('../core/conversation-store.cjs');
  const convStore = getConversationStore();

  const purgeResult = convStore.monthlyPurge();
  results.tasks.push({
    task: 'telephony_purge',
    status: 'success',
    details: purgeResult
  });

  console.log(`   ✅ Telephony: ${purgeResult.telephony.totalDeleted} deleted`);
  console.log(`   ✅ Widget: ${purgeResult.widget.totalDeleted} deleted`);
} catch (e) {
  console.error(`   ❌ Error: ${e.message}`);
  results.errors.push({ task: 'telephony_purge', error: e.message });
}

// Task 2: Rotate audit logs
try {
  console.log('\n📋 [2/4] Rotating audit logs...');
  const { getInstance: getAuditStore } = require('../core/audit-store.cjs');
  const auditStore = getAuditStore();

  const health = auditStore.health();
  let totalRotated = 0;

  for (const tenantId of health.tenant_list || []) {
    const rotateResult = auditStore.rotate(tenantId);
    totalRotated += rotateResult.rotated;
  }

  results.tasks.push({
    task: 'audit_rotation',
    status: 'success',
    details: { tenants: health.tenant_list?.length || 0, rotated: totalRotated }
  });

  console.log(`   ✅ ${totalRotated} audit entries archived across ${health.tenant_list?.length || 0} tenants`);
} catch (e) {
  console.error(`   ❌ Error: ${e.message}`);
  results.errors.push({ task: 'audit_rotation', error: e.message });
}

// Task 3: Reset quota usage (for tenants with monthly reset)
try {
  console.log('\n📊 [3/4] Resetting monthly quotas...');
  const { getDB } = require('../core/GoogleSheetsDB.cjs');
  const db = getDB();

  // Get all tenants
  const tenantsDir = path.join(__dirname, '../clients');
  const tenants = fs.existsSync(tenantsDir)
    ? fs.readdirSync(tenantsDir).filter(f =>
        f !== '_template' &&
        fs.statSync(path.join(tenantsDir, f)).isDirectory()
      )
    : [];

  let resetCount = 0;
  for (const tenantId of tenants) {
    try {
      // Only reset if tenant config specifies monthly reset
      const configPath = path.join(tenantsDir, tenantId, 'config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.quotas?.reset_period === 'monthly' || !config.quotas?.reset_period) {
          db.resetUsage(tenantId);
          resetCount++;
        }
      }
    } catch {
      // Skip invalid configs
    }
  }

  results.tasks.push({
    task: 'quota_reset',
    status: 'success',
    details: { tenants_reset: resetCount }
  });

  console.log(`   ✅ ${resetCount} tenant quotas reset`);
} catch (e) {
  console.error(`   ❌ Error: ${e.message}`);
  results.errors.push({ task: 'quota_reset', error: e.message });
}

// Task 4: Cleanup old export files (>7 days)
try {
  console.log('\n🗑️  [4/4] Cleaning up old export files...');
  const exportsDir = path.join(__dirname, '../data/exports');

  if (fs.existsSync(exportsDir)) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);

    const files = fs.readdirSync(exportsDir);
    let deleted = 0;

    for (const file of files) {
      const filePath = path.join(exportsDir, file);
      const stats = fs.statSync(filePath);
      if (stats.mtime < cutoff) {
        fs.unlinkSync(filePath);
        deleted++;
      }
    }

    results.tasks.push({
      task: 'export_cleanup',
      status: 'success',
      details: { deleted }
    });

    console.log(`   ✅ ${deleted} old export files deleted`);
  } else {
    console.log('   ℹ️  No exports directory found');
  }
} catch (e) {
  console.error(`   ❌ Error: ${e.message}`);
  results.errors.push({ task: 'export_cleanup', error: e.message });
}

// Summary
results.completed = new Date().toISOString();
results.success = results.errors.length === 0;

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  Summary');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  Tasks completed: ${results.tasks.length}`);
console.log(`  Errors: ${results.errors.length}`);
console.log(`  Status: ${results.success ? '✅ SUCCESS' : '❌ PARTIAL FAILURE'}`);
console.log(`  Completed: ${results.completed}`);
console.log('═══════════════════════════════════════════════════════════════\n');

// Write result to log file
const logsDir = path.join(__dirname, '../data/logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFile = path.join(logsDir, `maintenance-${new Date().toISOString().split('T')[0]}.json`);
fs.writeFileSync(logFile, JSON.stringify(results, null, 2));
console.log(`📝 Log saved: ${logFile}\n`);

process.exit(results.success ? 0 : 1);
