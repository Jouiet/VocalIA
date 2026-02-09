'use strict';

/**
 * GoogleSheetsDB - Google Sheets as Database for VocalIA
 *
 * Features:
 * - CRUD operations (create, read, update, delete)
 * - Query/filter capabilities
 * - In-memory caching with TTL (default 60s)
 * - Auto-retry on rate limits
 * - Batch operations for performance
 * - Schema validation
 *
 * Known Limits:
 * - No ACID transactions (eventual consistency)
 * - Google API rate limit: 100 req/100s per user
 * - Network latency on every cache miss (~200-500ms)
 * - No automatic backup (rely on Google Sheets version history)
 * - Max 10 million cells per spreadsheet
 * - NOT suitable for high-throughput writes (>1 write/sec sustained)
 *
 * @version 1.0.0
 * @author VocalIA
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { sanitizeTenantId } = require('./voice-api-utils.cjs');

// Configuration paths
const CONFIG_PATH = path.join(__dirname, '../data/google-sheets-config.json');
const TOKENS_PATH = path.join(__dirname, '../data/google-oauth-tokens.json');

// Schema definitions
// Session 250.97quater: Extended tenant schema for multi-tenant persona support
const SCHEMAS = {
  tenants: {
    columns: [
      // Core identity
      'id', 'name', 'email', 'phone',
      // Subscription
      'plan', 'mrr', 'status',
      // Analytics
      'nps_score', 'conversion_rate', 'qualified_leads',
      // Voice config
      'voice_language', 'voice_gender', 'active_persona',
      // === NEW: Multi-tenant persona fields (Session 250.97quater) ===
      'business_name',      // Commercial name for prompts
      'sector',             // Maps to PERSONAS archetype (DENTAL, GYM, etc.)
      'widget_type',        // B2B, B2C, ECOM
      'address',            // Full business address
      'horaires',           // Opening hours
      'services',           // JSON array of services
      'zones',              // JSON array of service zones
      'currency',           // EUR, MAD, USD
      'knowledge_base_id',  // tenant_xxx or null
      'payment_method',     // CARD, BANK, CASH
      'payment_details',    // Payment instructions
      // Billing (C8 fix)
      'stripe_customer_id', // Stripe customer ID for billing
      // Timestamps
      'created_at', 'updated_at'
    ],
    required: ['name', 'email'],
    defaults: {
      plan: 'trial', mrr: 0, status: 'active',
      nps_score: 0, conversion_rate: 0, qualified_leads: 0,
      voice_language: 'fr', voice_gender: 'female', active_persona: null,
      widget_type: 'B2B', currency: 'EUR', sector: 'UNIVERSAL_SME'
    }
  },
  sessions: {
    columns: ['id', 'tenant_id', 'calls', 'duration_sec', 'cost_usd', 'persona', 'lang', 'timestamp'],
    required: ['tenant_id'],
    defaults: { calls: 1, duration_sec: 0, cost_usd: 0, lang: 'fr' }
  },
  logs: {
    columns: ['timestamp', 'level', 'service', 'message', 'details'],
    required: ['level', 'message'],
    defaults: { service: 'vocalia' }
  },
  users: {
    columns: [
      'id', 'email', 'password_hash', 'role', 'tenant_id', 'name', 'phone', 'avatar_url',
      'email_verified', 'email_verify_token', 'email_verify_expires',
      'password_reset_token', 'password_reset_expires',
      'last_login', 'login_count', 'failed_login_count', 'locked_until',
      'preferences', 'created_at', 'updated_at'
    ],
    required: ['email', 'password_hash'],
    defaults: { role: 'user', email_verified: false, login_count: 0, failed_login_count: 0 }
  },
  auth_sessions: {
    columns: ['id', 'user_id', 'refresh_token_hash', 'device_info', 'expires_at', 'created_at', 'last_used_at'],
    required: ['user_id', 'refresh_token_hash', 'expires_at'],
    defaults: {}
  },
  hitl_pending: {
    columns: ['id', 'type', 'tenant', 'caller', 'score', 'summary', 'context', 'created_at'],
    required: ['type', 'tenant'],
    defaults: { score: 0 }
  },
  hitl_history: {
    columns: ['id', 'type', 'tenant', 'caller', 'score', 'summary', 'context', 'decision', 'decided_by', 'decided_at', 'rejection_reason'],
    required: ['type', 'tenant', 'decision', 'decided_by', 'decided_at'],
    defaults: {}
  }
};

/**
 * Convert column number (1-based) to letter(s): 1→A, 26→Z, 27→AA, 28→AB
 * H7 fix: Supports >26 columns (beyond A:Z limit)
 */
