'use strict';

/**
 * VocalIA ConversationStore Tests
 *
 * Tests:
 * - TELEPHONY_RETENTION_DAYS constant
 * - ConversationCache constructor (maxSize, ttlMs)
 * - ConversationCache get/set (LRU, TTL expiry, eviction)
 * - ConversationCache delete/clear/stats
 * - ConversationStore constructor (baseDir, cache)
 * - ConversationStore cacheKey
 * - ConversationStore getFilePath
 * - ConversationStore save/load (with temp dir)
 * - ConversationStore listSessions
 * - getInstance singleton
 *
 * NOTE: Tests with temp directories. Does NOT require running services.
 *
 * Run: node --test test/conversation-store.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  ConversationStore,
  ConversationCache,
  getInstance,
  TELEPHONY_RETENTION_DAYS
} = require('../core/conversation-store.cjs');

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

// ─── Exports ────────────────────────────────────────────────────

describe('ConversationStore exports', () => {
  test('exports ConversationStore class', () => {
    assert.strictEqual(typeof ConversationStore, 'function');
  });

  test('exports ConversationCache class', () => {
    assert.strictEqual(typeof ConversationCache, 'function');
  });

  test('exports getInstance function', () => {
    assert.strictEqual(typeof getInstance, 'function');
  });

  test('exports TELEPHONY_RETENTION_DAYS number', () => {
    assert.strictEqual(typeof TELEPHONY_RETENTION_DAYS, 'number');
  });
});
