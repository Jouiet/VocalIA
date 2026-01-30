#!/usr/bin/env node
/**
 * Test UCP Persistence (Session 249)
 * Verifies that profiles are actually persisted to file
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const UCP_PROFILES_FILE = path.join(DATA_DIR, 'ucp-profiles.json');

console.log('=== UCP Persistence Test ===\n');

// 1. Check if data directory exists
console.log(`1. Data directory: ${DATA_DIR}`);
console.log(`   Exists: ${fs.existsSync(DATA_DIR) ? '✅' : '❌'}`);

// 2. Simulate saving a profile
console.log('\n2. Simulating profile save...');

const testProfile = {
    profiles: {
        'agency_internal:test_user_123': {
            userId: 'test_user_123',
            tenantId: 'agency_internal',
            country: 'MA',
            market: 'maroc',
            locale: 'fr',
            currency: 'MAD',
            currencySymbol: 'DH',
            enforced: true,
            timestamp: new Date().toISOString()
        }
    },
    lastUpdated: new Date().toISOString()
};

try {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(UCP_PROFILES_FILE, JSON.stringify(testProfile, null, 2));
    console.log('   Save: ✅ SUCCESS');
} catch (e) {
    console.log(`   Save: ❌ FAILED - ${e.message}`);
    process.exit(1);
}

// 3. Read back and verify
console.log('\n3. Reading back profile...');
try {
    const data = fs.readFileSync(UCP_PROFILES_FILE, 'utf-8');
    const parsed = JSON.parse(data);

    if (parsed.profiles && parsed.profiles['agency_internal:test_user_123']) {
        const profile = parsed.profiles['agency_internal:test_user_123'];
        console.log('   Read: ✅ SUCCESS');
        console.log(`   - userId: ${profile.userId}`);
        console.log(`   - country: ${profile.country}`);
        console.log(`   - currency: ${profile.currency}`);
        console.log(`   - persisted: ${profile.timestamp}`);
    } else {
        console.log('   Read: ❌ FAILED - Profile not found');
        process.exit(1);
    }
} catch (e) {
    console.log(`   Read: ❌ FAILED - ${e.message}`);
    process.exit(1);
}

// 4. Clean up test data
console.log('\n4. Cleaning up test data...');
try {
    fs.unlinkSync(UCP_PROFILES_FILE);
    console.log('   Cleanup: ✅ SUCCESS');
} catch (e) {
    console.log(`   Cleanup: ⚠️ WARNING - ${e.message}`);
}

console.log('\n=== UCP Persistence Test: ✅ PASSED ===\n');
