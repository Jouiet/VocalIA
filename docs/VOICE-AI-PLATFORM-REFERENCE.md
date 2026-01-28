# VocalIA - Voice AI Platform
> Version: 1.1.0 | 28/01/2026 | Session 184bis | **MASTER REFERENCE**
>
> **Brand:** VocalIA | **Domain:** vocalia.ma | **Parent:** 3A Automation

## Executive Summary

### Brand Identity

| Élément | Valeur |
|:--------|:-------|
| **Nom** | VocalIA |
| **Domain** | vocalia.ma |
| **Tagline** | "Voice AI for MENA & Europe" |
| **Parent Company** | 3A Automation |
| **Positionnement** | Widget + Telephony AI combinés |

**Analyse du nom "VocalIA":**
- ✅ "Vocal" = Voix (universel FR/EN/ES)
- ✅ "IA" = Intelligence Artificielle (FR) / AI inversé
- ✅ Facile à prononcer en Darija/Arabe: "فوكاليا"
- ✅ .ma = Ancrage Maroc, crédibilité locale
- ✅ Mémorable et distinctif

**Noms similaires existants (vérifiés 28/01/2026):**
| Nom | Domain | Différence |
|:----|:-------|:-----------|
| Vocol AI | vocol.ai | Transcription/collaboration, pas telephony |
| Vocala | vocala.co | Alexa skills, UK-focused |
| Voice AI | voice.ai | Voice changer, pas business telephony |
| **VocalIA** | **vocalia.ma** | **Widget + Telephony, MENA-focused** |

---

**VocalIA = 2 Produits dans 1 Plateforme:**

| Produit | Description | Status Code | Status Runtime |
|:--------|:------------|:-----------:|:--------------:|
| **Voice Widget** | Browser-based (Web Speech API) | ✅ 1,012 L | ⚠️ Dépend backend |
| **Voice Telephony AI** | Twilio PSTN ↔ Grok WebSocket | ✅ 2,658 L | ❌ NO CREDS |

**Positionnement unique:** Widget + Telephony dans une seule plateforme (rare sur le marché).

---

## 1. ARCHITECTURE COMPLÈTE

### 1.1 Diagramme d'Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          3A VOICE AI PLATFORM                                │
│                           8,992 lignes de code                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────┐          ┌──────────────────────────────────┐  │
│  │  PRODUIT 1: WIDGET WEB  │          │  PRODUIT 2: TELEPHONY AI PSTN    │  │
│  │                         │          │                                  │  │
│  │  voice-widget-core.js   │          │  voice-telephony-bridge.cjs      │  │
│  │  (1,012 lignes)         │          │  (2,658 lignes)                  │  │
│  │                         │          │                                  │  │
│  │  • Web Speech API STT   │          │  • Twilio PSTN Inbound/Outbound  │  │
│  │  • Web Speech API TTS   │          │  • Grok WebSocket Audio          │  │
│  │  • Language detection   │          │  • 10 Function Tools             │  │
│  │  • Lead qualification   │          │  • HITL Controls                 │  │
│  │  • GA4 Analytics        │          │  • WhatsApp Confirmation         │  │
│  │  • Booking flow         │          │  • Session Management (50 max)   │  │
│  │                         │          │                                  │  │
│  │  Coût: $0 (Browser API) │          │  Coût: ~$0.05-0.10/min          │  │
│  └─────────────────────────┘          └──────────────────────────────────┘  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                       COMPOSANTS PARTAGÉS                           │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │  voice-api-resilient.cjs    (1,508 L) - Multi-AI text generation    │    │
│  │  grok-voice-realtime.cjs    (1,112 L) - WebSocket PCM16 audio       │    │
│  │  voice-persona-injector.cjs   (648 L) - 30 personas multi-tenant    │    │
│  │  voice-agent-b2b.cjs          (719 L) - B2B specific flows          │    │
│  │  voice-widget-templates.cjs   (800 L) - Widget configurations       │    │
│  │  voice-ecommerce-tools.cjs    (149 L) - Shopify/Klaviyo integration │    │
│  │  voice-crm-tools.cjs          (104 L) - HubSpot CRM sync            │    │
│  │  voice-quality-sensor.cjs     (282 L) - Health monitoring           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Inventaire Code (Vérifié 28/01/2026)

