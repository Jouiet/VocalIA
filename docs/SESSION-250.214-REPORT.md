# VocalIA — Rapport Strategique et Suivi d'Implementation

> **Origine**: Session 250.214 (15/02/2026) | **Derniere MAJ**: 250.217 (16/02/2026)
> **Role**: Document de suivi des implementations UI/UX dev→commercial + decisions strategiques
> **Tests**: ~6,233 pass, 0-1 fail intermittent (94 .mjs, B52 Node.js bug) | **Timeout**: 180s

---

## 1. Positionnement Strategique — Pourquoi ces 4 Features

### 1.1 Le Probleme

VocalIA a un backend complet (voice-api-resilient, 25 function tools, 38 personas, 5 langues, GA4 52 events, sessions avec latency tracking) mais **ne montre rien de cette puissance au client**. Le dashboard analytics est une page de charts basiques. Le pricing est statique. Le KB dashboard est un CRUD sans feedback.

Les concurrents directs exploitent deja ce levier:

| Concurrent | Ce qu'il montre | Impact commercial |
|:-----------|:---------------|:-----------------|
| **BuddyPro** | "1,167% ROI first year" + ROI Calculator | Conversion pre-achat — le prospect se dit "ca vaut le coup" |
| **BuddyPro** | "Knowledge Quality Score" | Retention — gamification onboarding, client enrichit sa KB |
| **YourAtlas** | "300% more conversions" + attribution | Retention — client voit la preuve de valeur, renouvelle |
| **YourAtlas** | "60 second engagement" + speed metrics | Confiance — client voit que l'IA est plus rapide qu'un humain |

VocalIA avait les donnees mais pas la vitrine. **Ces 4 features sont la vitrine.**

### 1.2 L'Effet Compose (Funnel de Valeur)

```
ACQUISITION (pricing.html)
  ROI Calculator Interactif
    → Prospect entre ses parametres
    → Voit: "Economie 32,000 EUR/an"
    → Clique "Commencer maintenant"
    → Signup

ONBOARDING (knowledge-base.html)
  KB Quality Score
    → Nouveau client voit "Score: 15/100 — Bronze"
    → Veut atteindre Gold/Platinum
    → Enrichit sa KB (ajoute FAQ, multilingue, details)
    → IA plus performante → conversations de meilleure qualite

CONFIANCE (analytics.html)
  Speed Metrics
    → Client voit "Temps moyen: 340ms" + "SLA 97%"
    → Compare mentalement: "Mon equipe met 2 minutes a repondre"
    → Satisfaction → reste abonne

RETENTION (analytics.html)
  Revenue Attribution
    → Client voit "142 conversations → 23 intents → 8 bookings → 5.6% conversion"
    → Preuve tangible que VocalIA genere du business
    → Justifie le renouvellement aupres de son manager/budget
    → Lifetime Value augmente

RESULTAT: 4 features × 4 etapes du cycle client = couverture complete du funnel
```

Ce funnel est EXACTEMENT ce que BuddyPro et YourAtlas font. VocalIA le fait maintenant aussi.

---

## 2. Analyse Concurrentielle Feature-par-Feature

### 2.1 ROI Calculator — Vs BuddyPro "1,167% ROI"

**Ce que BuddyPro fait**: Affiche un chiffre ROI enorme ("1,167%") sur sa landing page. C'est un claim marketing base sur un cas client.

**Ce que VocalIA fait maintenant**: Calculateur INTERACTIF — le prospect entre SES propres parametres:
- Nombre d'agents support actuels (1-10)
- Tickets/jour (10-200)
- Cout horaire agent (15-60 EUR)

Le calcul se fait en temps reel, avec la geo-currency du visiteur (EUR/USD/MAD).

**Avantage VocalIA**:
- BuddyPro affiche UN chiffre generique. VocalIA montre le chiffre DU prospect.
- Le prospect ne peut pas se dire "oui mais chez moi c'est different" — c'est CALCULE avec ses donnees.
- Geo-currency automatique: un prospect marocain voit MAD, un francais voit EUR.

**Limitations honnetes**:
- Le taux d'automatisation de 70% est une hypothese — pas de donnees empiriques VocalIA (0 paying clients, 0 conversations reelles). BuddyPro a probablement aussi un taux hypothetique mais le masque derriere un cas client.
- Disclaimer affiche: "* Estimation basee sur un taux d'automatisation de 70% et 5 min/ticket."
- Le calcul n'integre pas les couts indirects (formation, recrutement, turnover) qui augmenteraient le ROI reel.

### 2.2 KB Quality Score — Vs BuddyPro "Knowledge Quality Score"

**Ce que BuddyPro fait**: Score de qualite de la knowledge base avec recommandations.

**Ce que VocalIA fait maintenant**: Score 0-100 avec 4 criteres ponderes (25 pts chacun):

| Critere | Mesure | Logique |
|:--------|:-------|:--------|
| Nombre d'entrees | count → scale 0-25 | 30+ entrees = score max |
| Couverture langues | fetch async 5 langues | 5/5 langues = 25 pts |
| Profondeur | % entrees avec JSON structure | Details > simple string = +qualite |
| Categories cles | 5 groupes semantiques | livraison, retours, paiement, horaires, FAQ |

+ Badges Bronze/Silver/Gold/Platinum + SVG ring anime + Recommandations actionables cliquables

