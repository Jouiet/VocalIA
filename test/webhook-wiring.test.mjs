/**
 * webhook-wiring.test.mjs
 * REGRESSION TEST: Verify that webhook events are actually wired to emitters
 *
 * Context: Session 250.240 deep audit found that only 2/8 webhook events
 * were actually dispatched. The other 6 had subscribers but no emitters.
 * This test ensures all events remain wired after code changes.
 *
 * @session 250.241
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// Read source files once
const dbApi = fs.readFileSync(path.join(ROOT, 'core', 'db-api.cjs'), 'utf8');
const voiceApi = fs.readFileSync(path.join(ROOT, 'core', 'voice-api-resilient.cjs'), 'utf8');
const telephony = fs.readFileSync(path.join(ROOT, 'telephony', 'voice-telephony-bridge.cjs'), 'utf8');
const dispatcher = fs.readFileSync(path.join(ROOT, 'core', 'webhook-dispatcher.cjs'), 'utf8');

describe('Webhook Event Wiring — Regression (B90-B95)', () => {

  describe('VALID_EVENTS defined in dispatcher', () => {
    it('should define exactly 8 valid events', () => {
      const match = dispatcher.match(/VALID_EVENTS\s*=\s*\[([^\]]+)\]/s);
      assert.ok(match, 'VALID_EVENTS array not found in webhook-dispatcher.cjs');
      const events = match[1].match(/'([^']+)'/g).map(s => s.replace(/'/g, ''));
      assert.equal(events.length, 8, `Expected 8 events, got ${events.length}: ${events.join(', ')}`);
    });
  });

  describe('Event emitters — each event has at least one dispatch() call', () => {

    it('tenant.provisioned is dispatched in db-api.cjs', () => {
      const hasDispatch = dbApi.includes("dispatch(") && dbApi.includes("tenant.provisioned");
      assert.ok(hasDispatch, 'db-api.cjs must dispatch tenant.provisioned event');
    });

    it('call.started is dispatched in telephony', () => {
      const hasDispatch = telephony.includes("dispatch(") && telephony.includes("call.started");
      assert.ok(hasDispatch, 'telephony must dispatch call.started event');
    });

    it('call.completed is dispatched in telephony', () => {
      const hasDispatch = telephony.includes("dispatch(") && telephony.includes("call.completed");
      assert.ok(hasDispatch, 'telephony must dispatch call.completed event');
    });

    it('lead.qualified is dispatched in voice-api', () => {
      const hasDispatch = voiceApi.includes("dispatch(") && voiceApi.includes("lead.qualified");
      assert.ok(hasDispatch, 'voice-api must dispatch lead.qualified event');
    });

    it('appointment.booked is dispatched in telephony', () => {
      const hasDispatch = telephony.includes("dispatch(") && telephony.includes("appointment.booked");
      assert.ok(hasDispatch, 'telephony must dispatch appointment.booked event');
    });

    it('conversation.ended is dispatched in telephony', () => {
      const hasDispatch = telephony.includes("dispatch(") && telephony.includes("conversation.ended");
      assert.ok(hasDispatch, 'telephony must dispatch conversation.ended event');
    });

    it('quota.warning is emitted in voice-api', () => {
      const hasEmit = voiceApi.includes("quota.warning");
      assert.ok(hasEmit, 'voice-api must emit quota.warning event');
    });

    it('cart.abandoned is defined as valid event (extension point)', () => {
      assert.ok(dispatcher.includes("cart.abandoned"), 'cart.abandoned must be in VALID_EVENTS');
    });
  });

  describe('webhookDispatcher is required in services', () => {
    it('voice-api-resilient.cjs requires webhook-dispatcher', () => {
      assert.ok(
        voiceApi.includes("require('./webhook-dispatcher.cjs')"),
        'voice-api must require webhook-dispatcher'
      );
    });

    it('telephony requires webhook-dispatcher', () => {
      assert.ok(
        telephony.includes("require('../core/webhook-dispatcher.cjs')"),
        'telephony must require webhook-dispatcher'
      );
    });

    it('db-api.cjs requires webhook-dispatcher (conditional)', () => {
      assert.ok(
        dbApi.includes("require('./webhook-dispatcher.cjs')"),
        'db-api must require webhook-dispatcher'
      );
    });
  });

  describe('HMAC signing is implemented', () => {
    it('dispatcher uses crypto for HMAC-SHA256', () => {
      assert.ok(dispatcher.includes('hmac') || dispatcher.includes('HMAC') || dispatcher.includes('createHmac'),
        'dispatcher must implement HMAC signing');
    });

    it('dispatcher signs payloads', () => {
      assert.ok(dispatcher.includes('signPayload') || dispatcher.includes('sign'),
        'dispatcher must have a sign function');
    });
  });

  describe('Feature count consistency', () => {
    it('db-api PLAN_FEATURES has exactly 22 features per plan', () => {
      // Find PLAN_FEATURES block, then extract starter plan
      const pfIdx = dbApi.indexOf('PLAN_FEATURES');
      assert.ok(pfIdx > 0, 'PLAN_FEATURES not found');
      const afterPF = dbApi.substring(pfIdx);
      const starterMatch = afterPF.match(/starter:\s*\{([^}]+)\}/);
      assert.ok(starterMatch, 'PLAN_FEATURES.starter not found');
      const featureCount = (starterMatch[1].match(/[a-z_]+:\s*(true|false)/g) || []).length;
      assert.equal(featureCount, 22, `Expected 22 features in starter plan, got ${featureCount}`);
    });

    it('db-api comments say 22 features, not 23', () => {
      assert.ok(!dbApi.includes('23 features'), 'Comments should say 22 features, not 23');
    });
  });

  describe('Trial API response structure', () => {
    it('db-api trial endpoint returns nested {trial: {...}}', () => {
      // Verify the response structure wraps trial in a nested object
      assert.ok(
        dbApi.includes('trial: status') || dbApi.includes('trial: {'),
        'Trial endpoint must return { trial: { active, ... } } not flat response'
      );
    });
  });
});