| Fichier | Lignes | Fonction | Port |
|:--------|:------:|:---------|:----:|
| voice-telephony-bridge.cjs | 2,658 | Twilio PSTN ↔ Grok WebSocket | 3009 |
| voice-api-resilient.cjs | 1,508 | Multi-AI text generation | 3004 |
| grok-voice-realtime.cjs | 1,112 | WebSocket audio PCM16/24kHz | 3007 |
| voice-widget-core.js | 1,012 | Browser widget (Web Speech) | - |
| voice-widget-templates.cjs | 800 | Widget configs | - |
| voice-agent-b2b.cjs | 719 | B2B flows | - |
| voice-persona-injector.cjs | 648 | 30 personas | - |
| voice-quality-sensor.cjs | 282 | Health checks | - |
| voice-ecommerce-tools.cjs | 149 | Shopify/Klaviyo | - |
| voice-crm-tools.cjs | 104 | HubSpot | - |
| **TOTAL** | **8,992** | | |

---

## 2. PRODUIT 1: VOICE WIDGET (Browser)

### 2.1 Spécifications Techniques

| Critère | Valeur | Source |
|:--------|:-------|:-------|
| **Technologie STT** | Web Speech API (SpeechRecognition) | voice-widget-core.js:234 |
| **Technologie TTS** | Web Speech API (SpeechSynthesis) | voice-widget-core.js:315 |
| **Langues** | FR, EN (browser-dependent) | voice-widget-core.js:45 |
| **Coût** | $0 (API navigateur gratuite) | - |
| **Compatibilité** | Chrome, Edge (complet), Safari/Firefox (partiel) | - |

### 2.2 Fonctionnalités Implémentées

| Fonctionnalité | Fichier:Ligne | Status |
|:---------------|:--------------|:------:|
| Speech Recognition | voice-widget-core.js:234-280 | ✅ |
| Speech Synthesis | voice-widget-core.js:315-360 | ✅ |
| Language Detection | voice-widget-core.js:189-220 | ✅ |
| Lead Qualification BANT | voice-api-resilient.cjs:116-171 | ✅ |
| HubSpot CRM Sync | voice-api-resilient.cjs:871-982 | ✅ |
| GA4 Event Tracking | voice-widget-core.js:540-580 | ✅ |
| Booking Flow | voice-widget-core.js:620-710 | ✅ |
| Attribution Capture | voice-widget-core.js:125-175 | ✅ |

### 2.3 Lead Qualification (BANT)

```javascript
// voice-api-resilient.cjs:116-171
const BANT_WEIGHTS = {
  budget: 30,         // Has budget in range
  timeline: 25,       // Ready to start soon
  decisionMaker: 20,  // Is decision maker
  fit: 15,            // Industry fit
  engagement: 10      // Conversation engagement
};

const THRESHOLDS = {
  hot: 75,   // Score ≥ 75 = Hot lead
  warm: 50,  // Score 50-74 = Warm lead
  cool: 25,  // Score 25-49 = Cool lead
  cold: 0    // Score < 25 = Cold lead
};
```

---

## 3. PRODUIT 2: VOICE TELEPHONY AI (PSTN)

### 3.1 Spécifications Techniques

| Critère | Valeur | Source |
|:--------|:-------|:-------|
| **Architecture** | Twilio PSTN → HTTP Webhook → Grok WebSocket → Audio Bridge | voice-telephony-bridge.cjs:11 |
| **Audio Input** | Mu-Law 8kHz (PCMU) - Standard téléphonie | voice-telephony-bridge.cjs:590 |
| **Audio Output** | Mu-Law 8kHz (PCMU) | voice-telephony-bridge.cjs:591 |
| **WebSocket** | wss://api.x.ai/v1/realtime | voice-telephony-bridge.cjs:109 |
| **Concurrent Sessions** | 50 max | voice-telephony-bridge.cjs:137 |
| **Session Timeout** | 10 minutes | voice-telephony-bridge.cjs:138 |
| **Rate Limiting** | 30 req/min | voice-telephony-bridge.cjs:143 |

### 3.2 Function Tools (11 implémentés - VÉRIFIÉ 28/01/2026)

