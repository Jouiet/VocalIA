# VocalIA - Analyse Forensique: Capacité Catalogue Produits Dynamique

> **Date**: 03/02/2026 | **Session**: 250.63 | **Auteur**: Claude Opus 4.5
> **Objectif**: Permettre aux Voice AI (Widget + Telephony) de présenter les produits/menu/inventaire des clients

---

## Executive Summary

**Question**: Les produits VocalIA peuvent-ils présenter les données dynamiques des clients (menu restaurant, véhicules disponibles, produits e-commerce)?

**Réponse Factuelle**:

| Capacité | Status Actuel | Gap |
|:---------|:--------------|:----|
| E-commerce Shopify | ⚠️ PARTIEL | `check_product_stock` existe mais limité (titre, prix, stock) |
| E-commerce 7 plateformes | ✅ MCP Tools | 57 tools disponibles mais NON connectés au Voice |
| Restaurant Menu | ❌ INEXISTANT | KB statique avec templates génériques |
| Location Véhicules | ❌ INEXISTANT | Aucune intégration fleet management |
| Catalogue Dynamique | ❌ INEXISTANT | KB ne sync pas avec sources externes |

---

## 0. Analyse d'Alignement avec les 40 Personas VocalIA

### 0.1 Catégorisation des Besoins Catalogue par Persona

| Catégorie | Personas | Besoin Principal | Couverture Doc |
|:----------|:---------|:-----------------|:--------------:|
| **CRITIQUE - Catalogue Produits** | 10 | Produits + prix + stock temps réel | ⚠️ PARTIEL |
| **MOYEN - Catalogue Services** | 10 | Services + tarifs + disponibilité | ❌ MANQUANT |
| **FAIBLE - Services Personnalisés** | 20 | Pas de catalogue (devis, consultations) | ✅ Non concerné |

### 0.2 Détail - Personas CRITIQUES (Catalogue Produits)

| Persona | ID | Type Catalogue | Données Requises | Status Doc |
|:--------|:---|:---------------|:-----------------|:----------:|
| **Restaurant** | restaurateur_v1 | Menu dynamique | Plats, prix, dispo, allergènes | ⚠️ Mentionné |
| **Boulangerie** | bakery_v1 | Produits | Pains, viennoiseries, commandes | ❌ MANQUANT |
| **Grocery/Épicerie** | grocery_v1 | Stock temps réel | Produits, prix, promos, dispo | ❌ MANQUANT |
| **Retail/Détaillant** | retailer_v1 | Inventaire | Stock, prix, tailles | ⚠️ Partiel |
| **E-commerce** | universal_ecom_v1 | Catalogue full | Tout | ⚠️ Shopify only |
| **Producteur** | producer_v1 | Produits fermiers | Fruits, légumes, dispo | ❌ MANQUANT |
| **Pharmacie** | pharmacist_v1 | Médicaments | Stock, alternatives | ❌ MANQUANT |
| **Location Véhicules** | renter_v1 | Fleet | Véhicules, tarifs, dates dispo | ⚠️ Mentionné |
| **Agence Voyage** | travel_agent_v1 | Voyages | Destinations, prix, dates | ❌ MANQUANT |
| **Fabricant** | manufacturer_v1 | Pièces/Produits | Catalogue, délais | ❌ MANQUANT |

### 0.3 Détail - Personas MOYENS (Catalogue Services)

| Persona | ID | Type Catalogue | Données Requises | Status Doc |
|:--------|:---|:---------------|:-----------------|:----------:|
| **Garage** | mechanic_v1 | Services auto | Prestations, tarifs, créneaux | ❌ MANQUANT |
| **Spa/Institut** | stylist_v1 | Soins | Prestations, prix, durée | ❌ MANQUANT |
| **Salle de sport** | gym_v1 | Abonnements + Cours | Types, horaires, places | ❌ MANQUANT |
| **Coiffeur** | hairdresser_v1 | Prestations | Services, tarifs | ❌ MANQUANT |
| **Nettoyage** | cleaner_v1 | Services | Types, tarifs horaires | ❌ MANQUANT |
| **Formation** | trainer_v1 | Formations | Catalogue, dates, places | ❌ MANQUANT |
| **Médecin** | healer_v1 | Consultations | Spécialités, créneaux | ❌ MANQUANT |
| **Dentiste** | dental_intake_v1 | Soins dentaires | Actes, tarifs, forfaits | ❌ MANQUANT |
| **Hôtel** | concierge_v1 | Services | Room service, activités | ❌ MANQUANT |
| **Événementiel** | planner_v1 | Prestations | Packages, options | ❌ MANQUANT |

