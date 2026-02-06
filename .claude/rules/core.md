# Règles Core VocalIA

> Session 250.105 | 06/02/2026

## Standards Code
- CommonJS (.cjs), 2 espaces, single quotes
- Credentials: `process.env.*` (jamais hardcodé)
- Erreurs: `console.error('❌ ...')`
- Succès: `console.log('✅ ...')`

## Validation Credentials (pattern obligatoire)
```javascript
const requiredEnv = ['XAI_API_KEY'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`❌ ${key} non défini`);
    process.exit(1);
  }
}
```

## Credentials
| Credential | Service | Requis |
|:-----------|:--------|:------:|
| XAI_API_KEY | Grok Voice (PRIMARY) | ✅ |
| GOOGLE_GENERATIVE_AI_API_KEY | Gemini Fallback | ✅ |
| ELEVENLABS_API_KEY | TTS/STT | ✅ |
| TWILIO_* (3 keys) | Telephony PSTN | Pour PSTN |
| ANTHROPIC_API_KEY | Claude Fallback | Optional |
| WOOCOMMERCE_* (3 keys) | WooCommerce | Pour WP tenants |

## Deploy
- Production: https://vocalia.ma
- VPS: Hostinger Docker Compose (api.vocalia.ma)
- Health: `node scripts/health-check.cjs`
