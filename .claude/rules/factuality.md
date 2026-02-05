# Règles de Factualité VocalIA

> Toute affirmation doit être vérifiable empiriquement.
> **MÀJOUR RIGOUREUSE: 05/02/2026 - Session 250.94**

## Avant Toute Affirmation
1. Services "UP" → Vérifier avec `--health`
2. "X personas" → Compter dans voice-persona-injector.cjs
3. "X langues" → Vérifier prompts multilingues existent

## INTERDIT
- ❌ Claims sans test empirique
- ❌ Wishful thinking
- ❌ "Ça marche" sans vérification port

## Source de Vérité VocalIA
| Source | Données | Vérification |
|:-------|:--------|:-------------|
| `voice-persona-injector.cjs` | **40 personas** | `grep -E "^\s+[A-Z_]+:\s*\{$" \| sort -u \| wc -l` |
| `voice-telephony-bridge.cjs` | **25 function tools** | `grep -c "name: '"` |
| `mcp-server/src/index.ts` | **203 MCP tools** | `grep -c "server.tool("` |
| `scripts/voice-quality-sensor.cjs --health` | Runtime status | curl |
| `.env` | Credentials status | exists check |

## Vérification Rapide (COMMANDES EXACTES)
```bash
# Services status
curl -s http://localhost:3004/health 2>/dev/null || echo "3004 DOWN"
curl -s http://localhost:3007/health 2>/dev/null || echo "3007 DOWN"
curl -s http://localhost:3009/health 2>/dev/null || echo "3009 DOWN"

# Personas count (40 uniques)
grep -E "^\s+[A-Z_]+:\s*\{$" personas/voice-persona-injector.cjs | sort -u | wc -l

# Function tools count (25)
grep -c "name: '" telephony/voice-telephony-bridge.cjs

# MCP tools count (203)
grep -c "server.tool(" mcp-server/src/index.ts

# Line counts
wc -l core/*.cjs           # 32,727
wc -l telephony/*.cjs      # 4,709
wc -l personas/*.cjs       # 5,995
wc -l widget/*.js          # 9,107
wc -l sensors/*.cjs        # 822
wc -l integrations/*.cjs   # 2,234
```

## Métriques Vérifiées (05/02/2026)
| Métrique | Valeur | Commande Vérification |
|:---------|:------:|:----------------------|
| Core backend | **32,727** lignes | `wc -l core/*.cjs` |
| Telephony | **4,709** lignes | `wc -l telephony/*.cjs` |
| Personas | **5,995** lignes | `wc -l personas/*.cjs` |
| Widget | **9,107** lignes | `wc -l widget/*.js` |
| Sensors | **822** lignes | `wc -l sensors/*.cjs` |
| Integrations | **2,234** lignes | `wc -l integrations/*.cjs` |
| MCP Server | **17,630** lignes | `wc -l mcp-server/src/**/*.ts` |
| Website libs | **7,563** lignes | `wc -l website/src/lib/*.js` |
| i18n locales | **23,790** lignes | `wc -l website/src/locales/*.json` |
| HTML pages | **76** | `find website -name "*.html" \| wc -l` |
| Personas | **40** | grep unique |
| Function tools | **25** | grep count |
| MCP tools | **203** | grep count |
| Langues | **5** | FR, EN, ES, AR, ARY |
| Services | **7** | ports 3004, 3007, 3009, 3010, 3011, 3012, 3013 |
