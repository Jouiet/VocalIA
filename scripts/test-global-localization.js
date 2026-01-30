const { GlobalLocalization, MARKET_RULES } = require('../website/src/lib/global-localization.js');

async function testLocalization() {
    console.log("🌍 Testing Global Localization Engine (Strict Rules)...");

    // Mock fetch for IP API
    global.fetch = async (url) => {
        if (url.includes('ipapi')) {
            return {
                ok: true,
                json: async () => ({ country_code: 'MA' }) // Default mock to MA
            };
        }
    };

    // Test 1: Configuration Checks
    console.log("\n[Test 1] strict Market Rules Verification:");

    const check = (code, expectLang, expectCurr) => {
        const config = GlobalLocalization.getMarketConfig(code);
        const pass = config.lang === expectLang && config.currency === expectCurr;
        console.log(`- ${code}: ${config.lang}/${config.currency} [Expected: ${expectLang}/${expectCurr}] -> ${pass ? '✅' : '❌'}`);
        return pass;
    };

    const t1 = check('MA', 'fr', 'MAD');
    const t2 = check('FR', 'fr', 'EUR');
    const t3 = check('ES', 'fr', 'EUR'); // Strict Europe Rule: FR + EUR
    const t4 = check('AE', 'en', 'USD');
    const t5 = check('JP', 'en', 'USD'); // Intl

    if (t1 && t2 && t3 && t4 && t5) {
        console.log("✅ All Market Rules Passed");
    } else {
        console.error("❌ Some Market Rules Failed");
        process.exit(1);
    }

    // Test 2: Formatting
    console.log("\n[Test 2] Price Formatting:");
    console.log(`- MAD: ${GlobalLocalization.formatPrice(100, 'MAD')} (Expected: 100 DH)`);
    console.log(`- EUR: ${GlobalLocalization.formatPrice(100, 'EUR')} (Expected: €100)`);
    console.log(`- USD: ${GlobalLocalization.formatPrice(100, 'USD')} (Expected: $100)`);
}

testLocalization().catch(console.error);
