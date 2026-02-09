# VocalIA — Roadmap to 100% Completion

> **Date:** 2026-02-09 | **Session:** 250.177 (Architecture audit evaluation + documentation corrections: 8 HTTP servers, deployed/non-deployed split, 5 distribution platforms)
> **Code Completeness:** 8.5/10 | **Production Readiness:** 4.0/10 (website deployed, API on VPS RESPONDING but running OLD code — /respond crashes C14 VOICE_CONFIG, db-api connected to Google Sheets, auth returns proper errors, widget v2.7.0 live)
> **Methodologie:** Chaque tache est liee a un FAIT verifie par commande. Zero supposition.
> **Source:** Audit croise de 13 documents + external audits + **DEEP AUDIT 250.166-170b** (70 bugs found, 65 fixed) + **LIVE DEPLOYMENT AUDIT 250.171** (curl-verified) + **EXTERNAL AUDIT 250.171b** (11 bugs reported, 7 confirmed+fixed) + **MCP-SOTA 250.171c** (Phase 0+1+2 complete) + **DEEP CODE AUDIT 250.172** (ALL 55 core modules audited, 69 new bugs) + **COUNTER-AUDIT 250.173** (20 NEW bugs found, 14 fixed) + **MASS FIX 250.172-173** (74 total bugs fixed) + **SESSION 250.174** (NM7 CORS dedup, dashboard System Intelligence, status live health, investor fallback chain) + **DEEP SYSTEM AUDIT 250.175** (21 reported, ~62% accurate, 7 confirmed+fixed) + **ULTRA-DEEP AUDIT 250.176** (9 bugs found+fixed: telephony, OAuthGateway, auth-service, remotion-hitl)

---

## Table des Matières

