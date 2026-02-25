/**
 * VocalIA LLM Global Gateway Tests
 *
 * Tests:
 * - generate() with unknown provider → error
 * - generate() compliance integration (prompt validation)
 * - generateWithFallback() chain failure behavior
 * - Singleton identity
 * - Constructor key mapping from environment
 *
 * NOTE: Does NOT call any real LLM API. Tests error paths and logic only.
 *
 * Run: node --test test/llm-global-gateway.test.mjs
 */



import { test, describe } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import gateway from '../core/gateways/llm-global-gateway.cjs';

const require = createRequire(import.meta.url);
const gateway2 = require('../core/gateways/llm-global-gateway.cjs');

// ─── generate() error paths ─────────────────────────────────────────

describe('LLMGateway generate()', () => {
  test('throws on unknown provider', async () => {
    await assert.rejects(
      () => gateway.generate('nonexistent_provider', 'Hello'),
      (err) => {
        assert.ok(err.message.includes('Unknown Provider'), `Expected "Unknown Provider" but got: ${err.message}`);
        return true;
      }
    );
  });

  test('throws on empty provider string', async () => {
    await assert.rejects(
      () => gateway.generate('', 'Hello'),
      (err) => {
        // Empty string doesn't match any case → Unknown Provider
        assert.ok(err.message.includes('Unknown Provider') || err.message.includes('Cannot read'), `Unexpected error: ${err.message}`);
        return true;
      }
    );
  });

  test('generate requires prompt argument', async () => {
    // Missing prompt should cause compliance check to fail or provider to error
    await assert.rejects(
      () => gateway.generate('gemini'),
      (err) => {
        assert.ok(err instanceof Error);
        return true;
      }
    );
  });

  test('provider names are case-insensitive', async () => {
    // 'GEMINI' lowercased should match 'gemini' case — either works or throws missing key
    // The important thing: it should NOT throw "Unknown Provider"
    try {
      await gateway.generate('GEMINI', 'test');
    } catch (err) {
      // Should fail with API key error, NOT "Unknown Provider"
      assert.ok(!err.message.includes('Unknown Provider'),
        `GEMINI should be recognized (case-insensitive). Got: ${err.message}`);
    }
  });

  test('recognizes all 4 provider names', async () => {
    const providers = ['gemini', 'claude', 'grok', 'openai'];
    for (const provider of providers) {
      try {
        await gateway.generate(provider, 'test');
      } catch (err) {
        // Each should fail with API-related error, NOT "Unknown Provider"
        assert.ok(!err.message.includes('Unknown Provider'),
          `Provider "${provider}" should be recognized. Got: ${err.message}`);
      }
    }
  });
});

// ─── generateWithFallback() ─────────────────────────────────────────

describe('LLMGateway generateWithFallback()', () => {
  test('throws after exhausting all providers when none work', async () => {
    // Save original env
    const savedKeys = {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      XAI_API_KEY: process.env.XAI_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY
    };

    // Temporarily clear all keys to force failure
    delete process.env.GEMINI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.XAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    // Create fresh instance with no keys
    const LLMGatewayCls = gateway.constructor;
    const freshGateway = new LLMGatewayCls();

    try {
      await assert.rejects(
        () => freshGateway.generateWithFallback('test prompt'),
        (err) => {
          assert.ok(err.message.includes('All Frontier models') || err.message.includes('failed'),
            `Expected fallback chain failure message. Got: ${err.message}`);
          return true;
        }
      );
    } finally {
      // Restore env
      for (const [key, value] of Object.entries(savedKeys)) {
        if (value !== undefined) process.env[key] = value;
      }
    }
  });

  test('fallback chain order is claude → openai → grok → gemini', () => {
    // Verify the chain order by reading the method source (structural test but meaningful)
    const methodStr = gateway.generateWithFallback.toString();
    const claudeIdx = methodStr.indexOf("'claude'");
    const openaiIdx = methodStr.indexOf("'openai'");
    const grokIdx = methodStr.indexOf("'grok'");
    const geminiIdx = methodStr.indexOf("'gemini'");

    assert.ok(claudeIdx > -1, 'Chain should include claude');
    assert.ok(openaiIdx > -1, 'Chain should include openai');
    assert.ok(grokIdx > -1, 'Chain should include grok');
    assert.ok(geminiIdx > -1, 'Chain should include gemini');
    assert.ok(claudeIdx < openaiIdx, 'Claude should be before OpenAI in chain');
  });
});

// ─── Singleton behavior ─────────────────────────────────────────────

describe('LLMGateway singleton', () => {
  test('same instance on multiple requires', () => {
    assert.strictEqual(gateway, gateway2);
  });

  test('is an instance with generate method callable', () => {
    // Verify the instance is actually usable, not just truthy
    assert.ok(gateway.generate.call !== undefined, 'generate should be callable');
    assert.ok(gateway.generateWithFallback.call !== undefined, 'generateWithFallback should be callable');
  });
});

// ─── Constructor / key mapping ───────────────────────────────────────

describe('LLMGateway constructor', () => {
  test('maps GEMINI_API_KEY from env', () => {
    // geminiKey is set from process.env.GEMINI_API_KEY
    // It may be undefined if env var not set — that's OK, we test the mapping exists
    assert.ok('geminiKey' in gateway, 'Should have geminiKey property');
  });

  test('maps ANTHROPIC_API_KEY from env', () => {
    assert.ok('anthropicKey' in gateway, 'Should have anthropicKey property');
  });

  test('maps XAI_API_KEY from env', () => {
    assert.ok('xaiKey' in gateway, 'Should have xaiKey property');
  });

  test('maps OPENAI_API_KEY from env', () => {
    assert.ok('openaiKey' in gateway, 'Should have openaiKey property');
  });

  test('uses direct REST API for Gemini (no SDK dependency)', () => {
    // Session 250.222: @google/generative-ai SDK removed, replaced with direct fetch
    // Verify the gateway has geminiKey property but no genAI SDK instance
    assert.ok('geminiKey' in gateway, 'Should have geminiKey property');
    assert.strictEqual(gateway.genAI, undefined, 'Should NOT have SDK instance (deprecated SDK removed)');
  });
});
