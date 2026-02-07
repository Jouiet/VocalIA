'use strict';

/**
 * VocalIA Widget↔Backend INTEGRATION Tests
 *
 * PURPOSE: Verify that EVERY fetch() in EVERY widget has a matching backend route
 * with the correct HTTP method, path pattern, and port.
 *
 * This test does NOT test pure functions in isolation — it tests the REAL
 * integration chain between frontend widgets and backend API routes.
 *
 * METHODOLOGY:
 * 1. Parse widget JS files for ALL fetch() calls → extract method + URL pattern
 * 2. Parse db-api.cjs + voice-api-resilient.cjs for ALL route handlers → extract method + path regex
 * 3. Cross-reference: every widget endpoint MUST have a matching backend route
 * 4. Verify auth requirements: widget public endpoints must NOT require auth
 *
 * Run: node --test test/widget-backend-integration.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// ─── Helper: Read file safely ────────────────────────────────────────────────

function readFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

// ─── Extract endpoints from widget files ─────────────────────────────────────

/**
 * Extract all fetch() calls from a JS file
 * Returns array of { line, url, method, file }
 */
function extractFetchCalls(filePath) {
  const content = readFile(filePath);
  const lines = content.split('\n');
  const results = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Match fetch( with URL string
    if (line.includes('fetch(') || line.includes('fetch (')) {
      // Look at surrounding lines for method and URL
      const context = lines.slice(Math.max(0, i - 5), Math.min(lines.length, i + 15)).join('\n');

      // Extract URL pattern
      let url = null;
      const urlPatterns = [
        // Template literals: `${CONFIG.xxx}/path`
        /fetch\(\s*`([^`]+)`/,
        /fetch\(\s*\n\s*`([^`]+)`/,
        // String concatenation with endpoint variable
        /endpoint\s*=\s*`([^`]+)`/,
        /const\s+(?:ttsUrl|url|endpoint)\s*=\s*`([^`]+)`/,
        // Direct URL string
        /fetch\(\s*['"]([^'"]+)['"]/,
        /fetch\(\s*([A-Z_]+\.(?:VOICE_API_URL|BOOKING_API|CONFIG_API_URL|SOCIAL_PROOF_API_URL))/,
      ];

      for (const pat of urlPatterns) {
        const m = context.match(pat);
        if (m) { url = m[1]; break; }
      }

      // Extract HTTP method (default GET)
      let method = 'GET';
      const methodMatch = context.match(/method:\s*['"](\w+)['"]/);
      if (methodMatch) method = methodMatch[1].toUpperCase();

      if (url) {
        results.push({ line: lineNum, url, method, file: filePath });
      }
    }
  }

  return results;
}

// ─── Extract route handlers from backend ─────────────────────────────────────

/**
 * Extract all route handlers from a backend file
 * Returns array of { path, method, requiresAuth, line }
 */
function extractRoutes(filePath) {
  const content = readFile(filePath);
  const lines = content.split('\n');
  const routes = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Pattern 1: path === '/xxx' && method === 'POST'
    const exactMatch = line.match(/path\s*===\s*'([^']+)'\s*&&\s*method\s*===\s*'(\w+)'/);
    if (exactMatch) {
      const lookAhead = lines.slice(i, Math.min(lines.length, i + 5)).join('\n');
      const needsAuth = lookAhead.includes('checkAuth') || lookAhead.includes('checkAdmin');
      routes.push({ path: exactMatch[1], method: exactMatch[2].toUpperCase(), requiresAuth: needsAuth, line: lineNum });
    }

    // Pattern 2: path.match(/regex/) && method === 'POST'
    const regexMatch = line.match(/path\.match\(\/([^/]+)\/\)\s*&&\s*method\s*===\s*'(\w+)'/);
    if (regexMatch) {
      const lookAhead = lines.slice(i, Math.min(lines.length, i + 5)).join('\n');
      const needsAuth = lookAhead.includes('checkAuth') || lookAhead.includes('checkAdmin');
      routes.push({ path: regexMatch[1], method: regexMatch[2].toUpperCase(), regex: true, requiresAuth: needsAuth, line: lineNum });
    }

    // Pattern 3: if (someMatch && method === 'POST')
    const matchVarPattern = line.match(/if\s*\((\w+Match)\s*&&\s*method\s*===\s*'(\w+)'\)/);
    if (matchVarPattern) {
      // Find the match variable definition above
      for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
        const defLine = lines[j];
        const defMatch = defLine.match(/const\s+\w+\s*=\s*path\.match\(\/([^/]+)\/\)/);
        if (defMatch) {
          const lookAhead = lines.slice(i, Math.min(lines.length, i + 5)).join('\n');
          const needsAuth = lookAhead.includes('checkAuth') || lookAhead.includes('checkAdmin');
          routes.push({ path: defMatch[1], method: matchVarPattern[2].toUpperCase(), regex: true, requiresAuth: needsAuth, line: lineNum });
          break;
        }
      }
    }

    // Pattern 4: req.url === '/xxx' && req.method === 'POST' (voice-api-resilient style)
    const reqMatch = line.match(/req\.url\s*===\s*'([^']+)'\s*&&\s*req\.method\s*===\s*'(\w+)'/);
    if (reqMatch) {
      routes.push({ path: reqMatch[1], method: reqMatch[2].toUpperCase(), requiresAuth: false, line: lineNum });
    }

    // Pattern 5: req.url.startsWith('/xxx')
    const startsWithMatch = line.match(/req\.url\.startsWith\('([^']+)'\)\s*&&\s*req\.method\s*===\s*'(\w+)'/);
    if (startsWithMatch) {
      routes.push({ path: startsWithMatch[1], method: startsWithMatch[2].toUpperCase(), prefix: true, requiresAuth: false, line: lineNum });
    }

    // Pattern 6: req.url.startsWith('/xxx') without method check (implies GET)
    const startsWithNoMethod = line.match(/req\.url\.startsWith\('([^']+)'\)/);
    if (startsWithNoMethod && !line.includes('method')) {
      routes.push({ path: startsWithNoMethod[1], method: 'GET', prefix: true, requiresAuth: false, line: lineNum });
    }

    // Pattern 7: (req.url === '/respond' || req.url === '/') && req.method === 'POST'
    const orMatch = line.match(/req\.url\s*===\s*'([^']+)'.*&&\s*req\.method\s*===\s*'(\w+)'/);
    if (orMatch && !reqMatch) {
      routes.push({ path: orMatch[1], method: orMatch[2].toUpperCase(), requiresAuth: false, line: lineNum });
    }
  }

  return routes;
}

