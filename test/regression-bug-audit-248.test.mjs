/**
 * regression-bug-audit-248.test.mjs
 * Regression tests for 5 cross-system bugs found in Session 250.248 audit.
 *
 * BUG-1: AgencyEventBus.emit() used instead of .publish() for quota.warning
 * BUG-2: EventBus subscribe handlers destructured from event instead of event.payload
 * BUG-3: Missing await on catalogStore.registerTenant() in db-api.cjs
 * BUG-4: Missing await on stripeService.reportVoiceMinutes() in telephony bridge
 * BUG-5: Hardcoded http://localhost:3004 in WebhookRouter Slack handler
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);

// ─── BUG-1 & BUG-2: EventBus publish envelope ───────────────────────────────

describe('BUG-1+2: AgencyEventBus publish envelope', () => {
  const AgencyEventBus = require('../core/AgencyEventBus.cjs');

  test('publish() wraps payload in envelope with tenantId at top level', async () => {
    const received = [];
    AgencyEventBus.subscribe('test.bug1', (event) => {
      received.push(event);
    });

    await AgencyEventBus.publish('test.bug1', {
      score: 85,
      sessionId: 'sess_123'
    }, { tenantId: 'tenant_abc' });

    // Wait for async delivery
    await new Promise(r => setTimeout(r, 50));

    assert.ok(received.length >= 1, 'Should receive at least 1 event');
    const event = received[0];

    // Envelope structure: tenantId at top level, data inside payload
    assert.equal(event.tenantId, 'tenant_abc', 'tenantId must be at event.tenantId');
    assert.equal(event.type, 'test.bug1', 'type must be at event.type');
    assert.ok(event.payload, 'event.payload must exist');
    assert.equal(event.payload.score, 85, 'score must be in event.payload');
    assert.equal(event.payload.sessionId, 'sess_123', 'sessionId must be in event.payload');

    // BUG-1 regression: these should NOT be at top level
    assert.equal(event.score, undefined, 'score must NOT be at event root');
    assert.equal(event.sessionId, undefined, 'sessionId must NOT be at event root');
  });

  test('publish() without tenantId defaults to unknown', async () => {
    const received = [];
    AgencyEventBus.subscribe('test.bug1b', (event) => {
      received.push(event);
    });

    await AgencyEventBus.publish('test.bug1b', { data: 'x' });
    await new Promise(r => setTimeout(r, 50));

    assert.ok(received.length >= 1);
    assert.equal(received[0].tenantId, 'unknown', 'Missing tenantId should default to unknown');
  });

  test('subscribe handler must read payload fields from event.payload, not event', async () => {
    // This test verifies the CORRECT pattern used after BUG-2 fix
    const received = [];
    AgencyEventBus.subscribe('test.bug2', (event) => {
      // CORRECT pattern (post-fix):
      const { sessionId, score } = event.payload || {};
      const tenantId = event.tenantId;
      received.push({ tenantId, sessionId, score });
    });

    await AgencyEventBus.publish('test.bug2', {
      sessionId: 'sess_456',
      score: 92
    }, { tenantId: 'tenant_xyz' });

    await new Promise(r => setTimeout(r, 50));

    assert.ok(received.length >= 1);
    assert.equal(received[0].tenantId, 'tenant_xyz');
    assert.equal(received[0].sessionId, 'sess_456');
    assert.equal(received[0].score, 92);
  });
});

// ─── BUG-1: No .emit() calls remain ─────────────────────────────────────────

describe('BUG-1: No .emit() calls in voice-api-resilient.cjs', () => {
  test('quota.warning uses .publish() not .emit()', () => {
    const src = fs.readFileSync(
      new URL('../core/voice-api-resilient.cjs', import.meta.url), 'utf8'
    );
    const emitCalls = src.match(/AgencyEventBus\.emit\(/g);
    assert.equal(emitCalls, null, 'No AgencyEventBus.emit() calls should remain');
  });

  test('quota.warning publish includes tenantId in options', () => {
    const src = fs.readFileSync(
      new URL('../core/voice-api-resilient.cjs', import.meta.url), 'utf8'
    );
    // Find quota.warning publish call — must have { tenantId } as 3rd arg
    const quotaPublish = src.match(/publish\('quota\.warning'[\s\S]*?\}\s*,\s*\{\s*tenantId\s*\}/);
    assert.ok(quotaPublish, 'quota.warning publish must pass tenantId in options (3rd arg)');
  });
});

// ─── BUG-2: Subscribe handlers read from event.payload ───────────────────────

describe('BUG-2: Subscribe handlers use event.payload', () => {
  const EVENTS = [
    'lead.qualified',
    'call.completed',
    'conversation.ended',
    'cart.abandoned',
    'quota.warning'
  ];

  test('all 5 subscribe handlers destructure from event.payload', () => {
    const src = fs.readFileSync(
      new URL('../core/voice-api-resilient.cjs', import.meta.url), 'utf8'
    );

    for (const evt of EVENTS) {
      // Find the subscribe block for this event
      const subRe = new RegExp(
        `subscribe\\('${evt.replace('.', '\\.')}'[\\s\\S]*?\\}\\);`,
        'g'
      );
      const match = src.match(subRe);
      assert.ok(match, `Subscribe handler for ${evt} must exist`);

      const block = match[0];
      // Must contain event.payload
      assert.ok(
        block.includes('event.payload'),
        `${evt} handler must read from event.payload, not event directly`
      );
      // Must contain event.tenantId
      assert.ok(
        block.includes('event.tenantId'),
        `${evt} handler must read tenantId from event.tenantId`
      );
    }
  });

  test('subscribe handlers guard against unknown tenantId', () => {
    const src = fs.readFileSync(
      new URL('../core/voice-api-resilient.cjs', import.meta.url), 'utf8'
    );
    // All handlers should check for 'unknown' tenantId
    const unknownGuards = (src.match(/tenantId !== 'unknown'/g) || []).length;
    assert.ok(unknownGuards >= 5, `At least 5 subscribe handlers must guard against tenantId === 'unknown', found ${unknownGuards}`);
  });
});

// ─── BUG-3: await on catalogStore.registerTenant() ───────────────────────────

describe('BUG-3: await on catalogStore.registerTenant()', () => {
  test('db-api.cjs has await before catalogStore.registerTenant()', () => {
    const src = fs.readFileSync(
      new URL('../core/db-api.cjs', import.meta.url), 'utf8'
    );
    // Must find "await catalogStore.registerTenant(" — NOT just "catalogStore.registerTenant("
    const awaitPattern = /await\s+catalogStore\.registerTenant\(/;
    assert.ok(awaitPattern.test(src), 'catalogStore.registerTenant() must be awaited');

    // Must NOT have non-awaited version (except in comments)
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('//') || line.startsWith('*')) continue;
      if (line.includes('catalogStore.registerTenant(') && !line.includes('await')) {
        assert.fail(`Line ${i + 1}: catalogStore.registerTenant() without await`);
      }
    }
  });
});

// ─── BUG-4: await on stripeService.reportVoiceMinutes() ──────────────────────

describe('BUG-4: stripeService.reportVoiceMinutes() async error handling', () => {
  test('telephony bridge handles reportVoiceMinutes async errors with .catch()', () => {
    const src = fs.readFileSync(
      new URL('../telephony/voice-telephony-bridge.cjs', import.meta.url), 'utf8'
    );
    // cleanupSession is sync, so await can't be used. Must use .catch() on promise.
    const catchPattern = /reportVoiceMinutes\([^)]+\)\s*\n?\s*\.catch\(/;
    assert.ok(catchPattern.test(src), 'reportVoiceMinutes() must chain .catch() for async error handling');
  });

  test('reportVoiceMinutes is inside try-catch for sync require errors', () => {
    const src = fs.readFileSync(
      new URL('../telephony/voice-telephony-bridge.cjs', import.meta.url), 'utf8'
    );
    const idx = src.indexOf('reportVoiceMinutes');
    assert.ok(idx > 0, 'reportVoiceMinutes must exist in telephony bridge');

    // Look backwards for try { (sync errors from require)
    const before = src.substring(Math.max(0, idx - 200), idx);
    assert.ok(before.includes('try'), 'reportVoiceMinutes must be inside try block');

    // The .catch() handles async rejection, the try-catch handles sync require() failure
    const after = src.substring(idx, idx + 300);
    assert.ok(after.includes('.catch('), '.catch() must handle async rejection');
  });
});

// ─── BUG-5: No hardcoded localhost in WebhookRouter ──────────────────────────

describe('BUG-5: No hardcoded localhost in WebhookRouter', () => {
  test('WebhookRouter uses VOCALIA_API_URL env var', () => {
    const src = fs.readFileSync(
      new URL('../core/WebhookRouter.cjs', import.meta.url), 'utf8'
    );
    assert.ok(
      src.includes('VOCALIA_API_URL'),
      'WebhookRouter must use VOCALIA_API_URL env var'
    );
  });

  test('no hardcoded http://localhost:3004/respond', () => {
    const src = fs.readFileSync(
      new URL('../core/WebhookRouter.cjs', import.meta.url), 'utf8'
    );
    // Filter out comments
    const lines = src.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'));
    const code = lines.join('\n');
    const hardcoded = code.match(/fetch\(\s*['"]http:\/\/localhost:3004/);
    assert.equal(hardcoded, null, 'No hardcoded fetch to localhost:3004 should remain');
  });

  test('Slack handler constructs URL from env var with fallback', () => {
    const src = fs.readFileSync(
      new URL('../core/WebhookRouter.cjs', import.meta.url), 'utf8'
    );
    // Must have the pattern: process.env.VOCALIA_API_URL || 'http://localhost:3004'
    assert.ok(
      src.includes("process.env.VOCALIA_API_URL || 'http://localhost:3004'"),
      'Must use env var with localhost fallback'
    );
  });
});

// ─── Cross-system: EventBus → WebhookDispatcher integration ──────────────────

describe('Cross-system: EventBus → Webhook pipeline', () => {
  const AgencyEventBus = require('../core/AgencyEventBus.cjs');

  test('publish + subscribe roundtrip preserves all fields', async () => {
    const captured = [];
    AgencyEventBus.subscribe('test.roundtrip', (event) => {
      const { sessionId, score, status, extractedData } = event.payload || {};
      const tenantId = event.tenantId;
      captured.push({ tenantId, sessionId, score, status, extractedData });
    });

    await AgencyEventBus.publish('test.roundtrip', {
      sessionId: 'rt_001',
      score: 75,
      status: 'warm',
      extractedData: { email: 'test@vocalia.ma', company: 'ACME' }
    }, { tenantId: 'tenant_roundtrip' });

    await new Promise(r => setTimeout(r, 50));

    assert.ok(captured.length >= 1);
    const c = captured[0];
    assert.equal(c.tenantId, 'tenant_roundtrip');
    assert.equal(c.sessionId, 'rt_001');
    assert.equal(c.score, 75);
    assert.equal(c.status, 'warm');
    assert.deepEqual(c.extractedData, { email: 'test@vocalia.ma', company: 'ACME' });
  });

  test('publish with unknown tenantId is filtered by subscribe guard', async () => {
    const captured = [];
    AgencyEventBus.subscribe('test.guard', (event) => {
      const tenantId = event.tenantId;
      // Mimic the guard from voice-api-resilient.cjs
      if (tenantId && tenantId !== 'unknown') {
        captured.push(event);
      }
    });

    // Publish without tenantId → defaults to 'unknown'
    await AgencyEventBus.publish('test.guard', { data: 'should_be_filtered' });
    await new Promise(r => setTimeout(r, 50));

    assert.equal(captured.length, 0, 'Events with unknown tenantId must be filtered');
  });
});
