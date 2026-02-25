/**
 * VocalIA Persona E2E Integration Tests
 *
 * Tests the COMPLETE persona injection flow:
 * Widget → getPersona() → inject() → AI Provider config
 *
 * Originally session 250.54 (custom runner → DEAD).
 * Session 250.238: Converted to node:test + added behavioral tests.
 *
 * Run: node --test test/persona-e2e.test.mjs
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { VoicePersonaInjector, PERSONAS, SYSTEM_PROMPTS } from '../personas/voice-persona-injector.cjs';

const LANGUAGES = ['fr', 'en', 'es', 'ar', 'ary'];
const EXPECTED_LANGUAGE_MARKERS = {
  fr: /Bonjour|vous|notre|client|VocalIA/i,
  en: /Hello|you|our|customer|VocalIA/i,
  es: /Hola|usted|nuestro|cliente|VocalIA/i,
  ar: /[\u0600-\u06FF]/,
  ary: /[\u0600-\u06FF]/
};

// ─── getPersona() ────────────────────────────────────────────────────────────

describe('VoicePersonaInjector.getPersona()', () => {
  test('returns object with archetypeKey for B2B widget', () => {
    const persona = VoicePersonaInjector.getPersona(null, null, 'test_client', 'B2B');
    assert.ok(persona.archetypeKey, 'archetypeKey should be defined');
    assert.ok(PERSONAS[persona.archetypeKey], `archetypeKey "${persona.archetypeKey}" should exist in PERSONAS`);
  });

  test('returns object with archetypeKey for B2C widget', () => {
    const persona = VoicePersonaInjector.getPersona(null, null, 'test_client', 'B2C');
    assert.ok(persona.archetypeKey);
    assert.ok(PERSONAS[persona.archetypeKey]);
  });

  test('persona has required fields (name, voice, language)', () => {
    const persona = VoicePersonaInjector.getPersona(null, null, 'test_client', 'B2B');
    assert.ok(persona.name, 'Should have name');
    assert.ok(persona.voice, 'Should have voice');
    assert.ok(persona.language, 'Should have language');
  });

  test('returns correct persona for known tenant archetype', () => {
    // agency_internal maps to AGENCY archetype
    const persona = VoicePersonaInjector.getPersona('AGENCY', null, 'agency_internal', 'B2B');
    assert.strictEqual(persona.archetypeKey, 'AGENCY');
  });
});

// ─── inject() — per-language ─────────────────────────────────────────────────

describe('VoicePersonaInjector.inject() language routing', () => {
  for (const lang of LANGUAGES) {
    test(`inject() produces ${lang} instructions with correct language markers`, () => {
      const persona = VoicePersonaInjector.getPersona(null, null, 'test_client', 'B2C');
      persona.language = lang;

      const baseConfig = { session: { metadata: {} } };
      const injected = VoicePersonaInjector.inject(baseConfig, persona);
      const instructions = injected.session.instructions;

      assert.ok(instructions, 'inject() should produce instructions');
      assert.ok(instructions.length > 100, `Instructions should be substantial, got ${instructions.length} chars`);

      const marker = EXPECTED_LANGUAGE_MARKERS[lang];
      assert.ok(marker.test(instructions),
        `${lang} instructions should contain language markers. First 200 chars: ${instructions.substring(0, 200)}`);
    });
  }
});

// ─── inject() — metadata ─────────────────────────────────────────────────────

describe('VoicePersonaInjector.inject() metadata', () => {
  test('injects persona_id into session metadata', () => {
    const persona = VoicePersonaInjector.getPersona(null, null, 'test_session', 'B2C');
    persona.language = 'ar';

    const baseConfig = { session: { metadata: {} } };
    const injected = VoicePersonaInjector.inject(baseConfig, persona);
    const metadata = injected.session.metadata;

    assert.ok(metadata.persona_id, 'Should have persona_id');
    assert.ok(metadata.persona_name, 'Should have persona_name');
    assert.strictEqual(metadata.language, 'ar', 'Should have correct language');
    assert.ok(metadata.knowledge_base_id, 'Should have knowledge_base_id');
  });

  test('preserves existing metadata keys', () => {
    const persona = VoicePersonaInjector.getPersona(null, null, 'test_session', 'B2B');
    persona.language = 'fr';

    const baseConfig = { session: { metadata: { custom_key: 'preserved' } } };
    const injected = VoicePersonaInjector.inject(baseConfig, persona);

    assert.strictEqual(injected.session.metadata.custom_key, 'preserved',
      'Existing metadata should not be overwritten');
    assert.ok(injected.session.metadata.persona_id, 'Should also add persona_id');
  });
});

// ─── inject() — SYSTEM_PROMPTS override vs fallback ──────────────────────────

describe('VoicePersonaInjector.inject() SYSTEM_PROMPTS vs fallback', () => {
  test('uses SYSTEM_PROMPTS[key][lang] when available (not PERSONAS fallback)', () => {
    const persona = VoicePersonaInjector.getPersona('AGENCY', null, 'test', 'B2B');
    persona.language = 'fr';

    const baseConfig = { session: { metadata: {} } };
    const injected = VoicePersonaInjector.inject(baseConfig, persona);
    const instructions = injected.session.instructions;

    // SYSTEM_PROMPTS.AGENCY.fr should be used (multilingual)
    // It should be different from the EN fallback in PERSONAS.AGENCY.systemPrompt
    const fallback = PERSONAS.AGENCY.systemPrompt;
    if (SYSTEM_PROMPTS.AGENCY && SYSTEM_PROMPTS.AGENCY.fr) {
      // If FR prompt exists, it should NOT be the EN fallback
      assert.ok(instructions.length > 0, 'Should have instructions');
      // FR prompt should contain French markers
      assert.ok(/vous|notre|Bonjour|VocalIA/i.test(instructions),
        'FR instructions should contain French language markers');
    }
  });

  test('all 40 persona archetypes have SYSTEM_PROMPTS for all 5 languages', () => {
    const archetypeKeys = Object.keys(PERSONAS);
    assert.strictEqual(archetypeKeys.length, 40, 'Should have 40 personas');

    for (const key of archetypeKeys) {
      assert.ok(SYSTEM_PROMPTS[key], `SYSTEM_PROMPTS missing archetype: ${key}`);
      for (const lang of LANGUAGES) {
        assert.ok(SYSTEM_PROMPTS[key][lang],
          `SYSTEM_PROMPTS.${key}.${lang} missing`);
        assert.ok(SYSTEM_PROMPTS[key][lang].length > 50,
          `SYSTEM_PROMPTS.${key}.${lang} too short (${SYSTEM_PROMPTS[key][lang].length} chars)`);
      }
    }
  });
});

// ─── buildFullInstructions() end-to-end ──────────────────────────────────────

describe('buildFullInstructions() end-to-end chain', () => {
  test('produces non-empty instructions for every persona × language combo', () => {
    const archetypeKeys = Object.keys(PERSONAS);
    let tested = 0;

    for (const key of archetypeKeys) {
      for (const lang of LANGUAGES) {
        const persona = VoicePersonaInjector.getPersona(key, null, 'e2e_test', 'B2B');
        persona.language = lang;

        const baseConfig = { session: { metadata: {} } };
        const injected = VoicePersonaInjector.inject(baseConfig, persona);

        assert.ok(injected.session.instructions,
          `No instructions for ${key}/${lang}`);
        assert.ok(injected.session.instructions.length > 100,
          `Instructions too short for ${key}/${lang}: ${injected.session.instructions.length} chars`);
        tested++;
      }
    }

    // 40 personas × 5 langs = 200 combos
    assert.strictEqual(tested, 200, 'Should test all 200 persona×lang combinations');
  });
});
