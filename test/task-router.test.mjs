/**
 * Tests for TaskRouter — Dynamic Model Routing by Competence
 * VocalIA — Session 250.245
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const {
  classifyTask,
  getOptimalProviderOrder,
  TASK_TYPES,
  ROUTING_TABLE,
  QUAL_PATTERN,
  REC_PATTERN,
  SUPPORT_PATTERN,
} = require('../core/task-router.cjs');

// ─────────────────────────────────────────────────────────────────────────────
// classifyTask()
// ─────────────────────────────────────────────────────────────────────────────

describe('TaskRouter.classifyTask()', () => {
  // Darija = absolute priority regardless of content
  test('Darija language always returns DARIJA task type', () => {
    assert.strictEqual(classifyTask('Quel est le prix ?', 'ary', null), TASK_TYPES.DARIJA);
    assert.strictEqual(classifyTask('recommend me a product', 'ary', null), TASK_TYPES.DARIJA);
    assert.strictEqual(classifyTask('help me fix this', 'ary', null), TASK_TYPES.DARIJA);
  });

  // Qualification patterns (FR)
  test('detects qualification intent — budget (FR)', () => {
    assert.strictEqual(classifyTask('Quel est votre budget ?', 'fr', null), TASK_TYPES.QUALIFICATION);
  });

  test('detects qualification intent — prix (FR)', () => {
    assert.strictEqual(classifyTask('Combien ça coûte ?', 'fr', null), TASK_TYPES.QUALIFICATION);
  });

  test('detects qualification intent — tarif (FR)', () => {
    assert.strictEqual(classifyTask('Quels sont vos tarifs ?', 'fr', null), TASK_TYPES.QUALIFICATION);
  });

  test('detects qualification intent — délai (FR)', () => {
    assert.strictEqual(classifyTask('Quel est le délai de livraison ?', 'fr', null), TASK_TYPES.QUALIFICATION);
  });

  test('detects qualification intent — décideur (FR)', () => {
    assert.strictEqual(classifyTask('Qui décide dans votre entreprise ?', 'fr', null), TASK_TYPES.QUALIFICATION);
  });

  // Qualification patterns (EN)
  test('detects qualification intent — price (EN)', () => {
    assert.strictEqual(classifyTask('What is the price?', 'en', null), TASK_TYPES.QUALIFICATION);
  });

  test('detects qualification intent — cost (EN)', () => {
    assert.strictEqual(classifyTask('How much does it cost?', 'en', null), TASK_TYPES.QUALIFICATION);
  });

  test('detects qualification intent — deadline (EN)', () => {
    assert.strictEqual(classifyTask('What is the deadline?', 'en', null), TASK_TYPES.QUALIFICATION);
  });

  test('detects qualification intent — decision (EN)', () => {
    assert.strictEqual(classifyTask('Who makes the decision?', 'en', null), TASK_TYPES.QUALIFICATION);
  });

  // Qualification patterns (AR)
  test('detects qualification intent — ميزانية (AR)', () => {
    assert.strictEqual(classifyTask('ما هي ميزانيتكم؟', 'ar', null), TASK_TYPES.QUALIFICATION);
  });

  test('detects qualification intent — سعر (AR)', () => {
    assert.strictEqual(classifyTask('كم سعر الخدمة؟', 'ar', null), TASK_TYPES.QUALIFICATION);
  });

  // Recommendation patterns (FR)
  test('detects recommendation intent — recommande (FR)', () => {
    assert.strictEqual(classifyTask('Que me recommandez-vous ?', 'fr', null), TASK_TYPES.RECOMMENDATION);
  });

  test('detects recommendation intent — quel produit (FR)', () => {
    assert.strictEqual(classifyTask('Quel produit choisir ?', 'fr', null), TASK_TYPES.RECOMMENDATION);
  });

  test('detects recommendation intent — meilleure option (FR)', () => {
    assert.strictEqual(classifyTask('Quelle est la meilleure option ?', 'fr', null), TASK_TYPES.RECOMMENDATION);
  });

  // Recommendation patterns (EN)
  test('detects recommendation intent — recommend (EN)', () => {
    assert.strictEqual(classifyTask('Can you recommend something?', 'en', null), TASK_TYPES.RECOMMENDATION);
  });

  test('detects recommendation intent — which plan (EN)', () => {
    assert.strictEqual(classifyTask('Which plan is best for me?', 'en', null), TASK_TYPES.RECOMMENDATION);
  });

  // Recommendation patterns (AR/Darija-like in AR mode)
  test('detects recommendation intent — قترح (AR)', () => {
    assert.strictEqual(classifyTask('اقترح لي شيء', 'ar', null), TASK_TYPES.RECOMMENDATION);
  });

  // Support patterns (FR)
  test('detects support intent — problème (FR)', () => {
    assert.strictEqual(classifyTask('J\'ai un problème avec mon compte', 'fr', null), TASK_TYPES.SUPPORT);
  });

  test('detects support intent — marche pas (FR)', () => {
    assert.strictEqual(classifyTask('Le widget ne marche pas', 'fr', null), TASK_TYPES.SUPPORT);
  });

  test('detects support intent — erreur (FR)', () => {
    assert.strictEqual(classifyTask('Il y a une erreur sur la page', 'fr', null), TASK_TYPES.SUPPORT);
  });

  test('detects support intent — comment faire (FR)', () => {
    assert.strictEqual(classifyTask('Comment faire pour installer le widget ?', 'fr', null), TASK_TYPES.SUPPORT);
  });

  // Support patterns (EN)
  test('detects support intent — help (EN)', () => {
    assert.strictEqual(classifyTask('I need help with setup', 'en', null), TASK_TYPES.SUPPORT);
  });

  test('detects support intent — not working (EN)', () => {
    assert.strictEqual(classifyTask('The voice widget is not working', 'en', null), TASK_TYPES.SUPPORT);
  });

  test('detects support intent — error (EN)', () => {
    assert.strictEqual(classifyTask('I\'m getting an error message', 'en', null), TASK_TYPES.SUPPORT);
  });

  // Support patterns (AR)
  test('detects support intent — مشكل (AR)', () => {
    assert.strictEqual(classifyTask('عندي مشكل في الموقع', 'ar', null), TASK_TYPES.SUPPORT);
  });

  // Default: CONVERSATION
  test('general greeting defaults to CONVERSATION', () => {
    assert.strictEqual(classifyTask('Bonjour !', 'fr', null), TASK_TYPES.CONVERSATION);
  });

  test('general question defaults to CONVERSATION', () => {
    assert.strictEqual(classifyTask('Parlez-moi de vos services', 'fr', null), TASK_TYPES.CONVERSATION);
  });

  test('small talk defaults to CONVERSATION', () => {
    assert.strictEqual(classifyTask('Hello, how are you?', 'en', null), TASK_TYPES.CONVERSATION);
  });

  // ES
  test('detects qualification intent — precio (ES)', () => {
    assert.strictEqual(classifyTask('Cuál es el precio?', 'es', null), TASK_TYPES.QUALIFICATION);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getOptimalProviderOrder()
// ─────────────────────────────────────────────────────────────────────────────

describe('TaskRouter.getOptimalProviderOrder()', () => {
  const allProviders = {
    grok: { enabled: true },
    gemini: { enabled: true },
    anthropic: { enabled: true },
    atlasChat: { enabled: true },
  };

  test('CONVERSATION: Grok first (low latency)', () => {
    const order = getOptimalProviderOrder(TASK_TYPES.CONVERSATION, allProviders);
    assert.strictEqual(order[0], 'grok');
    assert.ok(order.includes('gemini'));
    assert.ok(order.includes('anthropic'));
  });

  test('QUALIFICATION: Anthropic first (structured reasoning)', () => {
    const order = getOptimalProviderOrder(TASK_TYPES.QUALIFICATION, allProviders);
    assert.strictEqual(order[0], 'anthropic');
  });

  test('RECOMMENDATION: Gemini first (data analysis)', () => {
    const order = getOptimalProviderOrder(TASK_TYPES.RECOMMENDATION, allProviders);
    assert.strictEqual(order[0], 'gemini');
  });

  test('SUPPORT: Gemini first (KB search, long context)', () => {
    const order = getOptimalProviderOrder(TASK_TYPES.SUPPORT, allProviders);
    assert.strictEqual(order[0], 'gemini');
  });

  test('DARIJA: includes atlasChat', () => {
    const order = getOptimalProviderOrder(TASK_TYPES.DARIJA, allProviders);
    assert.ok(order.includes('atlasChat'));
    assert.strictEqual(order[0], 'grok');
  });

  test('filters out disabled providers', () => {
    const limitedProviders = {
      grok: { enabled: false },
      gemini: { enabled: true },
      anthropic: { enabled: true },
    };
    const order = getOptimalProviderOrder(TASK_TYPES.CONVERSATION, limitedProviders);
    assert.ok(!order.includes('grok'));
    assert.strictEqual(order[0], 'gemini');
  });

  test('filters out missing providers', () => {
    const partialProviders = {
      grok: { enabled: true },
    };
    const order = getOptimalProviderOrder(TASK_TYPES.QUALIFICATION, partialProviders);
    assert.strictEqual(order.length, 1);
    assert.strictEqual(order[0], 'grok'); // grok is the only one available, even though anthropic is preferred
  });

  test('returns empty array if no providers enabled', () => {
    const noProviders = {};
    const order = getOptimalProviderOrder(TASK_TYPES.CONVERSATION, noProviders);
    assert.strictEqual(order.length, 0);
  });

  test('unknown task type falls back to CONVERSATION routing', () => {
    const order = getOptimalProviderOrder('unknown_type', allProviders);
    assert.deepStrictEqual(order, getOptimalProviderOrder(TASK_TYPES.CONVERSATION, allProviders));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTING_TABLE integrity
// ─────────────────────────────────────────────────────────────────────────────

describe('TaskRouter.ROUTING_TABLE integrity', () => {
  test('every TASK_TYPE has a routing entry', () => {
    for (const type of Object.values(TASK_TYPES)) {
      assert.ok(ROUTING_TABLE[type], `Missing routing for ${type}`);
      assert.ok(Array.isArray(ROUTING_TABLE[type]), `Routing for ${type} is not an array`);
      assert.ok(ROUTING_TABLE[type].length > 0, `Routing for ${type} is empty`);
    }
  });

  test('ROUTING_TABLE only references valid provider keys', () => {
    const validProviders = ['grok', 'gemini', 'anthropic', 'atlasChat'];
    for (const [type, providers] of Object.entries(ROUTING_TABLE)) {
      for (const p of providers) {
        assert.ok(validProviders.includes(p), `Invalid provider "${p}" in routing for ${type}`);
      }
    }
  });

  test('CONVERSATION starts with grok (latency-critical)', () => {
    assert.strictEqual(ROUTING_TABLE[TASK_TYPES.CONVERSATION][0], 'grok');
  });

  test('QUALIFICATION starts with anthropic (reasoning-critical)', () => {
    assert.strictEqual(ROUTING_TABLE[TASK_TYPES.QUALIFICATION][0], 'anthropic');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Pattern compilation (performance)
// ─────────────────────────────────────────────────────────────────────────────

describe('TaskRouter pattern performance', () => {
  test('QUAL_PATTERN is a compiled RegExp', () => {
    assert.ok(QUAL_PATTERN instanceof RegExp);
  });

  test('REC_PATTERN is a compiled RegExp', () => {
    assert.ok(REC_PATTERN instanceof RegExp);
  });

  test('SUPPORT_PATTERN is a compiled RegExp', () => {
    assert.ok(SUPPORT_PATTERN instanceof RegExp);
  });

  test('patterns are case-insensitive', () => {
    assert.ok(QUAL_PATTERN.flags.includes('i'));
    assert.ok(REC_PATTERN.flags.includes('i'));
    assert.ok(SUPPORT_PATTERN.flags.includes('i'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('TaskRouter edge cases', () => {
  test('empty message defaults to CONVERSATION', () => {
    assert.strictEqual(classifyTask('', 'fr', null), TASK_TYPES.CONVERSATION);
  });

  test('null session does not crash', () => {
    assert.strictEqual(classifyTask('Bonjour', 'fr', null), TASK_TYPES.CONVERSATION);
  });

  test('qualification takes priority over recommendation in ambiguous message', () => {
    // "Quel est le prix du produit recommandé ?" — has both qual and rec patterns
    const result = classifyTask('Quel est le prix du produit recommandé ?', 'fr', null);
    // Qualification is checked first in the code, so it should win
    assert.strictEqual(result, TASK_TYPES.QUALIFICATION);
  });

  test('qualification takes priority over support', () => {
    // "J\'ai un problème avec le prix" — has both support and qual patterns
    const result = classifyTask('J\'ai un problème avec le prix', 'fr', null);
    assert.strictEqual(result, TASK_TYPES.QUALIFICATION);
  });

  test('DARIJA overrides everything regardless of content', () => {
    // Message has qualification pattern but language is Darija
    const result = classifyTask('budget price cost deadline', 'ary', null);
    assert.strictEqual(result, TASK_TYPES.DARIJA);
  });
});
