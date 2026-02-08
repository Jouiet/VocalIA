# VocalIA - Voice AI Platform

> Voice AI SaaS | vocalia.ma | ~/Desktop/VocalIA/ | CommonJS (.cjs), 2 spaces, single quotes
> 79 pages | 5 langs (FR/EN/ES/AR/ARY) | RTL | ~83k lines | 3,763 tests (68 .mjs, 0 skip)
> 203 MCP tools | 38 personas | 25 function tools | 7 widgets

## Architecture

core/ (55 modules, 35.4k lines) | telephony/ (4.8k) | personas/ (8.8k) | widget/ (10.6k, 7 files)
mcp-server/src/ (19.2k, 32 .ts) | lib/ (923) | sensors/ (822) | integrations/ (2.2k)
clients/ = 553 dirs (ALL test data) | website/ = 79 pages + locales (26.2k lines)

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

## Bugs Fixed (Audit 250.153 → ALL RESOLVED 250.154)

| Bug | Status | Fix |
|:----|:------:|:----|
| `conversationStore` not imported | ✅ FIXED | Added import from conversation-store.cjs |
| CORS blocks third-party origins | ✅ FIXED | Tenant domain whitelist from client_registry.json |
| CDN `cdn.vocalia.ma` non-existent | ✅ FIXED | Replaced all refs with direct vocalia.ma URLs |
| WordPress plugin broken (3 bugs) | ✅ FIXED | JS URL, CONFIG var, persona count |
| V3 fake social proof fallback | ✅ FIXED | Removed getDefaultSocialProofMessages() |
| `email-service.cjs` missing | ✅ FIXED | Created core/email-service.cjs (nodemailer) |
| Gemini version inconsistency | ✅ FIXED | Unified to gemini-3-flash |
| B2B version mismatch | ✅ FIXED | Unified to 2.7.0 |
| Permissions-Policy microphone | ✅ FIXED | Changed to microphone=(self) |

## State

- **Code completeness**: 9.6/10 — all features coded, tested, P0-AUDIT 9/9 DONE, multi-tenant security hardened, Shadow DOM 7/7 widgets, A2UI XSS sanitized, i18n 100% (4,858 keys × 5 langs, 0 missing)
- **Production readiness**: 3.5/10 — website deployed, widget VISIBLE on live site (v2.7.0), 0 paying customers, API backend NOT deployed on VPS. Needs: VPS deployment, first customer, GA4
- **Next**: VPS deployment (API backend) → first paying customer → GA4 activation
- **Weighted score**: 8.4/10

*Last update: 08/02/2026 - Session 250.159 (WAF .min.js fix, 170+ i18n broken translations, live widget verified, forensic audit)*
