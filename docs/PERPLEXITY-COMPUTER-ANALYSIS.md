# Perplexity Computer — Analyse Technique & Business + Plan d'Action VocalIA

> Document de référence factuel | 27/02/2026 | Sources: blog officiel, docs Perplexity, Fortune, Heise, reviews indépendantes
> Objectif: Comprendre l'architecture de Perplexity Computer et extraire les patterns applicables à VocalIA

---

## TABLE DES MATIÈRES

1. [Perplexity Computer — Vue d'Ensemble](#1-perplexity-computer--vue-densemble)
2. [Architecture Technique Détaillée](#2-architecture-technique-détaillée)
3. [Modèles & Orchestration](#3-modèles--orchestration)
4. [Fonctionnalités Clés](#4-fonctionnalités-clés)
5. [Tarification & Crédits](#5-tarification--crédits)
6. [Forces & Limites (Vérifiées)](#6-forces--limites-vérifiées)
7. [Cas d'Usage Business Documentés](#7-cas-dusage-business-documentés)
8. [Comparatif Factuel: Perplexity Computer vs VocalIA](#8-comparatif-factuel-perplexity-computer-vs-vocalia)
9. [Plan d'Action: Patterns à Implémenter dans VocalIA](#9-plan-daction-patterns-à-implémenter-dans-vocalia)
10. [Annexes](#10-annexes)

---

## 1. PERPLEXITY COMPUTER — VUE D'ENSEMBLE

### 1.1 Identité

| Attribut | Valeur |
|:---------|:-------|
| **Nom** | Perplexity Computer |
| **Type** | Orchestrateur multi-agents cloud (« digital worker ») |
| **Lancement** | 25 février 2026 |
| **CEO** | Aravind Srinivas |
| **Architecte** | Alex Graveley (ex-GitHub Copilot, créateur Comet browser) |
| **Entreprise** | Perplexity AI (San Francisco) |
| **Origine** | Évolution de « ASI » — plugin Slack interne devenu système autonome |

### 1.2 Philosophie

Citation Aravind Srinivas : **"L'IA est l'ordinateur."**

Perplexity Computer ne traite pas les modèles IA comme des entités isolées mais comme des **composants interchangeables** — à l'instar d'un système de fichiers ou de commandes terminal — pour exécuter des workflows sans interruption humaine.

Citation Fortune : *"The orchestration is the product. The model is a tool."*

### 1.3 Positionnement Stratégique

- **Paradigme** : De l'IA conversationnelle (Q&R) → IA Agentique (gestion de machine d'état)
- **Cible** : Dirigeants, équipes réduites, professionnels du savoir
- **Promesse** : Transformer une équipe réduite en « organisation à haute capacité »
- **Modèle économique** : Abonnement Max (200$/mois) + système de crédits

---

## 2. ARCHITECTURE TECHNIQUE DÉTAILLÉE

### 2.1 Paradigme d'Orchestration

```
┌──────────────────────────────────────────────────────┐
│                    UTILISATEUR                        │
│          (Web / Slack / Mobile / "Hey Plex")          │
└─────────────────────┬────────────────────────────────┘
                      │ Intention
                      ▼
┌──────────────────────────────────────────────────────┐
│              ORCHESTRATEUR (Opus 4.6)                 │
│  ┌─────────────────────────────────────────────────┐ │
│  │  1. Ingestion de l'intention (le "quoi")        │ │
│  │  2. Décomposition en sous-tâches                │ │
│  │  3. Sélection dynamique modèle par sous-tâche   │ │
│  │  4. Dispatch parallèle aux sous-agents          │ │
│  │  5. Agrégation + vérification cohérence         │ │
│  │  6. Auto-correction si échec                    │ │
│  └─────────────────────────────────────────────────┘ │
└─────┬──────┬──────┬──────┬──────┬──────┬─────────────┘
      │      │      │      │      │      │
      ▼      ▼      ▼      ▼      ▼      ▼
   ┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐
   │Opus ││Gemi-││GPT  ││Grok ││Nano ││Veo  │
   │4.6  ││ni   ││5.2  ││     ││Bana-││3.1  │
   │     ││     ││     ││     ││na   ││     │
   │Code ││Rech.││Long ││Micro││Image││Video│
   │Logic││Web  ││Ctx  ││Task ││Gen  ││Gen  │
   └─────┘└─────┘└─────┘└─────┘└─────┘└─────┘
      │      │      │      │      │      │
      └──────┴──────┴──────┴──────┴──────┘
                      │
                      ▼
         ┌─────────────────────┐
         │  SANDBOX ISOLÉ      │
         │  • Filesystem réel  │
         │  • Browser (Comet)  │
         │  • API access       │
         │  • Persistance      │
         └─────────────────────┘
```

### 2.2 Composants Architecturaux

| Composant | Description | Analogie VocalIA |
|:----------|:------------|:----------------|
| **Orchestrateur** | Opus 4.6 planifie, décompose, route | `getResilisentResponse()` (mais séquentiel) |
| **Sous-agents** | Instances spécialisées par sous-tâche | N/A — VocalIA n'a pas de sous-agents |
| **Sandbox** | Conteneur cloud isolé avec FS + browser | Docker containers (7 services) |
| **Mémoire persistante** | Fichiers, préférences, contexte cross-session | `ContextBox` + `conversation-analytics` |
| **Connecteurs** | 400+ apps (Gmail, Slack, GitHub, CRM…) | HubSpot, WooCommerce, Calendly, Stripe |
| **Comet** | Navigateur IA agentique (browsing réel) | N/A |
| **Auto-correction** | Spawn agent de dépannage si échec | Fallback linéaire (pas de retry intelligent) |

### 2.3 Cycle d'Exécution

1. **Ingestion** — L'utilisateur décrit l'objectif business (pas les étapes)
2. **Mapping Agentique** — Décomposition en sous-tâches + sélection dynamique parmi 19 modèles
3. **Exécution Multi-threadée** — Recherche, analyse, rédaction s'opèrent en parallèle (pas séquentiel)
4. **Synthèse** — L'orchestrateur agrège les résultats, vérifie la cohérence, déploie le livrable
5. **Auto-correction** — Si source de données corrompue, un sous-agent trouve une alternative

### 2.4 Sécurité

- Code exécuté dans **conteneurs isolés** (aucune commande ne touche l'infra locale)
- Contrairement à OpenClaw (local), pas de risque de misconfiguration système
- Lignes d'interaction avec APIs/services tiers **tracées** pour auditabilité
- Cloud US — aucune souveraineté données pour l'utilisateur

---

## 3. MODÈLES & ORCHESTRATION

### 3.1 Les 19 Modèles — Liste Vérifiée

**Confirmés publiquement (7/19) :**

| # | Modèle | Rôle Stratégique | Source |
|:--|:-------|:-----------------|:-------|
| 1 | **Opus 4.6** (Claude) | Orchestration centrale, raisonnement, supervision, code | Blog officiel, Fortune |
| 2 | **Sonnet 4.6** (Claude) | Scripts, exécution de code, calcul | Doc workflow |
| 3 | **Gemini** (Google) | Recherche massive, web crawling, données | Blog officiel |
| 4 | **GPT-5.2** (OpenAI) | Contexte long, extraction connaissances complexes | Fortune, Heise |
| 5 | **Grok** (xAI) | Micro-tâches haute vélocité, faible latence | Blog officiel |
| 6 | **Nano Banana** (Google) | Génération/manipulation d'images | Blog officiel |
| 7 | **Veo 3.1** (Google) | Production/édition vidéo agentique | Blog officiel |

**Non identifiés (12/19)** : Probablement des modèles spécialisés (embedding, classification, OCR, audio, traduction, etc.). Aucune source publique ne les nomme à ce jour.

### 3.2 Stratégie de Routage Dynamique

Le concept clé : **"Dans un marché où de nouveaux modèles Frontier émergent tous les 17 jours, la valeur ne réside plus dans la possession d'un modèle unique, mais dans le routage dynamique."**

```
                    ┌─────────────────┐
                    │  TÂCHE ENTRANTE │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  CLASSIFICATEUR │
                    │  (Opus 4.6)     │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼──────┐ ┌────▼─────┐ ┌──────▼──────┐
     │  Raisonnement │ │ Recherche│ │   Vitesse   │
     │  → Opus 4.6   │ │ → Gemini │ │   → Grok    │
     └───────────────┘ └──────────┘ └─────────────┘
              │              │              │
     ┌────────▼──────┐ ┌────▼─────┐ ┌──────▼──────┐
     │    Code       │ │  Ctx Long│ │   Images    │
     │  → Sonnet 4.6 │ │ → GPT5.2 │ │ → Nano Ban. │
     └───────────────┘ └──────────┘ └─────────────┘
```

**Principe** : L'orchestrateur n'utilise PAS un modèle unique pour tout. Il analyse le TYPE de chaque sous-tâche et sélectionne le modèle le plus performant pour cette tâche spécifique.

### 3.3 Modèle-Agnosticité

Citation Srinivas (Fortune) : *"More than half of the company's enterprise users already select multiple models within a single workday."*

Architecture conçue pour que les modèles soient **interchangeables** : si un meilleur modèle de recherche remplace Gemini demain, le swap est transparent.

---

## 4. FONCTIONNALITÉS CLÉS

### 4.1 Décomposition Intelligente de Tâches

L'utilisateur décrit un **objectif** (pas des étapes). L'orchestrateur :
- Décompose en sous-tâches
- Crée des sous-agents spécialisés
- Exécute en parallèle
- N'interrompt l'utilisateur que pour les décisions critiques

### 4.2 Exécution Parallèle Multi-threadée

- Recherche + analyse financière + rédaction = **simultané**, pas séquentiel
- 30 prospects recherchés en parallèle (LinkedIn, actualités, rapports annuels)
- 7 types de search en même temps (web, académique, people, image, vidéo, shopping, social)

### 4.3 Mémoire Persistante Cross-Session

- Fichiers, préférences, contexte projet persistés entre sessions
- L'agent "reprend là où il s'est arrêté"
- Profil utilisateur évolutif

### 4.4 Workflows Longue Durée

- Tâches qui s'exécutent heures, semaines, voire mois
- Pas besoin de re-prompting
- Exécution asynchrone en arrière-plan
- Notifications uniquement quand c'est nécessaire

### 4.5 Auto-Correction

- Si un sous-agent échoue → spawn automatique d'un agent de dépannage
- Si une source de données est corrompue → recherche automatique d'une alternative
- L'orchestrateur ne s'arrête pas sur les erreurs, il les contourne

### 4.6 400+ Intégrations Apps

Gmail, Slack, GitHub, CRM, calendrier, e-commerce… (liste exacte non publiée). Tests indépendants n'ont vérifié que GitHub.

### 4.7 Navigateur Réel (Comet)

Technologie "agentic browsing" — le système peut naviguer sur le web réel, interagir avec des pages, remplir des formulaires, extraire des données de sites dynamiques.

### 4.8 Convergence Mobile (Samsung S26)

- Intégration au niveau framework Samsung (remplace Bixby)
- Mot de réveil : **"Hey Plex"**
- Accès profond au système : calendrier, horloge, notes
- Actions transversales entre applications

---

## 5. TARIFICATION & CRÉDITS

### 5.1 Plans Perplexity (Février 2026)

| Plan | Prix/mois | Prix/an | Computer | Crédits |
|:-----|:----------|:--------|:---------|:--------|
| **Free** | 0$ | 0$ | Non | — |
| **Pro** | 20$ | 200$ | Non (prévu) | — |
| **Max** | **200$** | **2 000$** | **Oui** | **10 000/mois** |
| Enterprise Pro | 40$/siège | 400$/siège | Non (prévu) | — |
| Enterprise Max | 325$/siège | 3 250$/siège | Oui | À définir |

**Bonus lancement** : 20 000 crédits supplémentaires (expire 30 jours).

### 5.2 Système de Crédits

- Token-based billing (première fois chez Perplexity)
- Plafonds de dépenses configurables par l'utilisateur
- Gestion granulaire du budget tokens par tâche
- L'utilisateur peut choisir quel modèle utiliser pour chaque sous-agent
- Pas de données publiques sur le coût en crédits par type de tâche

### 5.3 API Perplexity (Séparée de Computer)

| Modèle API | Input ($/1M tokens) | Output ($/1M tokens) |
|:-----------|:-------------------:|:--------------------:|
| Sonar | 1$ | 1$ |
| Sonar Pro | 3$ | 15$ |
| Sonar Reasoning | 1$ | 5$ |
| Sonar Reasoning Pro | 2$ | 8$ |
| Sonar Deep Research | 2$ | 8$ + 5$/1K searches |
| Search API | 5$/1 000 requêtes | — |

---

## 6. FORCES & LIMITES (VÉRIFIÉES)

### 6.1 Forces Confirmées

| Force | Preuve |
|:------|:-------|
| Orchestration multi-modèle | 7 modèles confirmés, routage dynamique par compétence |
| Exécution parallèle | Review indépendante : 7 types de search simultanées |
| Mémoire persistante | Confirmé par blog officiel et reviews |
| Auto-correction | Documenté dans l'architecture (spawn agents dépannage) |
| Sandbox sécurisé | Conteneurs isolés cloud, pas d'accès système local |
| Modèle-agnosticité | Modèles interchangeables par design |

### 6.2 Limites Confirmées

| Limite | Source |
|:-------|:-------|
| **200$/mois** — barrier financière significative | Pricing officiel |
| **Cloud-only** — aucune exécution locale possible | Architecture |
| **Aucune souveraineté données** — cloud US | Architecture |
| **Pas de contrôle desktop** — contrairement à Claude Computer Use | Review Substack |
| **Watermarks** sur les apps générées ("Generated with Perplexity Computer") | Review Substack |
| **400 intégrations annoncées** — seul GitHub vérifié indépendamment | Review Substack |
| **12/19 modèles non identifiés** — aucune source publique | Toutes sources |
| **Pas de voix** — texte uniquement, pas de TTS/STT | Architecture |
| **Pas de téléphonie** — aucune intégration PSTN | Architecture |
| **Interventions humaines** parfois nécessaires en scénarios ultra-complexes | Review AIGyani |
| **Pas d'API publique Computer** — uniquement via interface web Max | Docs officielles |
| **Web-only** — pas d'app mobile à ce jour | Heise |

---

## 7. CAS D'USAGE BUSINESS DOCUMENTÉS

### 7.1 Prospection Commerciale Hyper-Personnalisée

- Recherche multi-threadée sur 30 prospects simultanément (LinkedIn, actualités, rapports annuels)
- Rédaction d'argumentaires basés sur points de douleur spécifiques
- Orchestration envoi via Gmail
- **Impact revendiqué** : -90% cycle de prospection

### 7.2 Intelligence Compétitive Temps Réel

- Surveillance automatisée 24/7 des concurrents (prix, features, signaux sociaux)
- Analyse des changements vs veille
- Rapport stratégique quotidien (8h)
- **Impact revendiqué** : Élimination veille manuelle

### 7.3 Analyse Financière Niveau Bloomberg

- Mémos d'investissement complets (graphiques, marges, sentiment marché)
- **Comparaison** : Terminal Bloomberg ≈ 30 000$/an → Perplexity Computer 2 400$/an
- **Impact revendiqué** : "Democratized Alpha"

### 7.4 Génération d'Apps/Sites (Vérifié par Review)

- Callout box generator avec branding exact → déployé en < 30 min
- Table generator avec contrôles colonnes/lignes
- Push direct vers GitHub
- **Limite** : Watermarks "Generated with Perplexity Computer"

### 7.5 Research Packets (Vérifié par Review)

- 7 types de search simultanées
- Lecture pages complètes (pas snippets)
- Cross-référencement entre bases de données
- 4 packets complets en une nuit

---

## 8. COMPARATIF FACTUEL: PERPLEXITY COMPUTER vs VOCALIA

### 8.1 Matrice Comparative Complète

| Dimension | Perplexity Computer | VocalIA | Verdict |
|:----------|:-------------------|:--------|:--------|
| **Nature** | Digital worker généraliste | Agent vocal B2B client-facing | Complémentaires |
| **Canal principal** | Web (texte) | Voix temps-réel + PSTN | VocalIA unique |
| **Latence cible** | Minutes à heures (asynchrone) | < 2 secondes (voix live) | Contraintes opposées |
| **Modèles IA** | 19 (routage par compétence) | 4 (fallback séquentiel) | PC plus riche |
| **Stratégie multi-modèle** | Tâche → meilleur modèle | Grok → Gemini → Claude → Local | PC plus intelligent |
| **Exécution** | Parallèle, asynchrone, longue durée | Synchrone, temps-réel | Besoins différents |
| **Sous-agents** | Oui (spawn dynamique) | Non | PC supérieur |
| **Auto-correction** | Oui (agent dépannage auto) | Non (fallback linéaire) | PC supérieur |
| **Mémoire** | Cross-session (fichiers, projets) | Cross-session (facts, leads, KB) | Équivalent |
| **RAG** | Search web multi-source (7 types) | Hybrid local (BM25+Embeddings+RRF) | Complémentaires |
| **Qualification leads** | Non natif | Natif (BANT 0-100, CRM sync) | VocalIA supérieur |
| **TTS/STT** | Non | ElevenLabs + Grok Realtime WS | VocalIA unique |
| **Téléphonie** | Non | Twilio PSTN, 25 function tools | VocalIA unique |
| **Personas** | 1 (assistant unique) | 40 × 5 langues = 200 prompts | VocalIA supérieur |
| **Multi-tenant** | Non (usage personnel) | 26 tenants, isolation complète | VocalIA supérieur |
| **Langues** | Multilingue (via modèles) | 5 natives (FR/EN/ES/AR/Darija) | VocalIA plus spécialisé |
| **Darija** | Non | Oui (seul système au monde) | VocalIA unique |
| **Intégrations** | 400+ annoncées (GitHub vérifié) | HubSpot, WooCommerce, Calendly, Stripe, WhatsApp | PC plus large |
| **MCP** | Non | 203 tools, 6 resources, 8 prompts | VocalIA unique |
| **Sécurité** | Sandbox cloud isolé | CORS/CSP/SRI/JWT/rate-limit/path-guard | Équivalent |
| **Souveraineté** | Cloud US (aucune) | Self-hosted Docker (totale) | VocalIA supérieur |
| **Prix** | 200$/mois (individuel) | 49-199€/mois (B2B SaaS) | VocalIA plus abordable |
| **Open source** | Non | Non (mais self-hosted) | — |

### 8.2 Conclusion du Comparatif

**Perplexity Computer et VocalIA ne sont pas concurrents.** Ce sont des systèmes de nature fondamentalement différente :

- **Perplexity Computer** = orchestrateur de productivité personnelle/équipe (recherche, code, design)
- **VocalIA** = agent vocal B2B client-facing (conversation, qualification, support)

La relation est **complémentaire**. Les patterns d'orchestration intelligente de Perplexity Computer sont directement transposables pour améliorer les capacités de VocalIA.

---

## 9. PLAN D'ACTION: PATTERNS À IMPLÉMENTER DANS VOCALIA

### Vue d'Ensemble des Tâches

| # | Tâche | Priorité | Impact | Effort | Fichier Principal | Status |
|:--|:------|:---------|:-------|:-------|:-----------------|:-------|
| T1 | Routage dynamique par compétence | **CRITIQUE** | Qualité ++ | Moyen | `core/task-router.cjs` | **DONE** (250.245) |
| T2 | Parallélisation des sous-tâches | **HAUTE** | Latence -53% | Faible | `core/voice-api-resilient.cjs` | **DONE** (250.245) |
| T3 | Quality Gate post-réponse | **HAUTE** | Pertinence ++ | Moyen | `core/quality-gate.cjs` | **DONE** (250.245) |
| T4 | Retry intelligent par type d'erreur | **HAUTE** | Fiabilité ++ | Faible | `core/voice-api-resilient.cjs` | **DONE** (250.245) |
| T5 | Profil client évolutif enrichi | **MOYENNE** | Conversion ++ | Moyen | `core/ContextBox.cjs` | **DONE** (250.245) |
| T6 | Token Budget Manager par tenant | **MOYENNE** | Coûts prévisibles | Moyen | `core/token-budget.cjs` | **DONE** (250.245) |
| T7 | Enrichissement RAG multi-source | **BASSE** | Précision e-com | Moyen | `core/voice-ecommerce-tools.cjs` + `voice-api-resilient.cjs` | ✅ DONE (250.246) |

---

### T1. ROUTAGE DYNAMIQUE PAR COMPÉTENCE (CRITIQUE)

**Pattern Perplexity** : L'orchestrateur analyse le type de tâche et route vers le modèle le plus performant.

**Problème VocalIA actuel** : `voice-api-resilient.cjs:1675-1681` — le fallback est **linéaire et aveugle** :
```
Grok → [Atlas-Chat si Darija] → Gemini → Anthropic
```
Grok est TOUJOURS essayé en premier, quelle que soit la tâche. Or :
- Grok excelle en **vitesse** (micro-tâches conversationnelles)
- Gemini excelle en **recherche** et **raisonnement sur données**
- Claude excelle en **raisonnement structuré** et **extraction JSON**
- Atlas-Chat excelle en **Darija**

**Implémentation** :

Créer un `TaskRouter` en amont du fallback dans `getResilisentResponse()` (ligne 1675) :

```javascript
// core/task-router.cjs — Nouveau module
// Routage dynamique inspiré Perplexity Computer

const TASK_TYPES = {
  CONVERSATION: 'conversation',     // Réponse fluide, rapide
  QUALIFICATION: 'qualification',   // Extraction BANT structurée
  RECOMMENDATION: 'recommendation', // Suggestion produit/service
  SUPPORT: 'support',              // Résolution problème technique
  DARIJA: 'darija',                // Conversation en Darija
};

// Modèle optimal par type de tâche
const ROUTING_TABLE = {
  [TASK_TYPES.CONVERSATION]:   ['grok', 'gemini', 'anthropic'],     // Grok = vitesse
  [TASK_TYPES.QUALIFICATION]:  ['anthropic', 'gemini', 'grok'],     // Claude = raisonnement structuré
  [TASK_TYPES.RECOMMENDATION]: ['gemini', 'grok', 'anthropic'],     // Gemini = données, contexte
  [TASK_TYPES.SUPPORT]:        ['gemini', 'anthropic', 'grok'],     // Gemini = recherche KB
  [TASK_TYPES.DARIJA]:         ['grok', 'atlasChat', 'gemini'],     // Grok rapide, Atlas fallback
};

function classifyTask(userMessage, language, session) {
  const lower = userMessage.toLowerCase();

  // Darija = priorité absolue
  if (language === 'ary') return TASK_TYPES.DARIJA;

  // Qualification : détection d'intention budget/timeline/décision
  const qualPatterns = /budget|prix|tarif|co[uû]t|d[eé]lai|timeline|d[eé]cid|responsable|qui d[eé]cide|price|cost|deadline|decision/i;
  if (qualPatterns.test(userMessage)) return TASK_TYPES.QUALIFICATION;

  // Recommandation : détection d'intention suggestion
  const recPatterns = /recommand|suggest|propos|conseill|quoi (acheter|choisir)|quel.*(produit|service|plan)|قترح|شنو نشري/i;
  if (recPatterns.test(userMessage)) return TASK_TYPES.RECOMMENDATION;

  // Support : détection d'intention problème
  const supportPatterns = /probl[eè]m|bug|erreur|marche pas|fonctionne pas|aide|help|issue|error|broken|not working/i;
  if (supportPatterns.test(userMessage)) return TASK_TYPES.SUPPORT;

  // Défaut : conversation fluide
  return TASK_TYPES.CONVERSATION;
}

function getOptimalProviderOrder(taskType, currentProviders) {
  const order = ROUTING_TABLE[taskType] || ROUTING_TABLE[TASK_TYPES.CONVERSATION];
  // Filtrer les providers non configurés
  return order.filter(p => currentProviders[p]?.enabled);
}

module.exports = { classifyTask, getOptimalProviderOrder, TASK_TYPES };
```

**Intégration dans `voice-api-resilient.cjs`** (remplacer lignes 1675-1681) :

```javascript
// AVANT (fallback linéaire aveugle) :
const baseOrder = ['grok', 'gemini', 'anthropic'];
const providerOrder = language === 'ary' && currentProviders.atlasChat?.enabled
  ? ['grok', 'atlasChat', 'gemini', 'anthropic']
  : baseOrder;

// APRÈS (routage dynamique par compétence) :
const taskType = TaskRouter.classifyTask(userMessage, language, session);
const providerOrder = TaskRouter.getOptimalProviderOrder(taskType, currentProviders);
console.log(`[Voice API] Task type: ${taskType} → Provider order: [${providerOrder.join(', ')}]`);
```

**Impact attendu** :
- Qualification leads : Claude (raisonnement structuré) au lieu de Grok (vitesse) → extraction BANT plus précise
- Support technique : Gemini (recherche KB longue) au lieu de Grok → réponses plus complètes
- Conversation : Grok reste premier (latence optimale) → pas de régression

**Tests à ajouter** :
- `test/task-router.test.mjs` — classification correcte pour chaque type
- Vérifier que le fallback fonctionne si le provider optimal échoue
- Benchmark latence avant/après

---

### T2. PARALLÉLISATION DES SOUS-TÂCHES (HAUTE)

**Pattern Perplexity** : Recherche + analyse + rédaction s'exécutent simultanément, pas séquentiellement.

**Problème VocalIA actuel** : `voice-api-resilient.cjs:1524-1659` — tout est **séquentiel** :
```
RAG search (1524) → await
  GraphRAG search (1542) → sync
    Order check (1555) → await
      CRM lookup (1572) → await
        Tenant memory (1588) → await
          Stock check (1602) → await
            Recommendation (1621) → await
              → PUIS AI call
```

7 étapes séquentielles avant l'appel AI. Chaque étape attend la précédente.

**Implémentation** : Identifier les tâches **indépendantes** et les paralléliser :

```javascript
// AVANT (séquentiel — ~7 awaits) :
const ragresults = await hybridRAG.search(...);   // ~200ms
const graphResults = KB.graphSearch(...);           // ~10ms (sync)
const order = await ECOM_TOOLS.checkOrderStatus(); // ~300ms
const customer = await CRM_TOOLS.lookupCustomer(); // ~200ms
const facts = await ContextBox.getTenantFacts();    // ~50ms
const stock = await ECOM_TOOLS.checkStock();        // ~300ms
// Total séquentiel : ~1060ms

// APRÈS (parallèle — 3 groupes) :
// Groupe 1 : Contexte (tous indépendants)
const [ragresults, graphResults, facts] = await Promise.all([
  hybridRAG ? hybridRAG.search(tenantId, language, userMessage, { limit: 3, geminiKey })
            .catch(e => { console.warn('[RAG]', e.message); return []; })
            : Promise.resolve(KB.search(userMessage, 3)),
  Promise.resolve(KB.graphSearch(userMessage, { tenantId })),
  ContextBox.getTenantFacts(tenantId, { limit: 10 })
    .catch(e => { console.warn('[Memory]', e.message); return []; }),
]);

// Groupe 2 : Enrichissement conditionnel (dépend du contexte)
const enrichmentPromises = [];
if (needsOrderCheck) enrichmentPromises.push(ECOM_TOOLS.checkOrderStatus(...).catch(() => null));
if (needsCrmLookup) enrichmentPromises.push(CRM_TOOLS.lookupCustomer(...).catch(() => null));
if (needsStockCheck) enrichmentPromises.push(ECOM_TOOLS.checkStock(...).catch(() => null));
const enrichments = await Promise.all(enrichmentPromises);
// Total parallèle : max(200, 10, 50) + max(300, 200, 300) ≈ 500ms (-53%)
```

**Impact attendu** : Latence pré-AI réduite de **~500ms** (de ~1060ms à ~500ms) soit **-53%**.

**Fichier** : `core/voice-api-resilient.cjs` lignes 1524-1659

**Tests** : Vérifier que chaque enrichissement se comporte identiquement (catch individuel, pas de blocage croisé)

---

### T3. QUALITY GATE POST-RÉPONSE (HAUTE)

**Pattern Perplexity** : L'orchestrateur agrège les résultats, **vérifie la cohérence**, et déploie seulement si OK.

**Problème VocalIA actuel** : `voice-api-resilient.cjs:1718-1730` — la réponse AI est **retournée telle quelle** sans vérification de pertinence :
```javascript
const content = response.text || response;
return { success: true, response: content, ... };
```

La seule vérification est `verifyTranslation()` (A2A supervision, ligne 1040) qui vérifie la **langue**, pas la **pertinence**.

**Implémentation** :

```javascript
// core/quality-gate.cjs — Nouveau module
// Quality Gate inspiré de l'agrégation Perplexity

function assessResponseQuality(response, originalQuery, ragContext, language) {
  const checks = [];
  let score = 100;

  // 1. Réponse vide ou trop courte
  if (!response || response.trim().length < 10) {
    checks.push({ check: 'min_length', passed: false, penalty: 50 });
    score -= 50;
  }

  // 2. Hallucination : la réponse invente des données non présentes dans le RAG
  //    Heuristique : si la réponse contient des chiffres/prix non trouvés dans ragContext
  const pricePattern = /(\d+)[€$]\s/g;
  const responsePrices = [...response.matchAll(pricePattern)].map(m => m[1]);
  const ragPrices = ragContext ? [...ragContext.matchAll(pricePattern)].map(m => m[1]) : [];
  const inventedPrices = responsePrices.filter(p => !ragPrices.includes(p));
  if (inventedPrices.length > 0) {
    checks.push({ check: 'price_hallucination', passed: false, penalty: 20, invented: inventedPrices });
    score -= 20;
  }

  // 3. Langue incorrecte (basique — la supervision A2A couvre déjà ça)
  // 4. Réponse hors-sujet : aucun mot-clé de la question dans la réponse
  const queryWords = originalQuery.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const responseWords = response.toLowerCase();
  const overlap = queryWords.filter(w => responseWords.includes(w));
  if (queryWords.length > 2 && overlap.length === 0) {
    checks.push({ check: 'off_topic', passed: false, penalty: 30 });
    score -= 30;
  }

  return {
    score: Math.max(0, score),
    passed: score >= 60,
    checks
  };
}

module.exports = { assessResponseQuality };
```

**Intégration** dans `getResilisentResponse()` après ligne 1718 :

```javascript
// Quality Gate — vérifier avant de retourner
const quality = QualityGate.assessResponseQuality(content, userMessage, ragContext, language);
if (!quality.passed) {
  console.warn(`[Voice API] Quality gate FAILED (score: ${quality.score}):`, quality.checks);
  // Ne pas retourner — continuer le fallback vers le provider suivant
  errors.push({ provider: provider.name, error: `Quality gate failed (score: ${quality.score})` });
  continue;
}
```

**Impact** : Réponses hors-sujet ou hallucinées sont interceptées et un meilleur provider est essayé.

---

### T4. RETRY INTELLIGENT PAR TYPE D'ERREUR (HAUTE)

**Pattern Perplexity** : Si un sous-agent échoue, un agent de dépannage est spawné (pas juste un fallback).

**Problème VocalIA actuel** : `voice-api-resilient.cjs:1731-1734` — toute erreur = **skip au provider suivant** :
```javascript
} catch (err) {
  errors.push({ provider: provider.name, error: err.message });
  console.log(`[Voice API] ${provider.name} failed:`, err.message);
}
```

Pas de distinction entre :
- **Timeout** (le provider est lent mais fonctionnel → retry avec timeout augmenté)
- **Rate limit 429** (temporaire → retry après backoff)
- **Erreur 500** (provider down → skip immédiat au suivant)
- **Réponse vide** (modèle confus → reformuler le prompt et retenter)

**Implémentation** :

```javascript
} catch (err) {
  const errType = classifyError(err);

  if (errType === 'timeout' && !retried) {
    // Retry une fois avec timeout doublé
    console.log(`[Voice API] ${provider.name} timeout — retrying with 2x timeout`);
    try {
      response = await callWithTimeout(providerKey, { ...opts, timeout: opts.timeout * 2 });
      retried = true;
      // Si succès, continuer normalement
    } catch (retryErr) {
      errors.push({ provider: provider.name, error: retryErr.message, retry: true });
    }
  } else if (errType === 'rate_limit') {
    // Backoff court (100ms) puis retry une fois
    await new Promise(r => setTimeout(r, 100));
    try {
      response = await callProvider(providerKey, ...);
    } catch (retryErr) {
      errors.push({ provider: provider.name, error: retryErr.message, retry: true });
    }
  } else {
    // Erreur fatale → skip au provider suivant
    errors.push({ provider: provider.name, error: err.message });
  }
}

function classifyError(err) {
  if (err.message?.includes('timeout') || err.code === 'ETIMEDOUT') return 'timeout';
  if (err.statusCode === 429 || err.message?.includes('rate limit')) return 'rate_limit';
  if (err.statusCode >= 500) return 'server_error';
  if (!err.statusCode) return 'network_error';
  return 'unknown';
}
```

**Impact** : Réduction des fallbacks inutiles. Un timeout Grok (courant sous charge) ne force plus le switch vers Gemini (plus lent).

---

### T5. PROFIL CLIENT ÉVOLUTIF ENRICHI (MOYENNE)

**Pattern Perplexity** : Mémoire persistante cross-session — fichiers, préférences, contexte projet évoluent.

**VocalIA actuel** : `ContextBox.cjs:228` stocke des facts atomiques (`extractKeyFact`), mais pas de **profil client agrégé** avec historique consolidé.

**Implémentation** : Enrichir `ContextBox` avec un profil client structuré :

```javascript
// Dans core/ContextBox.cjs — Nouvelle méthode
getClientProfile(tenantId, clientId) {
  const facts = this.getSessionFacts(clientId);
  const interactions = this._data.interactions?.[clientId] || [];

  return {
    clientId,
    tenantId,
    totalConversations: interactions.length,
    firstSeen: interactions[0]?.timestamp || null,
    lastSeen: interactions[interactions.length - 1]?.timestamp || null,
    knownBudget: facts.find(f => f.type === 'budget')?.value || null,
    knownTimeline: facts.find(f => f.type === 'timeline')?.value || null,
    productsInterested: facts.filter(f => f.type === 'product_interest').map(f => f.value),
    objectionsRaised: facts.filter(f => f.type === 'objection').map(f => f.value),
    objectionsResolved: facts.filter(f => f.type === 'objection_resolved').map(f => f.value),
    preferredLanguage: this._inferLanguage(interactions),
    leadScore: facts.find(f => f.type === 'lead_score')?.value || null,
    sentiment: this._inferSentiment(interactions),
    recommendedAction: this._inferAction(facts, interactions),
  };
}

_inferAction(facts, interactions) {
  const lastInteraction = interactions[interactions.length - 1];
  if (!lastInteraction) return null;

  const daysSinceLast = (Date.now() - lastInteraction.timestamp) / 86400000;
  const score = facts.find(f => f.type === 'lead_score')?.value || 0;

  if (score >= 70 && daysSinceLast > 2) return 'relance_whatsapp';
  if (score >= 40 && daysSinceLast > 7) return 'relance_email';
  if (score < 40) return 'nurturing';
  return 'monitor';
}
```

**Injection dans le prompt** (dans `getResilisentResponse()` après ligne 1593) :

```javascript
// Client Profile enrichi (si client connu)
let clientProfileContext = "";
if (session?.extractedData?.email || session?.extractedData?.phone) {
  const clientId = session.extractedData.email || session.extractedData.phone;
  const profile = ContextBox.getClientProfile(tenantId, clientId);
  if (profile.totalConversations > 1) {
    clientProfileContext = `\nCLIENT_PROFILE (returning customer):
- Conversations: ${profile.totalConversations} | Last: ${profile.lastSeen}
- Budget connu: ${profile.knownBudget || 'non renseigné'}
- Produits d'intérêt: ${profile.productsInterested.join(', ') || 'aucun'}
- Objections: ${profile.objectionsRaised.join(', ') || 'aucune'}
- Action recommandée: ${profile.recommendedAction}`;
  }
}
```

**Impact** : Conversations beaucoup plus personnalisées dès la 2ème interaction. Aligné avec la promesse "VocalIA mémorise et agit".

---

### T6. TOKEN BUDGET MANAGER PAR TENANT (MOYENNE)

**Pattern Perplexity** : Plafonds de dépenses configurables, gestion granulaire tokens par tâche.

**Problème VocalIA** : Aucun suivi du coût par tenant. Un tenant Starter (49€) peut consommer autant de tokens qu'un Expert Clone (149€).

**Implémentation** :

```javascript
// core/token-budget.cjs — Nouveau module

const PLAN_BUDGETS = {
  starter:    { monthlyTokens: 500_000,  alertAt: 0.8 },
  pro:        { monthlyTokens: 2_000_000, alertAt: 0.8 },
  ecommerce:  { monthlyTokens: 2_000_000, alertAt: 0.8 },
  expert:     { monthlyTokens: 5_000_000, alertAt: 0.8 },
  telephony:  { monthlyTokens: 10_000_000, alertAt: 0.8 },
};

class TokenBudgetManager {
  constructor(dataDir) {
    this._dataDir = dataDir;
    this._usage = {};  // tenantId → { month, inputTokens, outputTokens }
  }

  recordUsage(tenantId, inputTokens, outputTokens) {
    const month = new Date().toISOString().slice(0, 7);
    if (!this._usage[tenantId] || this._usage[tenantId].month !== month) {
      this._usage[tenantId] = { month, inputTokens: 0, outputTokens: 0 };
    }
    this._usage[tenantId].inputTokens += inputTokens;
    this._usage[tenantId].outputTokens += outputTokens;
  }

  checkBudget(tenantId, plan) {
    const budget = PLAN_BUDGETS[plan] || PLAN_BUDGETS.starter;
    const usage = this._usage[tenantId];
    if (!usage) return { allowed: true, remaining: budget.monthlyTokens };

    const totalUsed = usage.inputTokens + usage.outputTokens;
    const remaining = budget.monthlyTokens - totalUsed;
    const ratio = totalUsed / budget.monthlyTokens;

    return {
      allowed: remaining > 0,
      remaining: Math.max(0, remaining),
      percentUsed: Math.round(ratio * 100),
      alert: ratio >= budget.alertAt,
    };
  }
}

module.exports = { TokenBudgetManager, PLAN_BUDGETS };
```

**Intégration** : Avant l'appel AI dans `/respond`, vérifier le budget. Si dépassé → réponse dégradée (plus courte, modèle moins cher).

---

### T7. ENRICHISSEMENT RAG MULTI-SOURCE (BASSE) — ✅ DONE (Session 250.246)

**Pattern Perplexity** : 7 types de search simultanées (web, académique, people, image, vidéo, shopping, social).

**Application VocalIA** : Le Hybrid RAG cherchait uniquement dans la KB locale. Pour les tenants e-commerce, on enrichit maintenant avec des données produit live (prix, stock, description) depuis Shopify/WooCommerce.

**Implémentation** :

1. **`voice-ecommerce-tools.cjs`** — Nouveau export `searchProductsForRAG(query, tenantId, options)` :
   - Utilise le `CatalogConnector` existant (Shopify/WooCommerce/Custom)
   - Retourne des snippets RAG-compatibles (`{id, text, rrfScore, source}`)
   - Non-bloquant : retourne `[]` en cas d'erreur

2. **`voice-api-resilient.cjs`** — Intégré dans Phase 1 (Promise.all) :
   - Détecte automatiquement si le tenant a des credentials e-commerce (`SHOPIFY_ACCESS_TOKEN` ou `WOOCOMMERCE_URL`)
   - Exécute la recherche produit en parallèle avec RAG/TenantFacts/CRM
   - Résultats mergés dans `ragContext` avec préfixe `LIVE_PRODUCT_DATA`

```javascript
// Phase 1: 4 operations parallèles (ajout du 4ème)
const [ragRaw, tenantFactsRaw, crmRaw, liveProducts] = await Promise.all([
  // ... RAG, TenantFacts, CRM (existants) ...
  hasEcomCreds ? ECOM_TOOLS.searchProductsForRAG(userMessage, tenantId, { limit: 3 }) : [],
]);

// Merge dans ragContext
if (liveProducts.length > 0) {
  ragContext += '\n\nLIVE_PRODUCT_DATA (real-time):\n' + liveProducts.map(p => `[LIVE: ${p.id}] ${p.text}`).join('\n');
}
```

**Tests** : 6 tests dans `test/voice-ecommerce-tools.test.mjs` (export, graceful failure, limit, RAG format)

**Impact** : Réponses produit toujours à jour (prix, stock) au lieu de données KB potentiellement stale.

---

### ORDRE D'IMPLÉMENTATION RECOMMANDÉ

```
Phase 1 — Fondations (T1 + T2)          ≈ 1 session
├── T1: TaskRouter (routage dynamique)    → qualité réponses
├── T2: Promise.all (parallélisation)     → latence -53%
└── Tests : task-router.test.mjs + benchmark latence

Phase 2 — Fiabilité (T3 + T4)           ≈ 1 session
├── T3: QualityGate (vérification post)   → pertinence
├── T4: Retry intelligent                 → fiabilité
└── Tests : quality-gate.test.mjs + retry scenarios

Phase 3 — Intelligence (T5 + T6)        ≈ 1 session
├── T5: ClientProfile (mémoire enrichie)  → personnalisation
├── T6: TokenBudgetManager                → coûts prévisibles
└── Tests : client-profile.test.mjs + token-budget.test.mjs

Phase 4 — Enrichissement (T7)           ✅ DONE (250.246)
└── T7: RAG multi-source                  → précision e-com
```

**Résultat : 7 tâches complétées en 2 sessions (250.245-250.246). Toutes les tâches DONE.**

---

## 10. ANNEXES

### A. Sources Consultées

| Source | Type | Date | URL |
|:-------|:-----|:-----|:----|
| Blog officiel Perplexity | Primaire | 25/02/2026 | perplexity.ai/hub/blog/introducing-perplexity-computer |
| Fortune (CEO interview) | Primaire | 26/02/2026 | fortune.com/2026/02/26/perplexity-ceo-aravind-srinivas-computer-openclaw-ai-agent/ |
| Heise (technique) | Secondaire | 26/02/2026 | heise.de/en/news/Perplexity-AI-Agentic-AI-in-a-Sandbox-with-19-Models-11191317.html |
| TrendingTopics | Secondaire | 26/02/2026 | trendingtopics.eu/perplexity-computer-orchestrates-19-ai-models/ |
| AIGyani (review) | Indépendant | 26/02/2026 | aigyani.com/perplexity-computer-review/ |
| Substack (hands-on) | Indépendant | 26/02/2026 | karozieminski.substack.com/p/perplexity-computer-review-examples-guide |
| Finout (pricing) | Secondaire | 2026 | finout.io/blog/perplexity-pricing-in-2026 |
| SolidTiming | Secondaire | 2026 | solidtiming.co/perplexity-computer-unified-ai-platform/5352/ |
| Doc locale 1 | Utilisateur | 2026 | Rapport Stratégique — Perplexity Computer vs OpenClaw |
| Doc locale 2 | Utilisateur | 2026 | Guide de Flux de Travail — Perplexity Computer |
| Doc locale 3 | Utilisateur | 2026 | Stratégie d'Orchestration — Perplexity Computer |

### B. Glossaire

| Terme | Définition |
|:------|:-----------|
| **Routage dynamique** | Sélection automatique du meilleur modèle IA pour chaque sous-tâche |
| **Sous-agent** | Instance IA spécialisée spawned par l'orchestrateur pour une tâche spécifique |
| **Sandbox** | Environnement d'exécution isolé (conteneur cloud) avec FS et browser |
| **Quality Gate** | Vérification automatique de la qualité/pertinence avant de retourner une réponse |
| **BANT** | Budget, Authority, Need, Timeline — framework de qualification de leads |
| **RRF** | Reciprocal Rank Fusion — algorithme de fusion des résultats BM25 + embeddings |
| **Comet** | Navigateur IA agentique développé par Alex Graveley (agentic browsing) |
| **Fallback séquentiel** | Architecture où les providers sont essayés un par un dans un ordre fixe |
| **Fallback par compétence** | Architecture où le provider est sélectionné selon le type de tâche |

### C. Métriques de Référence VocalIA (État Actuel)

| Métrique | Valeur | Source |
|:---------|:-------|:-------|
| Latence moyenne Grok | ~800ms | `recordLatency()` production |
| Latence moyenne Gemini | ~1200ms | `recordLatency()` production |
| Fallback rate | Non mesuré | À instrumenter |
| Taux de qualification leads | Non mesuré | À instrumenter |
| Tokens/conversation moyenne | Non mesuré | T6 résoudra |
| Tests | 7003+/7003+ pass | `npm test` |
| Providers configurés | 4 (Grok, Gemini, Claude, Atlas) | `getProviderConfig()` |
| Personas | 40 × 5 langues | `voice-persona-injector.cjs` |

---

*Document généré le 27/02/2026 — Session 250.245*
*Basé sur des données factuelles vérifiées. Les 12 modèles non identifiés de Perplexity Computer ne sont pas spéculés.*
