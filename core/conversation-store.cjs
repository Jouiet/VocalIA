'use strict';

/**
 * VocalIA - Conversation Store
 *
 * Persistent conversation storage for Voice Widget and Telephony.
 * Stores conversation history per session_id + tenant_id.
 *
 * Features:
 * - File-based storage (fast, no external deps)
 * - LRU cache for hot conversations
 * - Automatic cleanup of old conversations
 * - Export to JSON for analytics
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
const DATA_DIR = path.join(__dirname, '../data/conversations');
const CLIENTS_DIR = path.join(__dirname, '../clients');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * LRU Cache for hot conversations
 */
class ConversationCache {
  constructor(maxSize = 500, ttlMs = 30 * 60 * 1000) { // 30 min TTL
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

    // Move to end (most recently used)
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
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs
    };
  }
}

/**
 * ConversationStore - Persistent conversation storage
 */
class ConversationStore {
  constructor(options = {}) {
    this.cache = new ConversationCache(
      options.maxCacheSize || 500,
      options.cacheTTL || 30 * 60 * 1000
    );
    this.dataDir = options.dataDir || DATA_DIR;
  }

  /**
   * Generate cache key
   */
  cacheKey(tenantId, sessionId) {
    return `${tenantId}:${sessionId}`;
  }

  /**
   * Get file path for conversation
   */
  getFilePath(tenantId, sessionId) {
    const tenantDir = path.join(this.dataDir, tenantId);
    if (!fs.existsSync(tenantDir)) {
      fs.mkdirSync(tenantDir, { recursive: true });
    }
    return path.join(tenantDir, `${sessionId}.json`);
  }