function columnLetter(n) {
  let result = '';
  while (n > 0) {
    n--;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

/**
 * Get sheet range string covering all columns for a given schema
 */
function sheetRange(sheet) {
  const schema = SCHEMAS[sheet];
  if (!schema) return `${sheet}!A:Z`;
  const lastCol = columnLetter(schema.columns.length);
  return `${sheet}!A:${lastCol}`;
}

class GoogleSheetsDB {
  constructor(options = {}) {
    this.config = null;
    this.auth = null;
    this.sheets = null;
    this.cache = new Map();
    this.cacheTTL = options.cacheTTL || 60000; // 1 minute default
    this.maxRetries = options.maxRetries || 3;
    this.initialized = false;
    this.locks = new Map(); // Concurrency locks: sheet -> Promise
  }

  /**
   * Internal lock to serialize operations on a per-sheet basis
   * Prevents Read-Modify-Write race conditions
   */
  async acquireLock(sheet) {
    while (this.locks.get(sheet)) {
      await this.locks.get(sheet);
    }
    let resolve;
    const promise = new Promise(r => resolve = r);
    this.locks.set(sheet, promise);
    return () => {
      this.locks.delete(sheet);
      resolve();
    };
  }

  /**
   * Initialize the database connection
   */
  async init() {
    if (this.initialized) return this;

    try {
      // Load config
      if (!fs.existsSync(CONFIG_PATH)) {
        throw new Error('Config not found: ' + CONFIG_PATH);
      }
      if (!fs.existsSync(TOKENS_PATH)) {
        throw new Error('Tokens not found: ' + TOKENS_PATH);
      }

      this.config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'));

      // Setup OAuth
      this.auth = new google.auth.OAuth2(tokens.client_id, tokens.client_secret);
      this.auth.setCredentials({ refresh_token: tokens.refresh_token });

      // Initialize Sheets API
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });

      this.initialized = true;
      console.log('✅ [GoogleSheetsDB] Initialized');
      return this;

    } catch (error) {
      console.error('❌ [GoogleSheetsDB] Init failed:', error.message);
      throw error;
    }
  }

  /**
   * Generate unique ID
   */
  generateId() {
    // M8 fix: 12 hex chars instead of 8 — collision probability ~1 in 281 trillion
    return crypto.randomUUID().replace(/-/g, '').substring(0, 12);
  }

  /**
   * Get current timestamp
   */
  timestamp() {
    return new Date().toISOString();
  }

  /**
   * Cache key generator
   */
  cacheKey(sheet, query = null) {
    return `${sheet}:${query ? JSON.stringify(query) : 'all'}`;
  }

  /**
   * Get from cache if valid
   */
  getCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.time < this.cacheTTL) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  /**
   * Set cache
   */
  setCache(key, data) {
    this.cache.set(key, { data, time: Date.now() });
  }

  /**
   * Invalidate cache for sheet
   */
  invalidateCache(sheet) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(sheet + ':')) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Execute with retry on rate limit
   */
  async withRetry(operation) {
    for (let i = 0; i < this.maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        if (error.code === 429 && i < this.maxRetries - 1) {
          const delay = Math.pow(2, i) * 1000;
          console.log(`⚠️ [GoogleSheetsDB] Rate limited, retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Validate data against schema
   */
  validate(sheet, data) {
    const schema = SCHEMAS[sheet];
    if (!schema) {
      throw new Error(`Unknown sheet: ${sheet}`);
    }

    // Check required fields
    for (const field of schema.required) {
      if (data[field] === undefined || data[field] === null || data[field] === '') {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    return true;
  }

  /**
   * Apply defaults to data
   */
  applyDefaults(sheet, data) {
    const schema = SCHEMAS[sheet];
    const result = { ...schema.defaults, ...data };

    // Auto-generate ID if not provided
    if (!result.id) {
      result.id = this.generateId();
    }

    // Auto-set timestamps
    const now = this.timestamp();
    if (schema.columns.includes('created_at') && !result.created_at) {
      result.created_at = now;
    }
    if (schema.columns.includes('updated_at')) {
      result.updated_at = now;
    }
    if (schema.columns.includes('timestamp') && !result.timestamp) {
      result.timestamp = now;
    }

    return result;
  }

  /**
   * Convert row array to object
   */
  rowToObject(sheet, row) {
    const schema = SCHEMAS[sheet];
    const obj = {};
    schema.columns.forEach((col, i) => {
      obj[col] = row[i] || null;
    });
    return obj;
  }

  /**
   * Convert object to row array
   */
  objectToRow(sheet, obj) {
    const schema = SCHEMAS[sheet];
    return schema.columns.map(col => obj[col] ?? '');
  }

  // ==================== CRUD OPERATIONS ====================

  /**
   * CREATE - Insert new record
   */
  async create(sheet, data) {
    await this.init();

    // Validate and apply defaults
    const record = this.applyDefaults(sheet, data);
    this.validate(sheet, record);

    const row = this.objectToRow(sheet, record);

    await this.withRetry(async () => {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.config.spreadsheetId,
        range: sheetRange(sheet),
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [row] }
      });
    });

    this.invalidateCache(sheet);
    console.log(`✅ [GoogleSheetsDB] Created ${sheet}:${record.id}`);
    return record;
  }

  /**
   * READ ALL - Get all records from sheet
   */
  async findAll(sheet, options = {}) {
    await this.init();

    const cacheKey = this.cacheKey(sheet);
    const cached = this.getCache(cacheKey);
    if (cached && !options.noCache) {
      return cached;
    }

    const response = await this.withRetry(async () => {
      return await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.config.spreadsheetId,
        range: sheetRange(sheet)
      });
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) {
      return []; // Only headers or empty
    }

    const records = rows.slice(1).map(row => this.rowToObject(sheet, row));
    this.setCache(cacheKey, records);
    return records;
  }

  /**
   * READ ONE - Find by ID
   */
  async findById(sheet, id) {
    const records = await this.findAll(sheet);
    return records.find(r => r.id === id) || null;
  }

  /**
   * FIND - Query with filters
   */
  async find(sheet, query = {}) {
    const records = await this.findAll(sheet);

    return records.filter(record => {
      for (const [key, value] of Object.entries(query)) {
        if (record[key] !== value) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * FIND ONE - Query single record
   */
  async findOne(sheet, query = {}) {
    const records = await this.find(sheet, query);
    return records[0] || null;
  }

  /**
   * QUERY - Alias for find (compatibility)
   */
  async query(sheet, filters = {}) {
    return this.find(sheet, filters);
  }

  /**
   * UPDATE - Update record by ID
   * Session 179-ULTRATHINK: Added sheet-level lock to prevent RMW race conditions
   */
  async update(sheet, id, data) {
    await this.init();
    const release = await this.acquireLock(sheet);

    try {
      // Find row index
      const response = await this.withRetry(async () => {
        return await this.sheets.spreadsheets.values.get({
          spreadsheetId: this.config.spreadsheetId,
          range: `${sheet}!A:A`
        });
      });

      const ids = response.data.values || [];
      const rowIndex = ids.findIndex(row => row[0] === id);

      if (rowIndex === -1) {
        throw new Error(`Record not found: ${sheet}:${id}`);
      }

      // H6 fix: Invalidate cache before reading to prevent stale merges under lock
      this.invalidateCache(sheet);
      const current = await this.findById(sheet, id);
      const updated = {
        ...current,
        ...data,
        id, // Preserve ID
        updated_at: this.timestamp()
      };

      const row = this.objectToRow(sheet, updated);
      const range = `${sheet}!A${rowIndex + 1}:${columnLetter(row.length)}${rowIndex + 1}`;

      await this.withRetry(async () => {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.config.spreadsheetId,
          range,
          valueInputOption: 'RAW',
          requestBody: { values: [row] }
        });
      });

      this.invalidateCache(sheet);
      console.log(`✅ [GoogleSheetsDB] Updated ${sheet}:${id}`);
      return updated;
    } finally {
      release();
    }
  }

  /**
   * DELETE - Remove record by ID
   */
  async delete(sheet, id) {
    await this.init();

    // Find row index
    const response = await this.withRetry(async () => {
      return await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.config.spreadsheetId,
        range: `${sheet}!A:A`
      });
    });

    const ids = response.data.values || [];
    const rowIndex = ids.findIndex(row => row[0] === id);

    if (rowIndex === -1) {
      throw new Error(`Record not found: ${sheet}:${id}`);
    }

    // Get sheet ID for delete request
    const metadata = await this.sheets.spreadsheets.get({
      spreadsheetId: this.config.spreadsheetId
    });

    const sheetMeta = metadata.data.sheets.find(s => s.properties.title === sheet);
    if (!sheetMeta) {
      throw new Error(`Sheet not found: ${sheet}`);
    }

    await this.withRetry(async () => {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.config.spreadsheetId,
        requestBody: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: sheetMeta.properties.sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex,
                endIndex: rowIndex + 1
              }
            }
          }]
        }
      });
    });

    this.invalidateCache(sheet);
    console.log(`✅ [GoogleSheetsDB] Deleted ${sheet}:${id}`);
    return true;
  }

  // ==================== BATCH OPERATIONS ====================

  /**
   * BATCH CREATE - Insert multiple records
   */
  async createMany(sheet, dataArray) {
    await this.init();

    const records = dataArray.map(data => {
      const record = this.applyDefaults(sheet, data);
      this.validate(sheet, record);
      return record;
    });

    const rows = records.map(r => this.objectToRow(sheet, r));

    await this.withRetry(async () => {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.config.spreadsheetId,
        range: sheetRange(sheet),
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: rows }
      });
    });

    this.invalidateCache(sheet);
    console.log(`✅ [GoogleSheetsDB] Created ${records.length} records in ${sheet}`);
    return records;
  }

  // ==================== SHEET MANAGEMENT ====================

  /**
   * Create a new sheet (tab) in the spreadsheet
   */
  async createSheet(sheetName, headers = null) {
    await this.init();

    // Check if sheet already exists
    const metadata = await this.sheets.spreadsheets.get({
      spreadsheetId: this.config.spreadsheetId
    });

    const existingSheet = metadata.data.sheets.find(s => s.properties.title === sheetName);
    if (existingSheet) {
      console.log(`⚠️ [GoogleSheetsDB] Sheet already exists: ${sheetName}`);
      return existingSheet.properties.sheetId;
    }

    // Create the sheet
    const response = await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.config.spreadsheetId,
      requestBody: {
        requests: [{
          addSheet: {
            properties: {
              title: sheetName
            }
          }
        }]
      }
    });

    const newSheetId = response.data.replies[0].addSheet.properties.sheetId;
    console.log(`✅ [GoogleSheetsDB] Created sheet: ${sheetName} (ID: ${newSheetId})`);

    // Add headers if provided
    if (headers && headers.length > 0) {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.config.spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers]
        }
      });
      console.log(`✅ [GoogleSheetsDB] Added headers to ${sheetName}`);
    }

    return newSheetId;
  }

  /**
   * Ensure a sheet exists, create if not
   */
  async ensureSheet(sheetName, headers = null) {
    try {
      const metadata = await this.sheets.spreadsheets.get({
        spreadsheetId: this.config.spreadsheetId
      });

      const exists = metadata.data.sheets.some(s => s.properties.title === sheetName);
      if (!exists) {
        await this.createSheet(sheetName, headers);
      }
      return true;
    } catch (e) {
      console.error(`❌ [GoogleSheetsDB] Failed to ensure sheet ${sheetName}:`, e.message);
      return false;
    }
  }

  // ==================== SPECIALIZED METHODS ====================

  /**
   * Count records
   */
  async count(sheet, query = {}) {
    const records = await this.find(sheet, query);
    return records.length;
  }

  /**
   * Check if record exists
   */
  async exists(sheet, query) {
    const record = await this.findOne(sheet, query);
    return record !== null;
  }

  /**
   * Aggregate - sum a numeric field
   */
  async sum(sheet, field, query = {}) {
    const records = await this.find(sheet, query);
    return records.reduce((sum, r) => sum + (parseFloat(r[field]) || 0), 0);
  }

  /**
   * Log helper - quick log entry
   */
  async log(level, message, details = null, service = 'vocalia') {
    return await this.create('logs', {
      level,
      message,
      details: details ? JSON.stringify(details) : '',
      service
    });
  }

  // ==================== TENANT METHODS ====================

  /**
   * Get tenant by email
   */
  async getTenantByEmail(email) {
    return await this.findOne('tenants', { email });
  }

  /**
   * Create new tenant
   */
  async createTenant(data) {
    return await this.create('tenants', data);
  }

  /**
   * Get tenant stats
   */
  async getTenantStats(tenantId) {
    const sessions = await this.find('sessions', { tenant_id: tenantId });
    return {
      totalCalls: sessions.reduce((sum, s) => sum + (parseInt(s.calls) || 0), 0),
      totalDuration: sessions.reduce((sum, s) => sum + (parseInt(s.duration_sec) || 0), 0),
      totalCost: sessions.reduce((sum, s) => sum + (parseFloat(s.cost_usd) || 0), 0),
      sessionCount: sessions.length
    };
  }

  // ==================== SESSION METHODS ====================

  /**
   * Log voice session
   */
  async logSession(tenantId, data) {
    return await this.create('sessions', {
      tenant_id: tenantId,
      ...data
    });
  }

  // ==================== USER METHODS ====================

  /**
   * Get user by email
   */
  async getUserByEmail(email) {
    return await this.findOne('users', { email });
  }

  /**
   * Update last login
   */
  async updateLastLogin(userId) {
    return await this.update('users', userId, {
      last_login: this.timestamp()
    });
  }

  // ==================== QUOTA MANAGEMENT (Session 250.57) ====================

  /**
   * Get tenant config from file system
   * @param {string} tenantId - Tenant identifier
   * @returns {Object|null} Tenant configuration
   */
  getTenantConfig(tenantId) {
    // Session 250.82: Check client config first, then fallback to data/quotas
    const safeTenantId = sanitizeTenantId(tenantId);
    const configPath = path.join(__dirname, '../clients', safeTenantId, 'config.json');
    const quotaFallbackPath = path.join(__dirname, '../data/quotas', `${safeTenantId}.json`);

    let loadPath = null;
    if (fs.existsSync(configPath)) {
      loadPath = configPath;
    } else if (fs.existsSync(quotaFallbackPath)) {
      loadPath = quotaFallbackPath;
    } else {
      // Silent warning only for non-default tenants
      if (tenantId !== 'default') {
        console.warn(`[Quotas] Config not found for tenant: ${tenantId}`);
      }
      return null;
    }

    try {
      return JSON.parse(fs.readFileSync(loadPath, 'utf8'));
    } catch (e) {
      console.error(`[Quotas] Error loading config for ${tenantId}:`, e.message);
      return null;
    }
  }

  /**
   * Update tenant usage in config file
   * @param {string} tenantId - Tenant identifier
   * @param {Object} usage - Usage updates
   */
  updateTenantUsage(tenantId, usage) {
    const configPath = path.join(__dirname, '../clients', sanitizeTenantId(tenantId), 'config.json');
    try {
      const config = this.getTenantConfig(tenantId);
      if (!config) return false;

      config.usage = { ...config.usage, ...usage };
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      return true;
    } catch (e) {
      console.error(`[Quotas] Error updating usage for ${tenantId}:`, e.message);
      return false;
    }
  }

  /**
   * Check if tenant is within quota
   * @param {string} tenantId - Tenant identifier
   * @param {string} quotaType - 'calls' | 'sessions' | 'kb_entries' | 'users'
   * @returns {Object} { allowed: boolean, current: number, limit: number, remaining: number }
   */
  checkQuota(tenantId, quotaType) {
    const config = this.getTenantConfig(tenantId);
    if (!config) {
      // C10 fix: Unknown tenants are DENIED, not allowed with infinite quota
      console.warn(`[Quotas] Denying unknown tenant: ${tenantId}`);
      return { allowed: false, current: 0, limit: 0, remaining: 0, error: 'Unknown tenant — no quota config found' };
    }

    const quotaMap = {
      calls: { quota: 'calls_monthly', usage: 'calls_current' },
      sessions: { quota: 'sessions_monthly', usage: 'sessions_current' },
      kb_entries: { quota: 'kb_entries', usage: 'kb_entries_current' },
      users: { quota: 'users_max', usage: null } // Users counted from users table
    };

    const mapping = quotaMap[quotaType];
    if (!mapping) {
      return { allowed: true, current: 0, limit: Infinity, remaining: Infinity, error: 'Invalid quota type' };
    }

    const limit = config.quotas?.[mapping.quota] || Infinity;
    const current = config.usage?.[mapping.usage] || 0;
    const remaining = Math.max(0, limit - current);

    return {
      allowed: current < limit,
      current,
      limit,
      remaining,
      quotaType,
      tenantId
    };
  }

  /**
   * Increment usage counter for a tenant
   * @param {string} tenantId - Tenant identifier
   * @param {string} usageType - 'calls' | 'sessions' | 'kb_entries'
   * @param {number} amount - Amount to increment (default: 1)
   * @returns {Object} { success: boolean, newValue: number, withinQuota: boolean }
   */
  incrementUsage(tenantId, usageType, amount = 1) {
    const config = this.getTenantConfig(tenantId);
    if (!config) {
      return { success: false, error: 'Config not found' };
    }

    const usageMap = {
      calls: 'calls_current',
      sessions: 'sessions_current',
      kb_entries: 'kb_entries_current'
    };

    const usageKey = usageMap[usageType];
    if (!usageKey) {
      return { success: false, error: 'Invalid usage type' };
    }

    // Check quota before incrementing
    const quotaCheck = this.checkQuota(tenantId, usageType);
    if (!quotaCheck.allowed) {
      return {
        success: false,
        error: 'Quota exceeded',
        current: quotaCheck.current,
        limit: quotaCheck.limit
      };
    }

    // Increment usage
    const newValue = (config.usage?.[usageKey] || 0) + amount;
    const updated = this.updateTenantUsage(tenantId, { [usageKey]: newValue });

    return {
      success: updated,
      newValue,
      withinQuota: newValue <= (config.quotas?.[usageMap[usageType]?.replace('_current', '_monthly')] || Infinity)
    };
  }

  /**
   * Get full quota status for a tenant
   * @param {string} tenantId - Tenant identifier
   * @returns {Object} Complete quota status
   */
  getQuotaStatus(tenantId) {
    const config = this.getTenantConfig(tenantId);
    if (!config) {
      return { error: 'Config not found', tenantId };
    }

    return {
      tenantId,
      plan: config.plan,
      quotas: {
        calls: this.checkQuota(tenantId, 'calls'),
        sessions: this.checkQuota(tenantId, 'sessions'),
        kb_entries: this.checkQuota(tenantId, 'kb_entries'),
        users: this.checkQuota(tenantId, 'users'),
        conversation_history_days: config.quotas?.conversation_history_days || 30
      },
      period_start: config.usage?.period_start,
      updated_at: config.updated_at
    };
  }

  /**
   * Reset usage counters (called at period start)
   * @param {string} tenantId - Tenant identifier
   */
  resetUsage(tenantId) {
    const now = new Date().toISOString();
    return this.updateTenantUsage(tenantId, {
      calls_current: 0,
      sessions_current: 0,
      period_start: now
    });
  }

  // ==================== QUOTA SYNC (Session 250.170 — M9 fix) ====================

  /**
   * Sync tenant plan from Google Sheets → local config
   * Resolves the two-sources-of-truth problem: Sheets is authoritative for plan,
   * local config is authoritative for usage counters.
   * @param {string} tenantId - Tenant identifier
   * @returns {Object} { synced: boolean, plan: string|null, changed: boolean }
   */
  async syncTenantPlan(tenantId) {
    try {
      const safeTenantId = sanitizeTenantId(tenantId);
      const tenant = await this.findOne('tenants', { id: safeTenantId });
      if (!tenant) {
        return { synced: false, error: 'Tenant not found in Sheets' };
      }

      const sheetsPlan = (tenant.plan || 'starter').toLowerCase();
      const config = this.getTenantConfig(safeTenantId);
      if (!config) {
        return { synced: false, error: 'No local config' };
      }

      const localPlan = (config.plan || 'starter').toLowerCase();
      if (localPlan === sheetsPlan) {
        return { synced: true, plan: sheetsPlan, changed: false };
      }

      // Plan differs — Sheets is authoritative
      config.plan = sheetsPlan;
      config.updated_at = new Date().toISOString();
      const configPath = path.join(__dirname, '../clients', safeTenantId, 'config.json');
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      console.log(`[QuotaSync] Plan updated for ${safeTenantId}: ${localPlan} → ${sheetsPlan}`);
      return { synced: true, plan: sheetsPlan, changed: true, previous: localPlan };
    } catch (e) {
      console.error(`[QuotaSync] Error syncing ${tenantId}:`, e.message);
      return { synced: false, error: e.message };
    }
  }

  /**
   * Sync ALL tenants: plan from Sheets → local config
   * Runs periodically to keep local quota configs in sync with Sheets authority.
   * @returns {Object} { total: number, synced: number, changed: number, errors: number }
   */
  async syncAllTenantPlans() {
    try {
      const tenants = await this.findAll('tenants');
      let synced = 0, changed = 0, errors = 0;

      for (const tenant of tenants) {
        if (!tenant.id) continue;
        const result = await this.syncTenantPlan(tenant.id);
        if (result.synced) {
          synced++;
          if (result.changed) changed++;
        } else {
          errors++;
        }
      }

      const summary = { total: tenants.length, synced, changed, errors, timestamp: new Date().toISOString() };
      if (changed > 0) {
        console.log(`[QuotaSync] Batch sync complete: ${changed} plans updated out of ${tenants.length} tenants`);
      }
      return summary;
    } catch (e) {
      console.error('[QuotaSync] Batch sync failed:', e.message);
      return { total: 0, synced: 0, changed: 0, errors: 1, error: e.message };
    }
  }

  /**
   * Start periodic quota sync (every 10 minutes)
   * Call once during server startup. Uses unref() so it doesn't prevent process exit.
   */
  startQuotaSync() {
    if (this._quotaSyncTimer) return;
    const SYNC_INTERVAL = 10 * 60 * 1000; // 10 minutes
    this._quotaSyncTimer = setInterval(async () => {
      try {
        await this.syncAllTenantPlans();
      } catch (e) {
        console.error('[QuotaSync] Periodic sync error:', e.message);
      }
    }, SYNC_INTERVAL);
    this._quotaSyncTimer.unref();
    console.log('[QuotaSync] Periodic sync started (every 10 min)');
  }

  // ==================== UTILITY ====================

  /**
   * Health check
   */
  async health() {
    try {
      await this.init();
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.config.spreadsheetId
      });
      return {
        status: 'ok',
        spreadsheetId: this.config.spreadsheetId,
        title: response.data.properties.title,
        sheets: response.data.sheets.map(s => s.properties.title)
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Get spreadsheet URL
   */
  getUrl() {
    return this.config?.url || null;
  }
}

// Singleton instance
let instance = null;

/**
 * Get database instance (singleton)
 */
function getDB() {
  if (!instance) {
    instance = new GoogleSheetsDB();
  }
  return instance;
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const cmd = args[0];

  (async () => {
    const db = getDB();

    switch (cmd) {
      case '--health':
        const health = await db.health();
        console.log(JSON.stringify(health, null, 2));
        break;

      case '--test':
        console.log('Testing CRUD operations...\n');

        // Create
        const tenant = await db.create('tenants', {
          name: 'Test Company',
          email: 'test@example.com',
          plan: 'pro',
          mrr: 99
        });
        console.log('Created:', tenant);

        // Read
        const found = await db.findById('tenants', tenant.id);
        console.log('Found:', found);

        // Update
        const updated = await db.update('tenants', tenant.id, { mrr: 199 });
        console.log('Updated:', updated);

        // Delete
        await db.delete('tenants', tenant.id);
        console.log('Deleted');

        // Log
        await db.log('info', 'Test completed', { test: true });
        console.log('\n✅ All tests passed!');
        break;

      default:
        console.log(`
GoogleSheetsDB - VocalIA Database

Usage:
  node GoogleSheetsDB.cjs --health    Check connection
  node GoogleSheetsDB.cjs --test      Run CRUD tests

Programmatic:
  const { getDB } = require('./GoogleSheetsDB.cjs');
  const db = getDB();
  await db.create('tenants', { name: 'Acme', email: 'a@b.com' });
`);
    }
  })().catch(e => console.error('❌', e.message));
}

module.exports = { GoogleSheetsDB, getDB, SCHEMAS, columnLetter, sheetRange };
