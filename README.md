# VocalIA - Voice AI Platform

> **Domain:** https://vocalia.ma | **Version:** 2.7.0 | **Session:** 250.204
> **🌐 PRODUCTION LIVE** | HTTP/2 ✅ | HSTS preload ✅ | Security 100/100 ✅
> **MÉTRIQUES VÉRIFIÉ 13/02/2026:** ~86k lignes | 81 pages | 203 MCP tools | 38 Personas | 25 Function Tools | 7 Widgets

## Overview

VocalIA is a comprehensive Voice AI SaaS platform combining:

- **Voice Widget** - Browser-based (Web Speech API, $0 cost) - 7 widgets, 11,001 lines
- **Voice Telephony AI** - PSTN integration (Twilio + Grok WebSocket) - ~4,800 lines, 25 function tools
- **SaaS Webapp** - Multi-tenant dashboards (Auth, HITL, Analytics) - 81 pages

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
│  │  • 7 widgets        │    │  • Grok WebSocket           │    │
│  │    (Shadow DOM)     │    │  • 25 Function Tools        │    │
│  │  • 11,001 lines      │    │  • ~4,800 lines            │    │
│  └─────────────────────┘    └─────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   SHARED COMPONENTS                      │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  • 38 Multi-Tenant Personas (8,800 lines)               │   │
│  │  • 5 Languages (FR, EN, ES, AR, ARY/Darija)            │   │
│  │  • 27 ElevenLabs Voices (Males + Females)              │   │
│  │  • Marketing Science (BANT, PAS, CIALDINI, AIDA)       │   │
│  │  • 31 Native Integrations (CRM, E-commerce, Calendar)  │   │
│  │  • Multi-AI Fallback (Grok→Gemini→Claude→Atlas)        │   │
│  │  • 203 MCP Tools | 3,803 Tests | 68 Test Files        │   │
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
node core/voice-api-resilient.cjs

# Grok Realtime (port 3007)
node core/grok-voice-realtime.cjs

# Telephony Bridge (port 3009) - requires Twilio
node telephony/voice-telephony-bridge.cjs

# DB API (port 3013)
node core/db-api.cjs
```

### 3. Health Check

```bash
node scripts/health-check.cjs
```

## Directory Structure (VÉRIFIÉ 13/02/2026)

```
VocalIA/                          # ~86,000 lignes source
├── core/                    # 58 modules (~37,600 lignes)
│   ├── voice-api-resilient.cjs   (~3,500)
│   ├── db-api.cjs                (~3,100)
│   ├── OAuthGateway.cjs          (~400)   ← port 3010
│   ├── WebhookRouter.cjs         (~350)   ← port 3011
│   ├── remotion-hitl.cjs         (645)    ← port 3012 (hybrid)
│   └── [+53 modules]
├── widget/                  # 7 fichiers (11,001 lignes)
│   ├── voice-widget-b2b.js       (1,573)  ← 49 pages
│   ├── voice-widget-v3.js        (3,684)  ← e-commerce.html
│   └── [+5 ECOM sub-widgets]
├── telephony/               # 1 fichier (~4,800 lignes)
│   └── voice-telephony-bridge.cjs (25 function tools)
├── personas/                # 3 fichiers (8,800 lignes)
│   └── voice-persona-injector.cjs (38 personas × 5 langs)
├── integrations/            # 7 fichiers (2,234 lignes)
├── sensors/                 # 4 fichiers (852 lignes)
├── mcp-server/              # TypeScript (~19,300 lignes, 33 .ts, 203 tools)
├── distribution/            # 5 platforms (npm, shopify, wordpress, wix, zapier)
├── website/                 # 81 pages HTML
│   └── src/locales/         # 5 langues (~27,800 lignes)
└── docs/                    # Documentation
```

## Features

### Voice Widget (Browser) - 7 widgets, 11,001 lines — ALL Shadow DOM

- voice-widget-b2b.js (1,573) - B2B Lead Widget + Catalog Mode (49 pages)
- voice-widget-v3.js (3,684) - E-commerce Core + Widget Orchestrator
- abandoned-cart-recovery.js (1,446) - Cart recovery
- spin-wheel.js (1,248) - Gamification
- voice-quiz.js (1,163) - Product quiz
- free-shipping-bar.js (847) - Shipping progress
- recommendation-carousel.js (656) - AI Product Carousel

### Voice Telephony AI (PSTN) - 4,709 lines, 25 function tools

- Twilio PSTN ↔ Grok WebSocket bridge
- 25 function tools (Session 250.94: +CRM +E-commerce)
- HITL (Human-in-the-Loop) controls
- WhatsApp/SMS confirmation

### Multi-Tenant Personas (38)

- Tier 1 (Core): AGENCY, DENTAL, PROPERTY, CONTRACTOR
- Tier 2 (Expansion): HEALER, COUNSELOR, CONCIERGE, STYLIST, RECRUITER...
- Tier 3 (Universal): UNIVERSAL_ECOMMERCE, UNIVERSAL_SME
- Tier 4 (Economy): RETAILER, BUILDER, RESTAURATEUR, CONSULTANT, DOCTOR, NOTARY...

### Languages

- French (FR)
- English (EN)
- Spanish (ES)
- Arabic MSA (AR)
- Moroccan Darija (ARY) - via Atlas-Chat-9B + ElevenLabs

## Credentials Required

```bash
# Required
XAI_API_KEY=              # Grok API (Primary)
GOOGLE_GENERATIVE_AI_API_KEY=  # Gemini fallback
ELEVENLABS_API_KEY=       # TTS/STT

