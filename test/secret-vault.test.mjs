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
  });
});
