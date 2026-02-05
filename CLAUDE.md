# VocalIA - Voice AI Platform

> **v6.94.0** | 05/02/2026 | Health: 100% | Production: https://vocalia.ma
> 70 pages | 22k+ i18n keys | 5 langs (FR/EN/ES/AR/ARY) | RTL | 306 unit + 375 E2E tests (99.5%)
> **186 MCP Tools** | 40 Personas | 8 E-commerce Widgets | 28 Integrations | Stripe 19 tools
> 🔴 **SESSION 250.87:** I18N CATASTROPHE - 7,143 untranslated keys (en: 1841, es: 2000, ar: 1658, ary: 1644)

## Quick Reference

| Item | Value |
|:-----|:------|
| Type | Voice AI SaaS Platform |
| Domain | www.vocalia.ma |
| Location | `~/Desktop/VocalIA/` |
| Scores | **Backend 84/100** (48/306 tests fail), **Frontend 40/100** (7,143 i18n untranslated), Security 100/100 |

---

## Architecture

```
VocalIA/                              # ~107,000 lines
├── core/           # 38 modules (~18,000 lines)
│   ├── voice-api-resilient.cjs   # Multi-AI fallback (port 3004)
│   ├── grok-voice-realtime.cjs   # WebSocket audio (port 3007)
│   ├── db-api.cjs                # REST API + Auth (port 3013)
│   ├── auth-service.cjs          # JWT + bcrypt
│   ├── GoogleSheetsDB.cjs        # Database (7 tables)
│   └── [+33 modules]
├── telephony/      # PSTN bridge (3,194 lines, 13 function tools)
├── personas/       # 40 personas SOTA (5,280 lines)
├── widget/         # Browser widget + 8 e-commerce widgets
├── website/        # 70 pages (51 public + 19 webapp)
│   └── src/locales/   # 5 langs (22k+ keys)
├── mcp-server/     # 186 tools TypeScript
└── docs/           # SESSION-HISTORY.md for detailed logs
```

---

## Services

| Service | Port | Command |
|:--------|:----:|:--------|
| Voice API | 3004 | `node core/voice-api-resilient.cjs` |
| Grok Realtime | 3007 | `node core/grok-voice-realtime.cjs` |
| Telephony | 3009 | `node telephony/voice-telephony-bridge.cjs` |
| OAuth Gateway | 3010 | `node core/OAuthGateway.cjs --start` |
| Webhook Router | 3011 | `node core/WebhookRouter.cjs --start` |
| DB API | 3013 | `node core/db-api.cjs` |
| Website | 8080 | `npx serve website` |

---

## Credentials

| Key | Service | Required |
|:----|:--------|:--------:|
| XAI_API_KEY | Grok (PRIMARY) | ✅ |
| GOOGLE_GENERATIVE_AI_API_KEY | Gemini | ✅ |
| ELEVENLABS_API_KEY | TTS/STT | ✅ |
| TWILIO_* | Telephony | For PSTN |
| ANTHROPIC_API_KEY | Claude fallback | Optional |

---

## i18n

| Lang | Code | RTL |
|:-----|:----:|:---:|
| Français | fr | No |
| English | en | No |
| Español | es | No |
| العربية | ar | Yes |
| Darija | ary | Yes |

**Geo-detect:** MA→FR+MAD, EU→FR+EUR, Other→EN+USD

---

## Commands

```bash
# Health
node scripts/health-check.cjs

# Build CSS
cd website && npm run build:css

# Translation QA
python3 scripts/translation-quality-check.py --verbose

# Deploy
git push origin main
```

---

## Code Standards

- CommonJS (.cjs), 2 spaces, single quotes
- Credentials: `process.env.*`
- Errors: `console.error('❌ ...')`
- Success: `console.log('✅ ...')`

---

## MCP Server (186 Tools - Verified)

| Category | Tools |
|:---------|:-----:|
| Stripe | 19 |
| Shopify | 8 |
| WooCommerce | 7 |
| Magento | 10 |
| PrestaShop | 10 |
| BigCommerce | 9 |
| Wix | 6 |
| Squarespace | 7 |
| Pipedrive | 7 |
| Zendesk + Freshdesk | 12 |
| Google Suite | 17 |
| UCP/CDP | 7 |
| iPaaS | 9 |
| Export | 5 |
| Other | ~49 |

---

## Key Features

| Feature | Status |
|:--------|:------:|
| Voice Widget v3.2 | ✅ 8 widgets |
| Telephony TwiML | ✅ |
| Multi-tenant KB | ✅ |
| A2A Protocol | ✅ 4 agents |
| UCP/CDP | ✅ 7 tools |
| PWA | ✅ |
| A/B Testing | ✅ |

---

## Documentation

| Doc | Content |
|:----|:--------|
| `docs/VOCALIA-SYSTEM-ARCHITECTURE.md` | Full architecture (988 lines) |
| `docs/SESSION-HISTORY.md` | **All session logs** |
| `docs/VOCALIA-MCP.md` | MCP 186 tools |
| `docs/PLUG-AND-PLAY-STRATEGY.md` | Multi-tenant |

---

## Products

| Product | Pricing |
|:--------|:--------|
| Voice Widget | 49€/month |
| Voice Telephony | 0.06€/min |

**Policy:** No Free Tier - 14-day trial only

> ⚠️ **Session 250.86 AUDIT**: i18n contamination (47 "free" claims), MCP gaps (5 modules missing)

---

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

---

## Voice Providers

| Provider | Use |
|:---------|:----|
| Grok | Primary LLM + Voice |
| Gemini | Fallback + TTS |
| ElevenLabs | Darija TTS (27 voices) |
| Twilio | Telephony PSTN |
| Web Speech API | Widget fallback |

---

*Full session history: `docs/SESSION-HISTORY.md`*
*Last update: 05/02/2026*
