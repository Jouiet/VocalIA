# VocalIA — Business Intelligence

> **Version**: 2.1.0 | **Date**: 13/02/2026 | **Session**: 250.205 (pricing data from 250.142-204, infra updated 250.205)
> **Source**: External business audits Nr 2 (250.139) + Nr 3 (250.142) — verified against code + provider pricing Feb 2026
> **Contact**: contact@vocalia.ma | +1 762 422 4223 (Twilio official number)

---

## 1. Cost Structure (Verified)

### 1A. Widget — Cost per Conversation

| Component | Model | Cost | Source |
|:----------|:------|:-----|:-------|
| LLM (primary) | Grok 4.1 Fast | $0.20/M input, $0.50/M output | xAI pricing |
| LLM (fallback 1) | Gemini 3 Flash | ~$0.075/M input, $0.30/M output | Google pricing |
| LLM (fallback 2) | Claude Opus 4.5 | $15/M input, $75/M output | Anthropic pricing |

**Per conversation** (~6 messages, ~2,000 tokens):
- Grok: **~$0.001** (0.1 centime)
- Gemini: ~$0.0006
- Claude (emergency fallback): ~$0.09

**Conclusion**: Widget LLM cost is negligible. ~$1 for 1,000 conversations.

### 1B. Telephony — Cost per Minute

| Component | Cost/min | Source |
|:----------|:---------|:-------|
| Grok Voice Agent (LLM+STT+TTS) | $0.05 | xAI pricing |
| Twilio PSTN France inbound | $0.01 | twilio.com/voice/pricing/fr |
| Twilio PSTN France outbound mobile | $0.04 (EEA) | Same |
| Twilio number (FR) | $1.15/month | Same |
| ElevenLabs TTS (Darija only) | $0.10/min | elevenlabs.io/pricing/api |

**Cost per 5-min inbound call**:
| Scenario | Calculation | Total |
|:---------|:-----------|:------|
| FR/EN/ES (Grok native) | ($0.05 + $0.01) x 5 | **$0.30** |
| Darija (Grok + ElevenLabs) | ($0.05 + $0.01 + $0.10) x 5 | **$0.80** |

### 1C. CRITICAL: Twilio Morocco

| Twilio Morocco | Status |
|:---------------|:-------|
| Moroccan numbers | **NOT AVAILABLE** |
| Inbound to Moroccan number | **IMPOSSIBLE** |
| Outbound to Moroccan mobile | **$0.83/min** (14x France) |
| Outbound to Moroccan landline | **$0.47/min** |

**Source**: twilio.com/en-us/voice/pricing/ma

**Impact**: A Moroccan client CANNOT have a local number via Twilio. Must use +33 (France) or +1 (US) number. For a dental clinic in Casablanca, calling a +33 = major friction.

**Alternatives**: Telnyx (potentially has Moroccan numbers, $0.005/min FR inbound), local SIP trunk (Maroc Telecom/Inwi).

---

## 2. Pricing Analysis

### 2A. Pricing Structure (Restructured Session 250.143)

| Tier | Price | Cost | Margin | Verdict |
|:-----|:------|:-----|:-------|:--------|
| **Starter** | 49€/month | ~$3-5/month | **~90-93%** | Voice AI assistant, 500 conv/mois |
| **Pro** | 99€/month | ~$8-20/month | **80-92%** | Lead gen + booking + CRM sync |
| **E-commerce** | 99€/month | ~$8-20/month | **80-92%** | Cart recovery + quiz + gamification |
| **Telephony** | 199€/mo + 0.24€/min | $0.06/min | **~77%** | PSTN line, 100 min included |

> **B2C product (79€) ELIMINATED** — merged into Pro (99€). B2C page redirects to /pricing.
> **Telephony REPRICED** from 0.06€→0.10€→0.24€/min (margin 8%→38%→77%). Session 250.204.

### 2B. Telephony Repricing Options

| Price | Margin | Verdict |
|:------|:-------|:--------|
| 0.06€/min | ~8% | Non viable — price change by Grok = instant loss |
| 0.10€/min | ~38% | Viable but thin |
| **0.24€/min** | **~77%** | **CURRENT — tout-inclus positioning (IA + personas + analytics)** |

**Decision (250.204)**: Repriced to 0.24€/min. VocalIA is no longer cheapest — moat is value (tout-inclus vs components billed separately at competitors).

### 2C. Darija Pricing Options

1. Differentiated Darija price: 0.15-0.20€/min (no competitor exists)
2. Darija widget-only (no PSTN cost, included in widget plan)
3. Self-hosted TTS (Qwen3-TTS: $0.10/min → ~$0.005/min)

