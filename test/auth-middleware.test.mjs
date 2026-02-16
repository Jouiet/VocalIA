/**
 * VocalIA AuthMiddleware Tests
 *
 * Tests:
 * - extractToken (Bearer parsing)
 * - sendError (response formatting)
 * - requireRole (role-based access)
 * - requirePermission (permission-based access)
 * - requireTenant (tenant isolation)
 * - requireAdmin (admin shortcut)
 * - requireVerifiedEmail
 * - rateLimit (in-memory rate limiting)
 * - corsMiddleware (CORS headers)
 * - cleanupRateLimits
 *
 * NOTE: Uses mock req/res objects. No real HTTP server needed.
 *
 * Run: node --test test/auth-middleware.test.mjs
 */


import { test, describe } from 'node:test';
import assert from 'node:assert';
import { extractToken, sendError, requireAuth, optionalAuth, requireRole, requirePermission, requireTenant, requireAdmin, requireVerifiedEmail, rateLimit, corsMiddleware, cleanupRateLimits } from '../core/auth-middleware.cjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);


// Mock response object
function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(key, value) { this.headers[key] = value; },
    writeHead(status, headers) {
      this.statusCode = status;
      Object.assign(this.headers, headers || {});
    },
    end(data) { this.body = data; }
  };
  return res;
}

// ─── extractToken ──────────────────────────────────────────────────

describe('extractToken', () => {
  test('extracts Bearer token from Authorization header', () => {
    const req = { headers: { authorization: 'Bearer abc123' } };
    assert.strictEqual(extractToken(req), 'abc123');
  });

  test('returns null when no Authorization header', () => {
    const req = { headers: {} };
    assert.strictEqual(extractToken(req), null);
  });

  test('returns null when no headers', () => {
    const req = {};
    assert.strictEqual(extractToken(req), null);
  });

  test('returns null for non-Bearer auth', () => {
    const req = { headers: { authorization: 'Basic dXNlcjpwYXNz' } };
    assert.strictEqual(extractToken(req), null);
  });

  test('handles capital Authorization header', () => {
    const req = { headers: { Authorization: 'Bearer xyz789' } };
    assert.strictEqual(extractToken(req), 'xyz789');
  });

  test('handles empty Bearer token', () => {
    const req = { headers: { authorization: 'Bearer ' } };
    assert.strictEqual(extractToken(req), '');
  });
});

// ─── sendError ─────────────────────────────────────────────────────

describe('sendError', () => {
  test('sends JSON error response with status', () => {
    const res = createMockRes();
    sendError(res, 401, 'Unauthorized', 'AUTH_REQUIRED');

    assert.strictEqual(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.error, 'Unauthorized');
    assert.strictEqual(body.code, 'AUTH_REQUIRED');
    assert.strictEqual(body.status, 401);
    assert.ok(body.timestamp);
  });

  test('defaults code to ERROR', () => {
    const res = createMockRes();
    sendError(res, 500, 'Server error');

    const body = JSON.parse(res.body);
    assert.strictEqual(body.code, 'ERROR');
  });

  test('sets Content-Type to application/json', () => {
    const res = createMockRes();
    sendError(res, 400, 'Bad request');

    assert.strictEqual(res.headers['Content-Type'], 'application/json');
  });
});

// ─── requireRole ───────────────────────────────────────────────────

describe('requireRole', () => {
  test('calls next() when user has allowed role', () => {
    const middleware = requireRole(['admin', 'user']);
    const req = { user: { role: 'admin' } };
    const res = createMockRes();
    let nextCalled = false;

    middleware(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true);
  });

  test('sends 403 when user has wrong role', () => {
    const middleware = requireRole(['admin']);
    const req = { user: { role: 'viewer' } };
    const res = createMockRes();
    let nextCalled = false;

    middleware(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 403);
  });

  test('sends 401 when no user on request', () => {
    const middleware = requireRole(['admin']);
    const req = {};
    const res = createMockRes();
    let nextCalled = false;

    middleware(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 401);
  });
});

// ─── requirePermission ─────────────────────────────────────────────

describe('requirePermission', () => {
  test('calls next() when user has all required permissions', () => {
    const middleware = requirePermission(['read:calls', 'write:calls']);
    const req = { user: { permissions: ['read:calls', 'write:calls', 'read:agents'] } };
    const res = createMockRes();
    let nextCalled = false;

    middleware(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true);
  });

  test('sends 403 when user missing permission', () => {
    const middleware = requirePermission(['admin:system']);
    const req = { user: { permissions: ['read:calls'] } };
    const res = createMockRes();
    let nextCalled = false;

    middleware(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 403);
  });

  test('sends 401 when no user', () => {
    const middleware = requirePermission(['read:calls']);
    const req = {};
    const res = createMockRes();
    let nextCalled = false;

    middleware(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 401);
  });
});

