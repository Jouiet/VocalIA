/**
 * VocalIA Security Regression Tests — T5
 *
 * Per-occurrence scanners that detect dangerous patterns across the ENTIRE codebase.
 * Tests FAIL when bugs exist. Each violation includes exact file:line location.
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── T5.1: Widget XSS + Shadow DOM ──────────────────────────────────────────

describe('T5.1: Widget XSS protection', () => {
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

// ─── T5.2: JSON.parse safety scanner ────────────────────────────────────────
// Scans ALL .cjs files. JSON.parse without try-catch = process crash on bad input.

describe('T5.2: JSON.parse without try-catch — crash risk', () => {
  const cjsDirs = ['core', 'telephony', 'integrations'];
  const allCjsFiles = [];
  for (const dir of cjsDirs) {
    allCjsFiles.push(...listFiles(dir, '.cjs'));
  }

  test('All JSON.parse calls are inside try-catch blocks', () => {
    const violations = [];

    for (const file of allCjsFiles) {
      const src = readFile(file);
      if (!src) continue;
      const lines = src.split('\n');
      let tryDepth = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Skip comments
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

        // Track try depth — handle 'try {' and 'try\n{'
        if (/\btry\s*\{/.test(line)) {
          tryDepth++;
        } else if (/\btry\s*$/.test(trimmed)) {
          for (let k = i + 1; k < Math.min(lines.length, i + 3); k++) {
            const next = lines[k].trim();
            if (next === '') continue;
            if (next.startsWith('{')) { tryDepth++; break; }
            break;
          }
        }

        // Track catch — handle '} catch' and standalone 'catch'
        if (/\}\s*catch\b/.test(line)) {
          if (tryDepth > 0) tryDepth--;
        } else if (/^\s*catch\s*[\({]/.test(trimmed) && !/catch\s*:/.test(trimmed)) {
          if (tryDepth > 0) tryDepth--;
        }

        // Check JSON.parse
        if (trimmed.includes('JSON.parse(') && tryDepth === 0) {
          // Skip inline try-catch on same line
          if (/\btry\b/.test(trimmed) && /\bcatch\b/.test(trimmed)) continue;

          violations.push(`  ${file}:${i + 1} — ${trimmed.substring(0, 120)}`);
        }
      }
    }

    assert.strictEqual(violations.length, 0,
      `Found ${violations.length} JSON.parse call(s) without try-catch:\n${violations.join('\n')}`);
  });
});

// ─── T5.3: innerHTML per-occurrence XSS scanner ─────────────────────────────
// Scans ALL app HTML. Every innerHTML with ${} interpolation must use escapeHtml.

describe('T5.3: innerHTML per-occurrence XSS', () => {
  const appDirs = ['website/app/client', 'website/app/admin', 'website/app/auth'];
  const appPages = [];
  for (const dir of appDirs) {
    appPages.push(...listFiles(dir, '.html'));
  }

  test('All innerHTML assignments with ${} use escapeHtml', () => {
    const violations = [];

    for (const pagePath of appPages) {
      const src = readFile(pagePath);
      if (!src) continue;

      const scriptBlocks = src.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
      for (const block of scriptBlocks) {
        const content = block.replace(/<\/?script[^>]*>/gi, '');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (!/\.innerHTML\s*[+=]=?\s*/.test(line)) continue;

          // Collect the full expression (multi-line template literals)
          let fullExpr = line;
          let backtickCount = (line.match(/`/g) || []).length;

          if (backtickCount % 2 !== 0) {
            // Unbalanced backticks — collect until balanced
            for (let j = i + 1; j < Math.min(lines.length, i + 50); j++) {
              fullExpr += '\n' + lines[j];
              backtickCount += (lines[j].match(/`/g) || []).length;
              if (backtickCount % 2 === 0) break;
            }
          }

          // Skip if no dynamic interpolation
          if (!fullExpr.includes('${')) continue;

          // Check if escapeHtml is used in the expression
          if (fullExpr.includes('escapeHtml') || fullExpr.includes('escapeHTML')) continue;

          violations.push(`  ${pagePath}:~${i + 1} — innerHTML with unescaped \${}`);
        }
      }
    }

    assert.strictEqual(violations.length, 0,
      `Found ${violations.length} innerHTML assignment(s) with unescaped interpolation:\n${violations.join('\n')}`);
  });
});

