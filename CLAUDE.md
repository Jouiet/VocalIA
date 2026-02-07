# VocalIA - Voice AI Platform

> **v7.20.0** | 07/02/2026 | Health: Voice API UP (3004) | Production: https://vocalia.ma
> **77 pages** | 24,010 i18n lines | 5 langs (FR/EN/ES/AR/ARY) | RTL | **3,763 tests** (69 files .mjs, 0 skip)
> **203 MCP Tools** | 38 Personas | **25 Function Tools** | 8 E-commerce Widgets | 31 Integrations | Stripe 19 | HubSpot 7 | Twilio 5
> **~82k lines source** | Core 33,920 (53 files) + Telephony 4,709 + Personas 9,081 + Widget 9,671 + MCP/src 17,630 + Lib 921 + Website 31,512
> ✅ **SESSION 250.138 WIDGET TREE-SHAKING**: Build pipeline v2.0 (esbuild DCE→terser 3-pass→brotli). ECOM: 37.1 KB transfer. B2B: 8.3 KB transfer. Pre-compressed .gz/.br. Widget v2.5.0.
> ✅ **SESSION 250.137 APP COMPONENTIZATION**: Sidebar component (9 pages, -585 lines), calls AI insights, integrations webhook health, mobile all pages
> ✅ **SESSION 250.136 DASHBOARD+DOCS**: Client ROI section (4 cards), mobile responsive, Playwright CI, 16 audit docs archived, SESSION-HISTORY -67%, 8 ROADMAP tasks
> ✅ **SESSION 250.132 ESM MIGRATION**: 69 test files .cjs→.mjs, esbuild production bundler (3 bundles), const→let bug fix
> ✅ **SESSION 250.131 WIDGET INTEGRATION**: 3 widgets restored+integrated (spin-wheel, shipping-bar, reco-carousel). Orchestrator wired. B2B catalog mode. A2A/A2UI done.
>    - **510 tenants** (B2B=270, B2C=186, ECOM=54) | **553 KB directories** × 5 languages = **2,765 KB files**
>    - **38 personas covered**: 12-13 tenants each | 12 regions

## Quick Reference

| Item | Value |
|:-----|:------|
| Type | Voice AI SaaS Platform |
| Domain | www.vocalia.ma |
| Location | `~/Desktop/VocalIA/` |
| Scores | **Tests**: 3,763 (69 files .mjs, 0 skip) — **Score**: 8.8/10 (250.134), **Coverage**: 46.78%, **CORS**: ✅, **XSS**: ✅ |

---

## Architecture

```
VocalIA/                              # VÉRIFIÉ wc -l 06/02/2026 (Session 250.102)
├── core/           # 53 modules (33,920 lines)
│   ├── voice-api-resilient.cjs   # Multi-AI fallback (3,086 lines, port 3004)
│   ├── grok-voice-realtime.cjs   # WebSocket audio (1,109 lines, port 3007)
│   ├── db-api.cjs                # REST API + Auth (2,733 lines, port 3013)
│   ├── voice-crm-tools.cjs       # HubSpot + Pipedrive API (351 lines)
│   ├── voice-ecommerce-tools.cjs # Shopify + WooCommerce API (389 lines)
│   └── [+48 modules]
├── lib/            # 1 module (921 lines) - security-utils
├── telephony/      # PSTN bridge (4,709 lines, 25 function tools)
├── personas/       # 38 personas (8,479 .cjs + 602 .json = 9,081 lines)
├── widget/         # 7 e-commerce widgets (9,671 lines)
├── website/        # 77 pages (public + webapp)
│   └── src/locales/   # 5 langs (23,950 lines)
├── mcp-server/src/ # 203 tools TypeScript (17,630 lines, 31 .ts files)
├── clients/        # 553 tenant directories (auto-generated)
└── docs/           # SESSION-HISTORY.md for detailed logs
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

# Design Token Validation (14 checks, full codebase)
node scripts/validate-design-tokens.cjs

# Translation QA
python3 scripts/translation-quality-check.py --verbose

# Deploy
git push origin main
```

### ⛔ TÂCHE RÉCURRENTE CRITIQUE — TOUTES LES 15-20 SESSIONS — NE JAMAIS SUPPRIMER

