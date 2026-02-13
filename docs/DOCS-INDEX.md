# VocalIA - Documentation Index

> **Version**: 6.2.0 | **Date**: 13/02/2026 | **Session**: 250.205
> **Production**: https://vocalia.ma
> **Verified:** ~87k lines source | 84 pages | 203 MCP tools (0 connected) | 38 Personas | 25 Function Tools | 7 Widgets

---

## Document Principal de Reference

| Document | Description | Status |
|:---------|:------------|:------:|
| **VOCALIA-SYSTEM-ARCHITECTURE.md** | **ARCHITECTURE SYSTEME COMPLETE** | ✅ v2.7.0 (250.205: 8 HTTP services, SMTP+OAuth LIVE) |

---

## Documents par Categorie

### Architecture & Technique

| Document | Description | Status |
|:---------|:------------|:------:|
| **VOCALIA-SYSTEM-ARCHITECTURE.md** | Architecture complete v2.2.0 | ✅ |
| **PLUG-AND-PLAY-STRATEGY.md** | Multi-tenant architecture | ✅ |
| **VOCALIA-MCP.md** | MCP Server (203 tools) | ✅ |
| **INTEGRATIONS-ROADMAP.md** | Roadmap integrations | ✅ |

### Securite & Compliance

| Document | Description | Status |
|:---------|:------------|:------:|
| **GDPR-COMPLIANCE.md** | Conformite RGPD | ✅ |
| **SECURITY.md** | Politiques securite | ✅ |
| **SOC2-PREPARATION.md** | Preparation SOC2 | ✅ |

### Strategie & Analyse

| Document | Description | Status |
|:---------|:------------|:------:|
| **STRATEGIC-DIRECTIVES-SYNTHESIS.md** | Directives strategiques | ✅ |
| **VOICE-MENA-PLATFORM-ANALYSIS.md** | Benchmark MENA | ✅ |
| **USE-CASES-BUSINESS-VALUE-ANALYSIS.md** | Analyse business | ✅ |
| **USE-CASES-STRATEGIC-ANALYSIS.md** | Analyse strategique | ✅ |

### Design & Branding

| Document | Description | Status |
|:---------|:------------|:------:|
| **DESIGN-BRANDING-SYSTEM.md** | Palette, typo, composants | ✅ |

### Historique & Suivi

| Document | Description | Status |
|:---------|:------------|:------:|
| **SESSION-HISTORY.md** | Historique sessions | ✅ |
| **ROADMAP-TO-COMPLETION.md** | Remaining work | ✅ |

---

## Rules (.claude/rules/) — Updated 08/02/2026

| Rule | Description |
|:-----|:------------|
| **platform.md** | Architecture (verified line counts), production readiness matrix |
| **factuality.md** | Verification commands, deployment status checks |
| **branding.md** | Approved palette, widget branding, platform numbers |
| **core.md** | Code standards, credentials |
| **personas-architecture.md** | Structure duale personas |
| **token-optimization.md** | Token management |
| **shelf-isolation.md** | Isolation shelf |

---

## Metriques Verifiees (13/02/2026 - Session 250.205)

| Metrique | Valeur | Commande Verification |
|:---------|:------:|:----------------------|
| Core Backend | **~37,600** lignes (58 files) | `wc -l core/*.cjs` |
| Telephony | **~4,800** lignes | `wc -l telephony/*.cjs` |
| Personas | **8,800** lignes (3 files) | `wc -l personas/*.cjs personas/*.json` |
| Widget | **11,001** lignes (7 files) | `wc -l widget/*.js` |
| Sensors | **852** lignes | `wc -l sensors/*.cjs` |
| Integrations | **2,275** lignes | `wc -l integrations/*.cjs` |
| Lib | **944** lignes | `wc -l lib/*.cjs` |
| MCP Server | **~19,300** lignes (33 files) | `find mcp-server/src -name "*.ts" -exec wc -l {} +` |
| Website Libs | **7,581** lignes | `wc -l website/src/lib/*.js` |
| i18n Locales | **~27,800** lignes | `wc -l website/src/locales/*.json` |
| HTML Pages | **84** | `find website -name "*.html" \| wc -l` |
| MCP Tools | **203** (0 connected) | `grep -c "server.tool(" mcp-server/src/index.ts` |
| Function Tools | **25** | `grep -c "name: '" telephony/voice-telephony-bridge.cjs` |
| Personas | **38** | `grep -E "^\s+[A-Z_]+:\s*\{$" \| sort -u \| wc -l` |
| Langues | **5** | FR, EN, ES, AR, ARY |
| HTTP Services | **8** | 7 deployed (3004,3007,3009,3010,3011,3012,3013) + 1 non-deployed (3015) |
| Tests | **5,019+** (77 files, 0 fail) | `node --test test/*.mjs` |
| Registered Clients | **22** (0 paying) | `client_registry.json` |
| Client Folders | **553** (all test data) | `ls clients/ \| wc -l` |
| Distribution | **5** platforms | npm, shopify, wordpress, wix, zapier |

---

## Services (8 HTTP Servers)

**Deployed (7 Docker containers via Traefik — ALL non-root):**
```bash
node core/voice-api-resilient.cjs    # port 3004
node core/grok-voice-realtime.cjs    # port 3007
node telephony/voice-telephony-bridge.cjs  # port 3009
node core/db-api.cjs                 # port 3013
node core/OAuthGateway.cjs --start   # port 3010
node core/WebhookRouter.cjs --start  # port 3011
node core/remotion-hitl.cjs --server # port 3012 (hybrid: library + optional server)
```

**Non-deployed (standalone, code exists):**
```bash
node mcp-server/dist/index.js --http # port 3015 (standalone TypeScript)
```

---

*Index updated: 13/02/2026 - Session 250.205*
*All metrics verified with wc -l, grep -c, and node --test*
