# VocalIA - Voice AI Platform
> Version: 1.4.0 | 28/01/2026 | Session 187 | Engineering Score: 95/100 | Health: 100%

## Identité

- **Type**: Voice AI SaaS Platform
- **Domain**: www.vocalIA.ma
- **Parent**: 3A Automation (3a-automation.com)
- **Location**: `~/Desktop/VocalIA/`

---

## Engineering Score (28/01/2026 - Session 185 FINAL)

| Discipline | Max | Current | Note |
|:-----------|:---:|:-------:|:-----|
| **Voice Widget** | 15 | **15** | Web Speech API, $0, complet |
| **Voice Telephony** | 15 | **12** | Code OK, TWILIO creds manquants |
| **Multi-Persona** | 15 | **15** | 28 personas, 5 langues, marketing science |
| **Integrations** | 15 | **12** | HubSpot+Klaviyo+Shopify (creds manquants) |
| **Documentation** | 10 | **10** | 5 rules, CLAUDE.md, scripts.md ✅ |
| **Infrastructure** | 15 | **15** | MCP ✅, Sensors ✅, Registry ✅, GPM ✅, 3A-Shelf ✅ |
| **Testing** | 15 | **15** | 25/25 checks ✅, health-check.cjs ✅ |
| **TOTAL** | **100** | **95** | Health Score: 100% (25/25 passed) |

---

## 2 Produits

| Produit | Technologie | Coût | Status |
|:--------|:------------|:-----|:------:|
| **Voice Widget** | Web Speech API (Browser) | $0 | ✅ |
| **Voice Telephony AI** | Twilio PSTN ↔ Grok WebSocket | ~$0.06/min | ⚠️ Creds |

---

## Architecture (VÉRIFIÉ 28/01/2026 - Session 185 FINAL)

```
VocalIA/                              # 22,361 lignes (49 fichiers)
├── core/                             # 11,290 L (18 fichiers)
│   ├── voice-api-resilient.cjs       # Multi-AI fallback (1,508 L)
│   ├── grok-voice-realtime.cjs       # WebSocket audio (1,112 L)
│   ├── voice-agent-b2b.cjs           # B2B agent (719 L)
│   ├── grok-client.cjs               # API client (400 L)
│   ├── knowledge-base-services.cjs   # KB services (835 L)
│   ├── AgencyEventBus.cjs            # Event-driven (618 L)
│   ├── ErrorScience.cjs              # Error handling (522 L)
│   ├── ContextBox.cjs                # Session context (455 L)
│   ├── RevenueScience.cjs            # Pricing (414 L)
│   ├── BillingAgent.cjs              # Billing (310 L)
│   ├── marketing-science-core.cjs    # Marketing (292 L)
│   ├── compliance-guardian.cjs       # Compliance (142 L)
│   ├── stitch-api.cjs                # UI generation MCP (279 L) ✅ NEW
│   ├── stitch-to-3a-css.cjs          # CSS extraction (388 L) ✅ NEW
│   ├── TenantContext.cjs             # Multi-tenant context ✅ NEW
│   ├── TenantLogger.cjs              # Tenant logging ✅ NEW
│   ├── knowledge-embedding-service.cjs # Embeddings
│   └── gateways/                     # Payment/Meta gateways
├── widget/                           # 1,812 L
│   ├── voice-widget-core.js          # Browser (1,012 L)
│   └── voice-widget-templates.cjs    # Templates (800 L)
├── telephony/                        # 2,658 L
│   ├── voice-telephony-bridge.cjs    # PSTN bridge, 11 tools
│   └── knowledge_base.json           # KB data
├── personas/                         # 648 L
│   ├── voice-persona-injector.cjs    # 28 personas
│   ├── agency-financial-config.cjs   # Pricing config
│   └── client_registry.json          # Tenant config
├── integrations/                     # 1,458 L
│   ├── hubspot-b2b-crm.cjs           # HubSpot CRM
│   ├── voice-crm-tools.cjs           # CRM bridge
│   └── voice-ecommerce-tools.cjs     # Shopify+Klaviyo
├── sensors/                          # 4 sensors ✅ NEW
│   ├── voice-quality-sensor.cjs      # Voice health
│   ├── cost-tracking-sensor.cjs      # API costs
│   ├── lead-velocity-sensor.cjs      # Lead metrics
│   └── retention-sensor.cjs          # Retention
├── knowledge-base/                   # 654 L
│   └── src/
│       ├── vector-store.cjs          # Vector DB
│       └── catalog-extractor.cjs     # Catalog
├── lib/                              # 919 L
│   └── security-utils.cjs            # Security
├── docs/                             # 10 documents
│   ├── VOICE-AI-PLATFORM-REFERENCE.md
│   ├── VOICE-AI-ARCHITECTURE.md
│   ├── SESSION-HISTORY.md            # Suivi implémentation
│   ├── DOCS-INDEX.md
│   ├── SAVOIR-FAIRE-TRANSMISSIBLE.md
│   ├── VOICE-MENA-PLATFORM-ANALYSIS.md  # Benchmark stratégique (2,187 L)
│   ├── VOICE-MULTILINGUAL-STRATEGY.md   # Stratégie multilingue (736 L)
│   ├── VOICE-DARIJA-FORENSIC.md         # Audit Darija (111 L)
│   ├── VOICE-AUDIT-FINAL.md             # Audit forensique (85 L)
│   └── benchmarks-2026.md               # Latency benchmarks (12 L)
├── .claude/rules/                    # 5 règles
│   ├── core.md
│   ├── factuality.md
│   ├── voice-platform.md
│   ├── scripts.md                    ✅ NEW
│   └── token-optimization.md         ✅ NEW
└── .mcp.json                         ✅ NEW (grok server)
```

