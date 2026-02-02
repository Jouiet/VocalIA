# VocalIA - Voice AI Platform

> **Domain:** https://vocalia.ma | **Version:** 6.76.0 | **Session:** 250.66
> **🌐 PRODUCTION LIVE** | HTTP/2 ✅ | HSTS preload ✅ | Security 100/100 ✅

## Overview

VocalIA is a comprehensive Voice AI SaaS platform combining:

- **Voice Widget** - Browser-based (Web Speech API, $0 cost)
- **Voice Telephony AI** - PSTN integration (Twilio + Grok WebSocket)
- **SaaS Webapp** - Multi-tenant dashboards (Auth, HITL, Analytics)

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
│  │  • 40 Multi-Tenant Personas (SOTA)                      │   │
│  │  • 5 Languages (FR, EN, ES, AR, ARY/Darija)            │   │
│  │  • 27 ElevenLabs Voices (Males + Females)              │   │
│  │  • Marketing Science (BANT, PAS, CIALDINI, AIDA)       │   │
│  │  • 28 Native Integrations (CRM, E-commerce, Calendar)  │   │
│  │  • Multi-AI Fallback (Grok→Gemini→Claude→Atlas)        │   │
│  │  • 182 MCP Tools | 305 Unit Tests | 375 E2E Tests     │   │
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

### Multi-Tenant Personas (40)

- Tier 1 (Core): AGENCY, DENTAL, PROPERTY, CONTRACTOR, FUNERAL
- Tier 2 (Expansion): HEALER, MECHANIC, COUNSELOR, CONCIERGE, STYLIST, RECRUITER...
- Tier 3 (Universal): UNIVERSAL_ECOMMERCE, UNIVERSAL_SME
- Tier 4 (Economy): RETAILER, BUILDER, RESTAURATEUR, CONSULTANT, DOCTOR, NOTARY...

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
| Pricing | $0.15-0.33/min | $0.13-0.31/min | **$0.06/min** |
| Widget + Telephony | ❌ | ❌ | ✅ |
| Darija Support | ❌ | ❌ | ✅ |
| Multi-Personas | ❌ | ❌ | ✅ (40) |
| MCP Server | ❌ | ❌ | ✅ (182 tools) |
| Self-Hosted | ❌ | ❌ | ✅ |
| E2E Tests | ❌ | ❌ | ✅ (375 tests) |

## Platform Metrics

| Metric | Value |
|--------|-------|
| HTML Pages | 70 (51 public + 19 webapp) |
| MCP Tools | 182 |
| Unit Tests | 305 (100% pass) |
| E2E Tests | 375 (99.5% pass, 5 browsers) |
| i18n Keys | 17,000+ |
| Security Score | 100/100 |

## License

Proprietary - VocalIA. All rights reserved.

---

**Website:** https://vocalia.ma | **GitHub:** https://github.com/Jouiet/VoicalAI
**VocalIA - SOTA Voice AI Systems**
