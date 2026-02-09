# VocalIA - Voice AI Platform

> Voice AI SaaS | vocalia.ma | ~/Desktop/VocalIA/ | CommonJS (.cjs), 2 spaces, single quotes
> 80 pages | 5 langs (FR/EN/ES/AR/ARY) | RTL | ~84k lines | 3,804 tests (68 .mjs, 0 skip)
> 203 MCP tools + 6 resource types (43 URIs) + 8 prompts (SDK v1.26.0, stdio + HTTP + OAuth) | 38 personas | 25 function tools | 7 widgets

## Architecture

core/ (55 modules, 36.1k) | telephony/ (4.8k) | personas/ (8.8k) | widget/ (10.6k, 7 files)
mcp-server/src/ (19.5k, 32 .ts) | lib/ (923) | sensors/ (822) | integrations/ (2.2k)
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

- **Code completeness**: 7.5/10 — **149 bugs found, 75 fixed, 74 unfixed** (69 from 250.172 deep audit: 3C/9H/52M/5L). MCP **9.0/10** (203 tools, 6 resources, 8 prompts, SDK v1.26.0, dual transport, OAuth 2.1, Dockerfile).
- **Production readiness**: 4.0/10 — Website live, /respond BROKEN on VPS. 0 paying customers.
- **MCP Server**: Phase 0-5 DONE. MCP **8.5/10**. stdio + Streamable HTTP + OAuth 2.1 + CORS + rate limiting. Dockerfile ready (untested). Needs: npm login + publish, Docker Hub push, MCP Registry submit. Known: 2 tool modules have process.cwd() path bug, OAuth store in-memory only.
- **Next**: Fix 74 audit bugs → npm publish → VPS redeploy → First paying customer
- **Weighted score**: 6.8/10

*Last update: 09/02/2026 - Session 250.172b (MCP Phase 4+5: HTTP transport, OAuth 2.1, Dockerfile, README v1.0.0, LLMGateway dotenv fix)*
