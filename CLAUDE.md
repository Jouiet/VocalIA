# VocalIA - Voice AI Platform

> Voice AI SaaS | vocalia.ma | CommonJS (.cjs), 2 spaces, single quotes
> 80 pages | 5 langs (FR/EN/ES/AR/ARY) | RTL | ~83k lines | 3,773 tests (68 .mjs)
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

- **Code completeness**: 8.7/10 — 250.169: +8 bugs fixed (WebSocket auth via header, widget config injection blocked, mrrGrowth real data, dashboard metrics persisted, UUID 12-char, HITL already persisted, signup/forgot UX resolved). All P1 code bugs resolved. 54 total bugs (43 fixed, 11 remain — mostly VPS infra)
- **Production readiness**: 2.5/10 — Website deployed, API on VPS BUT: Docker data ephemeral, 7 missing VPS env vars, SMTP not configured. 0 paying customers
- **Market strategy**: 1. Europe → 2. MENA → 3. International → 4. Morocco. USP = price (60% cheaper EU) + widget+telephony unified. Darija = 1 of 5 languages.
- **VPS**: Hostinger KVM 2 (148.230.113.163) — vocalia-api, db-api, realtime, telephony. Traefik SSL. MISSING: Docker volumes, JWT_SECRET, VOCALIA_VAULT_KEY, STRIPE_SECRET_KEY, SMTP_*
- **Next**: VPS infra fixes (Docker volumes, env vars, SMTP) → First paying customer

*Last update: 09/02/2026 - Session 250.169 (Phase 5: 8 bugs fixed, 11 remain. Code 8.4→8.7, Weighted 7.3→7.6)*
