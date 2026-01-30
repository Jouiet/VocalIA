# VocalIA - Voice AI Platform

> Version: 6.1.0 | 30/01/2026 | Session 249.6 | Health: 100%
> i18n: 5 Languages (FR, EN, ES, AR, ARY) | 31 pages | **1530 keys** | 2016 data-i18n | RTL ✅ | **100% COMPLETE**
> SDKs: Python | Node.js | MCP Server v0.5.3 (**114 tools**) | RAG: BM25 SOTA
> Export: CSV, XLSX, PDF | Email: SMTP (4 templates) | Output: data/exports/
> Integrations: **19/20 (95%)** | ✅ All Phases COMPLETE | 4 blocked (Salesforce, Teams, WhatsApp, Outlook)
> SEO: ~90% ✅ | AEO: ~75% ✅ | UCP ✅ | QA ✅ | SecretVault ✅ | OAuth Gateway ✅ | clients/ ✅

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
├── mcp-server/     # MCP Server (114 tools)
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

**Session 249.3: Phase 1 Integrations COMPLETE**

### Phase 0 - Multi-Tenant Architecture ✅ COMPLETE

| Composant | Fichier | Status |
|:----------|:--------|:------:|
| SecretVault | `core/SecretVault.cjs` (347 lignes) | ✅ |
| OAuth Gateway | `core/OAuthGateway.cjs` (401 lignes) | ✅ |
| WebhookRouter | `core/WebhookRouter.cjs` (394 lignes) | ✅ |
| clients/ | 2 tenants | ✅ |
| HubSpot refactor | TenantContext | ✅ |
| MCP tools refactor | _meta.tenantId | ✅ |

### Phase 1 - Quick Wins ✅ COMPLETE (100%)

| Integration | Tools | Status |
|:------------|:-----:|:------:|
| Google Sheets | 5 | ✅ DONE |
| Google Drive | 6 | ✅ DONE |
| Calendly | 6 | ✅ DONE |
| Freshdesk | 6 | ✅ DONE |
| Pipedrive | 7 | ✅ DONE |

### Vérification Empirique

```bash
# Multi-tenant components
ls core/SecretVault.cjs core/OAuthGateway.cjs core/WebhookRouter.cjs  # ✅ EXISTS
ls clients/  # agency_internal, client_demo, _template

# MCP build
cd mcp-server && npm run build  # ✅ SUCCESS (32 tools)
```

---

## Plan Actionnable (Session 250)

| # | Task | Priority | Effort |
|:-:|:-----|:--------:|:------:|
| 1 | Calendly integration | P1 | 2-3j |
| 2 | Freshdesk integration | P1 | 2-3j |
| 3 | Pipedrive integration | P1 | 3-5j |
| 4 | SDK Publish (npm/PyPI) | P1 | User creds |
| 5 | Gmail integration | P2 | 2-4j |

---

*Voir `docs/SESSION-HISTORY.md` pour l'historique complet*
*Voir `docs/INTEGRATIONS-ROADMAP.md` pour planning détaillé*
*Voir `docs/VOCALIA-MCP.md` pour documentation MCP (32 tools)*
*Màj: 30/01/2026 - Session 249.2 (Phase 0 COMPLETE, Phase 1 40%)*
