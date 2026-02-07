/**
 * Widget OUTPUT QUALITY Test Suite
 * Tests the ACTUAL PROMPTS generated for B2B, B2C, ECOM widgets
 * Session 250.97quater - Output Quality Verification
 *
 * CRITICAL: This tests the REAL OUTPUT that users will receive,
 * not just data structure correctness.
 */

const path = require('path');

// Load the persona injector
const { VoicePersonaInjector, PERSONAS, SYSTEM_PROMPTS, CLIENT_REGISTRY } = require('../personas/voice-persona-injector.cjs');

// Quality metrics
const qualityResults = {
    total: 0,
    excellent: 0,
    good: 0,
    poor: 0,
    critical: 0,
    issues: []
};

function logSection(title) {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`  ${title}`);
    console.log('═'.repeat(70));
}

function logSubSection(title) {
    console.log(`\n  ─── ${title} ───`);
}

/**
 * Quality Score Calculator
 * Evaluates the ACTUAL prompt quality on multiple dimensions
 */
function evaluatePromptQuality(prompt, persona, clientId, widgetType) {
    const evaluation = {
        clientId,
        widgetType,
        personaName: persona.name,
        archetype: persona.archetypeKey,
        language: persona.language,
        scores: {},
        issues: [],
        promptLength: prompt?.length || 0
    };

    // 1. PERSONALIZATION: Does it contain client-specific data?
    const personalizationScore = evaluatePersonalization(prompt, persona, evaluation);
    evaluation.scores.personalization = personalizationScore;

    // 2. TEMPLATE RESOLUTION: Are there unresolved {{variables}}?
    const templateScore = evaluateTemplateResolution(prompt, evaluation);
    evaluation.scores.templateResolution = templateScore;

    // 3. LANGUAGE CONSISTENCY: Is the prompt in the correct language?
    const languageScore = evaluateLanguageConsistency(prompt, persona.language, evaluation);
    evaluation.scores.languageConsistency = languageScore;

    // 4. BUSINESS CONTEXT: Does it have relevant business info?
    const businessScore = evaluateBusinessContext(prompt, persona, evaluation);
    evaluation.scores.businessContext = businessScore;

    // 5. RESPONSE FORMAT: Does it have conversation guidelines?
    const formatScore = evaluateResponseFormat(prompt, evaluation);
    evaluation.scores.responseFormat = formatScore;

    // 6. NO AGENCY LEAKAGE: Does it NOT mention VocalIA (for non-AGENCY)?
    const isolationScore = evaluateIsolation(prompt, persona, evaluation);
    evaluation.scores.isolation = isolationScore;

    // Calculate overall score (weighted)
    const weights = {
        personalization: 0.25,
        templateResolution: 0.20,
        languageConsistency: 0.15,
        businessContext: 0.20,
        responseFormat: 0.10,
        isolation: 0.10
    };

    evaluation.overallScore = Object.entries(evaluation.scores).reduce((sum, [key, score]) => {
        return sum + (score * weights[key]);
    }, 0);

    // Classify quality
    if (evaluation.overallScore >= 90) {
        evaluation.quality = 'EXCELLENT';
        qualityResults.excellent++;
    } else if (evaluation.overallScore >= 70) {
        evaluation.quality = 'GOOD';
        qualityResults.good++;
    } else if (evaluation.overallScore >= 50) {
        evaluation.quality = 'POOR';
        qualityResults.poor++;
    } else {
        evaluation.quality = 'CRITICAL';
        qualityResults.critical++;
    }

    qualityResults.total++;
    if (evaluation.issues.length > 0) {
        qualityResults.issues.push({
            clientId,
            widgetType,
            issues: evaluation.issues
        });
    }

    return evaluation;
}

function evaluatePersonalization(prompt, persona, evaluation) {
    if (!prompt) {
        evaluation.issues.push('NO PROMPT GENERATED');
        return 0;
    }

    let score = 100;
    const checks = [];

    // Check if client name appears in prompt
    if (persona.name) {
        if (!prompt.includes(persona.name)) {
            score -= 40;
            checks.push(`❌ Client name "${persona.name}" NOT in prompt`);
        } else {
            checks.push(`✅ Client name "${persona.name}" present`);
        }
    }

    // Check if phone appears (if available)
    if (persona.business_info?.phone) {
        if (!prompt.includes(persona.business_info.phone)) {
            score -= 15;
            checks.push(`⚠️ Phone "${persona.business_info.phone}" NOT in prompt`);
        }
    }

    // Check if address appears (if available)
    if (persona.business_info?.address) {
        const addressPart = persona.business_info.address.split(',')[0];
        if (!prompt.includes(addressPart)) {
            score -= 15;
            checks.push(`⚠️ Address not in prompt`);
        }
    }

    if (score < 60) {
        evaluation.issues.push('LOW PERSONALIZATION: ' + checks.filter(c => c.startsWith('❌')).join(', '));
    }

    return Math.max(0, score);
}

