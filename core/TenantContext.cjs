#!/usr/bin/env node
/**
 * TenantContext - Build Execution Context for Multi-Tenant Scripts
 *
 * Provides isolated execution context with:
 * - Credentials from SecretVault (or fallback)
 * - Tenant configuration
 * - Isolated logger
 * - Integration status
 *
 * @module TenantContext
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const TenantLogger = require('./TenantLogger.cjs');

class TenantContext {
  /**
   * Build execution context for a tenant
   * @param {string} tenantId - Tenant identifier
   * @param {Object} options - Context options
   */
  constructor(tenantId, options = {}) {
    this.tenantId = tenantId;
    this.scriptName = options.scriptName || 'unknown';
    this.runId = options.runId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.startTime = Date.now();
    this.params = options.params || {};

    // Paths
    this.clientDir = path.join(process.cwd(), '..', 'clients', tenantId);
    this.configPath = path.join(this.clientDir, 'config.json');
    this.credentialsPath = path.join(this.clientDir, 'credentials.json');

    // Initialize
    this.config = null;
    this.secrets = {};
    this.integrations = {};
    this.logger = new TenantLogger(tenantId, {
      scriptName: this.scriptName,
      runId: this.runId,
    });
  }

  /**
   * Load tenant configuration
   */
  async loadConfig() {
    if (!fs.existsSync(this.configPath)) {
      throw new Error(`Tenant config not found: ${this.tenantId}`);
    }

    try {
      this.config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      this.integrations = this.config.integrations || {};
      return this.config;
    } catch (error) {
      throw new Error(`Failed to parse tenant config: ${error.message}`);
    }
  }

  /**
   * Load credentials from vault or fallback
   */
  async loadSecrets() {
    // Try SecretVault first
    try {
      const vault = require('./SecretVault.cjs');
      const vaultSecrets = await vault.getAllSecrets(this.tenantId);

      if (vaultSecrets && typeof vaultSecrets === 'object') {
        for (const [key, value] of Object.entries(vaultSecrets)) {
          this.secrets[key] = value;
        }
        this.logger.debug('Loaded secrets from vault', { count: Object.keys(vaultSecrets).length });
        return this.secrets;
      }
    } catch (error) {
      this.logger.debug('Vault not available, using fallback', { error: error.message });
    }

    // Fallback to credentials file
    if (fs.existsSync(this.credentialsPath)) {
      try {
        const creds = JSON.parse(fs.readFileSync(this.credentialsPath, 'utf8'));
        this.secrets = { ...creds };
        this.logger.debug('Loaded secrets from file', { count: Object.keys(creds).length });
      } catch (error) {
        this.logger.warn('Failed to load credentials file', { error: error.message });
      }
    }

    return this.secrets;
  }

  /**
   * Build complete execution context
   */
  async build() {
    await this.loadConfig();
    await this.loadSecrets();

    // Build context object
    const context = {
      // Identifiers
      tenantId: this.tenantId,
      runId: this.runId,
      scriptName: this.scriptName,
      startTime: this.startTime,

      // Configuration
      config: this.config,
      params: this.params,

      // Credentials (isolated)
      secrets: this.secrets,

      // Integration status
      integrations: this.integrations,

      // Logger
      logger: this.logger,

      // Helper methods
      getSecret: (key, defaultValue = null) => this.secrets[key] || defaultValue,
      hasIntegration: (name) => this.integrations[name]?.enabled === true,
      getIntegration: (name) => this.integrations[name] || null,

      // Duration helper
      getDuration: () => Date.now() - this.startTime,
    };

    this.logger.debug('Context built', {
      secretsCount: Object.keys(this.secrets).length,
      integrationsCount: Object.keys(this.integrations).length,
    });

    return context;
  }

  /**
   * Check if required integrations are available
   */
  checkRequiredIntegrations(required = []) {
    const missing = [];
    for (const integration of required) {
      if (!this.integrations[integration]?.enabled) {
        missing.push(integration);
      }
    }
    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * Check if required secrets are available
   */
  checkRequiredSecrets(required = []) {
    const missing = [];
    for (const key of required) {
      if (!this.secrets[key]) {
        missing.push(key);
      }
    }
    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * Get Shopify credentials if available
   */
  getShopifyCredentials() {
    if (!this.integrations.shopify?.enabled) {
      return null;
    }

    return {
      store: this.secrets.SHOPIFY_STORE || this.integrations.shopify.shop_domain,
      accessToken: this.secrets.SHOPIFY_ACCESS_TOKEN,
      apiVersion: this.secrets.SHOPIFY_API_VERSION || '2024-01',
    };
  }

  /**
   * Get Klaviyo credentials if available
   */
  getKlaviyoCredentials() {
    if (!this.integrations.klaviyo?.enabled) {
      return null;
    }

    return {
      apiKey: this.secrets.KLAVIYO_API_KEY || this.secrets.KLAVIYO_ACCESS_TOKEN,
      accountId: this.secrets.KLAVIYO_ACCOUNT_ID || this.integrations.klaviyo.account_id,
    };
  }

  /**
   * Get Google credentials if available
   */
  getGoogleCredentials() {
    if (!this.integrations.google?.enabled) {
      return null;
    }

    return {
      accessToken: this.secrets.GOOGLE_ACCESS_TOKEN,
      refreshToken: this.secrets.GOOGLE_REFRESH_TOKEN,
      propertyId: this.secrets.GA4_PROPERTY_ID,
      siteUrl: this.secrets.GSC_SITE_URL,
    };
  }

  /**
   * Static method to build context quickly
   */
  static async build(tenantId, options = {}) {
    const ctx = new TenantContext(tenantId, options);
    return ctx.build();
  }

  /**
   * List all available tenants
   */
  static listTenants() {
    const clientsDir = path.join(process.cwd(), '..', 'clients');

    if (!fs.existsSync(clientsDir)) {
      return [];
    }

    const dirs = fs.readdirSync(clientsDir, { withFileTypes: true });
    const tenants = [];

    for (const dir of dirs) {
      if (!dir.isDirectory() || dir.name.startsWith('_')) continue;

      const configPath = path.join(clientsDir, dir.name, 'config.json');
      if (!fs.existsSync(configPath)) continue;

      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        tenants.push({
          id: dir.name,
          name: config.name || dir.name,
          vertical: config.vertical,
          status: config.status,
          integrations: Object.keys(config.integrations || {}).filter(
            k => config.integrations[k]?.enabled
          ),
        });
      } catch {
        continue;
      }
    }

    return tenants;
  }
}