// ─── requireTenant ─────────────────────────────────────────────────

describe('requireTenant', () => {
  test('admin bypasses tenant check', () => {
    const req = { user: { role: 'admin', tenant_id: 'any' }, params: { tenantId: 'other' } };
    const res = createMockRes();
    let nextCalled = false;

    requireTenant(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true);
  });

  test('user can access own tenant', () => {
    const req = {
      user: { role: 'user', tenant_id: 'tenant_1' },
      params: { tenantId: 'tenant_1' },
      query: {},
      body: {}
    };
    const res = createMockRes();
    let nextCalled = false;

    requireTenant(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true);
    assert.strictEqual(req.tenantFilter, 'tenant_1');
  });

  test('user cannot access other tenant', () => {
    const req = {
      user: { role: 'user', tenant_id: 'tenant_1' },
      params: { tenantId: 'tenant_2' },
      query: {},
      body: {}
    };
    const res = createMockRes();
    let nextCalled = false;

    requireTenant(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 403);
  });

  test('sets tenantFilter when no specific tenant requested', () => {
    const req = {
      user: { role: 'user', tenant_id: 'my_tenant' },
      params: {},
      query: {},
      body: {}
    };
    const res = createMockRes();
    let nextCalled = false;

    requireTenant(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true);
    assert.strictEqual(req.tenantFilter, 'my_tenant');
  });

  test('sends 401 when no user', () => {
    const req = { params: {} };
    const res = createMockRes();
    let nextCalled = false;

    requireTenant(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 401);
  });
});

// ─── requireAdmin ──────────────────────────────────────────────────

describe('requireAdmin', () => {
  test('allows admin', () => {
    const req = { user: { role: 'admin' } };
    const res = createMockRes();
    let nextCalled = false;

    requireAdmin(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true);
  });

  test('rejects non-admin', () => {
    const req = { user: { role: 'user' } };
    const res = createMockRes();
    let nextCalled = false;

    requireAdmin(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 403);
  });

  test('rejects when no user', () => {
    const req = {};
    const res = createMockRes();

    requireAdmin(req, res, () => {});
    assert.strictEqual(res.statusCode, 401);
  });
});

// ─── requireVerifiedEmail ──────────────────────────────────────────

describe('requireVerifiedEmail', () => {
  test('allows verified user', () => {
    const req = { user: { email_verified: true } };
    const res = createMockRes();
    let nextCalled = false;

    requireVerifiedEmail(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true);
  });

  test('rejects unverified user', () => {
    const req = { user: { email_verified: false } };
    const res = createMockRes();
    let nextCalled = false;

    requireVerifiedEmail(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 403);
  });

  test('rejects when no user', () => {
    const req = {};
    const res = createMockRes();

    requireVerifiedEmail(req, res, () => {});
    assert.strictEqual(res.statusCode, 401);
  });
});

// ─── rateLimit ─────────────────────────────────────────────────────

describe('rateLimit middleware', () => {
  test('allows requests within limit', () => {
    const middleware = rateLimit({ windowMs: 60000, max: 5 });
    const req = { headers: { 'x-forwarded-for': '192.168.1.100' }, socket: {} };
    const res = createMockRes();
    let nextCalled = false;

    middleware(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true);
    assert.strictEqual(res.headers['X-RateLimit-Limit'], 5);
    assert.ok(res.headers['X-RateLimit-Remaining'] >= 0);
  });

  test('blocks requests over limit', () => {
    const middleware = rateLimit({ windowMs: 60000, max: 2 });
    const ip = `test-rate-${Date.now()}`;
    const req = { headers: { 'x-forwarded-for': ip }, socket: {} };

    // Request 1 (ok)
    const res1 = createMockRes();
    middleware(req, res1, () => {});

    // Request 2 (ok)
    const res2 = createMockRes();
    middleware(req, res2, () => {});

    // Request 3 (blocked)
    const res3 = createMockRes();
    let nextCalled = false;
    middleware(req, res3, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res3.statusCode, 429);
    assert.ok(res3.headers['Retry-After']);
  });

  test('uses custom keyGenerator', () => {
    const middleware = rateLimit({
      windowMs: 60000,
      max: 100,
      keyGenerator: (req) => `custom-${req.customKey}`
    });

    const req = { customKey: 'abc', headers: {}, socket: {} };
    const res = createMockRes();
    let nextCalled = false;

    middleware(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true);
  });
});

// ─── cleanupRateLimits ─────────────────────────────────────────────

describe('cleanupRateLimits', () => {
  test('runs without error', () => {
    assert.doesNotThrow(() => cleanupRateLimits());
  });
});

// ─── corsMiddleware ────────────────────────────────────────────────

