/**
 * test-billing-flow.cjs
 * VocalIA - Billing Flow Verification
 */

const BillingAgent = require('../core/BillingAgent.cjs');

async function test() {
    console.log('🚀 Starting Billing Flow Test...');

    const mockSession = {
        pillars: {
            identity: { email: 'client@example.ma', name: 'Test Client', phone: '+212600000000' },
            intent: { need: 'E-commerce Voice AI' },
            qualification: { score: 85 }
        },
        metadata: {
            tenantId: 'test_client_maroc',
            currency: 'mad',
            attribution: { fbclid: 'test_fbclid_123' }
        }
    };

    console.log('\n--- Testing MAD Payment (Payzone) ---');
    const resultMAD = await BillingAgent.processSessionBilling(mockSession);
    console.log('Result MAD:', JSON.stringify(resultMAD, null, 2));

    console.log('\n--- Testing EUR Payment (Stripe) ---');
    mockSession.metadata.currency = 'eur';
    const resultEUR = await BillingAgent.processSessionBilling(mockSession);
    console.log('Result EUR:', JSON.stringify(resultEUR, null, 2));

    if (resultMAD.success && resultEUR.success) {
        console.log('\n✅ Billing Flow Test PASSED.');
    } else {
        console.error('\n❌ Billing Flow Test FAILED.');
    }
}

test();
