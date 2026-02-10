/**
 * VocalIA DB API Tests
 *
 * Tests:
 * - filterUserRecord (strips sensitive fields — SECURITY CRITICAL)
 * - filterUserRecords (array version)
 * - getCorsHeaders (CORS origin validation — SECURITY CRITICAL)
 * - ALLOWED_SHEETS whitelist (access control)
 * - CORS_ALLOWED_ORIGINS whitelist (no wildcard)
 * - parseBody (JSON stream parsing, error handling)
 * - sendJson / sendError (response formatting)
 * - Route pattern regex validation (URL → params extraction)
 * - handleRequest (OPTIONS preflight, 404 fallback)
 *
 * Run: node --test test/db-api.test.mjs
 */


import { test, describe } from 'node:test';
import assert from 'node:assert';
import { EventEmitter } from 'events';
import dbApi from '../core/db-api.cjs';

const {
  filterUserRecord,
  filterUserRecords,
  getCorsHeaders,
  parseBody,
  sendJson,
  sendError,
  handleRequest,
  ALLOWED_SHEETS,
  CORS_ALLOWED_ORIGINS
} = dbApi;

// ─── Helper: mock request as EventEmitter ────────────────────────────────────

function createMockReq(body, headers = {}) {
  const req = new EventEmitter();
  req.headers = headers;
  req.method = 'POST';
  req.url = '/test';
  // Emit body data asynchronously
  if (body !== undefined) {
    process.nextTick(() => {
      if (body !== null) req.emit('data', typeof body === 'string' ? body : JSON.stringify(body));
      req.emit('end');
    });
  }
  return req;
}

// ─── Helper: mock response ───────────────────────────────────────────────────

function createMockRes(corsReq) {
  const res = {
    _corsReq: corsReq || { headers: { origin: 'https://vocalia.ma' } },
    _statusCode: null,
    _headers: null,
    _body: null,
    _ended: false,
    writableEnded: false,
    writeHead(code, headers) {
      res._statusCode = code;
      res._headers = headers;
    },
    end(body) {
      res._body = body;
      res._ended = true;
      res.writableEnded = true;
    }
  };
  return res;
}

// ─── parseBody ───────────────────────────────────────────────────────────────

describe('DB API parseBody', () => {
  test('parses valid JSON body', async () => {
    const req = createMockReq({ name: 'Test', value: 42 });
    const result = await parseBody(req);
    assert.deepStrictEqual(result, { name: 'Test', value: 42 });
  });

  test('returns empty object for empty body', async () => {
    const req = createMockReq(null); // no data, just end
    const result = await parseBody(req);
    assert.deepStrictEqual(result, {});
  });

  test('rejects invalid JSON', async () => {
    const req = new EventEmitter();
    process.nextTick(() => {
      req.emit('data', 'not-json{{{');
      req.emit('end');
    });
    await assert.rejects(() => parseBody(req), { message: 'Invalid JSON' });
  });

  test('parses nested objects', async () => {
    const data = { tenant: { id: 't1', config: { lang: 'fr' } }, tags: ['a', 'b'] };
    const req = createMockReq(data);
    const result = await parseBody(req);
    assert.deepStrictEqual(result, data);
  });

  test('parses string body (valid JSON string)', async () => {
    const req = createMockReq('"hello"');
    // "hello" is valid JSON — a string literal
    req.removeAllListeners();
    process.nextTick(() => {
      req.emit('data', '"hello"');
      req.emit('end');
    });
    const result = await parseBody(req);
    assert.strictEqual(result, 'hello');
  });

  test('parses array body', async () => {
    const req = new EventEmitter();
    process.nextTick(() => {
      req.emit('data', '[1,2,3]');
      req.emit('end');
    });
    const result = await parseBody(req);
    assert.deepStrictEqual(result, [1, 2, 3]);
  });

  test('rejects on stream error', async () => {
    const req = new EventEmitter();
    process.nextTick(() => {
      req.emit('error', new Error('Connection reset'));
    });
    await assert.rejects(() => parseBody(req), { message: 'Connection reset' });
  });

  test('handles chunked data', async () => {
    const req = new EventEmitter();
    process.nextTick(() => {
      req.emit('data', '{"na');
      req.emit('data', 'me":"ch');
      req.emit('data', 'unked"}');
      req.emit('end');
    });
    const result = await parseBody(req);
    assert.deepStrictEqual(result, { name: 'chunked' });
  });
});

