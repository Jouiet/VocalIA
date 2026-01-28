# VocalIA - Voice AI Platform
> Version: 1.0.0 | 28/01/2026 | Session 184bis | Engineering Score: 76/100

## Identité

- **Type**: Voice AI SaaS Platform
- **Domain**: www.vocalIA.ma
- **Parent**: 3A Automation (3a-automation.com)
- **Location**: `~/Desktop/VocalIA/`

---

## Engineering Score (28/01/2026)

| Discipline | Max | Current | Note |
|:-----------|:---:|:-------:|:-----|
| **Voice Widget** | 15 | **15** | Web Speech API, $0, complet |
| **Voice Telephony** | 15 | **12** | Code OK, TWILIO creds manquants |
| **Multi-Persona** | 15 | **15** | 30 personas, 5 langues |
| **Integrations** | 15 | **12** | HubSpot+Klaviyo+Shopify |
| **Documentation** | 10 | **8** | Rules créés, index fait |
| **Infrastructure** | 15 | **6** | .claude/rules OK, MCP/GPM manquants |
| **Testing** | 15 | **8** | --health existe |
| **TOTAL** | **100** | **76** | Infrastructure à compléter |

---

## 2 Produits

| Produit | Technologie | Coût | Status |
|:--------|:------------|:-----|:------:|
| **Voice Widget** | Web Speech API (Browser) | $0 | ✅ |
| **Voice Telephony AI** | Twilio PSTN ↔ Grok WebSocket | ~$0.06/min | ⚠️ Creds |

---

## Architecture

```
VocalIA/                              # 8,098 lignes
├── core/                             # 3,339 L
│   ├── voice-api-resilient.cjs       # Multi-AI fallback (1,508 L)
│   ├── grok-voice-realtime.cjs       # WebSocket audio (1,112 L)
│   ├── voice-agent-b2b.cjs           # B2B agent (719 L)
│   └── grok-client.cjs               # API client
├── widget/                           # 1,812 L
│   ├── voice-widget-core.js          # Browser (1,012 L)
│   └── voice-widget-templates.cjs    # Templates (800 L)
├── telephony/                        # 2,658 L
│   └── voice-telephony-bridge.cjs    # PSTN bridge, 11 tools
├── personas/                         # 648 L
│   └── voice-persona-injector.cjs    # 30 personas
├── integrations/                     # 253 L
│   ├── voice-crm-tools.cjs           # HubSpot (104 L)
│   └── voice-ecommerce-tools.cjs     # Shopify+Klaviyo (149 L)
├── scripts/                          # 282 L
│   └── voice-quality-sensor.cjs      # Health monitoring
├── docs/                             # Documentation
│   ├── VOICE-AI-PLATFORM-REFERENCE.md
│   ├── VOICE-AI-ARCHITECTURE.md
│   ├── SESSION-HISTORY.md
│   └── DOCS-INDEX.md
└── .claude/rules/                    # Règles Claude
    ├── core.md
    ├── factuality.md
    └── voice-platform.md
```

---

## Services (Ports)

| Service | Port | Commande | Status |
|:--------|:----:|:---------|:------:|
| Voice API | 3004 | `node core/voice-api-resilient.cjs` | ❌ |
| Grok Realtime | 3007 | `node core/grok-voice-realtime.cjs` | ❌ |
| Telephony Bridge | 3009 | `node telephony/voice-telephony-bridge.cjs` | ❌ |

---

## Credentials Requis

| Credential | Service | Status |
|:-----------|:--------|:------:|
| XAI_API_KEY | Grok (Primary) | À vérifier |
| GOOGLE_GENERATIVE_AI_API_KEY | Gemini (Fallback) | À vérifier |
| TWILIO_ACCOUNT_SID | Telephony | ❌ Manquant |
| TWILIO_AUTH_TOKEN | Telephony | ❌ Manquant |
| TWILIO_PHONE_NUMBER | Telephony | ❌ Manquant |

---

## Métriques Vérifiables

| Métrique | Valeur | Vérification |
|:---------|:-------|:-------------|
| Lignes code | 8,098 | `wc -l **/*.cjs **/*.js` |
| Personas | 30 | voice-persona-injector.cjs |
| Function tools | 11 | voice-telephony-bridge.cjs:605-844 |
| Langues | 5 | FR, EN, ES, AR, ARY |
| CRM Integrations | 3 | HubSpot, Klaviyo, Shopify |

---

## Différenciateurs vs Concurrents

| Feature | Vapi | Retell | **VocalIA** |
|:--------|:----:|:------:|:-----------:|
| Pricing | $0.15-0.33/min | $0.13-0.31/min | **$0.06/min** |
| Widget + Telephony | ❌ | ❌ | **✅** |
| 30 Personas | ❌ | ❌ | **✅** |
| Darija Support | ❌ | ❌ | **✅** |
| Self-Hosted | ❌ | ❌ | **✅** |

---

## Gaps à Combler

| Gap | Impact | Priorité |
|:----|:-------|:--------:|
| `.mcp.json` | No MCP tools | P0 |
| `automations-registry.json` | No registry | P1 |
| GPM sensors | No health aggregation | P1 |
| Test suite | Limited testing | P2 |

---

## Commandes

```bash
# Health check
node scripts/voice-quality-sensor.cjs --health

# Start services
node core/voice-api-resilient.cjs &
node core/grok-voice-realtime.cjs &
node telephony/voice-telephony-bridge.cjs &
```

---

## Règles

1. **Credentials**: `process.env.*` uniquement
2. **Health Check**: `--health` sur voice-quality-sensor.cjs
3. **Langues**: FR, EN, ES, AR, ARY (Darija via Atlas-Chat-9B)
4. **HITL**: Contrôles sur bookings et transfers

---

## Documentation

| Document | Description |
|:---------|:------------|
| `docs/VOICE-AI-PLATFORM-REFERENCE.md` | Master reference |
| `docs/VOICE-AI-ARCHITECTURE.md` | Architecture |
| `docs/SESSION-HISTORY.md` | Suivi sessions |
| `docs/DOCS-INDEX.md` | Index docs |

---

## Parent

- **Company**: 3A Automation
- **Location**: `~/Desktop/JO-AAA/`
- **Étagère**: `docs/ETAGERE-TECHNOLOGIQUE-ECOSYSTEME-3A.md`

---

*Créé: 28/01/2026 - Session 184bis*
*Dérivé de 3A Automation*
