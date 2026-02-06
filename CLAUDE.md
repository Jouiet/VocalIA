# VocalIA - Voice AI Platform

> **v7.10.0** | 06/02/2026 | Health: Voice API UP (3004) | Production: https://vocalia.ma
> **77 pages** | 23,950 i18n lines | 5 langs (FR/EN/ES/AR/ARY) | RTL | 281 unit + 57 E2E = **338 tests**
> **203 MCP Tools** | 40 Personas | **25 Function Tools** | 8 E-commerce Widgets | 31 Integrations | Stripe 19 | HubSpot 7 | Twilio 5
> **~80k lines source** | Core 33,728 (53 files) + Telephony 4,709 + Personas 7,374 + Widget 9,107 + MCP/src 17,630 + Lib 921 + Website 31,512
> ✅ **SESSION 250.97octies:** MULTI-TENANT SCALE - 30→537 tenants | 2,890 KB files | 12 regions | 40 sectors
>    - **537 tenants** (B2B=283, B2C=200, ECOM=54) | **580 KB directories** × 5 languages = **2,890 KB files**
>    - **12 regions**: Morocco(3), France, Spain, UK, UAE, Belgium, Netherlands, Switzerland, Canada, Germany
>    - **40 personas covered**: 12-13 tenants each | Widget testing infrastructure PRODUCTION READY

## Quick Reference

| Item | Value |
|:-----|:------|
| Type | Voice AI SaaS Platform |
| Domain | www.vocalia.ma |
| Location | `~/Desktop/VocalIA/` |
| Scores | **Backend**: 281 unit tests, **Frontend**: 57 E2E tests, **Security**: CORS db-api wildcard issue |

---

## Architecture

```
VocalIA/                              # VÉRIFIÉ wc -l 06/02/2026 (Session 250.98)
├── core/           # 53 modules (33,728 lines)
│   ├── voice-api-resilient.cjs   # Multi-AI fallback (3,086 lines, port 3004)
│   ├── grok-voice-realtime.cjs   # WebSocket audio (1,109 lines, port 3007)
│   ├── db-api.cjs                # REST API + Auth (2,733 lines, port 3013)
│   ├── voice-crm-tools.cjs       # HubSpot + Pipedrive API (351 lines)
│   ├── voice-ecommerce-tools.cjs # Shopify + WooCommerce API (389 lines)
│   └── [+48 modules]
├── lib/            # 1 module (921 lines) - security-utils
├── telephony/      # PSTN bridge (4,709 lines, 25 function tools)
├── personas/       # 40 personas (6,722 .cjs + 591 .json = 7,374 lines)
├── widget/         # 8 e-commerce widgets (9,107 lines)
├── website/        # 77 pages (public + webapp)
│   └── src/locales/   # 5 langs (23,950 lines)
├── mcp-server/src/ # 203 tools TypeScript (17,630 lines, 31 .ts files)
├── clients/        # 580 tenant directories (auto-generated)
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

# Translation QA
python3 scripts/translation-quality-check.py --verbose

# Deploy
git push origin main
```

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

## WordPress/WooCommerce (COMPLETE - Session 250.94)

| Composant | Fichier | Lignes | Fonction |
|:----------|:--------|:------:|:---------|
| **MCP WooCommerce** | `mcp-server/src/tools/woocommerce.ts` | 687 | 7 tools REST v3 |
| **WordPress Plugin** | `plugins/wordpress/vocalia-voice-widget.php` | 514 | Widget injection |
| **Catalog Connector** | `core/catalog-connector.cjs` | ~200 | WooCommerceCatalogConnector |
| **Voice Ecom Tools** | `core/voice-ecommerce-tools.cjs` | 389 | checkOrderStatus, getOrderHistory |

**WooCommerce MCP Tools (7):**
`woocommerce_list_orders`, `woocommerce_get_order`, `woocommerce_update_order`, `woocommerce_list_products`, `woocommerce_get_product`, `woocommerce_list_customers`, `woocommerce_get_customer`

**Note:** `wordpress.ts` MCP N'EST PAS nécessaire - WooCommerce couvre 100% du besoin e-commerce WordPress.

---

## Multi-Tenant System (Session 250.97ter - VERIFIED ✅)

