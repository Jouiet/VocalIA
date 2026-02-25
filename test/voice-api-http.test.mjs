/**
 * Voice API — E2E HTTP Tests
 * VocalIA — Session 250.207
 *
 * Tests: core/voice-api-resilient.cjs — 31+ routes via real HTTP.
 * THIS IS THE CORE PRODUCT. /respond = revenue-generating endpoint.
 * Was: 1 route tested (embed-code only, in install-widget.test.mjs).
 *
 * Strategy: Spawn child process (--server --port=14004) for real HTTP tests.
 * LLM providers are NOT available in test (no API keys) → test validation chain
 * + error behavior when all providers fail.
 *
 * Run: node --test test/voice-api-http.test.mjs
 */

import { describe, it, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const TEST_PORT = 14004;
const BASE = `http://127.0.0.1:${TEST_PORT}`;
let voiceProcess;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — unique IP per request to avoid rate limiting (60 req/min per IP)
// ─────────────────────────────────────────────────────────────────────────────

let ipCounter = 0;
function uniqueIp() {
  ipCounter++;
  return `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
}

async function get(path, headers = {}) {
  return fetch(`${BASE}${path}`, {
    headers: { Origin: 'https://vocalia.ma', 'X-Forwarded-For': uniqueIp(), ...headers }
  });
}

async function post(path, body, headers = {}) {
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://vocalia.ma', 'X-Forwarded-For': uniqueIp(), ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle: spawn voice-api as child process
// ─────────────────────────────────────────────────────────────────────────────

before(async () => {
  voiceProcess = spawn('node', [
    join(ROOT, 'core/voice-api-resilient.cjs'),
    '--server',
    `--port=${TEST_PORT}`
  ], {
    stdio: 'pipe',
    env: { ...process.env, NODE_ENV: 'test', JWT_SECRET: 'vocalia-jwt-secret-dev' }
  });

  // Collect stderr for debugging
  let stderrBuf = '';
  voiceProcess.stderr.on('data', d => { stderrBuf += d.toString(); });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => resolve(), 5000);

    voiceProcess.stdout.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('listening') || msg.includes('started') || msg.includes('port')) {
        clearTimeout(timeout);
        setTimeout(resolve, 500);
      }
    });

    voiceProcess.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    voiceProcess.on('exit', (code) => {
      if (code !== null && code !== 0) {
        clearTimeout(timeout);
        reject(new Error(`Voice API exited with code ${code}: ${stderrBuf}`));
      }
    });
  });
});

after(() => {
  if (voiceProcess) {
    voiceProcess.kill('SIGTERM');
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: GET /health
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /health', () => {
  it('returns 200 with status object', async () => {
    const res = await get('/health');
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.healthy, true);
    assert.ok('providers' in data);
    assert.ok('leadQualification' in data);
  });

  it('includes provider configuration status', async () => {
    const res = await get('/health');
    const data = await res.json();
    assert.ok('grok' in data.providers);
    assert.ok('gemini' in data.providers);
    assert.ok('anthropic' in data.providers);
    for (const p of Object.values(data.providers)) {
      assert.ok('name' in p);
      assert.ok('configured' in p);
    }
  });

  it('includes lead qualification config', async () => {
    const res = await get('/health');
    const data = await res.json();
    assert.equal(data.leadQualification.enabled, true);
    assert.ok('thresholds' in data.leadQualification);
    assert.ok(typeof data.leadQualification.activeSessions === 'number');
  });

  it('includes localFallback flag', async () => {
    const res = await get('/health');
    const data = await res.json();
    assert.equal(data.localFallback, true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: GET /metrics
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /metrics', () => {
  it('returns 200 with metrics object', async () => {
    const res = await get('/metrics');
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok('timestamp' in data);
    assert.ok('uptime_seconds' in data);
    assert.ok('memory' in data);
    assert.ok('providers' in data);
    assert.ok('lead_sessions' in data);
    assert.ok('rate_limiter' in data);
  });

  it('memory stats are numbers', async () => {
    const res = await get('/metrics');
    const data = await res.json();
    assert.ok(typeof data.memory.heap_used_mb === 'number');
    assert.ok(typeof data.memory.rss_mb === 'number');
  });

  it('uptime is a positive number', async () => {
    const res = await get('/metrics');
    const data = await res.json();
    assert.ok(data.uptime_seconds > 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: GET /dashboard/metrics
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /dashboard/metrics', () => {
  it('returns 200', async () => {
    const res = await get('/dashboard/metrics');
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(typeof data === 'object');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: GET /social-proof
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /social-proof', () => {
  it('returns 200 with messages array (fr)', async () => {
    const res = await get('/social-proof?lang=fr');
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.messages));
  });

  it('works with all 5 languages', async () => {
    for (const lang of ['fr', 'en', 'es', 'ar', 'ary']) {
      const res = await get(`/social-proof?lang=${lang}`);
      assert.equal(res.status, 200, `Failed for lang=${lang}`);
      const data = await res.json();
      assert.equal(data.success, true);
    }
  });

  it('defaults to fr when no lang param', async () => {
    const res = await get('/social-proof');
    assert.equal(res.status, 200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: POST /respond — VALIDATION CHAIN (the money endpoint)
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /respond — validation chain', () => {
  it('rejects missing message → 400', async () => {
    const res = await post('/respond', { language: 'fr' });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.toLowerCase().includes('message'));
  });

  it('rejects empty message string → 400', async () => {
    const res = await post('/respond', { message: '' });
    assert.equal(res.status, 400);
  });

  it('rejects malformed JSON → 400', async () => {
    const res = await post('/respond', '{not valid json}');
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.toLowerCase().includes('json'));
  });

  it('rejects body too large (>1MB) → 413', async () => {
    const bigBody = JSON.stringify({ message: 'x'.repeat(1024 * 1024 + 100) });
    const res = await fetch(`${BASE}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://vocalia.ma', 'X-Forwarded-For': uniqueIp() },
      body: bigBody
    });
    // Either 413 (body too large) or connection reset
    assert.ok([413, 400].includes(res.status) || !res.ok);
  });

  it('rejects blocked origin → 403', async () => {
    const res = await fetch(`${BASE}/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://evil-site.com',
        'X-Forwarded-For': uniqueIp()
      },
      body: JSON.stringify({ message: 'hello' })
    });
    assert.equal(res.status, 403);
  });

  it('rejects tenant/origin mismatch → 403', async () => {
    // Use a real tenant but with wrong origin
    const res = await fetch(`${BASE}/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://competitor-store.com',
        'X-Forwarded-For': uniqueIp()
      },
      body: JSON.stringify({ message: 'hello', tenant_id: 'ecom_nike_01' })
    });
    assert.equal(res.status, 403);
  });

  it('rejects invalid API key → 403', async () => {
    const res = await post('/respond', {
      message: 'hello',
      tenant_id: 'agency_internal',
      api_key: 'vk_completely_wrong_key_that_does_not_match_at_all'
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.ok(data.error.toLowerCase().includes('api key') || data.error.toLowerCase().includes('invalid'));
  });

  it('processes valid request (LLM providers may fail, but validation passes)', async () => {
    // This goes through ALL validation gates: origin, tenant, api_key, quota
    // Then hits LLM providers which will fail (no API keys in test)
    // We expect either: 200 (local fallback) or 500/502 (all providers failed)
    const res = await post('/respond', {
      message: 'Bonjour, quels sont vos services ?',
      language: 'fr',
      tenant_id: 'default'
    });
    // Should NOT be a validation error (4xx) — it passed validation
    // Should be 200 (local fallback) or 5xx (LLM failure)
    assert.ok(res.status !== 400, 'Should not be 400 (validation should pass)');
    assert.ok(res.status !== 403, 'Should not be 403 (origin/tenant valid)');
  });

  it('accepts request at root path / (alias for /respond)', async () => {
    const res = await post('/', { message: 'test', language: 'en' });
    // Same validation as /respond — should not be 404
    assert.ok(res.status !== 404, 'Root path / should be handled (alias for /respond)');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: POST /feedback
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /feedback', () => {
  it('accepts valid feedback → 200', async () => {
    const res = await post('/feedback', {
      sessionId: 'test_session_001',
      messageIndex: 0,
      rating: 'up',
      tenantId: 'default'
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
  });

  it('rejects missing fields → 400', async () => {
    const res = await post('/feedback', { sessionId: 'test' });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('Missing'));
  });

  it('rejects invalid rating → 400', async () => {
    const res = await post('/feedback', {
      sessionId: 'test',
      messageIndex: 0,
      rating: 'invalid',
      tenantId: 'default'
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('up') || data.error.includes('down'));
  });

  it('rejects malformed JSON → 400', async () => {
    const res = await post('/feedback', 'not json');
    assert.equal(res.status, 400);
  });

  it('rejects oversized payload → 413', async () => {
    const res = await post('/feedback', {
      sessionId: 'x'.repeat(5000),
      messageIndex: 0,
      rating: 'up',
      tenantId: 'default'
    });
    assert.equal(res.status, 413);
  });

  it('accepts down rating', async () => {
    const res = await post('/feedback', {
      sessionId: 'test_session_002',
      messageIndex: 1,
      rating: 'down',
      tenantId: 'default'
    });
    assert.equal(res.status, 200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7: GET /config
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /config', () => {
  it('returns config for default tenant', async () => {
    const res = await get('/config?tenantId=default');
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(typeof data === 'object');
  });

  it('returns config for agency_internal', async () => {
    const res = await get('/config?tenantId=agency_internal');
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(typeof data === 'object');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8: Admin endpoints — auth guard
// ═══════════════════════════════════════════════════════════════════════════════

describe('Admin endpoints — auth guard', () => {
  it('GET /admin/tenants without auth → 401', async () => {
    const res = await get('/admin/tenants');
    assert.equal(res.status, 401);
  });

  it('GET /admin/metrics without auth → 401', async () => {
    const res = await get('/admin/metrics');
    assert.equal(res.status, 401);
  });

  it('POST /admin/refresh without auth → 401', async () => {
    const res = await post('/admin/refresh', {});
    assert.equal(res.status, 401);
  });

  it('GET /admin/logs without auth → 401', async () => {
    const res = await get('/admin/logs');
    assert.equal(res.status, 401);
  });

  it('GET /admin/health without auth → 401', async () => {
    const res = await get('/admin/health');
    assert.equal(res.status, 401);
  });

  it('rejects invalid Bearer token → 401', async () => {
    const res = await get('/admin/tenants', { Authorization: 'Bearer fake.jwt.token' });
    assert.equal(res.status, 401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9: Static asset serving
// ═══════════════════════════════════════════════════════════════════════════════

describe('Static asset serving', () => {
  it('GET /voice-assistant/voice-widget-v3.js → 200 JS', async () => {
    const res = await get('/voice-assistant/voice-widget-v3.js');
    assert.equal(res.status, 200);
    const ct = res.headers.get('content-type');
    assert.ok(ct.includes('javascript'), `Expected javascript, got ${ct}`);
  });

  it('GET /lang/widget-fr.json → 200 JSON', async () => {
    const res = await get('/lang/widget-fr.json');
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(typeof data === 'object');
  });

  it('GET /lang/widget-en.json → 200 JSON', async () => {
    const res = await get('/lang/widget-en.json');
    assert.equal(res.status, 200);
  });

  it('GET /lang/widget-ar.json → 200 JSON', async () => {
    const res = await get('/lang/widget-ar.json');
    assert.equal(res.status, 200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 10: OPTIONS (CORS preflight)
// ═══════════════════════════════════════════════════════════════════════════════

describe('OPTIONS (CORS preflight)', () => {
  it('returns 200 for OPTIONS', async () => {
    const res = await fetch(`${BASE}/respond`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://vocalia.ma', 'X-Forwarded-For': uniqueIp() }
    });
    assert.equal(res.status, 200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 11: POST /qualify — lead qualification
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /qualify', () => {
  it('rejects malformed JSON → 400', async () => {
    const res = await post('/qualify', 'not json');
    assert.equal(res.status, 400);
  });

  it('rejects missing email → 400', async () => {
    const res = await post('/qualify', { name: 'Test User' });
    assert.equal(res.status, 400);
  });

  it('accepts valid qualification request', async () => {
    const res = await post('/qualify', {
      email: 'prospect@company.com',
      name: 'Test Prospect',
      budget: 1000,
      timeline: 'ce mois',
      company: 'Test Corp',
      message: 'Interested in voice AI'
    });
    // Should return 200 with qualification result
    assert.ok([200, 201].includes(res.status), `Expected 200/201, got ${res.status}`);
    const data = await res.json();
    assert.ok('score' in data || 'qualification' in data || 'lead' in data || 'sessionId' in data);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 12: GET /lead/:sessionId
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /lead/:sessionId', () => {
  it('requires admin auth (BL35 — PII protection) → 401', async () => {
    const res = await get('/lead/nonexistent_session_xyz');
    assert.equal(res.status, 401);
  });

  it('rejects invalid token → 401', async () => {
    const res = await get('/lead/some_session', { Authorization: 'Bearer fake.jwt' });
    assert.equal(res.status, 401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 13: POST /tts — text-to-speech validation
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /tts', () => {
  it('rejects malformed JSON → 400', async () => {
    const res = await post('/tts', 'not json');
    assert.equal(res.status, 400);
  });

  it('rejects missing text → 400', async () => {
    const res = await post('/tts', { language: 'fr' });
    assert.equal(res.status, 400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 14: POST /stt — speech-to-text validation
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /stt', () => {
  it('rejects too-small audio data → 400', async () => {
    // /stt reads raw binary, not JSON. Audio < 100 bytes → 400
    const res = await fetch(`${BASE}/stt`, {
      method: 'POST',
      headers: { 'Content-Type': 'audio/webm', Origin: 'https://vocalia.ma', 'X-Forwarded-For': uniqueIp() },
      body: Buffer.from('tiny')
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('too small'));
  });

  it('handles garbage audio gracefully (200 if API available, 503 if not)', async () => {
    // Send 100+ bytes of fake audio data — behavior depends on API key availability
    const fakeAudio = Buffer.alloc(200, 0xFF);
    const res = await fetch(`${BASE}/stt`, {
      method: 'POST',
      headers: { 'Content-Type': 'audio/webm', Origin: 'https://vocalia.ma', 'X-Forwarded-For': uniqueIp() },
      body: fakeAudio
    });
    // With API keys: provider may transcribe garbage → 200
    // Without API keys: all providers fail → 503
    assert.ok([200, 503].includes(res.status), `Expected 200 or 503, got ${res.status}`);
    const data = await res.json();
    if (res.status === 200) {
      assert.strictEqual(data.success, true);
      assert.strictEqual(typeof data.text, 'string');
    } else {
      assert.ok(data.error);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 15: POST /api/contact
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/contact', () => {
  it('rejects malformed JSON → 400', async () => {
    const res = await post('/api/contact', 'not json');
    assert.equal(res.status, 400);
  });

  it('rejects missing required fields', async () => {
    const res = await post('/api/contact', { name: 'Test' });
    assert.equal(res.status, 400);
  });

  it('accepts valid contact form', async () => {
    const res = await post('/api/contact', {
      name: 'Test User',
      email: 'test@company.com',
      message: 'Interested in VocalIA for my e-commerce site',
      company: 'Test Corp',
      phone: '+33612345678'
    });
    assert.ok([200, 201].includes(res.status), `Expected 200/201, got ${res.status}`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 16: A2UI endpoints
// ═══════════════════════════════════════════════════════════════════════════════

describe('A2UI endpoints', () => {
  it('GET /a2ui/health → 200', async () => {
    const res = await get('/a2ui/health');
    assert.equal(res.status, 200);
  });

  it('POST /a2ui/generate — rejects malformed JSON → 400', async () => {
    const res = await post('/a2ui/generate', 'not json');
    assert.equal(res.status, 400);
  });

  it('POST /a2ui/generate — rejects missing type → 400', async () => {
    const res = await post('/a2ui/generate', { context: {}, language: 'fr' });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('type'));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 17: GET /api/widget/embed-code
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/widget/embed-code', () => {
  it('returns embed code for default platform', async () => {
    const res = await get('/api/widget/embed-code?tenantId=test_tenant');
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.tenantId, 'test_tenant');
    assert.ok(data.snippet);
    assert.ok(data.instructions);
  });

  it('rejects missing tenantId → 400', async () => {
    const res = await get('/api/widget/embed-code');
    assert.equal(res.status, 400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 18: Security headers
// ═══════════════════════════════════════════════════════════════════════════════

describe('Security headers', () => {
  it('includes X-Content-Type-Options: nosniff', async () => {
    const res = await get('/health');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  });

  it('includes X-Frame-Options: DENY', async () => {
    const res = await get('/health');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
  });

  it('includes X-Trace-Id', async () => {
    const res = await get('/metrics');
    const traceId = res.headers.get('x-trace-id');
    assert.ok(traceId, 'Expected X-Trace-Id header');
    assert.ok(traceId.startsWith('req_'));
  });

  it('includes CORS headers for allowed origin', async () => {
    const res = await get('/health');
    assert.equal(res.headers.get('access-control-allow-origin'), 'https://vocalia.ma');
  });

  it('includes Strict-Transport-Security', async () => {
    const res = await get('/health');
    const hsts = res.headers.get('strict-transport-security');
    assert.ok(hsts && hsts.includes('max-age'));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 19: Origin blocking
// ═══════════════════════════════════════════════════════════════════════════════

describe('Origin blocking', () => {
  it('blocks unknown origin → 403', async () => {
    const res = await fetch(`${BASE}/health`, {
      headers: { Origin: 'https://evil.com', 'X-Forwarded-For': uniqueIp() }
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.ok(data.error.includes('Origin'));
  });

  it('allows request without Origin header (server-to-server)', async () => {
    const res = await fetch(`${BASE}/health`, {
      headers: { 'X-Forwarded-For': uniqueIp() }
    });
    assert.equal(res.status, 200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 20: API health sub-endpoints
// ═══════════════════════════════════════════════════════════════════════════════

describe('API health sub-endpoints', () => {
  it('GET /api/health/grok → 503 (service not running in test)', async () => {
    const res = await get('/api/health/grok');
    assert.equal(res.status, 503);
    const data = await res.json();
    assert.ok(data.status === 'offline' || data.error);
  });

  it('GET /api/health/telephony → 200 or 503 (depends on service state)', async () => {
    const res = await get('/api/health/telephony');
    assert.ok([200, 503].includes(res.status), `Expected 200 or 503, got ${res.status}`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Session 250.209: /a2ui/action endpoint
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /a2ui/action', () => {
  it('valid action → 200 with success', async () => {
    const res = await post('/a2ui/action', {
      action: 'submit_lead',
      data: { name: 'Test', email: 'test@test.com' },
      sessionId: 'session_test',
      tenant_id: 'demo'
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.success);
    assert.equal(data.action, 'submit_lead');
    assert.equal(data.message, 'Lead captured');
  });

  it('confirm_booking action with slot → booking confirmed', async () => {
    const res = await post('/a2ui/action', {
      action: 'confirm_booking',
      data: { slot: '2026-03-01T10:00' },
      sessionId: 'session_booking',
      tenant_id: 'demo'
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.message, 'Booking confirmed');
    assert.ok(data.booking);
    assert.equal(data.booking.slot, '2026-03-01T10:00');
    assert.equal(data.booking.status, 'confirmed');
  });

  it('checkout action → checkout initiated', async () => {
    const res = await post('/a2ui/action', {
      action: 'checkout',
      data: { cartId: 'cart_123' },
      tenant_id: 'demo'
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.message, 'Checkout initiated');
  });

  it('missing action field → 400', async () => {
    const res = await post('/a2ui/action', { data: { foo: 'bar' } });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('action'));
  });

  it('invalid JSON body → 400', async () => {
    const res = await fetch(`${BASE}/a2ui/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://vocalia.ma', 'X-Forwarded-For': uniqueIp() },
      body: 'not valid json {'
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('Invalid JSON'));
  });

  it('unknown action still returns 200 with success', async () => {
    const res = await post('/a2ui/action', {
      action: 'custom_action',
      data: {},
      tenant_id: 'demo'
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.success);
    assert.equal(data.action, 'custom_action');
    // Unknown actions don't have a specific message
    assert.equal(data.message, undefined);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Session 250.209: /admin/logs/export endpoint
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /admin/logs/export', () => {
  it('without auth → 401', async () => {
    const res = await get('/admin/logs/export');
    assert.equal(res.status, 401);
  });

  it('without admin role → 403', async () => {
    // Create a non-admin JWT
    const jwt = await import('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'vocalia-jwt-secret-dev';
    const userToken = jwt.default.sign({ sub: 'user_1', role: 'user' }, secret, { expiresIn: '1h' });
    const res = await get('/admin/logs/export', { Authorization: `Bearer ${userToken}` });
    assert.equal(res.status, 403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Session 250.209: /admin/tenants POST (B7 fix — safeJsonParse + name validation)
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /admin/tenants', () => {
  it('without auth → 401', async () => {
    const res = await post('/admin/tenants', { name: 'Test Corp' });
    assert.equal(res.status, 401);
  });

  it('without admin role → 403', async () => {
    const jwt = await import('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'vocalia-jwt-secret-dev';
    const userToken = jwt.default.sign({ sub: 'user_1', role: 'user' }, secret, { expiresIn: '1h' });
    const res = await post('/admin/tenants', { name: 'Test Corp' }, { Authorization: `Bearer ${userToken}` });
    assert.equal(res.status, 403);
  });

  it('with invalid JSON body → 400 (B7 fix)', async () => {
    const jwt = await import('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'vocalia-jwt-secret-dev';
    const adminToken = jwt.default.sign({ sub: 'admin_1', role: 'admin' }, secret, { expiresIn: '1h' });
    const res = await fetch(`${BASE}/admin/tenants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://vocalia.ma',
        'X-Forwarded-For': uniqueIp(),
        Authorization: `Bearer ${adminToken}`
      },
      body: 'not json at all {'
    });
    assert.equal(res.status, 400, 'Invalid JSON should return 400, not 500 (B7 fix)');
    const data = await res.json();
    assert.ok(data.error.includes('Invalid JSON'));
  });

  it('without name → 400 (B7 fix)', async () => {
    const jwt = await import('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'vocalia-jwt-secret-dev';
    const adminToken = jwt.default.sign({ sub: 'admin_1', role: 'admin' }, secret, { expiresIn: '1h' });
    const res = await post('/admin/tenants', { plan: 'starter' }, { Authorization: `Bearer ${adminToken}` });
    assert.equal(res.status, 400, 'Missing name should return 400 (B7 fix)');
    const data = await res.json();
    assert.ok(data.error.includes('name'));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: syncLeadToHubSpot — unit tests (exported function, no HTTP server)
// ═══════════════════════════════════════════════════════════════════════════════

describe('syncLeadToHubSpot unit tests', () => {
  const { syncLeadToHubSpot, QUALIFICATION } = require('../core/voice-api-resilient.cjs');

  test('hubspot disabled → returns null', async () => {
    const origEnabled = QUALIFICATION.hubspot.enabled;
    QUALIFICATION.hubspot.enabled = false;
    try {
      const result = await syncLeadToHubSpot({
        extractedData: { email: 'test@test.com' },
        score: 80,
        status: 'hot',
        scoreBreakdown: {}
      });
      assert.equal(result, null);
    } finally {
      QUALIFICATION.hubspot.enabled = origEnabled;
    }
  });

  test('no email in extractedData → returns null', async () => {
    const origEnabled = QUALIFICATION.hubspot.enabled;
    QUALIFICATION.hubspot.enabled = true;
    try {
      const result = await syncLeadToHubSpot({
        extractedData: { name: 'No Email Person' },
        score: 60,
        status: 'warm',
        scoreBreakdown: {}
      });
      assert.equal(result, null);
    } finally {
      QUALIFICATION.hubspot.enabled = origEnabled;
    }
  });

  test('HubSpot API success → returns {success:true, contactId}', async () => {
    const origEnabled = QUALIFICATION.hubspot.enabled;
    const origKey = QUALIFICATION.hubspot.apiKey;
    const origEndpoint = QUALIFICATION.hubspot.endpoint;
    QUALIFICATION.hubspot.enabled = true;
    QUALIFICATION.hubspot.apiKey = 'fake-key';
    QUALIFICATION.hubspot.endpoint = 'https://fake-hubspot.test';

    // Mock https.request
    const https = require('https');
    const origRequest = https.request;
    const { EventEmitter } = require('events');

    https.request = (opts, callback) => {
      const mockRes = new EventEmitter();
      mockRes.statusCode = 201;
      process.nextTick(() => {
        callback(mockRes);
        mockRes.emit('data', JSON.stringify({ id: 'contact_abc123' }));
        mockRes.emit('end');
      });
      const mockReq = new EventEmitter();
      mockReq.write = () => {};
      mockReq.end = () => {};
      mockReq.destroy = () => {};
      return mockReq;
    };

    try {
      const result = await syncLeadToHubSpot({
        extractedData: {
          email: 'lead@company.com',
          name: 'Ahmed Benali',
          phone: '+212600000000',
          budget: { label: '500-1000€' },
          timeline: { tier: 'immediate' },
          industry: { tier: 'tech' }
        },
        score: 85,
        status: 'hot',
        scoreBreakdown: { email: 20, budget: 15 }
      });
      assert.ok(result);
      assert.equal(result.success, true);
      assert.equal(result.contactId, 'contact_abc123');
    } finally {
      https.request = origRequest;
      QUALIFICATION.hubspot.enabled = origEnabled;
      QUALIFICATION.hubspot.apiKey = origKey;
      QUALIFICATION.hubspot.endpoint = origEndpoint;
    }
  });
});
