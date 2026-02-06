# SAVOIR-FAIRE TRANSMISSIBLE - VocalIA

> **Version**: 1.0.0 | **Date**: 28/01/2026 | **Session**: 184bis POST-FIX
> **Méthode**: Bottom-up factuel, vérifié empiriquement
> **Source**: VocalIA (JO-AAA) → VocalIA

---

## INVENTAIRE FACTUEL

### Ce Qui A Été Transféré (Session 184bis)

| Module | Fichiers | LOC | Status | Vérifié |
|:-------|:---------|:----|:-------|:--------|
| **Core Voice** | 4 | 4,739 | ✅ | node require OK |
| **Widget** | 2 | 1,812 | ✅ | node require OK |
| **Telephony** | 1 | 2,658 | ✅ | node require OK |
| **Personas** | 1 | 648 | ✅ | node require OK |
| **Integrations** | 3 | 1,458 | ✅ | node require OK |
| **Agent Ops** | 7 | 3,027 | ✅ | EventBus init OK |
| **Security** | 1 | 919 | ✅ | node require OK |
| **KB/RAG** | 3 | 654 | ✅ | node require OK |
| **Gateways** | 3 | ~500 | ✅ | node require OK |
| **TOTAL** | **29** | **16,959** | **✅** | 100% load OK |

### Ce Qui MANQUE (Gap Analysis)

