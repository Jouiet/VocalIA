# AUDIT FORENSIQUE - Dashboards & DB VocalIA
> Session 250.51 | 01/02/2026 | Analyse Factuelle
> **UPDATED: Session 250.52 | 01/02/2026 | Corrections appliquées**

---

## EXECUTIVE SUMMARY

| Composant | Status | Problème Principal |
|:----------|:------:|:-------------------|
| GoogleSheetsDB.cjs | ✅ OK | - |
| db-api.cjs (3012) | ✅ OK | - |
| db-admin.html | ✅ OK | Utilise port 3012 |
| admin.html | ✅ CORRIGÉ | Données RÉELLES depuis Google Sheets |
| voice-api-resilient.cjs | ⚠️ INCOMPLET | Endpoints manquants |
| HITL Service | ❌ INEXISTANT | Fichier n'existe pas (graceful fallback) |

### Corrections Session 250.52

| Élément | Avant | Après |
|:--------|:------|:------|
| Tenants "28" | Hardcodé | `id="stat-tenants-count"` → dynamique |
| Revenue breakdown | Hardcodé (24,850€) | Calculé depuis tenants DB |
| API Usage (45,231...) | Hardcodé | `id="api-usage-*"` → estimé depuis sessions |
| Health Check (26/26) | Hardcodé | `id="health-*"` → live checks services |
| Logs initiaux | Mockés (6 logs) | Chargés depuis `/api/db/logs` |
| API_BASE port | 3004 | 3012 (db-api) |

---

## 1. DONNÉES MOCKÉES DANS admin.html - ✅ TOUTES CORRIGÉES

### 1.1 Stats Hardcodées → ✅ DYNAMIQUES

| Élément | Avant | Après | Status |
|:--------|:------|:------|:------:|
| Tenants actifs | `28` hardcodé | `id="stat-tenants-count"` | ✅ |
| Health Check total | `26/26` hardcodé | `id="health-total"` | ✅ |
| Health catégories | `7/7, 3/3...` hardcodé | `id="health-categories"` | ✅ |

### 1.2 Revenue Breakdown → ✅ CALCULÉ DEPUIS DB

| Élément | Avant | Après | Status |
|:--------|:------|:------|:------:|
| Enterprise/Pro/Starter % | Hardcodé | `updateRevenueBreakdown()` | ✅ |
| Total MRR | `24,850€` | `id="total-mrr-display"` | ✅ |
| ARR projeté | `298,200€` | `id="total-arr-display"` | ✅ |

### 1.3 API Usage → ✅ ESTIMÉ DEPUIS SESSIONS

| Élément | Avant | Après | Status |
|:--------|:------|:------|:------:|
| AI Primary | `45,231` | `id="api-usage-primary"` | ✅ |
| AI Fallback | `3,421` | `id="api-usage-fallback"` | ✅ |
| PSTN minutes | `12,892` | `id="api-usage-pstn"` | ✅ |
| TTS caractères | `8,543` | `id="api-usage-tts"` | ✅ |

**Note:** API usage est estimé depuis les sessions (calls × 4 pour AI, duration/60 pour PSTN, etc.)

### 1.4 Logs Initiaux → ✅ CHARGÉS DEPUIS DB

```javascript
// Session 250.52: Logs chargés depuis Google Sheets
function updateLogsFromDB(dbLogs) {
  allLogs = dbLogs.map(log => ({
    level: log.level || 'info',
    time: new Date(log.timestamp || Date.now()),
    message: log.message || ''
  }));
  renderLogs();
}
```

---

## 2. ENDPOINTS MANQUANTS

### 2.1 Dans voice-api-resilient.cjs (port 3004)

| Endpoint | Method | Status | Utilisé par |
|:---------|:-------|:------:|:------------|
| `/admin/metrics` | GET | ✅ | admin.html |
| `/admin/tenants` | GET | ✅ | admin.html |
| `/admin/tenants` | POST | ✅ | admin.html |
| `/admin/refresh` | POST | ✅ | admin.html |
| `/admin/logs` | GET | ✅ | admin.html |
| `/admin/logs/export` | GET | ✅ | admin.html |
| `/admin/restart` | POST | ❌ MANQUANT | admin.html:1159 |
| `/admin/tenants/:id` | PUT | ❌ MANQUANT | - |
| `/admin/tenants/:id` | DELETE | ❌ MANQUANT | - |
| `/admin/users/*` | ALL | ❌ MANQUANT | - |
| `/admin/sessions/*` | ALL | ❌ MANQUANT | - |

### 2.2 Service HITL (INEXISTANT)

```
Fichier attendu: core/remotion-hitl.cjs
Status: N'EXISTE PAS

Endpoints attendus (admin.html:737-862):
- GET /pending
- GET /stats
- POST /queue
- POST /video/{id}/approve
- POST /video/{id}/reject
```

---

## 3. INCOHÉRENCE DES PORTS

### Architecture Actuelle (PROBLÈME)

