# AUDIT FORENSIQUE COMPLET - Dashboards VocalIA
> Session 250.52 | 01/02/2026 | Analyse Bottom-Up Factuelle
> Méthode: Lecture directe des fichiers, vérification empirique, zéro supposition

---

## TABLE DES MATIÈRES

1. [Executive Summary](#1-executive-summary)
2. [Inventaire des Fichiers](#2-inventaire-des-fichiers)
3. [Audit admin.html](#3-audit-adminhtml)
4. [Audit client.html](#4-audit-clienthtml)
5. [Audit widget-analytics.html](#5-audit-widget-analyticshtml)
6. [Audit db-admin.html](#6-audit-db-adminhtml)
7. [Architecture Cible](#7-architecture-cible)
8. [Plan d'Action](#8-plan-daction)
9. [Commandes de Vérification](#9-commandes-de-vérification)

---

## 1. EXECUTIVE SUMMARY

### 1.1 État Actuel des Dashboards (MÀJ 01/02/2026 23:30)

| Fichier | Lignes | Port API | Source Données | Fonctionnel? |
|:--------|:------:|:--------:|:---------------|:------------:|
| admin.html | 2100+ | 3012 | Google Sheets | ✅ OUI (+DB CRUD) |
| client.html | 1100+ | 3012 | Google Sheets | ✅ OUI |
| widget-analytics.html | 800+ | 3012 | Google Sheets | ✅ OUI |
| db-admin.html | - | - | ARCHIVÉ | ✅ Fusionné |

### 1.2 Verdict

| Aspect | Status |
|:-------|:------:|
| **admin.html** | ✅ Corrigé Session 250.52 - Données réelles + DB CRUD intégré |
| **client.html** | ✅ CORRIGÉ Session 250.52 - Connecté à Google Sheets |
| **widget-analytics.html** | ✅ CORRIGÉ Session 250.52 - Connecté à Google Sheets |
| **db-admin.html** | ✅ ARCHIVÉ - Fusionné dans admin.html |

### 1.3 Architecture Cible

```
AVANT (4 fichiers)              APRÈS (2 fichiers + 1 sub-page)
─────────────────               ───────────────────────────────
admin.html                      admin.html (fusionné avec db-admin)
db-admin.html         ────►     └── Onglet "Database" intégré
client.html                     client.html (connecté à DB)
widget-analytics.html           └── widget-analytics.html (sub-page)
```

---

## 2. INVENTAIRE DES FICHIERS

### 2.1 Localisation

```
/Users/mac/Desktop/VocalIA/website/dashboard/
├── admin.html              76,940 bytes   1582 lignes
├── client.html             48,133 bytes    919 lignes
├── db-admin.html           19,807 bytes    467 lignes
└── widget-analytics.html   34,360 bytes    675 lignes
```

### 2.2 Vérification Empirique

```bash
ls -la /Users/mac/Desktop/VocalIA/website/dashboard/
# Résultat vérifié le 01/02/2026
```

---

## 3. AUDIT admin.html

### 3.1 Configuration API

```javascript
// Lignes 990-998
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3012/api/db'    // ✅ db-api (Google Sheets)
  : 'https://api.vocalia.ma/db';

const VOICE_API = window.location.hostname === 'localhost'
  ? 'http://localhost:3004'           // Pour health checks
  : 'https://api.vocalia.ma';
```

### 3.2 IDs Dynamiques (Vérifié)

| ID | Ligne | Mis à jour par | Source |
|:---|:-----:|:---------------|:-------|
| `stat-tenants-count` | ~197 | `updateAdminDashboard()` | DB tenants |
| `stat-calls-today` | ~203 | `updateAdminDashboard()` | DB sessions |
| `stat-mrr` | ~215 | `updateAdminDashboard()` | Calculé DB |
| `api-usage-primary` | ~435 | `updateApiUsage()` | Estimé sessions |
| `api-usage-fallback` | ~450 | `updateApiUsage()` | Estimé sessions |
| `api-usage-pstn` | ~465 | `updateApiUsage()` | Estimé sessions |
| `api-usage-tts` | ~480 | `updateApiUsage()` | Estimé sessions |
| `health-total` | ~296 | `fetchHealthCheck()` | Live checks |
| `health-categories` | ~298 | `updateHealthCheckUI()` | Live checks |
| `total-mrr-display` | ~433 | `updateRevenueBreakdown()` | Calculé DB |
| `total-arr-display` | ~435 | `updateRevenueBreakdown()` | Calculé DB |

### 3.3 Fonctions Clés

| Fonction | Ligne | Rôle |
|:---------|:-----:|:-----|
| `fetchAdminMetrics()` | ~1001 | Fetch depuis `/tenants`, `/sessions`, `/logs` |
| `updateAdminDashboard()` | ~1085 | Met à jour tous les éléments DOM |
| `updateRevenueBreakdown()` | ~1154 | Calcule et affiche MRR par plan |
| `updateApiUsage()` | ~1205 | Estime API usage depuis sessions |
| `fetchHealthCheck()` | ~1235 | Check live des services |
| `renderTenantsTable()` | ~1175 | Affiche table des tenants |

### 3.4 Status: ✅ FONCTIONNEL

Corrigé en Session 250.52. Données réelles depuis Google Sheets.

---

## 4. AUDIT client.html

### 4.1 Configuration API

```javascript
// Lignes 590-592
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3004'           // ❌ voice-api (PAS db-api!)
  : 'https://api.vocalia.ma';

// Endpoint appelé (ligne 597)
fetch(`${API_BASE}/dashboard/metrics`)  // Retourne in-memory data (zéros)
```

### 4.2 INVENTAIRE EXHAUSTIF DES VALEURS HARDCODÉES

#### 4.2.1 User Info (Lignes 99-113)

| Ligne | Élément | Valeur Hardcodée | Impact |
|:-----:|:--------|:-----------------|:-------|
| 103 | Initiales avatar | `JD` | Faux utilisateur |
| 105 | Nom utilisateur | `Jean Dupont` | Faux utilisateur |
| 106 | Plan utilisateur | `Pro Plan` | Fausse info |

#### 4.2.2 Stats Cards (Lignes 181-235)

| Ligne | Élément | Valeur | ID Existe? | Mis à jour? |
|:-----:|:--------|:-------|:----------:|:-----------:|
| 189 | Growth % | `+12%` | ❌ Non | ❌ |
| 191 | Total Calls | `1,247` | ✅ `totalCalls` | ✅ Mais API=0 |
| 201 | Max Minutes | `/ 2000 min` | ❌ Non | ❌ |
| 203 | Minutes Used | `1,456` | ✅ `minutesUsed` | ✅ Mais API=0 |
| 207 | Progress Bar | `w-[73%]` | ❌ Non (CSS) | ❌ |
| 218 | Conv Trend | `+5%` | ✅ `conversionTrend` | ❌ Jamais |
| 220 | Conv Rate | `0%` | ✅ `conversionRate` | ✅ |
| 232 | NPS Score | `0` | ✅ `npsScore` | ✅ |

#### 4.2.3 Language Distribution (Lignes 291-340)

| Ligne | Langue | % Affiché | CSS Width | Mis à jour? |
|:-----:|:-------|:----------|:----------|:-----------:|
| 298 | Français | `62%` | `w-[62%]` | ❌ |
| 307 | Darija | `18%` | `w-[18%]` | ❌ |
| 316 | Anglais | `12%` | `w-[12%]` | ❌ |
| 325 | Arabe | `5%` | `w-[5%]` | ❌ |
| 334 | Espagnol | `3%` | `w-[3%]` | ❌ |

**Note:** La fonction `updateLanguageChart()` existe (ligne 639) mais ne fonctionne pas car elle cherche des éléments mal ciblés.

#### 4.2.4 Billing Section (Lignes 495-516)

| Ligne | Élément | Valeur Hardcodée |
|:-----:|:--------|:-----------------|
| 500 | Plan name | `Pro` |
| 501 | Plan price | `149€/mois` |
| 506 | Extra minutes | `0` |
| 508 | Remaining mins | `544 min restantes` |
| 512 | Next bill amount | `149€` |
| 513 | Next bill date | `Le 1er Février 2026` |

#### 4.2.5 Activity Panel Modal (Lignes 672-720)

| Ligne | Élément | Valeur Hardcodée |
|:-----:|:--------|:-----------------|
| 685 | Phone number | `+212 6XX XXX XX1` |
| 694 | Doctor name | `Dr. Alaoui` |
| 694 | Appointment | `Demain 14h30` |

### 4.3 Endpoint API Analysé

```javascript
// voice-api-resilient.cjs:1559-1563
if (req.url === '/dashboard/metrics' && req.method === 'GET') {
  const metrics = getDashboardMetrics();  // ← In-memory, démarre à 0
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(metrics, null, 2));
}
```

```javascript
// voice-api-resilient.cjs:204-217
const dashboardMetrics = {
  totalCalls: 0,           // ← Toujours 0 au démarrage
  totalMinutes: 0,         // ← Toujours 0 au démarrage
  hotLeads: 0,
  warmLeads: 0,
  coolLeads: 0,
  coldLeads: 0,
  totalLeadsQualified: 0,
  languageDistribution: { fr: 0, en: 0, es: 0, ar: 0, ary: 0 },
  dailyCalls: {},
  monthStartDate: new Date().toISOString().slice(0, 7),
  npsResponses: [],
  lastUpdated: Date.now()
};
```

### 4.4 Status: ✅ CORRIGÉ (Session 250.52)

**Corrections appliquées:**
1. ✅ API_BASE changé vers port 3012 (db-api)
2. ✅ Connexion à Google Sheets via `/api/db/tenants` et `/api/db/sessions`
3. ⏳ Authentification (Phase 5 - optionnel)
4. ✅ Support tenant_id via URL params ou localStorage
5. ✅ 27+ valeurs hardcodées supprimées et remplacées par IDs dynamiques

---

## 5. AUDIT widget-analytics.html

### 5.1 Relation avec client.html

```html
<!-- Ligne 53 -->
<a href="/dashboard/client" ...>Vue d'ensemble</a>

<!-- Ligne 61 -->
<a href="/dashboard/client#calls" ...>Appels</a>

<!-- Ligne 65 -->
<a href="/dashboard/client#agents" ...>Agents IA</a>

<!-- Ligne 69 -->
<a href="/dashboard/client#billing" ...>Facturation</a>
```

**Verdict:** C'est une sub-page de client.html, pas un dashboard séparé.

### 5.2 Valeurs Hardcodées

| Ligne | Élément | Valeur |
|:-----:|:--------|:-------|
| 77 | Initiales | `JD` |
| 79 | Nom | `Jean Dupont` |
| 80 | Plan | `Pro Plan` |
| 125 | Trend | `+18%` |
| 128 | Sessions | `3,847` |
| 140 | Trend | `+8%` |
| 143 | Avg Duration | `2:34` |

### 5.3 Status: ✅ CORRIGÉ (Session 250.52)

**Corrections appliquées:**
1. ✅ API_BASE configuré vers port 3012 (db-api)
2. ✅ User info dynamique (initiales, nom, plan)
3. ✅ Stats dynamiques (sessions, durée, completion, leads)
4. ✅ Language distribution depuis sessions
5. ✅ Personas table calculée depuis sessions
6. ✅ Sessions chart avec données réelles

---

## 6. AUDIT db-admin.html

### 6.1 Configuration API

```javascript
// Ligne implicite - utilise db-client.js
const API_BASE = 'http://localhost:3012/api/db';
```

### 6.2 Fonctionnalités

| Onglet | CRUD | Table Google Sheets |
|:-------|:----:|:--------------------|
| Tenants | ✅ Create, Read, Update, Delete | `tenants` |
| Sessions | ✅ Create, Read, Update, Delete | `sessions` |
| Users | ✅ Create, Read, Update, Delete | `users` |
| Logs | ✅ Read | `logs` |

### 6.3 Lien vers admin.html

```html
<!-- Ligne 25-28 -->
<a href="/dashboard/admin.html" class="text-gray-400 hover:text-white">
  <svg ...>← Back</svg>
</a>
```

### 6.4 Status: ✅ ARCHIVÉ - FUSIONNÉ DANS ADMIN.HTML

**Session 250.52:**
- Fonctionnalités CRUD intégrées dans admin.html section #database
- Fichier renommé en `db-admin.html.archived`
- Liens de retour vers admin.html plus nécessaires

---

## 7. ARCHITECTURE CIBLE

### 7.1 Structure Finale

```
/website/dashboard/
├── admin.html                    # Dashboard VocalIA (operators)
│   ├── Overview (stats, revenue, health)
│   ├── Tenants (table CRUD)
│   ├── Logs (system logs)
│   ├── HITL (video queue)
│   └── Database (NOUVEAU - fusionné de db-admin.html)
│       ├── Tenants CRUD
│       ├── Sessions CRUD
│       ├── Users CRUD
│       └── Logs view
│
├── client.html                   # Dashboard Client (utilisateurs)
│   ├── Overview (ses stats)
│   ├── Calls (historique appels)
│   ├── Agents IA (configuration)
│   ├── Knowledge Base
│   ├── Analytics → widget-analytics.html
│   ├── Billing (facturation)
│   └── Settings
│
└── widget-analytics.html         # Sub-page de client.html
    └── Analytics détaillées du widget
```

### 7.2 Flux de Données Cible

```
┌─────────────────────────────────────────────────────────────────┐
│                        GOOGLE SHEETS                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ tenants  │  │ sessions │  │  users   │  │   logs   │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
└───────┼─────────────┼─────────────┼─────────────┼───────────────┘
        │             │             │             │
        └─────────────┴──────┬──────┴─────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │    db-api.cjs (port 3012)    │
              │  /api/db/tenants             │
              │  /api/db/sessions            │
              │  /api/db/users               │
              │  /api/db/logs                │
              │  /api/db/client/:id/metrics  │  ← NOUVEAU
              └──────────────┬───────────────┘
                             │
           ┌─────────────────┼─────────────────┐
           │                 │                 │
           ▼                 ▼                 ▼
    ┌────────────┐    ┌────────────┐    ┌──────────────────┐
    │ admin.html │    │client.html │    │widget-analytics  │
    │ (tous      │    │(tenant X)  │    │(tenant X)        │
    │ tenants)   │    │            │    │                  │
    └────────────┘    └────────────┘    └──────────────────┘
```

---

## 8. PLAN D'ACTION

### Phase 1: Fusionner db-admin.html dans admin.html ✅ DONE

| # | Tâche | Status | Vérification |
|:-:|:------|:------:|:-------------|
| 1.1 | Ajouter onglet "Database" dans sidebar | ✅ | `grep -c 'Database' admin.html` = 12 |
| 1.2 | Copier contenu tabs de db-admin | ✅ | Section #database avec 4 tabs |
| 1.3 | Copier fonctions JS CRUD | ✅ | `refreshDBData`, `editDBRecord`, etc. |
| 1.4 | Archiver db-admin.html | ✅ | `db-admin.html.archived` |
| 1.5 | Event handler global | ✅ | `initActionHandler()` pour data-action |

**Temps réel:** ~1.5 heures | **Commit:** 4db7e72

### Phase 2: Connecter client.html à Google Sheets ✅ DONE

| # | Tâche | Status | Vérification |
|:-:|:------|:------:|:-------------|
| 2.1 | Changer API_BASE | ✅ | `grep 'localhost:3012' client.html` = 1 |
| 2.2 | Utiliser endpoints existants | ✅ | `/tenants` + `/sessions` au lieu d'endpoint dédié |
| 2.3 | Support tenant_id | ✅ | URL param + localStorage |
| 2.4 | Créer fetchDashboardMetrics() | ✅ | Fetch + calcul côté client |
| 2.5 | Update dynamique DOM | ✅ | IDs pour tous les éléments |

**Temps réel:** ~2 heures | **Commit:** 4db7e72

### Phase 3: Supprimer Hardcodés client.html ✅ DONE

| # | Élément | Status | Vérification |
|:-:|:--------|:------:|:-------------|
| 3.1-3.3 | User info (JD, Jean Dupont, Pro Plan) | ✅ | 0 matches |
| 3.4-3.9 | Stats cards (+12%, 1,247, etc.) | ✅ | IDs dynamiques |
| 3.10-3.14 | Language distribution | ✅ | `lang-pct-*`, `lang-bar-*` IDs |
| 3.15-3.20 | Billing section | ✅ | `billing-*` IDs |

**Vérification finale:** `grep -c 'Jean Dupont\|149€\|1,247' client.html` = 0

### Phase 4: Corriger widget-analytics.html ✅ DONE

| # | Tâche | Status | Vérification |
|:-:|:------|:------:|:-------------|
| 4.1 | Connecter API | ✅ | `API_BASE` vers port 3012 |
| 4.2 | Supprimer hardcodés | ✅ | User info, stats dynamiques |
| 4.3 | Créer fetchWidgetAnalytics() | ✅ | + updateWidgetAnalytics() |
| 4.4 | Personas table dynamique | ✅ | updatePersonasTable() |
| 4.5 | Sessions chart | ✅ | renderSessionsChart() |

**Temps réel:** ~1.5 heures | **Commit:** 4db7e72

### Phase 5: Authentification (OPTIONNEL mais CRITIQUE)

| # | Tâche | Fichier | Détail |
|:-:|:------|:--------|:-------|
| 5.1 | Créer table `users` dans Sheets | Google Sheets | email, password_hash, tenant_id, role |
| 5.2 | Créer endpoint login | db-api.cjs | `POST /api/db/auth/login` |
| 5.3 | Ajouter page login | login.html | Formulaire email/password |
| 5.4 | Gérer session | client.html | JWT ou cookie |
| 5.5 | Protéger routes | db-api.cjs | Middleware auth |

**Effort estimé:** 8-12 heures
**Risque:** Élevé (sécurité critique)

---

## 9. COMMANDES DE VÉRIFICATION

### 9.1 Vérifier État Actuel

```bash
# Fichiers dashboard
ls -la /Users/mac/Desktop/VocalIA/website/dashboard/

# APIs en cours
curl -s http://localhost:3012/api/db/health | head -5
curl -s http://localhost:3004/health | head -5

# Données Google Sheets
curl -s http://localhost:3012/api/db/tenants | python3 -c "import json,sys; print(f'Tenants: {json.load(sys.stdin)[\"count\"]}')"
curl -s http://localhost:3012/api/db/sessions | python3 -c "import json,sys; print(f'Sessions: {json.load(sys.stdin)[\"count\"]}')"
```

### 9.2 Vérifier Hardcodés

```bash
# client.html hardcodés
grep -n 'Jean Dupont\|149€\|1,247\|1,456\|62%\|18%\|12%\|544 min' /Users/mac/Desktop/VocalIA/website/dashboard/client.html

# widget-analytics.html hardcodés
grep -n 'Jean Dupont\|3,847\|2:34' /Users/mac/Desktop/VocalIA/website/dashboard/widget-analytics.html
```

### 9.3 Vérifier Après Corrections

```bash
# Après Phase 1 (fusion db-admin)
ls /Users/mac/Desktop/VocalIA/website/dashboard/  # db-admin.html ne doit plus exister
grep -c 'Database' /Users/mac/Desktop/VocalIA/website/dashboard/admin.html  # Doit retourner > 0

# Après Phase 2 (connexion client)
grep 'localhost:3012' /Users/mac/Desktop/VocalIA/website/dashboard/client.html  # Doit exister
curl -s http://localhost:3012/api/db/client/t001/metrics  # Doit retourner JSON

# Après Phase 3 (suppression hardcodés)
grep -c 'Jean Dupont' /Users/mac/Desktop/VocalIA/website/dashboard/client.html  # Doit retourner 0
```

---

## ANNEXE A: Checklist de Validation Finale

| # | Check | Commande | Résultat Attendu |
|:-:|:------|:---------|:-----------------|
| 1 | admin.html fonctionnel | Ouvrir navigateur | Données réelles affichées |
| 2 | db-admin.html supprimé | `ls dashboard/` | 3 fichiers seulement |
| 3 | client.html connecté DB | `grep '3012' client.html` | Match trouvé |
| 4 | Pas de hardcodés client | `grep 'Jean Dupont' client.html` | 0 matches |
| 5 | widget-analytics connecté | Test navigateur | Données réelles |
| 6 | Endpoint client existe | `curl /api/db/client/*/metrics` | JSON valide |

---

## ANNEXE B: Récapitulatif Effort

| Phase | Estimé | Réel | Status |
|:------|:------:|:----:|:------:|
| Phase 1 (Fusion db-admin) | 2-3h | ~1.5h | ✅ DONE |
| Phase 2 (Connexion client) | 4-6h | ~2h | ✅ DONE |
| Phase 3 (Suppr. hardcodés) | 3-4h | ~1h | ✅ DONE |
| Phase 4 (widget-analytics) | 2-3h | ~1.5h | ✅ DONE |
| Phase 5 (Auth) | 8-12h | - | ⏳ OPTIONNEL |
| **TOTAL Phases 1-4** | **11-16h** | **~6h** | ✅ COMPLETE |

### Commits Session 250.52

| Commit | Description |
|:-------|:------------|
| 4db7e72 | feat(dashboards): Connect all dashboards to Google Sheets DB |

### Fichiers Modifiés

| Fichier | Insertions | Suppressions |
|:--------|:----------:|:------------:|
| admin.html | +818 | -0 |
| client.html | +316 | -152 |
| widget-analytics.html | +350 | -97 |
| db-admin.html | 0 | -467 (archivé) |

---

*Document généré: 01/02/2026 | Session 250.52*
*Auteur: Analyse automatisée bottom-up*
*Vérification: Chaque fait basé sur lecture directe des fichiers source*
*Dernière mise à jour: 01/02/2026 23:45 CET*
*Status: Phases 1-4 COMPLÈTES | Phase 5 (Auth) OPTIONNELLE*
