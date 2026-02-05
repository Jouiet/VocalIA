# VocalIA - Voice AI Platform

> **v7.3.0** | 05/02/2026 | Health: 100% | Production: https://vocalia.ma
> **77 pages** | 23,795 i18n lines | 5 langs (FR/EN/ES/AR/ARY) | RTL | 306 unit + 375 E2E tests (99.5%)
> **203 MCP Tools** | 40 Personas | **25 Function Tools** | 8 E-commerce Widgets | 31 Integrations | Stripe 19 | HubSpot 7 | Twilio 5
> **~140k lines total** | Core 32,727 + Telephony 4,709 + Personas 5,995 + Widget 9,107 + MCP 17,630 + Website 31,353
> ✅ **SESSION 250.96:** Forensic Audit Frontend 100% DONE - 17 console.log removed, signup CTA, mentions-legales.html, Score 95/100

## Quick Reference

| Item | Value |
|:-----|:------|
| Type | Voice AI SaaS Platform |
| Domain | www.vocalia.ma |
| Location | `~/Desktop/VocalIA/` |
| Scores | **Backend 100/100** (306/309 pass, 3 skip), **Frontend 100/100** (i18n 100%), Security 100/100 |

---

## Architecture

```
VocalIA/                              # ~140,000 lines (VÉRIFIÉ wc -l 05/02/2026)
├── core/           # 38 modules (32,727 lines)
│   ├── voice-api-resilient.cjs   # Multi-AI fallback (3,018 lines, port 3004)
│   ├── grok-voice-realtime.cjs   # WebSocket audio (1,109 lines, port 3007)
│   ├── db-api.cjs                # REST API + Auth (2,721 lines, port 3013)
│   ├── voice-crm-tools.cjs       # HubSpot + Pipedrive API (351 lines) ← SESSION 250.94
│   ├── voice-ecommerce-tools.cjs # Shopify + WooCommerce API (389 lines) ← SESSION 250.94
│   └── [+33 modules]
├── telephony/      # PSTN bridge (4,709 lines, 25 function tools)
├── personas/       # 40 personas SOTA (5,995 lines)
├── widget/         # 8 e-commerce widgets (9,107 lines)
├── website/        # 76 pages (public + webapp)
│   └── src/locales/   # 5 langs (23,790 lines)
├── mcp-server/     # 203 tools TypeScript (17,630 lines, v0.8.0)
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

## MCP Server (186 Tools - Verified)

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
| Zendesk + Freshdesk | 12 |
| Google Suite | 17 |
| UCP/CDP | 7 |
| iPaaS | 9 |
| Export | 5 |
| Other | ~49 |

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

## Documentation

| Doc | Content |
|:----|:--------|
| `docs/VOCALIA-SYSTEM-ARCHITECTURE.md` | Full architecture (988 lines) |
| `docs/SESSION-HISTORY.md` | **All session logs** |
| `docs/VOCALIA-MCP.md` | MCP 186 tools |
| `docs/PLUG-AND-PLAY-STRATEGY.md` | Multi-tenant |

---

## Products

| Product | Pricing |
|:--------|:--------|
| Voice Widget | 49€/month |
| Voice Telephony | 0.06€/min |

**Policy:** No Free Tier - 14-day trial only

> ⚠️ **Session 250.86 AUDIT**: i18n contamination (47 "free" claims), MCP gaps (5 modules missing)

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

*Full session history: `docs/SESSION-HISTORY.md`*
*Last update: 05/02/2026*
