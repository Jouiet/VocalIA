# VocalIA - Voice AI Platform

> Voice AI SaaS | vocalia.ma | ~/Desktop/VocalIA/ | CommonJS (.cjs), 2 spaces, single quotes
> 78 pages | 5 langs (FR/EN/ES/AR/ARY) | RTL | ~82k lines | 3,764 tests (68 .mjs, 0 skip)
> 203 MCP tools | 38 personas | 25 function tools | 7 widgets

## Architecture

core/ (54 modules, 34.6k lines) | telephony/ (4.7k) | personas/ (8.7k) | widget/ (10.1k)
mcp-server/src/ (19.2k, 32 .ts) | lib/ (923) | sensors/ (822) | integrations/ (2.2k)
clients/ = 553 dirs (ALL test data) | website/ = 78 pages + locales (24k lines)

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
node scripts/validate-design-tokens.cjs                     # Design tokens (17 checks)
python3 scripts/translation-quality-check.py --verbose      # i18n QA
```

### ⛔ RECURRING TASK (every 15-20 sessions — NEVER DELETE)
Run `node scripts/validate-design-tokens.cjs`. Verify STALE_NUMBER_PATTERNS matches real numbers. See `.claude/rules/branding.md` "Platform Numbers" section.

## i18n

5 langs: FR, EN, ES, AR (RTL), ARY (RTL). Geo-detect: MA→FR+MAD, EU→FR+EUR, Other→EN+USD.

## Fallback Chain

grok (grok-4-1-fast-reasoning) → gemini (gemini-3-flash) → anthropic (claude-opus-4-5) → atlas (Atlas-Chat-9B) → local (rule-based)

## Pricing

Starter 49€/mo | Pro 99€/mo | E-commerce 99€/mo | Telephony 199€/mo + 0.10€/min
No Free Tier — 14-day trial only. Feature gating: `checkFeature()` in voice-api-resilient.cjs.

## Multi-Tenant

22 registered (0 paying) | 553 client folders (ALL test data) | 38 personas × 5 langs
Contact: +1 762 422 4223 | contact@vocalia.ma

## Key Docs

| Doc | Content |
|:----|:--------|
| `docs/ROADMAP-TO-COMPLETION.md` | Remaining work |
| `docs/BUSINESS-INTELLIGENCE.md` | Cost/pricing |
| `docs/VOCALIA-SYSTEM-ARCHITECTURE.md` | Full architecture |
| `.claude/rules/branding.md` | Design tokens + validator |
| `.claude/rules/core.md` | Code standards + credentials |

## State

- **Code completeness**: 9.0/10 — all features coded, tested, feature-gated
- **Production readiness**: 3.5/10 — website deployed, funnel connected, feature gating done, 0 paying customers
- **Next**: GA4 activation → first paying customer

*Last update: 08/02/2026 - Session 250.152 (admin sidebar component, nginx brotli, repo rename, Google Sheets verified)*
