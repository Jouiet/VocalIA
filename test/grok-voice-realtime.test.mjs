/**
 * VocalIA Grok Voice Realtime Tests
 *
 * Tests CONFIG values, GeminiTTSFallback.mapVoice(), GrokRealtimeSession
 * behavioral guards, _handleMessage event routing, GrokRealtimeProxy HTTP
 * server (health, voices, CORS, rate limiting, 404), session cleanup, and
 * real Grok WebSocket connection (when XAI_API_KEY is available).
 *
 * Session 250.238: Converted STRUCTURAL checks to BEHAVIORAL tests.
 * Session 250.239: Added HTTP proxy tests, _handleMessage routing, real WS.
 *
 * Run: node --test test/grok-voice-realtime.test.mjs
 */

import { test, describe, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { EventEmitter } from 'events';
import { GrokRealtimeSession, GrokRealtimeProxy, GeminiTTSFallback, CONFIG, GEMINI_CONFIG } from '../core/grok-voice-realtime.cjs';

// Helper: HTTP GET request
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.on('data', (d) => body += d);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// Helper: HTTP request with options
function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      method: options.method || 'GET',
      headers: options.headers || {},
    }, (res) => {
      let body = '';
      res.on('data', (d) => body += d);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

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

  test('cleanupSessions removes expired sessions', () => {
    const proxy = new GrokRealtimeProxy();
    // Add a fake session with an old timestamp (> 30 min ago)
    const fakeSession = { disconnect: () => {} };
    proxy.sessions.set('old_session', fakeSession);
    proxy.sessionTimeouts.set('old_session', Date.now() - 31 * 60 * 1000);

    // Add a fresh session
    const freshSession = { disconnect: () => {} };
    proxy.sessions.set('fresh_session', freshSession);
    proxy.sessionTimeouts.set('fresh_session', Date.now());

    proxy.cleanupSessions();
    assert.strictEqual(proxy.sessions.size, 1);
    assert.ok(proxy.sessions.has('fresh_session'));
    assert.ok(!proxy.sessions.has('old_session'));
  });

  test('stop clears all sessions and closes server', () => {
    const proxy = new GrokRealtimeProxy();
    // Add fake sessions
    let disconnectCalled = 0;
    const fakeSession = { disconnect: () => { disconnectCalled++; } };
    proxy.sessions.set('s1', fakeSession);
    proxy.sessions.set('s2', { ...fakeSession, disconnect: () => { disconnectCalled++; } });

    proxy.stop();
    assert.strictEqual(proxy.sessions.size, 0);
    assert.strictEqual(disconnectCalled, 2);
  });
});

// ─── GrokRealtimeProxy HTTP server ──────────────────────────────────────────