module.exports = TenantContext;

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    console.log(`
TenantContext - Build Execution Context for Multi-Tenant Scripts

Usage:
  node TenantContext.cjs --tenant <id> --show
  node TenantContext.cjs --list

Options:
  --tenant <id>     Tenant ID
  --show            Show tenant context (secrets masked)
  --list            List all tenants
  --check-secrets   Check required secrets
  --check-integrations  Check required integrations
`);
    process.exit(0);
  }

  if (args.includes('--list')) {
    const tenants = TenantContext.listTenants();
    console.log(JSON.stringify(tenants, null, 2));
    process.exit(0);
  }

  const tenantIdx = args.indexOf('--tenant');
  const tenantId = tenantIdx !== -1 ? args[tenantIdx + 1] : null;

  if (!tenantId) {
    console.error('Error: --tenant is required');
    process.exit(1);
  }

  (async () => {
    try {
      const ctx = new TenantContext(tenantId, { scriptName: 'cli' });
      const context = await ctx.build();

      if (args.includes('--show')) {
        // Mask secrets
        const maskedSecrets = {};
        for (const key of Object.keys(context.secrets)) {
          const value = context.secrets[key];
          maskedSecrets[key] = value ? `${value.substring(0, 4)}...${value.slice(-4)}` : null;
        }

        console.log(JSON.stringify({
          tenantId: context.tenantId,
          config: context.config,
          integrations: context.integrations,
          secrets: maskedSecrets,
        }, null, 2));
      }

      if (args.includes('--check-secrets')) {
        const secretsIdx = args.indexOf('--check-secrets');
        const required = args[secretsIdx + 1]?.split(',') || [];
        const result = ctx.checkRequiredSecrets(required);
        console.log(JSON.stringify(result, null, 2));
        process.exit(result.valid ? 0 : 1);
      }

      if (args.includes('--check-integrations')) {
        const intIdx = args.indexOf('--check-integrations');
        const required = args[intIdx + 1]?.split(',') || [];
        const result = ctx.checkRequiredIntegrations(required);
        console.log(JSON.stringify(result, null, 2));
        process.exit(result.valid ? 0 : 1);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  })();
}
