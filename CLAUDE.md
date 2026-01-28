# VocalIA - Voice AI Platform
> Version: 1.5.0 | 28/01/2026 | Session 188 | Engineering Score: 97/100 | Health: 100%

## Identité

- **Type**: Voice AI SaaS Platform
- **Domain**: www.vocalIA.ma
- **Parent**: 3A Automation (3a-automation.com)
- **Location**: `~/Desktop/VocalIA/`

---

## Engineering Score (28/01/2026 - Session 188)

| Discipline | Max | Current | Note |
|:-----------|:---:|:-------:|:-----|
| **Voice Widget** | 15 | **15** | Web Speech API, $0, complet |
| **Voice Telephony** | 15 | **14** | Code OK, 5 langues, TWILIO creds manquants |
| **Multi-Persona** | 15 | **15** | 28 personas, 5 langues, marketing science |
| **Integrations** | 15 | **12** | HubSpot+Klaviyo+Shopify (creds manquants) |
| **Documentation** | 10 | **10** | 5 rules, CLAUDE.md, 10 docs ✅ |
| **Infrastructure** | 15 | **15** | MCP ✅, Sensors ✅, Registry ✅, GPM ✅, 3A-Shelf ✅ |
| **Testing** | 15 | **15** | 32/32 checks ✅, health-check.cjs ✅ |
| **TOTAL** | **100** | **97** | Health Score: 100% (32/32 passed) |

---

## 2 Produits

| Produit | Technologie | Coût | Status |
|:--------|:------------|:-----|:------:|
| **Voice Widget** | Web Speech API (Browser) | $0 | ✅ |
| **Voice Telephony AI** | Twilio PSTN ↔ Grok WebSocket | ~$0.06/min | ⚠️ Creds |

---

## Website (NEW - Session 188)

```
website/                              # 1,135 lignes
├── index.html                        # Landing page (561 L)
├── src/
│   ├── lib/
│   │   ├── geo-detect.js             # Geo detection + currency (188 L)
│   │   └── i18n.js                   # Internationalization (150 L)
│   └── locales/
│       ├── fr.json                   # French translations (118 L)
│       └── en.json                   # English translations (118 L)
└── public/assets/
```

**Features:**
- Design futuriste, sober, puissant
- Auto-detect location: MAD (Maroc), EUR (Europe), USD (Autres)
- FR + EN avec switch dynamique
- Tailwind CSS + animations modernes

---

## Architecture (VÉRIFIÉ 28/01/2026 - Session 188)

```
VocalIA/                              # 23,496 lignes (54 fichiers)
├── core/                             # 11,290 L (18 fichiers)
│   ├── voice-api-resilient.cjs       # Multi-AI fallback (1,508 L)
│   ├── grok-voice-realtime.cjs       # WebSocket audio (1,112 L)
│   ├── voice-agent-b2b.cjs           # B2B agent (719 L)
│   ├── grok-client.cjs               # API client (400 L)
│   ├── knowledge-base-services.cjs   # KB services (835 L)
│   └── ... (13 autres modules)
├── widget/                           # 1,812 L
├── telephony/                        # 2,658 L + KBs
│   ├── voice-telephony-bridge.cjs    # PSTN bridge, 5 langues
│   ├── knowledge_base.json           # KB FR (16 secteurs)
│   └── knowledge_base_ary.json       # KB Darija (15 secteurs) ✅ NEW
├── personas/                         # 648 L
├── integrations/                     # 1,458 L
├── sensors/                          # 4 sensors
├── knowledge-base/                   # 654 L
├── website/                          # 1,135 L ✅ NEW
├── docs/                             # 10 documents
├── .claude/rules/                    # 5 règles
└── .mcp.json
```

---

## Services (Ports)

| Service | Port | Commande | Status |
|:--------|:----:|:---------|:------:|
| Voice API | 3004 | `node core/voice-api-resilient.cjs` | ✅ |
| Grok Realtime | 3007 | `node core/grok-voice-realtime.cjs` | ✅ |
| Telephony Bridge | 3009 | `node telephony/voice-telephony-bridge.cjs` | ✅ |
| Website | 8080 | `npx serve website` | ✅ |

---

## Credentials Requis

