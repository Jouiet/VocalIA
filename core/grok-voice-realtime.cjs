#!/usr/bin/env node
/**
 * GROK VOICE AGENT API - Real WebSocket Implementation with Gemini TTS Fallback
 *
 * FALLBACK CHAIN:
 *   1. Grok Realtime WebSocket (wss://api.x.ai/v1/realtime) - Full conversational
 *   2. Gemini 2.5 Flash TTS (REST API) - Text→Audio only (degraded mode)
 *
 * Audio: PCM16, 24000Hz, mono, little-endian, base64 encoded
 * Pricing: Grok $0.05/min | Gemini ~$0.001/1K chars
 *
 * Date: 2025-12-29
 * Version: 2.0.0 (with Gemini TTS fallback)
 *
 * Docs: https://docs.x.ai/docs/guides/voice
 *       https://ai.google.dev/gemini-api/docs/speech-generation
 */

require('dotenv').config();
const WebSocket = require('ws');
const http = require('http');
const crypto = require('crypto');
const { EventEmitter } = require('events');

// Import security utilities
const {
  RateLimiter,
  setSecurityHeaders,
  secureRandomString
} = require('../../lib/security-utils.cjs');

// Security constants
const MAX_BODY_SIZE = 1024 * 1024; // 1MB
const REQUEST_TIMEOUT_MS = 30000;
const MAX_SESSIONS = 100; // Bounded session pool
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minute session timeout

// ============================================================================
// CONFIGURATION - Verified December 2025
// ============================================================================

const CONFIG = {
  // xAI WebSocket endpoint (OpenAI Realtime API compatible)
  wsUrl: 'wss://api.x.ai/v1/realtime',

  // Audio format requirements
  audio: {
    format: 'pcm16',      // 16-bit signed PCM
    sampleRate: 24000,    // 24kHz required
    channels: 1,          // Mono
    encoding: 'base64',   // Base64 for WebSocket transport
    chunkMs: 40,          // ~40ms chunks recommended
  },

  // Available voices (December 2025)
  voices: {
    ara: 'Ara - Default voice',
    eve: 'Eve - Female voice',
    leo: 'Leo - Male voice',
    sal: 'Sal - Male voice',
    rex: 'Rex - Male voice',
    mika: 'Mika - Female voice',
    valentin: 'Valentin - Male voice',
  },

  // Default settings
  defaults: {
    voice: 'ara',
    model: 'grok-4', // FRONTIER realtime model (powered by Grok-4 family per xAI docs Jan 2026)
    language: 'auto',       // Auto-detect
  },

  // Turn detection (VAD)
  turnDetection: {
    type: 'server_vad',
    threshold: 0.5,
    prefixPaddingMs: 300,
    silenceDurationMs: 400, // SOTA Optimization: 400ms (was 200ms - too aggressive)
  },
};

// ============================================================================
// GEMINI TTS FALLBACK CONFIGURATION - Verified December 2025
// ============================================================================

const GEMINI_CONFIG = {
  // Gemini 2.5 Flash TTS endpoint (Dec 2025)
  endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent',

  // Available voices (subset - most natural for French/English)
  voices: {
    kore: 'Kore - Firm female',
    puck: 'Puck - Upbeat neutral',
    zephyr: 'Zephyr - Bright neutral',
    enceladus: 'Enceladus - Breathy female',
    algieba: 'Algieba - Smooth neutral',
    sulafat: 'Sulafat - Warm female',
    aoede: 'Aoede - Clear female',
    charon: 'Charon - Deep male',
  },

  // Voice mapping from Grok to Gemini (closest matches)
  voiceMapping: {
    ara: 'Kore',       // Default → Firm female
    eve: 'Sulafat',    // Female → Warm female
    mika: 'Aoede',     // Female → Clear female
    leo: 'Puck',       // Male → Upbeat neutral
    sal: 'Charon',     // Male → Deep male
    rex: 'Zephyr',     // Male → Bright neutral
    valentin: 'Algieba', // Male → Smooth neutral
  },

  // Output format (matches Grok: PCM16 24kHz)
  audioFormat: 'audio/L16;codec=pcm;rate=24000',
};

