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
 * Run: node --test test/remotion-service.test.mjs
 */


import { test, describe } from 'node:test';
import assert from 'node:assert';
import { COMPOSITIONS, LANGUAGES, HITL_ENABLED, VOCALIA_METRICS, listCompositions, healthCheck, getHITL, renderComposition, renderCompositionDirect, queueForApproval, processApproved, renderAll, renderAllLanguages, generateVideo, installDependencies, startStudio, getCompositionId } from '../core/remotion-service.cjs';


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
    assert.strictEqual(health.metrics.personas, 38, 'Personas: 38 (5 eliminated session 250.120)');
    assert.strictEqual(health.metrics.languages, 5);
  });

  test('returns totalCompositions count', () => {
    const health = healthCheck();
    const expected = Object.keys(COMPOSITIONS).length * LANGUAGES.length + Object.keys(COMPOSITIONS).length;
    assert.strictEqual(health.totalCompositions, expected);
  });

  test('returns ready boolean', () => {
    const health = healthCheck();
    assert.strictEqual(typeof health.ready, 'boolean');
  });

  test('returns outputs object', () => {
    const health = healthCheck();
    assert.ok(health.outputs);
    for (const key of Object.keys(COMPOSITIONS)) {
      assert.ok(health.outputs[key] !== undefined, `Missing output for ${key}`);
      assert.strictEqual(typeof health.outputs[key].exists, 'boolean');
      assert.strictEqual(typeof health.outputs[key].size, 'number');
    }
  });

  test('returns version string', () => {
    const health = healthCheck();
    assert.strictEqual(typeof health.version, 'string');
  });
});

// ─── VOCALIA_METRICS ─────────────────────────────────────────────

describe('RemotionService VOCALIA_METRICS', () => {
  test('has personas count', () => {
    assert.strictEqual(VOCALIA_METRICS.personas, 38, 'Personas: 38 (5 eliminated session 250.120)');
  });

  test('has languages count', () => {
    assert.strictEqual(VOCALIA_METRICS.languages, 5);
  });

  test('has mcpTools count', () => {
    assert.strictEqual(typeof VOCALIA_METRICS.mcpTools, 'number');
    assert.ok(VOCALIA_METRICS.mcpTools > 100);
  });

  test('has integrations count', () => {
    assert.strictEqual(typeof VOCALIA_METRICS.integrations, 'number');
    assert.ok(VOCALIA_METRICS.integrations > 10);
  });

  test('has ecommercePlatforms count', () => {
    assert.strictEqual(VOCALIA_METRICS.ecommercePlatforms, 7);
  });

  test('has stripeTools count', () => {
    assert.strictEqual(VOCALIA_METRICS.stripeTools, 19);
  });
});

// ─── COMPOSITIONS detail ────────────────────────────────────────

describe('RemotionService COMPOSITIONS detail', () => {
  test('socialclip compositions have 15s duration', () => {
    const socialKeys = Object.keys(COMPOSITIONS).filter(k => k.startsWith('socialclip'));
    assert.strictEqual(socialKeys.length, 3);
    for (const key of socialKeys) {
      assert.strictEqual(COMPOSITIONS[key].duration, 15);
    }
  });

  test('integration compositions have 40s duration', () => {
    const integrationKeys = Object.keys(COMPOSITIONS).filter(k => k.startsWith('integration'));
    assert.strictEqual(integrationKeys.length, 3);
    for (const key of integrationKeys) {
      assert.strictEqual(COMPOSITIONS[key].duration, 40);
    }
  });

  test('only thumbnail is a still', () => {
    const stills = Object.entries(COMPOSITIONS).filter(([, c]) => c.isStill);
    assert.strictEqual(stills.length, 1);
    assert.strictEqual(stills[0][0], 'thumbnail');
  });

  test('all non-still compositions output mp4', () => {
    for (const [key, comp] of Object.entries(COMPOSITIONS)) {
      if (!comp.isStill) {
        assert.ok(comp.output.endsWith('.mp4'), `${key} should output mp4`);
      }
    }
  });

  test('onboarding is the longest at 60s', () => {
    const longest = Object.entries(COMPOSITIONS).reduce((max, [, c]) => Math.max(max, c.duration), 0);
    assert.strictEqual(longest, 60);
    assert.strictEqual(COMPOSITIONS.onboarding.duration, 60);
  });
});

// NOTE: Export existence is proven by the behavioral tests (COMPOSITIONS, LANGUAGES,
// healthCheck, getCompositionId, etc.) — no separate typeof theater needed.

// ─── getCompositionId ────────────────────────────────────────────

describe('RemotionService getCompositionId', () => {
  test('returns baseId for fr language', () => {
    assert.strictEqual(getCompositionId('VocaliaDemo', 'fr'), 'VocaliaDemo');
  });

  test('returns baseId for null language', () => {
    assert.strictEqual(getCompositionId('VocaliaDemo', null), 'VocaliaDemo');
  });

  test('returns baseId for undefined language', () => {
    assert.strictEqual(getCompositionId('VocaliaDemo', undefined), 'VocaliaDemo');
  });

  test('returns baseId for empty string language', () => {
    assert.strictEqual(getCompositionId('VocaliaDemo', ''), 'VocaliaDemo');
  });

  test('appends -EN for English', () => {
    assert.strictEqual(getCompositionId('VocaliaDemo', 'en'), 'VocaliaDemo-EN');
  });

  test('appends -ES for Spanish', () => {
    assert.strictEqual(getCompositionId('VocaliaDemo', 'es'), 'VocaliaDemo-ES');
  });

  test('appends -AR for Arabic', () => {
    assert.strictEqual(getCompositionId('VocaliaDemo', 'ar'), 'VocaliaDemo-AR');
  });

  test('appends -ARY for Darija', () => {
    assert.strictEqual(getCompositionId('VocaliaDemo', 'ary'), 'VocaliaDemo-ARY');
  });

  test('uppercases language code', () => {
    assert.strictEqual(getCompositionId('Test', 'de'), 'Test-DE');
  });

  test('works with FeatureShowcase', () => {
    assert.strictEqual(getCompositionId('FeatureShowcase', 'en'), 'FeatureShowcase-EN');
  });
});
