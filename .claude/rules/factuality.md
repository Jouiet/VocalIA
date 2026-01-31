# Règles de Factualité VocalIA

> Toute affirmation doit être vérifiable empiriquement.

## Avant Toute Affirmation
1. Services "UP" → Vérifier avec `--health`
2. "X personas" → Compter dans voice-persona-injector.cjs
3. "X langues" → Vérifier prompts multilingues existent

## INTERDIT
- ❌ Claims sans test empirique
- ❌ Wishful thinking
- ❌ "Ça marche" sans vérification port

## Source de Vérité VocalIA
| Source | Données |
|:-------|:--------|
| `voice-persona-injector.cjs` | 41 personas (SOTA structure) |
| `voice-telephony-bridge.cjs` | 11 function tools (lignes 605-844) |
| `scripts/voice-quality-sensor.cjs --health` | Runtime status |
| `.env` | Credentials status |

## Vérification Rapide
```bash
# Services status
curl -s http://localhost:3004/health 2>/dev/null || echo "3004 DOWN"
curl -s http://localhost:3007/health 2>/dev/null || echo "3007 DOWN"
curl -s http://localhost:3009/health 2>/dev/null || echo "3009 DOWN"

# Personas count
grep -c "key:" personas/voice-persona-injector.cjs

# Function tools count
grep -c "name: '" telephony/voice-telephony-bridge.cjs
```

## Métriques Vérifiables
| Métrique | Valeur | Vérification |
|:---------|:-------|:-------------|
| Lignes code | 8,098 | `wc -l **/*.cjs **/*.js` |
| Personas | 30 | grep count |
| Function tools | 11 | grep count |
| Langues | 5 | FR, EN, ES, AR, ARY |
| Services | 3 | ports 3004, 3007, 3009 |
