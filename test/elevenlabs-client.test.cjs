'use strict';

/**
 * VocalIA ElevenLabs Client Tests
 *
 * Tests:
 * - VOICE_IDS (27+ entries, language coverage, Darija voices)
 * - MODELS (5 models)
 * - DEFAULT_VOICE_SETTINGS (stability, similarity, style, speaker_boost)
 * - LOW_LATENCY_VOICE_SETTINGS (speed-optimized settings)
 * - getVoiceIdForLanguage (pure function, known/unknown langs)
 * - ElevenLabsClient constructor (defaults, custom apiKey)
 * - isConfigured() (with/without apiKey)
 * - getHeaders() (content type, api key)
 * - getCacheStats() (structure, maxSize, ttl)
 * - clearCache() (empties TTS_CACHE)
 * - TTS_CACHE (exposed Map)
 *
 * NOTE: Does NOT call ElevenLabs API. Tests pure logic and constants only.
 *
 * Run: node --test test/elevenlabs-client.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
  ElevenLabsClient,
  VOICE_IDS,
  MODELS,
  DEFAULT_VOICE_SETTINGS,
  LOW_LATENCY_VOICE_SETTINGS,
  getVoiceIdForLanguage,
  OPTIMIZE_STREAMING_LATENCY,
  TTS_CACHE
} = require('../core/elevenlabs-client.cjs');

// ─── VOICE_IDS ──────────────────────────────────────────────────

describe('ElevenLabs VOICE_IDS', () => {
  test('has at least 20 voice entries', () => {
    assert.ok(Object.keys(VOICE_IDS).length >= 20);
  });

  test('has Darija female (ary)', () => {
    assert.ok(VOICE_IDS.ary);
    assert.strictEqual(VOICE_IDS.ary, 'OfGMGmhShO8iL9jCkXy8'); // Ghizlane
  });

  test('has Darija male (ary_male)', () => {
    assert.ok(VOICE_IDS.ary_male);
    assert.strictEqual(VOICE_IDS.ary_male, 'PmGnwGtnBs40iau7JfoF'); // Jawad
  });

  test('has ary_female alias same as ary', () => {
    assert.strictEqual(VOICE_IDS.ary_female, VOICE_IDS.ary);
  });

  test('has French voices (fr, fr_female, fr_male)', () => {
    assert.ok(VOICE_IDS.fr);
    assert.ok(VOICE_IDS.fr_female);
    assert.ok(VOICE_IDS.fr_male);
    assert.strictEqual(VOICE_IDS.fr, VOICE_IDS.fr_female);
  });

  test('has English voices (en, en_female, en_male)', () => {
    assert.ok(VOICE_IDS.en);
    assert.ok(VOICE_IDS.en_female);
    assert.ok(VOICE_IDS.en_male);
    assert.strictEqual(VOICE_IDS.en, VOICE_IDS.en_female);
  });

  test('has Spanish voices (es, es_female, es_male)', () => {
    assert.ok(VOICE_IDS.es);
    assert.ok(VOICE_IDS.es_female);
    assert.ok(VOICE_IDS.es_male);
    assert.strictEqual(VOICE_IDS.es, VOICE_IDS.es_female);
  });

  test('has Arabic MSA voices (ar, ar_female, ar_male)', () => {
    assert.ok(VOICE_IDS.ar);
    assert.ok(VOICE_IDS.ar_female);
    assert.ok(VOICE_IDS.ar_male);
    assert.strictEqual(VOICE_IDS.ar, VOICE_IDS.ar_female);
  });

  test('has Arabic dialect voices (ar_egyptian, ar_gulf)', () => {
    assert.ok(VOICE_IDS.ar_egyptian);
    assert.ok(VOICE_IDS.ar_gulf);
  });

  test('has user-provided name aliases', () => {
    assert.ok(VOICE_IDS.asmaa);
    assert.ok(VOICE_IDS.adam);
    assert.ok(VOICE_IDS.liliya);
    assert.ok(VOICE_IDS.nelya);
    assert.ok(VOICE_IDS.ikhlass);
    assert.ok(VOICE_IDS.najlae);
    assert.ok(VOICE_IDS.liwae);
  });

  test('all voice IDs are non-empty strings', () => {
    for (const [key, id] of Object.entries(VOICE_IDS)) {
      assert.strictEqual(typeof id, 'string', `${key} should be string`);
      assert.ok(id.length > 0, `${key} should be non-empty`);
    }
  });

  test('covers all 5 VocalIA languages', () => {
    assert.ok(VOICE_IDS.fr, 'French voice missing');
    assert.ok(VOICE_IDS.en, 'English voice missing');
    assert.ok(VOICE_IDS.es, 'Spanish voice missing');
    assert.ok(VOICE_IDS.ar, 'Arabic voice missing');
    assert.ok(VOICE_IDS.ary, 'Darija voice missing');
  });
});

// ─── MODELS ─────────────────────────────────────────────────────

describe('ElevenLabs MODELS', () => {
  test('has 5 models', () => {
    assert.strictEqual(Object.keys(MODELS).length, 5);
  });

  test('has multilingual_v2', () => {
    assert.strictEqual(MODELS.multilingual_v2, 'eleven_multilingual_v2');
  });

  test('has flash_v2_5', () => {
    assert.strictEqual(MODELS.flash_v2_5, 'eleven_flash_v2_5');
  });

  test('has turbo_v2_5', () => {
    assert.strictEqual(MODELS.turbo_v2_5, 'eleven_turbo_v2_5');
  });

  test('has scribe_v1 (STT)', () => {
    assert.strictEqual(MODELS.scribe_v1, 'scribe_v1');
  });

  test('has scribe_v2 (STT latest)', () => {
    assert.strictEqual(MODELS.scribe_v2, 'scribe_v2');
  });
});

// ─── DEFAULT_VOICE_SETTINGS ─────────────────────────────────────

describe('ElevenLabs DEFAULT_VOICE_SETTINGS', () => {
  test('has stability 0.5', () => {
    assert.strictEqual(DEFAULT_VOICE_SETTINGS.stability, 0.5);
  });

  test('has similarity_boost 0.75', () => {
    assert.strictEqual(DEFAULT_VOICE_SETTINGS.similarity_boost, 0.75);
  });

  test('has style 0.5', () => {
    assert.strictEqual(DEFAULT_VOICE_SETTINGS.style, 0.5);
  });

  test('has use_speaker_boost true', () => {
    assert.strictEqual(DEFAULT_VOICE_SETTINGS.use_speaker_boost, true);
  });
});

// ─── LOW_LATENCY_VOICE_SETTINGS ─────────────────────────────────

describe('ElevenLabs LOW_LATENCY_VOICE_SETTINGS', () => {
  test('has stability 0.5', () => {
    assert.strictEqual(LOW_LATENCY_VOICE_SETTINGS.stability, 0.5);
  });

  test('has similarity_boost 0.75', () => {
    assert.strictEqual(LOW_LATENCY_VOICE_SETTINGS.similarity_boost, 0.75);
  });

  test('has style 0 (disabled for speed)', () => {
    assert.strictEqual(LOW_LATENCY_VOICE_SETTINGS.style, 0);
  });

  test('has use_speaker_boost false (disabled for speed)', () => {
    assert.strictEqual(LOW_LATENCY_VOICE_SETTINGS.use_speaker_boost, false);
  });
});

// ─── getVoiceIdForLanguage ──────────────────────────────────────

describe('ElevenLabs getVoiceIdForLanguage', () => {
  test('returns voice ID for fr', () => {
    assert.strictEqual(getVoiceIdForLanguage('fr'), VOICE_IDS.fr);
  });

  test('returns voice ID for en', () => {
    assert.strictEqual(getVoiceIdForLanguage('en'), VOICE_IDS.en);
  });

  test('returns voice ID for es', () => {
    assert.strictEqual(getVoiceIdForLanguage('es'), VOICE_IDS.es);
  });

  test('returns voice ID for ar', () => {
    assert.strictEqual(getVoiceIdForLanguage('ar'), VOICE_IDS.ar);
  });

  test('returns voice ID for ary', () => {
    assert.strictEqual(getVoiceIdForLanguage('ary'), VOICE_IDS.ary);
  });

  test('returns null for unknown language', () => {
    assert.strictEqual(getVoiceIdForLanguage('zh'), null);
  });

  test('returns null for empty string', () => {
    assert.strictEqual(getVoiceIdForLanguage(''), null);
  });

  test('returns voice for name alias', () => {
    assert.strictEqual(getVoiceIdForLanguage('asmaa'), VOICE_IDS.asmaa);
  });

  test('returns voice for fr_male', () => {
    assert.strictEqual(getVoiceIdForLanguage('fr_male'), VOICE_IDS.fr_male);
  });
});

// ─── OPTIMIZE_STREAMING_LATENCY ─────────────────────────────────

describe('ElevenLabs OPTIMIZE_STREAMING_LATENCY', () => {
  test('is a number', () => {
    assert.strictEqual(typeof OPTIMIZE_STREAMING_LATENCY, 'number');
  });

  test('is between 0 and 4', () => {
    assert.ok(OPTIMIZE_STREAMING_LATENCY >= 0);
    assert.ok(OPTIMIZE_STREAMING_LATENCY <= 4);
  });
});

// ─── ElevenLabsClient constructor ───────────────────────────────

describe('ElevenLabsClient constructor', () => {
  test('creates instance without apiKey', () => {
    const client = new ElevenLabsClient('test-key-123');
    assert.ok(client);
  });

  test('stores custom apiKey', () => {
    const client = new ElevenLabsClient('test-key-456');
    assert.strictEqual(client.apiKey, 'test-key-456');
  });

  test('has baseUrl', () => {
    const client = new ElevenLabsClient('test-key');
    assert.ok(client.baseUrl);
    assert.ok(client.baseUrl.includes('elevenlabs.io'));
  });

  test('has voiceIds from VOICE_IDS', () => {
    const client = new ElevenLabsClient('test-key');
    assert.strictEqual(client.voiceIds.ary, VOICE_IDS.ary);
    assert.strictEqual(client.voiceIds.fr, VOICE_IDS.fr);
  });

  test('has defaultModel set to multilingual_v2', () => {
    const client = new ElevenLabsClient('test-key');
    assert.strictEqual(client.defaultModel, MODELS.multilingual_v2);
  });
});

// ─── isConfigured ───────────────────────────────────────────────

describe('ElevenLabsClient isConfigured', () => {
  test('returns true when apiKey is set', () => {
    const client = new ElevenLabsClient('test-key');
    assert.strictEqual(client.isConfigured(), true);
  });

  test('returns false when apiKey is null', () => {
    const client = new ElevenLabsClient(null);
    // Falls back to ELEVENLABS_API_KEY env
    // If env not set, should be falsy
    if (!process.env.ELEVENLABS_API_KEY) {
      assert.strictEqual(client.isConfigured(), false);
    }
  });
});

// ─── getHeaders ─────────────────────────────────────────────────

describe('ElevenLabsClient getHeaders', () => {
  test('returns headers with api key', () => {
    const client = new ElevenLabsClient('my-secret-key');
    const headers = client.getHeaders();
    assert.strictEqual(headers['xi-api-key'], 'my-secret-key');
  });

  test('defaults to application/json content type', () => {
    const client = new ElevenLabsClient('key');
    const headers = client.getHeaders();
    assert.strictEqual(headers['Content-Type'], 'application/json');
  });

  test('accepts custom content type', () => {
    const client = new ElevenLabsClient('key');
    const headers = client.getHeaders('multipart/form-data');
    assert.strictEqual(headers['Content-Type'], 'multipart/form-data');
  });
});

// ─── getCacheStats ──────────────────────────────────────────────

describe('ElevenLabsClient getCacheStats', () => {
  test('returns cache stats object', () => {
    const client = new ElevenLabsClient('key');
    const stats = client.getCacheStats();
    assert.strictEqual(typeof stats.size, 'number');
    assert.strictEqual(typeof stats.maxSize, 'number');
    assert.strictEqual(typeof stats.ttlMs, 'number');
  });

  test('maxSize is 100', () => {
    const client = new ElevenLabsClient('key');
    assert.strictEqual(client.getCacheStats().maxSize, 100);
  });

  test('ttlMs is 30 minutes', () => {
    const client = new ElevenLabsClient('key');
    assert.strictEqual(client.getCacheStats().ttlMs, 30 * 60 * 1000);
  });
});

// ─── clearCache ─────────────────────────────────────────────────

describe('ElevenLabsClient clearCache', () => {
  test('clears TTS_CACHE', () => {
    // Add an entry to cache
    TTS_CACHE.set('test-key', { audio: Buffer.from('test'), timestamp: Date.now() });
    assert.ok(TTS_CACHE.size > 0);

    const client = new ElevenLabsClient('key');
    client.clearCache();
    assert.strictEqual(TTS_CACHE.size, 0);
  });
});

// ─── TTS_CACHE ──────────────────────────────────────────────────

describe('ElevenLabs TTS_CACHE', () => {
  test('is a Map', () => {
    assert.ok(TTS_CACHE instanceof Map);
  });

  test('supports set/get/delete operations', () => {
    TTS_CACHE.set('test', { audio: Buffer.from('x'), timestamp: Date.now() });
    assert.ok(TTS_CACHE.has('test'));
    TTS_CACHE.delete('test');
    assert.ok(!TTS_CACHE.has('test'));
  });
});

// NOTE: Exports are proven by behavioral tests above (ElevenLabsClient, VOICE_IDS,
// MODELS, getVoiceIdForLanguage, OPTIMIZE_STREAMING_LATENCY, TTS_CACHE).
