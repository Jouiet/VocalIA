/**
 * VocalIA ContextBox Tests
 *
 * Tests:
 * - CONTEXT_CONFIG defaults
 * - ContextBox constructor (storageDir, config)
 * - _getPath (path sanitization, path traversal prevention)
 * - _estimateTokens (string, object, null)
 * - get (default structure, pillars)
 * - set (merge, deep merge pillars, auto-compact)
 * - _compactHistory (event summarization)
 * - getContextForLLM (token budget, priority loading)
 * - extractKeyFact
 * - logEvent
 * - _predictNextAgent (score-based routing)
 * - _suggestActions (context-based suggestions)
 * - listSessions
 * - cleanupStale
 * - getTenantFacts (B110: full chain promoteFact → getTenantFacts)
 * - promoteFact (B110: enriches with sessionId, delegates to TenantMemory)
 *
 * NOTE: Tests pure logic with temp directory. Does NOT require EventBus.
 *
 * Run: node --test test/context-box.test.mjs
 */



import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ContextBox } from '../core/ContextBox.cjs';

// Use temp dir for isolation
function createTestBox(config = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocalia-ctx-'));
  return { box: new ContextBox({ storageDir: tmpDir, config }), tmpDir };
}

function cleanup(tmpDir) {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (e) { /* ignore */ }
}

// ─── constructor ────────────────────────────────────────────────────

describe('ContextBox constructor', () => {
  test('creates storageDir if not exists', () => {
    const tmpDir = path.join(os.tmpdir(), `vocalia-ctx-test-${Date.now()}`);
    const box = new ContextBox({ storageDir: tmpDir });
    assert.ok(fs.existsSync(tmpDir));
    cleanup(tmpDir);
  });

  test('uses default config values', () => {
    const { box, tmpDir } = createTestBox();
    assert.strictEqual(box.config.maxHistoryEvents, 50);
    assert.strictEqual(box.config.maxTokenEstimate, 4000);
    assert.strictEqual(box.config.staleSessionHours, 24);
    assert.strictEqual(box.config.tokensPerChar, 0.25);
    cleanup(tmpDir);
  });

  test('accepts custom config', () => {
    const { box, tmpDir } = createTestBox({ maxHistoryEvents: 100, maxTokenEstimate: 8000 });
    assert.strictEqual(box.config.maxHistoryEvents, 100);
    assert.strictEqual(box.config.maxTokenEstimate, 8000);
    cleanup(tmpDir);
  });
});

// ─── _getPath ───────────────────────────────────────────────────────

describe('ContextBox _getPath', () => {
  test('returns path ending in .json', () => {
    const { box, tmpDir } = createTestBox();
    const p = box._getPath('session-123');
    assert.ok(p.endsWith('.json'));
    cleanup(tmpDir);
  });

  test('sanitizes path traversal characters', () => {
    const { box, tmpDir } = createTestBox();
    const p = box._getPath('../../../etc/passwd');
    assert.ok(!p.includes('..'));
    assert.ok(p.includes('______etc_passwd'));
    cleanup(tmpDir);
  });

  test('preserves alphanumeric and hyphens/underscores', () => {
    const { box, tmpDir } = createTestBox();
    const p = box._getPath('session_abc-123');
    assert.ok(p.includes('session_abc-123'));
    cleanup(tmpDir);
  });
});

// ─── _estimateTokens ────────────────────────────────────────────────

describe('ContextBox _estimateTokens', () => {
  test('returns 0 for null', () => {
    const { box, tmpDir } = createTestBox();
    assert.strictEqual(box._estimateTokens(null), 0);
    cleanup(tmpDir);
  });

  test('returns 0 for empty string', () => {
    const { box, tmpDir } = createTestBox();
    assert.strictEqual(box._estimateTokens(''), 0);
    cleanup(tmpDir);
  });

  test('estimates tokens for string (0.25 per char)', () => {
    const { box, tmpDir } = createTestBox();
    const result = box._estimateTokens('Hello World!'); // 12 chars
    assert.strictEqual(result, Math.ceil(12 * 0.25)); // 3
    cleanup(tmpDir);
  });

  test('estimates tokens for object (JSON stringified)', () => {
    const { box, tmpDir } = createTestBox();
    const obj = { key: 'value' };
    const jsonLen = JSON.stringify(obj).length;
    const result = box._estimateTokens(obj);
    assert.strictEqual(result, Math.ceil(jsonLen * 0.25));
    cleanup(tmpDir);
  });
});

