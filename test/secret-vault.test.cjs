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
});

// Run test summary
console.log('\n🔐 SecretVault Tests Complete\n');
