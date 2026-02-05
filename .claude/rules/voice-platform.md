# Règles Voice Platform VocalIA

> **MÀJOUR RIGOUREUSE: 05/02/2026 - Session 250.94**
> Métriques vérifiées avec `wc -l` et `grep -c`

## Architecture 2 Produits

### Produit 1: Voice Widget (Browser)
```
Technologie: Web Speech API (gratuit) + AI Backend
Coût: $0 navigateur, pricing API backend
Fichiers: widget/ (8 fichiers, 9,107 lignes)
- voice-widget-v3.js (3,135) - E-commerce Core
- abandoned-cart-recovery.js (1,416)
- spin-wheel.js (1,176)
- voice-quiz.js (1,127)
- free-shipping-bar.js (826)
- voice-widget-b2b.js (659)
- recommendation-carousel.js (615)
- intelligent-fallback.js (153)
```

### Produit 2: Voice Telephony AI (PSTN)
```
Technologie: PSTN ↔ AI WebSocket Bridge
Coût: Compétitif (voir pricing commercial)
Fichiers: telephony/voice-telephony-bridge.cjs (4,709 lignes)
         core/grok-voice-realtime.cjs (1,109 lignes)
Function Tools: 25 (VÉRIFIÉ grep -c "name: '")
```

## Multi-AI Fallback Chain
```javascript
// Ordre de fallback (voice-api-resilient.cjs)
providers: [
  { name: 'grok', model: 'grok-4-1-fast-reasoning' },    // Primary
  { name: 'gemini', model: 'gemini-3-flash' },           // Fallback 1
  { name: 'anthropic', model: 'claude-opus-4-5' },       // Fallback 2
  { name: 'atlas', model: 'Atlas-Chat-9B' },             // Darija only
  { name: 'local', model: 'rule-based-fallback' }        // Emergency
]
// Trigger: Latency > 15s OR Status != 200
```

## 40 Personas (voice-persona-injector.cjs) - VÉRIFIÉ 05/02/2026
| Tier | Count | Examples |
|:-----|:-----:|:---------|
| Tier 1 (Core) | 5 | AGENCY, DENTAL, PROPERTY, CONTRACTOR, FUNERAL |
| Tier 2 (Expansion) | 19 | HEALER, MECHANIC, COUNSELOR, CONCIERGE, STYLIST, RECRUITER, DISPATCHER, COLLECTOR, INSURER... |
| Tier 3 (Universal) | 2 | UNIVERSAL_ECOMMERCE, UNIVERSAL_SME |
| Tier 4 (Economy) | 14 | RETAILER, BUILDER, RESTAURATEUR, TRAVEL_AGENT, CONSULTANT, IT_SERVICES, DOCTOR, NOTARY, BAKERY, GROCERY... |

**Total: 40 personas** (vérifié: `grep -E "^\s+[A-Z_]+:\s*\{$" | sort -u | wc -l`)

## 25 Function Tools (voice-telephony-bridge.cjs) - VÉRIFIÉ 05/02/2026
| Tool | Purpose |
|:-----|:--------|
| qualify_lead | BANT scoring |
| handle_objection | Analytics |
| check_order_status | Shopify/WooCommerce lookup |
| check_product_stock | Inventory |
| get_customer_tags | Klaviyo |
| schedule_callback | Follow-up |
| create_booking | Calendar |
| track_conversion_event | Analytics |
| search_knowledge_base | RAG |
| send_payment_details | Payment |
| transfer_call | Human handoff |
| start_product_quiz | Voice quiz |
| lookup_customer | HubSpot/Pipedrive lookup (Session 250.94) |
| create_lead | HubSpot contact creation (Session 250.94) |
| update_customer | HubSpot PATCH (Session 250.94) |
| log_call | HubSpot call engagement (Session 250.94) |
| check_stock | Catalog connector stock |
| recommend_products | AI recommendations |
| get_order_history | Shopify order history (Session 250.94) |
| get_similar_products | Similar products |
| get_frequently_bought_together | Cross-sell |
| get_personalized_recommendations | Personalized |
| queue_cart_recovery_callback | Cart recovery |
| send_cart_recovery_sms | SMS recovery |
| browse_catalog | Catalog browsing |

## HITL Controls
```bash
# ENV Variables
HITL_VOICE_ENABLED=true
HITL_APPROVE_HOT_BOOKINGS=true
HITL_APPROVE_TRANSFERS=true
HITL_BOOKING_SCORE_THRESHOLD=70  # 60|70|80|90
HITL_SLACK_WEBHOOK=              # Notifications
```

## Langues Supportées
| Code | Langue | Support |
|:-----|:-------|:--------|
| fr | Français | ✅ Full |
| en | English | ✅ Full |
| es | Español | ✅ Full |
| ar | Arabic MSA | ✅ Full |
| ary | Darija (Moroccan) | ✅ Native support (ElevenLabs) |

## WordPress/WooCommerce (COMPLETE - Session 250.94)

| Composant | Fichier | Lignes | Tools |
|:----------|:--------|:------:|:-----:|
| MCP WooCommerce | `woocommerce.ts` | 687 | 7 |
| WordPress Plugin | `vocalia-voice-widget.php` | 514 | N/A |
| Catalog Connector | `catalog-connector.cjs` | ~200 | N/A |

**WooCommerce Tools:** list_orders, get_order, update_order, list_products, get_product, list_customers, get_customer

**Note:** `wordpress.ts` MCP N'EST PAS nécessaire - WooCommerce couvre le besoin e-commerce WordPress.

## Avantages Concurrentiels
| Avantage | Description |
|:---------|:------------|
| Pricing | 60% moins cher que alternatives |
| Platform | Widget + Telephony intégré |
| Personas | 40 personas SOTA |
| Langues | Seul avec Darija native |
| MCP Tools | 203 tools (vérifié) |
| E-commerce | 7 platforms, ~64% market coverage |
| WordPress | ✅ WooCommerce 7 tools + Plugin PHP |
