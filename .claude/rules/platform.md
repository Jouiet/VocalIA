# VocalIA Platform Reference

> **Session 250.105** | Verified 06/02/2026

## Architecture

| Dossier | Fichiers | Lignes |
|---------|----------|--------|
| core/ | 53 | 33,920 |
| telephony/ | 1 | 4,709 |
| personas/ | 2 | ~9,020 |
| widget/ | 8 | 9,353 |
| sensors/ | 4 | 822 |
| integrations/ | 7 | 2,234 |
| lib/ | 1 | 921 |
| mcp-server/src/ | 31 | 17,630 |

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

## 40 Personas (`grep -E "^\s+[A-Z_]+:\s*\{$" | sort -u | wc -l`)

| Tier | Count | Examples |
|:-----|:-----:|:---------|
| Core | 5 | AGENCY, DENTAL, PROPERTY, CONTRACTOR, FUNERAL |
| Expansion | 19 | HEALER, MECHANIC, COUNSELOR, CONCIERGE, STYLIST... |
| Universal | 2 | UNIVERSAL_ECOMMERCE, UNIVERSAL_SME |
| Economy | 14 | RETAILER, BUILDER, RESTAURATEUR, TRAVEL_AGENT... |

## Widgets (8 fichiers)

| Widget | LOC | Purpose |
|--------|-----|---------|
| voice-widget-v3.js | 3,135 | E-commerce Core |
| abandoned-cart-recovery.js | 1,416 | Cart Recovery |
| spin-wheel.js | 1,176 | Gamification |
| voice-quiz.js | 1,127 | Interactive Quiz |
| free-shipping-bar.js | 826 | Shipping Progress |
| voice-widget-b2b.js | 659 | B2B Lead Widget |
| recommendation-carousel.js | 615 | AI Product Carousel |
| intelligent-fallback.js | 153 | Graceful Degradation |

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
