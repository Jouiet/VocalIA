/**
 * VocalIA Grok Voice Realtime Tests
 *
 * Tests CONFIG values, GeminiTTSFallback.mapVoice(), GrokRealtimeSession
 * behavioral guards (constructor throws, setVoice throws, sendAudio throws
 * when not connected), and GeminiTTSFallback.getStats().
 *
 * Session 250.238: Converted STRUCTURAL checks to BEHAVIORAL tests.
 * NOTE: Does NOT connect to WebSocket. Tests pure logic and guards only.
 *
 * Run: node --test test/grok-voice-realtime.test.mjs
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { EventEmitter } from 'events';
import { GrokRealtimeSession, GrokRealtimeProxy, GeminiTTSFallback, CONFIG, GEMINI_CONFIG } from '../core/grok-voice-realtime.cjs';

// ─── CONFIG validation (production constants) ───────────────────────────────

describe('GrokRealtime CONFIG', () => {
  test('wsUrl points to xAI WebSocket endpoint', () => {
    assert.ok(CONFIG.wsUrl.startsWith('wss://'));
    assert.ok(CONFIG.wsUrl.includes('x.ai'));
  });

  test('audio config is PCM16 24kHz mono base64', () => {
    assert.strictEqual(CONFIG.audio.format, 'pcm16');
    assert.strictEqual(CONFIG.audio.sampleRate, 24000);
    assert.strictEqual(CONFIG.audio.channels, 1);
    assert.strictEqual(CONFIG.audio.encoding, 'base64');
    assert.strictEqual(CONFIG.audio.chunkMs, 40);
  });

  test('has 7 voices (ara, eve, leo, sal, rex, mika, valentin)', () => {
    const expected = ['ara', 'eve', 'leo', 'sal', 'rex', 'mika', 'valentin'];
    assert.strictEqual(Object.keys(CONFIG.voices).length, 7);
    for (const v of expected) {
      assert.ok(CONFIG.voices[v], `Missing voice: ${v}`);
    }
  });

  test('defaults are ara voice + grok-4 model', () => {
    assert.strictEqual(CONFIG.defaults.voice, 'ara');
    assert.strictEqual(CONFIG.defaults.model, 'grok-4');
  });

  test('turn detection is server_vad with 400ms silence', () => {
    assert.strictEqual(CONFIG.turnDetection.type, 'server_vad');
    assert.strictEqual(CONFIG.turnDetection.silenceDurationMs, 400);
    assert.strictEqual(typeof CONFIG.turnDetection.threshold, 'number');
  });
});

// ─── GEMINI_CONFIG validation ────────────────────────────────────────────────

describe('GrokRealtime GEMINI_CONFIG', () => {
  test('endpoint is Gemini generativelanguage API', () => {
    assert.ok(GEMINI_CONFIG.endpoint.includes('generativelanguage.googleapis.com'));
  });

  test('has 8 Gemini voices', () => {
    assert.strictEqual(Object.keys(GEMINI_CONFIG.voices).length, 8);
    assert.ok(GEMINI_CONFIG.voices.kore);
  });

  test('voice mapping covers all 7 Grok voices', () => {
    for (const grokVoice of Object.keys(CONFIG.voices)) {
      const mapped = GEMINI_CONFIG.voiceMapping[grokVoice];
      assert.ok(mapped, `Missing mapping for ${grokVoice}`);
      assert.ok(GEMINI_CONFIG.voices[mapped.toLowerCase()], `Mapped ${mapped} not in Gemini voices`);
    }
  });

  test('audio format is PCM', () => {
    assert.ok(GEMINI_CONFIG.audioFormat.includes('pcm'));
  });
});

// ─── GeminiTTSFallback.mapVoice (pure static function) ──────────────────────

describe('GeminiTTSFallback.mapVoice()', () => {
  test('maps all 7 Grok voices to Gemini equivalents', () => {
    const expected = {
      ara: 'Kore', eve: 'Sulafat', mika: 'Aoede',
      leo: 'Puck', sal: 'Charon', rex: 'Zephyr', valentin: 'Algieba'
    };
    for (const [grok, gemini] of Object.entries(expected)) {
      assert.strictEqual(GeminiTTSFallback.mapVoice(grok), gemini, `${grok} → ${gemini}`);
    }
  });

  test('returns Kore for unknown/null/undefined', () => {
    assert.strictEqual(GeminiTTSFallback.mapVoice('nonexistent'), 'Kore');
    assert.strictEqual(GeminiTTSFallback.mapVoice(null), 'Kore');
    assert.strictEqual(GeminiTTSFallback.mapVoice(undefined), 'Kore');
  });
});

// ─── GeminiTTSFallback constructor + getStats ────────────────────────────────

describe('GeminiTTSFallback instance', () => {
  test('throws without GEMINI_API_KEY', () => {
    const orig = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      assert.throws(
        () => new GeminiTTSFallback(),
        /GEMINI_API_KEY required/
      );
    } finally {
      if (orig) process.env.GEMINI_API_KEY = orig;
    }
  });

  test('constructor accepts apiKey option', () => {
    const tts = new GeminiTTSFallback({ apiKey: 'test-key' });
    assert.ok(tts instanceof EventEmitter);
    assert.strictEqual(tts.voice, 'Kore');
  });

  test('constructor accepts custom voice', () => {
    const tts = new GeminiTTSFallback({ apiKey: 'test-key', voice: 'Puck' });
    assert.strictEqual(tts.voice, 'Puck');
  });

  test('getStats returns zero stats on fresh instance', () => {
    const tts = new GeminiTTSFallback({ apiKey: 'test-key' });
    const stats = tts.getStats();
    assert.strictEqual(stats.requestCount, 0);
    assert.strictEqual(stats.totalChars, 0);
    assert.strictEqual(stats.totalAudioBytes, 0);
    assert.strictEqual(stats.totalAudioKB, '0.00');
  });
});

// ─── GrokRealtimeSession behavioral guards ──────────────────────────────────

describe('GrokRealtimeSession guards', () => {
  test('throws without XAI_API_KEY', () => {
    const orig = process.env.XAI_API_KEY;
    delete process.env.XAI_API_KEY;
    try {
      assert.throws(
        () => new GrokRealtimeSession(),
        /XAI_API_KEY required/
      );
    } finally {
      if (orig) process.env.XAI_API_KEY = orig;
    }
  });

  test('constructor sets defaults from CONFIG', () => {
    const session = new GrokRealtimeSession({ apiKey: 'test-key' });
    assert.strictEqual(session.voice, CONFIG.defaults.voice);
    assert.strictEqual(session.model, CONFIG.defaults.model);
    assert.strictEqual(session.connected, false);
    assert.deepStrictEqual(session.audioBuffer, []);
  });

  test('constructor accepts custom voice/model/instructions', () => {
    const session = new GrokRealtimeSession({
      apiKey: 'test-key',
      voice: 'eve',
      model: 'custom-model',
      instructions: 'Custom prompt'
    });
    assert.strictEqual(session.voice, 'eve');
    assert.strictEqual(session.model, 'custom-model');
    assert.strictEqual(session.instructions, 'Custom prompt');
  });

  test('extends EventEmitter', () => {
    const session = new GrokRealtimeSession({ apiKey: 'test-key' });
    assert.ok(session instanceof EventEmitter);
  });

  test('sendAudio throws when not connected', () => {
    const session = new GrokRealtimeSession({ apiKey: 'test-key' });
    assert.throws(
      () => session.sendAudio('dGVzdA=='),
      /Not connected/
    );
  });

  test('sendText throws when not connected', () => {
    const session = new GrokRealtimeSession({ apiKey: 'test-key' });
    assert.throws(
      () => session.sendText('hello'),
      /Not connected/
    );
  });

  test('setVoice throws for invalid voice', () => {
    const session = new GrokRealtimeSession({ apiKey: 'test-key' });
    assert.throws(
      () => session.setVoice('nonexistent'),
      /Invalid voice/
    );
  });

  test('setVoice accepts valid voice names', () => {
    const session = new GrokRealtimeSession({ apiKey: 'test-key' });
    // setVoice calls updateSession which calls _send — but ws is null, so _send is a no-op
    session.setVoice('eve');
    assert.strictEqual(session.voice, 'eve');
    session.setVoice('leo');
    assert.strictEqual(session.voice, 'leo');
  });

  test('disconnect is safe when not connected', () => {
    const session = new GrokRealtimeSession({ apiKey: 'test-key' });
    // Should not throw
    session.disconnect();
    assert.strictEqual(session.connected, false);
  });

  test('getStats returns stats object', () => {
    const session = new GrokRealtimeSession({ apiKey: 'test-key' });
    session.stats.connectTime = Date.now() - 60000;
    const stats = session.getStats();
    assert.strictEqual(typeof stats.durationMs, 'number');
    assert.ok(stats.durationMs >= 59000);
    assert.strictEqual(typeof stats.durationMin, 'string');
    assert.strictEqual(typeof stats.estimatedCost, 'string');
    assert.ok(stats.estimatedCost.startsWith('$'));
  });
});

// ─── GrokRealtimeProxy ──────────────────────────────────────────────────────

describe('GrokRealtimeProxy', () => {
  test('constructor sets default port 3007', () => {
    const proxy = new GrokRealtimeProxy();
    assert.strictEqual(proxy.port, 3007);
  });

  test('constructor accepts custom port', () => {
    const proxy = new GrokRealtimeProxy(9999);
    assert.strictEqual(proxy.port, 9999);
  });

  test('sessions map is empty on creation', () => {
    const proxy = new GrokRealtimeProxy();
    assert.ok(proxy.sessions instanceof Map);
    assert.strictEqual(proxy.sessions.size, 0);
  });

  test('cleanupSessions removes nothing from empty map', () => {
    const proxy = new GrokRealtimeProxy();
    proxy.cleanupSessions();
    assert.strictEqual(proxy.sessions.size, 0);
  });
});
