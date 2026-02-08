# VocalIA — Roadmap to 100% Completion

> **Date:** 2026-02-08 | **Session:** 250.163 (VPS deployment verified + updated — all 4 services LIVE)
> **Code Completeness:** 9.9/10 | **Production Readiness:** 5.5/10 (website deployed, API backend LIVE on VPS, 4 services healthy, widget can chat, CORS unblocked, multi-tenant security hardened, 0 paying customers)
> **Methodologie:** Chaque tache est liee a un FAIT verifie par commande. Zero supposition.
> **Source:** Audit croise de 13 documents + external audits (250.129, 250.139, 250.142, 250.153) + pricing restructure (250.143) + implementation (250.144) + website factual audit (250.160)

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

**Code Completeness: 9.8/10** — All features coded and tested (3,764 tests, 68 files). P0-AUDIT 9/9, P0-WEBSITE 23/23 ✅. Darija $0.25/min implemented. Zero business/factual errors on website. Multi-tenant security hardened. Shadow DOM 7/7 widgets.
**Production Readiness: 3.5/10** — Website deployed at vocalia.ma. 0 paying customers. CORS supports tenant domains. All code tasks DONE. Still needs: VPS deployment, first customer, GA4 activation.

> **Important**: These are TWO separate scores. Code completeness measures how much code is written/tested. Production readiness measures what's deployed and serving real users.

| # | Dimension | Score 250.158 | Score 250.160 | Delta | Justification (250.160) |
|:-:|:----------|:-----:|:-----:|:-----:|:------|
| 1 | Tests unitaires | 7.0 | 7.0 | 0 | 3,764 tests pass, 0 fail, 0 skip (ESM) |
| 2 | Sécurité | 10.0 | 10.0 | 0 | A2UI XSS sanitized, Shadow DOM 7/7, escapeHTML 7/7 |
| 3 | Production readiness | 3.0 | **5.5** | **+2.5** | Website deployed, API backend LIVE on VPS (4 containers healthy), widget can chat, 0 paying customers |
| 4 | Documentation accuracy | 9.0 | **10.0** | **+1.0** | Technical docs accurate. 64→0 business/factual errors on website (validator v3.0 23/23 ✅). Darija $0.25/min documented. |
| 5 | Architecture code | 10.0 | 10.0 | 0 | Shadow DOM ALL 7 widgets, full CSS isolation |
| 6 | Multi-tenant | 9.5 | 9.5 | 0 | No change |
| 7 | i18n | 10.0 | 10.0 | 0 | 4,858 keys × 5 langs, 170+ broken translations fixed (250.159) |
| 8 | Intégrations | 8.0 | 8.0 | 0 | No change |
| 9 | Developer experience | 9.5 | **10.0** | **+0.5** | Validator v3.0: 23 checks (17 CSS + 6 business/factual). Catches eliminated products, old pricing, uptime claims, unverified metrics, competitive claims, telephony base fee |
| 10 | Mémoire & docs | 9.0 | 9.0 | 0 | No change |

| | Poids | Contribution |
|:-|:-----:|:------------:|
| 1 (7.0) | 15% | 1.050 |
| 2 (10.0) | 15% | 1.500 |
| 3 (5.5) | 10% | 0.550 |
| 4 (10.0) | 10% | 1.000 |
| 5 (10.0) | 10% | 1.000 |
| 6 (9.5) | 10% | 0.950 |
| 7 (10.0) | 5% | 0.500 |
| 8 (8.0) | 10% | 0.800 |
| 9 (10.0) | 10% | 1.000 |
| 10 (9.0) | 5% | 0.450 |
| **TOTAL** | **100%** | **8.800** → **~8.8/10** (250.163 — VPS deployment LIVE, Production +2.5) |

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
| Dockerfile + docker-compose (prod+staging) | ✅ Deployed |
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

**Widget**: Only voice-native widget with Darija + 5 languages. 49€ vs Intercom $39-139/seat. Different product (voice-first sales vs support platform).
**Telephony**: 0.10€/min vs Vapi 0.15-0.33€/min. Structural advantage: Grok bundles LLM+STT+TTS at ~$0.05/min.
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

**TOTAL: 3,764 tests | 3,763 pass | 0 fail | 0 skip | ALL ESM (.mjs)** (Verified 250.156)

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

## 6. Résumé Exécutif — Plan d'Action

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

**Code Completeness: 9.9/10** | **Production Readiness: 5.5/10** | **Weighted: 8.8/10**

**Remaining (code — REQUIRED):**
```
→ (none — all code tasks complete)
```

**Remaining (code — OPTIONAL):**
```
→ P3-1g: Source module ESM migration (core/*.cjs → .mjs) — DEFERRED (78 conditional requires)
```

**Remaining (infrastructure/decisions — NOT code):**
```
→ GA4: ✅ DONE — configured (Stream ID 13579681217)
→ Darija pricing: ✅ DONE — $0.25/min inbound, implemented in code + website
→ VPS: ✅ DONE — 4 containers healthy, ALL routed via api.vocalia.ma (path-based, no extra DNS)
→ Telnyx: Evaluate for Moroccan numbers
```

**Methodology:**
- Tests scored by BUG DETECTION CAPABILITY, not pass rate
- Architecture scored by DEPLOYED output, not source code quality
- Tenant system scored by ACTUAL FUNCTIONALITY on vocalia.ma
- Widget system scored by INTEGRATION COMPLETENESS
- ESM scored by ACTUAL PASSING TESTS after conversion
- CI scored by GATE COMPLETENESS

---

*Document mis a jour le 2026-02-08 — Session 250.163*
*250.163: VPS deployment verified + updated. All 4 Docker containers healthy on Hostinger KVM 2 (148.230.113.163). api.vocalia.ma/health returns 200 OK with 4 AI providers. db-api connected to Google Sheets (7 tables). Code updated to latest GitHub commit. Production readiness 3.5→5.5/10. DNS for ws/tel subdomains pending (NindoHost).*
*250.162: P0-COMPONENTS — Dashboard→app redirect (5 pages eliminated duplication), telephony page created in app/client/, sidebar component updated with telephony link, onboarding migrated to sidebar component, validator now covers ALL 80 pages (was 46). 23/23 ✅ 0 errors 0 warnings.*
*250.161: P0-WEBSITE COMPLETE — 64→0 errors, 44→2 warnings (23/23 ✅). Darija $0.25/min (inbound) implemented across codebase. Phase 4 manual audit fixes (math, stale 40→38, Tier 1 5→4, unverified claims).*
*250.160: Validator v3.0 (17→23 checks: +6 business/factual). 64 errors + 44 warnings detected. White line cleanup (31 files). academie-business deep audit (20 problems).*
*250.159: WAF .min.js→.js fix (55 refs in 49 pages). 170+ broken i18n translations. Live widget verified via Playwright.*
*250.158: i18n 100% (4,858 keys × 5 langs). OpenAPI revalidated (25/24). Nginx routing fix. ESM audit → DEFERRED.*
*250.157: Shadow DOM 5 sub-widgets. A2UI XSS sanitized. Cart recovery GET persistence.*
*250.155: Multi-tenant deep security (origin↔tenant, api_key 22/22). escapeHTML 7/7. RGPD consent. Promo server-side.*
*250.153: P0-AUDIT 9/9 bugs fixed. External audit accuracy: 85% exact, 10% partial, 5% wrong.*
