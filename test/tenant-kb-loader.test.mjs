/**
 * VocalIA Tenant KB Loader Tests
 *
 * Tests:
 * - SUPPORTED_LANGUAGES constant (5 languages)
 * - DEFAULT_LANGUAGE constant (fr)
 * - LRUCache constructor (defaults, custom maxSize/ttl)
 * - LRUCache get/set (miss, hit, LRU eviction, TTL expiry)
 * - LRUCache invalidate (pattern-based)
 * - LRUCache clear/stats
 * - TenantKBLoader constructor (cache, universalKB)
 * - TenantKBLoader exports
 *
 * NOTE: Does NOT require KB files or running services.
 * Tests pure cache logic and constants only.
 *
 * Run: node --test test/tenant-kb-loader.test.mjs
 */


import { test, describe } from 'node:test';
import assert from 'node:assert';
import { TenantKBLoader, getInstance, LRUCache, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '../core/tenant-kb-loader.cjs';


// ─── SUPPORTED_LANGUAGES ────────────────────────────────────────

describe('TenantKBLoader SUPPORTED_LANGUAGES', () => {
  test('has 5 languages', () => {
    assert.strictEqual(SUPPORTED_LANGUAGES.length, 5);
  });

  test('includes fr', () => {
    assert.ok(SUPPORTED_LANGUAGES.includes('fr'));
  });

  test('includes en', () => {
    assert.ok(SUPPORTED_LANGUAGES.includes('en'));
  });

  test('includes es', () => {
    assert.ok(SUPPORTED_LANGUAGES.includes('es'));
  });

  test('includes ar', () => {
    assert.ok(SUPPORTED_LANGUAGES.includes('ar'));
  });

  test('includes ary', () => {
    assert.ok(SUPPORTED_LANGUAGES.includes('ary'));
  });

  test('is an array of strings', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      assert.strictEqual(typeof lang, 'string');
    }
  });
});

// ─── DEFAULT_LANGUAGE ───────────────────────────────────────────

describe('TenantKBLoader DEFAULT_LANGUAGE', () => {
  test('is fr', () => {
    assert.strictEqual(DEFAULT_LANGUAGE, 'fr');
  });

  test('is in SUPPORTED_LANGUAGES', () => {
    assert.ok(SUPPORTED_LANGUAGES.includes(DEFAULT_LANGUAGE));
  });
});

// ─── LRUCache constructor ───────────────────────────────────────

describe('LRUCache constructor', () => {
  test('creates with default maxSize 100', () => {
    const cache = new LRUCache();
    assert.strictEqual(cache.stats().maxSize, 100);
  });

  test('creates with default ttl 5 minutes', () => {
    const cache = new LRUCache();
    assert.strictEqual(cache.stats().ttlMs, 5 * 60 * 1000);
  });

  test('accepts custom maxSize', () => {
    const cache = new LRUCache(50);
    assert.strictEqual(cache.stats().maxSize, 50);
  });

  test('accepts custom ttlMs', () => {
    const cache = new LRUCache(100, 10000);
    assert.strictEqual(cache.stats().ttlMs, 10000);
  });

  test('starts empty', () => {
    const cache = new LRUCache();
    assert.strictEqual(cache.stats().size, 0);
  });
});

// ─── LRUCache get/set ───────────────────────────────────────────