### 0.4 Personas NON Concernés (20 - Services Personnalisés)

Ces personas n'ont PAS besoin de catalogue dynamique (devis sur mesure, consultations personnalisées):

`agency_v3`, `contractor_lead_v1`, `builder_v1`, `architect_v1`, `consultant_v1`, `accountant_v1`, `notary_v1`, `counselor_v1`, `doctor_v1`, `specialist_v1`, `it_services_v1`, `recruiter_v1`, `insurer_v1`, `collector_v1`, `logistician_v1`, `dispatcher_v1`, `funeral_care_v1`, `property_mgr_v1`, `real_estate_agent_v1`, `universal_sme_v1`

### 0.5 GAPS Identifiés dans le Document

| Gap | Description | Impact | Priorité |
|:----|:------------|:-------|:--------:|
| **G1** | Pas de connecteur POS restaurant (Square, Lightspeed, etc.) | bakery, restaurateur | P0 |
| **G2** | Pas de connecteur Pharmacie (systèmes officine) | pharmacist | P2 |
| **G3** | Pas de gestion des créneaux/slots services | mechanic, stylist, gym, healer, dental | P1 |
| **G4** | Pas de connecteur Fleet/Location (Rent-a-car systems) | renter | P2 |
| **G5** | Pas de connecteur GDS/Voyages (Amadeus, Sabre) | travel_agent | P2 |
| **G6** | grocery_v1 mal couvert (besoin stock temps réel) | grocery | P1 |
| **G7** | Pas de schéma pour catalogues services (vs produits) | 10 personas | P1 |

---

## 1. Analyse Forensique du Système Actuel

### 1.1 Function Tools Existants (Telephony Bridge)

**Fichier**: `telephony/voice-telephony-bridge.cjs` (3,404 lignes)

| Tool | Ligne | Description | Limitation |
|:-----|:-----:|:------------|:-----------|
| `check_product_stock` | 773 | Recherche produit Shopify par nom | Titre seulement, pas de caractéristiques |
| `check_order_status` | 758 | Statut commande par email | Shopify uniquement |
| `search_knowledge_base` | 898 | Recherche KB statique | Templates génériques, pas de données réelles |
| `get_customer_tags` | 787 | Profil client Klaviyo | CRM, pas catalogue |

