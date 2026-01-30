#!/usr/bin/env node
/**
 * OAuthGateway - Multi-Tenant OAuth Flow Handler
 *
 * Handles OAuth 2.0 flows for clients to connect their external accounts.
 * Supports: Google, HubSpot, Shopify, Slack
 *
 * Session 249.2 - Multi-Tenant Phase 0
 *
 * @module OAuthGateway
 * @version 1.0.0
 */

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SecretVault = require('./SecretVault.cjs');

// OAuth Provider Configurations
const OAUTH_PROVIDERS = {
  google: {
    name: 'Google',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: {
      calendar: 'https://www.googleapis.com/auth/calendar',
      sheets: 'https://www.googleapis.com/auth/spreadsheets',
      drive: 'https://www.googleapis.com/auth/drive.file',
      gmail: 'https://www.googleapis.com/auth/gmail.readonly'
    },
    clientIdEnv: 'GOOGLE_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_CLIENT_SECRET'
  },
  hubspot: {
    name: 'HubSpot',
    authUrl: 'https://app.hubspot.com/oauth/authorize',
    tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
    scopes: {
      crm: 'crm.objects.contacts.read crm.objects.contacts.write crm.objects.companies.read crm.objects.deals.read'
    },
    clientIdEnv: 'HUBSPOT_CLIENT_ID',
    clientSecretEnv: 'HUBSPOT_CLIENT_SECRET'
  },
  shopify: {
    name: 'Shopify',
    // Shopify uses custom app URLs
    authUrlTemplate: 'https://{shop}.myshopify.com/admin/oauth/authorize',
    tokenUrlTemplate: 'https://{shop}.myshopify.com/admin/oauth/access_token',
    scopes: {
      default: 'read_orders,read_products,read_customers'
    },
    clientIdEnv: 'SHOPIFY_API_KEY',
    clientSecretEnv: 'SHOPIFY_API_SECRET'
  },
  slack: {
    name: 'Slack',
    authUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    scopes: {
      default: 'incoming-webhook,chat:write'
    },
    clientIdEnv: 'SLACK_CLIENT_ID',
    clientSecretEnv: 'SLACK_CLIENT_SECRET'
  }
};

// State storage for CSRF protection
const pendingStates = new Map();

