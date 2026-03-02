# VocalIA - Voice AI Platform

> Voice AI SaaS | vocalia.ma | ~/Desktop/VocalIA/ | CommonJS (.cjs), 2 spaces, single quotes
> 89 pages | 5 langs (FR/EN/ES/AR/ARY) | RTL | ~92k lines | ~8,041+ tests (132 files: 123 .mjs + 9 .cjs, 0 fail, 4 skip Gemini TTS quota)
> 203 MCP tools + 6 resource types (43 URIs) + 8 prompts (SDK v1.26.0, stdio + HTTP + OAuth) | 40 personas | 25 function tools | 7 widgets

## Architecture

core/ (70 modules, 43.1k) | telephony/ (5.5k) | personas/ (8.8k) | widget/ (11.0k, 7 files)
mcp-server/src/ (19.3k, 33 .ts) | lib/ (944) | sensors/ (973) | integrations/ (3.8k, 12 platform dirs + 7 CRM/ecom .cjs, 6 downloadable ZIPs)
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

- **Code**: 9.9/10 | **Production**: 6.0/10 | **Revenue Readiness**: 4.0/10 | **Security**: 9.5/10
- 543+ bugs fixed across 83 phases, 8 not fixable locally. **B52 RESOLVED** via test-runner.cjs (isolation=none for heavy files).
- 7 containers LIVE + DEPLOYED, 0 paying customers. OAuth SSO + Resend SMTP + Monitoring v3.0 LIVE.
- **Promptfoo** (250.233): 200/200 prompts (100%), eval-all 98.6%, red team 40/40 (99.6%), anti-hallucination 199 SECURITY sections.
- **Coverage Audit** (250.241→255): 462/491 functions tested (94%), 0 CRITICAL gaps. 132 test files, ~7,400+ tests.
- **Cross-system Bug Audit** (250.252): 6 bugs found+fixed — EventBus .emit→.publish, payload envelope mismatch (5 subscribers), hardcoded localhost in WebhookRouter, missing await stripeService, sync-to-3a process.exit guard. Regression tests: regression-bug-audit-248.test.mjs (15 tests).
- **c8 Coverage Architecture** (250.252): ROOT CAUSE — c8 cannot track V8 coverage through node:test child processes. WORKAROUND: cov-runner.cjs (direct function calls). test-runner.cjs Step 4 auto-runs cov-*.cjs runners. Coverage push in progress (76 files below 88% threshold).
- **Perplexity Computer Patterns** (250.245-247): T1-T7 ALL DONE — TaskRouter, parallel context, QualityGate v2 (synonym groups + injection detection + penalty recalibration), intelligent retry, ClientProfile, TokenBudget, RAG multi-source enrichment.
- **WhatsApp Inbound** (250.247): deriveTenantFromWhatsApp was UNDEFINED (production crash). Fixed: function + ClientRegistry.getTenantIdByWhatsAppNumberId(). Gemini TTS: preflight quota detection (4 false fails → 4 clean skips). asyncSearchHybrid: 0→7 tests.
- **Satellite Audit** (250.242-245): Score 8→91/100. All critical blockers resolved. 4 satellites pre-provisioned.
- **Plugin 1-Click** (250.250-257): 12 CMS dirs (6 PHP plugins with PHPUnit: WP 30 + PS 29 + Joomla 15 + Drupal 15 + Magento 18 + OpenCart 15 = 122 tests, 6 HTML/Liquid/JS snippets: Shopify/BigC/Wix/Squarespace/Webflow/GTM). 7 CRM/ecom .cjs backends (2,275L). 6 downloadable ZIPs (WP 5.5KB, PS 3.1KB, Joomla 3.5KB, Drupal 6.0KB, Magento 7.4KB, OpenCart 9.1KB). Widget install verifier + heartbeat. 0 real CMS installations.
- **Plugins SOTA 2026** (250.264-265): 8 chantiers: OAuth "Connect with VocalIA" (WP/PS/Joomla/Drupal), auto-register origin (plugin-connect + heartbeat first-use), Magento/OpenCart ZIP restructure (cassés→standard), Tenant ID visible dans dashboard, login.html plugin handler. Widget features sync bridge (GoogleSheetsDB→config.json disconnect fixé). 4 ecom toggles (cart recovery, quiz, gamification, carousel). GSAP bento-grid fix (250.265). Traefik +5 path prefixes deployed. 6 ZIPs rebuilt.
- **SOTA Dashboards** (250.249-250): T1-T7 pipeline visualization in admin + client dashboards, engine-stats API, engine metrics per tenant.
- **Unified Component Loader** (250.251): Two loaders merged into one. 19 app pages migrated. NLP Operator auto-injection bug fixed (checked nonexistent class).
- **Revenue Path Audit** (250.254b): FATAL — Register/Login = 500 on VPS (GoogleSheetsDB OAuth expired), Stripe prices = PLACEHOLDER, STRIPE_SECRET_KEY missing, no Stripe webhook receiver, WebSocket 3007 unreachable, new tenant quota = 0. Revenue readiness: 1.5/10.
- **Revenue Pipeline E2E** (250.255): B4 FIXED (`stripe-subscription-handler.cjs` + 4 WebhookRouter handlers), B2 FIXED (dynamic `/api/billing/prices`), B6 debunked (quotas were correct, issue = B1 prevents provisioning), sms_automation REMOVED (22 features), KB Score API added (F5 backend), trial_end + stripe section in provisionTenant. Revenue readiness: 1.5→2.5/10.
- **Thinking Partner MOAT Features** (250.256-259): ALL 5 DONE. F1 KB Gap Detection, F2 Drift Detection, F3 Visitor Memory, F5 KB Score gamified (250.256). F4 Cross-sell Co-occurrence (`/api/tenants/:id/cross-sell` + analytics.html "Cross-sell detecte" with lift/confidence, 250.259).
- **Plugin System Complete** (250.257): CDN URL fix verified (0 api.vocalia.ma remaining in /integrations/). 6 ZIPs (WP 4.4KB, PS 2.1KB, Joomla 2.6KB, Drupal 4.7KB, Magento 4.8KB, OpenCart 2.7KB). build-plugin-zips.cjs auto-copy to website/downloads/. Download endpoint 6 platforms. install-widget.html: separated Magento/BigCommerce/OpenCart cards with ZIP download buttons. Widget install verifier (GET /api/widget/verify?url=). Widget heartbeat (POST /api/widget/heartbeat + GET /api/widget/heartbeats). install-widget.html: inline verification UI.
- **SRI Deep Surgery** (250.258): 6 bugs fixed (B1-B6). SRI SHA-384 auto-generation in build-widgets.cjs → sri-hashes.json (8 widget hashes). Auto-update pipeline: build propagates hashes to 6 PHP plugins + BigCommerce + Squarespace + Webflow + Wix + GTM (11 files). BigCommerce obsolete hash replaced. All 6 PHP plugins inject `integrity` + `crossorigin="anonymous"`. install-widget.html snippets include SRI dynamically (fetch sri-hashes.json). onboarding.html snippet now dynamic (widget_type from persona selection, no hardcoded b2b, no ?v=2.7.0). 6 ZIPs rebuilt (WP 4.6KB, PS 2.3KB, Joomla 2.8KB, Drupal 4.9KB, Magento 5.1KB, OpenCart 2.9KB). Verified: openssl independent hash calculation matches, zero sha384-PENDING remaining, idempotent rebuild.
- **Feature Audit Upgrade** (250.259): 22-feature audit: 3→7 WORKS, 3→0 PARTIAL, 1→0 FRAGILE. email_automation: welcome email auto-trigger on register. booking: confirmed per-tenant (booking_url in config, not hardcoded). analytics_dashboard + export: code complete (WORKS, data empty = expected with 0 conversations). F4 cross-sell co-occurrence analysis: backend + dashboard UI.
- **Data Driven Dashboard** (250.260-261): Aggregated insights API (`GET /api/tenants/:id/insights` — KB score + drift + cross-sell + alerts). Client dashboard Intelligence Summary widget (4 cards). Admin dashboard Platform Health widget (`GET /api/admin/platform-health` — 6 metrics: tenants, KB avg, conversations, active widgets, KB entries, alerts). i18n: 5 locales (native chars). Self-audit: 3 bugs found+fixed (path.join shadow in kb-score, F3 missing from b2b widget, welcome email 404 link).
- **B5 WebSocket URL Fix** (250.261): Widget used `wss://api.vocalia.ma:3007` (port blocked) → `wss://api.vocalia.ma/realtime` (Traefik path route). Deployed + verified: `/realtime/health` → 200 OK.
- **B1 DEBUNKED** (250.261): "OAuth expired → register 500" was WRONG. OAuth was NEVER expired. Register 500 was caused by shell escaping `!` → `\!` in test commands → invalid JSON body. Verified: `POST /api/auth/register` → 201 OK from Mac, VPS host, and container. GoogleSheetsDB init, write, read ALL work.
- **VPS Full Restart** (250.261, 250.265): 7 containers restarted with latest code. All HEALTHY. Register: 201. Realtime: 200. Health: OK.
- **GSAP Bento-Grid Fix + Deploy** (250.265): pricing.html comparison cards invisible on LIVE (opacity: 0). Root cause: `gsap.fromTo()` + embedded `scrollTrigger` = unreliable. Fix: `ScrollTrigger.create()` + `onEnter` + 4s safety timeout. Cache buster v=265 (39 pages). Traefik +5 path prefixes (oauth, billing, admin, plugins, widget). 6 ZIPs rebuilt. NindoHost auto-deploy via GitHub Actions FTP. Verified LIVE: cards visible, counter 16x.
- **Hosting**: vocalia.ma = NindoHost (auto-deploy `.github/workflows/deploy-nindohost.yml`). api.vocalia.ma = Hostinger VPS Docker.
- **Next (CRITICAL PATH)**: 1) Create Stripe Products/Prices on dashboard.stripe.com 2) Set STRIPE_SECRET_KEY + STRIPE_PRICE_* on VPS .env 3) Configure Stripe webhook URL → api.vocalia.ma/webhook/stripe 4) VPS restart 5) First paying customer

- **PHPUnit Coverage Audit** (250.266): Exhaustive sector-by-sector audit found 6 critical gaps: OAuth Connect (WP/PS untested), SRI integrity (0 tests all 6), XSS escaping (Drupal/Magento), HTTPS URL (WP/OpenCart). +18 tests written: WP +5, PS +4, Joomla +1, Drupal +2, Magento +4, OpenCart +2. Total: 104→122 PHPUnit tests, 191→220 assertions. All 122/122 pass.

*Last update: 02/03/2026 — Session 250.266: PHPUnit coverage audit — 6 critical gaps found, +18 tests written (122/122 pass, 220 assertions). All code tasks DONE. Only remaining: Stripe config on VPS (business, not code).*
