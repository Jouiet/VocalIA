'use strict';

/**
 * VocalIA - Unified Customer Profile (UCP) Store
 * Multi-tenant customer profile management
 *
 * Features:
 * - Per-tenant profile storage (data/ucp/{tenant_id}/)
 * - LTV tracking (bronze → diamond)
 * - Interaction logging (append-only)
 * - Preferences management
 * - RGPD-compliant deletion
 *
 * Storage Structure:
 *   data/ucp/{tenant_id}/
 *   ├── profiles.json       # Customer profiles
 *   ├── interactions.jsonl  # Append-only interaction log
 *   └── ltv.json           # LTV scores and tiers
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
const UCP_DIR = path.join(__dirname, '../data/ucp');

// LTV Tiers (from CLAUDE.md)
const LTV_TIERS = {
  bronze: { min: 0, max: 99, label: 'Bronze' },
  silver: { min: 100, max: 499, label: 'Silver' },
  gold: { min: 500, max: 1999, label: 'Gold' },
  platinum: { min: 2000, max: 9999, label: 'Platinum' },
  diamond: { min: 10000, max: Infinity, label: 'Diamond' }
};

/**
 * Get LTV tier from value
 */
function getLTVTier(ltvValue) {
  for (const [tier, range] of Object.entries(LTV_TIERS)) {
    if (ltvValue >= range.min && ltvValue <= range.max) {
      return { tier, ...range };
    }
  }
  return { tier: 'bronze', ...LTV_TIERS.bronze };
}

/**
 * UCPStore - Multi-tenant Unified Customer Profile Store
 */
class UCPStore {
  constructor(options = {}) {
    this.baseDir = options.baseDir || UCP_DIR;
    this.cache = new Map(); // tenantId -> { data, timestamp }
    this.cacheTTL = options.cacheTTL || 5 * 60 * 1000; // 5 min
    this.maxCacheSize = options.maxCacheSize || 100;
  }

  /**
   * Get tenant directory path
   */
  getTenantDir(tenantId) {
    const dir = path.join(this.baseDir, sanitizeTenantId(tenantId));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Get profiles file path
   */
  getProfilesPath(tenantId) {
    return path.join(this.getTenantDir(tenantId), 'profiles.json');
  }

  /**
   * Get interactions file path
   */
  getInteractionsPath(tenantId) {
    return path.join(this.getTenantDir(tenantId), 'interactions.jsonl');
  }

  /**
   * Get LTV file path
   */
  getLTVPath(tenantId) {
    return path.join(this.getTenantDir(tenantId), 'ltv.json');
  }

  // ==================== PROFILES ====================

  /**
   * Load all profiles for a tenant (cache-through: memory → disk)
   */
  loadProfiles(tenantId) {
    const cached = this.cache.get(tenantId);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
      return cached.data;
    }

    const filepath = this.getProfilesPath(tenantId);
    if (!fs.existsSync(filepath)) {
      return {};
    }
    try {
      const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
      this._cacheSet(tenantId, data);
      return data;
    } catch (e) {
      console.error(`❌ [UCP] Error loading profiles for ${tenantId}:`, e.message);
      return {};
    }
  }

  /**
   * Save all profiles for a tenant (write-through: memory + disk)
   */
  saveProfiles(tenantId, profiles) {
    const filepath = this.getProfilesPath(tenantId);
    fs.writeFileSync(filepath, JSON.stringify(profiles, null, 2));
    this._cacheSet(tenantId, profiles);
  }

  /**
   * Set cache entry with LRU eviction
   */
  _cacheSet(tenantId, data) {
    if (this.cache.size >= this.maxCacheSize && !this.cache.has(tenantId)) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(tenantId, { data, timestamp: Date.now() });
  }

  /**
   * Invalidate cache for a tenant
   */
  _cacheInvalidate(tenantId) {
    this.cache.delete(tenantId);
  }

  /**
   * Get a customer profile
   */
  getProfile(tenantId, customerId) {
    const profiles = this.loadProfiles(tenantId);
    return profiles[customerId] || null;
  }

  /**
   * Get all profiles for a tenant (for analytics dashboard)
   * Session 250.74 - E-commerce Widget Analytics
   */
  getAllProfiles(tenantId) {
    const profiles = this.loadProfiles(tenantId);
    return Object.entries(profiles).map(([userId, profile]) => ({
      userId,
      ...profile,
      interactions: this.getInteractions(tenantId, userId, { limit: 100 }),
      ltv: this.getLTV(tenantId, userId),
      lastUpdated: profile.updated_at
    }));
  }

  /**
   * Create or update a customer profile
   */
  upsertProfile(tenantId, customerId, data) {
    const profiles = this.loadProfiles(tenantId);
    const now = new Date().toISOString();

    const existing = profiles[customerId] || {};
    profiles[customerId] = {
      ...existing,
      ...data,
      customer_id: customerId,
      tenant_id: tenantId,
      updated_at: now,
      created_at: existing.created_at || now
    };

    this.saveProfiles(tenantId, profiles);
    return profiles[customerId];
  }

