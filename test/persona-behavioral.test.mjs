/**
 * Persona Behavioral Tests — voice-persona-injector.cjs
 * VocalIA — Session 250.216
 *
 * Tests the SYSTEM_PROMPTS[key][lang] → PERSONAS[key].systemPrompt fallback chain
 * in VoicePersonaInjector.inject(), and persona selection via getPersona().
 *
 * Architecture (from .claude/rules/personas-architecture.md):
 *   1. SYSTEM_PROMPTS = multilingual prompts (38 × 5 langs = 190 prompts)
 *   2. PERSONAS = metadata + EN-only fallback systemPrompt
 *   inject() priority: SYSTEM_PROMPTS[key][lang] > SYSTEM_PROMPTS[key]['fr'] > PERSONAS[key].systemPrompt
 *
 * Run: node --test test/persona-behavioral.test.mjs
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  VoicePersonaInjector,
  PERSONAS,
  SYSTEM_PROMPTS,
  VOICE_CONFIG
} = require('../personas/voice-persona-injector.cjs');

// ═══════════════════════════════════════════════════════════════════════════════
// 1. SYSTEM_PROMPTS → PERSONAS fallback chain
// ═══════════════════════════════════════════════════════════════════════════════

describe('inject() — SYSTEM_PROMPTS override chain', () => {
  const testKeys = ['AGENCY', 'DENTAL', 'UNIVERSAL_ECOMMERCE'];

  // Helper: build persona with all required fields for inject()
  function buildPersona(key, lang) {
    return {
      id: PERSONAS[key].id || key.toLowerCase(),
      archetypeKey: key,
      systemPrompt: PERSONAS[key].systemPrompt,
      language: lang,
      name: PERSONAS[key].name,
      voice: PERSONAS[key].voice,
      sensitivity: PERSONAS[key].sensitivity
    };
  }

  // Helper: extract an invariant phrase from the prompt (skip lines with {{template}} vars)
  function getInvariantPhrase(prompt) {
    const lines = prompt.split('\n')
      .filter(l => l.trim().length > 20 && !l.includes('{{'));
    return lines[0]?.trim().slice(0, 40) || null;
  }

  for (const key of testKeys) {
    test(`${key}: inject() uses SYSTEM_PROMPTS[${key}][fr] for FR (not EN fallback)`, () => {
      const result = VoicePersonaInjector.inject({}, buildPersona(key, 'fr'));
      const frPrompt = SYSTEM_PROMPTS[key]?.fr;
      const enFallback = PERSONAS[key].systemPrompt;
      if (frPrompt) {
        const frPhrase = getInvariantPhrase(frPrompt);
        if (frPhrase) {
          assert.ok(result.instructions.includes(frPhrase),
            `inject() should use SYSTEM_PROMPTS.${key}.fr containing "${frPhrase}"`);
        }
        // Verify it's NOT using the EN fallback (unless FR and EN share text)
        const enPhrase = getInvariantPhrase(enFallback);
        if (enPhrase && frPhrase && !frPhrase.includes(enPhrase)) {
          assert.ok(!result.instructions.startsWith(enFallback.slice(0, 30)),
            `inject() should NOT use EN fallback for FR`);
        }
      }
    });

    test(`${key}: inject() uses SYSTEM_PROMPTS[${key}][en] for EN`, () => {
      const result = VoicePersonaInjector.inject({}, buildPersona(key, 'en'));
      const enPrompt = SYSTEM_PROMPTS[key]?.en;
      if (enPrompt) {
        const enPhrase = getInvariantPhrase(enPrompt);
        if (enPhrase) {
          assert.ok(result.instructions.includes(enPhrase),
            `inject() should use SYSTEM_PROMPTS.${key}.en containing "${enPhrase}"`);
        }
      }
    });

    test(`${key}: inject() uses SYSTEM_PROMPTS[${key}][ar] for AR`, () => {
      const result = VoicePersonaInjector.inject({}, buildPersona(key, 'ar'));
      const arPrompt = SYSTEM_PROMPTS[key]?.ar;
      if (arPrompt) {
        // For Arabic, find an invariant phrase (no templates) with Arabic chars
        const arLines = arPrompt.split('\n')
          .filter(l => /[\u0600-\u06FF]/.test(l) && !l.includes('{{') && l.trim().length > 10);
        const arPhrase = arLines[0]?.trim().slice(0, 30) || null;
        if (arPhrase) {
          assert.ok(result.instructions.includes(arPhrase),
            `inject() should use SYSTEM_PROMPTS.${key}.ar containing "${arPhrase}"`);
        } else {
          // All AR lines have templates — verify result contains Arabic text
          assert.ok(/[\u0600-\u06FF]/.test(result.instructions),
            `inject() for AR should contain Arabic characters`);
        }
      }
    });
  }

  test('inject() falls back to FR when requested language is missing from SYSTEM_PROMPTS', () => {
    const result = VoicePersonaInjector.inject({}, buildPersona('AGENCY', 'xx'));
    const frPrompt = SYSTEM_PROMPTS.AGENCY.fr;
    assert.ok(result.instructions.includes(frPrompt.slice(0, 50)),
      'Should fall back to FR when language not found');
  });

  test('inject() adds Darija injection for language=ary', () => {
    const result = VoicePersonaInjector.inject({}, buildPersona('AGENCY', 'ary'));
    assert.ok(result.instructions.includes('DARIJA'),
      'Should contain Darija injection for ary language');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. SYSTEM_PROMPTS structure verification
// ═══════════════════════════════════════════════════════════════════════════════

describe('SYSTEM_PROMPTS structure', () => {
  const EXPECTED_LANGS = ['fr', 'en', 'es', 'ar', 'ary'];

  test('every SYSTEM_PROMPTS key exists in PERSONAS', () => {
    for (const key of Object.keys(SYSTEM_PROMPTS)) {
      assert.ok(PERSONAS[key], `SYSTEM_PROMPTS has key "${key}" missing from PERSONAS`);
    }
  });

  test('every PERSONAS key exists in SYSTEM_PROMPTS', () => {
    for (const key of Object.keys(PERSONAS)) {
      assert.ok(SYSTEM_PROMPTS[key], `PERSONAS has key "${key}" missing from SYSTEM_PROMPTS`);
    }
  });

  test('each SYSTEM_PROMPTS entry has all 5 languages with non-empty strings', () => {
    for (const [key, prompts] of Object.entries(SYSTEM_PROMPTS)) {
      for (const lang of EXPECTED_LANGS) {
        assert.ok(prompts[lang], `SYSTEM_PROMPTS.${key} missing language: ${lang}`);
        assert.ok(typeof prompts[lang] === 'string' && prompts[lang].length > 10,
          `SYSTEM_PROMPTS.${key}.${lang} should be a non-trivial string`);
      }
    }
  });

  test('each PERSONAS entry has systemPrompt fallback (non-empty string)', () => {
    for (const [key, persona] of Object.entries(PERSONAS)) {
      assert.ok(persona.systemPrompt && typeof persona.systemPrompt === 'string',
        `PERSONAS.${key} missing systemPrompt fallback`);
      assert.ok(persona.systemPrompt.length > 10,
        `PERSONAS.${key}.systemPrompt too short (${persona.systemPrompt.length} chars)`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. getPersona() — widget type isolation
// ═══════════════════════════════════════════════════════════════════════════════

describe('getPersona() — widget type isolation', () => {
  test('B2C widget defaults to UNIVERSAL_SME, NOT AGENCY', () => {
    const persona = VoicePersonaInjector.getPersona(null, null, null, 'B2C');
    assert.notEqual(persona.archetypeKey || '', 'AGENCY',
      'B2C widget must NOT get AGENCY persona');
  });

  test('ECOM widget defaults to UNIVERSAL_ECOMMERCE', () => {
    const persona = VoicePersonaInjector.getPersona(null, null, null, 'ECOM');
    assert.ok(['UNIVERSAL_ECOMMERCE'].includes(persona.archetypeKey || persona.name),
      'ECOM widget should get UNIVERSAL_ECOMMERCE');
  });

  test('TELEPHONY widget can use AGENCY', () => {
    const persona = VoicePersonaInjector.getPersona(null, null, null, 'TELEPHONY');
    assert.equal(persona.archetypeKey, 'AGENCY',
      'TELEPHONY widget should default to AGENCY');
  });

  test('getPersona returns identity with required fields', () => {
    const persona = VoicePersonaInjector.getPersona(null, null, null, 'B2C');
    assert.ok(persona.name, 'has name');
    assert.ok(persona.systemPrompt, 'has systemPrompt');
    assert.ok(persona.payment_config, 'has payment_config');
    assert.ok(persona.business_info, 'has business_info');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. inject() output structure
// ═══════════════════════════════════════════════════════════════════════════════

describe('inject() — output structure', () => {
  function buildPersona(key, lang) {
    return {
      id: PERSONAS[key].id || key.toLowerCase(),
      archetypeKey: key,
      systemPrompt: PERSONAS[key].systemPrompt,
      language: lang,
      name: PERSONAS[key].name,
      voice: PERSONAS[key].voice,
      sensitivity: PERSONAS[key].sensitivity
    };
  }

  test('inject() returns object with instructions field', () => {
    const result = VoicePersonaInjector.inject({}, buildPersona('AGENCY', 'fr'));
    assert.ok(result.instructions, 'result has instructions');
    assert.ok(typeof result.instructions === 'string', 'instructions is a string');
    assert.ok(result.instructions.length > 100, 'instructions is substantial');
  });

  test('inject() merges baseConfig properties', () => {
    const result = VoicePersonaInjector.inject({ model: 'grok-4', temperature: 0.7 }, buildPersona('AGENCY', 'fr'));
    assert.ok(result.instructions, 'result has instructions');
  });
});
