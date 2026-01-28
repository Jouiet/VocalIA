# VocalIA - Voice AI Platform

> **Domain:** www.vocalIA.ma | **Parent:** 3A Automation | **Version:** 1.0.0

## Overview

VocalIA is a comprehensive Voice AI platform combining:
- **Voice Widget** - Browser-based (Web Speech API, $0 cost)
- **Voice Telephony AI** - PSTN integration (Twilio + Grok WebSocket)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        VocalIA Platform                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────┐    ┌─────────────────────────────┐    │
│  │   VOICE WIDGET      │    │   VOICE TELEPHONY AI        │    │
│  │   (Browser)         │    │   (PSTN)                    │    │
│  │                     │    │                             │    │
│  │  • Web Speech API   │    │  • Twilio Integration       │    │
│  │  • $0 cost          │    │  • Grok WebSocket           │    │
│  │  • Lead qual BANT   │    │  • 11 Function Tools        │    │
│  │  • GA4 tracking     │    │  • HITL Controls            │    │
│  └─────────────────────┘    └─────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   SHARED COMPONENTS                      │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  • 30 Multi-Tenant Personas                             │   │
│  │  • 5 Languages (FR, EN, ES, AR, ARY/Darija)            │   │
│  │  • Marketing Science (BANT, PAS, CIALDINI, AIDA)       │   │
│  │  • CRM Integration (HubSpot + Klaviyo + Shopify)       │   │
│  │  • Multi-AI Fallback (Grok→Gemini→Claude→Atlas)        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Configure Environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

### 2. Start Services

```bash
# Voice API (port 3004)
npm run start:api

# Grok Realtime (port 3007)
npm run start:realtime

# Telephony Bridge (port 3009) - requires Twilio
npm run start:telephony

# Or start all
npm run start:all
```

### 3. Health Check

```bash
npm run health
```

## Directory Structure

```
VocalIA/
├── core/                    # Voice engine
│   ├── voice-api-resilient.cjs
│   └── grok-voice-realtime.cjs
├── widget/                  # Browser widget
│   ├── voice-widget-core.js
│   └── voice-widget-templates.cjs
├── telephony/               # PSTN bridge
│   └── voice-telephony-bridge.cjs
├── personas/                # Multi-tenant personas
│   └── voice-persona-injector.cjs
├── integrations/            # CRM/E-commerce
│   ├── voice-crm-tools.cjs
│   └── voice-ecommerce-tools.cjs
├── docs/                    # Documentation
├── config/                  # Configuration files
└── scripts/                 # Utility scripts
```

## Features

### Voice Widget (Browser)
- Free (Web Speech API)
- Lead qualification (BANT scoring)
- GA4 event tracking
- Booking flow integration

### Voice Telephony AI (PSTN)
- Twilio PSTN ↔ Grok WebSocket bridge
- 11 function tools
- HITL (Human-in-the-Loop) controls
- WhatsApp confirmation

### Multi-Tenant Personas (30)
- Tier 1 (Core): Agency, E-commerce, Dental, Property, HOA, School, Collector
- Tier 2 (Expansion): 11 additional verticals
- Tier 3 (Extended): 12 additional verticals

### Languages
- French (FR)
- English (EN)
- Spanish (ES)
- Arabic MSA (AR)
- Moroccan Darija (ARY) - via Atlas-Chat-9B

## Pricing Model

| Channel | COGS/min | Suggested Price | Margin |
|---------|----------|-----------------|--------|
| Widget Web | $0.007 | $0.08-0.12 | 91-94% |
| WhatsApp Voice | $0.013 | $0.08-0.10 | 84-87% |
| PSTN Morocco | $0.044 | $0.12-0.15 | 63-71% |

## Credentials Required

```bash
# Required
XAI_API_KEY=              # Grok API
GOOGLE_GENERATIVE_AI_API_KEY=  # Gemini fallback

# For Telephony (optional)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# For CRM Integration (optional)
HUBSPOT_API_KEY=
KLAVIYO_API_KEY=
SHOPIFY_ACCESS_TOKEN=
SHOPIFY_SHOP_NAME=
```

## Competitive Positioning

| Feature | Vapi | Retell | VocalIA |
|---------|------|--------|---------|
| Pricing | $0.15-0.33/min | $0.13-0.31/min | $0.06/min |
| Widget + Telephony | ❌ | ❌ | ✅ |
| Darija Support | ❌ | ❌ | ✅ |
| Multi-Personas | ❌ | ❌ | ✅ (30) |
| Self-Hosted | ❌ | ❌ | ✅ |

## License

Proprietary - 3A Automation. All rights reserved.

---

**Contact:** contact@www.vocalIA.ma | **Parent:** 3A Automation