// ─── sendJson ────────────────────────────────────────────────────────────────

describe('DB API sendJson', () => {
  test('sets status code', () => {
    const res = createMockRes();
    sendJson(res, 200, { ok: true });
    assert.strictEqual(res._statusCode, 200);
  });

  test('sets 201 for creation', () => {
    const res = createMockRes();
    sendJson(res, 201, { id: '123' });
    assert.strictEqual(res._statusCode, 201);
  });

  test('serializes body as JSON', () => {
    const res = createMockRes();
    sendJson(res, 200, { data: [1, 2, 3] });
    assert.strictEqual(res._body, '{"data":[1,2,3]}');
  });

  test('includes CORS headers from req origin', () => {
    const req = { headers: { origin: 'https://app.vocalia.ma' } };
    const res = createMockRes(req);
    sendJson(res, 200, {});
    assert.strictEqual(res._headers['Access-Control-Allow-Origin'], 'https://app.vocalia.ma');
  });

  test('ends response', () => {
    const res = createMockRes();
    sendJson(res, 200, {});
    assert.ok(res._ended);
  });
});

// ─── sendError ───────────────────────────────────────────────────────────────

describe('DB API sendError', () => {
  test('sends 400 with error message', () => {
    const res = createMockRes();
    sendError(res, 400, 'Bad request');
    assert.strictEqual(res._statusCode, 400);
    const body = JSON.parse(res._body);
    assert.strictEqual(body.error, 'Bad request');
  });

  test('sends 401 for auth error', () => {
    const res = createMockRes();
    sendError(res, 401, 'Unauthorized');
    assert.strictEqual(res._statusCode, 401);
    assert.strictEqual(JSON.parse(res._body).error, 'Unauthorized');
  });

  test('sends 403 for forbidden', () => {
    const res = createMockRes();
    sendError(res, 403, 'Admin access required');
    assert.strictEqual(res._statusCode, 403);
    assert.strictEqual(JSON.parse(res._body).error, 'Admin access required');
  });

  test('sends 404 for not found', () => {
    const res = createMockRes();
    sendError(res, 404, 'Not found');
    assert.strictEqual(res._statusCode, 404);
    assert.strictEqual(JSON.parse(res._body).error, 'Not found');
  });

  test('sends 500 with generic message (P4: no internal detail leakage)', () => {
    const res = createMockRes();
    sendError(res, 500, 'Some internal detail that should be hidden');
    assert.strictEqual(res._statusCode, 500);
    // P4 fix: 500 errors MUST return generic message, never internal details
    assert.strictEqual(JSON.parse(res._body).error, 'Internal server error');
  });
});

// ─── ALLOWED_SHEETS ─────────────────────────────────────────────────────────

describe('DB API ALLOWED_SHEETS', () => {
  test('has exactly 7 allowed sheets', () => {
    assert.strictEqual(ALLOWED_SHEETS.length, 7);
  });

  test('contains all expected sheets', () => {
    const expected = ['tenants', 'sessions', 'logs', 'users', 'auth_sessions', 'hitl_pending', 'hitl_history'];
    for (const sheet of expected) {
      assert.ok(ALLOWED_SHEETS.includes(sheet), `Missing sheet: ${sheet}`);
    }
  });

  test('does NOT include dangerous sheets', () => {
    const dangerous = ['admin', 'secrets', 'credentials', 'passwords', 'tokens', 'config'];
    for (const sheet of dangerous) {
      assert.ok(!ALLOWED_SHEETS.includes(sheet), `Should NOT include: ${sheet}`);
    }
  });

  test('all sheet names are lowercase alphanumeric + underscore', () => {
    for (const sheet of ALLOWED_SHEETS) {
      assert.match(sheet, /^[a-z_]+$/, `Sheet "${sheet}" should be lowercase with underscores only`);
    }
  });
});

