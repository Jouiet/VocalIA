# AUDIT FORENSIQUE — Implémentation des Agents VocalIA chez les Clients Multi-Tenants

> **Document de référence** | Audit bottom-up basé sur lecture exhaustive du code source
> **Date** : 25/02/2026 | **Session** : 250.239
> **Méthode** : Lecture directe de chaque fichier, grep systématique, vérification empirique
> **Scope** : Widget embed, Téléphonie, API, Onboarding, Billing, Multi-tenant, Compliance

---

## TABLE DES MATIÈRES

1. [Inventaire Factuel — Ce Qui EXISTE](#1-inventaire-factuel--ce-qui-existe)
2. [Audit Canal par Canal](#2-audit-canal-par-canal)
3. [Audit Multi-Tenant](#3-audit-multi-tenant)
4. [Audit Dashboard Client](#4-audit-dashboard-client)
5. [Audit Billing/Revenue](#5-audit-billingrevenue)
6. [Audit Compliance](#6-audit-compliance)
7. [Gap Analysis Complète](#7-gap-analysis-complète)
8. [Benchmark Concurrentiel Vérifié](#8-benchmark-concurrentiel-vérifié)
9. [Plan d'Action — TOUTES les étapes jusqu'à 100% DONE](#9-plan-daction--toutes-les-étapes-jusquà-100-done)
10. [Commandes de Vérification](#10-commandes-de-vérification)

---

## 1. INVENTAIRE FACTUEL — CE QUI EXISTE

### 1.1 Fichiers Widget (7 fichiers, ~11k lignes)

| Fichier | Lignes | Fonction | Vérifié |
|:--------|:------:|:---------|:--------|
| `widget/voice-widget-v3.js` | ~2000 | Widget unifié ECOM (text+voice, 5 langs, Shadow DOM, product carousel) | `wc -l` |
| `widget/voice-widget-b2b.js` | ~1500 | Widget B2B (lead qualification, booking, exit intent, no cart) | `wc -l` |
| `widget/voice-quiz.js` | ~800 | Quiz conversationnel intégré au widget | `wc -l` |
| `widget/recommendation-carousel.js` | ~600 | Carrousel de recommandations produit | `wc -l` |
| `widget/abandoned-cart-recovery.js` | ~500 | Récupération panier abandonné (voice popup) | `wc -l` |
| `widget/spin-wheel.js` | ~400 | Gamification roue de la fortune | `wc -l` |
| `widget/free-shipping-bar.js` | ~300 | Barre de livraison gratuite dynamique | `wc -l` |

### 1.2 Services Backend impliqués dans l'implémentation client

| Service | Port | Fichier | Rôle pour le client | État |
|:--------|:----:|:--------|:-------------------|:-----|
| **Voice API** | 3004 | `core/voice-api-resilient.cjs` (3,944 l.) | `/respond` (chat IA), `/config` (widget config), `/social-proof` | ✅ Déployé 250.241 |
| **Grok Realtime** | 3007 | `core/grok-voice-realtime.cjs` (1,109 l.) | WebSocket audio streaming, tenant origin validation | ✅ Déployé |
| **Telephony Bridge** | 3009 | `telephony/voice-telephony-bridge.cjs` (5,503 l.) | Twilio PSTN ↔ Grok WS, 25 function tools, outbound calls | ✅ Déployé 250.241 |
| **DB API** | 3013 | `core/db-api.cjs` (5,346 l.) | REST API tenants, catalog, auth, WebSocket, GDPR, billing, KB | ✅ Déployé 250.241 |
| **OAuth Gateway** | 3010 | `core/OAuthGateway.cjs` | SSO Google + GitHub + Slack | ✅ Déployé |
| **Webhook Router** | 3011 | `core/WebhookRouter.cjs` | Inbound webhooks (HubSpot, Shopify, Stripe, Klaviyo) | ✅ Déployé |

### 1.3 Package NPM

| Fichier | État | Vérification |
|:--------|:-----|:------------|
| `distribution/npm/vocalia-widget/package.json` | ✅ Existe | `name: "vocalia-widget"`, version 1.0.0 |
| `distribution/npm/vocalia-widget/index.js` | ✅ Existe | Exports: `initVocalia()`, `initVocaliaB2B()`, `initVocaliaEcommerce()` |
| `distribution/npm/vocalia-widget/index.d.ts` | ✅ Existe | TypeScript declarations |
| `distribution/npm/vocalia-widget/README.md` | ✅ Existe | Doc complète: CDN, npm, config, events, programmatic control |
| **Publié sur npmjs.com** | ✅ LIVE | `npm info vocalia-widget` → v1.0.0, maintainer: jouiet, 38.4 kB |

### 1.4 Client Registry

| Champ | État | Détail |
|:------|:-----|:-------|
| Nombre de tenants | **22** | `Object.keys(registry.clients).length` |
| Nombre de sectors | **19** | DENTAL, TRAVEL_AGENT, RENTER, NOTARY, REAL_ESTATE_AGENT, etc. |
| Champs par tenant | 8-15 | `name, sector, currency, language, knowledge_base_id, payment_method, phone, api_key, allowed_origins` |
| API keys | ✅ | Format `vk_` + 48 chars hex, unique par tenant |
| `allowed_origins` | ✅ | Array de domaines autorisés, présent sur chaque tenant |
| `knowledge_base_id` | ✅ | ID unique KB par tenant, routé vers RAG |

**FAIT CRITIQUE** : Les 22 tenants ont **TOUS** `"allowed_origins": ["https://vocalia.ma"]` comme seule origine externe. **AUCUN tenant n'a son propre domaine configuré** (ex: `"https://cabinet-lumiere.fr"`). Cela signifie que le widget ne peut fonctionner que sur vocalia.ma — **PAS sur les sites des clients.**

---

## 2. AUDIT CANAL PAR CANAL

### 2.1 Canal Widget Web — Embed JavaScript

#### Flux technique vérifié (lecture du code)

```
Site client → <script src="https://api.vocalia.ma/voice-assistant/voice-widget-v3.js">
                   ↓
              IIFE auto-exécutée
                   ↓
              detectLanguage() → URL param > HTML lang > browser > default 'fr'
                   ↓
              loadTenantConfig() → GET /config?tenantId=xxx
                   ↓
              Voice API fetch → POST /respond { message, history, sessionId, language }
                   ↓
              Réponse texte affichée dans le chat
                   ↓ (si voice activé)
              Web Speech API → speechSynthesis.speak(utterance)
```

#### Ce qui FONCTIONNE (vérifié dans le code)

| Feature | Fichier:Ligne | État |
|:--------|:-------------|:-----|
| Shadow DOM isolation | `voice-widget-v3.js:381` | ✅ `host.attachShadow({ mode: 'open' })` |
| RTL auto-detect | `voice-widget-v3.js:370-374` | ✅ Position auto selon `L.meta.rtl` |
| 5 langues supportées | `voice-widget-v3.js:25` | ✅ `['fr', 'en', 'es', 'ar', 'ary']` |
| Auto-detect langue navigateur | `voice-widget-v3.js:271-295` | ✅ Mapping browser → supported |
| Tenant config dynamique | `voice-widget-v3.js:224-261` | ✅ Fetch `/config?tenantId=xxx` |
| Branding dynamique (couleur) | `voice-widget-v3.js:236-240` | ✅ Override `primaryColor` depuis config |
| Position configurable | `voice-widget-v3.js:242-244` | ✅ `bottom-right` / `bottom-left` |
| Plan-based feature gating | `voice-widget-v3.js:247-249` | ✅ `state.planFeatures` from `/config` |
| Currency per-tenant | `voice-widget-v3.js:251-253` | ✅ `state.currency` from `/config` |
| E-commerce product cards | `voice-widget-v3.js:1041` | ✅ Catalog API integration |
| Conversation persistence | `voice-widget-v3.js:117-138` | ✅ sessionStorage, 30min TTL, 50 messages |
| GA4 event tracking | `voice-widget-v3.js:327-343` | ✅ `gtag()` + `dataLayer.push()` |
| Marketing attribution | `voice-widget-v3.js:348-358` | ✅ UTM, gclid, fbclid, referrer |
| Exit-intent popup | `voice-widget-v3.js:51-57` | ✅ Configurable sensitivity/cooldown |
| Social proof/FOMO | `voice-widget-v3.js:60-69` | ✅ Fetch from `/social-proof` API |
| XSS protection | `voice-widget-v3.js:102-110` | ✅ `escapeHTML()`, `escapeAttr()` |
| Programmatic control | NPM README, `window.VocalIA.*` | ✅ `open()`, `close()`, `toggle()`, `setPersona()`, `sendContext()` |
| Event hooks | NPM README | ✅ `vocalia:ready`, `vocalia:message`, `vocalia:qualify`, `vocalia:error` |
| Data attributes | NPM README | ✅ `data-vocalia-action`, `data-vocalia-persona` |
| CSS Variables override | NPM README | ✅ `--vocalia-primary`, `--vocalia-font`, `--vocalia-z-index` |

#### Ce qui est ABSENT ou CASSÉ

| Gap | Sévérité | Preuve |
|:----|:---------|:-------|
| **Widget ne charge que le text AI** (pas le voice streaming) | 🔴 CRITIQUE | `voice-widget-v3.js` fait uniquement `POST /respond` (texte). Le streaming audio WebSocket vers `port 3007` n'est PAS intégré dans le widget. Le "voice" utilise **Web Speech API navigateur** (synthèse locale), PAS Grok/ElevenLabs. |
| **`VOCALIA_CONFIG` est lu mais FILTRÉ** | 🟡 CORRIGÉ | Le widget lit `window.VOCALIA_CONFIG` (ligne 3657) mais via `safeConfigMerge()` qui ne laisse passer que des clés UI (EXIT_INTENT, SOCIAL_PROOF, widgetPosition). `tenantId`, `apiKey`, `primaryColor` du NPM index.js sont **IGNORÉS** par le filtre de sécurité (H8 fix). Le NPM `index.js` set `tenantId` dans `VOCALIA_CONFIG` mais le widget le bloque car `tenantId` n'est PAS dans `SAFE_CONFIG_KEYS`. |
| **tenantId detection fonctionne** mais via chemins spécifiques | 🟡 INFO | `voice-widget-v3.js:3696-3709` : detecte via (1) `CONFIG.tenantId` (non mergeable via VOCALIA_CONFIG), (2) `data-vocalia-tenant` script attr, (3) `data-tenant-id` script attr, (4) URL param, (5) meta tag. **Le NPM index.js devrait utiliser `data-vocalia-tenant` sur le script tag, pas `window.VOCALIA_CONFIG`.** |
| **NPM package non publié** | 🟠 HAUTE | Le package existe localement mais `npm publish` n'a jamais été confirmé. `npm info vocalia-widget` non vérifié. |
| **Fallback text-only si pas SpeechRecognition** | 🟡 INFO | `voice-widget-v3.js:208` : Firefox et Safari → `needsTextFallback = true`. Pas un bug, mais limite l'expérience "voice" aux navigateurs Chromium. |

### 2.2 Canal Téléphonie PSTN (Twilio)

#### Flux technique vérifié

```
Appelant PSTN → Twilio → HTTP Webhook POST → voice-telephony-bridge.cjs:3009
                                                    ↓
                                            TwiML <Connect><Stream>
                                                    ↓
                                            WebSocket bidirectionnel
                                                    ↓
                                            Grok Realtime API (wss://api.x.ai/v1/realtime)
                                                    ↓
                                            Audio PCM16 24kHz base64 ↔ bridge ↔ Twilio Stream
```

#### Ce qui FONCTIONNE

| Feature | Ligne | État |
|:--------|:------|:-----|
| Inbound calls (webhook) | `voice-telephony-bridge.cjs:11` | ✅ `Twilio Inbound Call → HTTP Webhook → Grok WebSocket Session → Audio Bridge` |
| Outbound calls API | `voice-telephony-bridge.cjs:4207-4233` | ✅ `POST /voice/outbound` + TwiML generation |
| 25 Function tools | `voice-telephony-bridge.cjs` | ✅ booking, billing, CRM, escalation, etc. |
| Multi-AI fallback | `core/grok-voice-realtime.cjs:6-7` | ✅ Grok Realtime → Gemini Flash TTS fallback |
| Persona injection | `voice-telephony-bridge.cjs:48` | ✅ `VoicePersonaInjector` import |
| Tenant validation | `core/grok-voice-realtime.cjs:58-60` | ✅ `validateWebSocketOrigin(origin, tenantId)` |
| ElevenLabs TTS (Darija) | `voice-telephony-bridge.cjs:59` | ✅ For Arabic/Darija voices |
| Cart recovery calls | `voice-telephony-bridge.cjs:3948-3980` | ✅ Automated outbound for abandoned carts |
| UCP interaction tracking | `voice-telephony-bridge.cjs:4627` | ✅ `ucpStore.recordInteraction()` |

#### Ce qui est ABSENT

| Gap | Sévérité | Preuve |
|:----|:---------|:-------|
| **Pas de call recording** | 🔴 CRITIQUE | `grep -i "record\|recording\|consent" telephony/` → **0 matches**. Aucun enregistrement d'appel, aucune gestion de consentement. |
| **Pas de transcription sauvegardée** | 🟠 HAUTE | Les transcripts sont dans la session mémoire mais ne sont pas persistés en DB après l'appel. |
| **Pas de webhooks OUTBOUND** (événements → client) | 🟠 HAUTE | Le bridge ne pousse AUCUN événement vers une URL client. Les events restent internes (`ContextBox.logEvent`). |
| **Pas de DTMF handling** | 🟡 MOYENNE | Aucune gestion des tonalités DTMF dans le bridge. |
| **Pas de call transfer SIP REFER** | 🟡 MOYENNE | L'escalation existe en function tool mais pas via SIP REFER natif. |
| **Security key check basique** | 🟡 INFO | `voice-telephony-bridge.cjs:280` : warn si `VOCALIA_INTERNAL_KEY` non set, mais `/voice/outbound` reste accessible. |

### 2.3 Canal API REST

#### Endpoints disponibles (vérifié dans voice-api-resilient.cjs)

| Endpoint | Method | Auth | Fonction |
|:---------|:-------|:-----|:---------|
| `/respond` | POST | CORS (origin) | Chat IA multi-provider |
| `/config` | GET/POST | CORS | Widget config per-tenant |
| `/social-proof` | GET | CORS | Messages FOMO |
| `/health` | GET | None | Health check |

#### Ce qui MANQUE pour une API client complète

| Gap | Sévérité |
|:----|:---------|
| **Pas d'endpoint `/api/v1/agents` CRUD** | 🟠 — Les clients ne peuvent pas créer/modifier leurs agents via API |
| **Pas d'endpoint `/api/v1/calls` (list, detail, transcript)** | 🟠 — Pas d'accès programmatique aux données d'appels |
| **Pas de documentation OpenAPI/Swagger** | 🟡 — `website/docs/api.html` existe mais non vérifié si auto-généré |
| **Pas de SDK clients (npm/pip)** | 🟡 — Le package npm existe mais ne couvre que le widget, pas l'API |

---

## 3. AUDIT MULTI-TENANT

### 3.1 Isolation — Ce qui EXISTE

| Mécanisme | Implémentation | Fichier | État |
|:----------|:--------------|:--------|:-----|
| API key per tenant | `vk_` + 48 hex chars | `client_registry.json` | ✅ |
| Origin validation (CORS) | `isOriginAllowed()`, timing-safe compare | `core/tenant-cors.cjs:32-60` | ✅ |
| WebSocket origin validation | `validateWebSocketOrigin(origin, tenantId)` | `core/grok-voice-realtime.cjs:58` | ✅ |
| Knowledge Base ID isolation | `knowledge_base_id` per tenant | `client_registry.json` | ✅ |
| Plan-based feature gating | 5 plans × 23 features | `voice-api-resilient.cjs:416-452` | ✅ |
| Tenant config per-client folder | `clients/{tenantId}/config.json` | `voice-api-resilient.cjs:2482` | ✅ |
| TenantId sanitization | `sanitizeTenantId()` | `voice-api-resilient.cjs:2468` | ✅ (path traversal prevention) |
| Currency per-tenant | `client.currency` | `voice-api-resilient.cjs:2506` | ✅ |

### 3.2 Isolation — Ce qui MANQUE

| Gap | Sévérité | Détail |
|:----|:---------|:-------|
| **Registry = fichier JSON statique** | 🔴 CRITIQUE | `client_registry.json` est lu depuis le filesystem. Pas de CRUD API pour ajouter/modifier des tenants. L'onboarding nécessite un commit git + redéploiement. |
| **Tous les `allowed_origins` pointent vers vocalia.ma** | 🔴 CRITIQUE | Sur les 22 tenants, seul `ecom_nike_01` a un domaine externe (`nike-reseller-paris.com`). Les 21 autres ne fonctionnent QUE sur `vocalia.ma`. **Les widgets ne peuvent PAS être déployés sur les vrais sites clients.** |
| **Pas de tenant provisioning API** | 🔴 CRITIQUE | Pas d'endpoint pour créer un tenant, générer une API key, configurer les origins. Tout est manuel. |
| **Pas de rotation d'API key** | 🟠 HAUTE | Les API keys sont statiques dans le JSON. Pas de mécanisme de régénération. |
| **Pas d'isolation des conversations** | 🟡 MOYENNE | Les conversations sont dans `sessionStorage` côté client (ephémère) et dans les sessions serveur (mémoire). Pas de stockage per-tenant persistant. |
| **Pas de quota/rate limiting per-tenant** | 🟡 MOYENNE | Le `RateLimiter` existe globalement mais pas segmenté par tenant. |

### 3.3 PLAN_FEATURES (5 plans × 23 features)

```
Vérifié dans voice-api-resilient.cjs:416-452

starter:      voice_widget ✅ | voice_telephony ❌ | booking ❌ | crm_sync ❌ | webhooks ❌ | custom_branding ❌
pro:          voice_widget ✅ | voice_telephony ❌ | booking ✅ | crm_sync ✅ | webhooks ✅ | custom_branding ✅
ecommerce:    voice_widget ✅ | voice_telephony ❌ | booking ✅ | crm_sync ✅ | webhooks ✅ | ecom_cart_recovery ✅
expert_clone: voice_widget ✅ | voice_telephony ❌ | booking ✅ | crm_sync ✅ | voice_cloning ✅ | expert_dashboard ✅
telephony:    voice_widget ✅ | voice_telephony ✅ | booking ✅ | ALL features ✅
```

**FAIT** : `voice_telephony` est `false` sur TOUS les plans sauf `telephony` (199€/mois). Le feature gating est implémenté côté backend (`checkFeature()`) et transmis au widget via `/config`.

---

## 4. AUDIT DASHBOARD CLIENT

### 4.1 Pages existantes (13 fichiers dans `website/app/client/`)

| Page | Fichier | Fonction | Backend connecté |
|:-----|:--------|:---------|:----------------|
| **Accueil** | `index.html` | Dashboard principal | `/api/tenants/{id}/stats` |
| **Onboarding** | `onboarding.html` | Setup 4 étapes (Welcome → Business Info → Agent Config → Complete) | `/api/tenants/{id}/onboard` |
| **Install Widget** | `install-widget.html` | Snippet embed, domaines autorisés, personnalisation, preview live | `/api/tenants/{id}/widget-config` |
| **Analytics** | `analytics.html` | Métriques conversations | `/api/tenants/{id}/stats` |
| **Billing** | `billing.html` | Facturation Stripe | StripeService |
| **Telephony** | `telephony.html` | Dashboard téléphonie IA (stats, chart, live calls) | `/api/tenants/{id}/calls` |
| **Calls** | `calls.html` | Historique appels | `/api/tenants/{id}/calls` |
| **Catalog** | `catalog.html` | Gestion catalogue produits | `/api/tenants/{id}/catalog` |
| **Knowledge Base** | `knowledge-base.html` | Gestion KB | `/api/tenants/{id}/knowledge-base` |
| **Agents** | `agents.html` | Gestion agents/personas | `/api/tenants/{id}/agents` |
| **Integrations** | `integrations.html` | Connexions CRM, webhooks | `/api/tenants/{id}/integrations` |
| **Settings** | `settings.html` | Paramètres compte | `/api/tenants/{id}/settings` |
| **Expert Dashboard** | `expert-dashboard.html` | Dashboard Expert Clone | `/api/tenants/{id}/expert` |

### 4.2 Analyse de l'onboarding (4 étapes — vérifié dans le HTML)

| Étape | Contenu | Backend requis | État backend |
|:------|:--------|:--------------|:-------------|
| **1. Welcome** | Présentation features (Widget, Téléphonie, 40 Personas) | Aucun | ✅ |
| **2. Business Info** | Company name, Industry (6 options), Team size | `POST /api/tenants/{id}/onboard` | ⚠️ Non vérifié si endpoint existe |
| **3. Agent Config** | Persona selection (4 cartes: Agency, E-commerce, Santé, Immobilier), Voice language (5 langs) | `POST /api/tenants/{id}/agents` | ⚠️ Non vérifié |
| **4. Complete** | Quick install snippet + boutons vers dashboard/install-widget | Génération snippet | ✅ Frontend only |

### 4.3 Analyse de install-widget (vérifié en détail)

| Feature | État | Détail |
|:--------|:-----|:-------|
| **Snippet per-platform** | ✅ | Tabs: HTML, Shopify, WordPress, React/Next.js, Wix |
| **Copy to clipboard** | ✅ | Bouton copy avec feedback |
| **Domaines autorisés** | ✅ UI | CRUD UI complet (add/remove, max 10). Backend: `GET/PUT /tenants/{id}/widget-config` |
| **Personnalisation couleur** | ✅ | Color picker + hex input + live preview |
| **Position configurable** | ✅ | Select bottom-right / bottom-left |
| **Mode E-commerce toggle** | ✅ | Switch on/off |
| **Preview live** | ✅ | Simulated browser avec FAB widget |
| **Checklist vérification** | ✅ | 4 étapes: copié, collé, déployé, visible |
| **Save config to backend** | ✅ | `api.put(/tenants/${tenantId}/widget-config, ...)` |

**VERDICT install-widget** : Le frontend est **remarquablement complet**. C'est l'une des pages les plus abouties du dashboard. Le gap est côté backend : les endpoints `/tenants/{id}/widget-config` et `/tenants/{id}/domains` doivent être vérifiés dans `db-api.cjs`.

---

## 5. AUDIT BILLING/REVENUE

### 5.1 Stack Billing existante

| Composant | Fichier | Lignes | Fonction |
|:----------|:--------|:------:|:---------|
| `StripeService.cjs` | `core/StripeService.cjs` | ~100 | Layer service: get/create customer, list invoices, create checkout |
| `stripe-global-gateway.cjs` | `core/gateways/stripe-global-gateway.cjs` | ~200 | Gateway HTTP brut vers Stripe API |
| `BillingAgent.cjs` | `core/BillingAgent.cjs` | ~400 | Autonomous billing agent (A2A protocol, state machine) |
| `payzone-global-gateway.cjs` | `core/gateways/payzone-global-gateway.cjs` | ~150 | Gateway Payzone (MAD) |
| `billing.html` | `website/app/client/billing.html` | ~200 | Frontend facturation client |

### 5.2 Ce qui EXISTE dans le billing

| Feature | Preuve | État |
|:--------|:-------|:-----|
| Stripe Customer creation | `StripeService.cjs:20-51` | ✅ Code complet |
| Invoice listing | `StripeService.cjs:56-66` | ✅ Code complet |
| Checkout Session creation | `StripeService.cjs:71-80` | ✅ Code complet |
| Idempotency keys | `BillingAgent.cjs:9` | ✅ Mentionné |
| Webhook signature verification | `BillingAgent.cjs:10` | ✅ Mentionné |
| Currency routing MAD→Payzone, EUR/USD→Stripe | `BillingAgent.cjs:64-68` | ✅ Mentionné |
| EventBus integration | `BillingAgent.cjs:13` | ✅ Event-driven billing |

### 5.3 Ce qui MANQUE (CRITIQUE pour le revenue)

| Gap | Sévérité | Détail |
|:----|:---------|:-------|
| **`STRIPE_SECRET_KEY` non set sur le VPS** | 🔴 BLOQUANT | Documenté dans MEMORY.md : "Missing: STRIPE_SECRET_KEY". AUCUNE opération Stripe ne fonctionne en production. |
| **Pas de usage-based billing (per-minute metering)** | 🔴 CRITIQUE | Aucun code de metering trouvé. `grep "usage.*billing\|meter\|track.*minute" core/*.cjs` → 0 résultats pertinents. Les appels ne sont PAS facturés à la minute. |
| **Pas de credit grant model** | 🔴 CRITIQUE | Pas de système de crédits gratuits → auto-billing. Pattern Retell ($1M→$10M ARR) non implémenté. |
| **Pas de usage dashboard per-tenant** | 🟠 HAUTE | Le client ne voit pas sa consommation en temps réel. |
| **Pas de Stripe Billing Meters** | 🟠 HAUTE | Stripe supporte les meters nativement. Non utilisé. |
| **Pas de payment capture at signup** | 🟠 HAUTE | L'onboarding ne demande pas de carte bancaire. |

---

## 6. AUDIT COMPLIANCE

### 6.1 Ce qui EXISTE

| Aspect | État | Preuve |
|:-------|:-----|:-------|
| CSP sur toutes les pages | ✅ | `Content-Security-Policy` header dans chaque HTML |
| HSTS sur tous les services | ✅ | Traefik config |
| SRI sur les CDN | ✅ | `integrity` attributes (78/78 vérifié) |
| CORS restrictif | ✅ | `tenant-cors.cjs` avec origin validation |
| Rate limiting | ✅ | `RateLimiter` from `security-utils.cjs` |
| Input sanitization | ✅ | `sanitizeTenantId()`, `sanitizeInput()`, `escapeHTML()` |
| API key timing-safe compare | ✅ | `crypto.timingSafeEqual()` dans `tenant-cors.cjs` |
| JWT admin auth | ✅ | `voice-api-resilient.cjs:63-84` |

### 6.2 Ce qui MANQUE

| Gap | Sévérité | Détail |
|:----|:---------|:-------|
| **AUCUN enregistrement d'appels** | 🔴 | `grep -i "record" telephony/` → 0 matches. Pas de Twilio `<Record>` TwiML. |
| **AUCUNE gestion de consentement** | 🔴 | Pas de "Cet appel est enregistré..." avant les conversations. |
| **Pas de droit d'effacement** | 🔴 | GDPR Article 17 : droit à l'oubli. Pas d'endpoint DELETE pour les données d'un tenant/utilisateur. |
| **Pas de DPA (Data Processing Agreement)** | 🟠 | Requis pour les clients EU. Document juridique absent. |
| **Pas de BAA (Business Associate Agreement)** | 🟡 | Requis uniquement si clients HIPAA (healthcare). Pas de marché US immédiat. |
| **Pas d'audit trail formalisé** | 🟡 | Les logs existent mais pas de journal d'audit immutable pour compliance. |

---

## 7. GAP ANALYSIS COMPLÈTE

### Légende : 🔴 Bloquant | 🟠 Haute priorité | 🟡 Moyenne | 🟢 Basse

### 7.1 Gaps Bloquants (Revenue = 0 tant que non résolu)

| # | Gap | Fichier(s) impacté(s) | Effort estimé |
|:--|:----|:---------------------|:-------------|
| G1 | **STRIPE_SECRET_KEY non configuré en production** | `.env` VPS | 30 min (config) |
| G2 | ~~**Widget utilise Web Speech API, PAS voice streaming réel**~~ **FIXED 250.240** — Cloud voice streaming via Grok Realtime WebSocket (`cloudVoice` module). PCM16 audio capture → base64 → WS. Plan-gated (`cloud_voice` feature, Pro+). Web Speech API fallback for Starter plan. | `widget/voice-widget-v3.js` | ~~2-3 jours~~ DONE |
| G3 | ~~**NPM `index.js` ↔ Widget disconnect**~~ **FIXED 250.239** — NPM now uses `data-vocalia-tenant` attr + maps safe config keys | `distribution/npm/vocalia-widget/index.js` | ~~0.5 jour~~ DONE |
| G4 | **`allowed_origins` = vocalia.ma sur 21/22 tenants** — By design (test tenants). Provisioned tenants get custom origins via API. | `personas/client_registry.json` | Design decision |
| G5 | ~~**Pas de tenant provisioning API**~~ **EXISTED** — `provisionTenant()` (db-api L109), `POST /api/auth/register`, `GET/PUT /api/tenants/:id/allowed-origins`. CORS sync **FIXED 250.239** — `tenant-cors.cjs` now reads both `client_registry.json` AND `clients/*/config.json`. | `core/tenant-cors.cjs`, `core/db-api.cjs` | ~~3-5 jours~~ DONE |
| G6 | ~~**Pas de domain management API**~~ **EXISTED** — `GET/PUT /api/tenants/:id/allowed-origins` (db-api L1555-1641). Max 10 origins, URL validation. **CORS sync FIXED 250.239**. | `core/db-api.cjs` | ~~2-3 jours~~ DONE |
| G7 | ~~**Pas de usage-based billing (metering)**~~ **FIXED 250.239** — `StripeGlobalGateway`: `reportMeterEvent()`, `createMeter()`, `listMeters()`, `getMeterEventSummary()`. `StripeService`: `reportVoiceMinutes()`, `reportApiCalls()`, `getUsageSummary()`, `initializeMeters()`. Telephony bridge wired to report voice minutes post-call. Requires STRIPE_SECRET_KEY on VPS to activate. | ~~3-5 jours~~ DONE (code) |

### 7.2 Gaps Haute Priorité (Fonctionnalité client dégradée)

| # | Gap | Effort estimé |
|:--|:----|:-------------|
| G8 | ~~Pas de webhooks OUTBOUND~~ **FIXED 250.239** — `core/webhook-dispatcher.cjs` (HMAC-SHA256, 3x retry, 8 event types). Wired to EventBus (`lead.qualified`, `call.completed`). API: `GET/PUT /api/tenants/:id/webhooks`. Plan-gated (Pro+). | ~~2-3 jours~~ DONE |
| G9 | ~~Pas de call recording + consent~~ **FIXED 250.239** — TwiML `recordingConsent` message in 5 langs. Per-tenant `features.call_recording` toggle. Consent announced before stream connect. | ~~2-3 jours~~ DONE |
| G10 | ~~Pas de transcription persistée~~ **ALREADY EXISTED** — `conversationStore.save()` in voice-api (L2791-2796) + telephony (L623). Files: `clients/{tenantId}/conversations/{sessionId}.json`. | ~~1-2 jours~~ EXISTED |
| G11 | ~~Pas de API key rotation~~ **FIXED 250.239** — `provisionTenant()` now generates `vk_` + 48 hex. New endpoints: `POST /api/tenants/:id/api-key/rotate`, `GET /api/tenants/:id/api-key`. Audit logged. | ~~1 jour~~ DONE |
| G12 | ~~Pas de credit grant model (crédits gratuits → auto-billing)~~ **FIXED 250.240** — `StripeService`: `grantTrialCredits()` (plan-based credit amounts), `getTrialStatus()`, `createTrialSubscription()`. 14-day trial, auto-credit on registration. `GET /api/tenants/:id/trial` endpoint. | ~~2-3 jours~~ DONE |
| G13 | ~~Pas de rate limiting per-tenant~~ **FIXED 250.239** — Per-tenant RateLimiter in voice-api `/respond`. Plan-based limits: starter=20/min, pro/ecom=60/min, expert/telephony=120/min. | ~~1 jour~~ DONE |
| G14 | NPM package probablement non publié | 30 min |

### 7.3 Gaps Moyenne Priorité

| # | Gap | Effort estimé |
|:--|:----|:-------------|
| G15 | ~~Pas de DTMF handling~~ **PARTIALLY EXISTS** — `<Gather numDigits="1">` in cart recovery outbound calls (L3984). Not needed for AI voice calls (direct speech streaming). | N/A (by design) |
| G16 | Pas de call transfer SIP REFER | 2 jours |
| G17 | Pas de documentation OpenAPI/Swagger auto-générée | 2 jours |
| G18 | ~~Pas de GDPR right-to-erasure~~ **FIXED 250.239** — `DELETE /api/tenants/:id/data` with explicit confirmation, erases conversations/KB/UCP, redacts PII in config, audit logged. | ~~1 jour~~ DONE |
| G19 | ~~Pas d'audit trail immutable~~ **ALREADY EXISTED** — `audit-store.cjs`: append-only JSONL, SHA-256 hash chaining, `verifyIntegrity()`, per-tenant dirs, monthly archives. | ~~2 jours~~ EXISTED |
| G20 | ~~Pas de usage dashboard API~~ **FIXED 250.239** — `GET /api/tenants/:id/usage` returns plan, quotas (calls/sessions/kb with %, used, limit), conversation count, features list, widget config. Combined with existing `/widget/interactions` and `/ucp/profiles` endpoints. | ~~2-3 jours~~ DONE |

### 7.4 Gaps Basse Priorité

| # | Gap | Effort estimé |
|:--|:----|:-------------|
| G21 | Pas de SIP bridge Asterisk/FreeSWITCH natif | 5+ jours |
| G22 | Pas de Zapier/Make app listing | 3+ jours |
| G23 | Pas de SDK Python (pip) | 3 jours |
| G24 | Pas de DPA/BAA documents juridiques | Externe |

---

## 8. BENCHMARK CONCURRENTIEL VÉRIFIÉ

### Sources : Vellum 2026 Guide, WhiteSpace 2026, Monetizely, Twilio, Stripe/Retell case study

| Critère | Retell AI | Vapi | Bland AI | **VocalIA** |
|:--------|:---------|:-----|:---------|:-----------|
| **Latence** | ~600ms | ~700ms | ~800ms | **~50ms bridge** + cloud voice streaming (Pro+), Web Speech fallback (Starter) |
| **Prix/min** | $0.07 affiché ($0.13-0.31 réel) | $0.05+ ($0.13-0.31 réel) | $0.09 ($0.09-0.15 réel) | **0.24€/min** (telephony plan) |
| **Widget embed** | Script tag 1 ligne | Script tag 1 ligne | API-first | **Script tag + config** ✅ |
| **SIP trunking** | ✅ Elastic SIP + Dial URI | ✅ BYOC Twilio/Telnyx | ✅ SIP/Twilio | ✅ **Twilio bridge** |
| **Outbound calls** | ✅ API + batch | ✅ API | ✅ API + batch | ✅ `/voice/outbound` |
| **Call recording** | ✅ Natif | ✅ Natif | ✅ Natif | ✅ **Twilio `<Record>` dual-channel** + consent 5 langs + recording callback (G9 + Step 4.3) |
| **Usage billing** | ✅ Stripe Meters multi-dim | ✅ | Non public | ✅ **Stripe Meters** (G7 code done, needs STRIPE_KEY) |
| **Webhook events** | ✅ call events → client URL | ✅ 11 event types | ✅ | ✅ **8 events + HMAC** (G8 fixed) |
| **Self-service signup** | ✅ Minutes/credit card | ✅ | ✅ | ✅ **Auto-provision** (POST /api/auth/register) |
| **Tenant provisioning** | ✅ API | ✅ API | ✅ API | ✅ **API + auto-key** (G5/G11 fixed) |
| **HIPAA** | ✅ | ✅ | ❌ | ❌ |
| **SOC 2** | ✅ Type II | ✅ | ❌ | ❌ |
| **Multi-language** | ❌ Limited | ✅ | ❌ Limited | ✅ **5 langs + RTL** (avantage) |
| **Personas spécialisés** | ❌ | ❌ | ❌ | ✅ **40 × 5 langs** (avantage unique) |
| **RAG Knowledge Base** | ✅ Basic | ✅ Basic | ❌ | ✅ **Hybrid RAG + Graph** (avantage) |
| **BANT Lead Scoring** | ❌ | ❌ | ❌ | ✅ **Intégré** (avantage unique) |

### Avantages compétitifs VocalIA (vérifiés, uniques)

1. **40 personas × 5 langues** = 200 prompts spécialisés (aucun concurrent ne fait ça)
2. **Darija (dialecte marocain)** = unique sur le marché
3. **BANT lead qualification** intégré dans le widget (Retell/Vapi/Bland n'ont pas ça)
4. **Hybrid RAG (vector + graph)** vs simple RAG
5. **RTL natif** (arabe, darija) avec auto-detection

---

## 9. PLAN D'ACTION — TOUTES LES ÉTAPES JUSQU'À 100% DONE

### PHASE 0 : DÉBLOQUAGE IMMÉDIAT (Jour 1-2)

| Step | Action | Gap | Fichier(s) | Done? |
|:-----|:-------|:----|:----------|:------|
| 0.1 | **Configurer `STRIPE_SECRET_KEY` sur le VPS** — `.env` exists, key placeholder ready, docker-compose wired | G1 | `/docker/vocalia/.env` VPS | ☐ NEEDS KEY VALUE |
| 0.2 | **Configurer `STRIPE_WEBHOOK_SECRET`** — added to `.env` + `docker-compose.yml` on VPS | G1 | `/docker/vocalia/.env` VPS | ☐ NEEDS KEY VALUE |
| 0.3 | **Créer les Products + Prices dans Stripe Dashboard** (Starter 49€, Pro 99€, E-commerce 99€, Expert Clone 149€, Telephony 199€) | G1 | Stripe Dashboard | ☐ |
| 0.4 | **NPM `vocalia-widget@1.0.0` publié** — `npm info vocalia-widget` ✅, ESM exports, 3 functions | G14 | `distribution/npm/vocalia-widget/` | ✅ 250.240 |
| 0.5 | **Tester billing.html → StripeService → Stripe live** | G1 | `website/app/client/billing.html`, `core/StripeService.cjs` | ☐ |

### PHASE 1 : WIDGET REAL VOICE + NPM FIX (Jour 3-7)

| Step | Action | Gap | Fichier(s) | Done? |
|:-----|:-------|:----|:----------|:------|
| 1.1 | **Fix NPM `index.js`** — `data-vocalia-tenant` attribute + safe config mapping | G3 | `distribution/npm/vocalia-widget/index.js` | ✅ 250.239 |
| 1.2 | **Optionnel : Ajouter `tenantId` et `primaryColor` à `SAFE_CONFIG_KEYS`** — Not needed (tenantId via data attr) | G3 | `widget/voice-widget-v3.js:3632` | N/A |
| 1.3 | **Test NPM complet** — `npm install vocalia-widget` + ESM import → 3 exports OK (initVocalia, initVocaliaB2B, initVocaliaEcommerce) | G3 | E2E test | ✅ 250.240 |
| 1.4 | **WebSocket audio streaming** dans le widget — `cloudVoice` module (connect to `wss://api.vocalia.ma/realtime`, PCM16 mic capture, plan-gated). URL fix 250.261: was `:3007` (port blocked), now `/realtime` (Traefik path route) | G2 | `widget/voice-widget-v3.js` | ✅ 250.261 |
| 1.5 | **Embed domaine externe** — CORS dual-source (registry + dynamic config.json), tenant detection (4 methods: config/data-attr/URL/meta), NPM ESM import verified | G4 | Widget + CORS | ✅ By design + 250.240 NPM test |

### PHASE 2 : TENANT PROVISIONING DYNAMIQUE (Jour 8-14)

| Step | Action | Gap | Fichier(s) | Done? |
|:-----|:-------|:----|:----------|:------|
| 2.1 | **Tenant provisioning API** — `provisionTenant()` (L109) + `POST /api/auth/register` + auto api_key gen | G5 | `core/db-api.cjs` | ✅ EXISTED + 250.239 |
| 2.2 | **Origins CRUD API** — `GET/PUT /api/tenants/:id/allowed-origins` + dual-source CORS | G6 | `core/db-api.cjs`, `core/tenant-cors.cjs` | ✅ EXISTED + 250.239 |
| 2.3 | **Registry migration** — Not needed. `client_registry.json` = static seed. Dynamic via `clients/{id}/config.json` + `tenant-cors.cjs` dual-source. | G5 | N/A | ✅ By design |
| 2.4 | **API key rotation** — `POST /api/tenants/:id/api-key/rotate` + `GET /api/tenants/:id/api-key` | G11 | `core/db-api.cjs` | ✅ 250.239 |
| 2.5 | **Connecter onboarding.html → backend** — `api.put('/tenants/${tid}/widget-config')` for dual persistence | G5 | `website/app/client/onboarding.html` | ✅ 250.239 |
| 2.6 | **Connecter install-widget.html → backend** — `saveOrigins()` → `api.put('/tenants/${tid}/allowed-origins')` | G6 | `website/app/client/install-widget.html` | ✅ 250.239 |

### PHASE 3 : USAGE-BASED BILLING (Jour 15-22)

| Step | Action | Gap | Fichier(s) | Done? |
|:-----|:-------|:----|:----------|:------|
| 3.1 | **Stripe Meter methods** — `createMeter()`, `reportMeterEvent()`, `getMeterEventSummary()`, `listMeters()` in gateway | G7 | `core/gateways/stripe-global-gateway.cjs` | ✅ 250.239 |
| 3.2 | **Telephony metering** — `reportVoiceMinutes()` called after each call completion | G7 | `telephony/voice-telephony-bridge.cjs` | ✅ 250.239 |
| 3.3 | **StripeService metering** — `reportVoiceMinutes()`, `reportApiCalls()`, `getUsageSummary()`, `initializeMeters()` | G7 | `core/StripeService.cjs` | ✅ 250.239 |
| 3.4 | **Credit grant model** — 14-day trial with plan-based credits (49-199€), auto-billing after exhausted. `grantTrialCredits()`, `getTrialStatus()`, `createTrialSubscription()`. Wired to registration. | G12 | `core/StripeService.cjs`, `core/db-api.cjs` | ✅ 250.240 |
| 3.5 | **Usage dashboard API** — `GET /api/tenants/:id/usage` + `GET /api/tenants/:id/calls` | G20 | `core/db-api.cjs` | ✅ 250.239 |
| 3.6 | **Rate limiting per-tenant** — Plan-based: starter=20, pro/ecom=60, expert/telephony=120 req/min | G13 | `core/voice-api-resilient.cjs` | ✅ 250.239 |

### PHASE 4 : WEBHOOKS OUTBOUND + CALL MANAGEMENT (Jour 23-30)

| Step | Action | Gap | Fichier(s) | Done? |
|:-----|:-------|:----|:----------|:------|
| 4.1 | **Webhook outbound system** — `core/webhook-dispatcher.cjs` + EventBus subscriptions + API CRUD | G8 | `core/webhook-dispatcher.cjs`, `core/db-api.cjs` | ✅ 250.239 |
| 4.2 | **Call recording consent** — TwiML `recordingConsent` 5 langs + per-tenant toggle | G9 | `telephony/voice-telephony-bridge.cjs` | ✅ 250.239 |
| 4.3 | **Twilio call recording** — `<Record>` in TwiML (dual-channel, trim-silence, 1h max), `recordingStatusCallback` saves URL/SID/duration to conversation JSON. | G9 | `telephony/voice-telephony-bridge.cjs` | ✅ 250.240 |
| 4.4 | **Transcription persistence** — Already existed: `conversationStore.save()` in both voice-api + telephony | G10 | Already done | ✅ EXISTED |
| 4.5 | **Calls list API** — `GET /api/tenants/:id/calls` with pagination, reads conversation JSON files | G10 | `core/db-api.cjs` | ✅ 250.239 |
| 4.6 | **DTMF handling** — Partially exists in cart recovery `<Gather>`. Not needed for AI voice calls. | G15 | N/A | ✅ By design |

### PHASE 5 : COMPLIANCE + DOCUMENTATION (Jour 31-38)

| Step | Action | Gap | Fichier(s) | Done? |
|:-----|:-------|:----|:----------|:------|
| 5.1 | **GDPR right-to-erasure** — `DELETE /api/tenants/:id/data` with explicit confirmation | G18 | `core/db-api.cjs` | ✅ 250.239 |
| 5.2 | **Audit trail** — Already existed: `audit-store.cjs` append-only JSONL + SHA-256 hash chain | G19 | `core/audit-store.cjs` | ✅ EXISTED |
| 5.3 | **Documentation OpenAPI** — 79 endpoints documented, auto-extracted via `scripts/extract-api-routes.cjs`, REST API section in sidebar (7 domains) | G17 | `website/docs/api.html` | ✅ 250.240 |
| 5.4 | **DPA template** — GDPR-compliant, 10 sections, sub-processors table, retention periods, erasure API ref | G24 | `docs/legal/DPA.md` | ✅ 250.240 |
| 5.5 | **Privacy Policy** — recording consent 5 langs, retention periods, GDPR erasure API reference | G18 | `website/privacy.html` | ✅ 250.240 |

### PHASE 6 : SCALE (Jour 39+)

| Step | Action | Gap | Effort |
|:-----|:-------|:----|:-------|
| 6.1 | Call transfer SIP REFER | G16 | 2 jours |
| 6.2 | SIP bridge Asterisk/FreeSWITCH (AudioSocket) | G21 | 5+ jours |
| 6.3 | Zapier app (actions: create call, get transcript, lead webhook) | G22 | 3+ jours |
| 6.4 | SDK Python (pip) pour l'API | G23 | 3 jours |
| 6.5 | SOC 2 Type II preparation | — | Externe |

---

## 10. COMMANDES DE VÉRIFICATION

Chaque gap peut être vérifié empiriquement :

```bash
# G1: Stripe key missing
ssh vps "grep STRIPE_SECRET_KEY .env"                          # Expected: set

# G2: Widget uses Web Speech API, not real voice streaming
grep -c "speechSynthesis\|SpeechRecognition" widget/voice-widget-v3.js  # Shows browser API usage
grep -c "wss://\|WebSocket" widget/voice-widget-v3.js                    # Should be >0 for real voice

# G3: NPM disconnected
grep "VOCALIA_CONFIG" widget/voice-widget-v3.js                          # Expected: >0 matches

# G4: All origins = vocalia.ma
node -e "const r=require('./personas/client_registry.json'); const c=r.clients; let ext=0; for(const[k,v]of Object.entries(c)){for(const o of v.allowed_origins||[]){if(!o.includes('vocalia.ma'))ext++}}; console.log('External origins:',ext)"
# Expected: should be >1 for real client deployment

# G5: No tenant provisioning API
grep -c "POST.*tenants.*create\|registerTenant" core/db-api.cjs          # Expected: >0

# G7: No usage metering
grep -i "meterEvent\|billing\.meter\|usage.*report" core/*.cjs           # Expected: >0

# G8: No outbound webhooks
grep -c "webhook.*dispatch\|webhook.*outbound\|notifyClient" telephony/*.cjs core/*.cjs  # Expected: >0

# G9: No call recording
grep -ic "Record\|recording\|consent" telephony/voice-telephony-bridge.cjs  # Expected: >0
```

---

## RÉSUMÉ EXÉCUTIF

### Score d'implémentation client : 45/100 → 78/100 → 88/100 → 93/100 (code) | 8/100 (production externe) (Session 250.242b)

| Dimension | Score 250.239 | Score 250.240 | Justification |
|:----------|:----------:|:----------:|:-------------|
| **Widget embed** (code exists) | 8/10 | 9/10 | Shadow DOM, 5 langs, RTL, e-commerce, preview, install page + **cloud voice streaming** (G2) |
| **Widget embed** (fonctionnel chez client) | 4/10 | 7/10 | NPM + CORS FIXED. **Cloud voice WS** for Pro+ plans, Web Speech fallback for Starter. |
| **Téléphonie** (code exists) | 8/10 | 9/10 | Inbound+outbound, 25 tools, multi-AI, persona injection + **Twilio `<Record>`** (Step 4.3) |
| **Téléphonie** (fonctionnel chez client) | 6/10 | 8/10 | Consent FIXED, webhook events FIXED, transcripts EXISTED. **Recording callback + metadata persist**. |
| **Multi-tenant isolation** | 9/10 | 9/10 | CORS dual-source, API key gen, rotation, per-tenant rate limits |
| **Dashboard client** | 8/10 | 9/10 | 13 pages + usage API + calls list + **trial banner** in billing.html + PLAN_FEATURES 23-feature sync |
| **Billing/Revenue** | 5/10 | 8/10 | Stripe Meters + **14-day trial credits** (G12) + `getTrialStatus()` + registration auto-credit. Needs STRIPE_KEY on VPS. |
| **Compliance** | 7/10 | 9/10 | GDPR erasure, audit trail, consent notice, webhook HMAC, **dual-channel recording**, **privacy policy** updated (retention + recording), **OpenAPI docs** 79 endpoints |

### Gaps résolus Session 250.239 + 250.240

| Gap | Statut |
|:----|:-------|
| G2 (Cloud voice streaming) | **FIXED 250.240** — `cloudVoice` module in widget, WS to Grok Realtime, PCM16 audio, plan-gated |
| G3 (NPM disconnect) | **FIXED 250.239** — `data-vocalia-tenant` attr + safe config mapping |
| G5/G6 (Provisioning + CORS) | **EXISTED** + **FIXED 250.239** — dual-source tenant-cors.cjs |
| G7 (Usage-based billing) | **FIXED 250.239** — Stripe Meters infra + telephony wiring |
| G8 (Outbound webhooks) | **FIXED 250.239** — `webhook-dispatcher.cjs` + EventBus + API |
| G9 (Call recording consent) | **FIXED 250.239** — TwiML consent 5 langs + per-tenant toggle |
| G9+ (Twilio `<Record>`) | **FIXED 250.240** — dual-channel recording + callback + metadata persist |
| G10 (Transcription persist) | **ALREADY EXISTED** |
| G11 (API key rotation) | **FIXED 250.239** — generation + GET/POST rotate + audit |
| G12 (Credit grant model) | **FIXED 250.240** — 14-day trial, plan-based credits, `grantTrialCredits()` + `getTrialStatus()` |
| G13 (Per-tenant rate limiting) | **FIXED 250.239** — plan-based limits (20-120 req/min) |
| G18 (GDPR erasure) | **FIXED 250.239** — `DELETE /api/tenants/:id/data` |
| G19 (Audit trail) | **ALREADY EXISTED** — hash-chain JSONL |
| G17 (OpenAPI docs) | **FIXED 250.240** — 79 endpoints documented, `scripts/extract-api-routes.cjs`, REST API sidebar |
| G18+ (Privacy policy) | **FIXED 250.240** — Recording consent, retention periods, GDPR API reference |
| G14 (NPM publish) | **FIXED 250.240** — `vocalia-widget@1.0.0` published, ESM, 3 exports, TypeScript types |
| G20 (Usage dashboard API) | **FIXED 250.239** — `GET /api/tenants/:id/usage` |
| G24 (DPA template) | **FIXED 250.240** — `docs/legal/DPA.md` GDPR-compliant, 10 sections, sub-processors table |

### Gaps restants

| Gap | Statut | Effort |
|:----|:-------|:-------|
| G1 (Stripe key) | VPS config needed | 30 min |
| G14 (NPM publish) | **FIXED 250.240** — `vocalia-widget@1.0.0` live on npmjs.com | Done |
| G16 (SIP REFER) | Low priority | 2 jours |
| G17 (OpenAPI docs) | **FIXED 250.240** — 79 endpoints, `scripts/extract-api-routes.cjs` | Done |
| G21-G23 | Future | 10+ jours |
| G24 (DPA template) | **FIXED 250.240** — `docs/legal/DPA.md` 10 sections, sub-processors, GDPR-compliant | Done |

### La vérité — mise à jour (Session 250.242b — audit satellite)

> **ATTENTION** : Cette section corrige des claims antérieures qui étaient factuellement incorrectes ou non vérifiées en production. La Session 250.241 affirmait "système SOTA pleinement opérationnel" — l'audit satellite 250.242 a révélé que cette affirmation était prématurée.

**VPS** — Code déployé, mais 3 endpoints critiques CASSÉS (vérifiés le 26/02/2026) :

#### Ce qui FONCTIONNE en production (vérifié par curl) :

| Composant | Preuve | Statut |
|:----------|:-------|:-------|
| `/respond` (API IA) | Réponse Grok 4.1 Fast Reasoning, latence 3.5-6.4s | ✅ |
| `/config` (config tenant) | Retourne config complète (branding, features, plan) | ✅ |
| `/social-proof` | Endpoint fonctionne mais `{"messages":[]}` (données vides) | ⚠️ |
| Widget B2B sur vocalia.ma | Charge (200, 88964 bytes), communique avec API | ✅ |
| Widget Ecom monolith sur vocalia.ma | Charge (200) | ✅ |
| Login endpoint | `{"error":"Invalid email or password"}` (répond correctement) | ✅ |
| Routes tenant (webhooks, usage, rotation) | `{"error":"Authorization required"}` (routes existent, auth fonctionne) | ✅ |
| GDPR erasure route | `{"error":"Authorization required"}` | ✅ |
| NPM `vocalia-widget@1.0.0` | `npm info vocalia-widget` → v1.0.0 | ✅ |

#### Ce qui NE FONCTIONNE PAS en production (vérifié par curl) :

| Composant | Preuve | Impact |
|:----------|:-------|:-------|
| **Register** (`POST /api/auth/register`) | **500 "Internal server error"** (avec email frais) | **AUCUN signup possible** |
| **Health** (`/health`, `/api/health`) | **404** | Monitoring externe impossible |
| **WebSocket** (`/realtime/`) | **404** | Cloud voice streaming inaccessible |
| Widget depuis domaine externe | **403 "Origin not allowed"** | Widget inutilisable hors vocalia.ma |
| Widget ecom sub-bundles | **403** (6/8 fichiers bloqués par .htaccess) | Code-split ecom inutilisable |
| Snippet onboarding | URL `api.vocalia.ma` (404) + fichier `v3.js` (inexistant) | Installation widget impossible |

#### Fonctionnalités "FIXED" en code mais NON VÉRIFIÉES en production :

Les items suivants ont du code ajouté (sessions 250.239-250.240) et les routes existent (pas 404), mais leur LOGIQUE n'a pas été testée end-to-end en production car ils nécessitent un JWT valide (impossible sans register fonctionnel) ou des services externes (Stripe, Twilio) :

- Cloud voice streaming (G2) — code existe, mais WebSocket `/realtime` retourne 404
- Webhook dispatcher (G8) — route existe, dispatch non testé
- Call recording (G9) — code existe, non testable sans Twilio
- API key rotation (G11) — route existe, logique non testée
- Credit grant (G12) — code existe, non testable sans Stripe
- GDPR erasure (G18) — route existe, logique non testée
- Per-tenant rate limiting (G13) — code existe, non testé empiriquement
- Usage dashboard (G20) — route existe, données non vérifiées

**En résumé** : le CODE est complet (93/100), mais la PRODUCTION FONCTIONNELLE pour un client externe est à ~8/100.

### Vérification VPS (250.241) — Delta avant/après déploiement

| Fichier | Avant | Après | Delta |
|:--------|:-----:|:-----:|:-----:|
| db-api.cjs | 3,610 | 5,346 | +1,736 |
| StripeService.cjs | 83 (stub) | 349 | +266 |
| webhook-dispatcher.cjs | ABSENT | 163 | NEW |
| voice-api-resilient.cjs | 3,883 | 3,944 | +61 |
| telephony-bridge.cjs | 4,843 | 5,503 | +660 |
| voice-widget-v3.js | 3,737 | 4,021 | +284 |

### Blocages restants (Session 250.242 — Audit Satellite)

#### A. Stripe Configuration (action utilisateur — INCHANGÉ)

1. `STRIPE_SECRET_KEY` → vide dans `/docker/vocalia/.env`
2. `STRIPE_WEBHOOK_SECRET` → vide dans `/docker/vocalia/.env`
3. 5 `price_PLACEHOLDER_*` → nécessite création Products/Prices dans Stripe Dashboard

#### B. Widget Embed — Blocages découverts 250.242 (empêchent TOUT déploiement externe)

| # | Blocage | Sévérité | Cause racine | Fichier(s) |
|:--|:--------|:---------|:-------------|:-----------|
| S1 | **Snippet URL pointe vers `api.vocalia.ma` → 404** | 🔴 CRITIQUE | `API_BASE = 'https://api.vocalia.ma'` (L255). Traefik proxy vers Node.js, pas de fichiers statiques. | `website/app/client/install-widget.html:255`, `website/app/client/onboarding.html:382` |
| S2 | **Snippet référence `voice-widget-v3.js` — n'existe pas comme bundle** | 🔴 CRITIQUE | Build produit `voice-widget-b2b.js`, `voice-widget-ecommerce-core.js`, etc. `voice-widget-v3.js` = source, pas livrable. | `scripts/build-widgets.cjs` BUNDLES config |
| S3 | **.htaccess bloque 6/8 sous-bundles e-commerce (403)** | 🔴 CRITIQUE | Whitelist `.htaccess:100` : seulement `voice-widget\|voice-widget-b2b\|voice-widget-ecommerce`. Manquent `-core`, `-cart`, `-quiz`, `-spin`, `-shipping`, `-carousel`. | `website/.htaccess:100` |
| S4 | **CORS sur vocalia.ma bloque les fichiers lang depuis domaines externes** | 🟠 HAUTE | Pas de `Access-Control-Allow-Origin` sur Hostinger LiteSpeed pour `.json`. Widget fait `fetch(vocalia.ma/voice-assistant/lang/voice-fr.json)` → CORS error. | `website/.htaccess` (pas de header CORS) |
| S5 | **CORS sur api.vocalia.ma bloque les appels API depuis domaines satellites** | 🟠 HAUTE | `tenant-cors.cjs:108-116` : seules les origines dans `allowed_origins` passent. 22/22 tenants statiques = `["https://vocalia.ma"]`. Les tenants dynamiques doivent enregistrer explicitement leurs origines. | `core/tenant-cors.cjs`, `personas/client_registry.json` |
| S6 | **CSP stricte sur CinematicAds bloque script + fetch** | 🟠 HAUTE (spécifique) | `script-src` et `connect-src` n'incluent ni `vocalia.ma` ni `api.vocalia.ma`. | CSP header `cinematicads.studio` |

#### C. Serveur — Blocages découverts 250.242b (vérification empirique post-satellite)

| # | Blocage | Sévérité | Preuve curl | Fichier(s) |
|:--|:--------|:---------|:------------|:-----------|
| S7 | **Register retourne 500** | 🔴 BLOQUANT | `curl -s -X POST api.vocalia.ma/api/auth/register -d '{email,password,company}'` → `{"error":"Internal server error"}` | `core/db-api.cjs:424` (pas de try-catch autour `authService.register()`) |
| S8 | **/health retourne 404 depuis l'extérieur** | 🟠 HAUTE | `curl -sI api.vocalia.ma/health` → 404. `/api/health` pas dans PathPrefix Traefik du db-api. | `docker-compose.production.yml:99` |
| S9 | **/realtime WebSocket retourne 404** | 🟠 HAUTE | `curl -sI api.vocalia.ma/realtime/ -H "Upgrade: websocket"` → 404 | Container `vocalia-realtime` ou routing Traefik |
| S10 | **Social proof = données vides** | 🟡 BASSE | `curl -s api.vocalia.ma/social-proof?lang=fr` → `{"messages":[]}` | Aucune donnée social proof configurée |

**Preuve empirique (26/02/2026) :**

```bash
# S1: Widget URL 404 sur api.vocalia.ma
curl -sI "https://api.vocalia.ma/voice-assistant/voice-widget-v3.js" | head -1
# → HTTP/2 404

# S2: Fichier v3 absent du build
ls website/voice-assistant/*.js | grep -v '.min.js'
# → 8 bundles, AUCUN voice-widget-v3.js

# S3: Sous-bundles bloqués
curl -sI "https://vocalia.ma/voice-assistant/voice-widget-ecommerce-core.js" | head -1
# → HTTP/2 403

# S4: Pas de CORS pour fichiers lang
curl -sI -H "Origin: https://3a-automation.com" \
  "https://vocalia.ma/voice-assistant/lang/voice-fr.json" | grep -i access-control
# → (rien)

# S5: CORS = rejet actif 403 (PAS juste un header manquant)
curl -s -X POST "https://api.vocalia.ma/respond" \
  -H "Origin: https://hendersonshop.com" -H "Content-Type: application/json" \
  -d '{"message":"test","tenantId":"agency_internal","language":"fr"}'
# → {"error":"Origin not allowed"}

# S7: Register cassé
curl -s -X POST "https://api.vocalia.ma/api/auth/register" \
  -H "Content-Type: application/json" -H "Origin: https://vocalia.ma" \
  -d '{"email":"test-'$(date +%s)'@proton.me","password":"Test2026!!","company":"Test"}'
# → {"error":"Internal server error"}  (HTTP 500)

# S8: Health inaccessible
curl -sI "https://api.vocalia.ma/health" | head -1
# → HTTP/2 404

# S9: WebSocket inaccessible
curl -sI "https://api.vocalia.ma/realtime/" | head -1
# → HTTP/2 404

# S10: Social proof vide
curl -s "https://api.vocalia.ma/social-proof?lang=fr" -H "Origin: https://vocalia.ma"
# → {"success":true,"messages":[]}
```

#### D. Latence réelle (mesurée, pas théorique)

Le benchmark (section 8) mentionne "~50ms bridge". C'est le temps de traitement interne Node.js uniquement. La latence **réelle** ressentie par le client :

| Appel | Latence end-to-end |
|:------|:-------------------|
| 1 | 3,531 ms |
| 2 | 6,338 ms |
| 3 | 6,361 ms |
| 4 | 3,701 ms |
| 5 | 5,142 ms |
| **Moyenne** | **5,015 ms** |

Provider : Grok 4.1 Fast Reasoning. La latence est dominée par l'appel IA externe (~95% du temps).

#### Hiérarchie des blocages

```
S7 (Register 500)      ── BLOQUE TOUT (aucun signup possible)
  ↓ si réparé
S1+S2 (Snippet)        ── Widget ne charge PAS (URL fausse + fichier inexistant)
  ↓ si corrigé
S5+S4 (CORS)           ── Widget charge mais ne communique PAS (403 "Origin not allowed")
  ↓ si origines enregistrées
A (Stripe)             ── Facturation impossible (clés manquantes)
S3 (.htaccess)         ── E-commerce code-split bloqué (monolith contourne)
S9 (WebSocket)         ── Voice streaming indisponible (fallback Web Speech)
S8 (/health)           ── Monitoring externe impossible
S6 (CSP CinematicAds)  ── Spécifique 1 plateforme
```

**Conclusion 250.242b** : Le code LOCAL est complet (~93/100). La PRODUCTION ACCESSIBLE DEPUIS L'EXTÉRIEUR est à ~8/100. L'écart vient de 3 catégories :
1. **Bug serveur** (register 500) qui bloque tout le funnel
2. **Erreurs de configuration** (URL snippet, .htaccess, CORS) jamais testées end-to-end depuis un domaine externe
3. **Endpoints inaccessibles** (health, realtime) depuis l'extérieur via Traefik

**Aucune de ces défaillances n'est visible en testant depuis vocalia.ma uniquement.** Le widget fonctionne parfaitement sur vocalia.ma (origin whitelistée, snippet non utilisé, script en dur).

**Voir** : `docs/SATELLITE-IMPLEMENTATION-AUDIT.md` pour le plan de correction détaillé par plateforme.
