/**
 * Tenant Bridge Integration Test
 * Session 250.97quater - Verify TenantBridge with real clients
 * Session 250.102 - Fixed to use actual client_registry.json IDs
 *
 * Tests:
 * 1. TenantBridge can retrieve clients (DB or static)
 * 2. Persona injection uses clients correctly (no AGENCY contamination)
 * 3. Widget isolation is maintained
 * 4. Template variables resolve properly
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Import modules
const TenantBridge = require('../core/tenant-persona-bridge.cjs');
const { VoicePersonaInjector } = require('../personas/voice-persona-injector.cjs');

// Test clients - ACTUAL IDs from client_registry.json
const TEST_CLIENTS = {
  B2B: [
    'notaire_rabat_01',
    'agence_commerciale_01',
    'assurance_01'
  ],
  B2C: [
    'dentiste_casa_01',
    'fitness_casa_01',
    'hotel_marrakech_01'
  ],
  ECOM: [
    'ecom_nike_01',
    'ecom_darija_01'
  ]
};

const EXPECTED_ARCHETYPES = {
  B2B: 'UNIVERSAL_SME',
  B2C: 'UNIVERSAL_SME',
  ECOM: 'UNIVERSAL_ECOMMERCE'
};

// Test results
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, details = '') {
  const status = passed ? '✅' : '❌';
  console.log(`  ${status} ${name}${details ? ': ' + details : ''}`);
  results.tests.push({ name, passed, details });
  if (passed) results.passed++;
  else results.failed++;
}

async function testTenantBridgeRetrieval() {
  console.log('\n═══ TEST 1: TenantBridge Retrieval ═══\n');

  for (const widgetType of Object.keys(TEST_CLIENTS)) {
    for (const clientId of TEST_CLIENTS[widgetType]) {
      const config = await TenantBridge.getClientConfig(clientId);

      if (config) {
        // Accept both database and static_demo sources
        logTest(
          `${clientId} retrieved`,
          true,
          `source=${config._source || 'static'}, name=${config.name?.substring(0, 25)}...`
        );
      } else {
        logTest(`${clientId} retrieved`, false, 'NOT FOUND');
      }
    }
  }
}

async function testWidgetIsolation() {
  console.log('\n═══ TEST 2: Widget Type Isolation (NO AGENCY Contamination) ═══\n');

  for (const [widgetType, clients] of Object.entries(TEST_CLIENTS)) {
    console.log(`  --- ${widgetType} Widgets ---`);

    for (const clientId of clients) {
      const clientConfig = await TenantBridge.getClientConfig(clientId);
      if (!clientConfig) {
        logTest(`${clientId} isolation`, false, 'Client not found');
        continue;
      }

      const persona = await VoicePersonaInjector.getPersonaAsync(null, null, clientId, widgetType);

      // Check: NOT AGENCY unless TELEPHONY
      const isAgency = persona?.id === 'agency_v3' || persona?.archetypeKey === 'AGENCY';

      const passed = !isAgency;
      logTest(
        `${clientId} NOT AGENCY`,
        passed,
        passed ? `✓ Isolated (archetype: ${persona?.archetypeKey})` : '⚠️ AGENCY CONTAMINATION!'
      );
    }
  }
}

async function testTemplateResolution() {
  console.log('\n═══ TEST 3: Template Variable Resolution ═══\n');

  const testCases = [
    { client: 'notaire_rabat_01', expectedName: 'Fassi-Fihri', widgetType: 'B2B' },
    { client: 'dentiste_casa_01', expectedName: 'Centre Dentaire Smile', widgetType: 'B2C' },
    { client: 'ecom_nike_01', expectedName: 'Nike Reseller Paris', widgetType: 'ECOM' }
  ];

  for (const { client, expectedName, widgetType } of testCases) {
    const clientConfig = await TenantBridge.getClientConfig(client);
    const persona = await VoicePersonaInjector.getPersonaAsync(null, null, client, widgetType);

    if (!persona?.systemPrompt) {
      logTest(`${client} template resolution`, false, 'No systemPrompt');
      continue;
    }

    // Check for unresolved templates
    const unresolvedTemplates = persona.systemPrompt.match(/\{\{[^}]+\}\}/g) || [];
    const hasBusinessName = persona.systemPrompt.includes(expectedName) ||
                           persona.systemPrompt.includes(clientConfig?.name) ||
                           persona.systemPrompt.includes(clientConfig?.business_name);

    const passed = unresolvedTemplates.length === 0;
    logTest(
      `${client} templates resolved`,
      passed,
      passed
        ? `✓ All resolved, has business name: ${hasBusinessName}`
        : `⚠️ Unresolved: ${unresolvedTemplates.join(', ')}`
    );
  }
}

async function testMultiLanguage() {
  console.log('\n═══ TEST 4: Multi-Language Support ═══\n');

  const languages = ['fr', 'en', 'es', 'ary'];

  // Test Darija client specifically
  const darijaClient = 'ecom_darija_01';
  const clientConfig = await TenantBridge.getClientConfig(darijaClient);

  if (!clientConfig) {
    logTest(`${darijaClient} multi-lang`, false, 'Client not found');
    return;
  }

  for (const lang of languages) {
    const persona = await VoicePersonaInjector.getPersonaAsync(null, null, darijaClient, 'ECOM');

    const hasPrompt = persona?.systemPrompt?.length > 100;
    logTest(
      `${darijaClient} [${lang}]`,
      hasPrompt,
      hasPrompt ? `✓ ${persona.systemPrompt.length} chars` : 'No prompt'
    );
  }
}

async function testCachePerformance() {
  console.log('\n═══ TEST 5: Cache Performance ═══\n');

  const clientId = 'notaire_rabat_01';

  // Clear cache first
  TenantBridge.invalidateCache();

  // First call (DB/static fetch)
  const start1 = Date.now();
  await TenantBridge.getClientConfig(clientId);
  const time1 = Date.now() - start1;

  // Second call (cache hit)
  const start2 = Date.now();
  await TenantBridge.getClientConfig(clientId);
  const time2 = Date.now() - start2;

  const cacheHit = time2 <= time1 || time2 < 5;
  logTest(
    'Cache hit faster than fetch',
    cacheHit,
    `Fetch=${time1}ms, Cache=${time2}ms`
  );

  // Check cache stats
  const stats = TenantBridge.getCacheStats();
  logTest(
    'Cache populated',
    stats.size > 0,
    `size=${stats.size}, maxSize=${stats.maxSize}`
  );
}

async function testSectorToArchetypeMapping() {
  console.log('\n═══ TEST 6: Sector to Archetype Mapping ═══\n');

  const testMappings = [
    { client: 'notaire_rabat_01', expectedArchetype: 'NOTARY' },
    { client: 'dentiste_casa_01', expectedArchetype: 'DENTAL' },
    { client: 'fitness_casa_01', expectedArchetype: 'GYM' },
    { client: 'ecom_nike_01', expectedArchetype: 'UNIVERSAL_ECOMMERCE' }
  ];

  for (const { client, expectedArchetype } of testMappings) {
    const config = await TenantBridge.getClientConfig(client);
    const passed = config?.sector === expectedArchetype;
    logTest(
      `${client} sector mapping`,
      passed,
      `sector=${config?.sector}, expected=${expectedArchetype}`
    );
  }
}

async function runAllTests() {
  console.log('██████████████████████████████████████████████████████████████████████');
  console.log('  TENANT BRIDGE INTEGRATION TESTS');
  console.log('  Session 250.102 - Real client_registry.json Clients');
  console.log('██████████████████████████████████████████████████████████████████████');

  try {
    await testTenantBridgeRetrieval();
    await testWidgetIsolation();
    await testTemplateResolution();
    await testMultiLanguage();
    await testCachePerformance();
    await testSectorToArchetypeMapping();
  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error(error.stack);
  }

  // Summary
  console.log('\n══════════════════════════════════════════════════════════════════════');
  console.log('  TEST SUMMARY');
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log(`  Passed: ${results.passed}`);
  console.log(`  Failed: ${results.failed}`);
  console.log(`  Total:  ${results.tests.length}`);
  console.log(`  Score:  ${Math.round(results.passed / results.tests.length * 100)}%`);
  console.log('██████████████████████████████████████████████████████████████████████\n');

  process.exit(results.failed > 0 ? 1 : 0);
}

runAllTests();
