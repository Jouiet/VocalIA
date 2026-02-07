/**
 * VocalIA Voice CRM Tools Tests
 *
 * Tests:
 * - Module exports (lookupCustomer, createLead, updateCustomer, logCall)
 * - No-credential fallbacks
 *
 * NOTE: Does NOT call HubSpot/Pipedrive APIs. Tests pure logic only.
 *
 * Run: node --test test/voice-crm-tools.test.mjs
 */



import { test, describe } from 'node:test';
import assert from 'node:assert';
import crmTools from '../core/voice-crm-tools.cjs';

// NOTE: Exports are proven by behavioral tests below (lookupCustomer, createLead, updateCustomer, logCall).

// ─── lookupCustomer without credentials ──────────────────────────

describe('VoiceCRMTools lookupCustomer (no creds)', () => {
  test('returns not found for nonexistent tenant', async () => {
    const result = await crmTools.lookupCustomer('test@test.com', 'nonexistent_tenant_xyz');
    assert.strictEqual(result.found, false);
  });

  test('returns no_credentials reason', async () => {
    const result = await crmTools.lookupCustomer('a@b.com', 'no_creds_tenant');
    assert.strictEqual(result.found, false);
    assert.strictEqual(result.reason, 'no_credentials');
  });

  test('returns message for no credentials', async () => {
    const result = await crmTools.lookupCustomer('test@example.com', 'empty_tenant');
    assert.ok(result.message);
    assert.ok(result.message.includes('not configured') || result.message.includes('CRM'));
  });
});

// ─── createLead without credentials ──────────────────────────────

describe('VoiceCRMTools createLead (no creds)', () => {
  test('returns queued_for_sync when no HubSpot', async () => {
    const result = await crmTools.createLead({ email: 'test@test.com', score: 50 }, 'nonexistent_tenant');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.status, 'queued_for_sync');
  });
});

// ─── updateCustomer without credentials ──────────────────────────

describe('VoiceCRMTools updateCustomer (no creds)', () => {
  test('returns error when no credentials', async () => {
    const result = await crmTools.updateCustomer('12345', { phone: '+1234567890' }, 'nonexistent_tenant');
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('No CRM credentials'));
  });
});

// ─── logCall without credentials ─────────────────────────────────

describe('VoiceCRMTools logCall (no creds)', () => {
  test('returns error when no credentials or contactId', async () => {
    const result = await crmTools.logCall({ duration: 120 }, 'nonexistent_tenant');
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('Missing credentials'));
  });

  test('returns error with contactId but no creds', async () => {
    const result = await crmTools.logCall({ contactId: '123', duration: 60 }, 'nonexistent_tenant');
    assert.strictEqual(result.success, false);
  });
});

// ─── createLead edge cases ──────────────────────────────────────

describe('VoiceCRMTools createLead edge cases', () => {
  test('handles minimal lead data', async () => {
    const result = await crmTools.createLead({ email: 'min@test.com' }, 'no_creds');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.status, 'queued_for_sync');
  });

  test('handles lead with high score', async () => {
    const result = await crmTools.createLead({ email: 'hot@test.com', score: 85 }, 'no_creds');
    assert.strictEqual(result.success, true);
  });

  test('handles lead with name splitting', async () => {
    const result = await crmTools.createLead({ email: 'named@test.com', name: 'Jean Dupont' }, 'no_creds');
    assert.strictEqual(result.success, true);
  });

  test('handles lead with zero score', async () => {
    const result = await crmTools.createLead({ email: 'cold@test.com', score: 0 }, 'no_creds');
    assert.strictEqual(result.success, true);
  });
});

// ─── updateCustomer edge cases ──────────────────────────────────

describe('VoiceCRMTools updateCustomer edge cases', () => {
  test('rejects empty updates', async () => {
    const result = await crmTools.updateCustomer('123', {}, 'no_creds');
    assert.strictEqual(result.success, false);
  });

  test('rejects with score update', async () => {
    const result = await crmTools.updateCustomer('123', { score: 75 }, 'no_creds');
    assert.strictEqual(result.success, false);
  });

  test('rejects with notes update', async () => {
    const result = await crmTools.updateCustomer('123', { notes: 'Test note' }, 'no_creds');
    assert.strictEqual(result.success, false);
  });
});

// ─── lookupCustomer edge cases ──────────────────────────────────

describe('VoiceCRMTools lookupCustomer edge cases', () => {
  test('handles empty email', async () => {
    const result = await crmTools.lookupCustomer('', 'no_creds');
    assert.strictEqual(result.found, false);
  });

  test('returns consistent structure', async () => {
    const result = await crmTools.lookupCustomer('test@example.com', 'some_tenant');
    assert.ok('found' in result);
    assert.strictEqual(typeof result.found, 'boolean');
  });
});
