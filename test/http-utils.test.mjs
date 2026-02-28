import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseBody, sendJson, sendError } = require('../core/http-utils.cjs');

// ─── Mock Request (readable stream) ──────────────────────────

function createMockReq(body, { chunkSize = 1024 } = {}) {
  const emitter = new EventEmitter();
  process.nextTick(() => {
    if (body !== null && body !== undefined) {
      const str = typeof body === 'string' ? body : JSON.stringify(body);
      for (let i = 0; i < str.length; i += chunkSize) {
        emitter.emit('data', Buffer.from(str.slice(i, i + chunkSize)));
      }
    }
    emitter.emit('end');
  });
  emitter.destroy = () => {};
  return emitter;
}

// ─── Mock Response ───────────────────────────────────────────

function createMockRes(corsHeaders) {
  const res = {
    _corsHeaders: corsHeaders || {},
    _statusCode: null,
    _headers: {},
    _body: '',
    writeHead(code, headers) {
      res._statusCode = code;
      res._headers = headers;
    },
    end(data) {
      res._body = data || '';
    }
  };
  return res;
}

// ═══════════════════════════════════════════════════════════════
// parseBody
// ═══════════════════════════════════════════════════════════════

describe('http-utils — parseBody', () => {
  it('parses valid JSON body', async () => {
    const req = createMockReq({ name: 'test', value: 42 });
    const result = await parseBody(req);
    assert.deepEqual(result, { name: 'test', value: 42 });
  });

  it('returns empty object for empty body', async () => {
    const req = createMockReq('');
    const result = await parseBody(req);
    assert.deepEqual(result, {});
  });

  it('returns empty object for null body', async () => {
    const req = createMockReq(null);
    const result = await parseBody(req);
    assert.deepEqual(result, {});
  });

  it('rejects invalid JSON', async () => {
    const req = createMockReq('not-json{{{');
    await assert.rejects(() => parseBody(req), { message: 'Invalid JSON' });
  });

  it('rejects body exceeding maxBodySize', async () => {
    const bigBody = 'x'.repeat(200);
    const req = createMockReq(bigBody, { chunkSize: 50 });
    await assert.rejects(() => parseBody(req, 100), /too large/);
  });

  it('uses default maxBodySize of 1MB', async () => {
    const req = createMockReq({ ok: true });
    const result = await parseBody(req);
    assert.deepEqual(result, { ok: true });
  });

  it('handles chunked data', async () => {
    const data = { items: Array.from({ length: 100 }, (_, i) => i) };
    const req = createMockReq(data, { chunkSize: 32 });
    const result = await parseBody(req);
    assert.deepEqual(result, data);
  });

  it('propagates stream errors', async () => {
    const emitter = new EventEmitter();
    emitter.destroy = () => {};
    process.nextTick(() => emitter.emit('error', new Error('stream broke')));
    await assert.rejects(() => parseBody(emitter), { message: 'stream broke' });
  });
});

// ═══════════════════════════════════════════════════════════════
// sendJson
// ═══════════════════════════════════════════════════════════════

describe('http-utils — sendJson', () => {
  it('sends JSON with status 200', () => {
    const res = createMockRes();
    sendJson(res, 200, { success: true });
    assert.equal(res._statusCode, 200);
    assert.equal(res._headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(res._body), { success: true });
  });

  it('includes CORS headers from res._corsHeaders', () => {
    const res = createMockRes({ 'Access-Control-Allow-Origin': '*' });
    sendJson(res, 200, {});
    assert.equal(res._headers['Access-Control-Allow-Origin'], '*');
  });

  it('accepts extra headers', () => {
    const res = createMockRes();
    sendJson(res, 201, { id: 1 }, { 'X-Custom': 'test' });
    assert.equal(res._statusCode, 201);
    assert.equal(res._headers['X-Custom'], 'test');
  });

  it('extra headers override CORS headers', () => {
    const res = createMockRes({ 'X-Foo': 'cors' });
    sendJson(res, 200, {}, { 'X-Foo': 'custom' });
    assert.equal(res._headers['X-Foo'], 'custom');
  });

  it('serializes complex objects', () => {
    const res = createMockRes();
    const data = { nested: { arr: [1, 2], flag: true, nil: null } };
    sendJson(res, 200, data);
    assert.deepEqual(JSON.parse(res._body), data);
  });
});

// ═══════════════════════════════════════════════════════════════
// sendError
// ═══════════════════════════════════════════════════════════════

describe('http-utils — sendError', () => {
  it('sends 400 with original message', () => {
    const res = createMockRes();
    sendError(res, 400, 'Bad request data');
    assert.equal(res._statusCode, 400);
    assert.deepEqual(JSON.parse(res._body), { error: 'Bad request data' });
  });

  it('sends 404 with original message', () => {
    const res = createMockRes();
    sendError(res, 404, 'Not found');
    assert.equal(res._statusCode, 404);
    assert.deepEqual(JSON.parse(res._body), { error: 'Not found' });
  });

  it('masks 500 errors as "Internal server error"', () => {
    const res = createMockRes();
    sendError(res, 500, 'SQL injection trace leaked');
    assert.equal(res._statusCode, 500);
    const body = JSON.parse(res._body);
    assert.equal(body.error, 'Internal server error');
    assert.ok(!body.error.includes('SQL'));
  });

  it('masks 502/503 errors too', () => {
    const res = createMockRes();
    sendError(res, 502, 'upstream DB connection string');
    assert.deepEqual(JSON.parse(res._body), { error: 'Internal server error' });
  });

  it('passes extra headers', () => {
    const res = createMockRes();
    sendError(res, 429, 'Rate limited', { 'Retry-After': '60' });
    assert.equal(res._headers['Retry-After'], '60');
  });

  it('includes CORS headers', () => {
    const res = createMockRes({ 'Access-Control-Allow-Origin': 'https://vocalia.ma' });
    sendError(res, 400, 'bad');
    assert.equal(res._headers['Access-Control-Allow-Origin'], 'https://vocalia.ma');
  });
});