**Avantage VocalIA**:
- BuddyPro a probablement un score similaire. VocalIA a l'avantage de la couverture multilingue (5 langues, dont Darija — unique au marche).
- Les recommandations sont ACTIONABLES: un clic ouvre le modal d'ajout pre-rempli.
- Le score pousse le client a enrichir sa KB dans les 5 langues, ce qui ameliore directement la qualite des reponses IA (BM25 search sur les chunks multilingues).

**Limitation honnete**: 0 paying clients = impossible de valider que le score correle avec la satisfaction client ou la qualite des reponses IA.

### 2.3 Speed Metrics — Vs YourAtlas "60 second engagement"

**Ce que YourAtlas fait**: Met en avant "60 second engagement" — temps d'engagement moyen.

**Ce que VocalIA fait maintenant**: 4 KPIs de performance vocale dans le dashboard analytics:

| KPI | Source | Signification |
|:----|:-------|:-------------|
| Temps de reponse moyen | `session.avg_latency_ms` | Latence IA moyenne du mois |
| P95 Latence | 95e percentile | Pire cas (hors outliers) |
| Taux SLA (<800ms) | % sessions sous 800ms | SLA existant dans voice-api-resilient.cjs:705 |
| Uptime | jours avec sessions / jours du mois | Proxy de disponibilite |

+ Chart latence 7 jours (Chart.js line chart)

**Avantage VocalIA**:
- YourAtlas affiche UN chiffre marketing. VocalIA montre les metriques REELLES du tenant, calculees depuis SES sessions.
- Le seuil SLA 800ms est un standard verifiable (deja code dans le backend).
- P95 est une metrique professionnelle (SRE standard) — positionne VocalIA comme un produit enterprise.

**Limitation honnete**: Les sessions EXISTANTES n'ont pas `avg_latency_ms`. Seules les nouvelles sessions post-deploy l'auront. Le dashboard affichera "--ms" pour l'historique. Implementation backend = 3 lignes seulement:
```javascript
session.latency_total = (session.latency_total || 0) + result.latencyMs;
session.latency_count = (session.latency_count || 0) + 1;
session.avg_latency_ms = Math.round(session.latency_total / session.latency_count);
```

### 2.4 Revenue Attribution — Vs YourAtlas "300% conversions"

**Ce que YourAtlas fait**: Claim "300% more conversions" base sur des cas clients.

**Ce que VocalIA fait maintenant**: Funnel d'attribution dans le dashboard analytics:

```
Conversations totales → Intents produit → Bookings → Taux conversion %
```

+ Top 3 personas par taux de conversion (progress bars visuelles)

**Comment ca marche**:
- Intent produit = sessions avec `status hot/warm` (qualification BANT) ou `lead_score > 0`
- Booking = sessions avec `booking_completed` ou (`status completed` ET `duration > 60s`)
- Session_id dans les events GA4 widget (nouvelle ligne ajoutee a `trackEvent()`)

**Avantage VocalIA**:
- YourAtlas dit "300% conversions" sans montrer les donnees. VocalIA montre le funnel REEL du tenant avec SES chiffres.
- Le top 3 personas montre QUEL persona convertit le mieux — permet au client d'optimiser.

**Limitations honnetes**:
- **PAS de Stripe**: Le "revenue" est un proxy base sur bookings et lead scores, PAS du vrai revenu financier. Quand Stripe sera connecte, le revenue attribution deviendra reel.
- La detection booking via `duration > 60s` est un heuristique imprecis (B41 ouvert).
- L'attribution session_id → GA4 events n'est exploitable que si le client configure une integration GA4 cote serveur.

---

## 3. Vision Strategique — 4 Features comme Fondation des Mouvements Identifies dans l'Audit

> Ref: `~/Desktop/AUDIT-OUTILS-IA-3A-VOCALIA-CINEMATICADS.md` (1248 lignes, 13 outils audites, 15/02/2026)

Les 4 features ne sont pas des "widgets dashboard". Ce sont les **fondations techniques** des mouvements strategiques identifies dans l'audit concurrentiel. Chaque feature active un levier specifique.

### 3.1 ROI Calculator → Repositionnement Pricing (Audit §11.2)

**Constat audit**: "VocalIA est probablement sous-price de 3-5x par rapport au marche" (ligne 591). Your Atlas cible ~$300-1000+/mois. Le pricing actuel (€49-199) est calibre pour un MVP, pas pour une plateforme a 38 personas × 5 langues × 203 MCP tools.

**Proposition audit** (ligne 1008-1015):

| Tier | Prix actuel | Prix recommande | Delta |
|:-----|:----------:|:---------------:|:-----:|
| Starter | €49/mois | €99/mois | ×2 |
| Professional | €99/mois | €249/mois | ×2.5 |
| Enterprise | €199/mois | €599/mois | ×3 |
| Expert Clone | — | €149/mois | Nouveau |

**Probleme**: On ne peut PAS doubler les prix sans PROUVER la valeur. Un prospect qui voit "€249/mois" sans justification ferme l'onglet.

**Ce que le ROI Calculator active**: Le prospect entre SES parametres et voit "Economie: 32,000 EUR/an". Le prix de €249/mois (2,988 EUR/an) devient une evidence face a l'economie calculee. Le calculateur **neutralise l'objection prix** avant meme qu'elle se forme.

