#!/usr/bin/env node
/**
 * VocalIA - ElevenLabs Integration Client
 * Version: 1.0.0
 * Created: 2026-02-02 - Session 250.44bis
 *
 * Features:
 *   - TTS (Text-to-Speech) with Ghizlane voice for Darija
 *   - STT (Speech-to-Text) with Scribe model (Maghrebi support)
 *   - Voice cloning capability
 *   - Streaming support
 *
 * Usage:
 *   const { ElevenLabsClient } = require('./elevenlabs-client.cjs');
 *   const client = new ElevenLabsClient();
 *
 *   // TTS
 *   const audio = await client.textToSpeech('مرحبا', { language: 'ary' });
 *
 *   // STT
 *   const transcript = await client.speechToText(audioBuffer);
 *
 * Configuration:
 *   Set ELEVENLABS_API_KEY in .env file
 *   Get key from: https://elevenlabs.io/app/settings/api-keys
 *
 * Sources:
 *   - https://elevenlabs.io/docs/api-reference/text-to-speech/convert
 *   - https://elevenlabs.io/docs/api-reference/speech-to-text
 *   - https://json2video.com/ai-voices/elevenlabs/voices/OfGMGmhShO8iL9jCkXy8/
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const fs = require('fs');

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// Session 250.45: Geographic routing for lowest latency
// Source: https://elevenlabs.io/docs/developers/best-practices/latency-optimization
const ELEVENLABS_BASE_URL = process.env.ELEVENLABS_USE_GLOBAL === 'true'
  ? 'https://api-global-preview.elevenlabs.io/v1'  // Geographic routing
  : 'https://api.elevenlabs.io/v1';

// Session 250.45: Latency optimization levels (0-4)
// 0 = default, 4 = max speed (may mispronounce numbers/dates)
const OPTIMIZE_STREAMING_LATENCY = parseInt(process.env.ELEVENLABS_LATENCY_LEVEL || '3', 10);

// Voice IDs for different languages/dialects
// Source: https://json2video.com/ai-voices/elevenlabs/
// Verified: 03/02/2026 - Session 250.63 (added male voices for FR/EN/ES/AR)
// BUG FIX: Added ar_male, fr_male, en_male, es_male (were undefined, referenced in voice-api-resilient.cjs)
const VOICE_IDS = {
  // ═══════════════════════════════════════════════════════════════
  // MOROCCAN DARIJA - PRIMARY for VocalIA
  // ═══════════════════════════════════════════════════════════════
  ary: 'OfGMGmhShO8iL9jCkXy8',        // Ghizlane - Female Moroccan Darija (VERIFIED)
  ary_female: 'OfGMGmhShO8iL9jCkXy8', // Ghizlane - Alias
  ary_male: 'PmGnwGtnBs40iau7JfoF',   // Jawad - Male Moroccan Darija (USER PROVIDED 02/02/2026)
  ary_male_jawad: 'PmGnwGtnBs40iau7JfoF', // Jawad - Explicit alias
  ary_male_ali: '5lXEHh42xcasVuJofypc',   // Ali - Male Moroccan
  ary_male_hamid: 'A9ATTqUUQ6GHu0coCz8t', // Hamid - Male Moroccan (backup option)

  // ═══════════════════════════════════════════════════════════════
  // OTHER ARABIC DIALECTS
  // ═══════════════════════════════════════════════════════════════
  ar: 'pqHfZKP75CvOlQylNhV4',         // Bill - Arabic MSA Female (default)
  ar_female: 'pqHfZKP75CvOlQylNhV4',  // Bill - Alias
  ar_male: 'yrPIy5b3iLnVLIBfUSw8',    // Amr - Male MSA Egyptian (Session 250.63)
  ar_egyptian: 'IES4nrmZdUBHByLBde0P', // Haytham - Egyptian Conversational
  ar_gulf: '5Spsi3mCH9e7futpnGE5',     // Fares - Gulf Arabic Male

  // ═══════════════════════════════════════════════════════════════
  // INTERNATIONAL - FRENCH
  // ═══════════════════════════════════════════════════════════════
  fr: 'EXAVITQu4vr4xnSDxMaL',         // Sarah - French Female (default)
  fr_female: 'EXAVITQu4vr4xnSDxMaL',  // Sarah - Alias
  fr_male: '6pccwT1F6VJ5KMrxQqcX',    // Abdel - French Male (Session 250.63)

  // ═══════════════════════════════════════════════════════════════
  // INTERNATIONAL - ENGLISH
  // ═══════════════════════════════════════════════════════════════
  en: '21m00Tcm4TlvDq8ikWAM',         // Rachel - English Female (default)
  en_female: '21m00Tcm4TlvDq8ikWAM',  // Rachel - Alias
  en_male: 'pNInz6obpgDQGcFmaJgB',    // Adam - English Male (Session 250.63)

  // ═══════════════════════════════════════════════════════════════
  // INTERNATIONAL - SPANISH
  // ═══════════════════════════════════════════════════════════════
  es: 'AZnzlk1XvdvUeBnXmlld',         // Domi - Spanish Female (default)
  es_female: 'AZnzlk1XvdvUeBnXmlld',  // Domi - Alias
  es_male: 'RyfjEHnKbtma4Srae2za',    // Juan Carlos - Spanish Male (Session 250.63)

  // ═══════════════════════════════════════════════════════════════
  // USER-PROVIDED ARABIC/DARIJA NAME ALIASES (Session 250.63)
  // ═══════════════════════════════════════════════════════════════
  asmaa: 'qi4PkV9c01kb869Vh7Su',      // Asmaa - Arabic Female (exact match)
  adam: 'pNInz6obpgDQGcFmaJgB',       // Adam - English Male (exact match)
  liliya: 'OfGMGmhShO8iL9jCkXy8',     // Liliya → Ghizlane (Darija Female)
  nelya: 'VwC51uc4PUblWEJSPzeo',      // Nelya → Abrar (Arabic Female)
  ikhlass: 'qi4PkV9c01kb869Vh7Su',    // Ikhlass → Asmaa (Arabic Female)
  najlae: 'VwC51uc4PUblWEJSPzeo',     // Najlae → Abrar (Arabic Female)
  liwae: '5lXEHh42xcasVuJofypc',      // Liwae → Ali (Darija Male)
};

// Model IDs
const MODELS = {
  multilingual_v2: 'eleven_multilingual_v2',      // Highest quality, all languages
  flash_v2_5: 'eleven_flash_v2_5',                // Low latency (75ms), real-time
  turbo_v2_5: 'eleven_turbo_v2_5',                // Fast, good quality
  scribe_v1: 'scribe_v1',                         // STT model
  scribe_v2: 'scribe_v2',                         // STT model v2 (latest)
};

// Default voice settings
const DEFAULT_VOICE_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.5,
  use_speaker_boost: true,
};

// Session 250.45: Low-latency voice settings (faster but slightly less quality)
const LOW_LATENCY_VOICE_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0,            // Disable style for speed
  use_speaker_boost: false,  // Disable for speed
};

// TTS Phrase Cache for common phrases (reduces latency for repeated phrases)
const TTS_CACHE = new Map();
const TTS_CACHE_MAX_SIZE = 100;
const TTS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// ═══════════════════════════════════════════════════════════════
// ELEVENLABS CLIENT CLASS
// ═══════════════════════════════════════════════════════════════

class ElevenLabsClient {
  constructor(apiKey = null) {
    this.apiKey = apiKey || ELEVENLABS_API_KEY;
    this.baseUrl = ELEVENLABS_BASE_URL;
    this.voiceIds = { ...VOICE_IDS };
    this.defaultModel = MODELS.multilingual_v2;

    if (!this.apiKey) {
      console.warn('⚠️  ELEVENLABS_API_KEY not set. ElevenLabs features will be disabled.');
    }
  }

  /**
   * Check if ElevenLabs is configured
   */
  isConfigured() {
    return !!this.apiKey;
  }

  /**
   * Get headers for API requests
   */
  getHeaders(contentType = 'application/json') {
    return {
      'xi-api-key': this.apiKey,
      'Content-Type': contentType,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // TEXT-TO-SPEECH (TTS)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Convert text to speech
   *
   * @param {string} text - Text to convert to speech
   * @param {Object} options - Options
   * @param {string} options.language - Language code (fr, en, es, ar, ary)
   * @param {string} options.voiceId - Override voice ID
   * @param {string} options.model - Model ID (default: eleven_multilingual_v2)
   * @param {string} options.outputFormat - Output format (mp3_44100_128, pcm_16000, etc.)
   * @param {Object} options.voiceSettings - Voice settings override
   * @param {boolean} options.lowLatency - Use low-latency settings (Session 250.45)
   * @param {boolean} options.useCache - Use phrase cache (Session 250.45)
   * @returns {Promise<Buffer>} Audio buffer
   */
  async textToSpeech(text, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('ElevenLabs API key not configured');
    }

    const language = options.language || 'fr';
    const voiceId = options.voiceId || this.voiceIds[language] || this.voiceIds.en;
    const lowLatency = options.lowLatency || false;
    const useCache = options.useCache !== false; // Default true

    // Session 250.45: Use Flash model for low-latency, multilingual for quality
    const model = options.model || (lowLatency ? MODELS.flash_v2_5 : this.defaultModel);
    const outputFormat = options.outputFormat || (lowLatency ? 'pcm_22050' : 'mp3_44100_128');
    const voiceSettings = lowLatency
      ? { ...LOW_LATENCY_VOICE_SETTINGS, ...options.voiceSettings }
      : { ...DEFAULT_VOICE_SETTINGS, ...options.voiceSettings };

    // Session 250.45: Check cache for common phrases
    if (useCache) {
      const cacheKey = `${voiceId}:${model}:${text.substring(0, 100)}`;
      const cached = TTS_CACHE.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < TTS_CACHE_TTL) {
        console.log('[ElevenLabs] Cache hit for TTS phrase');
        return cached.audio;
      }
    }

    // Session 250.45: Add optimize_streaming_latency parameter
    const url = `${this.baseUrl}/text-to-speech/${voiceId}?output_format=${outputFormat}&optimize_streaming_latency=${OPTIMIZE_STREAMING_LATENCY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        text,
        model_id: model,
        voice_settings: voiceSettings,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs TTS error (${response.status}): ${error}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    // Session 250.45: Cache result
    if (useCache && text.length < 200) {  // Only cache short phrases
      const cacheKey = `${voiceId}:${model}:${text.substring(0, 100)}`;
      if (TTS_CACHE.size >= TTS_CACHE_MAX_SIZE) {
        // Remove oldest entry
        const oldestKey = TTS_CACHE.keys().next().value;
        TTS_CACHE.delete(oldestKey);
      }
      TTS_CACHE.set(cacheKey, { audio: audioBuffer, timestamp: Date.now() });
    }

    return audioBuffer;
  }

  /**
   * Stream text to speech (for real-time applications)
   * Session 250.45: Optimized with Flash v2.5 model + latency params
   *
   * @param {string} text - Text to convert
   * @param {Object} options - Same as textToSpeech
   * @returns {Promise<ReadableStream>} Audio stream
   */
  async streamTextToSpeech(text, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('ElevenLabs API key not configured');
    }

    const language = options.language || 'fr';
    const voiceId = options.voiceId || this.voiceIds[language] || this.voiceIds.en;
    const model = options.model || MODELS.flash_v2_5; // Flash = 135ms TTFB
    const outputFormat = options.outputFormat || 'pcm_22050';  // Lower quality = faster
    // Session 250.45: Use low-latency settings for streaming
    const voiceSettings = { ...LOW_LATENCY_VOICE_SETTINGS, ...options.voiceSettings };

    // Session 250.45: Max latency optimization for streaming (level 4)
    const url = `${this.baseUrl}/text-to-speech/${voiceId}/stream?output_format=${outputFormat}&optimize_streaming_latency=4`;

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        text,
        model_id: model,
        voice_settings: voiceSettings,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs TTS stream error (${response.status}): ${error}`);
    }

    return response.body;
  }

  /**
   * Convert text to speech for Darija (Moroccan Arabic)
   * Convenience method using Ghizlane voice
   *
   * @param {string} text - Darija text
   * @param {Object} options - Additional options
   * @returns {Promise<Buffer>} Audio buffer
   */
  async textToSpeechDarija(text, options = {}) {
    return this.textToSpeech(text, {
      ...options,
      language: 'ary',
      voiceId: this.voiceIds.ary, // Ghizlane
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // SPEECH-TO-TEXT (STT)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Transcribe audio to text using Scribe
   *
   * @param {Buffer|string} audio - Audio buffer or file path
   * @param {Object} options - Options
   * @param {string} options.language - Language hint (ar, ar-MA for Maghrebi)
   * @param {boolean} options.diarization - Enable speaker diarization
   * @param {number} options.numSpeakers - Number of speakers (if diarization)
   * @returns {Promise<Object>} Transcription result
   */
  async speechToText(audio, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('ElevenLabs API key not configured');
    }

    // Read file if path provided
    let audioBuffer = audio;
    if (typeof audio === 'string') {
      audioBuffer = fs.readFileSync(audio);
    }

    // Create form data
    const formData = new FormData();
    formData.append('audio', new Blob([audioBuffer]), 'audio.mp3');

    if (options.language) {
      formData.append('language_code', options.language);
    }

    if (options.diarization) {
      formData.append('diarize', 'true');
      if (options.numSpeakers) {
        formData.append('num_speakers', options.numSpeakers.toString());
      }
    }

    const url = `${this.baseUrl}/speech-to-text`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
        // Don't set Content-Type for FormData, let fetch set it with boundary
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs STT error (${response.status}): ${error}`);
    }

    return response.json();
  }

  /**
   * Transcribe Darija (Moroccan Arabic) audio
   * Convenience method with Maghrebi language hint
   *
   * @param {Buffer|string} audio - Audio buffer or file path
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Transcription result
   */
  async speechToTextDarija(audio, options = {}) {
    return this.speechToText(audio, {
      ...options,
      language: 'ar-MA', // Maghrebi Arabic hint
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // VOICE MANAGEMENT
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get list of available voices
   *
   * @returns {Promise<Array>} List of voices
   */
  async getVoices() {
    if (!this.isConfigured()) {
      throw new Error('ElevenLabs API key not configured');
    }

    const response = await fetch(`${this.baseUrl}/voices`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs voices error (${response.status}): ${error}`);
    }

    const data = await response.json();
    return data.voices;
  }

  /**
   * Get voice by ID
   *
   * @param {string} voiceId - Voice ID
   * @returns {Promise<Object>} Voice details
   */
  async getVoice(voiceId) {
    if (!this.isConfigured()) {
      throw new Error('ElevenLabs API key not configured');
    }

    const response = await fetch(`${this.baseUrl}/voices/${voiceId}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs voice error (${response.status}): ${error}`);
    }

    return response.json();
  }

  /**
   * Clone a voice from audio samples
   *
   * @param {string} name - Name for the cloned voice
   * @param {Array<Buffer|string>} samples - Audio samples (1-25 files)
   * @param {string} description - Voice description
   * @returns {Promise<Object>} Cloned voice details
   */
  async cloneVoice(name, samples, description = '') {
    if (!this.isConfigured()) {
      throw new Error('ElevenLabs API key not configured');
    }

    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);

    for (let i = 0; i < samples.length; i++) {
      let sampleBuffer = samples[i];
      if (typeof sampleBuffer === 'string') {
        sampleBuffer = fs.readFileSync(sampleBuffer);
      }
      formData.append('files', new Blob([sampleBuffer]), `sample_${i}.mp3`);
    }

    const response = await fetch(`${this.baseUrl}/voices/add`, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs clone error (${response.status}): ${error}`);
    }

    return response.json();
  }

  // ─────────────────────────────────────────────────────────────────
  // ACCOUNT
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get account subscription info and usage
   *
   * @returns {Promise<Object>} Subscription info
   */
  async getSubscription() {
    if (!this.isConfigured()) {
      throw new Error('ElevenLabs API key not configured');
    }

    const response = await fetch(`${this.baseUrl}/user/subscription`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs subscription error (${response.status}): ${error}`);
    }

    return response.json();
  }

  /**
   * Get current user info
   *
   * @returns {Promise<Object>} User info
   */
  async getUser() {
    if (!this.isConfigured()) {
      throw new Error('ElevenLabs API key not configured');
    }

    const response = await fetch(`${this.baseUrl}/user`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs user error (${response.status}): ${error}`);
    }

    return response.json();
  }

  // ─────────────────────────────────────────────────────────────────
  // HEALTH CHECK
  // ─────────────────────────────────────────────────────────────────

  /**
   * Check ElevenLabs API health
   *
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    const result = {
      configured: this.isConfigured(),
      connected: false,
      voices: 0,
      subscription: null,
      ghizlaneAvailable: false,
      error: null,
    };

    if (!this.isConfigured()) {
      result.error = 'ELEVENLABS_API_KEY not configured';
      return result;
    }

    try {
      // Check connection by getting voices
      const voices = await this.getVoices();
      result.connected = true;
      result.voices = voices.length;

      // Check if Ghizlane voice is available
      result.ghizlaneAvailable = voices.some(v => v.voice_id === this.voiceIds.ary);

      // Get subscription info
      result.subscription = await this.getSubscription();

      return result;
    } catch (error) {
      result.error = error.message;
      return result;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // SESSION 250.45: PHRASE PRE-CACHING
  // ─────────────────────────────────────────────────────────────────

  /**
   * Pre-cache common phrases for faster response
   * Call this at startup to warm up the cache
   *
   * @param {Array<string>} languages - Languages to pre-cache (default: ['fr', 'en', 'ary'])
   * @returns {Promise<Object>} Cache stats
   */
  async preCacheCommonPhrases(languages = ['fr', 'en', 'ary']) {
    if (!this.isConfigured()) {
      console.warn('[ElevenLabs] Cannot pre-cache: API key not configured');
      return { success: false, cached: 0 };
    }

    const COMMON_PHRASES = {
      fr: [
        'Bonjour, comment puis-je vous aider?',
        'Merci pour votre appel.',
        'Un instant s\'il vous plaît.',
        'Je vous transfere vers un conseiller.',
        'Au revoir et bonne journée!'
      ],
      en: [
        'Hello, how can I help you?',
        'Thank you for calling.',
        'One moment please.',
        'Let me transfer you to an agent.',
        'Goodbye and have a great day!'
      ],
      es: [
        'Hola, ¿cómo puedo ayudarle?',
        'Gracias por llamar.',
        'Un momento por favor.',
        'Le transfiero con un agente.',
        '¡Adiós y que tenga un buen día!'
      ],
      ar: [
        'مرحبا، كيف يمكنني مساعدتك؟',
        'شكرا لاتصالك.',
        'لحظة من فضلك.',
        'سأحولك إلى موظف.',
        'مع السلامة!'
      ],
      ary: [
        'السلام، كيفاش نقدر نعاونك؟',
        'شكرا على الاتصال ديالك.',
        'تسنا شوية عافاك.',
        'غادي نحولك لواحد المستشار.',
        'بسلامة وتهلا فراسك!'
      ]
    };

    let cached = 0;
    const errors = [];

    console.log(`[ElevenLabs] Pre-caching phrases for: ${languages.join(', ')}`);

    for (const lang of languages) {
      const phrases = COMMON_PHRASES[lang];
      if (!phrases) continue;

      for (const phrase of phrases) {
        try {
          await this.textToSpeech(phrase, {
            language: lang,
            lowLatency: true,
            useCache: true
          });
          cached++;
        } catch (e) {
          errors.push({ lang, phrase: phrase.substring(0, 20), error: e.message });
        }
      }
    }

    console.log(`[ElevenLabs] Pre-cached ${cached} phrases (${errors.length} errors)`);

    return {
      success: errors.length === 0,
      cached,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return {
      size: TTS_CACHE.size,
      maxSize: TTS_CACHE_MAX_SIZE,
      ttlMs: TTS_CACHE_TTL
    };
  }

  /**
   * Clear TTS cache
   */
  clearCache() {
    TTS_CACHE.clear();
    console.log('[ElevenLabs] TTS cache cleared');
  }
}

// ═══════════════════════════════════════════════════════════════
// VOICE IDS REFERENCE
// ═══════════════════════════════════════════════════════════════

/**
 * Get voice ID for a language
 *
 * @param {string} language - Language code
 * @returns {string|null} Voice ID
 */
function getVoiceIdForLanguage(language) {
  return VOICE_IDS[language] || null;
}

// ═══════════════════════════════════════════════════════════════
// CLI MODE
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' VocalIA - ElevenLabs Client v1.0.0');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const client = new ElevenLabsClient();

  // Parse CLI args
  const args = process.argv.slice(2);

  if (args.includes('--health') || args.length === 0) {
    console.log('📊 Health Check...');
    console.log('');

    const health = await client.healthCheck();

    console.log(`   API Key Configured: ${health.configured ? '✅' : '❌'}`);
    console.log(`   API Connected:      ${health.connected ? '✅' : '❌'}`);
    console.log(`   Voices Available:   ${health.voices}`);
    console.log(`   Ghizlane (Darija):  ${health.ghizlaneAvailable ? '✅' : '❌'}`);

    if (health.subscription) {
      console.log('');
      console.log('📦 Subscription:');
      console.log(`   Tier:       ${health.subscription.tier}`);
      console.log(`   Characters: ${health.subscription.character_count}/${health.subscription.character_limit}`);
    }

    if (health.error) {
      console.log('');
      console.log(`❌ Error: ${health.error}`);
    }

    return;
  }

  if (args.includes('--voices')) {
    console.log('🎤 Available Voices...');
    console.log('');

    const voices = await client.getVoices();

    // Filter Arabic voices
    const arabicVoices = voices.filter(v =>
      v.labels?.language === 'ar' ||
      v.labels?.accent?.toLowerCase().includes('arabic') ||
      v.labels?.accent?.toLowerCase().includes('moroccan') ||
      v.name.toLowerCase().includes('ghizlane')
    );

    console.log(`   Total Voices: ${voices.length}`);
    console.log(`   Arabic Voices: ${arabicVoices.length}`);
    console.log('');

    if (arabicVoices.length > 0) {
      console.log('   Arabic/Darija Voices:');
      arabicVoices.forEach(v => {
        console.log(`   - ${v.name} (${v.voice_id})`);
        console.log(`     Labels: ${JSON.stringify(v.labels || {})}`);
      });
    }

    return;
  }

  if (args.includes('--tts')) {
    const textIndex = args.indexOf('--tts') + 1;
    const text = args[textIndex] || 'كيفاش الحال؟';
    const lang = args.includes('--lang') ? args[args.indexOf('--lang') + 1] : 'ary';

    console.log(`🔊 TTS: "${text}" (${lang})`);
    console.log('');

    const audio = await client.textToSpeech(text, { language: lang });
    const outputPath = `./test-tts-${lang}.mp3`;
    fs.writeFileSync(outputPath, audio);

    console.log(`   ✅ Audio saved to: ${outputPath}`);
    console.log(`   Size: ${audio.length} bytes`);

    return;
  }

  // Show help
  console.log('Usage:');
  console.log('  node elevenlabs-client.cjs --health    Check API health');
  console.log('  node elevenlabs-client.cjs --voices    List available voices');
  console.log('  node elevenlabs-client.cjs --tts "text" [--lang ary]   Generate TTS');
  console.log('');
  console.log('Voice IDs:');
  Object.entries(VOICE_IDS).forEach(([lang, id]) => {
    console.log(`  ${lang}: ${id}`);
  });
}

// Run CLI if called directly
if (require.main === module) {
  main().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
  ElevenLabsClient,
  VOICE_IDS,
  MODELS,
  DEFAULT_VOICE_SETTINGS,
  LOW_LATENCY_VOICE_SETTINGS,
  getVoiceIdForLanguage,
  OPTIMIZE_STREAMING_LATENCY,
  TTS_CACHE,  // Expose for testing
};
