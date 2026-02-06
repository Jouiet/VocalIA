# AUDIT FORENSIQUE - Dashboard Client (client.html)
> Session 250.52 | 01/02/2026 | Analyse Bottom-Up Factuelle

---

## EXECUTIVE SUMMARY

| Aspect | Status | Détail |
|:-------|:------:|:-------|
| **API Endpoint** | ✅ EXISTS | `/dashboard/metrics` ligne 1559 voice-api |
| **Data Source** | ⚠️ IN-MEMORY | `dashboardMetrics` object, démarre à 0 |
| **Persistence** | ❌ NONE | Données perdues au redémarrage serveur |
| **User Authentication** | ❌ NONE | "Jean Dupont" hardcodé |
| **Tenant Isolation** | ❌ NONE | Dashboard unique pour tous |
| **Google Sheets Integration** | ❌ NONE | Pas connecté à la DB |

---

## 1. DONNÉES HARDCODÉES (INVENTAIRE EXHAUSTIF)

### 1.1 User Info (TOTALEMENT HARDCODÉ)

| Ligne | Élément | Valeur | Source |
|:------|:--------|:-------|:-------|
| 103 | Initiales | `JD` | HARDCODÉ |
| 105 | Nom | `Jean Dupont` | HARDCODÉ |
| 106 | Plan | `Pro Plan` | HARDCODÉ |

### 1.2 Stats Cards (PARTIELLEMENT DYNAMIQUES)

| Ligne | Élément | Valeur Initiale | ID | Mis à jour par API? |
|:------|:--------|:----------------|:---|:-------------------:|
| 189 | Growth % | `+12%` | - | ❌ |
| 191 | Total Calls | `1,247` | `totalCalls` | ✅ animateValue() |
| 201 | Max Minutes | `/ 2000 min` | - | ❌ |
| 203 | Minutes Used | `1,456` | `minutesUsed` | ✅ animateValue() |
| 207 | Progress Bar | `w-[73%]` | - | ❌ |
| 218 | Conv Trend | `+5%` | `conversionTrend` | ❌ (ID existe mais pas mis à jour) |
| 220 | Conv Rate | `0%` | `conversionRate` | ✅ |
| 232 | NPS | `0` | `npsScore` | ✅ |

### 1.3 Language Distribution (HARDCODÉ EN HTML)

| Ligne | Langue | Valeur | CSS Width | Source |
|:------|:-------|:-------|:----------|:-------|
| 298 | Français | `62%` | `w-[62%]` | HARDCODÉ |
| 307 | Darija | `18%` | `w-[18%]` | HARDCODÉ |
| 316 | Anglais | `12%` | `w-[12%]` | HARDCODÉ |
| 325 | Arabe | `5%` | `w-[5%]` | HARDCODÉ |
| 334 | Espagnol | `3%` | `w-[3%]` | HARDCODÉ |

**Note:** La fonction `updateLanguageChart()` EXISTE mais ne met pas à jour les `w-[XX%]` CSS classes car elle cherche `.h-full` elements mal ciblés.

### 1.4 Billing Section (TOTALEMENT HARDCODÉ)

| Ligne | Élément | Valeur | Source |
|:------|:--------|:-------|:-------|
| 500 | Plan | `Pro` | HARDCODÉ |
| 501 | Prix | `149€/mois` | HARDCODÉ |
| 506 | Minutes extra | `0` | HARDCODÉ |
| 508 | Restantes | `544 min` | HARDCODÉ |
| 512 | Prochaine facture | `149€` | HARDCODÉ |
| 513 | Date facture | `1er Février 2026` | HARDCODÉ |

---

## 2. ARCHITECTURE API

### 2.1 Configuration Client

```javascript
// client.html:590-592
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3004'   // Voice API (PAS db-api!)
  : 'https://api.vocalia.ma';

// Endpoint appelé
fetch(`${API_BASE}/dashboard/metrics`)
```

### 2.2 Endpoint Serveur

```javascript
// voice-api-resilient.cjs:1559-1563
if (req.url === '/dashboard/metrics' && req.method === 'GET') {
  const metrics = getDashboardMetrics();
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(metrics, null, 2));
}
```

### 2.3 Source des Données

