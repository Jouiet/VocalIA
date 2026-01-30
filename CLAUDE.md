# VocalIA - Voice AI Platform

> Version: 4.9.0 | 30/01/2026 | Session 241 | Health: 100%
> i18n: 5 Languages (FR, EN, ES, AR, ARY) | 31 pages | 1444 keys | RTL ✅ | QA Scripts ✅
> SDKs: Python | Node.js | MCP Server v0.3.2 (21 tools)

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
├── core/           # Voice engine (14 fichiers)
├── widget/         # Browser widget
├── telephony/      # PSTN bridge
├── personas/       # 30 personas
├── integrations/   # CRM/E-commerce
├── website/        # 31 pages HTML
│   └── src/locales/  # 5 langues (fr,en,es,ar,ary)
├── sdks/           # Python + Node.js
├── mcp-server/     # MCP Server (21 tools)
└── docs/           # Documentation
```

---

## Services (Ports)

| Service | Port | Commande |
|:--------|:----:|:---------|
| Voice API | 3004 | `node core/voice-api-resilient.cjs` |
| Grok Realtime | 3007 | `node core/grok-voice-realtime.cjs` |
| Telephony | 3009 | `node telephony/voice-telephony-bridge.cjs` |
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
| `docs/VOCALIA-MCP.md` | MCP Server (21 tools) |
| `docs/I18N-AUDIT-ACTIONPLAN.md` | Plan i18n |

---

## MCP Server (21 Tools)

**Local Tools (10):**
- voice_generate_response, voice_synthesize, voice_transcribe
- telephony_initiate_call, telephony_get_call, telephony_transfer_call
- personas_list, knowledge_base_search
- qualify_lead, schedule_callback

**External Integrations (11):**
- HubSpot: create_contact, get_contact, create_deal, update_deal
- Klaviyo: track_event, add_to_list, get_profile
- Shopify: get_order, update_order, get_inventory, search_products

---

## Current Session Focus

**Session 241: SOTA Optimization Audit Complete**
- ✅ QA Scripts: translation-quality-check.py, darija-validator.py
- ✅ Bug fix: darija-validator.py regex word boundaries (false positives)
- ✅ SOTA audit: RAG, MCP, Voice, ContextBox, Sensors
- ✅ System verification: 19 Python + 18 CJS + 21 MCP tools = 100%

**SOTA Alignment: 85%**
| System | Status | Gap |
|:-------|:------:|:----|
| Voice AI | ✅ SOTA | Native Grok, <1s TTFA |
| ContextBox | ✅ SOTA | Token mgmt, EventBus |
| MCP | ✅ Good | 21 tools, bounded |
| RAG | ⚠️ Near | BM25 + reranking needed |

**QA Scripts:**
- `translation-quality-check.py` - Detects <60% length ratio, identical, empty
- `darija-validator.py` - Detects MSA formal markers with regex word boundaries

---

## Plan Actionnable (Session 242)

| # | Action | Priorité | Impact | Notes |
|:-:|:-------|:--------:|:------:|:------|
| 1 | SDK publish | **P0** | Distribution | User creds required |
| 2 | API Backend deploy | **P1** | MCP/SDKs work | api.vocalia.ma |
| 3 | Replace TF-IDF with BM25 | P2 | +15% recall | 2h effort |
| 4 | Add Cohere re-ranking | P2 | +67% precision | 4h effort |
| 5 | MCP Prometheus metrics | P3 | Observability | Production feature |

---

*Voir `docs/SESSION-HISTORY.md` pour l'historique complet*
*Màj: 30/01/2026 - Session 241 (SOTA Audit: 85% aligned, Voice/ContextBox SOTA)*
