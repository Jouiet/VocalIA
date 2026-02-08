# Regles de Factualite VocalIA

> Toute affirmation doit etre verifiable empiriquement.
> Session 250.139 | 08/02/2026

## Avant Toute Affirmation

### Code Counts (verified)
1. Personas: `grep -E "^\s+[A-Z_]+:\s*\{$" personas/voice-persona-injector.cjs | sort -u | wc -l` → **38**
2. Function Tools: `grep -c "name: '" telephony/voice-telephony-bridge.cjs` → **25**
3. MCP Tools: `grep -c "server.tool(" mcp-server/src/index.ts` → **203**
4. Widgets: `ls widget/*.js | wc -l` → **7**
5. Languages: `ls website/src/locales/*.json | wc -l` → **5**
6. Tests: `ls test/*.mjs | wc -l` → **68 files**
7. HTML pages: `find website -name "*.html" | wc -l` → **78**
8. Registry clients: `node -e "const r=require('./personas/client_registry.json'); console.log(Object.keys(r.clients).length)"` → **22**

### Deployment Status (CRITICAL — do NOT confuse with code existence)
9. Services UP: `curl -s http://localhost:3004/health 2>/dev/null || echo "3004 DOWN"`
10. MCP connected: **0 external API keys** configured in production
11. Paying customers: **0** (all 553 client dirs are test data)
12. Live voice calls: **0** (no telephony configured)
13. Widget conversations: **0** with real users
14. ECOM catalogs connected: **0** (widget deployed on 1 demo page)

### Line Counts (verified 08/02/2026)
```bash
wc -l core/*.cjs                    # 35,368 (55 files)
wc -l telephony/*.cjs               # 4,751 (1 file)
wc -l personas/*.cjs personas/*.json # 8,791 (3 files)
wc -l widget/*.js                   # 10,598 (7 files)
wc -l mcp-server/src/**/*.ts        # 19,173 (32 files)
wc -l website/src/locales/*.json    # 26,175 (5 files)
```

## INTERDIT
- Claims sans test empirique
- "Code exists" presented as "Feature deployed"
- Vanity metrics without deployment context (e.g. "203 MCP Tools" without "(0 connected)")
- Wishful thinking
- "Ca marche" sans verification port

## Two Scores — ALWAYS Separate
- **Code Completeness**: How much code is written and tested
- **Production Readiness**: How much is deployed, connected, and serving real users

Never present a single "platform score" without distinguishing these two dimensions.

## Source de Verite
| Source | Donnees |
|:-------|:--------|
| `voice-persona-injector.cjs` | 38 personas |
| `voice-telephony-bridge.cjs` | 25 function tools |
| `mcp-server/src/index.ts` | 203 MCP tools |
| `widget/*.js` | 7 widgets |
| `.env` | Credentials |
| `personas/client_registry.json` | 22 registered clients |
