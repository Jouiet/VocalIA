# Règles Core VocalIA - Chargées TOUJOURS

> **MÀJOUR RIGOUREUSE: 05/02/2026 - Session 250.94**
> Métriques vérifiées avec `wc -l` et `grep -c`

## Architecture (VÉRIFIÉ 05/02/2026)
```
VocalIA/                              # ~140,000 lignes total
├── core/                    # 38 modules (32,727 lignes)
├── widget/                  # 8 fichiers (9,107 lignes)
├── telephony/               # 1 fichier (4,709 lignes, 25 function tools)
├── personas/                # 2 fichiers (5,995 lignes, 40 personas)
├── integrations/            # 7 fichiers (2,234 lignes)
├── sensors/                 # 4 fichiers (822 lignes)
├── mcp-server/              # TypeScript (17,630 lignes, 203 tools)
├── website/                 # 76 pages HTML
│   └── src/lib/            # 21 JS libs (7,563 lignes)
│   └── src/locales/        # 5 langues (23,790 lignes)
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
| GOOGLE_GENERATIVE_AI_API_KEY | Gemini Fallback | ✅ |
| ELEVENLABS_API_KEY | TTS/STT | ✅ |
| TWILIO_ACCOUNT_SID | Telephony | Pour PSTN |
| TWILIO_AUTH_TOKEN | Telephony | Pour PSTN |
| TWILIO_PHONE_NUMBER | Telephony | Pour PSTN |
| ANTHROPIC_API_KEY | Claude Fallback | ⚠️ Optional |
| WOOCOMMERCE_URL | WooCommerce E-commerce | Pour WP tenants |
| WOOCOMMERCE_CONSUMER_KEY | WooCommerce E-commerce | Pour WP tenants |
| WOOCOMMERCE_CONSUMER_SECRET | WooCommerce E-commerce | Pour WP tenants |

## WordPress/WooCommerce (COMPLETE)
| Composant | Fichier | Lignes | Tools |
|:----------|:--------|:------:|:-----:|
| MCP WooCommerce | `mcp-server/src/tools/woocommerce.ts` | 687 | 7 |
| WordPress Plugin | `plugins/wordpress/vocalia-voice-widget.php` | 514 | - |
| Catalog Connector | `core/catalog-connector.cjs` | ~200 | - |

**Note:** `wordpress.ts` MCP N'EST PAS nécessaire - WooCommerce couvre le besoin.

## Services (7 Ports)
| Service | Port | Commande |
|:--------|:----:|:---------|
| Voice API | 3004 | `node core/voice-api-resilient.cjs` |
| Grok Realtime | 3007 | `node core/grok-voice-realtime.cjs` |
| Telephony Bridge | 3009 | `node telephony/voice-telephony-bridge.cjs` |
| OAuth Gateway | 3010 | `node core/OAuthGateway.cjs --start` |
| Webhook Router | 3011 | `node core/WebhookRouter.cjs --start` |
| Remotion HITL | 3012 | `node core/remotion-hitl.cjs` |
| DB API | 3013 | `node core/db-api.cjs` |

## Health Check
```bash
node scripts/health-check.cjs
```

## Deploy
Production: https://vocalia.ma
VPS: Hostinger Docker Compose (api.vocalia.ma)