// ─── get ────────────────────────────────────────────────────────────

describe('ContextBox get', () => {
  test('returns default structure for new ID', () => {
    const { box, tmpDir } = createTestBox();
    const ctx = box.get('new-session');
    assert.strictEqual(ctx.id, 'new-session');
    assert.ok(ctx.created_at);
    assert.ok(ctx.pillars);
    assert.deepStrictEqual(ctx.pillars.identity, {});
    assert.deepStrictEqual(ctx.pillars.intent, {});
    assert.deepStrictEqual(ctx.pillars.qualification, {});
    assert.deepStrictEqual(ctx.pillars.sentiment, []);
    assert.deepStrictEqual(ctx.pillars.history, []);
    assert.deepStrictEqual(ctx.pillars.keyFacts, []);
    assert.strictEqual(ctx.pillars.summary, null);
    assert.strictEqual(ctx.status, 'active');
    cleanup(tmpDir);
  });

  test('returns persisted data after set', () => {
    const { box, tmpDir } = createTestBox();
    box.set('test-1', { pillars: { identity: { email: 'test@test.com' } } });
    const ctx = box.get('test-1');
    assert.strictEqual(ctx.pillars.identity.email, 'test@test.com');
    cleanup(tmpDir);
  });
});

// ─── set ────────────────────────────────────────────────────────────

describe('ContextBox set', () => {
  test('merges identity data', () => {
    const { box, tmpDir } = createTestBox();
    box.set('s1', { pillars: { identity: { email: 'a@b.com' } } });
    box.set('s1', { pillars: { identity: { name: 'Ahmed' } } });
    const ctx = box.get('s1');
    assert.strictEqual(ctx.pillars.identity.email, 'a@b.com');
    assert.strictEqual(ctx.pillars.identity.name, 'Ahmed');
    cleanup(tmpDir);
  });

  test('appends history events', () => {
    const { box, tmpDir } = createTestBox();
    box.set('s2', { pillars: { history: [{ event: 'A' }] } });
    box.set('s2', { pillars: { history: [{ event: 'B' }] } });
    const ctx = box.get('s2');
    assert.strictEqual(ctx.pillars.history.length, 2);
    cleanup(tmpDir);
  });

  test('caps sentiment at last 20', () => {
    const { box, tmpDir } = createTestBox();
    const sentiments = Array.from({ length: 25 }, (_, i) => ({ score: i }));
    box.set('s3', { pillars: { sentiment: sentiments } });
    const ctx = box.get('s3');
    assert.strictEqual(ctx.pillars.sentiment.length, 20);
    cleanup(tmpDir);
  });

  test('updates token estimate in metadata', () => {
    const { box, tmpDir } = createTestBox();
    box.set('s4', { pillars: { identity: { email: 'long-data@example.com' } } });
    const ctx = box.get('s4');
    assert.ok(ctx.metadata.tokenEstimate > 0);
    cleanup(tmpDir);
  });

  test('sets updated_at timestamp', () => {
    const { box, tmpDir } = createTestBox();
    box.set('s5', { pillars: { identity: {} } });
    const ctx = box.get('s5');
    assert.ok(ctx.updated_at);
    cleanup(tmpDir);
  });
});

// ─── _compactHistory ────────────────────────────────────────────────

