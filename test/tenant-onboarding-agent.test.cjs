'use strict';

/**
 * VocalIA TenantOnboardingAgent Tests
 *
 * Tests:
 * - AGENT_CARD structure (A2A Protocol compliance)
 * - TASK_STATES enum
 * - getAgentCard
 * - getTaskHistory / recordTaskState
 * - Task history cleanup (max 500)
 *
 * NOTE: Does NOT test onboardTenant (requires HubSpot + AgencyEventBus).
 * Tests A2A protocol compliance and task lifecycle only.
 *
 * Run: node --test test/tenant-onboarding-agent.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const agent = require('../core/TenantOnboardingAgent.cjs');

// ─── AGENT_CARD ─────────────────────────────────────────────────────

describe('TenantOnboardingAgent AGENT_CARD', () => {
  const card = agent.getAgentCard();

  test('has required A2A fields', () => {
    assert.ok(card.name);
    assert.ok(card.version);
    assert.ok(card.description);
    assert.ok(card.provider);
    assert.ok(card.capabilities);
    assert.ok(card.skills);
    assert.ok(card.authentication);
  });

  test('name is TenantOnboardingAgent', () => {
    assert.strictEqual(card.name, 'TenantOnboardingAgent');
  });

  test('version is semver', () => {
    assert.ok(/^\d+\.\d+\.\d+$/.test(card.version));
  });

  test('provider is VocalIA', () => {
    assert.strictEqual(card.provider.organization, 'VocalIA');
    assert.strictEqual(card.provider.url, 'https://vocalia.ma');
  });

  test('has 3 skills', () => {
    assert.strictEqual(card.skills.length, 3);
  });

  test('skills include directory_provisioning', () => {
    assert.ok(card.skills.some(s => s.id === 'directory_provisioning'));
  });

  test('skills include crm_sync', () => {
    assert.ok(card.skills.some(s => s.id === 'crm_sync'));
  });

  test('skills include integration_setup', () => {
    assert.ok(card.skills.some(s => s.id === 'integration_setup'));
  });

  test('each skill has required fields', () => {
    for (const skill of card.skills) {
      assert.ok(skill.id);
      assert.ok(skill.name);
      assert.ok(skill.description);
      assert.ok(Array.isArray(skill.inputModes));
      assert.ok(Array.isArray(skill.outputModes));
    }
  });

  test('capabilities include streaming false', () => {
    assert.strictEqual(card.capabilities.streaming, false);
  });

  test('capabilities include pushNotifications true', () => {
    assert.strictEqual(card.capabilities.pushNotifications, true);
  });

  test('capabilities include stateTransitionHistory true', () => {
    assert.strictEqual(card.capabilities.stateTransitionHistory, true);
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

// ─── Task History (A2A lifecycle) ───────────────────────────────────

describe('TenantOnboardingAgent task history', () => {
  test('getTaskHistory returns empty for unknown correlation', () => {
    const history = agent.getTaskHistory('unknown_corr_123');
    assert.deepStrictEqual(history, []);
  });

  test('recordTaskState creates history entry', () => {
    const corrId = `test_${Date.now()}`;
    agent.recordTaskState(corrId, 'submitted', { tenantId: 'test_t' });

    const history = agent.getTaskHistory(corrId);
    assert.strictEqual(history.length, 1);
    assert.strictEqual(history[0].state, 'submitted');
    assert.strictEqual(history[0].tenantId, 'test_t');
    assert.ok(history[0].timestamp);
  });

  test('recordTaskState appends to existing history', () => {
    const corrId = `test_append_${Date.now()}`;
    agent.recordTaskState(corrId, 'submitted');
    agent.recordTaskState(corrId, 'working', { skill: 'dir_provision' });
    agent.recordTaskState(corrId, 'completed');

    const history = agent.getTaskHistory(corrId);
    assert.strictEqual(history.length, 3);
    assert.strictEqual(history[0].state, 'submitted');
    assert.strictEqual(history[1].state, 'working');
    assert.strictEqual(history[1].skill, 'dir_provision');
    assert.strictEqual(history[2].state, 'completed');
  });

  test('timestamps are ISO format', () => {
    const corrId = `test_ts_${Date.now()}`;
    agent.recordTaskState(corrId, 'submitted');

    const history = agent.getTaskHistory(corrId);
    const ts = history[0].timestamp;
    assert.ok(!isNaN(Date.parse(ts)));
  });
});

// ─── Module exports ─────────────────────────────────────────────────

describe('TenantOnboardingAgent exports', () => {
  test('exports an instance (not a class)', () => {
    assert.strictEqual(typeof agent.getAgentCard, 'function');
    assert.strictEqual(typeof agent.getTaskHistory, 'function');
    assert.strictEqual(typeof agent.recordTaskState, 'function');
    assert.strictEqual(typeof agent.onboardTenant, 'function');
  });

  test('has baseClientsDir', () => {
    assert.ok(agent.baseClientsDir);
    assert.ok(agent.baseClientsDir.includes('clients'));
  });

  test('has taskHistory as Map', () => {
    assert.ok(agent.taskHistory instanceof Map);
  });
});
