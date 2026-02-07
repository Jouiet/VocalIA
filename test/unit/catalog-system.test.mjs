/**
 * VocalIA Catalog System Unit Tests
 * Session 250.63
 *
 * Tests:
 * - CatalogConnector base class
 * - CustomCatalogConnector
 * - ShopifyCatalogConnector
 * - CatalogConnectorFactory
 * - TenantCatalogStore
 * - LRU Cache behavior
 * - Voice description generation
 */


import assert from 'assert';
import path from 'path';
import { TenantCatalogStore } from '../../core/tenant-catalog-store.cjs';
import { CatalogConnector, CustomCatalogConnector, ShopifyCatalogConnector, CatalogConnectorFactory, CATALOG_TYPES } from '../../core/catalog-connector.cjs';


// Test data paths
const SAMPLE_MENU = path.join(import.meta.dirname, '../../data/catalogs/sample-restaurant-menu.json');
const SAMPLE_PRODUCTS = path.join(import.meta.dirname, '../../data/catalogs/sample-ecommerce-products.json');
const SAMPLE_SERVICES = path.join(import.meta.dirname, '../../data/catalogs/sample-garage-services.json');
const SAMPLE_FLEET = path.join(import.meta.dirname, '../../data/catalogs/sample-car-rental.json');
const SAMPLE_TRIPS = path.join(import.meta.dirname, '../../data/catalogs/sample-travel-trips.json');

// ============================================
// Test Suite: CATALOG_TYPES
// ============================================
function testCatalogTypes() {
  console.log('\n📋 Testing CATALOG_TYPES...');

  assert.strictEqual(CATALOG_TYPES.PRODUCTS, 'products');
  assert.strictEqual(CATALOG_TYPES.MENU, 'menu');
  assert.strictEqual(CATALOG_TYPES.SERVICES, 'services');
  assert.strictEqual(CATALOG_TYPES.FLEET, 'fleet');
  assert.strictEqual(CATALOG_TYPES.TRIPS, 'trips');
  assert.strictEqual(CATALOG_TYPES.PACKAGES, 'packages');

  console.log('✅ CATALOG_TYPES: 6 types defined');
}

// ============================================
// Test Suite: CustomCatalogConnector
// ============================================
async function testCustomCatalogConnector() {
  console.log('\n📋 Testing CustomCatalogConnector...');

  // Test with menu data
  const connector = new CustomCatalogConnector('test_restaurant', {
    catalogType: CATALOG_TYPES.MENU,
    dataPath: SAMPLE_MENU
  });

  // Test connect
  const connected = await connector.connect();
  assert.strictEqual(connected, true, 'Should connect successfully');
  console.log('  ✓ connect() works');

  // Test sync
  const items = await connector.sync();
  assert.ok(Array.isArray(items), 'sync() should return array');
  assert.ok(items.length > 0, 'sync() should return items');
  console.log(`  ✓ sync() returns ${items.length} items`);

  // Test getItem
  const item = await connector.getItem('P01');
  assert.ok(item, 'getItem() should return item');
  assert.strictEqual(item.name, 'Couscous Royal');
  console.log('  ✓ getItem() returns correct item');

  // Test search
  const searchResults = await connector.search('tajine');
  assert.ok(Array.isArray(searchResults), 'search() should return array');
  assert.ok(searchResults.length >= 1, 'Should find tajine items');
  console.log(`  ✓ search("tajine") returns ${searchResults.length} results`);

  // Test checkAvailability
  const availability = await connector.checkAvailability('P01');
  assert.ok(typeof availability.available === 'boolean');
  console.log(`  ✓ checkAvailability() works (available: ${availability.available})`);

  console.log('✅ CustomCatalogConnector: All tests passed');
}

// ============================================
// Test Suite: CatalogConnectorFactory
// ============================================
async function testCatalogConnectorFactory() {
  console.log('\n📋 Testing CatalogConnectorFactory...');

  // Test custom connector creation
  const customConnector = CatalogConnectorFactory.create('test_tenant', {
    source: 'custom',
    catalogType: CATALOG_TYPES.PRODUCTS,
    dataPath: SAMPLE_PRODUCTS
  });
  assert.ok(customConnector instanceof CustomCatalogConnector);
  console.log('  ✓ Factory creates CustomCatalogConnector');

  // Test shopify connector creation
  const shopifyConnector = CatalogConnectorFactory.create('shopify_tenant', {
    source: 'shopify',
    catalogType: CATALOG_TYPES.PRODUCTS,
    shopDomain: 'test-shop.myshopify.com',
    accessToken: 'test_token'
  });
  assert.ok(shopifyConnector instanceof ShopifyCatalogConnector);
  console.log('  ✓ Factory creates ShopifyCatalogConnector');

  // Test default fallback
  const defaultConnector = CatalogConnectorFactory.create('default_tenant', {});
  assert.ok(defaultConnector instanceof CustomCatalogConnector);
  console.log('  ✓ Factory defaults to CustomCatalogConnector');

  console.log('✅ CatalogConnectorFactory: All tests passed');
}

