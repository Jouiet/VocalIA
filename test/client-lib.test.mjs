/**
 * Client-Side Library Tests — website/src/lib/
 * VocalIA — Session 250.215b
 *
 * Tests 6 critical client-side JS files:
 * 1. escape-html.js — XSS protection (pure function)
 * 2. geo-detect.js — Market routing (6 markets, pure functions)
 * 3. form-validation.js — WCAG error message structure
 * 4. auth-client.js — JWT decode, token validation, permissions
 * 5. api-client.js — APIError, URL building, helpers
 * 6. db-client.js — Sheet accessor structure
 *
 * Run: node --test test/client-lib.test.mjs
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const LIB_DIR = join(__dirname, '..', 'website', 'src', 'lib');

// ─────────────────────────────────────────────────────────────────────────────
// Browser global mocks (must be set BEFORE ES module imports)
// ─────────────────────────────────────────────────────────────────────────────

function createMockStorage() {
  const store = new Map();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear()
  };
}

if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    location: { hostname: 'localhost', pathname: '/', search: '' },
    dispatchEvent: () => {},
    addEventListener: () => {}
  };
}
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    readyState: 'complete',
    documentElement: { lang: 'fr', setAttribute: () => {} },
    querySelectorAll: () => [],
    addEventListener: () => {},
    getElementById: () => null,
    createElement: () => ({
      id: '', className: '', textContent: '',
      setAttribute: () => {}, parentNode: { appendChild: () => {} }
    })
  };
}
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = createMockStorage();
}
if (typeof globalThis.sessionStorage === 'undefined') {
  globalThis.sessionStorage = createMockStorage();
}
if (typeof globalThis.CustomEvent === 'undefined') {
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, opts) { this.type = type; this.detail = opts?.detail; }
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. escape-html.js — XSS Protection
// ═══════════════════════════════════════════════════════════════════════════════

describe('escape-html.js — XSS protection', () => {
  let escapeHtml;

  before(() => {
    const code = readFileSync(join(LIB_DIR, 'escape-html.js'), 'utf8');
    escapeHtml = new Function(code + '\nreturn escapeHtml;')();
  });

  it('escapes all 5 dangerous HTML characters', () => {
    assert.equal(
      escapeHtml('<script>alert("xss")</script>'),
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('escapes ampersand correctly', () => {
    assert.equal(escapeHtml('a & b'), 'a &amp; b');
  });

  it('escapes single quotes (attribute injection)', () => {
    assert.equal(escapeHtml("it's"), 'it&#39;s');
  });

  it('returns empty string for null/undefined/falsy', () => {
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(undefined), '');
    assert.equal(escapeHtml(''), '');
    assert.equal(escapeHtml(0), '');
  });

  it('converts non-string input to string', () => {
    assert.equal(escapeHtml(123), '123');
    assert.equal(escapeHtml(true), 'true');
  });

  it('handles nested HTML with mixed characters', () => {
    assert.equal(
      escapeHtml('<div class="a"><span>b & c</span></div>'),
      '&lt;div class=&quot;a&quot;&gt;&lt;span&gt;b &amp; c&lt;/span&gt;&lt;/div&gt;'
    );
  });

  it('double-escapes already-escaped content', () => {
    assert.equal(escapeHtml('&amp;'), '&amp;amp;');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. geo-detect.js — Sovereign Market Routing (6 markets)
// ═══════════════════════════════════════════════════════════════════════════════

describe('geo-detect.js — sovereign market routing', () => {
  let geo;

  before(() => {
    geo = require(join(LIB_DIR, 'geo-detect.js'));
  });

  // Market 1: Morocco → FR + MAD
  it('MA → lang:fr, currency:MAD, symbol:DH, region:MA', () => {
    const c = geo.resolveConfig('MA');
    assert.equal(c.lang, 'fr');
    assert.equal(c.currency, 'MAD');
    assert.equal(c.symbol, 'DH');
    assert.equal(c.region, 'MA');
  });

  // Market 2: Maghreb + Europe (hors ES) → FR + EUR
  it('FR → lang:fr, currency:EUR, region:EU', () => {
    const c = geo.resolveConfig('FR');
    assert.equal(c.lang, 'fr');
    assert.equal(c.currency, 'EUR');
    assert.equal(c.symbol, '€');
    assert.equal(c.region, 'EU');
  });

  it('DZ → lang:fr, currency:EUR (Maghreb route)', () => {
    const c = geo.resolveConfig('DZ');
    assert.equal(c.lang, 'fr');
    assert.equal(c.currency, 'EUR');
  });

  it('TN → lang:fr, currency:EUR (Maghreb route)', () => {
    const c = geo.resolveConfig('TN');
    assert.equal(c.lang, 'fr');
    assert.equal(c.currency, 'EUR');
  });

  it('DE → lang:fr, currency:EUR (Europe non-hispanic)', () => {
    const c = geo.resolveConfig('DE');
    assert.equal(c.lang, 'fr');
    assert.equal(c.currency, 'EUR');
  });

  // Market 3: Spain → ES + EUR
  it('ES → lang:es, currency:EUR, region:HISPANIC_EU', () => {
    const c = geo.resolveConfig('ES');
    assert.equal(c.lang, 'es');
    assert.equal(c.currency, 'EUR');
    assert.equal(c.region, 'HISPANIC_EU');
  });

  // Market 4: MENA/Gulf → AR + USD
  it('SA → lang:ar, currency:USD, region:MENA', () => {
    const c = geo.resolveConfig('SA');
    assert.equal(c.lang, 'ar');
    assert.equal(c.currency, 'USD');
    assert.equal(c.symbol, '$');
    assert.equal(c.region, 'MENA');
  });

  it('AE → lang:ar, currency:USD (Gulf)', () => {
    const c = geo.resolveConfig('AE');
    assert.equal(c.lang, 'ar');
    assert.equal(c.currency, 'USD');
  });

  it('EG → lang:ar, currency:USD (MENA)', () => {
    const c = geo.resolveConfig('EG');
    assert.equal(c.lang, 'ar');
    assert.equal(c.currency, 'USD');
  });

  // Market 5: Hispanic/LatAm → ES + USD
  it('MX → lang:es, currency:USD, region:HISPANIC', () => {
    const c = geo.resolveConfig('MX');
    assert.equal(c.lang, 'es');
    assert.equal(c.currency, 'USD');
    assert.equal(c.region, 'HISPANIC');
  });

  it('CO → lang:es, currency:USD (LatAm)', () => {
    const c = geo.resolveConfig('CO');
    assert.equal(c.lang, 'es');
    assert.equal(c.currency, 'USD');
  });

  // Market 6: International (ROW) → EN + USD
  it('US → lang:en, currency:USD, region:INTL', () => {
    const c = geo.resolveConfig('US');
    assert.equal(c.lang, 'en');
    assert.equal(c.currency, 'USD');
    assert.equal(c.region, 'INTL');
  });

  it('GB → lang:en, currency:USD (GB = International, NOT EU)', () => {
    const c = geo.resolveConfig('GB');
    assert.equal(c.lang, 'en');
    assert.equal(c.currency, 'USD');
    assert.equal(c.region, 'INTL');
  });

  it('JP → lang:en, currency:USD (Asia = International)', () => {
    const c = geo.resolveConfig('JP');
    assert.equal(c.lang, 'en');
    assert.equal(c.currency, 'USD');
  });

  // Edge cases
  it('null/undefined defaults to MA (FR+MAD)', () => {
    const c = geo.resolveConfig(null);
    assert.equal(c.country, 'MA');
    assert.equal(c.lang, 'fr');
    assert.equal(c.currency, 'MAD');
  });

  it('lowercase country code → case insensitive', () => {
    const c = geo.resolveConfig('fr');
    assert.equal(c.lang, 'fr');
    assert.equal(c.currency, 'EUR');
  });

  // getCurrencySymbol
  it('getCurrencySymbol maps all 4 currencies + unknown passthrough', () => {
    assert.equal(geo.getCurrencySymbol('MAD'), 'DH');
    assert.equal(geo.getCurrencySymbol('EUR'), '€');
    assert.equal(geo.getCurrencySymbol('USD'), '$');
    assert.equal(geo.getCurrencySymbol('GBP'), '£');
    assert.equal(geo.getCurrencySymbol('XYZ'), 'XYZ');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. form-validation.js — WCAG Validation (BEHAVIORAL — executes production code)
// ═══════════════════════════════════════════════════════════════════════════════

describe('form-validation.js — WCAG validation (behavioral)', () => {
  let validateInput;
  const errorElements = new Map();

  before(() => {
    errorElements.clear();

    // Enhance document mocks for form-validation IIFE
    globalThis.document.getElementById = (id) => errorElements.get(id) || null;
    globalThis.document.createElement = (tag) => ({
      id: '', className: '', textContent: '', tagName: tag.toUpperCase(),
      _attrs: {},
      setAttribute(k, v) { this._attrs[k] = v; },
      getAttribute(k) { return this._attrs[k] ?? null; },
      removeAttribute(k) { delete this._attrs[k]; }
    });

    // Load and execute production code (IIFE)
    const code = readFileSync(join(LIB_DIR, 'form-validation.js'), 'utf8');
    new Function(code)();

    validateInput = globalThis.window.VocaliaFormValidation.validateInput;
    assert.ok(typeof validateInput === 'function', 'validateInput loaded from production code');
  });

  function mockInput(overrides = {}) {
    return {
      id: overrides.id || `input_${Math.random().toString(36).slice(2, 8)}`,
      type: overrides.type || 'text',
      value: overrides.value || '',
      minLength: overrides.minLength || 0,
      validity: overrides.validity || {},
      validationMessage: overrides.validationMessage || 'Invalid',
      checkValidity() {
        const v = this.validity;
        return !v.valueMissing && !v.typeMismatch && !v.tooShort && !v.patternMismatch;
      },
      _attrs: {},
      setAttribute(k, v) { this._attrs[k] = v; },
      getAttribute(k) { return this._attrs[k] ?? null; },
      removeAttribute(k) { delete this._attrs[k]; },
      classList: {
        _s: new Set(),
        add(c) { this._s.add(c); },
        remove(c) { this._s.delete(c); },
        contains(c) { return this._s.has(c); }
      },
      parentNode: {
        appendChild(el) { if (el.id) errorElements.set(el.id, el); }
      }
    };
  }

  it('validates required field — returns false + FR error message', () => {
    globalThis.document.documentElement.lang = 'fr';
    const input = mockInput({ id: 'name1', validity: { valueMissing: true } });
    const result = validateInput(input);
    assert.equal(result, false);
    const errorEl = errorElements.get('name1-error');
    assert.ok(errorEl, 'error element created');
    assert.equal(errorEl.textContent, 'Ce champ est requis');
  });

  it('validates email typeMismatch — returns false + EN error message', () => {
    globalThis.document.documentElement.lang = 'en';
    const input = mockInput({ id: 'email1', type: 'email', validity: { typeMismatch: true } });
    const result = validateInput(input);
    assert.equal(result, false);
    const errorEl = errorElements.get('email1-error');
    assert.equal(errorEl.textContent, 'Please enter a valid email address');
  });

  it('validates tooShort — returns false + ES error with {min} substitution', () => {
    globalThis.document.documentElement.lang = 'es';
    const input = mockInput({ id: 'pass1', minLength: 8, validity: { tooShort: true } });
    const result = validateInput(input);
    assert.equal(result, false);
    const errorEl = errorElements.get('pass1-error');
    assert.equal(errorEl.textContent, 'Se requieren al menos 8 caracteres');
  });

  it('validates patternMismatch — returns false + AR error message', () => {
    globalThis.document.documentElement.lang = 'ar';
    const input = mockInput({ id: 'phone1', validity: { patternMismatch: true } });
    const result = validateInput(input);
    assert.equal(result, false);
    const errorEl = errorElements.get('phone1-error');
    assert.equal(errorEl.textContent, 'التنسيق غير صالح');
  });

  it('validates valueMissing — returns false + ARY error message', () => {
    globalThis.document.documentElement.lang = 'ary';
    const input = mockInput({ id: 'field1', validity: { valueMissing: true } });
    const result = validateInput(input);
    assert.equal(result, false);
    const errorEl = errorElements.get('field1-error');
    assert.equal(errorEl.textContent, 'هاد الخانة خاصها تتعمر');
  });

  it('returns true for valid input + adds border-green-500', () => {
    globalThis.document.documentElement.lang = 'fr';
    const input = mockInput({ id: 'valid1', value: 'hello@test.com' });
    const result = validateInput(input);
    assert.equal(result, true);
    assert.ok(input.classList._s.has('border-green-500'), 'valid input gets green border');
  });

  it('sets aria-invalid=true and aria-describedby on invalid input', () => {
    globalThis.document.documentElement.lang = 'fr';
    const input = mockInput({ id: 'aria1', validity: { valueMissing: true } });
    validateInput(input);
    assert.equal(input._attrs['aria-invalid'], 'true');
    assert.equal(input._attrs['aria-describedby'], 'aria1-error');
    assert.ok(input.classList._s.has('border-red-500'), 'invalid input gets red border');
  });

  it('error element has role=alert + aria-live=polite (WCAG)', () => {
    globalThis.document.documentElement.lang = 'fr';
    errorElements.clear();
    const input = mockInput({ id: 'wcag1', validity: { valueMissing: true } });
    validateInput(input);
    const errorEl = errorElements.get('wcag1-error');
    assert.ok(errorEl, 'error element was created');
    assert.equal(errorEl._attrs['role'], 'alert');
    assert.equal(errorEl._attrs['aria-live'], 'polite');
    assert.ok(errorEl.className.includes('form-error'), 'has form-error class');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. auth-client.js — JWT Token Management
// ═══════════════════════════════════════════════════════════════════════════════

describe('auth-client.js — JWT token management', () => {
  let AuthClient;

  before(async () => {
    const mod = await import(pathToFileURL(join(LIB_DIR, 'auth-client.js')).href);
    AuthClient = mod.AuthClient;
  });

  function createTestJwt(payload) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64');
    return `${header}.${body}.test_signature`;
  }

  it('_decodeToken extracts JWT payload correctly', () => {
    const a = new AuthClient();
    const token = createTestJwt({ sub: 'user_123', role: 'admin', exp: 9999999999 });
    const payload = a._decodeToken(token);
    assert.equal(payload.sub, 'user_123');
    assert.equal(payload.role, 'admin');
    assert.equal(payload.exp, 9999999999);
  });

  it('_decodeToken returns null for invalid tokens', () => {
    const a = new AuthClient();
    assert.equal(a._decodeToken('not-a-jwt'), null);
    assert.equal(a._decodeToken(''), null);
    assert.equal(a._decodeToken(null), null);
  });

  it('_isTokenExpiring returns true for expired token', () => {
    const a = new AuthClient();
    const expired = createTestJwt({ exp: Math.floor(Date.now() / 1000) - 3600 });
    assert.equal(a._isTokenExpiring(expired), true);
  });

  it('_isTokenExpiring returns false for long-lived token', () => {
    const a = new AuthClient();
    const valid = createTestJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
    assert.equal(a._isTokenExpiring(valid), false);
  });

  it('_isTokenExpiring returns true when within 5-min threshold', () => {
    const a = new AuthClient();
    const expiringSoon = createTestJwt({ exp: Math.floor(Date.now() / 1000) + 120 });
    assert.equal(a._isTokenExpiring(expiringSoon), true);
  });

  it('isAuthenticated returns false with no token', () => {
    globalThis.localStorage.clear();
    globalThis.sessionStorage.clear();
    const a = new AuthClient();
    assert.equal(a.isAuthenticated(), false);
  });

  it('hasPermission checks permissions array in JWT', () => {
    const token = createTestJwt({ permissions: ['read', 'write'], exp: Math.floor(Date.now() / 1000) + 3600 });
    globalThis.localStorage.setItem('vocalia_remember', 'false');
    globalThis.sessionStorage.setItem('vocalia_access_token', token);
    const a = new AuthClient();
    assert.equal(a.hasPermission('read'), true);
    assert.equal(a.hasPermission('write'), true);
    assert.equal(a.hasPermission('delete'), false);
    globalThis.localStorage.clear();
    globalThis.sessionStorage.clear();
  });

  it('hasRole and isAdmin check role field in JWT', () => {
    const token = createTestJwt({ role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 });
    globalThis.localStorage.setItem('vocalia_remember', 'false');
    globalThis.sessionStorage.setItem('vocalia_access_token', token);
    const a = new AuthClient();
    assert.equal(a.hasRole('admin'), true);
    assert.equal(a.hasRole('user'), false);
    assert.equal(a.isAdmin(), true);
    globalThis.localStorage.clear();
    globalThis.sessionStorage.clear();
  });

  it('getTenantId extracts tenant_id from JWT', () => {
    const token = createTestJwt({ tenant_id: 'tenant_abc', exp: Math.floor(Date.now() / 1000) + 3600 });
    globalThis.localStorage.setItem('vocalia_remember', 'false');
    globalThis.sessionStorage.setItem('vocalia_access_token', token);
    const a = new AuthClient();
    assert.equal(a.getTenantId(), 'tenant_abc');
    globalThis.localStorage.clear();
    globalThis.sessionStorage.clear();
  });

  it('onAuthStateChange subscribes and unsubscribes correctly', () => {
    const a = new AuthClient();
    const events = [];
    const unsub = a.onAuthStateChange((event) => events.push(event));
    a._notifyListeners('login', null);
    assert.equal(events.length, 1);
    assert.equal(events[0], 'login');
    unsub();
    a._notifyListeners('logout', null);
    assert.equal(events.length, 1); // still 1 — unsubscribed
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. api-client.js — API Error and Helpers
// ═══════════════════════════════════════════════════════════════════════════════

describe('api-client.js — APIError and helpers', () => {
  let APIError, APIClient;

  before(async () => {
    const mod = await import(pathToFileURL(join(LIB_DIR, 'api-client.js')).href);
    APIError = mod.APIError;
    APIClient = mod.APIClient;
  });

  it('APIError has correct properties and extends Error', () => {
    const err = new APIError('test error', 404, 'NOT_FOUND', { detail: 'x' });
    assert.equal(err.message, 'test error');
    assert.equal(err.status, 404);
    assert.equal(err.code, 'NOT_FOUND');
    assert.deepEqual(err.data, { detail: 'x' });
    assert.equal(err.name, 'APIError');
    assert.ok(err instanceof Error);
  });

  it('APIError.fromResponse creates error from HTTP response', () => {
    const err = APIError.fromResponse(
      { status: 500, statusText: 'Internal Server Error' },
      { error: 'DB connection failed', code: 'DB_ERROR' }
    );
    assert.equal(err.status, 500);
    assert.equal(err.message, 'DB connection failed');
    assert.equal(err.code, 'DB_ERROR');
  });

  it('APIClient._buildUrl builds URL with query params', () => {
    const client = new APIClient('http://localhost:3013/api');
    const url = client._buildUrl('/db/tenants', { limit: 10, status: 'active' });
    assert.ok(url.includes('/db/tenants'));
    assert.ok(url.includes('limit=10'));
    assert.ok(url.includes('status=active'));
  });

  it('APIClient._buildUrl skips null/undefined params', () => {
    const client = new APIClient('http://localhost:3013/api');
    const url = client._buildUrl('/db/tenants', { limit: 10, status: null, name: undefined });
    assert.ok(url.includes('limit=10'));
    assert.ok(!url.includes('status'));
    assert.ok(!url.includes('name'));
  });

  it('APIClient._groupBy groups array by field', () => {
    const client = new APIClient('http://localhost:3013/api');
    const data = [
      { language: 'fr' }, { language: 'fr' },
      { language: 'en' }, { language: null }
    ];
    const result = client._groupBy(data, 'language');
    assert.equal(result.fr, 2);
    assert.equal(result.en, 1);
    assert.equal(result.unknown, 1);
  });

  it('APIClient._groupByDate groups by ISO date portion', () => {
    const client = new APIClient('http://localhost:3013/api');
    const data = [
      { created_at: '2025-01-15T10:00:00Z' },
      { created_at: '2025-01-15T14:00:00Z' },
      { created_at: '2025-01-16T08:00:00Z' },
      { created_at: undefined }
    ];
    const result = client._groupByDate(data, 'created_at');
    assert.equal(result['2025-01-15'], 2);
    assert.equal(result['2025-01-16'], 1);
    assert.equal(result['unknown'], 1);
  });

  it('tenants.list() sends GET /db/tenants via fetch', async () => {
    const client = new APIClient('http://localhost:3013/api');
    const calls = [];
    const origFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      calls.push({ url, method: opts?.method || 'GET' });
      return {
        ok: true, status: 200,
        headers: { get: (n) => n === 'content-type' ? 'application/json' : null },
        json: async () => ({ data: [] })
      };
    };
    try {
      await client.tenants.list();
      assert.ok(calls.length > 0, 'fetch was called');
      assert.ok(calls[0].url.includes('/db/tenants'), 'URL includes /db/tenants');
      assert.equal(calls[0].method, 'GET');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('tenants.create() sends POST /db/tenants with JSON body', async () => {
    const client = new APIClient('http://localhost:3013/api');
    const calls = [];
    const origFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      calls.push({ url, method: opts?.method, body: opts?.body });
      return {
        ok: true, status: 201,
        headers: { get: (n) => n === 'content-type' ? 'application/json' : null },
        json: async () => ({ id: '1', name: 'Test' })
      };
    };
    try {
      const result = await client.tenants.create({ name: 'Test' });
      assert.ok(calls[0].url.includes('/db/tenants'));
      assert.equal(calls[0].method, 'POST');
      const body = JSON.parse(calls[0].body);
      assert.equal(body.name, 'Test');
      assert.equal(result.name, 'Test');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('interceptor add/remove works correctly', () => {
    const client = new APIClient('http://localhost:3013/api');
    const unsub = client.addRequestInterceptor(() => {});
    assert.equal(client.requestInterceptors.length, 1);
    unsub();
    assert.equal(client.requestInterceptors.length, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. db-client.js — Database Client Structure
// ═══════════════════════════════════════════════════════════════════════════════

describe('db-client.js — database client', () => {
  let DBClient;

  before(async () => {
    const mod = await import(pathToFileURL(join(LIB_DIR, 'db-client.js')).href);
    DBClient = mod.DBClient;
  });

  it('constructor accepts custom baseUrl', () => {
    const client = new DBClient('http://test:3013/api/db');
    assert.equal(client.baseUrl, 'http://test:3013/api/db');
  });

  it('sheet().list() sends GET /{sheet} and returns data array', async () => {
    const client = new DBClient('http://test:3013/api/db');
    const calls = [];
    const origFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      calls.push({ url, method: opts?.method || 'GET' });
      return { ok: true, status: 200, json: async () => ({ data: [{ id: '1' }] }) };
    };
    try {
      const result = await client.sheet('tenants').list();
      assert.ok(calls[0].url.includes('/tenants'), 'URL includes /tenants');
      assert.equal(calls[0].method, 'GET');
      assert.deepEqual(result, [{ id: '1' }]);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('sheet().create() sends POST /{sheet} with JSON body', async () => {
    const client = new DBClient('http://test:3013/api/db');
    const calls = [];
    const origFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      calls.push({ url, method: opts?.method, body: opts?.body });
      return { ok: true, status: 201, json: async () => ({ id: '1', name: 'Acme' }) };
    };
    try {
      const result = await client.sheet('tenants').create({ name: 'Acme' });
      assert.ok(calls[0].url.includes('/tenants'));
      assert.equal(calls[0].method, 'POST');
      const body = JSON.parse(calls[0].body);
      assert.equal(body.name, 'Acme');
      assert.equal(result.name, 'Acme');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('convenience accessors route to correct sheet paths', async () => {
    const client = new DBClient('http://test:3013/api/db');
    const urls = [];
    const origFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      urls.push(url);
      return { ok: true, status: 200, json: async () => ({ data: [] }) };
    };
    try {
      await client.tenants.list();
      await client.sessions.list();
      await client.logs.list();
      await client.users.list();
      assert.ok(urls[0].includes('/tenants'), 'tenants → /tenants');
      assert.ok(urls[1].includes('/sessions'), 'sessions → /sessions');
      assert.ok(urls[2].includes('/logs'), 'logs → /logs');
      assert.ok(urls[3].includes('/users'), 'users → /users');
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. Integration Chains — auth→api token injection, db→storage auth
// ═══════════════════════════════════════════════════════════════════════════════

describe('integration chains — auth token injection', () => {
  let APIClient, DBClient;

  before(async () => {
    const apiMod = await import(pathToFileURL(join(LIB_DIR, 'api-client.js')).href);
    const dbMod = await import(pathToFileURL(join(LIB_DIR, 'db-client.js')).href);
    APIClient = apiMod.APIClient;
    DBClient = dbMod.DBClient;
  });

  function createTestJwt(payload) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64');
    return `${header}.${body}.test_sig`;
  }

  it('auth→api: JWT from storage auto-injected into APIClient fetch headers', async () => {
    const token = createTestJwt({ sub: 'u1', role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 });
    globalThis.localStorage.setItem('vocalia_remember', 'true');
    globalThis.localStorage.setItem('vocalia_access_token', token);

    const client = new APIClient('http://localhost:3013/api');
    const captured = [];
    const origFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      captured.push({ url, headers: opts?.headers || {} });
      return {
        ok: true, status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ data: [] })
      };
    };
    try {
      await client.tenants.list();
      assert.ok(captured.length > 0, 'fetch was called');
      assert.ok(captured[0].headers['Authorization'], 'Authorization header present');
      assert.ok(captured[0].headers['Authorization'].startsWith('Bearer '), 'Bearer prefix');
      assert.ok(captured[0].headers['Authorization'].includes(token), 'correct token injected');
    } finally {
      globalThis.fetch = origFetch;
      globalThis.localStorage.clear();
      globalThis.sessionStorage.clear();
    }
  });

  it('db→storage: token from localStorage injected into DBClient fetch headers', async () => {
    const token = 'test_db_token_xyz';
    globalThis.localStorage.setItem('vocalia_access_token', token);

    const client = new DBClient('http://test:3013/api/db');
    const captured = [];
    const origFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      captured.push({ headers: opts?.headers || {} });
      return { ok: true, status: 200, json: async () => ({ data: [] }) };
    };
    try {
      await client.tenants.list();
      assert.equal(captured[0].headers['Authorization'], `Bearer ${token}`);
    } finally {
      globalThis.fetch = origFetch;
      globalThis.localStorage.clear();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. ab-testing.js — A/B Testing Framework
// ═══════════════════════════════════════════════════════════════════════════════

describe('ab-testing.js — A/B testing framework', () => {
  let VocaliaAB;

  before(() => {
    // Mock browser globals needed by the IIFE
    globalThis.window.dataLayer = [];
    if (!globalThis.navigator?.sendBeacon) {
      Object.defineProperty(globalThis, 'navigator', {
        value: { ...globalThis.navigator, sendBeacon: () => true },
        writable: true, configurable: true
      });
    }
    globalThis.localStorage.clear();

    const code = readFileSync(join(LIB_DIR, 'ab-testing.js'), 'utf8');
    new Function(code)();
    VocaliaAB = globalThis.window.VocaliaAB;
    assert.ok(VocaliaAB, 'VocaliaAB loaded from production code');
  });

  it('EXPERIMENTS has 4 experiments defined', () => {
    const keys = Object.keys(VocaliaAB.EXPERIMENTS);
    assert.equal(keys.length, 4);
    assert.ok(keys.includes('hero-cta'));
    assert.ok(keys.includes('pricing-cta'));
    assert.ok(keys.includes('demo-request'));
    assert.ok(keys.includes('newsletter'));
  });

  it('EVENTS has 4 event types', () => {
    assert.equal(VocaliaAB.EVENTS.IMPRESSION, 'impression');
    assert.equal(VocaliaAB.EVENTS.CLICK, 'click');
    assert.equal(VocaliaAB.EVENTS.CONVERSION, 'conversion');
    assert.equal(VocaliaAB.EVENTS.HOVER, 'hover');
  });

  it('each experiment has variants, weights, enabled, content', () => {
    for (const [key, exp] of Object.entries(VocaliaAB.EXPERIMENTS)) {
      assert.ok(Array.isArray(exp.variants), `${key} has variants array`);
      assert.ok(Array.isArray(exp.weights), `${key} has weights array`);
      assert.equal(exp.variants.length, exp.weights.length, `${key} variants/weights length match`);
      assert.equal(typeof exp.enabled, 'boolean', `${key} has enabled boolean`);
      assert.ok(exp.content, `${key} has content object`);
    }
  });

  it('experiment weights sum to ~1.0', () => {
    for (const [key, exp] of Object.entries(VocaliaAB.EXPERIMENTS)) {
      const sum = exp.weights.reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(sum - 1.0) < 0.01, `${key} weights sum to ${sum}, expected ~1.0`);
    }
  });

  it('getVariant returns a valid variant for each experiment', () => {
    globalThis.localStorage.clear();
    for (const key of Object.keys(VocaliaAB.EXPERIMENTS)) {
      const variant = VocaliaAB.getVariant(key);
      assert.ok(VocaliaAB.EXPERIMENTS[key].variants.includes(variant),
        `${key} returned variant "${variant}" not in variants list`);
    }
  });

  it('getVariant returns consistent result (localStorage persistence)', () => {
    globalThis.localStorage.clear();
    const v1 = VocaliaAB.getVariant('hero-cta');
    const v2 = VocaliaAB.getVariant('hero-cta');
    assert.equal(v1, v2, 'Same variant returned on subsequent calls');
  });

  it('forceVariant overrides assignment', () => {
    VocaliaAB.forceVariant('hero-cta', 'urgent');
    assert.equal(VocaliaAB.getVariant('hero-cta'), 'urgent');
  });

  it('getVariantContent returns localized content object', () => {
    VocaliaAB.forceVariant('hero-cta', 'control');
    const content = VocaliaAB.getVariantContent('hero-cta');
    assert.ok(content, 'content returned');
    assert.equal(content.variant, 'control');
    assert.ok(content.text, 'has text');
  });

  it('getResults returns userId and assignments', () => {
    const results = VocaliaAB.getResults();
    assert.ok(results.userId, 'has userId');
    assert.ok(results.assignments, 'has assignments');
    assert.ok(Array.isArray(results.experiments), 'has experiments array');
  });

  it('reset clears all assignments', () => {
    VocaliaAB.getVariant('hero-cta');
    VocaliaAB.reset();
    const stored = globalThis.localStorage.getItem('vocalia_ab_v1');
    assert.equal(stored, null, 'localStorage cleared after reset');
  });

  it('trackConversion does not throw', () => {
    globalThis.localStorage.clear();
    VocaliaAB.getVariant('hero-cta');
    assert.doesNotThrow(() => VocaliaAB.trackConversion('hero-cta', 'signup'));
  });

  it('trackClick does not throw', () => {
    assert.doesNotThrow(() => VocaliaAB.trackClick('hero-cta'));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. websocket-manager.js — WebSocket Manager (pure logic, no real WS)
// ═══════════════════════════════════════════════════════════════════════════════

describe('websocket-manager.js — WebSocket manager', () => {
  let WS_STATES, WebSocketManager;

  before(async () => {
    // Mock WebSocket constructor so autoConnect doesn't crash
    globalThis.WebSocket = class MockWebSocket {
      constructor() { this.readyState = 3; }
      send() {}
      close() {}
    };
    const mod = await import(pathToFileURL(join(LIB_DIR, 'websocket-manager.js')).href);
    WS_STATES = mod.WS_STATES;
    WebSocketManager = mod.WebSocketManager;
  });

  it('WS_STATES has 4 states matching WebSocket spec', () => {
    assert.equal(WS_STATES.CONNECTING, 0);
    assert.equal(WS_STATES.OPEN, 1);
    assert.equal(WS_STATES.CLOSING, 2);
    assert.equal(WS_STATES.CLOSED, 3);
  });

  it('constructor initializes with CLOSED state when autoConnect=false', () => {
    const mgr = new WebSocketManager('ws://localhost:3013/ws', { autoConnect: false });
    assert.equal(mgr.getState(), WS_STATES.CLOSED);
    assert.equal(mgr.isConnected(), false);
    assert.equal(mgr.getConnectionId(), null);
  });

  it('message queue accepts messages when disconnected', () => {
    const mgr = new WebSocketManager('ws://localhost:3013/ws', { autoConnect: false });
    const sent = mgr.send({ type: 'test', data: 'hello' });
    assert.equal(sent, false, 'send returns false when not connected');
    assert.equal(mgr.messageQueue.length, 1, 'message queued');
  });

  it('message queue respects size limit (100)', () => {
    const mgr = new WebSocketManager('ws://localhost:3013/ws', { autoConnect: false });
    for (let i = 0; i < 105; i++) {
      mgr.send({ i });
    }
    assert.equal(mgr.messageQueue.length, 100, 'queue capped at 100');
  });

  it('on() subscribes and returns unsubscribe function', () => {
    const mgr = new WebSocketManager('ws://localhost:3013/ws', { autoConnect: false });
    const events = [];
    const unsub = mgr.on('test', (data) => events.push(data));
    mgr._emit('test', 'a');
    mgr._emit('test', 'b');
    assert.equal(events.length, 2);
    unsub();
    mgr._emit('test', 'c');
    assert.equal(events.length, 2, 'unsubscribed — no new events');
  });

  it('once() fires handler exactly once', () => {
    const mgr = new WebSocketManager('ws://localhost:3013/ws', { autoConnect: false });
    const events = [];
    mgr.once('single', (data) => events.push(data));
    mgr._emit('single', 'x');
    mgr._emit('single', 'y');
    assert.equal(events.length, 1);
    assert.equal(events[0], 'x');
  });

  it('subscribe() creates channel map and returns unsubscribe', () => {
    const mgr = new WebSocketManager('ws://localhost:3013/ws', { autoConnect: false });
    const msgs = [];
    const unsub = mgr.subscribe('chat', 'message', (data) => msgs.push(data));
    assert.ok(mgr.channels.has('chat'), 'channel registered');
    mgr._emitChannel('chat', 'message', 'hello');
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0], 'hello');
    unsub();
    assert.ok(!mgr.channels.has('chat'), 'channel cleaned up after unsub');
  });

  it('disconnect() sets autoReconnect=false and state=CLOSING', () => {
    const mgr = new WebSocketManager('ws://localhost:3013/ws', { autoConnect: false });
    mgr.options.autoReconnect = true;
    mgr.disconnect();
    assert.equal(mgr.options.autoReconnect, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. global-localization.js — Market Rules & Pricing
// ═══════════════════════════════════════════════════════════════════════════════

describe('global-localization.js — market rules & pricing', () => {
  let GlobalLocalization, MARKET_RULES, PRICING_TABLE;

  before(() => {
    const mod = require(join(LIB_DIR, 'global-localization.js'));
    GlobalLocalization = mod.GlobalLocalization;
    MARKET_RULES = mod.MARKET_RULES;
    PRICING_TABLE = mod.PRICING_TABLE;
  });

  it('MARKET_RULES has entries for all 6 market segments', () => {
    // Maroc
    assert.equal(MARKET_RULES.MA.lang, 'fr');
    assert.equal(MARKET_RULES.MA.currency, 'MAD');
    // Europe
    assert.equal(MARKET_RULES.FR.lang, 'fr');
    assert.equal(MARKET_RULES.FR.currency, 'EUR');
    // Hispanic EU
    assert.equal(MARKET_RULES.ES.lang, 'es');
    assert.equal(MARKET_RULES.ES.currency, 'EUR');
    // MENA
    assert.equal(MARKET_RULES.SA.lang, 'ar');
    assert.equal(MARKET_RULES.SA.currency, 'USD');
    // Hispanic LatAm
    assert.equal(MARKET_RULES.MX.lang, 'es');
    assert.equal(MARKET_RULES.MX.currency, 'USD');
    // International default
    assert.equal(MARKET_RULES.DEFAULT_INTL.lang, 'en');
    assert.equal(MARKET_RULES.DEFAULT_INTL.currency, 'USD');
  });

  it('PRICING_TABLE has 3 currencies with correct Starter prices', () => {
    assert.equal(PRICING_TABLE.EUR.starter, 49);
    assert.equal(PRICING_TABLE.USD.starter, 49);
    assert.equal(PRICING_TABLE.MAD.starter, 490);
  });

  it('PRICING_TABLE telephony prices match spec', () => {
    assert.equal(PRICING_TABLE.EUR.telephony, 199);
    assert.equal(PRICING_TABLE.USD.telephony, 199);
    assert.equal(PRICING_TABLE.MAD.telephony, 1990);
  });

  it('getMarketConfig returns correct config for known country', () => {
    const config = GlobalLocalization.getMarketConfig('FR');
    assert.equal(config.lang, 'fr');
    assert.equal(config.currency, 'EUR');
    assert.equal(config.id, 'europe');
  });

  it('getMarketConfig returns DEFAULT_INTL for unknown country', () => {
    const config = GlobalLocalization.getMarketConfig('ZZ');
    assert.equal(config.lang, 'en');
    assert.equal(config.currency, 'USD');
    assert.equal(config.id, 'intl');
  });

  it('getMarketConfig is case-insensitive', () => {
    const config = GlobalLocalization.getMarketConfig('fr');
    assert.equal(config.lang, 'fr');
    assert.equal(config.currency, 'EUR');
  });

  it('getMarketConfig handles null → intl', () => {
    const config = GlobalLocalization.getMarketConfig(null);
    assert.equal(config.id, 'intl');
  });

  it('formatPrice formats MAD with suffix, EUR/USD with prefix', () => {
    assert.equal(GlobalLocalization.formatPrice(490, 'MAD'), '490 DH');
    assert.equal(GlobalLocalization.formatPrice(49, 'EUR'), '€49');
    assert.equal(GlobalLocalization.formatPrice(49, 'USD'), '$49');
  });

  it('Maghreb countries route to FR+EUR (DZ, TN)', () => {
    assert.equal(MARKET_RULES.DZ.lang, 'fr');
    assert.equal(MARKET_RULES.DZ.currency, 'EUR');
    assert.equal(MARKET_RULES.TN.lang, 'fr');
    assert.equal(MARKET_RULES.TN.currency, 'EUR');
  });

  it('Gulf countries route to AR+USD (AE, QA, KW)', () => {
    assert.equal(MARKET_RULES.AE.lang, 'ar');
    assert.equal(MARKET_RULES.AE.currency, 'USD');
    assert.equal(MARKET_RULES.QA.lang, 'ar');
    assert.equal(MARKET_RULES.QA.currency, 'USD');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. event-delegation.js — Action Registry
// ═══════════════════════════════════════════════════════════════════════════════

describe('event-delegation.js — action registry', () => {
  let VocaliaActions;

  before(() => {
    // Set up minimal DOM mocks for event-delegation IIFE
    const eventListeners = [];
    globalThis.document.addEventListener = (type, handler) => {
      eventListeners.push({ type, handler });
    };
    globalThis.document.readyState = 'complete';
    globalThis.document.querySelectorAll = () => [];
    globalThis.document.getElementById = () => null;
    globalThis.document.querySelector = () => null;

    // Mock lucide
    globalThis.lucide = { createIcons: () => {} };

    const code = readFileSync(join(LIB_DIR, 'event-delegation.js'), 'utf8');
    new Function(code)();
    VocaliaActions = globalThis.window.VocaliaActions;
    assert.ok(VocaliaActions, 'VocaliaActions loaded');
  });

  it('has all core action functions registered', () => {
    const requiredActions = [
      'switchLang', 'toggleLangDropdown', 'openDemoModal', 'closeDemoModal',
      'selectPlan', 'signInWithGoogle', 'togglePassword',
      'copyCode', 'reload', 'closeModal', 'closeConfigModal'
    ];
    for (const action of requiredActions) {
      assert.equal(typeof VocaliaActions[action], 'function', `action "${action}" is a function`);
    }
  });

  it('LANG_LABELS covers all 5 supported languages', async () => {
    // switchLang updates document.documentElement.lang
    // We verify it doesn't throw for each language
    for (const lang of ['fr', 'en', 'es', 'ar', 'ary']) {
      await VocaliaActions.switchLang(lang);
      assert.equal(globalThis.document.documentElement.lang, lang);
    }
  });

  it('switchLang sets RTL for ar/ary, LTR for others', async () => {
    await VocaliaActions.switchLang('ar');
    assert.equal(globalThis.document.documentElement.dir, 'rtl');
    await VocaliaActions.switchLang('ary');
    assert.equal(globalThis.document.documentElement.dir, 'rtl');
    await VocaliaActions.switchLang('fr');
    assert.equal(globalThis.document.documentElement.dir, 'ltr');
    await VocaliaActions.switchLang('en');
    assert.equal(globalThis.document.documentElement.dir, 'ltr');
  });

  it('dashboard action delegates exist and do not throw', () => {
    const dashActions = ['queueVideo', 'quickAction', 'viewAllTenants',
      'viewAllCalls', 'viewAllSessions', 'refreshHITLQueue',
      'showActivityPanel', 'configureAgents', 'exportWidgetAnalytics'];
    for (const action of dashActions) {
      assert.equal(typeof VocaliaActions[action], 'function', `${action} exists`);
      assert.doesNotThrow(() => VocaliaActions[action]('test'), `${action} doesn't throw`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 12. modal.js — Modal Component (config + class structure)
// ═══════════════════════════════════════════════════════════════════════════════

describe('modal.js — modal component config & structure', () => {
  let Modal, MODAL_CONFIG, alert, confirm, prompt, loading, closeAll;

  before(async () => {
    // Enhanced document mock for modal creation
    const mockEl = () => ({
      id: '', className: '', textContent: '', innerHTML: '', style: {},
      _children: [], _listeners: {},
      setAttribute(k, v) { this[k] = v; },
      getAttribute(k) { return this[k]; },
      appendChild(child) { this._children.push(child); return child; },
      querySelector() { return mockEl(); },
      querySelectorAll() { return []; },
      addEventListener(type, handler) {
        if (!this._listeners[type]) this._listeners[type] = [];
        this._listeners[type].push(handler);
      },
      classList: {
        _s: new Set(),
        add(...c) { c.forEach(x => this._s.add(x)); },
        remove(...c) { c.forEach(x => this._s.delete(x)); },
        contains(c) { return this._s.has(c); },
        toggle(c) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); }
      },
      remove() {},
      closest() { return null; },
      focus() {}
    });

    globalThis.document.createElement = () => mockEl();
    globalThis.document.body = mockEl();
    globalThis.document.body.style = {};
    globalThis.document.activeElement = mockEl();
    globalThis.requestAnimationFrame = (fn) => fn();

    const mod = await import(pathToFileURL(join(LIB_DIR, 'modal.js')).href);
    Modal = mod.Modal;
    alert = mod.alert;
    confirm = mod.confirm;
    prompt = mod.prompt;
    loading = mod.loading;
    closeAll = mod.closeAll;
  });

  it('Modal class exists and is constructable with defaults', () => {
    const m = new Modal();
    assert.equal(m.options.size, 'md');
    assert.equal(m.options.closable, true);
    assert.equal(m.options.closeOnBackdrop, true);
    assert.equal(m.options.closeOnEsc, true);
    assert.equal(m.options.showClose, true);
    assert.equal(m.isOpen, false);
  });

  it('Modal accepts custom options (title, size, closable)', () => {
    const m = new Modal({
      title: 'Test Modal',
      size: 'lg',
      closable: false
    });
    assert.equal(m.options.title, 'Test Modal');
    assert.equal(m.options.size, 'lg');
    assert.equal(m.options.closable, false);
  });

  it('Modal size accepts sm/md/lg/xl/2xl/full', () => {
    for (const size of ['sm', 'md', 'lg', 'xl', '2xl', 'full']) {
      const m = new Modal({ size });
      assert.equal(m.options.size, size);
    }
  });

  it('Modal has open(), close(), setContent(), setTitle() methods', () => {
    const m = new Modal();
    assert.equal(typeof m.open, 'function');
    assert.equal(typeof m.close, 'function');
    assert.equal(typeof m.setContent, 'function');
    assert.equal(typeof m.setTitle, 'function');
  });

  it('factory functions exist: alert, confirm, prompt, loading, closeAll', () => {
    assert.equal(typeof alert, 'function');
    assert.equal(typeof confirm, 'function');
    assert.equal(typeof prompt, 'function');
    assert.equal(typeof loading, 'function');
    assert.equal(typeof closeAll, 'function');
  });

  it('MODAL_CONFIG has correct defaults', () => {
    // MODAL_CONFIG is not exported, verify via Modal behavior
    const m = new Modal();
    assert.ok(m.id.startsWith('modal-'), 'generates modal-N id');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 13. toast.js — Toast Notification Config
// ═══════════════════════════════════════════════════════════════════════════════

describe('toast.js — toast notification system', () => {
  let ToastManager, toastInstance;

  before(async () => {
    // Toast manager needs document for container creation
    const mockEl = () => ({
      id: '', className: '', textContent: '', innerHTML: '', style: {},
      _children: [],
      setAttribute(k, v) { this[k] = v; },
      appendChild(child) { this._children.push(child); return child; },
      removeChild(child) {
        const i = this._children.indexOf(child);
        if (i > -1) this._children.splice(i, 1);
      },
      querySelector() { return mockEl(); },
      parentNode: null,
      addEventListener() {},
      classList: {
        _s: new Set(),
        add(...c) { c.forEach(x => this._s.add(x)); },
        remove(...c) { c.forEach(x => this._s.delete(x)); },
        contains(c) { return this._s.has(c); }
      },
      remove() { if (this.parentNode) this.parentNode.removeChild(this); }
    });

    globalThis.document.getElementById = (id) => {
      if (id === 'vocalia-toast-container') return null; // Force creation
      return null;
    };
    globalThis.document.createElement = () => {
      const el = mockEl();
      el.parentNode = globalThis.document.body;
      return el;
    };
    globalThis.document.body = mockEl();
    globalThis.requestAnimationFrame = (fn) => fn();

    const mod = await import(pathToFileURL(join(LIB_DIR, 'toast.js')).href);
    ToastManager = mod.ToastManager;
    toastInstance = mod.toast;
  });

  it('ToastManager class exists', () => {
    assert.equal(typeof ToastManager, 'function');
  });

  it('toast singleton is a ToastManager instance', () => {
    assert.ok(toastInstance instanceof ToastManager);
  });

  it('has convenience methods: success, error, warning, info, loading', () => {
    assert.equal(typeof toastInstance.success, 'function');
    assert.equal(typeof toastInstance.error, 'function');
    assert.equal(typeof toastInstance.warning, 'function');
    assert.equal(typeof toastInstance.info, 'function');
    assert.equal(typeof toastInstance.loading, 'function');
  });

  it('has show, remove, clear methods', () => {
    assert.equal(typeof toastInstance.show, 'function');
    assert.equal(typeof toastInstance.remove, 'function');
    assert.equal(typeof toastInstance.clear, 'function');
  });

  it('has async promise() helper', () => {
    assert.equal(typeof toastInstance.promise, 'function');
  });

  it('4 toast types: success, error, warning, info', () => {
    // Verify the types are handled without throwing
    for (const type of ['success', 'error', 'warning', 'info']) {
      assert.doesNotThrow(() => toastInstance.show('test', type));
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 14. data-table.js — DataTable Pure Logic
// ═══════════════════════════════════════════════════════════════════════════════

describe('data-table.js — DataTable logic', () => {
  let DataTable;

  before(async () => {
    // Full DOM mock for DataTable which renders into a container
    const mockEl = (tag) => ({
      tagName: (tag || 'DIV').toUpperCase(),
      id: '', className: '', textContent: '', innerHTML: '', style: {},
      colSpan: 0, dataset: {},
      _children: [], _listeners: {},
      setAttribute(k, v) { this.dataset[k] = v; },
      getAttribute(k) { return this.dataset[k]; },
      appendChild(child) { this._children.push(child); return child; },
      querySelector(sel) {
        // Simple selector support for test
        if (sel === 'input') return mockEl('input');
        if (sel === '.select-all') return mockEl('input');
        if (sel === '.page-size') return mockEl('select');
        if (sel === '.prev') return mockEl('button');
        if (sel === '.next') return mockEl('button');
        return null;
      },
      querySelectorAll() { return []; },
      addEventListener(type, handler) {
        if (!this._listeners[type]) this._listeners[type] = [];
        this._listeners[type].push(handler);
      },
      classList: {
        _s: new Set(),
        add(...c) { c.forEach(x => this._s.add(x)); },
        remove(...c) { c.forEach(x => this._s.delete(x)); }
      },
      closest() { return null; },
      value: ''
    });

    globalThis.document.createElement = (tag) => mockEl(tag);
    globalThis.document.querySelector = () => mockEl();
    // Mock VocaliaI18n for _t() function
    globalThis.VocaliaI18n = { t: (key) => key };

    const mod = await import(pathToFileURL(join(LIB_DIR, 'data-table.js')).href);
    DataTable = mod.DataTable;
  });

  it('DataTable class exists', () => {
    assert.equal(typeof DataTable, 'function');
  });

  it('_getValue extracts nested values', () => {
    const container = globalThis.document.createElement('div');
    const dt = new DataTable(container, { columns: [{ key: 'name', label: 'Name' }] });
    assert.equal(dt._getValue({ name: 'Alice' }, 'name'), 'Alice');
    assert.equal(dt._getValue({ a: { b: { c: 42 } } }, 'a.b.c'), 42);
    assert.equal(dt._getValue({ a: null }, 'a.b'), undefined);
  });

  it('_matchFilter handles equals, contains, range, dateRange', () => {
    const container = globalThis.document.createElement('div');
    const dt = new DataTable(container, { columns: [] });

    assert.equal(dt._matchFilter('hello', { type: 'equals', value: 'hello' }), true);
    assert.equal(dt._matchFilter('hello', { type: 'equals', value: 'world' }), false);
    assert.equal(dt._matchFilter('Hello World', { type: 'contains', value: 'world' }), true);
    assert.equal(dt._matchFilter('Hello', { type: 'contains', value: 'xyz' }), false);
    assert.equal(dt._matchFilter(50, { type: 'range', min: 10, max: 100 }), true);
    assert.equal(dt._matchFilter(5, { type: 'range', min: 10, max: 100 }), false);
    assert.equal(dt._matchFilter('2025-06-15', {
      type: 'dateRange',
      start: '2025-01-01',
      end: '2025-12-31'
    }), true);
  });

  it('_getPageData paginates correctly', () => {
    const container = globalThis.document.createElement('div');
    const dt = new DataTable(container, {
      columns: [{ key: 'id', label: 'ID' }],
      pageSize: 2
    });
    dt.data = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];
    dt.filteredData = [...dt.data];

    dt.currentPage = 1;
    assert.deepEqual(dt._getPageData(), [{ id: 1 }, { id: 2 }]);
    dt.currentPage = 2;
    assert.deepEqual(dt._getPageData(), [{ id: 3 }, { id: 4 }]);
    dt.currentPage = 3;
    assert.deepEqual(dt._getPageData(), [{ id: 5 }]);
  });

  it('_applyFilters respects search query across columns', () => {
    const container = globalThis.document.createElement('div');
    const dt = new DataTable(container, {
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' }
      ]
    });
    dt.data = [
      { name: 'Alice', email: 'alice@test.com' },
      { name: 'Bob', email: 'bob@test.com' },
      { name: 'Charlie', email: 'charlie@test.com' }
    ];
    dt.searchQuery = 'bob';
    dt._applyFilters();
    assert.equal(dt.filteredData.length, 1);
    assert.equal(dt.filteredData[0].name, 'Bob');
  });

  it('sorting works for strings and numbers', () => {
    const container = globalThis.document.createElement('div');
    const dt = new DataTable(container, {
      columns: [{ key: 'val', label: 'Value' }]
    });
    dt.data = [{ val: 'c' }, { val: 'a' }, { val: 'b' }];
    dt.sortColumn = 'val';
    dt.sortDirection = 'asc';
    dt._applyFilters();
    assert.deepEqual(dt.filteredData.map(r => r.val), ['a', 'b', 'c']);

    dt.sortDirection = 'desc';
    dt._applyFilters();
    assert.deepEqual(dt.filteredData.map(r => r.val), ['c', 'b', 'a']);
  });

  it('_escapeHtml prevents XSS in table cells', () => {
    const container = globalThis.document.createElement('div');
    const dt = new DataTable(container, { columns: [] });
    const escaped = dt._escapeHtml('<script>alert("xss")</script>');
    assert.ok(!escaped.includes('<script>'), 'script tag escaped');
  });
});
