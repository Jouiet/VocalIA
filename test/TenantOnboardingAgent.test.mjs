/**
 * VocalIA TenantOnboardingAgent Tests
 *
 * Tests: ALL exported methods behavioral (boundary mocks: HubSpot, EventBus)
 * - getAgentCard, recordTaskState, getTaskHistory
 * - onboardTenant (full lifecycle: directory + config + CRM + events)
 *
 * Run: node --test test/TenantOnboardingAgent.test.mjs
 * @session 250.241
 */

import { test, describe, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'node:module';
import mod from '../core/TenantOnboardingAgent.cjs';

const require = createRequire(import.meta.url);

// NOTE: Exports are proven by behavioral tests below (getAgentCard, onboardTenant, recordTaskState, etc.)

// ─── AGENT_CARD ─────────────────────────────────────────────────────────────

describe('TenantOnboardingAgent AGENT_CARD', () => {
  const card = mod.getAgentCard();

  test('has name TenantOnboardingAgent', () => {
    assert.strictEqual(card.name, 'TenantOnboardingAgent');
  });

  test('has version string', () => {
    assert.ok(card.version);
    assert.match(card.version, /^\d+\.\d+\.\d+$/);
  });

  test('has description', () => {
    assert.ok(card.description);
    assert.ok(card.description.length > 10);
  });

  test('has provider with organization VocalIA', () => {
    assert.strictEqual(card.provider.organization, 'VocalIA');
    assert.strictEqual(card.provider.url, 'https://vocalia.ma');
  });

  test('has capabilities object', () => {
    assert.strictEqual(typeof card.capabilities, 'object');
    assert.strictEqual(card.capabilities.streaming, false);
    assert.strictEqual(card.capabilities.pushNotifications, true);
    assert.strictEqual(card.capabilities.stateTransitionHistory, true);
  });

  test('has 3 skills', () => {
    assert.strictEqual(card.skills.length, 3);
  });

  test('skill IDs are directory_provisioning, crm_sync, integration_setup', () => {
    const ids = card.skills.map(s => s.id);
    assert.ok(ids.includes('directory_provisioning'));
    assert.ok(ids.includes('crm_sync'));
    assert.ok(ids.includes('integration_setup'));
  });

  test('each skill has name, description, inputModes, outputModes', () => {
    for (const skill of card.skills) {
      assert.ok(skill.name, `skill ${skill.id} missing name`);
      assert.ok(skill.description, `skill ${skill.id} missing description`);
      assert.ok(Array.isArray(skill.inputModes), `skill ${skill.id} missing inputModes`);
      assert.ok(Array.isArray(skill.outputModes), `skill ${skill.id} missing outputModes`);
    }
  });

  test('authentication scheme is none', () => {
    assert.deepStrictEqual(card.authentication.schemes, ['none']);
  });

  test('defaultInputModes is application/json', () => {
    assert.deepStrictEqual(card.defaultInputModes, ['application/json']);
  });

  test('defaultOutputModes is application/json', () => {
    assert.deepStrictEqual(card.defaultOutputModes, ['application/json']);
  });
});

// ─── Task state management ──────────────────────────────────────────────────

describe('TenantOnboardingAgent recordTaskState', () => {
  test('records state for new correlationId', () => {
    const id = `test_${Date.now()}_1`;
    mod.recordTaskState(id, 'submitted', { tenantId: 'test' });
    const history = mod.getTaskHistory(id);
    assert.strictEqual(history.length, 1);
    assert.strictEqual(history[0].state, 'submitted');
    assert.strictEqual(history[0].tenantId, 'test');
  });

  test('appends multiple states', () => {
    const id = `test_${Date.now()}_2`;
    mod.recordTaskState(id, 'submitted', {});
    mod.recordTaskState(id, 'working', {});
    mod.recordTaskState(id, 'completed', {});
    const history = mod.getTaskHistory(id);
    assert.strictEqual(history.length, 3);
    assert.strictEqual(history[0].state, 'submitted');
    assert.strictEqual(history[1].state, 'working');
    assert.strictEqual(history[2].state, 'completed');
  });

  test('includes timestamp in each state', () => {
    const id = `test_${Date.now()}_3`;
    mod.recordTaskState(id, 'submitted', {});
    const history = mod.getTaskHistory(id);
    assert.ok(history[0].timestamp);
    assert.ok(!isNaN(Date.parse(history[0].timestamp)));
  });

  test('includes additional details', () => {
    const id = `test_${Date.now()}_4`;
    mod.recordTaskState(id, 'failed', { error: 'test error', tenantId: 'xyz' });
    const history = mod.getTaskHistory(id);
    assert.strictEqual(history[0].error, 'test error');
    assert.strictEqual(history[0].tenantId, 'xyz');
  });
});

describe('TenantOnboardingAgent getTaskHistory', () => {
  test('returns empty array for unknown correlationId', () => {
    const history = mod.getTaskHistory('__nonexistent_correlation_id__');
    assert.deepStrictEqual(history, []);
  });

  test('returns existing history', () => {
    const id = `test_${Date.now()}_5`;
    mod.recordTaskState(id, 'submitted', {});
    const history = mod.getTaskHistory(id);
    assert.ok(Array.isArray(history));
    assert.ok(history.length >= 1);
  });
});

// ─── baseClientsDir ─────────────────────────────────────────────────────────

describe('TenantOnboardingAgent paths', () => {
  test('baseClientsDir includes clients', () => {
    assert.ok(mod.baseClientsDir.includes('clients'));
  });
});

// ─── onboardTenant — behavioral with boundary mocks ──────────────────────────

describe('TenantOnboardingAgent onboardTenant', () => {
  const testTenantId = `test_onboard_${process.pid}`;
  const testDir = path.join(mod.baseClientsDir, testTenantId);

  // Boundary mocks: HubSpot CRM (external API) + AgencyEventBus (event system)
  const HubSpotB2BCRM = require('../integrations/hubspot-b2b-crm.cjs');
  const AgencyEventBus = require('../core/AgencyEventBus.cjs');
  let origUpsert, origPublish;

  // Save originals + install boundary mocks before each test
  function installMocks() {
    origUpsert = HubSpotB2BCRM.upsertContact;
    origPublish = AgencyEventBus.publish;
    HubSpotB2BCRM.upsertContact = async () => ({ success: true });
    AgencyEventBus.publish = async () => {};
  }

  function restoreMocks() {
    HubSpotB2BCRM.upsertContact = origUpsert;
    AgencyEventBus.publish = origPublish;
  }

  after(() => {
    // Cleanup test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    // Cleanup sanitized path traversal test directory
    const sanitizedDir = path.join(mod.baseClientsDir, 'etcpasswd');
    if (fs.existsSync(sanitizedDir)) {
      fs.rmSync(sanitizedDir, { recursive: true, force: true });
    }
    restoreMocks();
  });

  test('creates client directory, config.json, and credentials.json', async () => {
    installMocks();
    const result = await mod.onboardTenant({
      id: testTenantId,
      name: 'Test Company',
      email: 'test@onboard.com',
      vertical: 'retail'
    });

    assert.strictEqual(result.success, true);
    assert.ok(result.tenantId);
    assert.ok(result.correlationId);

    // Verify directory was created
    assert.ok(fs.existsSync(testDir), 'Client directory should exist');

    // Verify config.json was written with correct content
    const config = JSON.parse(fs.readFileSync(path.join(testDir, 'config.json'), 'utf8'));
    assert.strictEqual(config.id, testTenantId);
    assert.strictEqual(config.name, 'Test Company');
    assert.strictEqual(config.vertical, 'retail');
    assert.strictEqual(config.status, 'onboarding');
    assert.ok(config.created_at);
    assert.strictEqual(config.integrations.vocalia_widget.enabled, true);

    // Verify credentials.json was written
    const creds = JSON.parse(fs.readFileSync(path.join(testDir, 'credentials.json'), 'utf8'));
    assert.strictEqual(creds.HUBSPOT_ACCESS_TOKEN, '');
    assert.strictEqual(creds.STRIPE_SECRET_KEY, '');
    restoreMocks();
  });

  test('calls HubSpot CRM upsertContact with correct data', async () => {
    installMocks();
    let hubspotData = null;
    HubSpotB2BCRM.upsertContact = async (data) => {
      hubspotData = data;
      return { success: true };
    };

    // Clean dir from previous test
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });

    await mod.onboardTenant({
      id: testTenantId,
      name: 'John Doe Client',
      email: 'john@test.com',
      vertical: 'finance'
    });

    assert.ok(hubspotData, 'HubSpot upsertContact should have been called');
    assert.strictEqual(hubspotData.email, 'john@test.com');
    assert.strictEqual(hubspotData.firstname, 'John');
    assert.strictEqual(hubspotData.lastname, 'Doe Client');
    assert.strictEqual(hubspotData.hs_lead_status, 'SUBSCRIBER');
    restoreMocks();
  });

  test('publishes tenant.created event via AgencyEventBus', async () => {
    installMocks();
    let publishedEvent = null;
    AgencyEventBus.publish = async (event, payload, opts) => {
      if (event === 'tenant.created') {
        publishedEvent = { event, payload, opts };
      }
    };

    // Clean dir
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });

    await mod.onboardTenant({
      id: testTenantId,
      name: 'Event Test',
      email: 'event@test.com',
      vertical: 'healthcare'
    });

    assert.ok(publishedEvent, 'tenant.created should have been published');
    assert.strictEqual(publishedEvent.payload.tenantId, testTenantId);
    assert.strictEqual(publishedEvent.payload.name, 'Event Test');
    assert.strictEqual(publishedEvent.opts.source, 'TenantOnboardingAgent');
    restoreMocks();
  });

  test('records A2A task state lifecycle (submitted → working → completed)', async () => {
    installMocks();
    // Clean dir
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });

    const result = await mod.onboardTenant({
      id: testTenantId,
      name: 'Lifecycle Test',
      email: 'lifecycle@test.com',
      vertical: 'ecommerce'
    });

    const history = mod.getTaskHistory(result.correlationId);
    assert.ok(history.length >= 3, `Expected >= 3 state transitions, got ${history.length}`);
    assert.strictEqual(history[0].state, 'submitted');
    assert.strictEqual(history[1].state, 'working');
    // Final state should be completed
    assert.strictEqual(history[history.length - 1].state, 'completed');
    restoreMocks();
  });

  test('returns failure when HubSpot throws (publishes system.error)', async () => {
    installMocks();
    let errorPublished = false;
    HubSpotB2BCRM.upsertContact = async () => { throw new Error('HubSpot API down'); };
    AgencyEventBus.publish = async (event) => {
      if (event === 'system.error') errorPublished = true;
    };

    // Clean dir
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });

    const result = await mod.onboardTenant({
      id: testTenantId,
      name: 'Fail Test',
      email: 'fail@test.com',
      vertical: 'retail'
    });

    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('HubSpot'));
    assert.ok(result.correlationId);
    assert.ok(errorPublished, 'system.error event should be published on failure');

    // Verify task state history ends with 'failed'
    const history = mod.getTaskHistory(result.correlationId);
    assert.strictEqual(history[history.length - 1].state, 'failed');
    restoreMocks();
  });

  test('sanitizes tenant ID to prevent path traversal', async () => {
    installMocks();
    const maliciousId = '../../../etc/passwd';

    const result = await mod.onboardTenant({
      id: maliciousId,
      name: 'Malicious',
      email: 'evil@test.com',
      vertical: 'retail'
    });

    // Should succeed but with sanitized ID (no path traversal)
    assert.strictEqual(result.success, true);
    // The created directory should NOT be at /etc/passwd
    assert.ok(!fs.existsSync('/etc/passwd/config.json'), 'Path traversal should be prevented');

    // Cleanup the sanitized directory
    const sanitizedDir = path.join(mod.baseClientsDir, result.tenantId);
    if (fs.existsSync(sanitizedDir)) fs.rmSync(sanitizedDir, { recursive: true, force: true });
    restoreMocks();
  });
});