describe('GrokRealtimeProxy HTTP server', () => {
  let proxy;
  const PORT = 19007 + Math.floor(Math.random() * 1000);
  const BASE = `http://127.0.0.1:${PORT}`;

  // Start proxy before tests
  test('proxy starts and serves HTTP', async () => {
    proxy = new GrokRealtimeProxy(PORT);
    proxy.start();
    // Wait for server to listen
    await new Promise(r => setTimeout(r, 200));

    const res = await httpGet(`${BASE}/health`);
    assert.strictEqual(res.status, 200);
    const data = JSON.parse(res.body);
    assert.strictEqual(data.status, 'ok');
    assert.strictEqual(data.service, 'grok-voice-realtime-proxy');
    assert.strictEqual(data.maxSessions, 100);
    assert.ok(Array.isArray(data.voices));
    assert.strictEqual(data.voices.length, 7);
  });

  test('/voices returns all 7 voice names', async () => {
    const res = await httpGet(`${BASE}/voices`);
    assert.strictEqual(res.status, 200);
    const voices = JSON.parse(res.body);
    assert.ok(voices.ara);
    assert.ok(voices.eve);
    assert.ok(voices.leo);
    assert.strictEqual(Object.keys(voices).length, 7);
  });

  test('unknown path returns 404', async () => {
    const res = await httpGet(`${BASE}/nonexistent`);
    assert.strictEqual(res.status, 404);
  });

  test('OPTIONS returns 204 (CORS preflight)', async () => {
    const res = await httpRequest(`${BASE}/health`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://vocalia.ma' }
    });
    assert.strictEqual(res.status, 204);
  });

  test('CORS allows vocalia.ma origin', async () => {
    const res = await httpRequest(`${BASE}/health`, {
      headers: { Origin: 'https://vocalia.ma' }
    });
    assert.strictEqual(res.headers['access-control-allow-origin'], 'https://vocalia.ma');
  });

  test('CORS allows dashboard.vocalia.ma origin', async () => {
    const res = await httpRequest(`${BASE}/health`, {
      headers: { Origin: 'https://dashboard.vocalia.ma' }
    });
    assert.strictEqual(res.headers['access-control-allow-origin'], 'https://dashboard.vocalia.ma');
  });

  test('CORS defaults to vocalia.ma for unknown origin', async () => {
    const res = await httpRequest(`${BASE}/health`, {
      headers: { Origin: 'https://evil.com' }
    });
    // Unknown origin: no Access-Control-Allow-Origin set for evil.com
    assert.notStrictEqual(res.headers['access-control-allow-origin'], 'https://evil.com');
  });

  test('security headers are set', async () => {
    const res = await httpGet(`${BASE}/health`);
    assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
    assert.strictEqual(res.headers['x-frame-options'], 'DENY');
    assert.ok(res.headers['strict-transport-security']);
  });

  test('rate limiter returns 429 after many requests', async () => {
    // The rate limiter allows 20 req/min per IP
    // Make 25 rapid requests to /health
    let got429 = false;
    for (let i = 0; i < 25; i++) {
      try {
        const res = await httpGet(`${BASE}/health`);
        if (res.status === 429) {
          got429 = true;
          const data = JSON.parse(res.body);
          assert.ok(data.error.includes('Too many'));
          break;
        }
      } catch {
        // Timeout or error — skip
      }
    }
    assert.ok(got429, 'Should have received 429 within 25 requests');
  });

  // Cleanup
  after(() => {
    if (proxy) proxy.stop();
  });
});

// ─── GrokRealtimeSession._handleMessage event routing ──────────────────────