---

## 3. Competitive Positioning (Verified)

### 3A. Voice Telephony

| Platform | Cost/min (FR inbound) | What's included |
|:---------|:---------------------|:---------------|
| **VocalIA** | **~0.24€/min (~$0.26)** | Grok LLM+STT+TTS + Twilio + 25 function tools + persona + RAG — tout-inclus |
| Vapi | $0.15-0.25/min | Platform only, add LLM + STT + TTS + telecom |
| Retell | $0.12-0.20/min | STT included, add LLM + TTS + telecom |
| Bland | $0.15-0.25/min | Self-hosted possible |

**VocalIA structural advantage**: Grok $0.05/min includes LLM+STT+TTS in one price. Competitors charge each separately.

**"60% cheaper" claim REMOVED (250.204)**: At 0.24€/min, VocalIA is NOT cheaper than Bland ($0.09-0.11) or Retell (~$0.14). Competitive moat = tout-inclus (IA + 38 personas + analytics in one subscription).

### 3B. Voice Widget

| Platform | Price | Voice Native | Darija | 5 Languages |
|:---------|:------|:----------:|:------:|:-----------:|
| **VocalIA** | **49€/month** | **✅** | **✅** | **✅** |
| Intercom | $39-139/seat | ❌ | ❌ | Via plugin |
| Drift | ~$2,500/month | ❌ | ❌ | ❌ |
| Crisp | €95/month | ❌ | ❌ | Auto-translate |
| Tidio | $29-59/month | ❌ | ❌ | Limited |

**VocalIA = only widget with voice native + Darija + 5 languages.** Factual, verifiable.

### 3C. Feature Gap (VocalIA vs Competitors)

| Feature | Intercom | Crisp | VocalIA |
|:--------|:--------:|:-----:|:-------:|
| Help center/KB public | ✅ | ✅ | ❌ |
| Shared inbox multi-agent | ✅ | ✅ | ❌ |
| Ticketing/SLA | ✅ | ✅ | ❌ |
| Email channel | ✅ | ✅ | ❌ |
| WhatsApp/Messenger | ✅ | ✅ | ❌ (code exists, not deployed) |
| File upload | ✅ | ✅ | ❌ |
| **Voice AI native** | **❌** | **❌** | **✅** |
| **Darija** | **❌** | **❌** | **✅** |
| **5 native languages** | **❌** | **❌** | **✅** |

**Verdict**: VocalIA = voice-first sales/booking assistant. Intercom/Crisp = support platforms. Different products.

---

## 4. Market Segments (Realistic)

### 4A. Morocco — Differentiator, Not Revenue Market

- Population: ~38M
- Twilio: NO Moroccan numbers
- Outbound mobile: $0.83/min (14x France)
- PME with SaaS budget >49€/month: minority
- **Darija = marketing differentiator** ("seule plateforme voice AI Darija-native")
- **Revenue comes from Europe/US. Morocco = showcase.**

### 4B. Addressable Segments

| Segment | TAM | Pricing | Competitive Advantage |
|:--------|:----|:--------|:---------------------|
| PME francaises (widget) | ~500K with websites | 49€/month | Voice + 5 langs + price |
| E-commerce FR (ECOM widget) | ~200K sites | 99€/month | Cart recovery + voice shopping |
| Marketing agencies FR | ~15K agencies | White-label reseller | Multi-tenant, 38 personas |
| Call centers FR/MA | ~2K centers | 0.24€/min tout-inclus | Darija + plateforme unifiée |

---

## 5. GA4 Analytics (ACTIVE — Session 250.163)

| Widget | Unique Events | Total Call Sites | Status |
|:-------|:------------:|:----------------:|:------:|
| B2B | 12 | 14 | ✅ coded, ✅ configured |
| ECOM (all 6 IIFEs) | 44 | ~70 | ✅ coded, ✅ configured |
| **Total unique** | **52** | **~84** | **✅ All collecting data** |

**Activated**: Session 250.163 — configured (Stream ID: 13579681217)
**Coverage**: 84/84 pages (header.html 46 + sidebar.html 11 + admin-sidebar.html 5 + 5 auth inline + 13 dashboard→app redirect + investor.html + 3 utility pages 250.205)
**Server-side**: marketing-science-core.cjs Measurement Protocol (needs GA4_API_SECRET env var)

---

## 6. Priority Matrix (Business Impact / Effort)

