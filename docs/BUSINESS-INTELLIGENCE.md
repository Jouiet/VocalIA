# VocalIA — Business Intelligence

> **Version**: 2.0.0 | **Date**: 08/02/2026 | **Session**: 250.142
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

### 2A. Current Pricing vs Margins

| Product | Price | Cost | Margin | Verdict |
|:--------|:------|:-----|:-------|:--------|
| Widget B2B | 49€/month (~$53) | ~$8-20/month | **62-85%** | Excellent |
| Telephony FR | 0.06€/min (~$0.065) | $0.06/min | **~8%** | **NON VIABLE** |
| Telephony Darija | 0.06€/min | $0.15/min | **-$0.085 (LOSS)** | **PERTE** |

### 2B. Telephony Repricing Options

| Price | Margin | Verdict |
|:------|:-------|:--------|
| 0.06€/min | ~8% | Non viable — price change by Grok = instant loss |
| 0.08€/min | ~23% | Fragile |
| **0.10€/min** | **~38%** | **Viable, still competitive vs Vapi at $0.15+** |
| **0.12€/min** | **~50%** | **Healthy, still 2x cheaper than competitors** |

**Recommendation**: Increase to 0.10-0.12€/min. Even at 0.12€, VocalIA is 2x cheaper than Vapi/Retell.

### 2C. Darija Pricing Options

1. Differentiated Darija price: 0.15-0.20€/min (no competitor exists)
2. Darija widget-only (no PSTN cost, included in widget plan)
3. Self-hosted TTS (Qwen3-TTS: $0.10/min → ~$0.005/min)

---

## 3. Competitive Positioning (Verified)

### 3A. Voice Telephony

| Platform | Cost/min (FR inbound) | What's included |
|:---------|:---------------------|:---------------|
| **VocalIA** | **~$0.06/min** | Grok LLM+STT+TTS + Twilio + 25 function tools + persona + RAG |
| Vapi | $0.15-0.25/min | Platform only, add LLM + STT + TTS + telecom |
| Retell | $0.12-0.20/min | STT included, add LLM + TTS + telecom |
| Bland | $0.15-0.25/min | Self-hosted possible |

**VocalIA structural advantage**: Grok $0.05/min includes LLM+STT+TTS in one price. Competitors charge each separately.

**"60% cheaper" claim** (in lang files): TRUE for FR/EU market. FALSE for Morocco ($0.83/min Twilio).

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
| E-commerce FR (ECOM widget) | ~200K sites | 49€/month + usage | Cart recovery + voice shopping |
| Marketing agencies FR | ~15K agencies | White-label reseller | Multi-tenant, 38 personas |
| Call centers FR/MA | ~2K centers | 0.10-0.12€/min | Darija + cost 2x lower |

---

## 5. GA4 Analytics (Code Ready, Data Inactive)

| Widget | Unique Events | Total Call Sites | Status |
|:-------|:------------:|:----------------:|:------:|
| B2B | 12 | 14 | ✅ coded, ❌ G-XXXXXXXXXX |
| ECOM (all 6 IIFEs) | 44 | ~70 | ✅ coded, ❌ G-XXXXXXXXXX |
| **Total unique** | **52** | **~84** | **All going to void** |

**Action**: Replace `G-XXXXXXXXXX` in `website/components/header.html` (2 occurrences, lines 2 and 7).
**Effort**: 5 minutes on analytics.google.com.
**Impact**: Unlocks all data-driven decisions.

---

## 6. Priority Matrix (Business Impact / Effort)

| # | Action | Effort | Impact | ROI |
|:-:|:-------|:-------|:-------|:---:|
| 1 | Activate GA4 (replace G-XXXXXXXXXX) | 5min | 52 events collecting data | ★★★★★ |
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

### 9A. Broken Funnel Elements

| Element | Status | Evidence | Impact |
|:--------|:------:|:---------|:-------|
| **Newsletter** | **DEAD** | `event-delegation.js:120-126` — changes button text to "✓ Inscrit!", NO fetch/POST, NO webhook | 0% email capture rate |
| **Booking form** | **DEAD** | `booking.html:435-436` — `alert('Merci!')`, comment says "in real app, send to API" | 0% demo conversion |
| **Contact form** | **PARTIAL** | `voice-api-resilient.cjs:3052` — `/api/contact` endpoint exists, saves to Google Sheets DB | DB not configured (no GOOGLE_SHEETS_ID in .env), data goes to console log only |
| **GA4 Analytics** | **DEAD** | `header.html:2,7` — `G-XXXXXXXXXX` placeholder | 52 events coded, 0 data collected |
| **Plausible Analytics** | **INSTALLED** | `site-init.js` + 5+ pages with `data-domain="vocalia.ma"` script | Account existence not verified |

### 9B. Social Proof — FICTITIOUS DATA

