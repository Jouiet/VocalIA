#!/usr/bin/env node
/**
 * VocalIA - Lahajati.ai Integration Client
 * Version: 1.0.0
 * Created: 2026-02-02 - Session 250.44bis
 *
 * Lahajati.ai - Arabic-focused TTS/STT platform
 * Website: https://lahajati.ai/en
 *
 * Features:
 *   - TTS: 500+ voices across 192+ Arabic dialects (including Moroccan Darija)
 *   - STT: 99% accuracy claimed for Arabic dialects
 *   - Voice cloning: Requires 30-second sample
 *   - GDPR compliant, servers in Arab region
 *
 * Pricing:
 *   - Free tier: 10,000 points/month (1 point = 1 character)
 *   - Commercial use allowed on paid tiers
 *
 * Usage:
 *   const { LahajatiClient } = require('./lahajati-client.cjs');
 *   const client = new LahajatiClient();
 *
 *   // TTS
 *   const audio = await client.textToSpeech('كيفاش الحال', { dialect: 'moroccan' });
 *
 *   // STT
 *   const transcript = await client.speechToText(audioBuffer);
 *
 * Configuration:
 *   Set LAHAJATI_API_KEY in .env file
 *   Get key from: https://lahajati.ai/en (API dashboard after registration)
 *
 * Sources:
 *   - https://lahajati.ai/en
 *   - https://lahajati.ai/ar/docs (API documentation)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const fs = require('fs');

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const LAHAJATI_API_KEY = process.env.LAHAJATI_API_KEY;
const LAHAJATI_BASE_URL = 'https://api.lahajati.ai/v1'; // Note: Verify actual URL from docs

// Supported dialects
// Source: https://lahajati.ai/en
const DIALECTS = {
  msa: 'modern_standard_arabic',       // Modern Standard Arabic
  egyptian: 'egyptian',                 // Egyptian Arabic
  moroccan: 'moroccan',                 // Moroccan Darija - PRIMARY for VocalIA
  tunisian: 'tunisian',                 // Tunisian Arabic
  algerian: 'algerian',                 // Algerian Arabic
  libyan: 'libyan',                     // Libyan Arabic
  saudi_hejazi: 'saudi_hejazi',         // Saudi Hejazi
  saudi_nejdi: 'saudi_nejdi',           // Saudi Nejdi
  lebanese: 'lebanese',                 // Lebanese Arabic
  syrian: 'syrian',                     // Syrian Arabic
  palestinian: 'palestinian',           // Palestinian Arabic
  iraqi: 'iraqi',                       // Iraqi Arabic
  yemeni: 'yemeni',                     // Yemeni Arabic
  sudanese: 'sudanese',                 // Sudanese Arabic
  omani: 'omani',                       // Omani Arabic
  gulf: 'gulf',                         // Gulf Arabic (Kuwait, Bahrain, Qatar, UAE)
};

// Map VocalIA language codes to Lahajati dialects
const LANGUAGE_TO_DIALECT = {
  ary: 'moroccan',      // Darija → Moroccan
  ar: 'msa',            // Arabic MSA
  fr: null,             // French not supported
  en: null,             // English not supported
  es: null,             // Spanish not supported
};

// Output formats
const OUTPUT_FORMATS = {
  mp3_128: 'mp3_128',
  mp3_192: 'mp3_192',
  mp3_320: 'mp3_320',
  wav: 'wav',
  flac: 'flac',
  m4a: 'm4a',
};

// ═══════════════════════════════════════════════════════════════
// LAHAJATI CLIENT CLASS
// ═══════════════════════════════════════════════════════════════

class LahajatiClient {
  constructor(apiKey = null) {
    this.apiKey = apiKey || LAHAJATI_API_KEY;
    this.baseUrl = LAHAJATI_BASE_URL;

    if (!this.apiKey) {
      console.warn('⚠️  LAHAJATI_API_KEY not set. Lahajati features will be disabled.');
    }
  }

  /**
   * Check if Lahajati is configured
   */
  isConfigured() {
    return !!this.apiKey;
  }

  /**
   * Get headers for API requests
   */
  getHeaders(contentType = 'application/json') {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': contentType,
    };
  }

  /**
   * Check if a language is supported
   *
   * @param {string} language - VocalIA language code
   * @returns {boolean} True if supported
   */
  supportsLanguage(language) {
    const dialect = LANGUAGE_TO_DIALECT[language];
    return dialect !== null && dialect !== undefined;
  }

  /**
   * Get dialect for a language code
   *
   * @param {string} language - VocalIA language code
   * @returns {string|null} Lahajati dialect code
   */
  getDialect(language) {
    return LANGUAGE_TO_DIALECT[language] || null;
  }

  // ─────────────────────────────────────────────────────────────────
  // TEXT-TO-SPEECH (TTS)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Convert text to speech
   *
   * NOTE: API endpoint structure is UNVERIFIED.
   * Lahajati.ai does not publish public API documentation.
   * Verify actual endpoint at: https://lahajati.ai/ar/docs (requires account)
   *
   * @param {string} text - Text to convert (Arabic)
   * @param {Object} options - Options
   * @param {string} options.dialect - Dialect code (moroccan, egyptian, etc.)
   * @param {string} options.language - VocalIA language code (ary, ar)
   * @param {string} options.voice - Voice ID (from Lahajati voice library)
   * @param {string} options.format - Output format (mp3_128, wav, etc.)
   * @param {number} options.speed - Speech speed (0.5-2.0)
   * @param {string} options.emotion - Emotion (neutral, happy, sad, angry)
   * @returns {Promise<Buffer>} Audio buffer
   */
  async textToSpeech(text, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('Lahajati API key not configured');
    }

    // Determine dialect
    let dialect = options.dialect;
    if (!dialect && options.language) {
      dialect = this.getDialect(options.language);
    }
    dialect = dialect || DIALECTS.moroccan; // Default to Moroccan

    const format = options.format || OUTPUT_FORMATS.mp3_128;
    const speed = options.speed || 1.0;
    const emotion = options.emotion || 'neutral';

    // NOTE: This endpoint structure is hypothetical
    // Verify actual structure from https://lahajati.ai/ar/docs
    const url = `${this.baseUrl}/tts`;

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        text,
        dialect,
        voice_id: options.voice,
        output_format: format,
        speed,
        emotion,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Lahajati TTS error (${response.status}): ${error}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Convert Darija text to speech
   * Convenience method for Moroccan Arabic
   *
   * @param {string} text - Darija text
   * @param {Object} options - Additional options
   * @returns {Promise<Buffer>} Audio buffer
   */
  async textToSpeechDarija(text, options = {}) {
    return this.textToSpeech(text, {
      ...options,
      dialect: DIALECTS.moroccan,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // SPEECH-TO-TEXT (STT)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Transcribe audio to text
   *
   * NOTE: API endpoint structure is UNVERIFIED.
   * Lahajati.ai does not publish public API documentation.
   * Verify actual endpoint at: https://lahajati.ai/ar/docs (requires account)
   *
   * @param {Buffer|string} audio - Audio buffer or file path
   * @param {Object} options - Options
   * @param {string} options.dialect - Expected dialect
   * @param {boolean} options.diarization - Enable speaker diarization
   * @param {string} options.outputFormat - Output format (txt, json, srt, vtt)
   * @returns {Promise<Object>} Transcription result
   */
  async speechToText(audio, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('Lahajati API key not configured');
    }

    // Read file if path provided
    let audioBuffer = audio;
    if (typeof audio === 'string') {
      audioBuffer = fs.readFileSync(audio);
    }

    // Create form data
    const formData = new FormData();
    formData.append('audio', new Blob([audioBuffer]), 'audio.mp3');

    if (options.dialect) {
      formData.append('dialect', options.dialect);
    }

    if (options.diarization) {
      formData.append('diarize', 'true');
    }

    // NOTE: This endpoint structure is hypothetical
    // Verify actual structure from https://lahajati.ai/ar/docs
    const url = `${this.baseUrl}/stt`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Lahajati STT error (${response.status}): ${error}`);
    }

    return response.json();
  }

  /**
   * Transcribe Darija audio
   * Convenience method for Moroccan Arabic
   *
   * @param {Buffer|string} audio - Audio buffer or file path
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Transcription result
   */
  async speechToTextDarija(audio, options = {}) {
    return this.speechToText(audio, {
      ...options,
      dialect: DIALECTS.moroccan,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // VOICE CLONING
  // ─────────────────────────────────────────────────────────────────

  /**
   * Clone a voice from audio sample
   * Requires minimum 30 seconds of audio
   *
   * @param {string} name - Name for the cloned voice
   * @param {Buffer|string} sample - Audio sample (30+ seconds)
   * @param {string} description - Voice description
   * @returns {Promise<Object>} Cloned voice details
   */
  async cloneVoice(name, sample, description = '') {
    if (!this.isConfigured()) {
      throw new Error('Lahajati API key not configured');
    }

    let sampleBuffer = sample;
    if (typeof sample === 'string') {
      sampleBuffer = fs.readFileSync(sample);
    }

    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);
    formData.append('audio', new Blob([sampleBuffer]), 'voice_sample.mp3');

    // NOTE: This endpoint structure is hypothetical
    const url = `${this.baseUrl}/voice-clone`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Lahajati clone error (${response.status}): ${error}`);
    }

    return response.json();
  }

  // ─────────────────────────────────────────────────────────────────
  // ACCOUNT
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get account info and remaining points
   *
   * @returns {Promise<Object>} Account info
   */
  async getAccount() {
    if (!this.isConfigured()) {
      throw new Error('Lahajati API key not configured');
    }

    // NOTE: This endpoint structure is hypothetical
    const url = `${this.baseUrl}/account`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Lahajati account error (${response.status}): ${error}`);
    }

    return response.json();
  }

  // ─────────────────────────────────────────────────────────────────
  // HEALTH CHECK
  // ─────────────────────────────────────────────────────────────────

  /**
   * Check Lahajati API health
   *
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    const result = {
      configured: this.isConfigured(),
      connected: false,
      supportedDialects: Object.keys(DIALECTS).length,
      moroccanSupported: true,
      account: null,
      error: null,
    };

    if (!this.isConfigured()) {
      result.error = 'LAHAJATI_API_KEY not configured';
      return result;
    }

    try {
      // Check connection by getting account info
      const account = await this.getAccount();
      result.connected = true;
      result.account = account;

      return result;
    } catch (error) {
      // Don't fail health check on API error - just report it
      result.error = error.message;
      return result;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// CLI MODE
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' VocalIA - Lahajati.ai Client v1.0.0');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('  Website: https://lahajati.ai/en');
  console.log('  API Docs: https://lahajati.ai/ar/docs');
  console.log('');

  const client = new LahajatiClient();

  // Parse CLI args
  const args = process.argv.slice(2);

  if (args.includes('--health') || args.length === 0) {
    console.log('📊 Health Check...');
    console.log('');

    const health = await client.healthCheck();

    console.log(`   API Key Configured: ${health.configured ? '✅' : '❌'}`);
    console.log(`   API Connected:      ${health.connected ? '✅' : '⚠️ (verify API docs)'}`);
    console.log(`   Dialects Supported: ${health.supportedDialects}`);
    console.log(`   Moroccan (Darija):  ${health.moroccanSupported ? '✅' : '❌'}`);

    if (health.account) {
      console.log('');
      console.log('📦 Account:');
      console.log(`   ${JSON.stringify(health.account, null, 2)}`);
    }

    if (health.error) {
      console.log('');
      console.log(`⚠️  Note: ${health.error}`);
    }

    console.log('');
    console.log('ℹ️  Note: API endpoint structures are UNVERIFIED.');
    console.log('   Lahajati.ai requires account login for API documentation.');
    console.log('   Verify endpoints at: https://lahajati.ai/ar/docs');

    return;
  }

  if (args.includes('--dialects')) {
    console.log('🗣️  Supported Dialects:');
    console.log('');
    Object.entries(DIALECTS).forEach(([key, value]) => {
      const primary = key === 'moroccan' ? ' ← PRIMARY (Darija)' : '';
      console.log(`   ${key}: ${value}${primary}`);
    });
    return;
  }

  // Show help
  console.log('Usage:');
  console.log('  node lahajati-client.cjs --health     Check API health');
  console.log('  node lahajati-client.cjs --dialects   List supported dialects');
  console.log('');
  console.log('VocalIA Language Mapping:');
  Object.entries(LANGUAGE_TO_DIALECT).forEach(([lang, dialect]) => {
    const supported = dialect ? `→ ${dialect}` : '→ NOT SUPPORTED';
    console.log(`  ${lang}: ${supported}`);
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
  LahajatiClient,
  DIALECTS,
  LANGUAGE_TO_DIALECT,
  OUTPUT_FORMATS,
};
