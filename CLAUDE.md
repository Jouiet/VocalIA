# VocalIA - Voice AI Platform

> **v7.21.0** | 08/02/2026 | Production: https://vocalia.ma
> **78 pages** | 23,995 i18n lines | 5 langs (FR/EN/ES/AR/ARY) | RTL | **3,763 tests** (68 files .mjs, 0 skip)
> **203 MCP Tools** (0 connected) | 38 Personas | **25 Function Tools** | 7 Widgets | 22 Registered Clients (0 paying)
> **~81k lines source** | Core 34,533 (54) + Telephony 4,732 + Personas 8,700 + Widget 9,671 + MCP/src 19,173 (32) + Lib 923 + Sensors 822 + Integrations 2,234
> ✅ **SESSION 250.139 DOC OVERHAUL**: All documentation audited and corrected. Production readiness matrix added. Vanity metrics eliminated.
> ✅ **SESSION 250.138 WIDGET TREE-SHAKING**: Build pipeline v2.0 (esbuild DCE→terser 3-pass→brotli). ECOM: 37.1 KB transfer. B2B: 8.3 KB transfer.

## Quick Reference

| Item | Value |
|:-----|:------|
| Type | Voice AI SaaS Platform |
| Domain | www.vocalia.ma |
| Location | `~/Desktop/VocalIA/` |
| Tests | 3,763 (68 files .mjs, 0 skip), Coverage: 46.78% |
| Code Completeness | **8.5/10** — all major features coded and tested |
| Production Readiness | **3.0/10** — website deployed, 0 paying customers, 0 live integrations |

---

## Production Readiness Matrix

| Component | Code | Tests | Deployed | Live Data | Score |
|:----------|:----:|:-----:|:--------:|:---------:|:-----:|
| Website (78 pages) | ✅ | — | ✅ vocalia.ma | ✅ i18n works | 9/10 |
| Voice Widget B2B | ✅ | ✅ | ✅ on website | ❌ 0 real conversations | 5/10 |
| Voice Widget ECOM | ✅ | ✅ | ✅ 1 demo page | ❌ no catalog connected | 3/10 |
| Voice API (3004) | ✅ | ✅ | ✅ server runs | ❌ 0 live API calls | 4/10 |
| Telephony PSTN | ✅ | ✅ | ❌ no Twilio config | ❌ 0 calls | 2/10 |
| MCP Server (203 tools) | ✅ | — | ❌ TypeScript only | ❌ 0 API keys | 1/10 |
| Multi-tenant (22 entries) | ✅ | ✅ | ❌ all test data | ❌ 0 customers | 2/10 |
| OAuth/Webhook/DB APIs | ✅ | ✅ | ❌ not running | ❌ | 1/10 |
| i18n (5 langs) | ✅ | ✅ | ✅ website | ✅ geo-detect | 9/10 |
| Build Pipeline | ✅ | — | ✅ esbuild+terser+brotli | ✅ | 9/10 |

---

## Architecture

```
VocalIA/                              # VERIFIED wc -l 08/02/2026 (Session 250.139)
├── core/           # 54 modules (34,533 lines)
│   ├── voice-api-resilient.cjs   # Multi-AI fallback (port 3004)
│   ├── grok-voice-realtime.cjs   # WebSocket audio (port 3007)
│   ├── db-api.cjs                # REST API + Auth (port 3013)
│   ├── voice-crm-tools.cjs       # HubSpot + Pipedrive API
│   ├── voice-ecommerce-tools.cjs # Shopify + WooCommerce API
│   └── [+49 modules]
├── lib/            # 1 module (923 lines) - security-utils
├── telephony/      # PSTN bridge (4,732 lines, 25 function tools)
├── personas/       # 38 personas (8,700 lines: 8,055 .cjs + 61 .cjs + 584 .json)
├── widget/         # 7 widgets (9,671 lines: 6 ECOM IIFEs + 1 B2B)
├── website/        # 78 pages (public + webapp)
│   └── src/locales/   # 5 langs (23,995 lines)
├── mcp-server/src/ # 203 tools TypeScript (19,173 lines, 32 .ts files)
├── clients/        # 553 tenant directories (ALL test data, 0 production)
└── docs/           # Architecture, ROADMAP, session history
```

