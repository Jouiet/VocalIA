# VocalIA - Voice AI Platform

> Voice AI SaaS | vocalia.ma | ~/Desktop/VocalIA/ | CommonJS (.cjs), 2 spaces, single quotes
> 89 pages | 5 langs (FR/EN/ES/AR/ARY) | RTL | ~92k lines | ~7,400+ tests (131 files: 122 .mjs + 9 .cjs, 0 fail, 4 skip Gemini TTS quota)
> 203 MCP tools + 6 resource types (43 URIs) + 8 prompts (SDK v1.26.0, stdio + HTTP + OAuth) | 40 personas | 25 function tools | 7 widgets

## Architecture

core/ (70 modules, 43.1k) | telephony/ (5.5k) | personas/ (8.8k) | widget/ (11.0k, 7 files)
mcp-server/src/ (19.3k, 33 .ts) | lib/ (944) | sensors/ (973) | integrations/ (3.8k, 12 platform dirs + 7 CRM/ecom .cjs, 4 downloadable ZIPs)
clients/ = 1,248 dirs (ALL test data) | website/ = 89 pages + locales (28.0k)

## Services (8 HTTP servers)

**Deployed (7 Docker containers via Traefik — ALL non-root, su-exec node PID 1):**

| Service | Port | Script | Profile |
|:--------|:----:|:-------|:--------|
| Voice API | 3004 | `core/voice-api-resilient.cjs` | core |
| Grok Realtime | 3007 | `core/grok-voice-realtime.cjs` | core |
| Telephony | 3009 | `telephony/voice-telephony-bridge.cjs` | core |
| DB API | 3013 | `core/db-api.cjs` | core |
| OAuth Gateway | 3010 | `core/OAuthGateway.cjs --start` | integrations |
| Webhook Router | 3011 | `core/WebhookRouter.cjs --start` | integrations |
| Video HITL | 3012 | `core/remotion-hitl.cjs --server` | video |

**Non-deployed (standalone, code exists):**

| Service | Port | Script |
|:--------|:----:|:-------|
| MCP Server (HTTP) | 3015 | `mcp-server/dist/index.js --http` |

## Commands

```bash
node scripts/health-check.cjs                              # Health
cd website && npm run build:css                             # CSS
node scripts/build-widgets.cjs [--production] [--check]     # Widgets
node scripts/validate-design-tokens.cjs                     # Design tokens (23 checks)
python3 scripts/translation-quality-check.py --verbose      # i18n QA
```

### ⛔ RECURRING TASK (every 15-20 sessions — NEVER DELETE)
Run `node scripts/validate-design-tokens.cjs`. Verify STALE_NUMBER_PATTERNS matches real numbers. See `.claude/rules/branding.md`.

## Key Info

- **i18n**: 5 langs. Geo-detect: MA→FR+MAD, EU→FR+EUR, Other→EN+USD
- **Fallback**: Dynamic TaskRouter (250.245): classifies task → routes to optimal provider. Default: grok → gemini → anthropic → atlas. WhatsApp inbound: deriveTenantFromWhatsApp → ClientRegistry reverse lookup.
- **Pricing**: Starter 49€ | Pro 99€ | E-commerce 99€ | Expert Clone 149€ | Telephony 199€ + 0.24€/min. No Free Tier, 14-day trial.
- **Multi-Tenant**: 26 registered (22 test + 4 satellites, 0 paying) | 528 client folders (b2b/b2c/ecom/satellite test data) | 40 personas × 5 langs

## Key Docs (read with Read tool ONLY when needed — NOT auto-loaded)

- Architecture: `docs/VOCALIA-SYSTEM-ARCHITECTURE.md` (8 services, ports, data layer, AI providers)
- Roadmap: `docs/ROADMAP-TO-COMPLETION.md` (543+ bugs tracker, 61 phases, fix history)
- Business: `docs/BUSINESS-INTELLIGENCE.md` (costs, pricing, competitive analysis, GA4)
- Tests: `docs/TEST-COVERAGE-AUDIT.md` (~7,400+ tests, 462/491 functions tested, 0 CRITICAL gaps)
- Client Implementation: `docs/AUDIT-IMPLEMENTATION-CLIENT.md` (gaps G1-G24, score 93/100)
- Strategy: `docs/SESSION-250.214-REPORT.md` (ROI calc, KB score, speed metrics, Expert Clone)
- Perplexity: `docs/PERPLEXITY-COMPUTER-ANALYSIS.md` (T1-T7 patterns, comparison, all DONE)

