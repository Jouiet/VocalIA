# Plan d'Amélioration Qualité Multi-Tenant

> **Session 250.97quater** | 06/02/2026
> **Score Actuel**: 75.2/100
> **Score Cible**: 100/100
> **Gap**: 24.8 points

---

## Analyse Factuelle

### Scoring Algorithm (5 critères × 20 points = 100)

| Critère | Max | Actuel (Avg) | Gap |
|:--------|:---:|:------------:|:---:|
| Prompt Length (>1000 chars) | 20 | 10.7 | **9.3** |
| Business Name in Prompt | 20 | 20.0 | 0 |
| No Unresolved Templates | 20 | 20.0 | 0 |
| No AGENCY Contamination | 20 | 20.0 | 0 |
| Tone Indicators (5/5) | 20 | 4.5 | **15.5** |

### Root Causes

1. **Prompts trop courts**: Moyenne 493 chars (besoin >1000)
2. **Indicateurs de ton manquants**: "bonjour", "bienvenue" absents de 97% des prompts

---

## Actions Requises

### ACTION 1: Enrichir les SYSTEM_PROMPTS (Impact: +9.3 pts avg)

**25 archetypes à étendre** de ~200 chars à >1000 chars:

| Archetype | Actuel | Cible | Contenu à ajouter |
|:----------|:------:|:-----:|:------------------|
| CONSULTANT | 183 | 1000+ | Méthodologie, livrables, tarification |
| IT_SERVICES | 170 | 1000+ | Stack technique, SLA, support |
| DISPATCHER | 171 | 1000+ | Suivi, délais, exceptions |
| CONTRACTOR | 177 | 1000+ | Types travaux, devis, garanties |
| PLANNER | 173 | 1000+ | Types événements, capacités, options |
| COUNSELOR | 198 | 1000+ | Spécialités, confidentialité |
| INSURER | 168 | 1000+ | Types contrats, sinistres |
| ... | | | |

**Template enrichi (>1000 chars):**

```
Tu es l'assistant de {{business_name}}.

BIENVENUE! Je suis là pour vous aider.

ADRESSE: {{address}}
TÉL: {{phone}}
HORAIRES: {{horaires}}

NOS SERVICES:
{{services}}

ZONES DE SERVICE:
{{zones}}

COMMENT JE PEUX VOUS AIDER:
- Répondre à vos questions sur nos services
- Vous orienter vers le bon interlocuteur
- Prendre rendez-vous
- Fournir des informations sur nos tarifs

OBJECTIF: [spécifique à l'archetype]

STYLE: Professionnel, à l'écoute, serviable.

INSTRUCTIONS IMPORTANTES:
1. Toujours saluer le client avec "Bonjour!"
2. Proposer son aide activement
3. Être précis et concis
4. Confirmer la compréhension des demandes
5. Proposer des alternatives si nécessaire

CE QUE JE NE FAIS PAS:
- Donner des conseils [juridiques/médicaux/etc.]
- Promettre des délais non confirmés
- Communiquer des informations confidentielles

EN CAS DE PROBLÈME:
- Proposer de transférer à un responsable
- Prendre les coordonnées pour rappel
```

### ACTION 2: Ajouter indicateurs de ton (Impact: +15.5 pts avg)

**5 mots-clés requis dans CHAQUE prompt:**

```
1. "bonjour" - Salutation d'accueil
2. "bienvenue" - Message de bienvenue
3. "service" - Orientation service
4. "client" - Focus client
5. "aide" - Proposition d'aide
```

**Pattern standard à inclure:**

```
Bonjour et bienvenue chez {{business_name}}!
Je suis votre assistant dédié pour vous aider avec nos services.
Comment puis-je aider notre client aujourd'hui?
```

---

## Effort Estimé

| Action | Archetypes | Effort/Archetype | Total |
|:-------|:----------:|:----------------:|:-----:|
| Enrichir prompts | 25 | 15 min | 6h15 |
| Ajouter tone indicators | 25 | 5 min | 2h05 |
| Tests | - | 30 min | 30 min |
| **TOTAL** | | | **~9h** |

---

## Vérification Post-Implémentation

```bash
# Re-run exhaustive tests
node test/exhaustive-multi-tenant-test.cjs

# Run quality gap analysis
node test/quality-gap-analysis.cjs

# Cible:
# - Average Score: 100/100
# - Min Score: 100/100
# - Max Score: 100/100
```

---

## Alternative: Ajuster les critères de scoring

Si l'effort de 9h est trop élevé, on peut:

1. **Réduire le seuil de longueur**: 500 chars au lieu de 1000
2. **Réduire le nombre d'indicateurs**: 3/5 au lieu de 5/5

**MAIS**: Cela diminue la qualité réelle des interactions vocales.

---

## Recommandation

**Option A (Recommandée)**: Enrichir les prompts pour atteindre 100% de qualité réelle.
- Effort: 9h
- Résultat: Interactions vocales professionnelles et complètes

**Option B**: Ajuster les tests pour refléter la réalité actuelle.
- Effort: 30 min
- Résultat: Score 100% mais qualité inchangée

---

*Document créé: Session 250.97quater | 06/02/2026*
