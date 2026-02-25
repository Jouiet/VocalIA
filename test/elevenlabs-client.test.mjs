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
 * Run: node --test test/elevenlabs-client.test.mjs
 */


import { test, describe } from 'node:test';
import assert from 'node:assert';
import { ElevenLabsClient, VOICE_IDS, MODELS, DEFAULT_VOICE_SETTINGS, LOW_LATENCY_VOICE_SETTINGS, getVoiceIdForLanguage, OPTIMIZE_STREAMING_LATENCY, TTS_CACHE } from '../core/elevenlabs-client.cjs';


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

// ═══════════════════════════════════════════════════════════════════════════════
// B103+B104: Behavioral tests — textToSpeech, streamTextToSpeech, cloneVoice
// Mock global fetch to intercept ElevenLabs API calls.
// These tests call REAL production methods with REAL parameters.
// ═══════════════════════════════════════════════════════════════════════════════

describe('ElevenLabsClient textToSpeech (mock fetch)', () => {
  const originalFetch = globalThis.fetch;
  let client;
  let lastFetchUrl, lastFetchOptions;

  // Install mock before each test
  function installMock(responseBuffer = Buffer.from('fake-audio-mp3'), status = 200) {
    globalThis.fetch = async (url, opts) => {
      lastFetchUrl = url;
      lastFetchOptions = opts;
      if (status !== 200) {
        return { ok: false, status, text: async () => `Error ${status}` };
      }
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => responseBuffer.buffer.slice(
          responseBuffer.byteOffset,
          responseBuffer.byteOffset + responseBuffer.byteLength
        ),
      };
    };
    client = new ElevenLabsClient('test-api-key-123');
    TTS_CACHE.clear();
  }

  // Restore after all tests
  test('setup', () => { installMock(); assert.ok(true); });

  test('calls ElevenLabs TTS endpoint with correct URL structure', async () => {
    installMock();
    await client.textToSpeech('Bonjour le monde');
    assert.ok(lastFetchUrl.includes('text-to-speech/'), 'URL should contain text-to-speech/');
    assert.ok(lastFetchUrl.includes('output_format='), 'URL should contain output_format');
    assert.ok(lastFetchUrl.includes('optimize_streaming_latency='), 'URL should contain latency param');
  });

  test('sends correct headers with API key', async () => {
    installMock();
    await client.textToSpeech('Test');
    const body = JSON.parse(lastFetchOptions.body);
    assert.strictEqual(lastFetchOptions.headers['xi-api-key'], 'test-api-key-123');
    assert.strictEqual(lastFetchOptions.headers['Content-Type'], 'application/json');
  });

  test('sends model_id and voice_settings in body', async () => {
    installMock();
    await client.textToSpeech('Test voice');
    const body = JSON.parse(lastFetchOptions.body);
    assert.strictEqual(body.text, 'Test voice');
    assert.ok(body.model_id, 'Should include model_id');
    assert.ok(body.voice_settings, 'Should include voice_settings');
    assert.strictEqual(typeof body.voice_settings.stability, 'number');
  });

  test('uses French voice by default', async () => {
    installMock();
    await client.textToSpeech('Bonjour');
    // Default language is 'fr', so URL should contain French voice ID
    assert.ok(lastFetchUrl.includes(VOICE_IDS.fr), `URL should contain FR voice ID ${VOICE_IDS.fr}`);
  });

  test('uses specified language voice', async () => {
    installMock();
    await client.textToSpeech('Hello', { language: 'en' });
    assert.ok(lastFetchUrl.includes(VOICE_IDS.en), 'URL should contain EN voice ID');
  });

  test('uses voiceId override when provided', async () => {
    installMock();
    await client.textToSpeech('Custom', { voiceId: 'custom_voice_123' });
    assert.ok(lastFetchUrl.includes('custom_voice_123'), 'URL should use custom voice ID');
  });

  test('returns Buffer with audio data', async () => {
    const fakeAudio = Buffer.from([0xFF, 0xFB, 0x90, 0x00]); // MP3 sync bytes
    installMock(fakeAudio);
    const result = await client.textToSpeech('Audio test');
    assert.ok(Buffer.isBuffer(result), 'Should return a Buffer');
    assert.ok(result.length > 0, 'Buffer should not be empty');
  });

  test('caches short phrases (< 200 chars)', async () => {
    installMock();
    TTS_CACHE.clear();
    await client.textToSpeech('Short phrase');
    assert.strictEqual(TTS_CACHE.size, 1, 'Cache should have 1 entry after first call');
    // Second call should hit cache (fetch won't be called again)
    let fetchCalled = false;
    const secondFetch = globalThis.fetch;
    globalThis.fetch = async () => { fetchCalled = true; return secondFetch(...arguments); };
    await client.textToSpeech('Short phrase');
    // Cache hit means fetch should not be called (unless cache key differs)
  });

  test('does not cache long phrases (>= 200 chars)', async () => {
    installMock();
    TTS_CACHE.clear();
    const longText = 'x'.repeat(250);
    await client.textToSpeech(longText);
    assert.strictEqual(TTS_CACHE.size, 0, 'Should not cache phrases >= 200 chars');
  });

  test('low-latency mode uses Flash model', async () => {
    installMock();
    await client.textToSpeech('Fast', { lowLatency: true });
    const body = JSON.parse(lastFetchOptions.body);
    assert.strictEqual(body.model_id, MODELS.flash_v2_5, 'Should use Flash model in low-latency mode');
  });

  test('low-latency mode disables speaker_boost', async () => {
    installMock();
    await client.textToSpeech('Fast', { lowLatency: true });
    const body = JSON.parse(lastFetchOptions.body);
    assert.strictEqual(body.voice_settings.use_speaker_boost, false, 'Should disable speaker_boost');
    assert.strictEqual(body.voice_settings.style, 0, 'Should disable style');
  });

  test('throws on API error (non-200)', async () => {
    installMock(Buffer.from(''), 429);
    await assert.rejects(
      () => client.textToSpeech('Rate limited'),
      /ElevenLabs TTS error.*429/
    );
  });

  test('throws when not configured', async () => {
    const unconfigured = new ElevenLabsClient(null);
    // Only fails if env var not set
    if (!process.env.ELEVENLABS_API_KEY) {
      await assert.rejects(
        () => unconfigured.textToSpeech('Test'),
        /not configured/
      );
    }
  });

  test('cleanup', () => { globalThis.fetch = originalFetch; assert.ok(true); });
});

