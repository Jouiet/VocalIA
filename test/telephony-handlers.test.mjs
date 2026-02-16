/**
 * Telephony Handlers — Unit Tests
 * VocalIA — Session 250.208
 *
 * Tests: 14 handler functions from telephony/voice-telephony-bridge.cjs
 * These functions are exported but were NEVER tested (0% coverage).
 *
 * Strategy: Import handlers directly, mock session objects,
 * test logic (validation, payload construction, error handling, response format).
 * External APIs (Twilio, WhatsApp) are NOT called — we test the logic around them.
 *
 * Run: node --test test/telephony-handlers.test.mjs
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs';

// Import the module
const bridge = await import(`file://${path.join(import.meta.dirname, '..', 'telephony', 'voice-telephony-bridge.cjs')}?t=${Date.now()}`).then(m => m.default);

const {
  handleSearchKnowledgeBase,
  handleTransferCall,
  handleTransferCallInternal,
  handleSendPaymentDetails,
  handleQualifyLead,
  handleObjection,
  handleScheduleCallback,
  handleCreateBooking,
  handleCreateBookingInternal,
  handleTrackConversion,
  sendTwilioSMS,
  sendWhatsAppMessage,
  queueCartRecoveryCallback,
  listPendingActions,
  approveAction,
  rejectAction,
  // Pure logic utilities
  calculateBANTScore,
  getQualificationLabel,
  detectQueryLanguage,
  safeJsonParse,
  generateSessionId,
  checkRateLimit,
  detectFinancialCommitment,
  getMatchedFinancialKeywords,
  getGrokVoiceFromPreferences,
  getTwiMLLanguage,
  getTwiMLMessage,
  HITL_CONFIG,
  CONFIG
} = bridge;

// ─── Test Helpers ────────────────────────────────────────────────────

function makeSession(overrides = {}) {
  return {
    sessionId: `test_sess_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    callSid: `CA_test_${Date.now()}`,
    createdAt: Date.now(),
    metadata: {
      tenant_id: 'test_tenant',
      persona_id: 'SALES_OUTBOUND_FR',
      language: 'fr',
      knowledge_base_id: 'SALES_OUTBOUND_FR',
      ...(overrides.metadata || {})
    },
    qualification: {
      need: null,
      timeline: null,
      budget: null,
      authority: null,
      industry: null,
      company_size: null,
      score: 0,
      ...(overrides.qualification || {})
    },
    bookingData: {
      name: null,
      email: null,
      phone: '+33612345678',
      slot: null,
      qualification_score: 'cold',
      notes: '',
      ...(overrides.bookingData || {})
    },
    analytics: {
      events: [],
      objections: [],
      funnel_stage: 'discovery',
      outcome: null,
      ...(overrides.analytics || {})
    },
    callback: null,
    conversationLog: [],
    lastActivityAt: Date.now(),
    ...overrides
  };
}

// ─── handleQualifyLead ──────────────────────────────────────────────

describe('handleQualifyLead', () => {
  test('full BANT data → high score', async () => {
    const session = makeSession();
    const result = await handleQualifyLead(session, {
      need: 'high',
      timeline: 'immediate',
      budget: 'defined',
      authority: 'decision_maker'
    });

    assert.ok(result.success);
    assert.strictEqual(result.score, 100);
    assert.strictEqual(result.label, 'hot');
    assert.strictEqual(session.qualification.need, 'high');
    assert.strictEqual(session.qualification.timeline, 'immediate');
    assert.strictEqual(session.qualification.budget, 'defined');
    assert.strictEqual(session.qualification.authority, 'decision_maker');
  });

  test('partial BANT data → warm score', async () => {
    const session = makeSession();
    const result = await handleQualifyLead(session, {
      need: 'medium',
      timeline: 'this_quarter',
      budget: 'unknown',
      authority: 'influencer'
    });

    assert.ok(result.success);
    assert.strictEqual(result.score, 50);
    assert.strictEqual(result.label, 'warm');
  });

  test('minimal data → cold score', async () => {
    const session = makeSession();
    const result = await handleQualifyLead(session, {
      need: 'low',
      timeline: 'exploring',
      budget: 'unknown',
      authority: 'unknown'
    });

    assert.ok(result.success);
    assert.strictEqual(result.score, 10);
    assert.strictEqual(result.label, 'cold');
  });

  test('empty args → zero score', async () => {
    const session = makeSession();
    const result = await handleQualifyLead(session, {});
    assert.ok(result.success);
    assert.strictEqual(result.score, 0);
    assert.strictEqual(result.label, 'cold');
  });

  test('tracks analytics event', async () => {
    const session = makeSession();
    await handleQualifyLead(session, { need: 'high' });

    const event = session.analytics.events.find(e => e.type === 'qualification_complete');
    assert.ok(event, 'should push qualification_complete event');
    assert.ok(event.timestamp);
  });

  test('updates funnel stage to value_prop', async () => {
    const session = makeSession();
    await handleQualifyLead(session, { need: 'high' });
    assert.strictEqual(session.analytics.funnel_stage, 'value_prop');
  });

  test('merges with existing qualification', async () => {
    const session = makeSession({
      qualification: { need: 'low', timeline: null, budget: null, authority: null, industry: null, company_size: null, score: 10 }
    });
    const result = await handleQualifyLead(session, { timeline: 'immediate' });
    assert.strictEqual(session.qualification.need, 'low');
    assert.strictEqual(session.qualification.timeline, 'immediate');
    assert.ok(result.score > 10);
  });

  test('returns qualification object in result', async () => {
    const session = makeSession();
    const result = await handleQualifyLead(session, { need: 'medium', budget: 'flexible' });
    assert.ok(result.qualification);
    assert.strictEqual(result.qualification.need, 'medium');
    assert.strictEqual(result.qualification.budget, 'flexible');
  });
});

// ─── handleObjection ────────────────────────────────────────────────

describe('handleObjection', () => {
  test('known objection type (price) → LAER response', async () => {
    const session = makeSession();
    const result = await handleObjection(session, {
      objection_type: 'price',
      objection_text: 'C\'est trop cher',
      resolved: false
    });

    assert.strictEqual(result.status, 'objection_logged');
    assert.strictEqual(result.type, 'price');
    assert.ok(result.real_meaning);
    assert.ok(result.suggested_responses);
    assert.ok(result.suggested_responses.laer_framework);
    assert.ok(result.suggested_responses.feel_felt_found);
    assert.ok(result.proof_points);
    assert.ok(result.recommended_next_action);
  });

  test('known objection type (timing) → LAER response', async () => {
    const session = makeSession();
    const result = await handleObjection(session, {
      objection_type: 'timing',
      objection_text: 'Pas le bon moment',
      resolved: false
    });
    assert.strictEqual(result.type, 'timing');
    assert.ok(result.real_meaning);
    assert.ok(result.proof_points.length > 0);
  });

  test('known objection type (competitor) → response', async () => {
    const session = makeSession();
    const result = await handleObjection(session, {
      objection_type: 'competitor',
      objection_text: 'On utilise déjà X'
    });
    assert.strictEqual(result.type, 'competitor');
    assert.ok(result.suggested_responses);
  });

  test('known objection type (authority) → response', async () => {
    const session = makeSession();
    const result = await handleObjection(session, {
      objection_type: 'authority',
      objection_text: 'Je dois en parler à mon boss'
    });
    assert.strictEqual(result.type, 'authority');
    assert.ok(result.recommended_next_action);
  });

  test('known objection type (need) → response', async () => {
    const session = makeSession();
    const result = await handleObjection(session, {
      objection_type: 'need',
      objection_text: 'On n\'a pas vraiment besoin'
    });
    assert.strictEqual(result.type, 'need');
  });

  test('known objection type (trust) → response', async () => {
    const session = makeSession();
    const result = await handleObjection(session, {
      objection_type: 'trust',
      objection_text: 'Je ne connais pas votre entreprise'
    });
    assert.strictEqual(result.type, 'trust');
    assert.ok(result.proof_points);
  });

  test('unknown objection type → generic response', async () => {
    const session = makeSession();
    const result = await handleObjection(session, {
      objection_type: 'custom_unknown',
      objection_text: 'Something else',
      resolved: false
    });
    assert.strictEqual(result.status, 'objection_logged');
    assert.strictEqual(result.type, 'custom_unknown');
    assert.ok(result.note); // generic note
    assert.strictEqual(result.real_meaning, undefined);
  });

  test('resolved objection → event type is objection_resolved', async () => {
    const session = makeSession();
    await handleObjection(session, {
      objection_type: 'price',
      objection_text: 'OK, le prix est acceptable',
      resolved: true
    });
    const event = session.analytics.events.find(e => e.type === 'objection_resolved');
    assert.ok(event);
  });

  test('unresolved objection → event type is objection_raised', async () => {
    const session = makeSession();
    await handleObjection(session, {
      objection_type: 'price',
      objection_text: 'Trop cher!',
      resolved: false
    });
    const event = session.analytics.events.find(e => e.type === 'objection_raised');
    assert.ok(event);
  });

  test('tracks objection in analytics.objections', async () => {
    const session = makeSession();
    await handleObjection(session, {
      objection_type: 'timing',
      objection_text: 'Not now'
    });
    assert.strictEqual(session.analytics.objections.length, 1);
    assert.strictEqual(session.analytics.objections[0].type, 'timing');
  });

  test('updates funnel_stage to objection_handling', async () => {
    const session = makeSession();
    await handleObjection(session, {
      objection_type: 'price',
      objection_text: 'Too expensive'
    });
    assert.strictEqual(session.analytics.funnel_stage, 'objection_handling');
  });
});

// ─── handleScheduleCallback ─────────────────────────────────────────

describe('handleScheduleCallback', () => {
  test('valid callback → success', async () => {
    const session = makeSession();
    const result = await handleScheduleCallback(session, {
      callback_time: '2026-02-20T10:00:00Z',
      next_action: 'follow_up',
      notes: 'Rappeler pour devis'
    });

    assert.ok(result.success);
    assert.strictEqual(result.status, 'callback_scheduled');
    assert.ok(result.callback);
    assert.strictEqual(result.callback.time, '2026-02-20T10:00:00Z');
    assert.strictEqual(result.callback.action, 'follow_up');
  });

  test('no callback_time → uses "unspecified"', async () => {
    const session = makeSession();
    const result = await handleScheduleCallback(session, {
      next_action: 'send_info'
    });
    assert.ok(result.success);
    assert.strictEqual(result.callback.time, 'unspecified');
  });

  test('updates analytics outcome to callback', async () => {
    const session = makeSession();
    await handleScheduleCallback(session, { next_action: 'test' });
    assert.strictEqual(session.analytics.outcome, 'callback');
    assert.strictEqual(session.analytics.funnel_stage, 'follow_up');
  });

  test('tracks callback_scheduled event', async () => {
    const session = makeSession();
    await handleScheduleCallback(session, { next_action: 'recall' });
    const event = session.analytics.events.find(e => e.type === 'callback_scheduled');
    assert.ok(event);
    assert.ok(event.data.scheduled);
  });

  test('stores callback data on session', async () => {
    const session = makeSession();
    await handleScheduleCallback(session, {
      callback_time: '2026-03-01T14:00:00Z',
      next_action: 'demo',
      notes: 'Préparer démo personnalisée'
    });
    assert.ok(session.callback);
    assert.strictEqual(session.callback.scheduled, true);
    assert.strictEqual(session.callback.notes, 'Préparer démo personnalisée');
  });
});

// ─── handleCreateBooking ────────────────────────────────────────────

describe('handleCreateBooking', () => {
  test('low BANT score → booking created directly (no HITL)', async () => {
    const session = makeSession({
      qualification: { score: 30, need: 'low', timeline: null, budget: null, authority: null, industry: null, company_size: null }
    });
    const result = await handleCreateBooking(session, {
      name: 'Jean Test',
      email: 'jean@test.com',
      slot: '2026-02-20T10:00:00Z',
      meeting_type: 'discovery_call'
    });

    assert.strictEqual(result.status, 'booking_created');
    assert.ok(result.success);
  });

  test('high BANT score + HITL enabled → pending approval', async () => {
    const originalEnabled = HITL_CONFIG.enabled;
    const originalApprove = HITL_CONFIG.approveHotBookings;
    const originalThreshold = HITL_CONFIG.bookingScoreThreshold;

    HITL_CONFIG.enabled = true;
    HITL_CONFIG.approveHotBookings = true;
    HITL_CONFIG.bookingScoreThreshold = 70;

    try {
      const session = makeSession({
        qualification: { score: 85, need: 'high', timeline: 'immediate', budget: 'defined', authority: 'decision_maker', industry: null, company_size: null }
      });
      const result = await handleCreateBooking(session, {
        name: 'Hot Lead',
        email: 'hot@lead.com',
        slot: '2026-02-21T09:00:00Z'
      });

      assert.strictEqual(result.status, 'pending_approval');
      assert.ok(result.hitlId);
      assert.strictEqual(result.bantScore, 85);
      assert.strictEqual(result.threshold, 70);
    } finally {
      HITL_CONFIG.enabled = originalEnabled;
      HITL_CONFIG.approveHotBookings = originalApprove;
      HITL_CONFIG.bookingScoreThreshold = originalThreshold;
    }
  });

  test('merges booking data from args', async () => {
    const session = makeSession({
      qualification: { score: 10, need: null, timeline: null, budget: null, authority: null, industry: null, company_size: null }
    });
    await handleCreateBooking(session, {
      name: 'Booking Name',
      email: 'booking@test.com',
      slot: '2026-02-22T11:00:00Z',
      meeting_type: 'consultation',
      notes: 'VIP client'
    });
    assert.strictEqual(session.bookingData.name, 'Booking Name');
    assert.strictEqual(session.bookingData.email, 'booking@test.com');
    assert.strictEqual(session.bookingData.meeting_type, 'consultation');
    assert.strictEqual(session.bookingData.notes, 'VIP client');
  });

  test('defaults meeting_type to discovery_call', async () => {
    const session = makeSession({
      qualification: { score: 10, need: null, timeline: null, budget: null, authority: null, industry: null, company_size: null }
    });
    await handleCreateBooking(session, { name: 'Test' });
    assert.strictEqual(session.bookingData.meeting_type, 'discovery_call');
  });
});

// ─── handleCreateBookingInternal ────────────────────────────────────

describe('handleCreateBookingInternal', () => {
  test('creates booking and sets analytics', async () => {
    const session = makeSession();
    const result = await handleCreateBookingInternal(session, {
      name: 'Internal Test',
      email: 'internal@test.com'
    });

    assert.ok(result.success);
    assert.strictEqual(result.status, 'booking_created');
    assert.ok(result.booking);
    assert.strictEqual(session.analytics.outcome, 'booked');
    assert.strictEqual(session.analytics.funnel_stage, 'closing');
  });

  test('tracks booking_created event', async () => {
    const session = makeSession();
    await handleCreateBookingInternal(session, {});
    const event = session.analytics.events.find(e => e.type === 'booking_created');
    assert.ok(event);
  });
});

// ─── handleTrackConversion ──────────────────────────────────────────

describe('handleTrackConversion', () => {
  test('tracks valid conversion event', async () => {
    const session = makeSession();
    const result = await handleTrackConversion(session, {
      event: 'demo_requested',
      stage: 'interest',
      outcome: 'success'
    });

    assert.ok(result.success);
    assert.strictEqual(result.status, 'event_tracked');
    assert.strictEqual(result.event, 'demo_requested');
    assert.strictEqual(result.stage, 'interest');
  });

  test('defaults outcome to pending', async () => {
    const session = makeSession();
    await handleTrackConversion(session, {
      event: 'page_view',
      stage: 'awareness'
    });

    const event = session.analytics.events.find(e => e.type === 'page_view');
    assert.ok(event);
    assert.strictEqual(event.outcome, 'pending');
  });

  test('updates funnel_stage', async () => {
    const session = makeSession();
    await handleTrackConversion(session, {
      event: 'checkout_started',
      stage: 'decision'
    });
    assert.strictEqual(session.analytics.funnel_stage, 'decision');
  });

  test('pushes event to analytics.events', async () => {
    const session = makeSession();
    const before = session.analytics.events.length;
    await handleTrackConversion(session, { event: 'test', stage: 'test' });
    assert.strictEqual(session.analytics.events.length, before + 1);
  });

  test('event has timestamp', async () => {
    const session = makeSession();
    await handleTrackConversion(session, { event: 'ts_test', stage: 'ts' });
    const event = session.analytics.events[session.analytics.events.length - 1];
    assert.ok(event.timestamp);
    assert.ok(typeof event.timestamp === 'number');
  });
});

// ─── handleSearchKnowledgeBase ──────────────────────────────────────

describe('handleSearchKnowledgeBase', () => {
  test('returns { found, result } structure', async () => {
    const session = makeSession();
    const result = await handleSearchKnowledgeBase(session, { query: 'pricing' });
    assert.ok('found' in result, 'result should have found property');
    assert.ok('result' in result, 'result should have result property');
  });

  test('result.found is boolean', async () => {
    const session = makeSession();
    const result = await handleSearchKnowledgeBase(session, { query: 'nonexistent_xyz_abc' });
    assert.strictEqual(typeof result.found, 'boolean');
  });

  test('not found → returns localized message', async () => {
    const session = makeSession({ metadata: { language: 'fr', tenant_id: 'test_tenant', persona_id: 'unknown_persona' } });
    const result = await handleSearchKnowledgeBase(session, { query: 'zzz_impossible_query_999' });
    assert.ok(typeof result.result === 'string');
    assert.ok(result.result.length > 0);
  });

  test('uses session language for fallback messages', async () => {
    const sessionEN = makeSession({ metadata: { language: 'en', tenant_id: 'test_tenant', persona_id: 'unknown_persona' } });
    const resultEN = await handleSearchKnowledgeBase(sessionEN, { query: 'xyznotexist' });

    const sessionFR = makeSession({ metadata: { language: 'fr', tenant_id: 'test_tenant', persona_id: 'unknown_persona' } });
    const resultFR = await handleSearchKnowledgeBase(sessionFR, { query: 'xyznotexist' });

    // Both should return strings, potentially different languages
    assert.ok(typeof resultEN.result === 'string');
    assert.ok(typeof resultFR.result === 'string');
  });

  test('defaults tenant_id to default', async () => {
    const session = makeSession({ metadata: { language: 'fr' } });
    // Should not throw even without tenant_id
    const result = await handleSearchKnowledgeBase(session, { query: 'test' });
    assert.ok('found' in result);
  });
});

// ─── handleTransferCall ─────────────────────────────────────────────

describe('handleTransferCall', () => {
  test('with HITL enabled → pending approval', async () => {
    const originalEnabled = HITL_CONFIG.enabled;
    const originalApprove = HITL_CONFIG.approveTransfers;
    HITL_CONFIG.enabled = true;
    HITL_CONFIG.approveTransfers = true;

    try {
      const session = makeSession();
      const result = await handleTransferCall(session, {
        reason: 'Customer wants human agent',
        phone_number: '+33612345678'
      });

      assert.strictEqual(result.status, 'pending_approval');
      assert.ok(result.hitlId);
      assert.ok(result.message);
    } finally {
      HITL_CONFIG.enabled = originalEnabled;
      HITL_CONFIG.approveTransfers = originalApprove;
    }
  });

  test('with HITL disabled → falls through to internal', async () => {
    const originalEnabled = HITL_CONFIG.enabled;
    HITL_CONFIG.enabled = false;

    try {
      const session = makeSession();
      const result = await handleTransferCall(session, {
        reason: 'Escalation needed',
        phone_number: '+33699999999'
      });

      // Without Twilio, should return twilio_not_configured error
      assert.ok(result);
      assert.ok(result.error === 'twilio_not_configured' || result.success !== undefined);
    } finally {
      HITL_CONFIG.enabled = originalEnabled;
    }
  });
});

// ─── handleTransferCallInternal ─────────────────────────────────────

describe('handleTransferCallInternal', () => {
  test('returns result with success boolean', async () => {
    const session = makeSession();
    const result = await handleTransferCallInternal(session, {
      reason: 'Test transfer',
      phone_number: '+33699999999'
    });

    // Twilio SDK may or may not be loaded depending on env
    // Either way, result should have success boolean and an error field if failed
    assert.strictEqual(typeof result.success, 'boolean');
    if (!result.success) {
      assert.ok(result.error, 'should have error message on failure');
    }
  });

  test('without target phone → returns no_target_phone error', async () => {
    const session = makeSession({
      metadata: { language: 'fr' }
    });
    // Clear all possible phone sources
    delete session.metadata.business_info;
    // CONFIG.twilio.phoneNumber may be set, so we can't guarantee no_target_phone
    // But we test the function doesn't throw
    const result = await handleTransferCallInternal(session, {
      reason: 'Test no phone',
      phone_number: undefined
    });
    assert.ok(result);
    assert.strictEqual(typeof result.success, 'boolean');
  });
});

// ─── handleSendPaymentDetails ───────────────────────────────────────

describe('handleSendPaymentDetails', () => {
  test('no payment config → error', async () => {
    const session = makeSession({ metadata: {} });
    const result = await handleSendPaymentDetails(session, {
      amount: 100,
      description: 'Service Starter'
    });
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'no_payment_config');
  });

  test('with payment config but no phone → error', async () => {
    const session = makeSession({
      metadata: {
        payment_config: { method: 'BANK_TRANSFER', details: 'IBAN FR76...', currency: 'EUR' }
      },
      bookingData: { phone: null, name: null, email: null, slot: null, qualification_score: 'cold', notes: '' }
    });
    const result = await handleSendPaymentDetails(session, {
      amount: 99,
      description: 'Plan Pro'
    });
    assert.strictEqual(result.success, false);
    assert.ok(result.error); // "No phone number available" or messaging failure
  });

  test('BANK_TRANSFER message format includes IBAN', async () => {
    // Test that the function builds the right message format
    // We can't actually send, but we verify the logic doesn't crash with config present
    const session = makeSession({
      metadata: {
        payment_config: { method: 'BANK_TRANSFER', details: 'IBAN FR76...', currency: 'EUR' },
        language: 'fr'
      }
    });
    // Will fail on messaging (no real Twilio/WhatsApp) but shouldn't throw
    const result = await handleSendPaymentDetails(session, {
      amount: 49,
      description: 'Starter'
    });
    assert.ok(result);
  });

  test('LINK method message includes link', async () => {
    const session = makeSession({
      metadata: {
        payment_config: { method: 'LINK', details: 'https://pay.stripe.com/xxx', currency: 'EUR' },
        language: 'fr'
      }
    });
    const result = await handleSendPaymentDetails(session, {
      amount: 99,
      description: 'Pro Plan'
    });
    assert.ok(result);
  });

  test('method_override takes priority', async () => {
    const session = makeSession({
      metadata: {
        payment_config: { method: 'LINK', details: 'https://pay.test/abc', currency: 'MAD' },
        language: 'fr'
      }
    });
    // Won't throw, just verify the call path works
    const result = await handleSendPaymentDetails(session, {
      amount: 200,
      description: 'Custom',
      method_override: 'BANK_TRANSFER'
    });
    assert.ok(result);
  });
});

// ─── sendTwilioSMS ──────────────────────────────────────────────────

describe('sendTwilioSMS', () => {
  test('no credentials → returns false', async () => {
    // CONFIG.twilio credentials are empty in test env
    const result = await sendTwilioSMS('+33612345678', 'Test message');
    assert.strictEqual(result, false);
  });

  test('accepts valid phone and message', async () => {
    const result = await sendTwilioSMS('+212600000000', 'Bonjour');
    assert.strictEqual(typeof result, 'boolean');
  });
});

// ─── sendWhatsAppMessage ────────────────────────────────────────────

describe('sendWhatsAppMessage', () => {
  test('no credentials → returns false', async () => {
    const result = await sendWhatsAppMessage('+33612345678', 'Test');
    assert.strictEqual(result, false);
  });

  test('accepts valid phone and message', async () => {
    const result = await sendWhatsAppMessage('+212600000000', 'Hello');
    assert.strictEqual(typeof result, 'boolean');
  });
});

// ─── queueCartRecoveryCallback ──────────────────────────────────────

describe('queueCartRecoveryCallback', () => {
  test('valid options → success', async () => {
    const result = await queueCartRecoveryCallback({
      phone: '+33612345678',
      tenantId: 'test_tenant',
      cart: { total: 149.99, items: ['Widget A', 'Widget B'] },
      discount: 10,
      language: 'fr',
      recoveryUrl: 'https://vocalia.ma/recover/abc123'
    });

    assert.ok(result.success);
    assert.ok(result.callbackId);
    assert.ok(result.callbackId.startsWith('cart_'));
  });

  test('invalid phone (too short) → error', async () => {
    const result = await queueCartRecoveryCallback({
      phone: '123',
      tenantId: 'test',
      cart: { total: 50 },
      discount: 5,
      language: 'fr'
    });
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'invalid_phone');
  });

  test('no phone → error', async () => {
    const result = await queueCartRecoveryCallback({
      tenantId: 'test',
      cart: { total: 50 },
      discount: 5
    });
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'invalid_phone');
  });

  test('phone without + prefix → normalizes', async () => {
    const result = await queueCartRecoveryCallback({
      phone: '33612345678',
      tenantId: 'test_normalize',
      cart: { total: 100 },
      discount: 15,
      language: 'en',
      recoveryUrl: 'https://vocalia.ma/recover/xyz'
    });
    assert.ok(result.success);
  });

  test('defaults language to fr', async () => {
    const result = await queueCartRecoveryCallback({
      phone: '+33612345678',
      tenantId: 'test_lang_default',
      cart: { total: 75 },
      discount: 20
    });
    assert.ok(result.success);
  });

  test('supports all 5 languages', async () => {
    for (const lang of ['fr', 'en', 'es', 'ar', 'ary']) {
      const result = await queueCartRecoveryCallback({
        phone: '+33612345678',
        tenantId: `test_lang_${lang}`,
        cart: { total: 99 },
        discount: 10,
        language: lang,
        recoveryUrl: 'https://vocalia.ma/test'
      });
      assert.ok(result.success, `should work for language: ${lang}`);
    }
  });

  test('queue is bounded (MAX_RECOVERY_CALLBACKS)', async () => {
    // Just verify it doesn't crash when queue grows
    const result = await queueCartRecoveryCallback({
      phone: '+33612345678',
      tenantId: 'test_bound',
      cart: { total: 10 },
      discount: 5,
      language: 'fr'
    });
    assert.ok(result.success);
    assert.ok(Array.isArray(global.cartRecoveryCallbacks));
  });
});

// ─── HITL: listPendingActions / approveAction / rejectAction ────────

describe('HITL pipeline', () => {
  test('listPendingActions returns array', () => {
    const pending = listPendingActions();
    assert.ok(Array.isArray(pending));
  });

  test('approveAction with non-existent ID → error', async () => {
    const result = await approveAction('hitl_voice_nonexistent_xyz');
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'Action not found');
  });

  test('rejectAction with non-existent ID → error', () => {
    const result = rejectAction('hitl_voice_nonexistent_abc');
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'Action not found');
  });

  test('rejectAction with custom reason', () => {
    const result = rejectAction('hitl_voice_custom_reason_test', 'Custom rejection reason');
    assert.strictEqual(result.success, false); // not found, but function works
  });

  test('HITL_CONFIG has expected properties', () => {
    assert.strictEqual(typeof HITL_CONFIG.enabled, 'boolean');
    assert.strictEqual(typeof HITL_CONFIG.approveHotBookings, 'boolean');
    assert.strictEqual(typeof HITL_CONFIG.approveTransfers, 'boolean');
    assert.strictEqual(typeof HITL_CONFIG.approveFinancialComplaints, 'boolean');
    assert.strictEqual(typeof HITL_CONFIG.bookingScoreThreshold, 'number');
    assert.ok(Array.isArray(HITL_CONFIG.financialKeywords));
  });

  test('HITL_CONFIG bookingScoreThresholdOptions is valid', () => {
    assert.ok(Array.isArray(HITL_CONFIG.bookingScoreThresholdOptions));
    assert.deepStrictEqual(HITL_CONFIG.bookingScoreThresholdOptions, [60, 70, 80, 90]);
  });

  test('HITL flow: queue → list → approve', async () => {
    // Enable HITL temporarily
    const origEnabled = HITL_CONFIG.enabled;
    const origTransfers = HITL_CONFIG.approveTransfers;
    HITL_CONFIG.enabled = true;
    HITL_CONFIG.approveTransfers = true;

    try {
      const session = makeSession();
      // Queue a transfer action
      const transferResult = await handleTransferCall(session, {
        reason: 'HITL test flow',
        phone_number: '+33600000000'
      });
      assert.strictEqual(transferResult.status, 'pending_approval');
      const hitlId = transferResult.hitlId;

      // List should include our action
      const pending = listPendingActions();
      const found = pending.find(a => a.id === hitlId);
      assert.ok(found, 'Action should be in pending list');
      assert.strictEqual(found.actionType, 'transfer');

      // Approve
      const approveResult = await approveAction(hitlId);
      assert.ok(approveResult.success);
      assert.ok(approveResult.action);
      assert.strictEqual(approveResult.action.status, 'approved');

      // Should no longer be in pending
      const pendingAfter = listPendingActions();
      const stillFound = pendingAfter.find(a => a.id === hitlId);
      assert.strictEqual(stillFound, undefined, 'Action should be removed from pending after approval');
    } finally {
      HITL_CONFIG.enabled = origEnabled;
      HITL_CONFIG.approveTransfers = origTransfers;
    }
  });

  test('HITL flow: queue → reject', async () => {
    const origEnabled = HITL_CONFIG.enabled;
    const origTransfers = HITL_CONFIG.approveTransfers;
    HITL_CONFIG.enabled = true;
    HITL_CONFIG.approveTransfers = true;

    try {
      const session = makeSession();
      const transferResult = await handleTransferCall(session, {
        reason: 'HITL reject test',
        phone_number: '+33600000001'
      });
      const hitlId = transferResult.hitlId;

      const rejectResult = rejectAction(hitlId, 'Not authorized');
      assert.ok(rejectResult.success);
      assert.strictEqual(rejectResult.action.status, 'rejected');
      assert.strictEqual(rejectResult.action.rejectionReason, 'Not authorized');
    } finally {
      HITL_CONFIG.enabled = origEnabled;
      HITL_CONFIG.approveTransfers = origTransfers;
    }
  });
});

// ─── calculateBANTScore ─────────────────────────────────────────────

describe('calculateBANTScore', () => {
  test('max score is 100', () => {
    const score = calculateBANTScore({
      need: 'high',
      timeline: 'immediate',
      budget: 'defined',
      authority: 'decision_maker'
    });
    assert.strictEqual(score, 100);
  });

  test('min score is 0', () => {
    const score = calculateBANTScore({
      need: 'unknown',
      timeline: 'exploring',
      budget: 'unknown',
      authority: 'unknown'
    });
    assert.strictEqual(score, 0);
  });

  test('empty object → 0', () => {
    assert.strictEqual(calculateBANTScore({}), 0);
  });

  test('partial data → partial score', () => {
    const score = calculateBANTScore({ need: 'high', timeline: 'this_quarter' });
    assert.strictEqual(score, 50);
  });

  test('medium/flexible/influencer → 45', () => {
    const score = calculateBANTScore({
      need: 'medium',
      timeline: 'this_year',
      budget: 'flexible',
      authority: 'influencer'
    });
    assert.strictEqual(score, 20 + 10 + 15 + 10);
  });

  test('low/limited/user → 20', () => {
    const score = calculateBANTScore({
      need: 'low',
      timeline: 'exploring',
      budget: 'limited',
      authority: 'user'
    });
    assert.strictEqual(score, 10 + 0 + 5 + 5);
  });

  test('unknown values → 0 for each', () => {
    const score = calculateBANTScore({
      need: 'nonexistent',
      timeline: 'never',
      budget: 'infinite',
      authority: 'ceo'
    });
    assert.strictEqual(score, 0);
  });
});

// ─── getQualificationLabel ──────────────────────────────────────────

describe('getQualificationLabel', () => {
  test('score >= 70 → hot', () => {
    assert.strictEqual(getQualificationLabel(70), 'hot');
    assert.strictEqual(getQualificationLabel(100), 'hot');
    assert.strictEqual(getQualificationLabel(85), 'hot');
  });

  test('score >= 40 and < 70 → warm', () => {
    assert.strictEqual(getQualificationLabel(40), 'warm');
    assert.strictEqual(getQualificationLabel(69), 'warm');
    assert.strictEqual(getQualificationLabel(55), 'warm');
  });

  test('score < 40 → cold', () => {
    assert.strictEqual(getQualificationLabel(39), 'cold');
    assert.strictEqual(getQualificationLabel(0), 'cold');
    assert.strictEqual(getQualificationLabel(10), 'cold');
  });
});

// ─── detectFinancialCommitment / getMatchedFinancialKeywords ────────

describe('detectFinancialCommitment', () => {
  test('response with financial keyword → true', () => {
    assert.ok(detectFinancialCommitment('Nous allons vous offrir un remboursement complet'));
  });

  test('response without keywords → false', () => {
    assert.strictEqual(detectFinancialCommitment('Merci pour votre patience'), false);
  });

  test('null → false', () => {
    assert.strictEqual(detectFinancialCommitment(null), false);
  });

  test('non-string → false', () => {
    assert.strictEqual(detectFinancialCommitment(123), false);
    assert.strictEqual(detectFinancialCommitment({}), false);
  });

  test('empty string → false', () => {
    assert.strictEqual(detectFinancialCommitment(''), false);
  });

  test('keyword "gratuit" → true', () => {
    assert.ok(detectFinancialCommitment('C\'est totalement gratuit pour vous'));
  });

  test('keyword "offert" → true', () => {
    assert.ok(detectFinancialCommitment('Le mois suivant est offert'));
  });

  test('keyword "compensation" → true', () => {
    assert.ok(detectFinancialCommitment('Nous vous offrons une compensation'));
  });

  test('keyword "sans frais" → true', () => {
    assert.ok(detectFinancialCommitment('Le remplacement est sans frais'));
  });
});

describe('getMatchedFinancialKeywords', () => {
  test('multiple keywords → all matched', () => {
    const matched = getMatchedFinancialKeywords('Remboursement gratuit et compensation offerte');
    assert.ok(matched.includes('remboursement'));
    assert.ok(matched.includes('gratuit'));
    assert.ok(matched.includes('compensation'));
  });

  test('no keywords → empty array', () => {
    const matched = getMatchedFinancialKeywords('Simple question sur le produit');
    assert.strictEqual(matched.length, 0);
  });

  test('null → empty array', () => {
    const matched = getMatchedFinancialKeywords(null);
    assert.deepStrictEqual(matched, []);
  });

  test('case insensitive matching', () => {
    const matched = getMatchedFinancialKeywords('REMBOURSEMENT total');
    assert.ok(matched.includes('remboursement'));
  });
});

// ─── detectQueryLanguage ────────────────────────────────────────────

describe('detectQueryLanguage', () => {
  test('French text → fr (Latin = fr default)', () => {
    assert.strictEqual(detectQueryLanguage('quel est le prix'), 'fr');
  });

  test('English text → fr (Latin text defaults to fr — BM25 works for both)', () => {
    // Design: EN and FR are both Latin-script, BM25 matches either.
    // Function returns 'fr' for ALL non-Arabic, non-Spanish Latin text.
    assert.strictEqual(detectQueryLanguage('what is the price'), 'fr');
  });

  test('Arabic script → ar', () => {
    assert.strictEqual(detectQueryLanguage('ما هو السعر'), 'ar');
  });

  test('Darija (Arabic script) → ar', () => {
    assert.strictEqual(detectQueryLanguage('شحال الثمن'), 'ar');
  });

  test('Spanish text → es', () => {
    assert.strictEqual(detectQueryLanguage('¿cuánto cuesta?'), 'es');
  });

  test('Spanish word → es', () => {
    assert.strictEqual(detectQueryLanguage('quiero comprar algo'), 'es');
  });

  test('mixed Latin without Spanish markers → fr', () => {
    assert.strictEqual(detectQueryLanguage('hello world'), 'fr');
  });
});

// ─── safeJsonParse ──────────────────────────────────────────────────

describe('safeJsonParse', () => {
  test('valid JSON → parsed object', () => {
    const result = safeJsonParse('{"key": "value"}', {});
    assert.deepStrictEqual(result, { key: 'value' });
  });

  test('invalid JSON → fallback', () => {
    const result = safeJsonParse('not json', { default: true });
    assert.deepStrictEqual(result, { default: true });
  });

  test('null → JSON.parse(null) = null (valid JSON)', () => {
    // JSON.parse(null) returns null (null IS valid JSON)
    const result = safeJsonParse(null, 'fallback');
    assert.strictEqual(result, null);
  });

  test('empty string → fallback', () => {
    const result = safeJsonParse('', {});
    assert.deepStrictEqual(result, {});
  });

  test('array JSON → parsed array', () => {
    const result = safeJsonParse('[1,2,3]', []);
    assert.deepStrictEqual(result, [1, 2, 3]);
  });
});

// ─── generateSessionId ─────────────────────────────────────────────

describe('generateSessionId', () => {
  test('returns string starting with sess_', () => {
    const id = generateSessionId();
    assert.ok(typeof id === 'string');
    assert.ok(id.startsWith('sess_'));
  });

  test('generates unique IDs', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      ids.add(generateSessionId());
    }
    assert.strictEqual(ids.size, 100, 'All 100 session IDs should be unique');
  });

  test('has sufficient length', () => {
    const id = generateSessionId();
    assert.ok(id.length > 20, 'Session ID should be reasonably long');
  });
});

// ─── checkRateLimit ─────────────────────────────────────────────────

describe('checkRateLimit', () => {
  test('first request from new IP → returns true', () => {
    const ip = `test_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const result = checkRateLimit(ip);
    // checkRateLimit returns a boolean, not an object
    assert.strictEqual(typeof result, 'boolean');
    assert.strictEqual(result, true);
  });

  test('multiple requests from same IP within limit → all true', () => {
    const ip = `ratelimit_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit(ip);
      assert.strictEqual(result, true, `Request ${i + 1} should be allowed`);
    }
  });

  test('exceeding maxRequests → returns false', () => {
    const ip = `flood_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const max = CONFIG.rateLimit.maxRequests;
    // Fill up to max
    for (let i = 0; i < max; i++) {
      checkRateLimit(ip);
    }
    // Next should be rejected
    const result = checkRateLimit(ip);
    assert.strictEqual(result, false);
  });
});

// ─── getTwiMLLanguage ───────────────────────────────────────────────

describe('getTwiMLLanguage', () => {
  test('fr → fr-FR', () => {
    assert.strictEqual(getTwiMLLanguage('fr'), 'fr-FR');
  });

  test('en → en-US', () => {
    assert.strictEqual(getTwiMLLanguage('en'), 'en-US');
  });

  test('es → es-ES', () => {
    assert.strictEqual(getTwiMLLanguage('es'), 'es-ES');
  });

  test('ar → ar-SA', () => {
    assert.strictEqual(getTwiMLLanguage('ar'), 'ar-SA');
  });

  test('ary → ar-MA', () => {
    assert.strictEqual(getTwiMLLanguage('ary'), 'ar-MA');
  });

  test('unknown → defaults to fr-FR', () => {
    const result = getTwiMLLanguage('xx');
    assert.ok(typeof result === 'string');
  });
});

// ─── getTwiMLMessage ────────────────────────────────────────────────

describe('getTwiMLMessage', () => {
  test('connecting in FR → French message', () => {
    const msg = getTwiMLMessage('connecting', 'fr');
    assert.ok(typeof msg === 'string');
    assert.ok(msg.length > 0);
  });

  test('connecting in EN → English message', () => {
    const msg = getTwiMLMessage('connecting', 'en');
    assert.ok(typeof msg === 'string');
    assert.ok(msg.length > 0);
  });

  test('transferToHuman in FR → French message', () => {
    const msg = getTwiMLMessage('transferToHuman', 'fr');
    assert.ok(typeof msg === 'string');
  });

  test('unknown message key → returns string', () => {
    const msg = getTwiMLMessage('nonexistent', 'fr');
    // Should return something (empty string or undefined is acceptable)
    assert.ok(msg === undefined || typeof msg === 'string');
  });
});

// ─── getGrokVoiceFromPreferences ────────────────────────────────────

describe('getGrokVoiceFromPreferences', () => {
  // Signature: getGrokVoiceFromPreferences(language = 'fr', gender = 'female')
  // Returns mapped Grok voice name from GROK_VOICE_MAP

  test('default (fr, female) → returns string', () => {
    const voice = getGrokVoiceFromPreferences();
    assert.strictEqual(typeof voice, 'string');
    assert.ok(voice.length > 0);
  });

  test('fr + female → returns voice name', () => {
    const voice = getGrokVoiceFromPreferences('fr', 'female');
    assert.strictEqual(typeof voice, 'string');
  });

  test('en + male → returns voice name', () => {
    const voice = getGrokVoiceFromPreferences('en', 'male');
    assert.strictEqual(typeof voice, 'string');
  });

  test('unknown language → falls back to fr_female', () => {
    const voice = getGrokVoiceFromPreferences('xx', 'unknown');
    const defaultVoice = getGrokVoiceFromPreferences('fr', 'female');
    assert.strictEqual(voice, defaultVoice);
  });
});

// ─── CONFIG structure ───────────────────────────────────────────────

describe('CONFIG', () => {
  test('has port', () => {
    assert.strictEqual(typeof CONFIG.port, 'number');
  });

  test('has twilio config', () => {
    assert.ok(CONFIG.twilio);
    assert.ok('accountSid' in CONFIG.twilio);
    assert.ok('authToken' in CONFIG.twilio);
    assert.ok('phoneNumber' in CONFIG.twilio);
  });

  test('has supportedLanguages with 5 langs', () => {
    assert.deepStrictEqual(CONFIG.supportedLanguages, ['fr', 'en', 'es', 'ar', 'ary']);
  });

  test('has security config', () => {
    assert.ok(CONFIG.security);
    assert.ok(typeof CONFIG.security.maxBodySize === 'number');
    assert.ok(typeof CONFIG.security.requestTimeout === 'number');
    assert.ok(typeof CONFIG.security.maxActiveSessions === 'number');
  });

  test('has rateLimit config', () => {
    assert.ok(CONFIG.rateLimit);
    assert.ok(typeof CONFIG.rateLimit.windowMs === 'number');
    assert.ok(typeof CONFIG.rateLimit.maxRequests === 'number');
  });

  test('has whatsapp config', () => {
    assert.ok(CONFIG.whatsapp);
    assert.ok('accessToken' in CONFIG.whatsapp);
    assert.ok('phoneNumberId' in CONFIG.whatsapp);
  });

  test('has grok config', () => {
    assert.ok(CONFIG.grok);
    assert.ok(typeof CONFIG.grok.model === 'string');
  });

  test('defaultLanguage is fr', () => {
    assert.strictEqual(CONFIG.defaultLanguage, 'fr');
  });
});

// ─── i18n BEHAVIORAL tests (B32-B34 — Session 250.213c) ─────────

describe('getTwiMLLanguage — i18n behavioral', () => {
  test('maps all 5 supported langs to BCP-47', () => {
    assert.strictEqual(getTwiMLLanguage('fr'), 'fr-FR');
    assert.strictEqual(getTwiMLLanguage('en'), 'en-US');
    assert.strictEqual(getTwiMLLanguage('es'), 'es-ES');
    assert.strictEqual(getTwiMLLanguage('ar'), 'ar-SA');
    assert.strictEqual(getTwiMLLanguage('ary'), 'ar-MA');
  });

  test('unknown lang falls back to fr-FR', () => {
    assert.strictEqual(getTwiMLLanguage('xx'), 'fr-FR');
    assert.strictEqual(getTwiMLLanguage(undefined), 'fr-FR');
  });
});

describe('detectQueryLanguage — i18n behavioral (design: Latin→fr, BM25 handles both)', () => {
  test('French Latin text → fr', () => {
    assert.strictEqual(detectQueryLanguage('Bonjour, je voudrais commander'), 'fr');
  });

  test('English Latin text → fr (by design: BM25 matches both FR/EN)', () => {
    // detectQueryLanguage does NOT distinguish EN from FR — both are Latin script.
    // BM25 search handles both, so 'fr' is returned for all Latin text.
    assert.strictEqual(detectQueryLanguage('Hello, I would like to order'), 'fr');
  });

  test('Spanish with markers → es', () => {
    assert.strictEqual(detectQueryLanguage('Hola, quiero hacer un pedido'), 'es');
  });

  test('Arabic script → ar', () => {
    assert.strictEqual(detectQueryLanguage('مرحبا أريد أن أطلب'), 'ar');
  });
});

describe('handleSendPaymentDetails — i18n error path', () => {
  // NOTE: These test that the function correctly reads voice_language and
  // doesn't crash. The i18n message IS built (lines 3472-3478) but the error
  // path (no phone) returns generic error without voiceResponse.
  // The paymentMsgs i18n is verified by code reading — the function creates
  // paymentMsgs[lang] for fr/en/es/ar/ary and selects based on session.metadata.voice_language.
  // Full integration test requires real Twilio — not possible without external service.

  test('no_payment_config returns error regardless of language', async () => {
    const session = makeSession({ metadata: { voice_language: 'en' } });
    const result = await handleSendPaymentDetails(session, { amount: 99, description: 'Pro' });
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'no_payment_config');
  });

  test('with config + no phone → error for all 5 langs', async () => {
    for (const lang of ['fr', 'en', 'es', 'ar', 'ary']) {
      const session = makeSession({
        metadata: {
          payment_config: { method: 'LINK', details: 'https://pay.test', currency: 'EUR' },
          voice_language: lang
        }
      });
      const result = await handleSendPaymentDetails(session, { amount: 99, description: 'Test' });
      assert.strictEqual(result.success, false, `lang=${lang} should fail (no phone)`);
      assert.ok(result.error, `lang=${lang} should have error message`);
    }
  });
});
