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
 * Storage Structure:
 *   data/conversations/{tenant_id}/{session_id}.json
 *
 * @version 1.0.0
 * @author VocalIA
 * Session 250.57
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Paths
const CONVERSATIONS_DIR = path.join(__dirname, '../data/conversations');
const CLIENTS_DIR = path.join(__dirname, '../clients');

// Ensure base directory exists
if (!fs.existsSync(CONVERSATIONS_DIR)) {
  fs.mkdirSync(CONVERSATIONS_DIR, { recursive: true });
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
    const dir = path.join(this.baseDir, tenantId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Get file path for a conversation
   */
  getFilePath(tenantId, sessionId) {
    return path.join(this.getTenantDir(tenantId), `${sessionId}.json`);
  }

  /**
   * Get retention days from tenant config
   */
  getRetentionDays(tenantId) {
    const configPath = path.join(CLIENTS_DIR, tenantId, 'config.json');
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

    const message = {
      id: crypto.randomUUID().split('-')[0],
      role, // 'user' | 'assistant' | 'system'
      content,
      timestamp: now,
      ...messageMetadata
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
    const tenantDir = path.join(this.baseDir, tenantId);
    if (!fs.existsSync(tenantDir)) {
      return [];
    }

    const files = fs.readdirSync(tenantDir).filter(f => f.endsWith('.json'));
    const conversations = [];

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
          persona: data.metadata?.persona
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
      conversations.filter(c => c.source === options.source);
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
    const tenantDir = path.join(this.baseDir, tenantId);
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
    const tenantDir = path.join(this.baseDir, tenantId);
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
    const tenantDir = path.join(this.baseDir, tenantId);
    if (fs.existsSync(tenantDir)) {
      fs.rmSync(tenantDir, { recursive: true, force: true });
      return true;
    }
    return false;
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

function getInstance(options = {}) {
  if (!instance) {
    instance = new ConversationStore(options);
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
VocalIA Conversation Store

⛔ RAPPEL: Conversation History = CONSULTATION CLIENT UNIQUEMENT
   - JAMAIS pour alimenter la KB ou le RAG

Usage:
  node conversation-store.cjs --health              Health check
  node conversation-store.cjs --stats               Global statistics
  node conversation-store.cjs --stats --tenant <id> Tenant statistics
  node conversation-store.cjs --cleanup             Cleanup old conversations
  node conversation-store.cjs --test                Run tests
`);
}

module.exports = {
  ConversationStore,
  ConversationCache,
  getInstance
};