**Code de `check_product_stock`** (vérifié):
```javascript
// integrations/voice-ecommerce-tools.cjs:74-108
async checkProductStock(query) {
  const url = `https://${this.shopifyShop}.myshopify.com/admin/api/2026-01/products.json?title=${encodeURIComponent(query)}&limit=3`;
  // Retourne: { title, price, inStock: boolean }
  // ❌ NE RETOURNE PAS: tailles, couleurs, caractéristiques, images
}
```

### 1.2 Knowledge Base Architecture

**Structure Actuelle**:
```
data/knowledge-base/
├── chunks.json              # 107KB - Index global (RAG)
├── tfidf_index.json         # 314KB - TF-IDF pour recherche
├── tenants/
│   └── client_demo/
│       └── fr/
│           ├── chunks.json      # 50KB - KB tenant
│           └── tfidf_index.json # 44KB - Index tenant
```

**Contenu KB Réel** (knowledge_base.json:182):
```json
"restaurateur_v1": {
  "reservations": "Réservation conseillée le week-end...",
  "menu": "Menu du jour à 18€ (entrée-plat ou plat-dessert)",  // ❌ STATIQUE
  "allergenes": "Tous nos plats sont adaptables..."
}
```

**Problème Fondamental**: La KB contient des TEMPLATES génériques, pas les données RÉELLES du client.

### 1.3 MCP Server Tools (Non Connectés au Voice)

**Fichier**: `mcp-server/src/index.ts` - 182 tools

| Plateforme | Tools | Capacités | Status Voice |
|:-----------|:-----:|:----------|:------------:|
| Shopify | 8 | list_orders, get_product, cancel_order... | ❌ Non connecté |
| WooCommerce | 7 | list_products, get_product, update_order | ❌ Non connecté |
| Magento | 10 | list_products, get_stock, list_customers | ❌ Non connecté |
| PrestaShop | 10 | list_products, get_product, get_stock | ❌ Non connecté |
| BigCommerce | 9 | list_products, get_product, update_order | ❌ Non connecté |
| Wix | 6 | list_products, get_inventory | ❌ Non connecté |
| Squarespace | 7 | list_products, get_product, list_inventory | ❌ Non connecté |

**Total**: 57 tools e-commerce existants, AUCUN utilisable par Voice AI.

### 1.4 Schéma d'Architecture Actuel

```
┌─────────────────────────────────────────────────────────────┐
│                    VOICE AI SYSTEM                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ Voice Widget│    │ Telephony   │    │ Grok        │     │
│  │ (Browser)   │    │ Bridge      │    │ Realtime WS │     │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘     │
│         │                  │                   │            │
│         └─────────┬────────┴───────────────────┘            │
│                   │                                          │
│                   ▼                                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            FUNCTION TOOLS (12 tools)                 │   │
│  │  ┌─────────────────┐  ┌───────────────────────┐     │   │
│  │  │check_product_   │  │ search_knowledge_base │     │   │
│  │  │stock (Shopify)  │  │ (RAG statique)        │     │   │
│  │  │❌ Limité: titre │  │ ❌ Templates only     │     │   │
│  │  └─────────────────┘  └───────────────────────┘     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│                   ▼ NON CONNECTÉ                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            MCP SERVER (182 tools)                    │   │
│  │  57 E-commerce tools (list_products, get_product)    │   │
│  │  ❌ Inaccessible depuis Voice Bridge                 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Benchmark Concurrentiel

### 2.1 Solutions Voice AI Commerciales (Recherche Web 03/02/2026)

| Solution | Capacité Catalogue | Architecture |
|:---------|:-------------------|:-------------|
| **SoundHound Amelia 7** | ✅ Menus restaurant, réservations | Function tools + APIs |
| **Square Voice Ordering** | ✅ Menu complet + suggestions | POS intégré |
| **VoicePlug AI** | ✅ Menu + customization | Restaurant-specific |
| **Wendy's FreshAI** | ✅ Menu + upsell | Google Cloud + POS |
| **Bojangles Bo-Linda** | ✅ Menu + paiement | Hi Auto integration |

