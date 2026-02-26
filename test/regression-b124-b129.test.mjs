/**
 * VocalIA Regression Tests — B124-B129
 * Session 250.243
 *
 * These tests verify that the bugs found in session 250.239b are
 * properly fixed AND will catch any regression if the fixes are reverted.
 *
 * B124: getResilisentResponse RAG crash → graceful degradation
 * B125: getResilisentResponse throws on all-providers-fail → returns {success:false}
 * B126: /respond handler returns 503 (not crash) when result.success=false
 * B127: webhook-dispatcher.cjs path traversal in getWebhookConfig
 * B128: voice-telephony-bridge.cjs path traversal sanitization
 * B129: clients/default/config.json has tenant_id field
 *
 * Run: node --test test/regression-b124-b129.test.mjs
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = path.join(import.meta.dirname, '..');

// ─── B124: RAG crash → graceful degradation ─────────────────────────────────

describe('B124: getResilisentResponse survives RAG search failure', () => {
  let getResilisentResponse;

  test('function exists and is callable', () => {
    const voiceApi = require('../core/voice-api-resilient.cjs');
    getResilisentResponse = voiceApi.getResilisentResponse;
    assert.strictEqual(typeof getResilisentResponse, 'function');
  });

  test('returns result (not throws) when RAG search fails internally', async () => {
    // Without API keys, hybridRAG.search() fails → try-catch in production code
    // catches it and sets ragresults = []. Before B124 fix, this threw.
    const result = await getResilisentResponse('Quel est le prix ?', [], null, 'fr');
    assert.ok(result !== undefined && result !== null,
      'B124 regression: getResilisentResponse threw instead of returning result');
    assert.strictEqual(typeof result, 'object', 'must return an object');
  });

  test('source code has try-catch around hybridRAG.search()', () => {
    const src = fs.readFileSync(path.join(ROOT, 'core', 'voice-api-resilient.cjs'), 'utf8');
    // The B124 fix wraps hybridRAG.search() in try-catch with ragresults = [] fallback
    const hasRagTryCatch = src.includes('RAG search failed, degrading gracefully');
    assert.ok(hasRagTryCatch,
      'B124 regression: try-catch around hybridRAG.search() was removed');
  });
});

// ─── B125: All providers fail → {success:false} not throw ───────────────────

describe('B125: getResilisentResponse returns {success:false} on total failure', () => {
  test('force-fail all providers → returns object with success:false', async () => {
    const { getResilisentResponse } = require('../core/voice-api-resilient.cjs');
    const result = await getResilisentResponse(
      'Test',
      [],
      null,
      'fr',
      { forceFailProviders: ['grok', 'gemini', 'anthropic'] }
    );
    assert.ok(result, 'B125 regression: function threw instead of returning');
    assert.strictEqual(result.success, false,
      'B125 regression: should return {success: false} when all providers fail');
    assert.ok(result.error || result.errors,
      'failure result must include error information');
  });
});

// ─── B126: /respond handler 503 on all-providers-fail ────────────────────────

describe('B126: /respond route handler checks result.success before accessing result.response', () => {
  test('source code has early-return with 503 when result.success is false', () => {
    const src = fs.readFileSync(path.join(ROOT, 'core', 'voice-api-resilient.cjs'), 'utf8');

    // The B126 fix adds: if (!result.success) { ... sendJson(res, errorResponse, 503); return; }
    // Find the /respond handler section
    const respondHandlerIdx = src.indexOf("req.url === '/respond'");
    assert.ok(respondHandlerIdx > -1, '/respond handler must exist');

    // Look for the B126 fix pattern — the handler is large, search a wider range
    const afterHandler = src.slice(respondHandlerIdx, respondHandlerIdx + 12000);
    const hasSuccessCheck = afterHandler.includes('!result.success') || afterHandler.includes('result.success === false');
    assert.ok(hasSuccessCheck,
      'B126 regression: /respond handler must check result.success before accessing result.response');

    const has503 = afterHandler.includes('503');
    assert.ok(has503,
      'B126 regression: /respond handler must return 503 when all providers fail');
  });

  test('the 503 response includes a user-facing error message', () => {
    const src = fs.readFileSync(path.join(ROOT, 'core', 'voice-api-resilient.cjs'), 'utf8');
    const respondIdx = src.indexOf("req.url === '/respond'");
    assert.ok(respondIdx > -1, '/respond handler must exist');
    const section = src.slice(respondIdx, respondIdx + 12000);

    // The B126 fix provides localized error messages
    const hasFrMessage = section.includes('temporairement indisponible') || section.includes('indisponible');
    const hasEnMessage = section.includes('temporarily unavailable') || section.includes('unavailable');
    assert.ok(hasFrMessage || hasEnMessage,
      'B126 regression: 503 response must include user-facing error message');
  });
});

// ─── B127: webhook-dispatcher.cjs path traversal ────────────────────────────

describe('B127: webhook-dispatcher path traversal prevention (BEHAVIORAL)', () => {
  let getWebhookConfig;

  test('loads webhook-dispatcher module', async () => {
    const mod = await import('../core/webhook-dispatcher.cjs');
    getWebhookConfig = (mod.default || mod).getWebhookConfig;
    assert.strictEqual(typeof getWebhookConfig, 'function');
  });

  test('path traversal in tenantId is neutralized — ../../etc/passwd', () => {
    // Before B127 fix: getWebhookConfig('../../../etc/passwd') would read /etc/passwd
    // After fix: safeTenantId strips all non-alphanumeric except _ and -
    const result = getWebhookConfig('../../../etc/passwd');
    // Must return null (no config found for sanitized ID) — NOT read /etc/passwd
    assert.strictEqual(result, null,
      'B127 regression: path traversal must be blocked');
  });

  test('path traversal with URL encoding is neutralized', () => {
    const result = getWebhookConfig('..%2F..%2F..%2Fetc%2Fpasswd');
    assert.strictEqual(result, null);
  });

  test('null bytes in tenantId are neutralized', () => {
    const result = getWebhookConfig('tenant\0../../etc/passwd');
    assert.strictEqual(result, null);
  });

  test('source code uses .replace(/[^a-zA-Z0-9_-]/g) before path.join', () => {
    const src = fs.readFileSync(path.join(ROOT, 'core', 'webhook-dispatcher.cjs'), 'utf8');
    const pathJoinIdx = src.indexOf("path.join(__dirname, '..', 'clients'");
    assert.ok(pathJoinIdx > -1, 'path.join for clients dir must exist');

    // The sanitization MUST appear BEFORE the path.join
    const beforePathJoin = src.slice(Math.max(0, pathJoinIdx - 200), pathJoinIdx);
    const hasSanitize = beforePathJoin.includes('.replace(/[^a-zA-Z0-9_-]/g');
    assert.ok(hasSanitize,
      'B127 regression: tenantId sanitization must appear before path.join');
  });
});

// ─── B128: voice-telephony-bridge.cjs path traversal ────────────────────────

describe('B128: telephony bridge path traversal prevention', () => {
  test('recording-status handler sanitizes tenantId from query params', () => {
    const src = fs.readFileSync(path.join(ROOT, 'telephony', 'voice-telephony-bridge.cjs'), 'utf8');

    // Find the recording-status handler
    const recordingIdx = src.indexOf("'/recording-status'");
    assert.ok(recordingIdx > -1, 'recording-status handler must exist');

    // Check that tenantId is sanitized within 5 lines of extraction from query params
    const section = src.slice(recordingIdx, recordingIdx + 500);
    const hasTenantSanitize = section.includes("tenantId') || '').replace(/[^a-zA-Z0-9_-]/g");
    assert.ok(hasTenantSanitize,
      'B128 regression: tenantId in recording-status must be sanitized');

    // Also check sessionId is sanitized
    const hasSessionSanitize = section.includes("sessionId') || '').replace(/[^a-zA-Z0-9_-]/g");
    assert.ok(hasSessionSanitize,
      'B128 regression: sessionId in recording-status must be sanitized');
  });

  test('outbound call handler sanitizes tenantId (line ~4217)', () => {
    const src = fs.readFileSync(path.join(ROOT, 'telephony', 'voice-telephony-bridge.cjs'), 'utf8');

    // Find the outbound handler section where tenantId is used with path.join
    // The B128 fix is at line ~4217: safeTenantId = (tenantId || '').replace(...)
    const outboundPathJoin = src.indexOf("const tenantConfigPath = path.join(__dirname, '..', 'clients'");
    if (outboundPathJoin > -1) {
      const before = src.slice(Math.max(0, outboundPathJoin - 300), outboundPathJoin);
      const hasSafe = before.includes('safeTenantId') || before.includes('.replace(/[^a-zA-Z0-9_-]/g');
      assert.ok(hasSafe,
        'B128 regression: outbound handler must sanitize tenantId before path.join');
    }
  });

  test('validateOrigin handler sanitizes tenantId', () => {
    const src = fs.readFileSync(path.join(ROOT, 'telephony', 'voice-telephony-bridge.cjs'), 'utf8');

    // Find the section around line 2019 where tenantId is validated
    const validateIdx = src.indexOf('safeTenantId = tenantId.replace');
    assert.ok(validateIdx > -1,
      'B128 regression: validateOrigin section must sanitize tenantId');
  });
});

// ─── B129: clients/default/config.json has tenant_id ────────────────────────

describe('B129: default client config has tenant_id field', () => {
  test('config.json exists and has tenant_id', () => {
    const configPath = path.join(ROOT, 'clients', 'default', 'config.json');
    assert.ok(fs.existsSync(configPath), 'clients/default/config.json must exist');

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.ok(config.tenant_id,
      'B129 regression: clients/default/config.json must have tenant_id field');
    assert.strictEqual(config.tenant_id, 'default',
      'default config tenant_id must be "default"');
  });
});

// ─── Cross-cutting: All path.join(tenantId) in production code are sanitized ─

describe('Global path traversal guard (catches future regressions)', () => {
  const productionDirs = ['core', 'telephony', 'integrations', 'sensors'];

  for (const dir of productionDirs) {
    const dirPath = path.join(ROOT, dir);
    if (!fs.existsSync(dirPath)) continue;

    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.cjs') || f.endsWith('.js'));

    for (const file of files) {
      test(`${dir}/${file} — path.join with tenantId is sanitized`, () => {
        const src = fs.readFileSync(path.join(dirPath, file), 'utf8');
        const lines = src.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // Skip comments
          if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

          if (line.includes('path.join') && line.includes('tenantId') &&
              !line.includes('sanitizeTenantId') && !line.includes('safeTId') &&
              !line.includes('safeTenantId') && !line.includes('sanitizedId') &&
              !line.includes('this.getTenantDir') && !line.includes('getTenantDir')) {
            const contextAbove = lines.slice(Math.max(0, i - 10), i).join('\n');
            const hasSanitize = contextAbove.includes('sanitizeTenantId') ||
                                contextAbove.includes('safeTId') ||
                                contextAbove.includes('safeTenantId') ||
                                contextAbove.includes('.replace(/[^a-zA-Z0-9_-]/g');
            assert.ok(hasSanitize,
              `${dir}/${file}:${i + 1} — path.join with raw tenantId (no sanitization within 10 lines above).\n  Line: ${line.trim()}`);
          }
        }
      });
    }
  }
});
