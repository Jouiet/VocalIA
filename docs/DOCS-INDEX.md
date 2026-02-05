# VocalIA - Documentation Index

> **Version**: 5.0.0 | **Date**: 05/02/2026 | **Session**: 250.94
> **🌐 PRODUCTION LIVE**: https://vocalia.ma | HTTP/2 ✅ | HSTS preload ✅ | Security 100/100 ✅
> **MÉTRIQUES VÉRIFIÉ:** ~140k lignes | 76 pages | 203 MCP tools | 40 Personas | 25 Function Tools

---

## Document Principal de Référence

| Document | Description | Lignes | Status |
|:---------|:------------|:------:|:------:|
| **📐 VOCALIA-SYSTEM-ARCHITECTURE.md** | **ARCHITECTURE SYSTÈME COMPLÈTE** | ~1,000 | ✅ v2.0.0 |

Ce document consolidé contient:

- Vue d'ensemble système (~140k lignes total)
- Architecture des 7 services (ports 3004-3013)
- Architecture backend (38 modules core, 32,727 lignes)
- Architecture frontend (76 pages HTML)
- Architecture Voice AI (Widget 9,107 lignes + Telephony 4,709 lignes)
- Architecture données (7 tables Google Sheets)
- Architecture MCP Server (203 tools, 17,630 lignes)
- Architecture intégrations (31 natives)
- Architecture sécurité (JWT, bcrypt, RBAC, HSTS, CSP)
- Architecture i18n (5 langues, 23,790 lignes)
- Flux de données (Auth, HITL, Dashboard)

---

## Documents par Catégorie

### Architecture & Technique

| Document | Description | Status |
|:---------|:------------|:------:|
| **VOCALIA-SYSTEM-ARCHITECTURE.md** | Architecture complète v2.0.0 | ✅ |
| **ARCHITECTURE-SYSTEM-FORENSIC-AUDIT.md** | Audit système détaillé | ✅ |
| **PLUG-AND-PLAY-STRATEGY.md** | Multi-tenant architecture | ✅ |
| **VOCALIA-MCP.md** | MCP Server (203 tools) | ✅ |
| **INTEGRATIONS-ROADMAP.md** | Roadmap intégrations | ✅ |

### Audits & Forensique

| Document | Description | Status |
|:---------|:------------|:------:|
| **ARCHITECTURE-SYSTEM-FORENSIC-AUDIT.md** | Audit système Session 250.94 | ✅ |
| **AUDIT-FORENSIQUE-PERSONAS-KB-SESSION-250.md** | Audit personas + KB | ✅ |
| **FORENSIC-AUDIT-250.90.md** | Audit i18n | ✅ |

### Sécurité & Compliance

| Document | Description | Status |
|:---------|:------------|:------:|
| **SECURITY-POLICY-2026.md** | Politiques sécurité | ✅ |
| **GDPR-COMPLIANCE.md** | Conformité RGPD | ✅ |
| **SOC2-PREPARATION.md** | Préparation SOC2 | ✅ |

### Design & Branding

| Document | Description | Status |
|:---------|:------------|:------:|
| **DESIGN-BRANDING-SYSTEM.md** | Palette, typo, composants | ✅ |
| **DESIGN-TOOLS-WORKFLOWS.md** | Workflows design | ✅ |

### Stratégie & Analyse

| Document | Description | Status |
|:---------|:------------|:------:|
| **STRATEGIC-DIRECTIVES-SYNTHESIS.md** | Directives stratégiques | ✅ |
| **VOICE-MENA-PLATFORM-ANALYSIS.md** | Benchmark MENA | ✅ |

### Historique

| Document | Description | Status |
|:---------|:------------|:------:|
| **SESSION-HISTORY.md** | Historique sessions | ✅ |

---

## Documents Archivés

```
docs/archive/
├── VOICE-AI-ARCHITECTURE.md      # Obsolète - 28/01/2026
└── VOICE-AI-PLATFORM-REFERENCE.md # Obsolète - 28/01/2026
```

---

## Rules (.claude/rules/) - MÀJOUR 05/02/2026

| Rule | Description |
|:-----|:------------|
| **core.md** | Architecture (~140k lignes), 7 services, credentials |
| **factuality.md** | Métriques vérifiées wc -l/grep -c |
| **voice-platform.md** | 40 personas, 25 function tools |
| **scripts.md** | 60 fichiers backend (55,594 lignes) |
| **token-optimization.md** | Token management |
| **personas-architecture.md** | Structure duale personas |
| **shelf-isolation.md** | Isolation shelf |

---

## Métriques Vérifiées (05/02/2026 - Session 250.94)

| Métrique | Valeur | Commande Vérification |
|:---------|:------:|:----------------------|
| Core Backend | **32,727** lignes | `wc -l core/*.cjs` |
| Telephony | **4,709** lignes | `wc -l telephony/*.cjs` |
| Personas | **5,995** lignes | `wc -l personas/*.cjs` |
| Widget | **9,107** lignes | `wc -l widget/*.js` |
| Sensors | **822** lignes | `wc -l sensors/*.cjs` |
| Integrations | **2,234** lignes | `wc -l integrations/*.cjs` |
| MCP Server | **17,630** lignes | `wc -l mcp-server/src/**/*.ts` |
| Website Libs | **7,563** lignes | `wc -l website/src/lib/*.js` |
| i18n Locales | **23,790** lignes | `wc -l website/src/locales/*.json` |
| HTML Pages | **76** | `find website -name "*.html" \| wc -l` |
| MCP Tools | **203** | `grep -c "server.tool(" mcp-server/src/index.ts` |
| Function Tools | **25** | `grep -c "name: '" telephony/voice-telephony-bridge.cjs` |
| Personas | **40** | `grep -E "^\s+[A-Z_]+:\s*\{$" \| sort -u \| wc -l` |
| Langues | **5** | FR, EN, ES, AR, ARY |
| Services | **7** | Ports 3004, 3007, 3009, 3010, 3011, 3012, 3013 |
| Unit Tests | **306** (100% pass) | `npm test` |
| E2E Tests | **375** (99.5% pass) | Playwright, 5 browsers |
| Security Score | **100/100** | HTTPS, HSTS, CSP, X-Frame-Options, SRI |
| **TOTAL Backend** | **~55,594** lignes | core+telephony+personas+widget+sensors+integrations |
| **TOTAL Platform** | **~140,577** lignes | Tous composants |

---

## Services (7 Ports)

```bash
# Start tous les services
node core/voice-api-resilient.cjs    # port 3004
node core/grok-voice-realtime.cjs    # port 3007
node telephony/voice-telephony-bridge.cjs  # port 3009
node core/OAuthGateway.cjs --start   # port 3010
node core/WebhookRouter.cjs --start  # port 3011
node core/remotion-hitl.cjs          # port 3012
node core/db-api.cjs                 # port 3013
npx serve website -p 8080            # port 8080

# Health checks
curl http://localhost:3004/health
curl http://localhost:3013/api/db/health
```

---

*Index màj: 05/02/2026 - Session 250.94*
*Métriques vérifiées avec wc -l et grep -c*
*Production LIVE: https://vocalia.ma - Security 100/100*