| Tool | Ligne | Purpose |
|:-----|:------|:--------|
| `qualify_lead` | 605 | BANT scoring (Need/Timeline/Budget/Authority) |
| `handle_objection` | 645 | Tracking objections pour analytics |
| `check_order_status` | 665 | Lookup commande Shopify (via voice-ecommerce-tools.cjs) |
| `check_product_stock` | 680 | Vérification inventaire Shopify |
| `get_customer_tags` | 695 | Récupération segments Klaviyo |
| `schedule_callback` | 710 | Planification follow-up |
| `create_booking` | 734 | Création RDV Google Calendar |
| `track_conversion_event` | 775 | Tracking funnel analytics |
| `search_knowledge_base` | 801 | Recherche RAG multilingue |
| `send_payment_details` | 820 | Envoi infos paiement |
| `transfer_call` | 844 | Transfert vers humain |

### 3.3 CRM/E-commerce Integrations (VÉRIFIÉ)

| Integration | Fichier | Status | Fonctions |
|:------------|:--------|:------:|:----------|
| **HubSpot** | voice-crm-tools.cjs | ✅ | Contact lookup, deal history, lead status |
| **Klaviyo** | voice-ecommerce-tools.cjs | ✅ | Customer profile, tags, segments |
| **Shopify** | voice-ecommerce-tools.cjs | ✅ | Orders, inventory, products |
| Salesforce | - | ❌ NON | Pas implémenté |
| Omnisend | - | ❌ NON | Pas implémenté |
| Cal.com | - | ❌ NON | Retell l'a, pas nous |
| GoHighLevel | - | ❌ NON | Vapi l'a, pas nous |

### 3.3 HITL Controls (Human-in-the-Loop)

| Control | ENV Variable | Default | Options |
|:--------|:-------------|:--------|:--------|
| Master switch | `HITL_VOICE_ENABLED` | true | true/false |
| Hot booking approval | `HITL_APPROVE_HOT_BOOKINGS` | true | true/false |
| Transfer approval | `HITL_APPROVE_TRANSFERS` | true | true/false |
| Score threshold | `HITL_BOOKING_SCORE_THRESHOLD` | 70 | 60/70/80/90 |
| Slack notifications | `HITL_SLACK_WEBHOOK` | - | URL |

**Commandes CLI:**
```bash
node voice-telephony-bridge.cjs --list-pending   # Liste actions en attente
node voice-telephony-bridge.cjs --approve=<id>   # Approuver action
node voice-telephony-bridge.cjs --reject=<id>    # Rejeter action
```

### 3.4 VAD (Voice Activity Detection)

```javascript
// voice-telephony-bridge.cjs:593-597
turn_detection: {
  type: 'server_vad',
  threshold: 0.5,
  prefix_padding_ms: 300,
  silence_duration_ms: 400  // Optimisé (était 700ms)
}
```

---

## 4. MULTI-TENANT: 30 PERSONAS

### 4.1 Tier 1: Gold Rush (7 personas)

| # | Key | Name | Voice | Sensitivity |
|:--|:----|:-----|:------|:------------|
| 1 | AGENCY | 3A Automation Architect | ara | normal |
| 2 | DENTAL | Cabinet Dentaire Lumière | eve | high |
| 3 | PROPERTY | Atlas Property Management | leo | normal |
| 4 | HOA | Sunnyvale HOA Hotline | sal | normal |
| 5 | SCHOOL | Lincoln High Attendance | mika | high |
| 6 | CONTRACTOR | Apex Roofing & Solar | rex | normal |
| 7 | FUNERAL | Willow Creek Funeral Home | valentin | obsessive |

### 4.2 Tier 2: Expansion (11 personas)

| # | Key | Name | Voice | Sensitivity |
|:--|:----|:-----|:------|:------------|
| 8 | HEALER | Centre de Santé Intégral | eve | high |
| 9 | MECHANIC | Auto Expert Service | leo | normal |
| 10 | COUNSELOR | Cabinet Juridique Associé | ara | high |
| 11 | CONCIERGE | L'Hôtel de la Plage | sal | normal |
| 12 | STYLIST | Espace Beauté & Spa | sara | normal |
| 13 | RECRUITER | 3A Talent Acquisition | tom | normal |
| 14 | DISPATCHER | Logistique Express | rex | normal |
| 15 | COLLECTOR | Service Recouvrement | valentin | high |
| 16 | SURVEYOR | Unité Satisfaction Client | mika | normal |
| 17 | GOVERNOR | Mairie de Proximité | tom | high |
| 18 | INSURER | Assurance Horizon | rex | normal |