| Metric | Value | Verification |
|:-------|:------|:-------------|
| Sector→PERSONAS Mapping | **40/40** ✅ | All 40 sectors in both SYSTEM_PROMPTS and PERSONAS |
| Template Usages | 181 | `grep -c '{{' personas/voice-persona-injector.cjs` |
| Client Folders | **580** | `ls clients/ \| wc -l` (B2B=282, B2C=204, ECOM=61, UUID=30) |
| Clients in Registry | **23** | `jq '.clients \| keys \| length' personas/client_registry.json` |
| KB Files in clients/ | **2,890** | `find clients -name "kb_*.json" \| wc -l` (578 dirs × 5 langs) |
| KB in data/ legacy | 1 | `ls data/knowledge-base/tenants/` → client_demo only |
| **GAP** | **557** | 580 folders - 23 registry entries = 557 NOT in registry |

**Score Methodology:** See `docs/AUDIT-MULTI-TENANT-SESSION-250.57.md` § "MÉTHODOLOGIE DE SCORE MULTI-TENANT"

**Session 250.97ter Fixes:**
- ✅ 15 sectors corrected in client_registry.json (was falling back to AGENCY)
- ✅ NOTARY + REAL_ESTATE_AGENT: Added B2B widget compatibility
- ✅ Exports: Added SYSTEM_PROMPTS + CLIENT_REGISTRY

**Session 250.99 Deep Surgery Fixes:**
- ✅ Social Proof V3: Fake data REMOVED → real `/social-proof` backend endpoint
- ✅ Social Proof B2B: Fully implemented (was 0 functions)
- ✅ Booking B2B: `isBookingIntent()` (5 langs) + `showBookingCTA()` implemented
- ✅ Dashboard: 3 widget feature toggles added to settings.html
- ✅ KB: `booking` section added to all 5 language templates
- ✅ XSS: Social proof textContent fix (innerHTML count 15 → 9)
- ✅ client_registry.json: `booking_url` field on 11 booking-required clients

**Session 250.100 Security Hardening Fixes:**
- ✅ CORS wildcard `*` → origin whitelist in db-api.cjs (vocalia.ma + localhost)
- ✅ `free_price: "0"` → `"49"` in all 5 locale files (no-free-tier enforced)
- ✅ innerHTML XSS: addMessage→textContent, product cards→escapeHTML (count 9→5)
- ✅ B2B notification bubble: innerHTML→textContent

**Work Remaining:**
- P0: Register 557 clients into client_registry.json (2h)
- P1: Add conversational format to 37 personas (6h)
- P2: Sync function tool names in docs vs actual code (1h)

**Docs:** `docs/AUDIT-MULTI-TENANT-SESSION-250.57.md`, `docs/MULTI-TENANT-KB-OPTIMIZATION-PLAN.md`

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

> ✅ **Session 250.100**: CORS wildcard FIXED (origin whitelist), `free_price` FIXED (0→49), innerHTML XSS 15→5
> ⚠️ **Tests réels**: 281 unit + 57 E2E = 338 total (NOT 681 as previously claimed)

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

---

## Session 250.98 Forensic Findings (06/02/2026)

| Finding | Severity | Detail |
|:--------|:--------:|:-------|
| ~~CORS wildcard db-api~~ | ~~**HIGH**~~ | **FIXED** Session 250.100 - Origin whitelist (vocalia.ma + localhost dev) |
| ~~`free_price: "0"` in locales~~ | ~~**HIGH**~~ | **FIXED** Session 250.100 - Changed to `"49"` in all 5 locales |
| Tests overcounted | **HIGH** | 338 real tests, not 681 (was 306+375, actual 281+57) |
| Function tool names wrong in docs | **HIGH** | 12/25 names in docs don't match actual code |
| ~~innerHTML XSS risk~~ | ~~**MEDIUM**~~ | **REDUCED** 15→5 (sessions 250.99+250.100: textContent, escapeHTML) |
| 557 tenants not in registry | **MEDIUM** | 580 folders but only 23 in client_registry.json |
| lib/ not documented | **LOW** | security-utils.cjs (921 lines) missing from architecture docs |
| ~~Social proof FAKE data~~ | ~~**HIGH**~~ | **FIXED** Session 250.99 - Real backend data, fake names removed |
| ~~B2B booking/social proof missing~~ | ~~**HIGH**~~ | **FIXED** Session 250.99 - Fully implemented |
| ~~No dashboard widget toggles~~ | ~~**MEDIUM**~~ | **FIXED** Session 250.99 - 3 toggles in settings.html |

*Full session history: `docs/SESSION-HISTORY.md`*
*Last update: 06/02/2026 - Session 250.100 Security Hardening*
