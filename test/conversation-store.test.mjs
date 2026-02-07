/**
 * VocalIA ConversationStore Tests
 *
 * Tests:
 * - TELEPHONY_RETENTION_DAYS constant
 * - ConversationCache constructor (maxSize, ttlMs)
 * - ConversationCache get/set (LRU, TTL expiry, eviction)
 * - ConversationCache delete/clear/stats
 * - ConversationStore constructor (baseDir, cache)
 * - ConversationStore cacheKey, getTenantDir, getFilePath
 * - ConversationStore save/load (with temp dir)
 * - ConversationStore addMessage, getRecentMessages
 * - ConversationStore delete, countByTenant
 * - ConversationStore listByTenant (filters, limit, sort)
 * - ConversationStore getStats, getGlobalStats, health
 * - ConversationStore cleanup, purgeTenant, getRetentionDays
 * - getInstance singleton
 *
 * NOTE: Tests with temp directories. Does NOT require running services.
 *
 * Run: node --test test/conversation-store.test.mjs
 */


import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ConversationStore, ConversationCache, getInstance, TELEPHONY_RETENTION_DAYS } from '../core/conversation-store.cjs';


// Helper: create temp dir
function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'vocalia-conv-'));
}
function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

// ─── TELEPHONY_RETENTION_DAYS ───────────────────────────────────

describe('ConversationStore TELEPHONY_RETENTION_DAYS', () => {
  test('is 60 days', () => {
    assert.strictEqual(TELEPHONY_RETENTION_DAYS, 60);
  });

  test('is a number', () => {
    assert.strictEqual(typeof TELEPHONY_RETENTION_DAYS, 'number');
  });
});

// ─── ConversationCache constructor ──────────────────────────────

describe('ConversationCache constructor', () => {
  test('creates with default maxSize 500', () => {
    const cache = new ConversationCache();
    const stats = cache.stats();
    assert.strictEqual(stats.maxSize, 500);
  });

  test('creates with default ttlMs 30 min', () => {
    const cache = new ConversationCache();
    assert.strictEqual(cache.stats().ttlMs, 30 * 60 * 1000);
  });

  test('accepts custom maxSize', () => {
    const cache = new ConversationCache(100);
    assert.strictEqual(cache.stats().maxSize, 100);
  });

  test('accepts custom ttlMs', () => {
    const cache = new ConversationCache(500, 60000);
    assert.strictEqual(cache.stats().ttlMs, 60000);
  });

  test('starts with size 0', () => {
    const cache = new ConversationCache();
    assert.strictEqual(cache.stats().size, 0);
  });
});

// ─── ConversationCache get/set ──────────────────────────────────

describe('ConversationCache get/set', () => {
  test('returns null for missing key', () => {
    const cache = new ConversationCache();
    assert.strictEqual(cache.get('nonexistent'), null);
  });

  test('stores and retrieves data', () => {
    const cache = new ConversationCache();
    cache.set('key1', { messages: ['hello'] });
    assert.deepStrictEqual(cache.get('key1'), { messages: ['hello'] });
  });

  test('increments size on set', () => {
    const cache = new ConversationCache();
    cache.set('a', 1);
    cache.set('b', 2);
    assert.strictEqual(cache.stats().size, 2);
  });

  test('evicts oldest when maxSize reached', () => {
    const cache = new ConversationCache(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4); // should evict 'a'
    assert.strictEqual(cache.get('a'), null);
    assert.strictEqual(cache.get('d'), 4);
    assert.strictEqual(cache.stats().size, 3);
  });

  test('TTL expiry returns null', () => {
    const cache = new ConversationCache(500, 1); // 1ms TTL
    cache.set('expire', 'data');
    const start = Date.now();
    while (Date.now() - start < 5) {} // busy-wait
    assert.strictEqual(cache.get('expire'), null);
  });

  test('LRU: accessing moves entry to most recent', () => {
    const cache = new ConversationCache(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.get('a'); // Access 'a' - now most recent
    cache.set('d', 4); // Should evict 'b' (oldest after 'a' was accessed)
    assert.strictEqual(cache.get('a'), 1); // Still present
    assert.strictEqual(cache.get('b'), null); // Evicted
  });
});

// ─── ConversationCache delete/clear/stats ───────────────────────

describe('ConversationCache delete/clear/stats', () => {
  test('delete removes entry', () => {
    const cache = new ConversationCache();
    cache.set('x', 1);
    cache.delete('x');
    assert.strictEqual(cache.get('x'), null);
    assert.strictEqual(cache.stats().size, 0);
  });

  test('clear removes all entries', () => {
    const cache = new ConversationCache();
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.clear();
    assert.strictEqual(cache.stats().size, 0);
  });

  test('stats returns size, maxSize, ttlMs', () => {
    const cache = new ConversationCache(200, 5000);
    const stats = cache.stats();
    assert.strictEqual(typeof stats.size, 'number');
    assert.strictEqual(stats.maxSize, 200);
    assert.strictEqual(stats.ttlMs, 5000);
  });
});

// ─── ConversationStore constructor ──────────────────────────────

describe('ConversationStore constructor', () => {
  test('creates with custom baseDir', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    assert.ok(store);
    cleanup(dir);
  });

  test('has cache', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    assert.ok(store.cache);
    cleanup(dir);
  });
});

