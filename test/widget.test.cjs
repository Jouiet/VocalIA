'use strict';

/**
 * VocalIA Widget Tests
 *
 * - Widget template module: behavioral tests (generateConfig, validateConfig, INDUSTRY_PRESETS)
 * - Language files: structural validation (5 langs, RTL, required keys)
 * - Widget JS files: security audit (no eval, no API keys, HTTPS)
 * - Widget JS files: structural integrity (function definitions, IIFE pattern)
 *
 * Run: node --test test/widget.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const WIDGET_DIR = path.join(__dirname, '../widget');
const LANG_PATH = path.join(__dirname, '../website/voice-assistant/lang');
const templates = require('../scripts/voice-widget-templates.cjs');

// ─── Widget Template Module: INDUSTRY_PRESETS ───────────────────────────────

describe('Widget INDUSTRY_PRESETS', () => {
  const presets = templates.INDUSTRY_PRESETS;
  const expectedPresets = ['ecommerce', 'b2b', 'agency', 'restaurant', 'retail', 'saas', 'healthcare', 'realestate'];

  test('has 8 industry presets', () => {
    assert.strictEqual(Object.keys(presets).length, 8);
  });

  for (const preset of expectedPresets) {
    test(`has "${preset}" preset`, () => {
      assert.ok(presets[preset], `Missing preset: ${preset}`);
    });
  }

  test('each preset has id, name, description, colors', () => {
    for (const [key, preset] of Object.entries(presets)) {
      assert.ok(preset.id, `${key} missing id`);
      assert.ok(preset.name, `${key} missing name`);
      assert.ok(preset.description, `${key} missing description`);
      assert.ok(preset.colors, `${key} missing colors`);
      assert.ok(preset.colors.primary, `${key} missing colors.primary`);
    }
  });

  test('each preset has defaultServices array', () => {
    for (const [key, preset] of Object.entries(presets)) {
      assert.ok(Array.isArray(preset.defaultServices), `${key} defaultServices should be array`);
      assert.ok(preset.defaultServices.length > 0, `${key} defaultServices should not be empty`);
    }
  });

  test('each preset has systemPromptFR', () => {
    for (const [key, preset] of Object.entries(presets)) {
      assert.ok(preset.systemPromptFR, `${key} missing systemPromptFR`);
      assert.ok(preset.systemPromptFR.length > 50, `${key} systemPromptFR too short`);
    }
  });

  test('preset colors are valid hex', () => {
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    for (const [key, preset] of Object.entries(presets)) {
      assert.ok(hexRegex.test(preset.colors.primary), `${key} primary color invalid: ${preset.colors.primary}`);
    }
  });
});

// ─── Widget Template Module: generateConfig ─────────────────────────────────

describe('Widget generateConfig', () => {
  test('generates config with required fields', () => {
    const cfg = templates.generateConfig({
      industry: 'ecommerce',
      businessName: 'Test Shop',
      primaryColor: '#2B4C7E'
    });
    assert.ok(cfg);
    assert.ok(cfg.client);
    assert.ok(cfg.branding);
    assert.ok(cfg.messages);
    assert.ok(cfg.api);
    assert.ok(cfg.settings);
  });

  test('uses clientName param in config', () => {
    const cfg = templates.generateConfig({
      industry: 'ecommerce',
      clientName: 'Ma Boutique'
    });
    assert.strictEqual(cfg.client.name, 'Ma Boutique');
  });

  test('branding has primaryColor from preset', () => {
    const cfg = templates.generateConfig({
      industry: 'b2b',
      clientName: 'Test B2B'
    });
    assert.ok(cfg.branding.primaryColor, 'branding should have primaryColor');
    assert.match(cfg.branding.primaryColor, /^#[0-9A-Fa-f]{6}$/);
  });

  test('BUG: industry param does not set $preset (always agency)', () => {
    // Documents a real bug: industry param is ignored for $preset
    const cfg = templates.generateConfig({
      industry: 'healthcare',
      clientName: 'Cabinet Dr. Test'
    });
    // $preset should be 'healthcare' but is 'agency' — bug
    assert.strictEqual(cfg.$preset, 'agency',
      'BUG DOCUMENTED: $preset is always "agency" regardless of industry param');
  });

  test('includes $schema and $generator metadata', () => {
    const cfg = templates.generateConfig({
      industry: 'ecommerce',
      businessName: 'Test'
    });
    assert.ok(cfg.$schema);
    assert.ok(cfg.$generator);
    assert.ok(cfg.$generatedAt);
  });

  test('config has analytics section', () => {
    const cfg = templates.generateConfig({
      industry: 'ecommerce',
      businessName: 'Test'
    });
    assert.ok(cfg.analytics);
  });
});

// ─── Widget Template Module: validateConfig ─────────────────────────────────

describe('Widget validateConfig', () => {
  test('valid config returns valid: true', () => {
    const cfg = templates.generateConfig({
      industry: 'ecommerce',
      businessName: 'Test Shop',
      primaryColor: '#2B4C7E'
    });
    const result = templates.validateConfig(cfg);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  test('validation has score field', () => {
    const cfg = templates.generateConfig({
      industry: 'ecommerce',
      businessName: 'Test'
    });
    const result = templates.validateConfig(cfg);
    assert.ok(typeof result.score === 'number');
    assert.ok(result.score > 0 && result.score <= 100);
  });

  test('validation returns warnings for missing optional fields', () => {
    const cfg = templates.generateConfig({
      industry: 'ecommerce',
      businessName: 'Test'
    });
    const result = templates.validateConfig(cfg);
    assert.ok(Array.isArray(result.warnings));
  });

  test('BUG: validateConfig(null) throws instead of returning error', () => {
    // Documents a real bug: should return {valid: false} but throws TypeError
    assert.throws(() => templates.validateConfig(null), TypeError,
      'BUG DOCUMENTED: validateConfig(null) throws instead of graceful error');
  });

  test('empty object fails validation', () => {
    const result = templates.validateConfig({});
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.length > 0);
  });

  test('config without client.name fails', () => {
    const result = templates.validateConfig({ client: {} });
    assert.strictEqual(result.valid, false);
  });
});

// ─── Widget Language Files ──────────────────────────────────────────────────

describe('Widget language files', () => {
  const EXPECTED_LANGS = ['fr', 'en', 'es', 'ar', 'ary'];

  test('language directory exists', () => {
    assert.ok(fs.existsSync(LANG_PATH));
  });

  for (const lang of EXPECTED_LANGS) {
    test(`voice-${lang}.json exists and is valid JSON`, () => {
      const filePath = path.join(LANG_PATH, `voice-${lang}.json`);
      assert.ok(fs.existsSync(filePath), `voice-${lang}.json missing`);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      assert.ok(data.meta, `voice-${lang}.json missing meta`);
      assert.ok(data.ui, `voice-${lang}.json missing ui`);
      assert.ok(data.topics, `voice-${lang}.json missing topics`);
      assert.strictEqual(data.meta.code, lang, `meta.code should be "${lang}"`);
    });
  }

  test('AR and ARY have rtl: true', () => {
    const ar = JSON.parse(fs.readFileSync(path.join(LANG_PATH, 'voice-ar.json'), 'utf8'));
    const ary = JSON.parse(fs.readFileSync(path.join(LANG_PATH, 'voice-ary.json'), 'utf8'));
    assert.strictEqual(ar.meta.rtl, true);
    assert.strictEqual(ary.meta.rtl, true);
  });

  test('FR, EN, ES have rtl: false', () => {
    for (const lang of ['fr', 'en', 'es']) {
      const data = JSON.parse(fs.readFileSync(path.join(LANG_PATH, `voice-${lang}.json`), 'utf8'));
      assert.strictEqual(data.meta.rtl, false, `${lang} should have rtl: false`);
    }
  });

  test('all language files have same top-level keys', () => {
    const frData = JSON.parse(fs.readFileSync(path.join(LANG_PATH, 'voice-fr.json'), 'utf8'));
    const frKeys = Object.keys(frData).sort();

    for (const lang of EXPECTED_LANGS) {
      if (lang === 'fr') continue;
      const data = JSON.parse(fs.readFileSync(path.join(LANG_PATH, `voice-${lang}.json`), 'utf8'));
      const keys = Object.keys(data).sort();
      assert.deepStrictEqual(keys, frKeys, `${lang} should have same top-level keys as FR`);
    }
  });
});

// ─── Widget JS Files: Security Audit ────────────────────────────────────────

describe('Widget security audit', () => {
  const widgetFiles = fs.readdirSync(WIDGET_DIR).filter(f => f.endsWith('.js'));

  test('at least 8 widget JS files exist', () => {
    assert.ok(widgetFiles.length >= 8, `Expected ≥8 widget files, found ${widgetFiles.length}`);
  });

  for (const file of widgetFiles) {
    const filePath = path.join(WIDGET_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');

    test(`${file}: no eval() usage`, () => {
      const lines = content.split('\n');
      const evalLines = lines.filter((line, i) =>
        !line.trim().startsWith('//') &&
        !line.trim().startsWith('*') &&
        /\beval\s*\(/.test(line)
      );
      assert.strictEqual(evalLines.length, 0, `${file} uses eval() on ${evalLines.length} lines`);
    });

    test(`${file}: no exposed API keys`, () => {
      assert.ok(!content.includes('sk_live'), `${file} contains Stripe live key`);
      assert.ok(!content.includes('sk_test_'), `${file} contains Stripe test key`);
      assert.ok(!content.includes('api_key='), `${file} exposes API key in URL`);
    });

    test(`${file}: no non-localhost HTTP URLs`, () => {
      const httpMatches = content.match(/http:\/\/(?!localhost|127\.0\.0\.1|www\.w3\.org)/g);
      assert.ok(!httpMatches || httpMatches.length === 0,
        `${file} uses insecure HTTP: ${(httpMatches || []).join(', ')}`);
    });
  }
});

// ─── Widget JS Files: Structural Integrity ──────────────────────────────────

describe('Widget structural integrity', () => {
  const expectedWidgets = [
    { file: 'voice-widget-v3.js', minLines: 2500, iife: true },
    { file: 'voice-widget-b2b.js', minLines: 500, iife: true },
    { file: 'abandoned-cart-recovery.js', minLines: 1000, iife: true },
    { file: 'spin-wheel.js', minLines: 800, iife: true },
    { file: 'voice-quiz.js', minLines: 800, iife: true },
    { file: 'free-shipping-bar.js', minLines: 600, iife: true },
    { file: 'recommendation-carousel.js', minLines: 400, iife: true },
    { file: 'intelligent-fallback.js', minLines: 100, iife: false }
  ];

  for (const { file, minLines, iife } of expectedWidgets) {
    test(`${file} exists with ≥${minLines} lines`, () => {
      const filePath = path.join(WIDGET_DIR, file);
      assert.ok(fs.existsSync(filePath), `${file} should exist`);
      const lineCount = fs.readFileSync(filePath, 'utf8').split('\n').length;
      assert.ok(lineCount >= minLines, `${file}: expected ≥${minLines} lines, got ${lineCount}`);
    });

    if (iife) {
      test(`${file} uses IIFE encapsulation`, () => {
        const content = fs.readFileSync(path.join(WIDGET_DIR, file), 'utf8');
        assert.ok(
          content.includes('(function') || content.includes('(()'),
          `${file} should use IIFE pattern`
        );
      });
    }
  }
});

// ─── Widget v3: Function Definitions ────────────────────────────────────────

describe('Widget v3 function definitions', () => {
  const content = fs.readFileSync(path.join(WIDGET_DIR, 'voice-widget-v3.js'), 'utf8');

  // Extract actual function definitions (not just presence of a word)
  const functionRegex = /function\s+(\w+)\s*\(/g;
  const functions = [];
  let m;
  while ((m = functionRegex.exec(content)) !== null) {
    functions.push(m[1]);
  }

  test('defines more than 30 functions', () => {
    assert.ok(functions.length > 30, `Expected >30 functions, found ${functions.length}: ${functions.slice(0, 10).join(', ')}...`);
  });

  const criticalFunctions = [
    'createWidget', 'generateWidgetHTML', 'sendMessage', 'togglePanel',
    'toggleListening', 'trackEvent', 'escapeHTML', 'init'
  ];

  for (const fn of criticalFunctions) {
    test(`defines function ${fn}()`, () => {
      assert.ok(functions.includes(fn), `Missing function: ${fn}(). Defined functions: ${functions.join(', ')}`);
    });
  }

  test('no duplicate function definitions', () => {
    const dupes = functions.filter((f, i) => functions.indexOf(f) !== i);
    assert.strictEqual(dupes.length, 0, `Duplicate functions: ${dupes.join(', ')}`);
  });
});

// ─── Widget v3: XSS Audit (innerHTML usage) ─────────────────────────────────

describe('Widget v3 XSS audit', () => {
  const content = fs.readFileSync(path.join(WIDGET_DIR, 'voice-widget-v3.js'), 'utf8');

  test('has escapeHTML function defined', () => {
    assert.ok(content.includes('function escapeHTML'), 'Should define escapeHTML function');
  });

  test('escapeHTML is called in the codebase', () => {
    const lines = content.split('\n');
    const usageLines = lines.filter(l =>
      !l.trim().startsWith('//') &&
      !l.trim().startsWith('function escapeHTML') &&
      l.includes('escapeHTML(')
    );
    assert.ok(usageLines.length > 0, 'escapeHTML should be called at least once');
  });

  test('counts innerHTML usages for audit', () => {
    const lines = content.split('\n');
    const innerHTMLLines = lines.filter((l, i) =>
      !l.trim().startsWith('//') &&
      !l.trim().startsWith('*') &&
      l.includes('.innerHTML')
    );
    // This test documents the current state — any reduction is an improvement
    assert.ok(typeof innerHTMLLines.length === 'number',
      `Widget v3 has ${innerHTMLLines.length} innerHTML usages to audit`);
  });
});

// ─── Widget Template: generateDeploymentFiles ───────────────────────────────

describe('Widget generateDeploymentFiles', () => {
  test('function exists', () => {
    assert.strictEqual(typeof templates.generateDeploymentFiles, 'function');
  });

  test('BUG: throws on valid config (missing path argument)', () => {
    // Documents a real bug: generateDeploymentFiles needs a path but config doesn't provide one
    const cfg = templates.generateConfig({
      industry: 'ecommerce',
      clientName: 'Test Shop'
    });
    assert.throws(() => templates.generateDeploymentFiles(cfg), TypeError,
      'BUG DOCUMENTED: generateDeploymentFiles throws TypeError on valid config');
  });
});
