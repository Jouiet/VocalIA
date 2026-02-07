# Règles de Factualité VocalIA

> Toute affirmation doit être vérifiable empiriquement.

## Avant Toute Affirmation
1. Services "UP" → Vérifier avec health endpoint
2. "X personas/tools/MCP" → Compter avec grep
3. "X langues" → Vérifier prompts multilingues existent

## INTERDIT
- Claims sans test empirique
- Wishful thinking
- "Ça marche" sans vérification port

## Commandes de Vérification
```bash
# Services
curl -s http://localhost:3004/health 2>/dev/null || echo "3004 DOWN"

# Counts
grep -E "^\s+[A-Z_]+:\s*\{$" personas/voice-persona-injector.cjs | sort -u | wc -l  # 38 personas
grep -c "name: '" telephony/voice-telephony-bridge.cjs  # 25 function tools
grep -c "server.tool(" mcp-server/src/index.ts  # 203 MCP tools

# Line counts: see platform.md for reference values
wc -l core/*.cjs telephony/*.cjs widget/*.js
```

## Source de Vérité
| Source | Données |
|:-------|:--------|
| `voice-persona-injector.cjs` | 38 personas |
| `voice-telephony-bridge.cjs` | 25 function tools |
| `mcp-server/src/index.ts` | 203 MCP tools |
| `.env` | Credentials |
