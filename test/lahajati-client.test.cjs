'use strict';

/**
 * VocalIA Lahajati Client Tests
 *
 * Tests:
 * - DIALECTS constant (16 Arabic dialects)
 * - LANGUAGE_TO_DIALECT mapping (VocalIA codes → Lahajati dialects)
 * - OUTPUT_FORMATS constant
 * - LahajatiClient constructor, isConfigured, getHeaders
 * - LahajatiClient supportsLanguage, getDialect
 *
 * NOTE: Does NOT call Lahajati.ai API. Tests pure logic only.
 *
 * Run: node --test test/lahajati-client.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const { LahajatiClient, DIALECTS, LANGUAGE_TO_DIALECT, OUTPUT_FORMATS } = require('../core/lahajati-client.cjs');

// ─── DIALECTS ───────────────────────────────────────────────────────

describe('Lahajati DIALECTS', () => {
  test('has 16 dialects', () => {
    assert.strictEqual(Object.keys(DIALECTS).length, 16);
  });

  test('includes MSA', () => {
    assert.strictEqual(DIALECTS.msa, 'modern_standard_arabic');
  });

  test('includes Moroccan (Darija)', () => {
    assert.strictEqual(DIALECTS.moroccan, 'moroccan');
  });

  test('includes Egyptian', () => {
    assert.strictEqual(DIALECTS.egyptian, 'egyptian');
  });

  test('includes Gulf', () => {
    assert.strictEqual(DIALECTS.gulf, 'gulf');
  });

  test('includes Lebanese', () => {
    assert.strictEqual(DIALECTS.lebanese, 'lebanese');
  });

  test('includes Tunisian', () => {
    assert.strictEqual(DIALECTS.tunisian, 'tunisian');
  });

  test('includes Algerian', () => {
    assert.strictEqual(DIALECTS.algerian, 'algerian');
  });

  test('includes Iraqi', () => {
    assert.strictEqual(DIALECTS.iraqi, 'iraqi');
  });

  test('includes Saudi Hejazi and Nejdi', () => {
    assert.strictEqual(DIALECTS.saudi_hejazi, 'saudi_hejazi');
    assert.strictEqual(DIALECTS.saudi_nejdi, 'saudi_nejdi');
  });
});

// ─── LANGUAGE_TO_DIALECT ────────────────────────────────────────────

describe('Lahajati LANGUAGE_TO_DIALECT', () => {
  test('maps ary to moroccan', () => {
    assert.strictEqual(LANGUAGE_TO_DIALECT.ary, 'moroccan');
  });

  test('maps ar to msa', () => {
    assert.strictEqual(LANGUAGE_TO_DIALECT.ar, 'msa');
  });

  test('maps fr to null (not supported)', () => {
    assert.strictEqual(LANGUAGE_TO_DIALECT.fr, null);
  });

  test('maps en to null (not supported)', () => {
    assert.strictEqual(LANGUAGE_TO_DIALECT.en, null);
  });

  test('maps es to null (not supported)', () => {
    assert.strictEqual(LANGUAGE_TO_DIALECT.es, null);
  });
});

// ─── OUTPUT_FORMATS ─────────────────────────────────────────────────

describe('Lahajati OUTPUT_FORMATS', () => {
  test('has 6 formats', () => {
    assert.strictEqual(Object.keys(OUTPUT_FORMATS).length, 6);
  });

  test('includes mp3_128', () => {
    assert.strictEqual(OUTPUT_FORMATS.mp3_128, 'mp3_128');
  });

  test('includes wav', () => {
    assert.strictEqual(OUTPUT_FORMATS.wav, 'wav');
  });

  test('includes flac', () => {
    assert.strictEqual(OUTPUT_FORMATS.flac, 'flac');
  });

  test('includes m4a', () => {
    assert.strictEqual(OUTPUT_FORMATS.m4a, 'm4a');
  });
});

// ─── LahajatiClient constructor ─────────────────────────────────────

describe('Lahajati LahajatiClient', () => {
  test('constructor accepts custom API key', () => {
    const client = new LahajatiClient('test-key-123');
    assert.strictEqual(client.apiKey, 'test-key-123');
  });

  test('constructor sets baseUrl', () => {
    const client = new LahajatiClient('key');
    assert.ok(client.baseUrl.includes('lahajati'));
  });

  test('isConfigured returns true with API key', () => {
    const client = new LahajatiClient('key');
    assert.strictEqual(client.isConfigured(), true);
  });

  test('isConfigured returns false without API key', () => {
    const client = new LahajatiClient('');
    assert.strictEqual(client.isConfigured(), false);
  });

  test('getHeaders includes Authorization', () => {
    const client = new LahajatiClient('test-key');
    const headers = client.getHeaders();
    assert.strictEqual(headers['Authorization'], 'Bearer test-key');
    assert.strictEqual(headers['Content-Type'], 'application/json');
  });

  test('getHeaders accepts custom content type', () => {
    const client = new LahajatiClient('key');
    const headers = client.getHeaders('multipart/form-data');
    assert.strictEqual(headers['Content-Type'], 'multipart/form-data');
  });
});

// ─── LahajatiClient language support ────────────────────────────────

describe('Lahajati supportsLanguage', () => {
  const client = new LahajatiClient('key');

  test('supports ary (Darija)', () => {
    assert.strictEqual(client.supportsLanguage('ary'), true);
  });

  test('supports ar (MSA)', () => {
    assert.strictEqual(client.supportsLanguage('ar'), true);
  });

  test('does not support fr', () => {
    assert.strictEqual(client.supportsLanguage('fr'), false);
  });

  test('does not support en', () => {
    assert.strictEqual(client.supportsLanguage('en'), false);
  });

  test('does not support es', () => {
    assert.strictEqual(client.supportsLanguage('es'), false);
  });

  test('does not support unknown', () => {
    assert.strictEqual(client.supportsLanguage('xx'), false);
  });
});

describe('Lahajati getDialect', () => {
  const client = new LahajatiClient('key');

  test('returns moroccan for ary', () => {
    assert.strictEqual(client.getDialect('ary'), 'moroccan');
  });

  test('returns msa for ar', () => {
    assert.strictEqual(client.getDialect('ar'), 'msa');
  });

  test('returns null for fr', () => {
    assert.strictEqual(client.getDialect('fr'), null);
  });

  test('returns null for unknown', () => {
    assert.strictEqual(client.getDialect('xx'), null);
  });
});

// ─── LahajatiClient TTS/STT guard ──────────────────────────────────

describe('Lahajati API guards', () => {
  test('textToSpeech throws without API key', async () => {
    const client = new LahajatiClient('');
    await assert.rejects(
      () => client.textToSpeech('test'),
      { message: /not configured/ }
    );
  });

  test('speechToText throws without API key', async () => {
    const client = new LahajatiClient('');
    await assert.rejects(
      () => client.speechToText(Buffer.from('test')),
      { message: /not configured/ }
    );
  });
});