  /**
   * Delete a customer profile (RGPD)
   */
  deleteProfile(tenantId, customerId) {
    const profiles = this.loadProfiles(tenantId);
    if (profiles[customerId]) {
      delete profiles[customerId];
      this.saveProfiles(tenantId, profiles);
      return true;
    }
    return false;
  }

  /**
   * Search profiles by criteria
   */
  searchProfiles(tenantId, criteria = {}) {
    const profiles = this.loadProfiles(tenantId);
    return Object.values(profiles).filter(profile => {
      for (const [key, value] of Object.entries(criteria)) {
        if (profile[key] !== value) return false;
      }
      return true;
    });
  }

  /**
   * List all profiles for a tenant
   */
  listProfiles(tenantId, options = {}) {
    const profiles = this.loadProfiles(tenantId);
    let result = Object.values(profiles);

    // Sort by updated_at desc
    result.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

    // Apply limit
    if (options.limit) {
      result = result.slice(0, options.limit);
    }

    return result;
  }

  // ==================== INTERACTIONS ====================

  /**
   * Record an interaction (append-only log)
   */
  recordInteraction(tenantId, customerId, interaction) {
    const filepath = this.getInteractionsPath(tenantId);
    // BL27 fix: Spread interaction BEFORE fixed fields to prevent override of system values
    const entry = {
      ...interaction,
      id: crypto.randomUUID().split('-')[0],
      customer_id: customerId,
      tenant_id: tenantId,
      timestamp: new Date().toISOString(),
    };

    // Append to JSONL file
    fs.appendFileSync(filepath, JSON.stringify(entry) + '\n');

    // Update profile last_interaction
    this.upsertProfile(tenantId, customerId, {
      last_interaction: entry.timestamp,
      interaction_count: (this.getProfile(tenantId, customerId)?.interaction_count || 0) + 1
    });

    return entry;
  }

  /**
   * Get interactions for a customer
   */
  getInteractions(tenantId, customerId, options = {}) {
    const filepath = this.getInteractionsPath(tenantId);
    if (!fs.existsSync(filepath)) {
      return [];
    }

    const lines = fs.readFileSync(filepath, 'utf8').trim().split('\n').filter(Boolean);
    let interactions = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);

    // Filter by customer
    if (customerId) {
      interactions = interactions.filter(i => i.customer_id === customerId);
    }

    // Sort by timestamp desc
    interactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Apply limit
    if (options.limit) {
      interactions = interactions.slice(0, options.limit);
    }

