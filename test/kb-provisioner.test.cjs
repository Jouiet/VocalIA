'use strict';

/**
 * VocalIA KB Provisioner Tests
 *
 * Tests:
 * - SUPPORTED_LANGUAGES (5 languages)
 * - generateInitialKB (all 5 langs, 7 sections each, template interpolation)
 * - provisionKB (directory creation, KB files, config.json, skip existing, overwrite)
 *
 * NOTE: Uses real clients/ directory with temp tenant IDs (cleaned up after).
 *
 * Run: node --test test/kb-provisioner.test.cjs
 */

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { generateInitialKB, provisionKB, SUPPORTED_LANGUAGES } = require('../core/kb-provisioner.cjs');

// ─── SUPPORTED_LANGUAGES ────────────────────────────────────────────

describe('KB Provisioner SUPPORTED_LANGUAGES', () => {
  test('has exactly 5 languages', () => {
    assert.strictEqual(SUPPORTED_LANGUAGES.length, 5);
  });

  test('includes fr, en, es, ar, ary', () => {
    assert.deepStrictEqual(SUPPORTED_LANGUAGES, ['fr', 'en', 'es', 'ar', 'ary']);
  });
});

// ─── generateInitialKB ─────────────────────────────────────────────

describe('KB Provisioner generateInitialKB', () => {
  const tenant = {
    id: 'test_tenant',
    business_name: 'Test Business',
    address: '123 Rue Test, Casablanca',
    phone: '+212600000000',
    horaires: 'Lun-Ven 9h-18h',
    services: ['Service A', 'Service B'],
    payment_method: 'CB, Espèces',
    zones: ['Casablanca', 'Rabat'],
    booking_url: 'https://booking.test.com'
  };

  test('generates KB with __meta for FR', () => {
    const kb = generateInitialKB(tenant, 'fr');
    assert.ok(kb.__meta);
    assert.strictEqual(kb.__meta.tenant_id, 'test_tenant');
    assert.strictEqual(kb.__meta.business_name, 'Test Business');
    assert.strictEqual(kb.__meta.language, 'fr');
    assert.strictEqual(kb.__meta.auto_generated, true);
  });

  test('generates all 7 sections', () => {
    const kb = generateInitialKB(tenant, 'fr');
    assert.ok(kb.business_info);
    assert.ok(kb.horaires);
    assert.ok(kb.services);
    assert.ok(kb.contact);
    assert.ok(kb.payment);
    assert.ok(kb.zones);
    assert.ok(kb.booking);
  });

  test('each section has question, response, keywords', () => {
    const kb = generateInitialKB(tenant, 'fr');
    for (const key of ['business_info', 'horaires', 'services', 'contact', 'payment', 'zones', 'booking']) {
      assert.ok(kb[key].question, `${key} missing question`);
      assert.ok(kb[key].response, `${key} missing response`);
      assert.ok(Array.isArray(kb[key].keywords), `${key} missing keywords array`);
    }
  });

  test('interpolates business name in FR', () => {
    const kb = generateInitialKB(tenant, 'fr');
    assert.ok(kb.business_info.question.includes('Test Business'));
    assert.ok(kb.business_info.response.includes('Test Business'));
  });

  test('interpolates phone in contact', () => {
    const kb = generateInitialKB(tenant, 'fr');
    assert.ok(kb.contact.response.includes('+212600000000'));
  });

  test('interpolates address in business_info', () => {
    const kb = generateInitialKB(tenant, 'fr');
    assert.ok(kb.business_info.response.includes('123 Rue Test'));
  });

  test('interpolates services array', () => {
    const kb = generateInitialKB(tenant, 'fr');
    assert.ok(kb.services.response.includes('Service A'));
    assert.ok(kb.services.response.includes('Service B'));
  });

  test('interpolates booking_url', () => {
    const kb = generateInitialKB(tenant, 'fr');
    assert.ok(kb.booking.response.includes('https://booking.test.com'));
    assert.strictEqual(kb.booking.booking_url, 'https://booking.test.com');
  });

  test('generates EN correctly', () => {
    const kb = generateInitialKB(tenant, 'en');
    assert.strictEqual(kb.__meta.language, 'en');
    assert.ok(kb.business_info.question.includes('Where'));
    assert.ok(kb.booking.question.includes('appointment'));
  });

  test('generates ES correctly', () => {
    const kb = generateInitialKB(tenant, 'es');
    assert.strictEqual(kb.__meta.language, 'es');
    assert.ok(kb.business_info.question.includes('Dónde'));
  });

  test('generates AR correctly', () => {
    const kb = generateInitialKB(tenant, 'ar');
    assert.strictEqual(kb.__meta.language, 'ar');
    assert.ok(kb.business_info.keywords.includes('عنوان'));
  });

  test('generates ARY (Darija) correctly', () => {
    const kb = generateInitialKB(tenant, 'ary');
    assert.strictEqual(kb.__meta.language, 'ary');
    assert.ok(kb.business_info.question.includes('فين'));
  });

  test('defaults to FR for unknown language', () => {
    const kb = generateInitialKB(tenant, 'xx');
    assert.ok(kb.business_info.question.includes('se trouve'));
  });

  test('fallback when no address', () => {
    const kb = generateInitialKB({ id: 't', business_name: 'X' }, 'fr');
    assert.ok(kb.business_info.response.includes('contacter'));
  });

  test('fallback when no phone', () => {
    const kb = generateInitialKB({ id: 't', business_name: 'X' }, 'fr');
    assert.ok(kb.contact.response.includes('formulaire'));
  });

  test('fallback when no booking_url or phone', () => {
    const kb = generateInitialKB({ id: 't', business_name: 'X' }, 'fr');
    assert.ok(kb.booking.response.includes('contacter'));
    assert.strictEqual(kb.booking.booking_url, null);
    assert.strictEqual(kb.booking.booking_phone, null);
  });

  test('booking uses phone when no booking_url', () => {
    const kb = generateInitialKB({ id: 't', phone: '+212555' }, 'fr');
    assert.ok(kb.booking.response.includes('+212555'));
  });

  test('defaults business_name to Business', () => {
    const kb = generateInitialKB({ id: 't' }, 'fr');
    assert.ok(kb.business_info.question.includes('Business'));
  });
});

