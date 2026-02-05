# VocalIA Scripts Reference

> **MÀJOUR RIGOUREUSE: 05/02/2026 - Session 250.94**
> Métriques vérifiées avec `wc -l` et `grep -c`

## Status VÉRIFIÉ (05/02/2026)

### Fichiers par Dossier (wc -l vérifié)

| Dossier | Fichiers | Lignes |
|---------|----------|--------|
| **core/** | 38 | 32,727 |
| **telephony/** | 1 | 4,709 |
| **personas/** | 2 | 5,995 |
| **widget/** | 8 | 9,107 |
| **sensors/** | 4 | 822 |
| **integrations/** | 7 | 2,234 |
| **TOTAL Backend** | **60** | **55,594** |

---

## Key Scripts

| Script | Lignes | Port | Fonction |
|--------|--------|------|----------|
| voice-api-resilient.cjs | 3,018 | 3004 | Multi-AI voice responses |
| grok-voice-realtime.cjs | 1,109 | 3007 | WebSocket audio streaming |
| voice-telephony-bridge.cjs | 4,709 | 3009 | PSTN ↔ AI bridge, 25 function tools |
| db-api.cjs | 2,721 | 3013 | REST API + Auth + WebSocket |
| voice-persona-injector.cjs | 5,934 | - | 40 personas SOTA injection |
| voice-quality-sensor.cjs | 282 | - | Health monitoring |
| catalog-connector.cjs | 2,287 | - | 6 E-commerce connectors |

---

## Sensors (4 fichiers, 822 lignes)

| Sensor | Lignes | Purpose | Status |
|--------|--------|---------|--------|
| voice-quality-sensor.cjs | 282 | Voice API latency/health | ✅ OK |
| cost-tracking-sensor.cjs | 285 | API costs burn rate | ✅ OK |
| lead-velocity-sensor.cjs | 111 | Lead qualification rate | ✅ OK |
| retention-sensor.cjs | 144 | Client retention metrics | ⚠️ Needs config |

---

## Widget (8 fichiers, 9,107 lignes)

| Widget | Lignes | Purpose |
|--------|--------|---------|
| voice-widget-v3.js | 3,135 | E-commerce Widget Core |
| abandoned-cart-recovery.js | 1,416 | Cart Recovery (+25% recovery) |
| spin-wheel.js | 1,176 | Gamification (+15% conversion) |
| voice-quiz.js | 1,127 | Interactive Quiz (+65% completion) |
| free-shipping-bar.js | 826 | Shipping Progress (+20% AOV) |
| voice-widget-b2b.js | 659 | B2B Lead Widget |
| recommendation-carousel.js | 615 | AI Product Carousel |
| intelligent-fallback.js | 153 | Graceful Degradation |

---

## Fallback Pattern (All Voice Scripts)

```javascript
// Fallback chain (voice-api-resilient.cjs)
providers: [
  { name: 'grok', model: 'grok-4-1-fast-reasoning' },    // Primary - Real-time
  { name: 'gemini', model: 'gemini-3-flash' },           // Fallback 1
  { name: 'anthropic', model: 'claude-opus-4-5' },       // Fallback 2 (CRITICAL)
  { name: 'atlas', model: 'Atlas-Chat-9B' },             // Darija only
  { name: 'local', model: 'rule-based-fallback' }        // Emergency
]
// Trigger: Latency > 15s OR Status != 200
```

---

## Function Tools (25 - Telephony Bridge) - VÉRIFIÉ grep -c "name: '"

| Tool | Purpose |
|------|---------|
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
| lookup_customer | CRM lookup |
| create_lead | CRM create |
| update_customer | CRM update |
| log_call | CRM call log |
| check_stock | E-commerce stock |
| recommend_products | AI recommendations |
| get_order_history | Order history |
| get_similar_products | Similar products |
| get_frequently_bought_together | Cross-sell |
| get_personalized_recommendations | Personalized |
| queue_cart_recovery_callback | Cart recovery |
| send_cart_recovery_sms | SMS recovery |
| browse_catalog | Catalog browsing |

---

## HITL (Human In The Loop)

```bash
# ENV Variables
HITL_VOICE_ENABLED=true
HITL_APPROVE_HOT_BOOKINGS=true
HITL_APPROVE_TRANSFERS=true
HITL_BOOKING_SCORE_THRESHOLD=70    # 60|70|80|90
HITL_HOT_LEAD_THRESHOLD=75         # 60|70|75|80|90
HITL_SLACK_WEBHOOK=                # Optional notifications
```

---

## Service Ports (7 total)

| Service | Port | Status |
|---------|------|--------|
| Voice API | 3004 | Available |
| Grok Realtime | 3007 | Available |
| Telephony Bridge | 3009 | Available |
| OAuth Gateway | 3010 | Available |
| Webhook Router | 3011 | Available |
| Remotion HITL | 3012 | Available |
| DB API | 3013 | Available |

---

## Start Commands

```bash
# Development (single service)
node core/voice-api-resilient.cjs --server --port=3004

# Production (all services)
npm run start:all
```

---

## WordPress/WooCommerce (COMPLETE - Session 250.94)

**Architecture 3 Composants:**

| Composant | Fichier | Lignes | Fonction |
|:----------|:--------|:------:|:---------|
| MCP WooCommerce | `mcp-server/src/tools/woocommerce.ts` | 687 | 7 tools REST v3 |
| WordPress Plugin | `plugins/wordpress/vocalia-voice-widget.php` | 514 | Widget injection |
| Catalog Connector | `core/catalog-connector.cjs` | ~200 | WooCommerceCatalogConnector |

**WooCommerce MCP Tools (7):**
- `woocommerce_list_orders`, `woocommerce_get_order`, `woocommerce_update_order`
- `woocommerce_list_products`, `woocommerce_get_product`
- `woocommerce_list_customers`, `woocommerce_get_customer`

**Credentials:**
```bash
WOOCOMMERCE_URL=https://store.example.com
WOOCOMMERCE_CONSUMER_KEY=ck_xxxx
WOOCOMMERCE_CONSUMER_SECRET=cs_xxxx
```

**Note:** `wordpress.ts` MCP N'EST PAS nécessaire - VocalIA utilise WooCommerce pour e-commerce WordPress.

---

*VocalIA Voice AI Platform - Session 250.94*
