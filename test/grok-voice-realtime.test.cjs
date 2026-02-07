'use strict';

/**
 * VocalIA Grok Voice Realtime Tests
 *
 * Tests:
 * - CONFIG structure (WebSocket URL, audio format, voices, defaults, turn detection)
 * - GEMINI_CONFIG structure (endpoint, voices, voice mapping)
 * - GeminiTTSFallback.mapVoice (static pure function)
 * - GrokRealtimeSession class structure
 * - GrokRealtimeProxy class structure
 * - Exports
 *
 * NOTE: Does NOT connect to WebSocket. Tests constants and class structure only.
 *
 * Run: node --test test/grok-voice-realtime.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
  GrokRealtimeSession,
  GrokRealtimeProxy,
  GeminiTTSFallback,
  CONFIG,
  GEMINI_CONFIG
} = require('../core/grok-voice-realtime.cjs');

// ─── CONFIG ─────────────────────────────────────────────────────────────────

describe('GrokRealtime CONFIG', () => {
  test('has WebSocket URL', () => {
    assert.ok(CONFIG.wsUrl);
    assert.ok(CONFIG.wsUrl.startsWith('wss://'));
  });

  test('wsUrl points to xAI API', () => {
    assert.ok(CONFIG.wsUrl.includes('x.ai'));
  });

  test('has audio config', () => {
    assert.ok(CONFIG.audio);
    assert.strictEqual(CONFIG.audio.format, 'pcm16');
    assert.strictEqual(CONFIG.audio.sampleRate, 24000);
    assert.strictEqual(CONFIG.audio.channels, 1);
    assert.strictEqual(CONFIG.audio.encoding, 'base64');
  });

  test('has 7 voices', () => {
    assert.strictEqual(Object.keys(CONFIG.voices).length, 7);
  });

  test('has ara voice (default)', () => {
    assert.ok(CONFIG.voices.ara);
  });

  test('has eve, leo, sal, rex, mika, valentin voices', () => {
    for (const v of ['eve', 'leo', 'sal', 'rex', 'mika', 'valentin']) {
      assert.ok(CONFIG.voices[v], `Missing voice: ${v}`);
    }
  });

  test('default voice is ara', () => {
    assert.strictEqual(CONFIG.defaults.voice, 'ara');
  });

  test('default model is grok-4', () => {
    assert.strictEqual(CONFIG.defaults.model, 'grok-4');
  });

  test('has turn detection config', () => {
    assert.ok(CONFIG.turnDetection);
    assert.strictEqual(CONFIG.turnDetection.type, 'server_vad');
    assert.strictEqual(typeof CONFIG.turnDetection.threshold, 'number');
    assert.strictEqual(typeof CONFIG.turnDetection.silenceDurationMs, 'number');
  });

  test('silence duration is 400ms (SOTA optimization)', () => {
    assert.strictEqual(CONFIG.turnDetection.silenceDurationMs, 400);
  });

  test('audio chunk is ~40ms', () => {
    assert.strictEqual(CONFIG.audio.chunkMs, 40);
  });
});

// ─── GEMINI_CONFIG ──────────────────────────────────────────────────────────

describe('GrokRealtime GEMINI_CONFIG', () => {
  test('has endpoint URL', () => {
    assert.ok(GEMINI_CONFIG.endpoint);
    assert.ok(GEMINI_CONFIG.endpoint.includes('generativelanguage.googleapis.com'));
  });

  test('has 8 voices', () => {
    assert.strictEqual(Object.keys(GEMINI_CONFIG.voices).length, 8);
  });

  test('has kore voice', () => {
    assert.ok(GEMINI_CONFIG.voices.kore);
  });

  test('has voice mapping for all Grok voices', () => {
    for (const grokVoice of Object.keys(CONFIG.voices)) {
      assert.ok(GEMINI_CONFIG.voiceMapping[grokVoice], `Missing mapping for ${grokVoice}`);
    }
  });

  test('all mapped voices exist in Gemini voices', () => {
    for (const [grokVoice, geminiVoice] of Object.entries(GEMINI_CONFIG.voiceMapping)) {
      const lowercase = geminiVoice.toLowerCase();
      assert.ok(GEMINI_CONFIG.voices[lowercase], `Gemini voice ${geminiVoice} (mapped from ${grokVoice}) not in voices list`);
    }
  });

  test('has audio format', () => {
    assert.ok(GEMINI_CONFIG.audioFormat);
    assert.ok(GEMINI_CONFIG.audioFormat.includes('pcm'));
  });
});

// ─── GeminiTTSFallback.mapVoice ─────────────────────────────────────────────

describe('GeminiTTSFallback.mapVoice', () => {
  test('maps ara to Kore', () => {
    assert.strictEqual(GeminiTTSFallback.mapVoice('ara'), 'Kore');
  });

  test('maps eve to Sulafat', () => {
    assert.strictEqual(GeminiTTSFallback.mapVoice('eve'), 'Sulafat');
  });

  test('maps mika to Aoede', () => {
    assert.strictEqual(GeminiTTSFallback.mapVoice('mika'), 'Aoede');
  });

  test('maps leo to Puck', () => {
    assert.strictEqual(GeminiTTSFallback.mapVoice('leo'), 'Puck');
  });

  test('maps sal to Charon', () => {
    assert.strictEqual(GeminiTTSFallback.mapVoice('sal'), 'Charon');
  });

  test('maps rex to Zephyr', () => {
    assert.strictEqual(GeminiTTSFallback.mapVoice('rex'), 'Zephyr');
  });

  test('maps valentin to Algieba', () => {
    assert.strictEqual(GeminiTTSFallback.mapVoice('valentin'), 'Algieba');
  });

  test('returns Kore for unknown voice', () => {
    assert.strictEqual(GeminiTTSFallback.mapVoice('nonexistent'), 'Kore');
  });

  test('returns Kore for null', () => {
    assert.strictEqual(GeminiTTSFallback.mapVoice(null), 'Kore');
  });

  test('returns Kore for undefined', () => {
    assert.strictEqual(GeminiTTSFallback.mapVoice(undefined), 'Kore');
  });
});

// ─── GrokRealtimeSession class ──────────────────────────────────────────────

describe('GrokRealtimeSession class', () => {
  test('is a constructor function', () => {
    assert.strictEqual(typeof GrokRealtimeSession, 'function');
  });

  test('has prototype methods', () => {
    assert.strictEqual(typeof GrokRealtimeSession.prototype.connect, 'function');
    assert.strictEqual(typeof GrokRealtimeSession.prototype.disconnect, 'function');
    assert.strictEqual(typeof GrokRealtimeSession.prototype.sendAudio, 'function');
    assert.strictEqual(typeof GrokRealtimeSession.prototype.sendText, 'function');
  });

  test('extends EventEmitter', () => {
    const { EventEmitter } = require('events');
    assert.ok(GrokRealtimeSession.prototype instanceof EventEmitter);
  });
});

// ─── GrokRealtimeProxy class ────────────────────────────────────────────────

describe('GrokRealtimeProxy class', () => {
  test('is a constructor function', () => {
    assert.strictEqual(typeof GrokRealtimeProxy, 'function');
  });

  test('has prototype methods', () => {
    assert.strictEqual(typeof GrokRealtimeProxy.prototype.start, 'function');
    assert.strictEqual(typeof GrokRealtimeProxy.prototype.stop, 'function');
  });
});

// ─── GeminiTTSFallback class ────────────────────────────────────────────────

describe('GeminiTTSFallback class', () => {
  test('is a constructor function', () => {
    assert.strictEqual(typeof GeminiTTSFallback, 'function');
  });

  test('has static mapVoice method', () => {
    assert.strictEqual(typeof GeminiTTSFallback.mapVoice, 'function');
  });

  test('has prototype methods', () => {
    assert.strictEqual(typeof GeminiTTSFallback.prototype.synthesize, 'function');
    assert.strictEqual(typeof GeminiTTSFallback.prototype.healthCheck, 'function');
    assert.strictEqual(typeof GeminiTTSFallback.prototype.getStats, 'function');
  });
});

// ─── Exports ────────────────────────────────────────────────────────────────

describe('GrokRealtime exports', () => {
  test('exports 5 items', () => {
    const mod = require('../core/grok-voice-realtime.cjs');
    assert.strictEqual(Object.keys(mod).length, 5);
  });

  test('exports GrokRealtimeSession', () => {
    assert.ok(GrokRealtimeSession);
  });

  test('exports GrokRealtimeProxy', () => {
    assert.ok(GrokRealtimeProxy);
  });

  test('exports GeminiTTSFallback', () => {
    assert.ok(GeminiTTSFallback);
  });

  test('exports CONFIG', () => {
    assert.ok(CONFIG);
  });

  test('exports GEMINI_CONFIG', () => {
    assert.ok(GEMINI_CONFIG);
  });
});
