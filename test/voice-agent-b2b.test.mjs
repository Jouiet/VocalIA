/**
 * VocalIA Voice Agent B2B Tests
 *
 * Tests:
 * - AGENT_CARD structure (A2A Protocol compliance)
 * - TASK_STATES enum
 * - SERVICE_PACKS (3 plans with bilingual fields)
 * - RAGRetrieval (constructor, formatContextForPrompt, retrieveContext uninit)
 * - VoiceAgentB2B._generateFallbackResponse (12+ keyword categories)
 * - VoiceAgentB2B session lifecycle (startSession, endSession, getStatus)
 *
 * NOTE: Tests offline logic only. No Grok API calls.
 *
 * Run: node --test test/voice-agent-b2b.test.mjs
 */



import { test, describe } from 'node:test';
import assert from 'node:assert';
import { VoiceAgentB2B, RAGRetrieval, SERVICE_PACKS } from '../core/voice-agent-b2b.cjs';

// ─── SERVICE_PACKS ──────────────────────────────────────────────────

describe('VoiceAgentB2B SERVICE_PACKS', () => {
  test('has 4 plans', () => {
    assert.strictEqual(Object.keys(SERVICE_PACKS).length, 4);
  });

  test('has starter plan', () => {
    assert.ok(SERVICE_PACKS.starter);
    assert.strictEqual(SERVICE_PACKS.starter.name, 'Starter');
  });

  test('has pro plan', () => {
    assert.ok(SERVICE_PACKS.pro);
    assert.strictEqual(SERVICE_PACKS.pro.name, 'Pro');
  });

  test('has ecommerce plan', () => {
    assert.ok(SERVICE_PACKS.ecommerce);
    assert.strictEqual(SERVICE_PACKS.ecommerce.name, 'E-commerce');
  });

  test('has telephony plan', () => {
    assert.ok(SERVICE_PACKS.telephony);
    assert.strictEqual(SERVICE_PACKS.telephony.name, 'Telephony');
  });

  test('each plan has bilingual names', () => {
    for (const [key, pack] of Object.entries(SERVICE_PACKS)) {
      assert.ok(pack.name, `${key} missing name`);
      assert.ok(pack.name_fr, `${key} missing name_fr`);
    }
  });

  test('each plan has price and description', () => {
    for (const [key, pack] of Object.entries(SERVICE_PACKS)) {
      assert.ok(pack.price, `${key} missing price`);
      assert.ok(pack.description, `${key} missing description`);
      assert.ok(pack.description_fr, `${key} missing description_fr`);
    }
  });

  test('each plan has includes array', () => {
    for (const [key, pack] of Object.entries(SERVICE_PACKS)) {
      assert.ok(Array.isArray(pack.includes), `${key} missing includes`);
      assert.ok(pack.includes.length >= 3, `${key} includes too short`);
    }
  });

  test('all plans have EUR pricing', () => {
    for (const [key, pack] of Object.entries(SERVICE_PACKS)) {
      assert.ok(pack.price.includes('€'), `${key} price should be in EUR: ${pack.price}`);
    }
  });
});

// ─── RAGRetrieval ───────────────────────────────────────────────────

describe('VoiceAgentB2B RAGRetrieval', () => {
  test('constructor initializes empty', () => {
    const rag = new RAGRetrieval();
    assert.strictEqual(rag.kb, null);
    assert.strictEqual(rag.isInitialized, false);
  });

  test('retrieveContext returns empty when not initialized', () => {
    const rag = new RAGRetrieval();
    const result = rag.retrieveContext('test query');
    assert.deepStrictEqual(result, []);
  });

  test('formatContextForPrompt returns fallback for empty context', () => {
    const rag = new RAGRetrieval();
    const result = rag.formatContextForPrompt([]);
    assert.ok(result.includes('No relevant'));
  });

  test('formatContextForPrompt returns fallback for null', () => {
    const rag = new RAGRetrieval();
    const result = rag.formatContextForPrompt(null);
    assert.ok(result.includes('No relevant'));
  });

  test('formatContextForPrompt formats context items', () => {
    const rag = new RAGRetrieval();
    const context = [
      { title: 'Lead Scoring', category: 'CRM', category_name: 'CRM', benefit_en: 'Faster qualification', frequency_en: 'Real-time', agentic_level: 3, id: 'ls1' },
      { title: 'Email Campaign', category: 'Marketing', benefit_en: 'Better engagement', frequency_en: 'Daily', id: 'ec1' }
    ];
    const result = rag.formatContextForPrompt(context);
    assert.ok(result.includes('RELEVANT AUTOMATIONS'));
    assert.ok(result.includes('Lead Scoring'));
    assert.ok(result.includes('Email Campaign'));
    assert.ok(result.includes('Faster qualification'));
    assert.ok(result.includes('L3'));
  });
});

// ─── VoiceAgentB2B fallback responses ───────────────────────────────