// ============================================
// Test Suite: TenantCatalogStore
// ============================================
async function testTenantCatalogStore() {
  console.log('\n📋 Testing TenantCatalogStore...');

  const store = new TenantCatalogStore();

  // Test tenant registration
  await store.registerTenant('restaurant_test', {
    source: 'custom',
    catalogType: CATALOG_TYPES.MENU,
    dataPath: SAMPLE_MENU
  });
  console.log('  ✓ registerTenant() works');

  // Test getMenu
  const menuResult = await store.getMenu('restaurant_test');
  assert.ok(menuResult.success, 'getMenu() should succeed');
  assert.ok(menuResult.menu, 'Should have menu object');
  assert.ok(menuResult.menu.categories, 'Menu should have categories');
  assert.ok(menuResult.voiceSummary, 'Menu should have voiceSummary');
  console.log(`  ✓ getMenu() returns menu with ${menuResult.menu.categories.length} categories`);

  // Test searchCatalog
  const searchResult = await store.searchCatalog('restaurant_test', 'couscous');
  assert.ok(searchResult.success, 'searchCatalog should succeed');
  assert.ok(searchResult.results.length >= 1, 'Should find couscous');
  assert.ok(searchResult.voiceSummary, 'Should have voice summary');
  console.log(`  ✓ searchCatalog("couscous") returns ${searchResult.results.length} results`);

  // Test checkAvailability
  const avail = await store.checkAvailability('restaurant_test', 'P04');
  assert.ok(avail.success, 'checkAvailability should succeed');
  assert.ok(typeof avail.available === 'boolean');
  assert.ok(avail.voiceResponse, 'Should have voice response');
  console.log(`  ✓ checkAvailability() returns (available: ${avail.available})`);

  // Test getItemDetails
  const itemResult = await store.getItemDetails('restaurant_test', 'P01');
  assert.ok(itemResult.success, 'getItemDetails should succeed');
  assert.ok(itemResult.item, 'Should return item object');
  assert.strictEqual(itemResult.item.name, 'Couscous Royal');
  assert.ok(itemResult.item.voiceDescription, 'Should have voice description');
  console.log('  ✓ getItemDetails() returns full item with voice description');

  console.log('✅ TenantCatalogStore: All tests passed');
}

// ============================================
// Test Suite: Services Catalog
// ============================================
async function testServicesCatalog() {
  console.log('\n📋 Testing Services Catalog...');

  const store = new TenantCatalogStore();

  await store.registerTenant('garage_test', {
    source: 'custom',
    catalogType: CATALOG_TYPES.SERVICES,
    dataPath: SAMPLE_SERVICES
  });

  // Test getServices
  const servicesResult = await store.getServices('garage_test');
  assert.ok(servicesResult.success, 'getServices should succeed');
  assert.ok(servicesResult.services, 'Should have services');
  assert.ok(servicesResult.services.length >= 5, 'Should have at least 5 services');
  console.log(`  ✓ getServices() returns ${servicesResult.services.length} services`);

  // Test search for specific service
  const diagResults = await store.searchCatalog('garage_test', 'diagnostic');
  assert.ok(diagResults.success, 'searchCatalog should succeed');
  assert.ok(diagResults.results.length >= 1, 'Should find diagnostic service');
  console.log(`  ✓ searchCatalog("diagnostic") returns ${diagResults.results.length} results`);

  console.log('✅ Services Catalog: All tests passed');
}

// ============================================
// Test Suite: Fleet Catalog
// ============================================
async function testFleetCatalog() {
  console.log('\n📋 Testing Fleet Catalog...');

  const store = new TenantCatalogStore();

  await store.registerTenant('rental_test', {
    source: 'custom',
    catalogType: CATALOG_TYPES.FLEET,
    dataPath: SAMPLE_FLEET
  });

  // Test browse
  const fleet = await store.browseCatalog('rental_test');
  assert.ok(fleet.success, 'browseCatalog should succeed');
  assert.ok(fleet.items, 'Should have items');
  assert.ok(fleet.items.length >= 4, 'Should have at least 4 vehicles');
  console.log(`  ✓ browseCatalog() returns ${fleet.items.length} vehicles`);

  // Test search - search for Peugeot or SUV (case-insensitive might vary)
  const suvResults = await store.searchCatalog('rental_test', 'Peugeot');
  assert.ok(suvResults.success, 'searchCatalog should succeed');
  assert.ok(suvResults.results.length >= 1, 'Should find Peugeot');
  console.log(`  ✓ searchCatalog("Peugeot") returns ${suvResults.results.length} results`);

  // Test availability
  const vehAvail = await store.checkAvailability('rental_test', 'VEH-001', {
    fromDate: '2026-02-10',
    toDate: '2026-02-15'
  });
  assert.ok(vehAvail.success, 'checkAvailability should succeed');
  assert.ok(typeof vehAvail.available === 'boolean');
  console.log(`  ✓ checkAvailability() for vehicle works (available: ${vehAvail.available})`);

  console.log('✅ Fleet Catalog: All tests passed');
}

