/**
 * VocalIA Module Load Tests
 *
 * Verifies all modules can be loaded without errors.
 * Run: node --test test/
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');

describe('Core Modules', () => {
  test('AgencyEventBus loads', () => {
    const mod = require('../core/AgencyEventBus.cjs');
    assert.ok(mod, 'Module should export something');
  });

  test('ContextBox loads', () => {
    const mod = require('../core/ContextBox.cjs');
    assert.ok(mod, 'Module should export something');
  });

  test('BillingAgent loads', () => {
    const mod = require('../core/BillingAgent.cjs');
    assert.ok(mod, 'Module should export something');
  });

  test('ErrorScience loads', () => {
    const mod = require('../core/ErrorScience.cjs');
    assert.ok(mod, 'Module should export something');
  });

  test('RevenueScience loads', () => {
    const mod = require('../core/RevenueScience.cjs');
    assert.ok(mod, 'Module should export something');
  });

  test('marketing-science-core loads', () => {
    const mod = require('../core/marketing-science-core.cjs');
    assert.ok(mod, 'Module should export something');
  });

  test('knowledge-base-services loads', () => {
    const mod = require('../core/knowledge-base-services.cjs');
    assert.ok(mod, 'Module should export something');
  });
});

describe('Integration Modules', () => {
  test('hubspot-b2b-crm loads', () => {
    const mod = require('../integrations/hubspot-b2b-crm.cjs');
    assert.ok(mod, 'Module should export something');
  });

  test('voice-ecommerce-tools loads', () => {
    const mod = require('../integrations/voice-ecommerce-tools.cjs');
    assert.ok(mod, 'Module should export something');
  });

  test('voice-crm-tools loads', () => {
    const mod = require('../integrations/voice-crm-tools.cjs');
    assert.ok(mod, 'Module should export something');
  });
});

describe('Persona Modules', () => {
  test('voice-persona-injector loads', () => {
    const mod = require('../personas/voice-persona-injector.cjs');
    assert.ok(mod, 'Module should export something');
  });

  test('agency-financial-config loads', () => {
    const mod = require('../personas/agency-financial-config.cjs');
    assert.ok(mod, 'Module should export something');
  });
});

describe('Sensor Modules', () => {
  test('voice-quality-sensor loads', () => {
    const mod = require('../sensors/voice-quality-sensor.cjs');
    assert.ok(mod, 'Module should export something');
  });

  test('cost-tracking-sensor loads', () => {
    const mod = require('../sensors/cost-tracking-sensor.cjs');
    assert.ok(mod, 'Module should export something');
  });

  test('lead-velocity-sensor loads', () => {
    const mod = require('../sensors/lead-velocity-sensor.cjs');
    assert.ok(mod, 'Module should export something');
  });

  test('retention-sensor loads', () => {
    const mod = require('../sensors/retention-sensor.cjs');
    assert.ok(mod, 'Module should export something');
  });
});

describe('Widget Modules', () => {
  test('voice-widget-templates loads', () => {
    // Session 250.87: Template file is in scripts/, not widget/
    const mod = require('../scripts/voice-widget-templates.cjs');
    assert.ok(mod, 'Module should export something');
  });
});

describe('Knowledge Base Modules', () => {
  test('knowledge-base-services loads', () => {
    const mod = require('../core/knowledge-base-services.cjs');
    assert.ok(mod, 'Module should export something');
  });

  test('knowledge-embedding-service loads', () => {
    const mod = require('../core/knowledge-embedding-service.cjs');
    assert.ok(mod, 'Module should export something');
  });
});

describe('Telephony Modules', () => {
  test('voice-telephony-bridge loads', () => {
    const mod = require('../telephony/voice-telephony-bridge.cjs');
    assert.ok(mod, 'Module should export something');
  });
});
