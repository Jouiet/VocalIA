# Règles Voice Platform VocalIA

## Architecture 2 Produits

### Produit 1: Voice Widget (Browser)
```
Technologie: Web Speech API (gratuit)
Coût: $0
Fichiers: widget/voice-widget-core.js, widget/voice-widget-templates.cjs
```

### Produit 2: Voice Telephony AI (PSTN)
```
Technologie: Twilio PSTN ↔ Grok WebSocket
Coût: ~$0.06/min (Grok $0.05 + Twilio $0.01)
Fichiers: telephony/voice-telephony-bridge.cjs, core/grok-voice-realtime.cjs
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

## 40 Personas (voice-persona-injector.cjs) - Session 250.6
| Tier | Count | Examples |
|:-----|:-----:|:---------|
| Tier 1 (Core) | 5 | AGENCY, DENTAL, PROPERTY, CONTRACTOR, FUNERAL |
| Tier 2 (Expansion) | 19 | HEALER, MECHANIC, COUNSELOR, CONCIERGE, STYLIST, RECRUITER, DISPATCHER, COLLECTOR, INSURER... |
| Tier 3 (Universal) | 2 | UNIVERSAL_ECOMMERCE, UNIVERSAL_SME |
| Tier 4 (NEW Economy) | 14 | RETAILER, BUILDER, RESTAURATEUR, TRAVEL_AGENT, CONSULTANT, IT_SERVICES, DOCTOR, NOTARY, BAKERY, GROCERY... |

**Removed (Session 250.6):** GOVERNOR, SCHOOL, HOA, SURVEYOR (admin), DRIVER (hors scope B2B)
**GROCERY reinstated:** Marché livraison grocery $128M Maroc + $59B Europe

## 11 Function Tools (voice-telephony-bridge.cjs)
| Tool | Ligne | Purpose |
|:-----|:------|:--------|
| qualify_lead | 605 | BANT scoring |
| handle_objection | 645 | Analytics |
| check_order_status | 665 | Shopify lookup |
| check_product_stock | 680 | Inventory |
| get_customer_tags | 695 | Klaviyo |
| schedule_callback | 710 | Follow-up |
| create_booking | 734 | Calendar |
| track_conversion_event | 775 | Analytics |
| search_knowledge_base | 801 | RAG |
| send_payment_details | 820 | Payment |
| transfer_call | 844 | Human handoff |

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
| ary | Darija (Moroccan) | ✅ via Atlas-Chat-9B |

## Concurrents
| Concurrent | Pricing | Notre Avantage |
|:-----------|:--------|:---------------|
| Vapi | $0.15-0.33/min | 60% moins cher |
| Retell | $0.13-0.31/min | Widget + Telephony |
| Bland | $0.09/min | 39 personas SOTA, Darija |
| Synthflow | $0.08-0.13/min | Self-hosted |
