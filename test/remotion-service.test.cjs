'use strict';

/**
 * VocalIA Remotion Service Tests
 *
 * Tests:
 * - COMPOSITIONS registry (13 compositions with metadata)
 * - LANGUAGES constant (5 languages)
 * - HITL_ENABLED default
 * - listCompositions (CLI display function)
 * - healthCheck structure
 * - getHITL integration
 *
 * NOTE: Does NOT execute Remotion renders. Tests constants and metadata only.
 *
 * Run: node --test test/remotion-service.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
  COMPOSITIONS,
  LANGUAGES,
  HITL_ENABLED,
  listCompositions,
  healthCheck,
  getHITL
} = require('../core/remotion-service.cjs');

// ─── COMPOSITIONS ───────────────────────────────────────────────────

describe('RemotionService COMPOSITIONS', () => {
  test('has 13 compositions', () => {
    assert.strictEqual(Object.keys(COMPOSITIONS).length, 13);
  });

  test('all compositions have required fields', () => {
    for (const [key, comp] of Object.entries(COMPOSITIONS)) {
      assert.ok(comp.id, `${key} missing id`);
      assert.ok(comp.output, `${key} missing output`);
      assert.strictEqual(typeof comp.duration, 'number', `${key} missing duration`);
      assert.ok(comp.description, `${key} missing description`);
    }
  });

  test('has demo composition', () => {
    assert.ok(COMPOSITIONS.demo);
    assert.strictEqual(COMPOSITIONS.demo.id, 'VocaliaDemo');
    assert.strictEqual(COMPOSITIONS.demo.duration, 30);
  });

  test('has features composition', () => {
    assert.ok(COMPOSITIONS.features);
    assert.strictEqual(COMPOSITIONS.features.id, 'FeatureShowcase');
    assert.strictEqual(COMPOSITIONS.features.duration, 45);
  });

  test('has testimonial composition', () => {
    assert.ok(COMPOSITIONS.testimonial);
    assert.strictEqual(COMPOSITIONS.testimonial.duration, 20);
  });

  test('has thumbnail still', () => {
    assert.ok(COMPOSITIONS.thumbnail);
    assert.strictEqual(COMPOSITIONS.thumbnail.isStill, true);
    assert.strictEqual(COMPOSITIONS.thumbnail.duration, 0);
    assert.ok(COMPOSITIONS.thumbnail.output.includes('.png'));
  });

  test('has onboarding composition (60s)', () => {
    assert.ok(COMPOSITIONS.onboarding);
    assert.strictEqual(COMPOSITIONS.onboarding.duration, 60);
  });

  test('has datareport composition', () => {
    assert.ok(COMPOSITIONS.datareport);
    assert.strictEqual(COMPOSITIONS.datareport.duration, 45);
  });

  test('has socialclip compositions (15s each)', () => {
    assert.ok(COMPOSITIONS.socialclip);
    assert.strictEqual(COMPOSITIONS.socialclip.duration, 15);
    assert.ok(COMPOSITIONS['socialclip-vertical']);
    assert.strictEqual(COMPOSITIONS['socialclip-vertical'].duration, 15);
    assert.ok(COMPOSITIONS['socialclip-horizontal']);
    assert.strictEqual(COMPOSITIONS['socialclip-horizontal'].duration, 15);
  });

  test('has pricing composition', () => {
    assert.ok(COMPOSITIONS.pricing);
    assert.strictEqual(COMPOSITIONS.pricing.duration, 30);
  });

  test('has integration compositions (40s each)', () => {
    assert.ok(COMPOSITIONS['integration-hubspot']);
    assert.strictEqual(COMPOSITIONS['integration-hubspot'].duration, 40);
    assert.ok(COMPOSITIONS['integration-shopify']);
    assert.strictEqual(COMPOSITIONS['integration-shopify'].duration, 40);
    assert.ok(COMPOSITIONS['integration-stripe']);
    assert.strictEqual(COMPOSITIONS['integration-stripe'].duration, 40);
  });

  test('all outputs have valid extensions', () => {
    for (const [key, comp] of Object.entries(COMPOSITIONS)) {
      assert.ok(
        comp.output.endsWith('.mp4') || comp.output.endsWith('.png'),
        `${key} has invalid output extension: ${comp.output}`
      );
    }
  });
});

// ─── LANGUAGES ──────────────────────────────────────────────────────

describe('RemotionService LANGUAGES', () => {
  test('has 5 languages', () => {
    assert.strictEqual(LANGUAGES.length, 5);
  });

  test('includes fr, en, es, ar, ary', () => {
    assert.ok(LANGUAGES.includes('fr'));
    assert.ok(LANGUAGES.includes('en'));
    assert.ok(LANGUAGES.includes('es'));
    assert.ok(LANGUAGES.includes('ar'));
    assert.ok(LANGUAGES.includes('ary'));
  });
});

// ─── HITL ───────────────────────────────────────────────────────────

describe('RemotionService HITL', () => {
  test('HITL_ENABLED is boolean', () => {
    assert.strictEqual(typeof HITL_ENABLED, 'boolean');
  });

  test('getHITL returns HITL service or null', () => {
    const hitl = getHITL();
    if (hitl) {
      assert.ok(hitl.queueVideo);
      assert.ok(hitl.STATES);
    }
  });
});

// ─── listCompositions ───────────────────────────────────────────────

describe('RemotionService listCompositions', () => {
  test('is a function', () => {
    assert.strictEqual(typeof listCompositions, 'function');
  });

  test('executes without error', () => {
    // listCompositions is a CLI display function (console.log output)
    assert.doesNotThrow(() => listCompositions());
  });
});

// ─── healthCheck ────────────────────────────────────────────────────

describe('RemotionService healthCheck', () => {
  test('returns object with service name', () => {
    const health = healthCheck();
    assert.strictEqual(health.service, 'Remotion');
  });

  test('returns compositions array', () => {
    const health = healthCheck();
    assert.ok(Array.isArray(health.compositions));
    assert.strictEqual(health.compositions.length, 13);
  });

  test('returns languages array', () => {
    const health = healthCheck();
    assert.ok(Array.isArray(health.languages));
    assert.strictEqual(health.languages.length, 5);
  });

  test('returns installed boolean', () => {
    const health = healthCheck();
    assert.strictEqual(typeof health.installed, 'boolean');
  });

  test('returns metrics object', () => {
    const health = healthCheck();
    assert.ok(health.metrics);
    assert.strictEqual(health.metrics.personas, 40);
    assert.strictEqual(health.metrics.languages, 5);
  });
});
