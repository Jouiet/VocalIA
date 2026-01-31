# AUDIT FORENSIQUE - Confusion "Agence" vs "Voice AI Platform"

**Session:** 250.33 | **Date:** 31 Janvier 2026
**Auditeur:** Claude Opus 4.5
**Méthodologie:** Bottom-up factuelle (grep, sed -n, Read)
**Scope:** Tous fichiers VocalIA contenant claims "agence/agency/automation"

---

## EXECUTIVE SUMMARY

| Métrique | Valeur |
|:---------|:------:|
| Fichiers analysés | ~500 |
| Incohérences CRITIQUES | **5 fichiers** |
| Claims "automation agency" actifs | **12 occurrences** |
| Contradiction avec Audit 250.31 | **OUI** |
| Risque | **BRAND IDENTITY CONFUSION** |

**Verdict:** L'audit Session 250.31 a déclaré "Patterns éliminés: (0)" mais **4 patterns subsistent** dans le code production.

---

## 1. DÉFINITION DE RÉFÉRENCE (SOURCE DE VÉRITÉ)

### CLAUDE.md (Autorité)
```yaml
Type: Voice AI SaaS Platform
Domain: www.vocalIA.ma
Products:
  - Voice Widget (browser, gratuit)
  - Voice Telephony (PSTN, payant)
```

### Ce que VocalIA N'EST PAS
- ❌ Une agence d'automatisation IA
- ❌ Un "Holistic Systems Architect"
- ❌ Un écosystème d'automatisation
- ❌ Un consultant en "Flywheel" ou "profit leaks"

---

## 2. INCOHÉRENCES IDENTIFIÉES

### 2.1 CRITIQUE #1: Commentaire Faux

**Fichier:** `core/voice-api-resilient.cjs`
**Ligne:** 808
**Evidence:**
```javascript
/**
 * Generate a culturally-adapted system prompt based on language
 * For Darija (ary): Uses full VocalIA context - FACTUALLY ACCURATE
 * Session 176quater: Fixed identity - VocalIA is an AGENCY, not an e-commerce company
 */
```

**Problème:** Le commentaire affirme "VocalIA is an AGENCY" - c'est FAUX.

**Vérification:**
```bash
sed -n '808p' core/voice-api-resilient.cjs
# Output: * Session 176quater: Fixed identity - VocalIA is an AGENCY, not an e-commerce company
```

**Impact:** Confusion pour les développeurs qui lisent le code.

---

### 2.2 CRITIQUE #2: AGENCY Persona MCP (Non corrigé)

**Fichier:** `mcp-server/src/index.ts`
**Lignes:** 211-221
**Evidence:**
```typescript
AGENCY: {
  fr: `Tu es l'Architecte Holistique #1 de VocalIA. Ta mission est de
       diagnostiquer les failles de croissance et de proposer des
       écosystèmes d'automatisation striking modern.
       AUDIT: Chaque interaction doit tendre vers un "Audit Système Complet"
       pour identifier les fuites de profit.`,

  en: `You are the #1 Holistic Systems Architect for VocalIA. Your mission
       is to diagnose growth bottlenecks and propose strikingly modern
       automation ecosystems.
       MISSION: Every dialogue must move towards a "Complete Flywheel Audit"
       to identify high-leverage profit leaks.`,
}
```

**Terminologie d'agence d'automatisation:**
| Terme | Occurrences | Contexte |
|-------|:-----------:|----------|
| "Holistic Systems Architect" | 2 | fr, en |
| "automation ecosystems" | 2 | fr, en |
| "Flywheel Audit" | 1 | en |
| "profit leaks" / "fuites de profit" | 2 | fr, en |
| "écosystèmes d'automatisation" | 1 | fr |

**Vérification:**
```bash
sed -n '211,221p' mcp-server/src/index.ts | grep -E "Holistic|automation|Flywheel|profit"
# Multiple matches
```

**Comparaison avec personas/voice-persona-injector.cjs (CORRIGÉ):**
```javascript
// AGENCY persona CORRECT (voice-persona-injector.cjs:69-94)
fr: `Tu es le conseiller Voice AI de VocalIA. VocalIA est une plateforme Voice AI avec 2 produits:
     1. Voice Widget: Assistant vocal 24/7 pour sites web
     2. Voice Telephony: Ligne téléphonique IA (via Twilio)`
```

**Incohérence:** Le persona AGENCY dans `voice-persona-injector.cjs` est correct (Voice AI), mais dans `mcp-server/src/index.ts` il est encore "automation agency".

---

### 2.3 CRITIQUE #3: Knowledge Base Chunks (agency_v2 obsolète)