describe('ContextBox _compactHistory', () => {
  test('compacts when history exceeds threshold', () => {
    const { box, tmpDir } = createTestBox({ maxHistoryEvents: 10 });

    // Add 15 history events
    const events = Array.from({ length: 15 }, (_, i) => ({
      timestamp: new Date().toISOString(),
      agent: 'TestAgent',
      event: `event_${i}`
    }));

    box.set('compact-test', { pillars: { history: events } });
    const ctx = box.get('compact-test');

    // Should be compacted: 1 COMPACTION entry + 6 recent (60% of 10)
    assert.ok(ctx.pillars.history.length <= 10 + 1); // max + compaction note
    assert.ok(ctx.pillars.history[0].event === 'COMPACTION');
    assert.ok(ctx.metadata.lastCompaction);
    cleanup(tmpDir);
  });

  test('does not compact when below threshold', () => {
    const { box, tmpDir } = createTestBox({ maxHistoryEvents: 50 });

    const events = Array.from({ length: 5 }, (_, i) => ({
      timestamp: new Date().toISOString(),
      agent: 'TestAgent',
      event: `event_${i}`
    }));

    box.set('no-compact', { pillars: { history: events } });
    const ctx = box.get('no-compact');
    assert.strictEqual(ctx.pillars.history.length, 5);
    cleanup(tmpDir);
  });
});

// ─── getContextForLLM ───────────────────────────────────────────────

describe('ContextBox getContextForLLM', () => {
  test('returns identity, intent, qualification, keyFacts', () => {
    const { box, tmpDir } = createTestBox();
    box.set('llm-test', {
      pillars: {
        identity: { email: 'test@test.com' },
        intent: { type: 'booking' },
        qualification: { score: 75 },
        keyFacts: [{ type: 'budget', value: '500€' }]
      }
    });

    const llm = box.getContextForLLM('llm-test');
    assert.strictEqual(llm.identity.email, 'test@test.com');
    assert.strictEqual(llm.intent.type, 'booking');
    assert.strictEqual(llm.qualification.score, 75);
    assert.strictEqual(llm.keyFacts.length, 1);
    cleanup(tmpDir);
  });

  test('limits history to fit token budget', () => {
    const { box, tmpDir } = createTestBox();

    // Add many history events
    const events = Array.from({ length: 20 }, (_, i) => ({
      timestamp: new Date().toISOString(),
      agent: 'Agent',
      event: `event_${i}`,
      detail: 'x'.repeat(100) // ~25 tokens each
    }));

    box.set('budget-test', { pillars: { history: events } });
    const llm = box.getContextForLLM('budget-test', 200); // Very tight budget
    assert.ok(llm.recentHistory.length < 20); // Should be truncated
    cleanup(tmpDir);
  });
});

// ─── extractKeyFact ─────────────────────────────────────────────────

describe('ContextBox extractKeyFact', () => {
  test('adds key fact to context', () => {
    const { box, tmpDir } = createTestBox();
    box.extractKeyFact('fact-test', 'budget', '500€', 'conversation');
    const ctx = box.get('fact-test');
    assert.strictEqual(ctx.pillars.keyFacts.length, 1);
    assert.strictEqual(ctx.pillars.keyFacts[0].type, 'budget');
    assert.strictEqual(ctx.pillars.keyFacts[0].value, '500€');
    assert.strictEqual(ctx.pillars.keyFacts[0].source, 'conversation');
    assert.ok(ctx.pillars.keyFacts[0].extractedAt);
    cleanup(tmpDir);
  });

  test('accumulates multiple facts', () => {
    const { box, tmpDir } = createTestBox();
    box.extractKeyFact('multi-fact', 'budget', '500€');
    box.extractKeyFact('multi-fact', 'timeline', 'Q1 2027');
    box.extractKeyFact('multi-fact', 'pain_point', 'manual processes');
    const ctx = box.get('multi-fact');
    assert.strictEqual(ctx.pillars.keyFacts.length, 3);
    cleanup(tmpDir);
  });
});

// ─── logEvent ───────────────────────────────────────────────────────

describe('ContextBox logEvent', () => {
  test('appends event to history', () => {
    const { box, tmpDir } = createTestBox();
    box.logEvent('event-test', 'VoiceAgent', 'message_received', { text: 'Hello' });
    const ctx = box.get('event-test');
    assert.strictEqual(ctx.pillars.history.length, 1);
    assert.strictEqual(ctx.pillars.history[0].agent, 'VoiceAgent');
    assert.strictEqual(ctx.pillars.history[0].event, 'message_received');
    assert.ok(ctx.pillars.history[0].timestamp);
    cleanup(tmpDir);
  });
});

// ─── _predictNextAgent ──────────────────────────────────────────────