```
┌─────────────────┐     ┌─────────────────┐
│   admin.html    │     │  db-admin.html  │
│   Port: 3004    │     │   Port: 3012    │
└────────┬────────┘     └────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│ voice-api.cjs   │     │   db-api.cjs    │
│   Port: 3004    │     │   Port: 3012    │
│ (adminMetrics)  │     │ (GoogleSheets)  │
└────────┬────────┘     └────────┬────────┘
         │                       │
         ▼                       ▼
    IN-MEMORY MAP          GOOGLE SHEETS
    (startup load)         (authoritative)
```

**Problème:** Deux sources de vérité différentes!

---

## 4. CE QUI FONCTIONNE RÉELLEMENT

### 4.1 GoogleSheetsDB.cjs ✅

```javascript
// CRUD complet testé et fonctionnel
const db = new GoogleSheetsDB();
await db.init();
await db.create('tenants', {...});  // ✅
await db.findAll('tenants');        // ✅
await db.findById('tenants', id);   // ✅
await db.update('tenants', id, {}); // ✅
await db.delete('tenants', id);     // ✅
```

### 4.2 db-api.cjs (Port 3012) ✅

```bash
# Tous ces endpoints fonctionnent:
GET  /api/db/health      # ✅
GET  /api/db/tenants     # ✅
GET  /api/db/tenants/:id # ✅
POST /api/db/tenants     # ✅
PUT  /api/db/tenants/:id # ✅
DELETE /api/db/tenants/:id # ✅
```

### 4.3 db-admin.html ✅

- Connecté à port 3012 (db-api)
- CRUD complet via db-client.js
- Données réelles depuis Google Sheets

---

## 5. PLAN D'ACTION

### Phase 1: Corriger admin.html (PRIORITÉ HAUTE)

| # | Tâche | Fichier | Lignes |
|:-:|:------|:--------|:-------|
| 1 | Remplacer stat tenants "28" par API | admin.html | 197 |
| 2 | Calculer revenue breakdown depuis API | admin.html | 398-436 |
| 3 | Calculer API usage depuis métriques | admin.html | 449-509 |
| 4 | Health check depuis /admin/health | admin.html | 296-357 |
| 5 | Logs depuis /admin/logs | admin.html | 924-931 |

### Phase 2: Ajouter endpoints manquants (PRIORITÉ HAUTE)

| # | Endpoint | Fichier | Action |
|:-:|:---------|:--------|:-------|
| 1 | POST /admin/restart | voice-api-resilient.cjs | Ajouter |
| 2 | PUT /admin/tenants/:id | voice-api-resilient.cjs | Ajouter |
| 3 | DELETE /admin/tenants/:id | voice-api-resilient.cjs | Ajouter |

### Phase 3: Unifier les dashboards (PRIORITÉ MOYENNE)

**Option A:** admin.html utilise db-api (port 3012)
- Avantage: Une seule source de vérité
- Inconvénient: Refactoring important

**Option B:** voice-api proxy vers db-api
- Avantage: Pas de changement admin.html
- Inconvénient: Latence ajoutée

**Recommandation:** Option A - Migrer admin.html vers port 3012

### Phase 4: HITL Service (PRIORITÉ BASSE)

- Créer core/remotion-hitl.cjs si nécessaire
- OU supprimer section HITL de admin.html

---

## 6. VÉRIFICATION EMPIRIQUE

```bash
# Commandes pour vérifier l'état actuel

# 1. Tester DB API
curl -s http://localhost:3012/api/db/health | jq .

# 2. Tester Voice API Admin
curl -s http://localhost:3004/admin/metrics | jq '.stats'

# 3. Lister tenants (DB réelle)
curl -s http://localhost:3012/api/db/tenants | jq '.data | length'

# 4. Créer tenant test
curl -s -X POST http://localhost:3012/api/db/tenants \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com"}' | jq .
```

---

## 7. FICHIERS À MODIFIER

### Modifications Requises

| Fichier | Lignes | Action |
|:--------|:-------|:-------|
| `admin.html` | 197 | Remplacer "28" par `metrics.stats.tenantsActive` |
| `admin.html` | 398-436 | Calculer depuis `metrics.topTenants` |
| `admin.html` | 449-509 | Calculer depuis `metrics.apiUsage` |
| `admin.html` | 296-357 | Appeler `/admin/health` |
| `admin.html` | 924-931 | Charger depuis `/admin/logs` |
| `admin.html` | 1022 | Changer API_BASE vers port 3012 |
| `voice-api-resilient.cjs` | ~1700 | Ajouter POST /admin/restart |

---

## 8. CONCLUSION

**État actuel:** Le système DB fonctionne mais le dashboard admin mélange données réelles et mockées.

**Risque:** L'utilisateur voit des métriques fausses (24,850€ MRR mockée).

**Solution:** Migrer admin.html vers db-api.cjs (port 3012) et supprimer toutes les données hardcodées.

---

*Document généré: 01/02/2026 | Session 250.51*
*Vérification: Analyse bottom-up basée sur lecture directe des fichiers*