```javascript
// voice-api-resilient.cjs:204-217
const dashboardMetrics = {
  totalCalls: 0,           // ← Démarre à 0
  totalMinutes: 0,         // ← Démarre à 0
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

### 2.4 Problèmes Identifiés

| Problème | Impact | Sévérité |
|:---------|:-------|:--------:|
| Données IN-MEMORY | Perdues au restart | 🔴 CRITIQUE |
| Pas de persistence | Pas d'historique | 🔴 CRITIQUE |
| Pas d'auth | Même dashboard pour tous | 🔴 CRITIQUE |
| Pas de tenant ID | Données mélangées | 🔴 CRITIQUE |
| Pas de Google Sheets | Pas synchronisé avec DB | 🟡 MAJEUR |

---

## 3. FLUX DE DONNÉES ACTUEL

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT.HTML                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Valeurs initiales HARDCODÉES:                        │   │
│  │   - Jean Dupont, Pro Plan                            │   │
│  │   - 1,247 appels, 1,456 minutes                      │   │
│  │   - 62% FR, 18% Darija, 12% EN...                    │   │
│  │   - 149€/mois, 544 min restantes                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                         │                                    │
│                         ▼                                    │
│         fetch('localhost:3004/dashboard/metrics')            │
│                         │                                    │
└─────────────────────────┼────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│               VOICE-API-RESILIENT.CJS                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ dashboardMetrics = {                                 │   │
│  │   totalCalls: 0,      ← IN-MEMORY                    │   │
│  │   totalMinutes: 0,    ← Démarre à ZÉRO               │   │
│  │   languageDistribution: { fr:0, en:0... }            │   │
│  │ }                                                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ❌ PAS connecté à Google Sheets                            │
│  ❌ PAS de persistence                                      │
│  ❌ Données perdues au redémarrage                          │
└─────────────────────────────────────────────────────────────┘

RÉSULTAT: Dashboard affiche soit hardcodé, soit 0
```

---

## 4. COMPARAISON ADMIN vs CLIENT

| Aspect | admin.html | client.html |
|:-------|:-----------|:------------|
| **API Port** | 3012 (db-api) ✅ | 3004 (voice-api) ⚠️ |
| **Data Source** | Google Sheets ✅ | In-Memory ❌ |
| **Persistence** | Oui ✅ | Non ❌ |
| **Authentication** | Non ⚠️ | Non ❌ |
| **Tenant Isolation** | Partiel | Aucun |
| **Revenue Data** | Réel depuis DB ✅ | Hardcodé ❌ |
| **Calls Data** | Depuis sessions ✅ | In-memory (0) ❌ |
| **Status** | **CORRIGÉ Session 250.52** | **À CORRIGER** |

---

## 5. PLAN D'ACTION REQUIS

### Phase 1: Connexion à Google Sheets (CRITIQUE)

| # | Tâche | Fichier | Détail |
|:-:|:------|:--------|:-------|
| 1 | Changer API_BASE | client.html:590-592 | → port 3012 (db-api) |
| 2 | Créer endpoint client | db-api.cjs | `/api/db/client/:tenantId/metrics` |
| 3 | Ajouter tenant_id param | client.html | Récupérer depuis URL/session |

### Phase 2: Authentification (CRITIQUE)

| # | Tâche | Fichier | Détail |
|:-:|:------|:--------|:-------|
| 1 | Créer table users | Google Sheets | email, password_hash, tenant_id |
| 2 | Ajouter login flow | client.html | Avant d'afficher dashboard |
| 3 | Session management | db-api.cjs | JWT ou session cookie |

### Phase 3: Suppression Hardcodés (HAUTE)

| Ligne | Élément | Action |
|:------|:--------|:-------|
| 103-106 | User info | Charger depuis session |
| 189, 218 | Trends | Calculer depuis historique |
| 201 | Max minutes | Charger depuis plan tenant |
| 207 | Progress bar | Calculer dynamiquement |
| 298-334 | Language % | IDs + update depuis API |
| 500-513 | Billing | Charger depuis tenant/Stripe |

---

## 6. ÉTAT ACTUEL DES SERVICES

```bash
# Test empirique
curl -s http://localhost:3004/dashboard/metrics | head -20
```

**Résultat attendu si voice-api non démarré:**
```
curl: (7) Failed to connect to localhost port 3004
```

**Résultat si voice-api démarré mais pas d'appels:**
```json
{
  "stats": {
    "totalCalls": 0,
    "minutesUsed": 0,
    "conversionRate": 0,
    "nps": 0
  },
  "charts": {
    "dailyCalls": [],
    "languages": {}
  }
}
```

---

## 7. CONCLUSION

**État actuel:** Le dashboard client est une FAÇADE avec des données hardcodées. L'API existe mais retourne des zéros car les données sont en mémoire et non persistées.

**Risque:** Affiche des fausses informations (1,247 appels hardcodés) au lieu des vraies données (0 appels réels).

**Solution:** Migrer vers db-api (port 3012) comme admin.html et implémenter l'authentification tenant.

---

*Document généré: 01/02/2026 | Session 250.52*
*Méthode: Analyse bottom-up basée sur lecture directe des fichiers*
