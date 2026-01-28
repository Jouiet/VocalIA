/**
 * test-onboarding.cjs
 * VocalIA - Onboarding E2E Test
 */

const TenantOnboardingAgent = require('../core/TenantOnboardingAgent.cjs');
const fs = require('fs');
const path = require('path');

async function test() {
    console.log('🚀 Starting Onboarding E2E Test...');

    const testTenant = {
        id: 'test_client_maroc',
        name: 'Maroc E-commerce SARL',
        email: 'contact@marocshop.ma',
        vertical: 'e-commerce',
        integrations: {
            shopify: { enabled: true, shop_domain: 'maroc-shop.myshopify.com' }
        }
    };

    const result = await TenantOnboardingAgent.onboardTenant(testTenant);

    if (result.success) {
        console.log('✅ Onboarding agent returned success.');

        // Verify files
        const configPath = path.join(process.cwd(), '..', 'clients', testTenant.id, 'config.json');
        if (fs.existsSync(configPath)) {
            console.log('✅ config.json created.');
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (config.name === testTenant.name) {
                console.log('✅ config content verified.');
            }
        } else {
            console.error('❌ config.json NOT found.');
        }

        const credsPath = path.join(process.cwd(), '..', 'clients', testTenant.id, 'credentials.json');
        if (fs.existsSync(credsPath)) {
            console.log('✅ credentials.json created.');
        } else {
            console.error('❌ credentials.json NOT found.');
        }
    } else {
        console.error('❌ Onboarding failed:', result.error);
    }
}

test();