// ─── CORS_ALLOWED_ORIGINS ───────────────────────────────────────────────────

describe('DB API CORS_ALLOWED_ORIGINS', () => {
  test('has exactly 4 allowed origins', () => {
    assert.strictEqual(CORS_ALLOWED_ORIGINS.length, 4);
  });

  test('contains all expected origins', () => {
    const expected = ['https://vocalia.ma', 'https://www.vocalia.ma', 'https://api.vocalia.ma', 'https://app.vocalia.ma'];
    for (const origin of expected) {
      assert.ok(CORS_ALLOWED_ORIGINS.includes(origin), `Missing origin: ${origin}`);
    }
  });

  test('does NOT include wildcard *', () => {
    assert.ok(!CORS_ALLOWED_ORIGINS.includes('*'));
  });

  test('all origins use HTTPS', () => {
    for (const origin of CORS_ALLOWED_ORIGINS) {
      assert.ok(origin.startsWith('https://'), `${origin} should use HTTPS`);
    }
  });

  test('all origins are vocalia.ma subdomains', () => {
    for (const origin of CORS_ALLOWED_ORIGINS) {
      assert.ok(origin.includes('vocalia.ma'), `${origin} should be vocalia.ma domain`);
    }
  });
});

// ─── getCorsHeaders ─────────────────────────────────────────────────────────

