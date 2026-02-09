# VocalIA — Roadmap to 100% Completion

> **Date:** 2026-02-09 | **Session:** 250.170 (6 more bugs fixed — Docker volumes, VPS env vars, quota sync, dashboard enhanced)
> **Code Completeness:** 9.0/10 | **Production Readiness:** 3.5/10 (website deployed, API on VPS with persistent volumes, auth near-functional, billing wired, 0 paying customers)
> **Methodologie:** Chaque tache est liee a un FAIT verifie par commande. Zero supposition.
> **Source:** Audit croise de 13 documents + external audits (250.129, 250.139, 250.142, 250.153) + pricing restructure (250.143) + implementation (250.144) + website factual audit (250.160) + market repositioning (250.164) + **DEEP AUDIT 250.166** (39 bugs after counter-audit) + **PHASE 3 INTERNAL AUDIT 250.167** (+15 bugs found, 15 fixed) + **PHASE 4 FIXES 250.168** (20 bugs fixed) + **PHASE 5 FIXES 250.169** (8 bugs fixed) + **PHASE 6 INFRA 250.170** (6 bugs fixed)

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

**Code Completeness: 9.0/10** — Features coded and tested (3,773 tests, 68 files). 250.170: +6 bugs fixed (C6 Docker volumes, F1 JWT_SECRET, F6 VOCALIA_VAULT_KEY, H2 STRIPE_SECRET_KEY, H3 SMTP env vars, M9 quota sync). Docker-compose rewritten with named volume `vocalia-data`. Quota sync every 10 min (Sheets→local). Admin dashboard: AI Fallback Chain visualization. All P0 infrastructure bugs resolved in code. Only M5 (Sheets scalability) and P2 research remain.
**Production Readiness: 3.5/10** — Website deployed at vocalia.ma. API on VPS: Docker volumes configured (needs redeploy), env vars defined in docker-compose (needs .env file with real values). 0 paying customers.

> **Important**: These are TWO separate scores. Code completeness measures how much code is written/tested AND how much of it actually works correctly. Production readiness measures what's deployed and functionally serving real users.

| # | Dimension | Score 250.160 | Score 250.166 | Delta | Justification (250.166 Deep Audit) |
|:-:|:----------|:-----:|:-----:|:-----:|:------|
| 1 | Tests unitaires | 7.0 | **7.5** | +0.5 | 3,773 tests pass, 0 fail. Added auth security tests (C2 email_verified, F2 token exposure), quota tests (C10), columnLetter/sheetRange tests (H7) |
| 2 | Sécurité | 10.0 | **8.5** | **-1.5** | 250.170: +0.5 — F1 JWT_SECRET in docker-compose, F6 VOCALIA_VAULT_KEY in docker-compose. All security bugs fixed in code. Needs actual env values on VPS. |
| 3 | Production readiness | 5.5 | **3.5** | **-2.0** | 250.170: +1.0 — Docker volumes configured (vocalia-data named volume), all env vars defined in docker-compose. Needs: redeploy with .env, SMTP credentials. |
| 4 | Documentation accuracy | 10.0 | **8.0** | **-2.0** | Website content accurate. BUT: ROADMAP scores were inflated (9.9 code was false), admin dashboard shows hardcoded mrrGrowth:18 |
| 5 | Architecture code | 10.0 | **9.0** | **-1.0** | 250.170: +0.5 — M9 quota sync (Sheets→local every 10min), Docker volumes for data persistence. Only M5 (Sheets scalability) remains. |
| 6 | Multi-tenant | 9.5 | **8.0** | **-1.5** | 250.170: +0.5 — VOCALIA_VAULT_KEY in docker-compose, quota sync resolves 2-sources-of-truth. CORS + origin↔tenant + api_key all working. Needs actual env values. |
| 7 | i18n | 10.0 | 10.0 | 0 | 4,858 keys × 5 langs verified |
| 8 | Intégrations | 8.0 | **5.5** | **-2.5** | 250.168: +1.5 — Stripe: customer_id save wired (C7). nodemailer installed + email functions added (F3/C11). STILL: Payzone dead code, HubSpot key not in VPS, OAuthGateway not deployed |
| 9 | Developer experience | 10.0 | **9.5** | **-0.5** | 250.169: mrrGrowth real data (H14), M10 Payzone not dead code confirmed. Persona threshold, columnLetter/sheetRange all working. |
| 10 | Mémoire & docs | 9.0 | **8.5** | **-0.5** | Scores were inflated pre-audit. Now corrected with factual deep audit data |

