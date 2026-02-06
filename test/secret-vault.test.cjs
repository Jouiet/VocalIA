/**
 * SecretVault Unit Tests
 *
 * Tests encryption, decryption, and credential management.
 * Run: node --test test/secret-vault.test.cjs
 *
 * @session 250.6
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');

// Set test encryption key before requiring module
process.env.VOCALIA_VAULT_KEY = 'test-key-32-chars-for-aes256-!!';

const { SecretVault } = require('../core/SecretVault.cjs');

describe('SecretVault', () => {
  let vault;

  beforeEach(() => {
    vault = new SecretVault();
  });

  describe('encrypt/decrypt', () => {
    test('encrypts and decrypts a string correctly', () => {
      const original = 'my-secret-api-key-123';
      const encrypted = vault.encrypt(original);

      // Encrypted should be different from original
      assert.notStrictEqual(encrypted, original);

      // Should be base64 encoded
      assert.ok(encrypted.match(/^[A-Za-z0-9+/=]+$/), 'Should be base64');

      // Decryption should return original
      const decrypted = vault.decrypt(encrypted);
      assert.strictEqual(decrypted, original);
    });

    test('encrypts same value to different ciphertexts (random IV)', () => {
      const value = 'same-secret';
      const encrypted1 = vault.encrypt(value);
      const encrypted2 = vault.encrypt(value);

      // Should produce different ciphertexts due to random IV
      assert.notStrictEqual(encrypted1, encrypted2);

      // Both should decrypt to same value
      assert.strictEqual(vault.decrypt(encrypted1), value);
      assert.strictEqual(vault.decrypt(encrypted2), value);
    });

    test('handles empty string', () => {
      const encrypted = vault.encrypt('');
      const decrypted = vault.decrypt(encrypted);
      assert.strictEqual(decrypted, '');
    });

    test('handles unicode characters', () => {
      const original = 'clé secrète avec accénts 日本語 🔐';
      const encrypted = vault.encrypt(original);
      const decrypted = vault.decrypt(encrypted);
      assert.strictEqual(decrypted, original);
    });

    test('handles long strings', () => {
      const original = 'x'.repeat(10000);
      const encrypted = vault.encrypt(original);
      const decrypted = vault.decrypt(encrypted);
      assert.strictEqual(decrypted, original);
    });

    test('decrypt returns null for invalid ciphertext', () => {
      const result = vault.decrypt('invalid-base64-!!!');
      assert.strictEqual(result, null);
    });

    test('decrypt returns null for tampered ciphertext', () => {
      const encrypted = vault.encrypt('secret');
      // Tamper with the encrypted value
      const tampered = 'A' + encrypted.slice(1);
      const result = vault.decrypt(tampered);
      assert.strictEqual(result, null);
    });
  });

  describe('getCredentialsPath', () => {
    test('returns correct path for tenant', () => {
      const tenantPath = vault.getCredentialsPath('client_demo');
      assert.ok(tenantPath.includes('clients'));
      assert.ok(tenantPath.includes('client_demo'));
      assert.ok(tenantPath.endsWith('credentials.json'));
    });

    test('handles tenant IDs with special characters', () => {
      const tenantPath = vault.getCredentialsPath('client-with-dashes');
      assert.ok(tenantPath.includes('client-with-dashes'));
    });
  });

  describe('caching', () => {
    test('cache is initialized as empty Map', () => {
      assert.ok(vault.cache instanceof Map);
      assert.strictEqual(vault.cache.size, 0);
    });

    test('cacheExpiry is 5 minutes', () => {
      assert.strictEqual(vault.cacheExpiry, 5 * 60 * 1000);
    });
  });

  describe('loadFromEnv', () => {
    test('returns object', () => {
      const result = vault.loadFromEnv();
      assert.strictEqual(typeof result, 'object');
    });

    test('picks up set env vars', () => {
      const orig = process.env.HUBSPOT_ACCESS_TOKEN;
      process.env.HUBSPOT_ACCESS_TOKEN = 'test-token-123';
      const result = vault.loadFromEnv();
      assert.strictEqual(result.HUBSPOT_ACCESS_TOKEN, 'test-token-123');
      if (orig) process.env.HUBSPOT_ACCESS_TOKEN = orig;
      else delete process.env.HUBSPOT_ACCESS_TOKEN;
    });

    test('skips unset env vars', () => {
      const orig = process.env.SHOPIFY_ACCESS_TOKEN;
      delete process.env.SHOPIFY_ACCESS_TOKEN;
      const result = vault.loadFromEnv();
      assert.strictEqual(result.SHOPIFY_ACCESS_TOKEN, undefined);
      if (orig) process.env.SHOPIFY_ACCESS_TOKEN = orig;
    });

    test('reads multiple env vars', () => {
      const origSid = process.env.TWILIO_ACCOUNT_SID;
      const origAuth = process.env.TWILIO_AUTH_TOKEN;
      process.env.TWILIO_ACCOUNT_SID = 'ACtest';
      process.env.TWILIO_AUTH_TOKEN = 'authtest';
      const result = vault.loadFromEnv();
      assert.strictEqual(result.TWILIO_ACCOUNT_SID, 'ACtest');
      assert.strictEqual(result.TWILIO_AUTH_TOKEN, 'authtest');
      if (origSid) process.env.TWILIO_ACCOUNT_SID = origSid;
      else delete process.env.TWILIO_ACCOUNT_SID;
      if (origAuth) process.env.TWILIO_AUTH_TOKEN = origAuth;
      else delete process.env.TWILIO_AUTH_TOKEN;
    });
  });

  describe('getCredentialsPath', () => {
    test('produces consistent path for same tenant', () => {
      const p1 = vault.getCredentialsPath('abc');
      const p2 = vault.getCredentialsPath('abc');
      assert.strictEqual(p1, p2);
    });

    test('different tenants get different paths', () => {
      const p1 = vault.getCredentialsPath('tenant_a');
      const p2 = vault.getCredentialsPath('tenant_b');
      assert.notStrictEqual(p1, p2);
    });
  });

  describe('loadCredentials', () => {
    test('returns object for nonexistent tenant', async () => {
      const creds = await vault.loadCredentials('__nonexistent_sv_test__');
      assert.strictEqual(typeof creds, 'object');
    });

    test('caches result on second call', async () => {
      await vault.loadCredentials('__sv_cache_test__');
      // Should be cached now
      const cached = vault.cache.get('creds___sv_cache_test__');
      assert.ok(cached);
      assert.ok(cached.data);
      assert.ok(cached.timestamp);
    });

    test('returns cached data within TTL', async () => {
      vault.cache.set('creds___sv_cached__', { data: { KEY: 'cached_val' }, timestamp: Date.now() });
      const creds = await vault.loadCredentials('__sv_cached__');
      assert.strictEqual(creds.KEY, 'cached_val');
    });

    test('expired cache returns fresh data', async () => {
      vault.cache.set('creds___sv_expired__', { data: { KEY: 'old' }, timestamp: Date.now() - 10 * 60 * 1000 });
      const creds = await vault.loadCredentials('__sv_expired__');
      // Should NOT return 'old' since cache is expired
      assert.notStrictEqual(creds.KEY, 'old');
    });
  });

  describe('getSecret', () => {
    test('returns defaultValue for missing key', async () => {
      const val = await vault.getSecret('__sv_secret_test__', 'NONEXISTENT', 'fallback');
      assert.strictEqual(val, 'fallback');
    });

    test('returns null defaultValue by default', async () => {
      const val = await vault.getSecret('__sv_secret_test2__', 'NONEXISTENT');
      assert.strictEqual(val, null);
    });

    test('returns value from cache', async () => {
      vault.cache.set('creds___sv_gs__', { data: { MY_KEY: 'my_val' }, timestamp: Date.now() });
      const val = await vault.getSecret('__sv_gs__', 'MY_KEY');
      assert.strictEqual(val, 'my_val');
    });
  });

  describe('getAllSecrets', () => {
    test('returns same as loadCredentials', async () => {
      vault.cache.set('creds___sv_all__', { data: { A: '1', B: '2' }, timestamp: Date.now() });
      const all = await vault.getAllSecrets('__sv_all__');
      assert.strictEqual(all.A, '1');
      assert.strictEqual(all.B, '2');
    });
  });

  describe('checkRequired', () => {
    test('valid when all keys present', async () => {
      vault.cache.set('creds___sv_cr1__', { data: { KEY1: 'v1', KEY2: 'v2' }, timestamp: Date.now() });
      const result = await vault.checkRequired('__sv_cr1__', ['KEY1', 'KEY2']);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.missing.length, 0);
    });

    test('invalid when keys missing', async () => {
      vault.cache.set('creds___sv_cr2__', { data: { KEY1: 'v1' }, timestamp: Date.now() });
      const result = await vault.checkRequired('__sv_cr2__', ['KEY1', 'KEY2', 'KEY3']);
      assert.strictEqual(result.valid, false);
      assert.ok(result.missing.includes('KEY2'));
      assert.ok(result.missing.includes('KEY3'));
    });

    test('empty required list is always valid', async () => {
      const result = await vault.checkRequired('__sv_cr3__', []);
      assert.strictEqual(result.valid, true);
    });
  });

  describe('listTenants', () => {
    test('returns array', () => {
      const tenants = vault.listTenants();
      assert.ok(Array.isArray(tenants));
    });

    test('returns strings', () => {
      const tenants = vault.listTenants();
      for (const t of tenants) {
        assert.strictEqual(typeof t, 'string');
      }
    });

    test('does not include hidden directories', () => {
      const tenants = vault.listTenants();
      for (const t of tenants) {
        assert.ok(!t.startsWith('_'), `Should not include ${t}`);
      }
    });
  });

  describe('exports', () => {
    test('exports SecretVault class', () => {
      assert.strictEqual(typeof SecretVault, 'function');
    });

    test('default export is instance', () => {
      const mod = require('../core/SecretVault.cjs');
      assert.ok(mod instanceof SecretVault);
    });

    test('instance has all methods', () => {
      const methods = ['encrypt', 'decrypt', 'getCredentialsPath', 'loadCredentials',
        'loadFromEnv', 'getSecret', 'getAllSecrets', 'saveCredentials',
        'checkRequired', 'listTenants', 'healthCheck'];
      for (const m of methods) {
        assert.strictEqual(typeof vault[m], 'function', `Missing method: ${m}`);
      }
    });
  });
});
