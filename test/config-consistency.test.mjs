/**
 * VocalIA Config Consistency Tests — T6
 *
 * Detects: plan name mismatches, pricing inconsistencies, stale config data,
 * locale key gaps, persona count drift, function tools count.
 *
 * Historical bugs caught: plan name mismatch (3), pricing inconsistency (5),
 * stale data (8), locale key gaps (5), schema.org errors (~10) = ~31 bugs.
 *
 * Run: node --test test/config-consistency.test.mjs
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.url.replace('file://', ''), '../../');

// ─── T6.1: Plan names consistent across modules ─────────────────────────────
// db-api has PLAN_QUOTAS, PLAN_FEATURES, PLAN_NAME_MAP
// voice-api has PLAN_FEATURES, PLAN_PRICES
// kb-quotas has its own PLAN_QUOTAS

describe('T6: Plan name consistency', () => {
  const dbApi = require('../core/db-api.cjs');
  const voiceApi = require('../core/voice-api-resilient.cjs');
  const kbQuotas = require('../core/kb-quotas.cjs');

  const canonicalPlans = ['starter', 'pro', 'ecommerce', 'telephony'];

  test('db-api PLAN_QUOTAS has all canonical plans', () => {
    for (const plan of canonicalPlans) {
      assert.ok(dbApi.PLAN_QUOTAS[plan],
        `db-api PLAN_QUOTAS missing plan: ${plan}`);
    }
  });

  test('db-api PLAN_FEATURES has all canonical plans', () => {
    for (const plan of canonicalPlans) {
      assert.ok(dbApi.PLAN_FEATURES[plan],
        `db-api PLAN_FEATURES missing plan: ${plan}`);
    }
  });

  test('voice-api PLAN_FEATURES has all canonical plans', () => {
    for (const plan of canonicalPlans) {
      assert.ok(voiceApi.PLAN_FEATURES[plan],
        `voice-api PLAN_FEATURES missing plan: ${plan}`);
    }
  });

  test('voice-api PLAN_PRICES has all canonical plans', () => {
    for (const plan of canonicalPlans) {
      assert.ok(voiceApi.PLAN_PRICES[plan] !== undefined,
        `voice-api PLAN_PRICES missing plan: ${plan}`);
    }
  });

  test('db-api PLAN_NAME_MAP maps all expected aliases', () => {
    const map = dbApi.PLAN_NAME_MAP;
    assert.strictEqual(map.ecom, 'ecommerce');
    assert.strictEqual(map.ecommerce, 'ecommerce');
    assert.strictEqual(map.starter, 'starter');
    assert.strictEqual(map.pro, 'pro');
    assert.strictEqual(map.telephony, 'telephony');
  });

  test('db-api PLAN_QUOTAS has no extra unknown plans', () => {
    const known = ['starter', 'pro', 'ecommerce', 'telephony'];
    for (const plan of Object.keys(dbApi.PLAN_QUOTAS)) {
      assert.ok(known.includes(plan),
        `db-api PLAN_QUOTAS has unknown plan: ${plan}`);
    }
  });

  test('voice-api PLAN_FEATURES has no extra unknown plans', () => {
    const known = ['starter', 'pro', 'ecommerce', 'telephony'];
    for (const plan of Object.keys(voiceApi.PLAN_FEATURES)) {
      assert.ok(known.includes(plan),
        `voice-api PLAN_FEATURES has unknown plan: ${plan}`);
    }
  });
});

// ─── T6.2: Pricing consistency ───────────────────────────────────────────────

describe('T6: Pricing values', () => {
  const voiceApi = require('../core/voice-api-resilient.cjs');

  test('Starter = 49€', () => {
    assert.strictEqual(voiceApi.PLAN_PRICES.starter, 49);
  });

  test('Pro = 99€', () => {
    assert.strictEqual(voiceApi.PLAN_PRICES.pro, 99);
  });

  test('E-commerce = 99€', () => {
    assert.strictEqual(voiceApi.PLAN_PRICES.ecommerce, 99);
  });

  test('Telephony = 199€', () => {
    assert.strictEqual(voiceApi.PLAN_PRICES.telephony, 199);
  });

  test('No free plan in PLAN_PRICES', () => {
    assert.strictEqual(voiceApi.PLAN_PRICES.free, undefined,
      'VocalIA has no free tier — 14-day trial only');
  });
});

// ─── T6.3: Feature flags consistency between db-api and voice-api ────────────
// Both modules define PLAN_FEATURES — core flags should match

describe('T6: PLAN_FEATURES cross-module consistency', () => {
  const dbFeatures = require('../core/db-api.cjs').PLAN_FEATURES;
  const voiceFeatures = require('../core/voice-api-resilient.cjs').PLAN_FEATURES;
  const sharedFlags = ['voice_widget', 'voice_telephony', 'crm_sync', 'calendar_sync',
    'custom_branding', 'api_access', 'webhooks'];

  for (const plan of ['starter', 'pro', 'ecommerce', 'telephony']) {
    for (const flag of sharedFlags) {
      if (dbFeatures[plan]?.[flag] !== undefined && voiceFeatures[plan]?.[flag] !== undefined) {
        test(`${plan}.${flag} matches between db-api and voice-api`, () => {
          assert.strictEqual(dbFeatures[plan][flag], voiceFeatures[plan][flag],
            `${plan}.${flag}: db-api=${dbFeatures[plan][flag]}, voice-api=${voiceFeatures[plan][flag]}`);
        });
      }
    }
  }
});

// ─── T6.4: Locale files — same top-level keys ───────────────────────────────

describe('T6: Locale key parity', () => {
  const localeDir = path.join(ROOT, 'website/src/locales');
  const localeFiles = ['fr.json', 'en.json', 'es.json', 'ar.json', 'ary.json'];

  test('All 5 locale files exist', () => {
    for (const file of localeFiles) {
      assert.ok(fs.existsSync(path.join(localeDir, file)),
        `Missing locale: ${file}`);
    }
  });

  test('All locale files are valid JSON', () => {
    for (const file of localeFiles) {
      const filePath = path.join(localeDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      assert.doesNotThrow(() => JSON.parse(content),
        `${file} is not valid JSON`);
    }
  });

  test('All locale files have the same top-level keys', () => {
    const locales = {};
    for (const file of localeFiles) {
      locales[file] = Object.keys(
        JSON.parse(fs.readFileSync(path.join(localeDir, file), 'utf8'))
      ).sort();
    }

    const referenceKeys = locales['fr.json'];
    for (const file of localeFiles) {
      if (file === 'fr.json') continue;
      const missing = referenceKeys.filter(k => !locales[file].includes(k));
      const extra = locales[file].filter(k => !referenceKeys.includes(k));
      assert.strictEqual(missing.length, 0,
        `${file} missing keys from fr.json: ${missing.slice(0, 5).join(', ')}`);
      assert.strictEqual(extra.length, 0,
        `${file} has extra keys not in fr.json: ${extra.slice(0, 5).join(', ')}`);
    }
  });

  test('All locale files have same number of top-level keys', () => {
    const counts = {};
    for (const file of localeFiles) {
      counts[file] = Object.keys(
        JSON.parse(fs.readFileSync(path.join(localeDir, file), 'utf8'))
      ).length;
    }
    const ref = counts['fr.json'];
    for (const [file, count] of Object.entries(counts)) {
      assert.strictEqual(count, ref,
        `${file} has ${count} keys, fr.json has ${ref}`);
    }
  });
});

// ─── T6.5: Locale sub-keys parity (second level) ────────────────────────────

describe('T6: Locale sub-key parity', () => {
  const localeDir = path.join(ROOT, 'website/src/locales');
  const fr = JSON.parse(fs.readFileSync(path.join(localeDir, 'fr.json'), 'utf8'));
  const localeFiles = ['en.json', 'es.json', 'ar.json', 'ary.json'];

  for (const topKey of Object.keys(fr)) {
    if (typeof fr[topKey] !== 'object' || fr[topKey] === null) continue;
    const frSubKeys = Object.keys(fr[topKey]).sort();

    for (const file of localeFiles) {
      test(`${file} → ${topKey} has same sub-keys as fr.json`, () => {
        const locale = JSON.parse(fs.readFileSync(path.join(localeDir, file), 'utf8'));
        if (!locale[topKey] || typeof locale[topKey] !== 'object') {
          // Top-level key exists (checked in T6.4) but might be a string
          return;
        }
        const subKeys = Object.keys(locale[topKey]).sort();
        const missing = frSubKeys.filter(k => !subKeys.includes(k));
        assert.strictEqual(missing.length, 0,
          `${file} → ${topKey} missing sub-keys: ${missing.slice(0, 5).join(', ')}`);
      });
    }
  }
});

// ─── T6.6: Persona consistency ───────────────────────────────────────────────

describe('T6: Persona consistency', () => {
  const { PERSONAS, SYSTEM_PROMPTS, VOICE_CONFIG } = require('../personas/voice-persona-injector.cjs');

  test('PERSONAS has 38 entries', () => {
    assert.strictEqual(Object.keys(PERSONAS).length, 38);
  });

  test('SYSTEM_PROMPTS has 38 entries', () => {
    assert.strictEqual(Object.keys(SYSTEM_PROMPTS).length, 38);
  });

  test('PERSONAS and SYSTEM_PROMPTS have the same keys', () => {
    const pKeys = Object.keys(PERSONAS).sort();
    const sKeys = Object.keys(SYSTEM_PROMPTS).sort();
    assert.deepStrictEqual(pKeys, sKeys,
      'PERSONAS and SYSTEM_PROMPTS should have identical keys');
  });

  test('Each SYSTEM_PROMPTS entry has all 5 languages', () => {
    const expectedLangs = ['fr', 'en', 'es', 'ar', 'ary'];
    for (const [key, prompts] of Object.entries(SYSTEM_PROMPTS)) {
      for (const lang of expectedLangs) {
        assert.ok(prompts[lang],
          `SYSTEM_PROMPTS.${key} missing language: ${lang}`);
        assert.ok(typeof prompts[lang] === 'string' && prompts[lang].length > 0,
          `SYSTEM_PROMPTS.${key}.${lang} should be non-empty string`);
      }
    }
  });

  test('Each PERSONAS entry has systemPrompt (EN fallback)', () => {
    for (const [key, persona] of Object.entries(PERSONAS)) {
      assert.ok(persona.systemPrompt && typeof persona.systemPrompt === 'string',
        `PERSONAS.${key} missing systemPrompt fallback`);
    }
  });

  test('Each PERSONAS entry has name', () => {
    for (const [key, persona] of Object.entries(PERSONAS)) {
      assert.ok(persona.name && typeof persona.name === 'string',
        `PERSONAS.${key} missing name`);
    }
  });
});

// ─── T6.7: OAuth providers consistency ───────────────────────────────────────

describe('T6: OAuth providers', () => {
  const { OAUTH_PROVIDERS } = require('../core/OAuthGateway.cjs');

  test('5 OAuth providers defined', () => {
    assert.strictEqual(Object.keys(OAUTH_PROVIDERS).length, 5);
  });

  test('Expected providers exist', () => {
    const expected = ['google', 'github', 'hubspot', 'shopify', 'slack'];
    for (const provider of expected) {
      assert.ok(OAUTH_PROVIDERS[provider],
        `Missing OAuth provider: ${provider}`);
    }
  });

  test('Each provider has required fields', () => {
    for (const [key, config] of Object.entries(OAUTH_PROVIDERS)) {
      assert.ok(config.name, `${key} missing name`);
      assert.ok(config.clientIdEnv, `${key} missing clientIdEnv`);
      assert.ok(config.clientSecretEnv, `${key} missing clientSecretEnv`);
      assert.ok(config.scopes && typeof config.scopes === 'object', `${key} missing scopes`);
    }
  });

  test('Login providers (google, github) have loginScopes', () => {
    assert.ok(OAUTH_PROVIDERS.google.loginScopes);
    assert.ok(OAUTH_PROVIDERS.github.loginScopes);
  });
});

// ─── T6.8: Function tools count in telephony ────────────────────────────────

describe('T6: Telephony function tools', () => {
  test('telephony has exactly 25 function tools', () => {
    const src = fs.readFileSync(path.join(ROOT, 'telephony/voice-telephony-bridge.cjs'), 'utf8');
    const matches = src.match(/name: '/g);
    assert.strictEqual(matches.length, 25,
      `Expected 25 function tools, found ${matches.length}`);
  });
});

// ─── T6.9: KB quota plan coverage ───────────────────────────────────────────

describe('T6: KB quota plans', () => {
  const { PLAN_QUOTAS } = require('../core/kb-quotas.cjs');

  test('KB quotas cover free/starter/pro/enterprise', () => {
    const expected = ['free', 'starter', 'pro', 'enterprise'];
    for (const plan of expected) {
      assert.ok(PLAN_QUOTAS[plan],
        `KB PLAN_QUOTAS missing plan: ${plan}`);
    }
  });

  test('Each KB plan has required quota fields', () => {
    const requiredFields = ['max_entries', 'max_storage_bytes', 'max_languages',
      'max_crawls_month', 'max_imports_month', 'max_file_size_bytes'];

    for (const [plan, quotas] of Object.entries(PLAN_QUOTAS)) {
      for (const field of requiredFields) {
        assert.ok(quotas[field] !== undefined,
          `KB PLAN_QUOTAS.${plan} missing field: ${field}`);
        assert.strictEqual(typeof quotas[field], 'number',
          `KB PLAN_QUOTAS.${plan}.${field} should be number`);
      }
    }
  });

  test('KB quotas increase with plan tier (max_entries)', () => {
    assert.ok(PLAN_QUOTAS.free.max_entries < PLAN_QUOTAS.starter.max_entries);
    assert.ok(PLAN_QUOTAS.starter.max_entries < PLAN_QUOTAS.pro.max_entries);
    assert.ok(PLAN_QUOTAS.pro.max_entries < PLAN_QUOTAS.enterprise.max_entries);
  });
});

// ─── T6.10: db-api PLAN_QUOTAS field consistency ────────────────────────────

describe('T6: db-api quota fields', () => {
  const { PLAN_QUOTAS } = require('../core/db-api.cjs');
  const requiredFields = ['calls_monthly', 'sessions_monthly', 'kb_entries',
    'conversation_history_days', 'users_max'];

  for (const [plan, quotas] of Object.entries(PLAN_QUOTAS)) {
    test(`db-api PLAN_QUOTAS.${plan} has all required fields`, () => {
      for (const field of requiredFields) {
        assert.ok(quotas[field] !== undefined,
          `PLAN_QUOTAS.${plan} missing: ${field}`);
        assert.strictEqual(typeof quotas[field], 'number',
          `PLAN_QUOTAS.${plan}.${field} should be number`);
      }
    });
  }

  test('Quotas increase with plan tier (calls_monthly)', () => {
    assert.ok(PLAN_QUOTAS.starter.calls_monthly < PLAN_QUOTAS.pro.calls_monthly);
    assert.ok(PLAN_QUOTAS.pro.calls_monthly <= PLAN_QUOTAS.telephony.calls_monthly);
  });
});

// ─── T6.11: Client registry consistency ──────────────────────────────────────

describe('T6: Client registry', () => {
  test('client_registry.json exists and is valid JSON', () => {
    const regPath = path.join(ROOT, 'personas/client_registry.json');
    assert.ok(fs.existsSync(regPath), 'client_registry.json should exist');
    const content = fs.readFileSync(regPath, 'utf8');
    const data = JSON.parse(content);
    assert.ok(data.clients, 'Should have clients property');
    assert.strictEqual(Object.keys(data.clients).length, 22,
      'Should have 22 registered tenants');
  });
});

// ─── T6.12: Widget file count ────────────────────────────────────────────────

describe('T6: Widget files', () => {
  test('7 widget JS files exist', () => {
    const widgetDir = path.join(ROOT, 'widget');
    const jsFiles = fs.readdirSync(widgetDir).filter(f => f.endsWith('.js'));
    assert.strictEqual(jsFiles.length, 7,
      `Expected 7 widget files, found ${jsFiles.length}: ${jsFiles.join(', ')}`);
  });
});

// ─── T6.13: Test file count ──────────────────────────────────────────────────

describe('T6: Test infrastructure', () => {
  test('Test files are .mjs format', () => {
    const testDir = path.join(ROOT, 'test');
    const testFiles = fs.readdirSync(testDir).filter(f => f.endsWith('.test.mjs'));
    assert.ok(testFiles.length >= 70, `Expected >= 70 test files, found ${testFiles.length}`);
  });
});

// ─── T6.14: HITL states consistency ──────────────────────────────────────────

describe('T6: HITL states', () => {
  const { STATES } = require('../core/remotion-hitl.cjs');

  test('HITL STATES includes required lifecycle states', () => {
    const required = ['pending', 'approved', 'generating', 'completed', 'failed'];
    for (const state of required) {
      const found = Object.values(STATES).includes(state);
      assert.ok(found, `HITL STATES missing: ${state}`);
    }
  });
});

// ─── T6.15: Client config.json schema validation ─────────────────────────────
// Bug: agency_internal was incomplete (missing quotas, usage, widget_config).
// Validates that ALL tenants with config.json have required structural fields.

describe('T6: Client config.json schema', () => {
  const clientsDir = path.join(ROOT, 'clients');
  const REQUIRED_FIELDS = ['tenant_id', 'plan'];
  // Tenants referenced by code (fallback clients, registered tenants) need FULL config
  const CRITICAL_TENANTS = ['agency_internal', 'client_demo'];
  const FULL_REQUIRED = [
    'tenant_id', 'name', 'type', 'plan', 'status',
    'quotas', 'usage', 'features', 'integrations', 'market_rules'
  ];
  const REQUIRED_QUOTAS = ['calls_monthly', 'sessions_monthly', 'kb_entries'];
  const REQUIRED_USAGE = ['calls_current', 'sessions_current'];

  for (const tenant of CRITICAL_TENANTS) {
    const cfgPath = path.join(clientsDir, tenant, 'config.json');

    test(`${tenant}/config.json exists`, () => {
      assert.ok(fs.existsSync(cfgPath), `${tenant}/config.json missing`);
    });

    test(`${tenant}/config.json has all required top-level fields`, () => {
      if (!fs.existsSync(cfgPath)) return;
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      for (const field of FULL_REQUIRED) {
        assert.ok(field in cfg,
          `${tenant}/config.json missing required field: ${field}`);
      }
    });

    test(`${tenant}/config.json tenant_id matches directory`, () => {
      if (!fs.existsSync(cfgPath)) return;
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      assert.strictEqual(cfg.tenant_id, tenant,
        `${tenant}/config.json tenant_id mismatch: ${cfg.tenant_id}`);
    });

    test(`${tenant}/config.json quotas has required subfields`, () => {
      if (!fs.existsSync(cfgPath)) return;
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      if (!cfg.quotas) return;
      for (const qf of REQUIRED_QUOTAS) {
        assert.ok(qf in cfg.quotas,
          `${tenant}/config.json quotas missing: ${qf}`);
      }
    });

    test(`${tenant}/config.json usage has required subfields`, () => {
      if (!fs.existsSync(cfgPath)) return;
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      if (!cfg.usage) return;
      for (const uf of REQUIRED_USAGE) {
        assert.ok(uf in cfg.usage,
          `${tenant}/config.json usage missing: ${uf}`);
      }
    });

    test(`${tenant}/config.json market_rules has markets/geo_rules and default`, () => {
      if (!fs.existsSync(cfgPath)) return;
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      if (!cfg.market_rules) return;
      assert.ok(cfg.market_rules.markets || cfg.market_rules.geo_rules,
        `${tenant} market_rules missing both markets and geo_rules`);
      assert.ok(cfg.market_rules.default, `${tenant} market_rules missing default`);
      assert.ok(cfg.market_rules.default.currency, `${tenant} market_rules.default missing currency`);
    });

    test(`${tenant}/config.json integrations is an object`, () => {
      if (!fs.existsSync(cfgPath)) return;
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      assert.ok(cfg.integrations && typeof cfg.integrations === 'object',
        `${tenant} integrations should be an object`);
    });
  }

  // Verify that seeded client configs at minimum have tenant_id + plan
  test('All client configs have tenant_id and plan', () => {
    const violations = [];
    const dirs = fs.readdirSync(clientsDir).filter(d =>
      fs.statSync(path.join(clientsDir, d)).isDirectory() && !d.startsWith('_')
    );
    for (const dir of dirs) {
      const cfgPath = path.join(clientsDir, dir, 'config.json');
      if (!fs.existsSync(cfgPath)) continue;
      try {
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
        for (const f of REQUIRED_FIELDS) {
          if (!(f in cfg)) {
            violations.push(`${dir}: missing ${f}`);
          }
        }
        if (cfg.tenant_id !== dir) {
          violations.push(`${dir}: tenant_id mismatch (${cfg.tenant_id})`);
        }
      } catch (e) {
        violations.push(`${dir}: JSON parse error`);
      }
    }
    assert.strictEqual(violations.length, 0,
      `Found ${violations.length} client config violation(s):\n  ${violations.slice(0, 10).join('\n  ')}`);
  });
});

// ─── T6.16: B43 Regression — No "gratuit" in CTA/pricing/trial contexts ──────
// Bug B43 (session 250.214): 27 instances of "gratuit/free trial" purged.
// Premium positioning: "gratuit" allowed ONLY in e-commerce/tech/booking contexts.

describe('T6: B43 regression — "gratuit" purge', () => {
  const FORBIDDEN_CONTEXTS = [
    'website/index.html',
    'website/pricing.html',
    'website/signup.html',
    'website/billing.html'
  ];
  const ALLOWED_EXCEPTIONS = [
    'livraison gratuite',        // e-commerce feature
    'Web Speech API gratuit',    // tech fact
    'annulation gratuite',       // booking policy
    'Essai 14 Jours Gratuit',   // AB test variant (controlled)
    'Free Personalized Demo'     // AB test variant (controlled)
  ];

  test('No "gratuit" in CTA/pricing pages (excluding allowed exceptions)', () => {
    const violations = [];
    for (const relPath of FORBIDDEN_CONTEXTS) {
      const filePath = path.join(ROOT, relPath);
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (/gratuit/i.test(line)) {
          const isAllowed = ALLOWED_EXCEPTIONS.some(exc => line.includes(exc));
          // Also allow in HTML comments and JS comments
          const isComment = /^\s*(<!--|\/\/|\/\*|\*)/.test(line.trim());
          if (!isAllowed && !isComment) {
            violations.push(`${relPath}:${i + 1}: ${line.trim().slice(0, 80)}`);
          }
        }
      });
    }
    assert.strictEqual(violations.length, 0,
      `Found ${violations.length} "gratuit" violation(s) in CTA/pricing pages:\n  ${violations.join('\n  ')}`);
  });

  test('No "free tier" or "free plan" in locale pricing keys', () => {
    const violations = [];
    const localeDir = path.join(ROOT, 'website/src/locales');
    const locales = fs.readdirSync(localeDir).filter(f => f.endsWith('.json'));
    for (const file of locales) {
      const content = JSON.parse(fs.readFileSync(path.join(localeDir, file), 'utf8'));
      const flat = JSON.stringify(content).toLowerCase();
      // Check for "free tier", "free plan", "plan gratuit" in pricing context
      if (/gratuit_0|free_tier|free_plan|plan_gratuit/.test(flat)) {
        violations.push(`${file}: contains deprecated "gratuit/free" pricing key`);
      }
    }
    assert.strictEqual(violations.length, 0,
      `Found deprecated gratuit keys:\n  ${violations.join('\n  ')}`);
  });
});

// ─── T6.17: B5 Regression — ab-analytics O(N) correctness ──────────────────
// Bug B5 (session 250.207b): accumulateStats was O(N×M), fixed to O(N).

describe('T6: B5 regression — ab-analytics correctness', () => {
  const { getExperimentStats } = require('../core/ab-analytics.cjs');

  test('getExperimentStats returns correct structure for non-existent experiment', () => {
    const stats = getExperimentStats('non_existent_experiment_xyz');
    assert.ok(stats, 'returns stats object');
    assert.equal(stats.experiment, 'non_existent_experiment_xyz');
    assert.equal(typeof stats.variants, 'object');
    assert.equal(stats.totalImpressions, 0);
    assert.equal(stats.totalClicks, 0);
    assert.equal(stats.totalConversions, 0);
  });
});
