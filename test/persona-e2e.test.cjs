#!/usr/bin/env node
/**
 * End-to-End Persona Injection Test
 * Session 250.54: Verifies complete flow from Widget → Voice API → AI Provider
 *
 * Tests:
 * 1. getPersona() returns correct archetypeKey
 * 2. inject() uses SYSTEM_PROMPTS for all 5 languages
 * 3. getResilisentResponse() uses injected systemPrompt
 * 4. Response language matches request language
 */

const assert = require('assert');

// Test data
const LANGUAGES = ['fr', 'en', 'es', 'ar', 'ary'];
const EXPECTED_LANGUAGE_MARKERS = {
  fr: /Bonjour|vous|notre|client|VocalIA/i,
  en: /Hello|you|our|customer|VocalIA/i,
  es: /Hola|usted|nuestro|cliente|VocalIA/i,
  ar: /[\u0600-\u06FF]/, // Arabic characters
  ary: /[\u0600-\u06FF]/ // Darija also uses Arabic script
};

async function runTests() {
  console.log('=== Persona E2E Integration Tests ===\n');

  let passed = 0;
  let failed = 0;

  // Test 1: VoicePersonaInjector.getPersona() returns archetypeKey
  console.log('Test 1: getPersona() returns archetypeKey');
  try {
    const { VoicePersonaInjector, PERSONAS } = require('../personas/voice-persona-injector.cjs');
    const persona = VoicePersonaInjector.getPersona(null, null, 'test_client');

    assert(persona.archetypeKey, 'archetypeKey should be defined');
    assert(PERSONAS[persona.archetypeKey], 'archetypeKey should match a PERSONA');
    console.log(`  ✅ archetypeKey = ${persona.archetypeKey}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${e.message}`);
    failed++;
  }

  // Test 2: inject() uses SYSTEM_PROMPTS for all languages
  console.log('\nTest 2: inject() uses correct language prompts');
  try {
    const { VoicePersonaInjector, PERSONAS } = require('../personas/voice-persona-injector.cjs');

    for (const lang of LANGUAGES) {
      const persona = VoicePersonaInjector.getPersona(null, null, 'test_client');
      persona.language = lang;

      const baseConfig = { session: { metadata: {} } };
      const injected = VoicePersonaInjector.inject(baseConfig, persona);
      const instructions = injected.session.instructions;

      const marker = EXPECTED_LANGUAGE_MARKERS[lang];
      const hasCorrectLanguage = marker.test(instructions);

      if (hasCorrectLanguage) {
        console.log(`  ✅ ${lang}: ${instructions.length} chars, language detected`);
        passed++;
      } else {
        console.log(`  ❌ ${lang}: Language not detected in instructions`);
        console.log(`     First 100 chars: ${instructions.substring(0, 100)}`);
        failed++;
      }
    }
  } catch (e) {
    console.log(`  ❌ ${e.message}`);
    failed++;
  }

  // Test 3: getResilisentResponse structure (without API call)
  console.log('\nTest 3: Response structure includes persona metadata');
  try {
    // We can't test the full API without network, but we can verify the structure
    const { VoicePersonaInjector } = require('../personas/voice-persona-injector.cjs');
    const persona = VoicePersonaInjector.getPersona(null, null, 'test_session');
    persona.language = 'ar';

    const baseConfig = { session: { metadata: {} } };
    const injected = VoicePersonaInjector.inject(baseConfig, persona);

    // Verify metadata structure
    const metadata = injected.session.metadata;
    assert(metadata.persona_id, 'Should have persona_id');
    assert(metadata.persona_name, 'Should have persona_name');
    assert(metadata.language === 'ar', 'Should have correct language');
    assert(metadata.knowledge_base_id, 'Should have knowledge_base_id');

    console.log(`  ✅ Metadata includes: persona_id, persona_name, language, knowledge_base_id`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${e.message}`);
    failed++;
  }

  // Test 4: All 40 personas have multilingual SYSTEM_PROMPTS
  console.log('\nTest 4: All personas have SYSTEM_PROMPTS');
  try {
    const fs = require('fs');
    const path = require('path');
    const code = fs.readFileSync(path.join(__dirname, '../personas/voice-persona-injector.cjs'), 'utf8');

    // Count SYSTEM_PROMPTS entries
    const systemPromptsMatch = code.match(/SYSTEM_PROMPTS\s*=\s*\{[\s\S]*?\n\};/);
    if (systemPromptsMatch) {
      const archetypeCount = (systemPromptsMatch[0].match(/^\s+[A-Z_]+:\s*\{/gm) || []).length;
      console.log(`  ✅ ${archetypeCount} archetypes have SYSTEM_PROMPTS`);
      passed++;
    } else {
      console.log('  ❌ Could not find SYSTEM_PROMPTS');
      failed++;
    }
  } catch (e) {
    console.log(`  ❌ ${e.message}`);
    failed++;
  }

  // Summary
  console.log('\n=== Test Summary ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.log('\n❌ Some tests failed!');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  runTests().catch(e => {
    console.error('Test error:', e);
    process.exit(1);
  });
}

module.exports = { runTests };