**Fichier:** `data/knowledge-base/chunks.json`
**Lignes:** 477-522
**Evidence:**
```json
{
  "id": "faq_agency_v2_services",
  "persona_id": "agency_v2",
  "answer_fr": "VocalIA propose des agents IA vocaux, des automatisations
               e-commerce (Shopify) et des systèmes de marketing agentique Level 5.",
  "text": "agency Services services VocalIA propose des agents IA vocaux,
          des automatisations e-commerce (Shopify) et des systèmes de
          marketing agentique Level 5."
},
{
  "id": "faq_agency_v2_mission",
  "answer_fr": "Notre mission est de transformer les agences et boutiques
               en moteurs autonomes ultra-performants."
},
{
  "id": "faq_agency_v2_expertise",
  "answer_fr": "Experts en RAG, Grok, Gemini 3 Pro et déploiements holistiques."
}
```

**Claims problématiques:**
| Claim | Problème |
|-------|----------|
| "automatisations e-commerce (Shopify)" | VocalIA = Voice AI, pas automation agency |
| "marketing agentique Level 5" | Jargon agence d'automatisation |
| "transformer agences en moteurs autonomes" | Discours agence, pas plateforme |
| "déploiements holistiques" | Terminologie agence |

**Vérification:**
```bash
sed -n '477,522p' data/knowledge-base/chunks.json | grep -E "automatisation|agentique|holistique"
# 3 matches
```

**Note:** `telephony/knowledge_base.json` contient `agency_v3` qui EST correct:
```json
"agency_v3": {
  "produits": "VocalIA propose 2 produits Voice AI: Voice Widget et Voice Telephony.",
  "personas": "40 personas sectoriels pré-configurés...",
  "langues": "5 langues supportées..."
}
```

---

### 2.4 CRITIQUE #4: Knowledge Base Darija (agency_v2)

**Fichier:** `telephony/knowledge_base_ary.json`
**Lignes:** 26-30
**Evidence:**
```json
"agency_v2": {
  "services": "VocalIA كنقدمو أجون IA صوتية، أوتوماسيون للتجارة الإلكترونية
              وأنظمة التسويق المتقدمة.",
  "mission": "المهمة ديالنا هي تحويل الوكالات والمتاجر لمحركات ذاتية فعالة.",
  "contact": "تواصل معانا على vocalia.ma ولا بالتيليفون +212 6 00 00 00 00.",
  "expertise": "خبراء ف RAG، Grok، Gemini والنشر الشامل."
}
```

**Traduction des problèmes:**
| Darija | Français | Problème |
|--------|----------|----------|
| أوتوماسيون للتجارة الإلكترونية | automation e-commerce | Pas Voice AI |
| تحويل الوكالات والمتاجر لمحركات ذاتية | transformer agences en moteurs autonomes | Discours agence |
| النشر الشامل | déploiement holistique | Jargon agence |

**Vérification:**
```bash
sed -n '26,30p' telephony/knowledge_base_ary.json
```

---

### 2.5 CRITIQUE #5: Knowledge Base Services

**Fichier:** `core/knowledge-base-services.cjs`
**Lignes:** 83, 186
**Evidence:**
```javascript
// Ligne 83
'content': {
  intent: "Create scalable content assets that compound organic reach over time.",
  framework: "Content Flywheel (Create → Distribute → Repurpose)",
  // ...
}

// Ligne 186
'system-audit': "Full gap analysis identifying at least 3 high-leverage profit leaks."
```

**Terminologie d'agence:**
| Terme | Ligne | Contexte |
|-------|:-----:|----------|
| "Content Flywheel" | 83 | framework |
| "profit leaks" | 186 | system-audit outcome |

**Vérification:**
```bash
grep -n "Flywheel\|profit leak" core/knowledge-base-services.cjs
# 83:    framework: "Content Flywheel (Create → Distribute → Repurpose)",
# 186:  'system-audit': "Full gap analysis identifying at least 3 high-leverage profit leaks."
```

---

## 3. CONTRADICTION AVEC AUDIT 250.31

### Claim dans `docs/FORENSIC-AUDIT-MERGED-250.22.md:38`
```markdown
- Patterns éliminés: "automation ecosystem" (0), "flywheel" (0), "profit leak" (0)
```

### Réalité Vérifiée
```bash
# Commandes exécutées le 31/01/2026
grep -r "automation ecosystem" --include="*.ts" --include="*.cjs" | wc -l
# Output: 1 (mcp-server/src/index.ts:215)

grep -ri "flywheel" --include="*.ts" --include="*.cjs" | wc -l
# Output: 3 (mcp-server + knowledge-base-services + archive)

grep -ri "profit leak" --include="*.ts" --include="*.cjs" | wc -l
# Output: 2 (mcp-server + knowledge-base-services)
```

### Tableau de Contradiction
| Pattern | Claim 250.31 | Réalité 250.33 | Delta |
|---------|:------------:|:--------------:|:-----:|
| "automation ecosystem" | 0 | **1** | +1 |
| "flywheel" | 0 | **3** | +3 |
| "profit leak" | 0 | **2** | +2 |

**Conclusion:** L'audit 250.31 est **FACTUELLEMENT INCORRECT** sur ce point.

---

## 4. FICHIERS CORRECTEMENT CORRIGÉS (Validation)