describe('DB API getCorsHeaders', () => {
  test('allows vocalia.ma origin', () => {
    const headers = getCorsHeaders({ headers: { origin: 'https://vocalia.ma' } });
    assert.strictEqual(headers['Access-Control-Allow-Origin'], 'https://vocalia.ma');
  });

  test('allows www.vocalia.ma origin', () => {
    const headers = getCorsHeaders({ headers: { origin: 'https://www.vocalia.ma' } });
    assert.strictEqual(headers['Access-Control-Allow-Origin'], 'https://www.vocalia.ma');
  });

  test('allows app.vocalia.ma origin', () => {
    const headers = getCorsHeaders({ headers: { origin: 'https://app.vocalia.ma' } });
    assert.strictEqual(headers['Access-Control-Allow-Origin'], 'https://app.vocalia.ma');
  });

  test('allows api.vocalia.ma origin', () => {
    const headers = getCorsHeaders({ headers: { origin: 'https://api.vocalia.ma' } });
    assert.strictEqual(headers['Access-Control-Allow-Origin'], 'https://api.vocalia.ma');
  });

  test('allows localhost for development', () => {
    const headers = getCorsHeaders({ headers: { origin: 'http://localhost:3000' } });
    assert.strictEqual(headers['Access-Control-Allow-Origin'], 'http://localhost:3000');
  });

  test('allows localhost on any port', () => {
    for (const port of [3004, 3013, 8080, 5173]) {
      const headers = getCorsHeaders({ headers: { origin: `http://localhost:${port}` } });
      assert.strictEqual(headers['Access-Control-Allow-Origin'], `http://localhost:${port}`);
    }
  });

  test('allows 127.0.0.1 for development', () => {
    const headers = getCorsHeaders({ headers: { origin: 'http://127.0.0.1:8080' } });
    assert.strictEqual(headers['Access-Control-Allow-Origin'], 'http://127.0.0.1:8080');
  });

  test('rejects unknown origin — returns first allowed', () => {
    const headers = getCorsHeaders({ headers: { origin: 'https://evil.com' } });
    assert.strictEqual(headers['Access-Control-Allow-Origin'], CORS_ALLOWED_ORIGINS[0]);
  });

  test('rejects HTTP vocalia.ma (not HTTPS)', () => {
    const headers = getCorsHeaders({ headers: { origin: 'http://vocalia.ma' } });
    // http://vocalia.ma is not in allowed list and doesn't start with http://localhost
    assert.strictEqual(headers['Access-Control-Allow-Origin'], CORS_ALLOWED_ORIGINS[0]);
  });

  test('rejects empty origin', () => {
    const headers = getCorsHeaders({ headers: { origin: '' } });
    assert.strictEqual(headers['Access-Control-Allow-Origin'], CORS_ALLOWED_ORIGINS[0]);
  });

  test('handles missing origin header', () => {
    const headers = getCorsHeaders({ headers: {} });
    assert.strictEqual(headers['Access-Control-Allow-Origin'], CORS_ALLOWED_ORIGINS[0]);
  });

  test('handles null request', () => {
    const headers = getCorsHeaders(null);
    assert.strictEqual(headers['Access-Control-Allow-Origin'], CORS_ALLOWED_ORIGINS[0]);
  });

  test('never returns wildcard * for any origin', () => {
    const testOrigins = [
      'https://vocalia.ma', 'https://evil.com', '', 'http://localhost:3000',
      'https://subdomain.evil.com', '*', 'null'
    ];
    for (const origin of testOrigins) {
      const headers = getCorsHeaders({ headers: { origin } });
      assert.notStrictEqual(headers['Access-Control-Allow-Origin'], '*',
        `Should never return * for origin "${origin}"`);
    }
  });

  test('includes GET POST PUT DELETE OPTIONS methods', () => {
    const headers = getCorsHeaders({ headers: { origin: 'https://vocalia.ma' } });
    const methods = headers['Access-Control-Allow-Methods'];
    for (const m of ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']) {
      assert.ok(methods.includes(m), `Missing method: ${m}`);
    }
  });

  test('includes Authorization and Content-Type headers', () => {
    const headers = getCorsHeaders({ headers: { origin: 'https://vocalia.ma' } });
    assert.ok(headers['Access-Control-Allow-Headers'].includes('Authorization'));
    assert.ok(headers['Access-Control-Allow-Headers'].includes('Content-Type'));
  });

  test('Content-Type is application/json', () => {
    const headers = getCorsHeaders({ headers: {} });
    assert.strictEqual(headers['Content-Type'], 'application/json');
  });
});

// ─── filterUserRecord ───────────────────────────────────────────────────────

describe('DB API filterUserRecord', () => {
  const SENSITIVE_FIELDS = [
    'password_hash', 'password_reset_token', 'password_reset_expires',
    'email_verify_token', 'email_verify_expires'
  ];

  test('strips all 5 sensitive fields', () => {
    const record = {
      id: '1', email: 'test@test.com', name: 'User',
      password_hash: 'bcrypt_hash_here',
      password_reset_token: 'reset_tok',
      password_reset_expires: '2026-12-31',
      email_verify_token: 'verify_tok',
      email_verify_expires: '2026-12-31'
    };
    const filtered = filterUserRecord(record);
    for (const field of SENSITIVE_FIELDS) {
      assert.ok(!(field in filtered), `Should strip ${field}`);
    }
    assert.strictEqual(Object.keys(filtered).length, 3); // id, email, name
  });

  for (const field of SENSITIVE_FIELDS) {
    test(`strips ${field}`, () => {
      const record = { id: '1', [field]: 'secret_value' };
      const filtered = filterUserRecord(record);
      assert.ok(!(field in filtered));
      assert.strictEqual(filtered.id, '1');
    });
  }

  test('preserves safe fields', () => {
    const record = { id: '1', email: 'a@b.com', name: 'Jean', role: 'user', tenant_id: 't1', created_at: '2026-01-01' };
    const filtered = filterUserRecord(record);
    assert.strictEqual(filtered.id, '1');
    assert.strictEqual(filtered.email, 'a@b.com');
    assert.strictEqual(filtered.name, 'Jean');
    assert.strictEqual(filtered.role, 'user');
    assert.strictEqual(filtered.tenant_id, 't1');
    assert.strictEqual(filtered.created_at, '2026-01-01');
  });

  test('returns null for null input', () => {
    assert.strictEqual(filterUserRecord(null), null);
  });

  test('returns undefined for undefined input', () => {
    assert.strictEqual(filterUserRecord(undefined), undefined);
  });

  test('handles record with no sensitive fields (passthrough)', () => {
    const record = { id: '1', email: 'a@b.com' };
    const filtered = filterUserRecord(record);
    assert.deepStrictEqual(filtered, record);
  });
});