function evaluateTemplateResolution(prompt, evaluation) {
    if (!prompt) return 0;

    let score = 100;

    // Check for unresolved template variables
    const unresolvedTemplates = prompt.match(/\{\{[^}]+\}\}/g) || [];

    if (unresolvedTemplates.length > 0) {
        score -= unresolvedTemplates.length * 20;
        evaluation.issues.push(`UNRESOLVED TEMPLATES: ${unresolvedTemplates.join(', ')}`);
    }

    return Math.max(0, score);
}

function evaluateLanguageConsistency(prompt, expectedLang, evaluation) {
    if (!prompt) return 0;

    let score = 100;

    // Language-specific checks
    const langPatterns = {
        fr: { positive: /bonjour|merci|bienvenue|nous sommes/i, negative: /hello|welcome|thank you/i },
        en: { positive: /hello|welcome|thank you|our services/i, negative: /bonjour|bienvenue|merci/i },
        es: { positive: /hola|bienvenido|gracias|nuestros servicios/i, negative: /bonjour|hello/i },
        ar: { positive: /مرحبا|أهلا|شكرا/i, negative: /bonjour|hello|hola/i },
        ary: { positive: /مرحبا|أهلا|wakha|daba|kifash/i, negative: /est-ce que|comment/i }
    };

    const patterns = langPatterns[expectedLang];
    if (patterns) {
        // Check for positive patterns (expected language)
        if (!patterns.positive.test(prompt)) {
            score -= 20;
        }
        // Check for negative patterns (wrong language)
        if (patterns.negative.test(prompt) && expectedLang !== 'fr') {
            score -= 30;
            evaluation.issues.push(`LANGUAGE LEAK: Found French/English in ${expectedLang} prompt`);
        }
    }

    return Math.max(0, score);
}

function evaluateBusinessContext(prompt, persona, evaluation) {
    if (!prompt) return 0;

    let score = 100;
    const clientData = CLIENT_REGISTRY.clients[persona.clientId];

    // Check for services (if applicable)
    if (persona.services && persona.services.length > 0) {
        const hasAnyService = persona.services.some(s => prompt.toLowerCase().includes(s.toLowerCase()));
        if (!hasAnyService) {
            score -= 25;
            evaluation.issues.push(`NO SERVICES in prompt (expected: ${persona.services.slice(0, 3).join(', ')}...)`);
        }
    }

    // Check for horaires (if applicable)
    if (persona.horaires) {
        if (!prompt.includes(persona.horaires)) {
            score -= 15;
        }
    }

    // Check for payment details for ECOM
    if (persona.payment_config?.details && persona.archetypeKey === 'UNIVERSAL_ECOMMERCE') {
        if (!prompt.toLowerCase().includes('paiement') && !prompt.toLowerCase().includes('payment')) {
            score -= 20;
        }
    }

    return Math.max(0, score);
}

function evaluateResponseFormat(prompt, evaluation) {
    if (!prompt) return 0;

    let score = 100;

    // Check for response length guidelines
    const hasLengthGuideline = /\d+\s*(mots|words|phrases|sentences)/i.test(prompt) ||
                               /maximum|limit/i.test(prompt) ||
                               /court|brief|concis/i.test(prompt);

    if (!hasLengthGuideline) {
        score -= 30;
        evaluation.issues.push('NO RESPONSE LENGTH GUIDELINES');
    }

    // Check for conversation flow guidance
    const hasFlowGuidance = /question|confirm|clarif/i.test(prompt);
    if (!hasFlowGuidance) {
        score -= 20;
    }

    return Math.max(0, score);
}

function evaluateIsolation(prompt, persona, evaluation) {
    if (!prompt) return 0;
    if (persona.archetypeKey === 'AGENCY') return 100; // AGENCY can mention VocalIA

    let score = 100;

    // Check for VocalIA mentions (excluding URLs)
    const vocaliaMatches = prompt.match(/VocalIA(?!\.ma)/gi) || [];
    if (vocaliaMatches.length > 0) {
        score -= 50;
        evaluation.issues.push(`AGENCY LEAKAGE: ${vocaliaMatches.length} VocalIA mentions in non-AGENCY prompt`);
    }

    // Check for agency_v3 KB reference
    if (prompt.includes('agency_v3')) {
        score -= 50;
        evaluation.issues.push('AGENCY_V3 KB LEAK in non-AGENCY prompt');
    }

    return Math.max(0, score);
}