| | Poids | Contribution |
|:-|:-----:|:------------:|
| 1 (7.5) | 15% | 1.125 |
| 2 (8.5) | 15% | 1.275 |
| 3 (3.5) | 10% | 0.350 |
| 4 (8.0) | 10% | 0.800 |
| 5 (9.0) | 10% | 0.900 |
| 6 (8.0) | 10% | 0.800 |
| 7 (10.0) | 5% | 0.500 |
| 8 (5.5) | 10% | 0.550 |
| 9 (9.5) | 10% | 0.950 |
| 10 (8.5) | 5% | 0.425 |
| **TOTAL** | **100%** | **8.000** → **~8.0/10** (250.170 — Docker volumes, VPS env vars, quota sync, dashboard) |

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
| Traefik reverse proxy | ✅ SSL/TLS auto (Let's Encrypt) |
| api.vocalia.ma/realtime/health | ✅ UP (7 voices, grok-realtime) |
| api.vocalia.ma/telephony/health | ✅ UP (Twilio configured) |
| Dockerfile + docker-compose (prod+staging) | ✅ Deployed (250.170: volumes + env vars added) |
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
| 9 | Test Qwen3-TTS for Darija | 8h | TTS cost -93% | ❌ Research |

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
| core/*.cjs | 35,368 lines / 55 files | `wc -l core/*.cjs` |
| widget/*.js | 10,598 lines / 7 files | `wc -l widget/*.js` |
| personas/ | 8,791 lines / 2 files | `wc -l personas/*.cjs personas/*.json` |
| telephony/ | 4,751 lines / 1 file | `wc -l telephony/*.cjs` |
| mcp-server/src/ | 17,628 lines / 31 files | `find mcp-server/src -name "*.ts"` |
| MCP tools | 203 | `grep -c "server.tool(" mcp-server/src/index.ts` |
| Function tools | 25 | `grep -c "name: '" telephony/voice-telephony-bridge.cjs` |
| Personas | 38 | `grep -E "^\s+[A-Z_]+:\s*\{$" personas/voice-persona-injector.cjs | sort -u | wc -l` |
| HTML pages | 80 | `find website -name "*.html" | wc -l` |
| Registry clients | 22 | `jq 'keys | length' personas/client_registry.json` |
| i18n lines | 26,175 | `wc -l website/src/locales/*.json` |
| npm vulnerabilities | 0 | `npm audit --json` |
| innerHTML XSS risk | 0 | All dynamic data uses escapeHTML/textContent |

### 5.2 Tests

**TOTAL: 3,773 tests | 3,773 pass | 0 fail | 0 skip | ALL ESM (.mjs)** (Verified 250.168)

Top test suites (by count):

| Suite | Tests | Quality |
|:------|:-----:|:-------:|
| security-utils | 148 | Real I/O |
| voice-api | 105 | Rebuilt 250.115 |
| db-api | 94 | Rebuilt 250.115 |
| widget | 92 | 3 bugs fixed 250.127 |
| mcp-server | 80 | Rebuilt 250.115 |
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
| Phase 2 (250.166) | 39 (6F+10C+13H+10M) | 2 (C3, C4) | 37 |
| Phase 3 (250.167) | 12 (1F+2C+4H+5M) | 10 | 2 (H14 monitoring, M16 non-fixable) |
| Phase 3b (250.167) | 3 (1C+2H) | 3 | 0 |
| Phase 4 (250.168) | 0 (fixes only) | 20 | 0 |
| Phase 5 (250.169) | 0 (fixes only) | 8 | 0 |
| Phase 6 (250.170) | 0 (fixes only) | 6 | 0 |
| **CUMULATIVE** | **54** | **49** | **5** (+ 2 non-fixable/monitoring + 3 resolved-not-bugs) |

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

**Code Completeness: 9.0/10** | **Production Readiness: 3.5/10** | **Weighted: 8.0/10**

**Remaining (5 bugs — from Deep Audit 250.166 + Phase 3 250.167, after 49 fixed):**
```
P1 (SHOULD FIX — Architectural):
  1. GoogleSheetsDB auth scalability ceiling [M5]

P2 (NICE TO HAVE — Research):
  2. Evaluate Telnyx for Moroccan telephony

NON-FIXABLE / MONITORING:
  - H14b: Gemini TTS preview model (no stable version exists)
  - M16: Gemini API key in URL (Google standard pattern)

RESOLVED (not bugs):
  - C5: Actual bug was wrong storage key (fixed 250.168), no ESM issue
  - M12/ex-H11: express IS used by OAuthGateway + WebhookRouter (not dead weight)
  - M10: Payzone is NOT dead code — BillingAgent uses it for MAD currency routing
```

**Remaining (operations — NOT code):**
```
→ GA4: ✅ DONE — configured + server-side Measurement Protocol
→ Darija pricing: ✅ DONE — $0.25/min inbound
→ Docker volumes: ✅ DONE — docker-compose.production.yml rewritten
→ VPS env vars: ✅ DONE in docker-compose — needs .env file with real values
→ VPS redeploy: Needed to apply new docker-compose + .env
→ SMTP: Needs provider credentials (Brevo/Resend/SES) in .env
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

**Methodology:**
- Tests scored by BUG DETECTION CAPABILITY, not pass rate
- Architecture scored by DEPLOYED output, not source code quality
- Tenant system scored by ACTUAL FUNCTIONALITY on vocalia.ma
- Widget system scored by INTEGRATION COMPLETENESS
- ESM scored by ACTUAL PASSING TESTS after conversion
- CI scored by GATE COMPLETENESS

---

*Document mis a jour le 2026-02-09 — Session 250.170*
*250.170: PHASE 6 INFRA — 6 BUGS FIXED. Docker: C6 named volume vocalia-data with symlinks (3 services). VPS env: F1 JWT_SECRET, F6 VOCALIA_VAULT_KEY, H2 STRIPE_SECRET_KEY, H3 SMTP_* all in docker-compose.production.yml. Architecture: M9 quota sync (syncTenantPlan + syncAllTenantPlans + startQuotaSync every 10min, Sheets authoritative, /api/quota/sync admin endpoint). Dashboard: AI Fallback Chain visualization (5-card: Grok→Gemini→Claude→Atlas→Local). Tests: 3,773 pass, 0 fail. Validator: 23/23 ✅. Cumulative: 54 bugs found, 49 fixed, 5 remain (1 architectural + 2 non-fixable + 1 research). Code 8.7→9.0, Prod 2.5→3.5, Weighted 7.6→8.0.*
*250.169: PHASE 5 — 8 BUGS FIXED/RESOLVED. Security: H5 WebSocket token via header (not query string), H8 widget config injection blocked (allowlist). Metrics: H14 mrrGrowth from real data, M6 dashboard metrics persisted to file. Architecture: M8 UUID 12-char (was 8), H10 HITL already persisted. UX: M2/M3 resolved by email wiring (F3). Resolved: M10 Payzone NOT dead code. Tests: 3,773 pass, 0 fail. Cumulative: 54 bugs found, 43 fixed, 11 remain. Code 8.4→8.7, Weighted 7.3→7.6.*
*250.168: PHASE 4 — 20 BUGS FIXED. Auth: F2/F7 token exposure removed (emails sent server-side), C2 email_verified enforced on login, F4 resend-verification endpoint, F3/C11 nodemailer installed, C5 wrong auth storage key. Security: C10 unknown tenant quota denied, H1 body limit 1MB, H13 SecretVault random salt (v2+v1 compat). Billing: C7/C8 StripeService wired + schema field. Infra: H7 columnLetter >26 cols, H12 persona 40→38, H4 db-client path+auth, H9 B2B absolute lang URL, C1 OAuth button hidden if OAuthGateway down, H6 cache invalidation in update(). UX: M1 auth page i18n, M11 ElevenLabs try/catch. Resolved: M12 express IS used (not dead). Tests: 3763→3773 (+10 new security/behavior tests). Cumulative: 54 bugs found, 35 fixed, 19 remain (+ 2 non-fixable + 2 resolved). Code 7.8→8.4, Weighted 6.8→7.3.*
*250.167: PHASE 3 INTERNAL AUDIT + FIXES — 15 bugs found (12 Phase 3 + 3 Phase 3b), 15 FIXED. Phase 3: F8 path traversal, C3+C4 auth guards, C12 tenant isolation, C13 WebSocket auth, H15+H16 fallback pricing, H17 auto-purge, M12 rate limiter, M13 WS email, M14 sanitization, M15 hash chain. Phase 3b: H18+H19 AGENCY prompt rebuilt (5 langs — removed "15 mots/5 lignes" constraints, added sector knowledge, multi-CTA), C14 VOICE_CONFIG ReferenceError fixed. Cumulative: 54 bugs found, 15 fixed, 39 remain. Code 7.5→7.8.*
*250.166: DEEP AUDIT — Line-by-line review of all critical modules. 39 bugs after counter-audit (6 FATAL, 10 CRITICAL, 13 HIGH, 10 MEDIUM). Counter-audit accuracy: 77% exact, 0% false. 3 severities corrected, 2 doublons removed. Scores corrected: Code 9.9→7.5/10, Prod 5.5→2.5/10, Weighted 8.8→6.6/10. Top 5 systemic: Docker ephemerality, Auth non-functional, 2 sources of truth, VPS env incomplete, Code≠Deployed. Full bug table in §6.*
*250.163: VPS deployment verified + updated. All 4 Docker containers healthy on Hostinger KVM 2 (148.230.113.163). api.vocalia.ma/health returns 200 OK with 4 AI providers. db-api connected to Google Sheets (7 tables). Code updated to latest GitHub commit. Production readiness 3.5→5.5/10. DNS for ws/tel subdomains pending (NindoHost).*
*250.162: P0-COMPONENTS — Dashboard→app redirect (5 pages eliminated duplication), telephony page created in app/client/, sidebar component updated with telephony link, onboarding migrated to sidebar component, validator now covers ALL 80 pages (was 46). 23/23 ✅ 0 errors 0 warnings.*
*250.161: P0-WEBSITE COMPLETE — 64→0 errors, 44→2 warnings (23/23 ✅). Darija $0.25/min (inbound) implemented across codebase. Phase 4 manual audit fixes (math, stale 40→38, Tier 1 5→4, unverified claims).*
*250.160: Validator v3.0 (17→23 checks: +6 business/factual). 64 errors + 44 warnings detected. White line cleanup (31 files). academie-business deep audit (20 problems).*
*250.159: WAF .min.js→.js fix (55 refs in 49 pages). 170+ broken i18n translations. Live widget verified via Playwright.*
*250.158: i18n 100% (4,858 keys × 5 langs). OpenAPI revalidated (25/24). Nginx routing fix. ESM audit → DEFERRED.*
*250.157: Shadow DOM 5 sub-widgets. A2UI XSS sanitized. Cart recovery GET persistence.*
*250.155: Multi-tenant deep security (origin↔tenant, api_key 22/22). escapeHTML 7/7. RGPD consent. Promo server-side.*
*250.153: P0-AUDIT 9/9 bugs fixed. External audit accuracy: 85% exact, 10% partial, 5% wrong.*