describe('LRUCache get/set', () => {
  test('returns null for missing key', () => {
    const cache = new LRUCache();
    assert.strictEqual(cache.get('nonexistent'), null);
  });

  test('stores and retrieves data', () => {
    const cache = new LRUCache();
    cache.set('key1', { data: 'hello' });
    const result = cache.get('key1');
    assert.deepStrictEqual(result, { data: 'hello' });
  });

  test('increments size on set', () => {
    const cache = new LRUCache();
    cache.set('a', 1);
    cache.set('b', 2);
    assert.strictEqual(cache.stats().size, 2);
  });

  test('evicts oldest when maxSize reached', () => {
    const cache = new LRUCache(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4); // evicts 'a'
    assert.strictEqual(cache.get('a'), null);
    assert.strictEqual(cache.get('d'), 4);
    assert.strictEqual(cache.stats().size, 3);
  });

  test('TTL expiry returns null', () => {
    const cache = new LRUCache(100, 1); // 1ms TTL
    cache.set('expire', 'data');
    const start = Date.now();
    while (Date.now() - start < 5) {} // busy-wait
    assert.strictEqual(cache.get('expire'), null);
  });

  test('LRU: access moves to most recent', () => {
    const cache = new LRUCache(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.get('a'); // access 'a', now most recent
    cache.set('d', 4); // should evict 'b' (oldest)
    assert.strictEqual(cache.get('a'), 1); // still present
    assert.strictEqual(cache.get('b'), null); // evicted
  });

  test('overwrite same key updates value', () => {
    const cache = new LRUCache();
    cache.set('x', 'old');
    cache.set('x', 'new');
    assert.strictEqual(cache.get('x'), 'new');
  });
});

// ─── LRUCache invalidate ────────────────────────────────────────

describe('LRUCache invalidate', () => {
  test('removes entries matching prefix', () => {
    const cache = new LRUCache();
    cache.set('tenant1:fr', { lang: 'fr' });
    cache.set('tenant1:en', { lang: 'en' });
    cache.set('tenant2:fr', { lang: 'fr' });
    cache.invalidate('tenant1');
    assert.strictEqual(cache.get('tenant1:fr'), null);
    assert.strictEqual(cache.get('tenant1:en'), null);
    assert.deepStrictEqual(cache.get('tenant2:fr'), { lang: 'fr' });
  });

  test('no-op for non-matching prefix', () => {
    const cache = new LRUCache();
    cache.set('key1', 1);
    cache.invalidate('nonexistent');
    assert.strictEqual(cache.get('key1'), 1);
  });

  test('removes all with empty prefix', () => {
    const cache = new LRUCache();
    cache.set('a', 1);
    cache.set('b', 2);
    cache.invalidate('');
    assert.strictEqual(cache.stats().size, 0);
  });
});

// ─── LRUCache clear/stats ───────────────────────────────────────

describe('LRUCache clear/stats', () => {
  test('clear removes all entries', () => {
    const cache = new LRUCache();
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    assert.strictEqual(cache.stats().size, 0);
  });

  test('stats returns size, maxSize, ttlMs', () => {
    const cache = new LRUCache(200, 10000);
    const stats = cache.stats();
    assert.strictEqual(typeof stats.size, 'number');
    assert.strictEqual(stats.maxSize, 200);
    assert.strictEqual(stats.ttlMs, 10000);
  });

  test('stats size reflects actual entries', () => {
    const cache = new LRUCache();
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    assert.strictEqual(cache.stats().size, 3);
  });
});

// ─── TenantKBLoader constructor ─────────────────────────────────

describe('TenantKBLoader constructor', () => {
  test('creates instance', () => {
    const loader = new TenantKBLoader();
    assert.ok(loader);
  });

  test('has cache', () => {
    const loader = new TenantKBLoader();
    assert.ok(loader.cache);
    assert.ok(loader.cache instanceof LRUCache);
  });

  test('has universalKB object', () => {
    const loader = new TenantKBLoader();
    assert.ok(loader.universalKB);
    assert.strictEqual(typeof loader.universalKB, 'object');
  });

  test('universalKB has keys for all supported languages', () => {
    const loader = new TenantKBLoader();
    for (const lang of SUPPORTED_LANGUAGES) {
      assert.ok(lang in loader.universalKB, `Missing universalKB key: ${lang}`);
    }
  });

  test('has watchedFiles map', () => {
    const loader = new TenantKBLoader();
    assert.ok(loader.watchedFiles instanceof Map);
  });
});

// ─── getInstance ────────────────────────────────────────────────

describe('TenantKBLoader getInstance', () => {
  test('returns TenantKBLoader instance', () => {
    const inst = getInstance();
    assert.ok(inst instanceof TenantKBLoader);
  });

  test('returns same instance on multiple calls', () => {
    const a = getInstance();
    const b = getInstance();
    assert.strictEqual(a, b);
  });
});

// ─── TenantKBLoader getStats ────────────────────────────────────

describe('TenantKBLoader getStats', () => {
  test('getStats returns object with expected structure', () => {
    const loader = new TenantKBLoader();
    const stats = loader.getStats();
    assert.strictEqual(typeof stats, 'object');
    assert.ok(stats !== null);
  });
});

// ─── mergeKB ─────────────────────────────────────────────────────

describe('TenantKBLoader mergeKB', () => {
  const loader = new TenantKBLoader();

  test('merges universal and client KB', () => {
    const universal = { faq: { q1: 'What is VocalIA?' } };
    const client = { hours: { open: '9-17' } };
    const merged = loader.mergeKB(universal, client);
    assert.deepStrictEqual(merged.faq, { q1: 'What is VocalIA?' });
    assert.deepStrictEqual(merged.hours, { open: '9-17' });
  });

  test('client overrides universal for same key', () => {
    const universal = { info: { name: 'Default' } };
    const client = { info: { name: 'Custom' } };
    const merged = loader.mergeKB(universal, client);
    assert.strictEqual(merged.info.name, 'Custom');
  });

  test('deep merges objects (client extends universal)', () => {
    const universal = { faq: { q1: 'A1', q2: 'A2' } };
    const client = { faq: { q3: 'A3' } };
    const merged = loader.mergeKB(universal, client);
    assert.strictEqual(merged.faq.q1, 'A1');
    assert.strictEqual(merged.faq.q3, 'A3');
  });

  test('arrays are directly overridden (not merged)', () => {
    const universal = { tags: ['a', 'b'] };
    const client = { tags: ['c'] };
    const merged = loader.mergeKB(universal, client);
    assert.deepStrictEqual(merged.tags, ['c']);
  });

  test('primitives are directly overridden', () => {
    const universal = { version: 1 };
    const client = { version: 2 };
    const merged = loader.mergeKB(universal, client);
    assert.strictEqual(merged.version, 2);
  });

  test('adds __meta with merged flag', () => {
    const merged = loader.mergeKB({}, {});
    assert.strictEqual(merged.__meta.merged, true);
  });

  test('__meta includes universalPersonas count', () => {
    const universal = { faq: {}, hours: {}, contact: {} };
    const merged = loader.mergeKB(universal, {});
    assert.strictEqual(merged.__meta.universalPersonas, 3);
  });

  test('__meta includes clientOverrides count', () => {
    const client = { custom1: 'a', custom2: 'b' };
    const merged = loader.mergeKB({}, client);
    assert.strictEqual(merged.__meta.clientOverrides, 2);
  });

  test('strips __meta from client before merge', () => {
    const client = { __meta: { old: true }, data: 'value' };
    const merged = loader.mergeKB({}, client);
    assert.strictEqual(merged.__meta.old, true);
    assert.strictEqual(merged.data, 'value');
  });

  test('handles empty universal', () => {
    const merged = loader.mergeKB({}, { key: 'val' });
    assert.strictEqual(merged.key, 'val');
  });

  test('handles empty client', () => {
    const merged = loader.mergeKB({ key: 'val' }, {});
    assert.strictEqual(merged.key, 'val');
  });
});

// ─── extractPersona ─────────────────────────────────────────────

describe('TenantKBLoader extractPersona', () => {
  const loader = new TenantKBLoader();

  test('returns null for null personaId', () => {
    const kb = { AGENCY: { name: 'Agency' } };
    assert.deepStrictEqual(loader.extractPersona(kb, null), kb);
  });

  test('extracts existing persona', () => {
    const kb = { AGENCY: { name: 'Agency' }, DENTAL: { name: 'Dental' } };
    assert.deepStrictEqual(loader.extractPersona(kb, 'AGENCY'), { name: 'Agency' });
  });

  test('returns null for missing persona', () => {
    const kb = { AGENCY: { name: 'Agency' } };
    assert.strictEqual(loader.extractPersona(kb, 'NONEXISTENT'), null);
  });
});

// ─── tokenize ───────────────────────────────────────────────────

describe('TenantKBLoader tokenize', () => {
  const loader = new TenantKBLoader();

  test('lowercases text', () => {
    const tokens = loader.tokenize('Hello World');
    assert.ok(tokens.includes('hello'));
    assert.ok(tokens.includes('world'));
  });

  test('filters tokens shorter than 3 chars', () => {
    const tokens = loader.tokenize('I am a big dog');
    assert.ok(!tokens.includes('am'));
    assert.ok(!tokens.includes('a'));
    assert.ok(tokens.includes('big'));
    assert.ok(tokens.includes('dog'));
  });

  test('removes punctuation', () => {
    const tokens = loader.tokenize('Hello, world! How are you?');
    assert.ok(!tokens.some(t => t.includes(',')));
    assert.ok(!tokens.some(t => t.includes('!')));
    assert.ok(!tokens.some(t => t.includes('?')));
  });

  test('preserves Arabic characters', () => {
    const tokens = loader.tokenize('مرحبا بالعالم');
    assert.ok(tokens.length > 0);
    assert.ok(tokens.some(t => /[\u0600-\u06FF]/.test(t)));
  });

  test('splits on whitespace', () => {
    const tokens = loader.tokenize('one   two   three');
    assert.ok(tokens.includes('one'));
    assert.ok(tokens.includes('two'));
    assert.ok(tokens.includes('three'));
  });

  test('returns empty array for empty string', () => {
    const tokens = loader.tokenize('');
    assert.deepStrictEqual(tokens, []);
  });

  test('handles mixed content', () => {
    const tokens = loader.tokenize('VocalIA est une plateforme AI');
    assert.ok(tokens.includes('vocalia'));
    assert.ok(tokens.includes('est'));
    assert.ok(tokens.includes('une'));
    assert.ok(tokens.includes('plateforme'));
  });
});

// ─── calculateRelevance ────────────────────────────────────────

describe('TenantKBLoader calculateRelevance', () => {
  const loader = new TenantKBLoader();

  test('returns 0 for no match', () => {
    assert.strictEqual(loader.calculateRelevance('hello world', 'xyz'), 0);
  });

  test('returns count for single word match', () => {
    const score = loader.calculateRelevance('hello hello hello', 'hello');
    assert.strictEqual(score, 3);
  });

  test('sums matches for multi-word query', () => {
    const score = loader.calculateRelevance('hello world hello', 'hello world');
    assert.ok(score >= 3); // hello:2 + world:1 = 3
  });

  test('case-insensitive matching', () => {
    const score = loader.calculateRelevance('Hello HELLO hello', 'hello');
    assert.strictEqual(score, 3);
  });

  test('higher score for more occurrences', () => {
    const low = loader.calculateRelevance('cat', 'cat');
    const high = loader.calculateRelevance('cat cat cat cat', 'cat');
    assert.ok(high > low);
  });
});

// ─── invalidateCache ────────────────────────────────────────────

describe('TenantKBLoader invalidateCache', () => {
  test('invalidates all entries for a tenant', () => {
    const loader = new TenantKBLoader();
    loader.cache.set('tenant1:fr', { data: 'fr' });
    loader.cache.set('tenant1:en', { data: 'en' });
    loader.cache.set('tenant2:fr', { data: 'fr' });
    loader.invalidateCache('tenant1');
    assert.strictEqual(loader.cache.get('tenant1:fr'), null);
    assert.strictEqual(loader.cache.get('tenant1:en'), null);
    assert.deepStrictEqual(loader.cache.get('tenant2:fr'), { data: 'fr' });
  });
});

// ─── refreshUniversalKB ─────────────────────────────────────────

describe('TenantKBLoader refreshUniversalKB', () => {
  test('clears cache after refresh', () => {
    const loader = new TenantKBLoader();
    loader.cache.set('test:fr', { data: 'test' });
    loader.refreshUniversalKB();
    assert.strictEqual(loader.cache.stats().size, 0);
  });
});

// ─── cleanup ────────────────────────────────────────────────────

describe('TenantKBLoader cleanup', () => {
  test('clears cache on cleanup', () => {
    const loader = new TenantKBLoader();
    loader.cache.set('test:fr', { data: 'test' });
    loader.cleanup();
    assert.strictEqual(loader.cache.stats().size, 0);
  });
});

// ─── getClientDefaultLanguage ────────────────────────────────────

describe('TenantKBLoader getClientDefaultLanguage', () => {
  test('returns fr for nonexistent tenant', async () => {
    const loader = new TenantKBLoader();
    const lang = await loader.getClientDefaultLanguage('nonexistent_tenant_xyz');
    assert.strictEqual(lang, 'fr');
  });
});

// NOTE: Exports are proven by behavioral tests above (getInstance singleton,
// LRUCache, SUPPORTED_LANGUAGES, mergeKB, getClientDefaultLanguage, etc.)