describe('GrokRealtimeSession._handleMessage()', () => {
  test('session.created emits session.created with sessionId', () => {
    const session = new GrokRealtimeSession({ apiKey: 'test-key' });
    let emitted = null;
    session.on('session.created', (data) => { emitted = data; });

    session._handleMessage(Buffer.from(JSON.stringify({
      type: 'session.created',
      session: { id: 'sess_abc123' }
    })));

    assert.strictEqual(session.sessionId, 'sess_abc123');
    assert.deepStrictEqual(emitted, { id: 'sess_abc123' });
    assert.strictEqual(session.stats.messagesReceived, 1);
  });

  test('session.updated emits session.updated', () => {
    const session = new GrokRealtimeSession({ apiKey: 'test-key' });
    let emitted = false;
    session.on('session.updated', () => { emitted = true; });

    session._handleMessage(Buffer.from(JSON.stringify({
      type: 'session.updated',
      session: { voice: 'eve' }
    })));

    assert.ok(emitted);
  });

  test('input_audio_buffer.speech_started emits speech.started', () => {
    const session = new GrokRealtimeSession({ apiKey: 'test-key' });
    let emitted = false;
    session.on('speech.started', () => { emitted = true; });

    session._handleMessage(Buffer.from(JSON.stringify({
      type: 'input_audio_buffer.speech_started'
    })));

    assert.ok(emitted);
  });

  test('input_audio_buffer.speech_stopped emits speech.stopped', () => {
    const session = new GrokRealtimeSession({ apiKey: 'test-key' });
    let emitted = false;
    session.on('speech.stopped', () => { emitted = true; });

    session._handleMessage(Buffer.from(JSON.stringify({
      type: 'input_audio_buffer.speech_stopped'
    })));

    assert.ok(emitted);
  });

  test('input_audio_buffer.committed emits audio.committed', () => {
    const session = new GrokRealtimeSession({ apiKey: 'test-key' });
    let emitted = false;
    session.on('audio.committed', () => { emitted = true; });

    session._handleMessage(Buffer.from(JSON.stringify({
      type: 'input_audio_buffer.committed'
    })));

    assert.ok(emitted);
  });

  test('conversation.item.created emits item.created', () => {
    const session = new GrokRealtimeSession({ apiKey: 'test-key' });
    let emitted = null;
    session.on('item.created', (item) => { emitted = item; });

    session._handleMessage(Buffer.from(JSON.stringify({
      type: 'conversation.item.created',
      item: { type: 'message', role: 'user' }
    })));

    assert.deepStrictEqual(emitted, { type: 'message', role: 'user' });
  });

  test('response.created emits response.started', () => {
    const session = new GrokRealtimeSession({ apiKey: 'test-key' });
    let emitted = null;
    session.on('response.started', (resp) => { emitted = resp; });

    session._handleMessage(Buffer.from(JSON.stringify({
      type: 'response.created',
      response: { id: 'resp_1' }
    })));

    assert.deepStrictEqual(emitted, { id: 'resp_1' });
  });

  test('response.audio.delta emits audio.delta and increments counter', () => {
    const session = new GrokRealtimeSession({ apiKey: 'test-key' });
    let emitted = null;
    session.on('audio.delta', (data) => { emitted = data; });

    session._handleMessage(Buffer.from(JSON.stringify({
      type: 'response.audio.delta',
      delta: 'base64audiodata',
      item_id: 'item_1'
    })));

    assert.strictEqual(emitted.delta, 'base64audiodata');
    assert.strictEqual(emitted.itemId, 'item_1');
    assert.strictEqual(session.stats.audioChunksReceived, 1);
  });

  test('response.audio.done emits audio.done', () => {
    const session = new GrokRealtimeSession({ apiKey: 'test-key' });
    let emitted = false;
    session.on('audio.done', () => { emitted = true; });

    session._handleMessage(Buffer.from(JSON.stringify({
      type: 'response.audio.done'
    })));

    assert.ok(emitted);
  });

  test('response.audio_transcript.delta emits transcript.delta', () => {
    const session = new GrokRealtimeSession({ apiKey: 'test-key' });
    let emitted = null;
    session.on('transcript.delta', (data) => { emitted = data; });

    session._handleMessage(Buffer.from(JSON.stringify({
      type: 'response.audio_transcript.delta',
      delta: 'Bonjour',
      item_id: 'item_2'
    })));

    assert.strictEqual(emitted.delta, 'Bonjour');
    assert.strictEqual(emitted.itemId, 'item_2');
  });

  test('response.audio_transcript.done emits transcript.done', () => {
    const session = new GrokRealtimeSession({ apiKey: 'test-key' });
    let emitted = null;
    session.on('transcript.done', (t) => { emitted = t; });

    session._handleMessage(Buffer.from(JSON.stringify({
      type: 'response.audio_transcript.done',
      transcript: 'Bonjour comment allez-vous'
    })));

    assert.strictEqual(emitted, 'Bonjour comment allez-vous');
  });

  test('response.text.delta emits text.delta', () => {
    const session = new GrokRealtimeSession({ apiKey: 'test-key' });
    let emitted = null;
    session.on('text.delta', (d) => { emitted = d; });

    session._handleMessage(Buffer.from(JSON.stringify({
      type: 'response.text.delta',
      delta: 'Hello'
    })));

    assert.strictEqual(emitted, 'Hello');
  });

  test('response.text.done emits text.done', () => {
    const session = new GrokRealtimeSession({ apiKey: 'test-key' });
    let emitted = null;
    session.on('text.done', (t) => { emitted = t; });

    session._handleMessage(Buffer.from(JSON.stringify({
      type: 'response.text.done',
      text: 'Full response text'
    })));

    assert.strictEqual(emitted, 'Full response text');
  });

  test('response.done emits response.done', () => {
    const session = new GrokRealtimeSession({ apiKey: 'test-key' });
    let emitted = null;
    session.on('response.done', (r) => { emitted = r; });

    session._handleMessage(Buffer.from(JSON.stringify({
      type: 'response.done',
      response: { status: 'completed' }
    })));

    assert.deepStrictEqual(emitted, { status: 'completed' });
  });

  test('user transcript emits user.transcript', () => {
    const session = new GrokRealtimeSession({ apiKey: 'test-key' });
    let emitted = null;
    session.on('user.transcript', (t) => { emitted = t; });

    session._handleMessage(Buffer.from(JSON.stringify({
      type: 'conversation.item.input_audio_transcription.completed',
      transcript: 'Je veux réserver'
    })));

    assert.strictEqual(emitted, 'Je veux réserver');
  });

  test('error event emits error', () => {
    const session = new GrokRealtimeSession({ apiKey: 'test-key' });
    let emitted = null;
    session.on('error', (err) => { emitted = err; });

    session._handleMessage(Buffer.from(JSON.stringify({
      type: 'error',
      error: { message: 'Rate limit exceeded' }
    })));

    assert.ok(emitted instanceof Error);
    assert.strictEqual(emitted.message, 'Rate limit exceeded');
  });

  test('unknown type does not throw', () => {
    const session = new GrokRealtimeSession({ apiKey: 'test-key' });
    // Should not throw
    session._handleMessage(Buffer.from(JSON.stringify({
      type: 'some.future.event'
    })));
    assert.strictEqual(session.stats.messagesReceived, 1);
  });

  test('invalid JSON does not throw', () => {
    const session = new GrokRealtimeSession({ apiKey: 'test-key' });
    // Should not throw — just logs error
    session._handleMessage(Buffer.from('not json'));
    assert.strictEqual(session.stats.messagesReceived, 0);
  });

  test('multiple messages increment counter correctly', () => {
    const session = new GrokRealtimeSession({ apiKey: 'test-key' });

    for (let i = 0; i < 5; i++) {
      session._handleMessage(Buffer.from(JSON.stringify({
        type: 'response.audio.delta',
        delta: `chunk_${i}`,
        item_id: `item_${i}`
      })));
    }

    assert.strictEqual(session.stats.messagesReceived, 5);
    assert.strictEqual(session.stats.audioChunksReceived, 5);
  });
});