describe('ContextBox _predictNextAgent', () => {
  test('predicts BillingAgent for high score', () => {
    const { box, tmpDir } = createTestBox();
    const result = box._predictNextAgent({
      pillars: { qualification: { score: 75 } }
    });
    assert.strictEqual(result, 'BillingAgent');
    cleanup(tmpDir);
  });

  test('predicts BookingAgent for medium score', () => {
    const { box, tmpDir } = createTestBox();
    const result = box._predictNextAgent({
      pillars: { qualification: { score: 50 } }
    });
    assert.strictEqual(result, 'BookingAgent');
    cleanup(tmpDir);
  });

  test('predicts SupportAgent for support intent', () => {
    const { box, tmpDir } = createTestBox();
    const result = box._predictNextAgent({
      pillars: { qualification: {}, intent: { type: 'support' } }
    });
    assert.strictEqual(result, 'SupportAgent');
    cleanup(tmpDir);
  });

  test('defaults to VoiceAgent', () => {
    const { box, tmpDir } = createTestBox();
    const result = box._predictNextAgent({
      pillars: { qualification: {}, intent: {} }
    });
    assert.strictEqual(result, 'VoiceAgent');
    cleanup(tmpDir);
  });
});

// ─── _suggestActions ────────────────────────────────────────────────

describe('ContextBox _suggestActions', () => {
  test('suggests extract_budget when missing', () => {
    const { box, tmpDir } = createTestBox();
    const actions = box._suggestActions({
      pillars: { qualification: { score: 30 }, history: [] }
    });
    assert.ok(actions.includes('extract_budget'));
    cleanup(tmpDir);
  });

  test('suggests extract_timeline when missing', () => {
    const { box, tmpDir } = createTestBox();
    const actions = box._suggestActions({
      pillars: { qualification: { budget: '500€' }, history: [] }
    });
    assert.ok(actions.includes('extract_timeline'));
    cleanup(tmpDir);
  });

  test('suggests offer_booking for qualified lead', () => {
    const { box, tmpDir } = createTestBox();
    const actions = box._suggestActions({
      pillars: { qualification: { score: 55, budget: '500€', timeline: 'Q1' }, history: [] }
    });
    assert.ok(actions.includes('offer_booking'));
    cleanup(tmpDir);
  });

  test('does not suggest offer_booking if already offered', () => {
    const { box, tmpDir } = createTestBox();
    const actions = box._suggestActions({
      pillars: {
        qualification: { score: 60, budget: '500€', timeline: 'Q1' },
        history: [{ event: 'booking_offered' }]
      }
    });
    assert.ok(!actions.includes('offer_booking'));
    cleanup(tmpDir);
  });
});

// ─── listSessions ───────────────────────────────────────────────────

describe('ContextBox listSessions', () => {
  test('returns empty array for empty storage', () => {
    const { box, tmpDir } = createTestBox();
    const sessions = box.listSessions();
    assert.deepStrictEqual(sessions, []);
    cleanup(tmpDir);
  });

  test('lists created sessions', () => {
    const { box, tmpDir } = createTestBox();
    box.set('session-a', { pillars: { identity: { email: 'a@a.com' } } });
    box.set('session-b', { pillars: { identity: { email: 'b@b.com' } } });
    const sessions = box.listSessions();
    assert.strictEqual(sessions.length, 2);
    assert.ok(sessions.find(s => s.id === 'session-a'));
    assert.ok(sessions.find(s => s.id === 'session-b'));
    cleanup(tmpDir);
  });
});

// ─── cleanupStale ───────────────────────────────────────────────────

describe('ContextBox cleanupStale', () => {
  test('returns 0 when no stale sessions', () => {
    const { box, tmpDir } = createTestBox();
    box.set('recent', { pillars: { identity: {} } });
    const cleaned = box.cleanupStale(24);
    assert.strictEqual(cleaned, 0);
    cleanup(tmpDir);
  });
});

// ─── handoff ───────────────────────────────────────────────────────────

