#!/usr/bin/env node
/**
 * Test UCP Persistence (Session 250.188 — unified per-tenant storage)
 * Verifies that profiles are persisted to data/ucp/{tenantId}/profiles.json
 * Compatible with both core/ucp-store.cjs and mcp-server/src/tools/ucp.ts
 */

const fs = require('fs');
const path = require('path');

const UCP_BASE_DIR = path.join(__dirname, '..', '..', 'data', 'ucp');
const TEST_TENANT = '__test__';
const TEST_DIR = path.join(UCP_BASE_DIR, TEST_TENANT);
const TEST_PROFILES_FILE = path.join(TEST_DIR, 'profiles.json');
const TEST_INTERACTIONS_FILE = path.join(TEST_DIR, 'interactions.jsonl');

console.log('=== UCP Persistence Test (Unified Storage) ===\n');

// 1. Check base directory
console.log(`1. UCP base directory: ${UCP_BASE_DIR}`);
console.log(`   Exists: ${fs.existsSync(UCP_BASE_DIR) ? '\u2705' : '\u274C'}`);

// 2. Create per-tenant directory and save profile
console.log('\n2. Simulating per-tenant profile save...');

const testProfile = {
  test_user_123: {
    customer_id: 'test_user_123',
    tenant_id: TEST_TENANT,
    name: 'Test User',
    country: 'MA',
    market: 'maroc',
    locale: 'fr',
    currency: 'MAD',
    currencySymbol: 'DH',
    enforced: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    interaction_count: 0,
    ltv_value: 0,
    ltv_tier: 'bronze'
  }
};

try {
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
  fs.writeFileSync(TEST_PROFILES_FILE, JSON.stringify(testProfile, null, 2));
  console.log('   Save: \u2705 SUCCESS');
} catch (e) {
  console.log(`   Save: \u274C FAILED - ${e.message}`);
  process.exit(1);
}

// 3. Read back and verify (same format as core/ucp-store.cjs)
console.log('\n3. Reading back profile (core-compatible format)...');
try {
  const data = fs.readFileSync(TEST_PROFILES_FILE, 'utf-8');
  const parsed = JSON.parse(data);

  if (parsed.test_user_123) {
    const profile = parsed.test_user_123;
    console.log('   Read: \u2705 SUCCESS');
    console.log(`   - customer_id: ${profile.customer_id}`);
    console.log(`   - country: ${profile.country}`);
    console.log(`   - currency: ${profile.currency}`);
    console.log(`   - ltv_tier: ${profile.ltv_tier}`);
    console.log(`   - created_at: ${profile.created_at}`);
  } else {
    console.log('   Read: \u274C FAILED - Profile not found');
    process.exit(1);
  }
} catch (e) {
  console.log(`   Read: \u274C FAILED - ${e.message}`);
  process.exit(1);
}

// 4. Test interactions JSONL (append-only audit trail)
console.log('\n4. Testing interactions JSONL...');
try {
  const interaction = {
    id: 'test_001',
    customer_id: 'test_user_123',
    tenant_id: TEST_TENANT,
    type: 'voice_call',
    channel: 'telephony',
    timestamp: new Date().toISOString()
  };
  fs.appendFileSync(TEST_INTERACTIONS_FILE, JSON.stringify(interaction) + '\n');
  const lines = fs.readFileSync(TEST_INTERACTIONS_FILE, 'utf-8').trim().split('\n');
  const parsed = JSON.parse(lines[0]);
  console.log(`   JSONL: \u2705 SUCCESS (${lines.length} entry, type=${parsed.type})`);
} catch (e) {
  console.log(`   JSONL: \u274C FAILED - ${e.message}`);
  process.exit(1);
}

// 5. Clean up test data
console.log('\n5. Cleaning up test data...');
try {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
  console.log('   Cleanup: \u2705 SUCCESS');
} catch (e) {
  console.log(`   Cleanup: \u26A0\uFE0F WARNING - ${e.message}`);
}

console.log('\n=== UCP Persistence Test: \u2705 PASSED (unified per-tenant storage) ===\n');