// ─── ConversationStore cacheKey ─────────────────────────────────

describe('ConversationStore cacheKey', () => {
  test('returns tenantId:sessionId format', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    assert.strictEqual(store.cacheKey('t1', 's1'), 't1:s1');
    cleanup(dir);
  });
});

// ─── ConversationStore getFilePath ──────────────────────────────

describe('ConversationStore getFilePath', () => {
  test('returns path ending in .json', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    const fp = store.getFilePath('tenant1', 'session1');
    assert.ok(fp.endsWith('.json'));
    cleanup(dir);
  });

  test('includes tenant and session in path', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    const fp = store.getFilePath('tenant1', 'session1');
    assert.ok(fp.includes('tenant1'));
    assert.ok(fp.includes('session1'));
    cleanup(dir);
  });

  test('creates tenant directory if not exists', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    store.getFilePath('new-tenant', 'sess');
    assert.ok(fs.existsSync(path.join(dir, 'new-tenant')));
    cleanup(dir);
  });
});

// ─── ConversationStore save/load ────────────────────────────────

describe('ConversationStore save/load', () => {
  test('save creates file', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    store.save('t1', 's1', [{ role: 'user', content: 'Hello' }]);
    const fp = store.getFilePath('t1', 's1');
    assert.ok(fs.existsSync(fp));
    cleanup(dir);
  });

  test('load returns saved data', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    store.save('t1', 's1', [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Bonjour' }
    ], { source: 'widget' });
    const conv = store.load('t1', 's1');
    assert.strictEqual(conv.session_id, 's1');
    assert.strictEqual(conv.tenant_id, 't1');
    assert.strictEqual(conv.messages.length, 2);
    assert.strictEqual(conv.message_count, 2);
    cleanup(dir);
  });

  test('load returns null for nonexistent', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    const conv = store.load('t1', 'nonexistent');
    assert.strictEqual(conv, null);
    cleanup(dir);
  });

  test('save sets timestamps', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    store.save('t1', 's1', []);
    const conv = store.load('t1', 's1');
    assert.ok(conv.created_at);
    assert.ok(conv.updated_at);
    cleanup(dir);
  });
});

// ─── ConversationStore listByTenant ──────────────────────────────

describe('ConversationStore listByTenant', () => {
  test('returns empty for unknown tenant', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    const sessions = store.listByTenant('unknown-tenant');
    assert.deepStrictEqual(sessions, []);
    cleanup(dir);
  });

  test('lists saved sessions', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    store.save('t1', 'session-a', [{ role: 'user', content: 'A' }]);
    store.save('t1', 'session-b', [{ role: 'user', content: 'B' }]);
    const sessions = store.listByTenant('t1');
    assert.strictEqual(sessions.length, 2);
    cleanup(dir);
  });
});

// ─── ConversationStore getTenantDir ──────────────────────────────

describe('ConversationStore getTenantDir', () => {
  test('creates tenant directory', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    const tenantDir = store.getTenantDir('my-tenant');
    assert.ok(fs.existsSync(tenantDir));
    assert.ok(tenantDir.includes('my-tenant'));
    cleanup(dir);
  });

  test('returns same path on second call', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    const d1 = store.getTenantDir('t1');
    const d2 = store.getTenantDir('t1');
    assert.strictEqual(d1, d2);
    cleanup(dir);
  });
});

// ─── ConversationStore addMessage ───────────────────────────────

