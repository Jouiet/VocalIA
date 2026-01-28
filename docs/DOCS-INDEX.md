# VocalIA - Documentation Index

> **Version**: 1.0.0 | **Date**: 28/01/2026

---

## Documents Principaux

| Document | Description | Taille |
|:---------|:------------|:-------|
| **VOICE-AI-PLATFORM-REFERENCE.md** | Master reference technique | ~500 lignes |
| **VOICE-AI-ARCHITECTURE.md** | Architecture et diagrammes | ~250 lignes |
| **SESSION-HISTORY.md** | Suivi des sessions et engineering score | ~150 lignes |

---

## Rules (.claude/rules/)

| Rule | Description | Auto-Load |
|:-----|:------------|:---------:|
| **core.md** | Standards code, credentials, deploy | ✅ Toujours |
| **factuality.md** | Vérification empirique | ✅ Toujours |
| **voice-platform.md** | Spécificités Voice AI | ✅ Toujours |

---

## Fichiers Racine

| Fichier | Description |
|:--------|:------------|
| **CLAUDE.md** | Memory système VocalIA |
| **README.md** | Documentation publique |
| **package.json** | NPM configuration |
| **.env.example** | Template credentials |

---

## Parent Documentation

Hérite de 3A Automation:
- `~/Desktop/JO-AAA/docs/ETAGERE-TECHNOLOGIQUE-ECOSYSTEME-3A.md`
- `~/Desktop/JO-AAA/docs/AI-PROVIDER-STRATEGY.md`
- `~/.claude/CLAUDE.md` (global memory)

---

## Quick Reference

### Services
```bash
node core/voice-api-resilient.cjs      # Port 3004
node core/grok-voice-realtime.cjs      # Port 3007
node telephony/voice-telephony-bridge.cjs  # Port 3009
```

### Health Check
```bash
node scripts/voice-quality-sensor.cjs --health
```

### Métriques Clés
| Métrique | Valeur |
|:---------|:-------|
| Code | 8,098 lignes |
| Personas | 30 |
| Function Tools | 11 |
| Langues | 5 (FR, EN, ES, AR, ARY) |
| CRM | 3 (HubSpot, Klaviyo, Shopify) |

---

*Index créé: 28/01/2026*
