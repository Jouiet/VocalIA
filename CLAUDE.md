# VocalIA - Voice AI Platform

> Version: 5.3.0 | 30/01/2026 | Session 248 | Health: 100%
> i18n: 5 Languages (FR, EN, ES, AR, ARY) | 32 pages | **1530 keys** | 2016 data-i18n | RTL ✅ | **100% COMPLETE**
> SDKs: Python | Node.js | MCP Server v0.3.3 (26 tools) | RAG: BM25 SOTA
> SEO: ~90% ✅ | AEO: ~75% ✅ | **GAPS**: UCP ⚠️ (no persist) | QA Script ⚠️ (481 FP) | Social Proof ❌

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

**Session 248: Audit Forensique Approfondi**

### Métriques Corrigées (Vérification Empirique)

| Metric | Documenté | Réel | Vérification |
|:-------|:---------:|:----:|:-------------|
| Locale keys | 1,471 | **1,530** | `jq paths | length` |
| data-i18n | ~2,000 | **2,016** | `grep -roh` |
| MCP Tools | 21 | **26** | index.ts |
| Core modules | 9,221 lignes | ✅ | `wc -l core/*.cjs` |

### DÉFAUTS CRITIQUES (Session 248)

| Défaut | Fichier | Impact | Fix |
|:-------|:--------|:-------|:----|
| `ucp_get_profile` NO PERSIST | ucp.ts:76 | UCP cassé | Implémenter storage |
| QA Script 481 faux positifs | translation-quality-check.py | QA inutilisable | Seuil 60%→40% |
| Google API Key invalid | .env | Embeddings cassés | User action |

### Composants VALIDÉS (Fonctionnels)

| Composant | Status | Test |
|:----------|:------:|:-----|
| BM25 RAG | ✅ | `--search "voice AI"` |
| Translation Supervisor | ✅ | EventBus + patterns |
| Global Localization | ✅ | 4 régions strictes |
| Darija Validator | ✅ | Score 94 |
| MCP TypeScript | ✅ | `npm run build` |

### Sessions 228-247 Summary

- **+1,655 lignes** code nouveau (22 fichiers)
- **+2,000 lignes** HTML modifié (SEO/i18n)
- **195 hreflang** + **39 Twitter Cards**
- **BM25 SOTA** implémenté (k1=1.5, b=0.75)

---

## Plan Actionnable (Session 249)

| # | Task | Priority | Blocker | Effort |
|:-:|:-----|:--------:|:--------|:------:|
| 1 | **Fix `ucp_get_profile` persistence** | P0 | - | 2h |
| 2 | **Fix QA script seuil (60%→40%)** | P1 | - | 30min |
| 3 | Renouveler Google API Key | P1 | User | 10min |
| 4 | Configurer Calendar/Slack creds | P2 | User | 30min |
| 5 | SDK Publish (npm/PyPI) | P1 | User creds | 2h |
| 6 | Social Proof content | P2 | User data | - |

---

*Voir `docs/SESSION-HISTORY.md` pour l'historique complet*
*Voir `docs/FORENSIC-AUDIT-WEBSITE.md` pour détails audit*
*Voir `docs/VOCALIA-MCP.md` pour UCP persistence gap*
*Màj: 30/01/2026 - Session 248 (Audit forensique: 1530 keys, UCP no persist, QA 481 FP)*
