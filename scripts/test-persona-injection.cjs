#!/usr/bin/env node
/**
 * Test VoicePersonaInjector with multilingual support
 * Session 250.54: Verify persona injection fix
 */

const { VoicePersonaInjector, PERSONAS, VOICE_CONFIG } = require('../personas/voice-persona-injector.cjs');

console.log('=== VoicePersonaInjector Test ===\n');

// Test 1: getPersona returns valid persona
const persona = VoicePersonaInjector.getPersona(null, null, 'test_client', 'B2C');
console.log('1. getPersona():');
console.log('   - ID:', persona.id);
console.log('   - Name:', persona.name);
console.log('   - Default language:', persona.language);
console.log('');

// Test 2: inject() with Arabic language
persona.language = 'ar';
const baseConfig = { session: { metadata: {} } };
const injectedAR = VoicePersonaInjector.inject(baseConfig, persona);

console.log('2. inject() with Arabic (ar):');
console.log('   - Instructions length:', injectedAR.session.instructions.length);
console.log('   - Contains Arabic:', /[\u0600-\u06FF]/.test(injectedAR.session.instructions));
console.log('   - First 100 chars:', injectedAR.session.instructions.substring(0, 100).replace(/\n/g, ' '));
console.log('');

// Test 3: inject() with Darija language
persona.language = 'ary';
const injectedARY = VoicePersonaInjector.inject(baseConfig, persona);

console.log('3. inject() with Darija (ary):');
console.log('   - Instructions length:', injectedARY.session.instructions.length);
console.log('   - Contains Darija marker:', injectedARY.session.instructions.includes('DARIJA'));
console.log('');

// Test 4: inject() with French language
persona.language = 'fr';
const injectedFR = VoicePersonaInjector.inject(baseConfig, persona);

console.log('4. inject() with French (fr):');
console.log('   - Instructions length:', injectedFR.session.instructions.length);
console.log('   - Contains French:', /Bonjour|vous|notre|client/i.test(injectedFR.session.instructions));
console.log('');

// Test 5: Personas count
const personaCount = Object.keys(PERSONAS).length;
console.log('5. Total personas:', personaCount);

console.log('\n=== All tests complete ===');
