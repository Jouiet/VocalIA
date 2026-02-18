# Charte Éditoriale VocalIA

> **Créé** : 16/02/2026 | **Statut** : ACTIF
> **Objectif** : Garantir que TOUTE copie client-visible parle en langage business, pas technique.

---

## 1. Audience Primaire

| Persona | Qui | Veut savoir | Ne veut PAS savoir |
|:--------|:----|:------------|:-------------------|
| **Fondateur / CEO** | Dirigeant PME, 35-55 ans | ROI, gain de temps, revenus | Architecture, protocoles, APIs |
| **Responsable commercial** | Dir. ventes, growth | Qualification leads, conversion | WebSocket, Shadow DOM, fallback |
| **Responsable ops** | Office manager, assistante | Facilité d'installation, fiabilité | GA4 events, BANT scoring, UCP |

**Audience secondaire (pages dédiées)** : CTO/Développeur → `docs/api.html`, `docs/index.html` uniquement.

---

## 2. Taxonomie des Pages

### Pages FOUNDER-FACING (langage 100% business)

| Page | URL | Audience |
|:-----|:----|:---------|
| Accueil | `/index.html` | Fondateur |
| Fonctionnalités | `/features.html` | Fondateur / Commercial |
| Tarifs | `/pricing.html` | Fondateur |
| Produits (4) | `/products/*.html` | Fondateur |
| Industries (5) | `/industries/*.html` | Fondateur |
| Cas d'usage (5) | `/use-cases/*.html` | Fondateur / Commercial |
| Blog (6+) | `/blog/articles/*.html` | Fondateur / Marketing |
| À propos | `/about.html` | Fondateur |
| Académie Business | `/academie-business/` | Fondateur |
| Booking | `/booking.html` | Client final |
| Contact | `/contact.html` | Fondateur |
| Intégrations | `/integrations.html` | Fondateur / Ops |
| Referral | `/referral.html` | Fondateur |

### Pages DEVELOPER-FACING (jargon technique AUTORISÉ)

| Page | URL | Audience |
|:-----|:----|:---------|
| Documentation API | `/docs/api.html` | Développeur |
| Quickstart | `/docs/index.html` | Développeur |
| Statut | `/status/index.html` | DevOps |

### Pages ADMIN-FACING (jargon semi-technique AUTORISÉ)

| Page | URL | Audience |
|:-----|:----|:---------|
| Dashboard client (10) | `/app/client/*.html` | Client IT |
| Admin panels (3) | `/app/admin/*.html` | Admin interne |

### Pages LÉGALES (jargon technique AUTORISÉ si juridiquement nécessaire)

| Page | URL |
|:-----|:----|
| Mentions légales | `/mentions-legales.html` |
| Politique cookies | `/cookie-policy.html` |
| CGV | `/terms.html` |
| Confidentialité | `/privacy.html` |

### Page INVESTISSEUR (jargon technique AUTORISÉ — audience avertie)

| Page | URL |
|:-----|:----|
| Investor | `/investor.html` |

---

## 3. Glossaire de Substitution

### Niveau 1 — Jargon INTERDIT sur pages founder-facing

| Terme technique | Remplacement business | Contexte |
|:----------------|:---------------------|:---------|
| PSTN | Téléphonie IA / Lignes téléphoniques dédiées | Partout |
| Webhook | Notification / Automatisation | Partout |
| MCP (outils/tools) | Connecteurs | Partout |
| JWT | Authentification sécurisée | Partout |
| CSP | Protection des pages | Partout |
| SRI | Vérification d'intégrité | Partout |
| CORS | Protection inter-domaines | Partout |
| XSS | Protection contre les injections | Partout |
| TLS/HTTPS | Chiffrement | Badge footer/pricing |
| Web Speech API | Reconnaissance vocale du navigateur | Partout |
| Function Tools | Fonctionnalités | Partout |
| Rate limiting | Protection anti-abus | Partout |
| Tenant | Compte / Client | Partout |

### Niveau 2 — Jargon à SIMPLIFIER sur pages founder-facing