| Fichier | Version | Status | Evidence |
|---------|:-------:|:------:|----------|
| `personas/voice-persona-injector.cjs` | agency_v3 | ✅ CORRECT | "Voice AI Platform" |
| `telephony/knowledge_base.json` | agency_v3 | ✅ CORRECT | "2 produits Voice AI" |
| `core/voice-agent-b2b.cjs` | v2.0.0 | ✅ CORRECT | Session 250.31 rewrite |
| `core/grok-client.cjs` | - | ✅ CORRECT | Voice AI system prompt |

**Vérification persona AGENCY correct:**
```bash
sed -n '69,75p' personas/voice-persona-injector.cjs
# Tu es le conseiller Voice AI de VocalIA. VocalIA est une plateforme Voice AI...
```

---

## 5. ARBRE DE DÉPENDANCES agency_v2 vs agency_v3

```
agency_v2 (OBSOLÈTE - À SUPPRIMER)
├── data/knowledge-base/chunks.json:477-522
├── telephony/knowledge_base_ary.json:26-30
├── telephony/voice-telephony-bridge.cjs:1657 (fallback)
└── personas/client_registry.json:8 (agency_internal)

agency_v3 (CORRECT - SOURCE DE VÉRITÉ)
├── personas/voice-persona-injector.cjs:810
├── telephony/knowledge_base.json:21-27
└── docs/VOCALIA-MCP.md (documentation)
```

---

## 6. IMPACT BUSINESS

### 6.1 Risque Identitaire
- Les prospects utilisant le MCP Server reçoivent un discours "agence d'automatisation"
- Confusion entre VocalIA (Voice AI) et agences partenaires (clients)

### 6.2 Risque SEO/AEO
- Les LLMs indexant le code peuvent propager la confusion
- llms.txt est correct, mais le code interne contredit

### 6.3 Risque Développeur
- Les nouveaux développeurs lisent le commentaire ligne 808 et pensent VocalIA = agence

---

## 7. PLAN DE CORRECTION (Non implémenté)

| # | Fichier | Ligne(s) | Action Requise | Priorité |
|:-:|---------|:--------:|----------------|:--------:|
| 1 | `core/voice-api-resilient.cjs` | 808 | Corriger commentaire → "Voice AI Platform" | P0 |
| 2 | `mcp-server/src/index.ts` | 211-221 | Aligner AGENCY persona sur voice-persona-injector.cjs | P0 |
| 3 | `data/knowledge-base/chunks.json` | 477-522 | Remplacer agency_v2 FAQs par agency_v3 | P1 |
| 4 | `telephony/knowledge_base_ary.json` | 26-30 | Traduire agency_v3 en Darija | P1 |
| 5 | `core/knowledge-base-services.cjs` | 83, 186 | Supprimer "Flywheel" et "profit leaks" | P2 |
| 6 | `docs/FORENSIC-AUDIT-MERGED-250.22.md` | 38 | Corriger claim "Patterns éliminés: (0)" | P2 |

---

## 8. COMMANDES DE VÉRIFICATION POST-FIX

```bash
# Vérifier absence patterns agence
grep -ri "automation ecosystem\|flywheel\|profit leak\|holistic" \
  --include="*.ts" --include="*.cjs" \
  --exclude-dir=archive --exclude-dir=node_modules | wc -l
# Expected: 0

# Vérifier commentaire corrigé
sed -n '808p' core/voice-api-resilient.cjs | grep -c "Voice AI Platform"
# Expected: 1

# Vérifier AGENCY MCP aligné
sed -n '211,221p' mcp-server/src/index.ts | grep -c "Voice AI"
# Expected: ≥2

# Vérifier absence agency_v2 dans chunks
grep -c '"persona_id": "agency_v2"' data/knowledge-base/chunks.json
# Expected: 0
```

---

## 9. MÉTRIQUES FINALES

| Métrique | Avant Audit | Après Correction |
|:---------|:-----------:|:----------------:|
| Claims "automation agency" | 12 | 0 (target) |
| Patterns "flywheel" | 3 | 0 (target) |
| Patterns "profit leak" | 2 | 0 (target) |
| Commentaires incorrects | 1 | 0 (target) |
| Cohérence AGENCY persona | 50% | 100% (target) |

---

## 10. CONCLUSION

### Faits Établis
1. VocalIA = **Voice AI SaaS Platform** (pas une agence)
2. Le persona AGENCY existe pour les **clients agences** utilisant VocalIA
3. L'audit 250.31 a corrigé certains fichiers mais **pas tous**
4. 5 fichiers contiennent encore des claims "automation agency"

### Recommandation
Exécuter les corrections P0/P1 avant toute communication externe ou mise à jour du MCP Server.

---

**Signé:** Claude Opus 4.5
**Date:** 31 Janvier 2026
**Session:** 250.33
**Hash de vérification:** `grep -c "agency_v2" data/knowledge-base/chunks.json` → 4