**Argumentaire chiffre integrable** (audit ligne 1019-1030):
```
Receptionniste humain (Maroc) : ~5,000 MAD/mois (~460 EUR)
  → 176h/mois (8h × 22j), ~15 appels/h = 2,640 appels max

VocalIA Professional : 249 EUR/mois
  → 720h/mois (24h × 30j), ~60 appels/h = 43,200 appels max
  → 16× plus de capacite pour 54% du cout
```

**Sequence**: ROI Calculator (conviction) → Prix repositionne → ARPU ×2.5 → Revenue sans plus de clients.

### 3.2 KB Quality Score → Tier "Expert Clone" (Audit §6.2)

**Constat audit**: BuddyPro vend le concept "Digital Twin" — l'expert uploade sa knowledge, BuddyPro cree un clone text, les clients de l'expert paient un abonnement, BuddyPro prend une commission (ligne 595-622).

**Modele Expert Clone transpose a VocalIA** (audit ligne 612-622):
1. L'expert uploade sa knowledge (voix, docs, formations)
2. VocalIA cree un persona voice dedie (via ElevenLabs voice cloning, deja integre)
3. L'expert definit des tiers de prix (Basic €29/mo, Pro €79/mo)
4. Les clients de l'expert interagissent via widget voice ou telephone
5. VocalIA collecte via `StripeService.cjs` (deja dans le code) et prend 15-20%
6. `ConversationLearner` ameliore le clone au fil du temps

**Revenue potentiel audit**: 10 experts × 50 clients × €49/mo = €24,500/mo dont 15% = **€3,675/mo pour VocalIA** (ligne 622).

**Probleme**: Ce modele NECESSITE que la KB soit de haute qualite. Un Expert Clone avec une KB a "15/100" donne des reponses mediocres → clients de l'expert insatisfaits → churn.

**Ce que KB Quality Score active**: Le score gamifie force l'expert a enrichir sa KB (Bronze→Silver→Gold→Platinum). Les recommandations actionables ("Ajoutez des reponses en anglais", "Enrichissez avec des details structures") guident l'expert vers une KB qui produit des reponses de qualite. **Sans KB Quality Score, Expert Clone echoue silencieusement.**

**Sequence**: KB Quality Score (qualite) → Expert enrichit sa KB → Clone performant → Clients satisfaits → Abonnements → Revenue recurring.

### 3.3 Revenue Attribution → RevShare + Cross-Sell (Audit §8 + §11.4)

**Constat audit RevShare** (§8): Le RevShare est un "outil de vente cible" — le client ne paie qu'un % du revenu genere. Mais il requiert une **attribution mesurable** (ligne 725): "Prouver QUE l'automation a genere le revenu (pas une correlation, une causalite)."

**Verdict audit pour VocalIA** (ligne 813): "Agents vocaux — Attribution appels→ventes indirecte. Tres difficile."

**Ce que Revenue Attribution active**: Le funnel Conversations→Intents→Bookings→Conversion% est la **premiere brique d'attribution**. Aujourd'hui c'est un proxy (lead_score, booking count). Quand Stripe sera connecte:
- `booking_completed` → montant reel Stripe
- Le funnel devient: Conversations → Intents → Bookings → **Revenue EUR/USD/MAD**
- Attribution devient MESURABLE → RevShare devient viable

**Constat audit Cross-Sell** (§11.4 ligne 1108-1166): Les 3 projets (3A, VocalIA, CinematicAds) sont en silos. 4 integrations techniques identifiees:

| Integration | De → Vers | Mecanisme | Effort |
|:------------|:----------|:----------|:------:|
| Lead scoring → Voice | 3A → VocalIA | Webhook: lead score >70 → appel sortant VocalIA | 2 jours |
| Video → Email | CinematicAds → 3A | Webhook: video produite → insertion flow Klaviyo | 1 jour |
| Voice transcript → Content | VocalIA → CinematicAds | Pattern extractor → brief video | 3 jours |
| Shared tenant registry | Tous | Client ID unifie + credential vault partage | 1 sem |

**Ce que Revenue Attribution active pour le Cross-Sell**: Quand un client VocalIA voit "142 conversations → 8 bookings → 5.6% conversion" dans son dashboard, c'est la **preuve quantifiee** que VocalIA genere du business. Cette preuve:
1. Justifie le renouvellement VocalIA
2. Ouvre la porte au pitch: "Vos leads qualifies par VocalIA peuvent etre nurtures par email (3A) et video (CinematicAds)"
3. Permet le bundle pricing (audit ligne 1153-1157): E-commerce Growth = 3A + VocalIA = 199 EUR/mois (-20%)

**Sequence**: Revenue Attribution (preuve) → Client convaincu → Cross-sell 3A/CinematicAds → Revenue par client ×2-3.

### 3.4 Speed Metrics → Positionnement "Agent qui ne dort jamais" (Audit §11.2)

**Constat audit** (ligne 990): Your Atlas utilise "Your AI agent never sleeps". L'audit recommande: "Page d'accueil VocalIA: Votre expert vocal qui ne dort jamais."

**Vocabulaire marketing identifie** (audit ligne 988-997):