describe('ContextBox handoff', () => {
  test('logs HANDOFF event with context snapshot', () => {
    const { box, tmpDir } = createTestBox();
    box.set('handoff-1', {
      pillars: {
        identity: { email: 'lead@test.com' },
        intent: { type: 'booking' },
        qualification: { score: 65, budget: '500€' },
        keyFacts: [{ type: 'budget', value: '500€' }]
      }
    });

    box.handoff('handoff-1', 'VoiceAgent', 'BookingAgent', 'qualified lead');

    const ctx = box.get('handoff-1');
    const handoffEvent = ctx.pillars.history.find(e => e.event === 'HANDOFF');
    assert.ok(handoffEvent, 'Should have HANDOFF event in history');
    assert.strictEqual(handoffEvent.agent, 'VoiceAgent');
    assert.strictEqual(handoffEvent.target, 'BookingAgent');
    assert.strictEqual(handoffEvent.reason, 'qualified lead');
    assert.ok(handoffEvent.contextSnapshot);
    assert.ok(handoffEvent.contextSnapshot.keyFacts);
    assert.ok(handoffEvent.contextSnapshot.intent);
    assert.ok(handoffEvent.contextSnapshot.qualification);
    cleanup(tmpDir);
  });

  test('handoff on empty context still works', () => {
    const { box, tmpDir } = createTestBox();
    assert.doesNotThrow(() => {
      box.handoff('handoff-empty', 'AgentA', 'AgentB', 'reason');
    });
    const ctx = box.get('handoff-empty');
    const handoffEvent = ctx.pillars.history.find(e => e.event === 'HANDOFF');
    assert.ok(handoffEvent);
    cleanup(tmpDir);
  });
});

// ─── getWithPrediction ─────────────────────────────────────────────────

describe('ContextBox getWithPrediction', () => {
  test('returns {primary, related, prediction} with correct structure', () => {
    const { box, tmpDir } = createTestBox();
    box.set('predict-1', {
      pillars: {
        qualification: { score: 75, budget: '500€' },
        intent: {},
        history: []
      }
    });

    const result = box.getWithPrediction('predict-1');
    assert.ok(result.primary);
    assert.ok(Array.isArray(result.related));
    assert.ok(result.prediction);
    assert.strictEqual(result.prediction.likelyNextAgent, 'BillingAgent');
    assert.ok(Array.isArray(result.prediction.suggestedActions));
    cleanup(tmpDir);
  });

  test('includes related contexts when provided', () => {
    const { box, tmpDir } = createTestBox();
    box.set('main-ctx', { pillars: { identity: { email: 'a@a.com' } } });
    box.set('related-ctx', { pillars: { identity: { email: 'b@b.com' } } });

    const result = box.getWithPrediction('main-ctx', ['related-ctx']);
    assert.strictEqual(result.related.length, 1);
    assert.strictEqual(result.related[0].id, 'related-ctx');
    assert.ok(result.related[0].context);
    cleanup(tmpDir);
  });

  test('medium score → predicts BookingAgent', () => {
    const { box, tmpDir } = createTestBox();
    box.set('predict-med', {
      pillars: {
        qualification: { score: 50 },
        history: []
      }
    });

    const result = box.getWithPrediction('predict-med');
    assert.strictEqual(result.prediction.likelyNextAgent, 'BookingAgent');
    cleanup(tmpDir);
  });
});

// ─── B110: getTenantFacts + promoteFact chain ────────────────────────────────

