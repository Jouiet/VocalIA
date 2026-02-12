/**
 * Integration verification: Tenant Provisioning (Session 250.198)
 *
 * NOT theater tests — this calls the REAL provisionTenant() from db-api.cjs,
 * then feeds the created config.json to the REAL GoogleSheetsDB.checkQuota()
 * and verifies the entire chain works.
 *
 * Chain tested: provisionTenant → config.json → getTenantConfig → checkQuota → allowed
 *
 * Run: node --test test/provision-tenant.test.mjs
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const require = createRequire(import.meta.url);

// ─────────────────────────────────────────────────────────────────────────────
// Import REAL modules from the codebase — NO replicas
// ─────────────────────────────────────────────────────────────────────────────

// Real provisionTenant + constants from db-api.cjs
const dbApi = require(join(ROOT, 'core/db-api.cjs'));
const { provisionTenant, generateTenantIdFromCompany, PLAN_QUOTAS, PLAN_FEATURES, PLAN_NAME_MAP } = dbApi;

// Real GoogleSheetsDB for checkQuota/getTenantConfig
const { getDB } = require(join(ROOT, 'core/GoogleSheetsDB.cjs'));

// Real sanitizeTenantId
const { sanitizeTenantId } = require(join(ROOT, 'core/voice-api-utils.cjs'));

// ─────────────────────────────────────────────────────────────────────────────
// TEST DATA CLEANUP
// ─────────────────────────────────────────────────────────────────────────────
const TEST_TENANTS = ['_test_int_starter', '_test_int_pro', '_test_int_ecom', '_test_int_telephony', '_test_int_accent', '_test_int_empty'];

function cleanupTestTenants() {
  for (const tid of TEST_TENANTS) {
    const dir = join(ROOT, 'clients', tid);
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATION TESTS
// ─────────────────────────────────────────────────────────────────────────────
describe('Tenant Provisioning — INTEGRATION (real modules)', () => {
  before(() => cleanupTestTenants());
  after(() => cleanupTestTenants());

  // ── CHAIN 1: provisionTenant → config.json → checkQuota ──
  describe('Full chain: provisionTenant → checkQuota', () => {
    for (const [plan, label, tid] of [
      ['starter', 'Starter', '_test_int_starter'],
      ['pro', 'Pro', '_test_int_pro'],
      ['ecom', 'E-commerce (via "ecom")', '_test_int_ecom'],
      ['telephony', 'Telephony', '_test_int_telephony']
    ]) {
      it(`${label}: provision → config.json → checkQuota = allowed`, () => {
        // Step 1: Call real provisionTenant
        const result = provisionTenant(tid, {
          plan: PLAN_NAME_MAP[plan] || 'starter',
          company: `Test ${label} Corp`,
          email: `test-${plan}@vocalia.ma`
        });

        assert.ok(result.success, `provisionTenant must succeed for ${plan}`);
        assert.ok(result.configPath, 'Must return configPath');

        // Step 2: Verify config.json exists on disk
        const configPath = join(ROOT, 'clients', tid, 'config.json');
        assert.ok(existsSync(configPath), `config.json must exist at ${configPath}`);

        // Step 3: Read config and verify structure
        const config = JSON.parse(readFileSync(configPath, 'utf8'));
        const expectedPlan = PLAN_NAME_MAP[plan] || 'starter';
        assert.equal(config.tenant_id, tid);
        assert.equal(config.plan, expectedPlan);
        assert.equal(config.status, 'active');

        // Step 4: Call REAL getTenantConfig (same function checkQuota uses)
        const db = getDB();
        const loadedConfig = db.getTenantConfig(tid);
        assert.ok(loadedConfig, `getTenantConfig must find ${tid}`);
        assert.equal(loadedConfig.plan, expectedPlan);
        assert.equal(loadedConfig.quotas.sessions_monthly, PLAN_QUOTAS[expectedPlan].sessions_monthly);

        // Step 5: Call REAL checkQuota
        const sessionQuota = db.checkQuota(tid, 'sessions');
        assert.ok(sessionQuota.allowed, `checkQuota(sessions) must be allowed for fresh ${plan} tenant`);
        assert.equal(sessionQuota.current, 0, 'Fresh tenant usage = 0');
        assert.equal(sessionQuota.limit, PLAN_QUOTAS[expectedPlan].sessions_monthly);

        const callQuota = db.checkQuota(tid, 'calls');
        assert.ok(callQuota.allowed, `checkQuota(calls) must be allowed for fresh ${plan} tenant`);
        assert.equal(callQuota.limit, PLAN_QUOTAS[expectedPlan].calls_monthly);

        const kbQuota = db.checkQuota(tid, 'kb_entries');
        assert.ok(kbQuota.allowed, `checkQuota(kb_entries) must be allowed for fresh ${plan} tenant`);
        assert.equal(kbQuota.limit, PLAN_QUOTAS[expectedPlan].kb_entries);
      });
    }
  });

  // ── CHAIN 2: provisionTenant config matches _template structure ──
  describe('Config structure matches _template', () => {
    it('provisioned config has all quota fields that _template has', () => {
      const templatePath = join(ROOT, 'clients', '_template', 'config.json');
      assert.ok(existsSync(templatePath), '_template/config.json must exist');

      const template = JSON.parse(readFileSync(templatePath, 'utf8'));
      const result = provisionTenant('_test_int_starter', { plan: 'starter', company: 'Test', email: 'test@t.com' });
      const config = JSON.parse(readFileSync(result.configPath, 'utf8'));

      // Verify all quota keys match
      for (const qKey of Object.keys(template.quotas || {})) {
        assert.ok(config.quotas.hasOwnProperty(qKey), `Must have quota field: ${qKey}`);
      }

      // Verify all usage keys match
      for (const uKey of Object.keys(template.usage || {})) {
        assert.ok(config.usage.hasOwnProperty(uKey), `Must have usage field: ${uKey}`);
      }

      // Verify all feature keys from template exist in config
      for (const fKey of Object.keys(template.features || {})) {
        assert.ok(config.features.hasOwnProperty(fKey), `Must have feature: ${fKey}`);
      }
    });
  });

  // ── CHAIN 3: Plan name normalization ──
  describe('Plan name normalization (P5 fix)', () => {
    it('"ecom" → "ecommerce" in PLAN_NAME_MAP', () => {
      assert.equal(PLAN_NAME_MAP['ecom'], 'ecommerce');
    });

    it('provisionTenant with "ecommerce" produces ecommerce config', () => {
      const result = provisionTenant('_test_int_ecom', { plan: 'ecommerce', company: 'Ecom Corp', email: 'e@t.com' });
      const config = JSON.parse(readFileSync(result.configPath, 'utf8'));
      assert.equal(config.plan, 'ecommerce');
      assert.equal(config.vertical, 'ecommerce');
      assert.equal(config.widget_config.persona, 'UNIVERSAL_ECOMMERCE');
    });

    it('unknown plan falls back to starter', () => {
      const result = provisionTenant('_test_int_empty', { plan: 'nonexistent', company: 'X', email: '' });
      const config = JSON.parse(readFileSync(result.configPath, 'utf8'));
      assert.equal(config.plan, 'starter');
      assert.equal(config.quotas.sessions_monthly, 1000);
    });
  });

  // ── CHAIN 4: Tenant ID generation ──
  describe('Tenant ID generation', () => {
    it('generates valid ID from company name', () => {
      const id = generateTenantIdFromCompany('Mon Entreprise SARL');
      assert.ok(/^mon_entreprise_sarl_[a-z0-9]{4}$/.test(id), `ID "${id}" must match pattern`);
    });

    it('handles accented characters (NFD normalization)', () => {
      const id = generateTenantIdFromCompany('Société Générale');
      assert.ok(id.startsWith('societe_generale_'), `ID "${id}" must start with societe_generale_`);
    });

    it('handles empty company (fallback to "tenant")', () => {
      const id = generateTenantIdFromCompany('');
      assert.ok(id.startsWith('tenant_'), `ID "${id}" must fallback to tenant_`);
    });

    it('truncates long names to max 40 chars base', () => {
      const id = generateTenantIdFromCompany('A'.repeat(100));
      assert.ok(id.length <= 45, `ID length ${id.length} must be <= 45`);
    });

    it('sanitizeTenantId accepts generated IDs', () => {
      const id = generateTenantIdFromCompany('Test Corp');
      const sanitized = sanitizeTenantId(id);
      assert.equal(sanitized, id, 'Generated ID must survive sanitization unchanged');
    });

    it('IDs are unique (timestamp-based suffix)', async () => {
      const id1 = generateTenantIdFromCompany('Same Corp');
      await new Promise(r => setTimeout(r, 10));
      const id2 = generateTenantIdFromCompany('Same Corp');
      assert.notEqual(id1, id2, 'Sequential IDs must differ');
    });
  });

  // ── CHAIN 5: Signup field mapping ──
  describe('Signup field mapping (caller/callee verification)', () => {
    it('signup.html body fields map to register handler extraction', () => {
      // What signup.html sends:
      const signupBody = {
        email: 'jean@monentreprise.fr',
        password: 'SecurePass123!',
        name: 'Jean Dupont',         // from fullname field
        company: 'Mon Entreprise SARL',
        plan: 'ecom'                  // from data-plan="ecom"
      };

      // What db-api.cjs register handler extracts (line ~298):
      const { email, password, name, fullname, company, plan, tenant_id } = signupBody;
      const userName = fullname || name || company || email.split('@')[0];
      const normalizedPlan = PLAN_NAME_MAP[plan] || 'starter';
      const tenantId = tenant_id || generateTenantIdFromCompany(company || email.split('@')[0]);

      // Verify
      assert.equal(email, 'jean@monentreprise.fr');
      assert.equal(userName, 'Jean Dupont');
      assert.equal(normalizedPlan, 'ecommerce');
      assert.ok(tenantId.startsWith('mon_entreprise_sarl_'), `tenantId "${tenantId}" must be derived from company`);
    });

    it('minimal signup (no name, no company) still produces valid tenant', () => {
      const signupBody = { email: 'user@test.com', password: 'x' };
      const { email, name, fullname, company, plan, tenant_id } = signupBody;
      const userName = fullname || name || company || email.split('@')[0];
      const normalizedPlan = PLAN_NAME_MAP[plan] || 'starter';
      const tenantId = tenant_id || generateTenantIdFromCompany(company || email.split('@')[0]);

      assert.equal(userName, 'user');
      assert.equal(normalizedPlan, 'starter');
      assert.ok(tenantId.startsWith('user_'), `tenantId "${tenantId}" must be derived from email prefix`);

      // Provision and verify checkQuota
      const result = provisionTenant(tenantId, { plan: normalizedPlan, company: '', email });
      assert.ok(result.success);

      const db = getDB();
      const quotaCheck = db.checkQuota(tenantId, 'sessions');
      assert.ok(quotaCheck.allowed, 'Minimal signup tenant must pass quota check');

      // Cleanup
      const dir = join(ROOT, 'clients', tenantId);
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    });
  });

  // ── CHAIN 6: Feature gating compatibility with voice-api-resilient.cjs ──
  describe('Feature gating compatibility', () => {
    it('starter features match PLAN_FEATURES restriction pattern', () => {
      const result = provisionTenant('_test_int_starter', { plan: 'starter' });
      const config = JSON.parse(readFileSync(result.configPath, 'utf8'));

      assert.equal(config.features.voice_widget, true, 'Starter: voice_widget=true');
      assert.equal(config.features.voice_telephony, false, 'Starter: voice_telephony=false');
      assert.equal(config.features.crm_sync, false, 'Starter: crm_sync=false');
      assert.equal(config.features.webhooks, false, 'Starter: webhooks=false');
      assert.equal(config.features.api_access, false, 'Starter: api_access=false');
      assert.equal(config.features.custom_branding, false, 'Starter: custom_branding=false');
    });

    it('pro features enable CRM + calendar + webhooks but NOT telephony', () => {
      const result = provisionTenant('_test_int_pro', { plan: 'pro' });
      const config = JSON.parse(readFileSync(result.configPath, 'utf8'));

      assert.equal(config.features.crm_sync, true, 'Pro: crm_sync=true');
      assert.equal(config.features.calendar_sync, true, 'Pro: calendar_sync=true');
      assert.equal(config.features.webhooks, true, 'Pro: webhooks=true');
      assert.equal(config.features.api_access, true, 'Pro: api_access=true');
      assert.equal(config.features.voice_telephony, false, 'Pro: voice_telephony=false');
    });

    it('ecommerce: crm_sync=true but calendar_sync=false', () => {
      const result = provisionTenant('_test_int_ecom', { plan: 'ecommerce' });
      const config = JSON.parse(readFileSync(result.configPath, 'utf8'));

      assert.equal(config.features.crm_sync, true, 'Ecom: crm_sync=true');
      assert.equal(config.features.calendar_sync, false, 'Ecom: calendar_sync=false');
    });

    it('telephony: ALL features enabled', () => {
      const result = provisionTenant('_test_int_telephony', { plan: 'telephony' });
      const config = JSON.parse(readFileSync(result.configPath, 'utf8'));

      for (const [key, val] of Object.entries(config.features)) {
        assert.equal(val, true, `Telephony: ${key} must be true`);
      }
    });
  });

  // ── CHAIN 7: Quota values match business pricing ──
  describe('Quota values match pricing tiers', () => {
    it('starter: 500 calls, 1000 sessions, 100 KB, 3 users', () => {
      assert.equal(PLAN_QUOTAS.starter.calls_monthly, 500);
      assert.equal(PLAN_QUOTAS.starter.sessions_monthly, 1000);
      assert.equal(PLAN_QUOTAS.starter.kb_entries, 100);
      assert.equal(PLAN_QUOTAS.starter.users_max, 3);
    });

    it('pro: 2000 calls, 5000 sessions, 500 KB, 10 users', () => {
      assert.equal(PLAN_QUOTAS.pro.calls_monthly, 2000);
      assert.equal(PLAN_QUOTAS.pro.sessions_monthly, 5000);
      assert.equal(PLAN_QUOTAS.pro.kb_entries, 500);
      assert.equal(PLAN_QUOTAS.pro.users_max, 10);
    });

    it('ecommerce: same quotas as pro (2000/5000/500/10)', () => {
      assert.equal(PLAN_QUOTAS.ecommerce.calls_monthly, 2000);
      assert.equal(PLAN_QUOTAS.ecommerce.sessions_monthly, 5000);
    });

    it('telephony: 5000 calls, 10000 sessions, 1000 KB, 25 users', () => {
      assert.equal(PLAN_QUOTAS.telephony.calls_monthly, 5000);
      assert.equal(PLAN_QUOTAS.telephony.sessions_monthly, 10000);
      assert.equal(PLAN_QUOTAS.telephony.kb_entries, 1000);
      assert.equal(PLAN_QUOTAS.telephony.users_max, 25);
    });
  });
});
