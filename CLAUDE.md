# VocalIA - Voice AI Platform

> Version: 5.2.2 | 30/01/2026 | Session 245 | Health: 100%
> i18n: 5 Languages (FR, EN, ES, AR, ARY) | 32 pages | 1471 keys | 2016 data-i18n | RTL ✅ | **100% COMPLETE**
> SDKs: Python | Node.js | MCP Server v0.3.3 (21 tools) | RAG: BM25 SOTA
> SEO: ~90% ✅ | AEO: ~75% ✅ | Investor Page: ✅ | **GAPS**: A2A ❌ | Social Proof ❌

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
├── website/        # 32 pages HTML
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

**Session 245: I18N Audit Tables Update**

### Completed Tasks (Sessions 243-245)

| # | Task | Status | Commit |
|:-:|:-----|:------:|:------:|
| 1 | ✅ SEO/AEO fixes (hreflang, Twitter Cards, schema) | Done | 0a15878 |
| 2 | ✅ Create investor.html | Done | 707fce6 |
| 3 | ✅ Remove vercel.json (NO VERCEL!) | Done | fc4d690 |
| 4 | ✅ Add HSTS to .htaccess | Done | fc4d690 |
| 5 | ✅ RLHF analysis (NOT applicable) | Done | Session 244.3 |
| 6 | ✅ Update I18N audit tables (32/32 pages) | Done | e5936f4 |
| 7 | ✅ Add geo-detect.js to investor.html | Done | e5936f4 |

### i18n Status - 100% COMPLETE

| Metric | Value | Verified |
|:-------|:-----:|:--------:|
| Pages with i18n.js | 32/32 | ✅ grep |
| Pages with geo-detect.js | 32/32 | ✅ grep |
| Total data-i18n attributes | 2016 | ✅ grep |
| Translation keys | 1471 × 5 = 7355 | ✅ |

### Remaining Gaps

| Gap | Priority | Blocker |
|:----|:--------:|:--------|
| Social Proof/Testimonials | P2 | Needs REAL customer data |
| Persona Performance Dashboard | P2 | - |
| SDK Publish | P1 | Needs user creds (npm/PyPI) |
| API Backend Deploy | P1 | Needs VPS config |
| Blog article i18n | P3 | Articles remain FR (by design) |

### RLHF Analysis (Session 244.3)

**Verdict:** RLHF n'est PAS applicable (API consumer, pas model owner)

**Ce que VocalIA DOIT faire (Prompt Optimization):**
1. Tracker outcomes par persona (qualify_lead, track_conversion_event)
2. Comparer performances personas par industrie
3. Itérer prompts basé sur données réelles
4. Versionner personas (déjà: `_v2` dans IDs)

**Voir:** `docs/VOCALIA-MCP.md` section "Prompt Optimization with Feedback"

---

## Plan Actionnable (Next Sprint)

| # | Task | Priority | Blocker | Effort |
|:-:|:-----|:--------:|:--------|:------:|
| 1 | SDK Publish | P1 | User creds (npm/PyPI) | 2h |
| 2 | API Backend deploy | P1 | VPS config | 4h |
| 3 | Social Proof/Testimonials | P2 | Content needed | 4h |
| 4 | Persona Performance Dashboard | P2 | - | 8h |

---

*Voir `docs/SESSION-HISTORY.md` pour l'historique complet*
*Voir `docs/FORENSIC-AUDIT-WEBSITE.md` pour détails audit*
*Voir `docs/VOCALIA-MCP.md` pour Prompt Optimization*
*Màj: 30/01/2026 - Session 245 (I18N audit 100% complete: 32/32 pages, 2016 data-i18n)*
