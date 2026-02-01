# VocalIA - Architecture Système Complète
## Audit Forensique - Session 250.54 (01/02/2026)

> **DOCUMENT DE RÉFÉRENCE EXHAUSTIF**
> Généré par analyse bottom-up factuelle du codebase

---

## 1. INVENTAIRE DES SERVICES

### 1.1 Services HTTP (Ports)

| Service | Port | Fichier | Status |
|:--------|:----:|:--------|:------:|
| **Voice API** | 3004 | `core/voice-api-resilient.cjs` | ✅ |
| **Grok Realtime** | 3007 | `core/grok-voice-realtime.cjs` | ✅ |
| **Telephony Bridge** | 3009 | `telephony/voice-telephony-bridge.cjs` | ✅ |
| **OAuth Gateway** | 3010 | `core/OAuthGateway.cjs` | ✅ |
| **Webhook Router** | 3011 | `core/WebhookRouter.cjs` | ✅ |
| **DB API** | 3013 | `core/db-api.cjs` | ✅ |
| **Remotion HITL** | 3012 | `core/remotion-hitl.cjs` | ✅ |
| **Website** | 8080 | `npx serve website` | ✅ |

### 1.2 Modules Core (27,238 lignes)

| Module | Lignes | Fonction |
|:-------|:------:|:---------|
| `voice-persona-injector.cjs` | 5,219 | 40 Personas + Injection |
| `voice-telephony-bridge.cjs` | 3,194 | PSTN ↔ AI Bridge |
| `voice-api-resilient.cjs` | 2,285 | Multi-Provider Fallback |
| `hubspot-b2b-crm.cjs` | 1,226 | CRM Integration |
| `grok-voice-realtime.cjs` | 1,107 | WebSocket Audio |
| `voice-widget-core.js` | 1,085 | Browser Widget |
| `knowledge-base-services.cjs` | 907 | RAG + GraphRAG |
| `remotion-service.cjs` | 773 | Video Generation |
| `chaos-engineering.cjs` | 768 | Resilience Testing |
| `voice-agent-b2b.cjs` | 726 | B2B Qualification |

---

## 2. FLUX DE DONNÉES COMPLET

### 2.1 Widget → AI Response

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER (Browser)                                │
│                         │                                        │
│                    [Click/Voice]                                 │
│                         ▼                                        │
│              widget/voice-widget-core.js                         │
│                         │                                        │
│              sendMessage(text) [L989]                            │
│                         │                                        │
│              getAIResponse(text) [L952]                          │
│                    │         │                                   │
│          [Booking Flow]  [AI Response]                           │
│                              │                                   │
│              callVoiceAPI(text) [L838]                           │
│                              │                                   │
│              ┌───────────────┴────────────────┐                  │
│              │  POST https://api.vocalia.ma/respond               │
│              │  Body: {message, language, sessionId, history}    │
│              └───────────────┬────────────────┘                  │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│              core/voice-api-resilient.cjs (port 3004)            │
│                               │                                  │
│              /respond endpoint [L1753]                           │
│                               │                                  │
│    ┌──────────────────────────┼────────────────────────────┐    │
│    │  VoicePersonaInjector.getPersona(null, null, sessionId)    │
│    │  [L1792] → Returns: {id, systemPrompt, knowledge_base_id}  │
│    └──────────────────────────┼────────────────────────────┘    │
│                               │                                  │
│    ┌──────────────────────────▼────────────────────────────┐    │
│    │  getResilisentResponse(msg, history, session, lang)       │
│    │  [L1366]                                                   │
│    │                                                             │
│    │  1. RAG Context: KB.searchHybrid() [L1370]                 │
│    │  2. GraphRAG: KB.graphSearch() [L1374]                     │
│    │  3. Tool Execution: ECOM_TOOLS, CRM_TOOLS [L1386-1414]    │
│    │  4. System Prompt: getSystemPromptForLanguage(lang)       │
│    │     [L1417] ← ⚠️ IGNORES session.metadata.systemPrompt!    │
│    │  5. Fallback Chain: Grok → Gemini → Claude → Local        │
│    └────────────────────────────────────────────────────────────┘
│                               │                                  │
└───────────────────────────────┼──────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│              AI PROVIDERS (Fallback Chain)                       │
│                                                                  │
│  Standard Order:                                                 │
│    1. Grok (grok-4-1-fast-reasoning) [L93-100]                  │
│    2. Gemini (gemini-3-flash-preview) [L101-107]                │
│    3. Claude (claude-opus-4-5-20251101) [L108-115]              │
│    4. Local Fallback [L1488-1492]                               │
│                                                                  │
│  Darija Order (ary):                                             │
│    1. Grok → 2. Atlas-Chat-9B → 3. Gemini → 4. Claude → Local  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Telephony → AI Response (CORRECT PATH)

