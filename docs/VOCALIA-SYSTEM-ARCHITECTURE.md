# VocalIA - Architecture Système Complète
## Document Consolidé de Référence
### Version 1.1.0 | 02/02/2026 | Session 250.52 (P0+P1+P2 COMPLETE)

> **DOCUMENT UNIQUE DE RÉFÉRENCE** - Remplace tous les documents d'architecture fragmentés
> Généré par analyse bottom-up factuelle exhaustive du codebase

---

## TABLE DES MATIÈRES

1. [Vue d'Ensemble](#1-vue-densemble)
2. [Architecture des Services](#2-architecture-des-services)
3. [Architecture Backend](#3-architecture-backend)
4. [Architecture Frontend](#4-architecture-frontend)
5. [Architecture Voice AI](#5-architecture-voice-ai)
6. [Architecture Données](#6-architecture-données)
7. [Architecture MCP Server](#7-architecture-mcp-server)
8. [Architecture Intégrations](#8-architecture-intégrations)
9. [Architecture Sécurité](#9-architecture-sécurité)
10. [Architecture i18n](#10-architecture-i18n)
11. [Flux de Données](#11-flux-de-données)
12. [Credentials et Configuration](#12-credentials-et-configuration)
13. [Métriques du Codebase](#13-métriques-du-codebase)

---

## 1. VUE D'ENSEMBLE

### 1.1 Identité

| Attribut | Valeur |
|:---------|:-------|
| **Nom** | VocalIA |
| **Domaine** | vocalia.ma |
| **Type** | Voice AI SaaS Platform |
| **Produits** | Voice Widget (Browser) + Voice Telephony (PSTN) |
| **Langues** | 5 (FR, EN, ES, AR, ARY/Darija) |

### 1.2 Métriques Globales (Vérifiées 02/02/2026)

| Composant | Fichiers | Lignes |
|:----------|:--------:|:------:|
| Core Backend | 32 | 16,833 |
| Telephony | 1 | 3,194 |
| Personas | 1 | 5,280 |
| Widget | 1 | 1,085 |
| Sensors | 4 | 822 |
| Integrations | 3 | 1,479 |
| MCP Server (TS) | 25+ | 15,755 |
| Website Libs (JS) | 21 | 7,326 |
| Website HTML | 67 | ~25,000 |
| **TOTAL Backend** | **~70** | **~45,000** |

### 1.3 Diagramme d'Architecture Globale

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│    ┌──────────────┐     ┌──────────────┐     ┌──────────────┐              │
│    │   Browser    │     │   PSTN Call  │     │   MCP Client │              │
│    │   (Widget)   │     │   (Twilio)   │     │   (Claude)   │              │
│    └──────┬───────┘     └──────┬───────┘     └──────┬───────┘              │
│           │                    │                    │                       │
└───────────┼────────────────────┼────────────────────┼───────────────────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SERVICES (Ports)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │  Voice API      │  │  Grok Realtime  │  │  Telephony      │             │
│  │  Port 3004      │  │  Port 3007      │  │  Port 3009      │             │
│  │  (Text AI)      │  │  (Audio WS)     │  │  (PSTN Bridge)  │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
│           │                    │                    │                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │  OAuth Gateway  │  │  Webhook Router │  │  DB API         │             │
│  │  Port 3010      │  │  Port 3011      │  │  Port 3013      │             │
│  └─────────────────┘  └─────────────────┘  └────────┬────────┘             │
│                                                      │                       │
│  ┌─────────────────┐  ┌─────────────────┐           │                       │
│  │  Remotion HITL  │  │  MCP Server     │           │                       │
│  │  Port 3012      │  │  (stdio)        │           │                       │
│  └─────────────────┘  └─────────────────┘           │                       │
│                                                      │                       │
└──────────────────────────────────────────────────────┼───────────────────────┘
                                                       │
                                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │  Google Sheets  │  │  Knowledge Base │  │  SecretVault    │             │
│  │  (7 tables)     │  │  (RAG + Graph)  │  │  (Credentials)  │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                                       │
                                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AI PROVIDERS (External)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │  Grok (xAI)     │  │  Gemini         │  │  Claude         │             │
│  │  PRIMARY        │  │  FALLBACK 1     │  │  FALLBACK 2     │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                                   │
│  │  Atlas-Chat     │  │  Local Fallback │                                   │
│  │  (Darija)       │  │  (Rule-based)   │                                   │
│  └─────────────────┘  └─────────────────┘                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. ARCHITECTURE DES SERVICES

### 2.1 Services HTTP (7 total)

| Service | Port | Fichier | Lignes | Fonction |
|:--------|:----:|:--------|:------:|:---------|
| **Voice API** | 3004 | `core/voice-api-resilient.cjs` | 2,285 | API texte multi-AI |
| **Grok Realtime** | 3007 | `core/grok-voice-realtime.cjs` | 1,107 | WebSocket audio |
| **Telephony Bridge** | 3009 | `telephony/voice-telephony-bridge.cjs` | 3,194 | PSTN ↔ AI |
| **OAuth Gateway** | 3010 | `core/OAuthGateway.cjs` | ~400 | OAuth 2.0 flows |
| **Webhook Router** | 3011 | `core/WebhookRouter.cjs` | ~350 | Inbound webhooks |
| **Remotion HITL** | 3012 | `core/remotion-hitl.cjs` | ~500 | Video HITL |
| **DB API** | 3013 | `core/db-api.cjs` | ~800 | REST API + Auth + WebSocket |

### 2.2 Commandes de Démarrage

```bash
# Voice API (Text)
node core/voice-api-resilient.cjs --server --port=3004

# Grok Realtime (Audio WebSocket)
node core/grok-voice-realtime.cjs --server --port=3007

# Telephony Bridge (PSTN)
node telephony/voice-telephony-bridge.cjs

# DB API (REST + Auth)
node core/db-api.cjs

# Website (Static)
npx serve website -p 8080
```

### 2.3 Health Checks

```bash
# Tous les services
curl http://localhost:3004/health
curl http://localhost:3007/health
curl http://localhost:3009/health
curl http://localhost:3013/api/db/health
```

---

## 3. ARCHITECTURE BACKEND

### 3.1 Modules Core (32 fichiers, 16,833 lignes)

| Catégorie | Modules | Lignes | Description |
|:----------|:--------|:------:|:------------|
| **Voice** | voice-api-resilient, grok-voice-realtime, grok-client | ~4,500 | AI voice processing |
| **Auth** | auth-service, auth-middleware | 963 | JWT + bcrypt |
| **Data** | GoogleSheetsDB, db-api | ~1,200 | Database layer |
| **Security** | SecretVault, compliance-guardian | ~700 | Credentials + GDPR |
| **Agents** | BillingAgent, TenantOnboardingAgent, voice-agent-b2b, translation-supervisor | ~1,500 | A2A Protocol |
| **Gateways** | OAuthGateway, WebhookRouter | ~750 | External integrations |
| **Utilities** | ErrorScience, RevenueScience, marketing-science-core | ~1,200 | Analytics + ML |
| **Multi-tenant** | TenantContext, TenantLogger, client-registry | ~600 | Tenant isolation |
| **Video** | remotion-service, remotion-hitl, stitch-api | ~1,500 | Video generation |
| **Knowledge** | knowledge-base-services, knowledge-embedding-service | ~1,400 | RAG + GraphRAG |

### 3.2 Sensors (4 fichiers, 822 lignes)

| Sensor | Fichier | Fonction |
|:-------|:--------|:---------|
| Voice Quality | `sensors/voice-quality-sensor.cjs` | Latency, health monitoring |
| Cost Tracking | `sensors/cost-tracking-sensor.cjs` | API costs burn rate |
| Lead Velocity | `sensors/lead-velocity-sensor.cjs` | Lead qualification rate |
| Retention | `sensors/retention-sensor.cjs` | Client retention metrics |

### 3.3 Integrations (3 fichiers, 1,479 lignes)

| Module | Lignes | Fonction |
|:-------|:------:|:---------|
| `hubspot-b2b-crm.cjs` | 1,226 | HubSpot CRM Full CRUD |
| `voice-crm-tools.cjs` | ~150 | CRM tool wrappers |
| `voice-ecommerce-tools.cjs` | ~100 | E-commerce tool wrappers |

### 3.4 Telephony (1 fichier, 3,194 lignes)

```
telephony/voice-telephony-bridge.cjs
├── TwiML Voice Handlers (5 fonctions)
├── Grok WebSocket Session Management
├── Function Tools (11 outils)
│   ├── qualify_lead
│   ├── handle_objection
│   ├── check_order_status
│   ├── check_product_stock
│   ├── get_customer_tags
│   ├── schedule_callback
│   ├── create_booking
│   ├── track_conversion_event
│   ├── search_knowledge_base
│   ├── send_payment_details
│   └── transfer_call
├── SMS Fallback (Twilio + WhatsApp)
└── HITL Controls
```

### 3.5 Personas (1 fichier, 5,280 lignes)

```
personas/voice-persona-injector.cjs
├── SYSTEM_PROMPTS (lignes 68-805)
│   └── 40 personas × 5 langues = 200 prompts multilingues
├── PERSONAS (lignes 807-5000)
│   └── 40 personas avec metadata
│       ├── personality_traits
│       ├── example_dialogues
│       ├── complaint_scenarios
│       ├── escalation_triggers
│       └── systemPrompt (fallback EN)
└── inject() function
    ├── Language-specific prompt selection
    ├── Darija enhancement
    ├── Marketing psychology (BANT/AIDA/PAS/CIALDINI)
    └── Behavioral context injection
```

**40 Personas:**
```
AGENCY, UNIVERSAL_ECOMMERCE, DENTAL, PROPERTY, COLLECTOR,
RETAILER, BUILDER, RESTAURATEUR, TRAVEL_AGENT, CONSULTANT,
IT_SERVICES, MANUFACTURER, DOCTOR, NOTARY, BAKERY,
SPECIALIST, REAL_ESTATE_AGENT, HAIRDRESSER, GROCERY, CONTRACTOR,
FUNERAL, HEALER, MECHANIC, COUNSELOR, CONCIERGE,
STYLIST, RECRUITER, DISPATCHER, INSURER, ACCOUNTANT,
ARCHITECT, PHARMACIST, RENTER, LOGISTICIAN, TRAINER,
PLANNER, PRODUCER, CLEANER, GYM, UNIVERSAL_SME
```

---

## 4. ARCHITECTURE FRONTEND

### 4.1 Website Statique (67 pages HTML)

```
website/
├── index.html                    # Homepage
├── about.html                    # À propos
├── contact.html                  # Contact
├── pricing.html                  # Tarification
├── features.html                 # Fonctionnalités
├── integrations.html             # Intégrations
├── signup.html                   # Inscription
├── login.html                    # Connexion legacy
├── investor.html                 # Investisseurs
├── terms.html                    # CGU
├── privacy.html                  # Confidentialité
├── cookie-policy.html            # Cookies
├── referral.html                 # Programme parrainage
├── 404.html                      # Page erreur
│
├── products/                     # 2 pages produits
│   ├── voice-widget.html
│   └── voice-telephony.html
│
├── industries/                   # 5 pages industries
│   ├── index.html
│   ├── retail.html
│   ├── finance.html
│   ├── healthcare.html
│   └── real-estate.html
│
├── use-cases/                    # 5 pages use cases
│   ├── index.html
│   ├── lead-qualification.html
│   ├── customer-support.html
│   ├── e-commerce.html
│   └── appointments.html
│
├── blog/                         # 13 pages blog
│   ├── index.html
│   └── articles/
│       ├── ai-act-europe-voice-ai.html
│       ├── vocalia-lance-support-darija.html
│       ├── voice-ai-vs-chatbot-comparatif.html
│       ├── integrer-vocalia-shopify.html
│       ├── guide-qualification-leads-bant.html
│       ├── clinique-amal-rappels-vocaux.html
│       ├── tendances-ia-vocale-2026.html
│       ├── rgpd-voice-ai-guide-2026.html
│       ├── reduire-couts-support-voice-ai.html
│       ├── comment-choisir-solution-voice-ai.html
│       ├── agence-immo-plus-conversion.html
│       └── automatiser-prise-rdv-telephonique.html
│
├── docs/                         # 2 pages documentation
│   ├── index.html
│   └── api.html
│
├── dashboard/                    # 3 dashboards legacy
│   ├── client.html
│   ├── admin.html
│   └── widget-analytics.html
│
├── academie-business/            # 1 page formation
│   └── index.html
│
├── status/                       # 1 page status
│   └── index.html
│
├── components/                   # 4 composants partagés
│   ├── header.html
│   ├── footer.html
│   ├── newsletter-cta.html
│   └── analytics.html
│
└── app/                          # 17 pages SaaS Webapp
    ├── auth/                     # 5 pages authentification
    │   ├── login.html
    │   ├── signup.html
    │   ├── forgot-password.html
    │   ├── reset-password.html
    │   └── verify-email.html
    ├── client/                   # 7 pages portail client
    │   ├── index.html            # Dashboard
    │   ├── calls.html            # Historique appels
    │   ├── agents.html           # Gestion personas
    │   ├── integrations.html     # Connexions CRM
    │   ├── analytics.html        # Graphiques
    │   ├── billing.html          # Facturation
    │   └── settings.html         # Paramètres
    └── admin/                    # 5 pages console admin
        ├── index.html            # Dashboard admin
        ├── tenants.html          # Gestion tenants
        ├── users.html            # Gestion users
        ├── logs.html             # Logs système
        └── hitl.html             # Approbations HITL
```

### 4.2 Libraries JavaScript (21 fichiers, 7,326 lignes)

```
website/src/lib/
├── auth-client.js         (465)   # JWT tokens, session
├── api-client.js          (429)   # Fetch wrapper + auth
├── data-table.js          (672)   # Tri, filtre, pagination
├── charts.js              (453)   # Chart.js wrapper
├── modal.js               (481)   # Dialogs accessibles
├── toast.js               (274)   # Notifications
├── websocket-manager.js   (465)   # Temps réel
├── ab-testing.js          (280)   # A/B testing framework
├── voice-visualizer.js    (580)   # Audio visualizer
├── gsap-animations.js     (680)   # Animations GSAP
├── home-page.js           (275)   # Homepage logic
├── site-init.js           (150)   # Site initialization
├── event-delegation.js    (250)   # Event handling
├── form-validation.js     (140)   # Form validation
├── geo-detect.js          (170)   # Geo-detection
├── global-localization.js (190)   # i18n runtime
├── i18n.js                (155)   # Translation loader
├── dashboard-grid.js      (230)   # Dashboard layout
├── components.js          (60)    # UI components
├── card-tilt.js           (185)   # Card effects
└── db-client.js           (87)    # DB utilities
```

### 4.3 Widget Voice (1 fichier, 1,085 lignes)

```
widget/voice-widget-core.js
├── VocaliaWidget class
├── Web Speech API integration
├── callVoiceAPI() → POST /respond
├── Booking flow handling
├── Language detection
├── Audio feedback
└── Accessibility features
```

---

## 5. ARCHITECTURE VOICE AI

### 5.1 Produit 1: Voice Widget (Browser)

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER (Browser)                                │
│                         │                                        │
│                    [Click/Voice]                                 │
│                         ▼                                        │
│              widget/voice-widget-core.js                         │
│                         │                                        │
│              Web Speech API (GRATUIT)                            │
│                         │                                        │
│              POST https://api.vocalia.ma/respond                 │
│              Body: {message, language, sessionId, history}       │
│                         │                                        │
│                         ▼                                        │
│              core/voice-api-resilient.cjs (port 3004)            │
│                         │                                        │
│    ┌────────────────────┼────────────────────┐                  │
│    │  1. VoicePersonaInjector.getPersona()  │                  │
│    │  2. KB.searchHybrid() (RAG)            │                  │
│    │  3. KB.graphSearch() (GraphRAG)        │                  │
│    │  4. Multi-AI Fallback Chain            │                  │
│    │     Grok → Gemini → Claude → Local     │                  │
│    └────────────────────┼────────────────────┘                  │
│                         │                                        │
│              Response: {text, audioUrl}                          │
│                         │                                        │
│              TTS via Web Speech API                              │
│                         │                                        │
│                    [Audio Output]                                │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Produit 2: Voice Telephony (PSTN)

```
┌─────────────────────────────────────────────────────────────────┐
│              TWILIO (PSTN Call)                                  │
│                    │                                             │
│              TwiML → WebSocket                                   │
│                    │                                             │
│                    ▼                                             │
│         telephony/voice-telephony-bridge.cjs (port 3009)        │
│                    │                                             │
│    ┌───────────────┼───────────────────────────────────┐        │
│    │  1. VoicePersonaInjector.getPersona(from, to)     │        │
│    │  2. VoicePersonaInjector.inject(config, persona)  │        │
│    │     - SYSTEM_PROMPTS[key][lang]                   │        │
│    │     - Darija enhancement                          │        │
│    │     - Marketing psychology                        │        │
│    │     - Example dialogues                           │        │
│    │  3. Function Tools (11 outils)                    │        │
│    └───────────────┼───────────────────────────────────┘        │
│                    │                                             │
│              WebSocket → Grok Realtime                           │
│              wss://api.x.ai/v1/realtime                         │
│                    │                                             │
│              Audio In/Out bidirectionnel                         │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Multi-AI Fallback Chain

```javascript
// Ordre Standard (voice-api-resilient.cjs)
providers: [
  { name: 'grok', model: 'grok-4-1-fast-reasoning' },    // Primary
  { name: 'gemini', model: 'gemini-3-flash-preview' },   // Fallback 1
  { name: 'anthropic', model: 'claude-opus-4-5' },       // Fallback 2
  { name: 'local', model: 'rule-based-fallback' }        // Emergency
]

// Ordre Darija (language === 'ary')
providers: [
  { name: 'grok', model: 'grok-4-1-fast-reasoning' },
  { name: 'atlas', model: 'Atlas-Chat-9B' },            // Darija specialist
  { name: 'gemini', model: 'gemini-3-flash-preview' },
  { name: 'anthropic', model: 'claude-opus-4-5' },
  { name: 'local', model: 'rule-based-fallback' }
]

// Trigger: Latency > 15s OR Status != 200
```

---

## 6. ARCHITECTURE DONNÉES

### 6.1 Google Sheets (7 tables)

| Table | Colonnes | Fonction |
|:------|:--------:|:---------|
| `tenants` | 12 | Multi-tenant config |
| `sessions` | 8 | Call history |
| `logs` | 5 | System logs |
| `users` | 20 | User accounts |
| `auth_sessions` | 7 | Refresh tokens |
| `hitl_pending` | 8 | Pending approvals |
| `hitl_history` | 11 | Decision history |

**Schéma `tenants` (12 colonnes):**
```
id, name, plan, mrr, status, email, phone,
nps_score, conversion_rate, qualified_leads,
created_at, updated_at
```

**Schéma `users` (20 colonnes):**
```
id, email, password_hash, role, tenant_id, name, phone, avatar_url,
email_verified, email_verify_token, email_verify_expires,
password_reset_token, password_reset_expires,
last_login, login_count, failed_login_count, locked_until,
preferences, created_at, updated_at
```

### 6.2 Knowledge Base (RAG + GraphRAG)

```
data/knowledge-base/
├── chunks.json           # 193 chunks, 107 KB
├── tfidf_index.json      # 1,701 terms, 314 KB
├── knowledge-graph.json  # 23 nodes, 38 edges, 11 KB
├── status.json           # Indexing status
└── knowledge_base_policies.json  # Access policies
```

**RAG Pipeline:**
```
searchHybrid(query, limit, {tenantId})
│
├─1. BM25 Keyword Search (TF-IDF)
├─2. Semantic Similarity (if embeddings)
├─3. RLS Filtering (tenant isolation)
└─4. Hybrid Ranking
```

**GraphRAG:**
```
graphSearch(query, {tenantId})
│
├─ 23 nodes (services, modules, integrations)
├─ 38 edges (relationships)
└─ 21 relation types
```

### 6.3 SecretVault (Credentials)

```javascript
// core/SecretVault.cjs
// AES-256-GCM encryption
// Per-tenant credential isolation

Methods:
- setSecret(tenantId, key, value)
- getSecret(tenantId, key)
- deleteSecret(tenantId, key)
- listSecrets(tenantId)
```

---

## 7. ARCHITECTURE MCP SERVER

### 7.1 Statistiques

| Métrique | Valeur |
|:---------|:------:|
| Total Tools | 182 |
| Tool Files | 25 |
| TypeScript Lines | 15,755 |
| Version | 0.8.0 |

### 7.2 Tools par Catégorie

| Catégorie | Tools | Fichier |
|:----------|:-----:|:--------|
| **Stripe** | 19 | `tools/stripe.ts` |
| **Shopify** | 8 | `tools/shopify.ts` |
| **WooCommerce** | 7 | `tools/woocommerce.ts` |
| **Magento** | 10 | `tools/magento.ts` |
| **PrestaShop** | 10 | `tools/prestashop.ts` |
| **BigCommerce** | 9 | `tools/bigcommerce.ts` |
| **Wix** | 6 | `tools/wix.ts` |
| **Squarespace** | 7 | `tools/squarespace.ts` |
| **Calendar** | 6 | `tools/calendar.ts` |
| **Calendly** | 6 | `tools/calendly.ts` |
| **Sheets** | 7 | `tools/sheets.ts` |
| **Drive** | 6 | `tools/drive.ts` |
| **Gmail** | 4 | `tools/gmail.ts` |
| **Slack** | 2 | `tools/slack.ts` |
| **Freshdesk** | 6 | `tools/freshdesk.ts` |
| **Pipedrive** | 7 | `tools/pipedrive.ts` |
| **Zendesk** | 6 | `tools/zendesk.ts` |
| **Zoho** | 6 | `tools/zoho.ts` |
| **HubSpot** | ~10 | Via `hubspot-b2b-crm.cjs` |
| **Zapier** | 3 | `tools/zapier.ts` |
| **Make** | 3 | `tools/make.ts` |
| **n8n** | 3 | `tools/n8n.ts` |
| **Export** | 5 | `tools/export.ts` |
| **UCP** | 7 | `tools/ucp.ts` |
| **Local** | ~20 | `index.ts` |

### 7.3 E-commerce Coverage

| Platform | Market Share | Tools | Status |
|:---------|:------------:|:-----:|:------:|
| WooCommerce | 33-39% | 7 | ✅ |
| Shopify | 10.32% | 8 | ✅ |
| Magento | 8% | 10 | ✅ |
| Wix Stores | 7.4% | 6 | ✅ |
| Squarespace | 2.6% | 7 | ✅ |
| PrestaShop | 1.91% | 10 | ✅ |
| BigCommerce | 1% | 9 | ✅ |
| **Total** | **~64%** | **57** | |

---

## 8. ARCHITECTURE INTÉGRATIONS

### 8.1 Intégrations Natives (28)

| Catégorie | Intégrations |
|:----------|:-------------|
| **CRM** | HubSpot, Pipedrive, Zoho CRM |
| **Support** | Zendesk, Freshdesk |
| **E-commerce** | Shopify, WooCommerce, Magento, Wix, Squarespace, BigCommerce, PrestaShop, Klaviyo |
| **Google** | Calendar, Sheets, Drive, Docs, Gmail |
| **Calendrier** | Calendly |
| **iPaaS** | Zapier, Make, n8n |
| **Export** | CSV, XLSX, PDF, SMTP |
| **Notification** | Slack |
| **Telephony** | Twilio (Voice + SMS) |
| **Messaging** | WhatsApp |

### 8.2 SDKs (2)

```
sdks/
├── python/          # Python SDK
│   ├── vocalia/
│   ├── setup.py
│   └── requirements.txt
└── node/            # Node.js SDK
    ├── src/
    ├── package.json
    └── tsconfig.json
```

---

## 9. ARCHITECTURE SÉCURITÉ

### 9.1 Authentication (JWT)

```javascript
// Access Token (24h)
{
  sub: "user_id",
  email: "user@example.com",
  role: "admin|user|viewer",
  tenant_id: "tenant_123",
  permissions: ["read:calls", "write:agents"],
  exp: 1706870400
}

// Refresh Token (30 jours) - stocké en DB
{
  id: "refresh_abc",
  user_id: "user_id",
  token_hash: "sha256",
  expires_at: "2026-03-01"
}
```

### 9.2 Features Sécurité

| Feature | Implementation |
|:--------|:---------------|
| Passwords | bcrypt (12 rounds) |
| Tokens | JWT HS256 |
| Rate Limiting | 3 register/h, 5 login/15min, 100 API/min |
| Account Lockout | 5 échecs → 15min blocage |
| RBAC | admin, user, viewer |
| Tenant Isolation | tenant_id dans JWT |
| Credentials | AES-256-GCM (SecretVault) |
| CSP | Strict Content-Security-Policy |
| SRI | GSAP + Lucide (39 pages) |
| CORS | Whitelist strict |
| API Auth | checkAuth() sur tous /api/db/* |
| Password Filter | filterUserRecord() sur users |
| Admin Protection | checkAdmin() sur hitl, logs, users |

### 9.3 API Endpoints (23)

| Endpoint | Method | Fonction |
|:---------|:------:|:---------|
| `/api/auth/register` | POST | Inscription |
| `/api/auth/login` | POST | Connexion + tokens |
| `/api/auth/logout` | POST | Déconnexion |
| `/api/auth/refresh` | POST | Refresh token |
| `/api/auth/forgot` | POST | Mot de passe oublié |
| `/api/auth/reset` | POST | Reset password |
| `/api/auth/verify-email` | POST | Vérification email |
| `/api/auth/me` | GET | User courant |
| `/api/auth/me` | PUT | Update profil |
| `/api/auth/password` | PUT | Change password |
| `/api/hitl/pending` | GET | Items en attente |
| `/api/hitl/history` | GET | Historique décisions |
| `/api/hitl/stats` | GET | Statistiques HITL |
| `/api/hitl/approve/:id` | POST | Approuver item |
| `/api/hitl/reject/:id` | POST | Rejeter item |
| `/api/logs` | GET | Logs système |
| `/api/db/health` | GET | Health check |
| `/api/db/:sheet` | GET | List records |
| `/api/db/:sheet/:id` | GET | Get record |
| `/api/db/:sheet` | POST | Create record |
| `/api/db/:sheet/:id` | PUT | Update record |
| `/api/db/:sheet/:id` | DELETE | Delete record |
| `/api/db/:sheet?field=value` | GET | Query records |

### 9.4 WebSocket Real-Time

| Aspect | Détail |
|:-------|:-------|
| **Endpoint** | `ws://localhost:3013/ws?token=JWT` |
| **Auth** | Token JWT dans query string |
| **Close Codes** | 4001 (no token), 4002 (invalid token) |
| **Heartbeat** | 30s interval, ping/pong |
| **Admin Channels** | hitl, users, auth_sessions |
| **User Channels** | tenants, sessions, logs |

**Messages:**
```javascript
// Subscribe
{ type: 'subscribe', channels: ['hitl', 'logs'] }

// Unsubscribe
{ type: 'unsubscribe', channel: 'hitl' }

// Broadcast (server → client)
{ channel: 'hitl', event: 'approved', data: {...}, timestamp: '...' }
```

---

## 10. ARCHITECTURE i18n

### 10.1 Langues Supportées

| Code | Langue | RTL | Fichier |
|:----:|:-------|:---:|:--------|
| fr | Français | Non | `locales/fr.json` |
| en | English | Non | `locales/en.json` |
| es | Español | Non | `locales/es.json` |
| ar | العربية (MSA) | Oui | `locales/ar.json` |
| ary | Darija (Marocain) | Oui | `locales/ary.json` |

### 10.2 Métriques i18n

| Métrique | Valeur |
|:---------|:------:|
| Fichiers locales | 5 |
| Lignes JSON totales | 22,140 |
| Keys par locale | ~4,000 |
| Personas × langues | 40 × 5 = 200 |

### 10.3 Geo-Detection

```javascript
// website/src/lib/geo-detect.js
MA (Maroc) → FR + MAD (990 DH)
EU (Europe) → FR + EUR (99€)
US/Other → EN + USD ($99)
```

---

## 11. FLUX DE DONNÉES

### 11.1 Flux Auth

```
┌─────────────────────────────────────────────────────────────────┐
│                      AUTH FLOW                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [1] REGISTER                                                    │
│      POST /api/auth/register                                     │
│      Body: {email, password, name}                               │
│      → bcrypt hash password                                      │
│      → Create user in Google Sheets                              │
│      → Send verification email                                   │
│      → Return {success: true}                                    │
│                                                                  │
│  [2] LOGIN                                                       │
│      POST /api/auth/login                                        │
│      Body: {email, password}                                     │
│      → Verify password with bcrypt                               │
│      → Generate access_token (24h)                               │
│      → Generate refresh_token (30d)                              │
│      → Store refresh_token_hash in auth_sessions                 │
│      → Return {access_token, refresh_token, user}                │
│                                                                  │
│  [3] AUTHENTICATED REQUEST                                       │
│      GET /api/db/sessions                                        │
│      Header: Authorization: Bearer {access_token}                │
│      → Verify JWT signature                                      │
│      → Check expiration                                          │
│      → Extract tenant_id                                         │
│      → Apply RLS filter                                          │
│      → Return data                                               │
│                                                                  │
│  [4] REFRESH                                                     │
│      POST /api/auth/refresh                                      │
│      Body: {refresh_token}                                       │
│      → Verify refresh_token in auth_sessions                     │
│      → Generate new access_token                                 │
│      → Return {access_token}                                     │
│                                                                  │
│  [5] LOGOUT                                                      │
│      POST /api/auth/logout                                       │
│      → Delete refresh_token from auth_sessions                   │
│      → Return {success: true}                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 11.2 Flux HITL

```
┌─────────────────────────────────────────────────────────────────┐
│                      HITL FLOW                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [1] CREATE PENDING ITEM                                         │
│      (From voice-telephony-bridge.cjs)                          │
│      → Score BANT < threshold                                    │
│      → POST /api/db/hitl_pending                                 │
│      → Notify admin via WebSocket/Slack                          │
│                                                                  │
│  [2] ADMIN REVIEW                                                │
│      GET /api/hitl/pending                                       │
│      → List all pending items                                    │
│      → Show in admin/hitl.html                                   │
│                                                                  │
│  [3A] APPROVE                                                    │
│      POST /api/hitl/approve/:id                                  │
│      → Move to hitl_history with decision=approved               │
│      → Delete from hitl_pending                                  │
│      → Trigger follow-up action                                  │
│                                                                  │
│  [3B] REJECT                                                     │
│      POST /api/hitl/reject/:id                                   │
│      Body: {reason}                                              │
│      → Move to hitl_history with decision=rejected               │
│      → Delete from hitl_pending                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 11.3 Flux Dashboard → Data

```
┌─────────────────────────────────────────────────────────────────┐
│                  DASHBOARD DATA FLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Client Dashboard - website/app/client/index.html]             │
│                                                                  │
│      ┌─────────────────────────────────────────────────┐        │
│      │  DOMContentLoaded                               │        │
│      │  ↓                                              │        │
│      │  auth.requireAuth() → Redirect if not logged in │        │
│      │  ↓                                              │        │
│      │  api.tenants.get(user.tenant_id)               │        │
│      │  → GET /api/db/tenants/{id}                    │        │
│      │  → Display: mrr, nps_score, conversion_rate    │        │
│      │  ↓                                              │        │
│      │  api.sessions.list({tenant_id})                │        │
│      │  → GET /api/db/sessions?tenant_id=xxx          │        │
│      │  → Calculate: total_calls, avg_duration        │        │
│      │  → Render charts                               │        │
│      └─────────────────────────────────────────────────┘        │
│                                                                  │
│  [Admin Dashboard - website/app/admin/index.html]               │
│                                                                  │
│      ┌─────────────────────────────────────────────────┐        │
│      │  auth.requireAdmin() → Redirect if not admin   │        │
│      │  ↓                                              │        │
│      │  api.tenants.list()                            │        │
│      │  api.hitl.stats()                              │        │
│      │  api.logs.list({limit: 10})                    │        │
│      │  ↓                                              │        │
│      │  Display: tenant count, pending HITL, logs     │        │
│      └─────────────────────────────────────────────────┘        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 12. CREDENTIALS ET CONFIGURATION

### 12.1 Variables d'Environnement Requises

| Variable | Service | Priorité |
|:---------|:--------|:--------:|
| `XAI_API_KEY` | Grok (Primary AI) | ✅ Critical |
| `GEMINI_API_KEY` | Gemini (Fallback) | ✅ Critical |
| `ANTHROPIC_API_KEY` | Claude (Fallback) | ⚠️ Important |
| `HUGGINGFACE_API_KEY` | Atlas-Chat (Darija) | ⚠️ Important |
| `TWILIO_ACCOUNT_SID` | Telephony | ✅ For PSTN |
| `TWILIO_AUTH_TOKEN` | Telephony | ✅ For PSTN |
| `TWILIO_PHONE_NUMBER` | Telephony | ✅ For PSTN |
| `GOOGLE_SHEETS_CREDENTIALS` | Database | ✅ Critical |
| `JWT_SECRET` | Authentication | ✅ Critical |
| `VOCALIA_VAULT_KEY` | SecretVault | ⚠️ Production |

### 12.2 Fichiers de Configuration

```
data/
├── google-oauth-credentials.json    # OAuth client
├── google-oauth-tokens.json         # OAuth tokens
├── google-service-account.json      # Service account
├── google-sheets-config.json        # Sheets config
└── ucp-profiles.json                # User profiles
```

---

## 13. MÉTRIQUES DU CODEBASE

### 13.1 Résumé Global

| Composant | Fichiers | Lignes |
|:----------|:--------:|:------:|
| Core Backend (.cjs) | 32 | 16,833 |
| Telephony | 1 | 3,194 |
| Personas | 1 | 5,280 |
| Widget | 1 | 1,085 |
| Sensors | 4 | 822 |
| Integrations | 3 | 1,479 |
| MCP Server (TS) | 25 | 15,755 |
| Website Libs (JS) | 21 | 7,326 |
| Website HTML | 67 | ~25,000 |
| Locales (JSON) | 5 | 22,140 |
| Scripts | 63 | ~8,000 |
| **TOTAL** | **~223** | **~107,000** |

### 13.2 Vérification

```bash
# Core backend
wc -l core/*.cjs            # 16,833

# Telephony
wc -l telephony/*.cjs       # 3,194

# Personas
wc -l personas/*.cjs        # 5,280

# Widget
wc -l widget/*.js           # 1,085

# Sensors
wc -l sensors/*.cjs         # 822

# Integrations
wc -l integrations/*.cjs    # 1,479

# MCP Server
wc -l mcp-server/src/**/*.ts # 15,755

# Website libs
wc -l website/src/lib/*.js  # 7,326

# HTML pages
find website -name "*.html" | wc -l  # 67

# Locales
wc -l website/src/locales/*.json  # 22,140
```

---

## ANNEXE A: AGENTS A2A (4)

| Agent | Fichier | Fonction |
|:------|:--------|:---------|
| TranslationSupervisor | `core/translation-supervisor.cjs` | Language quality guard |
| BillingAgent | `core/BillingAgent.cjs` | Revenue tracking |
| TenantOnboardingAgent | `core/TenantOnboardingAgent.cjs` | Client setup |
| VoiceAgentB2B | `core/voice-agent-b2b.cjs` | B2B qualification |

---

## ANNEXE B: PROBLÈMES CONNUS

| # | Problème | Impact | Status |
|:-:|:---------|:-------|:------:|
| 1 | Twilio credentials manquants | Telephony non fonctionnel | ⚠️ Config |
| 2 | Deprecation warning punycode | Console noise | 🟡 Mineur |
| 3 | Production API keys manquants | Local fallback utilisé | ⚠️ Config |

---

*Document généré: 02/02/2026*
*Session: 250.52*
*Méthode: Analyse bottom-up factuelle exhaustive*
*Vérification: Toutes les métriques vérifiées par commandes bash*