| # | Action | Effort | Impact | ROI |
|:-:|:-------|:-------|:-------|:---:|
| 1 | ~~Activate GA4~~ | ~~5min~~ | 52 events collecting data | ✅ DONE 250.163 |
| 2 | Increase telephony price 0.06→0.10-0.12€ | 0h (decision) | Margin 8%→38-50% | ★★★★★ |
| 3 | Serve brotli via nginx config | 30min | Transfer -84% B2B, -88% ECOM | ★★★★★ |
| 4 | Booking inline B2B (copy from ECOM) | 3h | Conversion booking +30-40% | ★★★★★ |
| 5 | Evaluate Telnyx (Moroccan numbers?) | 4h | Unblock Morocco, -50% PSTN | ★★★★ |
| 6 | Darija differentiated pricing | 0h (decision) | Eliminate loss per Darija call | ★★★★ |
| 7 | Code-split ECOM widget | 4h | Mobile performance -60% | ★★★★ |
| 8 | Fallback STT Firefox/Safari | 6h | +11% visitors with voice | ★★★ |
| 9 | Test Qwen3-TTS for Darija | 8h | Darija TTS cost -93% | ★★★ |

---

## 7. What NOT To Do

| Action | Reason |
|:-------|:-------|
| Lower widget price (<49€) | Margin already excellent, price below Crisp/Intercom |
| Compete with Intercom frontally | Missing 8+ features, 12+ months of dev for commoditized features |
| Keep telephony at 0.06€/min | 8% margin = non viable |
| Push Morocco telephony via Twilio | $0.83/min mobile = economically impossible |
| Migrate to LiveKit/Voximplant | Bridge works, migration = risk for 25 function tools |
| CDN (cdn.vocalia.ma) | VPS + nginx + brotli sufficient at current volume |
| ESM migration core modules | 34,533 lines of working code. Risk for developer gain, not customer gain |

---

## 8. Market Data (Verified Sources)

| Metric | Value | Source |
|:-------|:------|:-------|
| Voice commerce global 2025 | $70.47B | thebusinessresearchcompany.com |
| CAGR voice commerce | 24.61% | Same |
| Conversational commerce 2025 | $11.26B | mordorintelligence.com |
| Cart abandonment rate 2026 | 70-72% | baymard.com |
| Cart recovery leaders | 10-14% | convertcart.com |
| E-commerce conversion average | 1.5-2.5% | optimonk.com |
| SpeechRecognition browser support | ~73% (Chrome+Edge) | caniuse.com |

---

## 9. Marketing Funnel Audit (Session 250.142 — VERIFIED)

> **Source**: External audit Nr 3 — every claim verified against codebase with grep/read

### 9A. Funnel Elements (Updated 250.211)

| Element | Status | Evidence | Impact |
|:--------|:------:|:---------|:-------|
| **Newsletter** | **✅ FUNCTIONAL** | `event-delegation.js:120-148` — POSTs to `/api/contact` via fetch (250.205) | Email capture active |
| **Booking form** | **✅ FUNCTIONAL** | `booking.html:444-459` — POSTs to `/api/contact` via fetch, shows success message (250.203) | Demo requests flow to API |
| **Contact form** | **✅ FUNCTIONAL** | `voice-api-resilient.cjs:3052` — `/api/contact` endpoint exists, saves to Google Sheets DB | Functional (needs GOOGLE_SHEETS_ID for DB persistence) |
| **GA4 Analytics** | **✅ ACTIVE** | `header.html:2,7` — `configured` (250.163) | 52 events collecting data on 85 pages |
| **Plausible Analytics** | **INSTALLED** | `site-init.js` + 5+ pages with `data-domain="vocalia.ma"` script | Account existence not verified |

### 9B. Social Proof — CORRECTED (Session 250.195)

| Element | Location | Content | Status |
|:--------|:---------|:--------|:------:|
| "38 Personas IA" | `index.html` stats bar | Factually true (code verified) | **TRUE** |
| "203 MCP Tools" | `index.html` stats bar | Factually true (test verified) | **TRUE** |
| "25 Function Tools" | `index.html` stats bar | Factually true | **TRUE** |
| "5 Langues" | `index.html` stats bar | Factually true | **TRUE** |
| Testimonial "Scénario E-commerce" | `index.html:918` | Use case scenario, not fake person | **SCENARIO** |
| Testimonial "Scénario Clinique" | `index.html:937` | Use case scenario, not fake person | **SCENARIO** |
| Testimonial "Scénario Multi-Secteur" | `index.html:956` | Use case scenario, not fake person | **SCENARIO** |

> **Note**: Fictitious testimonials ("Karim M.", "Dr. Sara B.", "Youssef E.") and fake stats ("500+ Entreprises", "2M+ Appels", "98% Satisfaction") were replaced in session 250.195 with scenario-based use cases and real product metrics.

