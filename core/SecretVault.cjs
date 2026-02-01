#!/usr/bin/env node
/**
 * SecretVault - Per-Tenant Credential Storage
 *
 * Provides isolated credential storage for multi-tenant architecture.
 * Supports:
 * - File-based storage (development/self-hosted)
 * - Environment variable fallback
 * - Future: Infisical, HashiCorp Vault integration
 *
 * @module SecretVault
 * @version 1.0.0
 * @session 249.2
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configuration
const CLIENTS_DIR = path.join(process.cwd(), 'clients');
const ENCRYPTION_KEY = process.env.VOCALIA_VAULT_KEY || 'default-dev-key-change-in-prod';
const ALGORITHM = 'aes-256-gcm';

// Session 250.43: Warn if using default encryption key
if (!process.env.VOCALIA_VAULT_KEY) {
  console.warn('⚠️ [SecretVault] VOCALIA_VAULT_KEY not set - using default dev key. DO NOT USE IN PRODUCTION!');
}

class SecretVault {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get credentials file path for a tenant
   * @param {string} tenantId
   * @returns {string}
   */
  getCredentialsPath(tenantId) {
    return path.join(CLIENTS_DIR, tenantId, 'credentials.json');
  }

  /**
   * Encrypt a value
   * @param {string} value
   * @returns {string} Encrypted value (base64)
   */
  encrypt(value) {
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return Buffer.concat([iv, authTag, Buffer.from(encrypted, 'hex')]).toString('base64');
  }

  /**
   * Decrypt a value
   * @param {string} encryptedValue (base64)
   * @returns {string} Decrypted value
   */
  decrypt(encryptedValue) {
    try {
      const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
      const buffer = Buffer.from(encryptedValue, 'base64');

      const iv = buffer.slice(0, 16);
      const authTag = buffer.slice(16, 32);
      const encrypted = buffer.slice(32);

      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error(`[SecretVault] Decryption failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Load credentials for a tenant
   * @param {string} tenantId
   * @returns {Object} Credentials object
   */
  async loadCredentials(tenantId) {
    // Check cache first
    const cacheKey = `creds_${tenantId}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }

    const credPath = this.getCredentialsPath(tenantId);
    let credentials = {};

    // Try file-based credentials
    if (fs.existsSync(credPath)) {
      try {
        const fileContent = fs.readFileSync(credPath, 'utf8');
        const parsed = JSON.parse(fileContent);

        // Decrypt if encrypted
        if (parsed._encrypted) {
          for (const [key, value] of Object.entries(parsed)) {
            if (key !== '_encrypted' && key !== '_metadata') {
              credentials[key] = this.decrypt(value);
            }
          }
        } else {
          credentials = parsed;
        }
      } catch (error) {
        console.error(`[SecretVault] Failed to load ${tenantId}: ${error.message}`);
      }
    }

    // Fallback to environment variables for agency_internal
    if (tenantId === 'agency_internal' && Object.keys(credentials).length === 0) {
      credentials = this.loadFromEnv();
    }

    // Cache the result
    this.cache.set(cacheKey, { data: credentials, timestamp: Date.now() });

    return credentials;
  }

  /**
   * Load credentials from environment variables (fallback)
   * @returns {Object}
   */
  loadFromEnv() {
    const envKeys = [
      'HUBSPOT_ACCESS_TOKEN', 'HUBSPOT_API_KEY',
      'SHOPIFY_ACCESS_TOKEN', 'SHOPIFY_SHOP_NAME',
      'KLAVIYO_API_KEY',
      'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN',
      'SLACK_WEBHOOK_URL',
      'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER',
      'XAI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'
    ];

    const credentials = {};
    for (const key of envKeys) {
      if (process.env[key]) {
        credentials[key] = process.env[key];
      }
    }
    return credentials;
  }

  /**
   * Get a specific secret for a tenant
   * @param {string} tenantId
   * @param {string} key
   * @param {*} defaultValue
   * @returns {*}
   */
  async getSecret(tenantId, key, defaultValue = null) {
    const credentials = await this.loadCredentials(tenantId);
    return credentials[key] || defaultValue;
  }

  /**
   * Get all secrets for a tenant
   * @param {string} tenantId
   * @returns {Object}
   */
  async getAllSecrets(tenantId) {
    return this.loadCredentials(tenantId);
  }

  /**
   * Save credentials for a tenant (encrypted)
   * @param {string} tenantId
   * @param {Object} credentials
   * @param {boolean} encrypt - Whether to encrypt
   */
  async saveCredentials(tenantId, credentials, encrypt = true) {
    const clientDir = path.join(CLIENTS_DIR, tenantId);

    // Ensure directory exists
    if (!fs.existsSync(clientDir)) {
      fs.mkdirSync(clientDir, { recursive: true });
    }

    const credPath = this.getCredentialsPath(tenantId);
    let toSave = {};

    if (encrypt) {
      toSave._encrypted = true;
      toSave._metadata = {
        updated_at: new Date().toISOString(),
        algorithm: ALGORITHM
      };
      for (const [key, value] of Object.entries(credentials)) {
        if (value && typeof value === 'string') {
          toSave[key] = this.encrypt(value);
        }
      }
    } else {
      toSave = { ...credentials };
    }

    fs.writeFileSync(credPath, JSON.stringify(toSave, null, 2));

    // Invalidate cache
    this.cache.delete(`creds_${tenantId}`);

    console.log(`[SecretVault] Saved credentials for ${tenantId}`);
  }

  /**
   * Check if tenant has required credentials
   * @param {string} tenantId
   * @param {string[]} required
   * @returns {Object} { valid: boolean, missing: string[] }
   */
  async checkRequired(tenantId, required) {
    const credentials = await this.loadCredentials(tenantId);
    const missing = [];

    for (const key of required) {
      if (!credentials[key]) {
        missing.push(key);
      }
    }

    return {
      valid: missing.length === 0,
      missing
    };
  }

  /**
   * List all tenants with credentials
   * @returns {string[]}
   */
  listTenants() {
    if (!fs.existsSync(CLIENTS_DIR)) {
      return [];
    }

    const dirs = fs.readdirSync(CLIENTS_DIR, { withFileTypes: true });
    return dirs
      .filter(d => d.isDirectory() && !d.name.startsWith('_'))
      .map(d => d.name);
  }

  /**
   * Health check
   */
  async healthCheck() {
    console.log('\n=== SecretVault Health Check ===\n');

    const tenants = this.listTenants();
    console.log(`Tenants found: ${tenants.length}`);

    for (const tenantId of tenants) {
      const creds = await this.loadCredentials(tenantId);
      const count = Object.keys(creds).length;
      console.log(`  ${tenantId}: ${count} credentials`);
    }

    // Check agency_internal fallback
    const agencyCreds = await this.loadCredentials('agency_internal');
    const envFallback = Object.keys(agencyCreds).length > 0;
    console.log(`\nEnv fallback (agency_internal): ${envFallback ? '✅' : '❌'}`);

    console.log('\n=== SecretVault: OK ===\n');

    return {
      status: 'healthy',
      tenants: tenants.length,
      envFallback
    };
  }
}

// Singleton instance
const vault = new SecretVault();

module.exports = vault;
module.exports.SecretVault = SecretVault;

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--health')) {
    vault.healthCheck();
  } else if (args.includes('--list')) {
    console.log(vault.listTenants());
  } else if (args.includes('--get') && args.length >= 3) {
    const tenantId = args[args.indexOf('--get') + 1];
    vault.loadCredentials(tenantId).then(creds => {
      const masked = {};
      for (const [k, v] of Object.entries(creds)) {
        masked[k] = v ? `${v.substring(0, 4)}...${v.slice(-4)}` : null;
      }
      console.log(JSON.stringify(masked, null, 2));
    });
  } else {
    console.log(`
SecretVault - Per-Tenant Credential Storage

Usage:
  node SecretVault.cjs --health          # Health check
  node SecretVault.cjs --list            # List tenants
  node SecretVault.cjs --get <tenantId>  # Get credentials (masked)
`);
  }
}