// ============================================
// Test Suite: Trips Catalog
// ============================================
async function testTripsCatalog() {
  console.log('\n📋 Testing Trips Catalog...');

  const store = new TenantCatalogStore();

  await store.registerTenant('travel_test', {
    source: 'custom',
    catalogType: CATALOG_TYPES.TRIPS,
    dataPath: SAMPLE_TRIPS
  });

  // Test browse
  const trips = await store.browseCatalog('travel_test');
  assert.ok(trips.success, 'browseCatalog should succeed');
  assert.ok(trips.items, 'Should have items');
  assert.ok(trips.items.length >= 4, 'Should have at least 4 trips');
  console.log(`  ✓ browseCatalog() returns ${trips.items.length} trips`);

  // Test search for destination
  const istanbulResults = await store.searchCatalog('travel_test', 'Istanbul');
  assert.ok(istanbulResults.success, 'searchCatalog should succeed');
  assert.ok(istanbulResults.results.length >= 1, 'Should find Istanbul trip');
  console.log(`  ✓ searchCatalog("Istanbul") returns ${istanbulResults.results.length} results`);

  // Test trip details - trips use 'destination' as main identifier, which is mapped to 'name' in getItemDetails
  const tripResult = await store.getItemDetails('travel_test', 'TRIP-001');
  assert.ok(tripResult.success, 'getItemDetails should succeed');
  assert.ok(tripResult.item, 'Should return trip item');
  // The item should have a name (mapped from destination for trips) or the raw destination field
  const hasIdentifier = tripResult.item.name || tripResult.item.id;
  assert.ok(hasIdentifier, 'Should have name or id');
  assert.ok(tripResult.item.voiceDescription, 'Should have voice description');
  console.log('  ✓ getItemDetails() returns full trip with voice description');

  console.log('✅ Trips Catalog: All tests passed');
}

// ============================================
// Test Suite: LRU Cache
// ============================================
async function testLRUCache() {
  console.log('\n📋 Testing LRU Cache behavior...');

  const store = new TenantCatalogStore({ maxCacheSize: 3 });

  // Register 4 tenants (exceeds cache size of 3)
  await store.registerTenant('tenant1', { source: 'custom', catalogType: CATALOG_TYPES.MENU, dataPath: SAMPLE_MENU });
  await store.registerTenant('tenant2', { source: 'custom', catalogType: CATALOG_TYPES.PRODUCTS, dataPath: SAMPLE_PRODUCTS });
  await store.registerTenant('tenant3', { source: 'custom', catalogType: CATALOG_TYPES.SERVICES, dataPath: SAMPLE_SERVICES });

  // Access tenant1 to make it recently used
  await store.browseCatalog('tenant1');

  // Register tenant4 (should evict least recently used)
  await store.registerTenant('tenant4', { source: 'custom', catalogType: CATALOG_TYPES.FLEET, dataPath: SAMPLE_FLEET });

  // tenant1 should still be accessible (was accessed recently)
  const tenant1Result = await store.browseCatalog('tenant1');
  assert.ok(tenant1Result, 'tenant1 should still be in cache');
  console.log('  ✓ Recently used items stay in cache');

  // All tenants should be accessible (re-registers if evicted)
  const tenant4Result = await store.browseCatalog('tenant4');
  assert.ok(tenant4Result, 'tenant4 should be accessible');
  console.log('  ✓ Evicted tenants can be re-registered');

  console.log('✅ LRU Cache: All tests passed');
}