1. [Score Actuel — Décomposition Factuelle](#1-score-actuel)
2. [Completed Phases Summary](#2-completed-phases-summary)
3. [P0-WEBSITE — Active Work](#3-p0-website--active-work)
4. [Business Priorities](#4-business-priorities)
5. [Verified Metrics](#5-verified-metrics)
6. [Résumé Exécutif](#6-résumé-exécutif)

---

## 1. Score Actuel

**Code Completeness: 8.5/10** — Features coded and tested (3,803 tests, 68 files). **179 total bugs found, 167 fixed, 12 unfixed**. Session 250.176: Ultra-deep codebase audit — 9 bugs found+fixed (D1: telephony DATA_DIR path outside project, D2-D5: 4 function tool handlers missing return statements, D6-D7: OAuthGateway XSS in success/error callbacks, D8: auth-service JSON.parse preferences crash, D9: remotion-hitl JSON.parse audit log crash). Stale data: features.html 40→38 personas + 8→7 widgets, voice-fr.json B2C→3 gammes.
**Production Readiness: 4.0/10** — VERIFIED 250.171 via curl:
- `vocalia.ma` ✅ Website live (all 80 pages return 200)
- `api.vocalia.ma/health` ✅ Voice API responds (Grok/Gemini/Claude/Atlas all configured:true)
- `api.vocalia.ma/api/db/health` ✅ DB API connected (Google Sheets: 7 sheets, spreadsheetId confirmed)
- `api.vocalia.ma/api/auth/login` ✅ Auth endpoint works (returns proper error for invalid creds)
- `api.vocalia.ma/respond` ❌ **BROKEN** — returns `VOICE_CONFIG is not defined` (C14 bug, fixed in local code 250.167, NOT redeployed)
- Widget v2.7.0 live on homepage (72KB loaded, b2b kernel)
- .env: 12 API keys SET locally, 6 MISSING for docker-compose (JWT_SECRET, SMTP_*, STRIPE_SECRET_KEY, VOCALIA_VAULT_KEY)
- 0 paying customers, 22 registered test tenants

> **Important**: These are TWO separate scores. Code completeness measures how much code is written/tested AND how much of it actually works correctly. Production readiness measures what's deployed and functionally serving real users.

| # | Dimension | Score 250.172 | Score 250.173 | Delta | Justification (250.173 — 74 bugs fixed) |
|:-:|:----------|:-----:|:-----:|:-----:|:------|
| 1 | Tests unitaires | 7.0 | **7.5** | **+0.5** | 3,803 tests pass, 0 fail. 3 test assertions updated for business rule corrections (B2C→B2B, Shopify 2024→2026). |
| 2 | Sécurité | 6.5 | **8.5** | **+2.0** | sanitizeTenantId now in 20+ modules (30+ sites fixed). JWT split-brain fixed (shared CONFIG). Token hashing unified (SHA-256). Timing-safe API key comparison. Role injection prevented. |
| 3 | Production readiness | 4.0 | **4.0** | 0 | No deployment — fix session only. /respond still BROKEN on VPS. |
| 4 | Documentation accuracy | 8.5 | **8.5** | 0 | ROADMAP updated with session results. |
| 5 | Architecture code | 7.0 | **8.5** | **+1.5** | process.cwd()→__dirname in ALL 11 modules (15 sites). Module-level→lazy init (2 services). Wrong path depths fixed. Body size limits added. |
| 6 | Multi-tenant | 6.0 | **8.5** | **+2.5** | sanitizeTenantId canonical in 20+ modules. Per-limiter rate limit isolation. Fail-open warnings logged. B2C→B2B defaults corrected. |
| 7 | i18n | 10.0 | 10.0 | 0 | 4,858 keys × 5 langs verified. No changes. |
| 8 | Intégrations | 5.0 | **6.5** | **+1.5** | Embedding services lazy init (no more require-time crash). stitch-api env-based paths. Shopify API 2024→2026. |
| 9 | Developer experience | 8.0 | **8.5** | **+0.5** | Consistent sanitization pattern. Bounded caches. Config-based paths. |
| 10 | Mémoire & docs | 8.0 | **8.5** | **+0.5** | ROADMAP, MEMORY.md updated. Counter-audit methodology documented. |

| | Poids | Contribution |
|:-|:-----:|:------------:|
| 1 (7.5) | 15% | 1.125 |
| 2 (8.5) | 15% | 1.275 |
| 3 (4.0) | 10% | 0.400 |
| 4 (8.5) | 10% | 0.850 |
| 5 (8.5) | 10% | 0.850 |
| 6 (8.5) | 10% | 0.850 |
| 7 (10.0) | 5% | 0.500 |
| 8 (6.5) | 10% | 0.650 |
| 9 (8.5) | 10% | 0.850 |
| 10 (8.5) | 5% | 0.425 |
| **TOTAL** | **100%** | **7.775** → **~7.8/10** (250.173 — 74 bugs fixed, 15 remaining) |

---

## 2. Completed Phases Summary

> All phases below are ✅ DONE. Detailed per-task checklists archived in `memory/session-history.md`.
> For forensic audit methodology (250.114-250.127), see `docs/archive/`.

### Phase Overview

| Phase | Sessions | Tasks | Key Outcome | Score Impact |
|:------|:---------|:-----:|:------------|:-------------|
| **P0 (original)** | 250.105 | 6/6 | innerHTML XSS, CI tests, function tool docs, exhaustive test, stale data, `{{client_domain}}` | 5.8 → 6.5 |
| **P0-NEW (tests)** | 250.114-115 | 8/8 | Test deep surgery: voice-api(105), mcp-server(80), widget(89), db-api(94) rebuilt. 1 sanitizeInput bug fixed. 244 theater tests removed, 319 behavioral added | 5.2 → 7.2 |
| **P1** | 250.105 | 7/7 | .prettierrc, LICENSE, HSTS, Google Sheets docs, memory optimization (1242→803 lines), google-spreadsheet removed, 17 docs archived | 6.5 → 7.0 |
| **P2** | 250.105-110 | 7/7 | OpenAPI (25 methods/24 paths), coverage 16%→39%, Playwright E2E (57 tests×5 browsers), integration tests (+94), production monitor, Darija STT ar-MA, multi-turn tests | 7.0 → 7.5 |
| **P0-WIDGET** | 250.127-128 | 5/5 | XSS fixed (escapeHtml+escapeAttr), CONFIG keys defined, #4FBAF1→#5E6AD2, dead files deleted, WCAG (aria, focus trap) | 7.4 → 8.6 |
| **P0-TENANT** | 250.129 | 4/4 | data-vocalia-tenant on 50 pages, camelCase→snake_case, GA4 infra, ECOM social proof backend | 8.6 → 7.2 (audit) |
| **P2-WIDGET** | 250.130-131+157 | 3/3 | Shadow DOM ALL 7 widgets, terser minification (-40%), 3 widgets restored + orchestrator wired | 7.2 → 8.0 |
| **P3** | 250.118-132 | 5/5 | esbuild bundler, staging Docker, k6 load tests, A2A/A2UI protocol, 38 personas audited (711 tests) | 8.4 |
| **P0-AUDIT** | 250.153-155 | 9/9 | conversationStore import, CORS tenant whitelist, CDN removed, WordPress 3 bugs, V3 fake social proof, email-service.cjs, Gemini unified, mic policy, doc lies. Multi-tenant deep: origin↔tenant, api_key 22/22 | 8.5 → 9.3 code |
| **BIZ** | 250.140-147 | 8/8 | Booking inline B2B, code-split ECOM (-55%), STT fallback, feature gating (14×4 matrix), pricing restructure, plan gating widgets, currency geo-awareness, i18n error messages | N/A |
| **FUNNEL** | 250.144 | 4/4 | Newsletter POST, booking form POST, honest social proof, Google Sheets DB configured | Prod 2.5→3.5 |
| **P0-COMPONENTS** | 250.162 | 4/4 | Dashboard→app redirect, telephony page, sidebar component updated, validator full 80-page coverage | 23/23 ✅ 0 warnings |
| **P0-MARKET** | 250.164-165 | 8/8 | Market repositioning: Europe-first strategy. Darija de-emphasized from USP #1 to 1-of-5 languages. Geo-detection expanded 3→6 markets. ~100 HTML + locale changes across 20+ files + 5 locales. Session 165: deep surgery on ar/ary (50+ fixes), SEO/AEO overhaul (llms.txt, sitemap hreflang, Schema.org areaServed+KSA) | 23/23 ✅ 0 warnings |

### Key Technical Decisions (Reference)

| Decision | Session | Rationale |
|:---------|:-------:|:----------|
| B2C product ELIMINATED | 250.143 | Phantom product (no B2C widget, loaded B2B at 79€). Merged into Pro 99€ |
| Telephony 0.06→0.10€/min | 250.143 | Margin 8%→38%. Still 2x cheaper than Vapi |
| ESM source migration DEFERRED | 250.158 | 78 conditional requires — needs AST-based tool, too risky for regex |
| CDN REJECTED | 250.154 | VPS + nginx + brotli sufficient at current volume |
| PostgreSQL REJECTED | User directive | No migration from Google Sheets |

### Feature Gating System (250.143-146)

`checkFeature(tenantId, feature)` in voice-api-resilient.cjs — 14 features × 4 plans.
`/config` returns `plan_features` for widget init-time gating.
`/respond` returns `features` for per-request gating.
Export restriction: 403 for Starter plan.
Feature injection: blocked features injected into system prompt → AI won't offer them.

| Feature | Starter | Pro | ECOM | Telephony |
|:--------|:-------:|:---:|:----:|:---------:|
| voice_widget | ✅ | ✅ | ✅ | ✅ |
| booking, bant, crm, calendar, export, webhooks, api, custom_branding | ❌ | ✅ | ✅* | ✅ |
| voice_telephony | ❌ | ❌ | ❌ | ✅ |
| ecom_* (4 features) | ❌ | ❌ | ✅ | ✅ |

*ECOM: calendar_sync excluded.

### Widget System Reference

**7 widgets**, ALL with: Shadow DOM ✅, escapeHTML ✅, @media ✅, role/aria ✅

| Widget | Lines | Deployment |
|:-------|------:|:-----------|
| voice-widget-b2b.js | 1,573 | 49 pages |
| voice-widget-v3.js (ECOM) | 3,684 | 1 page (e-commerce.html) |
| abandoned-cart-recovery.js | 1,446 | ECOM bundle (lazy) |
| spin-wheel.js | 1,248 | ECOM bundle (lazy) |
| voice-quiz.js | 1,163 | ECOM bundle (lazy) |
| free-shipping-bar.js | 847 | ECOM bundle (lazy) |
| recommendation-carousel.js | 656 | ECOM bundle (lazy) |

**ECOM bundle:** 6 IIFEs, core 16.7 KB brotli + 5 lazy chunks. Build: `scripts/build-widgets.cjs` (esbuild DCE → terser 3-pass → .gz/.br).

### P0-AUDIT Details (250.153-155) — ALL ✅ FIXED

| # | Bug | Severity | Fix |
|:-:|:----|:--------:|:----|
| A1 | `conversationStore` not imported in voice-api | CRITICAL | Added import from conversation-store.cjs |
| A2 | CORS blocks ALL third-party origins | FATAL | Tenant domain whitelist + origin↔tenant validation + api_key per tenant (22/22 clients) |
| A3 | CDN `cdn.vocalia.ma` non-existent | HIGH | All refs → direct vocalia.ma URLs |
| A4 | WordPress plugin (3 bugs) | HIGH | JS URL, CONFIG var, persona count fixed |
| A5 | V3 fake social proof | MEDIUM | `getDefaultSocialProofMessages()` removed |
| A6 | `email-service.cjs` missing | MEDIUM | Created (nodemailer, i18n 5 langs, RTL) |
| A7 | Gemini version inconsistency | LOW | Unified to gemini-3-flash |
| A8 | Permissions-Policy microphone | LOW | `microphone=()` → `microphone=(self)` |
| A9 | Documentation lies | LOW | Fixed VOCALIA_CONFIG init, removed false claims |

**Audit accuracy**: ~85% exact, ~10% partial, ~5% wrong. Audit errors documented: sub-widget @media exists, cart-recovery has role/aria, dashboard has real fetchWidgetAnalytics().

### Infrastructure (Verified)

| Component | Status |
|:----------|:------:|
| vocalia.ma | ✅ UP |
| api.vocalia.ma/health | ✅ UP (4 AI providers configured) |
| api.vocalia.ma/api/db/health | ✅ UP (Google Sheets connected, 7 tables) |
| VPS Hostinger (KVM 2) | ✅ Running (2 CPU, 8 GB, 148.230.113.163) |
| Docker containers (4) | ✅ All healthy (vocalia-api, db-api, realtime, telephony) |
| Non-deployed servers (4) | OAuth 3010, Webhook 3011, Remotion HITL 3012, MCP 3015 |
| Traefik reverse proxy | ✅ SSL/TLS auto (Let's Encrypt) |
| api.vocalia.ma/realtime/health | ✅ UP (7 voices, grok-realtime) |
| api.vocalia.ma/telephony/health | ✅ UP (Twilio configured) |
| Dockerfile + docker-compose (prod+staging) | ✅ Deployed (250.170: volumes + env vars added) |
| Distribution platforms | 5 (npm, shopify, wordpress, wix, zapier) |
| CI/CD (unit + exhaustive + i18n + coverage + tsc + Playwright) | ✅ Active |
| OpenAPI spec | ✅ 25 methods / 24 paths (validated 250.158) |
| Security headers (CSP, HSTS, X-Frame, Referrer, Permissions) | ✅ All set |
| CORS origin whitelist | ✅ Tenant-based (client_registry.json, 5-min TTL) |

---

## 3. P0-WEBSITE — Active Work

> **Source**: Validator v3.0 (`node scripts/validate-design-tokens.cjs`) — ALL patterns verified against docs/BUSINESS-INTELLIGENCE.md
> **Context**: Validator v2.3 (17 CSS checks) → v3.0 (23 checks: +6 business/factual). Old validator said "17/17 ALL CLEAR" while website had 64 factual errors.

### 3.1 Errors Found (64 total — FAIL)

| Rule | Count | Files | Description |
|:-----|:-----:|:------|:------------|
| ELIMINATED_PRODUCT | 6 | academie-business, features, index (Schema.org) | "Voice Widget B2C" — product ELIMINATED (merged into Pro 99€) |
| OLD_PRICING | 2 | investor.html (L167, L253) | "$0.06/min" — OLD non-viable price (8% margin → now $0.10-0.11) |
| UPTIME_CLAIM | 44 | 7 HTML + 5 locale files | "99.9%" — API backend NOT deployed, claim unverifiable |
| UNVERIFIED_METRIC | 12 | academie-business only (L521-L1073) | "Résultat mesuré" — 0 paying customers, nothing measured |

### 3.2 Warnings Found (44 total)

| Rule | Count | Files | Description |
|:-----|:-----:|:------|:------------|
| COMPETITIVE_CLAIM | 29 | about, investor, index, blog ×4, locale ×5 | "60% moins cher" TRUE for FR/EU, FALSE for Morocco ($0.83/min Twilio) |
| TELEPHONY_BASE_MISSING | 13 | about, academie, features, blog ×4, docs, dashboard | "0.10€/min" without mentioning 199€/month base fee |
| COMPONENT_COVERAGE | 2 | mentions-legales, voice-widget-b2c | Redirect pages — acceptable exception |

### 3.3 Additional Issues (Manual audit 250.160)

| Page | Issue | Detail |
|:-----|:------|:-------|
| academie-business L1540 | Math error | "~200€/mois (3000 min)" → correct: ~499€ |
| academie-business L1590 | Stale count | "parmi les 40 disponibles" → 38 |
| academie-business L1257 | Inconsistency | "Tier 1 (5)" but only 4 listed |
| academie-business L362 | Unverified | "+15% conversion moyenne" — 0 customers |
| academie-business L1550 | Wrong calc | "ROI 900%+" based on wrong math |
| features L258 | Unverified | "+15% conversion" — 0 customers |
| features L247 | Missing price | E-commerce "7 Widgets" no price shown |

### 3.4 Fix Plan

| Phase | Scope | Est. effort |
|:------|:------|:------------|
| Phase 1 | HTML errors: B2C→Pro, $0.06→$0.10, remove "Résultat mesuré", fix math | 3h |
| Phase 2 | 99.9% uptime: replace with honest claim in 7 HTML + 5 locales (44 occ) | 2h |
| Phase 3 | Warnings: qualify "60% cheaper", add 199€ base fee context | 2h |
| Phase 4 | Manual audit fixes (math, counts, unverified claims) | 1h |

**Status:** ✅ **ALL DONE** (250.161) — 64→0 errors, 44→2 warnings (redirect pages only). 23/23 checks pass. Darija $0.25/min implemented.

---

## 4. Business Priorities

> **Full details**: `docs/BUSINESS-INTELLIGENCE.md` (307 lines, verified Feb 2026)

### 4.1 Priority Matrix

| # | Action | Effort | Impact | Status |
|:-:|:-------|:-------|:-------|:------:|
| 1 | ~~Activate GA4~~ | ~~5min~~ | 52 events collecting data | ✅ 250.163 |
| 2 | Increase telephony price 0.06→0.10€ | Decision | Margin 8%→38% | ✅ 250.143 |
| 3 | Serve brotli via nginx | 30min | Transfer -84% B2B, -88% ECOM | ✅ 250.152 |
| 4 | Booking inline B2B | 3h | Conversion +30-40% (est.) | ✅ 250.140 |
| 5 | Evaluate Telnyx (Moroccan numbers) | 4h | Unblock Morocco, -50% PSTN | ❌ Research |
| 6 | Darija differentiated pricing $0.25/min | Decision | Eliminate Darija loss | ✅ 250.161 |
| 7 | Code-split ECOM widget | 4h | -55% initial load | ✅ 250.141 |
| 8 | STT fallback Firefox/Safari | 6h | +11% visitors | ✅ 250.140 |
| 9 | ~~Test Qwen3-TTS for Darija~~ | ~~8h~~ | ~~TTS cost -93%~~ | ✅ **CLOSED** — Mediocre results |

### 4.2 Cost Reality

| Product | Price | Cost/mo | Margin | Viable? |
|:--------|:------|:--------|:-------|:-------:|
| Starter | 49€/month | ~€3.50 | **93%** | ✅ |
| Pro | 99€/month | ~€5 | **95%** | ✅ |
| E-commerce | 99€/month | ~€6.50 | **93%** | ✅ |
| Telephony FR/EN/ES | 199€/mo + 0.10€/min | $0.06/min cost | **38%** | ✅ |
| **Telephony Darija** | **$0.25/min** (inbound) | $0.16/min cost | **36%** | ✅ |

**Darija cost breakdown**: Grok $0.05 + Twilio inbound $0.01 + ElevenLabs TTS $0.10 = **$0.16/min**
**Price**: $0.25/min (inbound only) → **margin 36%** ($0.09/min)
**Note**: Outbound to Morocco via Twilio = $0.83/min → economically impossible. Darija telephony = inbound ONLY.

### 4.3 Competitive Position

**Widget**: Voice-native widget with 5 languages. 49€ vs Intercom $39-139/seat. Different product (voice-first sales vs support platform).
**Telephony**: 0.10€/min vs Vapi 0.15-0.33€/min (up to 60% cheaper for EU market). Structural advantage: Grok bundles LLM+STT+TTS at ~$0.05/min.
**Market strategy (250.164)**: 1. Europe (FR+EUR) → 2. MENA (AR+USD) → 3. International (EN+USD) → 4. Morocco (FR+MAD). USP = price + widget+telephony unified, NOT Darija.
**Feature gaps vs Intercom/Crisp**: No help center, shared inbox, ticketing, email channel, file upload, WhatsApp. VocalIA ≠ support platform.

### 4.4 Funnel Status

| Element | Status |
|:--------|:------:|
| Newsletter | ✅ 250.144 — POST to /api/contact |
| Booking form | ✅ 250.144 — POST to /api/contact |
| Contact form | ✅ Backend + Google Sheets configured |
| GA4 | ✅ configured activated (250.163) — 80/80 pages |
| Social proof | ✅ 250.144 — honest tech metrics |
| Case studies | ⚠️ Fictional (labeled honestly) |

### 4.5 What NOT To Do

| Action | Reason |
|:-------|:-------|
| Lower widget price (<49€) | Margin excellent, below Crisp/Intercom |
| Compete with Intercom frontally | Missing 8+ features, 12+ months dev |
| Push Morocco telephony via Twilio | $0.83/min = economically impossible |
| ESM migration source modules | 78 conditional requires, too risky |
| CDN (cdn.vocalia.ma) | VPS + nginx + brotli sufficient |

---

## 5. Verified Metrics

> All data verified by command on 2026-02-08.

### 5.1 Code Metrics

| Métrique | Valeur | Commande |
|:---------|:------:|:---------|
| core/*.cjs | 36,090 lines / 55 files | `wc -l core/*.cjs` |
| widget/*.js | 10,621 lines / 7 files | `wc -l widget/*.js` |
| personas/ | 8,776 lines / 2 files | `wc -l personas/*.cjs personas/*.json` |
| telephony/ | 4,754 lines / 1 file | `wc -l telephony/*.cjs` |
| mcp-server/src/ | 17,628 lines / 31 files | `find mcp-server/src -name "*.ts"` |
| MCP tools | 203 (22 inline + 181 external) | `node --test test/mcp-server.test.mjs` |
| MCP resources | 6 (5 static + 1 template) | `grep -c "server.registerResource(" mcp-server/src/index.ts` |
| MCP prompts | 8 | `grep -c "server.registerPrompt(" mcp-server/src/index.ts` |
| Function tools | 25 | `grep -c "name: '" telephony/voice-telephony-bridge.cjs` |
| Personas | 38 | `grep -E "^\s+[A-Z_]+:\s*\{$" personas/voice-persona-injector.cjs | sort -u | wc -l` |
| HTML pages | 80 | `find website -name "*.html" | wc -l` |
| Registry clients | 22 | `jq 'keys | length' personas/client_registry.json` |
| i18n lines | 26,175 | `wc -l website/src/locales/*.json` |
| npm vulnerabilities | 0 | `npm audit --json` |
| innerHTML XSS risk | 0 | All dynamic data uses escapeHTML/textContent |

### 5.2 Tests

**TOTAL: 3,803 tests | 3,803 pass | 0 fail | 0 skip | ALL ESM (.mjs)** (Verified 250.171c)

Top test suites (by count):

| Suite | Tests | Quality |
|:------|:-----:|:-------:|
| security-utils | 148 | Real I/O |
| voice-api | 105 | Rebuilt 250.115 |
| db-api | 94 | Rebuilt 250.115 |
| widget | 92 | 3 bugs fixed 250.127 |
| mcp-server | 110 | Rebuilt 250.171c (tools+resources+prompts+logging) |
| telephony-pure | 76 | Real functions |
| persona-audit | 711 | 38 × 5 langs |

68 test files total. Coverage: 39.4% statements, 75.2% branches, 45.0% functions.
Theater tests: **0** typeof/exports (244 purged in 250.126, 20 purged in 250.114).

### 5.3 The 25 Function Tools

```
booking_confirmation    get_available_slots    get_services
browse_catalog          get_customer_tags      get_trips
check_item_availability get_item_details       get_vehicles
check_order_status      get_menu               handle_complaint
check_product_stock     get_packages           handle_objection
create_booking          get_recommendations    qualify_lead
                        schedule_callback      search_catalog
                        search_knowledge_base  send_payment_details
                        start_product_quiz     track_conversion_event
                        transfer_call
```

---

## 6. P0-DEEPAUDIT — 51 Bugs (39 Phase 2 + 12 Phase 3) | 12 Fixed (250.167)

> **Phase 2 (250.166)**: Line-by-line code review of all critical modules. 39 bugs after counter-audit.
> **Phase 3 (250.167)**: Internal audit — 14 bugs found, counter-audit reduced to 12 (C14 doublon of C2, H13 admin pages have auth).
> **Fixes (250.167)**: 12 bugs fixed (F8, C3, C4, C12, C13, H15, H16, H17, M12, M13, M14, M15). 39 remain.
> **Counter-audit accuracy**: Phase 2: 77% exact, 0% false. Phase 3: 86% exact (12/14), 14% false/doublon.

### 6.1 FATAL (6)

| # | Bug | File:Line | Impact |
|:-:|:----|:----------|:-------|
| F1 | ~~JWT_SECRET not in VPS env vars — random on each restart~~ | auth-service.cjs:23 | ✅ **FIXED 250.170** — JWT_SECRET=${JWT_SECRET} in docker-compose.production.yml (db-api + voice-api) |
| F2 | ~~Password reset token returned in API response~~ | auth-service.cjs:457 | ✅ **FIXED 250.168** — Token removed from response, sent via email |
| F3 | ~~Emails never sent — nodemailer NOT in package.json~~ | package.json, email-service.cjs:18 | ✅ **FIXED 250.168** — nodemailer ^6.10.1 + sendVerificationEmail + sendPasswordResetEmail |
| F4 | ~~/api/auth/resend-verification endpoint doesn't exist~~ | db-api.cjs (missing) | ✅ **FIXED 250.168** — Endpoint + resendVerificationEmail function added |
| F6 | ~~VOCALIA_VAULT_KEY absent from VPS env~~ | docker-compose.production.yml | ✅ **FIXED 250.170** — VOCALIA_VAULT_KEY=${VOCALIA_VAULT_KEY} in docker-compose (db-api + telephony) |
| F7 | ~~register() returns verify_token in response~~ | auth-service.cjs:248 | ✅ **FIXED 250.168** — Token removed from response (see F2 fix) |

### 6.2 CRITICAL (10)

| # | Bug | File:Line | Impact |
|:-:|:----|:----------|:-------|
| C1 | ~~Google OAuth button → OAuthGateway (port 3010) not deployed~~ | login.html:330 | ✅ **FIXED 250.168** — Button hidden by default, shown only if /oauth/health reachable |
| C2 | ~~Login doesn't check email_verified~~ | auth-service.cjs:255 | ✅ **FIXED 250.168** — EMAIL_NOT_VERIFIED error with 403 |
| C3 | ~~4 app pages without auth guards~~ | knowledge-base, telephony, onboarding, catalog | ✅ **FIXED 250.167** — Auth guards added to all 4 pages |
| C4 | ~~catalog.html uses `vocalia_auth` (incompatible)~~ | catalog.html | ✅ **FIXED 250.167** — Fixed to `vocalia_access_token` + `vocalia_user` |
| C5 | ~~knowledge-base.html wrong auth storage key~~ | knowledge-base.html | ✅ **FIXED 250.168** — `vocalia_token`→`vocalia_access_token` (3 occurrences + logout). No ESM issue found. |
| C6 | ~~Docker containers NO volumes — quota/data resets on restart~~ | docker-compose.production.yml | ✅ **FIXED 250.170** — Named volume vocalia-data with symlinks (data→/vocalia-data, clients→/vocalia-data/clients) |
| C7 | ~~StripeService customer_id save COMMENTED OUT~~ | StripeService.cjs:47 | ✅ **FIXED 250.168** — Uncommented, saves after customer creation |
| C8 | ~~stripe_customer_id NOT in GoogleSheetsDB schema~~ | GoogleSheetsDB.cjs:38-62 | ✅ **FIXED 250.168** — Added as 27th column in tenants schema |
| C10 | ~~Quota bypass: unknown tenant → getTenantConfig() returns null → checkQuota allows~~ | GoogleSheetsDB.cjs:721,776 | ✅ **FIXED 250.168** — Returns allowed:false for unknown tenants |
| C11 | ~~nodemailer not in package.json dependencies~~ | package.json:34-48 | ✅ **FIXED 250.168** — nodemailer ^6.10.1 added (see F3) |

### 6.3 HIGH (13)

| # | Bug | File:Line | Impact |
|:-:|:----|:----------|:-------|
| H1 | ~~db-api.cjs parseBody() NO body size limit~~ | db-api.cjs:273-286 | ✅ **FIXED 250.168** — MAX_BODY_SIZE = 1MB, req.destroy() on overflow |
| H2 | ~~STRIPE_SECRET_KEY absent from VPS~~ | docker-compose.production.yml | ✅ **FIXED 250.170** — STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY} in docker-compose (db-api) |
| H3 | ~~SMTP not configured on VPS~~ | docker-compose.production.yml | ✅ **FIXED 250.170** — SMTP_HOST/PORT/USER/PASS/FROM in docker-compose (db-api). Needs real values in .env |
| H4 | ~~db-client.js wrong API path (/db vs /api/db)~~ | db-client.js:13 | ✅ **FIXED 250.168** — /db→/api/db + Authorization header added |
| H5 | ~~WebSocket token passed in query string~~ | db-api.cjs:3000 | ✅ **FIXED 250.169** — Token via Sec-WebSocket-Protocol header or first auth message. Query string deprecated. |
| H6 | ~~GoogleSheetsDB update() reads STALE cache inside lock~~ | GoogleSheetsDB.cjs:432 | ✅ **FIXED 250.168** — invalidateCache() before findById inside lock |
| H7 | ~~GoogleSheetsDB at 26/26 columns (A:Z limit)~~ | GoogleSheetsDB.cjs:326,441 | ✅ **FIXED 250.168** — columnLetter() + sheetRange() support >26 columns |
| H8 | ~~Widget config injection via Object.assign(CONFIG, window.VOCALIA_CONFIG)~~ | voice-widget-v3.js:3584 | ✅ **FIXED 250.169** — safeConfigMerge() with SAFE_CONFIG_KEYS allowlist. API URLs cannot be overridden. |
| H9 | ~~Widget B2B LANG_PATH resolves on HOST domain~~ | voice-widget-b2b.js:70 | ✅ **FIXED 250.168** — Absolute URL to vocalia.ma for third-party sites |
| H10 | ~~Telephony HITL pending data lost on restart~~ | voice-telephony-bridge.cjs:388 | ✅ **ALREADY FIXED** — File persistence in data/voice/hitl-pending/pending-actions.json with atomic write |
| H12 | ~~Startup health check persona threshold stale (>=40 vs 38 actual)~~ | voice-api-resilient.cjs:3454 | ✅ **FIXED 250.168** — Threshold corrected to >= 38 |
| H13 (ex-F5) | ~~SecretVault static salt `'salt'` for scrypt~~ | SecretVault.cjs:56 | ✅ **FIXED 250.168** — Random 32-byte salt per op (v2 format + v1 backward compat) |
| H14 (ex-C9) | ~~Admin dashboard mrrGrowth hardcoded 18%~~ | voice-api-resilient.cjs:464 | ✅ **FIXED 250.169** — Calculated from actual previousMRR vs current MRR |

### 6.4 MEDIUM (10)

| # | Bug | File:Line | Impact |
|:-:|:----|:----------|:-------|
| M1 | ~~Language switcher doesn't reload translations on auth pages~~ | verify-email.html:280 | ✅ **FIXED 250.168** — initI18n(lang) + translatePage() on all 5 auth pages |
| M2 | ~~signup says "check email" but no email ever sent~~ | signup.html, auth-service.cjs | ✅ **RESOLVED by F3/C11** — nodemailer + sendVerificationEmail now wired. Works when SMTP configured on VPS. |
| M3 | ~~forgot-password always shows success (dead-end)~~ | forgot-password.html:238 | ✅ **RESOLVED by F3** — sendPasswordResetEmail wired. UX correct (always show success to prevent email enumeration). |
| M5 | Google Sheets as auth database (100 req/100s limit) | GoogleSheetsDB.cjs:16 | Scalability ceiling for user auth |
| M6 | ~~Dashboard metrics in-memory only — lost on restart~~ | voice-api-resilient.cjs:268 | ✅ **FIXED 250.169** — File persistence to data/metrics/dashboard-metrics.json, auto-save every 5 min |
| M8 | ~~GoogleSheetsDB ID: 8-char truncated UUID~~ | GoogleSheetsDB.cjs:203 | ✅ **FIXED 250.169** — 12 hex chars (collision prob ~1 in 281 trillion) |
| M9 | ~~Quota config (JSON) vs tenant data (Sheets) never synced~~ | GoogleSheetsDB.cjs:721 | ✅ **FIXED 250.170** — syncTenantPlan() + syncAllTenantPlans() + startQuotaSync() every 10 min. Sheets authoritative. /api/quota/sync admin endpoint. |
| M10 | ~~Payzone gateway "dead code"~~ | payzone-global-gateway.cjs | ❌ **NOT DEAD CODE** — BillingAgent uses it for MAD currency routing. Graceful error when credentials missing. Needs PAYZONE_* env vars. |
| M11 | ~~ElevenLabs require() OUTSIDE try/catch — missing module crashes process~~ | voice-telephony-bridge.cjs:58 | ✅ **FIXED 250.168** — Wrapped in try/catch, graceful null fallback |
| M12 (ex-H11) | ~~express in package.json but unused by deployed services~~ | package.json:42 | ❌ **NOT A BUG** — express IS used by OAuthGateway.cjs + WebhookRouter.cjs |

### 6.5 Systemic Patterns (Top 5)

1. ~~**Docker Ephemerality**~~ — ✅ **FIXED 250.170** — Named volume `vocalia-data` with symlinks. All 3 stateful services mount it.
2. **Auth Near-Functional** — JWT_SECRET + SMTP now in docker-compose. Needs actual .env values on VPS + SMTP provider (Brevo/Resend/SES).
3. ~~**Two Sources of Truth**~~ — ✅ **FIXED 250.170** — Quota sync every 10 min (Sheets→local). Sheets authoritative for plan data.
4. ~~**VPS Env Vars Incomplete**~~ — ✅ **FIXED 250.170** — All required env vars defined in docker-compose.production.yml. Needs .env file with real values on VPS.
5. **Code Exists ≠ Feature Deployed** — StripeService, BillingAgent, Payzone, OAuthGateway, WebhookRouter, EmailService = sophisticated code. Needs redeploy with new docker-compose + .env.

### 6.6 Phase 3 Internal Audit (250.167) — 12 Bugs (+1F, +2C, +4H, +5M)

> Counter-audit: 14 found → 12 confirmed. C14 (login email_verified) = doublon of C2. H13 (admin pages no auth) = FALSE (all 5 admin pages use `requireRole('admin')`).

#### FATAL (1) — ALL FIXED

| # | Bug | File:Line | Status |
|:-:|:----|:----------|:-------|
| F8 | Path traversal via tenantId in path.join() | conversation-store, audit-store, GoogleSheetsDB | ✅ **FIXED** — `sanitizeTenantId()` in voice-api-utils.cjs, imported in all 4 modules |

#### CRITICAL (2) — ALL FIXED

| # | Bug | File:Line | Status |
|:-:|:----|:----------|:-------|
| C12 | Tenant isolation absent on KB/Catalog/Conversations (6 endpoints) | db-api.cjs | ✅ **FIXED** — `user.tenant_id !== tenantId` check on all 6 endpoints |
| C13 | WebSocket grok-realtime zero auth — anyone can connect + inject instructions | grok-voice-realtime.cjs | ✅ **FIXED** — Origin+tenant validation, instruction injection removed from query params |

#### HIGH (4) — 2 FIXED, 1 MONITORING, 1 NON-FIXABLE

| # | Bug | File:Line | Status |
|:-:|:----|:----------|:-------|
| H15 | Rule-based fallback: "$0.25/min Darija" hardcoded + "4 offres" (should be 3) | voice-api-resilient.cjs | ✅ **FIXED** — Removed Darija price, changed to "0.10€/min", "3 offres" |
| H16 | ~~(merged into H15)~~ | — | ✅ **FIXED** |
| H17 | Monthly conversation purge never auto-executed | conversation-store.cjs | ✅ **FIXED** — Auto-schedule: check every 12h, purge on 1st of month |
| H14 | Gemini TTS model is `preview` (gemini-2.5-flash-preview-tts) | grok-voice-realtime.cjs | ⚠️ **MONITORING** — No stable version exists (verified Feb 2026) |

#### MEDIUM (5) — 4 FIXED, 1 NON-FIXABLE

| # | Bug | File:Line | Status |
|:-:|:----|:----------|:-------|
| M12 | Rate limiter Map no maxSize — unbounded memory from distributed IPs | auth-middleware.cjs | ✅ **FIXED** — RATE_LIMIT_MAX_ENTRIES = 10000 cap |
| M13 | WebSocket welcome message exposes user email | db-api.cjs | ✅ **FIXED** — Email removed from welcome payload |
| M14 | Inconsistent sanitization: ContextBox sanitizes, others don't | conversation-store, audit-store, GoogleSheetsDB | ✅ **FIXED** — All use shared `sanitizeTenantId()` (by F8 fix) |
| M15 | Audit hash truncated to 16 chars (low collision resistance) | audit-store.cjs | ✅ **FIXED** — 32 chars + chain hash (previous_hash field) |
| M16 | Gemini API key passed in URL query string (visible in logs) | grok-voice-realtime.cjs | ❌ **NON-FIXABLE** — Google standard pattern for Gemini API |

### 6.7 Phase 3b — Prompt Quality + Runtime Bugs (250.167)

| # | Bug | File:Line | Status |
|:-:|:----|:----------|:-------|
| H18 | AGENCY prompt hyper-restrictif ("15 mots max", "5 lignes max", tunnel vidéo) → réponses mécaniques | voice-persona-injector.cjs:79-262 | ✅ **FIXED** — Prompts réécrits 5 langs: naturels, connaissance sectorielle, multi-CTA |
| H19 | "4 offres" stale dans 5 prompts (devrait être 3 gammes de prix) | voice-persona-injector.cjs:98,135,172,209,246 | ✅ **FIXED** — "3 gammes: Starter, Pro/E-commerce, Telephony" |
| C14 | `VOICE_CONFIG` ReferenceError — variable non déclarée dans /respond handler | voice-api-resilient.cjs:2630 | ✅ **FIXED** — Removed, fallback direct à 'fr' |

### 6.9 Phase 4 Fixes (250.168) — 18 Bugs Fixed

| # | Bug | Fix |
|:-:|:----|:----|
| F2 | verify_token in register() response | Removed — token sent via email server-side |
| F3 | nodemailer NOT in package.json | Added nodemailer ^6.10.1 + sendVerificationEmail + sendPasswordResetEmail |
| F4 | /api/auth/resend-verification missing | Added endpoint in db-api.cjs + resendVerificationEmail in auth-service.cjs |
| F7 | reset_token in requestPasswordReset() | Removed — token sent via email server-side |
| C1 | Google OAuth → non-deployed OAuthGateway | Button hidden by default, shown only if /oauth/health reachable |
| C2 | Login skips email_verified | Added check: EMAIL_NOT_VERIFIED error with 403 |
| C7 | StripeService customer_id save COMMENTED OUT | Uncommented — now saves after customer creation |
| C8 | stripe_customer_id NOT in schema | Added to tenants.columns (27th column) |
| C10 | Quota bypass for unknown tenants | Returns allowed: false (was true with Infinity) |
| H1 | db-api parseBody() no body limit | Added MAX_BODY_SIZE = 1MB, req.destroy() on overflow |
| H4 | db-client.js wrong path + no auth | Fixed /db→/api/db + added Authorization header |
| H6 | GoogleSheetsDB update() stale cache | invalidateCache() before findById inside lock |
| H7 | GoogleSheetsDB A:Z limit (26 cols) | columnLetter() + sheetRange() support >26 columns |
| H9 | Widget B2B LANG_PATH host domain | Absolute URL to vocalia.ma for third-party sites |
| H12 | Persona health check 40→38 | Fixed threshold |
| H13 | SecretVault static salt | Random 32-byte salt per encryption (v2 format + v1 backward compat) |
| M1 | Language switcher no reload on auth | Added translatePage() call on 5 auth pages |
| M11 | ElevenLabs require outside try/catch | Wrapped in try/catch |

### 6.11 Phase 5 Fixes (250.169) — 8 Bugs Fixed/Resolved

| # | Bug | Fix |
|:-:|:----|:----|
| H5 | WebSocket token in query string | Token via Sec-WebSocket-Protocol header or first auth message. Query string backward compat (deprecated). |
| H8 | Widget config injection (Object.assign) | safeConfigMerge() with SAFE_CONFIG_KEYS allowlist — API URLs cannot be overridden |
| H10 | HITL pending data lost on restart | Already persisted to data/voice/hitl-pending/pending-actions.json (atomic write) |
| H14 | mrrGrowth hardcoded 18% | Calculated from actual previousMRR vs current MRR |
| M2 | Signup "check email" dead-end | Resolved by F3/C11 — sendVerificationEmail wired. Works when SMTP configured. |
| M3 | Forgot-password dead-end | Resolved by F3 — sendPasswordResetEmail wired. UX correct (anti-enumeration). |
| M6 | Dashboard metrics in-memory only | File persistence to data/metrics/dashboard-metrics.json, auto-save every 5 min |
| M8 | UUID 8-char truncated | 12 hex chars — collision probability ~1 in 281 trillion |

**Resolved (not bugs):**
- M10: Payzone is NOT dead code — BillingAgent routes MAD payments through it. Needs PAYZONE_* env vars.

### 6.12 Cumulative Bug Summary

| Phase | Total | Fixed | Remaining |
|:------|:-----:|:-----:|:---------:|
| Phase 2 (250.166) | 39 (6F+10C+13H+10M) | 39 | 0 |
| Phase 3 (250.167) | 12 (1F+2C+4H+5M) | 10 | 2 (H14 monitoring, M16 non-fixable) |
| Phase 3b (250.167) | 3 (1C+2H) | 3 | 0 |
| Phase 4 (250.168) | 0 (fixes only) | 20 | 0 |
| Phase 5 (250.169) | 0 (fixes only) | 8 | 0 |
| Phase 6 (250.170) | 0 (fixes only) | 6 | 0 |
| Phase 6b (250.170b) | 0 (fixes only) | 16 | 0 |
| Phase 7 EXTERNAL (250.171b) | 11 (3C+3H+3M+2L) | 7 | 0 (2 false alarm, 2 already fixed) |
| Phase 8 DEEP CODE (250.172) | 69 (3C+9H+52M+5L) | 60 | 9 |
| **Phase 9 COUNTER-AUDIT (250.173-174)** | **20 (2C+4H+12M+2L)** | **17** | **3** |
| **Phase 10 DEEP SYSTEM (250.175)** | **7 (1C+2H+4M)** | **7** | **0** |
| **Phase 11 ULTRA-DEEP (250.176)** | **9 (1H+5M+2H+1M)** | **9** | **0** |
| **CUMULATIVE** | **179** | **167** | **12** (+ 2 non-fixable/monitoring + 3 resolved-not-bugs + 4 false/dup) |

---

## 7. Résumé Exécutif — Plan d'Action

| Phase | Status | Tâches | Score |
|:------|:------:|:------:|:-----:|
| **P0 (original)** | ✅ **DONE** | 6/6 | 5.8 → 6.5 |
| **P0-NEW (250.115)** | ✅ **8/8 DONE** | Test quality rebuilt | 5.2 → 7.2 |
| **P1** | ✅ **DONE** | 7/7 | 6.5 → 7.0 |
| **P2** | ✅ **DONE** | 7/7 | 7.0 → 7.5 |
| **P0-WIDGET (250.128)** | ✅ **5/5 DONE** | XSS, CONFIG, branding | 7.4 → 8.6 |
| **P0-TENANT (250.129)** | ✅ **4/4 DONE** | Tenant system fixed | 8.6 → 7.2 |
| **P2-WIDGET (250.130-157)** | ✅ **3/3 DONE** | Shadow DOM, minification | 7.2 → 8.0 |
| **P3** | ✅ **5/5 DONE** | ESM, staging, k6, A2A, personas | 8.4 |
| **P0-AUDIT (250.153-155)** | ✅ **9/9 DONE** | All audit bugs + multi-tenant | 9.3 code / 3.0 prod |
| **P0-WEBSITE (250.161)** | ✅ **DONE** | 64→0 errors, 44→2 warnings | 23/23 ✅ |
| **P0-COMPONENTS (250.162)** | ✅ **DONE** | Dashboard→app redirect, validator full coverage | 23/23 ✅ (0 warnings) |
| **P0-MARKET (250.164)** | ✅ **DONE** | Europe-first repositioning, Darija normalized, geo-detection 6 markets | 23/23 ✅ (0 warnings) |
| **P0-DEEPAUDIT (250.166)** | ✅ **AUDIT DONE** | 39 bugs (6F/10C/13H/10M) — counter-audit applied | 8.8 → **6.6** |
| **P0-DEEPAUDIT-FIX (250.167)** | ✅ **15 FIXED** | Phase 3+3b: +15 bugs found, 15 fixed. Prompt quality rebuilt (5 langs), VOICE_CONFIG crash fixed. | 6.6 → **6.8** |
| **P0-DEEPAUDIT-FIX2 (250.168)** | ✅ **20 FIXED** | Auth security (F2/F7 tokens, C2 email verify, F4 resend endpoint), quota security (C10), billing wired (C7/C8), >26 col (H7), nodemailer (F3), SecretVault salt (H13), db-client (H4), B2B lang (H9), ElevenLabs (M11), auth i18n (M1), C5 auth key, C1 OAuth hidden. M12 resolved (not a bug). 19 remain. | 6.8 → **7.3** |
| **P0-DEEPAUDIT-FIX3 (250.169)** | ✅ **8 FIXED** | H5 WebSocket token via header (not query string), H8 widget config injection allowlist, H14 mrrGrowth from real data, H10 HITL already persisted, M6 dashboard metrics persistence, M8 UUID 8→12 chars, M2/M3 resolved by F3 email wiring, M10 not dead code. 11 remain. | 7.3 → **7.6** |
| **P0-INFRA (250.170)** | ✅ **6 FIXED** | C6 Docker volumes (named volume vocalia-data + symlinks), F1 JWT_SECRET in docker-compose, F6 VOCALIA_VAULT_KEY, H2 STRIPE_SECRET_KEY, H3 SMTP vars. M9 quota sync (Sheets→local every 10min). Admin dashboard: AI Fallback Chain visualization. 5 remain. | 7.6 → **8.0** |
| **P0-LIVE-AUDIT (250.171)** | ✅ **AUDIT** | Live deployment verified via curl: website 200, voice API health OK, db-api connected (Google Sheets 7 tables), auth works, /respond BROKEN (old code). Client dashboard: quota usage radials. Benchmark SWOT updated. Qwen3-TTS closed. | 8.0 → **8.1** |
| **P0-EXTERNAL-AUDIT (250.171b)** | ✅ **7 FIXED** | External audit: 11 bugs reported, 7 confirmed+fixed, 2 false alarm, 2 already fixed. C1 readBody crash (16 endpoints), C2 admin auth (7 endpoints), C3 tenant isolation (10 endpoints), H2 Gemini env fallback, H3 model name harmonized, M1 sheetsDB declared. | 8.1 → **8.5** |
| **P0-DEEPCODE (250.172)** | ✅ **60/69 FIXED** | Line-by-line audit ALL 55 core modules. 69 NEW bugs (3C/9H/52M/5L). All 3C + 9H fixed. 10 systemic fix categories ALL resolved. | 8.5 → 6.8 → **7.8** |
| **P0-COUNTER-AUDIT (250.173)** | ✅ **14/20 FIXED** | Counter-audit: 20 NEW bugs (2C/4H/12M/2L). All 2C + 4H fixed. JWT split-brain, token hashing, timing-safe comparison, rate limiter isolation. | **7.8** |
| **P0-DEEP-SYSTEM (250.175)** | ✅ **7/7 FIXED** | Deep system audit: 21 reported (~62% accurate), 7 confirmed+fixed. BillingAgent crash (this.gateway), ErrorScience constructor, WebhookRouter HMAC timing-safe + Klaviyo, ecommerce cache bound, EventBus dedup. | **8.4** |
| **P0-ULTRA-DEEP (250.176)** | ✅ **9/9 FIXED** | Ultra-deep codebase audit: telephony DATA_DIR path outside project (D1), 4 function tool handlers missing return → Grok gets undefined output (D2-D5), OAuthGateway XSS in success+error callbacks (D6-D7), auth-service JSON.parse preferences crash (D8), remotion-hitl JSON.parse audit log crash (D9). | **8.5** |

**Code Completeness: 8.5/10** | **Production Readiness: 4.0/10** | **Weighted: 8.3/10** | **MCP: 9.0/10**

**Remaining (12 unfixed bugs):**
```
P1 (SHOULD FIX — Low priority):
  1. NL2: Anthropic model ID — already verified correct in 250.171b
  2. ~8 remaining MEDIUM from Phase 8 (minor edge cases in non-core modules)
  3. GoogleSheetsDB auth scalability ceiling [M5] — architecture limit, not a bug

P2 (NICE TO HAVE — Research):
  4. Evaluate Telnyx for Moroccan telephony

FIXED in 250.173b-175:
  - NM2: ✅ FIXED — Adapter pattern (integrations/ wraps core/) [250.173b]
  - NM7: ✅ FIXED — Shared tenant-cors.cjs module (80 lines deduped) [250.174]
  - NM10: ✅ FIXED — express.json({ limit: '1mb' }) [250.173b]
  - N1: ✅ FIXED — BillingAgent this.gateway→this.stripe [250.175]
  - N2: ✅ FIXED — ErrorScience errorBuffer in constructor [250.175]
  - N3: ✅ FIXED — WebhookRouter 3 timing-safe HMAC comparisons [250.175]
  - N4: ✅ FIXED — Klaviyo webhook HMAC-SHA256 verification [250.175]
  - N5: ✅ FIXED — BillingAgent currency variable scoping [250.175]
  - N6: ✅ FIXED — voice-ecommerce connectors MAX_CONNECTORS=50 [250.175]
  - N10: ✅ FIXED — AgencyEventBus duplicate ContextBox subscriptions removed [250.175]
  - D1: ✅ FIXED — Telephony DATA_DIR path.join('../../../data') → path.join('..', 'data') [250.176]
  - D2: ✅ FIXED — handleQualifyLead() missing return → Grok gets undefined output [250.176]
  - D3: ✅ FIXED — handleScheduleCallback() missing return [250.176]
  - D4: ✅ FIXED — handleTrackConversion() missing return [250.176]
  - D5: ✅ FIXED — handleCreateBookingInternal() missing return [250.176]
  - D6: ✅ FIXED — OAuthGateway XSS: tenantId unescaped in success HTML [250.176]
  - D7: ✅ FIXED — OAuthGateway XSS: error.message unescaped in error HTML [250.176]
  - D8: ✅ FIXED — auth-service JSON.parse(user.preferences) without try/catch [250.176]
  - D9: ✅ FIXED — remotion-hitl JSON.parse(line) in .map() without try/catch [250.176]

NON-FIXABLE / MONITORING:
  - H14b: Gemini TTS preview model (no stable version exists)
  - M16: Gemini API key in URL (Google standard pattern)
```

**Live Deployment Status (VERIFIED 250.171 via curl):**
```
✅ vocalia.ma            → Website live, all pages 200
✅ api.vocalia.ma/health → Voice API running (4 AI providers configured:true)
✅ api.vocalia.ma/api/db/health → DB API connected (Google Sheets: 7 sheets)
✅ api.vocalia.ma/api/auth/login → Auth endpoint works (returns proper errors)
❌ api.vocalia.ma/respond → BROKEN — "VOICE_CONFIG is not defined" (C14 bug, fixed locally 250.167, NOT redeployed)
✅ Widget v2.7.0 → Loaded from homepage (72KB b2b kernel)

.env LOCAL: 12 keys SET (XAI, Gemini, Anthropic, ElevenLabs, Twilio, Google OAuth)
.env MISSING: JWT_SECRET, SMTP_HOST/USER/PASS, STRIPE_SECRET_KEY, VOCALIA_VAULT_KEY
```

**Next Actions (Priority Order):**
```
⚠️ OPERATIONS — CRITICAL (NOT code):
  1. VPS REDEPLOY: /respond BROKEN on production — local code has ALL fixes since 250.167
     → git pull + docker-compose up on VPS = instant fix for 83+ bugs
  2. VPS .env: Create .env with JWT_SECRET, SMTP_HOST/USER/PASS, STRIPE_SECRET_KEY, VOCALIA_VAULT_KEY
  3. SMTP provider: Brevo/Resend/SES — email verification + password reset depend on it
  4. First paying customer → first real traffic → validate entire stack

CODE — LOW PRIORITY (~1h):
  5. Fix remaining ~8 MEDIUM edge cases from Phase 8 (non-core modules)
  6. Integration tests for fixed security patterns (JWT chain, token hashing, timing-safe)

BUSINESS:
  8. Evaluate Telnyx for Moroccan telephony (cheaper than Twilio $0.83/min)
  9. GA4 data review (52 events configured, collecting since 250.163)
```

### 6.13 Phase 6 Fixes (250.170) — 6 Bugs Fixed + Dashboard Enhancement

| # | Bug | Fix |
|:-:|:----|:----|
| C6 | Docker NO volumes — data lost on restart | Named volume `vocalia-data` with local driver. db-api, voice-api, telephony all mount it. Symlink approach: `ln -sf /vocalia-data data` |
| F1 | JWT_SECRET not in VPS env | Added `JWT_SECRET=${JWT_SECRET}` to db-api + voice-api in docker-compose.production.yml |
| F6 | VOCALIA_VAULT_KEY absent | Added `VOCALIA_VAULT_KEY=${VOCALIA_VAULT_KEY}` to db-api + telephony |
| H2 | STRIPE_SECRET_KEY absent | Added `STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}` to db-api |
| H3 | SMTP not configured | Added SMTP_HOST/PORT/USER/PASS/FROM to db-api |
| M9 | Quota JSON vs Sheets never synced | syncTenantPlan() + syncAllTenantPlans() + startQuotaSync() every 10min. /api/quota/sync admin endpoint. Sheets authoritative. |

**Dashboard Enhancement:**
- Admin dashboard: AI Fallback Chain visualization — 5-card layout (Grok→Gemini→Claude→Atlas→Local rule-based) with status indicators, model names, and capability descriptions.

### 6.14 Phase 6b Deep Audit Fixes (250.170b) — 16 Bugs Found + Fixed

| # | Severity | Bug | Fix |
|:-:|:--------:|:----|:----|
| B1 | CRITICAL | `VocaliaGeo.getGeo()` doesn't exist — 50+ pages broken | Added `getGeo: detect` alias in geo-detect.js |
| B2 | CRITICAL | 7 Traefik PathPrefix missing for db-api | Added /api/{telephony,recommendations,leads,cart-recovery,promo,quota,ucp} to docker-compose |
| B3 | CRITICAL | PRICING_TABLE stale: b2c eliminated, ecom 149→99, overage 0.06→0.10, key mismatch | Fixed keys to {starter,pro,ecom,telephony}, updated all values |
| B4 | HIGH | voice-es.json 3× "0,06EUR/min" | Changed to 0,10EUR/min |
| B5 | HIGH | voice-en.json "$99/month" | Changed to $49/month |
| B6 | HIGH | voice-es.json "99EUR/mes" | Changed to 49EUR/mes |
| B7 | HIGH | Darija prompt "Enterprise" plan (doesn't exist) | Fixed to Starter 490 / Pro+Ecom 990 / Telephony 1990 |
| B8 | HIGH | "n°1 au Maroc" / "#1 solution" (0 customers) | Replaced with factual "multilingual Voice AI with Darija support" |
| B9 | HIGH | "soporte exclusivo Darija" as USP | Replaced with "Darija support for the Moroccan market" |
| B10 | MEDIUM | README stale (250.94, v7.2.0, 40 personas, 76 pages) | Updated to 250.170, v2.7.0, 38 personas, 80 pages |
| B11 | MEDIUM | remotion OnboardingVideo "40 personas" | Changed to 38 |
| B12 | MEDIUM | remotion PricingExplainer "40 personas" | Changed to 38 |
| B13 | MEDIUM | voice-ary.json 499 MAD (should be 490) | Fixed to 490 |
| B14 | LOW | Widget code-split refs .min.js (WAF blocks) | Changed to .js in widget source + 2 deployed copies + 2 scripts |
| B15 | LOW | Dead .min.js files in voice-assistant/ | Build artifact — WAF blocks, non-functional. Noted only. |
| B16 | LOW | pricing.html `geo.pricing` undefined | Added inline pricingMap lookup from currency |

### 6.15 Phase 8 — Deep Code Audit (250.172) — 69 Bugs Found, 60 Fixed (250.172-173)

> **Source**: Line-by-line audit of ALL 55 core modules + telephony + lib/security-utils.
> **Method**: Read every module, cross-reference systemic patterns (grep sanitizeTenantId, process.cwd, path.join.*tenantId).
> **Result**: 69 bugs (3C/9H/52M/5L). 10 systemic fix categories identified.
> **Fixes (250.172-173)**: 60 of 69 fixed. All 3 CRITICAL, all 9 HIGH, ~48 MEDIUM fixed. 9 remaining (see §6.18).

#### CRITICAL (3) — ALL FIXED

| # | Bug | File:Line | Status |
|:-:|:----|:----------|:-------|
| C1-P8 | Module-level `new GoogleGenerativeAI()` crashes process if API key missing | product-embedding-service.cjs:26-27 | ✅ **FIXED** — Lazy init with `getModel()` function |
| C2-P8 | Same module-level crash pattern | knowledge-embedding-service.cjs:18-19 | ✅ **FIXED** — Same lazy init pattern |
| C3-P8 | Compliance severity check `=== 'HIGH'` skips CRITICAL violations | compliance-guardian.cjs:60 | ✅ **FIXED** — Includes CRITICAL in severity check |

#### HIGH (9) — ALL FIXED

| # | Bug | File:Line | Status |
|:-:|:----|:----------|:-------|
| H1-P8 | Wrong path + no tenantId sanitization | TenantContext.cjs:33 | ✅ **FIXED** — `__dirname` + `sanitizeTenantId()` |
| H2-P8 | Push to undefined `pricingHistory` array | RevenueScience.cjs:250 | ✅ **FIXED** — Array initialized before push |
| H3-P8 | Wrong return type (object vs expected format) | RevenueScience.cjs:220-222 | ✅ **FIXED** — Correct return structure |
| H4-P8 | Wrong argument order in function call | recommendation-service.cjs:722 | ✅ **FIXED** — Arguments reordered |
| H5-P8 | Wrong path depth `../../..` from core/ resolves to ~/Desktop/ | voice-agent-b2b.cjs:125 | ✅ **FIXED** — `__dirname + '/..'` |
| H6-P8 | Same wrong path depth pattern | marketing-science-core.cjs:216 | ✅ **FIXED** — `__dirname + '/..'` |
| H7-P8 | 6 catalog classes: no tenantId sanitization on path.join | catalog-connector.cjs (6 classes) | ✅ **FIXED** — `sanitizeTenantId()` on all 6 classes |
| H8-P8 | No tenantId sanitization on 2 path operations | SecretVault.cjs:44,216 | ✅ **FIXED** — `sanitizeTenantId()` on both paths |
| H9-P8 | Regex `/non/gi` replaces substrings within words | translation-supervisor.cjs:268 | ✅ **FIXED** — Word boundary `\b` regex |

#### MEDIUM (52) — ~43 Fixed, ~9 Remaining

| Category | Count | Status | Description |
|:---------|:-----:|:------:|:------------|
| sanitizeTenantId missing | ~20 | ✅ **ALL FIXED** | 20+ modules, 30+ sites now use `sanitizeTenantId()` from voice-api-utils.cjs |
| process.cwd() | 13 | ✅ **ALL FIXED** | 11 modules, 15 sites → `__dirname`-based paths |
| Unbounded caches | ~8 | ✅ **MOSTLY FIXED** | a2ui-service (maxSize 200), product-embedding (maxTenantCaches 50). Some minor caches remain |
| parseBody no body limit | 1 | ✅ **FIXED** | remotion-hitl.cjs + ab-analytics.cjs: 1MB max body |
| Hardcoded local paths | 2 | ✅ **FIXED** | stitch-api.cjs → env vars + os.homedir() |
| conversation-store partial | 4 | ✅ **FIXED** | All 4 methods now use sanitizeTenantId |
| Business defaults | ~4 | ✅ **FIXED** | B2C→B2B defaults, free→starter plan, Shopify API 2024→2026 |
| **Remaining (~9)** | ~9 | ❌ | NM2 duplicate voice-ecommerce-tools, NM7 CORS duplication, NM10 WebhookRouter 100kb, ~6 minor edge cases |

#### LOW (5)

Minor issues including stale comments, unused variables, and non-critical code style inconsistencies.

#### 10 Systemic Fix Categories — ALL RESOLVED (250.172-173)

| # | Category | Scope | Status |
|:-:|:---------|:------|:------:|
| 1 | **Import sanitizeTenantId in all path.join modules** | 20+ modules, 30+ sites | ✅ **DONE** |
| 2 | **Replace process.cwd() with __dirname** | 11 modules, 15 sites | ✅ **DONE** |
| 3 | **Module-level init → lazy init with null check** | 2 embedding services | ✅ **DONE** |
| 4 | **Compliance severity hierarchy** (includes CRITICAL) | 1 module | ✅ **DONE** |
| 5 | **Fix wrong path depths ../../..** | 2 modules | ✅ **DONE** |
| 6 | **Add TTL + maxSize to all caches** | a2ui, product-embedding | ✅ **MOSTLY DONE** |
| 7 | **parseBody body size limit** | remotion-hitl + ab-analytics | ✅ **DONE** |
| 8 | **Hardcoded paths → config-based** | stitch-api.cjs | ✅ **DONE** |
| 9 | **Regex word boundaries `\b`** | translation-supervisor.cjs | ✅ **DONE** |
| 10 | **conversation-store: sanitize all 4 remaining methods** | conversation-store.cjs | ✅ **DONE** |

#### Modules Audited (55 core + telephony + lib)

**Clean modules** (no significant bugs):
grok-voice-realtime.cjs, remotion-service.cjs, stitch-to-vocalia-css.cjs, lib/security-utils.cjs

**Partially clean** (1-2 minor issues):
GoogleSheetsDB.cjs (uses sanitizeTenantId properly), remotion-hitl.cjs (parseBody no limit), client-registry.cjs (process.cwd + no sanitization)

**Systemic issues** (affected by pattern #1 or #2):
All modules listed in MEDIUM category above.

---

### 6.16 Phase 9 — Counter-Audit (250.173) — 20 NEW Bugs Found, 14 Fixed

> **Source**: Counter-audit "AUDIT PROFOND 250.173 — NOUVEAUX BUGS NON COUVERTS PAR 250.172"
> **Counter-audit accuracy**: 9/10 — 18/20 bugs confirmed factually, 2 partially confirmed.
> **Result**: 2C + 4H + 12M + 2L. 14 fixed (2C + 4H + 8M), 6 remaining (4M + 2L).

#### CRITICAL (2) — ALL FIXED

| # | Bug | File | Fix |
|:-:|:----|:-----|:----|
| NC1 | JWT secret split-brain: auth-service random secret ≠ voice-api ENV.JWT_SECRET | voice-api-resilient.cjs | ✅ **FIXED** — Imports shared `AUTH_CONFIG.jwt.secret` from auth-service.cjs |
| NC2 | Password reset/verify tokens stored PLAINTEXT (refresh tokens were hashed) | auth-service.cjs (5 sites) | ✅ **FIXED** — All tokens now SHA-256 hashed before storage + hash-then-compare on verify |

#### HIGH (4) — ALL FIXED

| # | Bug | File | Fix |
|:-:|:----|:-----|:----|
| NH1 | WebSocket `let user` block-scoped → ReferenceError in message handler | db-api.cjs | ✅ **FIXED** — `clientData.user?.role` instead of block-scoped `user` |
| NH2 | Rate limiters share single global Map → cross-contamination | auth-middleware.cjs | ✅ **FIXED** — Per-limiter isolated `new Map()` + `_allRateLimitStates` array for cleanup |
| NH3 | API key comparison via `===` → timing attack vulnerable | voice-api-resilient.cjs + db-api.cjs | ✅ **FIXED** — `crypto.timingSafeEqual()` on both APIs |
| NH4 | Fail-open pattern: registry not loaded → validation returns valid:true | voice-api-resilient.cjs + db-api.cjs | ✅ **FIXED** — `console.warn()` for fail-open cases. !origin intentional (server-to-server). |

#### MEDIUM (12) — 8 Fixed, 4 Remaining

| # | Bug | Status |
|:-:|:----|:------:|
| NM1 | ab-analytics.cjs no body size limit | ✅ **FIXED** — 1MB max |
| NM2 | Duplicate voice-ecommerce-tools.cjs (core/ vs integrations/) | ✅ **FIXED 250.173b** — Adapter pattern: integrations/ wraps core/ |
| NM3 | Telephony .env path `../../../.env` (wrong depth) | ✅ **FIXED** — Only `../.env` |
| NM4 | Stitch-api QUOTA_PROJECT hardcoded | ✅ **FIXED** (by stitch-api env var refactor) |
| NM5 | register() accepts `role` param → privilege escalation | ✅ **FIXED** — Force `role = 'user'` |
| NM6 | Inline sanitization instead of canonical sanitizeTenantId() | ✅ **FIXED** — All sites use shared function |
| NM7 | CORS/tenant code duplication (~80 lines) voice-api ↔ db-api | ✅ **FIXED 250.174** — Shared tenant-cors.cjs module |
| NM8 | ErrorScience /tmp as default logDir | ✅ **FIXED** — `logs/analytics` |
| NM9 | ErrorScience unbounded file read for large logs | ✅ **FIXED** — 10MB cap on file reads |
| NM10 | WebhookRouter express.json() default 100kb limit | ✅ **FIXED 250.173b** — express.json({ limit: '1mb' }) |
| NM11 | voice-agent-b2b "Free tier available" in prompt | ✅ **FIXED** — "Plans start at 49€/month with 14-day trial" |
| NM12 | Stitch-api project ID hardcoded | ✅ **FIXED** — env var `STITCH_QUOTA_PROJECT` |

#### LOW (2) — Both Remaining

| # | Bug | Status |
|:-:|:----|:------:|
| NL1 | res.writeHead after req.destroy (6 sites) | ✅ **FIXED** — writeHead before destroy, wrapped in try/catch |
| NL2 | Anthropic model ID `claude-opus-4-5-20251101` unverified | ❌ Remaining — Already verified correct in 250.171b |

### 6.18 Remaining Bugs (12 — post 250.174)

| # | Source | Bug | Severity | Notes |
|:-:|:------:|:----|:--------:|:------|
| ~~1~~ | ~~NM2~~ | ~~Duplicate voice-ecommerce-tools.cjs~~ | ~~MEDIUM~~ | ✅ **FIXED 250.173b** — Adapter pattern |
| ~~2~~ | ~~NM7~~ | ~~CORS/tenant code duplication~~ | ~~MEDIUM~~ | ✅ **FIXED 250.174** — Shared tenant-cors.cjs |
| ~~3~~ | ~~NM10~~ | ~~WebhookRouter 100kb limit~~ | ~~MEDIUM~~ | ✅ **FIXED 250.173b** — 1mb limit |
| 4 | NL2 | Anthropic model ID unverified | LOW | Already verified correct in 250.171b |
| 5 | M5 | GoogleSheetsDB as auth database (100 req/100s) | MEDIUM | Architecture limit, not a bug |
| 6-12 | P8 | ~8 remaining MEDIUM from 250.172 | MEDIUM/LOW | Minor edge cases in non-critical modules |

**Non-fixable / Monitoring:**
- H14b: Gemini TTS `gemini-2.5-flash-preview-tts` (no stable version, Feb 2026)
- M16: Gemini API key in URL query string (Google standard pattern)

### 6.19 Phase 7 — External Audit (250.171b) — 11 Bugs Reported, 7 Confirmed + Fixed

> **Source**: External audit report "AUDIT PROFOND 250.171b"
> **Counter-audit accuracy**: 64% confirmed (7/11), 18% false alarm (2/11), 18% already fixed (2/11)

| # | Severity | Bug | Verdict | Fix |
|:-:|:--------:|:----|:-------:|:----|
| C1-NEW | CRITICAL | `readBody` called 16× in db-api.cjs but only `parseBody` exists — 16 POST endpoints crash | **CONFIRMED** | Replaced all 16 occurrences with `parseBody` |
| C2-NEW | CRITICAL | 7 `/admin/*` endpoints in voice-api-resilient.cjs have ZERO auth | **CONFIRMED** | Added `checkAdminAuth(req, res)` (JWT + admin role) to all 7 endpoints |
| C3-NEW | CRITICAL | Tenant isolation missing on KB + Catalog endpoints | **CONFIRMED (10 endpoints)** | Added `user.tenant_id !== tenantId` check on 6 KB + 4 Catalog endpoints. KB stats now admin-only. |
| H1-NEW | HIGH | Claude model ID `claude-opus-4-5-20251101` invalid | **FALSE ALARM** | Verified via anthropic.com — `claude-opus-4-5-20251101` is the correct ID |
| H2-NEW | HIGH | Gemini env var: 2 code paths use only `GOOGLE_GENERATIVE_AI_API_KEY`, docker passes `GEMINI_API_KEY` | **CONFIRMED** | Added `\|\| process.env.GEMINI_API_KEY` fallback to both paths (L1811, L3344) |
| H3-NEW | HIGH | `gemini-3-flash` vs `gemini-3.0-flash` inconsistency | **CONFIRMED** | Harmonized to `gemini-3-flash` in llm-global-gateway.cjs (matches REST API) |
| M1-NEW | MEDIUM | `sheetsDB` implicit global (no `let`/`const` declaration) | **CONFIRMED** | Added `let sheetsDB = null;` at module level in voice-api-resilient.cjs |
| M2-NEW | MEDIUM | nodemailer GHSA-mm7p-fcc7-pg87 vulnerability | **FALSE ALARM** | Root `^6.10.1` >= fix version (6.10.0), mcp `^7.0.13` also patched |
| M3-NEW | MEDIUM | Factuality regex in `.claude/rules/factuality.md` fragile | **LOW PRIORITY** | Internal dev tooling, not runtime code. No fix needed. |
| L1-NEW | LOW | Core line count stale (35,368) | **ALREADY FIXED** | Updated to 36,090 earlier in session |
| L2-NEW | LOW | Widget line count stale (10,598) | **ALREADY FIXED** | Updated to 10,621 earlier in session |

**Security hardening summary (250.171b):**
- 16 POST endpoints restored from certain crash (readBody→parseBody)
- 7 admin endpoints now require JWT + admin role
- 10 tenant-scoped endpoints now enforce `user.tenant_id !== tenantId`
- 1 global stats endpoint now requires admin auth
- Gemini API key fallback chain prevents production failures
- Module-level variable prevents implicit global pollution

**Methodology:**
- Tests scored by BUG DETECTION CAPABILITY, not pass rate
- Architecture scored by DEPLOYED output, not source code quality
- Tenant system scored by ACTUAL FUNCTIONALITY on vocalia.ma
- Widget system scored by INTEGRATION COMPLETENESS
- ESM scored by ACTUAL PASSING TESTS after conversion
- CI scored by GATE COMPLETENESS

---

*Document mis a jour le 2026-02-09 — Session 250.174*
*Changelog: sessions 250.153→174 (19 sessions, 163 bugs found, 151 fixed, 12 unfixed). Details: `memory/session-history.md`*
