'use strict';

/**
 * VocalIA Conversation Store Tests
 *
 * Tests:
 * - ConversationCache LRU behavior
 * - ConversationStore CRUD operations
 * - Multi-turn conversation context preservation (P2-7)
 * - Retention policy enforcement
 *
 * Run: node --test test/conversation-store.test.cjs
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { ConversationStore, ConversationCache, TELEPHONY_RETENTION_DAYS } = require('../core/conversation-store.cjs');

// Use temp dir for tests
const TEST_DIR = path.join(__dirname, '../data/conversations/__test__');

describe('ConversationCache', () => {
  let cache;

  beforeEach(() => {
    cache = new ConversationCache(5, 60000);
  });

  test('stores and retrieves data', () => {
    cache.set('key1', { msg: 'hello' });
    const result = cache.get('key1');
    assert.deepStrictEqual(result, { msg: 'hello' });
  });

  test('returns null for missing key', () => {
    assert.strictEqual(cache.get('nonexistent'), null);
  });

  test('evicts oldest entry when max size reached', () => {
    for (let i = 0; i < 6; i++) {
      cache.set(`key${i}`, i);
    }
    // key0 should be evicted (max 5)
    assert.strictEqual(cache.get('key0'), null);
    assert.strictEqual(cache.get('key5'), 5);
  });

  test('expires entries after TTL', () => {
    const shortCache = new ConversationCache(10, 1); // 1ms TTL
    shortCache.set('key1', 'data');

    // Wait for TTL to expire
    const start = Date.now();
    while (Date.now() - start < 5) { /* busy wait */ }

    assert.strictEqual(shortCache.get('key1'), null);
  });

  test('LRU moves accessed items to end', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);

    // Access 'a' to make it recent
    cache.get('a');

    // Fill to max
    cache.set('d', 4);
    cache.set('e', 5);

    // 'b' should be evicted (oldest after 'a' was refreshed)
    cache.set('f', 6);
    assert.strictEqual(cache.get('b'), null);
    assert.strictEqual(cache.get('a'), 1); // still present (was refreshed)
  });

  test('delete removes entry', () => {
    cache.set('key1', 'data');
    cache.delete('key1');
    assert.strictEqual(cache.get('key1'), null);
  });

  test('clear removes all entries', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    assert.strictEqual(cache.get('a'), null);
    assert.strictEqual(cache.get('b'), null);
  });

  test('stats returns correct info', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    const stats = cache.stats();
    assert.strictEqual(stats.size, 2);
    assert.strictEqual(stats.maxSize, 5);
    assert.strictEqual(stats.ttlMs, 60000);
  });
});

describe('ConversationStore CRUD', () => {
  let store;
  const tenantId = '__test_tenant__';
  const sessionId = 'test_session_001';

  beforeEach(() => {
    store = new ConversationStore({ baseDir: TEST_DIR });
  });

  afterEach(() => {
    // Cleanup test files
    const tenantDir = path.join(TEST_DIR, tenantId);
    if (fs.existsSync(tenantDir)) {
      fs.rmSync(tenantDir, { recursive: true, force: true });
    }
  });

  test('save creates conversation file', () => {
    const messages = [
      { role: 'user', content: 'Bonjour', timestamp: new Date().toISOString() },
      { role: 'assistant', content: 'Bienvenue chez VocalIA!', timestamp: new Date().toISOString() }
    ];

    store.save(tenantId, sessionId, messages, { source: 'widget', language: 'fr' });

    const filePath = store.getFilePath(tenantId, sessionId);
    assert.ok(fs.existsSync(filePath), 'Conversation file should exist');

    const saved = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.strictEqual(saved.session_id, sessionId);
    assert.strictEqual(saved.tenant_id, tenantId);
    assert.strictEqual(saved.message_count, 2);
    assert.strictEqual(saved.messages[0].content, 'Bonjour');
  });

  test('load retrieves saved conversation', () => {
    const messages = [
      { role: 'user', content: 'Test message' }
    ];
    store.save(tenantId, sessionId, messages);

    const result = store.load(tenantId, sessionId);
    assert.ok(result, 'Should return conversation');
    assert.strictEqual(result.session_id, sessionId);
    assert.strictEqual(result.messages.length, 1);
  });

  test('load returns null for nonexistent session', () => {
    const result = store.load(tenantId, 'nonexistent');
    assert.strictEqual(result, null);
  });

  test('addMessage appends to existing conversation', () => {
    const messages = [{ role: 'user', content: 'Bonjour' }];
    store.save(tenantId, sessionId, messages);

    store.addMessage(tenantId, sessionId, 'assistant', 'Comment puis-je vous aider?');

    const result = store.load(tenantId, sessionId);
    assert.strictEqual(result.messages.length, 2);
    assert.strictEqual(result.messages[1].content, 'Comment puis-je vous aider?');
  });

  test('listByTenant returns sessions for tenant', () => {
    store.save(tenantId, 'session_a', [{ role: 'user', content: 'A' }]);
    store.save(tenantId, 'session_b', [{ role: 'user', content: 'B' }]);

    const sessions = store.listByTenant(tenantId);
    assert.ok(sessions.length >= 2, 'Should have at least 2 sessions');
  });

  test('delete removes conversation file', () => {
    store.save(tenantId, sessionId, [{ role: 'user', content: 'test' }]);
    store.delete(tenantId, sessionId);

    const filePath = store.getFilePath(tenantId, sessionId);
    assert.ok(!fs.existsSync(filePath), 'File should be deleted');
  });

  test('cacheKey generates correct format', () => {
    const key = store.cacheKey('tenant1', 'session1');
    assert.strictEqual(key, 'tenant1:session1');
  });

  test('getRetentionDays returns default 30', () => {
    const days = store.getRetentionDays('nonexistent_tenant');
    assert.strictEqual(days, 30);
  });

  test('telephony retention is 60 days', () => {
    assert.strictEqual(TELEPHONY_RETENTION_DAYS, 60);
  });

  test('getRecentMessages returns last N messages', () => {
    const messages = [];
    for (let i = 0; i < 15; i++) {
      messages.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: `Msg ${i}` });
    }
    store.save(tenantId, sessionId, messages);

    const recent = store.getRecentMessages(tenantId, sessionId, 5);
    assert.strictEqual(recent.length, 5);
    assert.ok(recent[4].content.includes('14'));
  });

  test('countByTenant returns session count', () => {
    store.save(tenantId, 'count_a', [{ role: 'user', content: 'A' }]);
    store.save(tenantId, 'count_b', [{ role: 'user', content: 'B' }]);

    const count = store.countByTenant(tenantId);
    assert.ok(count >= 2);
  });
});

