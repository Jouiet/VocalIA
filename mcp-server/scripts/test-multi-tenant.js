import { ucpTools } from '../dist/tools/ucp.js';

async function testMultiTenant() {
    console.log("🏢 Testing Multi-Tenant Architecture...");

    const runTest = async (tenantId, country, desc) => {
        // Simulate meta-injection or header
        const mockArgs = {
            countryCode: country,
            _meta: { tenantId }
        };

        try {
            const result = await ucpTools.ucp_sync_preference.handler(mockArgs);
            const content = JSON.parse(result.content[0].text);
            return content.profile;
        } catch (e) {
            console.error(`Error for ${tenantId}:`, e);
            return null;
        }
    };

    // Test 1: Agency Internal (Strict Rules)
    // MA -> FR/MAD
    console.log("\n[Test 1] Agency Internal (Strict Rules)");
    const p1 = await runTest('agency_internal', 'MA', 'Internal MA');
    const check1 = p1.market === 'maroc' && p1.currency === 'MAD';
    console.log(`- Maroc: ${p1.market}/${p1.currency} -> ${check1 ? '✅' : '❌'}`);

    // Test 2: Client Demo (Lax Rules)
    // MA -> US Main/USD (because they only operate in USD and have no special rules)
    console.log("\n[Test 2] Client Demo (SaaS Mode - Custom Rules)");
    const p2 = await runTest('client_demo', 'MA', 'Demo Client MA');
    const check2 = p2.market === 'us_main' && p2.currency === 'USD';
    console.log(`- Maroc (as Demo Client): ${p2.market}/${p2.currency} -> ${check2 ? '✅' : '❌'} (Expected USD for strictly US-based client)`);

    if (check1 && check2) {
        console.log("\n✅ SUCCESS: Tenants are successfully isolated with different configurations.");
    } else {
        console.error("\n❌ FAILURE: Tenant isolation failed.");
        process.exit(1);
    }
}

testMultiTenant().catch(console.error);
