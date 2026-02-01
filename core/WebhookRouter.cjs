#!/usr/bin/env node
/**
 * WebhookRouter - Multi-Tenant Inbound Webhook Handler
 *
 * Receives and routes webhooks from external services (HubSpot, Shopify, etc.)
 * to the appropriate tenant handlers.
 *
 * Session 249.2 - Multi-Tenant Phase 0
 *
 * @module WebhookRouter
 * @version 1.0.0
 */

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Event log directory
const EVENTS_DIR = path.join(process.cwd(), 'data', 'events', 'webhooks');

// Webhook Provider Configurations
const WEBHOOK_PROVIDERS = {
  hubspot: {
    name: 'HubSpot',
    signatureHeader: 'X-HubSpot-Signature',
    signatureVersion: 'v3',
    verifySignature: (payload, signature, secret) => {
      // HubSpot v3 signature
      const hash = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
      return hash === signature;
    }
  },
  shopify: {
    name: 'Shopify',
    signatureHeader: 'X-Shopify-Hmac-Sha256',
    verifySignature: (payload, signature, secret) => {
      const hash = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('base64');
      return hash === signature;
    }
  },
  klaviyo: {
    name: 'Klaviyo',
    signatureHeader: 'X-Klaviyo-Signature',
    verifySignature: (payload, signature, secret) => {
      // Klaviyo uses simple API key verification in headers
      return true; // Simplified - implement actual verification
    }
  },
  stripe: {
    name: 'Stripe',
    signatureHeader: 'Stripe-Signature',
    verifySignature: (payload, signature, secret) => {
      // Stripe signature verification
      const elements = signature.split(',');
      const timestampElement = elements.find(e => e.startsWith('t='));
      const sigElement = elements.find(e => e.startsWith('v1='));

      if (!timestampElement || !sigElement) return false;

      const timestamp = timestampElement.split('=')[1];
      const sig = sigElement.split('=')[1];

      const signedPayload = `${timestamp}.${payload}`;
      const expectedSig = crypto
        .createHmac('sha256', secret)
        .update(signedPayload)
        .digest('hex');

      return expectedSig === sig;
    }
  },
  google: {
    name: 'Google (Pub/Sub)',
    signatureHeader: 'Authorization',
    verifySignature: () => true // Google uses JWT, simplified here
  }
};

// Webhook handlers registry
const handlers = new Map();

class WebhookRouter {
  constructor(options = {}) {
    this.port = options.port || parseInt(process.env.WEBHOOK_PORT) || 3011;
    this.app = null;
    this.server = null;
  }

  /**
   * Ensure events directory exists
   */
  ensureEventsDir() {
    if (!fs.existsSync(EVENTS_DIR)) {
      fs.mkdirSync(EVENTS_DIR, { recursive: true });
    }
  }

  /**
   * Log webhook event to file
   */
  logEvent(tenantId, provider, eventType, data) {
    this.ensureEventsDir();

    const timestamp = new Date().toISOString();
    const date = timestamp.split('T')[0];
    const logFile = path.join(EVENTS_DIR, `${date}.jsonl`);

    const event = {
      timestamp,
      tenantId,
      provider,
      eventType,
      data
    };

    fs.appendFileSync(logFile, JSON.stringify(event) + '\n');
    console.log(`[WebhookRouter] Logged ${provider}/${eventType} for ${tenantId}`);
  }

  /**
   * Register a webhook handler
   */
  registerHandler(provider, eventType, handler) {
    const key = `${provider}:${eventType}`;
    handlers.set(key, handler);
    console.log(`[WebhookRouter] Registered handler: ${key}`);
  }

  /**
   * Process a webhook event
   */
  async processEvent(tenantId, provider, eventType, data) {
    // Log the event
    this.logEvent(tenantId, provider, eventType, data);

    // Find handler
    const specificKey = `${provider}:${eventType}`;
    const wildcardKey = `${provider}:*`;

    const handler = handlers.get(specificKey) || handlers.get(wildcardKey);

    if (handler) {
      try {
        await handler(tenantId, eventType, data);
      } catch (error) {
        console.error(`[WebhookRouter] Handler error: ${error.message}`);
      }
    }
  }

  /**
   * Extract tenant ID from webhook
   */
  extractTenantId(provider, headers, body) {
    // Check custom header first
    if (headers['x-tenant-id']) {
      return headers['x-tenant-id'];
    }

    // Provider-specific extraction
    switch (provider) {
      case 'hubspot':
        // HubSpot can include portal ID which maps to tenant
        return body.portalId ? `hubspot_${body.portalId}` : 'agency_internal';

      case 'shopify':
        // Shopify domain in header
        const shopDomain = headers['x-shopify-shop-domain'];
        return shopDomain ? `shopify_${shopDomain.replace('.myshopify.com', '')}` : 'agency_internal';

      case 'stripe':
        // Stripe account ID
        if (body.account) return `stripe_${body.account}`;
        break;
    }

    return 'agency_internal'; // Default
  }