| Terme audit | Application VocalIA |
|:------------|:-------------------|
| "Agent qui ne dort jamais" | Hero section homepage |
| "Disponible 24/7 sans humeur" | Messaging sous le ROI Calculator |
| "100× plus d'appels sans recrutement" | KPI page pricing |
| "Cout marginal quasi nul" | Argument enterprise |

**Probleme**: Ces claims DOIVENT etre etayes. "24/7 sans humeur" n'est credible que si le client VOIT les metriques de performance.

**Ce que Speed Metrics active**: Le dashboard montre "Temps moyen: 340ms" + "SLA 97% (<800ms)" + "Uptime: 29/30 jours". Le claim "ne dort jamais" est **verifie empiriquement par le client lui-meme** — pas un chiffre marketing generique.

**Sequence**: Speed Metrics (transparence) → Claim "24/7" etaye → Confiance enterprise → Tier Enterprise a €599/mois viable.

### 3.5 Pipeline Voice→SOP — Integration Future (Audit §11.3)

L'audit identifie un **USP unique** que ni Your Atlas ni BuddyPro ne propose (ligne 1098-1101):

> "VocalIA apprend de chaque conversation pour ameliorer automatiquement la base de connaissances (avec validation humaine)."

**Architecture verifiee** (audit ligne 1038-1095):
```
EXISTANT:
  VocalIA conversation-store → donnees brutes (protegees)
  3A ConversationLearner → extraction patterns
  3A KBEnrichment → injection KB
  3A Learning Queue → HITL validation

MANQUANT:
  pattern-extractor.cjs (VocalIA) → extraction anonymisee
  Webhook VocalIA → 3A (pont)
```

**Connexion avec les 4 features**:
- KB Quality Score MESURE la qualite AVANT et APRES l'enrichissement automatique
- Revenue Attribution PROUVE que la KB enrichie genere plus de conversions
- Speed Metrics MONTRE que les reponses restent rapides meme avec une KB plus large

**Effort**: ~1 semaine. **Prerequis**: Consentement explicite du tenant + Stripe live (pour que le RevShare soit mesurable).

---

### 3.6 Matrice Concurrentielle Complete

#### Features de Conversion/Retention

| Feature | VocalIA | BuddyPro | YourAtlas | Intercom | Crisp |
|:--------|:-------:|:--------:|:---------:|:--------:|:-----:|
| ROI Calculator interactif | **OUI** | OUI (statique) | NON | NON | NON |
| KB Quality Score | **OUI** | OUI | NON | NON | NON |
| Speed Metrics dashboard | **OUI** | OUI (basique) | OUI (claim) | NON | NON |
| Revenue Attribution | **OUI** (proxy) | NON | OUI (claim) | Partiel | NON |
| Expert Clone tier | PRET (infra) | **OUI** (live) | NON | NON | NON |
| Voice→SOP pipeline | PRET (archi) | NON | NON | NON | NON |
| Geo-currency automatique | **OUI** (EUR/USD/MAD) | USD only | USD only | Multi | NON |
| 5 langues native | **OUI** | NON | NON | Via plugin | Auto-translate |
| Darija native | **OUI** | NON | NON | NON | NON |
| 38 personas metier | **OUI** | <10 | <10 | NON | NON |
| 203 MCP tools | **OUI** | 0 | 0 | NON | NON |
| Voice cloning (ElevenLabs) | **OUI** | NON | NON | NON | NON |

#### Avantages Structurels

| Avantage | Status | Ref audit |
|:---------|:-------|:----------|
| Voice-first (pas text-first avec voice ajoute) | Impossible a copier rapidement | §6.2 ligne 603 |
| Darija native (seule plateforme au monde) | Monopole de fait | §6.2 ligne 589 |
| 38 personas × 5 langues = 190 prompts | 10× plus que tout concurrent | §6.2 ligne 572 |
| Tout-inclus (LLM+STT+TTS+PSTN+personas+analytics) | Vs Vapi/Retell qui facturent chaque composant | §6.2 |
| Grok $0.05/min (LLM+STT+TTS en un prix) | Avantage cout structurel | §6.2 ligne 587 |
| Sous-price de 3-5× | Marge de repositionnement | §6.2 ligne 591 |

#### Ce que les Concurrents ont et VocalIA n'a PAS

| Feature manquante | Impact | Bloqueur | Ref audit |
|:------------------|:-------|:--------:|:----------|
| Stripe integration | CRITIQUE — 0 revenue sans ca | BLOQUANT | §6.2 ligne 606 |
| Expert Clone tier (monetisation expert) | BuddyPro l'a, VocalIA non | Stripe requis | §6.2 ligne 612 |
| RevShare contractuel | Outil de vente pour gros comptes | Attribution + Stripe | §8 ligne 813 |
| Help center/KB public | Intercom/Crisp y sont habitues | MED | — |
| WhatsApp/Messenger | Code existe, pas deploye | MED | — |
| Shared inbox multi-agent | Enterprise feature | LOW | — |

---

## 4. Implementation Technique — Resume

### 4.1 Fichiers Modifies (10 fichiers + 8 blog/page)

