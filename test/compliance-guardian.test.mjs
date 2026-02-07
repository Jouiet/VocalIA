/**
 * VocalIA Compliance Guardian Tests
 *
 * Tests EU AI Act 2026 compliance rules:
 * - PII detection (GDPR)
 * - Unethical pressure tactics
 * - AI disclosure requirements
 * - Hardcoded credential detection
 * - Token limit enforcement
 *
 * Run: node --test test/compliance-guardian.test.mjs
 */



import { test, describe } from 'node:test';
import assert from 'node:assert';
import guardian from '../core/compliance-guardian.cjs';

describe('ComplianceGuardian', () => {
  test('module exports a singleton instance', () => {
    assert.ok(guardian, 'Should export an instance');
  });

  test('has rules array with 5 rules', () => {
    assert.ok(Array.isArray(guardian.rules));
    assert.strictEqual(guardian.rules.length, 5);
  });
});

describe('PII Detection (GDPR_PII)', () => {
  test('detects email addresses in RESPONSE', () => {
    const result = guardian.validate('Contact us at john@example.com', 'RESPONSE');
    const piiViolation = result.violations.find(v => v.rule === 'GDPR_PII');
    assert.ok(piiViolation, 'Should detect email as PII');
    assert.strictEqual(piiViolation.severity, 'HIGH');
  });

  test('detects SSN-like patterns', () => {
    const result = guardian.validate('Your SSN is 123-45-6789', 'RESPONSE');
    const piiViolation = result.violations.find(v => v.rule === 'GDPR_PII');
    assert.ok(piiViolation, 'Should detect SSN pattern');
  });

  test('allows PII in PROMPT context (agent processing)', () => {
    const result = guardian.validate('User email: test@mail.com', 'PROMPT');
    const piiViolation = result.violations.find(v => v.rule === 'GDPR_PII');
    assert.strictEqual(piiViolation, undefined, 'Should NOT flag PII in PROMPT');
  });

  test('clean text passes PII check', () => {
    const result = guardian.validate('Bonjour, comment allez-vous?', 'RESPONSE');
    const piiViolation = result.violations.find(v => v.rule === 'GDPR_PII');
    assert.strictEqual(piiViolation, undefined);
  });
});

describe('Ethical Pressure Detection (ETHICS_PRESSURE)', () => {
  test('detects pressure tactics', () => {
    const result = guardian.validate('Buy now or die trying', 'RESPONSE');
    const violation = result.violations.find(v => v.rule === 'ETHICS_PRESSURE');
    assert.ok(violation, 'Should detect pressure');
    assert.strictEqual(result.valid, false, 'HIGH severity = invalid');
  });

  test('detects harassment keywords', () => {
    const result = guardian.validate("Don't take no for an answer", 'RESPONSE');
    const violation = result.violations.find(v => v.rule === 'ETHICS_PRESSURE');
    assert.ok(violation);
  });

  test('clean sales text passes', () => {
    const result = guardian.validate('Nous vous recommandons notre offre premium.', 'RESPONSE');
    const violation = result.violations.find(v => v.rule === 'ETHICS_PRESSURE');
    assert.strictEqual(violation, undefined);
  });
});

describe('AI Disclosure (AI_DISCLOSURE)', () => {
  test('flags missing AI disclosure in EMAIL', () => {
    const result = guardian.validate('Hello, here is your quote.', 'EMAIL');
    const violation = result.violations.find(v => v.rule === 'AI_DISCLOSURE');
    assert.ok(violation, 'Should require AI disclosure in outreach');
    assert.strictEqual(violation.severity, 'MEDIUM');
  });

  test('passes when [AI] tag present in EMAIL', () => {
    const result = guardian.validate('[AI] Hello, here is your quote.', 'EMAIL');
    const violation = result.violations.find(v => v.rule === 'AI_DISCLOSURE');
    assert.strictEqual(violation, undefined);
  });

  test('passes when French AI disclosure present', () => {
    const result = guardian.validate('Assisté par IA - Voici votre devis.', 'SMS');
    const violation = result.violations.find(v => v.rule === 'AI_DISCLOSURE');
    assert.strictEqual(violation, undefined);
  });

  test('does not require disclosure for RESPONSE type', () => {
    const result = guardian.validate('Regular response without AI tag', 'RESPONSE');
    const violation = result.violations.find(v => v.rule === 'AI_DISCLOSURE');
    assert.strictEqual(violation, undefined, 'RESPONSE is not outreach');
  });
});

describe('Credential Detection (STRIPE_KEY)', () => {
  test('detects hardcoded Stripe live key', () => {
    const result = guardian.validate('key: sk_live_' + 'AbCdEfGhIjKlMnOpQrStUvWx', 'PROMPT');
    const violation = result.violations.find(v => v.rule === 'STRIPE_KEY');
    assert.ok(violation, 'Should detect Stripe key');
    assert.strictEqual(violation.severity, 'CRITICAL');
  });

  test('detects test Stripe key', () => {
    const result = guardian.validate('sk_test_' + '123456789012345678901234', 'RESPONSE');
    const violation = result.violations.find(v => v.rule === 'STRIPE_KEY');
    assert.ok(violation);
  });

  test('safe text passes credential check', () => {
    const result = guardian.validate('Please use your Stripe dashboard', 'RESPONSE');
    const violation = result.violations.find(v => v.rule === 'STRIPE_KEY');
    assert.strictEqual(violation, undefined);
  });
});

describe('Validation Result Structure', () => {
  test('valid=true when no HIGH severity violations', () => {
    const result = guardian.validate('Bonjour!', 'RESPONSE');
    assert.strictEqual(result.valid, true);
    assert.ok(Array.isArray(result.violations));
    assert.strictEqual(result.violations.length, 0);
  });

  test('valid=false when HIGH severity violation present', () => {
    const result = guardian.validate('harass them into buying', 'RESPONSE');
    assert.strictEqual(result.valid, false);
  });

  test('valid=true even with MEDIUM violations', () => {
    const result = guardian.validate('Hello, here is info', 'EMAIL');
    // AI_DISCLOSURE is MEDIUM, so valid should still be true
    assert.strictEqual(result.valid, true);
  });
});