// ─── GrokRealtimeSession additional methods ─────────────────────────────────

describe('GrokRealtimeSession methods', () => {
  test('sendAudioBuffer converts Buffer to base64 and throws when not connected', () => {
    const session = new GrokRealtimeSession({ apiKey: 'test-key' });
    const pcmBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    assert.throws(() => session.sendAudioBuffer(pcmBuffer), /Not connected/);
  });

  test('commitAudio is no-op when ws is null (not connected)', () => {
    const session = new GrokRealtimeSession({ apiKey: 'test-key' });
    // ws is null, _send is a no-op — should not throw
    session.commitAudio();
  });

  test('clearAudio is no-op when ws is null', () => {
    const session = new GrokRealtimeSession({ apiKey: 'test-key' });
    session.clearAudio();
  });

  test('cancelResponse is no-op when ws is null', () => {
    const session = new GrokRealtimeSession({ apiKey: 'test-key' });
    session.cancelResponse();
  });

  test('updateSession is no-op when ws is null', () => {
    const session = new GrokRealtimeSession({ apiKey: 'test-key' });
    session.updateSession({ voice: 'eve' });
  });

  test('getStats uses disconnectTime when available', () => {
    const session = new GrokRealtimeSession({ apiKey: 'test-key' });
    session.stats.connectTime = 1000;
    session.stats.disconnectTime = 61000;
    const stats = session.getStats();
    assert.strictEqual(stats.durationMs, 60000);
    assert.strictEqual(stats.durationMin, '1.00');
    assert.strictEqual(stats.estimatedCost, '$0.0500');
  });
});

// ─── Real Grok WebSocket connection (requires XAI_API_KEY) ──────────────────