| # | Fichier | Feature | Changements |
|:-:|:--------|:--------|:------------|
| 1 | `website/app/client/knowledge-base.html` | KB Quality Score | +section score SVG, calcul, recommandations |
| 2 | `website/pricing.html` | ROI Calculator | +section calculateur interactif, 3 sliders |
| 3 | `website/app/client/analytics.html` | Speed + Revenue | +section Performance, +section Attribution |
| 4 | `core/voice-api-resilient.cjs` | Speed Metrics | +3 lignes accumulation latence dans session |
| 5 | `widget/voice-widget-v3.js` | Revenue Attribution | +session_id dans trackEvent |
| 6-10 | `website/src/locales/{fr,en,es,ar,ary}.json` | Toutes | +~40 cles × 5 langues |

### 4.2 Backend — 4 Lignes Seulement

Le choix architectural est delibere: **maximum de valeur, minimum de risque**.

- 3 lignes dans `voice-api-resilient.cjs` (accumulation latence dans session)
- 1 ligne dans `widget/voice-widget-v3.js` (session_id dans trackEvent)
- 0 nouvelle route API, 0 nouveau endpoint, 0 migration de donnees
- Tout le reste est client-side, calcule depuis les donnees deja disponibles

---

## 5. Bugs — Tableau Factuel Mis a Jour

| # | ID | Severite | Fichier | Bug | Statut |
|:-:|:--:|:--------:|:--------|:----|:------:|
| 1 | **B38** | **MED** | `pricing.html` | ROI Calculator: slider "Tickets/jour" pas utilise dans le calcul | **CORRIGE** — `hoursNeeded = Math.min(agents * 160, (tickets * 5/60) * 22)` |
| 2 | **B39** | **LOW** | `pricing.html` | ROI Calculator: aucun disclaimer | **CORRIGE** — `roi.disclaimer` × 5 langues |
| 3 | **B40** | **INFO** | `analytics.html` | Sessions historiques sans `avg_latency_ms` → "--ms" | **BY DESIGN** |
| 4 | **B41** | **HIGH** | `voice-api-resilient.cjs` + `analytics.html` | Detection booking via `duration > 60s` est imprecis | **CORRIGE** (250.215) — `session.booking_completed = true` + `status === 'hot' && qualificationComplete` |
| 5 | **B42** | **LOW** | `knowledge-base.html` | 4 requetes API paralleles pour couverture langues | **OUVERT** |
| 6 | **B43** | **MED** | 15 fichiers | "gratuit/free trial" dans CTA, FAQ, meta, signup, blogs | **CORRIGE** — 27 instances nettoyees |
| 7 | **B44** | **HIGH** | `test/remotion-hitl.test.mjs` | Queue file 17,742+ items, 7 failures intermittentes | **CORRIGE** (250.215) — before()/after() backup/restore |
| 8 | **B45** | **MED** | `test/auth-service.test.mjs` | 8 fonctions auth-service jamais testees | **CORRIGE** (250.215) — +18 tests comportementaux |
| 9 | **B47** | **MED** | `test/db-api-routes.test.mjs` | db-api-routes drain insuffisant | **CORRIGE** (250.215b) — closeAllConnections() + longer drain |
| 10 | **B48** | **LOW** | 5 locales + 2 HTML | 3 cles i18n "gratuit" misleading | **CORRIGE** (250.215b) — renommees |
| 11 | **B49** | **MED** | `test/client-lib.test.mjs` | 20 client-side JS avec 0 tests | **CORRIGE** (250.215b) — +53 tests |
| 12 | **B50** | **HIGH** | `pricing.html` | ANNUAL_DISCOUNT undefined crashed ROI calc | **CORRIGE** (250.216) |
| 13 | **B51** | **HIGH** | Dashboard pages | t(key, string) corrupted {{name}} templates | **CORRIGE** (250.216) |
| 14 | **B52** | **MED** | `core/db-api.cjs` | IPC deserialization intermittent (Node.js test runner bug) | **PARTIEL** (250.216b) — signal handlers fixed, core Node.js bug OPEN |

### B43 — Nettoyage "gratuit/free" (Detail)

**Probleme**: Le mot "gratuit/free" apparaissait dans 15 fichiers pour decrire le trial, les demos, et les CTA. Positionnement incompatible avec une startup premium.

**Correction**: 27 instances remplacees dans:
- ROI CTA: "Commencer l'essai gratuit" → "Commencer maintenant" (5 langues)
- Pricing FAQ: "essai gratuit" → "periode d'essai" (5 langues + HTML fallback)
- Pricing subtitle: "free trial" → "trial" (EN, ES, ARY)
- Signup subtitle: "gratuit" → "Deployez votre assistant vocal IA en minutes" (5 langues + HTML)
- Signup meta: "Essai gratuit" → "Essai" (HTML)
- Blog keys: `essai_gratuit_4`, `un_compte_vocalia_33`, `puisje_tester_vocalia_5`, `crez_votre_compte_9`, `form_submit` (10+ cles × langues)
- booking.html: 6 instances meta/og/twitter/schema
- 4 articles de blog: CTA buttons et textes

**Instances conservees (justifiees)**:
- "livraison gratuite" = feature e-commerce (seuil livraison dans le panier)
- "Web Speech API (navigateur, gratuit)" = fait technique (API navigateur)
- "Annulation gratuite" = politique de cancellation booking
- Noms de cles internes (`gratuit_0_95`, `gratuit_44`) — pas visibles utilisateur, valeurs = "Starter"

---

## 6. Couverture de Test

