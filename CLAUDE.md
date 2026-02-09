# VocalIA - Voice AI Platform

> Voice AI SaaS | vocalia.ma | ~/Desktop/VocalIA/ | CommonJS (.cjs), 2 spaces, single quotes
> 80 pages | 5 langs (FR/EN/ES/AR/ARY) | RTL | ~84k lines | 3,804 tests (68 .mjs, 0 skip)
> 203 MCP tools + 6 resources + 8 prompts | 38 personas | 25 function tools | 7 widgets

## Architecture

core/ (55 modules, 36.1k) | telephony/ (4.8k) | personas/ (8.8k) | widget/ (10.6k, 7 files)
mcp-server/src/ (17.6k, 31 .ts) | lib/ (923) | sensors/ (822) | integrations/ (2.2k)
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
- **Key Docs**: `docs/ROADMAP-TO-COMPLETION.md` | `docs/BUSINESS-INTELLIGENCE.md` | `docs/VOCALIA-SYSTEM-ARCHITECTURE.md`

## State

- **Code completeness**: 9.5/10 — 79 bugs found, 74 fixed, 5 remain (arch/non-fixable). MCP-SOTA Phase 0+1+2+3 complete: 203 tools + 6 resources + 8 prompts + auto-logging, all 3 MCP primitives, modern API, server.json for Registry. MCP score 2.5→8.0/10.
- **Production readiness**: 4.0/10 — VERIFIED via curl 250.171: website live, voice-api health OK, db-api connected (Google Sheets), auth works. BUT /respond BROKEN (old code on VPS — C14 VOICE_CONFIG not redeployed). Widget v2.7.0 live. 0 paying customers.
- **Market strategy**: 1. Europe → 2. MENA → 3. International → 4. Morocco. USP = price (60% cheaper EU) + widget+telephony unified. Darija = 1 of 5 languages.
- **VPS**: Hostinger KVM 2 (148.230.113.163) — 4 containers, Traefik SSL, vocalia-data named volume. API running but OLD code. NEEDS: redeploy with latest code + .env (6 missing keys)
- **Next**: MCP Phase 4 (HTTP transport + OAuth 2.1) → VPS redeploy → First paying customer
- **Weighted score**: 8.7/10

*Last update: 09/02/2026 - Session 250.171c (MCP-SOTA Phase 0+1+2+3: 203 tools + 6 resources + 8 prompts + logging + server.json, MCP 8.0/10)*
