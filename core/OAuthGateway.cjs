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
    loginScopes: 'openid email profile',
    profileUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    clientIdEnv: 'GOOGLE_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_CLIENT_SECRET'
  },
  github: {
    name: 'GitHub',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scopes: {
      default: 'read:user user:email'
    },
    loginScopes: 'read:user user:email',
    profileUrl: 'https://api.github.com/user',
    emailsUrl: 'https://api.github.com/user/emails',
    clientIdEnv: 'GITHUB_CLIENT_ID',
    clientSecretEnv: 'GITHUB_CLIENT_SECRET'
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
      default: 'incoming-webhook,chat:write,app_mentions:read,im:history,im:read,im:write,users:read'
    },
    // SSO Login via Slack OIDC
    loginAuthUrl: 'https://slack.com/openid/connect/authorize',
    loginTokenUrl: 'https://slack.com/api/openid.connect.token',
    loginScopes: 'openid email profile',
    profileUrl: 'https://slack.com/api/openid.connect.userInfo',
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
    // Auto-cleanup after 10 minutes (unref to not keep process alive)
    const timer = setTimeout(() => pendingStates.delete(state), 10 * 60 * 1000);
    if (timer.unref) timer.unref();
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
      },
      github: {
        access_token: 'GITHUB_ACCESS_TOKEN'
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

    // Save to vault under VocalIA tenant ID
    await SecretVault.saveCredentials(tenantId, newCredentials, false);

    // B17 fix: Slack webhooks arrive with team_id as tenant identifier.
    // Duplicate credentials under slack_${team_id} so the webhook handler finds them.
    if (provider === 'slack' && tokens.team?.id) {
      const slackTenantId = `slack_${tokens.team.id}`;
      newCredentials.VOCALIA_TENANT_ID = tenantId; // Back-reference to original tenant
      await SecretVault.saveCredentials(slackTenantId, newCredentials, false);
      console.log(`[OAuthGateway] Saved Slack tokens also under: ${slackTenantId}`);
    }

    console.log(`[OAuthGateway] Saved ${provider} tokens for tenant: ${tenantId}`);
  }

  /**
   * Get OAuth login URL (for SSO authentication, NOT integration)
   */
  getLoginAuthUrl(provider) {
    const config = OAUTH_PROVIDERS[provider];
    if (!config) throw new Error(`Unknown OAuth provider: ${provider}`);
    if (!config.loginScopes) throw new Error(`Provider ${provider} does not support login`);

    const clientId = process.env[config.clientIdEnv];
    if (!clientId) throw new Error(`Missing ${config.clientIdEnv} environment variable`);

    const state = crypto.randomBytes(32).toString('hex');
    pendingStates.set(state, {
      tenantId: '__login__',
      provider,
      scopes: ['login'],
      createdAt: Date.now()
    });
    const timer = setTimeout(() => pendingStates.delete(state), 10 * 60 * 1000);
    if (timer.unref) timer.unref();

    const redirectUri = `${this.baseUrl}/oauth/login/callback/${provider}`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: config.loginScopes,
      state: state
    });

    if (provider === 'google') {
      params.set('prompt', 'select_account');
    }

    const authBase = config.loginAuthUrl || config.authUrl;
    return `${authBase}?${params.toString()}`;
  }

  /**
   * Exchange login code and fetch user profile from provider
   */
  async exchangeLoginCode(provider, code, state) {
    const stateData = this.verifyState(state);
    if (!stateData || stateData.tenantId !== '__login__') {
      throw new Error('Invalid or expired login state token');
    }

    const config = OAUTH_PROVIDERS[provider];
    const clientId = process.env[config.clientIdEnv];
    const clientSecret = process.env[config.clientSecretEnv];

    if (!clientId || !clientSecret) {
      throw new Error(`Missing OAuth credentials for ${provider}`);
    }

    const redirectUri = `${this.baseUrl}/oauth/login/callback/${provider}`;

    // Exchange code for tokens
    const tokenHeaders = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (provider === 'github') {
      tokenHeaders['Accept'] = 'application/json';
    }

    const loginTokenUrl = config.loginTokenUrl || config.tokenUrl;
    const tokenResponse = await fetch(loginTokenUrl, {
      method: 'POST',
      headers: tokenHeaders,
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const tokens = await tokenResponse.json();
    const accessToken = tokens.access_token;
    if (!accessToken) throw new Error('No access token received');

    // Fetch user profile
    const profileResponse = await fetch(config.profileUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'User-Agent': 'VocalIA-OAuth/1.0'
      }
    });

    if (!profileResponse.ok) {
      throw new Error('Failed to fetch user profile from provider');
    }

    const profile = await profileResponse.json();

    // Normalize profile across providers
    if (provider === 'google') {
      return {
        email: profile.email,
        name: profile.name || profile.given_name || '',
        avatar: profile.picture || null,
        provider: 'google',
        providerId: profile.id
      };
    }

    if (provider === 'github') {
      let email = profile.email;
      // GitHub may not return email in profile — fetch from /user/emails
      if (!email && config.emailsUrl) {
        const emailsResponse = await fetch(config.emailsUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
            'User-Agent': 'VocalIA-OAuth/1.0'
          }
        });
        if (emailsResponse.ok) {
          const emails = await emailsResponse.json();
          const primary = emails.find(e => e.primary && e.verified);
          email = primary ? primary.email : (emails[0] ? emails[0].email : null);
        }
      }
      if (!email) throw new Error('Unable to retrieve email from GitHub. Ensure your email is public or grant user:email scope.');

      return {
        email: email,
        name: profile.name || profile.login || '',
        avatar: profile.avatar_url || null,
        provider: 'github',
        providerId: String(profile.id)
      };
    }

    if (provider === 'slack') {
      // Slack OIDC userInfo — profile already fetched above (generic fetch at L354)
      // Slack wraps response with ok:true/false
      if (profile.ok === false) {
        throw new Error(profile.error || 'Slack userInfo failed');
      }

      if (!profile.email) {
        throw new Error('Unable to retrieve email from Slack. Ensure email scope is granted.');
      }

      return {
        email: profile.email,
        name: profile.name || profile.given_name || '',
        avatar: profile.picture || null,
        provider: 'slack',
        providerId: profile.sub
      };
    }

    throw new Error(`Login not supported for provider: ${provider}`);
  }

  /**
   * Start the OAuth callback server
   */
  start() {
    this.app = express();

    // Security headers
    this.app.use((req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      next();
    });

    // Initialize auth-service with DB (required for loginWithOAuth — OAuthGateway runs as separate process)
    const authService = require('./auth-service.cjs');
    const { getDB } = require('./GoogleSheetsDB.cjs');
    authService.init(getDB());

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
        // Session 250.43: Sanitize error to prevent XSS
        const safeError = String(error).replace(/[<>&"']/g, c => ({
          '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
        }[c]));
        return res.status(400).send(`
          <html><body>
            <h1>OAuth Error</h1>
            <p>${safeError}</p>
            <script>window.close();</script>
          </body></html>
        `);
      }

      try {
        const result = await this.exchangeCode(provider, code, state);
        // Sanitize tenantId to prevent XSS (user-controlled input)
        const safeTenantId = String(result.tenantId).replace(/[<>&"']/g, c => ({
          '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
        }[c]));
        const safeProvider = String(provider).replace(/[<>&"']/g, c => ({
          '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
        }[c]));
        // B20 fix: Redirect to integrations page with connected param so UI updates
        const websiteBase = process.env.WEBSITE_URL || 'https://vocalia.ma';
        const redirectUrl = `${websiteBase}/app/client/integrations.html?connected=${encodeURIComponent(provider)}`;
        res.send(`
          <html><body>
            <h1>Connected Successfully!</h1>
            <p>${OAUTH_PROVIDERS[provider]?.name || safeProvider} connected for tenant: ${safeTenantId}</p>
            <p>Redirecting...</p>
            <script>
              setTimeout(() => { window.location.href = '${redirectUrl}'; }, 1500);
            </script>
          </body></html>
        `);
      } catch (error) {
        // Sanitize error message to prevent XSS
        const safeMsg = String(error.message).replace(/[<>&"']/g, c => ({
          '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
        }[c]));
        res.status(400).send(`
          <html><body>
            <h1>❌ Connection Failed</h1>
            <p>${safeMsg}</p>
          </body></html>
        `);
      }
    });

    // === SSO Login Routes (for user authentication, NOT service integration) ===

    // Initiate SSO login
    this.app.get('/oauth/login/:provider', (req, res) => {
      const { provider } = req.params;
      try {
        const authUrl = this.getLoginAuthUrl(provider);
        res.redirect(authUrl);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // SSO login callback
    this.app.get('/oauth/login/callback/:provider', async (req, res) => {
      const { provider } = req.params;
      const { code, state, error } = req.query;
      const websiteBase = process.env.WEBSITE_URL || 'https://vocalia.ma';

      if (error) {
        const safeError = encodeURIComponent(String(error));
        return res.redirect(`${websiteBase}/login.html?oauth_error=${safeError}`);
      }

      try {
        // Exchange code and get user profile
        const profile = await this.exchangeLoginCode(provider, code, state);

        // Authenticate via auth-service (find or create user)
        const authService = require('./auth-service.cjs');
        const result = await authService.loginWithOAuth({
          email: profile.email,
          name: profile.name,
          provider: profile.provider,
          providerId: profile.providerId
        });

        // Provision tenant if new user (no tenant_id yet)
        if (!result.user.tenant_id) {
          try {
            const { provisionTenant, generateTenantIdFromCompany } = require('./db-api.cjs');
            const tenantId = generateTenantIdFromCompany(profile.name || profile.email.split('@')[0]);
            provisionTenant(tenantId, { plan: 'starter', company: profile.name || '', email: profile.email });

            // Update user with tenant_id
            const { getDB } = require('./GoogleSheetsDB.cjs');
            await getDB().update('users', result.user.id, { tenant_id: tenantId });
            result.user.tenant_id = tenantId;
          } catch (provErr) {
            console.error('❌ [OAuthGateway] Tenant provisioning failed:', provErr.message);
          }
        }

        // Redirect to website with tokens in URL fragment (hash — not sent to server)
        const params = new URLSearchParams({
          access_token: result.access_token,
          refresh_token: result.refresh_token,
          user_id: result.user.id,
          user_email: result.user.email,
          user_name: result.user.name || '',
          tenant_id: result.user.tenant_id || '',
          role: result.user.role || 'user',
          email_verified: result.user.email_verified ? 'true' : 'false',
          oauth_provider: result.user.oauth_provider || provider,
          linked_providers: JSON.stringify(result.user.linked_providers || [provider])
        });

        res.redirect(`${websiteBase}/login.html#oauth_success=1&${params.toString()}`);
      } catch (error) {
        console.error('❌ [OAuthGateway] Login callback error:', error.message);
        const safeError = encodeURIComponent(String(error.message));
        res.redirect(`${websiteBase}/login.html?oauth_error=${safeError}`);
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

    process.on('uncaughtException', (err) => {
      console.error('❌ [OAuthGateway] Uncaught exception:', err.message);
      console.error(err.stack);
      gateway.stop();
      process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
      console.error('❌ [OAuthGateway] Unhandled rejection:', reason);
    });
  } else if (args.includes('--get-url')) {
    const providerIdx = args.indexOf('--provider');
    const tenantIdx = args.indexOf('--tenant');
    const provider = providerIdx !== -1 ? args[providerIdx + 1] : 'google';
    const tenantId = tenantIdx !== -1 ? args[tenantIdx + 1] : 'unknown';

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