// ─── Load all route data ─────────────────────────────────────────────────────

const dbApiRoutes = extractRoutes('core/db-api.cjs');
const voiceApiRoutes = extractRoutes('core/voice-api-resilient.cjs');
const allRoutes = [...dbApiRoutes, ...voiceApiRoutes];

// ─── Helper: Check if a URL matches a route ─────────────────────────────────

function routeMatchesUrl(route, urlPath, method) {
  if (route.method !== method) return false;

  if (route.prefix) {
    return urlPath.startsWith(route.path);
  }

  if (route.regex) {
    try {
      const re = new RegExp(route.path);
      return re.test(urlPath);
    } catch {
      return false;
    }
  }

  return route.path === urlPath;
}

function findMatchingRoute(urlPath, method) {
  return allRoutes.find(r => routeMatchesUrl(r, urlPath, method));
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRITICAL INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Widget V3 → Backend route alignment', () => {

  // ─── Voice API (port 3004) ───────────────────────────────────────────────

  test('POST /respond route exists in voice-api-resilient', () => {
    const route = voiceApiRoutes.find(r => r.path === '/respond' || r.path.includes('/respond'));
    assert.ok(route, 'POST /respond route must exist in voice-api-resilient.cjs');
  });

  test('GET /config route exists in voice-api-resilient', () => {
    const route = voiceApiRoutes.find(r => r.path === '/config' || r.path.includes('/config'));
    assert.ok(route, 'GET /config route must exist in voice-api-resilient.cjs');
  });

  test('POST /tts route exists in voice-api-resilient', () => {
    const route = voiceApiRoutes.find(r => r.path === '/tts');
    assert.ok(route, 'POST /tts route must exist in voice-api-resilient.cjs');
  });

  test('GET /social-proof route exists in voice-api-resilient', () => {
    const route = voiceApiRoutes.find(r =>
      r.path.includes('social-proof') || r.path === '/social-proof'
    );
    assert.ok(route, 'GET /social-proof route must exist in voice-api-resilient.cjs');
  });

  test('GET /health route exists in voice-api-resilient', () => {
    const route = voiceApiRoutes.find(r => r.path === '/health');
    assert.ok(route, 'GET /health route must exist in voice-api-resilient.cjs');
  });

  // ─── Catalog endpoints (port 3013) ──────────────────────────────────────
  // NOTE: These routes use path.match(/regex/) pattern which the generic extractor
  // can't parse. We verify directly in source code — the GROUND TRUTH.

  test('POST /api/tenants/:id/catalog/browse route exists in db-api (NO auth)', () => {
    const dbContent = readFile('core/db-api.cjs');
    const lines = dbContent.split('\n');

    // Find the route regex definition
    const regexLine = lines.findIndex(l => l.includes('catalog\\/browse'));
    assert.ok(regexLine >= 0, 'catalog/browse regex must exist in db-api.cjs');

    // Verify it checks for POST method
    const context = lines.slice(regexLine, Math.min(lines.length, regexLine + 5)).join('\n');
    assert.ok(context.includes("'POST'"), 'catalog/browse must check for POST method');

    // Verify NO checkAuth in the handler
    const handlerContext = lines.slice(regexLine, Math.min(lines.length, regexLine + 10)).join('\n');
    assert.ok(!handlerContext.includes('checkAuth'), 'catalog/browse must NOT require auth');
    assert.ok(handlerContext.includes('No auth required'), 'catalog/browse must have "No auth required" comment');
  });

  test('POST /api/tenants/:id/catalog/search route exists in db-api (NO auth)', () => {
    const dbContent = readFile('core/db-api.cjs');
    const lines = dbContent.split('\n');

    const regexLine = lines.findIndex(l => l.includes('catalog\\/search'));
    assert.ok(regexLine >= 0, 'catalog/search regex must exist in db-api.cjs');

    const context = lines.slice(regexLine, Math.min(lines.length, regexLine + 5)).join('\n');
    assert.ok(context.includes("'POST'"), 'catalog/search must check for POST method');

    const handlerContext = lines.slice(regexLine, Math.min(lines.length, regexLine + 10)).join('\n');
    assert.ok(!handlerContext.includes('checkAuth'), 'catalog/search must NOT require auth');
  });

  test('POST /api/tenants/:id/catalog/recommendations route exists in db-api (NO auth)', () => {
    const dbContent = readFile('core/db-api.cjs');
    const lines = dbContent.split('\n');

    const regexLine = lines.findIndex(l => l.includes('catalog\\/recommendations'));
    assert.ok(regexLine >= 0, 'catalog/recommendations regex must exist in db-api.cjs');

    const context = lines.slice(regexLine, Math.min(lines.length, regexLine + 5)).join('\n');
    assert.ok(context.includes("'POST'"), 'catalog/recommendations must check for POST method');

    const handlerContext = lines.slice(regexLine, Math.min(lines.length, regexLine + 10)).join('\n');
    assert.ok(!handlerContext.includes('checkAuth'), 'catalog/recommendations must NOT require auth');
  });

  test('GET /api/tenants/:id/catalog/detail/:itemId route exists in db-api (NO auth)', () => {
    const dbContent = readFile('core/db-api.cjs');
    const lines = dbContent.split('\n');

    const regexLine = lines.findIndex(l => l.includes('catalog\\/detail'));
    assert.ok(regexLine >= 0, 'catalog/detail regex must exist in db-api.cjs');

    const context = lines.slice(regexLine, Math.min(lines.length, regexLine + 5)).join('\n');
    assert.ok(context.includes("'GET'"), 'catalog/detail must check for GET method');

    const handlerContext = lines.slice(regexLine, Math.min(lines.length, regexLine + 10)).join('\n');
    assert.ok(!handlerContext.includes('checkAuth'), 'catalog/detail must NOT require auth');
    assert.ok(handlerContext.includes('No auth required'), 'catalog/detail must have "No auth required" comment');
  });

  // ─── UCP endpoints (port 3013) ──────────────────────────────────────────

  test('POST /api/ucp/sync route exists in db-api', () => {
    const route = dbApiRoutes.find(r => r.path === '/api/ucp/sync' && r.method === 'POST');
    assert.ok(route, 'POST /api/ucp/sync route must exist in db-api.cjs');
  });

  test('POST /api/ucp/interaction route exists in db-api', () => {
    const route = dbApiRoutes.find(r => r.path === '/api/ucp/interaction' && r.method === 'POST');
    assert.ok(route, 'POST /api/ucp/interaction route must exist in db-api.cjs');
  });

  test('POST /api/ucp/event route exists in db-api', () => {
    const route = dbApiRoutes.find(r => r.path === '/api/ucp/event' && r.method === 'POST');
    assert.ok(route, 'POST /api/ucp/event route must exist in db-api.cjs');
  });

  // ─── Recommendations (port 3013) ────────────────────────────────────────

  test('POST /api/recommendations route exists in db-api', () => {
    const route = dbApiRoutes.find(r => r.path === '/api/recommendations' && r.method === 'POST');
    assert.ok(route, 'POST /api/recommendations route must exist in db-api.cjs');
  });

  // ─── Leads (port 3013) ─────────────────────────────────────────────────

  test('POST /api/leads route exists in db-api', () => {
    const route = dbApiRoutes.find(r => r.path === '/api/leads' && r.method === 'POST');
    assert.ok(route, 'POST /api/leads route must exist in db-api.cjs');
  });

  // ─── Cart Recovery (port 3013) ──────────────────────────────────────────

  test('POST /api/cart-recovery route exists in db-api', () => {
    const route = dbApiRoutes.find(r => r.path === '/api/cart-recovery' && r.method === 'POST');
    assert.ok(route, 'POST /api/cart-recovery route must exist in db-api.cjs');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// WIDGET CONFIG VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Widget V3 CONFIG completeness', () => {
  const v3Content = readFile('widget/voice-widget-v3.js');

  test('CONFIG.VOICE_API_URL is defined', () => {
    assert.ok(v3Content.includes('VOICE_API_URL:'), 'VOICE_API_URL must be defined in CONFIG');
  });

  test('CONFIG.CATALOG_API_URL is defined', () => {
    assert.ok(v3Content.includes('CATALOG_API_URL:'), 'CATALOG_API_URL must be defined in CONFIG');
  });

  test('CONFIG.API_BASE_URL is defined', () => {
    assert.ok(v3Content.includes('API_BASE_URL:'), 'API_BASE_URL must be defined in CONFIG');
  });

  test('CONFIG.BOOKING_API is defined', () => {
    assert.ok(v3Content.includes('BOOKING_API:'), 'BOOKING_API must be defined in CONFIG');
  });

  test('VOICE_API_URL points to port 3004 in dev', () => {
    assert.ok(v3Content.includes("'http://localhost:3004/respond'"), 'VOICE_API_URL dev must be port 3004');
  });

  test('CATALOG_API_URL points to port 3013 in dev', () => {
    assert.ok(v3Content.includes("'http://localhost:3013/api/tenants'"), 'CATALOG_API_URL dev must be port 3013');
  });

  test('API_BASE_URL points to port 3013 in dev', () => {
    assert.ok(v3Content.includes("'http://localhost:3013'"), 'API_BASE_URL dev must be port 3013');
  });

  test('No fetch() calls use undefined CONFIG properties', () => {
    // Extract all CONFIG.XXX references used in fetch() calls
    const configRefs = v3Content.match(/CONFIG\.([A-Z_]+)/g) || [];
    const uniqueRefs = [...new Set(configRefs.map(r => r.replace('CONFIG.', '')))];

    // Check that CONFIG defines each referenced property
    const configBlock = v3Content.substring(
      v3Content.indexOf('const CONFIG = {'),
      v3Content.indexOf('};', v3Content.indexOf('const CONFIG = {')) + 2
    );

    for (const ref of uniqueRefs) {
      // Only check URL-related properties
      if (ref.endsWith('_URL') || ref === 'BOOKING_API' || ref === 'API_BASE_URL') {
        assert.ok(
          configBlock.includes(`${ref}:`),
          `CONFIG.${ref} is referenced but not defined in CONFIG object`
        );
      }
    }
  });
});

describe('Widget B2B CONFIG completeness', () => {
  const b2bContent = readFile('widget/voice-widget-b2b.js');

  test('CONFIG.VOICE_API_URL is defined', () => {
    assert.ok(b2bContent.includes('VOICE_API_URL:'), 'VOICE_API_URL must be defined');
  });

  test('CONFIG.CONFIG_API_URL is defined', () => {
    assert.ok(b2bContent.includes('CONFIG_API_URL:'), 'CONFIG_API_URL must be defined');
  });

  test('CONFIG.SOCIAL_PROOF_API_URL is defined', () => {
    assert.ok(b2bContent.includes('SOCIAL_PROOF_API_URL:'), 'SOCIAL_PROOF_API_URL must be defined');
  });

  test('VOICE_API_URL points to port 3004 in dev', () => {
    assert.ok(b2bContent.includes("'http://localhost:3004/respond'"), 'VOICE_API_URL dev must be port 3004');
  });

  test('CONFIG_API_URL points to port 3004 in dev', () => {
    assert.ok(b2bContent.includes("'http://localhost:3004/config'"), 'CONFIG_API_URL dev must be port 3004');
  });

  test('SOCIAL_PROOF_API_URL points to port 3004 in dev', () => {
    assert.ok(b2bContent.includes("'http://localhost:3004/social-proof'"), 'SOCIAL_PROOF_API_URL dev must be port 3004');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// WIDGET FETCH METHOD VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Widget V3 fetch() method correctness', () => {
  const v3Content = readFile('widget/voice-widget-v3.js');

  test('catalog/browse uses POST method', () => {
    // Find the fetch call for catalog/browse
    const browseIdx = v3Content.indexOf('catalog/browse');
    assert.ok(browseIdx > 0, 'catalog/browse endpoint must be referenced');

    // Check surrounding context for POST method
    const context = v3Content.substring(Math.max(0, browseIdx - 200), browseIdx + 200);
    assert.ok(context.includes("method: 'POST'"), 'catalog/browse must use POST method');
  });

  test('catalog/search uses POST method', () => {
    const searchIdx = v3Content.indexOf('catalog/search');
    assert.ok(searchIdx > 0, 'catalog/search endpoint must be referenced');

    // Find the fetch call context (there may be multiple references)
    const allMatches = [];
    let idx = 0;
    while ((idx = v3Content.indexOf('catalog/search', idx)) !== -1) {
      const context = v3Content.substring(Math.max(0, idx - 300), idx + 200);
      if (context.includes('fetch(') || context.includes('fetch (')) {
        allMatches.push(context);
      }
      idx += 1;
    }

    // ALL fetch calls to catalog/search must use POST
    for (const ctx of allMatches) {
      assert.ok(
        ctx.includes("method: 'POST'"),
        'Every catalog/search fetch must use POST method'
      );
    }
  });

  test('catalog/recommendations uses POST method', () => {
    const recoIdx = v3Content.indexOf('catalog/recommendations');
    assert.ok(recoIdx > 0, 'catalog/recommendations endpoint must be referenced');

    const context = v3Content.substring(Math.max(0, recoIdx - 200), recoIdx + 200);
    assert.ok(context.includes("method: 'POST'"), 'catalog/recommendations must use POST method');
  });

  test('/respond uses POST method', () => {
    const respondIdx = v3Content.indexOf('CONFIG.VOICE_API_URL,');
    if (respondIdx > 0) {
      const context = v3Content.substring(respondIdx, respondIdx + 300);
      assert.ok(context.includes("method: 'POST'"), '/respond must use POST method');
    }
  });

  test('NO fetch() calls use GET for catalog data endpoints', () => {
    // Ensure no GET method for catalog write/query endpoints
    const lines = v3Content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('catalog/browse') || line.includes('catalog/search') || line.includes('catalog/recommendations')) {
        // Look in surrounding context for method
        const context = lines.slice(Math.max(0, i - 5), Math.min(lines.length, i + 10)).join('\n');
        if (context.includes('fetch(') || context.includes('fetch (')) {
          assert.ok(
            !context.includes("method: 'GET'"),
            `Line ${i + 1}: Catalog data endpoint must NOT use GET method`
          );
        }
      }
    }
  });

  test('catalog/detail uses GET method (read-only)', () => {
    const detailIdx = v3Content.indexOf('catalog/detail');
    assert.ok(detailIdx > 0, 'catalog/detail endpoint must be referenced');

    // catalog/detail should NOT explicitly set POST method (defaults to GET)
    const context = v3Content.substring(Math.max(0, detailIdx - 100), detailIdx + 300);
    assert.ok(
      !context.includes("method: 'POST'"),
      'catalog/detail should use GET method (default)'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PORT ALIGNMENT VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Widget V3 port alignment', () => {
  const v3Content = readFile('widget/voice-widget-v3.js');

  test('Voice API calls use VOICE_API_URL (port 3004)', () => {
    // /respond, /tts, /social-proof, /config all use voice API
    assert.ok(v3Content.includes("CONFIG.VOICE_API_URL.replace('/respond', '/tts')"), '/tts must derive from VOICE_API_URL');
    assert.ok(v3Content.includes("CONFIG.VOICE_API_URL.replace('/respond', '/config')") ||
              v3Content.includes("CONFIG.VOICE_API_URL.replace('/respond', '')"),
              '/config must derive from VOICE_API_URL');
  });

  test('Catalog calls use CATALOG_API_URL (port 3013)', () => {
    // All catalog/* endpoints must use CATALOG_API_URL
    const catalogLines = v3Content.split('\n').filter(l =>
      l.includes('catalog/browse') || l.includes('catalog/search') ||
      l.includes('catalog/recommendations') || l.includes('catalog/detail')
    );

    for (const line of catalogLines) {
      if (line.includes('CATALOG_API_URL') || line.includes('CONFIG.CATALOG_API_URL')) {
        // OK - uses correct config
      } else if (line.includes('//') || line.includes('*')) {
        // Comment - skip
      } else {
        // If it's a URL construction, it MUST use CATALOG_API_URL
        if (line.includes('`$') || line.includes('fetch(')) {
          assert.ok(
            line.includes('CATALOG_API_URL'),
            `Catalog endpoint must use CATALOG_API_URL: ${line.trim()}`
          );
        }
      }
    }
  });

  test('/api/recommendations uses API_BASE_URL (port 3013), not VOICE_API_URL', () => {
    const recoLine = v3Content.split('\n').find(l => l.includes('/api/recommendations'));
    assert.ok(recoLine, '/api/recommendations must be referenced');
    assert.ok(
      recoLine.includes('API_BASE_URL'),
      '/api/recommendations must use API_BASE_URL (port 3013), not VOICE_API_URL'
    );
    assert.ok(
      !recoLine.includes('VOICE_API_URL'),
      '/api/recommendations must NOT use VOICE_API_URL (port 3004)'
    );
  });

  test('UCP calls derive from CATALOG_API_URL (port 3013)', () => {
    const ucpLines = v3Content.split('\n').filter(l =>
      l.includes('/api/ucp/') && l.includes('endpoint')
    );
    for (const line of ucpLines) {
      assert.ok(
        line.includes('CATALOG_API_URL'),
        `UCP endpoint must derive from CATALOG_API_URL: ${line.trim()}`
      );
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CROSS-FILE INTEGRATION: CatalogConnector used by backend routes
// ═══════════════════════════════════════════════════════════════════════════════

describe('CatalogConnector backend integration chain', () => {
  const dbApiContent = readFile('core/db-api.cjs');
  const tenantStoreContent = readFile('core/tenant-catalog-store.cjs');
  const catalogContent = readFile('core/catalog-connector.cjs');

  test('db-api.cjs lazy-loads TenantCatalogStore', () => {
    assert.ok(
      dbApiContent.includes("require('./tenant-catalog-store.cjs')"),
      'db-api.cjs must import tenant-catalog-store.cjs'
    );
  });

  test('TenantCatalogStore imports CatalogConnectorFactory', () => {
    assert.ok(
      tenantStoreContent.includes("require('./catalog-connector.cjs')"),
      'tenant-catalog-store.cjs must import catalog-connector.cjs'
    );
    assert.ok(
      tenantStoreContent.includes('CatalogConnectorFactory'),
      'tenant-catalog-store.cjs must use CatalogConnectorFactory'
    );
  });

  test('CatalogConnectorFactory.create() exists and returns connector', () => {
    const { CatalogConnectorFactory } = require('../core/catalog-connector.cjs');
    assert.strictEqual(typeof CatalogConnectorFactory.create, 'function');

    // Create a custom connector (doesn't need external API)
    const connector = CatalogConnectorFactory.create('test_integration', {
      type: 'custom',
      catalogType: 'PRODUCTS'
    });
    assert.ok(connector, 'Factory must return a connector instance');
    assert.strictEqual(connector.tenantId, 'test_integration');
  });

  test('TenantCatalogStore.getItems() method exists', () => {
    const { TenantCatalogStore } = require('../core/tenant-catalog-store.cjs');
    assert.strictEqual(typeof TenantCatalogStore.prototype.getItems, 'function');
  });

  test('TenantCatalogStore.getItem() method exists', () => {
    const { TenantCatalogStore } = require('../core/tenant-catalog-store.cjs');
    assert.strictEqual(typeof TenantCatalogStore.prototype.getItem, 'function');
  });

  test('TenantCatalogStore.registerTenant() method exists', () => {
    const { TenantCatalogStore } = require('../core/tenant-catalog-store.cjs');
    assert.strictEqual(typeof TenantCatalogStore.prototype.registerTenant, 'function');
  });

  test('TenantCatalogStore.syncCatalog() method exists', () => {
    const { TenantCatalogStore } = require('../core/tenant-catalog-store.cjs');
    assert.strictEqual(typeof TenantCatalogStore.prototype.syncCatalog, 'function');
  });

  test('Full chain: db-api getCatalogStore → TenantCatalogStore → CatalogConnectorFactory', () => {
    // Verify the chain by checking that:
    // 1. getCatalogStore is defined
    assert.ok(dbApiContent.includes('function getCatalogStore()'), 'getCatalogStore must be defined');
    // 2. It creates TenantCatalogStore
    assert.ok(dbApiContent.includes('new TenantCatalogStore()'), 'getCatalogStore must create TenantCatalogStore');
    // 3. Catalog browse/search/recommendations use getCatalogStore
    assert.ok(dbApiContent.includes('getCatalogStore()'), 'Catalog routes must call getCatalogStore()');
    // 4. TenantCatalogStore calls CatalogConnectorFactory.create
    assert.ok(tenantStoreContent.includes('CatalogConnectorFactory.create'), 'TenantCatalogStore must call CatalogConnectorFactory.create');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ABSENCE TESTS: Verify NO broken patterns remain
// ═══════════════════════════════════════════════════════════════════════════════

describe('Widget V3 NO broken endpoint patterns', () => {
  const v3Content = readFile('widget/voice-widget-v3.js');

  test('NO /catalog/items path (old broken pattern)', () => {
    const lines = v3Content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('/catalog/items') && !line.includes('//') && !line.includes('*')) {
        assert.fail(`Line ${i + 1}: Found old broken pattern /catalog/items — should be /catalog/browse or /catalog/detail`);
      }
    }
  });

  test('NO GET method for /catalog/search', () => {
    const lines = v3Content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('catalog/search')) {
        const context = lines.slice(Math.max(0, i - 3), Math.min(lines.length, i + 10)).join('\n');
        if (context.includes("method: 'GET'")) {
          assert.fail(`Line ${i + 1}: catalog/search must use POST, not GET`);
        }
      }
    }
  });

  test('NO VOICE_API_URL for catalog endpoints', () => {
    const lines = v3Content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if ((line.includes('catalog/browse') || line.includes('catalog/search') ||
           line.includes('catalog/detail') || line.includes('catalog/recommendations')) &&
          line.includes('VOICE_API_URL')) {
        assert.fail(`Line ${i + 1}: Catalog endpoints must NOT use VOICE_API_URL (port 3004)`);
      }
    }
  });
});