// ============================================================================
// GEMINI TTS FALLBACK CLASS
// ============================================================================

class GeminiTTSFallback extends EventEmitter {
  constructor(options = {}) {
    super();

    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY;
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY required for fallback');
    }

    this.voice = options.voice || 'Kore';
    this.stats = {
      requestCount: 0,
      totalChars: 0,
      totalAudioBytes: 0,
    };
  }

  /**
   * Map Grok voice name to Gemini voice
   * @param {string} grokVoice - Grok voice name (ara, eve, etc.)
   * @returns {string} Gemini voice name
   */
  static mapVoice(grokVoice) {
    return GEMINI_CONFIG.voiceMapping[grokVoice] || 'Kore';
  }

  /**
   * Generate audio from text using Gemini TTS
   * @param {string} text - Text to synthesize
   * @returns {Promise<{audio: string, mimeType: string}>} Base64 audio
   */
  async synthesize(text) {
    const url = `${GEMINI_CONFIG.endpoint}?key=${this.apiKey}`;

    // P0 FIX: Add timeout with AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{
            parts: [{ text }]
          }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: this.voice
                }
              }
            }
          }
        })
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (data.error) {
        throw new Error(`Gemini TTS error: ${data.error.message}`);
      }

      const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (!audioData) {
        throw new Error('Gemini TTS: No audio in response');
      }

      // Update stats
      this.stats.requestCount++;
      this.stats.totalChars += text.length;
      this.stats.totalAudioBytes += Buffer.from(audioData.data, 'base64').length;

      return {
        audio: audioData.data,           // Base64 PCM16 24kHz
        mimeType: audioData.mimeType,    // audio/L16;codec=pcm;rate=24000
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Gemini TTS timeout after ${REQUEST_TIMEOUT_MS}ms`);
      }
      throw error;
    }
  }

  /**
   * Health check for Gemini TTS
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      const result = await this.synthesize('Test.');
      return result.audio && result.audio.length > 0;
    } catch (error) {
      console.error('[GeminiTTS] Health check failed:', error.message);
      return false;
    }
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      ...this.stats,
      totalAudioKB: (this.stats.totalAudioBytes / 1024).toFixed(2),
    };
  }
}

// ============================================================================
// GROK REALTIME SESSION CLASS
// ============================================================================

class GrokRealtimeSession extends EventEmitter {
  constructor(options = {}) {
    super();

    this.apiKey = options.apiKey || process.env.XAI_API_KEY;
    if (!this.apiKey) {
      throw new Error('XAI_API_KEY required');
    }

    this.voice = options.voice || CONFIG.defaults.voice;
    this.model = options.model || CONFIG.defaults.model;
    this.instructions = options.instructions || 'You are a helpful voice assistant for 3A Automation.';

    this.ws = null;
    this.sessionId = null;
    this.connected = false;
    this.audioBuffer = [];

    // Stats
    this.stats = {
      connectTime: null,
      disconnectTime: null,
      audioChunksSent: 0,
      audioChunksReceived: 0,
      messagesReceived: 0,
    };
  }

  /**
   * Connect to Grok Realtime WebSocket
   */
  async connect() {
    return new Promise((resolve, reject) => {
      console.log(`[GrokRealtime] Connecting to ${CONFIG.wsUrl}...`);

      this.ws = new WebSocket(CONFIG.wsUrl, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'OpenAI-Beta': 'realtime=v1', // Required header
        },
      });

      this.ws.on('open', () => {
        console.log('[GrokRealtime] WebSocket connected');
        this.connected = true;
        this.stats.connectTime = Date.now();

        // Configure session
        this._sendSessionUpdate();

        resolve();
      });

      this.ws.on('message', (data) => {
        this._handleMessage(data);
      });

      this.ws.on('error', (error) => {
        console.error('[GrokRealtime] WebSocket error:', error.message);
        this.emit('error', error);
        if (!this.connected) {
          reject(error);
        }
      });

      this.ws.on('close', (code, reason) => {
        console.log(`[GrokRealtime] WebSocket closed: ${code} ${reason}`);
        this.connected = false;
        this.stats.disconnectTime = Date.now();
        this.emit('close', { code, reason: reason.toString() });
      });
    });
  }

  /**
   * Send session configuration
   */
  _sendSessionUpdate() {
    const sessionConfig = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: this.instructions,
        voice: this.voice,
        input_audio_format: CONFIG.audio.format,
        output_audio_format: CONFIG.audio.format,
        input_audio_transcription: {
          model: 'whisper-1',
        },
        turn_detection: CONFIG.turnDetection,
        tools: [],
        tool_choice: 'auto',
        temperature: 0.8,
        max_response_output_tokens: 'inf',
      },
    };

    this._send(sessionConfig);
    console.log(`[GrokRealtime] Session configured: voice=${this.voice}`);
  }

  /**
   * Handle incoming WebSocket messages
   */
  _handleMessage(data) {
    try {
      const message = JSON.parse(data.toString());
      this.stats.messagesReceived++;

      // Emit raw event for debugging
      this.emit('message', message);

      switch (message.type) {
        case 'session.created':
          this.sessionId = message.session?.id;
          console.log(`[GrokRealtime] Session created: ${this.sessionId}`);
          this.emit('session.created', message.session);
          break;

        case 'session.updated':
          console.log('[GrokRealtime] Session updated');
          this.emit('session.updated', message.session);
          break;

        case 'input_audio_buffer.speech_started':
          console.log('[GrokRealtime] Speech started (VAD detected)');
          this.emit('speech.started');
          break;

        case 'input_audio_buffer.speech_stopped':
          console.log('[GrokRealtime] Speech stopped (VAD detected)');
          this.emit('speech.stopped');
          break;

        case 'input_audio_buffer.committed':
          console.log('[GrokRealtime] Audio buffer committed');
          this.emit('audio.committed');
          break;

        case 'conversation.item.created':
          this.emit('item.created', message.item);
          break;

        case 'response.created':
          console.log('[GrokRealtime] Response started');
          this.emit('response.started', message.response);
          break;

        case 'response.output_item.added':
          this.emit('output.added', message.item);
          break;

        case 'response.audio.delta':
          // Audio chunk received - base64 encoded PCM16
          this.stats.audioChunksReceived++;
          this.emit('audio.delta', {
            delta: message.delta, // base64 audio
            itemId: message.item_id,
          });
          break;

        case 'response.audio.done':
          console.log('[GrokRealtime] Audio response complete');
          this.emit('audio.done', message);
          break;

        case 'response.audio_transcript.delta':
          // Transcript of AI's speech
          this.emit('transcript.delta', {
            delta: message.delta,
            itemId: message.item_id,
          });
          break;

        case 'response.audio_transcript.done':
          console.log('[GrokRealtime] Transcript:', message.transcript);
          this.emit('transcript.done', message.transcript);
          break;

        case 'response.text.delta':
          this.emit('text.delta', message.delta);
          break;

        case 'response.text.done':
          this.emit('text.done', message.text);
          break;

        case 'response.done':
          console.log('[GrokRealtime] Response complete');
          this.emit('response.done', message.response);
          break;

        case 'conversation.item.input_audio_transcription.completed':
          // Transcript of user's speech
          console.log('[GrokRealtime] User said:', message.transcript);
          this.emit('user.transcript', message.transcript);
          break;

        case 'error':
          console.error('[GrokRealtime] Error:', message.error);
          this.emit('error', new Error(message.error?.message || 'Unknown error'));
          break;

        default:
          // Log unknown event types for debugging
          if (message.type) {
            console.log(`[GrokRealtime] Event: ${message.type}`);
          }
      }
    } catch (error) {
      console.error('[GrokRealtime] Failed to parse message:', error.message);
    }
  }

  /**
   * Send audio chunk (base64 PCM16)
   * @param {string} audioBase64 - Base64 encoded PCM16 audio
   */
  sendAudio(audioBase64) {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    this._send({
      type: 'input_audio_buffer.append',
      audio: audioBase64,
    });

    this.stats.audioChunksSent++;
  }

  /**
   * Send raw PCM16 buffer as audio
   * @param {Buffer} pcmBuffer - Raw PCM16 buffer (24kHz, mono, little-endian)
   */
  sendAudioBuffer(pcmBuffer) {
    const base64 = pcmBuffer.toString('base64');
    this.sendAudio(base64);
  }

  /**
   * Commit audio buffer (trigger response)
   */
  commitAudio() {
    this._send({
      type: 'input_audio_buffer.commit',
    });
  }

  /**
   * Clear audio buffer
   */
  clearAudio() {
    this._send({
      type: 'input_audio_buffer.clear',
    });
  }

  /**
   * Send text message (for testing without audio)
   * @param {string} text - Text to send as user message
   */
  sendText(text) {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    // Create conversation item
    this._send({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: text,
          },
        ],
      },
    });

    // Request response
    this._send({
      type: 'response.create',
    });
  }

  /**
   * Cancel current response
   */
  cancelResponse() {
    this._send({
      type: 'response.cancel',
    });
  }

  /**
   * Update session settings
   * @param {object} settings - Partial session settings
   */
  updateSession(settings) {
    this._send({
      type: 'session.update',
      session: settings,
    });
  }

  /**
   * Change voice
   * @param {string} voice - Voice name (ara, eve, leo, sal, rex, mika, valentin)
   */
  setVoice(voice) {
    if (!CONFIG.voices[voice]) {
      throw new Error(`Invalid voice: ${voice}. Available: ${Object.keys(CONFIG.voices).join(', ')}`);
    }
    this.voice = voice;
    this.updateSession({ voice });
  }

  /**
   * Send message to WebSocket
   */
  _send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  /**
   * Get connection statistics
   */
  getStats() {
    const duration = this.stats.disconnectTime
      ? this.stats.disconnectTime - this.stats.connectTime
      : Date.now() - this.stats.connectTime;

    return {
      ...this.stats,
      durationMs: duration,
      durationMin: (duration / 60000).toFixed(2),
      estimatedCost: `$${((duration / 60000) * 0.05).toFixed(4)}`,
    };
  }
}

// ============================================================================
// HTTP PROXY SERVER (for browser WebSocket access)
// P0/P1/P2/P3 FIX: Security hardening
// ============================================================================

class GrokRealtimeProxy {
  constructor(port = 3007) {
    this.port = port;
    this.server = null;
    this.wss = null;
    this.sessions = new Map();
    this.sessionTimeouts = new Map(); // P1 FIX: Track session timeouts

    // P1 FIX: Rate limiter
    this.rateLimiter = new RateLimiter({ windowMs: 60000, maxRequests: 20 });
  }

  /**
   * P1 FIX: Cleanup zombie sessions
   */
  cleanupSessions() {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      const timeout = this.sessionTimeouts.get(id);
      if (timeout && now - timeout > SESSION_TIMEOUT_MS) {
        console.log(`[Proxy] Cleaning up expired session: ${id}`);
        session.disconnect();
        this.sessions.delete(id);
        this.sessionTimeouts.delete(id);
      }
    }
  }

  start() {
    // P1 FIX: Periodic cleanup every 5 minutes
    setInterval(() => this.cleanupSessions(), 5 * 60 * 1000);

    // Create HTTP server
    this.server = http.createServer((req, res) => {
      // P0 FIX: Security headers
      setSecurityHeaders(res);

      // P2 FIX: CORS with origin whitelist
      const allowedOrigins = [
        'https://3a-automation.com',
        'https://dashboard.3a-automation.com',
        'http://localhost:3000',
        'http://localhost:3007'
      ];
      const origin = req.headers.origin;
      if (allowedOrigins.includes(origin) || !origin) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
      }
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // P1 FIX: Rate limiting
      const clientIP = req.socket.remoteAddress || 'unknown';
      if (!this.rateLimiter.isAllowed(clientIP)) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Too many requests' }));
        return;
      }

      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          service: 'grok-voice-realtime-proxy',
          sessions: this.sessions.size,
          maxSessions: MAX_SESSIONS,
          voices: Object.keys(CONFIG.voices),
        }));
        return;
      }

      if (req.url === '/voices') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(CONFIG.voices));
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    // Create WebSocket server for browser clients
    this.wss = new WebSocket.Server({ server: this.server });

    this.wss.on('connection', (clientWs, req) => {
      console.log('[Proxy] Browser client connected');

      // P1 FIX: Check session limit
      if (this.sessions.size >= MAX_SESSIONS) {
        console.log('[Proxy] Session limit reached, rejecting connection');
        clientWs.close(1013, 'Session limit reached');
        return;
      }

      // Parse query params for configuration
      const url = new URL(req.url, `http://localhost:${this.port}`);
      const voice = url.searchParams.get('voice') || 'ara';
      const instructions = url.searchParams.get('instructions') || undefined;

      // Create Grok session
      const session = new GrokRealtimeSession({ voice, instructions });
      // P2 FIX: Use secure random session ID
      const sessionId = `session_${secureRandomString(16)}`;
      this.sessions.set(sessionId, session);
      this.sessionTimeouts.set(sessionId, Date.now()); // P1 FIX: Track creation time

      // Connect to Grok
      session.connect()
        .then(() => {
          // Forward events to browser client
          session.on('message', (msg) => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify(msg));
            }
          });

          clientWs.send(JSON.stringify({
            type: 'proxy.connected',
            sessionId,
            voice: session.voice,
          }));
        })
        .catch((error) => {
          clientWs.send(JSON.stringify({
            type: 'proxy.error',
            error: error.message,
          }));
          clientWs.close();
        });

      // Forward messages from browser to Grok
      // P2 FIX: Validate incoming messages
      clientWs.on('message', (data) => {
        try {
          // P0 FIX: Size limit on incoming messages
          if (data.length > MAX_BODY_SIZE) {
            console.error('[Proxy] Message too large, ignoring');
            return;
          }

          const msg = JSON.parse(data.toString());

          // P2 FIX: Validate message type
          const validTypes = ['proxy.audio', 'proxy.text', 'proxy.commit', 'proxy.clear', 'proxy.voice',
            'input_audio_buffer.append', 'input_audio_buffer.commit', 'input_audio_buffer.clear',
            'conversation.item.create', 'response.create', 'response.cancel', 'session.update'];

          if (msg.type && !validTypes.includes(msg.type)) {
            console.warn(`[Proxy] Unknown message type: ${msg.type}`);
            return;
          }

          // Update session activity timestamp
          this.sessionTimeouts.set(sessionId, Date.now());

          // Handle special proxy commands
          if (msg.type === 'proxy.audio') {
            session.sendAudio(msg.audio);
          } else if (msg.type === 'proxy.text') {
            // P2 FIX: Validate text length
            if (typeof msg.text === 'string' && msg.text.length <= 10000) {
              session.sendText(msg.text);
            }
          } else if (msg.type === 'proxy.commit') {
            session.commitAudio();
          } else if (msg.type === 'proxy.clear') {
            session.clearAudio();
          } else if (msg.type === 'proxy.voice') {
            // P2 FIX: Validate voice name
            if (CONFIG.voices[msg.voice]) {
              session.setVoice(msg.voice);
            }
          } else {
            // Forward raw message to Grok
            session._send(msg);
          }
        } catch (error) {
          console.error('[Proxy] Invalid message:', error.message);
        }
      });

      // Cleanup on disconnect
      clientWs.on('close', () => {
        console.log('[Proxy] Browser client disconnected');
        const stats = session.getStats();
        console.log(`[Proxy] Session stats:`, stats);
        session.disconnect();
        this.sessions.delete(sessionId);
        this.sessionTimeouts.delete(sessionId); // P1 FIX: Clean timeout tracking
      });
    });

    this.server.listen(this.port, () => {
      console.log(`[Proxy] Grok Realtime Proxy running on port ${this.port}`);
      console.log(`[Proxy] WebSocket: ws://localhost:${this.port}`);
      console.log(`[Proxy] Health: http://localhost:${this.port}/health`);
    });
  }

  stop() {
    // Disconnect all sessions
    for (const session of this.sessions.values()) {
      session.disconnect();
    }
    this.sessions.clear();

    if (this.wss) {
      this.wss.close();
    }
    if (this.server) {
      this.server.close();
    }
  }
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

