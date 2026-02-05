# VocalIA - Voice AI Platform

> **Domain:** https://vocalia.ma | **Version:** 7.2.0 | **Session:** 250.94
> **🌐 PRODUCTION LIVE** | HTTP/2 ✅ | HSTS preload ✅ | Security 100/100 ✅
> **MÉTRIQUES VÉRIFIÉ 05/02/2026:** ~140k lignes | 76 pages | 203 MCP tools | 40 Personas | 25 Function Tools

## Overview

VocalIA is a comprehensive Voice AI SaaS platform combining:

- **Voice Widget** - Browser-based (Web Speech API, $0 cost) - 8 widgets, 9,107 lines
- **Voice Telephony AI** - PSTN integration (Twilio + Grok WebSocket) - 4,709 lines, 25 function tools
- **SaaS Webapp** - Multi-tenant dashboards (Auth, HITL, Analytics) - 76 pages

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
│  │  • 8 E-commerce     │    │  • Grok WebSocket           │    │
│  │    widgets          │    │  • 25 Function Tools        │    │
│  │  • 9,107 lines      │    │  • 4,709 lines             │    │
│  └─────────────────────┘    └─────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   SHARED COMPONENTS                      │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  • 40 Multi-Tenant Personas (5,995 lines)               │   │
│  │  • 5 Languages (FR, EN, ES, AR, ARY/Darija)            │   │
│  │  • 27 ElevenLabs Voices (Males + Females)              │   │
│  │  • Marketing Science (BANT, PAS, CIALDINI, AIDA)       │   │
│  │  • 31 Native Integrations (CRM, E-commerce, Calendar)  │   │
│  │  • Multi-AI Fallback (Grok→Gemini→Claude→Atlas)        │   │
│  │  • 203 MCP Tools | 306 Unit Tests | 375 E2E Tests     │   │
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

## Directory Structure (VÉRIFIÉ wc -l 05/02/2026)

```
VocalIA/                          # ~140,000 lignes total
├── core/                    # 38 modules (32,727 lignes)
│   ├── voice-api-resilient.cjs   (3,018)
│   ├── db-api.cjs                (2,721)
│   ├── catalog-connector.cjs     (2,287)
│   ├── voice-crm-tools.cjs       (351) ← Session 250.94
│   └── voice-ecommerce-tools.cjs (389) ← Session 250.94
├── widget/                  # 8 fichiers (9,107 lignes)
│   ├── voice-widget-v3.js        (3,135)
│   ├── abandoned-cart-recovery.js (1,416)
│   └── [+6 widgets]
├── telephony/               # 1 fichier (4,709 lignes)
│   └── voice-telephony-bridge.cjs (25 function tools)
├── personas/                # 2 fichiers (5,995 lignes)
│   └── voice-persona-injector.cjs (40 personas)
├── integrations/            # 7 fichiers (2,234 lignes)
├── sensors/                 # 4 fichiers (822 lignes)
├── mcp-server/              # TypeScript (17,630 lignes, 203 tools)
├── website/                 # 76 pages HTML
│   └── src/locales/         # 5 langues (23,790 lignes)
└── docs/                    # Documentation
```

## Features

### Voice Widget (Browser) - 8 widgets, 9,107 lines

- voice-widget-v3.js (3,135) - E-commerce Core
- abandoned-cart-recovery.js (1,416) - +25% cart recovery
- spin-wheel.js (1,176) - Gamification +15% conversion
- voice-quiz.js (1,127) - +65% completion vs text
- free-shipping-bar.js (826) - +20% AOV
- voice-widget-b2b.js (659) - B2B Lead Widget
- recommendation-carousel.js (615) - AI Product Carousel
- intelligent-fallback.js (153) - Graceful Degradation

### Voice Telephony AI (PSTN) - 4,709 lines, 25 function tools

- Twilio PSTN ↔ Grok WebSocket bridge
- 25 function tools (Session 250.94: +CRM +E-commerce)
- HITL (Human-in-the-Loop) controls
- WhatsApp/SMS confirmation

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
| Pricing | $0.15-0.33/min | $0.13-0.31/min | **$0.06/min** |
| Widget + Telephony | ❌ | ❌ | ✅ |
| Darija Support | ❌ | ❌ | ✅ |
| Multi-Personas | ❌ | ❌ | ✅ (40) |
| MCP Server | ❌ | ❌ | ✅ (203 tools) |
| WordPress/WooCommerce | ❌ | ❌ | ✅ (7 tools + plugin) |
| Self-Hosted | ❌ | ❌ | ✅ |
| E2E Tests | ❌ | ❌ | ✅ (375 tests) |

## Platform Metrics (VÉRIFIÉ 05/02/2026)

| Metric | Value | Verification |
|--------|-------|--------------|
| Core Backend | 32,727 lines | `wc -l core/*.cjs` |
| Telephony | 4,709 lines | `wc -l telephony/*.cjs` |
| Personas | 5,995 lines | `wc -l personas/*.cjs` |
| Widget | 9,107 lines | `wc -l widget/*.js` |
| MCP Server | 17,630 lines | `wc -l mcp-server/src/**/*.ts` |
| i18n Locales | 23,790 lines | `wc -l website/src/locales/*.json` |
| HTML Pages | 76 | `find website -name "*.html" \| wc -l` |
| MCP Tools | 203 | `grep -c "server.tool("` |
| Function Tools | 25 | `grep -c "name: '"` |
| Personas | 40 | grep unique |
| Unit Tests | 306 (100% pass) | `npm test` |
| E2E Tests | 375 (99.5% pass) | Playwright |
| Security Score | 100/100 | HTTPS, HSTS, CSP |

## License

Proprietary - VocalIA. All rights reserved.

---

**Website:** https://vocalia.ma | **GitHub:** https://github.com/Jouiet/VoicalAI
**VocalIA - SOTA Voice AI Systems**
