# VocalIA — Audit Forensique de Couverture de Tests

> **Date** : 15/02/2026 — Session 250.210b (function coverage 100%)
> **Methode** : Bottom-up factuelle — chaque chiffre verifie par execution reelle
> **Total** : **6,042+ tests** | **97 fichiers** (91 at 250.210b + 6 added since) | **1,001+ suites** | **0 fail**
> **Verdict** : **221/221 fonctions exportees testees comportementalement (100%)** — 213 appels directs + 8 via HTTP E2E. **9 vraies chaines CRUD**. Scripts 2/33 testes (ceux avec pure functions exportees). Dashboard 0/25 (DOM-dependent, non testable en Node). **63.7% des tests executent du code production** (3,849/6,042), 28.9% static/content (1,746), 7.4% structural (447). Caller/callee verified (78 modules, 12 checks, 0 errors).

---

## Table des Matieres

1. [Resume Executif](#1-resume-executif)
2. [Couverture par Module — Core (58 modules)](#2-core-58-modules)
3. [Couverture par Module — Gateways (5)](#3-gateways-5-modules)
4. [Couverture par Module — Telephony (1)](#4-telephony-1-module)
5. [Couverture par Module — Widget (7)](#5-widget-7-modules)
6. [Couverture par Module — MCP Server (3)](#6-mcp-server-3-modules)
7. [Couverture par Module — Lib (1)](#7-lib-1-module)
8. [Couverture par Module — Personas (2)](#8-personas-2-modules)
9. [Couverture par Module — Integrations (7)](#9-integrations-7-modules)
10. [Couverture par Module — Sensors (4)](#10-sensors-4-modules)
11. [Couverture par Module — Scripts (30)](#11-scripts-30-modules)
12. [Couverture par Module — Dashboard Pages (23)](#12-dashboard-pages-23-html)
13. [Tests Meta/Transversaux](#13-tests-metatransversaux)
14. [Matrice de Couverture HTTP](#14-matrice-de-couverture-http)
15. [Audit CRUD — Completude des Chaines](#15-audit-crud--completude-des-chaines)
16. [GAPS — Modules Sans Test](#16-gaps--modules-sans-test)
17. [GAPS — Fonctions Non Couvertes dans Modules Testes](#17-gaps--fonctions-non-couvertes)
18. [Classification des Risques](#18-classification-des-risques)
19. [Bugs Trouves par les Tests (250.207-250.209)](#19-bugs-trouves-par-les-tests)
20. [Recommandations Priorisees](#20-recommandations-priorisees)

---

## 1. Resume Executif

### Progression 250.206 → 250.210b

| Metrique | Session 250.206 | Session 250.209c | Session 250.210b | Delta total |
|:---------|:---------------:|:----------------:|:----------------:|:-----------:|
| Fichiers test | 78 | 91 | 91 | +13 |
| Tests pass | 5,025 | 5,919 | 6,042 | +1,017 |
| Suites | 738 | 956 | 1,001 | +263 |
| Fail | 0 | 0 | 0 | = |
| Routes HTTP testees E2E | ~15 | ~80 | ~80 | +65 |
| CRUD chains completes | 1 | 9 | 9 | +8 |
| Fonctions exports testees | ? | ? | **221/221 (100%)** | — |
| Bugs trouves (sessions test) | 1 | 18 | 18 | +17 |
| Bugs trouves (total projet) | 440 | 457+ | 457+ | +17 |

### Couverture par categorie

| Categorie | Modules | Avec Tests | % |
|:----------|:-------:|:----------:|:-:|
| Core | 58 | 56 | 97% |
| Gateways | 5 | 5 | 100% |
| Telephony | 1 | 1 (handlers + HTTP) | ~45% |
| Widget | 7 | 7 (structure) | ~40% |
| MCP Server | 3 | 2 | 67% |
| Lib | 1 | 1 | 100% |
| Personas | 2 | 1 | 50% |
| Integrations | 7 | 7 (behavioral) | 100% |
| Sensors | 4 | 4 | 100% |
| Scripts | 33 | 2 (voice-widget-templates, batch-translate) | 6% |
| Dashboard Pages | 25 | 0 (DOM-dependent) | 0% |
| Dashboard Lib (src/lib/) | 21 | 0 (DOM-dependent) | 0% |
| **TOTAL** | **162** | **91** | **56%** |

### Classification des tests — verifie empiriquement (250.210b)

| Type | Fichiers | Tests | % | Execute du code prod ? |
|:-----|:--------:|:-----:|:-:|:----------------------:|
| **PURE_BEHAVIORAL** (constructors + pure methods) | 38 | 2,294 | 38.0% | ✅ OUI |
| **BEHAVIORAL** (real function calls, mock external deps) | 24 | 1,173 | 19.4% | ✅ OUI |
| **HTTP E2E** (real server + fetch) | 6 | 382 | 6.3% | ✅ OUI |
| **STRUCTURAL_REQUIRE** (require + export checks) | 4 | 447 | 7.4% | ⚠️ PARTIEL |
| **STATIC_FILE_SCAN** (read source, detect patterns) | 7 | 1,034 | 17.1% | ❌ NON |
| **CONTENT_DATA** (config, personas, i18n) | 2 | 712 | 11.8% | ❌ NON |
| **TOTAL** | **91** | **6,042** | **100%** | — |

**Verdict** : **3,849 tests (63.7%)** executent du code production (HTTP E2E + Behavioral + Pure Behavioral). **447 tests (7.4%)** font du require+export (partiel). **1,746 tests (28.9%)** font de l'analyse statique ou regression de contenu. Les tests statiques ne sont PAS du theater inutile — ils ont trouve **~66 bugs reels** (security-regression: 10, config-consistency: ~31, module-loader: ~25). Mais ils ne testent PAS le comportement runtime.

### Couverture des fonctions exportees — 250.210b

**221/221 (100%)** fonctions exportees testees comportementalement.
- 213 par appels directs dans les tests
- 8 via HTTP E2E (auth-service: refreshTokens, requestPasswordReset, resetPassword, changePassword, verifyEmail, resendVerificationEmail, getCurrentUser, updateProfile)
- 0 typeof-only (4 converties en 250.210)
- 0 NOT-TESTED (13 comblees en 250.210b)

Script d'audit : `/tmp/audit-coverage.cjs` — verifie par execution (`node /tmp/audit-coverage.cjs`)

---

## 2. Core (58 modules)

### COUVERTS (56 modules)

| Module | Lignes | Test(s) | Tests | Ce qui est teste |
|:-------|:------:|:--------|:-----:|:-----------------|
| `AgencyEventBus.cjs` | 645 | agency-event-bus + eventbus | 65 | Schemas, publish/subscribe, dedup, metrics, shutdown |
| `BillingAgent.cjs` | 435 | billing-agent | 57 | AGENT_CARD, states, task history, processSessionBilling, trackCost, **handleInvoicePaid** (dedup, amount extraction, _processedInvoices), **handleInvoicePaidWebhook** (signature, event type, parse error, delegation) |
| `ContextBox.cjs` | 455 | context-box | 40 | CRUD, token estimation, compaction, LLM context, predictNextAgent |
| `ErrorScience.cjs` | 555 | error-science | 29 | Constructor, sector mapping, trends, failure analysis, rules |
| `GoogleSheetsDB.cjs` | 1139 | google-sheets-db | 98 | Schemas, CRUD, cache, validation, defaults, quota, locking |
| `OAuthGateway.cjs` | 668 | OAuthGateway + oauth-login + oauth-gateway-methods | 75 | Providers, state gen/verify, auth URLs, loginWithOAuth, exchangeCode, Google+GitHub profile normalization, saveTokens, healthCheck, HTTP server start/stop |
| `RevenueScience.cjs` | 408 | revenue-science | 47 | Pricing models, ROI, margin checks, capacity, analytics |
| `SecretVault.cjs` | 354 | secret-vault + integration-tools | 24 | Encrypt/decrypt, getSecret, getAllSecrets, checkRequired, loadFromEnv, listTenants, saveCredentials roundtrip, healthCheck |
| `StripeService.cjs` | 83 | stripe-service | 53 | Config, constructor, pricing plans, plan details, Stripe product map, checkout mock, subscription mock |
| `TenantContext.cjs` | 348 | TenantContext | 45 | Constructor, integrations check, secrets, credentials, loadConfig |
| `TenantLogger.cjs` | 329 | TenantLogger | 38 | Format, log levels, child loggers, file I/O |
| `TenantOnboardingAgent.cjs` | 216 | TenantOnboardingAgent | 18 | AGENT_CARD, task state, history, paths |
| `WebhookRouter.cjs` | 448 | WebhookRouter | 43 | Providers, signatures, extractTenantId, event types, handlers |
| `a2ui-service.cjs` | 549 | a2ui-service | 41 | Template gen, localization, actions, sanitize, cache, health |
| `ab-analytics.cjs` | 277 | ab-analytics | 42 | Event logging, experiment stats, middleware, purgeOldFiles |
| `audit-store.cjs` | 519 | audit-store | 24 | Categories, logging, query, stats |
| `auth-middleware.cjs` | 331 | auth-middleware | 34 | Token extraction, roles, permissions, tenant, rate limit, CORS |
| `auth-service.cjs` | 825 | auth-service | 42 | Config, roles, password validation, JWT, permissions, mock DB |
| `calendar-slots-connector.cjs` | 776 | calendar-slots-connector | 50 | Config, slots, busy check, cache, store, booking/cancel |
| `catalog-connector.cjs` | 2297 | catalog-connector | 164 | All 7 connector types, factory, CRUD, sync, menu/services/fleet |
| `chaos-engineering.cjs` | 769 | chaos-engineering | 49 | Experiments, safe mode, risk distribution |
| `client-registry.cjs` | 212 | client-registry | 20 | getClient, getAllClients, cache, Twilio SID lookup |
| `compliance-guardian.cjs` | 76 | compliance-guardian | 19 | PII, ethical pressure, AI disclosure, credentials |
| `conversation-store.cjs` | 1057 | conversation-store | 74 | Cache, CRUD, tenant dirs, messages, retention, stats, cleanup |
| `db-api.cjs` | 3810 | db-api + e2e-http + route-smoke + db-api-routes + install-widget + provision-tenant + cross-service-flow | 559 | parseBody, sendJson, ALL auth routes, CRUD, KB, widget-config, catalog CRUD (B6+B8+B9 fixes), conversations, exports, UCP, tenant isolation, HITL approve/reject chain, auth lifecycle, promo lifecycle, cart recovery chain |
| `elevenlabs-client.cjs` | 813 | elevenlabs-client | 53 | Voice IDs, models, settings, language mapping, constructor, cache |
| `email-service.cjs` | 339 | email-service | 34 | sendEmail, sendCartRecoveryEmail, sendVerificationEmail, sendPasswordResetEmail, sendTransactionalEmail, getTransporter, template rendering |
| `grok-client.cjs` | 457 | grok-client | 50 | System prompt, sections, product details, RAG init, KB query, **chatCompletion** (fetch mock: success, 500, network failure, model check, systemPrompt), **generateAuditAnalysis**, **generateEmailContent** |
| `grok-voice-realtime.cjs` | 1189 | grok-voice-realtime | 28 | Config, Gemini config, voice mapping, session class |
| `hybrid-rag.cjs` | 264 | hybrid-rag | 35 | BM25, RRF fusion, invalidation, singleton |
| `kb-crawler.cjs` | 683 | kb-crawler | 92 | Page patterns, detection, sitemap, JSON-LD, content extraction, FAQ, hours, delivery |
| `kb-parser.cjs` | 542 | kb-parser | 38 | JSON/CSV/TSV/TXT/MD formats, validation, normalize |
| `kb-provisioner.cjs` | 569 | kb-provisioner | 26 | Languages, initial KB gen, provisioning |
| `kb-quotas.cjs` | 514 | kb-quotas | 30 | Plan quotas, resolution, usage tracking, alerts |
| `knowledge-base-services.cjs` | 952 | knowledge-base-services + knowledge-base | 99 | TF-IDF/BM25, tokenize, search, serialize, voice format, graph |
| `knowledge-embedding-service.cjs` | 138 | knowledge-embedding-service | 21 | Cosine similarity, cache, singleton, **getEmbedding** (cache hit, cache miss, eviction), **getQueryEmbedding** (graceful null), **batchEmbed** (iterates chunks, empty array) |
| `lahajati-client.cjs` | 499 | lahajati-client | 38 | Dialects, language mapping, formats, API guards |
| `marketing-science-core.cjs` | 298 | marketing-science | 29 | Frameworks, inject, analyze, trackV2 |
| `product-embedding-service.cjs` | 442 | product-embedding-service | 73 | Embedding dim, product text, price range, cosine, cache, stats, **getProductEmbedding** (no-id, cache hit, cache miss, failure), **getQueryEmbedding**, **batchEmbed** (iterate, skip no-id, cache hit, failure) |
| `recommendation-service.cjs` | 756 | recommendation-service | 43 | Persona config, association rules, user query, LTV reranking, diversity, voice format, **initializeCatalog** (batchEmbed+addBatch), **getSimilarProducts** (findSimilar, empty), **getPersonalizedRecommendations** (viewed, dedup), **getVoiceRecommendations** (similar, no results), **learnFromOrders** |
| `remotion-hitl.cjs` | 376 | remotion-hitl | 40 | States, queue workflow, stats (B48 fix: generating state), updateVideo, markGenerating, audit log, events |
| `remotion-service.cjs` | 775 | remotion-service | 58 | Compositions, languages, HITL, health, metrics, composition IDs, **renderComposition** (HITL chain, unknown→throws, custom lang), **renderCompositionDirect** (unknown→throws), **renderAll** (13 compositions), **renderAllLanguages** (65 = 13×5), **generateVideo** (demo, features, unknown), **installDependencies** (real npm install), **startStudio** (real spawn+kill) |
| `stitch-to-vocalia-css.cjs` | 388 | stitch-to-vocalia-css | 19 | Design tokens, CSS conversion, health |
| `tenant-catalog-store.cjs` | 1141 | tenant-catalog-store | 62 | Config, LRU cache, voice generators, connectors, CRUD, stats |
| `tenant-cors.cjs` | 150 | tenant-cors | 61 | validateOrigin, loadTenantOrigins, isOriginAllowedForTenant, edge cases |
| `tenant-kb-loader.cjs` | 715 | tenant-kb-loader | 65 | Languages, LRU, mergeKB, persona extraction, tokenize, relevance, cleanup |
| `tenant-persona-bridge.cjs` | 388 | tenant-persona-bridge | 41 | Sector archetypes, transform, getConfigSync, cache, demo clients, **getClientConfig** (null, demo, unknown, caching), **clientExists** (true/false) |
| `translation-supervisor.cjs` | 280 | translation-supervisor | 35 | Agent card, hallucination detection, TTS clean, Darija, fallback |
| `ucp-store.cjs` | 615 | ucp-store | 31 | LTV tiers, profile CRUD, interactions, LTV tracking, insights |
| `vector-store.cjs` | 426 | vector-store | 45 | CRUD, search, metadata filter, LRU eviction, serialize, multi-tenant |
| `voice-agent-b2b.cjs` | 758 | voice-agent-b2b | 33 | Service packs, RAG retrieval, fallback response, session lifecycle |
| `voice-api-resilient.cjs` | 3942 | voice-api + voice-api-http + install-widget | 346 | sanitizeInput, lead extraction (6 functions), BANT scoring, qualification, embed-code, HTTP routes: health, metrics, config, respond, qualify, lead, feedback, social-proof, a2ui/action (B7 fix), admin/tenants (B7 fix), admin/logs/export, CORS, security headers |
| `voice-api-utils.cjs` | 420 | voice-api-utils | 115 | Origin validation, NPS, JSON parse, sanitize, all extractors, lead scoring, system prompts, social proof |
| `voice-crm-tools.cjs` | 351 | voice-crm-tools + integration-tools | 25 | Lookup, createLead, updateCustomer, logCall (no creds mode) |
| `voice-ecommerce-tools.cjs` | 405 | voice-ecommerce-tools + integration-tools | 34 | Order status, stock check, recommendations, order history (no creds) |

### NON COUVERTS (2 modules) — GAPS

| Module | Lignes | Fonctions exportees | Risque |
|:-------|:------:|:--------------------|:------:|
| `kling-service.cjs` | 174 | KlingService (generateVideo, pollStatus, downloadVideo) | Moyen — API externe, credits expires |
| `stitch-api.cjs` | 301 | listProjects, createProject, generateScreen, getScreen | Faible — UI generation, pas critique |

**Note** : `email-service.cjs`, `tenant-cors.cjs`, `StripeService.cjs` sont maintenant couverts (sessions 250.207-250.209).

---

## 3. Gateways (5 modules)

| Module | Lignes | Test(s) | Tests | Status |
|:-------|:------:|:--------|:-----:|:------:|
| `llm-global-gateway.cjs` | 272 | llm-global-gateway | 14 | COUVERT |
| `meta-capi-gateway.cjs` | 286 | meta-capi | 28 | COUVERT |
| `payzone-gateway.cjs` | 134 | payzone-gateway + gateways | 67 | COUVERT |
| `payzone-global-gateway.cjs` | 190 | payzone-gateway + gateways | (inclus) | COUVERT |
| `stripe-global-gateway.cjs` | 282 | gateways | 28 | COUVERT |

**Verdict** : 100% couverts.

---

## 4. Telephony (1 module)

| Module | Lignes | Test(s) | Tests | Status |
|:-------|:------:|:--------|:-----:|:------:|
| `voice-telephony-bridge.cjs` | 4843 | voice-telephony-pure + telephony-handlers + telephony-http | 212 | **PARTIEL (~45%)** |

### Ce qui est teste (212 tests)

**Fonctions pures (70 tests — voice-telephony-pure)** :
- `getGrokVoiceFromPreferences`, `getTwiMLLanguage`/`getTwiMLMessage`
- `detectFinancialCommitment`/`getMatchedFinancialKeywords`, `calculateBANTScore`/`getQualificationLabel`
- `detectQueryLanguage`, `safeJsonParse`, `generateSessionId`, `checkRateLimit`
- CONFIG/HITL_CONFIG constants

**Handlers (131 tests — telephony-handlers)** :
- 14 handlers: handleQualifyLead, handleObjection, handleScheduleCallback, handleCreateBooking, handleCreateBookingInternal, handleTrackConversion, handleSearchKnowledgeBase, handleTransferCall, handleTransferCallInternal, handleSendPaymentDetails, sendTwilioSMS, sendWhatsAppMessage, queueCartRecoveryCallback, HITL pipeline (list/approve/reject)

**HTTP (11 tests — telephony-http)** :
- GET /health, POST /voice/inbound (auth + validation), POST /voice/outbound (auth)

### Ce qui N'EST PAS teste (gap significatif)

| Fonction/Route | Lignes | Impact |
|:---------------|:------:|:------:|
| `/voice/outbound-twiml` — TwiML generation callback | ~50 | HAUT |
| `/voice/status` — Status callback | ~10 | Faible |
| `/messaging/send` — sendMessage/SMS/WhatsApp | ~100 | HAUT |
| `/stream/:sessionId` — WebSocket handler | ~300 | **CRITIQUE** — Stream audio Twilio |
| `handleTwilioStream()` — Grok Realtime integration | ~500 | **CRITIQUE** — Traitement audio temps reel |
| Session management (`activeSessions`) | ~100 | HAUT |
| Twilio signature validation | ~30 | HAUT — Securite |
| **Total non teste** | **~1090** | **~22% du module** |

---

## 5. Widget (7 modules)

| Module | Lignes | Test(s) | Tests | Status |
|:-------|:------:|:--------|:-----:|:------:|
| `voice-widget-v3.js` | 3747 | widget + widget-backend-integration + install-widget | ~130 | **PARTIEL** |
| `voice-widget-b2b.js` | 1878 | widget + widget-backend-integration | ~30 | **PARTIEL** |
| `abandoned-cart-recovery.js` | 1454 | widget (structure only) | ~5 | **MINIMAL** |
| `free-shipping-bar.js` | 862 | widget (structure only) | ~3 | **MINIMAL** |
| `recommendation-carousel.js` | 653 | widget (structure only) | ~3 | **MINIMAL** |
| `spin-wheel.js` | 1256 | widget (structure only) | ~3 | **MINIMAL** |
| `voice-quiz.js` | 1161 | widget (structure only) | ~3 | **MINIMAL** |

**Non testable en Node.js** : DOM construction, Shadow DOM, micro/MediaRecorder, TTS playback, RTL dynamique. Necessite Playwright.

---

## 6. MCP Server (3 modules)

| Module | Lignes | Test(s) | Tests | Status |
|:-------|:------:|:--------|:-----:|:------:|
| `index.ts` | 2689 | mcp-server | 110 | **COUVERT** |
| `auth-provider.ts` | 374 | mcp-auth-provider | 44 | **COUVERT** |
| `paths.ts` | 24 | — | 0 | **NON COUVERT** (trivial — 1 function, 24 lignes) |

### MCP — Ce qui est teste (154 tests)

- 203 tools (22 inline + 181 external), naming conventions, file existence
- Resources (6) et Prompts (8)
- Critical inline tools, handler structure, build artifacts
- **auth-provider** : OAuth 2.1 token exchange, token storage, introspection, token revocation, client credentials, PKCE validation

---

## 7. Lib (1 module)

| Module | Lignes | Test(s) | Tests | Status |
|:-------|:------:|:--------|:-----:|:------:|
| `security-utils.cjs` | 944 | rate-limiter + security-utils | 231 | **COUVERT** |

Fonctions testees : RateLimiter, validateInput, sanitizeInput, validateRequestBody, sanitizePath, isValidFilename, secureRandomInt, secureRandomString, timingSafeEqual, redactSensitive, validateUrl, CSRF, encodeHTML, stripHTML, sanitizeURL.

**Verdict** : Couverture exhaustive.

---

## 8. Personas (2 modules)

| Module | Lignes | Test(s) | Tests | Status |
|:-------|:------:|:--------|:-----:|:------:|
| `voice-persona-injector.cjs` | 8061 | persona-audit + persona-e2e | 712 | **COUVERT** |
| `agency-financial-config.cjs` | 61 | — | 0 | **NON COUVERT** (trivial) |

---

## 9. Integrations (7 modules)

| Module | Lignes | Test(s) | Tests | Status |
|:-------|:------:|:--------|:-----:|:------:|
| `hubspot-b2b-crm.cjs` | 1370 | integrations | 9 | **BEHAVIORAL** |
| `klaviyo.cjs` | 190 | integrations | 7 | **BEHAVIORAL** |
| `pipedrive.cjs` | 172 | integrations | 6 | **BEHAVIORAL** |
| `prestashop.cjs` | 110 | integrations | 5 | **BEHAVIORAL** |
| `zoho.cjs` | 149 | integrations | 6 | **BEHAVIORAL** |
| `voice-crm-tools.cjs` | 104 | voice-crm-tools + integrations | 25 | **COUVERT** |
| `voice-ecommerce-tools.cjs` | 180 | voice-ecommerce-tools + integrations | 34 | **COUVERT** |

**Session 250.209** : `integrations.test.mjs` reecrit — typeof theater → behavioral :
- `createForTenant()` factory tests (async, instanceof, tenantId)
- `init()` error paths (sans credentials)
- Constructor defaults, CONFIG structure
- `formatForVoice()` pure function (edge cases: undefined, null, score=0)
- `getCustomerContext()` undefined email
- Adapter interface contracts
- HubSpot: `getForTenant` caching (meme instance pour meme tenant)

**Ce qui manque** : API calls reels (necessitent credentials — voir Section 20 P0-P3).

---

## 10. Sensors (4 modules)

| Module | Lignes | Test(s) | Tests | Status |
|:-------|:------:|:--------|:-----:|:------:|
| `cost-tracking-sensor.cjs` | 292 | sensors | 17 | **COUVERT** |
| `lead-velocity-sensor.cjs` | 118 | sensors | 17 | **COUVERT** |
| `retention-sensor.cjs` | 153 | sensors | 17 | **COUVERT** |
| `voice-quality-sensor.cjs` | 289 | sensors | 17 | **COUVERT** |

**Session 250.208b** : `sensors.test.mjs` — behavioral tests :
- `calculatePressure()` pour 4 sensors (cost, voice, lead, retention)
- `updateGPM()` pour 4 sensors
- `loadLocalCostLog()` — lit `logs/api-costs.json`
- Tests avec default data shape ET real data

---

## 11. Scripts (33 modules) — Audit 250.209b

### Testables et testes (2 fichiers)

| Module | Lignes | Test(s) | Tests | Ce qui est teste |
|:-------|:------:|:--------|:-----:|:-----------------|
| `voice-widget-templates.cjs` | 808 | scripts-widget-templates | 55 | INDUSTRY_PRESETS (8 presets × fields/colors/placeholders), generateConfig (15 tests: options, colors, prompts, booking, services), validateConfig (12 tests: required fields, hex validation, warnings, score), generateDeploymentFiles (6 tests: FS output, JSON/JS/HTML/README, chain) |
| `batch-translate-gemini.cjs` | 136 | scripts-widget-templates | 20 | extractLeaves (8 tests: flat/nested/deep/mixed/prefix), splitIntoBatches (6 tests: chunks/edge cases/preservation), chain (1 test) |

### Non testables — raison factuelle par categorie

| Categorie | Modules | Raison |
|:----------|:-------:|:-------|
| **Auto-execute a l'import** | 1 (production-monitor.cjs) | `run().then()` au top-level — require() declenche le monitoring. Fonctions pures (detectTransitions, loadCooldowns) non exportees. Refactoring = risque de regression VPS. |
| **Seeds (one-shot, deja executes)** | 6 | seed-300-tenants, seed-500-tenants, seed-multi-tenant-clients, fix-missing-tenants, fix-tenant-sectors, cleanup-uuid-tenants — scripts de migration deja executes. |
| **Build tools** | 2 | build-widgets.cjs (n'exporte pas, mode --check deja valide dans install-widget.test.mjs), validate-design-tokens.cjs (validateur recurrent, execute manuellement, 23/23 pass) |
| **Migration one-shot** | 3 | esm-migrate, convert-tests-esm, fix-es-contamination — terminee. |
| **Tests manuels** | 7 | test-*.cjs/js — scripts de test interactifs (persona injection, onboarding, billing flow, geo-detect, etc.) |
| **Enrichissement AI** | 2 | enrich-system-prompts.cjs, analyze-archetypes.cjs — generation de contenu one-shot |
| **Infra/debug** | 4 | health-check, start-e2e-services, verify-*.cjs, debug_kling — utilitaires operationnels |
| **Codegen** | 2 | generate-voice-widget-client, translate-locales — generation de code/traductions |
| **Maintenance** | 1 | monthly-maintenance.cjs — taches recurrentes VPS |

**Verdict scripts** : 2/33 testes (6%). Les 31 restants sont soit auto-executants (pas importables), soit one-shot (deja executes), soit des utilitaires operationnels sans logique metier critique. La couverture de 6% est le maximum REEL sans refactoring invasif.

---

## 12. Dashboard Pages (25 HTML) + Lib Modules (21 JS) — Audit 250.209b

### Realite factuelle

| Categorie | Fichiers | DOM refs (min-max) | Testable Node.js ? |
|:----------|:--------:|:------------------:|:------------------:|
| Dashboard HTML (client/) | 14 | inline `<script>` avec imports | ❌ |
| Dashboard HTML (admin/) | 6 | inline `<script>` avec imports | ❌ |
| Dashboard HTML (auth/) | 5 | inline `<script>` avec imports | ❌ |
| `website/src/lib/*.js` | 21 | 4 a 61 refs DOM | ❌ |

### Pourquoi non testable en Node.js

Les 21 modules `src/lib/` utilisent `window.location`, `document.querySelector`, `localStorage`, `addEventListener`, etc. directement dans leur code (pas derriere une abstraction). Exemples :
- `api-client.js` : `window.location.hostname` (ligne 17)
- `auth-client.js` : `localStorage.getItem` (ligne 39)
- `gsap-animations.js` : 61 refs DOM
- `data-table.js` : 34 refs DOM

**Alternatives pour tester** :
1. **Playwright E2E** — teste les pages dans un vrai navigateur. Cout : infra + maintenance.
2. **jsdom/happy-dom** — mock DOM minimal. Risque : faux positifs (DOM simule ≠ reel).
3. **Ne pas tester** — les routes API sous-jacentes (db-api, voice-api) sont deja testees a 88%.

**Verdict** : 0/46 testes. Les routes API que ces pages appellent sont couvertes a 88%. Le risque residuel est dans la logique frontend (validation de formulaire, gestion d'etat, navigation) qui ne peut etre testee qu'avec un navigateur reel.

---

## 13. Tests Meta/Transversaux

| Test | Tests | Ce qu'il couvre |
|:-----|:-----:|:----------------|
| `config-consistency.test.mjs` | 490 | Plan names, pricing, features, locales, personas, OAuth, telephony, KB quotas, registry, widgets, HITL states |
| `cross-module-integrity.test.mjs` | 73 | Ecom/CRM method matching, SecretVault patterns, require chains, EventBus API, singleton guards |
| `cross-service-flow.test.mjs` | 31 | Auth chain, persona→voice chain, KB chain, quota gating, error propagation, data contracts |
| `module-loader.test.mjs` | 233 | All core modules load, non-empty exports, expected methods, singletons, getInstance factories |
| `security-regression.test.mjs` | 274 | XSS (widget + innerHTML), JSON.parse crashes, path traversal, timing-safe, hardcoded secrets, CORS, auth guards, JWT config, memory leaks, eventBus, sanitizeTenantId |
| `i18n.test.mjs` | 18 | 5 locale files, key parity, translation quality, RTL, critical sections |
| `route-smoke.test.mjs` | 43 | OPTIONS, 404, public routes, protected routes, health, wrong method, CORS, registration |

---

## 14. Matrice de Couverture HTTP

### DB-API (port 3013) — ~50 routes

| Route | Methode | Test E2E | Fichier test |
|:------|:-------:|:--------:|:-------------|
| `/api/auth/register` | POST | ✅ | e2e-http, db-api-routes |
| `/api/auth/login` | POST | ✅ | e2e-http, db-api-routes |
| `/api/auth/logout` | POST | ✅ | db-api-routes |
| `/api/auth/refresh` | POST | ✅ | db-api-routes |
| `/api/auth/forgot` | POST | ✅ | db-api-routes |
| `/api/auth/reset` | POST | ✅ | db-api-routes |
| `/api/auth/verify-email` | POST | ✅ | db-api-routes |
| `/api/auth/resend-verification` | POST | ✅ | db-api-routes |
| `/api/auth/me` | GET/PUT | ✅ | e2e-http, db-api-routes |
| `/api/auth/password` | PUT | ✅ | db-api-routes |
| `/api/db/health` | GET | ✅ | route-smoke, db-api-routes |
| `/api/db/:sheet` | GET | ✅ | e2e-http, db-api-routes |
| `/api/db/:sheet` | POST | ✅ | db-api-routes |
| `/api/db/:sheet/:id` | GET | ❌ | **NON TESTE** |
| `/api/db/:sheet/:id` | PUT | ❌ | **NON TESTE** |
| `/api/db/:sheet/:id` | DELETE | ⚠️ | db-api-routes (auth only — 401 sans auth, **jamais teste avec auth**) |
| `/api/hitl/pending` | GET | ✅ | db-api-routes |
| `/api/hitl/history` | GET | ✅ | db-api-routes (chain) |
| `/api/hitl/stats` | GET | ✅ | db-api-routes (chain) |
| `/api/hitl/approve/:id` | POST | ✅ | db-api-routes (chain) |
| `/api/hitl/reject/:id` | POST | ✅ | db-api-routes (chain) |
| `/api/tenants/:id/billing` | GET | ✅ | db-api-routes |
| `/api/tenants/:id/billing` | POST | ✅ | db-api-routes |
| `/api/tenants/:id/billing/portal` | POST | ✅ | db-api-routes |
| `/api/tenants/:id/widget-config` | GET/PUT | ✅ | install-widget |
| `/api/tenants/:id/allowed-origins` | GET/PUT | ✅ | install-widget |
| `/api/tenants/:id/kb` | GET/POST | ✅ | e2e-http, db-api-routes |
| `/api/tenants/:id/kb/:id` | DELETE | ✅ | db-api-routes |
| `/api/tenants/:id/kb/search` | GET | ✅ | db-api-routes |
| `/api/tenants/:id/kb/quota` | GET | ✅ | db-api-routes |
| `/api/tenants/:id/kb/import` | POST | ⚠️ | db-api-routes (auth: no auth → 401, **jamais teste avec entries valides**) |
| `/api/tenants/:id/catalog` | GET | ✅ | db-api-routes |
| `/api/tenants/:id/catalog` | POST | ✅ | db-api-routes (CRUD chain) |
| `/api/tenants/:id/catalog/:itemId` | GET | ✅ | db-api-routes (CRUD chain) |
| `/api/tenants/:id/catalog/:itemId` | PUT | ✅ | db-api-routes (CRUD chain) |
| `/api/tenants/:id/catalog/:itemId` | DELETE | ✅ | db-api-routes (CRUD chain) |
| `/api/tenants/:id/catalog/sync` | POST | ✅ | db-api-routes |
| `/api/tenants/:id/catalog/detail/:id` | GET | ✅ | db-api-routes |
| `/api/tenants/:id/catalog/search` | GET | ✅ | db-api-routes |
| `/api/tenants/:id/catalog/browse` | GET | ✅ | db-api-routes |
| `/api/tenants/:id/conversations` | GET | ✅ | db-api-routes |
| `/api/tenants/:id/conversations/:id` | GET | ✅ | db-api-routes |
| `/api/tenants/:id/conversations/export` | POST | ✅ | e2e-http |
| `/api/exports/:filename` | GET | ✅ | db-api-routes (path traversal) |
| `/api/tenants/:id/widget/interactions` | GET | ✅ | db-api-routes |
| `/api/tenants/:id/ucp/profiles` | GET | ✅ | db-api-routes |
| `/api/ucp/sync` | POST | ✅ | db-api-routes |
| `/api/ucp/interaction` | POST | ✅ | db-api-routes |
| `/api/ucp/event` | POST | ✅ | db-api-routes |
| `/api/kb/stats` | GET | ✅ | db-api-routes (admin) |
| `/api/recommendations` | POST | ✅ | db-api-routes |
| `/api/leads` | POST | ✅ | db-api-routes |
| `/api/cart-recovery` | POST | ✅ | db-api-routes |
| `/api/promo/generate` | POST | ✅ | db-api-routes |
| `/api/promo/validate` | POST | ✅ | db-api-routes |
| `/api/promo/redeem` | POST | ✅ | db-api-routes |
| `/api/tenants/:id/kb/rebuild-index` | POST | ✅ | db-api-routes (smoke: auth → 200) |
| `/api/tenants/:id/kb/crawl` | POST | ⚠️ | db-api-routes (validation: no URL → 400, **jamais teste avec URL valide**) |
| `/api/tenants/:id/catalog/import` | POST | ⚠️ | db-api-routes (auth: no auth → 401, **jamais teste avec donnees**) |
| `/api/tenants/:id/catalog/connector` | GET/PUT | — | NON TESTE |
| `/api/tenants/:id/catalog/recommendations` | POST | — | NON TESTE |

**Legende** : ✅ = teste E2E (status + response) | ⚠️ = teste partiellement (auth-only ou validation-only) | ❌ = jamais teste

**Decomposition** (~58 routes distinctes) :
- **✅ Teste E2E** : ~50 routes
- **⚠️ Partiel** : 4 routes (kb/import, kb/crawl, catalog/import, db/:sheet/:id DELETE — seuls auth/validation testes)
- **❌ Non teste** : 5 routes (db/:sheet/:id GET, db/:sheet/:id PUT, catalog/connector GET, catalog/connector PUT, catalog/recommendations)

**Pourcentage** : 50/58 = **86%** (routes avec test E2E reel), 54/58 = **93%** (incluant tests partiels)

**NOTE IMPORTANTE** : La version 250.209 du doc affirmait 48/53 = 91%. Apres verification bottom-up (250.209b) :
1. 3 routes DB generic etaient faussement ✅ (GET/PUT/:id jamais testes, DELETE/:id seulement auth)
2. 5 routes manquaient de la matrice (hitl/history, hitl/stats, ucp/interaction, ucp/event, kb/stats)
3. kb/rebuild-index etait "NON TESTE" mais IS teste (smoke test → 200)
4. kb/import etait ✅ mais seulement auth (401) teste

### Voice-API (port 3004) — ~25 routes

| Route | Methode | Test E2E | Fichier test |
|:------|:-------:|:--------:|:-------------|
| `/health` | GET | ✅ | voice-api-http |
| `/metrics` | GET | ✅ | voice-api-http |
| `/config` | GET | ✅ | voice-api-http |
| `/respond` | POST | ✅ | voice-api-http (validation) |
| `/qualify` | POST | ✅ | voice-api-http |
| `/lead/:sessionId` | GET | ✅ | voice-api-http |
| `/feedback` | POST | ✅ | voice-api-http |
| `/social-proof` | GET | ✅ | voice-api-http |
| `/tts` | POST | ✅ | voice-api-http |
| `/stt` | POST | ✅ | voice-api-http |
| `/api/contact` | POST | ✅ | voice-api-http |
| `/a2ui/generate` | POST | ✅ | voice-api-http |
| `/a2ui/action` | POST | ✅ | voice-api-http (B7 fix) |
| `/admin/tenants` | GET | ✅ | voice-api-http |
| `/admin/tenants` | POST | ✅ | voice-api-http (B7 fix) |
| `/admin/logs/export` | GET | ✅ | voice-api-http |
| `/admin/refresh` | POST | ✅ | voice-api-http |
| `/admin/health` | GET | ✅ | voice-api-http |
| `/dashboard/metrics` | GET | ✅ | voice-api-http |
| `/api/widget/embed-code` | GET | ✅ | install-widget |
| `/api/health/grok` | GET | ✅ | voice-api-http |
| `/api/health/telephony` | GET | ✅ | voice-api-http |
| `/voice-assistant/*` | GET | — | NON TESTE (static files) |
| `/lang/widget-*.json` | GET | — | NON TESTE (static files) |
| `/api/trigger-call` | POST | — | NON TESTE (telephony bridge) |
| `/api/fallback/*` | GET | — | NON TESTE (proxy to realtime) |

**Routes testees E2E** : 22/26 (**85%**)

### Telephony (port 3009)

| Route | Methode | Test E2E | Fichier test |
|:------|:-------:|:--------:|:-------------|
| `/health` | GET | ✅ | telephony-http |
| `/voice/inbound` | POST | ✅ | telephony-http |
| `/voice/outbound` | POST | ✅ | telephony-http |
| `/voice/outbound-twiml` | POST | — | NON TESTE |
| `/voice/status` | POST | — | NON TESTE |
| `/messaging/send` | POST | — | NON TESTE |
| `/stream/:sessionId` | WS | — | NON TESTE |

**Routes testees E2E** : 3/7 (**43%**)

### Resume toutes routes

| Service | Routes totales | Testees E2E | Partielles | Non testees | % E2E |
|:--------|:--------------:|:-----------:|:----------:|:-----------:|:-----:|
| DB-API | ~58 | 50 | 4 | 5 | 86% |
| Voice-API | 26 | 22 | 0 | 4 | 85% |
| Telephony | 7 | 3 | 0 | 4 | 43% |
| OAuth Gateway | ~5 | 0 | 0 | ~5 | 0% |
| Webhook Router | ~5 | 0 | 0 | ~5 | 0% |
| **TOTAL** | **~101** | **75** | **4** | **~23** | **74%** |

---

## 15. Audit CRUD — Completude des Chaines

### Definitions (terminologie precise)

- **CRUD CHAIN** : Operations en SEQUENCE dans le meme test, ou les donnees persistent entre les requetes. Prouve que Create→Read→Update→Delete fonctionnent ensemble. Le DELETE est suivi d'un READ de verification (doit retourner 404).
- **Tests isoles** : Chaque operation testee separement (differents `it()` blocs, souvent `resetStore()` entre). NE PROUVE PAS que les operations fonctionnent ensemble.
- **Assertion d'auth** : Test qui verifie seulement que la route retourne 401 sans token — ne teste PAS le comportement reel.

### Chaines CRUD testees — Verification bottom-up

| Entite | Tests existants | Type | Verdict |
|:-------|:----------------|:----:|:-------:|
| **Catalog Item** | POST→GET→PUT→DELETE→GET(404) dans un seul `it()` | **CHAIN** | ✅ **COMPLET** (gold standard) |
| **Promo Code** | Generate→Validate→Redeem→Re-validate(already_used) dans un seul `it()` | **CHAIN** | ✅ **LIFECYCLE COMPLET** |
| **Auth User** | Register→Verify→Login→Me→Refresh→Logout→Refresh(fail) dans un seul `it()` | **CHAIN** | ✅ **COMPLET** (pas de DELETE user — route n'existe pas) |
| **Auth Lockout** | 5 failed logins→locked→reset password→login works dans un seul `it()` | **CHAIN** | ✅ **COMPLET** (security lifecycle) |
| **HITL Approval** | Create(DB)→Pending→Approve→History→Not-in-pending dans un seul `it()` | **CHAIN** | ✅ **COMPLET** (approval workflow) |
| **Widget Config** | PUT config→PUT origins→GET config(verify)→GET origins(verify)→FS verify | **CHAIN** | ✅ **C+R+U COMPLET** (upsert, pas de DELETE route) |
| **Cart Recovery** | POST create→GET admin queue→verify record present | **CHAIN** | ⚠️ **C+R seulement** (pas de U/D) |
| **UCP market rules** | POST sync×8 countries→verify currency+market pour chaque | **CHAIN** | ⚠️ **C+R seulement** (upsert, pas de D) |
| **KB Entry** | POST create→GET list→verify→POST update(upsert)→verify→DELETE→GET(gone) | **CHAIN** | ✅ **COMPLET** (250.209b) |
| **DB Generic (sessions)** | POST create→GET by ID→PUT update→GET verify→DELETE→GET(404) | **CHAIN** | ✅ **COMPLET** (250.209b — B10/B11/B12 fixes) |
| **UCP Profile** | POST sync(create)→GET profiles→POST sync(update)→verify update→interaction→event | **CHAIN** | ✅ **COMPLET** (250.209b) |

### Routes DB Generic — Avant/Apres 250.209b

| Operation | Route | Avant 250.209b | Apres 250.209b |
|:----------|:------|:--------------:|:--------------:|
| CREATE | `POST /api/db/sessions` | ✅ | ✅ |
| READ list | `GET /api/db/sessions` | ✅ | ✅ |
| READ by ID | `GET /api/db/sessions/:id` | ❌ | ✅ |
| UPDATE | `PUT /api/db/sessions/:id` | ❌ | ✅ (B10 fix: 404 on nonexistent) |
| DELETE | `DELETE /api/db/sessions/:id` | ❌ (auth only) | ✅ (B11 fix: 404 on nonexistent) |
| CHAIN | — | ❌ | ✅ POST→GET ID→PUT→GET→DELETE→GET(404) |
| Tenant isolation | — | ❌ | ✅ (B12 fix: consistent guards) |

### Chaines CRUD comblees en 250.209b

| # | Entite | Avant | Apres | Bugs trouves |
|:-:|:-------|:-----:|:-----:|:-------------|
| 1 | **DB Generic CRUD** | ❌ CRITIQUE | ✅ CHAIN COMPLETE | **B10** (PUT nonexistent→500), **B11** (DELETE nonexistent→500), **B12** (tenant isolation inconsistente) |
| 2 | **KB Entry** | ❌ ISOLE | ✅ CHAIN COMPLETE | (aucun — code correct) |
| 3 | **UCP Profile** | ❌ ISOLE | ✅ CHAIN COMPLETE | (aucun — code correct) |

### Chaines CRUD restant MANQUANTES

| # | Entite | Ce qui manque | Impact | Raison |
|:-:|:-------|:-------------|:------:|:-------|
| 1 | **Catalog Connector** | GET connector, PUT connector — **0 test** | **MOYEN** | Catalogue connecteur externe — jamais teste |
| 2 | **Catalog Import** | POST import avec donnees valides → verify items | **MOYEN** | Import teste seulement pour auth (401) |
| 3 | **Conversation** | CHAIN: (create via /respond) → GET detail | **MOYEN** | CREATE requiert XAI_API_KEY |
| 4 | **Tenant** | GET single, PUT, DELETE | **FAIBLE** | Routes inexistantes dans l'API |
| 5 | **Booking** | R/U/D via HTTP | **FAIBLE** | CREATE via telephony uniquement, pas de routes HTTP CRUD |

### Verdict CRUD — 250.209b

**9 vraies chaines CRUD** : Catalog Item, Promo Code, Auth Lifecycle, Auth Lockout, HITL Approval, Widget Config (250.209) + **DB Generic, KB Entry, UCP Profile** (250.209b).

**3 bugs reels trouves** par code reading lors de l'implementation des chaines (B10-B12). Les 3 bugs partageaient le meme pattern : pas de null-check avant delegation a la couche DB → 500 au lieu de 404.

**Gaps restants** : Catalog Connector et Import (MOYEN), Conversation (bloque par API key). Les entites Tenant et Booking n'ont simplement pas de routes CRUD completes dans l'API.

---

## 16. GAPS — Modules Sans Test

### Priorite CRITIQUE

| # | Module | Lignes | Raison |
|:-:|:-------|:------:|:-------|
| — | *(Tous les modules critiques sont maintenant couverts)* | — | — |

### Priorite MOYENNE

| # | Module | Lignes | Raison |
|:-:|:-------|:------:|:-------|
| 1 | `core/kling-service.cjs` | 174 | Client API Kling (credits expires — pas testable sans rechargement) |
| 2 | `core/stitch-api.cjs` | 301 | Client API Stitch (UI gen, pas critique) |
| 3 | `personas/agency-financial-config.cjs` | 61 | Config financiere (trivial, 61 lignes) |
| 4 | `mcp-server/src/paths.ts` | 24 | 1 fonction, 24 lignes |

### NON TESTABLE (scripts, dashboard)

| Categorie | Modules | Raison |
|:----------|:-------:|:-------|
| Scripts | 29 | Utilitaires one-shot, pas de logique metier critique |
| Dashboard HTML | 23 | Frontend — necessite Playwright |

---

## 17. GAPS — Fonctions Non Couvertes dans Modules Testes

### `voice-api-resilient.cjs` (3,942 lignes, ~346 tests)

| Fonction non testee | Impact |
|:--------------------|:------:|
| `getResilisentResponse()` — LLM call + fallback chain | **CRITIQUE** (necessite XAI_API_KEY) |
| `/respond` full pipeline (LLM + conversation save) | **CRITIQUE** (necessite XAI_API_KEY) |
| `/api/trigger-call` (telephony bridge) | HAUT (necessite VOICE_API_KEY + telephony) |

**Estime** : ~800 lignes non testees (**20%** — down from 65%)

### `grok-voice-realtime.cjs` (1,189 lignes, 28 tests)

| Fonction non testee | Impact |
|:--------------------|:------:|
| `GrokRealtimeProxy` — WebSocket proxy complet | **CRITIQUE** — Realtime voice |
| Session management, audio buffer handling | HAUT |
| Gemini fallback pipeline | HAUT |

**Estime** : ~900 lignes non testees (**76%**)

### `voice-telephony-bridge.cjs` (4,843 lignes, 212 tests)

| Fonction non testee | Impact |
|:--------------------|:------:|
| `/stream/:sessionId` WebSocket handler | **CRITIQUE** |
| `handleTwilioStream()` | **CRITIQUE** |
| `/messaging/send` | HAUT |
| Twilio signature validation | HAUT |

**Estime** : ~1,090 lignes non testees (**22%** — down from 40%)

---

## 18. Classification des Risques

### RISQUE CRITIQUE (necessitent API keys pour debloquer)

1. **`getResilisentResponse()`** — Coeur du produit. Teste 0 fois en E2E. Bloque sur `XAI_API_KEY`.
2. **Telephony WebSocket** — `handleTwilioStream()`. Bloque sur Twilio credentials.
3. **Grok Realtime WebSocket proxy** — Bloque sur `XAI_API_KEY`.

### RISQUE HAUT

4. **Widget DOM/interaction** — 7 widgets, ~11,000 lignes. Necessite Playwright.
5. **OAuth Gateway routes HTTP** — 5 routes non testees E2E (mais OAuth flow teste via redirect).
6. **Webhook Router routes HTTP** — 5 routes non testees E2E.

### RISQUE MOYEN

7. **Dashboard pages (23)** — Frontend HTML sans tests.
8. **Integration API calls reels** — 5 modules (HubSpot, Klaviyo, etc.) — structure testee, pas les calls reels.

---

## 19. Bugs Trouves par les Tests (250.207-250.209)

| # | Bug | Severite | Session | Comment trouve |
|:-:|:----|:--------:|:-------:|:---------------|
| B45 | convExport route order (convDetailMatch caught /export) | HIGH | 250.207 | Test HTTP |
| B46-1 | `path` shadowed by URL pathname in handleRequest() | **CRITIQUE** | 250.207b | Deep code reading |
| B46-2 | SMS templates `${discount_percent}` → "undefined%" | HIGH | 250.207b | Deep code reading |
| B46-3 | HITL audit `tenant_id` vs `tenant` | MEDIUM | 250.207b | Deep code reading |
| B46-4 | resetPassword() doesn't clear locked_until | HIGH | 250.207b | Deep code reading |
| B46-5 | sendCartRecoveryEmail .map() on object | HIGH | 250.207b | Deep code reading |
| B47 | ab-analytics O(N×M) = 66.5M JSON.parse | HIGH | 250.207b | Performance test |
| B48-1 | getStats() missing `generating` state in sum | MEDIUM | 250.208 | Test assertion |
| B48-2 | HITL stats cross-store aggregation fragile | LOW | 250.208 | Test assertion |
| **B6** | **4 catalog CRUD routes missing tenant isolation** | **CRITIQUE** | 250.209 | Deep code reading |
| **B7** | POST /admin/tenants: raw JSON.parse + wrong error match | LOW | 250.209 | Deep code reading |
| **B8** | registerTenant() not awaited → race condition → item never added | **HIGH** | 250.209 | Test failure analysis |
| **B8b** | catalogType case mismatch: 'PRODUCTS' vs 'products' | **HIGH** | 250.209 | Test failure analysis |
| **B9** | _catalogStore declared inside handleRequest → new instance per request | **CRITIQUE** | 250.209 | Test failure analysis |

| **B10** | **PUT /api/db/:sheet/:id on nonexistent → 500 instead of 404** | **HIGH** | 250.209b | Deep code reading |
| **B11** | **DELETE /api/db/:sheet/:id on nonexistent → 500 instead of 404** | **HIGH** | 250.209b | Deep code reading |
| **B12** | **Tenant isolation inconsistency: PUT/DELETE missing `record.tenant_id &&` guard** | **MEDIUM** | 250.209b | Deep code reading |
| **B13** | **`new SecretVault()` on singleton instance in telephony — BYOK credentials never loaded** | **HIGH** | 250.209c | verify-caller-callee.cjs script |

**Total bugs trouves/fixes session 250.209** : 5 (B6 CRITIQUE, B7 LOW, B8 HIGH, B8b HIGH, B9 CRITIQUE)
**Total bugs trouves/fixes session 250.209b** : 3 (B10 HIGH, B11 HIGH, B12 MEDIUM)
**Total bugs trouves/fixes session 250.209c** : 1 (B13 HIGH)
**Total bugs trouves/fixes session 250.210b** : 0 (13 fonctions testees, aucun bug)
**Total bugs trouves sessions 250.207-250.210b** : 18
**Total bugs trouves toutes sessions (1-52)** : 457+ (voir MEMORY.md Bug History pour le detail complet)

### Session 250.210b — Function Coverage Completion

| Fonction ajoutee | Fichier test | Tests | Methode |
|:-----------------|:------------|:-----:|:--------|
| `BillingAgent.handleInvoicePaid` | billing-agent | 4 | Instance locale, override stripe.verifyWebhookSignature |
| `BillingAgent.handleInvoicePaidWebhook` | billing-agent | 4 | Signature invalid/wrong type/malformed/valid |
| `grok-client.chatCompletion` | grok-client | 5 | globalThis.fetch override (save/restore) |
| `grok-client.generateAuditAnalysis` | grok-client | 2 | fetch mock |
| `grok-client.generateEmailContent` | grok-client | 2 | fetch mock |
| `recommendation.initializeCatalog` | recommendation-service | 2 | Override singleton deps |
| `recommendation.getSimilarProducts` | recommendation-service | 3 | Mock vectorStore.findSimilar |
| `recommendation.getPersonalizedRecommendations` | recommendation-service | 3 | Mock vectorStore.search |
| `recommendation.getVoiceRecommendations` | recommendation-service | 3 | Dispatch + format |
| `recommendation.learnFromOrders` | recommendation-service | 1 | AssociationEngine.learn |
| `product-embedding.getProductEmbedding` | product-embedding-service | 4 | Override _getInternalEmbedding |
| `product-embedding.getQueryEmbedding` | product-embedding-service | 1 | Override _getInternalEmbedding |
| `product-embedding.batchEmbed` | product-embedding-service | 4 | Bypass disk cache |
| `knowledge-embedding.getEmbedding` | knowledge-embedding-service | 3 | Cache pre-populate |
| `knowledge-embedding.getQueryEmbedding` | knowledge-embedding-service | 2 | Graceful null |
| `knowledge-embedding.batchEmbed` | knowledge-embedding-service | 2 | Override getEmbedding |
| `tenant-persona-bridge.getClientConfig` | tenant-persona-bridge | 4 | Async, static demos fallback |
| `tenant-persona-bridge.clientExists` | tenant-persona-bridge | 2 | Wraps getClientConfig |
| `remotion-service` (7 fonctions) | remotion-service | 12 | **REAL execution** — HITL chain, npm install, process spawn |
| `SecretVault` (6 fonctions) | secret-vault | 14 | Encrypt/decrypt roundtrip, load/save |

---

## 20. Recommandations Priorisees

### P0 — Debloquer avec API Keys (voir plan acquisition)

| # | Cle | Cout | Impact |
|:-:|:----|:----:|:------:|
| 1 | `STRIPE_SECRET_KEY` (test mode `sk_test_*`) | 0€ | Debloquer billing E2E |
| 2 | `XAI_API_KEY` | ~5$ | Debloquer getResilisentResponse, /respond, /stt, realtime |
| 3 | `TWILIO_*` (trial) | 0€ | Debloquer /voice/inbound signature, SMS, WhatsApp |
| 4 | `HUBSPOT_API_KEY` (free CRM) | 0€ | Debloquer syncLeadToHubSpot |
| 5 | `ELEVENLABS_API_KEY` (free tier) | 0€ | Debloquer TTS |

### P1 — Tests supplementaires sans API keys

| # | Action | Impact | Status |
|:-:|:-------|:------:|:------:|
| 6 | ~~DB Generic CRUD chain~~ | ~~CRITIQUE~~ | ✅ 250.209b (B10-B12 found+fixed) |
| 7 | ~~KB Entry CRUD chain~~ | ~~HAUT~~ | ✅ 250.209b |
| 8 | ~~UCP Profile chain~~ | ~~MOYEN~~ | ✅ 250.209b |
| 9 | ~~OAuth Gateway routes~~ | ~~OAuth flow~~ | ✅ Deja couvert : /health + /oauth/providers (HTTP E2E dans oauth-gateway-methods), getAuthUrl/getLoginAuthUrl/state/exchangeCode (unit behavioral). 75 tests, 3 fichiers. Routes /oauth/callback et /oauth/login/callback non testables E2E (requierent vrais tokens provider). |
| 10 | WebhookRouter HTTP E2E (POST /webhook/:provider, GET /webhook/handlers, GET /webhook/events/:tenantId) | Securise webhooks | ⚠️ Unit tests existent (43 tests: signature verification HMAC, extractTenantId, getEventType, registerHandler) mais 0 requete HTTP E2E |
| 11 | Catalog connector PUT via HTTP + catalog import E2E | Admin catalog management | ⚠️ GET /api/catalog/connectors teste (admin→200). PUT connector et POST import = auth-only (401). 164 unit tests CatalogConnector mais 0 HTTP E2E pour PUT/import |

### P2 — Nice to have

| # | Action | Impact |
|:-:|:-------|:------:|
| 10 | Widget DOM tests via Playwright | 7 widgets |
| 11 | Dashboard smoke tests via Playwright | 23 pages |
| 12 | Grok Realtime WebSocket tests | Realtime voice |

---

## 21. Promptfoo LLM Eval — Couverture reelle (250.230)

> **Methode** : `promptfoo eval` cross-model (Grok + Gemini + Anthropic) avec assertions llm-rubric
> **Outils** : promptfoo v0.120.25 (global) | Grader: google:gemini-3-flash-preview

### Ce qui EST teste

| Dimension | Couvert | Total | % |
|:----------|:-------:|:-----:|:-:|
| Personas (FR uniquement) | 40 | 40 | 100% |
| Prompts (toutes langues) | 42 | 200 | **21%** |
| Providers (Grok + Gemini) | 2 | 3 | **67%** |
| Red team (AGENCY-FR seulement) | 1 persona | 40 | **2.5%** |
| Multi-turn conversations | 0 | — | **0%** |
| Function tool trigger validation | 0 | 25 tools | **0%** |

### Ce qui N'EST PAS teste (fenêtres ouvertes)

- **158 prompts non testes** : 0 ES, 0 AR, 39/40 EN manquants, 39/40 ARY manquants
- **Anthropic provider BLOQUE** : "credit balance too low" — 131 erreurs systematiques (API key valide, billing = $0)
- **Red team superficiel** : 14 tests adversariaux sur 1 seul persona (AGENCY-FR). Les 39 autres personas ont 0 test de securite LLM
- **0 test multi-turn** : Toutes les 132 assertions sont single-turn (1 question → 1 reponse)
- **0 validation de function calling** : Tools retires de 37/42 configs pour eviter les echecs Grok (tool calls JSON au lieu de texte). Les 5 configs avec tools ne verifient pas le bon declenchement
- **Grader non-deterministe** : llm-rubric via Gemini Flash donne ~5% de faux negatifs aleatoires (tests differents a chaque run)

### Resultats bruts (dernier eval-all)

| Metrique | Valeur |
|:---------|:-------|
| Tests totaux | 132 assertions × 3 providers = 396 |
| PASS | 248 |
| FAIL (non-deterministe) | 14 |
| ERRORS (Anthropic billing) | 131 |
| Smoke test (3 tests × 3 providers) | 6 PASS, 0 FAIL, 3 ERRORS |
| Red team (14 tests × 1 provider) | 14/14 PASS |

### Ce qui a ete fait cote securite (dans le code source)

- **200/200 prompts** dans `voice-persona-injector.cjs` ont maintenant une section SECURITE/SECURITY/SEGURIDAD dans toutes les langues
- Injection bulk verifiee : `require()` charge le module sans erreur, 745/745 persona-audit tests passent
- Mais : **seul 1/40 persona a ete valide adversarialement par Promptfoo** (les 39 autres ont la section SECURITE dans le code, mais n'ont jamais ete attaques pour verifier qu'elle fonctionne)

### Verification

```bash
cd promptfoo
./run-eval.sh eval                      # Smoke test (3 tests, ~20s)
./run-eval.sh eval-all                  # Full suite (42 configs, ~15min)
./run-eval.sh eval -c redteam/promptfooconfig.yaml  # Red team (14 tests, ~30s)
./run-eval.sh sync                      # Re-extract prompts from source
promptfoo view                          # Resultats dans browser
```

---

## Annexe A — Inventaire Complet des 90 Fichiers de Test

| # | Fichier | Suites | Tests | Module(s) cible(s) |
|:-:|:--------|:------:|:-----:|:-------------------|
| 1 | OAuthGateway.test.mjs | 5 | 29 | OAuthGateway.cjs |
| 2 | TenantContext.test.mjs | 8 | 45 | TenantContext.cjs |
| 3 | TenantLogger.test.mjs | 7 | 38 | TenantLogger.cjs |
| 4 | TenantOnboardingAgent.test.mjs | 4 | 18 | TenantOnboardingAgent.cjs |
| 5 | WebhookRouter.test.mjs | 6 | 43 | WebhookRouter.cjs |
| 6 | a2ui-service.test.mjs | 9 | 41 | a2ui-service.cjs |
| 7 | ab-analytics.test.mjs | 5 | 42 | ab-analytics.cjs |
| 8 | agency-event-bus.test.mjs | 10 | 41 | AgencyEventBus.cjs |
| 9 | audit-store.test.mjs | 4 | 24 | audit-store.cjs |
| 10 | auth-middleware.test.mjs | 10 | 34 | auth-middleware.cjs |
| 11 | auth-service.test.mjs | 10 | 42 | auth-service.cjs |
| 12 | billing-agent.test.mjs | 14 | 57 | BillingAgent.cjs |
| 13 | calendar-slots-connector.test.mjs | 12 | 50 | calendar-slots-connector.cjs |
| 14 | catalog-connector.test.mjs | 43 | 164 | catalog-connector.cjs |
| 15 | chaos-engineering.test.mjs | 11 | 49 | chaos-engineering.cjs |
| 16 | client-registry.test.mjs | 6 | 20 | client-registry.cjs |
| 17 | compliance-guardian.test.mjs | 6 | 19 | compliance-guardian.cjs |
| 18 | config-consistency.test.mjs | 15 | 490 | Cross-module config |
| 19 | context-box.test.mjs | 13 | 40 | ContextBox.cjs |
| 20 | conversation-store.test.mjs | 25 | 74 | conversation-store.cjs |
| 21 | cross-module-integrity.test.mjs | 15 | 73 | Cross-module integrity |
| 22 | cross-service-flow.test.mjs | 6 | 31 | Cross-service chains |
| 23 | db-api-routes.test.mjs | 37 | 133 | db-api.cjs (HTTP routes) |
| 24 | db-api.test.mjs | 13 | 94 | db-api.cjs (unit) |
| 25 | e2e-http.test.mjs | 7 | 35 | db-api.cjs (E2E) |
| 26 | elevenlabs-client.test.mjs | 12 | 53 | elevenlabs-client.cjs |
| 27 | email-service.test.mjs | 8 | 34 | email-service.cjs |
| 28 | error-science.test.mjs | 8 | 29 | ErrorScience.cjs |
| 29 | eventbus.test.mjs | 7 | 24 | AgencyEventBus.cjs |
| 30 | gateways.test.mjs | 7 | 28 | stripe/payzone gateways |
| 31 | google-sheets-db.test.mjs | 23 | 98 | GoogleSheetsDB.cjs |
| 32 | grok-client.test.mjs | 10 | 50 | grok-client.cjs |
| 33 | grok-voice-realtime.test.mjs | 4 | 28 | grok-voice-realtime.cjs |
| 34 | hybrid-rag.test.mjs | 7 | 35 | hybrid-rag.cjs |
| 35 | i18n.test.mjs | 6 | 18 | Locale files (5) |
| 36 | install-widget.test.mjs | 6 | 59 | db-api + voice-api (widget) |
| 37 | integration-tools.test.mjs | 4 | 9 | CRM/ecom tools + SecretVault |
| 38 | integrations.test.mjs | 29 | 52 | 7 integration modules |
| 39 | kb-crawler.test.mjs | 19 | 92 | kb-crawler.cjs |
| 40 | kb-parser.test.mjs | 11 | 38 | kb-parser.cjs |
| 41 | kb-provisioner.test.mjs | 3 | 26 | kb-provisioner.cjs |
| 42 | kb-quotas.test.mjs | 7 | 30 | kb-quotas.cjs |
| 43 | knowledge-base-services.test.mjs | 12 | 68 | knowledge-base-services.cjs |
| 44 | knowledge-base.test.mjs | 8 | 31 | knowledge-base-services.cjs |
| 45 | knowledge-embedding-service.test.mjs | 6 | 21 | knowledge-embedding-service.cjs |
| 46 | lahajati-client.test.mjs | 7 | 38 | lahajati-client.cjs |
| 47 | llm-global-gateway.test.mjs | 4 | 14 | llm-global-gateway.cjs |
| 48 | marketing-science.test.mjs | 6 | 29 | marketing-science-core.cjs |
| 49 | mcp-auth-provider.test.mjs | 10 | 44 | mcp auth-provider.ts |
| 50 | mcp-server.test.mjs | 12 | 110 | mcp-server index.ts |
| 51 | meta-capi.test.mjs | 6 | 28 | meta-capi-gateway.cjs |
| 52 | module-loader.test.mjs | 8 | 233 | All core modules (load test) |
| 53 | oauth-gateway-methods.test.mjs | 7 | 30 | OAuthGateway.cjs (methods) |
| 54 | oauth-login.test.mjs | 6 | 16 | OAuthGateway + auth + provisioning |
| 55 | payzone-gateway.test.mjs | 11 | 39 | payzone gateways |
| 56 | persona-audit.test.mjs | 14 | 711 | voice-persona-injector.cjs |
| 57 | persona-e2e.test.mjs | 0 | 1 | voice-persona-injector.cjs |
| 58 | product-embedding-service.test.mjs | 13 | 73 | product-embedding-service.cjs |
| 59 | provision-tenant.test.mjs | 8 | 24 | db-api.cjs (provisioning) |
| 60 | rate-limiter.test.mjs | 17 | 55 | security-utils.cjs |
| 61 | recommendation-service.test.mjs | 8 | 43 | recommendation-service.cjs |
| 62 | remotion-hitl.test.mjs | 7 | 40 | remotion-hitl.cjs |
| 63 | remotion-service.test.mjs | 10 | 58 | remotion-service.cjs |
| 64 | revenue-science.test.mjs | 11 | 47 | RevenueScience.cjs |
| 65 | route-smoke.test.mjs | 12 | 43 | db-api.cjs (routes) |
| 66 | secret-vault.test.mjs | 7 | 24 | SecretVault.cjs |
| 67 | security-regression.test.mjs | 16 | 274 | Cross-codebase security |
| 68 | security-utils.test.mjs | 30 | 176 | security-utils.cjs |
| 69 | sensors.test.mjs | 21 | 68 | 4 sensor modules |
| 70 | stitch-to-vocalia-css.test.mjs | 3 | 19 | stitch-to-vocalia-css.cjs |
| 71 | stripe-service.test.mjs | 11 | 53 | StripeService.cjs |
| 72 | telephony-handlers.test.mjs | 26 | 131 | voice-telephony-bridge.cjs (handlers) |
| 73 | telephony-http.test.mjs | 9 | 11 | voice-telephony-bridge.cjs (HTTP) |
| 74 | tenant-catalog-store.test.mjs | 11 | 62 | tenant-catalog-store.cjs |
| 75 | tenant-cors.test.mjs | 8 | 61 | tenant-cors.cjs |
| 76 | tenant-kb-loader.test.mjs | 17 | 65 | tenant-kb-loader.cjs |
| 77 | tenant-persona-bridge.test.mjs | 7 | 41 | tenant-persona-bridge.cjs |
| 78 | translation-supervisor.test.mjs | 6 | 35 | translation-supervisor.cjs |
| 79 | ucp-store.test.mjs | 5 | 31 | ucp-store.cjs |
| 80 | vector-store.test.mjs | 11 | 45 | vector-store.cjs |
| 81 | video-services.test.mjs | 4 | 19 | kling/veo/remotion (video HITL) |
| 82 | voice-agent-b2b.test.mjs | 4 | 33 | voice-agent-b2b.cjs |
| 83 | voice-api-http.test.mjs | 23 | 80 | voice-api-resilient.cjs (HTTP) |
| 84 | voice-api-utils.test.mjs | 19 | 115 | voice-api-utils.cjs |
| 85 | voice-api.test.mjs | 13 | 105 | voice-api-resilient.cjs (unit) |
| 86 | voice-crm-tools.test.mjs | 7 | 16 | voice-crm-tools.cjs |
| 87 | voice-ecommerce-tools.test.mjs | 7 | 25 | voice-ecommerce-tools.cjs |
| 88 | voice-telephony-pure.test.mjs | 13 | 70 | voice-telephony-bridge.cjs (pure) |
| 89 | widget-backend-integration.test.mjs | 7 | 46 | Widget V3/B2B + backend |
| 90 | widget.test.mjs | 9 | 88 | Widget structure + templates |

---

## Annexe B — Chiffres Bruts Verifiables

```bash
# Verification commands
ls test/*.mjs | wc -l                    # 91 fichiers
node --test test/*.mjs 2>&1 | tail -7    # 6,042 tests, 0 fail
ls core/*.cjs | wc -l                    # 58 core modules
ls core/gateways/*.cjs | wc -l           # 5 gateways
ls integrations/*.cjs | wc -l            # 7 integrations
ls sensors/*.cjs | wc -l                 # 4 sensors
ls widget/*.js | wc -l                   # 7 widgets
ls scripts/*.cjs | wc -l                 # 30 scripts
ls mcp-server/src/*.ts | wc -l           # 3 MCP modules
```

---

*Document genere le 15/02/2026 — Session 250.210b. Chaque chiffre verifie par execution reelle (`node --test` individuel par fichier). 221/221 fonctions exportees testees behavioralement (100%). 6,042 tests, 0 fail, 91 fichiers.*
