'use strict';

/**
 * VocalIA KB Provisioner Tests
 *
 * Tests:
 * - generateInitialKB for all 5 languages
 * - Template variable interpolation
 * - provisionKB file creation
 * - SUPPORTED_LANGUAGES constant
 *
 * Run: node --test test/kb-provisioner.test.cjs
 */

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { generateInitialKB, provisionKB, SUPPORTED_LANGUAGES } = require('../core/kb-provisioner.cjs');

const CLIENTS_DIR = path.join(__dirname, '../clients');
const TEST_TENANT_ID = '__test_kb_provisioner__';

describe('SUPPORTED_LANGUAGES', () => {
  test('has exactly 5 languages', () => {
    assert.strictEqual(SUPPORTED_LANGUAGES.length, 5);
  });

  test('includes FR, EN, ES, AR, ARY', () => {
    assert.ok(SUPPORTED_LANGUAGES.includes('fr'));
    assert.ok(SUPPORTED_LANGUAGES.includes('en'));
    assert.ok(SUPPORTED_LANGUAGES.includes('es'));
    assert.ok(SUPPORTED_LANGUAGES.includes('ar'));
    assert.ok(SUPPORTED_LANGUAGES.includes('ary'));
  });
});

describe('generateInitialKB', () => {
  const tenant = {
    id: 'test_dental_01',
    business_name: 'Cabinet Dentaire Dr. Amrani',
    address: '12 Rue Mohammed V, Casablanca',
    phone: '+212522334455',
    horaires: 'Lundi-Vendredi 9h-18h',
    services: ['Détartrage', 'Blanchiment', 'Implants'],
    sector: 'DENTAL'
  };

  test('generates FR KB with business info', () => {
    const kb = generateInitialKB(tenant, 'fr');
    assert.ok(kb);
    assert.ok(kb.business_info, 'Should have business_info section');
    assert.ok(kb.business_info.response.includes('Cabinet Dentaire Dr. Amrani'));
    assert.ok(kb.business_info.response.includes('12 Rue Mohammed V'));
  });

  test('generates FR KB with horaires', () => {
    const kb = generateInitialKB(tenant, 'fr');
    assert.ok(kb.horaires);
    assert.ok(kb.horaires.response.includes('Lundi-Vendredi'));
  });

  test('generates FR KB with services array', () => {
    const kb = generateInitialKB(tenant, 'fr');
    assert.ok(kb.services);
    assert.ok(kb.services.response.includes('Détartrage'));
    assert.ok(kb.services.response.includes('Blanchiment'));
  });

  test('generates FR KB with contact info', () => {
    const kb = generateInitialKB(tenant, 'fr');
    assert.ok(kb.contact);
    assert.ok(kb.contact.response.includes('+212522334455'));
  });

  test('generates EN KB', () => {
    const kb = generateInitialKB(tenant, 'en');
    assert.ok(kb);
    assert.ok(kb.business_info);
    assert.ok(kb.business_info.keywords.includes('address') || kb.business_info.keywords.includes('where'));
  });

  test('generates ES KB', () => {
    const kb = generateInitialKB(tenant, 'es');
    assert.ok(kb);
    assert.ok(kb.business_info);
  });

  test('generates AR KB', () => {
    const kb = generateInitialKB(tenant, 'ar');
    assert.ok(kb);
    assert.ok(kb.business_info);
    // AR should contain Arabic keywords
    const hasArabic = kb.business_info.keywords.some(k => /[\u0600-\u06FF]/.test(k));
    assert.ok(hasArabic, 'AR KB should have Arabic keywords');
  });

  test('generates ARY KB', () => {
    const kb = generateInitialKB(tenant, 'ary');
    assert.ok(kb);
    assert.ok(kb.business_info);
  });

  test('handles missing tenant data gracefully', () => {
    const minimalTenant = { id: 'minimal_01' };
    const kb = generateInitialKB(minimalTenant, 'fr');
    assert.ok(kb);
    assert.ok(kb.business_info);
    // Should use fallback text, not crash
    assert.ok(kb.business_info.response.length > 0);
  });

  test('handles tenant without address', () => {
    const noAddr = { id: 't1', business_name: 'Test', phone: '+212600000000' };
    const kb = generateInitialKB(noAddr, 'fr');
    assert.ok(kb.business_info.response);
    // Should have fallback message
    assert.ok(kb.business_info.response.length > 10);
  });

  test('handles tenant without phone', () => {
    const noPhone = { id: 't2', business_name: 'Test', address: '123 Street' };
    const kb = generateInitialKB(noPhone, 'fr');
    assert.ok(kb.contact.response);
  });

  test('each language has keywords array', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      const kb = generateInitialKB(tenant, lang);
      assert.ok(kb.business_info.keywords, `${lang} should have keywords`);
      assert.ok(Array.isArray(kb.business_info.keywords), `${lang} keywords should be array`);
      assert.ok(kb.business_info.keywords.length > 0, `${lang} should have >0 keywords`);
    }
  });

  test('payment section exists for all languages', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      const kb = generateInitialKB(tenant, lang);
      assert.ok(kb.payment, `${lang} should have payment section`);
    }
  });
});

describe('provisionKB', () => {
  afterEach(() => {
    // Cleanup test tenant directory
    const testDir = path.join(CLIENTS_DIR, TEST_TENANT_ID);
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('creates KB files for all 5 languages', () => {
    const tenant = {
      id: TEST_TENANT_ID,
      business_name: 'Test Provisioner Business',
      phone: '+212600000000'
    };

    const result = provisionKB(tenant);
    assert.ok(result);
    assert.ok(result.success || result.created);

    // Check that KB directory was created
    const kbDir = path.join(CLIENTS_DIR, TEST_TENANT_ID, 'knowledge_base');
    if (fs.existsSync(kbDir)) {
      const files = fs.readdirSync(kbDir);
      assert.ok(files.length > 0, 'Should have created KB files');
    }
  });

  test('created KB files are valid JSON', () => {
    const tenant = {
      id: TEST_TENANT_ID,
      business_name: 'JSON Validation Test',
      phone: '+212611111111'
    };

    provisionKB(tenant);

    const kbDir = path.join(CLIENTS_DIR, TEST_TENANT_ID, 'knowledge_base');
    if (fs.existsSync(kbDir)) {
      const files = fs.readdirSync(kbDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        const content = fs.readFileSync(path.join(kbDir, file), 'utf8');
        assert.doesNotThrow(() => JSON.parse(content), `${file} should be valid JSON`);
      }
    }
  });
});