| Credential | Service | Status |
|:-----------|:--------|:------:|
| XAI_API_KEY | Grok (Primary) | À vérifier |
| GOOGLE_GENERATIVE_AI_API_KEY | Gemini (Fallback) | À vérifier |
| HUBSPOT_ACCESS_TOKEN | CRM Tools | ⚠️ Optional |
| TWILIO_ACCOUNT_SID | Telephony | ❌ Manquant |
| TWILIO_AUTH_TOKEN | Telephony | ❌ Manquant |
| TWILIO_PHONE_NUMBER | Telephony | ❌ Manquant |

---

## Métriques VÉRIFIÉES (28/01/2026 - Session 188)

| Métrique | Valeur | Vérification |
|:---------|:-------|:-------------|
| Lignes code | **23,496** | +1,135 (website) |
| Fichiers code | **54** | +5 (website files) |
| Health Check | **100%** | 32/32 checks passed |
| Branding VocalIA | **100%** | 0 refs "3A Automation" |
| KB FR | **16** secteurs | knowledge_base.json |
| KB Darija | **15** secteurs | knowledge_base_ary.json ✅ |
| Langues Telephony | **5** | FR, EN, ES, AR, ARY |

---

## Différenciateurs vs Concurrents

| Feature | Vapi | Retell | **VocalIA** |
|:--------|:----:|:------:|:-----------:|
| Pricing | $0.15-0.33/min | $0.13-0.31/min | **$0.06/min** |
| Widget + Telephony | ❌ | ❌ | **✅** |
| 28 Personas | ❌ | ❌ | **✅** |
| Darija Support | ❌ | ❌ | **✅** |
| Self-Hosted | ❌ | ❌ | **✅** |
| Website Geo-detect | N/A | N/A | **✅** |

---

## Gaps Status (Session 188)

### ✅ DONE (Session 188)
| Gap | Status | Vérification |
|:----|:------:|:-------------|
| Branding "3A" → "VocalIA" | ✅ DONE | `grep "3A Automation" --include="*.cjs" . \| wc -l` → 0 |
| Telephony 5 langues | ✅ DONE | FR, EN, ES, AR, ARY |
| KB Darija | ✅ DONE | `knowledge_base_ary.json` (15 secteurs) |
| KB Placeholder data | ✅ DONE | vocalia.ma, jobs@vocalia.ma |
| Website | ✅ DONE | 1,135 lignes, FR+EN, geo-detect |

### ⚠️ User Action Required
| Credential | Service | Setup |
|:-----------|:--------|:------|
| TWILIO_* | Telephony | [Twilio Console](https://www.twilio.com/console) |
| XAI_API_KEY | Grok | [xAI Console](https://console.x.ai/) |

---

## Commandes

```bash
# Health check
node scripts/health-check.cjs
# Expected: 32/32 passed, 100%

# Start website locally
npx serve website -p 8080

# Start voice services
node core/voice-api-resilient.cjs --server &
node telephony/voice-telephony-bridge.cjs &

# Verify branding
grep -r "3A Automation" --include="*.cjs" . | wc -l
# Expected: 0
```

---

## Documentation

| Document | Description |
|:---------|:------------|
| `docs/SESSION-HISTORY.md` | Suivi implémentation |
| `docs/VOICE-AI-PLATFORM-REFERENCE.md` | Master reference |
| `docs/VOICE-MENA-PLATFORM-ANALYSIS.md` | Benchmark stratégique |
| `docs/VOICE-DARIJA-FORENSIC.md` | Audit Darija |

---

## Session 188 Summary

**DOE Framework - Completed Tasks:**

1. ✅ **Branding**: 61 → 0 refs "3A Automation"
2. ✅ **Telephony**: Added ES, AR, ARY languages (5 total)
3. ✅ **KB Darija**: Created `knowledge_base_ary.json` (15 sectors)
4. ✅ **KB Placeholder**: Fixed to vocalia.ma
5. ✅ **Website**: Created 1,135 lines (futuristic, FR+EN, geo-detect)
6. ✅ **Health Check**: Extended to 32/32 checks

**Delta:**
- LOC: 22,361 → 23,496 (+1,135)
- Files: 49 → 54 (+5)
- Health: 25/25 → 32/32 (+7)
- Score: 95 → 97 (+2)

---

*Màj: 28/01/2026 - Session 188 (DOE Framework)*
*Status: 54 fichiers ✅ | 23,496 LOC | Health: 100% (32/32)*
*Phase 1.5: COMPLETE ✅*
