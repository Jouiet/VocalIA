# VocalIA - Voice AI Platform

> Voice AI SaaS | vocalia.ma | ~/Desktop/VocalIA/ | CommonJS (.cjs), 2 spaces, single quotes
> 85 pages | 5 langs (FR/EN/ES/AR/ARY) | RTL | ~86k lines | 6,152 tests (92 .mjs, 0 skip)
> 203 MCP tools + 6 resource types (43 URIs) + 8 prompts (SDK v1.26.0, stdio + HTTP + OAuth) | 38 personas | 25 function tools | 7 widgets

## Architecture

core/ (58 modules, 38.0k) | telephony/ (4.8k) | personas/ (8.8k) | widget/ (11.0k, 7 files)
mcp-server/src/ (19.3k, 33 .ts) | lib/ (944) | sensors/ (860) | integrations/ (2.3k)
clients/ = 1,248 dirs (ALL test data) | website/ = 85 pages + locales (28.0k)

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
- **Fallback**: grok (grok-4-1-fast-reasoning) → gemini (gemini-3-flash) → anthropic (claude-opus-4-5) → atlas → local
- **Pricing**: Starter 49€ | Pro 99€ | E-commerce 99€ | Telephony 199€ + 0.24€/min. No Free Tier, 14-day trial.
- **Multi-Tenant**: 22 registered (0 paying) | 1,248 client folders = test data | 38 personas × 5 langs
- **Key Docs**: `docs/ROADMAP-TO-COMPLETION.md` | `docs/BUSINESS-INTELLIGENCE.md` | `docs/VOCALIA-SYSTEM-ARCHITECTURE.md` | `docs/TEST-COVERAGE-AUDIT.md` | `docs/SESSION-250.214-REPORT.md`

## State

- **Code completeness**: 9.5/10 — **500+ bugs found across 61 phases, 8 not fixable locally** (VPS/arch), rest all fixed. Tests: 6,106 pass, 0 fail (92 .mjs). **213/215 exported functions directly tested + 2 indirectly (100%).** ALL 21 app pages + 5 auth pages audited.
- **Dashboard features** (250.214): KB Quality Score, ROI Calculator interactif, Speed Metrics (latency/SLA/uptime), Revenue Attribution (funnel + top personas). 4 lignes backend, ~40 cles i18n × 5 langues.
- **Security**: 9.0/10 — SOTA audit (250.200): CDN SRI 78/78, CSP 22 app pages, security headers all 7 API services, CORS tightened, npm vulns patched, **all 7 containers non-root** (su-exec node user PID 1). VPS: SSH key-only, fail2ban, UFW. X-XSS-Protection: 0 (modern).
- **Monitoring**: Production monitor v3.0 LIVE — 7 endpoints + 7 containers + disk/mem/SSL, ntfy.sh alerts, recovery detection, */5 cron.
- **Backup**: Daily at 2 AM UTC, 7-day retention, ~4KB compressed. Cron on VPS.
- **Marketing integrity**: 100% — Remediation COMPLETE (250.195-197): 34 HTML + locale keys + 12/12 blog disclaimers. Zero false claims. B43 (250.214): 27 instances "gratuit/free" purgees — positionnement premium.
- **Production readiness**: 8.5/10 — Website live + API + monitoring + security hardened + non-root containers + backup + disk cleaned (86%→20%). 7 containers healthy (node:22). GSC verified + sitemap submitted. **Resend SMTP LIVE** (DKIM+SPF+MX verified). **OAuth SSO LIVE** (Google+GitHub+Slack). Missing: Stripe, 0 paying customers.
- **OAuth SSO**: **LIVE** (250.205). Google + GitHub + Slack SSO configured — redirect 302 verified. Separate SSO client from Sheets API client.
- **Video Studio**: E2E verified (250.197-199). Veo FUNCTIONAL (GCP ADC). Kling API = external 500 (crédits).
- **MCP Server**: 9.0/10. 203 tools + 6 resources + 8 prompts.
- **UCP**: Unified — core + MCP + voice + telephony + recommendations. Zero fragmentation.
- **SEO**: GSC verified (250.205), sitemap submitted (40+ URLs, 5 hreflang), Schema.org Product image fixed (4 pages). Cookie consent RGPD (5 langs).
- **i18n**: Full coverage (250.213-214). Dashboard i18n complete, all FR-hardcoded strings → VocaliaI18n.t(). B28-B37 fixed (email, ecommerce, telephony i18n).
- **Next**: Stripe setup → First paying customer
- **Weighted score**: 9.2/10

*Last update: 16/02/2026 - Session 250.215 (B44: remotion-hitl test isolation fix (7→0 failures), B41: booking detection fix, B45: widget DRIFT rebuild, B46: hero copy audit-aligned × 5 langs. +12 behavioral tests voice-api, +25 auth-service tests. 6,106 tests (92 .mjs), 500+ bugs / 61 phases.)*
