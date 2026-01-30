import { ucpTools } from '../dist/tools/ucp.js';

async function testUCP() {
    console.log("🧪 Testing UCP MCP Tools (Strict Rules)...");

    const check = async (input, expectMarket, expectLang, expectCurr) => {
        const result = await ucpTools.ucp_sync_preference.handler({ countryCode: input });
        const content = JSON.parse(result.content[0].text);
        const p = content.profile;

        const pass = p.market === expectMarket && p.locale === expectLang && p.currency === expectCurr;
        console.log(`- Input: ${input} -> ${p.market}/${p.locale}/${p.currency} [Expect: ${expectMarket}/${expectLang}/${expectCurr}] -> ${pass ? '✅' : '❌'}`);
        return pass;
    };

    // 1. MAROC -> FR/MAD
    const t1 = await check('MA', 'maroc', 'fr', 'MAD');

    // 2. EUROPE -> FR/EUR (Strict)
    const t2 = await check('FR', 'europe', 'fr', 'EUR');
    const t3 = await check('ES', 'europe', 'fr', 'EUR'); // Spanin -> FR/EUR per rules

    // 3. MENA -> EN/USD
    const t4 = await check('AE', 'mena', 'en', 'USD');

    // 4. INTL -> EN/USD
    const t5 = await check('JP', 'intl', 'en', 'USD');

    if (t1 && t2 && t3 && t4 && t5) {
        console.log("✅ All UCP Market Rules Passed");
    } else {
        console.error("❌ Some UCP Rules Failed");
        process.exit(1);
    }
}

testUCP().catch(console.error);
