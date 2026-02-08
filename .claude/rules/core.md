# Règles Core VocalIA

## Standards
- CommonJS (.cjs), 2 espaces, single quotes
- Credentials: `process.env.*` (jamais hardcodé)
- Erreurs: `console.error('❌ ...')` | Succès: `console.log('✅ ...')`
- Env validation: loop `requiredEnv` array, `process.exit(1)` if missing

## Credentials
| Key | Service |
|:----|:--------|
| XAI_API_KEY | Grok Voice (PRIMARY) |
| GOOGLE_GENERATIVE_AI_API_KEY | Gemini Fallback |
| ELEVENLABS_API_KEY | TTS/STT |
| TWILIO_* (3) | Telephony PSTN |
| ANTHROPIC_API_KEY | Claude (optional) |
| WOOCOMMERCE_* (3) | WP tenants |

## Deploy
Production: vocalia.ma | VPS: Hostinger Docker (api.vocalia.ma) | Health: `node scripts/health-check.cjs`