### 9C. Case Studies — LABELED AS FICTIONAL

| Article | Disclaimer | Location |
|:--------|:-----------|:---------|
| Clinique Amal (-60% no-shows) | "Les noms et chiffres spécifiques sont fictifs à des fins démonstratives" | `clinique-amal-rappels-vocaux.html:152` |
| Agence Immo (+conversion) | "Les noms et chiffres spécifiques sont fictifs à des fins démonstratives" | `agence-immo-plus-conversion.html:135` |

**Note**: Both case studies honestly label themselves as fictional with industry-benchmark-based numbers. This is acceptable practice for pre-launch marketing, but should be replaced with real case studies as soon as first clients onboard.

### 9D. Product B2C — RESOLVED (Session 250.143)

> **RESOLVED**: B2C product (79€) eliminated. Merged into Pro (99€) with actual differentiating features:
> lead qualification (BANT), conversational booking, CRM sync (HubSpot), unlimited conversations.
> B2C page (`voice-widget-b2c.html`) now redirects to `/pricing`.
> Old B2C pricing card replaced with Pro card on pricing page.

### 9E. Social Media & Links

| Platform | URL | Status |
|:---------|:----|:------:|
| LinkedIn | `linkedin.com/company/vocalia` | Link exists, profile not verified |
| GitHub | `github.com/Jouiet/VocalIA` | **TYPO**: "VocalIA" not "VocalIA" |
| Twitter/X | — | **NOT PRESENT** in footer |
| Facebook | — | **NOT PRESENT** in footer |
| Instagram | — | **NOT PRESENT** in footer |

### 9F. Acquisition Funnel Reality (0 paying customers — updated 250.211)

```
AWARENESS (GA4+Plausible): Visitors → vocalia.ma (52 events tracking)
    ↓
INTEREST (Homepage):     Scenario-based social proof (38 personas, 203 tools — real stats)
    ↓
CONSIDERATION (Pricing): 4 tiers (Starter 49€, Pro 99€, ECOM 99€, Telephony 199€+0.24€/min)
    ↓
INTENT (Booking/Contact): Booking = POST /api/contact ✅, Contact = POST /api/contact ✅, Newsletter = POST /api/contact ✅
    ↓
SIGNUP:                  /signup?plan=X → register with plan → tenant provisioned ✅ (250.211)
    ↓
CHECKOUT:                billing.html → Stripe Checkout Session → payment ✅ (250.211)
    ↓
CONVERSION:              0 — STRIPE_SECRET_KEY not yet configured on VPS (manual task)
```

**Remaining blocker**: Configure STRIPE_SECRET_KEY + create Stripe Products/Prices (manual).

---

## 10. Updated Priority Matrix (Post-Audit Nr 3 — Updated 250.211)

| # | Action | Effort | Impact | Status |
|:-:|:-------|:-------|:-------|:------:|
| 1 | ~~Fix newsletter~~ — POSTs to /api/contact | ✅ Done | Email capture active | ✅ Session 250.205 |
| 2 | ~~Fix booking form~~ — POSTs to /api/contact | ✅ Done | Demo requests flow | ✅ Session 250.203 |
| 3 | ~~Activate GA4~~ | ~~5min~~ | 52 events collecting data | ✅ DONE 250.163 |
| 4 | ~~Replace fictitious social proof~~ — scenario-based messaging | ✅ Done | Legal/credibility risk eliminated | ✅ Session 250.195 |
| 5 | ~~Decide B2C product~~ — merged into Pro 99€ | ✅ Done | Pricing clarity | ✅ Session 250.143 |
| 6 | ~~Increase telephony price~~ — 0.06→0.10→0.24€/min | ✅ Done | Margin 77% | ✅ Session 250.143+250.204 |
| 7 | ~~Brotli~~ via nginx config on VPS | ✅ Done | Transfer -55% | ✅ Session 250.152 |
| 8 | **Fix GitHub typo** — VocalIA → VocalIA (or rename repo) | 5min | Brand consistency | ❌ |
| 9 | **Configure STRIPE_SECRET_KEY** on VPS | 5min | Payments enabled | ❌ Manual |
| 10 | **Create Stripe Products/Prices** (4 plans) | 30min | Checkout functional | ❌ Manual |

---

*Created: 08/02/2026 - Session 250.139 (External Business Audit Nr 2)*
*Updated: 15/02/2026 - Session 250.211 (Funnel fixes: newsletter ✅, booking ✅, social proof ✅, signup plan capture ✅, Stripe checkout flow ✅)*
*All costs verified against provider pricing pages as of February 2026*
