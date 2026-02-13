# Regles de Factualite VocalIA

> Toute affirmation doit etre verifiable empiriquement.

## Verification Commands
| Metric | Command | Expected |
|:-------|:--------|:---------|
| Personas | `grep -E "^\s+[A-Z_]+:\s*\{$" personas/voice-persona-injector.cjs \| sort -u \| wc -l` | 38 |
| Function Tools | `grep -c "name: '" telephony/voice-telephony-bridge.cjs` | 25 |
| MCP Tools | validated by `node --test test/mcp-server.test.mjs` (22 inline + 181 external) | 203 |
| MCP Resources | `grep -c "server.registerResource(" mcp-server/src/index.ts` | 6 |
| MCP Prompts | `grep -c "server.registerPrompt(" mcp-server/src/index.ts` | 8 |
| Widgets | `ls widget/*.js \| wc -l` | 7 |
| Languages | `ls website/src/locales/*.json \| wc -l` | 5 |
| Tests | `ls test/*.mjs \| wc -l` | 77 |
| HTML pages | `find website -name "*.html" \| wc -l` | 84 |
| Registry | `node -e "const r=require('./personas/client_registry.json'); console.log(Object.keys(r.clients).length)"` | 22 |

## Deployment Reality (7 containers deployed, 0 revenue)
Services: 7 containers HEALTHY (api, db-api, realtime, telephony, hitl, oauth, webhooks) — ALL non-root (node user PID 1, node:22-alpine) | Monitoring: v3.0 cron */5 + ntfy.sh alerts | Backup: daily 2AM UTC, 7-day retention | VPS: SSH key-only + fail2ban + UFW | Security: CDN SRI 78/78 + CSP all pages + HSTS all services + CORS restricted + X-XSS-Protection: 0 | External APIs: 1 configured (Resend SMTP — DKIM+SPF+MX verified) | OAuth SSO: Google + GitHub LIVE (302 redirect verified) | GSC: verified + sitemap submitted | Paying customers: 0 | Live calls: 0 | Real conversations: 0

## INTERDIT
- Claims sans test empirique | "Code exists" ≠ "Feature deployed" | Vanity metrics sans context
- TOUJOURS séparer **Code Completeness** vs **Production Readiness**
