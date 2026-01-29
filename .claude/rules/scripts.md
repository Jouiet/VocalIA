# VocalIA Scripts Reference

## Status VÉRIFIÉ (28/01/2026 - Session 184bis POST-FIX)

### Scripts Core VocalIA

| Category | Count | Status |
|----------|-------|--------|
| **Core Voice** | 14 | Production |
| **Integrations** | 3 | Production |
| **Telephony** | 1 | Production |
| **Widget** | 2 | Production |
| **Sensors** | 4 | Operational |
| **Total** | **24** | 100% module load |

---

## Key Scripts

| Script | Purpose | Port | Location |
|--------|---------|------|----------|
| voice-api-resilient.cjs | Multi-AI voice responses | 3004 | core/ |
| grok-voice-realtime.cjs | WebSocket audio streaming | 3007 | core/ |
| voice-telephony-bridge.cjs | PSTN ↔ Grok bridge | 3009 | telephony/ |
| voice-persona-injector.cjs | 30 personas injection | - | personas/ |
| voice-quality-sensor.cjs | Health monitoring | - | sensors/ |
| stitch-api.cjs | UI generation (MCP) | - | core/ |
| cost-tracking-sensor.cjs | API cost monitoring | - | sensors/ |

---

## Sensors (4 - VocalIA Specific)

| Sensor | Purpose | Status |
|--------|---------|--------|
| voice-quality-sensor.cjs | Voice API latency/health | ✅ OK |
| cost-tracking-sensor.cjs | API costs burn rate | ✅ OK |
| lead-velocity-sensor.cjs | Lead qualification rate | ✅ OK |
| retention-sensor.cjs | Client retention metrics | ⚠️ Needs config |

---

## Health Check Pattern

```bash
# Single script
node core/voice-api-resilient.cjs --health

# All sensors
for s in sensors/*.cjs; do echo "=== $s ===" && node "$s" --health 2>&1 | head -5; done
```

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

## HITL (Human In The Loop) - Voice Specific

| Script | HITL Type | Default | Options |
|--------|-----------|---------|---------|
| voice-telephony-bridge.cjs | BANT score | 70 | 60|70|80|90 |
| voice-api-resilient.cjs | Hot lead threshold | 75 | 60|70|75|80|90 |

### HITL ENV Variables

```bash
# Voice HITL
HITL_VOICE_ENABLED=true
HITL_APPROVE_HOT_BOOKINGS=true
HITL_APPROVE_TRANSFERS=true
HITL_BOOKING_SCORE_THRESHOLD=70    # 60|70|80|90
HITL_HOT_LEAD_THRESHOLD=75         # 60|70|75|80|90
HITL_SLACK_WEBHOOK=                # Optional notifications
```

### HITL Commands

```bash
node telephony/voice-telephony-bridge.cjs --list-pending
node telephony/voice-telephony-bridge.cjs --approve=<id>
node telephony/voice-telephony-bridge.cjs --reject=<id>
```

---

## Function Tools (11 - Telephony Bridge)

| Tool | Line | Purpose |
|------|------|---------|
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

---

## Service Ports

| Service | Port | Status |
|---------|------|--------|
| Voice API | 3004 | Available |
| Grok Realtime | 3007 | Available |
| Telephony Bridge | 3009 | Available |

---

## Start Commands

```bash
# Development (single service)
node core/voice-api-resilient.cjs --server --port=3004

# Production (all services)
npm run start:all
```

---

*Adapté de VocalIA - Session 184bis*
*VocalIA Voice AI Platform*
