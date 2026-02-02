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
const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';

// Voice IDs for different languages/dialects
// Source: https://json2video.com/ai-voices/elevenlabs/languages/arabic/
// Verified: 02/02/2026 - Session 250.44bis
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
  ar: 'pqHfZKP75CvOlQylNhV4',         // Arabic MSA - verify in production
  ar_egyptian: 'IES4nrmZdUBHByLBde0P', // Haytham - Egyptian Conversational
  ar_gulf: '5Spsi3mCH9e7futpnGE5',     // Fares - Gulf Arabic

  // ═══════════════════════════════════════════════════════════════
  // INTERNATIONAL
  // ═══════════════════════════════════════════════════════════════
  fr: 'EXAVITQu4vr4xnSDxMaL',   // Sarah - French
  en: '21m00Tcm4TlvDq8ikWAM',   // Rachel - English female
  es: 'AZnzlk1XvdvUeBnXmlld',   // Domi - Spanish
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
   * @returns {Promise<Buffer>} Audio buffer
   */
  async textToSpeech(text, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('ElevenLabs API key not configured');
    }

    const language = options.language || 'fr';
    const voiceId = options.voiceId || this.voiceIds[language] || this.voiceIds.en;
    const model = options.model || this.defaultModel;
    const outputFormat = options.outputFormat || 'mp3_44100_128';
    const voiceSettings = { ...DEFAULT_VOICE_SETTINGS, ...options.voiceSettings };

    const url = `${this.baseUrl}/text-to-speech/${voiceId}?output_format=${outputFormat}`;

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
    return Buffer.from(arrayBuffer);
  }

  /**
   * Stream text to speech (for real-time applications)
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
    const model = options.model || MODELS.flash_v2_5; // Use flash for streaming
    const outputFormat = options.outputFormat || 'mp3_44100_128';
    const voiceSettings = { ...DEFAULT_VOICE_SETTINGS, ...options.voiceSettings };

    const url = `${this.baseUrl}/text-to-speech/${voiceId}/stream?output_format=${outputFormat}`;

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
  getVoiceIdForLanguage,
};