| Element | Location | Content | Status |
|:--------|:---------|:--------|:------:|
| "500+ Entreprises Actives" | `index.html:964` | 0 paying customers | **FICTITIOUS** |
| "2M+ Appels Traités" | `index.html:968` | 0 real voice calls | **FICTITIOUS** |
| "98% Satisfaction" | `index.html:972` | No measurement, no clients | **FICTITIOUS** |
| "5 Langues" | `index.html:976` | Factually true (code exists) | **TRUE** |
| Testimonial "Karim M." | `index.html:899` | No real client | **FICTITIOUS** |
| Testimonial "Dr. Sara B." | `index.html:926` | No real client | **FICTITIOUS** |
| Testimonial "Youssef E." | `index.html:953` | No real client | **FICTITIOUS** |

### 9C. Case Studies — LABELED AS FICTIONAL

| Article | Disclaimer | Location |
|:--------|:-----------|:---------|
| Clinique Amal (-60% no-shows) | "Les noms et chiffres spécifiques sont fictifs à des fins démonstratives" | `clinique-amal-rappels-vocaux.html:152` |
| Agence Immo (+conversion) | "Les noms et chiffres spécifiques sont fictifs à des fins démonstratives" | `agence-immo-plus-conversion.html:135` |

**Note**: Both case studies honestly label themselves as fictional with industry-benchmark-based numbers. This is acceptable practice for pre-launch marketing, but should be replaced with real case studies as soon as first clients onboard.

### 9D. Product B2C — PHANTOM PRODUCT

| Fact | Evidence |
|:-----|:---------|
| No `voice-widget-b2c.js` exists | `ls widget/` — 7 files, none named b2c |
| B2C page loads B2B widget | `voice-widget-b2c.html:519` → `voice-widget-b2b.min.js?v=2.7.0` |
| B2C pricing card at 79€ | `pricing.html:283-321` — "Widget B2C" at 79€/month |
| 14 B2C entries in client_registry | `grep -c '"widget_type": "B2C"' client_registry.json` = 14 |
| Differentiation = persona only | Same JS code, different `sector` in backend → different persona loaded |

**Recommendation**: Either (a) remove B2C as separate product and absorb into B2B at 49€, or (b) create actual B2C-specific features to justify the 79€ price difference.

### 9E. Social Media & Links

| Platform | URL | Status |
|:---------|:----|:------:|
| LinkedIn | `linkedin.com/company/vocalia` | Link exists, profile not verified |
| GitHub | `github.com/Jouiet/VoicalAI` | **TYPO**: "VoicalAI" not "VocalIA" |
| Twitter/X | — | **NOT PRESENT** in footer |
| Facebook | — | **NOT PRESENT** in footer |
| Instagram | — | **NOT PRESENT** in footer |

### 9F. Acquisition Funnel Reality (0 paying customers)

```
AWARENESS (Plausible?):  Unknown visitors → vocalia.ma
    ↓
INTEREST (Homepage):     Fictitious social proof (500+, 2M+, 98%)
    ↓
CONSIDERATION (Pricing): 3 products (B2B 49€, B2C 79€ phantom, ECOM 149€, Telephony 0.06€)
    ↓
INTENT (Booking/Contact): Booking = alert(), Contact = log-only, Newsletter = button change
    ↓
CONVERSION:              0 — NO functional acquisition mechanism
```

**Critical path to first customer**: Fix newsletter webhook → Fix booking form → Fix GA4 → Replace fictitious social proof with honest messaging ("beta" or "launching soon").

---

## 10. Updated Priority Matrix (Post-Audit Nr 3)

| # | Action | Effort | Impact | Status |
|:-:|:-------|:-------|:-------|:------:|
| 1 | **Fix newsletter** — connect to Mailchimp/Brevo webhook | 1h | Email capture begins | ❌ |
| 2 | **Fix booking form** — POST to /api/contact or Calendly | 1h | Demo requests flow | ❌ |
| 3 | **Activate GA4** — replace G-XXXXXXXXXX | 5min | 52 events collecting data | ❌ Blocked (needs account) |
| 4 | **Replace fictitious social proof** — honest "launching" messaging | 2h | Legal/credibility risk eliminated | ❌ |
| 5 | **Decide B2C product** — merge into B2B or create real features | Decision | Pricing clarity | ❌ Decision needed |
| 6 | **Increase telephony price** 0.06→0.10-0.12€/min | Decision | Margin 8%→38-50% | ❌ Decision needed |
| 7 | **Serve brotli** via nginx config on VPS | 30min | Transfer -55% | ❌ Infrastructure |
| 8 | **Fix GitHub typo** — VoicalAI → VocalIA (or rename repo) | 5min | Brand consistency | ❌ |
| 9 | **Configure Google Sheets DB** — GOOGLE_SHEETS_ID in .env | 30min | Contact form actually persists | ❌ |

---

*Created: 08/02/2026 - Session 250.139 (External Business Audit Nr 2)*
*Updated: 08/02/2026 - Session 250.142 (External Business Audit Nr 3 — marketing funnel, social proof, B2C phantom product)*
*All costs verified against provider pricing pages as of February 2026*
*All funnel claims verified against codebase with grep/read on 08/02/2026*