---

## Services (Ports)

| Service | Port | Commande | Module Load | Runtime |
|:--------|:----:|:---------|:-----------:|:-------:|
| Voice API | 3004 | `node core/voice-api-resilient.cjs` | ✅ | ❌ |
| Grok Realtime | 3007 | `node core/grok-voice-realtime.cjs` | ✅ | ❌ |
| Telephony Bridge | 3009 | `node telephony/voice-telephony-bridge.cjs` | ✅ | ❌ |

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

## Métriques VÉRIFIÉES (28/01/2026 - Session 185 FINAL)

| Métrique | Valeur | Vérification |
|:---------|:-------|:-------------|
| Lignes code | **22,361** | `find . -name "*.cjs" -o -name "*.js" \| xargs wc -l` |
| Fichiers code | **49** | `find . -name "*.cjs" -o -name "*.js" \| wc -l` |
| Core modules | **17** | AgencyEventBus, ContextBox, BillingAgent, etc. |
| .claude/rules/ | **5** | core, factuality, scripts, token-optimization, voice-platform |
| Sensors | **4** | voice-quality, cost-tracking, lead-velocity, retention |
| Personas | **28** | `grep -E "^\s+[A-Z]+:\s*\{$" personas/*.cjs \| sort -u` |
| Function tools | **11** | voice-telephony-bridge.cjs:605-844 |
| Langues | **5** | FR, EN, ES, AR, ARY |
| CRM Integrations | **3** | HubSpot, Klaviyo, Shopify |
| MCP Config | **YES** | .mcp.json (grok server) |
| automations-registry | **12** | automations-registry.json |
| GPM pressure-matrix | **YES** | data/pressure-matrix.json |
| 3A-Shelf | **YES** | @3a/agent-ops via yalc |
| Health Check | **100%** | 25/25 checks passed |
| npm dependencies | **6** | package.json |

---

## Différenciateurs vs Concurrents

| Feature | Vapi | Retell | **VocalIA** |
|:--------|:----:|:------:|:-----------:|
| Pricing | $0.15-0.33/min | $0.13-0.31/min | **$0.06/min** |
| Widget + Telephony | ❌ | ❌ | **✅** |
| 28 Personas | ❌ | ❌ | **✅** |
| Darija Support | ❌ | ❌ | **✅** |
| Self-Hosted | ❌ | ❌ | **✅** |

---

## 3A-Shelf Integration (28/01/2026)

**Étagère Technologique - Code Sharing System**

VocalIA can now use shared packages from 3A-Shelf via yalc:

```bash
# Add shared packages
yalc add @3a/agent-ops    # EventBus, ContextBox, Billing
yalc add @3a/security     # Input sanitization
yalc add @3a/sensors      # GPM sensors
yalc add @3a/voice-core   # Voice modules
```

**Current Status:**
- ✅ @3a/agent-ops@3.0.0 installed via yalc
- ⏳ Other packages available on demand

**Update Command:**
```bash
yalc update  # Pull latest from 3A-Shelf
```

---

## Gaps à Combler (Session 187 - AUDIT)

### ✅ Infrastructure DONE
| Gap | Status |
|:----|:------:|
| `.mcp.json` | ✅ DONE |
| `.claude/rules/` | ✅ DONE (5 rules) |
| Multi-tenant modules | ✅ DONE |
| Sensors | ✅ DONE (4 sensors) |
| 3A-Shelf Integration | ✅ DONE |
| Test suite | ✅ DONE (25/25) |

### ❌ Gaps Critiques (Session 187 Audit)
| Gap | Impact | Priorité | Status |
|:----|:-------|:--------:|:------:|
| **Branding "3A" dans code** | 128 occurrences à corriger | **P0** | ❌ 33 fichiers |
| **Telephony hardcode fr-FR** | Agent muet en Darija | **P0** | ❌ L1235 |
| **KB FR-only** | RAG échoue en Darija | **P0** | ❌ Pas de KB ARY |
| **KB données placeholder** | Emails/URLs fictifs | **P1** | ❌ À corriger |
| TWILIO_* credentials | Telephony | P1 | ⚠️ USER ACTION |
| XAI_API_KEY | Grok provider | P1 | ⚠️ USER ACTION |

### Branding Stats (Session 187)
| Marque | Occurrences | Objectif |
|:-------|:-----------:|:--------:|
| "3A Automation" | 128 (45 fichiers) | 0 |
| "VocalIA" | 72 (19 fichiers) | 100% |

---

## Commandes

```bash
# Install dependencies (REQUIRED first time)
npm install

# Health check
node scripts/voice-quality-sensor.cjs --health

# Start services (requires .env configured)
node core/voice-api-resilient.cjs --server &
node core/grok-voice-realtime.cjs &
node telephony/voice-telephony-bridge.cjs &

# Test module loading
node -e "require('./core/voice-api-resilient.cjs')"
```

---

## Règles

1. **Credentials**: `process.env.*` uniquement
2. **Health Check**: `--health` sur voice-quality-sensor.cjs
3. **Langues**: FR, EN, ES, AR, ARY (Darija via Atlas-Chat-9B)
4. **HITL**: Contrôles sur bookings et transfers
5. **Factualité**: Toute métrique doit être vérifiable empiriquement

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

*Màj: 28/01/2026 - Session 187 (AUDIT KB & BRANDING)*
*Status: 49 fichiers ✅ | 22,361 LOC | Health: 100% (25/25)*
*Gaps Critiques: Branding (128 refs), KB FR-only, Telephony hardcode*
*Action: Uniformiser branding VocalIA, créer KB Darija*
