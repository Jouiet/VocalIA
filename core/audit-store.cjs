'use strict';

/**
 * VocalIA - Audit Store
 * Multi-tenant audit trail for compliance and security
 *
 * Features:
 * - Per-tenant audit logging (data/audit/{tenant_id}/)
 * - Append-only JSONL format (tamper-evident)
 * - Structured event logging (who, what, when, resource)
 * - Retention policy support
 * - Query by date range, actor, action
 *
 * Storage Structure:
 *   data/audit/{tenant_id}/
 *   ├── audit.jsonl         # Main audit log (append-only)
 *   └── audit-{YYYY-MM}.jsonl # Monthly archives
 *
 * @version 1.0.0
 * @author VocalIA
 * Session 250.57
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { sanitizeTenantId } = require('./voice-api-utils.cjs');

// Paths
const AUDIT_DIR = path.join(__dirname, '../data/audit');

// Ensure base directory exists
if (!fs.existsSync(AUDIT_DIR)) {
  fs.mkdirSync(AUDIT_DIR, { recursive: true });
}

// Action categories for structured logging
const { getDB } = require('./GoogleSheetsDB.cjs');

// SOTA Session 250.219: Event-to-DB Grounding
const AgencyEventBus = require('./AgencyEventBus.cjs');

/**
 * Initialize Centralized Audit Subscriptions
 * Ensures that all critical system events (Qualification, HITL, Payments)
 * are persisted to the Source of Truth (Google Sheets).
 */
function initAuditSubscriptions() {
  const db = getDB();
  const auditor = getInstance();

  // 1. Persist HITL Actions for Admin Review
  AgencyEventBus.subscribe('hitl.action_required', async (event) => {
    const { tenantId, type, data, message } = event.payload;

    // Log to JSONL (Local)
    auditor.log(tenantId, {
      action: ACTION_CATEGORIES.HITL_ESCALATE,
      actor: 'system',
      resource: `hitl:${type}`,
      details: { ...data, message }
    });

    // Persist to Google Sheets (Authority)
    db.create('hitl_actions', {
      id: event.id,
      tenant_id: tenantId,
      action_type: type,
      data: JSON.stringify(data),
      message: message,
      status: 'pending',
      created_at: event.metadata?.timestamp || new Date().toISOString()
    }).catch(e => console.error('[AuditStore] Failed to ground HITL action:', e.message));

    console.log(`✅ [Auditor] HITL Action recorded for ${tenantId}: ${type}`);
  }, { name: 'Auditor.onHITLAction' });

  console.log('✅ [Auditor] SOTA Event-to-DB Integrity Worker ACTIVE');
}

// Start subscriptions
process.nextTick(() => {
  initAuditSubscriptions();
});
const ACTION_CATEGORIES = {
  // Authentication
  AUTH_LOGIN: 'auth.login',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_FAILED: 'auth.failed',
  AUTH_PASSWORD_RESET: 'auth.password_reset',

  // Data access
  DATA_READ: 'data.read',
  DATA_CREATE: 'data.create',
  DATA_UPDATE: 'data.update',
  DATA_DELETE: 'data.delete',
  DATA_EXPORT: 'data.export',

  // Voice/Conversation
  VOICE_SESSION_START: 'voice.session_start',
  VOICE_SESSION_END: 'voice.session_end',
  VOICE_CALL_INBOUND: 'voice.call_inbound',
  VOICE_CALL_OUTBOUND: 'voice.call_outbound',

  // KB Operations
  KB_IMPORT: 'kb.import',
  KB_CRAWL: 'kb.crawl',
  KB_UPDATE: 'kb.update',
  KB_DELETE: 'kb.delete',

  // Admin actions
  ADMIN_USER_CREATE: 'admin.user_create',
  ADMIN_USER_UPDATE: 'admin.user_update',
  ADMIN_USER_DELETE: 'admin.user_delete',
  ADMIN_CONFIG_CHANGE: 'admin.config_change',
  ADMIN_QUOTA_OVERRIDE: 'admin.quota_override',

  // HITL
  HITL_APPROVE: 'hitl.approve',
  HITL_REJECT: 'hitl.reject',
  HITL_ESCALATE: 'hitl.escalate',

  // System
  SYSTEM_ERROR: 'system.error',
  SYSTEM_STARTUP: 'system.startup',
  SYSTEM_SHUTDOWN: 'system.shutdown'
};