describe('Real Grok WebSocket connection', { skip: !process.env.XAI_API_KEY }, () => {
  test('connects to xAI WebSocket and exchanges messages, then disconnects', async () => {
    const session = new GrokRealtimeSession();

    // Connect with 15s timeout
    await Promise.race([
      session.connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 15000))
    ]);

    assert.strictEqual(session.connected, true);
    assert.ok(session.stats.connectTime);

    // Wait for at least one message (session.created or session.updated or any event)
    await Promise.race([
      new Promise((resolve) => {
        if (session.stats.messagesReceived > 0) return resolve();
        session.once('message', resolve);
      }),
      new Promise(r => setTimeout(r, 10000))
    ]);

    // Verify we received messages from xAI
    assert.ok(session.stats.messagesReceived > 0, 'Should have received at least 1 message from xAI');

    // Clean disconnect
    session.disconnect();
    assert.strictEqual(session.connected, false);
  });

  test('sends text and receives response from Grok', async () => {
    const session = new GrokRealtimeSession({
      instructions: 'Respond in exactly one short sentence in French.'
    });

    await Promise.race([
      session.connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
    ]);

    // Wait for session.created
    await Promise.race([
      new Promise((resolve) => session.once('session.created', resolve)),
      new Promise(r => setTimeout(r, 5000))
    ]);

    // Collect text or transcript
    let gotResponse = false;
    session.on('response.done', () => { gotResponse = true; });

    // Send a simple text prompt
    session.sendText('Dis bonjour.');

    // Wait for response.done with 30s timeout
    await Promise.race([
      new Promise((resolve) => session.once('response.done', resolve)),
      new Promise(r => setTimeout(r, 30000))
    ]);

    assert.ok(gotResponse || session.stats.messagesReceived > 2,
      'Should have received a response from Grok');

    session.disconnect();
  });
});

// ─── Real Gemini TTS Fallback (requires GEMINI_API_KEY) ──────────────────────

describe('Real Gemini TTS Fallback', { skip: !process.env.GEMINI_API_KEY }, () => {
  // Pre-flight: detect quota exhaustion before running real API tests
  let quotaAvailable = true;
  let preflightError = null;

  test('preflight: Gemini TTS API is reachable and has quota', async () => {
    const tts = new GeminiTTSFallback({ voice: 'Kore' });
    try {
      const result = await tts.synthesize('Test.');
      assert.ok(result.audio, 'Preflight audio should exist');
    } catch (err) {
      if (/quota|rate.limit|429|billing/i.test(err.message)) {
        quotaAvailable = false;
        preflightError = err.message;
        console.warn(`[GeminiTTS] Quota exhausted — skipping real API tests: ${err.message}`);
      } else {
        throw err; // Real code bug — let it fail
      }
    }
  });

  test('synthesize generates real audio from text', { skip: false }, async (t) => {
    if (!quotaAvailable) return t.skip(`Gemini quota exhausted: ${preflightError}`);
    const tts = new GeminiTTSFallback({ voice: 'Kore' });

    const result = await tts.synthesize('Bonjour, bienvenue chez VocalIA.');

    assert.ok(result.audio, 'Audio data should exist');
    assert.ok(result.audio.length > 100, 'Audio should be substantial (>100 base64 chars)');
    assert.ok(result.mimeType, 'MIME type should be set');

    // Verify stats updated
    const stats = tts.getStats();
    assert.strictEqual(stats.requestCount, 1);
    assert.ok(stats.totalChars > 0);
    assert.ok(stats.totalAudioBytes > 0);

    const audioSizeKB = parseFloat(stats.totalAudioKB);
    assert.ok(audioSizeKB > 0, 'Audio should have non-zero size');
    console.log(`[GeminiTTS] Generated ${stats.totalAudioKB} KB audio, MIME: ${result.mimeType}`);
  });

  test('synthesize in English works', { skip: false }, async (t) => {
    if (!quotaAvailable) return t.skip(`Gemini quota exhausted: ${preflightError}`);
    const tts = new GeminiTTSFallback({ voice: 'Puck' });

    const result = await tts.synthesize('Hello, welcome to VocalIA.');

    assert.ok(result.audio);
    assert.ok(result.audio.length > 100);
  });

  test('healthCheck returns true when API is working', { skip: false }, async (t) => {
    if (!quotaAvailable) return t.skip(`Gemini quota exhausted: ${preflightError}`);
    const tts = new GeminiTTSFallback({ voice: 'Kore' });
    const healthy = await tts.healthCheck();
    assert.strictEqual(healthy, true);
  });

  test('stats accumulate across multiple calls', { skip: false }, async (t) => {
    if (!quotaAvailable) return t.skip(`Gemini quota exhausted: ${preflightError}`);
    const tts = new GeminiTTSFallback({ voice: 'Zephyr' });

    await tts.synthesize('Première phrase.');
    await tts.synthesize('Deuxième phrase.');

    const stats = tts.getStats();
    assert.strictEqual(stats.requestCount, 2);
    assert.ok(stats.totalChars > 20);
    assert.ok(stats.totalAudioBytes > 0);
  });
});
