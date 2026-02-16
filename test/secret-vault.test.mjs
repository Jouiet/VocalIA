/**
 * SecretVault Unit Tests
 *
 * Tests encryption, decryption, and credential management.
 * Run: node --test test/secret-vault.test.mjs
 *
 * @session 250.6
 */

// Set test encryption key BEFORE loading SecretVault (CJS module reads env at load time)
process.env.VOCALIA_VAULT_KEY = 'test-key-32-chars-for-aes256-!!';

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import { createRequire } from 'node:module';

// Use createRequire to load SecretVault AFTER env is set
// (ESM import hoisting would load it before process.env assignment)
const require = createRequire(import.meta.url);
const mod = require('../core/SecretVault.cjs');
const SecretVault = mod.SecretVault || mod;

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
      const value = 'test-value';
      const enc1 = vault.encrypt(value);
      const enc2 = vault.encrypt(value);
      assert.notStrictEqual(enc1, enc2, 'Each encryption should produce different output');
      assert.strictEqual(vault.decrypt(enc1), value);
      assert.strictEqual(vault.decrypt(enc2), value);
    });

    test('handles empty string', () => {
      const encrypted = vault.encrypt('');
      assert.strictEqual(vault.decrypt(encrypted), '');
    });

    test('handles unicode characters', () => {
      const unicode = 'مرحبا بكم في VocalIA 🎙️';
      const encrypted = vault.encrypt(unicode);
      assert.strictEqual(vault.decrypt(encrypted), unicode);
    });

    test('handles long strings', () => {
      const longStr = 'A'.repeat(10000);
      const encrypted = vault.encrypt(longStr);
      assert.strictEqual(vault.decrypt(encrypted), longStr);
    });

    test('decrypt returns null for invalid ciphertext', () => {
      const result = vault.decrypt('not-valid-base64-!@#');
      assert.strictEqual(result, null);
    });

    test('decrypt returns null for tampered ciphertext', () => {
      const encrypted = vault.encrypt('test');
      const tampered = encrypted.slice(0, -4) + 'XXXX';
      const result = vault.decrypt(tampered);
      assert.strictEqual(result, null);
    });
  });

  describe('getCredentialsPath', () => {
    test('returns correct path for tenant', () => {
      const p = vault.getCredentialsPath('test-tenant');
      assert.ok(p.includes('test-tenant'));
      assert.ok(p.endsWith('.json'));
    });
  });

  describe('loadCredentials', () => {
    test('returns empty object for non-existent tenant', async () => {
      const creds = await vault.loadCredentials('__nonexistent_tenant_xyz__');
      assert.ok(typeof creds === 'object');
    });

    test('caches results (second call returns same object without re-reading)', async () => {
      vault.cache.clear();
      const creds1 = await vault.loadCredentials('__cache_test_tenant__');
      const creds2 = await vault.loadCredentials('__cache_test_tenant__');
      assert.deepStrictEqual(creds1, creds2);
      // Verify it was cached
      const cached = vault.cache.get('creds___cache_test_tenant__');
      assert.ok(cached, 'Should be in cache');
      assert.ok(Date.now() - cached.timestamp < 1000, 'Cache should be fresh');
    });
  });

  describe('getSecret', () => {
    test('returns null for nonexistent key in nonexistent tenant', async () => {
      const result = await vault.getSecret('__no_tenant__', 'XAI_API_KEY');
      assert.strictEqual(result, null);
    });

    test('returns defaultValue when key missing', async () => {
      const result = await vault.getSecret('__no_tenant__', 'MISSING_KEY', 'fallback_val');
      assert.strictEqual(result, 'fallback_val');
    });

    test('returns credential when present (via cache injection)', async () => {
      // Pre-populate cache with known credentials
      vault.cache.set('creds___test_secret__', {
        data: { XAI_API_KEY: 'xai-test-123', STRIPE_KEY: 'sk_test' },
        timestamp: Date.now()
      });
      const result = await vault.getSecret('__test_secret__', 'XAI_API_KEY');
      assert.strictEqual(result, 'xai-test-123');
    });
  });

  describe('getAllSecrets', () => {
    test('returns all credentials for tenant', async () => {
      vault.cache.set('creds___all_secrets_test__', {
        data: { KEY_A: 'val_a', KEY_B: 'val_b' },
        timestamp: Date.now()
      });
      const result = await vault.getAllSecrets('__all_secrets_test__');
      assert.deepStrictEqual(result, { KEY_A: 'val_a', KEY_B: 'val_b' });
    });

    test('returns empty object for unknown tenant', async () => {
      vault.cache.clear();
      const result = await vault.getAllSecrets('__unknown_tenant__');
      assert.deepStrictEqual(result, {});
    });
  });

  describe('checkRequired', () => {
    test('returns valid=true when all required keys present', async () => {
      vault.cache.set('creds___check_test__', {
        data: { A: '1', B: '2', C: '3' },
        timestamp: Date.now()
      });
      const result = await vault.checkRequired('__check_test__', ['A', 'B']);
      assert.strictEqual(result.valid, true);
      assert.deepStrictEqual(result.missing, []);
    });

    test('returns valid=false with missing keys listed', async () => {
      vault.cache.set('creds___check_test2__', {
        data: { A: '1' },
        timestamp: Date.now()
      });
      const result = await vault.checkRequired('__check_test2__', ['A', 'B', 'C']);
      assert.strictEqual(result.valid, false);
      assert.deepStrictEqual(result.missing, ['B', 'C']);
    });

    test('returns valid=false for tenant with no credentials', async () => {
      vault.cache.clear();
      const result = await vault.checkRequired('__empty_tenant__', ['SOME_KEY']);
      assert.strictEqual(result.valid, false);
      assert.deepStrictEqual(result.missing, ['SOME_KEY']);
    });
  });

  describe('loadFromEnv', () => {
    test('picks up known env vars when set', () => {
      const origXai = process.env.XAI_API_KEY;
      process.env.XAI_API_KEY = 'xai-test-env';
      try {
        const result = vault.loadFromEnv();
        assert.strictEqual(result.XAI_API_KEY, 'xai-test-env');
      } finally {
        if (origXai) process.env.XAI_API_KEY = origXai;
        else delete process.env.XAI_API_KEY;
      }
    });

    test('skips env vars that are not set', () => {
      const origHubspot = process.env.HUBSPOT_ACCESS_TOKEN;
      delete process.env.HUBSPOT_ACCESS_TOKEN;
      try {
        const result = vault.loadFromEnv();
        assert.strictEqual(result.HUBSPOT_ACCESS_TOKEN, undefined);
      } finally {
        if (origHubspot) process.env.HUBSPOT_ACCESS_TOKEN = origHubspot;
      }
    });

    test('returns object with only set env vars', () => {
      // Clear all known keys
      const saved = {};
      const envKeys = [
        'HUBSPOT_ACCESS_TOKEN', 'HUBSPOT_API_KEY', 'SHOPIFY_ACCESS_TOKEN',
        'SHOPIFY_SHOP_NAME', 'KLAVIYO_API_KEY', 'GOOGLE_CLIENT_ID',
        'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN', 'SLACK_WEBHOOK_URL',
        'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER',
        'XAI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'
      ];
      for (const k of envKeys) {
        saved[k] = process.env[k];
        delete process.env[k];
      }
      try {
        const result = vault.loadFromEnv();
        assert.deepStrictEqual(result, {});
      } finally {
        for (const [k, v] of Object.entries(saved)) {
          if (v) process.env[k] = v;
        }
      }
    });
  });

  describe('listTenants', () => {
    test('returns array of tenant directory names', () => {
      const tenants = vault.listTenants();
      assert.ok(Array.isArray(tenants));
      // Should not include _template dir (starts with _)
      assert.ok(!tenants.some(t => t.startsWith('_')),
        'Should exclude directories starting with _');
    });
  });

  describe('saveCredentials + loadCredentials roundtrip', () => {
    const fs = require('fs');
    const testTenantId = '__vault_roundtrip_test__';

    test('saves encrypted credentials and loads them back', async () => {
      const creds = { API_KEY: 'test-key-value', SECRET: 'test-secret-value' };

      // Save (encrypted)
      await vault.saveCredentials(testTenantId, creds, true);

      // Verify file was created
      const credPath = vault.getCredentialsPath(testTenantId);
      assert.ok(fs.existsSync(credPath), 'Credentials file should exist');

      // Verify file content is encrypted (not plaintext)
      const fileContent = JSON.parse(fs.readFileSync(credPath, 'utf8'));
      assert.strictEqual(fileContent._encrypted, true);
      assert.notStrictEqual(fileContent.API_KEY, 'test-key-value', 'Should be encrypted, not plaintext');

      // Load back (should decrypt)
      vault.cache.clear(); // Force reload from file
      const loaded = await vault.loadCredentials(testTenantId);
      assert.strictEqual(loaded.API_KEY, 'test-key-value');
      assert.strictEqual(loaded.SECRET, 'test-secret-value');

      // Cleanup
      try {
        fs.unlinkSync(credPath);
        const dir = path.dirname(credPath);
        fs.rmdirSync(dir);
      } catch(e) { /* best effort */ }
    });

    test('saves unencrypted credentials when encrypt=false', async () => {
      const testId = '__vault_plain_test__';
      const creds = { PLAIN_KEY: 'visible-value' };

      await vault.saveCredentials(testId, creds, false);

      const credPath = vault.getCredentialsPath(testId);
      const fileContent = JSON.parse(fs.readFileSync(credPath, 'utf8'));
      assert.strictEqual(fileContent.PLAIN_KEY, 'visible-value', 'Should be plaintext');
      assert.strictEqual(fileContent._encrypted, undefined, 'Should not have _encrypted flag');

      // Cleanup
      try {
        fs.unlinkSync(credPath);
        fs.rmdirSync(path.dirname(credPath));
      } catch(e) {}
    });
  });
});
