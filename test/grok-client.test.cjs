'use strict';

/**
 * VocalIA Grok Client Tests
 *
 * Tests:
 * - BASE_SYSTEM_PROMPT content and structure
 * - Module exports (chatCompletion, generateAuditAnalysis, etc.)
 * - Prompt content: identity, products, personas, integrations, principles
 *
 * NOTE: Does NOT call xAI API. Tests pure logic and constants only.
 *
 * Run: node --test test/grok-client.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
  BASE_SYSTEM_PROMPT,
  chatCompletion,
  generateAuditAnalysis,
  generateEmailContent,
  queryKnowledgeBase,
  initRAG
} = require('../core/grok-client.cjs');

// ─── BASE_SYSTEM_PROMPT ─────────────────────────────────────────────

describe('GrokClient BASE_SYSTEM_PROMPT', () => {
  test('is a non-empty string', () => {
    assert.strictEqual(typeof BASE_SYSTEM_PROMPT, 'string');
    assert.ok(BASE_SYSTEM_PROMPT.length > 100);
  });

  test('contains VocalIA identity', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('VocalIA'));
    assert.ok(BASE_SYSTEM_PROMPT.includes('vocalia.ma'));
    assert.ok(BASE_SYSTEM_PROMPT.includes('contact@vocalia.ma'));
  });

  test('mentions Voice AI platform type', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('Voice AI'));
  });

  test('describes 2 products: Widget and Telephony', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('VOICE WIDGET'));
    assert.ok(BASE_SYSTEM_PROMPT.includes('VOICE TELEPHONY'));
  });

  test('mentions Web Speech API for widget', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('Web Speech API'));
  });

  test('mentions Twilio for telephony', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('Twilio'));
  });

  test('mentions 40 personas', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('40'));
    assert.ok(BASE_SYSTEM_PROMPT.includes('ersonas') || BASE_SYSTEM_PROMPT.includes('PERSONAS'));
  });

  test('mentions MCP tools', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('MCP'));
  });

  test('mentions integrations: HubSpot, Shopify, Stripe', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('HubSpot'));
    assert.ok(BASE_SYSTEM_PROMPT.includes('Shopify'));
    assert.ok(BASE_SYSTEM_PROMPT.includes('Stripe'));
  });

  test('mentions 5 languages', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('Français'));
    assert.ok(BASE_SYSTEM_PROMPT.includes('English'));
    assert.ok(BASE_SYSTEM_PROMPT.includes('Español'));
    assert.ok(BASE_SYSTEM_PROMPT.includes('العربية'));
    assert.ok(BASE_SYSTEM_PROMPT.includes('Darija'));
  });

  test('mentions location: Maroc', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('Maroc'));
  });

  test('includes principles section', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('Factualité'));
    assert.ok(BASE_SYSTEM_PROMPT.includes('Transparence'));
  });

  test('includes format guidelines', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('FORMAT'));
  });

  test('mentions BANT qualification', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('BANT'));
  });

  test('mentions Pipedrive and Zoho', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('Pipedrive'));
    assert.ok(BASE_SYSTEM_PROMPT.includes('Zoho'));
  });

  test('mentions WooCommerce and Magento', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('WooCommerce'));
    assert.ok(BASE_SYSTEM_PROMPT.includes('Magento'));
  });

  test('mentions Calendar integrations', () => {
    assert.ok(BASE_SYSTEM_PROMPT.includes('Calendar') || BASE_SYSTEM_PROMPT.includes('Calendly'));
  });
});

// ─── Exports ────────────────────────────────────────────────────────

describe('GrokClient exports', () => {
  test('exports chatCompletion function', () => {
    assert.strictEqual(typeof chatCompletion, 'function');
  });

  test('exports generateAuditAnalysis function', () => {
    assert.strictEqual(typeof generateAuditAnalysis, 'function');
  });

  test('exports generateEmailContent function', () => {
    assert.strictEqual(typeof generateEmailContent, 'function');
  });

  test('exports queryKnowledgeBase function', () => {
    assert.strictEqual(typeof queryKnowledgeBase, 'function');
  });

  test('exports initRAG function', () => {
    assert.strictEqual(typeof initRAG, 'function');
  });
});

// ─── queryKnowledgeBase guard ───────────────────────────────────────

describe('GrokClient queryKnowledgeBase guard', () => {
  test('returns error when RAG not initialized', async () => {
    const result = await queryKnowledgeBase('test query');
    assert.ok(result.error);
    assert.ok(result.error.includes('not initialized'));
  });
});