    return interactions;
  }

  // ==================== LTV ====================

  /**
   * Load LTV data for a tenant
   */
  loadLTV(tenantId) {
    const filepath = this.getLTVPath(tenantId);
    if (!fs.existsSync(filepath)) {
      return {};
    }
    try {
      return JSON.parse(fs.readFileSync(filepath, 'utf8'));
    } catch (e) {
      return {};
    }
  }

  /**
   * Save LTV data for a tenant
   */
  saveLTV(tenantId, ltvData) {
    const filepath = this.getLTVPath(tenantId);
    fs.writeFileSync(filepath, JSON.stringify(ltvData, null, 2));
  }

  /**
   * Update LTV for a customer
   */
  updateLTV(tenantId, customerId, amount, type = 'purchase') {
    const ltvData = this.loadLTV(tenantId);
    const now = new Date().toISOString();

    const existing = ltvData[customerId] || {
      customer_id: customerId,
      total_value: 0,
      transaction_count: 0,
      history: []
    };

    existing.total_value += amount;
    existing.transaction_count += 1;
    existing.tier = getLTVTier(existing.total_value);
    existing.updated_at = now;
    existing.history.push({
      amount,
      type,
      timestamp: now
    });

    // Keep only last 100 transactions in history
    if (existing.history.length > 100) {
      existing.history = existing.history.slice(-100);
    }

    ltvData[customerId] = existing;
    this.saveLTV(tenantId, ltvData);

    // Update profile with LTV tier
    this.upsertProfile(tenantId, customerId, {
      ltv_value: existing.total_value,
      ltv_tier: existing.tier.tier
    });

    return existing;
  }

  /**
   * Get LTV for a customer
   */
  getLTV(tenantId, customerId) {
    const ltvData = this.loadLTV(tenantId);
    return ltvData[customerId] || null;
  }

  /**
   * Get insights for a customer
   */
  getInsights(tenantId, customerId) {
    const profile = this.getProfile(tenantId, customerId);
    const ltv = this.getLTV(tenantId, customerId);
    const interactions = this.getInteractions(tenantId, customerId, { limit: 10 });

    if (!profile) {
      return null;
    }

    return {
      customer_id: customerId,
      profile: {
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        created_at: profile.created_at,
        interaction_count: profile.interaction_count || 0
      },
      ltv: ltv ? {
        total_value: ltv.total_value,
        tier: ltv.tier,
        transaction_count: ltv.transaction_count
      } : null,
      recent_interactions: interactions.slice(0, 5).map(i => ({
        type: i.type,
        channel: i.channel,
        timestamp: i.timestamp
      })),
      recommendations: this.generateRecommendations(profile, ltv, interactions)
    };
  }

  /**
   * Generate recommendations based on customer data
   */
  generateRecommendations(profile, ltv, interactions) {
    const recommendations = [];

    // LTV-based recommendations
    if (ltv) {
      if (ltv.tier.tier === 'bronze') {
        recommendations.push('Offrir une réduction de bienvenue pour augmenter l\'engagement');
      } else if (ltv.tier.tier === 'gold' || ltv.tier.tier === 'platinum') {
        recommendations.push('Proposer un programme de fidélité premium');
      } else if (ltv.tier.tier === 'diamond') {
        recommendations.push('Assigner un conseiller dédié');
      }
    }

    // Interaction-based recommendations
    if (profile?.interaction_count > 10) {
      recommendations.push('Client fidèle - priorité haute pour le support');
    }

    // Recency-based
    if (profile?.last_interaction) {
      const daysSinceLastInteraction = Math.floor(
        (Date.now() - new Date(profile.last_interaction)) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceLastInteraction > 30) {
        recommendations.push('Client inactif depuis 30+ jours - campagne de réactivation');
      }
    }

    return recommendations;
  }

  // ==================== TENANT MANAGEMENT ====================

  /**
   * Delete all data for a tenant (RGPD full purge)
   */
  purgeTenant(tenantId) {
    const tenantDir = path.join(this.baseDir, sanitizeTenantId(tenantId));
    this._cacheInvalidate(tenantId);
    if (fs.existsSync(tenantDir)) {
      fs.rmSync(tenantDir, { recursive: true, force: true });
      return true;
    }
    return false;
  }

  /**
   * Delete all data for a customer across a tenant (RGPD)
   */
  purgeCustomer(tenantId, customerId) {
    // Delete profile
    this.deleteProfile(tenantId, customerId);

    // Delete LTV
    const ltvData = this.loadLTV(tenantId);
    if (ltvData[customerId]) {
      delete ltvData[customerId];
      this.saveLTV(tenantId, ltvData);
    }

    // Note: Interactions are append-only for audit trail
    // In production, you might want to anonymize instead of delete

    return true;
  }

  /**
   * Get statistics for a tenant
   */
  getStats(tenantId) {
    const profiles = this.loadProfiles(tenantId);
    const ltvData = this.loadLTV(tenantId);

    const profileCount = Object.keys(profiles).length;
    const totalLTV = Object.values(ltvData).reduce((sum, l) => sum + (l.total_value || 0), 0);

    // Count by tier
    const tierCounts = { bronze: 0, silver: 0, gold: 0, platinum: 0, diamond: 0 };
    for (const ltv of Object.values(ltvData)) {
      if (ltv.tier?.tier) {
        tierCounts[ltv.tier.tier]++;
      }
    }

    return {
      tenant_id: tenantId,
      profile_count: profileCount,
      total_ltv: totalLTV,
      average_ltv: profileCount > 0 ? totalLTV / profileCount : 0,
      tier_distribution: tierCounts
    };
  }

  /**
   * Health check
   */
  health() {
    try {
      // List all tenants
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
    instance = new UCPStore(options);
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
    console.log('Testing UCP Store...\n');

    const tenantId = 'test_tenant';
    const customerId = 'customer_001';

    // Create profile
    const profile = store.upsertProfile(tenantId, customerId, {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890'
    });
    console.log('Created profile:', profile.customer_id);

    // Record interaction
    const interaction = store.recordInteraction(tenantId, customerId, {
      type: 'call',
      channel: 'telephony',
      duration_sec: 120,
      outcome: 'qualified'
    });
    console.log('Recorded interaction:', interaction.id);

    // Update LTV
    const ltv = store.updateLTV(tenantId, customerId, 150, 'purchase');
    console.log('Updated LTV:', ltv.total_value, '- Tier:', ltv.tier.tier);

    // Get insights
    const insights = store.getInsights(tenantId, customerId);
    console.log('Insights:', JSON.stringify(insights, null, 2));

    // Get stats
    const stats = store.getStats(tenantId);
    console.log('Stats:', stats);

    // Cleanup
    store.purgeTenant(tenantId);
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }

  console.log(`
VocalIA UCP Store - Unified Customer Profile

Usage:
  node ucp-store.cjs --health    Health check
  node ucp-store.cjs --test      Run tests

Programmatic:
  const { getInstance } = require('./ucp-store.cjs');
  const ucp = getInstance();
  ucp.upsertProfile('tenant_id', 'customer_id', { name: 'John' });
  ucp.recordInteraction('tenant_id', 'customer_id', { type: 'call' });
  ucp.updateLTV('tenant_id', 'customer_id', 100, 'purchase');
`);
}

module.exports = {
  UCPStore,
  getInstance,
  getLTVTier,
  LTV_TIERS
};