/**
 * AuditStore - Multi-tenant audit logging
 */
class AuditStore {
  constructor(options = {}) {
    this.baseDir = options.baseDir || AUDIT_DIR;
    this.retentionDays = options.retentionDays || 365; // 1 year default
  }

  /**
   * Get tenant audit directory (creates if not exists)
   */
  getTenantDir(tenantId) {
    const dir = path.join(this.baseDir, sanitizeTenantId(tenantId));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Get audit file path for a tenant
   */
  getAuditPath(tenantId) {
    return path.join(this.getTenantDir(tenantId), 'audit.jsonl');
  }

  /**
   * Get monthly archive path
   */
  getMonthlyArchivePath(tenantId, year, month) {
    const monthStr = String(month).padStart(2, '0');
    return path.join(this.getTenantDir(tenantId), `audit-${year}-${monthStr}.jsonl`);
  }

  /**
   * Generate audit event ID
   */
  generateEventId() {
    return `audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Log an audit event
   * @param {string} tenantId - Tenant identifier
   * @param {Object} event - Audit event details
   * @param {string} event.action - Action type (from ACTION_CATEGORIES)
   * @param {string} event.actor - Who performed the action (user_id or 'system')
   * @param {string} [event.resource] - Resource affected (e.g., 'user:123', 'session:abc')
   * @param {string} [event.ip] - IP address
   * @param {Object} [event.details] - Additional details
   * @param {string} [event.outcome] - 'success' | 'failure'
   */
  log(tenantId, event) {
    const auditPath = this.getAuditPath(tenantId);
    const now = new Date();

    const auditEntry = {
      id: this.generateEventId(),
      timestamp: now.toISOString(),
      tenant_id: tenantId,
      action: event.action,
      actor: event.actor || 'system',
      actor_type: event.actor_type || (event.actor === 'system' ? 'system' : 'user'),
      resource: event.resource || null,
      resource_type: event.resource_type || this.inferResourceType(event.resource),
      ip: event.ip || null,
      user_agent: event.user_agent || null,
      outcome: event.outcome || 'success',
      details: event.details || {},
      // Integrity hash for tamper detection
      hash: null
    };

    // Session 250.167: Chain hash with previous entry for tamper detection
    let previousHash = '0000000000000000';
    try {
      if (fs.existsSync(auditPath)) {
        const lines = fs.readFileSync(auditPath, 'utf8').trim().split('\n');
        if (lines.length > 0 && lines[lines.length - 1]) {
          const lastEntry = JSON.parse(lines[lines.length - 1]);
          previousHash = lastEntry.hash || previousHash;
        }
      }
    } catch { /* first entry or corrupt — use zero hash */ }

    const entryForHash = { ...auditEntry, previous_hash: previousHash };
    delete entryForHash.hash;
    auditEntry.previous_hash = previousHash;
    auditEntry.hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(entryForHash))
      .digest('hex')
      .substring(0, 32);

    // Append to JSONL file
    fs.appendFileSync(auditPath, JSON.stringify(auditEntry) + '\n');

    return auditEntry;
  }

  /**
   * Infer resource type from resource string
   */
  inferResourceType(resource) {
    if (!resource) return null;
    const parts = resource.split(':');
    return parts[0] || 'unknown';
  }

  /**
   * Query audit logs for a tenant
   * @param {string} tenantId - Tenant identifier
   * @param {Object} options - Query options
   * @param {Date} [options.startDate] - Start of date range
   * @param {Date} [options.endDate] - End of date range
   * @param {string} [options.action] - Filter by action
   * @param {string} [options.actor] - Filter by actor
   * @param {string} [options.resource] - Filter by resource
   * @param {number} [options.limit] - Max results
   */
  query(tenantId, options = {}) {
    const auditPath = this.getAuditPath(tenantId);
    if (!fs.existsSync(auditPath)) {
      return [];
    }

    const lines = fs.readFileSync(auditPath, 'utf8').trim().split('\n').filter(Boolean);
    let entries = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);

    // Apply filters
    if (options.startDate) {
      const start = new Date(options.startDate);
      entries = entries.filter(e => new Date(e.timestamp) >= start);
    }

    if (options.endDate) {
      const end = new Date(options.endDate);
      entries = entries.filter(e => new Date(e.timestamp) <= end);
    }

    if (options.action) {
      entries = entries.filter(e => e.action === options.action);
    }

    if (options.actor) {
      entries = entries.filter(e => e.actor === options.actor);
    }

    if (options.resource) {
      entries = entries.filter(e => e.resource === options.resource);
    }

    if (options.outcome) {
      entries = entries.filter(e => e.outcome === options.outcome);
    }

    // Sort by timestamp desc (newest first)
    entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Apply limit
    if (options.limit) {
      entries = entries.slice(0, options.limit);
    }

    return entries;
  }

  /**
   * Get audit stats for a tenant
   */
  getStats(tenantId) {
    const entries = this.query(tenantId);

    const actionCounts = {};
    const actorCounts = {};
    const outcomeCounts = { success: 0, failure: 0 };

    for (const e of entries) {
      actionCounts[e.action] = (actionCounts[e.action] || 0) + 1;
      actorCounts[e.actor] = (actorCounts[e.actor] || 0) + 1;
      if (e.outcome === 'failure') {
        outcomeCounts.failure++;
      } else {
        outcomeCounts.success++;
      }
    }

    return {
      tenant_id: tenantId,
      total_events: entries.length,
      by_action: actionCounts,
      by_actor: actorCounts,
      by_outcome: outcomeCounts,
      oldest: entries[entries.length - 1]?.timestamp || null,
      newest: entries[0]?.timestamp || null
    };
  }

  /**
   * Rotate logs to monthly archives
   */
  rotate(tenantId) {
    const auditPath = this.getAuditPath(tenantId);
    if (!fs.existsSync(auditPath)) {
      return { rotated: 0 };
    }

    const lines = fs.readFileSync(auditPath, 'utf8').trim().split('\n').filter(Boolean);
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const toKeep = [];
    const toArchive = {};

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        const entryMonth = entry.timestamp.substring(0, 7); // YYYY-MM

        if (entryMonth === currentMonth) {
          toKeep.push(line);
        } else {
          if (!toArchive[entryMonth]) {
            toArchive[entryMonth] = [];
          }
          toArchive[entryMonth].push(line);
        }
      } catch {
        toKeep.push(line); // Keep unparseable lines in current
      }
    }

    // Write archives
    let rotated = 0;
    for (const [month, archiveLines] of Object.entries(toArchive)) {
      const [year, mon] = month.split('-');
      const archivePath = this.getMonthlyArchivePath(tenantId, year, mon);
      fs.appendFileSync(archivePath, archiveLines.join('\n') + '\n');
      rotated += archiveLines.length;
    }

    // Rewrite current file
    fs.writeFileSync(auditPath, toKeep.join('\n') + (toKeep.length ? '\n' : ''));

    console.log(`✅ [AuditStore] Rotated ${rotated} entries for ${tenantId}`);
    return { rotated, kept: toKeep.length };
  }

  /**
   * Purge old audit logs (RGPD/retention)
   */
  purge(tenantId, retentionDays = this.retentionDays) {
    const tenantDir = this.getTenantDir(tenantId);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    let purged = 0;
    const files = fs.readdirSync(tenantDir).filter(f => f.endsWith('.jsonl'));

    for (const file of files) {
      // Check monthly archives for old dates
      const match = file.match(/audit-(\d{4})-(\d{2})\.jsonl/);
      if (match) {
        const archiveDate = new Date(`${match[1]}-${match[2]}-01`);
        if (archiveDate < cutoff) {
          fs.unlinkSync(path.join(tenantDir, file));
          purged++;
        }
      }
    }

    console.log(`✅ [AuditStore] Purged ${purged} archive files for ${tenantId}`);
    return { purged };
  }

  /**
   * Delete all audit data for a tenant (RGPD full purge)
   */
  purgeTenant(tenantId) {
    const tenantDir = path.join(this.baseDir, sanitizeTenantId(tenantId));
    if (fs.existsSync(tenantDir)) {
      fs.rmSync(tenantDir, { recursive: true, force: true });
      return true;
    }
    return false;
  }

  /**
   * Verify audit log integrity
   */
  verifyIntegrity(tenantId) {
    const entries = this.query(tenantId);
    const results = { total: entries.length, valid: 0, invalid: 0, missing_hash: 0 };

    for (const entry of entries) {
      if (!entry.hash) {
        results.missing_hash++;
        continue;
      }

      const entryForHash = { ...entry };
      delete entryForHash.hash;
      const calculatedHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(entryForHash))
        .digest('hex')
        .substring(0, 32);

      if (calculatedHash === entry.hash) {
        results.valid++;
      } else {
        results.invalid++;
      }
    }

    return results;
  }

  /**
   * Health check
   */
  health() {
    try {
      const tenants = fs.existsSync(this.baseDir)
        ? fs.readdirSync(this.baseDir).filter(f =>
          fs.statSync(path.join(this.baseDir, f)).isDirectory()
        )
        : [];

      return {
        status: 'ok',
        baseDir: this.baseDir,
        tenants: tenants.length,
        tenant_list: tenants
      };
    } catch (e) {
      return {
        status: 'error',
        error: e.message
      };
    }
  }
}

// Singleton
let instance = null;

function getInstance(options = {}) {
  if (!instance) {
    instance = new AuditStore(options);
  }
  return instance;
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const store = getInstance();

  if (args.includes('--health')) {
    console.log(JSON.stringify(store.health(), null, 2));
    process.exit(0);
  }

  if (args.includes('--test')) {
    console.log('Testing AuditStore...\n');

    const tenantId = 'test_tenant';

    // Log some events
    store.log(tenantId, {
      action: ACTION_CATEGORIES.AUTH_LOGIN,
      actor: 'user_123',
      ip: '192.168.1.1',
      outcome: 'success'
    });

    store.log(tenantId, {
      action: ACTION_CATEGORIES.DATA_READ,
      actor: 'user_123',
      resource: 'conversation:abc123',
      outcome: 'success'
    });

    store.log(tenantId, {
      action: ACTION_CATEGORIES.AUTH_FAILED,
      actor: 'unknown',
      ip: '10.0.0.1',
      outcome: 'failure',
      details: { reason: 'invalid_password' }
    });

    console.log('Logged 3 events');

    // Query
    const recent = store.query(tenantId, { limit: 5 });
    console.log('Recent events:', recent.length);

    // Stats
    const stats = store.getStats(tenantId);
    console.log('Stats:', JSON.stringify(stats, null, 2));

    // Verify integrity
    const integrity = store.verifyIntegrity(tenantId);
    console.log('Integrity:', JSON.stringify(integrity));

    // Cleanup
    store.purgeTenant(tenantId);
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }

  console.log(`
VocalIA Audit Store - Multi-tenant audit logging

Usage:
  node audit-store.cjs --health    Health check
  node audit-store.cjs --test      Run tests

Programmatic:
  const { getInstance } = require('./audit-store.cjs');
  const audit = getInstance();
  audit.log('tenant_id', { action: 'auth.login', actor: 'user_123' });
`);
}

module.exports = {
  AuditStore,
  getInstance,
  ACTION_CATEGORIES
};
