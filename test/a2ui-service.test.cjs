'use strict';

/**
 * VocalIA A2UI Service Tests
 *
 * Tests:
 * - COMPONENT_TEMPLATES (4 types: booking, lead_form, cart, confirmation)
 * - A2UIService constructor
 * - generateFromTemplate (template rendering with context)
 * - localizeContext (FR/EN/AR labels)
 * - extractActions (AG-UI action mapping)
 * - sanitizeHTML (XSS prevention)
 * - buildStitchPrompt (prompt generation)
 * - generateUI (integration: template + sanitize + cache)
 *
 * NOTE: Does NOT call Stitch/Google API. Tests pure logic only.
 *
 * Run: node --test test/a2ui-service.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const a2uiService = require('../core/a2ui-service.cjs');

// ─── COMPONENT_TEMPLATES ────────────────────────────────────────────

describe('A2UI COMPONENT_TEMPLATES', () => {
  test('service is an object', () => {
    assert.strictEqual(typeof a2uiService, 'object');
  });

  test('has generateUI method', () => {
    assert.strictEqual(typeof a2uiService.generateUI, 'function');
  });

  test('has generateFromTemplate method', () => {
    assert.strictEqual(typeof a2uiService.generateFromTemplate, 'function');
  });

  test('has localizeContext method', () => {
    assert.strictEqual(typeof a2uiService.localizeContext, 'function');
  });

  test('has extractActions method', () => {
    assert.strictEqual(typeof a2uiService.extractActions, 'function');
  });

  test('has sanitizeHTML method', () => {
    assert.strictEqual(typeof a2uiService.sanitizeHTML, 'function');
  });

  test('has health method', () => {
    assert.strictEqual(typeof a2uiService.health, 'function');
  });
});

// ─── generateFromTemplate ───────────────────────────────────────────

describe('A2UI generateFromTemplate', () => {
  test('generates booking template', () => {
    const result = a2uiService.generateFromTemplate('booking', {
      slots: [{ label: '09:00', value: '09:00' }, { label: '10:00', value: '10:00' }]
    }, 'fr');
    assert.ok(result.html);
    assert.ok(result.css);
    assert.strictEqual(result.type, 'booking');
    assert.strictEqual(result.source, 'template');
    assert.ok(result.html.includes('a2ui-booking'));
  });

  test('generates lead_form template', () => {
    const result = a2uiService.generateFromTemplate('lead_form', {
      fields: [{ label: 'Nom', type: 'text', name: 'name' }]
    }, 'fr');
    assert.ok(result.html);
    assert.strictEqual(result.type, 'lead_form');
    assert.ok(result.html.includes('a2ui-lead-form'));
  });

  test('generates cart template', () => {
    const result = a2uiService.generateFromTemplate('cart', {
      items: [{ id: '1', name: 'Widget', qty: 2, price: '98€' }],
      total: '98€'
    }, 'fr');
    assert.ok(result.html);
    assert.strictEqual(result.type, 'cart');
    assert.ok(result.html.includes('a2ui-cart'));
  });

  test('generates confirmation template', () => {
    const result = a2uiService.generateFromTemplate('confirmation', {
      icon: '✓',
      title: 'Confirmé',
      message: 'Votre RDV est confirmé.'
    }, 'fr');
    assert.ok(result.html);
    assert.strictEqual(result.type, 'confirmation');
    assert.ok(result.html.includes('Confirmé'));
  });

  test('throws for unknown type', () => {
    assert.throws(
      () => a2uiService.generateFromTemplate('unknown_type', {}, 'fr'),
      { message: /Unknown component type/ }
    );
  });
});

// ─── localizeContext ─────────────────────────────────────────────────

describe('A2UI localizeContext', () => {
  test('French booking labels', () => {
    const result = a2uiService.localizeContext({}, 'booking', 'fr');
    assert.strictEqual(result.title, 'Choisissez un créneau');
    assert.strictEqual(result.confirm, 'Confirmer');
  });

  test('English booking labels', () => {
    const result = a2uiService.localizeContext({}, 'booking', 'en');
    assert.strictEqual(result.title, 'Choose a time slot');
    assert.strictEqual(result.confirm, 'Confirm');
  });

  test('Arabic booking labels', () => {
    const result = a2uiService.localizeContext({}, 'booking', 'ar');
    assert.strictEqual(result.title, 'اختر موعداً');
  });

  test('French cart labels', () => {
    const result = a2uiService.localizeContext({}, 'cart', 'fr');
    assert.strictEqual(result.title, 'Votre panier');
    assert.strictEqual(result.checkout, 'Payer maintenant');
  });

  test('English cart labels', () => {
    const result = a2uiService.localizeContext({}, 'cart', 'en');
    assert.strictEqual(result.title, 'Your cart');
    assert.strictEqual(result.checkout, 'Pay now');
  });

  test('French lead_form labels', () => {
    const result = a2uiService.localizeContext({}, 'lead_form', 'fr');
    assert.strictEqual(result.title, 'Complétez vos informations');
  });

  test('English lead_form labels', () => {
    const result = a2uiService.localizeContext({}, 'lead_form', 'en');
    assert.strictEqual(result.title, 'Complete your information');
  });

  test('Arabic confirmation labels', () => {
    const result = a2uiService.localizeContext({}, 'confirmation', 'ar');
    assert.strictEqual(result.title, 'تم التأكيد!');
  });

  test('context overrides labels', () => {
    const result = a2uiService.localizeContext({ title: 'Custom Title' }, 'booking', 'fr');
    assert.strictEqual(result.title, 'Custom Title');
  });

  test('unknown language falls back to French', () => {
    const result = a2uiService.localizeContext({}, 'booking', 'zzz');
    assert.strictEqual(result.title, 'Choisissez un créneau');
  });
});

// ─── extractActions ─────────────────────────────────────────────────

describe('A2UI extractActions', () => {
  test('booking actions', () => {
    const actions = a2uiService.extractActions('booking');
    assert.deepStrictEqual(actions, ['select_slot', 'confirm_booking']);
  });

  test('lead_form actions', () => {
    const actions = a2uiService.extractActions('lead_form');
    assert.deepStrictEqual(actions, ['submit_lead', 'field_change']);
  });

  test('cart actions', () => {
    const actions = a2uiService.extractActions('cart');
    assert.deepStrictEqual(actions, ['update_qty', 'remove_item', 'checkout']);
  });

  test('confirmation actions', () => {
    const actions = a2uiService.extractActions('confirmation');
    assert.deepStrictEqual(actions, ['close']);
  });

  test('unknown type returns empty array', () => {
    const actions = a2uiService.extractActions('unknown');
    assert.deepStrictEqual(actions, []);
  });
});

// ─── sanitizeHTML ───────────────────────────────────────────────────

describe('A2UI sanitizeHTML', () => {
  test('removes script tags', () => {
    const result = a2uiService.sanitizeHTML('<div>Hello</div><script>alert("xss")</script>');
    assert.ok(!result.includes('<script'));
    assert.ok(!result.includes('alert'));
  });

  test('removes onclick handlers', () => {
    const result = a2uiService.sanitizeHTML('<div onclick="alert(1)">Click</div>');
    assert.ok(!result.includes('onclick'));
  });

  test('removes javascript: protocol', () => {
    const result = a2uiService.sanitizeHTML('<a href="javascript:alert(1)">Link</a>');
    assert.ok(!result.includes('javascript:'));
  });

  test('preserves safe HTML', () => {
    const input = '<div class="test"><span>Hello</span></div>';
    const result = a2uiService.sanitizeHTML(input);
    assert.ok(result.includes('Hello'));
  });
});

// ─── generateUI ─────────────────────────────────────────────────────

describe('A2UI generateUI', () => {
  test('returns generated UI for booking', async () => {
    const result = await a2uiService.generateUI({
      type: 'booking',
      context: { slots: [{ label: '09:00', value: '09:00' }] },
      language: 'fr'
    });
    assert.ok(result.html);
    assert.ok(result.css);
    assert.strictEqual(result.type, 'booking');
    assert.ok(result.actions.includes('select_slot'));
    assert.strictEqual(typeof result.latency, 'number');
  });

  test('caches results on second call', async () => {
    // Clear cache first
    a2uiService.cache.clear();

    const first = await a2uiService.generateUI({
      type: 'confirmation',
      context: { icon: '✓', message: 'Done' },
      language: 'en'
    });
    assert.strictEqual(first.cached, false);

    const second = await a2uiService.generateUI({
      type: 'confirmation',
      context: { icon: '✓', message: 'Done' },
      language: 'en'
    });
    assert.strictEqual(second.cached, true);
  });

  test('returns different results for different languages', async () => {
    a2uiService.cache.clear();

    const fr = await a2uiService.generateUI({ type: 'cart', context: {}, language: 'fr' });
    const en = await a2uiService.generateUI({ type: 'cart', context: {}, language: 'en' });
    assert.ok(fr.html !== en.html);
  });
});

// ─── buildStitchPrompt ──────────────────────────────────────────────

describe('A2UI buildStitchPrompt', () => {
  test('booking prompt mentions slots', () => {
    const prompt = a2uiService.buildStitchPrompt('booking', { slots: [1, 2, 3] }, 'fr');
    assert.ok(prompt.includes('3'));
    assert.ok(prompt.includes('booking') || prompt.includes('date'));
    assert.ok(prompt.includes('fr'));
  });

  test('lead_form prompt mentions fields', () => {
    const prompt = a2uiService.buildStitchPrompt('lead_form', {
      fields: [{ name: 'email' }, { name: 'phone' }]
    }, 'en');
    assert.ok(prompt.includes('email'));
    assert.ok(prompt.includes('phone'));
    assert.ok(prompt.includes('en'));
  });

  test('cart prompt mentions items', () => {
    const prompt = a2uiService.buildStitchPrompt('cart', { items: [1, 2, 3] }, 'fr');
    assert.ok(prompt.includes('3'));
    assert.ok(prompt.includes('cart') || prompt.includes('shopping'));
  });

  test('confirmation prompt includes message', () => {
    const prompt = a2uiService.buildStitchPrompt('confirmation', { message: 'RDV confirmé' }, 'fr');
    assert.ok(prompt.includes('RDV confirmé'));
  });

  test('unknown type falls back to confirmation', () => {
    const prompt = a2uiService.buildStitchPrompt('unknown', {}, 'fr');
    assert.ok(prompt.includes('confirmation') || prompt.includes('success'));
  });

  test('default slots count when none provided', () => {
    const prompt = a2uiService.buildStitchPrompt('booking', {}, 'en');
    assert.ok(prompt.includes('6')); // default: 6 time slots
  });
});

// ─── cache management ────────────────────────────────────────────

describe('A2UI cache management', () => {
  test('cache starts as Map', () => {
    assert.ok(a2uiService.cache instanceof Map);
  });

  test('cache clear removes all entries', async () => {
    await a2uiService.generateUI({ type: 'booking', context: { slots: [] }, language: 'fr' });
    assert.ok(a2uiService.cache.size > 0);
    a2uiService.cache.clear();
    assert.strictEqual(a2uiService.cache.size, 0);
  });

  test('different contexts produce different cache keys', async () => {
    a2uiService.cache.clear();
    await a2uiService.generateUI({ type: 'booking', context: { slots: [] }, language: 'fr' });
    await a2uiService.generateUI({ type: 'booking', context: { slots: [{ label: 'x', value: 'x' }] }, language: 'fr' });
    assert.strictEqual(a2uiService.cache.size, 2);
  });
});

// ─── constructor ──────────────────────────────────────────────────

describe('A2UI constructor', () => {
  test('stitchEnabled defaults to false', () => {
    assert.strictEqual(a2uiService.stitchEnabled, false);
  });

  test('projectId defaults to null', () => {
    assert.strictEqual(a2uiService.projectId, null);
  });

  test('has initialize method', () => {
    assert.strictEqual(typeof a2uiService.initialize, 'function');
  });

  test('has buildStitchPrompt method', () => {
    assert.strictEqual(typeof a2uiService.buildStitchPrompt, 'function');
  });
});

// ─── health ─────────────────────────────────────────────────────────

describe('A2UI health', () => {
  test('returns health object', async () => {
    const health = await a2uiService.health();
    assert.strictEqual(health.service, 'A2UI');
    assert.strictEqual(health.version, '1.0.0');
    assert.ok(Array.isArray(health.templatesAvailable));
    assert.ok(health.templatesAvailable.includes('booking'));
    assert.ok(health.templatesAvailable.includes('cart'));
    assert.strictEqual(typeof health.cacheSize, 'number');
  });

  test('health includes all 4 template types', async () => {
    const health = await a2uiService.health();
    assert.ok(health.templatesAvailable.includes('booking'));
    assert.ok(health.templatesAvailable.includes('lead_form'));
    assert.ok(health.templatesAvailable.includes('cart'));
    assert.ok(health.templatesAvailable.includes('confirmation'));
    assert.strictEqual(health.templatesAvailable.length, 4);
  });

  test('health reports stitchEnabled', async () => {
    const health = await a2uiService.health();
    assert.strictEqual(typeof health.stitchEnabled, 'boolean');
  });
});
