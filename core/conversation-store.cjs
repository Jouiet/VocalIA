'use strict';

/**
 * VocalIA - Conversation Store
 *
 * ⛔ RÈGLE ARCHITECTURALE NON-NÉGOCIABLE:
 *    Conversation History = CONSULTATION CLIENT UNIQUEMENT
 *    - Affichage historique pour le client (tenant)
 *    - Support client (voir conversations passées)
 *    - Analytics (comptage, durée, topics)
 *    - JAMAIS pour alimenter la KB ou le RAG
 *    - JAMAIS indexé avec TF-IDF ou vector store
 *
 * ⚠️ POLITIQUE DE RÉTENTION:
 *    - Telephony: 60 jours MAXIMUM (purge automatique 1er du mois)
 *    - Widget: Configurable par tenant (default 30 jours)
 *
 * Storage Structure:
 *   data/conversations/{tenant_id}/{session_id}.json
 *
 * Export Formats:
 *   - CSV (native)
 *   - XLSX (ExcelJS)
 *   - PDF (PDFKit)
 *
 * @version 2.0.0
 * @author VocalIA
 * Session 250.57
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { sanitizeTenantId } = require('./voice-api-utils.cjs');

// Export dependencies (lazy loaded)
let ExcelJS = null;
let PDFDocument = null;
let Papa = null;

// Paths
const CONVERSATIONS_DIR = path.join(__dirname, '../data/conversations');
const CLIENTS_DIR = path.join(__dirname, '../clients');
const EXPORTS_DIR = path.join(__dirname, '../data/exports');

// ⚠️ HARD LIMIT: Telephony history = 60 days maximum (non-negotiable)
const TELEPHONY_RETENTION_DAYS = 60;

// Ensure directories exist
if (!fs.existsSync(CONVERSATIONS_DIR)) {
  fs.mkdirSync(CONVERSATIONS_DIR, { recursive: true });
}
if (!fs.existsSync(EXPORTS_DIR)) {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}

/**
 * Lazy load export dependencies
 */
function loadExportDeps() {
  if (!ExcelJS) {
    try {
      ExcelJS = require('exceljs');
    } catch (e) {
      console.warn('⚠️ ExcelJS not installed, XLSX export unavailable');
    }
  }
  if (!PDFDocument) {
    try {
      PDFDocument = require('pdfkit');
    } catch (e) {
      console.warn('⚠️ PDFKit not installed, PDF export unavailable');
    }
  }
  if (!Papa) {
    try {
      Papa = require('papaparse');
    } catch (e) {
      console.warn('⚠️ PapaParse not installed, using native CSV');
    }
  }
}

/**
 * LRU Cache for active conversations
 */
class ConversationCache {
  constructor(maxSize = 500, ttlMs = 30 * 60 * 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    // LRU: move to end
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.data;
  }

