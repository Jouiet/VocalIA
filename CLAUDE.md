# VocalIA - Voice AI Platform

> **v7.13.0** | 07/02/2026 | Health: Voice API UP (3004) | Production: https://vocalia.ma
> **77 pages** | 23,950 i18n lines | 5 langs (FR/EN/ES/AR/ARY) | RTL | **3,792 tests** (68 files, 0 skip)
> **203 MCP Tools** | 38 Personas | **25 Function Tools** | 8 E-commerce Widgets | 31 Integrations | Stripe 19 | HubSpot 7 | Twilio 5
> **~82k lines source** | Core 33,920 (53 files) + Telephony 4,709 + Personas 9,081 + Widget 9,353 + MCP/src 17,630 + Lib 921 + Website 31,512
> ✅ **SESSION 250.129 TENANT AUDIT**: External audit revealed tenant system non-functional. 4 root causes fixed: data-vocalia-tenant on 50 pages, camelCase→snake_case, GA4 infra, ECOM social proof. Score 8.6→7.2
> ✅ **SESSION 250.128 WIDGET FIXES**: P0-W2 XSS, P0-W3 CONFIG, P0-W4 branding (#5E6AD2), P0-W5 cleanup, P1-W6 WCAG
>    - **510 tenants** (B2B=270, B2C=186, ECOM=54) | **553 KB directories** × 5 languages = **2,765 KB files**
>    - **38 personas covered**: 12-13 tenants each | 12 regions

## Quick Reference

| Item | Value |
|:-----|:------|
| Type | Voice AI SaaS Platform |
| Domain | www.vocalia.ma |
| Location | `~/Desktop/VocalIA/` |
| Scores | **Tests**: 3,792 (68 files, 0 skip) — **Score**: 7.2/10 (250.129 — tenant audit), **CORS**: ✅, **XSS**: ✅ (B2B + ECOM both fixed) |

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
├── widget/         # 8 e-commerce widgets (9,353 lines)
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

- CommonJS (.cjs), 2 spaces, single quotes
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
| Voice Widget v3.2 | ✅ 8 widgets |
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

**Work Remaining:** See `docs/ROADMAP-TO-COMPLETION.md` — P0-TENANT fixed (250.129). Remaining: GA4 Measurement ID, P2-W7/W8/W9 (Shadow DOM, CDN, archive), P3-1 ESM, P3-4 A2A

**530 client folders** in `clients/` = TEST DATA (not real clients). Only 23 registry entries are production.

## ✅ Test Quality (Session 250.126 — Theater Purge)

| Pattern | Before (250.114) | After (250.126) | Status |
|:--------|:-----------------:|:----------------:|:------:|
| typeof 'function' exports | 223 (49 files) | 12 (contextual only) | ✅ Fixed |
| source-grep (content.includes) | 121 | 0 | ✅ Fixed (250.125) |
| module-load assert.ok | 20 | 0 | ✅ Fixed (250.125) |
| existsSync | 40 | 40 (all legitimate) | ✅ Audited |
| Files rewritten from scratch | — | 3 (llm-gateway, eventbus, embedding) | ✅ |
| Theater tests removed | — | 244 total | ✅ |

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

**Platform Score: 7.2/10** (250.129 — External audit: tenant system non-functional. 4 fixes: data-vocalia-tenant 50 pages, camelCase→snake_case, GA4 infra, ECOM social proof. 3,792 tests, 0 fail)
P0-P2 resolved. P0-WIDGET NEW (4 tasks). See `docs/ROADMAP-TO-COMPLETION.md`.

*Last update: 07/02/2026 - Session 250.127 (Widget forensic audit: source≠deployed, 57% dead code, 2 broken stubs, 3 color schemes. Score 8.4→7.8)*