---

## Services

| Service | Port | Command |
|:--------|:----:|:--------|
| Voice API | 3004 | `node core/voice-api-resilient.cjs` |
| Grok Realtime | 3007 | `node core/grok-voice-realtime.cjs` |
| Telephony | 3009 | `node telephony/voice-telephony-bridge.cjs` |
| OAuth Gateway | 3010 | `node core/OAuthGateway.cjs --start` |
| Webhook Router | 3011 | `node core/WebhookRouter.cjs --start` |
| DB API | 3013 | `node core/db-api.cjs` |
| Website | 8080 | `npx serve website` |

---

## Credentials

| Key | Service | Required |
|:----|:--------|:--------:|
| XAI_API_KEY | Grok (PRIMARY) | ✅ |
| GOOGLE_GENERATIVE_AI_API_KEY | Gemini | ✅ |
| ELEVENLABS_API_KEY | TTS/STT | ✅ |
| TWILIO_* | Telephony | For PSTN |
| ANTHROPIC_API_KEY | Claude fallback | Optional |

---

## i18n

| Lang | Code | RTL |
|:-----|:----:|:---:|
| Français | fr | No |
| English | en | No |
| Español | es | No |
| العربية | ar | Yes |
| Darija | ary | Yes |

**Geo-detect:** MA→FR+MAD, EU→FR+EUR, Other→EN+USD

---

## Commands

```bash
# Health
node scripts/health-check.cjs

# Build CSS
cd website && npm run build:css

# Build Widgets (v2.0 — esbuild DCE → terser 3-pass → brotli)
node scripts/build-widgets.cjs [--production] [--check]

# Design Token Validation (17 checks, full codebase)
node scripts/validate-design-tokens.cjs

# Translation QA
python3 scripts/translation-quality-check.py --verbose

# Deploy
git push origin main
```

### ⛔ TACHE RECURRENTE CRITIQUE — TOUTES LES 15-20 SESSIONS — NE JAMAIS SUPPRIMER

Executer `node scripts/validate-design-tokens.cjs` et verifier que les chiffres plateforme
(`STALE_NUMBER_PATTERNS` dans le script) correspondent aux vrais chiffres.
Si un chiffre a change (personas, MCP tools, widgets, etc.), mettre a jour les patterns
du validateur PUIS corriger TOUTES les occurrences dans le codebase.
Voir `.claude/rules/branding.md` section 10 pour les commandes de verification.

---

## Code Standards

- Source: CommonJS (.cjs), 2 spaces, single quotes
- Tests: ESM (.mjs), import from .cjs sources
- Build: esbuild → dist/ (voice-api, db-api, telephony)
- Widgets: esbuild DCE → terser 3-pass → .gz/.br pre-compression
- Credentials: `process.env.*`
- Errors: `console.error('❌ ...')`
- Success: `console.log('✅ ...')`

---

## MCP Server (203 Tools — code only, 0 connected to real APIs)

Verified: `grep -c "server.tool(" mcp-server/src/index.ts` = 203

| Category | Tools |
|:---------|:-----:|
| Stripe | 19 |
| Shopify | 8 |
| WooCommerce | 7 |
| Magento | 10 |
| PrestaShop | 10 |
| BigCommerce | 9 |
| Wix | 6 |
| Squarespace | 7 |
| Pipedrive | 7 |
| Zendesk | 6 |
| Freshdesk | 6 |
| Gmail | 7 |
| Drive | 6 |
| Sheets | 5 |
| Docs | 4 |
| Calendly | 6 |
| UCP/CDP | 7 |
| Zoho | 6 |
| Klaviyo | 5 |
| Twilio | 5 |
| Make | 5 |
| n8n | 5 |
| Zapier | 3 |
| Export | 5 |
| Email | 3 |
| Recommendations | 4 |
| Calendar | 2 |
| Slack | 1 |
| Inline (system/voice/persona) | 22 |

**Reality check**: All 203 tools are TypeScript definitions. None are connected to real external APIs in production. They require API keys to be configured per-tenant.

---

## Key Features