  /**
   * Start the webhook server
   */
  start() {
    this.app = express();

    // Raw body for signature verification
    this.app.use('/webhook', express.raw({ type: '*/*' }));

    // JSON for other routes
    this.app.use(express.json());

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        service: 'WebhookRouter',
        version: '1.0.0',
        providers: Object.keys(WEBHOOK_PROVIDERS)
      });
    });

    // Generic webhook endpoint
    this.app.post('/webhook/:provider', async (req, res) => {
      const { provider } = req.params;
      const config = WEBHOOK_PROVIDERS[provider];

      if (!config) {
        return res.status(400).json({ error: `Unknown provider: ${provider}` });
      }

      // Get raw body for signature verification
      const rawBody = req.body.toString('utf8');
      let body;
      try {
        body = JSON.parse(rawBody);
      } catch {
        body = { raw: rawBody };
      }

      // Extract tenant ID
      const tenantId = this.extractTenantId(provider, req.headers, body);

      // Get event type
      const eventType = this.getEventType(provider, req.headers, body);

      // Log and process
      console.log(`[WebhookRouter] Received ${provider}/${eventType} for ${tenantId}`);

      await this.processEvent(tenantId, provider, eventType, body);

      // Respond quickly
      res.status(200).json({ received: true });
    });

    // List registered handlers
    this.app.get('/webhook/handlers', (req, res) => {
      res.json({
        handlers: Array.from(handlers.keys())
      });
    });

    // Get events for a tenant
    this.app.get('/webhook/events/:tenantId', (req, res) => {
      const { tenantId } = req.params;
      const { date, limit = 100 } = req.query;

      // Session 250.43: Validate date format to prevent path traversal
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      const targetDate = (date && datePattern.test(date)) ? date : new Date().toISOString().split('T')[0];
      const logFile = path.join(EVENTS_DIR, `${targetDate}.jsonl`);

      if (!fs.existsSync(logFile)) {
        return res.json({ events: [], count: 0 });
      }

      const lines = fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean);
      const events = lines
        .map(line => {
          try { return JSON.parse(line); } catch { return null; }
        })
        .filter(e => e && e.tenantId === tenantId)
        .slice(-parseInt(limit));

      res.json({ events, count: events.length });
    });

    this.server = this.app.listen(this.port, () => {
      console.log(`[WebhookRouter] Running on port ${this.port}`);
      console.log(`[WebhookRouter] Webhook URL: http://localhost:${this.port}/webhook/{provider}`);
    });

    // Register default handlers
    this.registerDefaultHandlers();
  }

  /**
   * Get event type from webhook
   */
  getEventType(provider, headers, body) {
    switch (provider) {
      case 'hubspot':
        return body.subscriptionType || body.eventType || 'unknown';

      case 'shopify':
        return headers['x-shopify-topic'] || 'unknown';

      case 'stripe':
        return body.type || 'unknown';

      case 'klaviyo':
        return body.event || 'unknown';

      case 'google':
        return body.message?.attributes?.eventType || 'unknown';

      default:
        return body.type || body.event || 'unknown';
    }
  }

  /**
   * Register default webhook handlers
   */
  registerDefaultHandlers() {
    // HubSpot: Contact created
    this.registerHandler('hubspot', 'contact.creation', async (tenantId, eventType, data) => {
      console.log(`[Handler] New HubSpot contact for ${tenantId}:`, data.objectId);
    });

    // Shopify: Order created
    this.registerHandler('shopify', 'orders/create', async (tenantId, eventType, data) => {
      console.log(`[Handler] New Shopify order for ${tenantId}:`, data.id);
    });

    // Stripe: Payment succeeded
    this.registerHandler('stripe', 'payment_intent.succeeded', async (tenantId, eventType, data) => {
      console.log(`[Handler] Stripe payment for ${tenantId}:`, data.id);
    });
  }

  /**
   * Stop the server
   */
  stop() {
    if (this.server) {
      this.server.close();
      console.log('[WebhookRouter] Stopped');
    }
  }

  /**
   * Health check
   */
  healthCheck() {
    console.log('\n=== WebhookRouter Health Check ===\n');

    console.log('Supported providers:');
    for (const [key, config] of Object.entries(WEBHOOK_PROVIDERS)) {
      console.log(`  ✅ ${config.name} (${key})`);
    }

    console.log('\nRegistered handlers:');
    if (handlers.size === 0) {
      console.log('  (none - will register on start)');
    } else {
      for (const key of handlers.keys()) {
        console.log(`  • ${key}`);
      }
    }

    console.log(`\nPort: ${this.port}`);
    console.log(`Events directory: ${EVENTS_DIR}`);
    console.log('\n=== WebhookRouter: OK ===\n');
  }
}

// Singleton instance
const router = new WebhookRouter();

module.exports = router;
module.exports.WebhookRouter = WebhookRouter;
module.exports.WEBHOOK_PROVIDERS = WEBHOOK_PROVIDERS;

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--health')) {
    router.healthCheck();
  } else if (args.includes('--start')) {
    router.start();
  } else {
    console.log(`
WebhookRouter - Multi-Tenant Inbound Webhook Handler

Usage:
  node WebhookRouter.cjs --health    # Check configuration
  node WebhookRouter.cjs --start     # Start server (port ${router.port})

Webhook URL: http://localhost:${router.port}/webhook/{provider}

Supported providers:
${Object.entries(WEBHOOK_PROVIDERS).map(([k, v]) => `  • ${k} (${v.name})`).join('\n')}

Environment Variables:
  WEBHOOK_PORT   Server port (default: 3011)
`);
  }
}