// ─── provisionKB ────────────────────────────────────────────────────

describe('KB Provisioner provisionKB', () => {
  const cleanupDirs = [];

  afterEach(() => {
    for (const dir of cleanupDirs) {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
    cleanupDirs.length = 0;
  });

  test('returns result object with expected shape', () => {
    const tenantId = `__test_kb_${Date.now()}`;
    const tenant = { id: tenantId, business_name: 'Test KB Provision' };
    cleanupDirs.push(path.join(__dirname, '../clients', tenantId));

    const result = provisionKB(tenant, { languages: ['fr'] });
    assert.ok(result.success);
    assert.strictEqual(result.tenant_id, tenantId);
    assert.ok(Array.isArray(result.created));
    assert.ok(Array.isArray(result.skipped));
    assert.ok(Array.isArray(result.errors));
  });

  test('creates KB files for all 5 languages', () => {
    const tenantId = `__test_kb5_${Date.now()}`;
    const tenant = { id: tenantId, business_name: 'Test 5 Langs', phone: '+212555' };
    cleanupDirs.push(path.join(__dirname, '../clients', tenantId));

    const result = provisionKB(tenant);
    assert.ok(result.success);
    assert.strictEqual(result.created.length, 5);
    assert.deepStrictEqual(result.created, ['fr', 'en', 'es', 'ar', 'ary']);

    const kbDir = path.join(__dirname, '../clients', tenantId, 'knowledge_base');
    for (const lang of SUPPORTED_LANGUAGES) {
      assert.ok(fs.existsSync(path.join(kbDir, `kb_${lang}.json`)));
    }
  });

  test('creates config.json with widget_features', () => {
    const tenantId = `__test_kb_cfg_${Date.now()}`;
    const tenant = { id: tenantId, business_name: 'Test Config', booking_url: 'https://book.test' };
    cleanupDirs.push(path.join(__dirname, '../clients', tenantId));

    provisionKB(tenant, { languages: ['fr'] });

    const configPath = path.join(__dirname, '../clients', tenantId, 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.strictEqual(config.tenant_id, tenantId);
    assert.strictEqual(config.booking_url, 'https://book.test');
    assert.strictEqual(config.widget_features.booking_enabled, true);
    assert.strictEqual(config.widget_features.social_proof_enabled, true);
  });

  test('skips existing KB files', () => {
    const tenantId = `__test_kb_skip_${Date.now()}`;
    const tenant = { id: tenantId, business_name: 'Test Skip' };
    cleanupDirs.push(path.join(__dirname, '../clients', tenantId));

    provisionKB(tenant, { languages: ['fr'] });
    const result2 = provisionKB(tenant, { languages: ['fr'] });
    assert.strictEqual(result2.created.length, 0);
    assert.strictEqual(result2.skipped.length, 1);
  });

  test('overwrites when option set', () => {
    const tenantId = `__test_kb_ow_${Date.now()}`;
    const tenant = { id: tenantId, business_name: 'Test Overwrite' };
    cleanupDirs.push(path.join(__dirname, '../clients', tenantId));

    provisionKB(tenant, { languages: ['fr'] });
    const result = provisionKB(tenant, { languages: ['fr'], overwrite: true });
    assert.strictEqual(result.created.length, 1);
    assert.strictEqual(result.skipped.length, 0);
  });

  test('booking_enabled false when no url/phone', () => {
    const tenantId = `__test_kb_nobk_${Date.now()}`;
    const tenant = { id: tenantId, business_name: 'No Booking' };
    cleanupDirs.push(path.join(__dirname, '../clients', tenantId));

    provisionKB(tenant, { languages: ['fr'] });

    const configPath = path.join(__dirname, '../clients', tenantId, 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.strictEqual(config.widget_features.booking_enabled, false);
  });
});