/**
 * Generate actual prompt for a client
 */
function generatePromptForClient(clientId, widgetType) {
    const persona = VoicePersonaInjector.getPersona(null, null, clientId, widgetType);

    if (!persona) {
        return { persona: null, prompt: null, error: `No persona found for ${clientId}/${widgetType}` };
    }

    // Store clientId for evaluation
    persona.clientId = clientId;

    const baseConfig = { instructions: '', session: {} };
    const injectedConfig = VoicePersonaInjector.inject(baseConfig, persona);

    const prompt = injectedConfig.session?.instructions || injectedConfig.instructions;

    return { persona, prompt, error: null };
}

// ============================================================
// TEST SUITE: B2B WIDGET OUTPUT QUALITY
// ============================================================
function testB2BOutputQuality() {
    logSection('B2B WIDGET OUTPUT QUALITY');

    const b2bClients = [
        'notaire_rabat_01',
        'agence_immo_01',
        'agence_commerciale_01'
    ];

    const results = [];

    b2bClients.forEach(clientId => {
        logSubSection(`Client: ${clientId}`);

        const { persona, prompt, error } = generatePromptForClient(clientId, 'B2B');

        if (error) {
            console.log(`  ❌ ERROR: ${error}`);
            qualityResults.critical++;
            qualityResults.total++;
            return;
        }

        const evaluation = evaluatePromptQuality(prompt, persona, clientId, 'B2B');
        results.push(evaluation);

        console.log(`  Persona: ${persona.name} (${persona.archetypeKey})`);
        console.log(`  Language: ${persona.language}`);
        console.log(`  Prompt Length: ${evaluation.promptLength} chars`);
        console.log(`  Scores:`);
        Object.entries(evaluation.scores).forEach(([key, score]) => {
            const emoji = score >= 80 ? '✅' : score >= 50 ? '⚠️' : '❌';
            console.log(`    ${emoji} ${key}: ${score}%`);
        });
        console.log(`  Overall: ${evaluation.overallScore.toFixed(1)}% → ${evaluation.quality}`);

        if (evaluation.issues.length > 0) {
            console.log(`  Issues:`);
            evaluation.issues.forEach(issue => console.log(`    🔴 ${issue}`));
        }
    });

    return results;
}

// ============================================================
// TEST SUITE: B2C WIDGET OUTPUT QUALITY
// ============================================================
function testB2COutputQuality() {
    logSection('B2C WIDGET OUTPUT QUALITY');

    const b2cClients = [
        'dentiste_casa_01',
        'medecin_general_01',
        'salon_coiffure_casa_01',
        'fitness_casa_01',
        'spa_marrakech_01',
        'hotel_marrakech_01'
    ];

    const results = [];

    b2cClients.forEach(clientId => {
        logSubSection(`Client: ${clientId}`);

        const { persona, prompt, error } = generatePromptForClient(clientId, 'B2C');

        if (error) {
            console.log(`  ❌ ERROR: ${error}`);
            qualityResults.critical++;
            qualityResults.total++;
            return;
        }

        const evaluation = evaluatePromptQuality(prompt, persona, clientId, 'B2C');
        results.push(evaluation);

        console.log(`  Persona: ${persona.name} (${persona.archetypeKey})`);
        console.log(`  Language: ${persona.language}`);
        console.log(`  Prompt Length: ${evaluation.promptLength} chars`);
        console.log(`  Scores:`);
        Object.entries(evaluation.scores).forEach(([key, score]) => {
            const emoji = score >= 80 ? '✅' : score >= 50 ? '⚠️' : '❌';
            console.log(`    ${emoji} ${key}: ${score}%`);
        });
        console.log(`  Overall: ${evaluation.overallScore.toFixed(1)}% → ${evaluation.quality}`);

        if (evaluation.issues.length > 0) {
            console.log(`  Issues:`);
            evaluation.issues.forEach(issue => console.log(`    🔴 ${issue}`));
        }
    });

    return results;
}

