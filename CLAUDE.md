# VocalIA - Voice AI Platform

> Version: 6.10.0 | 30/01/2026 | Session 249.13 | Health: 100%
> i18n: 5 Languages (FR, EN, ES, AR, ARY) | 31 pages | **1530 keys** | RTL ✅ | **100% COMPLETE**
> SDKs: Python | Node.js | MCP Server v0.5.6 (**143 tools**) | RAG: BM25 SOTA
> iPaaS: Zapier (+7000 apps) | Make | n8n | Export: CSV, XLSX, PDF | Email: SMTP + Gmail API
> Integrations: **24 native** (~64% e-commerce) | WordPress Plugin ✅ | Cross-browser ✅ | WCAG Touch ✅
> E-commerce: WooCommerce, Shopify, Magento, Wix, Squarespace, BigCommerce, PrestaShop

## Identité

- **Type**: Voice AI SaaS Platform
- **Domain**: www.vocalIA.ma
- **Location**: `~/Desktop/VocalIA/`

---

## Scores

| Score | Value | Notes |
|:------|:-----:|:------|
| Backend | **99/100** | Twilio creds manquants |
| Frontend | **~97%** | Light Mode ✅ |
| Health | **100%** | 39/39 checks |

---

## 2 Produits

| Produit | Technologie | Coût |
|:--------|:------------|:-----|
| Voice Widget | Web Speech API | $0 |
| Voice Telephony | Twilio PSTN ↔ Grok | ~$0.06/min |

---

## Architecture

```
VocalIA/
├── core/           # Voice engine (17 fichiers) + Multi-Tenant
│   ├── SecretVault.cjs       # Per-tenant credentials (AES-256-GCM)
│   ├── OAuthGateway.cjs      # OAuth 2.0 flows (port 3010)
│   └── WebhookRouter.cjs     # Inbound webhooks (port 3011)
├── clients/        # Per-tenant configurations
│   ├── agency_internal/      # VocalIA internal
│   └── client_demo/          # Demo tenant
├── widget/         # Browser widget
├── telephony/      # PSTN bridge
├── personas/       # 30 personas
├── integrations/   # CRM/E-commerce (multi-tenant)
├── website/        # 31 pages HTML
│   └── src/locales/  # 5 langues (fr,en,es,ar,ary)
├── sdks/           # Python + Node.js
├── mcp-server/     # MCP Server (143 tools)
└── docs/           # Documentation
```

---

## Services (Ports)

| Service | Port | Commande |
|:--------|:----:|:---------|
| Voice API | 3004 | `node core/voice-api-resilient.cjs` |
| Grok Realtime | 3007 | `node core/grok-voice-realtime.cjs` |
| Telephony | 3009 | `node telephony/voice-telephony-bridge.cjs` |
| OAuth Gateway | 3010 | `node core/OAuthGateway.cjs --start` |
| Webhook Router | 3011 | `node core/WebhookRouter.cjs --start` |
| Website | 8080 | `npx serve website` |

---

## Credentials

| Credential | Service | Status |
|:-----------|:--------|:------:|
| XAI_API_KEY | Grok | À vérifier |
| GOOGLE_GENERATIVE_AI_API_KEY | Gemini | À vérifier |
| TWILIO_* | Telephony | ❌ Manquant |

---

## i18n Configuration

| Langue | Code | RTL | Status |
|:-------|:----:|:---:|:------:|
| Français | fr | Non | ✅ |
| English | en | Non | ✅ |
| Español | es | Non | ✅ |
| العربية | ar | Oui | ✅ |
| Darija | ary | Oui | ✅ |

**Geo-detection:**
- MA (Maroc) → FR + MAD
- EU (Europe) → FR + EUR
- Other → EN + USD

---

## Commandes Essentielles

```bash
# Health check
node scripts/health-check.cjs

# Build CSS
cd website && npm run build:css

# Translation QA
python3 scripts/translation-quality-check.py --verbose
python3 scripts/darija-validator.py

# Sync locales (FR → others)
python3 scripts/sync-locales.py sync

# Deploy (auto via GitHub Actions)
git push origin main

# Test i18n
open http://localhost:8080?lang=ar
```

---

## Standards Code

- CommonJS (.cjs), 2 espaces, single quotes
- Credentials: `process.env.*`
- Erreurs: `console.error('❌ ...')`
- Succès: `console.log('✅ ...')`

---

## Différenciateurs

| Feature | Vapi | Retell | VocalIA |
|:--------|:----:|:------:|:-------:|
| Pricing | $0.15-0.33/min | $0.13-0.31/min | **$0.06/min** |
| Widget + Telephony | ❌ | ❌ | ✅ |
| 30 Personas | ❌ | ❌ | ✅ |
| Darija Support | ❌ | ❌ | ✅ |
| 5 Languages | ❌ | ❌ | ✅ |

---

## Documentation

