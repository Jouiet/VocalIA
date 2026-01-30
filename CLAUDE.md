# VocalIA - Voice AI Platform

> Version: 5.1.0 | 30/01/2026 | Session 242 (DOE Forensic) | Health: 100%
> i18n: 5 Languages (FR, EN, ES, AR, ARY) | 31 pages | 1471 keys | RTL ✅ | **Hreflang: ❌ 0%**
> SDKs: Python | Node.js | MCP Server v0.3.3 (21 tools) | RAG: BM25 SOTA
> **CRITICAL GAPS**: A2A ❌ | UCP ❌ | AEO 25% | Investor Page ❌ | Social Proof ❌

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

**Session 242: DOE Comprehensive Forensic Audit**

### Audit Scores (VERIFIED 30/01/2026)

| Domain | Score | Grade | Critical Issues |
|:-------|:-----:|:-----:|:----------------|
| Backend | 99/100 | A+ | Twilio creds only |
| Frontend Design | ~97% | A | Light mode ✅ |
| **SEO** | **70/100** | **C+** | Hreflang 0%, Twitter 13% |
| **AEO** | **25/100** | **F** | No AI bot rules, No FAQ schema |
| **A2A** | **0%** | **F** | ❌ NOT IMPLEMENTED |
| **UCP** | **0%** | **F** | ❌ NOT IMPLEMENTED (MCP only) |
| WCAG | 90/100 | A- | Heading hierarchy |
| Branding | 99% | A+ | Enterprise-grade |
| Marketing | B+ | B+ | No social proof |

### Critical Gaps Identified

| Gap | Impact | Fix Priority |
|:----|:-------|:------------:|
| **Exposed Google Apps Script URL** | Security breach | P0 |
| **Hreflang tags 0%** | SEO i18n invisible | P0 |
| **A2A Protocol missing** | No agent interop | P1 |
| **UCP not implemented** | No agentic commerce | P1 |
| **AEO 25%** | Invisible to GPT/Claude | P1 |
| **No investor page** | Can't fundraise | P2 |
| **No social proof** | Low conversion | P2 |

---

## Plan Actionnable (Session 243)

### P0 - CRITICAL (Immediate)

| # | Action | Impact | Effort |
|:-:|:-------|:------:|:------:|
| 1 | Remove exposed Google Apps Script URL | Security | 1h |
| 2 | Add hreflang to 31 pages (5 languages) | SEO | 4h |
| 3 | Add Twitter Card meta to 29 pages | Social | 2h |

### P1 - HIGH (This Week)

| # | Action | Impact | Effort |
|:-:|:-------|:------:|:------:|
| 4 | Add AI bot rules to robots.txt | AEO | 30min |
| 5 | Add FAQPage schema | AEO snippets | 2h |
| 6 | Add Speakable schema (Voice AI fit!) | AEO | 1h |
| 7 | **Implement A2A AgentCard** | Agent interop | 8h |
| 8 | **Expose UCP product feeds** | Agentic commerce | 16h |
| 9 | Add HSTS header | Security | 30min |

### P2 - MEDIUM (Next Sprint)

| # | Action | Impact | Effort |
|:-:|:-------|:------:|:------:|
| 10 | Create investor.html | Fundraising | 8h |
| 11 | Add testimonials section | Conversion | 4h |
| 12 | SDK publish (twine/npm) | Distribution | User creds |
| 13 | API Backend deploy | MCP/SDKs | VPS config |

---

*Voir `docs/SESSION-HISTORY.md` pour l'historique complet*
*Voir `docs/FORENSIC-AUDIT-WEBSITE.md` pour détails Session 242*
*Màj: 30/01/2026 - Session 242 (DOE Forensic - A2A/UCP gaps identified)*