# For Telephony (optional)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# For CRM Integration (optional)
HUBSPOT_ACCESS_TOKEN=
SHOPIFY_ACCESS_TOKEN=
SHOPIFY_STORE=
```

## WordPress/WooCommerce Integration (COMPLETE)

| Composant | Fichier | Lignes | Fonction |
|:----------|:--------|:------:|:---------|
| MCP WooCommerce Tools | `mcp-server/src/tools/woocommerce.ts` | 687 | 7 tools REST v3 |
| WordPress Plugin | `plugins/wordpress/vocalia-voice-widget.php` | 514 | Widget injection |
| Catalog Connector | `core/catalog-connector.cjs` | ~200 | WooCommerceCatalogConnector |

**WooCommerce MCP Tools (7):** list_orders, get_order, update_order, list_products, get_product, list_customers, get_customer

## Competitive Positioning

| Feature | Vapi | Retell | VocalIA |
|---------|------|--------|---------|
| Pricing | $0.15-0.33/min | $0.13-0.31/min | **$0.26/min tout-inclus** |
| Widget + Telephony | ❌ | ❌ | ✅ |
| 5 Languages | ❌ | ❌ | ✅ (FR/EN/ES/AR/ARY) |
| Multi-Personas | ❌ | ❌ | ✅ (38) |
| MCP Server | ❌ | ❌ | ✅ (203 tools) |
| WordPress/WooCommerce | ❌ | ❌ | ✅ (7 tools + plugin) |
| Self-Hosted | ❌ | ❌ | ✅ |
| Tests | ❌ | ❌ | ✅ (5,015+ tests) |

## Platform Metrics (VÉRIFIÉ 13/02/2026)

| Metric | Value | Verification |
|--------|-------|--------------|
| Core Backend | ~37,600 lines (58 files) | `wc -l core/*.cjs` |
| Telephony | ~4,800 lines | `wc -l telephony/*.cjs` |
| Personas | 8,800 lines (3 files) | `wc -l personas/*.cjs personas/*.json` |
| Widget | 11,001 lines (7 files) | `wc -l widget/*.js` |
| MCP Server | ~19,300 lines (33 files) | `find mcp-server/src -name "*.ts" -exec wc -l {} +` |
| i18n Locales | ~27,800 lines | `wc -l website/src/locales/*.json` |
| HTML Pages | 81 | `find website -name "*.html" \| wc -l` |
| HTTP Services | 8 (7 deployed + 1 non-deployed) | docker-compose + standalone |
| MCP Tools | 203 (0 connected) | `grep -c "server.tool("` |
| Function Tools | 25 | `grep -c "name: '"` |
| Personas | 38 | grep unique |
| Tests | 5,015+ (77 files, 0 fail) | `node --test test/*.mjs` |
| Distribution | 5 platforms | npm, shopify, wordpress, wix, zapier |
| Bugs Fixed | 432+ across 45+ phases | See ROADMAP-TO-COMPLETION.md |

## License

Proprietary - VocalIA. All rights reserved.

---

**Website:** https://vocalia.ma | **GitHub:** https://github.com/Jouiet/VoicalAI
**VocalIA - SOTA Voice AI Systems**
