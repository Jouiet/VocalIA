# VocalIA Platform Reference

> **Session 250.139** | Verified 08/02/2026 (`wc -l` + `ls` + `grep -c`)

## Architecture

| Dossier | Fichiers | Lignes | Vérifié |
|---------|----------|--------|---------|
| core/ | 54 | 34,533 | `wc -l core/*.cjs` |
| telephony/ | 1 | 4,732 | `wc -l telephony/*.cjs` |
| personas/ | 3 | 8,700 | `wc -l personas/*.cjs personas/*.json` |
| widget/ | 7 | 9,671 | `wc -l widget/*.js` |
| sensors/ | 4 | 822 | `wc -l sensors/*.cjs` |
| integrations/ | 7 | 2,234 | `wc -l integrations/*.cjs` |
| lib/ | 1 | 923 | `wc -l lib/*.cjs` |
| mcp-server/src/ | 32 | 19,173 | `wc -l mcp-server/src/**/*.ts` |

**Backend total**: ~61,615 lines | **With MCP**: ~80,788 lines

## Production Readiness

| Component | Code Exists | Deployed | Live Data |
|:----------|:----------:|:--------:|:---------:|
| Voice API (3004) | ✅ | ✅ | ❌ 0 live calls |
| Voice Widget B2B | ✅ | ✅ (website) | ❌ 0 real conversations |
| Voice Widget ECOM | ✅ | ✅ (1 page) | ❌ no catalog connected |
| Telephony PSTN | ✅ | ❌ no Twilio config | ❌ |
| MCP Server (203 tools) | ✅ | ❌ TypeScript only | ❌ 0 API keys connected |
| Multi-tenant (22 clients) | ✅ | ❌ test data only | ❌ 0 paying customers |
| OAuth Gateway (3010) | ✅ | ❌ | ❌ |
| Webhook Router (3011) | ✅ | ❌ | ❌ |
| DB API (3013) | ✅ | ❌ | ❌ |
| i18n (5 langs) | ✅ | ✅ (website) | ✅ |

## Services (7 Ports)

| Service | Port | Script |
|---------|------|--------|
| Voice API | 3004 | `voice-api-resilient.cjs` |
| Grok Realtime | 3007 | `grok-voice-realtime.cjs` |
| Telephony | 3009 | `voice-telephony-bridge.cjs` |
| OAuth Gateway | 3010 | `OAuthGateway.cjs` |
| Webhook Router | 3011 | `WebhookRouter.cjs` |
| Remotion HITL | 3012 | `remotion-hitl.cjs` |
| DB API | 3013 | `db-api.cjs` |

## Fallback Chain

```javascript
providers: [
  { name: 'grok', model: 'grok-4-1-fast-reasoning' },
  { name: 'gemini', model: 'gemini-3-flash' },
  { name: 'anthropic', model: 'claude-opus-4-5' },
  { name: 'atlas', model: 'Atlas-Chat-9B' },  // Darija
  { name: 'local', model: 'rule-based' }
]
```

## 25 Function Tools (`grep -c "name: '" telephony/voice-telephony-bridge.cjs`)

```
booking_confirmation    get_available_slots    get_services
browse_catalog          get_customer_tags      get_trips
check_item_availability get_item_details       get_vehicles
check_order_status      get_menu               handle_complaint
check_product_stock     get_packages           handle_objection
create_booking          get_recommendations    qualify_lead
schedule_callback       search_catalog         search_knowledge_base
send_payment_details    start_product_quiz     track_conversion_event
transfer_call
```

## 38 Personas (`grep -E "^\s+[A-Z_]+:\s*\{$" | sort -u | wc -l`)

| Tier | Count | Examples |
|:-----|:-----:|:---------|
| Core | 4 | AGENCY, DENTAL, PROPERTY, CONTRACTOR |
| Expansion | 16 | HEALER, COUNSELOR, CONCIERGE, STYLIST... |
| Universal | 2 | UNIVERSAL_ECOMMERCE, UNIVERSAL_SME |
| Economy | 16 | RETAILER, BUILDER, RESTAURATEUR, TRAVEL_AGENT... |

## Widgets (7 fichiers — `ls widget/*.js | wc -l`)

| Widget | LOC | Purpose |
|--------|-----|---------|
| voice-widget-v3.js | 3,383 | E-commerce Core (IIFE) |
| abandoned-cart-recovery.js | 1,411 | Cart Recovery (IIFE) |
| spin-wheel.js | 1,176 | Gamification (IIFE) |
| voice-quiz.js | 1,127 | Interactive Quiz (IIFE) |
| voice-widget-b2b.js | 1,122 | B2B Lead Widget (standalone) |
| free-shipping-bar.js | 826 | Shipping Progress (IIFE) |
| recommendation-carousel.js | 626 | AI Product Carousel (IIFE) |

**Note**: intelligent-fallback.js (153 lines) was deleted. ECOM bundle = 6 IIFEs concatenated. B2B = standalone.

## Languages: FR, EN, ES, AR, ARY (5)

## HITL

```bash
HITL_VOICE_ENABLED=true
HITL_APPROVE_HOT_BOOKINGS=true
HITL_APPROVE_TRANSFERS=true
HITL_BOOKING_SCORE_THRESHOLD=70
HITL_SLACK_WEBHOOK=
```

## WordPress/WooCommerce

WooCommerce MCP: 7 tools (list_orders, get_order, update_order, list_products, get_product, list_customers, get_customer)
WordPress Plugin: `plugins/wordpress/vocalia-voice-widget.php` (514 lines)