## State (concise — detail in auto memory)

- **Code**: 9.9/10 | **Production**: 4.0/10 | **Revenue Readiness**: 1.5/10 | **Security**: 9.5/10
- 543+ bugs fixed across 83 phases, 8 not fixable locally. **B52 RESOLVED** via test-runner.cjs (isolation=none for heavy files).
- 7 containers LIVE + DEPLOYED, 0 paying customers. OAuth SSO + Resend SMTP + Monitoring v3.0 LIVE.
- **Promptfoo** (250.233): 200/200 prompts (100%), eval-all 98.6%, red team 40/40 (99.6%), anti-hallucination 199 SECURITY sections.
- **Coverage Audit** (250.241→254): 462/491 functions tested (94%), 0 CRITICAL gaps. 131 test files, ~7,400+ tests.
- **Cross-system Bug Audit** (250.252): 6 bugs found+fixed — EventBus .emit→.publish, payload envelope mismatch (5 subscribers), hardcoded localhost in WebhookRouter, missing await stripeService, sync-to-3a process.exit guard. Regression tests: regression-bug-audit-248.test.mjs (15 tests).
- **c8 Coverage Architecture** (250.252): ROOT CAUSE — c8 cannot track V8 coverage through node:test child processes. WORKAROUND: cov-runner.cjs (direct function calls). test-runner.cjs Step 4 auto-runs cov-*.cjs runners. Coverage push in progress (76 files below 88% threshold).
- **Perplexity Computer Patterns** (250.245-247): T1-T7 ALL DONE — TaskRouter, parallel context, QualityGate v2 (synonym groups + injection detection + penalty recalibration), intelligent retry, ClientProfile, TokenBudget, RAG multi-source enrichment.
- **WhatsApp Inbound** (250.247): deriveTenantFromWhatsApp was UNDEFINED (production crash). Fixed: function + ClientRegistry.getTenantIdByWhatsAppNumberId(). Gemini TTS: preflight quota detection (4 false fails → 4 clean skips). asyncSearchHybrid: 0→7 tests.
- **Satellite Audit** (250.242-245): Score 8→91/100. All critical blockers resolved. 4 satellites pre-provisioned.
- **Plugin 1-Click** (250.250-253): 12 CMS dirs (2 full PHP plugins with PHPUnit: WP 266L + PS 182L, 4 untested PHP modules: Joomla/Drupal/Magento/OpenCart, 6 HTML/Liquid/JS snippets: Shopify/BigC/Wix/Squarespace/Webflow/GTM). 7 CRM/ecom .cjs backends (2,275L). 4 downloadable ZIPs (WP 4.4KB, PS 2.1KB, Joomla 2.6KB, Drupal 4.7KB). ZIP bloat fix: excluded vendor/tests/composer (WP was 16MB). 0 real CMS installations.
- **SOTA Dashboards** (250.249-250): T1-T7 pipeline visualization in admin + client dashboards, engine-stats API, engine metrics per tenant.
- **Unified Component Loader** (250.251): Two loaders merged into one. 19 app pages migrated. NLP Operator auto-injection bug fixed (checked nonexistent class).
- **Revenue Path Audit** (250.254b): FATAL — Register/Login = 500 on VPS (GoogleSheetsDB OAuth expired), Stripe prices = PLACEHOLDER, STRIPE_SECRET_KEY missing, no Stripe webhook receiver, WebSocket 3007 unreachable, new tenant quota = 0. Revenue readiness: 1.5/10.
- **Next (CRITICAL PATH)**: 1) SSH VPS → refresh Google OAuth tokens 2) Create Stripe Products/Prices 3) Set STRIPE_SECRET_KEY on VPS 4) Write Stripe webhook receiver 5) Fix default tenant quota 6) First paying customer

*Last update: 01/03/2026 — Session 250.254b: 3 code bugs fixed (kb-parser delimiter, cost-tracking array corruption, token-budget race condition), 76 test fixes, B52 solo isolation fix. Revenue path audit: Register=500 (OAuth expired), Stripe=PLACEHOLDER, WebSocket=unreachable. Revenue readiness 1.5/10. 131 files, ~7,400+ pass, 0 code fail, 4 skip.*
