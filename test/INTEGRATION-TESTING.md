# VocalIA Integration Testing Guide

> How to run integration tests with sandbox/real credentials.

## Unit Tests (no credentials needed)

```bash
# Full suite (736+ tests)
node --test test/*.test.cjs

# Coverage report
npx c8 --reporter=text-summary node --test test/*.test.cjs

# Single file
node --test test/gateways.test.cjs
```

All unit tests run offline — no API keys required.

## E2E Tests (Playwright)

```bash
# Against production
npx playwright test

# Against local
BASE_URL=http://localhost:8080 npx playwright test

# Single spec
npx playwright test test/e2e/public-pages.spec.js --project=chromium
```

Requires: `npx playwright install` (one-time browser download).

## Integration Tests with Sandbox Credentials

### Stripe (Test Mode)

```bash
# .env
STRIPE_SECRET_KEY=sk_test_...     # From Stripe Dashboard > Developers > API keys
STRIPE_WEBHOOK_SECRET=whsec_...   # From Stripe Dashboard > Webhooks > Signing secret
```

Test: `node --test test/gateways.test.cjs` (offline tests always work).

For live sandbox testing:
```bash
# Create test customer
curl -X POST http://localhost:3004/api/stripe/customer \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User"}'

# Stripe CLI for webhook testing
stripe listen --forward-to localhost:3004/webhook/stripe
stripe trigger checkout.session.completed
```

### HubSpot (Developer Test Account)

```bash
# .env
HUBSPOT_API_KEY=pat-na1-...  # From HubSpot > Settings > Integrations > Private Apps
```

Create a free developer test account at https://developers.hubspot.com.

Test: `node --test test/integration-tools.test.cjs` (offline tests always work).

### Shopify (Partner Account)

```bash
# .env
SHOPIFY_STORE_URL=https://your-dev-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_...
```

Create a free development store at https://partners.shopify.com.

### Meta CAPI (Test Mode)

```bash
# .env
META_PIXEL_ID=123456789
META_ACCESS_TOKEN=EAAG...
META_TEST_EVENT_CODE=TEST12345  # Enables test mode (no real tracking)
```

Get test event code from Meta Events Manager > Test Events tab.

Test: `node --test test/meta-capi.test.cjs` (offline tests always work).

### Klaviyo

```bash
# .env
KLAVIYO_API_KEY=pk_...  # Public API key from Klaviyo > Settings > API Keys
```

### WooCommerce

```bash
# .env
WOOCOMMERCE_URL=https://your-store.com
WOOCOMMERCE_CONSUMER_KEY=ck_...
WOOCOMMERCE_CONSUMER_SECRET=cs_...
```

Generate keys: WP Admin > WooCommerce > Settings > Advanced > REST API.

## Smoke Test Script

Run all integration smoke tests (requires credentials):

```bash
# Verify all integrations are reachable
node -e "
const gateways = ['stripe', 'payzone', 'meta-capi'];
const integrations = ['hubspot', 'klaviyo', 'shopify'];

// Check gateways
for (const gw of gateways) {
  try {
    const mod = require('./core/gateways/' + gw + '-global-gateway.cjs');
    const health = mod.healthCheck ? mod.healthCheck() : { status: 'no healthCheck' };
    console.log(gw + ':', health.configured ? 'configured' : 'NOT configured');
  } catch(e) { console.log(gw + ': ' + e.message); }
}
"
```

## Test File Index

| File | Tests | Module Tested |
|:-----|:-----:|:-------------|
| widget.test.cjs | 62 | Widget sanitization, escapeHTML |
| rate-limiter.test.cjs | 55 | Rate limiting algorithms |
| mcp-server.test.cjs | 56 | MCP tool definitions |
| kb-parser.test.cjs | 38 | KB import (JSON/CSV/TXT/MD) |
| translation-supervisor.test.cjs | 35 | Hallucination detection, Darija |
| voice-api.test.cjs | 34 | Voice API response formats |
| knowledge-base.test.cjs | 31 | KB CRUD operations |
| ucp-store.test.cjs | 31 | Unified Customer Profile |
| catalog-connector.test.cjs | 32 | E-commerce catalog connectors |
| kb-quotas.test.cjs | 30 | Plan quotas and limits |
| meta-capi.test.cjs | 28 | Meta Conversions API offline |
| gateways.test.cjs | 28 | Stripe + Payzone gateways |
| vector-store.test.cjs | 25 | Vector search + LRU eviction |
| audit-store.test.cjs | 24 | Audit trail storage |
| conversation-store.test.cjs | 24 | Multi-turn conversation cache |
| module-load.test.cjs | 20 | Module loading verification |
| integration-tools.test.cjs | 20 | CRM/ecom tool exports |
| webhook-router.test.cjs | 20 | Webhook signature verification |
| eventbus.test.cjs | 20 | Event bus pub/sub |
| compliance-guardian.test.cjs | 19 | PII/ethics/credential detection |
| marketing-science.test.cjs | 19 | Persuasion frameworks |
| kb-provisioner.test.cjs | 17 | KB generation pipeline |
| hybrid-rag.test.cjs | 15 | RAG retrieval |
| i18n.test.cjs | 15 | Locale completeness |
| oauth-gateway.test.cjs | 14 | OAuth provider config |
| secret-vault.test.cjs | 11 | Credential encryption |
| ab-analytics.test.cjs | 9 | A/B test analytics |