// ─── filterUserRecords ──────────────────────────────────────────────────────

describe('DB API filterUserRecords', () => {
  test('filters array of records', () => {
    const records = [
      { id: '1', email: 'a@b.com', password_hash: 'h1' },
      { id: '2', email: 'c@d.com', password_hash: 'h2', email_verify_token: 'tok' }
    ];
    const filtered = filterUserRecords(records);
    assert.strictEqual(filtered.length, 2);
    assert.ok(!('password_hash' in filtered[0]));
    assert.ok(!('password_hash' in filtered[1]));
    assert.ok(!('email_verify_token' in filtered[1]));
  });

  test('handles empty array', () => {
    assert.deepStrictEqual(filterUserRecords([]), []);
  });

  test('preserves array order', () => {
    const records = [
      { id: '1', email: 'first@test.com', password_hash: 'h1' },
      { id: '2', email: 'second@test.com', password_hash: 'h2' },
      { id: '3', email: 'third@test.com', password_hash: 'h3' }
    ];
    const filtered = filterUserRecords(records);
    assert.strictEqual(filtered[0].email, 'first@test.com');
    assert.strictEqual(filtered[1].email, 'second@test.com');
    assert.strictEqual(filtered[2].email, 'third@test.com');
  });
});

// ─── Route Pattern Regex Validation ─────────────────────────────────────────