// ============================================================
// TEST SUITE: ECOM WIDGET OUTPUT QUALITY
// ============================================================
function testECOMOutputQuality() {
    logSection('ECOM WIDGET OUTPUT QUALITY');

    const ecomClients = [
        'ecom_nike_01',
        'ecom_darija_01'
    ];

    const results = [];

    ecomClients.forEach(clientId => {
        logSubSection(`Client: ${clientId}`);

        const { persona, prompt, error } = generatePromptForClient(clientId, 'ECOM');

        if (error) {
            console.log(`  ❌ ERROR: ${error}`);
            qualityResults.critical++;
            qualityResults.total++;
            return;
        }

        const evaluation = evaluatePromptQuality(prompt, persona, clientId, 'ECOM');
        results.push(evaluation);

        console.log(`  Persona: ${persona.name} (${persona.archetypeKey})`);
        console.log(`  Language: ${persona.language}`);
        console.log(`  Prompt Length: ${evaluation.promptLength} chars`);
        console.log(`  Scores:`);
        Object.entries(evaluation.scores).forEach(([key, score]) => {
            const emoji = score >= 80 ? '✅' : score >= 50 ? '⚠️' : '❌';
            console.log(`    ${emoji} ${key}: ${score}%`);
        });
        console.log(`  Overall: ${evaluation.overallScore.toFixed(1)}% → ${evaluation.quality}`);

        if (evaluation.issues.length > 0) {
            console.log(`  Issues:`);
            evaluation.issues.forEach(issue => console.log(`    🔴 ${issue}`));
        }
    });

    return results;
}

// ============================================================
// PROMPT SAMPLE OUTPUT
// ============================================================
function showPromptSample() {
    logSection('SAMPLE PROMPT OUTPUT (First 1000 chars)');

    // Show one B2C client prompt as sample
    const { persona, prompt, error } = generatePromptForClient('dentiste_casa_01', 'B2C');

    if (error) {
        console.log(`  ❌ ERROR: ${error}`);
        return;
    }

    console.log(`\n  Client: dentiste_casa_01`);
    console.log(`  Persona: ${persona.name}`);
    console.log(`  Archetype: ${persona.archetypeKey}`);
    console.log(`  Language: ${persona.language}`);
    console.log(`\n  ─── ACTUAL PROMPT (truncated) ───\n`);

    const truncatedPrompt = prompt?.substring(0, 1500) || 'NO PROMPT';
    console.log(truncatedPrompt);

    if (prompt?.length > 1500) {
        console.log(`\n  [...${prompt.length - 1500} more characters...]`);
    }
}

// ============================================================
// RUN ALL TESTS
// ============================================================
console.log('\n' + '█'.repeat(70));
console.log('  WIDGET OUTPUT QUALITY TEST SUITE');
console.log('  Session 250.97quater - ACTUAL OUTPUT VERIFICATION');
console.log('  Tests the REAL prompts that users will receive');
console.log('█'.repeat(70));

try {
    testB2BOutputQuality();
    testB2COutputQuality();
    testECOMOutputQuality();
    showPromptSample();
} catch (err) {
    console.error('\n❌ FATAL ERROR:', err.message);
    console.error(err.stack);
}

// ============================================================
// FINAL SUMMARY
// ============================================================
logSection('QUALITY SUMMARY');

console.log(`\n  Total Evaluations: ${qualityResults.total}`);
console.log(`  ✅ Excellent (≥90%): ${qualityResults.excellent}`);
console.log(`  🟡 Good (70-89%): ${qualityResults.good}`);
console.log(`  ⚠️ Poor (50-69%): ${qualityResults.poor}`);
console.log(`  ❌ Critical (<50%): ${qualityResults.critical}`);

const avgScore = qualityResults.total > 0
    ? ((qualityResults.excellent * 95 + qualityResults.good * 80 + qualityResults.poor * 60 + qualityResults.critical * 25) / qualityResults.total).toFixed(1)
    : 0;
console.log(`\n  Average Quality Score: ${avgScore}%`);

if (qualityResults.issues.length > 0) {
    console.log(`\n  ─── ALL ISSUES (${qualityResults.issues.length} clients with problems) ───`);
    qualityResults.issues.forEach(item => {
        console.log(`\n  ${item.clientId} (${item.widgetType}):`);
        item.issues.forEach(issue => console.log(`    🔴 ${issue}`));
    });
}

// Exit code based on critical issues
const criticalThreshold = 0;
const exitCode = qualityResults.critical > criticalThreshold ? 1 : 0;

console.log('\n' + '█'.repeat(70));
if (exitCode === 0) {
    console.log('  ✅ OUTPUT QUALITY: ACCEPTABLE');
} else {
    console.log('  ❌ OUTPUT QUALITY: CRITICAL ISSUES FOUND');
}
console.log('█'.repeat(70));

process.exit(exitCode);
