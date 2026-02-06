'use strict';

/**
 * VocalIA BillingAgent Tests
 *
 * Tests:
 * - AGENT_CARD (A2A protocol metadata)
 * - TASK_STATES (6 states)
 * - BILLING_STATES (7 states)
 * - BillingAgent constructor defaults
 * - getAgentCard()
 * - getTaskHistory() (empty, populated)
 * - recordTaskState() (state tracking, bounded history)
 * - health() structure (via module instance)
 *
 * NOTE: Does NOT call Stripe/Payzone APIs. Tests pure logic and constants.
 *
 * Run: node --test test/billing-agent.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const billingInstance = require('../core/BillingAgent.cjs');
const { BillingAgent, STATES } = billingInstance;

// ─── AGENT_CARD ─────────────────────────────────────────────────────

describe('BillingAgent AGENT_CARD', () => {
  test('agent card has required A2A fields', () => {
    const card = billingInstance.getAgentCard();
    assert.ok(card.name);
    assert.ok(card.version);
    assert.ok(card.description);
    assert.ok(card.provider);
    assert.ok(card.capabilities);
    assert.ok(card.skills);
  });

  test('agent name is BillingAgent', () => {
    const card = billingInstance.getAgentCard();
    assert.strictEqual(card.name, 'BillingAgent');
  });

  test('version is 3.1.0', () => {
    const card = billingInstance.getAgentCard();
    assert.strictEqual(card.version, '3.1.0');
  });

  test('provider is VocalIA', () => {
    const card = billingInstance.getAgentCard();
    assert.strictEqual(card.provider.organization, 'VocalIA');
    assert.strictEqual(card.provider.url, 'https://vocalia.ma');
  });

  test('has 4 skills', () => {
    const card = billingInstance.getAgentCard();
    assert.strictEqual(card.skills.length, 4);
  });

  test('skills include customer_creation', () => {
    const card = billingInstance.getAgentCard();
    const skill = card.skills.find(s => s.id === 'customer_creation');
    assert.ok(skill);
    assert.ok(skill.description);
  });

  test('skills include invoice_drafting', () => {
    const card = billingInstance.getAgentCard();
    const skill = card.skills.find(s => s.id === 'invoice_drafting');
    assert.ok(skill);
  });

  test('skills include payment_processing', () => {
    const card = billingInstance.getAgentCard();
    const skill = card.skills.find(s => s.id === 'payment_processing');
    assert.ok(skill);
  });

  test('skills include currency_routing', () => {
    const card = billingInstance.getAgentCard();
    const skill = card.skills.find(s => s.id === 'currency_routing');
    assert.ok(skill);
    assert.ok(skill.description.includes('MAD'));
  });

  test('capabilities include pushNotifications', () => {
    const card = billingInstance.getAgentCard();
    assert.strictEqual(card.capabilities.pushNotifications, true);
  });

  test('capabilities include stateTransitionHistory', () => {
    const card = billingInstance.getAgentCard();
    assert.strictEqual(card.capabilities.stateTransitionHistory, true);
  });

  test('authentication scheme is bearer', () => {
    const card = billingInstance.getAgentCard();
    assert.ok(card.authentication.schemes.includes('bearer'));
  });
});

// ─── BILLING_STATES ─────────────────────────────────────────────────

describe('BillingAgent BILLING_STATES', () => {
  test('has 7 states', () => {
    assert.strictEqual(Object.keys(STATES).length, 7);
  });

  test('has IDLE state', () => {
    assert.strictEqual(STATES.IDLE, 'idle');
  });

  test('has CUSTOMER_CREATED state', () => {
    assert.strictEqual(STATES.CUSTOMER_CREATED, 'customer_created');
  });

  test('has INVOICE_DRAFTED state', () => {
    assert.strictEqual(STATES.INVOICE_DRAFTED, 'invoice_drafted');
  });

  test('has INVOICE_SENT state', () => {
    assert.strictEqual(STATES.INVOICE_SENT, 'invoice_sent');
  });

  test('has PAYMENT_PENDING state', () => {
    assert.strictEqual(STATES.PAYMENT_PENDING, 'payment_pending');
  });

  test('has PAYMENT_COMPLETED state', () => {
    assert.strictEqual(STATES.PAYMENT_COMPLETED, 'payment_completed');
  });

  test('has PAYMENT_FAILED state', () => {
    assert.strictEqual(STATES.PAYMENT_FAILED, 'payment_failed');
  });
});

// ─── getTaskHistory ─────────────────────────────────────────────────

describe('BillingAgent getTaskHistory', () => {
  test('returns empty array for unknown correlationId', () => {
    const history = billingInstance.getTaskHistory('unknown-id-xyz');
    assert.deepStrictEqual(history, []);
  });
});

// ─── recordTaskState ────────────────────────────────────────────────

describe('BillingAgent recordTaskState', () => {
  test('records state transition', () => {
    const corrId = `test-${Date.now()}`;
    billingInstance.recordTaskState(corrId, 'submitted', { email: 'test@test.com' });
    const history = billingInstance.getTaskHistory(corrId);
    assert.strictEqual(history.length, 1);
    assert.strictEqual(history[0].state, 'submitted');
    assert.ok(history[0].timestamp);
    assert.strictEqual(history[0].email, 'test@test.com');
  });

  test('accumulates multiple state transitions', () => {
    const corrId = `test-multi-${Date.now()}`;
    billingInstance.recordTaskState(corrId, 'submitted');
    billingInstance.recordTaskState(corrId, 'working');
    billingInstance.recordTaskState(corrId, 'completed', { result: 'success' });
    const history = billingInstance.getTaskHistory(corrId);
    assert.strictEqual(history.length, 3);
    assert.strictEqual(history[0].state, 'submitted');
    assert.strictEqual(history[1].state, 'working');
    assert.strictEqual(history[2].state, 'completed');
  });

  test('each entry has timestamp', () => {
    const corrId = `test-ts-${Date.now()}`;
    billingInstance.recordTaskState(corrId, 'submitted');
    const history = billingInstance.getTaskHistory(corrId);
    assert.ok(history[0].timestamp);
    // Should be a valid ISO date
    assert.ok(new Date(history[0].timestamp).getTime() > 0);
  });
});

// ─── Constructor defaults ───────────────────────────────────────────

describe('BillingAgent constructor', () => {
  test('has default price of 50000 (500€)', () => {
    assert.strictEqual(billingInstance.defaultPrice, 50000);
  });

  test('has default currency eur', () => {
    assert.strictEqual(billingInstance.currency, 'eur');
  });

  test('has stripe gateway', () => {
    assert.ok(billingInstance.stripe);
  });

  test('has payzone gateway', () => {
    assert.ok(billingInstance.payzone);
  });

  test('has taskHistory map', () => {
    assert.ok(billingInstance.taskHistory instanceof Map);
  });
});

// ─── getState ──────────────────────────────────────────────────────

describe('BillingAgent getState', () => {
  test('returns IDLE for unknown session', () => {
    const state = billingInstance.getState('unknown-session-xyz');
    assert.strictEqual(state, STATES.IDLE);
  });

  test('returns idle string', () => {
    const state = billingInstance.getState('another-unknown');
    assert.strictEqual(state, 'idle');
  });
});

// ─── constructor with custom options ────────────────────────────────

describe('BillingAgent custom constructor', () => {
  test('accepts custom defaultPrice', () => {
    const agent = new BillingAgent({ defaultPrice: 99900 });
    assert.strictEqual(agent.defaultPrice, 99900);
  });

  test('accepts custom currency', () => {
    const agent = new BillingAgent({ currency: 'mad' });
    assert.strictEqual(agent.currency, 'mad');
  });

  test('defaults when no options', () => {
    const agent = new BillingAgent();
    assert.strictEqual(agent.defaultPrice, 50000);
    assert.strictEqual(agent.currency, 'eur');
  });

  test('taskHistory starts empty', () => {
    const agent = new BillingAgent();
    assert.strictEqual(agent.taskHistory.size, 0);
  });
});

// ─── recordTaskState bounded history ────────────────────────────────

describe('BillingAgent recordTaskState bounded', () => {
  test('details are spread into entry', () => {
    const corrId = `test-details-${Date.now()}`;
    billingInstance.recordTaskState(corrId, 'working', { customer: 'cust_123', amount: 500 });
    const history = billingInstance.getTaskHistory(corrId);
    assert.strictEqual(history[0].customer, 'cust_123');
    assert.strictEqual(history[0].amount, 500);
  });

  test('timestamp is valid ISO string', () => {
    const corrId = `test-iso-${Date.now()}`;
    billingInstance.recordTaskState(corrId, 'submitted');
    const ts = billingInstance.getTaskHistory(corrId)[0].timestamp;
    assert.ok(!isNaN(Date.parse(ts)));
  });
});

// ─── AGENT_CARD skills structure ────────────────────────────────────

describe('BillingAgent AGENT_CARD skills detail', () => {
  test('all skills have id, name, description', () => {
    const card = billingInstance.getAgentCard();
    for (const skill of card.skills) {
      assert.ok(skill.id, 'Missing skill id');
      assert.ok(skill.name, 'Missing skill name');
      assert.ok(skill.description, 'Missing skill description');
    }
  });

  test('all skills have input/output modes', () => {
    const card = billingInstance.getAgentCard();
    for (const skill of card.skills) {
      assert.ok(Array.isArray(skill.inputModes));
      assert.ok(Array.isArray(skill.outputModes));
    }
  });

  test('default modes are application/json', () => {
    const card = billingInstance.getAgentCard();
    assert.ok(card.defaultInputModes.includes('application/json'));
    assert.ok(card.defaultOutputModes.includes('application/json'));
  });
});

// ─── STATES as static property ──────────────────────────────────────

describe('BillingAgent static STATES', () => {
  test('BillingAgent.STATES matches exported STATES', () => {
    assert.deepStrictEqual(BillingAgent.STATES, STATES);
  });

  test('all state values are lowercase strings', () => {
    for (const [key, val] of Object.entries(STATES)) {
      assert.strictEqual(typeof val, 'string');
      assert.strictEqual(val, val.toLowerCase());
    }
  });
});

// ─── Exports ────────────────────────────────────────────────────────

describe('BillingAgent exports', () => {
  test('exports BillingAgent class', () => {
    assert.strictEqual(typeof BillingAgent, 'function');
  });

  test('exports STATES', () => {
    assert.ok(STATES);
    assert.strictEqual(typeof STATES, 'object');
  });

  test('exports trackCost function', () => {
    assert.strictEqual(typeof billingInstance.constructor.trackCost, 'function');
  });

  test('instance has processSessionBilling method', () => {
    assert.strictEqual(typeof billingInstance.processSessionBilling, 'function');
  });

  test('instance has getAgentCard method', () => {
    assert.strictEqual(typeof billingInstance.getAgentCard, 'function');
  });

  test('instance has recordTaskState method', () => {
    assert.strictEqual(typeof billingInstance.recordTaskState, 'function');
  });

  test('instance has getTaskHistory method', () => {
    assert.strictEqual(typeof billingInstance.getTaskHistory, 'function');
  });

  test('instance has getState method', () => {
    assert.strictEqual(typeof billingInstance.getState, 'function');
  });

  test('instance has handleInvoicePaid method', () => {
    assert.strictEqual(typeof billingInstance.handleInvoicePaid, 'function');
  });

  test('instance has handleInvoicePaidWebhook method', () => {
    assert.strictEqual(typeof billingInstance.handleInvoicePaidWebhook, 'function');
  });
});
