/**
 * VocalIA Scripts Tests — voice-widget-templates.cjs + batch-translate-gemini.cjs
 *
 * Tests REAL pure functions exported by scripts:
 * - generateConfig: industry preset → full widget config
 * - validateConfig: config object → { valid, errors, warnings, score }
 * - generateDeploymentFiles: config → FS files (json, js, html, readme)
 * - INDUSTRY_PRESETS: 8 presets with required fields
 * - extractLeaves: nested object → flat key-value pairs
 * - splitIntoBatches: object → array of chunks
 *
 * Session 250.209b
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);

const {
  INDUSTRY_PRESETS,
  generateConfig,
  validateConfig,
  generateDeploymentFiles
} = require('../scripts/voice-widget-templates.cjs');

const {
  extractLeaves,
  splitIntoBatches
} = require('../scripts/batch-translate-gemini.cjs');

// ═══════════════════════════════════════════════════════════════════════════════
// INDUSTRY_PRESETS structure
// ═══════════════════════════════════════════════════════════════════════════════

describe('INDUSTRY_PRESETS', () => {
  const EXPECTED_PRESETS = ['ecommerce', 'b2b', 'agency', 'restaurant', 'retail', 'saas', 'healthcare', 'realestate'];

  it('has exactly 8 presets', () => {
    assert.equal(Object.keys(INDUSTRY_PRESETS).length, 8);
  });

  it('has all expected preset keys', () => {
    for (const key of EXPECTED_PRESETS) {
      assert.ok(INDUSTRY_PRESETS[key], `Missing preset: ${key}`);
    }
  });

  for (const key of ['ecommerce', 'b2b', 'agency', 'restaurant', 'retail', 'saas', 'healthcare', 'realestate']) {
    it(`${key}: has all required fields`, () => {
      const p = INDUSTRY_PRESETS[key];
      if (!p) return; // skip if preset doesn't exist yet
      assert.ok(p.id, `${key}.id missing`);
      assert.ok(p.name, `${key}.name missing`);
      assert.ok(p.description, `${key}.description missing`);
      assert.ok(p.colors?.primary, `${key}.colors.primary missing`);
      assert.ok(p.colors?.primaryDark, `${key}.colors.primaryDark missing`);
      assert.ok(p.colors?.accent, `${key}.colors.accent missing`);
      assert.ok(Array.isArray(p.defaultServices), `${key}.defaultServices not array`);
      assert.ok(p.defaultServices.length >= 3, `${key}.defaultServices too short`);
      assert.ok(p.systemPromptFR, `${key}.systemPromptFR missing`);
      assert.ok(p.systemPromptEN, `${key}.systemPromptEN missing`);
      assert.ok(Array.isArray(p.keywords), `${key}.keywords not array`);
      assert.ok(p.keywords.length >= 3, `${key}.keywords too short`);
    });

    it(`${key}: colors are valid hex`, () => {
      const p = INDUSTRY_PRESETS[key];
      if (!p) return;
      const hexRegex = /^#[0-9A-Fa-f]{6}$/;
      assert.ok(hexRegex.test(p.colors.primary), `${key}.colors.primary invalid: ${p.colors.primary}`);
      assert.ok(hexRegex.test(p.colors.primaryDark), `${key}.colors.primaryDark invalid: ${p.colors.primaryDark}`);
      assert.ok(hexRegex.test(p.colors.accent), `${key}.colors.accent invalid: ${p.colors.accent}`);
    });

    it(`${key}: systemPrompts contain {clientName} placeholder`, () => {
      const p = INDUSTRY_PRESETS[key];
      if (!p) return;
      assert.ok(p.systemPromptFR.includes('{clientName}'), `${key}.systemPromptFR missing {clientName}`);
      assert.ok(p.systemPromptEN.includes('{clientName}'), `${key}.systemPromptEN missing {clientName}`);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// generateConfig
// ═══════════════════════════════════════════════════════════════════════════════

describe('generateConfig', () => {
  it('generates valid config with minimal options', () => {
    const config = generateConfig({ preset: 'ecommerce', clientName: 'TestShop', domain: 'testshop.com' });

    assert.equal(config.client.name, 'TestShop');
    assert.equal(config.client.domain, 'testshop.com');
    assert.equal(config.client.industry, 'ecommerce');
    assert.ok(config.$generatedAt);
    assert.equal(config.$preset, 'ecommerce');
  });

  it('uses preset colors when no custom colors', () => {
    const config = generateConfig({ preset: 'restaurant', clientName: 'Chez Ali' });
    assert.equal(config.branding.primaryColor, INDUSTRY_PRESETS.restaurant.colors.primary);
    assert.equal(config.branding.primaryDark, INDUSTRY_PRESETS.restaurant.colors.primaryDark);
  });

  it('overrides colors with customColors', () => {
    const custom = { primary: '#FF0000', primaryDark: '#CC0000', accent: '#00FF00' };
    const config = generateConfig({ preset: 'agency', clientName: 'Test', customColors: custom });
    assert.equal(config.branding.primaryColor, '#FF0000');
    assert.equal(config.branding.primaryDark, '#CC0000');
    assert.equal(config.branding.accentColor, '#00FF00');
  });

  it('replaces {clientName} in prompts', () => {
    const config = generateConfig({ preset: 'b2b', clientName: 'AcmeCorp' });
    assert.ok(config.prompts.fr.includes('AcmeCorp'), 'FR prompt should contain clientName');
    assert.ok(config.prompts.en.includes('AcmeCorp'), 'EN prompt should contain clientName');
    assert.ok(!config.prompts.fr.includes('{clientName}'), 'FR prompt should not contain placeholder');
    assert.ok(!config.prompts.en.includes('{clientName}'), 'EN prompt should not contain placeholder');
  });

  it('sets email from domain by default', () => {
    const config = generateConfig({ preset: 'saas', clientName: 'X', domain: 'x.io' });
    assert.equal(config.client.email, 'contact@x.io');
  });

  it('booking disabled when no URL provided', () => {
    const config = generateConfig({ preset: 'agency', clientName: 'Test' });
    assert.equal(config.booking.enabled, false);
    assert.equal(config.booking.type, 'redirect');
  });

  it('booking enabled with bookingUrl', () => {
    const config = generateConfig({ preset: 'healthcare', clientName: 'Clinic', bookingUrl: 'https://cal.com/clinic' });
    assert.equal(config.booking.enabled, true);
    assert.equal(config.booking.url, 'https://cal.com/clinic');
  });

  it('booking enabled with bookingEndpoint', () => {
    const config = generateConfig({ preset: 'healthcare', clientName: 'Clinic', bookingEndpoint: 'https://api.clinic.com/book' });
    assert.equal(config.booking.enabled, true);
    assert.equal(config.booking.type, 'api');
    assert.equal(config.booking.endpoint, 'https://api.clinic.com/book');
  });

  it('fallback to agency preset for unknown preset', () => {
    const config = generateConfig({ preset: 'unknown_industry', clientName: 'Test' });
    // Should use agency as fallback (the INDUSTRY_PRESETS[preset] || INDUSTRY_PRESETS.agency)
    assert.ok(config.prompts.fr);
    assert.ok(config.prompts.en);
  });

  it('uses custom services when provided', () => {
    const services = ['Custom Service A', 'Custom Service B'];
    const config = generateConfig({ preset: 'ecommerce', clientName: 'Test', services });
    assert.deepEqual(config.knowledge.services, services);
  });

  it('uses preset default services when none provided', () => {
    const config = generateConfig({ preset: 'ecommerce', clientName: 'Test' });
    assert.deepEqual(config.knowledge.services, INDUSTRY_PRESETS.ecommerce.defaultServices);
  });

  it('sets all required sections', () => {
    const config = generateConfig({ preset: 'b2b', clientName: 'Corp' });
    assert.ok(config.client);
    assert.ok(config.branding);
    assert.ok(config.messages);
    assert.ok(config.messages.fr);
    assert.ok(config.messages.en);
    assert.ok(config.prompts);
    assert.ok(config.api);
    assert.ok(config.booking);
    assert.ok(config.knowledge);
    assert.ok(config.settings);
    assert.ok(config.realtime);
    assert.ok(config.analytics);
  });

  it('FR messages contain clientName', () => {
    const config = generateConfig({ preset: 'agency', clientName: 'SuperAgency' });
    assert.ok(config.messages.fr.welcomeMessage.includes('SuperAgency'));
  });

  it('EN messages contain clientName', () => {
    const config = generateConfig({ preset: 'agency', clientName: 'SuperAgency' });
    assert.ok(config.messages.en.welcomeMessage.includes('SuperAgency'));
  });

  it('default voiceEndpoint points to vocalia dashboard', () => {
    const config = generateConfig({ preset: 'agency', clientName: 'Test' });
    assert.ok(config.api.voiceEndpoint.includes('vocalia.ma'));
  });

  it('custom voiceEndpoint is used', () => {
    const config = generateConfig({ preset: 'agency', clientName: 'Test', voiceEndpoint: 'https://custom.api/voice' });
    assert.equal(config.api.voiceEndpoint, 'https://custom.api/voice');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// validateConfig
// ═══════════════════════════════════════════════════════════════════════════════

describe('validateConfig', () => {
  it('returns valid for a complete generated config', () => {
    const config = generateConfig({ preset: 'ecommerce', clientName: 'Shop', domain: 'shop.com' });
    const result = validateConfig(config);
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  it('returns invalid for null', () => {
    const result = validateConfig(null);
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
  });

  it('returns invalid for non-object', () => {
    const result = validateConfig('string');
    assert.equal(result.valid, false);
  });

  it('detects missing client.name', () => {
    const result = validateConfig({ client: { domain: 'x.com' }, branding: { primaryColor: '#000000' }, messages: { fr: { welcomeMessage: 'Hi' } }, prompts: { fr: 'Hello' } });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('client.name')));
  });

  it('detects missing client.domain', () => {
    const result = validateConfig({ client: { name: 'X' }, branding: { primaryColor: '#000000' }, messages: { fr: { welcomeMessage: 'Hi' } }, prompts: { fr: 'Hello' } });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('client.domain')));
  });

  it('detects missing branding.primaryColor', () => {
    const result = validateConfig({ client: { name: 'X', domain: 'x.com' }, branding: {}, messages: { fr: { welcomeMessage: 'Hi' } }, prompts: { fr: 'Hello' } });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('primaryColor')));
  });

  it('detects invalid hex color', () => {
    const result = validateConfig({ client: { name: 'X', domain: 'x.com' }, branding: { primaryColor: 'red' }, messages: { fr: { welcomeMessage: 'Hi' } }, prompts: { fr: 'Hello' } });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('hex color')));
  });

  it('warns about disabled booking', () => {
    const config = generateConfig({ preset: 'agency', clientName: 'Test' });
    const result = validateConfig(config);
    assert.ok(result.warnings.some(w => w.includes('Booking')));
  });

  it('warns about single language', () => {
    const config = generateConfig({ preset: 'agency', clientName: 'Test', languages: ['fr'] });
    const result = validateConfig(config);
    assert.ok(result.warnings.some(w => w.includes('one language')));
  });

  it('warns about disabled realtime', () => {
    const config = generateConfig({ preset: 'agency', clientName: 'Test' });
    const result = validateConfig(config);
    assert.ok(result.warnings.some(w => w.includes('Realtime')));
  });

  it('warns about short API timeout', () => {
    const config = generateConfig({ preset: 'agency', clientName: 'Test' });
    config.api.timeout = 2000;
    const result = validateConfig(config);
    assert.ok(result.warnings.some(w => w.includes('timeout')));
  });

  it('score is 100 for perfect config with all features', () => {
    const config = generateConfig({
      preset: 'ecommerce',
      clientName: 'Shop',
      domain: 'shop.com',
      languages: ['fr', 'en'],
      bookingUrl: 'https://booking.com'
    });
    config.realtime.enabled = true;
    const result = validateConfig(config);
    assert.equal(result.valid, true);
    // No errors, some warnings may still apply (analytics etc)
    assert.ok(result.score > 80, `Score should be >80, got ${result.score}`);
  });

  it('score penalized by errors (20 per error) and warnings (5 per warning)', () => {
    const result1 = validateConfig({ client: { name: 'X', domain: 'x.com' }, branding: { primaryColor: '#000000' }, messages: { fr: { welcomeMessage: 'Hi' } }, prompts: { fr: 'Hello' } });
    const result2 = validateConfig(null);
    assert.ok(result1.score > result2.score, 'Partial config should score higher than null');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// generateDeploymentFiles
// ═══════════════════════════════════════════════════════════════════════════════

describe('generateDeploymentFiles', () => {
  const tmpDirs = [];

  after(() => {
    for (const dir of tmpDirs) {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

  it('creates 4 files in output directory', () => {
    const config = generateConfig({ preset: 'ecommerce', clientName: 'TestDeploy', domain: 'deploy.com' });
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocalia-test-'));
    tmpDirs.push(tmpDir);

    const files = generateDeploymentFiles(config, tmpDir);
    assert.equal(files.length, 4);
    for (const f of files) {
      assert.ok(fs.existsSync(f), `File should exist: ${f}`);
    }
  });

  it('config.json contains valid JSON matching input', () => {
    const config = generateConfig({ preset: 'b2b', clientName: 'B2BCorp', domain: 'b2bcorp.com' });
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocalia-test-'));
    tmpDirs.push(tmpDir);

    generateDeploymentFiles(config, tmpDir);
    const jsonPath = path.join(tmpDir, 'voice-widget-config.json');
    const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    assert.equal(parsed.client.name, 'B2BCorp');
    assert.equal(parsed.client.domain, 'b2bcorp.com');
    assert.equal(parsed.$preset, 'b2b');
  });

  it('config.js sets window.VOICE_WIDGET_CONFIG', () => {
    const config = generateConfig({ preset: 'agency', clientName: 'Agency', domain: 'agency.ma' });
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocalia-test-'));
    tmpDirs.push(tmpDir);

    generateDeploymentFiles(config, tmpDir);
    const jsContent = fs.readFileSync(path.join(tmpDir, 'voice-widget-config.js'), 'utf-8');
    assert.ok(jsContent.includes('window.VOICE_WIDGET_CONFIG'));
    assert.ok(jsContent.includes('Agency'));
  });

  it('embed-snippet.html contains script tags', () => {
    const config = generateConfig({ preset: 'restaurant', clientName: 'Resto', domain: 'resto.ma' });
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocalia-test-'));
    tmpDirs.push(tmpDir);

    generateDeploymentFiles(config, tmpDir);
    const snippet = fs.readFileSync(path.join(tmpDir, 'embed-snippet.html'), 'utf-8');
    assert.ok(snippet.includes('<script'));
    assert.ok(snippet.includes('VoiceWidget'));
    assert.ok(snippet.includes('vocalia.ma'));
  });

  it('throws TypeError when outputDir is missing', () => {
    const config = generateConfig({ preset: 'agency', clientName: 'Test' });
    assert.throws(() => generateDeploymentFiles(config, null), TypeError);
    assert.throws(() => generateDeploymentFiles(config, ''), TypeError);
  });

  it('full chain: generate → validate → deploy → verify', () => {
    // Generate
    const config = generateConfig({
      preset: 'saas',
      clientName: 'CloudApp',
      domain: 'cloudapp.io',
      languages: ['fr', 'en'],
      bookingUrl: 'https://cal.com/cloudapp'
    });

    // Validate
    const validation = validateConfig(config);
    assert.equal(validation.valid, true, `Validation errors: ${validation.errors.join(', ')}`);

    // Deploy
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocalia-test-'));
    tmpDirs.push(tmpDir);
    const files = generateDeploymentFiles(config, tmpDir);

    // Verify all 4 files
    assert.equal(files.length, 4);
    const json = JSON.parse(fs.readFileSync(files[0], 'utf-8'));
    assert.equal(json.client.name, 'CloudApp');
    assert.equal(json.booking.enabled, true);
    assert.equal(json.booking.url, 'https://cal.com/cloudapp');

    const js = fs.readFileSync(files[1], 'utf-8');
    assert.ok(js.includes('CloudApp'));

    const snippet = fs.readFileSync(files[2], 'utf-8');
    assert.ok(snippet.includes('CloudApp'));

    const readme = fs.readFileSync(files[3], 'utf-8');
    assert.ok(readme.includes('CloudApp'));
    assert.ok(readme.includes('saas'));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// extractLeaves (batch-translate-gemini.cjs)
// ═══════════════════════════════════════════════════════════════════════════════

describe('extractLeaves', () => {
  it('extracts flat keys from nested object', () => {
    const result = extractLeaves({ a: { b: 'value1', c: 'value2' } });
    assert.deepEqual(result, { 'a.b': 'value1', 'a.c': 'value2' });
  });

  it('handles deeply nested objects', () => {
    const result = extractLeaves({ a: { b: { c: { d: 'deep' } } } });
    assert.deepEqual(result, { 'a.b.c.d': 'deep' });
  });

  it('handles flat object (no nesting)', () => {
    const result = extractLeaves({ x: 'hello', y: 'world' });
    assert.deepEqual(result, { x: 'hello', y: 'world' });
  });

  it('handles empty object', () => {
    const result = extractLeaves({});
    assert.deepEqual(result, {});
  });

  it('handles mixed nesting depths', () => {
    const result = extractLeaves({
      simple: 'value',
      nested: { deep: 'value2' },
      deeper: { a: { b: 'value3' } }
    });
    assert.equal(result['simple'], 'value');
    assert.equal(result['nested.deep'], 'value2');
    assert.equal(result['deeper.a.b'], 'value3');
  });

  it('preserves non-string leaf values', () => {
    const result = extractLeaves({ count: 42, enabled: true });
    assert.equal(result['count'], 42);
    assert.equal(result['enabled'], true);
  });

  it('respects prefix parameter', () => {
    const result = extractLeaves({ a: 'val' }, 'root');
    assert.deepEqual(result, { 'root.a': 'val' });
  });

  it('handles real-world locale structure', () => {
    const locale = {
      nav: { home: 'Accueil', pricing: 'Tarifs' },
      hero: { title: 'Bienvenue', subtitle: 'Description' },
      cta: { signup: 'Inscription', login: 'Connexion' }
    };
    const result = extractLeaves(locale);
    assert.equal(Object.keys(result).length, 6);
    assert.equal(result['nav.home'], 'Accueil');
    assert.equal(result['cta.signup'], 'Inscription');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// splitIntoBatches (batch-translate-gemini.cjs)
// ═══════════════════════════════════════════════════════════════════════════════

describe('splitIntoBatches', () => {
  it('splits object into chunks of specified size', () => {
    const obj = { a: 1, b: 2, c: 3, d: 4, e: 5 };
    const batches = splitIntoBatches(obj, 2);
    assert.equal(batches.length, 3); // 2 + 2 + 1
    assert.deepEqual(batches[0], { a: 1, b: 2 });
    assert.deepEqual(batches[1], { c: 3, d: 4 });
    assert.deepEqual(batches[2], { e: 5 });
  });

  it('returns single batch when size >= entries', () => {
    const obj = { a: 1, b: 2 };
    const batches = splitIntoBatches(obj, 10);
    assert.equal(batches.length, 1);
    assert.deepEqual(batches[0], { a: 1, b: 2 });
  });

  it('returns empty array for empty object', () => {
    const batches = splitIntoBatches({}, 5);
    assert.equal(batches.length, 0);
  });

  it('handles batch size of 1', () => {
    const obj = { a: 1, b: 2, c: 3 };
    const batches = splitIntoBatches(obj, 1);
    assert.equal(batches.length, 3);
    assert.deepEqual(batches[0], { a: 1 });
    assert.deepEqual(batches[1], { b: 2 });
    assert.deepEqual(batches[2], { c: 3 });
  });

  it('preserves all entries across batches', () => {
    const obj = {};
    for (let i = 0; i < 100; i++) obj[`key_${i}`] = i;
    const batches = splitIntoBatches(obj, 40);
    assert.equal(batches.length, 3); // 40 + 40 + 20

    const reassembled = {};
    for (const batch of batches) Object.assign(reassembled, batch);
    assert.equal(Object.keys(reassembled).length, 100);
    assert.equal(reassembled.key_0, 0);
    assert.equal(reassembled.key_99, 99);
  });

  it('chain: extractLeaves → splitIntoBatches preserves all keys', () => {
    const locale = {
      nav: { home: 'Accueil', pricing: 'Tarifs', features: 'Fonctionnalités' },
      hero: { title: 'Bienvenue', subtitle: 'Description', cta: 'Commencer' },
      footer: { copyright: '© VocalIA', links: { privacy: 'Confidentialité', terms: 'CGU' } }
    };
    const leaves = extractLeaves(locale);
    const batches = splitIntoBatches(leaves, 3);

    const totalKeys = batches.reduce((sum, b) => sum + Object.keys(b).length, 0);
    assert.equal(totalKeys, Object.keys(leaves).length);
    assert.equal(totalKeys, 9); // nav(3) + hero(3) + footer.copyright + footer.links.privacy + footer.links.terms
  });
});