describe('ConversationStore addMessage', () => {
  test('creates conversation if not exists', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    store.addMessage('t1', 'new-sess', 'user', 'Hello');
    const conv = store.load('t1', 'new-sess');
    assert.ok(conv);
    assert.strictEqual(conv.messages.length, 1);
    assert.strictEqual(conv.messages[0].role, 'user');
    assert.strictEqual(conv.messages[0].content, 'Hello');
    cleanup(dir);
  });

  test('appends to existing conversation', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    store.save('t1', 's1', [{ role: 'user', content: 'First' }]);
    store.addMessage('t1', 's1', 'assistant', 'Response');
    const conv = store.load('t1', 's1');
    assert.strictEqual(conv.messages.length, 2);
    assert.strictEqual(conv.messages[1].content, 'Response');
    cleanup(dir);
  });

  test('message has id and timestamp', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    store.addMessage('t1', 's1', 'user', 'Test');
    const conv = store.load('t1', 's1');
    assert.ok(conv.messages[0].id);
    assert.ok(conv.messages[0].timestamp);
    cleanup(dir);
  });

  test('updates message_count', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    store.addMessage('t1', 's1', 'user', 'A');
    store.addMessage('t1', 's1', 'assistant', 'B');
    store.addMessage('t1', 's1', 'user', 'C');
    const conv = store.load('t1', 's1');
    assert.strictEqual(conv.message_count, 3);
    cleanup(dir);
  });
});

// ─── ConversationStore getRecentMessages ────────────────────────

describe('ConversationStore getRecentMessages', () => {
  test('returns last N messages', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    store.save('t1', 's1', [
      { role: 'user', content: 'A' },
      { role: 'assistant', content: 'B' },
      { role: 'user', content: 'C' },
      { role: 'assistant', content: 'D' }
    ]);
    const recent = store.getRecentMessages('t1', 's1', 2);
    assert.strictEqual(recent.length, 2);
    assert.strictEqual(recent[0].content, 'C');
    assert.strictEqual(recent[1].content, 'D');
    cleanup(dir);
  });

  test('returns all messages when limit > total', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    store.save('t1', 's1', [{ role: 'user', content: 'Only' }]);
    const recent = store.getRecentMessages('t1', 's1', 10);
    assert.strictEqual(recent.length, 1);
    cleanup(dir);
  });

  test('returns empty array for missing conversation', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    const recent = store.getRecentMessages('t1', 'nonexistent');
    assert.deepStrictEqual(recent, []);
    cleanup(dir);
  });

  test('default limit is 10', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    const msgs = Array.from({ length: 15 }, (_, i) => ({ role: 'user', content: `msg-${i}` }));
    store.save('t1', 's1', msgs);
    const recent = store.getRecentMessages('t1', 's1');
    assert.strictEqual(recent.length, 10);
    cleanup(dir);
  });
});

// ─── ConversationStore delete ───────────────────────────────────

describe('ConversationStore delete', () => {
  test('deletes existing conversation', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    store.save('t1', 's1', [{ role: 'user', content: 'Hi' }]);
    const result = store.delete('t1', 's1');
    assert.strictEqual(result, true);
    assert.strictEqual(store.load('t1', 's1'), null);
    cleanup(dir);
  });

  test('returns false for nonexistent conversation', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    store.getTenantDir('t1'); // Ensure dir exists
    const result = store.delete('t1', 'nonexistent');
    assert.strictEqual(result, false);
    cleanup(dir);
  });

  test('removes from cache', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    store.save('t1', 's1', [{ role: 'user', content: 'Hi' }]);
    store.load('t1', 's1'); // Populates cache
    store.delete('t1', 's1');
    // After deletion, load should return null (not from cache)
    assert.strictEqual(store.load('t1', 's1'), null);
    cleanup(dir);
  });
});

// ─── ConversationStore countByTenant ────────────────────────────

describe('ConversationStore countByTenant', () => {
  test('returns 0 for unknown tenant', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    assert.strictEqual(store.countByTenant('nonexistent'), 0);
    cleanup(dir);
  });

  test('counts saved conversations', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    store.save('t1', 's1', []);
    store.save('t1', 's2', []);
    store.save('t1', 's3', []);
    assert.strictEqual(store.countByTenant('t1'), 3);
    cleanup(dir);
  });

  test('counts only for specified tenant', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    store.save('t1', 's1', []);
    store.save('t2', 's2', []);
    assert.strictEqual(store.countByTenant('t1'), 1);
    assert.strictEqual(store.countByTenant('t2'), 1);
    cleanup(dir);
  });
});

