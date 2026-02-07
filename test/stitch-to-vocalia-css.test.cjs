'use strict';

/**
 * VocalIA Stitch-to-VocalIA CSS Converter Tests
 *
 * Tests:
 * - DESIGN_TOKENS structure (colors, classMap, components)
 * - convertStitchToVocalIA (color replacement, class conversion, stylesheet injection, branding)
 * - healthCheck
 *
 * NOTE: Uses temp files for conversion tests.
 *
 * Run: node --test test/stitch-to-vocalia-css.test.cjs
 */

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { convertStitchToVocalIA, healthCheck, DESIGN_TOKENS } = require('../core/stitch-to-vocalia-css.cjs');

// ─── DESIGN_TOKENS ──────────────────────────────────────────────────

describe('StitchToVocalIA DESIGN_TOKENS', () => {
  test('has colors map', () => {
    assert.ok(DESIGN_TOKENS.colors);
    assert.ok(Object.keys(DESIGN_TOKENS.colors).length >= 5);
  });

  test('maps VocalIA primary color', () => {
    assert.strictEqual(DESIGN_TOKENS.colors['#5E6AD2'], 'var(--primary)');
  });

  test('maps VocalIA secondary color', () => {
    assert.strictEqual(DESIGN_TOKENS.colors['#191E35'], 'var(--secondary)');
  });

  test('maps VocalIA accent color', () => {
    assert.strictEqual(DESIGN_TOKENS.colors['#10B981'], 'var(--accent)');
  });

  test('maps Shopify green', () => {
    assert.strictEqual(DESIGN_TOKENS.colors['#95bf47'], 'var(--shopify-green)');
  });

  test('has classMap', () => {
    assert.ok(DESIGN_TOKENS.classMap);
    assert.ok(Object.keys(DESIGN_TOKENS.classMap).length >= 10);
  });

  test('classMap includes glassmorphism mappings', () => {
    assert.strictEqual(DESIGN_TOKENS.classMap['bg-white/3'], 'glass-bg');
    assert.strictEqual(DESIGN_TOKENS.classMap['backdrop-blur-md'], 'glass-backdrop');
  });

  test('classMap includes button mappings', () => {
    assert.strictEqual(DESIGN_TOKENS.classMap['bg-primary'], 'btn-cyber');
  });

  test('has components map', () => {
    assert.ok(DESIGN_TOKENS.components);
    assert.strictEqual(DESIGN_TOKENS.components['glass-card'], 'glass-panel');
  });
});

// ─── convertStitchToVocalIA ─────────────────────────────────────────

describe('StitchToVocalIA convertStitchToVocalIA', () => {
  const tmpFiles = [];

  afterEach(() => {
    for (const f of tmpFiles) {
      try { fs.unlinkSync(f); } catch { /* ignore */ }
    }
    tmpFiles.length = 0;
  });

  function createTempHtml(content) {
    const tmpFile = path.join(os.tmpdir(), `stitch-test-${Date.now()}.html`);
    fs.writeFileSync(tmpFile, content);
    tmpFiles.push(tmpFile);
    return tmpFile;
  }

  test('converts hex colors to CSS variables', () => {
    const input = createTempHtml(`<html><head></head><body>
      <div class="bg-[#5E6AD2]">Primary</div>
      <div class="text-[#191E35]">Secondary</div>
    </body></html>`);

    const result = convertStitchToVocalIA(input);
    assert.ok(result.includes('var(--primary)'));
    assert.ok(result.includes('var(--secondary)'));
    assert.ok(!result.includes('bg-[#5E6AD2]'));
  });

  test('converts component class names', () => {
    const input = createTempHtml(`<html><head></head><body>
      <div class="glass-card">Content</div>
    </body></html>`);

    const result = convertStitchToVocalIA(input);
    assert.ok(result.includes('glass-panel'));
  });

  test('removes Tailwind CDN script', () => {
    const input = createTempHtml(`<html><head>
      <script src="https://cdn.tailwindcss.com"></script>
    </head><body></body></html>`);

    const result = convertStitchToVocalIA(input);
    assert.ok(!result.includes('cdn.tailwindcss.com'));
  });

  test('injects VocalIA CSS variables', () => {
    const input = createTempHtml(`<html><head></head><body></body></html>`);
    const result = convertStitchToVocalIA(input);
    assert.ok(result.includes('--primary: #5E6AD2'));
    assert.ok(result.includes('--secondary: #191E35'));
  });

  test('injects VocalIA class definitions', () => {
    const input = createTempHtml(`<html><head></head><body></body></html>`);
    const result = convertStitchToVocalIA(input);
    assert.ok(result.includes('.glass-panel'));
    assert.ok(result.includes('.btn-cyber'));
  });

  test('adds VocalIA meta tags', () => {
    const input = createTempHtml(`<html><head></head><body></body></html>`);
    const result = convertStitchToVocalIA(input);
    assert.ok(result.includes('name="author" content="VocalIA"'));
    assert.ok(result.includes('stitch-converted'));
  });

  test('updates copyright year', () => {
    const input = createTempHtml(`<html><head></head><body>© 2020 Company</body></html>`);
    const result = convertStitchToVocalIA(input);
    assert.ok(result.includes(`© ${new Date().getFullYear()}`));
  });

  test('supports link mode', () => {
    const input = createTempHtml(`<html><head></head><body></body></html>`);
    const result = convertStitchToVocalIA(input, { mode: 'link' });
    assert.ok(result.includes('href="/styles.css'));
  });

  test('converts inline style hex colors', () => {
    const input = createTempHtml(`<html><head></head><body>
      <div style="color:#191E35;">Text</div>
    </body></html>`);

    const result = convertStitchToVocalIA(input);
    assert.ok(result.includes('var(--secondary)'));
  });
});

// ─── healthCheck ────────────────────────────────────────────────────

describe('StitchToVocalIA healthCheck', () => {
  test('returns true', () => {
    assert.strictEqual(healthCheck(), true);
  });
});