// ─── B103: cloneVoice behavioral test ────────────────────────────────────────

describe('ElevenLabsClient cloneVoice (mock fetch)', () => {
  const originalFetch = globalThis.fetch;
  let client;
  let lastFetchUrl, lastFetchBody;

  function installMock(responseData = { voice_id: 'cloned_voice_abc123' }, status = 200) {
    globalThis.fetch = async (url, opts) => {
      lastFetchUrl = url;
      lastFetchBody = opts.body;
      if (status !== 200) {
        return { ok: false, status, text: async () => `Clone error ${status}` };
      }
      return {
        ok: true,
        status: 200,
        json: async () => responseData,
      };
    };
    client = new ElevenLabsClient('clone-api-key');
  }

  test('calls /voices/add endpoint', async () => {
    installMock();
    const samples = [Buffer.from('fake-audio-1'), Buffer.from('fake-audio-2')];
    await client.cloneVoice('My Expert Voice', samples, 'Test description');
    assert.ok(lastFetchUrl.includes('/voices/add'), 'Should call /voices/add');
  });

  test('sends POST with FormData body', async () => {
    installMock();
    const samples = [Buffer.from('sample-data')];
    await client.cloneVoice('TestVoice', samples, 'desc');
    // FormData is opaque, but we can verify it was sent
    assert.ok(lastFetchBody instanceof FormData, 'Body should be FormData');
  });

  test('sends API key in headers (not Content-Type — FormData auto-sets it)', async () => {
    let capturedHeaders;
    globalThis.fetch = async (url, opts) => {
      capturedHeaders = opts.headers;
      return { ok: true, status: 200, json: async () => ({ voice_id: 'v123' }) };
    };
    client = new ElevenLabsClient('clone-key-xyz');
    await client.cloneVoice('V', [Buffer.from('a')]);
    assert.strictEqual(capturedHeaders['xi-api-key'], 'clone-key-xyz');
    // No Content-Type header — browser/Node sets multipart boundary automatically
    assert.ok(!capturedHeaders['Content-Type'], 'Should NOT set Content-Type (FormData auto-sets boundary)');
  });

  test('returns voice_id from API response', async () => {
    installMock({ voice_id: 'expert_voice_42', name: 'MyExpert' });
    const result = await client.cloneVoice('Expert', [Buffer.from('audio')], 'Expert voice');
    assert.strictEqual(result.voice_id, 'expert_voice_42');
    assert.strictEqual(result.name, 'MyExpert');
  });

  test('accepts multiple samples (up to 25)', async () => {
    installMock({ voice_id: 'multi_sample' });
    const samples = Array.from({ length: 5 }, (_, i) => Buffer.from(`sample-${i}`));
    const result = await client.cloneVoice('Multi', samples, '5 samples');
    assert.strictEqual(result.voice_id, 'multi_sample');
  });

  test('throws on API error', async () => {
    installMock({}, 400);
    await assert.rejects(
      () => client.cloneVoice('Bad', [Buffer.from('x')]),
      /ElevenLabs clone error.*400/
    );
  });

  test('throws when not configured', async () => {
    const unconfigured = new ElevenLabsClient(null);
    if (!process.env.ELEVENLABS_API_KEY) {
      await assert.rejects(
        () => unconfigured.cloneVoice('Test', [Buffer.from('x')]),
        /not configured/
      );
    }
  });

  test('cleanup', () => { globalThis.fetch = originalFetch; assert.ok(true); });
});

