# VocalIA - Documentation Index

> **Version**: 4.0.0 | **Date**: 03/02/2026 | **Session**: 250.66
> **🌐 PRODUCTION LIVE**: https://vocalia.ma | HTTP/2 ✅ | HSTS preload ✅ | Security 100/100 ✅

---

## Document Principal de Référence

| Document | Description | Lignes | Status |
|:---------|:------------|:------:|:------:|
| **📐 VOCALIA-SYSTEM-ARCHITECTURE.md** | **ARCHITECTURE SYSTÈME COMPLÈTE** | 988 | ✅ |

Ce document consolidé contient:

- Vue d'ensemble système
- Architecture des 7 services (ports 3004-3013)
- Architecture backend (41 modules core)
- Architecture frontend (70 pages HTML)
- Architecture Voice AI (Widget + Telephony)
- Architecture données (7 tables Google Sheets)
- Architecture MCP Server (182 tools)
- Architecture intégrations (28 natives)
- Architecture sécurité (JWT, bcrypt, RBAC, HSTS, CSP)
- Architecture i18n (5 langues, 21,605 keys)
- Flux de données (Auth, HITL, Dashboard)
- Métriques du codebase (~107,000 lignes)

---

## Documents par Catégorie

### Architecture & Technique

| Document | Description | Status |
|:---------|:------------|:------:|
| **VOCALIA-SYSTEM-ARCHITECTURE.md** | Architecture complète consolidée | ✅ |
| **PLUG-AND-PLAY-STRATEGY.md** | Multi-tenant architecture | ✅ |
| **VOCALIA-MCP.md** | MCP Server (182 tools) | ✅ |
| **INTEGRATIONS-ROADMAP.md** | Roadmap intégrations | ✅ |

### Audits & Forensique

| Document | Description | Status |
|:---------|:------------|:------:|
| **ARCHITECTURE-SYSTEM-FORENSIC-AUDIT.md** | Audit système détaillé | ✅ |
| **AUDIT-DASHBOARDS-COMPLET-SESSION-250.52.md** | Audit webapp SaaS | ✅ |
| **FORENSIC-AUDIT-WEBSITE.md** | Audit frontend | ✅ |
| **AUDIT-FORENSIQUE-PERSONAS-KB-SESSION-250.md** | Audit personas + KB | ✅ |

### Sécurité & Compliance

| Document | Description | Status |
|:---------|:------------|:------:|
| **SECURITY.md** | Politiques sécurité | ✅ |
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
| **VOICE-MENA-PLATFORM-ANALYSIS.md** | Benchmark MENA | ✅ |
| **USE-CASES-STRATEGIC-ANALYSIS.md** | Analyse use cases | ✅ |
| **USE-CASES-BUSINESS-VALUE-ANALYSIS.md** | Valeur business | ✅ |

### i18n

| Document | Description | Status |
|:---------|:------------|:------:|
| **I18N-AUDIT-ACTIONPLAN.md** | Plan i18n | ✅ |
| **TRANSLATION-QA-AUDIT.md** | QA traductions | ✅ |

### Historique

| Document | Description | Status |
|:---------|:------------|:------:|
| **SESSION-HISTORY.md** | Historique sessions | ✅ |

---

## Documents Archivés

Les documents suivants ont été archivés (remplacés par VOCALIA-SYSTEM-ARCHITECTURE.md):

```
docs/archive/
├── VOICE-AI-ARCHITECTURE.md      # Obsolète - 28/01/2026
└── VOICE-AI-PLATFORM-REFERENCE.md # Obsolète - 28/01/2026
```

---

## Rules (.claude/rules/)

| Rule | Description |
|:-----|:------------|
| **core.md** | Standards code, credentials |
| **factuality.md** | Vérification empirique |
| **voice-platform.md** | Spécificités Voice AI |
| **scripts.md** | Reference scripts et HITL |
| **token-optimization.md** | Token management |
| **personas-architecture.md** | Structure duale personas |
| **shelf-isolation.md** | Isolation shelf |

---

## Métriques Vérifiées (03/02/2026)

| Métrique | Valeur | Vérification |
|:---------|:------:|:-------------|
| Core Backend | 41 modules | `ls core/*.cjs \| wc -l` |
| Telephony | 3,194 lignes | `wc -l telephony/*.cjs` |
| Personas | 5,280 lignes | `wc -l personas/*.cjs` |
| MCP Server | 15,755 lignes | `wc -l mcp-server/src/**/*.ts` |
| Website Libs | 7,326 lignes | `wc -l website/src/lib/*.js` |
| HTML Pages | 70 | `find website -name "*.html" \| wc -l` |
| Locales | 21,605 keys (4321 × 5) | Verified: `node -e` count |
| MCP Tools | 182 | `grep -c "server.tool(" mcp-server/src/index.ts` |
| Personas | 40 | Verified in voice-persona-injector.cjs |
| Langues | 5 | FR, EN, ES, AR, ARY |
| Services | 7 | Ports 3004, 3007, 3009, 3010, 3011, 3012, 3013 |
| Unit Tests | 305 | 100% pass |
| E2E Tests | 375 | 99.5% pass (5 browsers) |
| Security Score | 100/100 | HTTPS, HSTS, CSP, X-Frame-Options, SRI |

---

## Services

```bash
# Start tous les services
node core/voice-api-resilient.cjs --server --port=3004
node core/grok-voice-realtime.cjs --server --port=3007
node telephony/voice-telephony-bridge.cjs
node core/db-api.cjs
npx serve website -p 8080

# Health checks
curl http://localhost:3004/health
curl http://localhost:3013/api/db/health
```

---

*Index màj: 03/02/2026 - Session 250.66*
*Production LIVE: https://vocalia.ma - Security 100/100*