  /**
   * Create or update a conversation
   */
  async save(tenantId, sessionId, messages, metadata = {}) {
    const filePath = this.getFilePath(tenantId, sessionId);
    const cacheKey = this.cacheKey(tenantId, sessionId);

    const conversation = {
      tenant_id: tenantId,
      session_id: sessionId,
      messages: messages || [],
      metadata: {
        ...metadata,
        updated_at: new Date().toISOString()
      },
      created_at: metadata.created_at || new Date().toISOString(),
      message_count: (messages || []).length
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
  async load(tenantId, sessionId) {
    const cacheKey = this.cacheKey(tenantId, sessionId);

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

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
   * Add a message to conversation
   */
  async addMessage(tenantId, sessionId, role, content, messageMetadata = {}) {
    let conversation = await this.load(tenantId, sessionId);

    if (!conversation) {
      conversation = {
        tenant_id: tenantId,
        session_id: sessionId,
        messages: [],
        metadata: {
          created_at: new Date().toISOString(),
          source: messageMetadata.source || 'widget',
          language: messageMetadata.language || 'fr',
          persona: messageMetadata.persona || null
        },
        created_at: new Date().toISOString()
      };
    }

    const message = {
      id: crypto.randomUUID().split('-')[0],
      role, // 'user' | 'assistant' | 'system'
      content,
      timestamp: new Date().toISOString(),
      ...messageMetadata
    };

    conversation.messages.push(message);
    conversation.message_count = conversation.messages.length;
    conversation.metadata.updated_at = new Date().toISOString();

    return await this.save(tenantId, sessionId, conversation.messages, conversation.metadata);
  }

  /**
   * Get recent messages (for context)
   */
  async getRecentMessages(tenantId, sessionId, limit = 10) {
    const conversation = await this.load(tenantId, sessionId);
    if (!conversation || !conversation.messages) {
      return [];
    }
    return conversation.messages.slice(-limit);
  }

  /**
   * Delete a conversation
   */
  async delete(tenantId, sessionId) {
    const filePath = this.getFilePath(tenantId, sessionId);
    const cacheKey = this.cacheKey(tenantId, sessionId);

    this.cache.delete(cacheKey);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  /**
   * List all conversations for a tenant
   */
  async listByTenant(tenantId, options = {}) {
    const tenantDir = path.join(this.dataDir, tenantId);
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
          updated_at: data.metadata?.updated_at,
          source: data.metadata?.source,
          language: data.metadata?.language
        });
      } catch (e) {
        // Skip corrupted files
      }
    }

    // Sort by updated_at desc
    conversations.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));

    // Apply limit
    if (options.limit) {
      return conversations.slice(0, options.limit);
    }

    return conversations;
  }

  /**
   * Cleanup old conversations
   */
  async cleanup(tenantId, maxAgeDays = 30) {
    const tenantDir = path.join(this.dataDir, tenantId);
    if (!fs.existsSync(tenantDir)) {
      return { deleted: 0 };
    }

    // Check tenant config for retention policy
    let retentionDays = maxAgeDays;
    const configPath = path.join(CLIENTS_DIR, tenantId, 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        retentionDays = config.quotas?.conversation_history_days || maxAgeDays;
      } catch (e) {
        // Use default
      }
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const files = fs.readdirSync(tenantDir).filter(f => f.endsWith('.json'));
    let deleted = 0;

    for (const file of files) {
      const filePath = path.join(tenantDir, file);
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const updatedAt = new Date(data.metadata?.updated_at || data.created_at);

        if (updatedAt < cutoff) {
          fs.unlinkSync(filePath);
          deleted++;
        }
      } catch (e) {
        // Delete corrupted files
        fs.unlinkSync(filePath);
        deleted++;
      }
    }

    console.log(`✅ [ConversationStore] Cleanup ${tenantId}: ${deleted} conversations deleted (retention: ${retentionDays} days)`);
    return { deleted, retentionDays };
  }

  /**
   * Cleanup all tenants
   */
  async cleanupAll() {
    if (!fs.existsSync(this.dataDir)) {
      return { tenants: 0, totalDeleted: 0 };
    }

    const tenants = fs.readdirSync(this.dataDir).filter(f =>
      fs.statSync(path.join(this.dataDir, f)).isDirectory()
    );

    let totalDeleted = 0;
    for (const tenantId of tenants) {
      const result = await this.cleanup(tenantId);
      totalDeleted += result.deleted;
    }

    return { tenants: tenants.length, totalDeleted };
  }

  /**
   * Export conversations for a tenant (for analytics)
   */
  async export(tenantId, options = {}) {
    const conversations = await this.listByTenant(tenantId);
    const fullData = [];

    for (const conv of conversations) {
      const full = await this.load(tenantId, conv.session_id);
      if (full) {
        fullData.push(full);
      }
    }

    if (options.format === 'csv') {
      return this.toCSV(fullData);
    }

    return fullData;
  }

  /**
   * Convert to CSV format
   */
  toCSV(conversations) {
    const rows = ['session_id,tenant_id,created_at,message_count,source,language'];

    for (const conv of conversations) {
      rows.push([
        conv.session_id,
        conv.tenant_id,
        conv.created_at,
        conv.message_count || 0,
        conv.metadata?.source || '',
        conv.metadata?.language || ''
      ].join(','));
    }

    return rows.join('\n');
  }

  /**
   * Get statistics
   */
  async stats(tenantId = null) {
    if (tenantId) {
      const conversations = await this.listByTenant(tenantId);
      return {
        tenant_id: tenantId,
        total_conversations: conversations.length,
        total_messages: conversations.reduce((sum, c) => sum + (c.message_count || 0), 0),
        cache_stats: this.cache.stats()
      };
    }

    // Global stats
    if (!fs.existsSync(this.dataDir)) {
      return { tenants: 0, total_conversations: 0, cache_stats: this.cache.stats() };
    }

    const tenants = fs.readdirSync(this.dataDir).filter(f =>
      fs.statSync(path.join(this.dataDir, f)).isDirectory()
    );

    let totalConversations = 0;
    let totalMessages = 0;

    for (const t of tenants) {
      const conversations = await this.listByTenant(t);
      totalConversations += conversations.length;
      totalMessages += conversations.reduce((sum, c) => sum + (c.message_count || 0), 0);
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
  async health() {
    try {
      const stats = await this.stats();
      return {
        status: 'ok',
        dataDir: this.dataDir,
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

// Singleton instance
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

  (async () => {
    const store = getInstance();

    if (args.includes('--health')) {
      const health = await store.health();
      console.log(JSON.stringify(health, null, 2));
      return;
    }

    if (args.includes('--stats')) {
      const tenantIdx = args.indexOf('--tenant');
      const tenantId = tenantIdx !== -1 ? args[tenantIdx + 1] : null;
      const stats = await store.stats(tenantId);
      console.log(JSON.stringify(stats, null, 2));
      return;
    }

    if (args.includes('--cleanup')) {
      const result = await store.cleanupAll();
      console.log(`✅ Cleanup complete: ${result.totalDeleted} conversations deleted across ${result.tenants} tenants`);
      return;
    }

    if (args.includes('--test')) {
      console.log('Testing ConversationStore...\n');

      // Test save
      const conv = await store.save('test_tenant', 'test_session_001', [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi! How can I help?' }
      ], { source: 'widget', language: 'en' });
      console.log('Saved:', conv.session_id);

      // Test load
      const loaded = await store.load('test_tenant', 'test_session_001');
      console.log('Loaded:', loaded.message_count, 'messages');

      // Test addMessage
      await store.addMessage('test_tenant', 'test_session_001', 'user', 'I need help with my order');
      const updated = await store.load('test_tenant', 'test_session_001');
      console.log('After add:', updated.message_count, 'messages');

      // Test list
      const list = await store.listByTenant('test_tenant');
      console.log('Tenant conversations:', list.length);

      // Test stats
      const stats = await store.stats('test_tenant');
      console.log('Stats:', stats);

      // Cleanup test data
      await store.delete('test_tenant', 'test_session_001');
      console.log('\n✅ All tests passed!');
      return;
    }

    console.log(`
VocalIA Conversation Store

Usage:
  node conversation-store.cjs --health      Health check
  node conversation-store.cjs --stats       Global statistics
  node conversation-store.cjs --stats --tenant <id>   Tenant statistics
  node conversation-store.cjs --cleanup     Cleanup old conversations
  node conversation-store.cjs --test        Run tests
`);
  })().catch(e => console.error('❌', e.message));
}

module.exports = {
  ConversationStore,
  ConversationCache,
  getInstance
};