### 6.1 Etat actuel
- **6,152 tests pass, 0 fail** (91 .mjs, 180s timeout)
- **221/221 fonctions exportees testees comportementalement** (100%)
- **0 regression** introduite par cette session

### 6.2 Lacunes introduites

| Lacune | Testable? | Priorite |
|:-------|:---------:|:--------:|
| Latency accumulation (voice-api-resilient.cjs, 3 lignes backend) | **OUI** | MED |
| `computeKBQualityScore()` (inline HTML) | Non sans extraction | LOW |
| `renderSpeedMetrics()` (inline HTML) | Non sans extraction | LOW |
| `renderAttribution()` (inline HTML) | Non sans extraction | LOW |
| `trackEvent` session_id (widget, 1 ligne) | Non (pas de test unitaire existant) | LOW |

---

## 7. Plan d'Action — Suivi d'Implementation

> Mis a jour: 16/02/2026 — Session 250.216b

### 7.0 Decisions Utilisateur (250.216b)

| Decision | Statut |
|:---------|:------:|
| Expert Clone tier | **APPROUVE** |
| Changement pricing (€49→€99, etc.) | **EXCLU** — pas de changement |
| Cross-sell bundles (3A+VocalIA) | **EXCLU** — sera implemente par devs 3A Automation |
| RevShare contractuel | **EXCLU** |
| Document UI/UX Conversion | **EXCLU** — ce document sert de suivi |

### 7.1 FAIT — Jargon Purge L1+L2 (250.216b)

| # | Action | Statut | Detail |
|:-:|:-------|:------:|:-------|
| 1 | **Layer 1**: termes purement techniques | **FAIT** | 133 changes, 18 files (PSTN/JWT/MCP/Webhook/CSP/SRI/CORS/TLS) |
| 2 | **Layer 2**: termes semi-techniques | **FAIT** | ~220 changes, 18 files (BANT/RAG/Shadow DOM/GA4/Fallback/Carousel/A2UI) |
| 3 | Verification grep residuel | **FAIT** | ZERO match sur pages cibles |
| 4 | Tests i18n+config | **FAIT** | 519/519 pass |

### 7.2 Bloquant Production

| # | Action | Priorite | Effort | Statut |
|:-:|:-------|:--------:|:------:|:------:|
| 1 | **Stripe integration** | CRITIQUE | Multi-session | TODO |
| 2 | **Premier paying customer** | CRITIQUE | Business | TODO |

### 7.3 UI/UX Gaps — Implementation (~2h total) ✅ DONE (250.217)

| # | Action | Page | Effort | Statut |
|:-:|:-------|:-----|:------:|:------:|
| 1 | Section "Receptionniste humain vs VocalIA" (comparaison chiffree) | `pricing.html` | 30min | **FAIT** (250.217) |
| 2 | Matrice concurrentielle visuelle (2 tables: Voice AI + Engagement Client) | `features.html` | 1h | **FAIT** (250.217) |
| 3 | Vocabulaire marketing: "100× plus d'appels", "Jamais fatigue", "Cout marginal quasi nul" | `index.html` | 30min | **FAIT** (250.217) |
| 4 | Social proof avec chiffres concrets en langage client | `index.html` | 20min | **FAIT** (250.217) |
| 5 | i18n × 5 langues (FR/EN/ES/AR/ARY) pour gaps 1-4 | tous locales | 30min | **FAIT** (250.217) |

### 7.4 Expert Clone — Nouveau Tier (~1 semaine)

> Ref: §3.2 ci-dessus + Audit §6.2 lignes 595-622

| # | Action | Effort | Statut |
|:-:|:-------|:------:|:------:|
| 1 | Page produit Expert Clone (pricing + landing) | 2h | TODO |
| 2 | Persona voice dedie (ElevenLabs voice cloning flow) | 1j | TODO |
| 3 | Dashboard expert (KB score + revenue attribution par client) | 1j | TODO |
| 4 | Billing: tier Expert Clone dans StripeService.cjs | 1j | TODO — requiert Stripe |
| 5 | ConversationLearner integration (amelioration continue) | 1j | TODO |
| 6 | i18n Expert Clone × 5 langues | 2h | TODO |

### 7.5 Post-Stripe

| # | Action | Impact | Statut |
|:-:|:-------|:-------|:------:|
| 1 | Revenue Attribution reel (booking → montant Stripe) | HIGH | Lie a Stripe |
| 2 | Expert Clone monetisation (15-20% commission) | HIGH | Lie a Stripe |
| 3 | WhatsApp/Messenger deploy | MED | Code existe |
| 4 | Help center/KB public | MED | — |

---

## 8. Verification Empirique

```
Tests:          6,152 pass / 0 fail / 0 skip (91 .mjs, 180s)
Validator:      10 errors (ALL STALE_NUMBER false positives from KB test data)
                19 warnings (16 Slack hex + 1 widget version + 2 telephony fee)
                0 errors liees a cette session

Fichiers:       10 (features) + 8 (nettoyage gratuit) = 18 fichiers modifies
Backend:        4 lignes (3 latency + 1 session_id)
Frontend:       ~370 lignes
i18n:           ~40 cles × 5 langues = ~200 traductions
Nettoyage:      27 instances "gratuit/free" supprimees dans 15 fichiers
Bugs:           6 identifies, 3 corriges, 2 low ouverts, 1 by design
```

