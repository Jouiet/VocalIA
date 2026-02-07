'use strict';

/**
 * VocalIA LLM Global Gateway Tests
 *
 * Tests:
 * - Module loads (singleton instance)
 * - API key properties exist
 * - Class structure (generate, generateWithFallback, private methods)
 *
 * NOTE: Does NOT call any LLM API. Tests class structure only.
 *
 * Run: node --test test/llm-global-gateway.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const gateway = require('../core/gateways/llm-global-gateway.cjs');

// ─── Module Load ────────────────────────────────────────────────────────────

describe('LLMGateway module load', () => {
  test('loads as singleton instance', () => {
    assert.ok(gateway);
    assert.strictEqual(typeof gateway, 'object');
  });

  test('has geminiKey property', () => {
    assert.ok('geminiKey' in gateway);
  });

  test('has anthropicKey property', () => {
    assert.ok('anthropicKey' in gateway);
  });

  test('has xaiKey property', () => {
    assert.ok('xaiKey' in gateway);
  });

  test('has openaiKey property', () => {
    assert.ok('openaiKey' in gateway);
  });
});

// ─── Class Methods ──────────────────────────────────────────────────────────

describe('LLMGateway methods', () => {
  test('has generate method', () => {
    assert.strictEqual(typeof gateway.generate, 'function');
  });

  test('has generateWithFallback method', () => {
    assert.strictEqual(typeof gateway.generateWithFallback, 'function');
  });

  test('has _generateGemini method', () => {
    assert.strictEqual(typeof gateway._generateGemini, 'function');
  });

  test('has _fetchClaude method', () => {
    assert.strictEqual(typeof gateway._fetchClaude, 'function');
  });

  test('has _fetchGrok method', () => {
    assert.strictEqual(typeof gateway._fetchGrok, 'function');
  });

  test('has _fetchOpenAI method', () => {
    assert.strictEqual(typeof gateway._fetchOpenAI, 'function');
  });

  test('has _handleFetchResponse method', () => {
    assert.strictEqual(typeof gateway._handleFetchResponse, 'function');
  });
});

// ─── Singleton behavior ─────────────────────────────────────────────────────

describe('LLMGateway singleton', () => {
  test('same instance on multiple requires', () => {
    const gateway2 = require('../core/gateways/llm-global-gateway.cjs');
    assert.strictEqual(gateway, gateway2);
  });
});