| Catégorie | 3A (Source) | VocalIA | Gap | Priorité |
|:----------|:------------|:--------|:----|:---------|
| **.claude/rules/** | 6 fichiers (390 L) | 3 fichiers (179 L) | -3 fichiers | P1 |
| **.mcp.json** | 6 servers | 0 | -6 servers | **P0** |
| **Multi-Tenant** | 4 modules | 0 | -4 modules | P1 |
| **Sensors Voice** | 1 dédié | 1 (partiel) | 0 | P2 |
| **Sensors Intégration** | 19 total | 0 | -19 (utiles: ~5) | P2 |
| **Dashboard** | 118 composants | 0 | Non requis initial | P3 |
| **Forensic Tools** | 9 modules | 0 | -9 | P2 |
| **CI/CD Workflows** | 6 workflows | 0 | -6 | P2 |
| **Stitch Design API** | 2 fichiers (667 L) | 0 | -2 | P1 |

---

## DÉTAIL DES TRANSFERTS MANQUANTS

### 1. MCP Configuration (PRIORITÉ P0)

**Source**: `/Users/mac/Desktop/JO-AAA/.mcp.json`
**Impact**: Sans MCP, VocalIA ne peut pas exposer ses tools aux agents

**Fichier à créer**: `/Users/mac/Desktop/VocalIA/.mcp.json`

```json
{
  "mcpServers": {
    "vocalia-mcp": {
      "command": "node",
      "args": ["mcp/vocalia-mcp/build/index.js"],
      "description": "VocalIA Voice AI Tools - 11 function tools"
    },
    "grok": {
      "command": "npx",
      "args": ["grok-search-mcp@latest"],
      "env": { "XAI_API_KEY": "${XAI_API_KEY}" }
    }
  }
}
```

**Modules à créer**:
- `mcp/vocalia-mcp/` - Wrapper MCP pour les 11 function tools de telephony-bridge

---

### 2. Règles Manquantes (PRIORITÉ P1)

**Source**: `/Users/mac/Desktop/JO-AAA/.claude/rules/`

| Fichier | Lignes | Pertinence VocalIA | Action |
|:--------|:-------|:-------------------|:-------|
| scripts.md | 196 | ✅ HIGH | Adapter pour scripts VocalIA |
| token-optimization.md | 72 | ✅ HIGH | Copier tel quel |
| dropshipping.md | 32 | ❌ NON | Ne pas copier |

---

### 3. Multi-Tenant Modules (PRIORITÉ P1)

**Source**: `/Users/mac/Desktop/JO-AAA/automations/agency/core/Tenant*.cjs`

| Module | Lignes | Purpose | Action |
|:-------|:-------|:--------|:-------|
| TenantContext.cjs | ~200 | Isolation contexte client | Copier + adapter |
| TenantCronManager.cjs | ~150 | Cron jobs par tenant | Optionnel |
| TenantLogger.cjs | ~100 | Logs isolés | Copier |
| TenantScriptRunner.cjs | ~180 | Exécution scripts | Optionnel |

---

### 4. Stitch Design API (PRIORITÉ P1)

**Source**: `/Users/mac/Desktop/JO-AAA/automations/agency/core/stitch*.cjs`

| Fichier | Lignes | Purpose |
|:--------|:-------|:--------|
| stitch-api.cjs | 279 | MCP wrapper for Google Stitch UI generation |
| stitch-to-3a-css.cjs | 388 | CSS extraction from Stitch designs |

**Impact VocalIA**: Génération programmatique de widget designs

---

### 5. Forensic/Audit Tools (PRIORITÉ P2)

**Source**: `/Users/mac/Desktop/JO-AAA/automations/agency/core/*-audit*.cjs`

| Module | Lignes | Purpose | Pertinence |
|:-------|:-------|:--------|:-----------|
| flows-audit-agentic.cjs | 16,965 | Audit Klaviyo flows | ✅ Pour clients |
| store-audit-agentic.cjs | 11,385 | Audit Shopify | ✅ Pour clients |
| system-audit-agentic.cjs | 11,014 | Audit système | ✅ Interne |

---

### 6. Sensors Pertinents (PRIORITÉ P2)

**Source**: `/Users/mac/Desktop/JO-AAA/automations/agency/core/*-sensor.cjs`

| Sensor | Pertinence VocalIA | Action |
|:-------|:-------------------|:-------|
| voice-quality-sensor.cjs | ✅ ESSENTIEL | Déjà copié (scripts/) |
| cost-tracking-sensor.cjs | ✅ HIGH | Copier (tracking API costs) |
| retention-sensor.cjs | ✅ MEDIUM | Pour analytics clients |
| lead-velocity-sensor.cjs | ✅ MEDIUM | Pour qualification leads |
| ga4-sensor.cjs | ⚠️ LOW | Si analytics requis |

---

## NON-PERTINENT POUR VOCALIA

| Catégorie | Raison |
|:----------|:-------|
| **CinematicAds/Remotion** | Subsidiary séparé (Ads-Automations/) |
| **Dropshipping** | Module e-commerce 3A |
| **Shopify Sensors** | Spécifique e-commerce |
| **Landing Page** | VocalIA aura son propre site |
| **Dashboard complet** | P3 - API-first pour VocalIA |

---

## MÉTHODOLOGIE DE TRANSFERT

### Principes

1. **Copie ≠ Transfert**: Adapter les paths, dépendances, configs
2. **Test Empirique**: `node -e "require('./module')"` après chaque copie
3. **Documentation**: Màj CLAUDE.md avec métriques vérifiées
4. **Pas de Régression**: Ne pas casser ce qui fonctionne

### Commande de Vérification

```bash
# Tester qu'un module charge
node -e "try { require('./path/module.cjs'); console.log('✅ OK'); } catch(e) { console.log('❌', e.message); }"

# Compter les lignes
wc -l path/to/file.cjs

# Vérifier structure
find . -name "*.cjs" | grep -v node_modules | wc -l
```

---

## PLAN D'ACTION PRIORISÉ

### Phase 1 - Infrastructure Critique (P0)

- [ ] Créer `.mcp.json` avec vocalia-mcp stub
- [ ] Créer `mcp/vocalia-mcp/` structure

### Phase 2 - Fondamentaux (P1)

- [ ] Copier `token-optimization.md` → `.claude/rules/`
- [ ] Créer `scripts.md` adapté VocalIA
- [ ] Copier modules Multi-Tenant (TenantContext, TenantLogger)
- [ ] Copier Stitch API (stitch-api.cjs, stitch-to-3a-css.cjs)

### Phase 3 - Opérations (P2)

- [ ] Copier sensors pertinents (cost-tracking, retention, lead-velocity)
- [ ] Copier outils forensic (system-audit-agentic.cjs)
- [ ] Créer CI/CD workflow basique

### Phase 4 - Scale (P3)

- [ ] Dashboard API endpoints
- [ ] Client onboarding automation
- [ ] Métriques/Analytics avancées

---

## MÉTRIQUES POST-TRANSFERT (À VÉRIFIER)

| Métrique | Avant | Cible | Vérification |
|:---------|:------|:------|:-------------|
| .claude/rules/ | 3 fichiers | 5 fichiers | `ls .claude/rules/*.md \| wc -l` |
| .mcp.json | 0 | 1 | `cat .mcp.json` |
| Modules Multi-Tenant | 0 | 2+ | `ls core/Tenant*.cjs` |
| Stitch Tools | 0 | 2 | `ls core/stitch*.cjs` |
| Sensors | 1 | 4+ | `ls *sensor*.cjs` |

---

*Document créé: 28/01/2026 - Session 184bis POST-FIX*
*Méthode: Bottom-up factuel*
*Parent: VocalIA (JO-AAA)*