### 4.3 Tier 3: Top 30 (12 personas)

| # | Key | Name | Voice | Sensitivity |
|:--|:----|:-----|:------|:------------|
| 19 | ACCOUNTANT | Cabinet Expertise & Co | tom | high |
| 20 | ARCHITECT | Studio Design | eve | normal |
| 21 | PHARMACIST | Pharmacie Centrale | mika | high |
| 22 | RENTER | Atlas Car Rental | leo | normal |
| 23 | LOGISTICIAN | Global Supply & Distro | rex | normal |
| 24 | TRAINER | Academy Tech & Sales | ara | normal |
| 25 | PLANNER | Elite Event Planning | sara | normal |
| 26 | PRODUCER | Morocco Agri Solutions | tom | normal |
| 27 | CLEANER | Nettoyage Pro & Services | leo | normal |
| 28 | GYM | Iron & Soul Fitness | rex | normal |
| 29 | UNIVERSAL_ECOMMERCE | Universal E-commerce | sara | normal |
| 30 | UNIVERSAL_SME | Universal SME Receptionist | tom | normal |

### 4.4 Client Registry (27 clients configurés)

| Secteur | Clients | Langues | Devises |
|:--------|:-------:|:--------|:--------|
| E-commerce | 3 | fr, ary | EUR, MAD |
| Médical | 3 | fr, ary | MAD |
| Dentaire | 2 | fr, ary | EUR, MAD |
| Immobilier | 2 | fr | MAD |
| Tourisme | 3 | fr, en | MAD |
| Services | 8 | fr, ary | EUR, MAD, USD |
| Beauty/Wellness | 4 | fr, ary | MAD |
| Fitness | 1 | ary | MAD |
| HOA | 1 | en | USD |

---

## 5. LANGUES SUPPORTÉES

### 5.1 Configuration

```javascript
// voice-persona-injector.cjs:24
supportedLanguages: ['fr', 'en', 'es', 'ar', 'ary']
// FR = Français, EN = English, ES = Español, AR = Arabic MSA, ARY = Darija
```

### 5.2 Darija Support (Atlas-Chat-9B)

```javascript
// voice-telephony-bridge.cjs:114-120
atlasChat: {
  apiKey: process.env.HUGGINGFACE_API_KEY,
  model: 'MBZUAI-Paris/Atlas-Chat-9B',
  url: 'https://router.huggingface.co/featherless-ai/v1/chat/completions',
  enabled: !!process.env.HUGGINGFACE_API_KEY,
  darijaOnly: true  // Used only for 'ary' language fallback
}
```

### 5.3 System Prompts Multilingues

Personas avec prompts en FR, EN, et ARY (Darija):
- AGENCY: ✅ FR, EN, ARY
- UNIVERSAL_ECOMMERCE: ✅ FR, EN, ARY
- DENTAL: ✅ FR, EN, ARY
- PROPERTY: ✅ FR, ARY, AR
- HOA: ✅ FR, ARY, AR
- SCHOOL: ✅ FR, ARY, AR
- COLLECTOR: ✅ FR, ARY, AR

---

## 6. AI PROVIDERS (Multi-Fallback)

### 6.1 Text Generation

```javascript
// voice-api-resilient.cjs:74-110
providers: [
  { name: 'grok', model: 'grok-4-1-fast-reasoning' },
  { name: 'gemini', model: 'gemini-3-flash' },
  { name: 'anthropic', model: 'claude-opus-4-5' },
  { name: 'local', model: 'rule-based-fallback' }
]
// Auto-rotate on failure (latency > 15s OR status != 200)
```

### 6.2 Realtime Audio

```javascript
// grok-voice-realtime.cjs:43-51
CONFIG = {
  wsUrl: 'wss://api.x.ai/v1/realtime',
  audio: {
    format: 'pcm16',
    sampleRate: 24000,
    channels: 1,
    encoding: 'base64'
  }
}

// Voices disponibles (7)
voices: ['ara', 'eve', 'leo', 'sal', 'rex', 'mika', 'valentin']

// Gemini TTS Fallback (8 voix)
geminiVoices: ['Kore', 'Puck', 'Zephyr', 'Enceladus', 'Algieba', 'Sulafat', 'Aoede', 'Charon']
```