describe('DB API route patterns', () => {
  // These test the actual regex patterns used in handleRequest to extract URL params

  test('billing route extracts tenant ID', () => {
    const pattern = /^\/api\/tenants\/(\w+)\/billing$/;
    const match = '/api/tenants/my_tenant_123/billing'.match(pattern);
    assert.ok(match);
    assert.strictEqual(match[1], 'my_tenant_123');
  });

  test('billing portal route extracts tenant ID', () => {
    const pattern = /^\/api\/tenants\/(\w+)\/billing\/portal$/;
    const match = '/api/tenants/agency_internal/billing/portal'.match(pattern);
    assert.ok(match);
    assert.strictEqual(match[1], 'agency_internal');
  });

  test('KB list route extracts tenant ID', () => {
    const pattern = /^\/api\/tenants\/(\w+)\/kb$/;
    const match = '/api/tenants/b2c_dental_france_02/kb'.match(pattern);
    assert.ok(match);
    assert.strictEqual(match[1], 'b2c_dental_france_02');
  });

  test('KB delete route extracts tenant ID and key', () => {
    const pattern = /^\/api\/tenants\/(\w+)\/kb\/(\w+)$/;
    const match = '/api/tenants/t1/kb/pricing'.match(pattern);
    assert.ok(match);
    assert.strictEqual(match[1], 't1');
    assert.strictEqual(match[2], 'pricing');
  });

  test('KB search route extracts tenant ID', () => {
    const pattern = /^\/api\/tenants\/(\w+)\/kb\/search$/;
    const match = '/api/tenants/t1/kb/search'.match(pattern);
    assert.ok(match);
    assert.strictEqual(match[1], 't1');
  });

  test('KB quota route extracts tenant ID', () => {
    const pattern = /^\/api\/tenants\/(\w+)\/kb\/quota$/;
    const match = '/api/tenants/tenant_abc/kb/quota'.match(pattern);
    assert.ok(match);
    assert.strictEqual(match[1], 'tenant_abc');
  });

  test('KB import route extracts tenant ID', () => {
    const pattern = /^\/api\/tenants\/(\w+)\/kb\/import$/;
    const match = '/api/tenants/t1/kb/import'.match(pattern);
    assert.ok(match);
    assert.strictEqual(match[1], 't1');
  });

  test('KB rebuild-index route extracts tenant ID', () => {
    const pattern = /^\/api\/tenants\/(\w+)\/kb\/rebuild-index$/;
    assert.ok('/api/tenants/t1/kb/rebuild-index'.match(pattern));
    // But plain kb/ should NOT match
    assert.ok(!'/api/tenants/t1/kb'.match(pattern));
  });

  test('KB crawl route extracts tenant ID', () => {
    const pattern = /^\/api\/tenants\/(\w+)\/kb\/crawl$/;
    assert.ok('/api/tenants/t1/kb/crawl'.match(pattern));
    assert.ok(!'/api/tenants/t1/kb/crawl/extra'.match(pattern));
  });

  test('catalog list route extracts tenant ID', () => {
    const pattern = /^\/api\/tenants\/(\w+)\/catalog$/;
    const match = '/api/tenants/ecom_fashion_paris_01/catalog'.match(pattern);
    assert.ok(match);
    assert.strictEqual(match[1], 'ecom_fashion_paris_01');
  });

  test('catalog item route extracts tenant ID and item ID', () => {
    const pattern = /^\/api\/tenants\/(\w+)\/catalog\/([^/]+)$/;
    const match = '/api/tenants/t1/catalog/item_123'.match(pattern);
    assert.ok(match);
    assert.strictEqual(match[1], 't1');
    assert.strictEqual(match[2], 'item_123');
  });

  test('catalog import route extracts tenant ID', () => {
    const pattern = /^\/api\/tenants\/(\w+)\/catalog\/import$/;
    assert.ok('/api/tenants/t1/catalog/import'.match(pattern));
  });

  test('catalog sync route extracts tenant ID', () => {
    const pattern = /^\/api\/tenants\/(\w+)\/catalog\/sync$/;
    assert.ok('/api/tenants/t1/catalog/sync'.match(pattern));
  });

  test('catalog detail route extracts tenant ID and item ID', () => {
    const pattern = /^\/api\/tenants\/(\w+)\/catalog\/detail\/([^/]+)$/;
    const match = '/api/tenants/t1/catalog/detail/prod_xyz'.match(pattern);
    assert.ok(match);
    assert.strictEqual(match[1], 't1');
    assert.strictEqual(match[2], 'prod_xyz');
  });

  test('catalog browse route extracts tenant ID', () => {
    const pattern = /^\/api\/tenants\/(\w+)\/catalog\/browse$/;
    assert.ok('/api/tenants/t1/catalog/browse'.match(pattern));
  });

  test('catalog search route extracts tenant ID', () => {
    const pattern = /^\/api\/tenants\/(\w+)\/catalog\/search$/;
    assert.ok('/api/tenants/t1/catalog/search'.match(pattern));
  });

  test('catalog recommendations route extracts tenant ID', () => {
    const pattern = /^\/api\/tenants\/(\w+)\/catalog\/recommendations$/;
    assert.ok('/api/tenants/t1/catalog/recommendations'.match(pattern));
  });

  test('connector config route extracts tenant ID', () => {
    const pattern = /^\/api\/tenants\/(\w+)\/catalog\/connector$/;
    assert.ok('/api/tenants/t1/catalog/connector'.match(pattern));
  });

  test('conversation list route extracts tenant ID', () => {
    const pattern = /^\/api\/tenants\/(\w+)\/conversations$/;
    const match = '/api/tenants/t1/conversations'.match(pattern);
    assert.ok(match);
    assert.strictEqual(match[1], 't1');
  });

  test('conversation detail route extracts tenant ID and session ID', () => {
    const pattern = /^\/api\/tenants\/(\w+)\/conversations\/([^/]+)$/;
    const match = '/api/tenants/t1/conversations/sess_abc123'.match(pattern);
    assert.ok(match);
    assert.strictEqual(match[1], 't1');
    assert.strictEqual(match[2], 'sess_abc123');
  });

  test('conversation export route extracts tenant ID', () => {
    const pattern = /^\/api\/tenants\/(\w+)\/conversations\/export$/;
    assert.ok('/api/tenants/t1/conversations/export'.match(pattern));
  });

  test('export download route validates filename with extension', () => {
    const pattern = /^\/api\/exports\/([^/]+\.(csv|xlsx|pdf))$/;
    assert.ok('/api/exports/report_2026.csv'.match(pattern));
    assert.ok('/api/exports/data.xlsx'.match(pattern));
    assert.ok('/api/exports/summary.pdf'.match(pattern));
    // Should NOT match other extensions
    assert.ok(!'/api/exports/script.js'.match(pattern));
    assert.ok(!'/api/exports/hack.php'.match(pattern));
    assert.ok(!'/api/exports/../etc/passwd'.match(pattern));
  });

  test('HITL approve route extracts ID', () => {
    const pattern = /^\/api\/hitl\/approve\/(\w+)$/;
    const match = '/api/hitl/approve/hitl_001'.match(pattern);
    assert.ok(match);
    assert.strictEqual(match[1], 'hitl_001');
  });

  test('HITL reject route extracts ID', () => {
    const pattern = /^\/api\/hitl\/reject\/(\w+)$/;
    const match = '/api/hitl/reject/hitl_002'.match(pattern);
    assert.ok(match);
    assert.strictEqual(match[1], 'hitl_002');
  });

  test('DB sheet route extracts sheet name', () => {
    const pattern = /^\/api\/db\/(\w+)(?:\/(\w+))?$/;
    const match = '/api/db/tenants'.match(pattern);
    assert.ok(match);
    assert.strictEqual(match[1], 'tenants');
    assert.strictEqual(match[2], undefined);
  });

  test('DB sheet+ID route extracts both', () => {
    const pattern = /^\/api\/db\/(\w+)(?:\/(\w+))?$/;
    const match = '/api/db/users/usr_123'.match(pattern);
    assert.ok(match);
    assert.strictEqual(match[1], 'users');
    assert.strictEqual(match[2], 'usr_123');
  });

  test('DB route rejects path traversal', () => {
    const pattern = /^\/api\/db\/(\w+)(?:\/(\w+))?$/;
    // \w+ only matches [a-zA-Z0-9_], so these should NOT match
    assert.ok(!'/api/db/../secrets'.match(pattern));
    assert.ok(!'/api/db/ten-ants'.match(pattern)); // hyphen not in \w
    assert.ok(!'/api/db/users/../../etc'.match(pattern));
  });

  test('widget interactions route extracts tenant ID', () => {
    const pattern = /^\/api\/tenants\/([^\/]+)\/widget\/interactions$/;
    const match = '/api/tenants/t1/widget/interactions'.match(pattern);
    assert.ok(match);
    assert.strictEqual(match[1], 't1');
  });

  test('UCP profiles route extracts tenant ID', () => {
    const pattern = /^\/api\/tenants\/([^\/]+)\/ucp\/profiles$/;
    const match = '/api/tenants/t1/ucp/profiles'.match(pattern);
    assert.ok(match);
    assert.strictEqual(match[1], 't1');
  });
});