```
┌─────────────────────────────────────────────────────────────────┐
│              TWILIO (PSTN Call)                                  │
│                    │                                             │
│              TwiML → WebSocket                                   │
│                    │                                             │
└────────────────────┼────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│         telephony/voice-telephony-bridge.cjs (port 3009)        │
│                    │                                             │
│         createGrokSession() [L588]                               │
│                    │                                             │
│    ┌───────────────▼────────────────────────────────────┐       │
│    │  VoicePersonaInjector.getPersona(from, to, clientId)       │
│    │  [L941] → Returns persona with archetypeKey                │
│    │                                                             │
│    │  VoicePersonaInjector.inject(sessionConfig, persona)       │
│    │  [L951] → FULL INJECTION including:                        │
│    │    - SYSTEM_PROMPTS[archetypeKey][language] [L5089-5090]  │
│    │    - Darija-specific instructions [L5094-5095]            │
│    │    - Marketing Psychology (BANT/AIDA/PAS) [L5119-5125]    │
│    │    - Example Dialogues [L5143-5151]                       │
│    │    - Complaint Scenarios [L5153-5161]                     │
│    │    - Escalation Triggers [L5163-5170]                     │
│    └────────────────────────────────────────────────────────────┘
│                    │                                             │
│         ws.send(JSON.stringify(finalConfig)) [L953]             │
│                    │                                             │
└────────────────────┼────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              GROK REALTIME (WebSocket)                           │
│              wss://api.x.ai/v1/realtime                          │
│                                                                  │
│              → Audio In/Out in real-time                        │
│              → Function Calling (11 tools)                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. PROBLÈMES CRITIQUES IDENTIFIÉS - ✅ ALL RESOLVED (Session 250.54)

### 🟢 P0 - CRITIQUE (RESOLVED)

| # | Problème | Fichier | Status |
|:-:|:---------|:--------|:------:|
| 1 | ~~Widget ignores Persona systemPrompt~~ | `voice-api-resilient.cjs:1809` | ✅ FIXED |
| 2 | ~~Port Conflict 3012~~ | `db-api.cjs:23` → port 3013 | ✅ FIXED |
| 3 | ~~CORS missing localhost:8080~~ | `voice-api-resilient.cjs` | ✅ FIXED |

### 🟢 P1 - MAJEUR (RESOLVED)

| # | Problème | Fichier | Status |
|:-:|:---------|:--------|:------:|
| 4 | ~~Widget VOICE_API_URL hardcoded~~ | `voice-widget-core.js:27` | ✅ FIXED (auto dev/prod) |
| 5 | ~~No health check on startup~~ | `voice-api-resilient.cjs` | ✅ FIXED |
| 6 | ~~session.metadata.systemPrompt unused~~ | `voice-api-resilient.cjs:1809` | ✅ FIXED |

### 🟡 P2 - MINEUR (Known)

| # | Problème | Fichier | Impact |
|:-:|:---------|:--------|:-------|
| 7 | Deprecation warning punycode | All Node.js | Console noise (harmless) |
| 8 | SecretVault default key | `SecretVault.cjs` | Use VOCALIA_VAULT_KEY in prod |

---

## 4. 40 PERSONAS ARCHITECTURE

### 4.1 Structure Duale (INTENTIONNELLE)

```javascript
// personas/voice-persona-injector.cjs