describe('Multi-Turn Conversation Tests (P2-7)', () => {
  let store;
  const tenantId = '__test_multiturn__';

  beforeEach(() => {
    store = new ConversationStore({ baseDir: TEST_DIR });
  });

  afterEach(() => {
    const tenantDir = path.join(TEST_DIR, tenantId);
    if (fs.existsSync(tenantDir)) {
      fs.rmSync(tenantDir, { recursive: true, force: true });
    }
  });

  test('maintains context across 5 sequential messages', () => {
    const sessionId = 'multiturn_001';

    // Save initial then add messages incrementally
    store.save(tenantId, sessionId, [
      { role: 'user', content: 'Je cherche un dentiste à Casablanca' }
    ]);
    store.addMessage(tenantId, sessionId, 'assistant', 'Voici nos dentistes partenaires à Casablanca. Quel quartier?');
    store.addMessage(tenantId, sessionId, 'user', 'Quartier Maarif, budget 500 DH');
    store.addMessage(tenantId, sessionId, 'assistant', 'Dr. Amrani au Maarif, 350 DH la consultation. Réserver?');
    store.addMessage(tenantId, sessionId, 'user', 'Oui, pour demain 14h');

    const result = store.load(tenantId, sessionId);
    assert.strictEqual(result.messages.length, 5, 'Should have 5 messages');

    // Verify context preservation
    assert.ok(result.messages[0].content.includes('dentiste'), 'Turn 1: topic set');
    assert.ok(result.messages[2].content.includes('Maarif'), 'Turn 3: location specified');
    assert.ok(result.messages[2].content.includes('500 DH'), 'Turn 3: budget specified');
    assert.ok(result.messages[4].content.includes('demain'), 'Turn 5: booking confirmed');
  });

  test('preserves metadata across turns', () => {
    const sessionId = 'multiturn_meta';

    store.save(tenantId, sessionId, [
      { role: 'user', content: 'Bonjour' }
    ], { source: 'telephony', language: 'fr' });

    store.addMessage(tenantId, sessionId, 'assistant', 'Bienvenue');
    store.addMessage(tenantId, sessionId, 'user', 'Je veux un RDV');

    const result = store.load(tenantId, sessionId);
    assert.strictEqual(result.metadata.source, 'telephony');
    assert.strictEqual(result.metadata.language, 'fr');
    assert.strictEqual(result.messages.length, 3);
  });

  test('handles bilingual conversation (FR/ARY switch)', () => {
    const sessionId = 'multiturn_bilingual';

    store.save(tenantId, sessionId, [
      { role: 'user', content: 'مرحبا', language: 'ary' },
      { role: 'assistant', content: 'مرحبا بيك! كيفاش نقدر نعاونك؟', language: 'ary' },
      { role: 'user', content: 'Je préfère continuer en français', language: 'fr' },
      { role: 'assistant', content: 'Bien sûr! Comment puis-je vous aider?', language: 'fr' }
    ], { language: 'ary' });

    const result = store.load(tenantId, sessionId);
    assert.strictEqual(result.messages.length, 4);
    assert.strictEqual(result.messages[0].language, 'ary');
    assert.strictEqual(result.messages[3].language, 'fr');
  });

  test('handles large conversation (20+ messages)', () => {
    const sessionId = 'multiturn_large';
    const messages = [];

    for (let i = 0; i < 25; i++) {
      messages.push({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}: ${i % 2 === 0 ? 'Question' : 'Answer'} about topic ${Math.floor(i / 4)}`,
        timestamp: new Date(Date.now() + i * 1000).toISOString()
      });
    }

    store.save(tenantId, sessionId, messages);

    const result = store.load(tenantId, sessionId);
    assert.strictEqual(result.messages.length, 25);
    assert.strictEqual(result.message_count, 25);
    assert.ok(result.messages[24].content.includes('Message 24'));
  });

  test('getRecentMessages returns context window correctly', () => {
    const sessionId = 'multiturn_context';

    store.save(tenantId, sessionId, [
      { role: 'user', content: 'Mon nom est Ahmed' },
      { role: 'assistant', content: 'Bonjour Ahmed!' },
      { role: 'user', content: 'Je veux un produit' },
      { role: 'assistant', content: 'Quel type de produit, Ahmed?' },
      { role: 'user', content: 'Electronique' },
      { role: 'assistant', content: 'Voici les produits électroniques' }
    ]);

    // Get last 4 messages (typical context window)
    const recent = store.getRecentMessages(tenantId, sessionId, 4);
    assert.strictEqual(recent.length, 4);
    // Should be the last 4 messages
    assert.ok(recent[0].content.includes('produit'));
  });
});