class OAuthGateway {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || process.env.OAUTH_BASE_URL || 'http://localhost:3010';
    this.port = options.port || parseInt(process.env.OAUTH_PORT) || 3010;
    this.app = null;
    this.server = null;
  }

  /**
   * Generate a secure state token
   */
  generateState(tenantId, provider, scopes) {
    const state = crypto.randomBytes(32).toString('hex');
    pendingStates.set(state, {
      tenantId,
      provider,
      scopes,
      createdAt: Date.now()
    });
    // Auto-cleanup after 10 minutes
    setTimeout(() => pendingStates.delete(state), 10 * 60 * 1000);
    return state;
  }

  /**
   * Verify and consume a state token
   */
  verifyState(state) {
    const data = pendingStates.get(state);
    if (data) {
      pendingStates.delete(state);
      return data;
    }
    return null;
  }

  /**
   * Get OAuth authorization URL for a provider
   */
  getAuthUrl(tenantId, provider, scopeKeys = ['default']) {
    const config = OAUTH_PROVIDERS[provider];
    if (!config) {
      throw new Error(`Unknown OAuth provider: ${provider}`);
    }

    const clientId = process.env[config.clientIdEnv];
    if (!clientId) {
      throw new Error(`Missing ${config.clientIdEnv} environment variable`);
    }

    // Build scopes
    const scopes = scopeKeys.map(key => config.scopes[key] || key).join(' ');

    // Generate state
    const state = this.generateState(tenantId, provider, scopeKeys);

    // Build callback URL
    const redirectUri = `${this.baseUrl}/oauth/callback/${provider}`;

    // Build auth URL
    let authUrl = config.authUrl;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes,
      state: state,
      access_type: 'offline', // For refresh tokens (Google)
      prompt: 'consent' // Force consent to get refresh token (Google)
    });

    return `${authUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(provider, code, state) {
    const stateData = this.verifyState(state);
    if (!stateData) {
      throw new Error('Invalid or expired state token');
    }

    const config = OAUTH_PROVIDERS[provider];
    const clientId = process.env[config.clientIdEnv];
    const clientSecret = process.env[config.clientSecretEnv];

    if (!clientId || !clientSecret) {
      throw new Error(`Missing OAuth credentials for ${provider}`);
    }

    const redirectUri = `${this.baseUrl}/oauth/callback/${provider}`;

    // Exchange code for tokens
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const tokens = await response.json();

    // Save tokens to SecretVault for the tenant
    await this.saveTokens(stateData.tenantId, provider, tokens);

    return {
      tenantId: stateData.tenantId,
      provider,
      scopes: stateData.scopes,
      success: true
    };
  }

  /**
   * Save tokens to SecretVault
   */
  async saveTokens(tenantId, provider, tokens) {
    // Load existing credentials
    const existing = await SecretVault.loadCredentials(tenantId);

    // Map tokens to standard env variable names
    const credentialMapping = {
      google: {
        access_token: 'GOOGLE_ACCESS_TOKEN',
        refresh_token: 'GOOGLE_REFRESH_TOKEN'
      },
      hubspot: {
        access_token: 'HUBSPOT_ACCESS_TOKEN',
        refresh_token: 'HUBSPOT_REFRESH_TOKEN'
      },
      shopify: {
        access_token: 'SHOPIFY_ACCESS_TOKEN'
      },
      slack: {
        access_token: 'SLACK_ACCESS_TOKEN',
        incoming_webhook: 'SLACK_WEBHOOK_URL'
      }
    };

    const mapping = credentialMapping[provider];
    const newCredentials = { ...existing };

    for (const [tokenKey, envKey] of Object.entries(mapping)) {
      if (tokens[tokenKey]) {
        newCredentials[envKey] = tokens[tokenKey];
      }
    }

    // Handle Slack webhook specially
    if (provider === 'slack' && tokens.incoming_webhook?.url) {
      newCredentials.SLACK_WEBHOOK_URL = tokens.incoming_webhook.url;
    }

    // Save to vault
    await SecretVault.saveCredentials(tenantId, newCredentials, false);

    console.log(`[OAuthGateway] Saved ${provider} tokens for tenant: ${tenantId}`);
  }

  /**
   * Start the OAuth callback server
   */
  start() {
    this.app = express();

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', service: 'OAuthGateway', version: '1.0.0' });
    });

    // Initiate OAuth flow
    this.app.get('/oauth/start/:provider', (req, res) => {
      const { provider } = req.params;
      const { tenantId, scopes } = req.query;

      if (!tenantId) {
        return res.status(400).json({ error: 'tenantId is required' });
      }

      try {
        const scopeKeys = scopes ? scopes.split(',') : ['default'];
        const authUrl = this.getAuthUrl(tenantId, provider, scopeKeys);
        res.redirect(authUrl);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // OAuth callback
    this.app.get('/oauth/callback/:provider', async (req, res) => {
      const { provider } = req.params;
      const { code, state, error } = req.query;

      if (error) {
        return res.status(400).send(`
          <html><body>
            <h1>OAuth Error</h1>
            <p>${error}</p>
            <script>window.close();</script>
          </body></html>
        `);
      }

      try {
        const result = await this.exchangeCode(provider, code, state);
        res.send(`
          <html><body>
            <h1>✅ Connected Successfully!</h1>
            <p>${OAUTH_PROVIDERS[provider].name} connected for tenant: ${result.tenantId}</p>
            <p>You can close this window.</p>
            <script>
              setTimeout(() => window.close(), 3000);
            </script>
          </body></html>
        `);
      } catch (error) {
        res.status(400).send(`
          <html><body>
            <h1>❌ Connection Failed</h1>
            <p>${error.message}</p>
          </body></html>
        `);
      }
    });

    // List available providers
    this.app.get('/oauth/providers', (req, res) => {
      const providers = Object.entries(OAUTH_PROVIDERS).map(([key, config]) => ({
        id: key,
        name: config.name,
        scopes: Object.keys(config.scopes)
      }));
      res.json({ providers });
    });

    this.server = this.app.listen(this.port, () => {
      console.log(`[OAuthGateway] Running on ${this.baseUrl}`);
      console.log(`[OAuthGateway] Providers: ${Object.keys(OAUTH_PROVIDERS).join(', ')}`);
    });
  }

  /**
   * Stop the server
   */
  stop() {
    if (this.server) {
      this.server.close();
      console.log('[OAuthGateway] Stopped');
    }
  }

  /**
   * Health check
   */
  healthCheck() {
    console.log('\n=== OAuthGateway Health Check ===\n');
    console.log('Providers configured:');

    for (const [key, config] of Object.entries(OAUTH_PROVIDERS)) {
      const clientId = process.env[config.clientIdEnv];
      const clientSecret = process.env[config.clientSecretEnv];
      const status = clientId && clientSecret ? '✅' : '❌';
      console.log(`  ${status} ${config.name}: ${clientId ? 'configured' : 'missing credentials'}`);
    }

    console.log(`\nBase URL: ${this.baseUrl}`);
    console.log(`Port: ${this.port}`);
    console.log('\n=== OAuthGateway: OK ===\n');
  }
}

// Singleton instance
const gateway = new OAuthGateway();

module.exports = gateway;
module.exports.OAuthGateway = OAuthGateway;
module.exports.OAUTH_PROVIDERS = OAUTH_PROVIDERS;

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--health')) {
    gateway.healthCheck();
  } else if (args.includes('--start')) {
    gateway.start();
  } else if (args.includes('--get-url')) {
    const providerIdx = args.indexOf('--provider');
    const tenantIdx = args.indexOf('--tenant');
    const provider = providerIdx !== -1 ? args[providerIdx + 1] : 'google';
    const tenantId = tenantIdx !== -1 ? args[tenantIdx + 1] : 'agency_internal';

    try {
      const url = gateway.getAuthUrl(tenantId, provider, ['calendar', 'sheets']);
      console.log('Auth URL:', url);
    } catch (e) {
      console.error('Error:', e.message);
    }
  } else {
    console.log(`
OAuthGateway - Multi-Tenant OAuth Flow Handler

Usage:
  node OAuthGateway.cjs --health              # Check provider configuration
  node OAuthGateway.cjs --start               # Start callback server (port ${gateway.port})
  node OAuthGateway.cjs --get-url --provider google --tenant agency_internal

Environment Variables:
  OAUTH_BASE_URL   Base URL for callbacks (default: http://localhost:3010)
  OAUTH_PORT       Server port (default: 3010)
  GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET     Google OAuth
  HUBSPOT_CLIENT_ID, HUBSPOT_CLIENT_SECRET   HubSpot OAuth
  SHOPIFY_API_KEY, SHOPIFY_API_SECRET        Shopify OAuth
  SLACK_CLIENT_ID, SLACK_CLIENT_SECRET       Slack OAuth
`);
  }
}
