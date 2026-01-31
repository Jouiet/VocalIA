# VocalIA - Voice AI Platform

> Version: 6.18.0 | 31/01/2026 | Session 249.23 | Health: 100%
> i18n: 5 Languages (FR, EN, ES, AR, ARY) | 36 pages | **1530 keys** | RTL ✅ | **100% COMPLETE**
> **Platform: 254 MCP Tools | 4 Sensors | 3 Agents | 31 Personas | 4 Frameworks | 12 Func. Tools | 23 Core Modules**
> SDKs: Python | Node.js | MCP Server v0.7.0 | RAG: BM25 SOTA | Multi-Tenant ✅
> iPaaS: Zapier (+7000 apps) | Make | n8n | Export: CSV, XLSX, PDF | Email: SMTP + Gmail API
> Integrations: **28 native** | WordPress Plugin ✅ | WhatsApp ✅ | 12 Function Tools ✅
> E-commerce: 7 platforms CRUD (Shopify, WooCommerce, Magento, PrestaShop, BigCommerce, Wix, Squarespace)
> **Payments: Stripe (29 tools)** - Payment Links, Checkout, Invoices, Refunds
> Telephony: TwiML Voice ✅ | Twilio SDK ✅ | **SMS Fallback ✅** | MCP 4 tools
> **Website: /docs/ Académie Business ✅** - Full Platform Inventory, Use Cases, Workflows, ROI

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
├── core/           # 23 modules (voice engine + multi-tenant)
│   ├── SecretVault.cjs       # Per-tenant credentials (AES-256-GCM)
│   ├── OAuthGateway.cjs      # OAuth 2.0 flows (port 3010)
│   ├── WebhookRouter.cjs     # Inbound webhooks (port 3011)
│   ├── BillingAgent.cjs      # Autonomous billing agent
│   ├── TenantOnboardingAgent.cjs  # Client setup agent
│   └── voice-agent-b2b.cjs   # B2B qualification agent
├── sensors/        # 4 real-time sensors
│   ├── cost-tracking-sensor.cjs
│   ├── lead-velocity-sensor.cjs
│   ├── retention-sensor.cjs
│   └── voice-quality-sensor.cjs
├── clients/        # Per-tenant configurations
│   ├── agency_internal/      # VocalIA internal
│   └── client_demo/          # Demo tenant
├── widget/         # Browser widget (2 files)
├── telephony/      # PSTN bridge (12 function tools)
├── personas/       # 31 personas
├── integrations/   # CRM/E-commerce (multi-tenant)
├── website/        # 36 pages HTML
│   └── src/locales/  # 5 langues (fr,en,es,ar,ary)
├── sdks/           # Python + Node.js
├── mcp-server/     # MCP Server (254 tools / 25 categories)
├── scripts/        # 30 utility scripts
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

## Session 249.16 - Corrections Critiques (31/01/2026)

### Bugs Fixés

| Bug | Fix | Vérification |
|:----|:----|:-------------|
| 4 function tools orphelins | Ajout 4 case statements (lignes 1119-1134) | 11/11 tools OK |
| "143 tools" fantômes | Corrigé → 144 tools réels | grep "144 tools" ✅ |
| Cal.com/Intercom/Crisp fake | Supprimé des commentaires index.ts | Build OK |

### Vérités Rétablies

| Claim Faux | Vérité |
|:-----------|:-------|
| HubSpot = webhook-only | Full CRUD via hubspot-b2b-crm.cjs |
| WhatsApp = pas implémenté | ✅ Implémenté (needs credentials) |
| Shopify = Production | READ-ONLY (pas de cancel/refund) |
| sendGenericSMS = SMS | ❌ C'était WhatsApp! Renommé sendWhatsAppMessage |
| MCP "5 telephony tools" | ✅ Corrigé → 3 tools |
| TwiML = pas implémenté | ✅ COMPLET (5 fonctions voice) |

---

## Plan Actionnable (Session 250)

| # | Task | Priority | Effort | Fichier | Status |
|:-:|:-----|:--------:|:------:|:--------|:------:|
| 1 | Shopify MCP tools WRITE | P0 | 5j | mcp-server/src/tools/shopify.ts | ❌ |
| 2 | ~~Twilio SMS fallback~~ | ~~P0~~ | ~~2-3j~~ | ~~telephony/voice-telephony-bridge.cjs~~ | ✅ DONE |
| 3 | ~~Page Use Cases website~~ | ~~P1~~ | ~~2j~~ | ~~website/use-cases/index.html~~ | ✅ DONE |
| 4 | Stripe Payment Links | P1 | 3j | core/stripe-payments.cjs | ❌ |

---

## Session 249.19 - Use Cases Index Page CRÉÉE

**Nouvelle page**: `website/use-cases/index.html`
- 4 use cases: Lead Qualification, E-commerce, Appointments, Customer Support
- Workflow diagram (4 steps)
- Integration stack (6 categories)
- CTA section

**Traductions i18n** (5 langues):
- FR, EN, ES, AR, ARY - `usecases_index_page.*` keys

**Website pages**: 32 (was 31)

---

## Session 249.18 - Twilio SMS Fallback IMPLÉMENTÉ

**Nouvelles fonctions** (voice-telephony-bridge.cjs):
- `sendTwilioSMS()` - Twilio REST API + SDK ($0.0083/msg US)
- `sendMessage()` - Unified avec fallback: WhatsApp → Twilio SMS
- `/messaging/send` - HTTP endpoint pour MCP

**MCP Tool ajouté**:
- `messaging_send` - Channel auto/whatsapp/sms

**Fonctions mises à jour**:
- `sendSMSBookingLink()` → utilise sendMessage()
- `handleSendPaymentDetails()` → utilise sendMessage()
- `sendRecoverySMS()` → utilise sendMessage()

**Vérification**:
```bash
node -e "require('./telephony/voice-telephony-bridge.cjs')"  # ✅ Module loads
cd mcp-server && npm run build  # ✅ Build OK
```

---

## Session 249.17 - Audit Twilio/TwiML

**TwiML Voice - COMPLET** (5 fonctions):
- `getTwiMLLanguage()`, `getTwiMLMessage()`
- `generateTwiML()`, `generateErrorTwiML()`, `generateOutboundTwiML()`

**Twilio SDK installé**: `"twilio": "^4.19.0"` (package.json)

---

*Voir `docs/SESSION-HISTORY.md` pour l'historique complet*
*Voir `docs/USE-CASES-STRATEGIC-ANALYSIS.md` pour SWOT et stratégie*
*Voir `docs/VOCALIA-MCP.md` pour documentation MCP (144 tools)*
*Màj: 31/01/2026 - Session 249.18 (Twilio SMS Fallback IMPLÉMENTÉ)*