| Terme technique | Remplacement business | Contexte |
|:----------------|:---------------------|:---------|
| RAG (vectorielle) | Base de connaissances intelligente | Partout |
| BANT | Score de qualification | Sauf use-cases/lead-qualification (OK d'expliquer BANT) |
| UCP | Profil client unifié | Retirer l'acronyme, garder le concept |
| Shadow DOM | Isolation du widget / Zéro conflit de styles | Partout |
| WebSocket | Temps réel | Schema.org, fallbacks |
| GA4 | Google Analytics | Ou juste "Analytics" |
| HITL | Validation humaine | Partout sauf dashboard client |
| sessionStorage / localStorage | Mémoire de session / Préférences sauvegardées | Partout |
| DatePicker | Calendrier interactif | Partout |
| A2UI | Composants interactifs | Partout |
| Carousel | Défilement produits | Ou garder "Carrousel" (FR standard) |
| fallback | Relais automatique / Redondance | Sauf pricing comparison table |
| EventBus | (supprimer — jamais visible client) | Partout |
| font-mono | (CSS class — invisible utilisateur) | N/A |
| Multi-AI Fallback | Redondance IA 5 niveaux | Partout |

### Exceptions confirmées (NE PAS CHANGER)

| Terme | Raison |
|:------|:-------|
| AES-256 | Badge standard reconnu ("chiffrement militaire") |
| OAuth2 / SSO | Page intégrations, audience semi-technique |
| API | Terme universellement compris |
| CRM | Terme universellement compris (Salesforce, HubSpot...) |
| IA / AI | Terme universellement compris |
| ElevenLabs | Nom de marque |
| Grok / Gemini / Claude | Noms de marque (dans fallback chain) |
| RGPD | Terme légal obligatoire |
| RTL | Invisible client (attribut HTML) |

---

## 4. Règles de Rédaction

### Règle 1 : Bénéfice AVANT Feature

```
❌ DEV: "Score BANT automatique (0-100) calculé en temps réel"
✅ BIZ: "Identifiez instantanément vos meilleurs prospects — chaque visiteur est évalué automatiquement"

❌ DEV: "Base de connaissances RAG vectorielle, personnalisée par secteur"
✅ BIZ: "L'IA connaît votre métier — elle répond avec VOS informations, pas des réponses génériques"

❌ DEV: "Multi-AI Fallback 5 niveaux (Grok → Gemini → Claude → Atlas → local)"
✅ BIZ: "Disponibilité 99.9% — si un moteur IA tombe, un autre prend le relais en 2 secondes"

❌ DEV: "Shadow DOM isolation CSS"
✅ BIZ: "Le widget s'intègre parfaitement — zéro conflit avec le design de votre site"
```

### Règle 2 : Pas d'acronyme sans explication (sauf exceptions)

```
❌ "Profil client unifié (UCP)"
✅ "Profil client unifié" (sans acronyme)

❌ "19 événements GA4"
✅ "19 événements Google Analytics"

❌ "Contrôles HITL"
✅ "Validation humaine"
```

### Règle 3 : Le "comment" est pour les développeurs, pas les clients

```
❌ "Réponses en streaming via WebSocket pour une sensation naturelle"
✅ "Réponses instantanées — la conversation coule naturellement"

❌ "Composant DatePicker avec créneaux disponibles affichés visuellement"
✅ "Calendrier interactif avec créneaux disponibles en un clic"
```

### Règle 4 : Schema.org = le résumé Google → encore PLUS business

Les Schema.org `featureList` et FAQ `acceptedAnswer` sont indexés par Google et apparaissent dans les résultats de recherche. Ils doivent être les PLUS commerciaux de toute la page.

```
❌ Schema: "BANT scoring (Budget, Authority, Need, Timeline)"
✅ Schema: "Automatic lead scoring and qualification"

❌ Schema: "Returning visitor memory (localStorage + server-side)"
✅ Schema: "Returning visitor recognition and personalized experience"
```

---

## 5. Matrice de Décision

Pour chaque terme sur une page founder-facing :

```
Le client de mon client (restaurateur, dentiste, agent immo) comprend-il ce mot ?
  → OUI → Garder
  → NON → Le mot apparaît-il dans le glossaire Niveau 1 ?
    → OUI → Remplacer immédiatement
    → NON → Le mot apparaît-il dans le glossaire Niveau 2 ?
      → OUI → Simplifier selon le contexte
      → NON → Évaluer au cas par cas, ajouter au glossaire si récurrent
```

---

## 6. Checklist Pré-Publication

Avant tout commit touchant du contenu client-visible :

- [ ] ZERO terme Niveau 1 sur pages founder-facing
- [ ] ZERO acronyme Niveau 2 non expliqué sur pages founder-facing
- [ ] Schema.org en langage 100% business
- [ ] Fallbacks HTML alignés avec les clés i18n
- [ ] Grep de validation : `grep -rn "PSTN\|Webhook\|MCP\|JWT\|Web Speech API\|function.tool" website/` — 0 match hors exclusions

---

*Ce document est la référence pour toute modification de copie marketing VocalIA.*
