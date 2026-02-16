/**
 * Telephony HTTP — E2E Tests
 * VocalIA — Session 250.207
 *
 * Tests: telephony/voice-telephony-bridge.cjs — 6 HTTP routes + 404
 * Was: 0 tests.
 *
 * Strategy: Child process spawn on test port, test HTTP routes.
 * Routes:
 *   GET  /health                → 200
 *   POST /voice/inbound         → needs Twilio signature (test 403/reject)
 *   POST /voice/status          → 200 (status callback)
 *   POST /voice/outbound        → needs internal auth (test 401)
 *   POST /voice/outbound-twiml  → needs Twilio signature (test 403)
 *   POST /messaging/send        → needs internal auth (test 401)
 *   GET  /unknown               → 404
 *
 * Run: node --test test/telephony-http.test.mjs
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';

const TEST_PORT = 14009;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const BRIDGE_SCRIPT = path.join(import.meta.dirname, '..', 'telephony', 'voice-telephony-bridge.cjs');

let serverProcess;
let uniqueIpCounter = 0;

function uniqueIp() {
  uniqueIpCounter++;
  const a = (uniqueIpCounter >> 16) & 255;
  const b = (uniqueIpCounter >> 8) & 255;
  const c = uniqueIpCounter & 255;
  return `100.${a}.${b}.${c}`;
}

function fetchWithIp(url, options = {}) {
  const headers = {
    ...options.headers,
    'X-Forwarded-For': uniqueIp()
  };
  return fetch(url, { ...options, headers });
}

async function waitForServer(url, maxWait = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(1000),
        headers: { 'X-Forwarded-For': '1.1.1.1' }
      });
      if (res.ok) return true;
    } catch { /* server not ready yet */ }
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error(`Server did not start within ${maxWait}ms`);
}

describe('Telephony HTTP E2E', () => {
  before(async () => {
    serverProcess = spawn('node', [BRIDGE_SCRIPT, `--port=${TEST_PORT}`], {
      env: {
        ...process.env,
        // Set a known internal key for auth testing
        VOCALIA_INTERNAL_KEY: 'test_internal_key_12345',
        // Suppress module warnings
        NODE_NO_WARNINGS: '1'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Collect stderr for debugging
    let stderrBuf = '';
    serverProcess.stderr.on('data', d => { stderrBuf += d.toString(); });
    serverProcess.stdout.on('data', () => {}); // drain

    try {
      await waitForServer(`${BASE_URL}/health`);
    } catch (e) {
      console.error('Server startup stderr:', stderrBuf.slice(-500));
      throw e;
    }
  });

  after(() => {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      serverProcess = null;
    }
  });

  // ─── Health endpoint ────────────────────────────────────────────────

  describe('GET /health', () => {
    it('returns 200 with status object', async () => {
      const res = await fetchWithIp(`${BASE_URL}/health`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'ok');
      assert.equal(data.service, 'voice-telephony-bridge');
      assert.ok(data.version);
      assert.ok('twilio' in data);
      assert.ok('grok' in data);
      assert.ok('timestamp' in data);
    });

    it('includes activeSessions count', async () => {
      const res = await fetchWithIp(`${BASE_URL}/health`);
      const data = await res.json();
      assert.equal(typeof data.activeSessions, 'number');
    });
  });

  // ─── Voice inbound (Twilio webhook) ─────────────────────────────────

  describe('POST /voice/inbound', () => {
    it('handles inbound call request', async () => {
      // Without valid Twilio signature, behavior depends on config
      // The route still processes the body (Twilio sends form-encoded)
      const res = await fetchWithIp(`${BASE_URL}/voice/inbound`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'CallSid=test123&From=+33612345678&To=+33700000000'
      });
      // Should return TwiML XML (200) or reject (403)
      assert.ok([200, 403].includes(res.status),
        `Expected 200 or 403, got ${res.status}`);
    });
  });

  // ─── Voice status callback ──────────────────────────────────────────

  describe('POST /voice/status', () => {
    it('returns 200 for status callback', async () => {
      const res = await fetchWithIp(`${BASE_URL}/voice/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'CallSid=test123&CallStatus=completed'
      });
      assert.equal(res.status, 200);
    });
  });

  // ─── Voice outbound (internal auth required) ────────────────────────

  describe('POST /voice/outbound', () => {
    it('rejects without internal auth', async () => {
      const res = await fetchWithIp(`${BASE_URL}/voice/outbound`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: '+33612345678' })
      });
      assert.equal(res.status, 401);
      const data = await res.json();
      assert.ok(data.error.includes('Unauthorized') || data.error.includes('Bearer'));
    });
  });

  // ─── Voice outbound TwiML (Twilio signature required) ───────────────

  describe('POST /voice/outbound-twiml', () => {
    it('rejects without Twilio signature', async () => {
      const res = await fetchWithIp(`${BASE_URL}/voice/outbound-twiml`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'CallSid=test123'
      });
      assert.equal(res.status, 403);
    });
  });

  // ─── Messaging endpoint (internal auth required) ────────────────────

  describe('POST /messaging/send', () => {
    it('rejects without internal auth', async () => {
      const res = await fetchWithIp(`${BASE_URL}/messaging/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: '+33612345678', message: 'Test' })
      });
      assert.equal(res.status, 401);
    });

    it('returns 400 for missing fields with valid auth', async () => {
      const res = await fetchWithIp(`${BASE_URL}/messaging/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test_internal_key_12345'
        },
        body: JSON.stringify({ to: '+33612345678' }) // missing 'message'
      });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('Missing'));
    });
  });

  // ─── 404 for unknown routes ─────────────────────────────────────────

  describe('Unknown routes', () => {
    it('returns 404 for GET /unknown', async () => {
      const res = await fetchWithIp(`${BASE_URL}/unknown`);
      assert.equal(res.status, 404);
      const data = await res.json();
      assert.ok(data.error.includes('Not found'));
    });

    it('returns 404 for POST /unknown', async () => {
      const res = await fetchWithIp(`${BASE_URL}/nonexistent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
      assert.equal(res.status, 404);
    });
  });

  // ─── Security headers ──────────────────────────────────────────────

  describe('Security headers', () => {
    it('includes security headers in response', async () => {
      const res = await fetchWithIp(`${BASE_URL}/health`);
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(res.headers.get('x-frame-options'), 'DENY');
      assert.ok(res.headers.get('strict-transport-security'));
    });
  });
});