Exécuter `node scripts/validate-design-tokens.cjs` et vérifier que les chiffres plateforme
(`STALE_NUMBER_PATTERNS` dans le script) correspondent aux vrais chiffres.
Si un chiffre a changé (personas, MCP tools, widgets, etc.), mettre à jour les patterns
du validateur PUIS corriger TOUTES les occurrences dans le codebase.
Voir `.claude/rules/branding.md` section 10 pour les commandes de vérification.

---

## Code Standards

- Source: CommonJS (.cjs), 2 spaces, single quotes
- Tests: ESM (.mjs), import from .cjs sources
- Build: esbuild → dist/ (voice-api, db-api, telephony)
- Credentials: `process.env.*`
- Errors: `console.error('❌ ...')`
- Success: `console.log('✅ ...')`

---

## MCP Server (203 Tools - Verified `grep -c "server.tool(" mcp-server/src/index.ts`)

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

---

## Key Features

| Feature | Status |
|:--------|:------:|
| Voice Widget v3.2 | ✅ 7 widgets (6 in ECOM bundle + 1 B2B) |
| Telephony TwiML | ✅ |
| Multi-tenant KB | ✅ |
| A2A Protocol | ✅ 4 agents |
| UCP/CDP | ✅ 7 tools |
| WordPress/WooCommerce | ✅ 7 MCP tools + PHP plugin |
| PWA | ✅ |
| A/B Testing | ✅ |

## Multi-Tenant System

| Metric | Value |
|:-------|:------|
| Personas | **38/38** (SYSTEM_PROMPTS + PERSONAS) |
| Registered Clients | **23** (`client_registry.json`) |
| Client Folders | **553** (23 real + 530 test data) |
| KB Files | **2,765** (553 dirs × 5 langs) |

**Work Remaining:** See `docs/ROADMAP-TO-COMPLETION.md` — P2-WIDGET + P3-4 done (250.131). Remaining: GA4 Measurement ID (user), CDN infra, P3-1 ESM (10h)

**530 client folders** in `clients/` = TEST DATA (not real clients). Only 23 registry entries are production.

## ✅ Test Quality (Session 250.132 — ESM Migration)

| Pattern | Before (250.114) | After (250.132) | Status |
|:--------|:-----------------:|:----------------:|:------:|
| typeof 'function' exports | 223 (49 files) | 12 (contextual only) | ✅ Fixed |
| source-grep (content.includes) | 121 | 0 | ✅ Fixed (250.125) |
| module-load assert.ok | 20 | 0 | ✅ Fixed (250.125+250.132) |
| existsSync | 40 | 40 (all legitimate) | ✅ Audited |
| Files rewritten from scratch | — | 3 (llm-gateway, eventbus, embedding) | ✅ |
| Theater tests removed | — | 244+ total | ✅ |
| ESM migration | 69 files .cjs | 69 files .mjs | ✅ 250.132 |
| esbuild production bundles | — | 3 targets (voice-api, db-api, telephony) | ✅ 250.132 |

**Remaining**: MAIN API + DB API still need behavioral function call tests (P0 tasks).

---

## Documentation

| Doc | Content |
|:----|:--------|
| `docs/VOCALIA-SYSTEM-ARCHITECTURE.md` | Full architecture (988 lines) |
| `docs/SESSION-HISTORY.md` | **All session logs** |
| `docs/VOCALIA-MCP.md` | MCP 203 tools |
| `docs/PLUG-AND-PLAY-STRATEGY.md` | Multi-tenant |

---

## Products

| Product | Pricing |
|:--------|:--------|
| Voice Widget | 49€/month |
| Voice Telephony | 0.06€/min |

**Policy:** No Free Tier - 14-day trial only

> ⚠️ **Session 250.114**: Test forensic audit — 453 theater tests, score recalculated 8.0→5.2
> ✅ **Session 250.113**: Coverage 52.57% stmts, 2,611 tests, kb-crawler regex bug fix
> ✅ **Session 250.105**: XSS fixed, CI tests added, function tool docs corrected

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

**Platform Score: 9.0/10** (250.138 — Widget tree-shaking pipeline v2.0, pre-compression .gz/.br, widget v2.5.0)
ALL code tasks DONE. See `docs/ROADMAP-TO-COMPLETION.md`. Remaining: optional source ESM + infrastructure (GA4 ID, CDN, monitoring).

*Last update: 07/02/2026 - Session 250.133 (CI hardening: tsc --noEmit, c8 coverage 45%, rogue #0f0f23 fixed, onboarding 6 bugs, stale "40", lucide pinned)*