describe('ContextBox getTenantFacts + promoteFact (B110)', () => {
  const tenantId = `ctx_test_${Date.now()}`;

  test('promoteFact returns false without tenantId', async () => {
    const { box, tmpDir } = createTestBox();
    const result = await box.promoteFact('sess1', null, { key: 'hours', value: '9-18h' });
    assert.strictEqual(result, false, 'Should reject when tenantId is null');
    cleanup(tmpDir);
  });

  test('promoteFact returns false with empty tenantId', async () => {
    const { box, tmpDir } = createTestBox();
    const result = await box.promoteFact('sess1', '', { key: 'hours', value: '9-18h' });
    assert.strictEqual(result, false, 'Should reject when tenantId is empty string');
    cleanup(tmpDir);
  });

  test('promoteFact enriches fact with sessionId and delegates to TenantMemory', async () => {
    const { box, tmpDir } = createTestBox();

    // Spy on tenantMemory.promoteFact to capture what ContextBox sends
    let capturedTenantId, capturedFact;
    const origPromote = box.tenantMemory.promoteFact;
    box.tenantMemory.promoteFact = async (tid, fact) => {
      capturedTenantId = tid;
      capturedFact = fact;
      return true;
    };

    const result = await box.promoteFact('session-abc', tenantId, {
      key: 'specialty',
      value: 'orthodontie'
    });

    assert.strictEqual(result, true);
    assert.strictEqual(capturedTenantId, tenantId, 'Should pass tenant ID through');
    assert.strictEqual(capturedFact.sessionId, 'session-abc', 'Should enrich fact with sessionId');
    assert.strictEqual(capturedFact.key, 'specialty');
    assert.strictEqual(capturedFact.value, 'orthodontie');

    // Restore
    box.tenantMemory.promoteFact = origPromote;
    cleanup(tmpDir);
  });

  test('getTenantFacts delegates to tenantMemory.getFacts', async () => {
    const { box, tmpDir } = createTestBox();

    // Spy on tenantMemory.getFacts
    let capturedTenantId, capturedOptions;
    const origGetFacts = box.tenantMemory.getFacts;
    box.tenantMemory.getFacts = async (tid, opts) => {
      capturedTenantId = tid;
      capturedOptions = opts;
      return [
        { key: 'hours', value: '9h-18h', confidence: 0.9 },
        { key: 'specialty', value: 'orthodontie', confidence: 0.85 }
      ];
    };

    const facts = await box.getTenantFacts(tenantId, { limit: 5 });
    assert.strictEqual(capturedTenantId, tenantId);
    assert.deepStrictEqual(capturedOptions, { limit: 5 });
    assert.strictEqual(facts.length, 2);
    assert.strictEqual(facts[0].key, 'hours');
    assert.strictEqual(facts[1].value, 'orthodontie');

    // Restore
    box.tenantMemory.getFacts = origGetFacts;
    cleanup(tmpDir);
  });

  test('getTenantFacts returns empty array for unknown tenant', async () => {
    const { box, tmpDir } = createTestBox();

    // Use real tenantMemory — unknown tenant has no facts
    const facts = await box.getTenantFacts(`unknown_${Date.now()}`);
    assert.ok(Array.isArray(facts), 'Should return an array');
    assert.strictEqual(facts.length, 0, 'Unknown tenant should have no facts');

    cleanup(tmpDir);
  });

  test('full chain: promoteFact → getTenantFacts round-trip', async () => {
    const { box, tmpDir } = createTestBox();
    const tid = `chain_test_${Date.now()}`;

    // Promote 3 facts (TenantMemory normalizes: keeps type, value, source, sessionId)
    await box.promoteFact('sess-chain-1', tid, {
      type: 'business_hours',
      value: 'Lun-Ven 9h-18h',
      confidence: 0.95,
      source: 'explicit'
    });
    await box.promoteFact('sess-chain-1', tid, {
      type: 'location',
      value: 'Casablanca',
      confidence: 0.9,
      source: 'explicit'
    });
    await box.promoteFact('sess-chain-2', tid, {
      type: 'specialty',
      value: 'implants dentaires',
      confidence: 0.85,
      source: 'inferred'
    });

    // Retrieve all facts
    const facts = await box.getTenantFacts(tid);
    assert.ok(Array.isArray(facts), 'Should return array');
    assert.ok(facts.length >= 2, `Should have at least 2 facts (got ${facts.length})`);

    // Verify facts contain our promoted values
    const values = facts.map(f => f.value);
    assert.ok(
      values.includes('Lun-Ven 9h-18h') || values.includes('Casablanca') || values.includes('implants dentaires'),
      `Should contain at least one promoted fact value (got: ${values.join(', ')})`
    );

    // Verify facts have enriched sessionId from ContextBox.promoteFact
    const sessionIds = [...new Set(facts.map(f => f.sessionId))];
    assert.ok(
      sessionIds.includes('sess-chain-1') || sessionIds.includes('sess-chain-2'),
      'Should contain enriched sessionId from promoteFact'
    );

    // Cleanup TenantMemory data for this tenant
    try {
      await box.tenantMemory.purgeTenantMemory(tid);
    } catch { /* ignore if purge fails */ }
    cleanup(tmpDir);
  });
});