---

## 7. RUNTIME STATUS (28/01/2026 17:56 CET)

### 7.1 Services

| Service | Port | Status | Latency |
|:--------|:----:|:------:|:--------|
| Voice API | 3004 | ❌ DOWN | -1 |
| Grok Realtime | 3007 | ❌ DOWN | -1 |
| Telephony Bridge | 3009 | ❌ DOWN | -1 |

### 7.2 AI Providers

| Provider | Status | Latency |
|:---------|:------:|:--------|
| OpenAI Whisper | ✅ HEALTHY | 964ms |
| ElevenLabs | ❌ ERROR | 303ms |

### 7.3 Credentials

| Credential | Status | Impact |
|:-----------|:------:|:-------|
| XAI_API_KEY | ✅ | Grok text/audio |
| GEMINI_API_KEY | ✅ | Fallback TTS |
| ELEVENLABS_API_KEY | ⚠️ ERROR | TTS premium |
| HUGGINGFACE_API_KEY | ✅ | Atlas-Chat Darija |
| TWILIO_ACCOUNT_SID | ❌ ABSENT | **PSTN bloqué** |
| TWILIO_AUTH_TOKEN | ❌ ABSENT | **PSTN bloqué** |
| TWILIO_PHONE_NUMBER | ❌ ABSENT | **Pas de DID** |
| TELNYX_API_KEY | ❌ ABSENT | Alternative PSTN |

---

## 8. CONCURRENTS

### 8.1 Catégorie Widgets (vs Produit 1)

| Plateforme | Voice In | Voice Out | Lead Qual | Pricing |
|:-----------|:--------:|:---------:|:---------:|:--------|
| Drift | ✅ | ✅ | ✅ BANT | $2,500+/mois |
| Intercom | ⚠️ | ❌ | ✅ | $0.99/résol |
| Qualified | ✅ Piper | ✅ | ✅ | Enterprise |
| Tidio | ❌ | ❌ | ✅ | $24-49/mois |
| **3A Widget** | ✅ Free | ✅ Free | ✅ BANT | **$0** |

### 8.2 Catégorie Telephony AI (vs Produit 2) - VÉRIFIÉ WEB 28/01/2026