// ─── ConversationStore getRetentionDays ─────────────────────────

describe('ConversationStore getRetentionDays', () => {
  test('returns 30 as default when no config', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    assert.strictEqual(store.getRetentionDays('no-config-tenant'), 30);
    cleanup(dir);
  });
});

// ─── ConversationStore getStats ─────────────────────────────────

describe('ConversationStore getStats', () => {
  test('returns stats for empty tenant', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    const stats = store.getStats('empty-tenant');
    assert.strictEqual(stats.tenant_id, 'empty-tenant');
    assert.strictEqual(stats.total_conversations, 0);
    assert.strictEqual(stats.total_messages, 0);
    cleanup(dir);
  });

  test('counts conversations and messages', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    store.save('t1', 's1', [
      { role: 'user', content: 'A' },
      { role: 'assistant', content: 'B' }
    ], { source: 'widget', language: 'fr' });
    store.save('t1', 's2', [
      { role: 'user', content: 'C' }
    ], { source: 'telephony', language: 'en' });
    const stats = store.getStats('t1');
    assert.strictEqual(stats.total_conversations, 2);
    assert.strictEqual(stats.total_messages, 3);
    cleanup(dir);
  });

  test('has by_source breakdown', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    store.save('t1', 's1', [], { source: 'widget' });
    store.save('t1', 's2', [], { source: 'telephony' });
    const stats = store.getStats('t1');
    assert.ok('by_source' in stats);
    assert.strictEqual(stats.by_source.widget, 1);
    assert.strictEqual(stats.by_source.telephony, 1);
    cleanup(dir);
  });

  test('has by_language breakdown', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    store.save('t1', 's1', [], { language: 'fr' });
    store.save('t1', 's2', [], { language: 'en' });
    const stats = store.getStats('t1');
    assert.ok('by_language' in stats);
    assert.strictEqual(stats.by_language.fr, 1);
    assert.strictEqual(stats.by_language.en, 1);
    cleanup(dir);
  });

  test('includes cache_stats', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    const stats = store.getStats('t1');
    assert.ok('cache_stats' in stats);
    cleanup(dir);
  });
});

// ─── ConversationStore getGlobalStats ───────────────────────────

describe('ConversationStore getGlobalStats', () => {
  test('returns zero stats for empty store', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    const stats = store.getGlobalStats();
    assert.strictEqual(stats.tenants, 0);
    assert.strictEqual(stats.total_conversations, 0);
    cleanup(dir);
  });

  test('aggregates across tenants', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    store.save('t1', 's1', [{ role: 'user', content: 'A' }]);
    store.save('t2', 's2', [{ role: 'user', content: 'B' }]);
    const stats = store.getGlobalStats();
    assert.strictEqual(stats.tenants, 2);
    assert.strictEqual(stats.total_conversations, 2);
    assert.strictEqual(stats.total_messages, 2);
    cleanup(dir);
  });

  test('includes cache_stats', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    const stats = store.getGlobalStats();
    assert.ok('cache_stats' in stats);
    cleanup(dir);
  });
});

// ─── ConversationStore health ───────────────────────────────────

describe('ConversationStore health', () => {
  test('returns status ok', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    const h = store.health();
    assert.strictEqual(h.status, 'ok');
    cleanup(dir);
  });

  test('includes baseDir', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    const h = store.health();
    assert.strictEqual(h.baseDir, dir);
    cleanup(dir);
  });

  test('includes tenant count', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    const h = store.health();
    assert.ok('tenants' in h);
    cleanup(dir);
  });
});

// ─── ConversationStore purgeTenant ──────────────────────────────

describe('ConversationStore purgeTenant', () => {
  test('removes all conversations for tenant', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    store.save('t1', 's1', []);
    store.save('t1', 's2', []);
    const result = store.purgeTenant('t1');
    assert.strictEqual(result, true);
    assert.strictEqual(store.countByTenant('t1'), 0);
    cleanup(dir);
  });

  test('returns false for nonexistent tenant', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    const result = store.purgeTenant('nonexistent');
    assert.strictEqual(result, false);
    cleanup(dir);
  });

  test('does not affect other tenants', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    store.save('t1', 's1', []);
    store.save('t2', 's2', []);
    store.purgeTenant('t1');
    assert.strictEqual(store.countByTenant('t2'), 1);
    cleanup(dir);
  });
});