// STRUCTURE 1: SYSTEM_PROMPTS (Lignes 68-805)
// Prompts MULTILINGUES - Source primaire
SYSTEM_PROMPTS = {
  AGENCY: {
    fr: "prompt français...",
    en: "prompt english...",
    es: "prompt español...",
    ar: "البرومبت...",
    ary: "الدارجة..."
  },
  // ... 40 personas × 5 langues = 200 prompts
}

// STRUCTURE 2: PERSONAS (Lignes 807-5000)
// Metadata + Fallback EN + Behavioral Context
PERSONAS = {
  AGENCY: {
    id: "agency_v3",
    name: "VocalIA Voice AI Consultant",
    voice: "ara",
    personality_traits: [...],
    example_dialogues: [...],
    complaint_scenarios: [...],
    escalation_triggers: [...],
    systemPrompt: "fallback EN only..."
  }
}
```

### 4.2 Flux d'Injection (inject())

```
inject(sessionConfig, persona) [L5080]
│
├─1. Base Prompt Selection
│   └─ SYSTEM_PROMPTS[archetypeKey][language] || fallback
│
├─2. Darija Enhancement (if language === 'ary')
│   └─ "+CRITICAL: SPEAK IN DARIJA..."
│
├─3. Marketing Psychology Injection
│   ├─ AGENCY/CONTRACTOR/RECRUITER → BANT
│   ├─ COLLECTOR → PAS
│   ├─ HEALER/DOCTOR → CIALDINI
│   └─ ECOMMERCE/RETAILER → AIDA
│
├─4. Example Dialogues Injection
│   └─ persona.example_dialogues[]
│
├─5. Complaint Scenarios (HITL-aware)
│   └─ persona.complaint_scenarios[]
│
└─6. Escalation Triggers
    └─ persona.escalation_triggers[]
```

---

## 5. KNOWLEDGE BASE (RAG)

### 5.1 Métriques

| Métrique | Valeur |
|:---------|:------:|
| Chunks | 193 |
| Terms (TF-IDF vocabulary) | 1,701 |
| Automations | 12 |
| Categories | 6 |
| File: chunks.json | 107 KB |
| File: tfidf_index.json | 314 KB |
| File: knowledge-graph.json | 11 KB |

### 5.2 RAG Pipeline

```
searchHybrid(query, limit, {tenantId}) [knowledge-base-services.cjs]
│
├─1. BM25 Keyword Search
│   └─ TF-IDF scoring on chunks
│
├─2. Semantic Similarity (if embeddings exist)
│   └─ Cosine similarity
│
├─3. RLS Filtering (Row-Level Security)
│   └─ Filter by tenantId for multi-tenant isolation
│
└─4. Hybrid Ranking
    └─ Combine BM25 + Semantic scores
