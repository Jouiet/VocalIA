/**
 * VocalIA - Voice Widget E2E Tests
 * Session 250.9 - Task #15
 *
 * Tests the Voice Widget Core functionality:
 * - Module structure and exports
 * - Configuration validation
 * - Language file integrity
 * - Widget HTML generation
 * - API endpoint configuration
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// Paths - Updated Session 250.87
const WIDGET_PATH = path.join(__dirname, '../widget/voice-widget-v3.js');
const TEMPLATE_PATH = path.join(__dirname, '../scripts/voice-widget-templates.cjs'); // In scripts/ not widget/
const LANG_PATH = path.join(__dirname, '../website/voice-assistant/lang');

// ─────────────────────────────────────────────────────────────────────────────
// Widget File Structure Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Voice Widget File Structure', () => {
  it('voice-widget-v3.js exists', () => {
    assert.ok(fs.existsSync(WIDGET_PATH), 'voice-widget-v3.js should exist');
  });

  it('voice-widget-templates.cjs exists', () => {
    assert.ok(fs.existsSync(TEMPLATE_PATH), 'voice-widget-templates.cjs should exist');
  });

  it('voice-widget-v3.js is substantial (>500 lines)', () => {
    const content = fs.readFileSync(WIDGET_PATH, 'utf8');
    const lines = content.split('\n').length;
    assert.ok(lines > 500, `Widget core should have >500 lines, got ${lines}`);
  });

  it('Widget uses IIFE pattern for encapsulation', () => {
    const content = fs.readFileSync(WIDGET_PATH, 'utf8');
    assert.ok(content.includes('(function ()'), 'Widget should use IIFE pattern');
    assert.ok(content.includes("'use strict'"), 'Widget should use strict mode');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Widget Configuration Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Voice Widget Configuration', () => {
  let widgetContent;

  beforeEach(() => {
    widgetContent = fs.readFileSync(WIDGET_PATH, 'utf8');
  });

  it('Has supported languages configuration', () => {
    assert.ok(widgetContent.includes('SUPPORTED_LANGS'), 'Should have SUPPORTED_LANGS');
    assert.ok(widgetContent.includes("'fr'"), 'Should support French');
    assert.ok(widgetContent.includes("'en'"), 'Should support English');
  });

  it('Has language path configuration', () => {
    assert.ok(widgetContent.includes('LANG_PATH'), 'Should have LANG_PATH config');
    assert.ok(widgetContent.includes('voice-{lang}.json'), 'Should have language file pattern');
  });

  it('Has branding colors configuration', () => {
    assert.ok(widgetContent.includes('primaryColor'), 'Should have primaryColor');
    assert.ok(widgetContent.includes('primaryDark'), 'Should have primaryDark');
    assert.ok(widgetContent.includes('accentColor'), 'Should have accentColor');
  });

  it('Has API endpoint configuration', () => {
    assert.ok(widgetContent.includes('BOOKING_API'), 'Should have BOOKING_API config');
  });

  it('Has auto-detect language mapping', () => {
    assert.ok(widgetContent.includes('AUTO_DETECT_LANGUAGES'), 'Should have AUTO_DETECT_LANGUAGES');
    assert.ok(widgetContent.includes("'fr-FR': 'fr'"), 'Should map fr-FR to fr');
    assert.ok(widgetContent.includes("'en-US': 'en'"), 'Should map en-US to en');
    assert.ok(widgetContent.includes("'ar-SA': 'ar'"), 'Should map ar-SA to ar');
    assert.ok(widgetContent.includes("'ary'"), 'Should support Darija (ary)');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Widget State Management Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Voice Widget State Management', () => {
  let widgetContent;

  beforeEach(() => {
    widgetContent = fs.readFileSync(WIDGET_PATH, 'utf8');
  });

  it('Has state object', () => {
    assert.ok(widgetContent.includes('let state = {'), 'Should have state object');
  });

  it('State has required properties', () => {
    assert.ok(widgetContent.includes('isOpen:'), 'Should have isOpen state');
    assert.ok(widgetContent.includes('isListening:'), 'Should have isListening state');
    assert.ok(widgetContent.includes('recognition:'), 'Should have recognition state');
    assert.ok(widgetContent.includes('conversationHistory:'), 'Should have conversationHistory state');
    assert.ok(widgetContent.includes('currentLang:'), 'Should have currentLang state');
  });

  it('Has conversation context tracking', () => {
    assert.ok(widgetContent.includes('conversationContext:'), 'Should have conversationContext');
    assert.ok(widgetContent.includes('stage:'), 'Should track conversation stage');
    assert.ok(widgetContent.includes('attribution:'), 'Should have attribution tracking');
  });

  it('Has booking flow state', () => {
    assert.ok(widgetContent.includes('bookingFlow:'), 'Should have bookingFlow state');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Widget Language Files Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Voice Widget Language Files', () => {
  const EXPECTED_LANGS = ['fr', 'en', 'es', 'ar', 'ary'];

  it('Language directory exists', () => {
    assert.ok(fs.existsSync(LANG_PATH), 'Language directory should exist');
  });

  for (const lang of EXPECTED_LANGS) {
    it(`voice-${lang}.json exists`, () => {
      const langFile = path.join(LANG_PATH, `voice-${lang}.json`);
      assert.ok(fs.existsSync(langFile), `voice-${lang}.json should exist`);
    });

    it(`voice-${lang}.json is valid JSON`, () => {
      const langFile = path.join(LANG_PATH, `voice-${lang}.json`);
      const content = fs.readFileSync(langFile, 'utf8');
      assert.doesNotThrow(() => JSON.parse(content), `voice-${lang}.json should be valid JSON`);
    });

    it(`voice-${lang}.json has required structure`, () => {
      const langFile = path.join(LANG_PATH, `voice-${lang}.json`);
      const data = JSON.parse(fs.readFileSync(langFile, 'utf8'));

      assert.ok(data.meta, `voice-${lang}.json should have meta section`);
      assert.ok(data.ui, `voice-${lang}.json should have ui section`);
      assert.ok(data.topics, `voice-${lang}.json should have topics section`);
    });

    it(`voice-${lang}.json has meta.code matching filename`, () => {
      const langFile = path.join(LANG_PATH, `voice-${lang}.json`);
      const data = JSON.parse(fs.readFileSync(langFile, 'utf8'));

      assert.strictEqual(data.meta.code, lang, `meta.code should be '${lang}'`);
    });
  }

  it('Arabic languages have RTL flag', () => {
    const arFile = path.join(LANG_PATH, 'voice-ar.json');
    const aryFile = path.join(LANG_PATH, 'voice-ary.json');

    const arData = JSON.parse(fs.readFileSync(arFile, 'utf8'));
    const aryData = JSON.parse(fs.readFileSync(aryFile, 'utf8'));

    assert.strictEqual(arData.meta.rtl, true, 'Arabic should have rtl: true');
    assert.strictEqual(aryData.meta.rtl, true, 'Darija should have rtl: true');
  });

  it('Non-Arabic languages have RTL flag as false', () => {
    const frFile = path.join(LANG_PATH, 'voice-fr.json');
    const enFile = path.join(LANG_PATH, 'voice-en.json');

    const frData = JSON.parse(fs.readFileSync(frFile, 'utf8'));
    const enData = JSON.parse(fs.readFileSync(enFile, 'utf8'));

    assert.strictEqual(frData.meta.rtl, false, 'French should have rtl: false');
    assert.strictEqual(enData.meta.rtl, false, 'English should have rtl: false');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Widget UI Generation Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Voice Widget UI Generation', () => {
  let widgetContent;

  beforeEach(() => {
    widgetContent = fs.readFileSync(WIDGET_PATH, 'utf8');
  });

  it('Has createWidget function', () => {
    assert.ok(widgetContent.includes('function createWidget()'), 'Should have createWidget function');
  });

  it('Has generateWidgetHTML function', () => {
    assert.ok(widgetContent.includes('function generateWidgetHTML'), 'Should have generateWidgetHTML function');
  });

  it('Widget creates unique element ID', () => {
    assert.ok(widgetContent.includes('voice-assistant-widget'), 'Should use voice-assistant-widget ID');
  });

  it('Widget has trigger button with animation', () => {
    assert.ok(widgetContent.includes('.va-trigger'), 'Should have trigger button class');
    assert.ok(widgetContent.includes('pulse-glow'), 'Should have pulse animation');
  });

  it('Widget supports RTL positioning', () => {
    assert.ok(widgetContent.includes("position === 'left' ? 'right'") ||
              widgetContent.includes("isRTL ? 'left' : 'right'"),
              'Should support RTL positioning');
  });

  it('Widget has message display area', () => {
    assert.ok(widgetContent.includes('va-messages') || widgetContent.includes('messages'),
              'Should have messages display area');
  });

  it('Widget has input area', () => {
    assert.ok(widgetContent.includes('va-input') || widgetContent.includes('input'),
              'Should have input area');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Widget Event Handling Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Voice Widget Event Handling', () => {
  let widgetContent;

  beforeEach(() => {
    widgetContent = fs.readFileSync(WIDGET_PATH, 'utf8');
  });

  it('Has event listeners initialization', () => {
    assert.ok(widgetContent.includes('initEventListeners') ||
              widgetContent.includes('addEventListener'),
              'Should initialize event listeners');
  });

  it('Has click handlers', () => {
    assert.ok(widgetContent.includes('click'), 'Should handle click events');
  });

  it('Has keyboard support', () => {
    assert.ok(widgetContent.includes('keydown') || widgetContent.includes('Enter'),
              'Should support keyboard interaction');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Widget Speech Recognition Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Voice Widget Speech Recognition', () => {
  let widgetContent;

  beforeEach(() => {
    widgetContent = fs.readFileSync(WIDGET_PATH, 'utf8');
  });

  it('Checks for SpeechRecognition support', () => {
    assert.ok(widgetContent.includes('SpeechRecognition'),
              'Should check for SpeechRecognition');
    assert.ok(widgetContent.includes('webkitSpeechRecognition'),
              'Should check for webkit prefix');
  });

  it('Has speech synthesis support', () => {
    assert.ok(widgetContent.includes('speechSynthesis'),
              'Should support speech synthesis');
  });

  it('Has browser detection for fallback', () => {
    assert.ok(widgetContent.includes('isFirefox') || widgetContent.includes('firefox'),
              'Should detect Firefox for fallback');
    assert.ok(widgetContent.includes('isSafari') || widgetContent.includes('safari'),
              'Should detect Safari for fallback');
  });

  it('Has text fallback mode', () => {
    assert.ok(widgetContent.includes('needsTextFallback') || widgetContent.includes('textFallback'),
              'Should have text fallback for browsers without speech recognition');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Widget Analytics Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Voice Widget Analytics', () => {
  let widgetContent;

  beforeEach(() => {
    widgetContent = fs.readFileSync(WIDGET_PATH, 'utf8');
  });

  it('Has event tracking function', () => {
    assert.ok(widgetContent.includes('trackEvent'), 'Should have trackEvent function');
  });

  it('Supports GA4', () => {
    assert.ok(widgetContent.includes('gtag'), 'Should support GA4 gtag');
  });

  it('Supports dataLayer', () => {
    assert.ok(widgetContent.includes('dataLayer'), 'Should support dataLayer');
  });

  it('Has attribution capture', () => {
    assert.ok(widgetContent.includes('captureAttribution') || widgetContent.includes('utm_source'),
              'Should capture marketing attribution');
  });

  it('Tracks UTM parameters', () => {
    assert.ok(widgetContent.includes('utm_source'), 'Should track utm_source');
    assert.ok(widgetContent.includes('utm_medium'), 'Should track utm_medium');
    assert.ok(widgetContent.includes('utm_campaign'), 'Should track utm_campaign');
  });

  it('Tracks ad platform IDs', () => {
    assert.ok(widgetContent.includes('gclid'), 'Should track Google Click ID');
    assert.ok(widgetContent.includes('fbclid'), 'Should track Facebook Click ID');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Widget Templates Module Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Voice Widget Templates Module', () => {
  it('Templates module loads without error', () => {
    assert.doesNotThrow(() => {
      require(TEMPLATE_PATH);
    }, 'Templates module should load');
  });

  it('Templates module exports functions', () => {
    const templates = require(TEMPLATE_PATH);
    assert.ok(typeof templates === 'object', 'Templates should export an object');
  });

  it('Templates module is substantial', () => {
    const content = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    const lines = content.split('\n').length;
    assert.ok(lines > 50, `Templates should have >50 lines, got ${lines}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Widget Security Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Voice Widget Security', () => {
  let widgetContent;

  beforeEach(() => {
    widgetContent = fs.readFileSync(WIDGET_PATH, 'utf8');
  });

  it('Does not expose API keys', () => {
    assert.ok(!widgetContent.includes('sk_live'), 'Should not contain Stripe live keys');
    assert.ok(!widgetContent.includes('sk_test'), 'Should not contain Stripe test keys');
    assert.ok(!widgetContent.includes('api_key='), 'Should not expose API keys');
  });

  it('Uses HTTPS for API endpoints', () => {
    const httpMatches = widgetContent.match(/http:\/\/(?!localhost|www\.w3\.org)/g);
    assert.ok(!httpMatches || httpMatches.length === 0,
              'Should not use non-localhost HTTP URLs');
  });

  it('Does not use eval', () => {
    // Check for eval but exclude comments
    const lines = widgetContent.split('\n');
    const evalUsage = lines.filter(line =>
      !line.trim().startsWith('//') &&
      !line.trim().startsWith('*') &&
      line.includes('eval(')
    );
    assert.strictEqual(evalUsage.length, 0, 'Should not use eval()');
  });
});
