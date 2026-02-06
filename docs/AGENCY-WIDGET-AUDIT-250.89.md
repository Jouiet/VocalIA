# Audit Widget AGENCY VocalIA - Session 250.89

**Date:** 2026-02-06
**Status:** PARTIELLEMENT COMPLET
**Auditeur:** Claude Opus 4.5

---

## 1. Objectif Initial

Tester factuellement que le prompt AGENCY produit des réponses correctement formatées pour le widget de démonstration VocalIA.

---

## 2. Méthodologie

### Tests Effectués:
1. **Lancement service** `voice-api-resilient.cjs` sur port 3004
2. **10 requêtes HTTP** vers `/respond` avec `widget_type: "B2B"`
3. **Vérification injection prompt** via code trace Node.js
4. **Analyse réponses** (lignes, présence question finale)

### Bugs Corrigés Pendant l'Audit:
| Bug | Fichier | Correction |
|:----|:--------|:-----------|
| PROVIDERS non défini | voice-api-resilient.cjs:65 | Ajout constante globale |
| MAX_BODY_SIZE non défini | voice-api-resilient.cjs:64 | Ajout `const MAX_BODY_SIZE = 1024 * 1024` |
| getDB non importé | voice-api-resilient.cjs:52 | Ajout import GoogleSheetsDB |
| KB.graphSearch erreur | voice-api-resilient.cjs:400 | Création instance ServiceKnowledgeBase |
| translationSupervisor non défini | voice-api-resilient.cjs:60 | Ajout `let translationSupervisor = null` |
| body non défini dans callGemini | voice-api-resilient.cjs:1017 | Ajout création body JSON |

---

## 3. Résultats Tests Conversation (10 Questions)

| # | Question | Lignes | Question? | Status |
|:--|:---------|:------:|:---------:|:------:|
| Q1 | Salutation | 4 | ✅ | PASS |
| Q2 | Question vague | 4 | ✅ | PASS |
| Q3 | Demande exhaustive | - | - | FAIL (null) |
| Q4 | Objection prix | 3 | ✅ | PASS |
| Q5 | Question technique | 5 | ✅ | PASS |
| Q6 | Demande démo | 5 | ✅ | PASS |
| Q7 | Hésitation | 4 | ✅ | PASS |
| Q8 | E-commerce Shopify | 5 | ✅ | PASS |
| Q9 | Comparaison | 5 | ✅ | PASS |
| Q10 | Closing | 4 | ✅ | PASS |

**Score: 9/10 (90%)**

---

## 4. Vérification Injection Prompt

### Preuve Factuelle (Code Trace):
```javascript
const persona = VoicePersonaInjector.getPersona(null, null, 'default', 'B2B');
persona.language = 'fr';
const injectedConfig = VoicePersonaInjector.inject(baseConfig, persona);
```

### Résultats:
| Élément | Présent? |
|:--------|:--------:|
| FORMAT DE RÉPONSE OBLIGATOIRE | ✅ |
| max 15 mots | ✅ |
| JAMAIS de pavé | ✅ |
| 4 produits | ✅ |
| 49€ | ✅ |
| +1 762-422-4223 | ✅ |

**Conclusion:** Le prompt AGENCY réécrit EST correctement injecté.

---

## 5. Bugs Restants

### 5.1 Template Replacement Corrompt le Lien Démo

**Fichier:** `personas/voice-persona-injector.cjs` ligne 6240

**Problème:**
```javascript
HARDCODED_DEMO_NAMES.forEach(demoName => {
    finalInstructions = finalInstructions.replace(..., persona.name);
});
```

Remplace "VocalIA" par "VocalIA Voice AI Consultant", ce qui transforme:
- `vocalia.ma/booking` → `VocalIA Voice AI Consultant.ma/booking` ❌

**Solution Proposée:** Exclure les URLs du remplacement ou utiliser un regex plus précis.

### 5.2 Mention "essai gratuit" au lieu de "essai 14 jours"

Dans les réponses Q7, Q9, Q10, le modèle dit "essai gratuit 14 jours".

**Problème:** Politique NO FREE TIER - devrait être "essai 14 jours" sans "gratuit".

**Solution:** Modifier le prompt pour préciser "PAS de mot gratuit".

### 5.3 Q3 Retourne Null

La demande exhaustive "Donnez-moi TOUS vos produits avec TOUS les prix" retourne null.

**Cause Probable:** Timeout ou erreur RAG.

**À Investiguer:** Logs détaillés pour cette requête.

---

## 6. Fichiers Modifiés Cette Session

| Fichier | Lignes Modifiées | Raison |
|:--------|:-----------------|:-------|
| core/voice-api-resilient.cjs | 52, 60, 64-65, 400, 1006-1020 | Corrections bugs runtime |
| personas/voice-persona-injector.cjs | 77-141 | Prompt AGENCY FORMAT (session précédente) |

---

## 7. Actions Requises

| Priorité | Action | Effort |
|:---------|:-------|:------:|
| P0 | Corriger bug template URL démo | 15min |
| P1 | Supprimer "gratuit" du vocabulaire modèle | 5min |
| P2 | Investiguer Q3 null | 30min |
| P3 | Ajouter tests automatisés prompt injection | 1h |

---

## 8. Conclusion

**Le prompt AGENCY FORMAT fonctionne à 90%.**

Les réponses sont:
- ✅ Courtes (3-5 lignes)
- ✅ Avec sauts de ligne
- ✅ Avec question finale
- ✅ Progressives (pas de dump)

**Bugs restants:** Template URL, vocabulaire "gratuit", Q3 timeout.

---

*Document généré: 2026-02-06 | Session 250.89*
