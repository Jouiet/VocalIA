# VocalIA - Voice AI Platform

> Voice AI SaaS | vocalia.ma | CommonJS (.cjs), 2 spaces, single quotes
> 80 pages | 5 langs (FR/EN/ES/AR/ARY) | RTL | ~83k lines | 3,764 tests (68 .mjs)
> 203 MCP tools | 38 personas | 25 function tools | 7 widgets

## Architecture

core/ (55 modules, 35.4k) | telephony/ (4.8k) | personas/ (8.8k) | widget/ (10.6k, 7 files)
mcp-server/src/ (19.2k, 32 .ts) | lib/ (923) | sensors/ (822) | integrations/ (2.2k)
clients/ = 553 dirs (ALL test data) | website/ = 80 pages + locales (26.2k)

## Services

| Service | Port | Script |
|:--------|:----:|:-------|
| Voice API | 3004 | `core/voice-api-resilient.cjs` |
| Grok Realtime | 3007 | `core/grok-voice-realtime.cjs` |
| Telephony | 3009 | `telephony/voice-telephony-bridge.cjs` |
| OAuth Gateway | 3010 | `core/OAuthGateway.cjs` |
| Webhook Router | 3011 | `core/WebhookRouter.cjs` |
| DB API | 3013 | `core/db-api.cjs` |

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
- **Key Docs**: @docs/ROADMAP-TO-COMPLETION.md | @docs/BUSINESS-INTELLIGENCE.md | @docs/VOCALIA-SYSTEM-ARCHITECTURE.md

## State

- **Code completeness**: 9.9/10 — all features coded, tested, P0-WEBSITE 23/23 ✅, P0-COMPONENTS 0 warnings, validator covers ALL 80 pages
- **Production readiness**: 5.5/10 — website deployed, API backend LIVE on VPS (4 containers healthy), widget can chat, 0 paying customers
- **VPS**: Hostinger KVM 2 (148.230.113.163) — vocalia-api, db-api, realtime, telephony. Traefik SSL.
- **Next**: DNS ws/tel subdomains → first paying customer → GA4

*Last update: 08/02/2026 - Session 250.163*
