# VocalIA - Voice AI Platform

> Version: 5.2.0 | 30/01/2026 | Session 244 (P0/P1 Complete) | Health: 100%
> i18n: 5 Languages (FR, EN, ES, AR, ARY) | 32 pages | 1530 keys | RTL ✅ | **Hreflang: ✅ 100%**
> SDKs: Python | Node.js | MCP Server v0.3.3 (21 tools) | RAG: BM25 SOTA
> SEO: ~90% ✅ | AEO: ~75% ✅ | Investor Page: ✅ | **GAPS**: A2A ❌ | UCP ❌ | Social Proof ❌

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

**Session 244: P2 Implementation + Documentation Update**

### Completed Tasks (Sessions 243-244)

| # | Task | Status | Commit |
|:-:|:-----|:------:|:------:|
| 1 | ✅ Remove exposed Google Apps Script URL | Done | 0a15878 |
| 2 | ✅ Add hreflang to 29 pages | Done | 0a15878 |
| 3 | ✅ Add Twitter Cards to 28 pages | Done | 0a15878 |
| 4 | ✅ Add AI bot rules to robots.txt | Done | 0a15878 |
| 5 | ✅ Add FAQPage schema (pricing.html) | Done | 0a15878 |
| 6 | ✅ Add Speakable schema (index.html) | Done | 0a15878 |
| 7 | ✅ Add HSTS header (.htaccess) | Done | 0a15878 |
| 8 | ✅ Add orphan pages to sitemap | Done | 0a15878 |
| 9 | ✅ Create investor.html | Done | Session 244 |

### Updated Scores

| Domain | Before | After | Status |
|:-------|:------:|:-----:|:------:|
| SEO | 70% | ~90% | ✅ Fixed |
| AEO | 25% | ~75% | ✅ Fixed |
| Security | CRITICAL | ✅ | Fixed |
| Investor Page | ❌ | ✅ | Created |

### Remaining Gaps

| Gap | Priority | Status |
|:----|:--------:|:------:|
| A2A Protocol | P2 | ❌ Not started |
| UCP Implementation | P2 | ❌ Not started |
| Social Proof/Testimonials | P2 | ❌ Not started |
| SDK Publish | P1 | Needs user creds |
| API Backend Deploy | P1 | Needs VPS config |

---

*Voir `docs/SESSION-HISTORY.md` pour l'historique complet*
*Voir `docs/FORENSIC-AUDIT-WEBSITE.md` pour détails audit*
*Màj: 30/01/2026 - Session 244 (P0/P1 Complete, Investor Page Created)*
