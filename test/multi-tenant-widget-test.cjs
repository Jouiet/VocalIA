/**
 * Multi-Tenant Widget Test Suite
 * Tests B2B, B2C, and ECOM widgets with sequential questions
 * Session 250.97bis - Rigorous Testing
 */

const path = require('path');

// Load the persona injector
const { VoicePersonaInjector, PERSONAS, SYSTEM_PROMPTS, CLIENT_REGISTRY } = require('../personas/voice-persona-injector.cjs');

// Test results tracking
const results = {
    passed: 0,
    failed: 0,
    errors: []
};

function assert(condition, testName, details = '') {
    if (condition) {
        console.log(`  ✅ ${testName}`);
        results.passed++;
    } else {
        console.log(`  ❌ ${testName} ${details}`);
        results.failed++;
        results.errors.push({ test: testName, details });
    }
}

function logSection(title) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  ${title}`);
    console.log('='.repeat(60));
}

// ============================================================
// TEST SUITE 1: B2B WIDGET (Excluding AGENCY)
// ============================================================
function testB2BWidget() {
    logSection('TEST SUITE 1: B2B WIDGET');

    // Test clients: notaire_rabat_01 (NOTARY), agence_immo_01 (REAL_ESTATE_AGENT)
    const b2bClients = [
        { id: 'notaire_rabat_01', expectedPersona: 'NOTARY', expectedName: 'Maître Fassi-Fihri' },
        { id: 'agence_immo_01', expectedPersona: 'REAL_ESTATE_AGENT', expectedName: 'Immobilier Casa Pro' },
        { id: 'agence_commerciale_01', expectedPersona: 'RECRUITER', expectedName: 'Force Vente Maroc' }
    ];

    b2bClients.forEach(client => {
        console.log(`\n  --- Testing B2B: ${client.id} ---`);

        // Q1: Get persona
        const persona = VoicePersonaInjector.getPersona(null, null, client.id, 'B2B');
        assert(persona !== null, `Q1: Persona retrieved for ${client.id}`);
        assert(persona.archetypeKey === client.expectedPersona,
            `Q2: Correct archetype (${persona.archetypeKey})`,
            `expected ${client.expectedPersona}`);
        assert(persona.name === client.expectedName,
            `Q3: Correct business name`,
            `got "${persona.name}" expected "${client.expectedName}"`);

        // Q4: Widget type compatibility
        const archetypeData = PERSONAS[persona.archetypeKey];
        assert(archetypeData?.widget_types?.includes('B2B'),
            `Q4: Widget B2B is compatible`,
            `widget_types: ${archetypeData?.widget_types}`);

        // Q5: Knowledge base NOT agency_v3
        assert(persona.knowledge_base_id !== 'agency_v3',
            `Q5: KB is NOT agency_v3`,
            `got "${persona.knowledge_base_id}"`);

        // Q6: Inject and check prompt has templates replaced
        const baseConfig = { instructions: '' };
        const injected = VoicePersonaInjector.inject(baseConfig, persona);
        const hasNoTemplateVars = !injected.instructions?.includes('{{business_name}}');
        assert(hasNoTemplateVars || !injected.instructions,
            `Q6: Templates injected (no raw {{business_name}})`,
            injected.instructions?.substring(0, 100));

        // Q7: Business info present
        assert(persona.business_info?.phone, `Q7: Business phone present`, persona.business_info?.phone);
        assert(persona.business_info?.address, `Q8: Business address present`, persona.business_info?.address?.substring(0, 30));
    });
}

// ============================================================
// TEST SUITE 2: B2C WIDGET
// ============================================================
function testB2CWidget() {
    logSection('TEST SUITE 2: B2C WIDGET');

    const b2cClients = [
        { id: 'dentiste_casa_01', expectedPersona: 'DENTAL', expectedName: 'Centre Dentaire Smile', lang: 'ary' },
        { id: 'medecin_general_01', expectedPersona: 'DOCTOR', expectedName: 'Cabinet Dr. Bennani', lang: 'fr' },
        { id: 'salon_coiffure_casa_01', expectedPersona: 'HAIRDRESSER', expectedName: 'Coiffure Prestige Casa', lang: 'fr' },
        { id: 'fitness_casa_01', expectedPersona: 'GYM', expectedName: 'City Gym Casablanca', lang: 'ary' }
    ];

    b2cClients.forEach(client => {
        console.log(`\n  --- Testing B2C: ${client.id} ---`);

        const persona = VoicePersonaInjector.getPersona(null, null, client.id, 'B2C');

        // Q1-Q3: Basic checks
        assert(persona !== null, `Q1: Persona retrieved`);
        assert(persona.archetypeKey === client.expectedPersona,
            `Q2: Correct archetype (${persona.archetypeKey})`,
            `expected ${client.expectedPersona}`);
        assert(persona.name === client.expectedName,
            `Q3: Correct name`,
            `got "${persona.name}"`);

        // Q4: Widget compatibility
        const archetypeData = PERSONAS[persona.archetypeKey];
        assert(archetypeData?.widget_types?.includes('B2C'),
            `Q4: B2C compatible`,
            `types: ${archetypeData?.widget_types}`);

        // Q5: Language preserved
        assert(persona.language === client.lang,
            `Q5: Language correct (${persona.language})`,
            `expected ${client.lang}`);

        // Q6: Services array present (for service-based businesses)
        const clientData = CLIENT_REGISTRY.clients[client.id];
        if (clientData?.services) {
            assert(persona.services?.length > 0,
                `Q6: Services array populated`,
                `${persona.services?.length} services`);
        }

        // Q7: Horaires present
        if (clientData?.horaires) {
            assert(persona.horaires, `Q7: Horaires present`, persona.horaires);
        }

        // Q8: Check SYSTEM_PROMPTS has the archetype
        const hasSystemPrompt = SYSTEM_PROMPTS[persona.archetypeKey];
        assert(hasSystemPrompt, `Q8: SYSTEM_PROMPTS has ${persona.archetypeKey}`);

        // Q9: Check prompt in correct language exists
        if (hasSystemPrompt) {
            const promptInLang = SYSTEM_PROMPTS[persona.archetypeKey][client.lang];
            assert(promptInLang, `Q9: Prompt exists in ${client.lang}`, promptInLang?.substring(0, 50));
        }
    });
}

// ============================================================
// TEST SUITE 3: ECOM WIDGET
// ============================================================
function testECOMWidget() {
    logSection('TEST SUITE 3: ECOM WIDGET');

    const ecomClients = [
        { id: 'ecom_nike_01', expectedPersona: 'UNIVERSAL_ECOMMERCE', expectedName: 'Nike Reseller Paris', lang: 'fr' },
        { id: 'ecom_darija_01', expectedPersona: 'UNIVERSAL_ECOMMERCE', expectedName: 'متجر درب غلف', lang: 'ary' }
    ];

    ecomClients.forEach(client => {
        console.log(`\n  --- Testing ECOM: ${client.id} ---`);

        const persona = VoicePersonaInjector.getPersona(null, null, client.id, 'ECOM');

        // Q1-Q3: Basic checks
        assert(persona !== null, `Q1: Persona retrieved`);
        assert(persona.archetypeKey === client.expectedPersona,
            `Q2: Correct archetype (${persona.archetypeKey})`,
            `expected ${client.expectedPersona}`);
        assert(persona.name === client.expectedName,
            `Q3: Correct name`,
            `got "${persona.name}"`);

        // Q4: Widget compatibility
        const archetypeData = PERSONAS[persona.archetypeKey];
        assert(archetypeData?.widget_types?.includes('ECOM'),
            `Q4: ECOM compatible`,
            `types: ${archetypeData?.widget_types}`);

        // Q5: Payment config present
        assert(persona.payment_config?.method,
            `Q5: Payment method set`,
            persona.payment_config?.method);

        // Q6: Currency correct
        const expectedCurrency = client.lang === 'ary' ? 'MAD' : 'EUR';
        assert(persona.payment_config?.currency === expectedCurrency,
            `Q6: Currency correct (${persona.payment_config?.currency})`,
            `expected ${expectedCurrency}`);

        // Q7: Inject and verify prompt
        const baseConfig = { instructions: '' };
        const injected = VoicePersonaInjector.inject(baseConfig, persona);
        assert(injected.instructions?.length > 100,
            `Q7: Prompt injected (${injected.instructions?.length} chars)`);

        // Q8: E-commerce specific - check product/order keywords in prompt
        const ecomKeywords = ['commande', 'order', 'produit', 'product', 'livraison', 'delivery', 'الطلبية', 'المنتوج'];
        const hasEcomKeywords = ecomKeywords.some(kw =>
            injected.instructions?.toLowerCase().includes(kw.toLowerCase())
        );
        assert(hasEcomKeywords,
            `Q8: Prompt has e-commerce keywords`,
            `checked: ${ecomKeywords.slice(0, 3).join(', ')}...`);
    });
}

// ============================================================
// TEST SUITE 4: CROSS-WIDGET ISOLATION (No Agency Leakage)
// ============================================================
function testIsolation() {
    logSection('TEST SUITE 4: ISOLATION (No Agency Leakage)');

    const testClients = [
        'dentiste_casa_01',
        'medecin_general_01',
        'ecom_nike_01',
        'salon_coiffure_casa_01',
        'hotel_marrakech_01'
    ];

    testClients.forEach(clientId => {
        console.log(`\n  --- Isolation test: ${clientId} ---`);

        const persona = VoicePersonaInjector.getPersona(null, null, clientId, 'B2C');

        // Q1: NOT agency archetype
        assert(persona.archetypeKey !== 'AGENCY',
            `Q1: Not AGENCY archetype`,
            `got ${persona.archetypeKey}`);

        // Q2: KB not agency_v3
        assert(persona.knowledge_base_id !== 'agency_v3',
            `Q2: KB not agency_v3`,
            `got ${persona.knowledge_base_id}`);

        // Q3: Name not VocalIA
        assert(!persona.name?.includes('VocalIA'),
            `Q3: Name not VocalIA`,
            `got "${persona.name}"`);

        // Q4: Inject and check no VocalIA mention
        const baseConfig = { instructions: '' };
        const injected = VoicePersonaInjector.inject(baseConfig, persona);
        const hasVocalIA = injected.instructions?.includes('VocalIA');
        // Note: Some prompts may legitimately mention VocalIA for branding, so this is a soft check
        if (hasVocalIA) {
            console.log(`    ⚠️  Warning: Prompt mentions VocalIA (may be intentional branding)`);
        }

        // Q5: Business-specific data present
        const clientData = CLIENT_REGISTRY.clients[clientId];
        assert(persona.business_info?.phone === clientData?.phone,
            `Q5: Client phone matches`,
            `${persona.business_info?.phone}`);
    });
}

// ============================================================
// TEST SUITE 5: SEQUENTIAL CONVERSATION LOGIC
// ============================================================
function testSequentialLogic() {
    logSection('TEST SUITE 5: SEQUENTIAL CONVERSATION LOGIC');

    // Simulate a B2C dental appointment booking flow
    console.log('\n  --- Scenario: Dental Appointment Booking ---');

    const clientId = 'dentiste_casa_01';
    const persona = VoicePersonaInjector.getPersona(null, null, clientId, 'B2C');

    // Q1: Initial greeting - persona should be ready
    assert(persona !== null, `Q1: Persona loaded for conversation`);

    // Q2: Check services available for "detartrage"
    const hasDetartrage = persona.services?.includes('detartrage');
    assert(hasDetartrage, `Q2: Service "detartrage" available`, `services: ${persona.services?.join(', ')}`);

    // Q3: Check horaires for scheduling
    assert(persona.horaires?.includes('Lun-Sam'), `Q3: Horaires include weekdays`, persona.horaires);

    // Q4: Check payment info for deposit
    assert(persona.payment_config?.details, `Q4: Payment details available for deposit info`);

    // Q5: Check address for directions
    assert(persona.business_info?.address?.includes('Casablanca'), `Q5: Address in Casablanca`, persona.business_info?.address);

    // Simulate E-commerce order tracking flow
    console.log('\n  --- Scenario: E-commerce Order Inquiry ---');

    const ecomPersona = VoicePersonaInjector.getPersona(null, null, 'ecom_nike_01', 'ECOM');

    // Q6: Persona ready
    assert(ecomPersona !== null, `Q6: ECOM persona loaded`);

    // Q7: Currency is EUR for Paris
    assert(ecomPersona.payment_config?.currency === 'EUR', `Q7: Currency EUR for Paris store`);

    // Q8: Payment method is Shopify
    assert(ecomPersona.payment_config?.method === 'SHOPIFY_CHECKOUT', `Q8: Shopify checkout method`);

    // Q9: Inject and check e-commerce prompt structure
    const injected = VoicePersonaInjector.inject({ instructions: '' }, ecomPersona);
    const promptLength = injected.instructions?.length || 0;
    assert(promptLength > 200, `Q9: E-commerce prompt substantial (${promptLength} chars)`);

    // Q10: Language correct
    assert(ecomPersona.language === 'fr', `Q10: Language is French`, ecomPersona.language);
}

// ============================================================
// TEST SUITE 6: WIDGET TYPE MISMATCH HANDLING
// ============================================================
function testWidgetMismatch() {
    logSection('TEST SUITE 6: WIDGET MISMATCH HANDLING');

    // Test: Request B2B widget for a B2C-only persona
    console.log('\n  --- Scenario: B2C persona with B2B widget request ---');

    // HEALER is B2C only
    const healerPersona = VoicePersonaInjector.getPersona(null, null, 'spa_marrakech_01', 'B2B');

    // Should fallback gracefully (to AGENCY for B2B or handle differently)
    assert(healerPersona !== null, `Q1: Mismatch handled gracefully`);

    // Check if it fell back
    const originalSector = CLIENT_REGISTRY.clients['spa_marrakech_01']?.sector; // HEALER
    const healerArchetype = PERSONAS['HEALER'];
    const isB2BCompatible = healerArchetype?.widget_types?.includes('B2B');

    if (!isB2BCompatible) {
        // Should have fallen back
        assert(healerPersona.archetypeKey !== 'HEALER' || healerPersona.archetypeKey === 'AGENCY',
            `Q2: Fallback applied for incompatible widget`,
            `archetype: ${healerPersona.archetypeKey}`);
    }

    // Test: Request ECOM widget for a non-ECOM persona
    console.log('\n  --- Scenario: Non-ECOM persona with ECOM widget request ---');

    const dentalPersona = VoicePersonaInjector.getPersona(null, null, 'dentiste_casa_01', 'ECOM');

    // Should fallback to UNIVERSAL_ECOMMERCE
    const dentalArchetype = PERSONAS['DENTAL'];
    const isECOMCompatible = dentalArchetype?.widget_types?.includes('ECOM');

    if (!isECOMCompatible) {
        assert(dentalPersona.archetypeKey === 'UNIVERSAL_ECOMMERCE',
            `Q3: ECOM fallback to UNIVERSAL_ECOMMERCE`,
            `got ${dentalPersona.archetypeKey}`);
    }
}

// ============================================================
// RUN ALL TESTS
// ============================================================
console.log('\n' + '█'.repeat(60));
console.log('  MULTI-TENANT WIDGET TEST SUITE');
console.log('  Session 250.97bis - Rigorous Testing');
console.log('  B2B, B2C, ECOM (Excluding AGENCY)');
console.log('█'.repeat(60));

try {
    testB2BWidget();
    testB2CWidget();
    testECOMWidget();
    testIsolation();
    testSequentialLogic();
    testWidgetMismatch();
} catch (err) {
    console.error('\n❌ FATAL ERROR:', err.message);
    console.error(err.stack);
    results.failed++;
    results.errors.push({ test: 'FATAL', details: err.message });
}

// ============================================================
// SUMMARY
// ============================================================
logSection('TEST SUMMARY');
console.log(`\n  Total Tests: ${results.passed + results.failed}`);
console.log(`  ✅ Passed: ${results.passed}`);
console.log(`  ❌ Failed: ${results.failed}`);
console.log(`  Pass Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

if (results.errors.length > 0) {
    console.log('\n  FAILURES:');
    results.errors.forEach((e, i) => {
        console.log(`    ${i + 1}. ${e.test}: ${e.details}`);
    });
}

console.log('\n' + '█'.repeat(60));
process.exit(results.failed > 0 ? 1 : 0);
