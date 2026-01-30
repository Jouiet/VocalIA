const { initGeoDetection, GEO_CONFIG, formatPrice } = require('../website/src/lib/geo-detect.js');

// Mock localStorage
global.localStorage = {
    store: {},
    getItem: function (key) { return this.store[key] || null; },
    setItem: function (key, value) { this.store[key] = value.toString(); }
};

// Mock fetch for IP API
global.fetch = async () => ({
    ok: true,
    json: async () => ({ country_code: 'MA' }) // Default to MA for first test
});

async function runTests() {
    console.log("--- TEST 1: Morocco (MA) ---");
    global.fetch = async () => ({ ok: true, json: async () => ({ country_code: 'MA' }) });
    let config = await initGeoDetection();
    console.log(`MA -> Currency: ${config.currency}, Lang: ${config.lang}`);
    if (config.currency !== 'MAD') console.error("❌ MA Failed: Currency should be MAD");
    if (config.lang !== 'fr') console.error("❌ MA Failed: Lang should be FR");

    console.log("\n--- TEST 2: France (FR) ---");
    global.fetch = async () => ({ ok: true, json: async () => ({ country_code: 'FR' }) });
    config = await initGeoDetection();
    console.log(`FR -> Currency: ${config.currency}, Lang: ${config.lang}`);
    if (config.currency !== 'EUR') console.error("❌ FR Failed: Currency should be EUR");

    console.log("\n--- TEST 3: UAE (AE) - MENA Rule ---");
    global.fetch = async () => ({ ok: true, json: async () => ({ country_code: 'AE' }) });
    config = await initGeoDetection();
    console.log(`AE -> Currency: ${config.currency}, Lang: ${config.lang}`);
    // Strict Rule: MENA (Gulf) -> English + USD
    if (config.currency !== 'USD') console.error("❌ AE Failed: Currency should be USD");
    if (config.lang !== 'en') console.error("❌ AE Failed: Lang should be EN");

    console.log("\n--- TEST 4: USA (US) ---");
    global.fetch = async () => ({ ok: true, json: async () => ({ country_code: 'US' }) });
    config = await initGeoDetection();
    console.log(`US -> Currency: ${config.currency}, Lang: ${config.lang}`);
    if (config.currency !== 'USD') console.error("❌ US Failed: Currency should be USD");
}

runTests();