// ─── ConversationStore cleanup ──────────────────────────────────

describe('ConversationStore cleanup', () => {
  test('returns deleted count for empty tenant', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    const result = store.cleanup('nonexistent');
    assert.strictEqual(result.deleted, 0);
    cleanup(dir);
  });

  test('keeps recent conversations', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    store.save('t1', 's1', [{ role: 'user', content: 'recent' }]);
    const result = store.cleanup('t1');
    assert.strictEqual(result.deleted, 0);
    assert.strictEqual(store.countByTenant('t1'), 1);
    cleanup(dir);
  });

  test('returns retentionDays when tenant exists', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    store.save('t1', 's1', [{ role: 'user', content: 'recent' }]);
    const result = store.cleanup('t1');
    assert.ok('retentionDays' in result);
    cleanup(dir);
  });
});

// ─── ConversationStore cleanupAll ───────────────────────────────

describe('ConversationStore cleanupAll', () => {
  test('returns zero for empty store', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    const result = store.cleanupAll();
    assert.strictEqual(result.tenants, 0);
    assert.strictEqual(result.totalDeleted, 0);
    cleanup(dir);
  });

  test('processes all tenants', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    store.save('t1', 's1', []);
    store.save('t2', 's2', []);
    const result = store.cleanupAll();
    assert.strictEqual(result.tenants, 2);
    cleanup(dir);
  });
});

// ─── ConversationStore purgeOldTelephony ────────────────────────

describe('ConversationStore purgeOldTelephony', () => {
  test('returns structure with tenantsProcessed and totalDeleted', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    const result = store.purgeOldTelephony();
    assert.ok('tenantsProcessed' in result);
    assert.ok('totalDeleted' in result);
    assert.ok('retentionDays' in result);
    assert.ok('cutoffDate' in result);
    assert.strictEqual(result.retentionDays, TELEPHONY_RETENTION_DAYS);
    cleanup(dir);
  });

  test('keeps recent telephony conversations', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    store.save('t1', 's1', [{ role: 'user', content: 'recent call' }], { source: 'telephony' });
    const result = store.purgeOldTelephony('t1');
    assert.strictEqual(result.totalDeleted, 0);
    cleanup(dir);
  });
});

// ─── ConversationStore monthlyPurge ─────────────────────────────

describe('ConversationStore monthlyPurge', () => {
  test('returns combined result', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    const result = store.monthlyPurge();
    assert.ok('telephony' in result);
    assert.ok('widget' in result);
    assert.ok('executedAt' in result);
    cleanup(dir);
  });
});

// ─── ConversationStore save metadata ────────────────────────────

describe('ConversationStore save metadata', () => {
  test('saves source in metadata', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    store.save('t1', 's1', [], { source: 'telephony' });
    const conv = store.load('t1', 's1');
    assert.strictEqual(conv.metadata.source, 'telephony');
    cleanup(dir);
  });

  test('saves language in metadata', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    store.save('t1', 's1', [], { language: 'ar' });
    const conv = store.load('t1', 's1');
    assert.strictEqual(conv.metadata.language, 'ar');
    cleanup(dir);
  });

  test('saves persona in metadata', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    store.save('t1', 's1', [], { persona: 'DENTAL' });
    const conv = store.load('t1', 's1');
    assert.strictEqual(conv.metadata.persona, 'DENTAL');
    cleanup(dir);
  });

  test('defaults source to widget', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    store.save('t1', 's1', []);
    const conv = store.load('t1', 's1');
    assert.strictEqual(conv.metadata.source, 'widget');
    cleanup(dir);
  });

  test('defaults language to fr', () => {
    const dir = tmpDir();
    const store = new ConversationStore({ baseDir: dir });
    store.save('t1', 's1', []);
    const conv = store.load('t1', 's1');
    assert.strictEqual(conv.metadata.language, 'fr');
    cleanup(dir);
  });
});

// ─── getInstance singleton ──────────────────────────────────────

describe('ConversationStore getInstance', () => {
  test('returns a ConversationStore instance', () => {
    const inst = getInstance();
    assert.ok(inst instanceof ConversationStore);
  });

  test('returns same instance on multiple calls', () => {
    const inst1 = getInstance();
    const inst2 = getInstance();
    assert.strictEqual(inst1, inst2);
  });
});

// NOTE: Exports are proven by behavioral tests above (ConversationStore, ConversationCache,
// getInstance, TELEPHONY_RETENTION_DAYS).