| Document | Description |
|:---------|:------------|
| `docs/SESSION-HISTORY.md` | Historique complet sessions |
| `docs/VOICE-AI-PLATFORM-REFERENCE.md` | Reference technique |
| `docs/VOCALIA-MCP.md` | MCP Server (114 tools) |
| `docs/INTEGRATIONS-ROADMAP.md` | Phase 0 ✅ + Phase 1 ✅ COMPLETE |
| `docs/PLUG-AND-PLAY-STRATEGY.md` | Multi-tenant architecture |
| `docs/I18N-AUDIT-ACTIONPLAN.md` | Plan i18n (100% COMPLETE) |

---

## MCP Server v0.5.0 (59 Tools)

**Local Tools (10):**
- personas_list, personas_get, personas_get_system_prompt
- qualify_lead, lead_score_explain
- knowledge_base_status, system_languages, api_status
- booking_schedule_callback, booking_create

**Google Tools (13) - Multi-Tenant:**
- Calendar: check_availability, create_event
- Sheets: read_range, write_range, append_rows, get_info, create
- Drive: list_files, get_file, create_folder, upload_file, share_file, delete_file

**Scheduling Tools (6) - Multi-Tenant:**
- Calendly: get_user, list_event_types, get_available_times, list_events, cancel_event, get_busy_times

**Support Tools (6) - Multi-Tenant:**
- Freshdesk: list_tickets, get_ticket, create_ticket, reply_ticket, update_ticket, search_contacts

**CRM Tools (7) - Multi-Tenant:**
- Pipedrive: list_deals, create_deal, update_deal, list_persons, create_person, search, list_activities

**External Integrations (9):**
- HubSpot: crm_get_customer, crm_create_contact
- Shopify: ecommerce_order_status, ecommerce_product_stock
- Klaviyo: ecommerce_customer_profile
- Slack: slack_send_notification
- UCP: ucp_sync_preference, ucp_get_profile, ucp_list_profiles

---

## Current Session Focus

**Session 249.11: STRATEGIC E-COMMERCE EXPANSION**

### Session 249.11: +27 Tools (4 Platforms)

| Action | Détail | Status |
|:-------|:-------|:------:|
| **Wix Stores** | 6 tools (7.4% market, +32.6% YoY) | ✅ |
| **Squarespace** | 7 tools (2.6% market, 16% USA) | ✅ |
| **BigCommerce** | 7 tools (1% market, mid-market) | ✅ |
| **PrestaShop** | 7 tools (1.91% market, 37% France) | ✅ |
| **Translation QA** | Per-language ratios, 0 issues | ✅ |
| **UCP Persistence** | File-based storage enabled | ✅ |

### Intégrations Factuelles (26)

| Catégorie | Intégrations |
|:----------|:-------------|
| **CRM** | HubSpot, Pipedrive, Zoho CRM |
| **Support** | Zendesk, Freshdesk |
| **E-commerce** | Shopify, WooCommerce, Magento, Klaviyo, **Wix, Squarespace, BigCommerce, PrestaShop** |
| **Google** | Calendar, Sheets, Drive, Docs, Gmail |
| **Calendrier** | Calendly |
| **iPaaS** | Zapier, Make, n8n |
| **Export** | CSV, XLSX, PDF, SMTP |
| **Notification** | Slack |

### E-commerce Market Coverage

```
Platform        Tools   Market Share
─────────────────────────────────────
WooCommerce      7      33-39% global
Shopify          2      10.32% global
Magento          6      8% global
Wix Stores       6      7.4% global ← NEW
Squarespace      7      2.6% global ← NEW
PrestaShop       7      1.91% global ← NEW
BigCommerce      7      1% global ← NEW
─────────────────────────────────────
TOTAL           43      ~64% coverage
```

### Vérification Empirique

```bash
# MCP tools count
grep -c "server.tool(" mcp-server/src/index.ts  # 143 ✅

# New e-commerce files
ls mcp-server/src/tools/{wix,squarespace,bigcommerce,prestashop}.ts  # 4 files ✅

# Translation QA
python3 scripts/translation-quality-check.py  # 0 issues ✅

# UCP persistence
ls data/ucp-profiles.json  # exists ✅
```

---

## Plan Actionnable (Session 250)

| # | Task | Priority | Blocker |
|:-:|:-----|:--------:|:--------|
| 1 | SDK Publish (npm/PyPI) | P1 | User credentials required |
| 2 | API Backend deploy (api.vocalia.ma) | P1 | Hosting setup |
| 3 | WordPress Plugin → WordPress.org | P2 | Review process |
| 4 | Frontend: Add 4 new e-commerce cards | P2 | Design review |

---

*Voir `docs/SESSION-HISTORY.md` pour l'historique complet*
*Voir `docs/INTEGRATIONS-ROADMAP.md` pour planning détaillé*
*Voir `docs/VOCALIA-MCP.md` pour documentation MCP (143 tools)*
*Màj: 30/01/2026 - Session 249.12 (Homepage Cleanup + Doc Sync)*
