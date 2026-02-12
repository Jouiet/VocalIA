# VocalIA - Voice AI Platform

> Voice AI SaaS | vocalia.ma | ~/Desktop/VocalIA/ | CommonJS (.cjs), 2 spaces, single quotes
> 80 pages | 5 langs (FR/EN/ES/AR/ARY) | RTL | ~85k lines | 4,903 tests (75 .mjs, 0 skip)
> 203 MCP tools + 6 resource types (43 URIs) + 8 prompts (SDK v1.26.0, stdio + HTTP + OAuth) | 38 personas | 25 function tools | 7 widgets

## Architecture

core/ (55 modules, 36.1k) | telephony/ (4.8k) | personas/ (8.8k) | widget/ (10.6k, 7 files)
mcp-server/src/ (19.5k, 32 .ts) | lib/ (923) | sensors/ (822) | integrations/ (2.2k)
clients/ = 553 dirs (ALL test data) | website/ = 81 pages + locales (26.2k)

## Services (8 HTTP servers)

**Deployed (6 Docker containers via Traefik):**

| Service | Port | Script | Profile |
|:--------|:----:|:-------|:--------|
| Voice API | 3004 | `core/voice-api-resilient.cjs` | core |
| Grok Realtime | 3007 | `core/grok-voice-realtime.cjs` | core |
| Telephony | 3009 | `telephony/voice-telephony-bridge.cjs` | core |
| DB API | 3013 | `core/db-api.cjs` | core |
| OAuth Gateway | 3010 | `core/OAuthGateway.cjs --start` | integrations |
| Video HITL | 3012 | `core/remotion-hitl.cjs --server` | video |

**Non-deployed (standalone, code exists):**

| Service | Port | Script |
|:--------|:----:|:-------|
| Webhook Router | 3011 | `core/WebhookRouter.cjs` |
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
- **Pricing**: Starter 49€ | Pro 99€ | E-commerce 99€ | Telephony 199€ + 0.10€/min. No Free Tier, 14-day trial.
- **Multi-Tenant**: 22 registered (0 paying) | 553 client folders = test data | 38 personas × 5 langs
- **Key Docs**: `docs/ROADMAP-TO-COMPLETION.md` | `docs/BUSINESS-INTELLIGENCE.md` | `docs/VOCALIA-SYSTEM-ARCHITECTURE.md`

## State

- **Code completeness**: 9.5/10 — **415 bugs found across 43 phases, 8 not fixable locally** (VPS/arch), rest all fixed. Tests: 4,903 pass, 0 fail. Validator: 23/23. **ALL CODE tasks complete. ALL 21 app pages + 5 auth pages audited.**
- **Security**: 9.0/10 — SOTA audit (250.200): CDN SRI 78/78, CSP 22 app pages, security headers all 7 API services, CORS tightened, npm vulns patched, **all 7 containers non-root** (su-exec node user PID 1). VPS: SSH key-only, fail2ban, UFW. X-XSS-Protection: 0 (modern).
- **Monitoring**: Production monitor v3.0 LIVE — 7 endpoints + 7 containers + disk/mem/SSL, ntfy.sh alerts, recovery detection, */5 cron.
- **Backup**: Daily at 2 AM UTC, 7-day retention, ~4KB compressed. Cron on VPS.
- **Marketing integrity**: 100% — Remediation COMPLETE (250.195-197): 34 HTML + locale keys + 12/12 blog disclaimers. Zero false claims.
- **Production readiness**: 8.0/10 — Website live + API + monitoring + security hardened + non-root containers + backup. 7 containers healthy. Missing: SMTP, Stripe, OAuth credentials, 0 paying customers.
- **OAuth SSO**: Deployed (250.198). Blocked: GOOGLE_CLIENT_ID/SECRET, GITHUB_CLIENT_ID/SECRET not configured.
- **Video Studio**: E2E verified (250.197-199). Veo FUNCTIONAL (GCP ADC). Kling API = external 500 (crédits).
- **MCP Server**: 9.0/10. 203 tools + 6 resources + 8 prompts.
- **UCP**: Unified — core + MCP + voice + telephony + recommendations. Zero fragmentation.
- **Next**: OAuth credentials → SMTP provider → Stripe setup → First paying customer
- **Weighted score**: 9.1/10

*Last update: 12/02/2026 - Session 250.200b (SOTA security: CDN SRI 78/78 + CSP 22 pages + security headers 6 services + CORS fix + npm audit + .htaccess CSP fix. 415 bugs / 43 phases.)*