**Marché**: $10B (2024) → $49B projeté (2029) ([FSR Magazine](https://www.fsrmagazine.com/feature/the-2026-tech-forecast-why-voice-ai-will-become-mission-critical-for-independent-restaurants/))

### 2.2 Repos GitHub Pertinents

| Repo | Stars | Architecture | Pertinence |
|:-----|:-----:|:-------------|:-----------|
| [livekit/agents](https://github.com/livekit/agents) | 5.8K+ | Multi-agent + function tools | ✅ restaurant_agent.py exemple |
| [twilio-realtime-openai-rag](https://github.com/ericrisco/twilio-realtime-openai-rag) | ~50 | Twilio + OpenAI + Product lookup | ✅ Simulated catalog |
| [NVIDIA-AI-Blueprints/ai-virtual-assistant](https://github.com/NVIDIA-AI-Blueprints/ai-virtual-assistant) | 200+ | RAG + product catalog | ✅ Retail template |
| [VoiceRAG](https://github.com/petermartens98/VoiceRAG-AI-Powered-Voice-Assistant-with-Knowledge-Retrieval) | ~100 | ElevenLabs + RAG | ⚠️ Documents, pas produits |

### 2.3 Modèles Hugging Face

| Modèle/Paper | Application | URL |
|:-------------|:------------|:----|
| **Meta-Prod2Vec** | Embeddings produits | [paper](https://huggingface.co/papers/1607.07326) |
| **Item-Language Model** | Recommandation conversationnelle | [paper](https://huggingface.co/papers/2406.02844) |
| **product-embeddings** | Embeddings multimodaux e-commerce | [model](https://huggingface.co/gerardovaldez0113/product-embeddings) |
| **User-LLM** | Préférences utilisateur | [paper](https://huggingface.co/papers/2402.13598) |

---

## 3. Architecture Cible Proposée

### 3.1 Nouveau Schéma

```
┌─────────────────────────────────────────────────────────────────────┐
│                    VOICE AI SYSTEM v2.0                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │ Voice Widget│    │ Telephony   │    │ Grok        │             │
│  │ (Browser)   │    │ Bridge      │    │ Realtime WS │             │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘             │
│         │                  │                   │                    │
│         └─────────┬────────┴───────────────────┘                    │
│                   │                                                  │
│                   ▼                                                  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │            FUNCTION TOOLS (18 tools) ← +6 NEW                │   │
│  │                                                              │   │
│  │  ┌───────────────────┐  ┌───────────────────┐               │   │
│  │  │ browse_catalog    │  │ get_product_      │               │   │
│  │  │ (NEW)             │  │ details (NEW)     │               │   │
│  │  │ ✅ Multi-platform │  │ ✅ Full specs     │               │   │
│  │  └───────────────────┘  └───────────────────┘               │   │
│  │                                                              │   │
│  │  ┌───────────────────┐  ┌───────────────────┐               │   │
│  │  │ get_menu          │  │ check_availability│               │   │
│  │  │ (NEW - Restaurant)│  │ (NEW - All types) │               │   │
│  │  │ ✅ Plats + prix   │  │ ✅ Stock/Date/Slot│               │   │
│  │  └───────────────────┘  └───────────────────┘               │   │
│  │                                                              │   │
│  │  ┌───────────────────┐  ┌───────────────────┐               │   │
│  │  │ search_catalog    │  │ get_recommendations│              │   │
│  │  │ (NEW - Semantic)  │  │ (NEW - AI)        │               │   │
│  │  │ ✅ RAG + Filters  │  │ ✅ Context-aware  │               │   │
│  │  └───────────────────┘  └───────────────────┘               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                   │                                                  │
│                   ▼                                                  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │         CATALOG CONNECTOR LAYER (NEW)                        │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐    │   │
│  │  │ Shopify   │ │ WooComm   │ │ Magento   │ │ Custom    │    │   │
│  │  │ Connector │ │ Connector │ │ Connector │ │ JSON/CSV  │    │   │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘    │   │
│  │                                                              │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐                  │   │
│  │  │ POS Menu  │ │ Fleet API │ │ Calendar  │                  │   │
│  │  │ Connector │ │ Connector │ │ Connector │                  │   │
│  │  └───────────┘ └───────────┘ └───────────┘                  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                   │                                                  │
│                   ▼                                                  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │         TENANT CATALOG STORE (NEW)                           │   │
│  │  data/catalogs/                                              │   │
│  │  ├── {tenant_id}/                                            │   │
│  │  │   ├── products.json    # Cached catalog                   │   │
│  │  │   ├── menu.json        # Restaurant menu                  │   │
│  │  │   ├── vehicles.json    # Fleet inventory                  │   │
│  │  │   ├── sync_status.json # Last sync timestamp              │   │
│  │  │   └── embeddings.bin   # Product embeddings (semantic)    │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Nouveaux Function Tools Proposés (Alignés 40 Personas)

#### Tier 1: Catalogue Produits (10 personas critiques)

| Tool | Personas | Description | Paramètres |
|:-----|:---------|:------------|:-----------|
| `browse_catalog` | retailer, ecom, grocery, producer | Parcourir par catégorie | `category`, `filters`, `limit` |
| `get_product_details` | retailer, ecom, manufacturer | Détails complet produit | `product_id`, `sku` |
| `get_menu` | restaurateur, bakery | Menu/Carte complète | `category`, `dietary` |
| `check_stock` | grocery, pharmacist, retailer | Stock temps réel | `product_id`, `location` |
| `search_catalog` | ALL | Recherche sémantique | `query`, `filters` |

#### Tier 2: Catalogue Services (10 personas moyens)

| Tool | Personas | Description | Paramètres |
|:-----|:---------|:------------|:-----------|
| `get_services` | mechanic, stylist, cleaner, trainer | Liste services + tarifs | `category` |
| `get_slots` | healer, dental, gym, hairdresser | Créneaux disponibles | `service_id`, `date_range` |
| `book_slot` | ALL services | Réserver un créneau | `slot_id`, `client_info` |
| `get_packages` | concierge, planner, gym | Forfaits/Packages | `type` |

#### Tier 3: Catalogue Spécialisés

| Tool | Personas | Description | Paramètres |
|:-----|:---------|:------------|:-----------|
| `get_vehicles` | renter | Flotte disponible | `type`, `dates` |
| `get_trips` | travel_agent | Voyages/Destinations | `destination`, `dates`, `budget` |
| `check_medication` | pharmacist | Stock médicaments | `name`, `dosage` |

#### Récapitulatif Couverture

| Catégorie | Personas Couverts | Tools Requis |
|:----------|:-----------------:|:------------:|
| Produits | 10/10 | 5 tools |
| Services | 10/10 | 4 tools |
| Spécialisés | 3/3 | 3 tools |
| **TOTAL** | **23/40** (58%) | **12 tools** |

*Note: 17 personas (42%) n'ont pas besoin de catalogue dynamique (services personnalisés/sur devis)*

---

## 4. Plan d'Implémentation

### Phase 1: Fondation (3-4 jours)

| Tâche | Fichier | Effort | Dépendance |
|:------|:--------|:------:|:-----------|
| 1.1 Créer `catalog-connector.cjs` | core/ | 1j | - |
| 1.2 Créer `tenant-catalog-store.cjs` | core/ | 1j | - |
| 1.3 Définir schéma JSON catalogue | docs/ | 0.5j | - |
| 1.4 Implémenter cache LRU catalogues | core/ | 0.5j | 1.2 |
| 1.5 Tests unitaires fondation | test/ | 1j | 1.1-1.4 |

### Phase 2: Connecteurs Catalogue Produits (5-6 jours)

| Tâche | Fichier | Effort | Personas Couverts |
|:------|:--------|:------:|:------------------|
| 2.1 Connecteur Shopify (bridge MCP) | core/connectors/shopify.cjs | 1j | universal_ecom, retailer |
| 2.2 Connecteur WooCommerce | core/connectors/woocommerce.cjs | 1j | universal_ecom |
| 2.3 Connecteur Custom JSON/CSV | core/connectors/custom.cjs | 0.5j | ALL (fallback) |
| 2.4 Connecteur Menu POS (Square/Lightspeed) | core/connectors/pos-menu.cjs | 1j | restaurateur, bakery |
| 2.5 Connecteur Grocery (Instacart API model) | core/connectors/grocery.cjs | 1j | grocery |
| 2.6 Sync scheduler (cron-like) | core/catalog-sync.cjs | 0.5j | ALL |
| 2.7 Tests connecteurs | test/catalog-connectors.test.cjs | 1j | - |

### Phase 3: Connecteurs Services & Créneaux (4-5 jours)

| Tâche | Fichier | Effort | Personas Couverts |
|:------|:--------|:------:|:------------------|
| 3.1 Connecteur Calendrier (slots) | core/connectors/calendar-slots.cjs | 1j | healer, dental, mechanic, stylist, hairdresser |
| 3.2 Connecteur Services (generic) | core/connectors/services.cjs | 0.5j | cleaner, trainer, gym |
| 3.3 Connecteur Fleet/Véhicules | core/connectors/fleet.cjs | 1j | renter |
| 3.4 Connecteur Packages | core/connectors/packages.cjs | 0.5j | concierge, planner, gym |
| 3.5 Schéma unifié services.json | docs/schemas/ | 0.5j | ALL services |
| 3.6 Tests connecteurs services | test/service-connectors.test.cjs | 1j | - |

### Phase 4: Function Tools Voice (4-5 jours)

| Tâche | Fichier | Effort | Tools |
|:------|:--------|:------:|:------|
| 4.1 Tools catalogue produits (5) | telephony/ | 1.5j | browse, details, menu, stock, search |
| 4.2 Tools catalogue services (4) | telephony/ | 1j | services, slots, book, packages |
| 4.3 Tools spécialisés (3) | telephony/ | 1j | vehicles, trips, medication |
| 4.4 Integration Grok function calling | telephony/ | 0.5j | - |
| 4.5 Tests E2E Voice + Catalog | test/e2e/ | 1j | - |

### Phase 5: Dashboard Webapp (3-4 jours)

| Tâche | Fichier | Effort | Description |
|:------|:--------|:------:|:------------|
| 5.1 Page `catalog.html` (produits) | website/app/client/ | 1j | Import CSV/JSON, preview, sync |
| 5.2 Page `services.html` (services) | website/app/client/ | 1j | Services + tarifs + slots |
| 5.3 API endpoints CRUD catalog | core/db-api.cjs | 0.5j | /api/catalog/* |
| 5.4 i18n keys (5 langues) | website/src/locales/ | 0.5j | catalog.*, services.* |
| 5.5 Tests E2E Dashboard | test/e2e/ | 0.5j | - |

### Phase 6: Documentation & Polish (2 jours)

| Tâche | Fichier | Effort | Description |
|:------|:--------|:------:|:------------|
| 6.1 Màj CLAUDE.md + SESSION-HISTORY | docs/ | 0.5j | - |
| 6.2 Doc API catalog endpoints | docs/CATALOG-API.md | 0.5j | OpenAPI spec |
| 6.3 Guide import catalogue par persona | docs/CATALOG-IMPORT-GUIDE.md | 0.5j | Templates par secteur |
| 6.4 Audit sécurité + GDPR | - | 0.5j | - |

### Phase 4: Webapp Dashboard (2-3 jours)

| Tâche | Fichier | Effort | Dépendance |
|:------|:--------|:------:|:-----------|
| 4.1 Page `catalog.html` (import/sync) | website/app/client/ | 1j | Phase 2 |
| 4.2 API endpoints CRUD catalog | core/db-api.cjs | 0.5j | Phase 2 |
| 4.3 i18n keys (5 langues) | website/src/locales/ | 0.5j | 4.1 |
| 4.4 Tests Dashboard | test/e2e/ | 0.5j | 4.1-4.3 |

### Phase 5: Documentation & Polish (1-2 jours)

| Tâche | Fichier | Effort | Dépendance |
|:------|:--------|:------:|:-----------|
| 5.1 Màj CLAUDE.md + SESSION-HISTORY | docs/ | 0.5j | Phase 4 |
| 5.2 Doc API catalog endpoints | docs/ | 0.5j | Phase 4 |
| 5.3 Guide import catalogue client | docs/ | 0.5j | Phase 4 |
| 5.4 Audit sécurité + GDPR | - | 0.5j | Phase 4 |

---

## 5. Estimation Totale (Révisée - 40 Personas)

| Phase | Effort | Complexité | Personas Couverts |
|:------|:------:|:-----------|:-----------------:|
| Phase 1: Fondation | 3-4j | Moyenne | Infrastructure |
| Phase 2: Connecteurs Produits | 5-6j | Haute | 10 personas |
| Phase 3: Connecteurs Services | 4-5j | Haute | 10 personas |
| Phase 4: Function Tools Voice | 4-5j | Moyenne | 23 personas |
| Phase 5: Dashboard Webapp | 3-4j | Moyenne | ALL |
| Phase 6: Doc & Polish | 2j | Basse | - |
| **TOTAL** | **21-26 jours** | | **23/40 (58%)** |

### Priorisation Recommandée

| Priorité | Phases | Effort | Personas | ROI |
|:---------|:-------|:------:|:--------:|:---:|
| **P0** | 1 + 2.1-2.4 + 4.1 | 10-12j | 6 personas (restaurant, bakery, ecom, retail) | Haut |
| **P1** | 2.5-2.7 + 3.1-3.2 + 4.2 | 6-8j | +8 personas (grocery, services) | Moyen |
| **P2** | 3.3-3.6 + 4.3 | 4-5j | +3 personas (renter, travel) | Moyen |
| **P3** | 5 + 6 | 5-6j | Dashboard + Docs | Support |

**Recommandation**: Commencer par P0 pour couvrir les cas d'usage les plus demandés (restaurants, e-commerce).

---

## 6. Risques et Mitigations

| Risque | Impact | Probabilité | Mitigation |
|:-------|:------:|:-----------:|:-----------|
| APIs externes rate limits | Haut | Moyen | Cache TTL 5min, fallback local |
| Catalogues volumineux (>10K produits) | Moyen | Faible | Pagination, index sémantique |
| Latence sync temps réel | Moyen | Moyen | Webhooks Shopify, SSE updates |
| Multi-tenant isolation | Haut | Faible | Tenant ID strict, validation |
| GDPR (données produits clients) | Moyen | Faible | Pas de PII dans catalogues |

---

## 7. Métriques de Succès

| Métrique | Cible | Mesure |
|:---------|:------|:-------|
| Latence lookup produit | < 500ms | P95 API response |
| Précision recherche sémantique | > 85% | Top-3 relevance |
| Couverture plateformes | 7+ | Shopify, Woo, Magento, PrestaShop, BigC, Wix, Squarespace |
| Temps import catalogue | < 30s pour 1000 produits | Benchmark |
| Adoption tenants | 50% en 3 mois | Analytics |

---

## 8. Prérequis Techniques

### Dépendances Existantes (Vérifiées)
- ✅ `xlsx` package (pour import Excel)
- ✅ `node-fetch` ou `fetch` natif
- ✅ KB Parser (core/kb-parser.cjs)
- ✅ Tenant KB Loader (core/tenant-kb-loader.cjs)
- ✅ MCP e-commerce tools (57 tools)

### Nouvelles Dépendances (Optionnelles)
- `@google/generative-ai` - Pour embeddings sémantiques (déjà installé)
- Aucune nouvelle dépendance majeure requise

---

## 9. Décision

**Approche Recommandée**: Implémentation Progressive

1. **Phase 1 Immédiate**: Custom JSON/CSV pour POC
2. **Phase 2 Rapide**: Bridge vers MCP Shopify existant
3. **Phase 3 Extension**: Autres connecteurs selon demande client

**ROI Estimé**:
- Restaurants: +26% revenus téléphone (benchmark SoundHound)
- E-commerce: -30% calls support produit
- Location: +15% conversion réservations

---

## Sources

### Recherche Web
- [SoundHound CES 2026](https://www.soundhound.com/newsroom/press-releases/ces-2026-soundhound-ai-unveils-agentic-voice-commerce-for-vehicles-and-tvs-with-ai-agents-that-order-food-make-dinner-reservations-pay-for-parking-and-book-tickets-on-the-go/)
- [Restaurant Tech Trends Q4 2025](https://hostie.ai/resources/restaurant-tech-trends-q4-2025-voice-ai-new-front-door)
- [Square Voice Ordering](https://www.restaurantdive.com/news/square-product-update-voice-ordering-ai-assistant/802331/)
- [FSR Magazine 2026 Tech Forecast](https://www.fsrmagazine.com/feature/the-2026-tech-forecast-why-voice-ai-will-become-mission-critical-for-independent-restaurants/)
- [Microsoft Retail Agentic AI](https://news.microsoft.com/source/2026/01/08/microsoft-propels-retail-forward-with-agentic-ai-capabilities-that-power-intelligent-automation-for-every-retail-function/)
- [Grok Voice Agent API](https://docs.x.ai/docs/guides/voice)

### GitHub
- [livekit/agents](https://github.com/livekit/agents) - Restaurant agent example
- [twilio-realtime-openai-rag](https://github.com/ericrisco/twilio-realtime-openai-rag) - Product catalog search
- [NVIDIA AI Virtual Assistant](https://github.com/NVIDIA-AI-Blueprints/ai-virtual-assistant) - Retail catalog template

### Hugging Face
- [Meta-Prod2Vec](https://huggingface.co/papers/1607.07326) - Product embeddings
- [Item-Language Model](https://huggingface.co/papers/2406.02844) - Conversational recommendation

---

*Document généré: 03/02/2026 | Session 250.63*
*Prochaine étape: Approbation utilisateur avant implémentation*