describe('corsMiddleware', () => {
  test('sets CORS headers for allowed origin', () => {
    const middleware = corsMiddleware(['https://vocalia.ma']);
    const req = { headers: { origin: 'https://vocalia.ma' }, method: 'GET' };
    const res = createMockRes();
    let nextCalled = false;

    middleware(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true);
    assert.strictEqual(res.headers['Access-Control-Allow-Origin'], 'https://vocalia.ma');
    assert.ok(res.headers['Access-Control-Allow-Methods']);
    assert.ok(res.headers['Access-Control-Allow-Headers']);
  });

  test('handles OPTIONS preflight', () => {
    const middleware = corsMiddleware(['*']);
    const req = { headers: { origin: 'https://any.com' }, method: 'OPTIONS' };
    const res = createMockRes();
    let nextCalled = false;

    middleware(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 204);
  });

  test('wildcard allows any origin', () => {
    const middleware = corsMiddleware(['*']);
    const req = { headers: { origin: 'https://random.com' }, method: 'GET' };
    const res = createMockRes();
    let nextCalled = false;

    middleware(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true);
    assert.strictEqual(res.headers['Access-Control-Allow-Origin'], 'https://random.com');
  });

  test('sets Allow-Credentials header', () => {
    const middleware = corsMiddleware(['*']);
    const req = { headers: {}, method: 'GET' };
    const res = createMockRes();

    middleware(req, res, () => {});
    assert.strictEqual(res.headers['Access-Control-Allow-Credentials'], 'true');
  });
});

// ─── requireAuth ─────────────────────────────────────────────────────

describe('requireAuth middleware', () => {
  test('valid token → attaches user + calls next()', async () => {
    const authService = require('../core/auth-service.cjs');
    const origVerify = authService.verifyAccessToken;
    authService.verifyAccessToken = async () => ({ id: 'u1', role: 'user', email: 'test@test.com' });

    const req = { headers: { authorization: 'Bearer valid_token_123' } };
    const res = createMockRes();
    let nextCalled = false;

    try {
      await requireAuth(req, res, () => { nextCalled = true; });
      assert.strictEqual(nextCalled, true);
      assert.strictEqual(req.user.id, 'u1');
      assert.strictEqual(req.token, 'valid_token_123');
    } finally {
      authService.verifyAccessToken = origVerify;
    }
  });

  test('no token → 401 MISSING_TOKEN', async () => {
    const req = { headers: {} };
    const res = createMockRes();
    let nextCalled = false;

    await requireAuth(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.code, 'MISSING_TOKEN');
  });

  test('invalid token → 401 INVALID_TOKEN', async () => {
    const authService = require('../core/auth-service.cjs');
    const origVerify = authService.verifyAccessToken;
    authService.verifyAccessToken = async () => { throw new Error('jwt expired'); };

    const req = { headers: { authorization: 'Bearer expired_token' } };
    const res = createMockRes();
    let nextCalled = false;

    try {
      await requireAuth(req, res, () => { nextCalled = true; });
      assert.strictEqual(nextCalled, false);
      assert.strictEqual(res.statusCode, 401);
    } finally {
      authService.verifyAccessToken = origVerify;
    }
  });
});

// ─── optionalAuth ────────────────────────────────────────────────────

describe('optionalAuth middleware', () => {
  test('valid token → attaches user + calls next()', async () => {
    const authService = require('../core/auth-service.cjs');
    const origVerify = authService.verifyAccessToken;
    authService.verifyAccessToken = async () => ({ id: 'u1', role: 'user' });

    const req = { headers: { authorization: 'Bearer valid_token' } };
    const res = createMockRes();
    let nextCalled = false;

    try {
      await optionalAuth(req, res, () => { nextCalled = true; });
      assert.strictEqual(nextCalled, true);
      assert.strictEqual(req.user.id, 'u1');
    } finally {
      authService.verifyAccessToken = origVerify;
    }
  });

  test('no token → calls next() without user', async () => {
    const req = { headers: {} };
    const res = createMockRes();
    let nextCalled = false;

    await optionalAuth(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true);
    assert.strictEqual(req.user, undefined);
  });

  test('invalid token → calls next() without user (no error)', async () => {
    const authService = require('../core/auth-service.cjs');
    const origVerify = authService.verifyAccessToken;
    authService.verifyAccessToken = async () => { throw new Error('invalid'); };

    const req = { headers: { authorization: 'Bearer bad_token' } };
    const res = createMockRes();
    let nextCalled = false;

    try {
      await optionalAuth(req, res, () => { nextCalled = true; });
      assert.strictEqual(nextCalled, true);
      assert.strictEqual(req.user, undefined);
    } finally {
      authService.verifyAccessToken = origVerify;
    }
  });
});