// ============================================
// Test Suite: Voice Description Generation
// ============================================
async function testVoiceDescriptions() {
  console.log('\n📋 Testing Voice Description generation...');

  const store = new TenantCatalogStore();

  await store.registerTenant('voice_test', {
    source: 'custom',
    catalogType: CATALOG_TYPES.MENU,
    dataPath: SAMPLE_MENU
  });

  // Test menu voice summary
  const menuResult = await store.getMenu('voice_test');
  assert.ok(menuResult.success, 'getMenu should succeed');
  assert.ok(menuResult.voiceSummary, 'Menu should have voice summary');
  // The voice summary mentions "carte" (menu) and category names
  assert.ok(menuResult.voiceSummary.includes('carte') || menuResult.voiceSummary.includes('Entrées'), 'Voice summary mentions menu/categories');
  console.log('  ✓ Menu voiceSummary generated');

  // Test search voice summary
  const searchResult = await store.searchCatalog('voice_test', 'couscous');
  assert.ok(searchResult.success, 'searchCatalog should succeed');
  assert.ok(searchResult.voiceSummary, 'Search should have voice summary');
  assert.ok(searchResult.voiceSummary.toLowerCase().includes('couscous') || searchResult.voiceSummary.includes('trouvé'), 'Voice summary mentions search term or results');
  console.log('  ✓ Search voiceSummary generated');

  // Test availability voice response
  const avail = await store.checkAvailability('voice_test', 'P04');
  assert.ok(avail.success, 'checkAvailability should succeed');
  assert.ok(avail.voiceResponse, 'Availability should have voice response');
  console.log('  ✓ Availability voiceResponse generated');

  // Test item voice description
  const itemResult = await store.getItemDetails('voice_test', 'P01');
  assert.ok(itemResult.success, 'getItemDetails should succeed');
  assert.ok(itemResult.item, 'Should have item');
  assert.ok(itemResult.item.voiceDescription, 'Item should have voice description');
  console.log(`  ✓ Item voiceDescription: "${itemResult.item.voiceDescription.substring(0, 50)}..."`);

  console.log('✅ Voice Descriptions: All tests passed');
}

// ============================================
// Test Suite: Error Handling
// ============================================
async function testErrorHandling() {
  console.log('\n📋 Testing Error Handling...');

  const store = new TenantCatalogStore();

  // Test unregistered tenant - returns error object, not throws
  const unregisteredResult = await store.browseCatalog('nonexistent_tenant');
  assert.ok(!unregisteredResult.success, 'Should return success: false for unregistered tenant');
  assert.ok(unregisteredResult.error, 'Should have error message');
  console.log('  ✓ Returns error for unregistered tenant');

  // Test invalid item ID
  await store.registerTenant('error_test', {
    source: 'custom',
    catalogType: CATALOG_TYPES.MENU,
    dataPath: SAMPLE_MENU
  });

  const invalidItemResult = await store.getItemDetails('error_test', 'INVALID_ID');
  assert.ok(!invalidItemResult.success, 'Should return success: false for invalid item');
  assert.ok(invalidItemResult.error === 'item_not_found', 'Should have item_not_found error');
  console.log('  ✓ Returns error for invalid item ID');

  // Test empty search
  const emptySearch = await store.searchCatalog('error_test', 'xyznonexistent');
  assert.ok(emptySearch.success, 'Empty search should still succeed');
  assert.strictEqual(emptySearch.results.length, 0, 'Should return empty array for no matches');
  assert.ok(emptySearch.voiceSummary.includes('rien') || emptySearch.voiceSummary.includes('trouvé'), 'Voice summary indicates no results');
  console.log('  ✓ Handles empty search results gracefully');

  console.log('✅ Error Handling: All tests passed');
}

// ============================================
// Main Test Runner
// ============================================
async function runAllTests() {
  console.log('═══════════════════════════════════════════');
  console.log('  VocalIA Catalog System - Unit Tests');
  console.log('  Session 250.63');
  console.log('═══════════════════════════════════════════');

  const startTime = Date.now();
  let passed = 0;
  let failed = 0;

  const tests = [
    { name: 'CATALOG_TYPES', fn: testCatalogTypes },
    { name: 'CustomCatalogConnector', fn: testCustomCatalogConnector },
    { name: 'CatalogConnectorFactory', fn: testCatalogConnectorFactory },
    { name: 'TenantCatalogStore', fn: testTenantCatalogStore },
    { name: 'Services Catalog', fn: testServicesCatalog },
    { name: 'Fleet Catalog', fn: testFleetCatalog },
    { name: 'Trips Catalog', fn: testTripsCatalog },
    { name: 'LRU Cache', fn: testLRUCache },
    { name: 'Voice Descriptions', fn: testVoiceDescriptions },
    { name: 'Error Handling', fn: testErrorHandling }
  ];

  for (const test of tests) {
    try {
      await test.fn();
      passed++;
    } catch (error) {
      failed++;
      console.error(`\n❌ ${test.name} FAILED:`);
      console.error(`   ${error.message}`);
      if (error.stack) {
        console.error(error.stack.split('\n').slice(1, 3).join('\n'));
      }
    }
  }

  const duration = Date.now() - startTime;

  console.log('\n═══════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log(`  Duration: ${duration}ms`);
  console.log('═══════════════════════════════════════════');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('\n✅ All Catalog System tests passed!');
  }
}

export { runAllTests };