```

### 5.3 GraphRAG

```
graphSearch(query, {tenantId}) [knowledge-base-services.cjs]
│
├─ Nodes: 23 (services, modules, widgets, integrations, sensors, providers)
├─ Edges: 38 (relationships)
└─ Relation Types: 21 (uses_primary, depends_on, monitors, etc.)
```

---

## 6. MCP SERVER

### 6.1 Statistiques

| Métrique | Valeur |
|:---------|:------:|
| Total Tools | 182 |
| Version | 0.8.0 |
| Build | ✅ TypeScript compiles |

### 6.2 Tools par Catégorie

| Catégorie | Count | Fichier |
|:----------|:-----:|:--------|
| Stripe | 19 | `tools/stripe.ts` |
| Shopify | 8 | `tools/shopify.ts` |
| WooCommerce | 7 | `tools/woocommerce.ts` |
| Magento | 10 | `tools/magento.ts` |
| PrestaShop | 10 | `tools/prestashop.ts` |
| BigCommerce | 9 | `tools/bigcommerce.ts` |
| Wix | 6 | `tools/wix.ts` |
| Squarespace | 7 | `tools/squarespace.ts` |
| Calendar | 6 | `tools/calendar.ts` |
| Calendly | 6 | `tools/calendly.ts` |
| Sheets | 7 | `tools/sheets.ts` |
| Drive | 6 | `tools/drive.ts` |
| Gmail | 4 | `tools/gmail.ts` |
| Slack | 2 | `tools/slack.ts` |
| Freshdesk | 6 | `tools/freshdesk.ts` |
| Pipedrive | 7 | `tools/pipedrive.ts` |
| Zendesk | 6 | `tools/zendesk.ts` |
| Zoho | 6 | `tools/zoho.ts` |
| HubSpot | ~10 | Via `hubspot-b2b-crm.cjs` |
| Zapier | 3 | `tools/zapier.ts` |
| Make | 3 | `tools/make.ts` |
| n8n | 3 | `tools/n8n.ts` |
| Export | 5 | `tools/export.ts` |
| UCP | 7 | `tools/ucp.ts` |
| Local (KB, Personas) | ~20 | `index.ts` |

---

## 7. INTEGRATIONS

### 7.1 CRM

| Integration | Module | Tools |
|:------------|:-------|:-----:|
| HubSpot | `hubspot-b2b-crm.cjs` | Full CRUD |
| Pipedrive | `tools/pipedrive.ts` | 7 |
| Zoho CRM | `tools/zoho.ts` | 6 |

### 7.2 E-commerce

| Platform | Market Share | Tools | Status |
|:---------|:------------:|:-----:|:------:|
| WooCommerce | 33-39% | 7 | ✅ |
| Shopify | 10.32% | 8 | ✅ |
| Magento | 8% | 10 | ✅ |
| Wix Stores | 7.4% | 6 | ✅ |
| Squarespace | 2.6% | 7 | ✅ |
| PrestaShop | 1.91% | 10 | ✅ |
| BigCommerce | 1% | 9 | ✅ |
| **Total Coverage** | **~64%** | **57** | |

### 7.3 Support

| Integration | Module | Tools |
|:------------|:-------|:-----:|
| Freshdesk | `tools/freshdesk.ts` | 6 |
| Zendesk | `tools/zendesk.ts` | 6 |

### 7.4 Payments

| Integration | Module | Tools |
|:------------|:-------|:-----:|
| Stripe | `tools/stripe.ts` | 19 |

---

## 8. SENSORS (4)

| Sensor | Fichier | Fonction |
|:-------|:--------|:---------|
| Voice Quality | `sensors/voice-quality-sensor.cjs` | Latency, health monitoring |
| Cost Tracking | `sensors/cost-tracking-sensor.cjs` | API costs burn rate |
| Lead Velocity | `sensors/lead-velocity-sensor.cjs` | Lead qualification rate |
| Retention | `sensors/retention-sensor.cjs` | Client retention metrics |

---

## 9. AGENTS A2A (4)

| Agent | Fichier | Fonction |
|:------|:--------|:---------|
| TranslationSupervisor | `core/translation-supervisor.cjs` | Language quality guard |
| BillingAgent | `core/BillingAgent.cjs` | Revenue tracking |
| TenantOnboardingAgent | `core/TenantOnboardingAgent.cjs` | Client setup |
| VoiceAgentB2B | `core/voice-agent-b2b.cjs` | B2B qualification |

---

## 10. CREDENTIALS REQUIS

| Variable | Service | Requis |
|:---------|:--------|:------:|
| `XAI_API_KEY` | Grok | ✅ Critical |
| `GEMINI_API_KEY` | Gemini | ✅ Critical |
| `ANTHROPIC_API_KEY` | Claude | ⚠️ Fallback |
| `HUGGINGFACE_API_KEY` | Atlas-Chat | ⚠️ Darija only |
| `TWILIO_ACCOUNT_SID` | Telephony | ✅ For PSTN |
| `TWILIO_AUTH_TOKEN` | Telephony | ✅ For PSTN |
| `TWILIO_PHONE_NUMBER` | Telephony | ✅ For PSTN |
| `HUBSPOT_ACCESS_TOKEN` | CRM | ⚠️ Optional |
| `STRIPE_SECRET_KEY` | Payments | ⚠️ Optional |
| `VOCALIA_VAULT_KEY` | SecretVault | ⚠️ Production |

---

## 11. i18n CONFIGURATION

### 11.1 Langues Supportées

| Code | Langue | RTL | Status |
|:----:|:-------|:---:|:------:|
| fr | Français | Non | ✅ |
| en | English | Non | ✅ |
| es | Español | Non | ✅ |
| ar | العربية (MSA) | Oui | ✅ |
| ary | Darija (Marocain) | Oui | ✅ |

### 11.2 Métriques i18n

| Métrique | Valeur |
|:---------|:------:|
| Website Keys | ~4,019 per locale |
| Total Keys | ~20,095 |
| Widget JSON Files | 5 |
| Translation QA Issues | 0 |

---

## 12. PLAN D'ACTION

### Phase 1: Fixes Critiques (P0) - ✅ COMPLETE

| # | Fix | Fichier | Status |
|:-:|:----|:--------|:------:|
| 1 | Use session.metadata.systemPrompt in getResilisentResponse() | `voice-api-resilient.cjs` | ✅ DONE |
| 2 | Change db-api port to 3013 | `core/db-api.cjs` | ✅ DONE |
| 3 | Add localhost:8080 to CORS whitelist | `voice-api-resilient.cjs` | ✅ DONE |

### Phase 2: Fixes Majeurs (P1) - ✅ COMPLETE

| # | Fix | Fichier | Status |
|:-:|:----|:--------|:------:|
| 4 | Add dev/prod config for VOICE_API_URL | `voice-widget-core.js` | ✅ DONE |
| 5 | Add startup health check | `voice-api-resilient.cjs` | ✅ DONE |
| 6 | Verify persona injection end-to-end | `test/persona-e2e.test.cjs` | ✅ 8/8 tests pass |

### Phase 3: Optimisations - ✅ COMPLETE

| # | Optimization | Fichier | Status |
|:-:|:-------------|:--------|:------:|
| 7 | Add request tracing/logging | `voice-api-resilient.cjs` | ✅ X-Trace-Id header |
| 8 | Add metrics endpoint | `voice-api-resilient.cjs` | ✅ GET /metrics |
| 9 | Add graceful shutdown | `voice-api-resilient.cjs` | ✅ SIGTERM/SIGINT |

---

## 13. ÉTAT DÉPLOIEMENT PRODUCTION

### 13.1 api.vocalia.ma (Vérifié 01/02/2026)

| Endpoint | Status | Réponse |
|:---------|:------:|:--------|
| GET /health | ✅ HTTP 200 | healthy: true |
| POST /respond | ✅ HTTP 200 | Fonctionne |

### 13.2 Configuration Production

| Provider | Configuré | Impact |
|:---------|:---------:|:-------|
| Grok | ❌ Non | XAI_API_KEY manquant |
| Gemini | ❌ Non | GEMINI_API_KEY manquant |
| Claude | ❌ Non | ANTHROPIC_API_KEY manquant |
| Atlas-Chat | ❌ Non | HUGGINGFACE_API_KEY manquant |
| Local Fallback | ✅ Oui | Utilisé par défaut |

**Conséquence:** En production, toutes les réponses utilisent le fallback local (pattern matching), PAS les 40 personas avec AI.

### 13.3 Action Requise (Ops)

Pour activer les 40 personas en production:
1. Configurer les variables d'environnement sur le serveur VPS
2. Redémarrer le service voice-api-resilient

---

## 14. CHANGELOG SESSION 250.54

| Change | Impact |
|:-------|:-------|
| archetypeKey propagation fix | 5 langues fonctionnent |
| Port conflict fix (db-api → 3013) | Services peuvent coexister |
| Startup health check | 3 checks automatiques |
| Request tracing | X-Trace-Id pour debugging |
| /metrics endpoint | Monitoring production |
| Graceful shutdown | Reliability accrue |
| E2E test suite | 8 tests automatisés |
| Document line number audit | All references verified |

---

*Document généré: 01/02/2026 - Session 250.54*
*Màj: 01/02/2026 - Session 250.54 - PLAN 100% COMPLETE*
*Méthode: Analyse forensique bottom-up factuelle*
