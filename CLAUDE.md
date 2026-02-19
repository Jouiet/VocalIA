# VocalIA - Voice AI Platform

> Voice AI SaaS | vocalia.ma | ~/Desktop/VocalIA/ | CommonJS (.cjs), 2 spaces, single quotes
> 85 pages | 5 langs (FR/EN/ES/AR/ARY) | RTL | ~86k lines | ~6,250 tests (94 .mjs, 0 skip)
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

## Key Docs (read with Read tool ONLY when needed — NOT auto-loaded)

- Architecture: `docs/VOCALIA-SYSTEM-ARCHITECTURE.md` (8 services, ports, data layer, AI providers)
- Roadmap: `docs/ROADMAP-TO-COMPLETION.md` (500+ bugs tracker, 71 phases, fix history)
- Business: `docs/BUSINESS-INTELLIGENCE.md` (costs, pricing, competitive analysis, GA4)
- Tests: `docs/TEST-COVERAGE-AUDIT.md` (6,250 tests, 221/221 functions, CRUD chains)
- Strategy: `docs/SESSION-250.214-REPORT.md` (ROI calc, KB score, speed metrics, Expert Clone)

## State (concise — detail in auto memory)

- **Code**: 9.8/10 | **Production**: 9.0/10 | **Security**: 9.2/10 | **Weighted**: 9.4/10
- 500+ bugs fixed across 71 phases, 8 not fixable locally. B52 = Node.js IPC bug (OPEN).
- 7 containers LIVE, 0 paying customers. OAuth SSO + Resend SMTP + Monitoring v3.0 LIVE.
- **SOTA Deep Surgery DONE** (250.221): 8 bugs fixed (B75-B82), 240MB deps removed, ProactiveScheduler file-based, TenantMemory singleton + flywheel, WhatsApp status tracking, QuotaAlertSkill
- **Next**: Stripe setup → First paying customer

*Last update: 19/02/2026 — Session 250.221: SOTA Deep Surgery (8 bugs, 3 features, 112 npm packages removed).*