async function runHealthCheck() {
  console.log('=== Voice API Health Check (with Fallback) ===\n');

  let grokOk = false;
  let geminiOk = false;

  // ─────────────────────────────────────────────────────────────
  // TEST 1: GROK REALTIME (Primary)
  // ─────────────────────────────────────────────────────────────
  console.log('── PROVIDER 1: Grok Realtime WebSocket ──');

  const xaiKey = process.env.XAI_API_KEY;
  if (!xaiKey) {
    console.log('❌ XAI_API_KEY not set');
  } else {
    console.log('✅ XAI_API_KEY configured');

    try {
      const session = new GrokRealtimeSession();

      await Promise.race([
        session.connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout')), 10000)
        ),
      ]);

      console.log('✅ WebSocket connected');
      console.log(`✅ Voice: ${session.voice}`);

      // Wait for session.created
      await new Promise((resolve) => {
        session.once('session.created', resolve);
        setTimeout(resolve, 3000);
      });

      console.log(`✅ Session ID: ${session.sessionId || 'N/A'}`);

      session.disconnect();
      console.log('✅ Grok Realtime: OPERATIONAL');
      grokOk = true;
    } catch (error) {
      console.log(`❌ Grok connection failed: ${error.message}`);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // TEST 2: GEMINI TTS FALLBACK
  // ─────────────────────────────────────────────────────────────
  console.log('\n── PROVIDER 2: Gemini 2.5 Flash TTS (Fallback) ──');

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    console.log('❌ GEMINI_API_KEY not set');
  } else {
    console.log('✅ GEMINI_API_KEY configured');

    try {
      const gemini = new GeminiTTSFallback({ voice: 'Kore' });
      const result = await gemini.synthesize('Test audio.');

      if (result.audio && result.audio.length > 0) {
        const audioBytes = Buffer.from(result.audio, 'base64').length;
        console.log(`✅ Audio generated: ${(audioBytes / 1024).toFixed(2)} KB`);
        console.log(`✅ Format: ${result.mimeType}`);
        console.log('✅ Gemini TTS: OPERATIONAL');
        geminiOk = true;
      } else {
        console.log('❌ Gemini TTS: No audio returned');
      }
    } catch (error) {
      console.log(`❌ Gemini TTS failed: ${error.message}`);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────
  console.log('\n── SUMMARY ──');
  console.log(`Grok Realtime:    ${grokOk ? '✅ OPERATIONAL' : '❌ UNAVAILABLE'}`);
  console.log(`Gemini Fallback:  ${geminiOk ? '✅ OPERATIONAL' : '❌ UNAVAILABLE'}`);

  if (grokOk && geminiOk) {
    console.log('\n✅ SYSTEM: FULLY RESILIENT (2 providers)');
  } else if (grokOk || geminiOk) {
    console.log('\n⚠️ SYSTEM: PARTIALLY OPERATIONAL (1 provider)');
  } else {
    console.log('\n❌ SYSTEM: NO VOICE PROVIDERS AVAILABLE');
  }

  console.log(`\nGrok voices: ${Object.keys(CONFIG.voices).join(', ')}`);
  console.log(`Gemini voices: ${Object.keys(GEMINI_CONFIG.voices).join(', ')}`);
  console.log(`Grok pricing: $0.05/min | Gemini: ~$0.001/1K chars`);

  return grokOk || geminiOk;
}

async function runTextTest(text) {
  console.log('=== Voice Text Test (with Fallback) ===\n');
  console.log(`Input: "${text}"\n`);

  // ─────────────────────────────────────────────────────────────
  // TRY 1: GROK REALTIME (Full conversational)
  // ─────────────────────────────────────────────────────────────
  console.log('Trying Grok Realtime...');

  const xaiKey = process.env.XAI_API_KEY;
  if (xaiKey) {
    try {
      const session = new GrokRealtimeSession();

      await Promise.race([
        session.connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout')), 10000)
        ),
      ]);

      // Wait for session.created
      await new Promise((resolve) => {
        session.once('session.created', resolve);
        setTimeout(resolve, 2000);
      });

      // Collect response
      let fullText = '';
      let fullTranscript = '';

      session.on('text.delta', (delta) => {
        fullText += delta;
        process.stdout.write(delta);
      });

      session.on('transcript.delta', (data) => {
        fullTranscript += data.delta;
      });

      // Send text
      session.sendText(text);

      // Wait for response.done
      await new Promise((resolve) => {
        session.once('response.done', resolve);
        setTimeout(resolve, 30000);
      });

      console.log('\n');

      if (fullTranscript) {
        console.log(`\nAudio transcript: "${fullTranscript}"`);
      }

      const stats = session.getStats();
      console.log(`\n✅ Provider: Grok Realtime`);
      console.log(`Stats: ${stats.durationMin} min, ${stats.estimatedCost}`);

      session.disconnect();
      return true;
    } catch (error) {
      console.log(`⚠️ Grok failed: ${error.message}`);
      console.log('Falling back to Gemini TTS...\n');
    }
  } else {
    console.log('⚠️ XAI_API_KEY not set, using fallback...\n');
  }

  // ─────────────────────────────────────────────────────────────
  // TRY 2: GEMINI TTS FALLBACK (Text→Audio only)
  // ─────────────────────────────────────────────────────────────
  console.log('Using Gemini TTS fallback...');

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    console.error('❌ GEMINI_API_KEY not set - no fallback available');
    return false;
  }

  try {
    const gemini = new GeminiTTSFallback({ voice: 'Kore' });

    // For TTS-only mode, we generate a simple response
    // In a real scenario, you'd first call a text AI for the response
    const responseText = `Vous avez dit: "${text}". Comment puis-je vous aider davantage?`;
    console.log(`Response: ${responseText}\n`);

    const result = await gemini.synthesize(responseText);
    const audioBytes = Buffer.from(result.audio, 'base64').length;

    console.log(`\n✅ Provider: Gemini TTS (fallback mode)`);
    console.log(`Audio: ${(audioBytes / 1024).toFixed(2)} KB`);
    console.log(`Format: ${result.mimeType}`);
    console.log(`Note: TTS-only mode (no conversational AI)`);

    return true;
  } catch (error) {
    console.error(`❌ Gemini TTS failed: ${error.message}`);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Grok Voice Realtime API - WebSocket with Gemini TTS Fallback

FALLBACK CHAIN:
  1. Grok Realtime (wss://api.x.ai/v1/realtime) - Full conversational
  2. Gemini 2.5 Flash TTS - Text→Audio only (degraded mode)

Usage:
  node grok-voice-realtime.cjs [options]

Options:
  --health           Test both providers (Grok + Gemini)
  --test="message"   Send text, get audio (auto-fallback)
  --server           Start proxy server for browser clients
  --port=3007        Server port (default: 3007)
  --voice=ara        Voice (ara, eve, leo, sal, rex, mika, valentin)

Environment:
  XAI_API_KEY        xAI API key (primary)
  GEMINI_API_KEY     Google Gemini key (fallback)

Grok Voices:    ara, eve, leo, sal, rex, mika, valentin
Gemini Voices:  Kore, Puck, Zephyr, Enceladus, Algieba, Sulafat, Aoede, Charon

Pricing:
  Grok:   $0.05/min connection time
  Gemini: ~$0.001/1K characters

Examples:
  node grok-voice-realtime.cjs --health
  node grok-voice-realtime.cjs --test="Bonjour, comment ça va?"
  node grok-voice-realtime.cjs --server --port=3007
`);
    return;
  }

  if (args.includes('--health')) {
    const ok = await runHealthCheck();
    process.exit(ok ? 0 : 1);
  }

  const testArg = args.find(a => a.startsWith('--test='));
  if (testArg) {
    const text = testArg.split('=').slice(1).join('=').replace(/^["']|["']$/g, '');
    const ok = await runTextTest(text);
    process.exit(ok ? 0 : 1);
  }

  if (args.includes('--server')) {
    const portArg = args.find(a => a.startsWith('--port='));
    const port = portArg ? parseInt(portArg.split('=')[1]) : 3007;

    const proxy = new GrokRealtimeProxy(port);
    proxy.start();

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\nShutting down...');
      proxy.stop();
      process.exit(0);
    });

    return;
  }

  // Default: show help
  console.log('Use --help for usage information');
}

// Export for use as module
module.exports = {
  GrokRealtimeSession,
  GrokRealtimeProxy,
  GeminiTTSFallback,
  CONFIG,
  GEMINI_CONFIG,
};

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