// ─── T5.4: No eval/Function/document.write ──────────────────────────────────

describe('T5.4: No dangerous JS patterns', () => {
  const appDirs = ['website/app/client', 'website/app/admin', 'website/app/auth'];

  for (const dir of appDirs) {
    const files = listFiles(dir, '.html');
    for (const file of files) {
      test(`${path.basename(file)} — no eval/Function constructor`, () => {
        const src = readFile(file);
        if (!src) return;

        const scriptBlocks = src.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
        for (const block of scriptBlocks) {
          const content = block.replace(/<\/?script[^>]*>/gi, '');
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

// ─── T5.5: Tenant isolation — path.join with raw tenantId ───────────────────

describe('T5.5: Tenant isolation — path traversal protection', () => {
  const coreModules = listFiles('core', '.cjs');

  for (const file of coreModules) {
    test(`${path.basename(file)} — path.join with tenantId uses sanitize`, () => {
      const src = readFile(file);
      if (!src) return;

      const lines = src.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('path.join') && line.includes('tenantId') &&
            !line.includes('sanitizeTenantId') && !line.includes('safeTId') &&
            !line.includes('safeTenantId') && !line.includes('sanitizedId') &&
            !line.includes('this.getTenantDir') && !line.includes('getTenantDir')) {
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

// ─── T5.6: Timing-safe comparisons for secrets ─────────────────────────────

describe('T5.6: Timing-safe secret comparison', () => {
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

// ─── T5.7: No hardcoded secrets ─────────────────────────────────────────────

describe('T5.7: No hardcoded secrets', () => {
  const coreModules = listFiles('core', '.cjs');

  for (const file of coreModules) {
    test(`${path.basename(file)} — no hardcoded API keys`, () => {
      const src = readFile(file);
      if (!src) return;

      const lines = src.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('//') || line.startsWith('*')) continue;

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

// ─── T5.8: Require path casing (Linux-safe) ────────────────────────────────

describe('T5.8: Require path casing', () => {
  const coreModules = listFiles('core', '.cjs');

  for (const file of coreModules) {
    test(`${path.basename(file)} — require paths match actual filenames`, () => {
      const src = readFile(file);
      if (!src) return;

      const requireMatches = src.matchAll(/require\(['"](\.[^'"]+)['"]\)/g);
      for (const match of requireMatches) {
        const reqPath = match[1];
        const resolvedPath = path.resolve(path.join(ROOT, path.dirname(file), reqPath));

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

// ─── T5.9: CORS — no wildcard ───────────────────────────────────────────────

describe('T5.9: CORS safety', () => {
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

// ─── T5.10: Auth guards completeness ────────────────────────────────────────

describe('T5.10: Auth guards completeness', () => {
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

// ─── T5.11: JWT configuration safety ────────────────────────────────────────

describe('T5.11: JWT configuration', () => {
  test('auth-service uses process.env for JWT secret', () => {
    const src = readFile('core/auth-service.cjs');
    assert.ok(src);
    assert.ok(src.includes('process.env') && (src.includes('JWT_SECRET') || src.includes('jwt')),
      'auth-service should read JWT secret from environment');
  });

  test('auth-service does not hardcode JWT secret', () => {
    const src = readFile('core/auth-service.cjs');
    assert.ok(src);
    const lines = src.split('\n');
    for (const line of lines) {
      if (line.includes('JWT_SECRET') && line.includes('=') && !line.includes('process.env')) {
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
        assert.fail(`Potential hardcoded JWT secret: ${line.trim()}`);
      }
    }
  });
});

// ─── T5.12: Unbounded Map/Set — memory leak scanner ────────────────────────
// Module-level and class-level Map/Set must have eviction logic.

describe('T5.12: Unbounded Map/Set — memory leak risk', () => {
  const coreFiles = listFiles('core', '.cjs');

  // Maps/Sets that are bounded by design (not per-request growth):
  // - WebhookRouter.handlers: registered at startup, finite webhook types
  // - knowledge-base-services vocabulary/idf: rebuilt per-index(), bounded by KB data size
  // - tenant-cors._tenantOrigins: rebuilt from client registry, finite
  const BOUNDED_BY_DESIGN = new Set([
    'WebhookRouter.cjs:handlers',
    'knowledge-base-services.cjs:vocabulary',
    'knowledge-base-services.cjs:idf',
    'tenant-cors.cjs:_tenantOrigins',
  ]);

  test('Persistent Map/Set collections have eviction logic', () => {
    const violations = [];

    for (const file of coreFiles) {
      const src = readFile(file);
      if (!src) continue;
      const lines = src.split('\n');

      // Find persistent Map/Set declarations
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        const indent = line.search(/\S/);

        let varName = null;
        let collType = null;

        // Module-level: const x = new Map() at indent 0
        const moduleMatch = trimmed.match(/^(?:const|let|var)\s+(\w+)\s*=\s*new\s+(Map|Set)\(\)/);
        if (moduleMatch && indent <= 0) {
          varName = moduleMatch[1];
          collType = moduleMatch[2];
        }

        // Class property: this.x = new Map()
        const classMatch = trimmed.match(/this\.(\w+)\s*=\s*new\s+(Map|Set)\(\)/);
        if (classMatch) {
          varName = classMatch[1];
          collType = classMatch[2];
        }

        if (!varName) continue;

        // Skip collections known to be bounded by design
        const fileBase = path.basename(file);
        if (BOUNDED_BY_DESIGN.has(`${fileBase}:${varName}`)) continue;

        // Check for eviction patterns for this variable
        const hasDelete = src.includes(`${varName}.delete(`) || src.includes(`${varName}.delete(`);
        const hasClear = src.includes(`${varName}.clear(`) || src.includes(`${varName}.clear()`);
        const hasSizeCheck = new RegExp(`${varName}\\.size\\s*>=?`).test(src);
        const hasMAX = /\bMAX_\w+\s*=\s*\d+/.test(src) || /\bmaxSize\b/.test(src);
        const hasTimeout = src.includes('setTimeout') && src.includes(varName);
        const hasCleanup = /cleanup|purge|evict/i.test(src);

        if (!hasDelete && !hasClear && !hasSizeCheck && !(hasMAX && (hasSizeCheck || hasDelete)) && !hasTimeout && !hasCleanup) {
          violations.push(`  ${file}:${i + 1} — ${collType} "${varName}" has no eviction/cleanup`);
        }
      }
    }

    assert.strictEqual(violations.length, 0,
      `Found ${violations.length} unbounded collection(s):\n${violations.join('\n')}`);
  });
});

// ─── T5.13: eventBus.emit vs publish scanner ────────────────────────────────
// eventBus.emit() only fires Node EventEmitter listeners.
// eventBus.publish() fires full subscriber system with retry/dedup/persistence.

describe('T5.13: eventBus.emit vs publish', () => {
  const cjsDirs = ['core', 'telephony', 'integrations', 'personas'];
  const allFiles = [];
  for (const dir of cjsDirs) {
    allFiles.push(...listFiles(dir, '.cjs'));
  }

  test('No eventBus.emit() calls — should use eventBus.publish()', () => {
    const violations = [];

    for (const file of allFiles) {
      const src = readFile(file);
      if (!src) continue;
      const lines = src.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

        if (/eventBus\.emit\s*\(/.test(trimmed)) {
          violations.push(`  ${file}:${i + 1} — ${trimmed.substring(0, 100)}`);
        }
      }
    }

    assert.strictEqual(violations.length, 0,
      `Found ${violations.length} eventBus.emit() call(s) — should be eventBus.publish():\n${violations.join('\n')}`);
  });
});

// ─── T5.14: Sensitive field filtering ───────────────────────────────────────

describe('T5.14: Sensitive field filtering', () => {
  test('db-api filterUserRecord strips all sensitive fields', () => {
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

// ─── T5.15: sanitizeTenantId runtime behavior ──────────────────────────────

describe('T5.15: sanitizeTenantId security', () => {
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

// ─── T5.16: WordPress plugin XSS protection ────────────────────────────────

describe('T5.16: WordPress plugin safety', () => {
  const wpFile = 'widget/wordpress-plugin/vocalia-voice-widget.php';

  test('WordPress plugin uses esc_html/esc_attr', () => {
    const src = readFile(wpFile);
    if (!src) return;
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