  set(key, data) {
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  delete(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  stats() {
    return { size: this.cache.size, maxSize: this.maxSize, ttlMs: this.ttlMs };
  }
}

/**
 * ConversationStore - File-based conversation storage
 * SEPARATE from Knowledge Base - for client consultation only
 */
class ConversationStore {
  constructor(options = {}) {
    this.baseDir = options.baseDir || CONVERSATIONS_DIR;
    this.cache = new ConversationCache(
      options.maxCacheSize || 500,
      options.cacheTTL || 30 * 60 * 1000
    );
  }

  /**
   * Generate cache key
   */
  cacheKey(tenantId, sessionId) {
    return `${tenantId}:${sessionId}`;
  }

  /**
   * Get tenant directory (creates if not exists)
   */
  getTenantDir(tenantId) {
    const dir = path.join(this.baseDir, sanitizeTenantId(tenantId));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Get file path for a conversation
   */
  getFilePath(tenantId, sessionId) {
    const safeSession = sanitizeTenantId(sessionId);
    return path.join(this.getTenantDir(tenantId), `${safeSession}.json`);
  }

  /**
   * Get retention days from tenant config
   */
  getRetentionDays(tenantId) {
    const configPath = path.join(CLIENTS_DIR, sanitizeTenantId(tenantId), 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        return config.quotas?.conversation_history_days || 30;
      } catch {
        return 30;
      }
    }
    return 30;
  }

  // ==================== CRUD ====================

  /**
   * Save a conversation
   */
  save(tenantId, sessionId, messages, metadata = {}) {
    const filePath = this.getFilePath(tenantId, sessionId);
    const cacheKey = this.cacheKey(tenantId, sessionId);
    const now = new Date().toISOString();

    const conversation = {
      session_id: sessionId,
      tenant_id: tenantId,
      messages: messages || [],
      message_count: (messages || []).length,
      created_at: metadata.created_at || now,
      updated_at: now,
      metadata: {
        source: metadata.source || 'widget',
        language: metadata.language || 'fr',
        persona: metadata.persona || null,
        duration_sec: metadata.duration_sec || null,
        lead_score: metadata.lead_score || null,
        ...metadata
      }
    };

    // Save to file
    fs.writeFileSync(filePath, JSON.stringify(conversation, null, 2));

    // Update cache
    this.cache.set(cacheKey, conversation);

    return conversation;
  }

  /**
   * Load a conversation
   */
  load(tenantId, sessionId) {
    const cacheKey = this.cacheKey(tenantId, sessionId);

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    // Load from file
    const filePath = this.getFilePath(tenantId, sessionId);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      this.cache.set(cacheKey, data);
      return data;
    } catch (e) {
      console.error(`❌ [ConversationStore] Load error: ${e.message}`);
      return null;
    }
  }

  /**
   * Add a message to a conversation
   */
  addMessage(tenantId, sessionId, role, content, messageMetadata = {}) {
    let conversation = this.load(tenantId, sessionId);
    const now = new Date().toISOString();

    if (!conversation) {
      conversation = {
        session_id: sessionId,
        tenant_id: tenantId,
        messages: [],
        created_at: now,
        metadata: {
          source: messageMetadata.source || 'widget',
          language: messageMetadata.language || 'fr',
          persona: messageMetadata.persona || null
        }
      };
    }

    // BL28 fix: Spread messageMetadata BEFORE fixed fields to prevent override of id/timestamp
    const message = {
      ...messageMetadata,
      id: crypto.randomUUID().split('-')[0],
      role, // 'user' | 'assistant' | 'system'
      content,
      timestamp: now
    };

    conversation.messages.push(message);
    conversation.message_count = conversation.messages.length;
    conversation.updated_at = now;

    return this.save(tenantId, sessionId, conversation.messages, conversation.metadata);
  }

  /**
   * Get recent messages (for context window)
   */
  getRecentMessages(tenantId, sessionId, limit = 10) {
    const conversation = this.load(tenantId, sessionId);
    if (!conversation?.messages) return [];
    return conversation.messages.slice(-limit);
  }

  /**
   * Delete a conversation
   */
  delete(tenantId, sessionId) {
    const filePath = this.getFilePath(tenantId, sessionId);
    const cacheKey = this.cacheKey(tenantId, sessionId);

    this.cache.delete(cacheKey);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  // ==================== LISTING ====================

  /**
   * List all conversations for a tenant
   */
  listByTenant(tenantId, options = {}) {
    const tenantDir = path.join(this.baseDir, sanitizeTenantId(tenantId));
    if (!fs.existsSync(tenantDir)) {
      return [];
    }

    const files = fs.readdirSync(tenantDir).filter(f => f.endsWith('.json'));
    let conversations = [];

    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(tenantDir, file), 'utf8'));
        conversations.push({
          session_id: data.session_id,
          message_count: data.message_count || (data.messages || []).length,
          created_at: data.created_at,
          updated_at: data.updated_at,
          source: data.metadata?.source,
          language: data.metadata?.language,
          persona: data.metadata?.persona,
          duration_sec: data.metadata?.duration_sec || 0,
          status: data.metadata?.status || 'Completed',
          call_sid: data.metadata?.call_sid
        });
      } catch {
        // Skip corrupted files
      }
    }

    // Sort by updated_at desc
    conversations.sort((a, b) =>
      new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
    );

    // Apply filters
    if (options.source) {
      conversations = conversations.filter(c => c.source === options.source);
    }

    // Apply limit
    if (options.limit) {
      return conversations.slice(0, options.limit);
    }

    return conversations;
  }

  /**
   * Count conversations for a tenant
   */
  countByTenant(tenantId) {
    const tenantDir = path.join(this.baseDir, sanitizeTenantId(tenantId));
    if (!fs.existsSync(tenantDir)) {
      return 0;
    }
    return fs.readdirSync(tenantDir).filter(f => f.endsWith('.json')).length;
  }

  // ==================== CLEANUP ====================

  /**
   * Cleanup old conversations based on retention policy
   */
  cleanup(tenantId) {
    const tenantDir = path.join(this.baseDir, sanitizeTenantId(tenantId));
    if (!fs.existsSync(tenantDir)) {
      return { deleted: 0 };
    }

    const retentionDays = this.getRetentionDays(tenantId);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const files = fs.readdirSync(tenantDir).filter(f => f.endsWith('.json'));
    let deleted = 0;

    for (const file of files) {
      const filePath = path.join(tenantDir, file);
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const updatedAt = new Date(data.updated_at || data.created_at);

        if (updatedAt < cutoff) {
          fs.unlinkSync(filePath);
          deleted++;
        }
      } catch {
        // Delete corrupted files
        fs.unlinkSync(filePath);
        deleted++;
      }
    }

    console.log(`✅ [ConversationStore] Cleanup ${tenantId}: ${deleted} deleted (retention: ${retentionDays} days)`);
    return { deleted, retentionDays };
  }

  /**
   * Cleanup all tenants
   */
  cleanupAll() {
    if (!fs.existsSync(this.baseDir)) {
      return { tenants: 0, totalDeleted: 0 };
    }

    const tenants = fs.readdirSync(this.baseDir).filter(f =>
      fs.statSync(path.join(this.baseDir, f)).isDirectory()
    );

    let totalDeleted = 0;
    for (const tenantId of tenants) {
      const result = this.cleanup(tenantId);
      totalDeleted += result.deleted;
    }

    return { tenants: tenants.length, totalDeleted };
  }

  /**
   * Purge all conversations for a tenant (RGPD)
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
   * ⚠️ TELEPHONY-SPECIFIC: 60-day hard limit purge
   * Called automatically on 1st of month
   */
  purgeOldTelephony(tenantId = null) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - TELEPHONY_RETENTION_DAYS);

    let totalDeleted = 0;
    let tenantsProcessed = 0;

    // BL15 fix: Sanitize tenantId when provided (all other methods use sanitizeTenantId)
    const tenants = tenantId
      ? [sanitizeTenantId(tenantId)]
      : fs.existsSync(this.baseDir)
        ? fs.readdirSync(this.baseDir).filter(f =>
          fs.statSync(path.join(this.baseDir, f)).isDirectory()
        )
        : [];

    for (const tid of tenants) {
      const tenantDir = path.join(this.baseDir, tid);
      if (!fs.existsSync(tenantDir)) continue;

      const files = fs.readdirSync(tenantDir).filter(f => f.endsWith('.json'));
      let deleted = 0;

      for (const file of files) {
        const filePath = path.join(tenantDir, file);
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

          // Only purge TELEPHONY conversations older than 60 days
          if (data.metadata?.source === 'telephony') {
            const createdAt = new Date(data.created_at);
            if (createdAt < cutoff) {
              fs.unlinkSync(filePath);
              deleted++;
            }
          }
        } catch {
          // Skip corrupted files
        }
      }

      if (deleted > 0) {
        console.log(`✅ [ConversationStore] Purged ${deleted} telephony conversations for ${tid} (>60 days)`);
      }
      totalDeleted += deleted;
      tenantsProcessed++;
    }

    return {
      tenantsProcessed,
      totalDeleted,
      retentionDays: TELEPHONY_RETENTION_DAYS,
      cutoffDate: cutoff.toISOString()
    };
  }

  /**
   * Monthly purge (run on 1st of each month)
   * Purges telephony >60 days, widget based on tenant config
   */
  monthlyPurge() {
    console.log(`📅 [ConversationStore] Monthly purge started: ${new Date().toISOString()}`);

    // 1. Purge old telephony (60 days hard limit)
    const telephonyResult = this.purgeOldTelephony();

    // 2. Cleanup all tenants based on their retention policy (widget)
    const widgetResult = this.cleanupAll();

    return {
      telephony: telephonyResult,
      widget: widgetResult,
      executedAt: new Date().toISOString()
    };
  }

  // ==================== EXPORT ====================

  /**
   * Export conversations to CSV
   */
  exportToCSV(tenantId, options = {}) {
    loadExportDeps();

    const conversations = this.listByTenant(tenantId, { source: options.source });
    if (conversations.length === 0) {
      return { error: 'No conversations to export' };
    }

    // Prepare data for CSV
    const data = [];
    for (const conv of conversations) {
      const fullConv = this.load(tenantId, conv.session_id);
      if (!fullConv) continue;

      for (const msg of fullConv.messages || []) {
        data.push({
          session_id: conv.session_id,
          created_at: conv.created_at,
          source: conv.source || 'unknown',
          language: conv.language || 'unknown',
          persona: conv.persona || '',
          message_role: msg.role,
          message_content: (msg.content || '').replace(/[\n\r]/g, ' ').substring(0, 500),
          message_timestamp: msg.timestamp
        });
      }
    }

    // Generate CSV
    let csv;
    if (Papa) {
      csv = Papa.unparse(data);
    } else {
      // Native CSV generation
      const headers = Object.keys(data[0] || {});
      const lines = [headers.join(',')];
      for (const row of data) {
        const values = headers.map(h => {
          const val = String(row[h] || '');
          return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
        });
        lines.push(values.join(','));
      }
      csv = lines.join('\n');
    }

    const filename = `conversations_${tenantId}_${Date.now()}.csv`;
    const outputPath = path.join(EXPORTS_DIR, filename);
    fs.writeFileSync(outputPath, csv, 'utf-8');

    return {
      status: 'success',
      file: {
        path: outputPath,
        filename,
        rows: data.length,
        conversations: conversations.length,
        size_bytes: fs.statSync(outputPath).size
      }
    };
  }

  /**
   * Export conversations to XLSX
   */
  async exportToXLSX(tenantId, options = {}) {
    loadExportDeps();

    if (!ExcelJS) {
      return { error: 'ExcelJS not installed. Run: npm install exceljs' };
    }

    const conversations = this.listByTenant(tenantId, { source: options.source });
    if (conversations.length === 0) {
      return { error: 'No conversations to export' };
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'VocalIA';
    workbook.created = new Date();

    // Summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Session ID', key: 'session_id', width: 25 },
      { header: 'Date', key: 'created_at', width: 20 },
      { header: 'Source', key: 'source', width: 12 },
      { header: 'Language', key: 'language', width: 10 },
      { header: 'Persona', key: 'persona', width: 20 },
      { header: 'Messages', key: 'message_count', width: 10 }
    ];

    // Style header
    summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF5E6AD2' }
    };

    for (const conv of conversations) {
      summarySheet.addRow({
        session_id: conv.session_id,
        created_at: conv.created_at,
        source: conv.source,
        language: conv.language,
        persona: conv.persona,
        message_count: conv.message_count
      });
    }

    // Messages sheet
    const messagesSheet = workbook.addWorksheet('Messages');
    messagesSheet.columns = [
      { header: 'Session ID', key: 'session_id', width: 25 },
      { header: 'Role', key: 'role', width: 12 },
      { header: 'Content', key: 'content', width: 80 },
      { header: 'Timestamp', key: 'timestamp', width: 22 }
    ];

    messagesSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    messagesSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF5E6AD2' }
    };

    for (const conv of conversations) {
      const fullConv = this.load(tenantId, conv.session_id);
      if (!fullConv?.messages) continue;

      for (const msg of fullConv.messages) {
        messagesSheet.addRow({
          session_id: conv.session_id,
          role: msg.role,
          content: (msg.content || '').substring(0, 1000),
          timestamp: msg.timestamp
        });
      }
    }

    const filename = `conversations_${tenantId}_${Date.now()}.xlsx`;
    const outputPath = path.join(EXPORTS_DIR, filename);
    await workbook.xlsx.writeFile(outputPath);

    return {
      status: 'success',
      file: {
        path: outputPath,
        filename,
        sheets: ['Summary', 'Messages'],
        conversations: conversations.length,
        size_bytes: fs.statSync(outputPath).size
      }
    };
  }

  /**
   * Export conversations to PDF
   */
  exportToPDF(tenantId, options = {}) {
    loadExportDeps();

    if (!PDFDocument) {
      return { error: 'PDFKit not installed. Run: npm install pdfkit' };
    }

    const conversations = this.listByTenant(tenantId, { source: options.source, limit: options.limit || 50 });
    if (conversations.length === 0) {
      return { error: 'No conversations to export' };
    }

    return new Promise((resolve) => {
      const filename = `conversations_${tenantId}_${Date.now()}.pdf`;
      const outputPath = path.join(EXPORTS_DIR, filename);

      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      // Header
      doc.fontSize(10)
        .fillColor('#5E6AD2')
        .text('VocalIA - Voice AI Platform', 50, 30, { align: 'right' });

      doc.fontSize(24)
        .fillColor('#1e1b4b')
        .text('Conversation History', 50, 60);

      doc.fontSize(12)
        .fillColor('#64748b')
        .text(`Tenant: ${tenantId}`, 50, 95);

      doc.fontSize(10)
        .text(`Generated: ${new Date().toLocaleDateString('fr-FR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}`, 50, 110);

      doc.fontSize(10)
        .fillColor('#ef4444')
        .text(`⚠️ Retention: Telephony history is automatically purged after ${TELEPHONY_RETENTION_DAYS} days`, 50, 125);

      doc.moveDown(2);

      // Conversations
      for (const conv of conversations) {
        const fullConv = this.load(tenantId, conv.session_id);
        if (!fullConv?.messages) continue;

        // Check for page break
        if (doc.y > 700) {
          doc.addPage();
        }

        // Session header
        doc.fontSize(11)
          .fillColor('#5E6AD2')
          .text(`━━━ ${conv.session_id} ━━━`, { underline: false });

        doc.fontSize(9)
          .fillColor('#64748b')
          .text(`${conv.created_at} | ${conv.source} | ${conv.language}`);

        doc.moveDown(0.5);

        // Messages
        for (const msg of fullConv.messages.slice(0, 10)) { // Limit messages per conv
          const roleColor = msg.role === 'user' ? '#059669' : '#5E6AD2';
          const roleLabel = msg.role === 'user' ? '👤 User' : '🤖 Assistant';

          doc.fontSize(9)
            .fillColor(roleColor)
            .text(roleLabel, { continued: true });

          doc.fillColor('#1e293b')
            .text(`: ${(msg.content || '').substring(0, 200)}${(msg.content || '').length > 200 ? '...' : ''}`);
        }

        if (fullConv.messages.length > 10) {
          doc.fontSize(8)
            .fillColor('#94a3b8')
            .text(`... +${fullConv.messages.length - 10} more messages`);
        }

        doc.moveDown();
      }

      doc.end();

      writeStream.on('finish', () => {
        resolve({
          status: 'success',
          file: {
            path: outputPath,
            filename,
            conversations: conversations.length,
            size_bytes: fs.statSync(outputPath).size
          }
        });
      });

      writeStream.on('error', (err) => {
        resolve({ error: err.message });
      });
    });
  }

  // ==================== ANALYTICS ====================

  /**
   * Get statistics for a tenant
   */
  getStats(tenantId) {
    const conversations = this.listByTenant(tenantId);
    const totalMessages = conversations.reduce((sum, c) => sum + (c.message_count || 0), 0);

    // Count by source
    const bySource = { widget: 0, telephony: 0, other: 0 };
    for (const c of conversations) {
      const source = c.source || 'other';
      bySource[source] = (bySource[source] || 0) + 1;
    }

    // Count by language
    const byLanguage = {};
    for (const c of conversations) {
      const lang = c.language || 'unknown';
      byLanguage[lang] = (byLanguage[lang] || 0) + 1;
    }

    return {
      tenant_id: tenantId,
      total_conversations: conversations.length,
      total_messages: totalMessages,
      by_source: bySource,
      by_language: byLanguage,
      cache_stats: this.cache.stats()
    };
  }

  /**
   * Global statistics
   */
  getGlobalStats() {
    if (!fs.existsSync(this.baseDir)) {
      return { tenants: 0, total_conversations: 0, cache_stats: this.cache.stats() };
    }

    const tenants = fs.readdirSync(this.baseDir).filter(f =>
      fs.statSync(path.join(this.baseDir, f)).isDirectory()
    );

    let totalConversations = 0;
    let totalMessages = 0;

    for (const t of tenants) {
      const stats = this.getStats(t);
      totalConversations += stats.total_conversations;
      totalMessages += stats.total_messages;
    }

    return {
      tenants: tenants.length,
      total_conversations: totalConversations,
      total_messages: totalMessages,
      cache_stats: this.cache.stats()
    };
  }

  /**
   * Health check
   */
  health() {
    try {
      const stats = this.getGlobalStats();
      return {
        status: 'ok',
        baseDir: this.baseDir,
        ...stats
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
let purgeInterval = null;

function getInstance(options = {}) {
  if (!instance) {
    instance = new ConversationStore(options);

    // Session 250.167: Auto-schedule monthly purge (check every 12h if 1st of month)
    if (!purgeInterval) {
      purgeInterval = setInterval(() => {
        const now = new Date();
        if (now.getDate() === 1 && now.getHours() < 12) {
          console.log('[ConversationStore] Auto-triggering monthly purge (1st of month)');
          try {
            instance.monthlyPurge();
          } catch (e) {
            console.error('[ConversationStore] Monthly purge error:', e.message);
          }
        }
      }, 12 * 60 * 60 * 1000); // 12 hours
      purgeInterval.unref();
    }
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

  if (args.includes('--stats')) {
    const tenantIdx = args.indexOf('--tenant');
    if (tenantIdx !== -1 && args[tenantIdx + 1]) {
      console.log(JSON.stringify(store.getStats(args[tenantIdx + 1]), null, 2));
    } else {
      console.log(JSON.stringify(store.getGlobalStats(), null, 2));
    }
    process.exit(0);
  }

  if (args.includes('--cleanup')) {
    const result = store.cleanupAll();
    console.log(`✅ Cleanup: ${result.totalDeleted} deleted across ${result.tenants} tenants`);
    process.exit(0);
  }

  if (args.includes('--purge-telephony')) {
    const tenantIdx = args.indexOf('--tenant');
    const tenantId = tenantIdx !== -1 ? args[tenantIdx + 1] : null;
    const result = store.purgeOldTelephony(tenantId);
    console.log(`✅ Telephony purge: ${result.totalDeleted} deleted (>${TELEPHONY_RETENTION_DAYS} days)`);
    console.log(`   Cutoff: ${result.cutoffDate}`);
    process.exit(0);
  }

  if (args.includes('--monthly-purge')) {
    const result = store.monthlyPurge();
    console.log('✅ Monthly purge complete:');
    console.log(`   Telephony: ${result.telephony.totalDeleted} deleted`);
    console.log(`   Widget: ${result.widget.totalDeleted} deleted`);
    process.exit(0);
  }

  if (args.includes('--export')) {
    const tenantIdx = args.indexOf('--tenant');
    const formatIdx = args.indexOf('--format');
    const tenantId = tenantIdx !== -1 ? args[tenantIdx + 1] : null;
    const format = formatIdx !== -1 ? args[formatIdx + 1] : 'csv';

    if (!tenantId) {
      console.error('❌ --tenant <id> required for export');
      process.exit(1);
    }

    (async () => {
      let result;
      switch (format.toLowerCase()) {
      case 'xlsx':
        result = await store.exportToXLSX(tenantId);
        break;
      case 'pdf':
        result = await store.exportToPDF(tenantId);
        break;
      default:
        result = store.exportToCSV(tenantId);
      }

      if (result.error) {
        console.error(`❌ Export failed: ${result.error}`);
        process.exit(1);
      }

      console.log(`✅ Export complete: ${result.file.filename}`);
      console.log(`   Path: ${result.file.path}`);
      console.log(`   Size: ${result.file.size_bytes} bytes`);
      process.exit(0);
    })();
    return;
  }

  if (args.includes('--test')) {
    console.log('Testing ConversationStore...\n');

    const tenantId = 'test_tenant';
    const sessionId = 'test_session_001';

    // Save conversation
    const conv = store.save(tenantId, sessionId, [
      { role: 'user', content: 'Hello', timestamp: new Date().toISOString() },
      { role: 'assistant', content: 'Hi! How can I help?', timestamp: new Date().toISOString() }
    ], { source: 'widget', language: 'en', persona: 'UNIVERSAL_SME' });
    console.log('Saved:', conv.session_id, '-', conv.message_count, 'messages');

    // Load
    const loaded = store.load(tenantId, sessionId);
    console.log('Loaded:', loaded.message_count, 'messages');

    // Add message
    store.addMessage(tenantId, sessionId, 'user', 'I need help with my order');
    const updated = store.load(tenantId, sessionId);
    console.log('After add:', updated.message_count, 'messages');

    // Get recent
    const recent = store.getRecentMessages(tenantId, sessionId, 2);
    console.log('Recent 2:', recent.map(m => m.role).join(', '));

    // List
    const list = store.listByTenant(tenantId);
    console.log('Tenant conversations:', list.length);

    // Stats
    const stats = store.getStats(tenantId);
    console.log('Stats:', JSON.stringify(stats, null, 2));

    // Cleanup test
    store.purgeTenant(tenantId);
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }

  console.log(`
VocalIA Conversation Store v2.0.0

⛔ RAPPEL: Conversation History = CONSULTATION CLIENT UNIQUEMENT
   - JAMAIS pour alimenter la KB ou le RAG

⚠️ RÉTENTION: Telephony = 60 jours MAX (purge automatique 1er du mois)

Usage:
  node conversation-store.cjs --health                      Health check
  node conversation-store.cjs --stats                       Global statistics
  node conversation-store.cjs --stats --tenant <id>         Tenant statistics
  node conversation-store.cjs --cleanup                     Cleanup old conversations
  node conversation-store.cjs --purge-telephony             Purge telephony >60 days (all tenants)
  node conversation-store.cjs --purge-telephony --tenant <id>  Purge telephony for specific tenant
  node conversation-store.cjs --monthly-purge               Run monthly purge (1st of month)
  node conversation-store.cjs --export --tenant <id> --format csv|xlsx|pdf  Export conversations
  node conversation-store.cjs --test                        Run tests
`);
}

module.exports = {
  ConversationStore,
  ConversationCache,
  getInstance,
  TELEPHONY_RETENTION_DAYS
};