// ─── handleRequest: OPTIONS preflight ───────────────────────────────────────

describe('DB API handleRequest OPTIONS', () => {
  test('OPTIONS returns 204 with CORS headers', async () => {
    const req = new EventEmitter();
    req.method = 'OPTIONS';
    req.url = '/api/db/tenants';
    req.headers = { origin: 'https://vocalia.ma' };

    const res = createMockRes(req);
    // Override writeHead to capture headers properly
    let capturedCode, capturedHeaders;
    res.writeHead = (code, headers) => { capturedCode = code; capturedHeaders = headers; };
    res.end = () => { res._ended = true; };

    await handleRequest(req, res);

    assert.strictEqual(capturedCode, 204);
    assert.strictEqual(capturedHeaders['Access-Control-Allow-Origin'], 'https://vocalia.ma');
    assert.ok(capturedHeaders['Access-Control-Allow-Methods'].includes('GET'));
    assert.ok(res._ended);
  });

  test('OPTIONS for unknown path still returns 204', async () => {
    const req = new EventEmitter();
    req.method = 'OPTIONS';
    req.url = '/api/whatever';
    req.headers = { origin: 'https://vocalia.ma' };

    let capturedCode;
    const res = { writeHead: (code) => { capturedCode = code; }, end: () => {}, _corsReq: req };

    await handleRequest(req, res);
    assert.strictEqual(capturedCode, 204);
  });
});

