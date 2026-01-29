# VocalIA - Documentation Index

> **Version**: 2.5.0 | **Date**: 29/01/2026 | **Session**: 207

---

## Document Principal de Suivi

| Document | Description | Status |
|:---------|:------------|:------:|
| **📋 SESSION-HISTORY.md** | **SUIVI D'IMPLÉMENTATION OFFICIEL** | ✅ Current |

Ce document contient:

- Engineering Score (99/100)
- Métriques vérifiées avec commandes
- Inventaire complet des 58+ modules
- Session history
- Gaps status
- Commandes de vérification

---

## Voice Widget (NEW - Session 205)

| Fichier | Description | Status |
|:--------|:------------|:------:|
| **website/voice-assistant/voice-widget.js** | Widget VocalIA intégré | ✅ Live |
| **website/voice-assistant/lang/voice-fr.json** | Langue Française | ✅ |
| **website/voice-assistant/lang/voice-en.json** | Langue Anglaise | ✅ |
| **scripts/generate-voice-widget-client.cjs** | Générateur widget clients | ✅ |
| **templates/voice-widget-client-config.json** | Template config client | ✅ |

---

## Audits Factuels (Session 205+)

| Document | Description | Status |
|:---------|:------------|:------:|
| **SESSION-205-AUDIT.md** | **AUDIT BRUTAL** - RAG, Widget, Transferts | ✅ NEW |

---

## Documents Techniques

| Document | Description | Taille |
|:---------|:------------|:-------|
| **PLUG-AND-PLAY-STRATEGY.md** | **STRATÉGIE MULTI-TENANT** - Widget, Telephony, OAuth | ~800 lignes |
| **VOICE-AI-PLATFORM-REFERENCE.md** | Master reference technique | ~660 lignes |
| **VOICE-AI-ARCHITECTURE.md** | Architecture et diagrammes | ~242 lignes |
| **SAVOIR-FAIRE-TRANSMISSIBLE.md** | Transfert 3A → VocalIA | ~215 lignes |

---

## Design & Branding (NEW - Session 200)

| Document | Description | Taille |
|:---------|:------------|:-------|
| **DESIGN-BRANDING-SYSTEM.md** | Palette Deep Teal, typo, composants | ~390 lignes |
| **DESIGN-TOOLS-WORKFLOWS.md** | **Workflows actionnables**: Stitch, Whisk, Remotion, Gemini, Playwright, DevTools | ~450 lignes |

---

## Documents Benchmark & Audit

| Document | Description | Taille |
|:---------|:------------|:-------|
| **VOICE-MENA-PLATFORM-ANALYSIS.md** | **BENCHMARK STRATÉGIQUE** - Marchés, concurrence, économie | ~2,187 lignes |
| **VOICE-MULTILINGUAL-STRATEGY.md** | Stratégie multilingue complète | ~736 lignes |
| **VOICE-DARIJA-FORENSIC.md** | Audit forensique Darija | ~111 lignes |
| **VOICE-AUDIT-FINAL.md** | Audit final Voice AI | ~85 lignes |
| **FORENSIC-AUDIT-WEBSITE.md** | Audit Frontend (Website & Dashboards) | ~315 lignes |
| **benchmarks-2026.md** | Benchmarks latence | ~12 lignes |

---

## Rules (.claude/rules/)

| Rule | Description | Auto-Load |
|:-----|:------------|:---------:|
| **core.md** | Standards code, credentials, deploy | ✅ Toujours |
| **factuality.md** | Vérification empirique | ✅ Toujours |
| **voice-platform.md** | Spécificités Voice AI | ✅ Toujours |
| **scripts.md** | Reference scripts et HITL | ✅ Toujours |
| **token-optimization.md** | Token management | ✅ Toujours |

---

## Fichiers Racine

| Fichier | Description | Status |
|:--------|:------------|:------:|
| **CLAUDE.md** | Memory système VocalIA v1.3.0 | ✅ Updated |
| **README.md** | Documentation publique | ✅ |
| **package.json** | NPM configuration (6 deps) | ✅ |
| **automations-registry.json** | 12 automations | ✅ NEW |
| **data/pressure-matrix.json** | GPM data | ✅ NEW |
| **.mcp.json** | MCP configuration (grok) | ✅ |

---

## Métriques Vérifiées (29/01/2026)

| Métrique | Valeur | Vérification |
|:---------|:-------|:-------------|
| **Code** | 25,000+ lignes | `find -exec wc -l` |
| **Fichiers** | 58+ | `find \| wc -l` |
| **Engineering Score** | 99/100 | CLAUDE.md |
| **Health Check** | 100% (39/39) | `node scripts/health-check.cjs` |
| **Voice Widget** | ✅ Intégré | Website live |
| **Personas** | 28 | Verified unique |
| **Function Tools** | 11 | telephony bridge |
| **Langues** | 5 | FR, EN, ES, AR, ARY |
| **CRM** | 3 | HubSpot, Klaviyo, Shopify |

---

## Services

```bash
# Health Check (PRINCIPAL)
node scripts/health-check.cjs

# Start services
node core/voice-api-resilient.cjs      # Port 3004
node core/grok-voice-realtime.cjs      # Port 3007
node telephony/voice-telephony-bridge.cjs  # Port 3009
```

---

## Parent Documentation

Hérite de VocalIA:

- `~/Desktop/JO-AAA/docs/ETAGERE-TECHNOLOGIQUE-ECOSYSTEME-3A.md`
- `~/Desktop/JO-AAA/docs/AI-PROVIDER-STRATEGY.md`
- `~/.claude/CLAUDE.md` (global memory)

---

## VocalIA-Ops Integration

```bash
# Package installé via yalc
ls node_modules/@3a/agent-ops/
# Modules: EventBus, ContextBox, BillingAgent, ErrorScience, RevenueScience
```

---

*Index màj: 29/01/2026 - Session 205*
*Voice Widget intégré au website + générateur client*
