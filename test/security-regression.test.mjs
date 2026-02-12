/**
 * VocalIA Security Regression Tests — T5
 *
 * Structural tests that verify security patterns are respected in source code.
 * No runtime execution — reads source files and asserts patterns.
 *
 * Detects: XSS innerHTML without escape (12), tenant isolation bypass (8),
 * timing-safe comparison gaps (3), unbounded collections (10), SSRF (1) = ~36 bugs.
 *
 * Run: node --test test/security-regression.test.mjs
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.url.replace('file://', ''), '../../');

// ─── Helper: read file safely ────────────────────────────────────────────────

function readFile(relPath) {
  const fullPath = path.join(ROOT, relPath);
  return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : null;
}

function listFiles(dir, ext) {
  const fullDir = path.join(ROOT, dir);
  if (!fs.existsSync(fullDir)) return [];
  return fs.readdirSync(fullDir)
    .filter(f => f.endsWith(ext))
    .map(f => path.join(dir, f));
}

// ─── T5.1: Widget XSS — all widgets have escapeHTML ─────────────────────────

describe('T5: Widget XSS protection', () => {
  const widgetFiles = listFiles('widget', '.js');

  test('All 7 widget files exist', () => {
    assert.strictEqual(widgetFiles.length, 7);
  });

  for (const file of widgetFiles) {
    test(`${path.basename(file)} has escapeHTML function`, () => {
      const src = readFile(file);
      assert.ok(src.includes('escapeHTML') || src.includes('escapeHtml'),
        `${file} missing escapeHTML — XSS vulnerability`);
    });
  }

  for (const file of widgetFiles) {
    test(`${path.basename(file)} uses Shadow DOM`, () => {
      const src = readFile(file);
      assert.ok(src.includes('attachShadow') || src.includes('shadowRoot'),
        `${file} should use Shadow DOM for style isolation`);
    });
  }
});

// ─── T5.2: App page XSS — innerHTML with dynamic data has escapeHtml ────────

describe('T5: App page XSS protection', () => {
  const appPages = [
    'website/app/client/calls.html',
    'website/app/client/billing.html',
    'website/app/client/catalog.html',
    'website/app/client/knowledge-base.html',
    'website/app/client/telephony.html',
    'website/app/admin/tenants.html',
    'website/app/admin/hitl.html',
    'website/app/admin/video-ads.html',
    'website/app/admin/logs.html',
  ];

  for (const page of appPages) {
    test(`${path.basename(page)} has escapeHtml when using innerHTML`, () => {
      const src = readFile(page);
      if (!src) return;

      // If page uses innerHTML with template literals, must have escapeHtml
      const hasInnerHTML = src.includes('innerHTML') && src.includes('${');
      if (hasInnerHTML) {
        assert.ok(src.includes('escapeHtml') || src.includes('escapeHTML'),
          `${page} uses innerHTML with template literals but no escapeHtml — XSS B6/B7 regression`);
      }
    });
  }
});

// ─── T5.3: No eval/Function/document.write in app pages ─────────────────────

describe('T5: No dangerous JS patterns', () => {
  const appDirs = ['website/app/client', 'website/app/admin', 'website/app/auth'];

  for (const dir of appDirs) {
    const files = listFiles(dir, '.html');
    for (const file of files) {
      test(`${path.basename(file)} — no eval/Function constructor`, () => {
        const src = readFile(file);
        if (!src) return;

        // Extract script content
        const scriptBlocks = src.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
        for (const block of scriptBlocks) {
          const content = block.replace(/<\/?script[^>]*>/gi, '');
          // Check for eval — but not inside strings or comments
          const lines = content.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
            assert.ok(!trimmed.match(/\beval\s*\(/),
              `${file}: eval() found — code injection risk\n  ${trimmed}`);
            assert.ok(!trimmed.match(/new\s+Function\s*\(/),
              `${file}: new Function() found — code injection risk\n  ${trimmed}`);
            assert.ok(!trimmed.match(/document\.write\s*\(/),
              `${file}: document.write() found — DOM clobbering risk\n  ${trimmed}`);
          }
        }
      });
    }
  }
});

// ─── T5.4: Tenant isolation — sanitizeTenantId usage ────────────────────────

describe('T5: Tenant isolation — path traversal protection', () => {
  const coreModules = listFiles('core', '.cjs');

  for (const file of coreModules) {
    test(`${path.basename(file)} — path.join with tenantId uses sanitize`, () => {
      const src = readFile(file);
      if (!src) return;

      const lines = src.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Find path.join calls that include tenantId as raw variable
        if (line.includes('path.join') && line.includes('tenantId') &&
            !line.includes('sanitizeTenantId') && !line.includes('safeTId') &&
            !line.includes('safeTenantId') && !line.includes('sanitizedId') &&
            !line.includes('this.getTenantDir') && !line.includes('getTenantDir')) {
          // Check if sanitization happened on a nearby line above
          const contextAbove = lines.slice(Math.max(0, i - 5), i).join('\n');
          const hasSanitize = contextAbove.includes('sanitizeTenantId') ||
                              contextAbove.includes('safeTId') ||
                              contextAbove.includes('safeTenantId');
          assert.ok(hasSanitize,
            `${file}:${i + 1} — path.join with raw tenantId, no sanitization nearby.\n  ${line.trim()}`);
        }
      }
    });
  }
});

// ─── T5.5: Timing-safe comparisons for secrets ──────────────────────────────

describe('T5: Timing-safe secret comparison', () => {
  const criticalFiles = [
    'core/gateways/stripe-global-gateway.cjs',
    'core/WebhookRouter.cjs',
    'core/gateways/payzone-global-gateway.cjs',
    'core/tenant-cors.cjs',
  ];

  for (const file of criticalFiles) {
    test(`${path.basename(file)} uses timingSafeEqual`, () => {
      const src = readFile(file);
      if (!src) return;
      assert.ok(src.includes('timingSafeEqual'),
        `${file} handles secrets but doesn't use timingSafeEqual`);
    });
  }

  test('auth-service uses crypto for password operations', () => {
    const src = readFile('core/auth-service.cjs');
    assert.ok(src);
    assert.ok(src.includes('crypto'),
      'auth-service should use crypto module for password hashing');
  });
});

// ─── T5.6: No hardcoded secrets ──────────────────────────────────────────────

describe('T5: No hardcoded secrets', () => {
  const coreModules = listFiles('core', '.cjs');

  for (const file of coreModules) {
    test(`${path.basename(file)} — no hardcoded API keys`, () => {
      const src = readFile(file);
      if (!src) return;

      const lines = src.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('//') || line.startsWith('*')) continue;

        // Check for patterns like: apiKey = 'sk_live_...'
        assert.ok(!line.match(/['"]sk_(live|test)_[a-zA-Z0-9]{10,}['"]/),
          `${file}:${i + 1} — hardcoded Stripe key\n  ${line}`);
        assert.ok(!line.match(/['"]xai-[a-zA-Z0-9]{20,}['"]/),
          `${file}:${i + 1} — hardcoded XAI key\n  ${line}`);
        assert.ok(!line.match(/['"]AIza[a-zA-Z0-9_-]{30,}['"]/),
          `${file}:${i + 1} — hardcoded Google API key\n  ${line}`);
      }
    });
  }
});

// ─── T5.7: Require casing correctness (Linux-safe) ──────────────────────────
// macOS is case-insensitive, Linux is case-sensitive. Wrong casing = crash on deploy.

describe('T5: Require path casing', () => {
  const coreModules = listFiles('core', '.cjs');

  for (const file of coreModules) {
    test(`${path.basename(file)} — require paths match actual filenames`, () => {
      const src = readFile(file);
      if (!src) return;

      const requireMatches = src.matchAll(/require\(['"](\.[^'"]+)['"]\)/g);
      for (const match of requireMatches) {
        const reqPath = match[1];
        const resolvedPath = path.resolve(path.join(ROOT, path.dirname(file), reqPath));

        // Add .cjs if no extension
        const candidates = [resolvedPath];
        if (!path.extname(resolvedPath)) {
          candidates.push(resolvedPath + '.cjs', resolvedPath + '.js', resolvedPath + '.json');
        }

        const exists = candidates.some(p => fs.existsSync(p));
        assert.ok(exists,
          `${file}: require('${reqPath}') — file not found. Possible casing issue.\n  Resolved: ${resolvedPath}`);
      }
    });
  }
});

// ─── T5.8: CORS — no wildcard origins ────────────────────────────────────────

describe('T5: CORS safety', () => {
  test('db-api CORS_ALLOWED_ORIGINS has no wildcard', () => {
    const { CORS_ALLOWED_ORIGINS } = require('../core/db-api.cjs');
    assert.ok(!CORS_ALLOWED_ORIGINS.includes('*'),
      'CORS_ALLOWED_ORIGINS must not include wildcard *');
  });

  test('db-api CORS origins are HTTPS (except localhost)', () => {
    const { CORS_ALLOWED_ORIGINS } = require('../core/db-api.cjs');
    for (const origin of CORS_ALLOWED_ORIGINS) {
      const isHTTPS = origin.startsWith('https://');
      const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
      assert.ok(isHTTPS || isLocalhost,
        `CORS origin should be HTTPS: ${origin}`);
    }
  });
});

// ─── T5.9: Auth middleware exports all required guards ───────────────────────

describe('T5: Auth guards completeness', () => {
  const authMW = require('../core/auth-middleware.cjs');

  const requiredGuards = ['requireAuth', 'requireRole', 'requireTenant',
    'requireAdmin', 'requireVerifiedEmail', 'rateLimit'];

  for (const guard of requiredGuards) {
    test(`auth-middleware exports ${guard}`, () => {
      assert.strictEqual(typeof authMW[guard], 'function',
        `Missing auth guard: ${guard}`);
    });
  }
});

// ─── T5.10: JWT configuration safety ────────────────────────────────────────

describe('T5: JWT configuration', () => {
  test('auth-service uses process.env for JWT secret', () => {
    const src = readFile('core/auth-service.cjs');
    assert.ok(src);
    assert.ok(src.includes('process.env') && (src.includes('JWT_SECRET') || src.includes('jwt')),
      'auth-service should read JWT secret from environment');
  });

  test('auth-service does not hardcode JWT secret', () => {
    const src = readFile('core/auth-service.cjs');
    assert.ok(src);
    // Check no literal string assigned to JWT secret (except env fallback)
    const lines = src.split('\n');
    for (const line of lines) {
      if (line.includes('JWT_SECRET') && line.includes('=') && !line.includes('process.env')) {
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
        assert.fail(`Potential hardcoded JWT secret: ${line.trim()}`);
      }
    }
  });
});

// ─── T5.11: Collection bounds — Maps/Sets have MAX limits ───────────────────

describe('T5: Bounded collections in singletons', () => {
  test('auth-middleware rateLimit has eviction', () => {
    const src = readFile('core/auth-middleware.cjs');
    assert.ok(src);
    assert.ok(src.includes('cleanupRateLimits') || src.includes('cleanup') || src.includes('delete'),
      'rateLimit should have a cleanup/eviction mechanism');
  });

  test('OAuthGateway pendingStates is bounded', () => {
    const src = readFile('core/OAuthGateway.cjs');
    assert.ok(src);
    // pendingStates should have expiry or cleanup
    assert.ok(src.includes('delete') || src.includes('clear') || src.includes('expire') || src.includes('setTimeout'),
      'OAuthGateway pendingStates should have cleanup mechanism');
  });
});

// ─── T5.12: Sensitive fields filtered from user records ─────────────────────

describe('T5: Sensitive field filtering', () => {
  test('db-api filterUserRecord strips sensitive fields', () => {
    const { filterUserRecord } = require('../core/db-api.cjs');
    const record = {
      email: 'test@test.com',
      name: 'Test',
      password_hash: 'abc123',
      password_reset_token: 'reset_tok',
      password_reset_expires: '2026-01-01',
      email_verify_token: 'verify_tok',
      email_verify_expires: '2026-01-01',
    };
    const filtered = filterUserRecord(record);
    assert.strictEqual(filtered.password_hash, undefined, 'password_hash should be stripped');
    assert.strictEqual(filtered.password_reset_token, undefined, 'password_reset_token should be stripped');
    assert.strictEqual(filtered.password_reset_expires, undefined, 'password_reset_expires should be stripped');
    assert.strictEqual(filtered.email_verify_token, undefined, 'email_verify_token should be stripped');
    assert.strictEqual(filtered.email_verify_expires, undefined, 'email_verify_expires should be stripped');
    assert.strictEqual(filtered.email, 'test@test.com', 'email should be preserved');
    assert.strictEqual(filtered.name, 'Test', 'name should be preserved');
  });
});

// ─── T5.13: sanitizeTenantId blocks path traversal ──────────────────────────

describe('T5: sanitizeTenantId security', () => {
  const { sanitizeTenantId } = require('../core/voice-api-utils.cjs');

  test('strips path traversal ../', () => {
    const result = sanitizeTenantId('../../../etc/passwd');
    assert.ok(!result.includes('..'), `Should strip ..: got "${result}"`);
    assert.ok(!result.includes('/'), `Should strip /: got "${result}"`);
  });

  test('strips null bytes', () => {
    const result = sanitizeTenantId('tenant\x00evil');
    assert.ok(!result.includes('\x00'), `Should strip null bytes: got "${result}"`);
  });

  test('handles empty string', () => {
    const result = sanitizeTenantId('');
    assert.ok(typeof result === 'string');
  });

  test('preserves valid tenant ID', () => {
    const result = sanitizeTenantId('my_tenant_123');
    assert.strictEqual(result, 'my_tenant_123');
  });
});

// ─── T5.14: WordPress plugin XSS protection ─────────────────────────────────

describe('T5: WordPress plugin safety', () => {
  const wpFile = 'widget/wordpress-plugin/vocalia-voice-widget.php';

  test('WordPress plugin uses esc_html/esc_attr', () => {
    const src = readFile(wpFile);
    if (!src) return; // Skip if no WP plugin
    assert.ok(src.includes('esc_html') || src.includes('esc_attr'),
      'WordPress plugin should use esc_html/esc_attr for output escaping');
  });

  test('WordPress plugin uses sanitize_text_field for input', () => {
    const src = readFile(wpFile);
    if (!src) return;
    assert.ok(src.includes('sanitize_text_field'),
      'WordPress plugin should use sanitize_text_field for user input');
  });
});

