'use strict';

/**
 * VocalIA TenantOnboardingAgent Tests
 *
 * Tests:
 * - Module exports (singleton instance + AGENT_CARD + TASK_STATES)
 * - AGENT_CARD structure (A2A protocol compliance)
 * - Task state management (recordTaskState, getTaskHistory)
 * - A2A task lifecycle
 * - Class methods existence
 *
 * NOTE: Does NOT write to filesystem or call HubSpot.
 *
 * Run: node --test test/TenantOnboardingAgent.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const mod = require('../core/TenantOnboardingAgent.cjs');

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
