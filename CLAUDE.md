# VocalIA - Voice AI Platform

> Voice AI SaaS | vocalia.ma | ~/Desktop/VocalIA/ | CommonJS (.cjs), 2 spaces, single quotes
> 80 pages | 5 langs (FR/EN/ES/AR/ARY) | RTL | ~84k lines | 3,765 tests (68 .mjs, 0 skip)
> 203 MCP tools + 6 resource types (43 URIs) + 8 prompts (SDK v1.26.0, stdio + HTTP + OAuth) | 38 personas | 25 function tools | 7 widgets

## Architecture

core/ (55 modules, 36.1k) | telephony/ (4.8k) | personas/ (8.8k) | widget/ (10.6k, 7 files)
mcp-server/src/ (19.5k, 32 .ts) | lib/ (923) | sensors/ (822) | integrations/ (2.2k)
clients/ = 553 dirs (ALL test data) | website/ = 80 pages + locales (26.2k)

## Services (8 HTTP servers)

**Deployed (4 Docker containers via Traefik):**

| Service | Port | Script |
|:--------|:----:|:-------|
| Voice API | 3004 | `core/voice-api-resilient.cjs` |
| Grok Realtime | 3007 | `core/grok-voice-realtime.cjs` |
| Telephony | 3009 | `telephony/voice-telephony-bridge.cjs` |
| DB API | 3013 | `core/db-api.cjs` |

**Non-deployed (standalone, code exists):**

| Service | Port | Script |
|:--------|:----:|:-------|
| OAuth Gateway | 3010 | `core/OAuthGateway.cjs` |
| Webhook Router | 3011 | `core/WebhookRouter.cjs` |
| Remotion HITL | 3012 | `core/remotion-hitl.cjs` (hybrid: library + optional server) |
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

- **Code completeness**: 9.5/10 — **372 bugs found across 32 phases, 8 not fixable locally** (VPS/arch), rest all fixed. Tests: 3,765 pass, 0 fail. Validator: 23/23.
- **Production readiness**: 3.5/10 — Website live, /respond BROKEN on VPS. 0 paying customers.
- **MCP Server**: Phase 0-6 DONE. MCP **9.0/10**. 29 tool files + index.ts + auth-provider + middleware audited. isError protocol compliance fixed.
- **UCP**: Unified — core + MCP + voice + telephony + recommendations all share `data/ucp/{tenantId}/profiles.json`. Zero fragmentation.
- **Next**: VPS redeploy (critical) → .env setup → SMTP provider → First paying customer
- **Weighted score**: 8.6/10

*Last update: 10/02/2026 - Session 250.191 (Runtime integrity deep scan: 6 bugs fixed — F16 saveCatalog guard, F17 Shopify token naming, F18 shop name fallback, F19-F20 path/fs missing imports, F21 docker-compose missing env vars)*