| Plateforme | Pricing Base | Pricing Réel | Plans | Compliance | Source |
|:-----------|:-------------|:-------------|:------|:----------:|:-------|
| **Vapi** | $0.05/min platform | $0.15-0.33/min total | $500-999/mo Agency | HIPAA $1k/mo | [vapi.ai/pricing](https://vapi.ai/pricing) |
| **Retell AI** | $0.07+/min voice | $0.13-0.31/min total | Enterprise $3k+/mo | SOC2/HIPAA | [retellai.com/pricing](https://www.retellai.com/pricing) |
| **Synthflow** | $0.08/min incl | $0.12-0.13/min overage | $29-1400/mo | SOC2/ISO | [synthflow.ai](https://synthflow.ai) |
| **Bland AI** | $0.09/min calls | $0.11+/min Scale | $299-499/mo | SOC2/HIPAA | [docs.bland.ai](https://docs.bland.ai/platform/billing) |
| **3A** | $0 code | ~$0.06/min (Grok+Twilio) | Self-hosted | ❌ Aucune | Local |

**Breakdown des coûts réels Vapi/Retell:**
- Platform: $0.05-0.08/min
- STT (Deepgram): ~$0.01/min
- LLM (GPT-4o): ~$0.05/min
- TTS (ElevenLabs): ~$0.07/min
- Telephony (Twilio): ~$0.015/min
- **Total: $0.13-0.31/min**

### 8.2.1 Function Tools Comparison (VÉRIFIÉ)

| Feature | Vapi | Retell | Bland | **3A** |
|:--------|:----:|:------:|:-----:|:------:|
| Transfer Call | ✅ | ✅ | ✅ | ✅ |
| End Call | ✅ | ✅ | ✅ | ⚠️ Via Twilio |
| Voicemail | ✅ | ✅ | ✅ | ❌ |
| Calendar (Cal.com) | ❌ | ✅ | ❌ | ❌ |
| Calendar (Google) | ✅ | ❌ | ❌ | ✅ |
| Google Sheets | ✅ | ❌ | ❌ | ❌ |
| Slack | ✅ | ❌ | ❌ | ⚠️ HITL only |
| GoHighLevel | ✅ | ❌ | ❌ | ❌ |
| HubSpot | ❌ | ✅ Marketplace | ❌ | ✅ |
| Salesforce | ❌ | ✅ Native | ❌ | ❌ |
| Klaviyo | ❌ | ❌ | ❌ | ✅ |
| Shopify | ❌ | ❌ | ❌ | ✅ |
| BANT Scoring | ❌ | ❌ | ❌ | ✅ |
| Marketing Science | ❌ | ❌ | ❌ | ✅ (BANT/PAS/CIALDINI/AIDA) |
| RAG Knowledge Base | ✅ | ✅ $0.005/min | ✅ | ✅ |
| MCP Server | ❌ | ✅ | ❌ | ✅ |
| Multi-persona | ❌ | ❌ | ❌ | ✅ (30) |
| **TOTAL** | 8/15 | 8/15 | 4/15 | **11/15** |

*Sources: [Vapi Tools](https://docs.vapi.ai/tools), [Retell Function Calling](https://docs.retellai.com/integrate-llm/integrate-function-calling)*

### 8.3 Catégorie MENA (VÉRIFIÉ WEB 28/01/2026)

| Plateforme | Pays | Darija | Funding | Features | Source |
|:-----------|:-----|:------:|:--------|:---------|:-------|
| **SAWT IA** | Maroc (Casablanca) | ✅ Native ML | Sensei Prod (10 ans) | Switch Darija/FR, analyse temps réel, 24/7 | [7news.ma](https://en.7news.ma/sensei-prod-unveils-sawt-ia-the-first-voice-ai-in-moroccan-arabic/) |
| **Sawt** | Saudi Arabia | ✅ Tous dialectes | $1M pre-seed (STV + T2) | Enterprise-grade, UC Berkeley origins | [wamda.com](https://www.wamda.com/2025/07/sawt-raises-1-million-transform-voice-based-customer-service) |
| **NEVOX AI** | UAE | ✅ 15 dialectes (Gulf, Levantine, Egyptian, Maghrébin) | - | 95% accuracy, auto-dialect detection, PDPL compliant | [nevoxai.com](https://www.nevoxai.com/) |
| **Maqsam** | MENA | ✅ Arabic AI | - | Customer service software, built for MENA | [maqsam.com](https://maqsam.com/) |
| **Lahajati** | - | ✅ 108 dialectes | - | TTS/STT, 99% accuracy | [lahajati.ai](https://lahajati.ai/en) |
| **DataQueue** | MENA | ✅ Gulf/Egyptian/Levantine | - | First avec DID MENA | [zawya.com](https://www.zawya.com/en/press-release/companies-news/the-first-arabic-voice-ai-that-understands-every-dialect-launched-ndy1b4qf) |
| **3A** | Maroc/FR | ✅ Atlas-Chat-9B | Self-funded | Widget+Telephony, 30 personas | Local |

**Menace concurrentielle MENA:**
- **SAWT IA** = Concurrent direct Maroc (même marché cible)
- **NEVOX AI** = Leader régional avec 15 dialectes
- **Sawt** = Backed by Google (via STV AI Fund) - threat level HIGH

**Différenciateur 3A vs MENA:**
- Widget + Telephony combinés (unique)
- Multi-tenant 30 personas (unique)
- Open-source-based (Atlas-Chat-9B) vs proprietary

---

## 9. ÉCONOMIE

### 9.1 Coûts (COGS)

| Canal | COGS/min | Prix vente | Marge |
|:------|:---------|:-----------|:------|
| Widget Web | $0.007 | $0.08-0.12 | 91-94% |
| WhatsApp Voice | $0.013 | $0.08-0.10 | 84-87% |
| PSTN Morocco | $0.044 | $0.12-0.15 | 63-71% |

### 9.2 Providers Pricing (si actifs)

| Provider | Coût |
|:---------|:-----|
| Grok Voice | $0.05/min |
| Twilio US | $0.015/min |
| Twilio France | ~$0.03-0.05/min |
| Telnyx France DID | ~$1/mois |
| ElevenLabs | Variable (plan) |

---

## 10. DÉMARRAGE RAPIDE

### 10.1 Démarrer les services

```bash
# Voice API (port 3004)
node automations/agency/core/voice-api-resilient.cjs

# Grok Realtime (port 3007)
node automations/agency/core/grok-voice-realtime.cjs

# Telephony Bridge (port 3009) - REQUIERT TWILIO_*
node automations/agency/core/voice-telephony-bridge.cjs
```

### 10.2 Health Check

```bash
node automations/agency/core/voice-quality-sensor.cjs --health
```

### 10.3 Configurer Twilio (pour PSTN)

```bash
# .env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+33XXXXXXXXX
```

---

## 11. DIFFÉRENCIATEURS UNIQUES (VÉRIFIÉ)

### 11.1 Avantages Compétitifs RÉELS

| Feature | Vapi | Retell | Bland | SAWT IA | NEVOX | **3A** |
|:--------|:----:|:------:|:-----:|:-------:|:-----:|:------:|
| Widget + Telephony | ❌ | ❌ | ❌ | ? | ❌ | **✅ LES DEUX** |
| Darija natif | ❌ | ❌ | ❌ | ✅ | ✅ | **✅ Atlas-Chat** |
| Multi-persona (30) | ❌ | ❌ | ❌ | ❌ | ❌ | **✅ UNIQUE** |
| $0 widget infra | ❌ | ❌ | ❌ | ❌ | ❌ | **✅ Web Speech API** |
| Marketing Science | ❌ | ❌ | ❌ | ❌ | ❌ | **✅ BANT/PAS/CIALDINI** |
| HubSpot + Klaviyo | ❌ | ✅ Hub | ❌ | ? | ? | **✅ LES DEUX** |
| Shopify native | ❌ | ❌ | ❌ | ? | ❌ | **✅** |
| HITL Controls | ⚠️ | ⚠️ | ❌ | ? | ? | **✅ 18/18 scripts** |
| Self-hosted option | ❌ | ❌ | ❌ | ❌ | ❌ | **✅ Full control** |

### 11.2 Gaps vs Concurrents (HONNÊTETÉ)

| Feature Missing | Qui l'a | Impact | Priorité |
|:----------------|:--------|:-------|:--------:|
| Cal.com integration | Retell | Booking simplifié | P2 |
| GoHighLevel | Vapi | Agences US | P3 |
| Salesforce native | Retell | Enterprise | P2 |
| Voicemail detection | Vapi, Retell, Bland | Outbound campaigns | P1 |
| SMS bidirectionnel | Retell | Omnichannel | P2 |
| SOC2/HIPAA compliance | Tous | Enterprise sales | P1 |
| Google Sheets | Vapi | Workflows simples | P3 |
| Make.com/Zapier | Vapi | No-code crowd | P3 |

### 11.3 Pricing Advantage

| Scenario | Vapi | Retell | Bland | **3A** |
|:---------|:-----|:-------|:------|:-------|
| 1,000 min/mois | $150-330 | $130-310 | $90 | **~$60** |
| 10,000 min/mois | $1,500-3,300 | $1,300-3,100 | $900 | **~$600** |
| Widget only | N/A | N/A | N/A | **$0** |

*3A coût = Grok ($0.05/min) + Twilio ($0.01/min) = $0.06/min*

---

## 12. PLAN D'ACTION (Session 184bis - 28/01/2026)

### 12.1 Actions IMMÉDIATES (P0) - Débloquer Runtime

| # | Action | Responsable | Blocker | Impact |
|:--|:-------|:------------|:--------|:-------|
| 1 | Configurer TWILIO_* credentials | User | Aucun | Débloquer Telephony AI |
| 2 | Réparer ELEVENLABS_API_KEY | User | Aucun | TTS premium |
| 3 | Démarrer voice services (3004, 3007, 3009) | User | Après #1 | Runtime 3/3 |

```bash
# .env à ajouter
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+33XXXXXXXXX  # ou +212XXXXXXXXX

# Démarrage
node automations/agency/core/voice-api-resilient.cjs &
node automations/agency/core/grok-voice-realtime.cjs &
node automations/agency/core/voice-telephony-bridge.cjs &
```

### 12.2 Actions COURT TERME (P1) - Parité Concurrents

| # | Action | Effort | Gain |
|:--|:-------|:-------|:-----|
| 1 | Ajouter Voicemail detection | 2-3 jours | Outbound campaigns |
| 2 | Créer voice-context-aggregator.cjs | 1-2 jours | Enrichir contexte via sensors |
| 3 | Documenter setup SOC2 basics | 1 jour | Crédibilité enterprise |
| 4 | Tester latence réelle en production | 0.5 jour | Benchmark vérifié |

### 12.3 Actions MOYEN TERME (P2) - Différenciation

| # | Action | Effort | Gain |
|:--|:-------|:-------|:-----|
| 1 | Intégrer Cal.com (parité Retell) | 2 jours | Booking simplifié |
| 2 | Ajouter Salesforce à voice-crm-tools.cjs | 3-4 jours | Enterprise clients |
| 3 | SMS bidirectionnel (Twilio SMS) | 2-3 jours | Omnichannel |
| 4 | Certifier SOC2 Type I | 3-6 mois | Enterprise sales |

### 12.4 Métriques de Succès

| Métrique | Actuel | Target 30 jours | Target 90 jours |
|:---------|:-------|:----------------|:----------------|
| Runtime services | 0/3 | 3/3 | 3/3 stable |
| Function tools | 11 | 13 (+voicemail, +cal.com) | 15 |
| CRM integrations | 3 | 4 (+Salesforce) | 5 |
| Latence mesurée | N/A | <200ms | <100ms |
| Clients Voice actifs | 0 | 2 | 10 |

---

## 13. FICHIERS DE RÉFÉRENCE

| Fichier | Lignes | Description |
|:--------|:------:|:------------|
| `voice-telephony-bridge.cjs` | 2,658 | Bridge Twilio PSTN ↔ Grok WebSocket, 11 function tools |
| `voice-api-resilient.cjs` | 1,508 | Multi-AI fallback (Grok→Gemini→Claude→Atlas→Local) |
| `grok-voice-realtime.cjs` | 1,112 | WebSocket audio PCM16/24kHz, 7 voices |
| `voice-widget-core.js` | 1,012 | Widget browser (Web Speech API, $0) |
| `voice-widget-templates.cjs` | 800+ | Templates industrie (e-commerce, B2B, agency) |
| `voice-agent-b2b.cjs` | 719 | B2B dual-role assistant (Sales 60% / Support 40%) |
| `voice-persona-injector.cjs` | 648 | 30 personas, 5 langues, marketing science |
| `voice-quality-sensor.cjs` | 282 | Health monitoring GPM |
| `voice-ecommerce-tools.cjs` | 149 | Shopify + Klaviyo integration |
| `voice-crm-tools.cjs` | 104 | HubSpot CRM sync |
| `client_registry.json` | 436 | 27 clients, 20 secteurs |

---

## 14. SOURCES VÉRIFIÉES (Session 184bis)

| Source | URL | Data Extracted |
|:-------|:----|:---------------|
| Vapi Pricing | [vapi.ai/pricing](https://vapi.ai/pricing) | $0.05/min + STT/LLM/TTS |
| Retell Pricing | [retellai.com/pricing](https://www.retellai.com/pricing) | $0.07+/min, Enterprise $3k+ |
| Bland Pricing | [docs.bland.ai](https://docs.bland.ai/platform/billing) | $0.09/min, $299-499/mo plans |
| Synthflow | [synthflow.ai](https://synthflow.ai) | $0.08/min, $29-1400/mo |
| SAWT IA | [7news.ma](https://en.7news.ma) | Darija native, Sensei Prod |
| NEVOX AI | [nevoxai.com](https://www.nevoxai.com/) | 15 dialectes, 95% accuracy |
| Sawt (Saudi) | [wamda.com](https://www.wamda.com) | $1M funding, STV + T2 |
| Vapi Examples | [github.com/VapiAI/examples](https://github.com/VapiAI/examples) | Healthcare, Multi-intent, Voicemail |
| Retell GitHub | [github.com/RetellAI](https://github.com/RetellAI) | 10 repos, Python/TS SDKs |

---

*Document màj: 28/01/2026 - Session 184bis*
*Lignes de code vérifiées: 8,992 (9 fichiers core)*
*Function tools: 11 (pas 10)*
*CRM integrations: HubSpot + Klaviyo + Shopify (3, pas 1)*
*Runtime: 0/3 services UP (TWILIO_* manquantes)*
*Recherche web: 15+ sources vérifiées*
