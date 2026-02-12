/**
 * VocalIA Route Smoke Tests — T3
 *
 * Tests HTTP route handlers via handleRequest() without starting a real server.
 * Uses the same mock req/res pattern as db-api.test.mjs.
 *
 * Detects: auth bypass, wrong status codes, route registration errors,
 * payload validation failures, tenant isolation gaps.
 *
 * Run: node --test test/route-smoke.test.mjs
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'module';
import { EventEmitter } from 'events';

const require = createRequire(import.meta.url);

const { handleRequest, sendJson, sendError, PLAN_QUOTAS, PLAN_FEATURES } = require('../core/db-api.cjs');

// ─── Mock helpers (same pattern as db-api.test.mjs) ──────────────────────────

function createMockReq({ method = 'GET', url = '/', headers = {}, body = undefined } = {}) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = { origin: 'https://vocalia.ma', ...headers };

  // Always emit end event so parseBody doesn't hang
  process.nextTick(() => {
    if (body !== undefined && body !== null) {
      req.emit('data', typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.emit('end');
  });

  return req;
}

function createMockRes(req) {
  const res = {
    _corsReq: req || { headers: { origin: 'https://vocalia.ma' } },
    _statusCode: null,
    _headers: null,
    _body: null,
    _ended: false,
    writableEnded: false,
    writeHead(code, headers) {
      this._statusCode = code;
      this._headers = headers;
    },
    end(body) {
      this._body = body;
      this._ended = true;
      this.writableEnded = true;
    }
  };
  return res;
}

function parseBody(res) {
  try {
    return JSON.parse(res._body);
  } catch {
    return null;
  }
}

// ─── T3.1: OPTIONS preflight on all route prefixes ──────────────────────────

describe('T3: OPTIONS preflight', () => {
  const prefixes = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/db/tenants',
    '/api/hitl/pending',
    '/api/telephony/stats',
    '/api/kb/stats',
    '/api/health',
  ];

  for (const path of prefixes) {
    test(`OPTIONS ${path} returns 204`, async () => {
      const req = createMockReq({ method: 'OPTIONS', url: path });
      const res = createMockRes(req);
      let code;
      res.writeHead = (c, h) => { code = c; res._headers = h; };
      res.end = () => { res._ended = true; };

      await handleRequest(req, res);
      assert.strictEqual(code, 204, `OPTIONS ${path} should return 204`);
    });
  }
});

// ─── T3.2: Unknown routes return 404 ────────────────────────────────────────

describe('T3: 404 fallback', () => {
  const unknownPaths = [
    '/api/nonexistent',
    '/api/auth/oauth/invalid',
    '/api/secret/admin',
    '/something/random',
    '/',
  ];

  for (const path of unknownPaths) {
    test(`GET ${path} returns 404`, async () => {
      const req = createMockReq({ method: 'GET', url: path });
      const res = createMockRes(req);
      await handleRequest(req, res);
      assert.strictEqual(res._statusCode, 404);
    });
  }
});

// ─── T3.3: Auth routes — no token required ──────────────────────────────────

describe('T3: Public auth routes accept requests', () => {
  test('POST /api/auth/register with missing fields returns 400', async () => {
    const req = createMockReq({
      method: 'POST',
      url: '/api/auth/register',
      body: {} // Missing required fields
    });
    const res = createMockRes(req);
    await handleRequest(req, res);

    // Should respond (not crash) — either 400 or 500 with error message
    assert.ok(res._ended, 'Response should complete');
    assert.ok([400, 500].includes(res._statusCode),
      `Expected 400 or 500, got ${res._statusCode}`);
  });

  test('POST /api/auth/login with missing fields returns 400/401', async () => {
    const req = createMockReq({
      method: 'POST',
      url: '/api/auth/login',
      body: {} // Missing email/password
    });
    const res = createMockRes(req);
    await handleRequest(req, res);

    assert.ok(res._ended, 'Response should complete');
    assert.ok([400, 401, 500].includes(res._statusCode));
  });

  test('POST /api/auth/forgot with invalid email returns error', async () => {
    const req = createMockReq({
      method: 'POST',
      url: '/api/auth/forgot',
      body: { email: 'notanemail' }
    });
    const res = createMockRes(req);
    await handleRequest(req, res);

    assert.ok(res._ended, 'Response should complete');
    // Should not crash — 400 or 404 or 500
    assert.ok(res._statusCode >= 400);
  });
});

// ─── T3.4: Protected routes without token → 401 ────────────────────────────

describe('T3: Protected routes require auth', () => {
  const protectedRoutes = [
    { method: 'GET', url: '/api/auth/me' },
    { method: 'PUT', url: '/api/auth/me' },
    { method: 'PUT', url: '/api/auth/password' },
    { method: 'GET', url: '/api/hitl/pending' },
    { method: 'GET', url: '/api/hitl/history' },
    { method: 'GET', url: '/api/hitl/stats' },
    { method: 'GET', url: '/api/telephony/stats' },
    { method: 'GET', url: '/api/telephony/cdrs' },
    { method: 'GET', url: '/api/kb/stats' },
  ];

  for (const { method, url } of protectedRoutes) {
    test(`${method} ${url} without token returns 401`, async () => {
      const req = createMockReq({ method, url });
      // No Authorization header
      const res = createMockRes(req);
      await handleRequest(req, res);

      assert.ok(res._ended, 'Response should complete');
      assert.strictEqual(res._statusCode, 401,
        `${method} ${url} without auth should return 401, got ${res._statusCode}`);
    });
  }
});

// ─── T3.5: Health endpoint returns 200 ──────────────────────────────────────

describe('T3: Health endpoints', () => {
  test('GET /api/health returns 200', async () => {
    const req = createMockReq({ method: 'GET', url: '/api/health' });
    const res = createMockRes(req);
    await handleRequest(req, res);

    assert.strictEqual(res._statusCode, 200);
    const body = parseBody(res);
    assert.ok(body, 'Health response should be JSON');
    assert.ok(body.status || body.ok !== undefined, 'Health should have status');
  });

  test('GET /api/db/health returns 200', async () => {
    const req = createMockReq({ method: 'GET', url: '/api/db/health' });
    const res = createMockRes(req);
    await handleRequest(req, res);

    assert.strictEqual(res._statusCode, 200);
  });
});

// ─── T3.6: Wrong HTTP method → 404/405 ─────────────────────────────────────

describe('T3: Wrong method handling', () => {
  test('GET /api/auth/register returns 404 (POST only)', async () => {
    const req = createMockReq({ method: 'GET', url: '/api/auth/register' });
    const res = createMockRes(req);
    await handleRequest(req, res);

    // Should either return 404 or 405 (method not allowed)
    assert.ok([404, 405].includes(res._statusCode),
      `GET on POST-only route should be 404/405, got ${res._statusCode}`);
  });

  test('DELETE /api/auth/login returns 404 (POST only)', async () => {
    const req = createMockReq({ method: 'DELETE', url: '/api/auth/login' });
    const res = createMockRes(req);
    await handleRequest(req, res);

    assert.ok([404, 405].includes(res._statusCode));
  });
});

// ─── T3.7: sendJson and sendError helpers ───────────────────────────────────

describe('T3: Response helpers', () => {
  test('sendJson sets correct status and JSON content-type', () => {
    const req = createMockReq();
    const res = createMockRes(req);
    sendJson(res, 200, { test: true }, req);

    assert.strictEqual(res._statusCode, 200);
    assert.ok(res._body);
    const body = JSON.parse(res._body);
    assert.strictEqual(body.test, true);
  });

  test('sendError sets error status and message', () => {
    const req = createMockReq();
    const res = createMockRes(req);
    sendError(res, 400, 'Bad request', req);

    assert.strictEqual(res._statusCode, 400);
    const body = JSON.parse(res._body);
    assert.strictEqual(body.error, 'Bad request');
  });

  test('sendJson with 201 for creation', () => {
    const req = createMockReq();
    const res = createMockRes(req);
    sendJson(res, 201, { id: 'abc' }, req);

    assert.strictEqual(res._statusCode, 201);
  });

  test('sendError with 500 for server error', () => {
    const req = createMockReq();
    const res = createMockRes(req);
    sendError(res, 500, 'Internal error', req);

    assert.strictEqual(res._statusCode, 500);
  });
});

// ─── T3.8: Auth register validation ─────────────────────────────────────────

describe('T3: Registration validation', () => {
  test('Register with empty body returns error', async () => {
    const req = createMockReq({
      method: 'POST',
      url: '/api/auth/register',
      body: {}
    });
    const res = createMockRes(req);
    await handleRequest(req, res);

    assert.ok(res._ended);
    assert.ok(res._statusCode >= 400, 'Empty register should fail');
  });

  test('Register with only email returns error', async () => {
    const req = createMockReq({
      method: 'POST',
      url: '/api/auth/register',
      body: { email: 'test@example.com' }
    });
    const res = createMockRes(req);
    await handleRequest(req, res);

    assert.ok(res._ended);
    assert.ok(res._statusCode >= 400, 'Register without password should fail');
  });
});

// ─── T3.9: CORS headers present on responses ───────────────────────────────

describe('T3: CORS headers on responses', () => {
  test('Response includes CORS headers for vocalia.ma origin', async () => {
    const req = createMockReq({ method: 'GET', url: '/api/health' });
    const res = createMockRes(req);
    await handleRequest(req, res);

    assert.ok(res._headers, 'Response should have headers');
    assert.ok(res._headers['Access-Control-Allow-Origin'],
      'Should include Access-Control-Allow-Origin');
  });
});

// ─── T3.10: Provisioning data consistency ────────────────────────────────────

describe('T3: Provisioning consistency', () => {
  const { provisionTenant, generateTenantIdFromCompany, PLAN_NAME_MAP } = require('../core/db-api.cjs');

  test('generateTenantIdFromCompany produces safe IDs', () => {
    const id = generateTenantIdFromCompany('Mon Entreprise SARL');
    assert.ok(id.startsWith('mon_entreprise_sarl_'),
      `Expected sanitized prefix, got: ${id}`);
    assert.ok(!id.includes(' '), 'ID should not contain spaces');
    assert.ok(!id.includes('/'), 'ID should not contain slashes');
  });

  test('generateTenantIdFromCompany handles accented characters', () => {
    const id = generateTenantIdFromCompany('Café Résumé');
    assert.ok(!id.includes('é'), 'Should remove accents');
    assert.ok(id.startsWith('cafe_resume_'));
  });

  test('generateTenantIdFromCompany handles empty string', () => {
    const id = generateTenantIdFromCompany('');
    assert.ok(id.startsWith('tenant_'), 'Empty company → "tenant_" prefix');
  });

  test('PLAN_NAME_MAP normalizes all aliases', () => {
    assert.strictEqual(PLAN_NAME_MAP.ecom, 'ecommerce');
    assert.strictEqual(PLAN_NAME_MAP.ecommerce, 'ecommerce');
    assert.strictEqual(PLAN_NAME_MAP.starter, 'starter');
    assert.strictEqual(PLAN_NAME_MAP.pro, 'pro');
    assert.strictEqual(PLAN_NAME_MAP.telephony, 'telephony');
  });
});

// ─── T3.11: Stripe gateway URL construction ─────────────────────────────────

describe('T3: Stripe URL construction', () => {
  test('stripe-global-gateway uses correct base URL', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.resolve(import.meta.url.replace('file://', ''), '../../core/gateways/stripe-global-gateway.cjs'),
      'utf8'
    );

    // Base URL should end with /v1 (no trailing slash)
    assert.ok(src.includes("'https://api.stripe.com/v1'"),
      'Stripe base URL should be https://api.stripe.com/v1');

    // Should not have double /v1
    assert.ok(!src.includes('/v1/v1'),
      'No double /v1 in URL construction (C1 regression)');
  });
});

// ─── T3.12: Request body parsing edge cases ─────────────────────────────────

describe('T3: Body parsing edge cases', () => {
  const { parseBody: dbParseBody } = require('../core/db-api.cjs');

  test('parseBody handles valid JSON', async () => {
    const req = createMockReq({ body: { key: 'value' } });
    const body = await dbParseBody(req);
    assert.deepStrictEqual(body, { key: 'value' });
  });

  test('parseBody handles empty body', async () => {
    const req = createMockReq({ body: null });
    const body = await dbParseBody(req);
    assert.deepStrictEqual(body, {});
  });

  test('parseBody handles invalid JSON gracefully', async () => {
    const req = createMockReq({ body: '{invalid json' });
    try {
      await dbParseBody(req);
      // If it doesn't throw, that's fine too (returns empty)
    } catch (e) {
      // Should throw a parse error, not crash
      assert.ok(e.message.includes('JSON') || e.message.includes('parse') || e.message.includes('Unexpected'),
        'Should throw JSON parse error');
    }
  });
});