---

## 9. Session 250.215 — Suite et Corrections

> **Date**: 2026-02-16 | **Tests**: 6,124 pass, 0 fail (92 .mjs) | **Timeout**: 300s

### 9.1 Bugs Corriges

| ID | Fichier | Bug | Severite | Fix |
|:---|:--------|:----|:---------|:----|
| **B41** | `voice-api-resilient.cjs` + `analytics.html` | Booking detection imprecise (`duration > 60s` proxy) | HIGH | Backend: `session.booking_completed = true` flag. Frontend: `status === 'hot' && qualificationComplete` |
| **B44** | `test/remotion-hitl.test.mjs` | Queue file 17,742+ items, 7 failures intermittentes en full suite | HIGH | `before()/after()` hooks: backup → queue vide → restore |
| **B45** | `test/auth-service.test.mjs` | 8 fonctions auth-service jamais appelees dans les tests | MEDIUM | +18 tests comportementaux avec mock DB |

### 9.2 Tests Ajoutes

- **+12 tests** voice-api: latency accumulation (6) + booking detection (6)
- **+18 tests** auth-service: refreshTokens, requestPasswordReset, resetPassword, changePassword, verifyEmail, resendVerificationEmail, getCurrentUser, updateProfile
- **Total**: 6,026 → 6,124 (+98 tests nets, incluant les 40 remotion-hitl non-flaky)

### 9.3 Autres Actions

- Widget DRIFT fixe (2 bundles rebuilds)
- Hero subtitle aligne avec audit concurrentiel §11.2 ("expert vocal qui ne dort jamais") × 5 langues
- CSS rebuilde

### 9.4 Verification Empirique

```
Tests:          6,124 pass / 0 fail / 0 skip (92 .mjs)
Validator:      10 errors (ALL STALE_NUMBER false positives from KB test data)
Widgets:        8/8 in sync
CSS:            Tailwind v4.1.18 build OK
Full suite:     0 intermittent failures (vs 7 avant B44 fix)
```

---

---

## 10. Session 250.218 — VocalIA Actions (Connexions Temps Reel)

> **Date**: 2026-02-17 | **Tests**: ~6,233 pass, 0-1 fail intermittent (B52) | **Timeout**: 180s

### 10.1 Feature Implementee: Actions — Real-Time Business System Connections

**Probleme**: Les 13 tools catalog/commerce de VocalIA lisent des fichiers JSON statiques. Quand un client appelle "ma commande est ou ?", l'IA lit un snapshot mort, pas le systeme reel du client.

**Solution**: 2 sous-features complementaires:

| Sous-feature | Description | Couverture |
|:-------------|:-----------|:-----------|
| **Action Override** | 13 tools existants acceptent un URL externe optionnel par tenant. Si configure → appel HTTPS temps reel. Si absent → JSON local inchange. | 10 catalog + 3 commerce |
| **Custom Action** | Tool generique (`query_external`) configurable par tenant. Description, parametres, URL — defini par le client. L'IA decide quand l'appeler. | Illimite (max 5 par tenant) |

### 10.2 Fichiers Modifies (10 fichiers, ~380 lignes)

| Fichier | Modification |
|:--------|:------------|
| `telephony/voice-telephony-bridge.cjs` | +`executeAction()` HTTPS fetcher securise, +`loadTenantActions()`, +`tryActionOverride()` intercepteur, +`handleCustomAction()`, +`ACTION_TOOL_MAP`, +injection custom tools dans tools[] LLM |
| `core/db-api.cjs` | +`GET/PUT /api/tenants/:id/actions`, +`actions` dans `provisionTenant()` |
| `website/app/client/integrations.html` | +Section "Connexions temps reel" (3 overrides + custom actions + info notice) |
| `website/src/lib/api-client.js` | +`get actions()` resource client |
| `website/src/locales/fr.json` | +32 cles `actions.*` |
| `website/src/locales/en.json` | +32 cles `actions.*` |
| `website/src/locales/es.json` | +32 cles `actions.*` |
| `website/src/locales/ar.json` | +32 cles `actions.*` |
| `website/src/locales/ary.json` | +32 cles `actions.*` |

### 10.3 Securite

| Risque | Mitigation |
|:-------|:-----------|
| SSRF | HTTPS uniquement + blocage localhost/127.0.0.1/10.*/172.16.*/192.168.*/[::1] |
| Path traversal | `loadTenantActions()` sanitize tenantId (B55 fix) |
| API lente | Timeout strict 5s |
| API en panne | Fallback automatique vers handler local JSON |
| Donnees malformees | JSON.parse en try/catch |
| Secrets | Headers masques (••••) en GET, preservation des existants en PUT |
| Injection prompt | Reponse externe → JSON.stringify avant envoi au LLM |

### 10.4 Bugs Trouves et Corriges (7 bugs)