// ─── handleRequest: 404 fallback ────────────────────────────────────────────

describe('DB API handleRequest 404', () => {
  test('unknown path returns 404', async () => {
    const req = new EventEmitter();
    req.method = 'GET';
    req.url = '/api/nonexistent/route';
    req.headers = { origin: 'https://vocalia.ma' };

    const res = createMockRes(req);
    await handleRequest(req, res);

    assert.strictEqual(res._statusCode, 404);
    const body = JSON.parse(res._body);
    assert.strictEqual(body.error, 'Not found');
  });

  test('root path returns 404', async () => {
    const req = new EventEmitter();
    req.method = 'GET';
    req.url = '/';
    req.headers = {};

    const res = createMockRes(req);
    await handleRequest(req, res);

    assert.strictEqual(res._statusCode, 404);
  });
});

// ─── Security: Admin-only sheets validation ─────────────────────────────────

describe('DB API admin-only sheets', () => {
  // These sheets require admin role (verified in handleRequest at line 2507)
  const adminSheets = ['users', 'auth_sessions', 'hitl_pending', 'hitl_history'];
  const publicSheets = ['tenants', 'sessions', 'logs'];

  test('admin-only sheets are subset of ALLOWED_SHEETS', () => {
    for (const sheet of adminSheets) {
      assert.ok(ALLOWED_SHEETS.includes(sheet), `Admin sheet ${sheet} should be in ALLOWED_SHEETS`);
    }
  });

  test('public sheets are subset of ALLOWED_SHEETS', () => {
    for (const sheet of publicSheets) {
      assert.ok(ALLOWED_SHEETS.includes(sheet), `Public sheet ${sheet} should be in ALLOWED_SHEETS`);
    }
  });

  test('admin + public sheets = total ALLOWED_SHEETS', () => {
    const all = [...adminSheets, ...publicSheets];
    assert.strictEqual(all.length, ALLOWED_SHEETS.length);
    for (const sheet of ALLOWED_SHEETS) {
      assert.ok(all.includes(sheet), `${sheet} should be in either admin or public list`);
    }
  });
});

// ─── Exports validation ─────────────────────────────────────────────────────

describe('DB API exports completeness', () => {
  const expectedExports = [
    'startServer', 'handleRequest', 'broadcast', 'broadcastToTenant', 'wsClients',
    'filterUserRecord', 'filterUserRecords', 'getCorsHeaders', 'parseBody', 'sendJson', 'sendError',
    'ALLOWED_SHEETS', 'CORS_ALLOWED_ORIGINS'
  ];

  test(`exports all ${expectedExports.length} expected members`, () => {
    for (const name of expectedExports) {
      assert.ok(name in dbApi, `Missing export: ${name}`);
    }
  });

  test('functions are callable', () => {
    const fnExports = expectedExports.filter(n => typeof dbApi[n] === 'function');
    assert.ok(fnExports.length >= 9, `Expected ≥9 function exports, got ${fnExports.length}`);
  });
});