| Feature | Code Status | Deployment Status |
|:--------|:----------:|:-----------------:|
| Voice Widget B2B (1,122 LOC) | ✅ coded + tested | ✅ deployed on website, ❌ no real users |
| Voice Widget ECOM (6 IIFEs, 8,549 LOC bundle) | ✅ coded + tested | ✅ 1 demo page, ❌ no catalog |
| Telephony TwiML (4,732 LOC) | ✅ coded + tested | ❌ no Twilio credentials |
| Multi-tenant KB | ✅ coded + tested | ❌ test data only |
| A2A Protocol (4 agents) | ✅ coded | ❌ not connected |
| UCP/CDP (7 tools) | ✅ coded | ❌ no real user profiles |
| WordPress/WooCommerce | ✅ 7 MCP tools + PHP plugin | ❌ no WP site connected |
| PWA | ✅ manifest + SW | ✅ deployed |
| A/B Testing | ✅ coded | ❌ no real traffic |

## Multi-Tenant System

| Metric | Value | Reality |
|:-------|:------|:--------|
| Personas | **38/38** | All coded with 5 lang prompts |
| Registered Clients | **22** (`client_registry.json`) | All test/demo entries |
| Client Folders | **553** | ALL test data (auto-generated) |
| KB Files | **2,765** (553 dirs × 5 langs) | Auto-generated, not real content |
| Paying Customers | **0** | No billing system active |

**Known bug**: agency_internal has phone conflict (registry: +33..., config.json: +212...) and missing KB directory.

## Test Quality (Session 250.132 — ESM Migration)

| Pattern | Before (250.114) | After (250.132) | Status |
|:--------|:-----------------:|:----------------:|:------:|
| typeof 'function' exports | 223 (49 files) | 12 (contextual only) | ✅ Fixed |
| source-grep (content.includes) | 121 | 0 | ✅ Fixed (250.125) |
| module-load assert.ok | 20 | 0 | ✅ Fixed (250.125+250.132) |
| existsSync | 40 | 40 (all legitimate) | ✅ Audited |
| Files rewritten from scratch | — | 3 (llm-gateway, eventbus, embedding) | ✅ |
| Theater tests removed | — | 244+ total | ✅ |
| ESM migration | 69 files .cjs | 68 files .mjs | ✅ 250.132 |
| esbuild production bundles | — | 3 targets (voice-api, db-api, telephony) | ✅ 250.132 |

---

## Documentation

| Doc | Content |
|:----|:--------|
| `docs/VOCALIA-SYSTEM-ARCHITECTURE.md` | Full architecture (~988 lines) |
| `docs/SESSION-HISTORY.md` | All session logs |
| `docs/VOCALIA-MCP.md` | MCP 203 tools reference |
| `docs/PLUG-AND-PLAY-STRATEGY.md` | Multi-tenant strategy |
| `docs/ROADMAP-TO-COMPLETION.md` | Remaining work |

---

## Products

| Product | Pricing | Status |
|:--------|:--------|:-------|
| Voice Widget | 49€/month | Code complete, 0 subscribers |
| Voice Telephony | 0.06€/min | Code complete, not configured |

**Policy:** No Free Tier - 14-day trial only

---

## Fallback Chain

```javascript
providers: [
  { name: 'grok', model: 'grok-4-1-fast-reasoning' },
  { name: 'gemini', model: 'gemini-3-flash' },
  { name: 'anthropic', model: 'claude-opus-4-5' },
  { name: 'atlas', model: 'Atlas-Chat-9B' },  // Darija
  { name: 'local', model: 'rule-based' }
]
```

---

## Voice Providers

| Provider | Use |
|:---------|:----|
| Grok | Primary LLM + Voice |
| Gemini | Fallback + TTS |
| ElevenLabs | Darija TTS (27 voices) |
| Twilio | Telephony PSTN |
| Web Speech API | Widget fallback |

---

**Code Completeness: 8.5/10** — All major features coded, tested (3,763 tests), build pipeline optimized.
**Production Readiness: 3.0/10** — Website deployed. Zero paying customers. Zero live integrations. Zero real voice calls.
**Next milestone**: First paying customer, first connected external API.

*Last update: 08/02/2026 - Session 250.139 (Documentation overhaul: all metrics verified, production readiness matrix, vanity metrics eliminated)*