| ID | Severite | Bug | Fix |
|:---|:---------|:----|:----|
| **B53** | CRITIQUE | `saveActions()` reconstruit headers avec `X-API-Key` hardcode → detruit le nom du header original + valeur masquee renvoyee sans demaskage | Preserve le header name existant, ne reconstruit que si le user entre une nouvelle valeur (sans ••••) |
| **B54** | HIGH | `executeAction()` — POST/PUT envoient params en query string, jamais en body (`req.end()` sans body) | Detection `isBodyMethod`, `JSON.stringify(params)` en body avec Content-Type + Content-Length |
| **B55** | HIGH | `loadTenantActions()` — tenantId non sanitise = path traversal (`../../etc/passwd`) | Regex `[^a-z0-9_-]` + reject si modifie |
| **B56** | MEDIUM | Status badge green classes ajoutees mais jamais nettoyees → badge reste vert apres suppression config | `classList.remove()` des classes actives avant d'ajouter les inactives |
| **B57** | MEDIUM | `api-client test()` avec `mode: 'no-cors'` → reponse opaque → `success: true` meme sur erreur 500 | Mode CORS normal + detection CORS-blocked comme "reachable" |
| **B58** | LOW | URL concatenation double slash (`url/` + `/path` = `url//path`) | `url.replace(/\/+$/, '')` + detection prefix slash/? |
| **B59** | MEDIUM | `handleCustomAction` met params dans query string ET `executeAction` les remet dans le body pour POST → double envoi | GET: params en query string. POST/PUT: params uniquement en body |

### 10.5 Verification Empirique

```
node -c telephony/voice-telephony-bridge.cjs    → OK
node -c core/db-api.cjs                         → OK
JSON validation × 5 locales                     → OK
Design tokens validator                          → 13/23 (10 STALE_NUMBER KB false positives — connu)
db-api-routes test                               → 82/83 (1 = B52 IPC — connu)
Caller/callee verification                       → 0 errors
```

### 10.6 Architecture: Flux d'un Appel avec Action Override

```
1. Client appelle → session creee avec metadata.tenant_id
2. loadTenantActions(tenantId) → lit clients/{id}/config.json → session._actions
3. L'IA invoque check_item_availability("couscous")
4. handleFunctionCall() → action interceptor AVANT le switch
5. tryActionOverride() regarde ACTION_TOOL_MAP + session._actions.overrides
   ├── OUI → executeAction(override, "/stock/{{item_id}}", args)
   │         ├── Succes → result envoyé au LLM via sendFunctionResult, return
   │         └── Echec → log warning, fallback dans le switch
   └── NON → switch classique (JSON local inchange)
6. Resultat envoyé au LLM → l'IA repond au client
```

### 10.7 Taches Restantes — Plan Actionnable

| # | Tache | Effort | Priorite | Dependance |
|:-:|:------|:-------|:---------|:-----------|
| 1 | **Expert Clone tier** (approved 250.216b, §6.2) | ~1 semaine | P1 | Aucune — design valide |
| 2 | **Stripe setup** — STRIPE_SECRET_KEY + webhooks + checkout flow | 1-2 jours | P1 | Expert Clone tier (pricing) |
| 3 | **Premier client payant** — demo, onboarding, config Actions | 1 jour | P1 | Stripe setup |
| 4 | **Test Actions E2E** — configurer un mock HTTPS server, verifier override + fallback + custom action en conditions reelles | 2h | P2 | Aucune |
| 5 | **Dashboard Actions analytics** — compteur d'appels externes reussis/echoues par type | 2h | P3 | Actions deploye en prod |
| 6 | **Actions UI: endpoint editor** — UI pour configurer les `endpoints` templates au lieu de defaults | 3h | P3 | Actions deploye |
| 7 | **Actions UI: custom action params editor** — ajouter/supprimer des params dans l'UI au lieu du JSON brut | 2h | P3 | Actions deploye |
| 8 | **Actions POST body support from UI** — formulaire pour choisir GET/POST + body template | 1h | P3 | B54 fix deploye |

### 10.8 Implementations Manquantes (Honnetete)

| Element | Statut | Impact |
|:--------|:-------|:-------|
| **Endpoint templates non editables dans l'UI** | Les defaults sont injects (`/products?category={{category}}`) mais le dashboard ne permet pas de les modifier. Le tenant doit passer par l'API PUT directement. | Moyen — les defaults couvrent 80% des cas REST standards |
| **Custom action params non editables dans l'UI** | Le `renderCustomActions` affiche les params existants mais ne permet pas d'ajouter/supprimer des params graphiquement | Moyen — le tenant peut configurer via API |
| **Pas de test de connectivite cote serveur** | Le bouton "Tester" fait un fetch browser-side qui peut etre bloque par CORS. Un vrai test devrait passer par le backend. | Moyen — le test est un indicateur, pas une garantie |
| **Pas de retry sur echec** | Si l'API externe echoue, on tombe direct en fallback local. Pas de retry avec backoff. | Faible — timeout 5s + fallback est suffisant pour les appels vocaux temps reel |
| **Pas de cache** | Chaque appel check_item_availability fait un HTTPS request. Pas de cache TTL. | Moyen — pour des catalogs a haute frequence, un cache 30s serait utile |
| **Pas de rate limiting par tenant** | Un tenant avec un override pourrait theoriquement generer des milliers de requetes vers son API | Faible — les appels vocaux sont naturellement limites par le debit humain |

---

*Sessions 250.214-218 — 4 features strategiques + Jargon Purge L1+L2 (~350 substitutions) + 21 bugs (B38-B59) + Expert Clone approuve + 4 UI/UX gaps + Actions temps reel (override 13 tools + custom actions + i18n × 5 langues)*
