/**
 * Tests for QualityGate — Post-response quality verification
 * VocalIA — Session 250.245
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { assessResponseQuality, SCORE_THRESHOLD } = require('../core/quality-gate.cjs');

// ─────────────────────────────────────────────────────────────────────────────
// Basic quality checks
// ─────────────────────────────────────────────────────────────────────────────

describe('QualityGate.assessResponseQuality()', () => {
  test('good response passes quality gate', () => {
    const result = assessResponseQuality(
      'Nos tarifs commencent à 49€ par mois pour le plan Starter.',
      'Quels sont vos tarifs ?',
      'Plan Starter: 49€/mois, Plan Pro: 99€/mois',
      'fr'
    );
    assert.ok(result.passed, `Score ${result.score} should pass (threshold: ${SCORE_THRESHOLD})`);
    assert.ok(result.score >= SCORE_THRESHOLD);
  });

  test('null response fails with score 0', () => {
    const result = assessResponseQuality(null, 'query', '', 'fr');
    assert.strictEqual(result.score, 0);
    assert.strictEqual(result.passed, false);
  });

  test('empty string response fails', () => {
    const result = assessResponseQuality('', 'query', '', 'fr');
    assert.strictEqual(result.score, 0);
    assert.strictEqual(result.passed, false);
  });

  test('very short response loses points', () => {
    const result = assessResponseQuality('Oui.', 'Quels sont vos tarifs ?', '', 'fr');
    assert.ok(result.score < 100);
    const minCheck = result.checks.find(c => c.check === 'min_length');
    assert.ok(minCheck);
    assert.strictEqual(minCheck.passed, false);
  });

  test('adequate length response passes min_length', () => {
    const result = assessResponseQuality(
      'Voici les informations que vous avez demandées concernant nos services.',
      'Quels services proposez-vous ?',
      '',
      'fr'
    );
    const minCheck = result.checks.find(c => c.check === 'min_length');
    assert.ok(minCheck);
    assert.strictEqual(minCheck.passed, true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Price hallucination detection
// ─────────────────────────────────────────────────────────────────────────────

describe('QualityGate price hallucination detection', () => {
  test('detects invented prices not in RAG', () => {
    const result = assessResponseQuality(
      'Notre service coûte 299€ par mois.',
      'Quels sont vos tarifs ?',
      'Plan Starter: 49€/mois, Plan Pro: 99€/mois',
      'fr'
    );
    const priceCheck = result.checks.find(c => c.check === 'price_hallucination');
    assert.ok(priceCheck);
    assert.strictEqual(priceCheck.passed, false);
  });

  test('correct prices from RAG pass', () => {
    const result = assessResponseQuality(
      'Le plan Starter est à 49€ par mois.',
      'Quels sont vos tarifs ?',
      'Plan Starter: 49€/mois, Plan Pro: 99€/mois',
      'fr'
    );
    const priceCheck = result.checks.find(c => c.check === 'price_hallucination');
    if (priceCheck) {
      assert.strictEqual(priceCheck.passed, true);
    }
  });

  test('no penalty when RAG has no prices', () => {
    const result = assessResponseQuality(
      'Notre service coûte 50€ par mois.',
      'Quels sont vos tarifs ?',
      'Nous proposons des services vocaux pour les entreprises.',
      'fr'
    );
    // No price_hallucination check should be negative since RAG has no prices to compare
    const priceCheck = result.checks.find(c => c.check === 'price_hallucination');
    // If the check exists, it should not penalize since RAG has no prices
    if (priceCheck) {
      assert.strictEqual(priceCheck.passed, true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Off-topic detection
// ─────────────────────────────────────────────────────────────────────────────

describe('QualityGate off-topic detection', () => {
  test('response related to query passes', () => {
    const result = assessResponseQuality(
      'Nos tarifs pour le service vocal commencent à 49 euros.',
      'Quels sont vos tarifs pour le service vocal ?',
      '',
      'fr'
    );
    const topicCheck = result.checks.find(c => c.check === 'off_topic');
    if (topicCheck) {
      assert.strictEqual(topicCheck.passed, true);
    }
  });

  test('completely unrelated response fails', () => {
    const result = assessResponseQuality(
      'La météo est belle aujourd\'hui à Paris. Le soleil brille.',
      'Comment installer votre widget vocal sur notre site WordPress ?',
      '',
      'fr'
    );
    const topicCheck = result.checks.find(c => c.check === 'off_topic');
    if (topicCheck) {
      assert.strictEqual(topicCheck.passed, false);
    }
  });

  test('short query skips off-topic check (not enough keywords)', () => {
    const result = assessResponseQuality(
      'Bonjour ! Comment puis-je vous aider ?',
      'Bonjour',
      '',
      'fr'
    );
    const topicCheck = result.checks.find(c => c.check === 'off_topic');
    // Short query (< 3 meaningful words) should not trigger off-topic check
    assert.ok(!topicCheck || topicCheck.passed);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Refusal detection
// ─────────────────────────────────────────────────────────────────────────────

describe('QualityGate refusal detection', () => {
  test('refusal with RAG context is penalized', () => {
    const ragContext = 'VocalIA propose des plans à partir de 49€. Le plan Pro est à 99€ par mois. Support technique inclus.';
    const result = assessResponseQuality(
      'I cannot assist with pricing information.',
      'What are your prices?',
      ragContext,
      'en'
    );
    const refusalCheck = result.checks.find(c => c.check === 'refusal_with_context');
    assert.ok(refusalCheck);
    assert.strictEqual(refusalCheck.passed, false);
  });

  test('refusal without RAG context is not penalized', () => {
    const result = assessResponseQuality(
      'I cannot assist with that request.',
      'What are your prices?',
      '',
      'en'
    );
    const refusalCheck = result.checks.find(c => c.check === 'refusal_with_context');
    assert.ok(!refusalCheck); // Check should not trigger
  });

  test('normal response is not flagged as refusal', () => {
    const result = assessResponseQuality(
      'Our plans start at 49 euros per month for the Starter plan.',
      'What are your prices?',
      'Plan Starter: 49€',
      'en'
    );
    const refusalCheck = result.checks.find(c => c.check === 'refusal_with_context');
    assert.ok(!refusalCheck);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Score threshold
// ─────────────────────────────────────────────────────────────────────────────

describe('QualityGate scoring', () => {
  test('SCORE_THRESHOLD is 60', () => {
    assert.strictEqual(SCORE_THRESHOLD, 60);
  });

  test('perfect response scores 100', () => {
    const result = assessResponseQuality(
      'Nos tarifs commencent à 49€ par mois pour le plan Starter et 99€ pour le plan Pro.',
      'Quels sont vos tarifs ?',
      'Plan Starter: 49€/mois, Plan Pro: 99€/mois',
      'fr'
    );
    assert.strictEqual(result.score, 100);
    assert.strictEqual(result.passed, true);
  });

  test('multiple failures can stack up', () => {
    // Short + refusal + off-topic should fail hard
    const result = assessResponseQuality(
      'I cannot.',
      'Comment installer le widget vocal sur WordPress avec WooCommerce ?',
      'Instructions: Ajoutez le code snippet dans le footer de votre thème WordPress.',
      'fr'
    );
    assert.ok(result.score < SCORE_THRESHOLD);
    assert.strictEqual(result.passed, false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('QualityGate edge cases', () => {
  test('undefined response returns score 0', () => {
    const result = assessResponseQuality(undefined, 'query', '', 'fr');
    assert.strictEqual(result.score, 0);
    assert.strictEqual(result.passed, false);
  });

  test('numeric response type returns score 0', () => {
    const result = assessResponseQuality(42, 'query', '', 'fr');
    assert.strictEqual(result.score, 0);
    assert.strictEqual(result.passed, false);
  });

  test('response with only whitespace fails min_length', () => {
    const result = assessResponseQuality('   \n\t  ', 'query', '', 'fr');
    const minCheck = result.checks.find(c => c.check === 'min_length');
    assert.strictEqual(minCheck.passed, false);
  });

  test('Arabic response with Arabic query works', () => {
    const result = assessResponseQuality(
      'أسعارنا تبدأ من 49 يورو شهريا للخطة الأساسية و99 يورو للخطة الاحترافية.',
      'ما هي أسعاركم؟',
      'الخطة الأساسية: 49€',
      'ar'
    );
    assert.ok(result.passed);
  });

  test('MAD currency detected', () => {
    const result = assessResponseQuality(
      'Le prix est de 500 MAD par mois.',
      'Quel est le prix ?',
      'Prix: 500 MAD/mois',
      'fr'
    );
    assert.ok(result.passed);
  });
});
