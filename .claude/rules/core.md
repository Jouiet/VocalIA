# Règles Core VocalIA - Chargées TOUJOURS

## Architecture
```
VocalIA/
├── core/                    # Voice engine (4 fichiers)
├── widget/                  # Browser widget (2 fichiers)
├── telephony/               # PSTN bridge (1 fichier)
├── personas/                # Multi-tenant (1 fichier)
├── integrations/            # CRM/E-commerce (2 fichiers)
├── scripts/                 # Utilities (1 fichier)
└── docs/                    # Documentation
```

## Standards Code
- CommonJS (.cjs), 2 espaces, single quotes
- Credentials: `process.env.*` (jamais hardcodé)
- Erreurs: `console.error('❌ ...')`
- Succès: `console.log('✅ ...')`

## Validation Credentials
```javascript
// Pattern obligatoire pour tous les scripts
const requiredEnv = ['XAI_API_KEY'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`❌ ${key} non défini`);
    process.exit(1);
  }
}
```

## Credentials Critiques VocalIA
| Credential | Service | Requis |
|:-----------|:--------|:------:|
| XAI_API_KEY | Grok Voice | ✅ |
| GOOGLE_GENERATIVE_AI_API_KEY | Gemini Fallback | ⚠️ |
| TWILIO_ACCOUNT_SID | Telephony | Pour PSTN |
| TWILIO_AUTH_TOKEN | Telephony | Pour PSTN |
| TWILIO_PHONE_NUMBER | Telephony | Pour PSTN |

## Services (Ports)
| Service | Port | Commande |
|:--------|:----:|:---------|
| Voice API | 3004 | `node core/voice-api-resilient.cjs` |
| Grok Realtime | 3007 | `node core/grok-voice-realtime.cjs` |
| Telephony Bridge | 3009 | `node telephony/voice-telephony-bridge.cjs` |

## Health Check
```bash
node scripts/voice-quality-sensor.cjs --health
```

## Deploy
Parent: 3A Automation (JO-AAA)
VPS: Hostinger 1168256 (si déployé en prod)