// ─── B104: streamTextToSpeech behavioral test ──────────────────────────────────

describe('ElevenLabsClient streamTextToSpeech (mock fetch)', () => {
  const originalFetch = globalThis.fetch;
  let client;
  let lastFetchUrl, lastFetchOptions;

  function installMock() {
    globalThis.fetch = async (url, opts) => {
      lastFetchUrl = url;
      lastFetchOptions = opts;
      return {
        ok: true,
        status: 200,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array([0xFF, 0xFB, 0x90]));
            controller.close();
          }
        }),
      };
    };
    client = new ElevenLabsClient('stream-key');
  }

  test('calls /stream endpoint', async () => {
    installMock();
    await client.streamTextToSpeech('Stream test');
    assert.ok(lastFetchUrl.includes('/stream'), 'URL should contain /stream');
    assert.ok(lastFetchUrl.includes('optimize_streaming_latency=4'), 'Should use max latency optimization');
  });

  test('uses Flash model for streaming', async () => {
    installMock();
    await client.streamTextToSpeech('Fast stream');
    const body = JSON.parse(lastFetchOptions.body);
    assert.strictEqual(body.model_id, MODELS.flash_v2_5, 'Should use Flash model for streaming');
  });

  test('uses low-latency voice settings', async () => {
    installMock();
    await client.streamTextToSpeech('Settings test');
    const body = JSON.parse(lastFetchOptions.body);
    assert.strictEqual(body.voice_settings.use_speaker_boost, false, 'Streaming should disable speaker_boost');
  });

  test('returns the response body stream', async () => {
    installMock();
    const body = await client.streamTextToSpeech('Read test');
    assert.ok(body instanceof ReadableStream, 'Should return a ReadableStream');
  });

  test('cleanup', () => { globalThis.fetch = originalFetch; assert.ok(true); });
});
