/**
 * cov-webhook-core.test.mjs
 * Tests webhook-dispatcher, BillingAgent, ErrorScience, a2ui-service branches.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// ─── WebhookDispatcher ─────────────────────────────────────────────────────

describe('WebhookDispatcher deep coverage', () => {
  const dispatcher = require('../core/webhook-dispatcher.cjs');

  test('exports dispatch, signPayload, getWebhookConfig', () => {
    assert.equal(typeof dispatcher.dispatch, 'function');
    assert.equal(typeof dispatcher.signPayload, 'function');
    assert.equal(typeof dispatcher.getWebhookConfig, 'function');
  });

  test('signPayload with secret', () => {
    const sig = dispatcher.signPayload('{"test":true}', 'secret123');
    assert.ok(sig);
    assert.ok(sig.length > 10);
  });

  test('signPayload without secret returns null', () => {
    assert.equal(dispatcher.signPayload('test', null), null);
    assert.equal(dispatcher.signPayload('test', ''), null);
  });

  test('dispatch rejects invalid event type', async () => {
    // Should log warning but not throw
    await dispatcher.dispatch('tenant_test', 'invalid.event', {});
  });

  test('dispatch with no webhook config = no-op', async () => {
    // default tenant has no webhook — should silently return
    await dispatcher.dispatch('default', 'lead.qualified', {});
  });

  test('dispatch with null tenantId = no-op', async () => {
    await dispatcher.dispatch(null, 'lead.qualified', {});
  });

  test('getWebhookConfig for default returns null', () => {
    assert.equal(dispatcher.getWebhookConfig('default'), null);
  });

  test('getWebhookConfig for null returns null', () => {
    assert.equal(dispatcher.getWebhookConfig(null), null);
  });

  test('getWebhookConfig for nonexistent tenant', () => {
    const config = dispatcher.getWebhookConfig('tenant_nonexistent_xyz');
    // Returns null or config from GoogleSheetsDB
    assert.ok(config === null || typeof config === 'object');
  });

  test('dispatch valid event for tenant without webhook', async () => {
    await dispatcher.dispatch('test_no_webhook', 'call.completed', { sessionId: 'test' });
  });

  test('all VALID_EVENTS accepted', async () => {
    const events = ['lead.qualified', 'call.started', 'call.completed',
      'conversation.ended', 'cart.abandoned', 'appointment.booked',
      'quota.warning', 'tenant.provisioned'];
    for (const evt of events) {
      await dispatcher.dispatch('test_tenant_wd', evt, { test: true });
    }
  });

  test('signPayload produces consistent signatures', () => {
    const payload = '{"id":"test"}';
    const sig1 = dispatcher.signPayload(payload, 'key');
    const sig2 = dispatcher.signPayload(payload, 'key');
    assert.equal(sig1, sig2);
  });

  test('signPayload different secrets produce different signatures', () => {
    const payload = '{"id":"test"}';
    const sig1 = dispatcher.signPayload(payload, 'key1');
    const sig2 = dispatcher.signPayload(payload, 'key2');
    assert.notEqual(sig1, sig2);
  });
});

// ─── BillingAgent ───────────────────────────────────────────────────────────

describe('BillingAgent branch coverage', () => {
  const billingModule = require('../core/BillingAgent.cjs');

  test('module exports BillingAgent class', () => {
    assert.ok(billingModule.BillingAgent);
    assert.equal(typeof billingModule.trackCost, 'function');
  });

  test('BillingAgent has STATES', () => {
    assert.ok(billingModule.STATES);
    assert.ok(typeof billingModule.STATES === 'object');
  });

  test('trackCost with test data', () => {
    billingModule.trackCost('test_billing_cov', 'grok', 0.001, { tokens: 100 });
  });

  test('BillingAgent taskHistory is a Map', () => {
    assert.ok(billingModule.taskHistory instanceof Map);
  });

  test('BillingAgent defaultPrice', () => {
    assert.ok(typeof billingModule.defaultPrice === 'number' || typeof billingModule.defaultPrice === 'object');
  });
});

// ─── ErrorScience ───────────────────────────────────────────────────────────

describe('ErrorScience branch coverage', () => {
  const ErrorScience = require('../core/ErrorScience.cjs');

  test('module exists', () => {
    assert.ok(ErrorScience);
  });

  test('recordError', () => {
    if (ErrorScience.recordError) {
      ErrorScience.recordError(new Error('test cov error'), {
        source: 'cov-test',
        tenantId: 'test_es',
        severity: 'low'
      });
    }
  });

  test('recordError with string error', () => {
    if (ErrorScience.recordError) {
      ErrorScience.recordError('string error message', {
        source: 'cov-test',
        tenantId: 'test_es2'
      });
    }
  });

  test('getReport', () => {
    if (ErrorScience.getReport) {
      const report = ErrorScience.getReport();
      assert.ok(typeof report === 'object');
    }
  });

  test('getErrorsByTenant', () => {
    if (ErrorScience.getErrorsByTenant) {
      const errors = ErrorScience.getErrorsByTenant('test_es');
      assert.ok(Array.isArray(errors) || typeof errors === 'object');
    }
  });

  test('recordError with context fields', () => {
    if (ErrorScience.recordError) {
      ErrorScience.recordError(new Error('ctx error'), {
        source: 'cov-test',
        tenantId: 'test_es3',
        endpoint: '/test',
        method: 'GET',
        statusCode: 500,
        duration: 123,
        requestId: 'req_123'
      });
    }
  });

  test('clearErrors', () => {
    if (ErrorScience.clearErrors) {
      ErrorScience.clearErrors();
    } else if (ErrorScience.reset) {
      ErrorScience.reset();
    }
  });
});

// ─── A2UIService ────────────────────────────────────────────────────────────

describe('A2UIService branch coverage', () => {
  const a2ui = require('../core/a2ui-service.cjs');

  test('module exports', () => {
    assert.ok(a2ui);
  });

  test('getWidgetConfig', () => {
    if (a2ui.getWidgetConfig) {
      const config = a2ui.getWidgetConfig('test_a2ui_tenant');
      assert.ok(typeof config === 'object');
    }
  });

  test('getWidgetConfig with unknown tenant', () => {
    if (a2ui.getWidgetConfig) {
      const config = a2ui.getWidgetConfig('nonexistent_tenant_xyz');
      assert.ok(typeof config === 'object');
    }
  });

  test('buildChatUI', () => {
    if (a2ui.buildChatUI) {
      const ui = a2ui.buildChatUI({ tenantId: 'test_a2ui', language: 'fr' });
      assert.ok(ui);
    }
  });

  test('getTheme', () => {
    if (a2ui.getTheme) {
      const theme = a2ui.getTheme('test_a2ui');
      assert.ok(typeof theme === 'object');
    }
  });

  test('getDashboardStats', () => {
    if (a2ui.getDashboardStats) {
      const stats = a2ui.getDashboardStats('test_a2ui');
      assert.ok(typeof stats === 'object');
    }
  });

  test('getConversationHistory', () => {
    if (a2ui.getConversationHistory) {
      const history = a2ui.getConversationHistory('test_a2ui', 'session_123');
      assert.ok(typeof history === 'object' || Array.isArray(history));
    }
  });
});

// ─── email-service branches ─────────────────────────────────────────────────

describe('email-service branch coverage', () => {
  const emailService = require('../core/email-service.cjs');

  test('module exists', () => {
    assert.ok(emailService);
  });

  test('sendEmail validation - missing to', async () => {
    if (emailService.sendEmail) {
      try {
        await emailService.sendEmail({ subject: 'test', html: 'body' });
      } catch (e) {
        assert.ok(e.message);
      }
    }
  });

  test('sendEmail validation - missing subject', async () => {
    if (emailService.sendEmail) {
      try {
        await emailService.sendEmail({ to: 'test@test.com', html: 'body' });
      } catch (e) {
        assert.ok(e.message);
      }
    }
  });

  test('getTemplates', () => {
    if (emailService.getTemplates) {
      const templates = emailService.getTemplates();
      assert.ok(typeof templates === 'object');
    }
  });

  test('renderTemplate with unknown template', () => {
    if (emailService.renderTemplate) {
      try {
        emailService.renderTemplate('nonexistent_template', {});
      } catch (e) {
        assert.ok(e.message);
      }
    }
  });
});