describe('VoiceAgentB2B _generateFallbackResponse', () => {
  const agent = new VoiceAgentB2B();

  test('responds to pricing keywords', () => {
    const resp = agent._generateFallbackResponse('What is the pricing?', '');
    assert.ok(resp.includes('plans') || resp.includes('Pro') || resp.includes('990'));
  });

  test('responds to booking keywords', () => {
    const resp = agent._generateFallbackResponse('Can I book a demo?', '');
    assert.ok(resp.includes('book') || resp.includes('discovery') || resp.includes('vocalia.ma'));
  });

  test('responds to widget keywords', () => {
    const resp = agent._generateFallbackResponse('Tell me about the widget', '');
    assert.ok(resp.includes('Widget') || resp.includes('JavaScript'));
  });

  test('responds to telephony keywords', () => {
    const resp = agent._generateFallbackResponse('Do you have phone integration?', '');
    assert.ok(resp.includes('Telephony') || resp.includes('phone') || resp.includes('PSTN'));
  });

  test('responds to voice AI keywords', () => {
    const resp = agent._generateFallbackResponse('Tell me about voice AI', '');
    assert.ok(resp.includes('Voice AI') || resp.includes('VocalIA'));
  });

  test('responds to persona keywords', () => {
    const resp = agent._generateFallbackResponse('What personas do you have?', '');
    assert.ok(resp.includes('persona') || resp.includes('40'));
  });

  test('responds to language keywords', () => {
    const resp = agent._generateFallbackResponse('Do you support darija?', '');
    assert.ok(resp.includes('Darija') || resp.includes('language'));
  });

  test('responds to integration keywords', () => {
    const resp = agent._generateFallbackResponse('Do you integrate with hubspot?', '');
    assert.ok(resp.includes('integrat') || resp.includes('MCP') || resp.includes('HubSpot'));
  });

  test('responds to ecommerce keywords', () => {
    const resp = agent._generateFallbackResponse('I have an ecommerce store', '');
    assert.ok(resp.includes('commerce') || resp.includes('Shopify') || resp.includes('WooCommerce'));
  });

  test('responds to greetings', () => {
    const resp = agent._generateFallbackResponse('bonjour', '');
    assert.ok(resp.includes('Hello') || resp.includes('Welcome') || resp.includes('VocalIA'));
  });

  test('responds to "what do you do"', () => {
    const resp = agent._generateFallbackResponse('What do you offer?', '');
    assert.ok(resp.includes('VocalIA') || resp.includes('Voice'));
  });

  test('responds with RAG context hint', () => {
    const resp = agent._generateFallbackResponse('random', 'RELEVANT AUTOMATIONS:\nSomething');
    assert.ok(resp.includes('relevant') || resp.includes('Voice'));
  });

  test('returns default for unknown input', () => {
    const resp = agent._generateFallbackResponse('xyzzy quantum flux', '');
    assert.ok(resp.includes('VocalIA') || resp.includes('Voice'));
  });
});

// ─── VoiceAgentB2B session lifecycle ────────────────────────────────

describe('VoiceAgentB2B session lifecycle', () => {
  test('startSession returns sessionId', () => {
    const agent = new VoiceAgentB2B();
    const sessionId = agent.startSession();
    assert.ok(sessionId);
    assert.strictEqual(typeof sessionId, 'string');
    assert.ok(sessionId.length > 5);
  });

  test('startSession creates session object', () => {
    const agent = new VoiceAgentB2B();
    agent.startSession();
    assert.ok(agent.currentSession);
    assert.ok(agent.currentSession.started_at);
    assert.deepStrictEqual(agent.currentSession.messages, []);
    assert.deepStrictEqual(agent.currentSession.automations_discussed, []);
  });

  test('endSession without active session returns error', () => {
    const agent = new VoiceAgentB2B();
    const result = agent.endSession();
    assert.strictEqual(result.success, false);
    assert.ok(result.error);
  });

  test('endSession saves log and clears session', () => {
    const agent = new VoiceAgentB2B();
    agent.startSession();
    const result = agent.endSession();
    assert.strictEqual(result.success, true);
    assert.ok(result.session_id);
    assert.strictEqual(result.message_count, 0);
    assert.strictEqual(agent.currentSession, null);
  });

  test('getStatus returns expected shape', () => {
    const agent = new VoiceAgentB2B();
    const status = agent.getStatus();
    assert.strictEqual(typeof status.rag_initialized, 'boolean');
    assert.strictEqual(typeof status.api_key_configured, 'boolean');
    assert.ok(Array.isArray(status.service_packs));
    assert.strictEqual(status.service_packs.length, 4);
  });

  test('getStatus shows active session when started', () => {
    const agent = new VoiceAgentB2B();
    const sessionId = agent.startSession();
    const status = agent.getStatus();
    assert.strictEqual(status.active_session, sessionId);
    agent.endSession();
  });
});
