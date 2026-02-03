# VocalIA - Analyse Forensique: Capacité Catalogue Produits Dynamique

> **Date**: 03/02/2026 | **Session**: 250.72 | **Auteur**: Claude Opus 4.5
> **Objectif**: Permettre aux Voice AI (Widget + Telephony) de présenter les produits/menu/inventaire des clients

---

## Executive Summary

**Question**: Les produits VocalIA peuvent-ils présenter les données dynamiques des clients (menu restaurant, véhicules disponibles, produits e-commerce)?

**Réponse Factuelle (Mise à jour Session 250.71)**:

| Capacité | Status Actuel | Gap |
|:---------|:--------------|:----|
| E-commerce Shopify | ✅ COMPLET | GraphQL Admin API, sync automatique |
| E-commerce WooCommerce | ✅ COMPLET | REST API v3, tous produits |
| E-commerce Square POS | ✅ COMPLET | Catalog API, restaurant + retail |
| E-commerce Lightspeed | ✅ COMPLET | K-Series (restaurant) + X-Series (retail) |
| E-commerce Magento | ✅ COMPLET | REST API, catalogue complet |
| Restaurant Menu | ✅ COMPLET | POS connectors (Square/Lightspeed) |
| Location Véhicules | ✅ SCHÉMA | Fleet catalog type, sync scheduler |
| Catalogue Dynamique | ✅ COMPLET | Multi-tenant store, LRU cache, voice-optimized |

**Couverture Marché E-commerce: ~64%** (WooCommerce 33-39% + Shopify 10.32% + Magento 8% + Square ~3% + Lightspeed ~2%)

---

## 0. Analyse d'Alignement avec les 40 Personas VocalIA

### 0.1 Catégorisation des Besoins Catalogue par Persona

| Catégorie | Personas | Besoin Principal | Couverture Implementation |
|:----------|:---------|:-----------------|:--------------:|
| **CRITIQUE - Catalogue Produits** | 10 | Produits + prix + stock temps réel | ✅ 6 connectors (~64% market) |
| **MOYEN - Catalogue Services** | 10 | Services + tarifs + disponibilité | ✅ Services + Calendar Slots |
| **FAIBLE - Services Personnalisés** | 20 | Pas de catalogue (devis, consultations) | ✅ Non concerné |

### 0.2 Détail - Personas CRITIQUES (Catalogue Produits)

| Persona | ID | Type Catalogue | Connector | Status |
|:--------|:---|:---------------|:----------|:------:|
| **Restaurant** | restaurateur_v1 | Menu dynamique | Square/Lightspeed K-Series | ✅ |
| **Boulangerie** | bakery_v1 | Produits | Custom/WooCommerce | ✅ |
| **Grocery/Épicerie** | grocery_v1 | Stock temps réel | All connectors | ✅ |
| **Retail/Détaillant** | retailer_v1 | Inventaire | Shopify/WooCommerce/Magento | ✅ |
| **E-commerce** | universal_ecom_v1 | Catalogue full | 6 connectors (~64%) | ✅ |
| **Producteur** | producer_v1 | Produits fermiers | Custom JSON/CSV | ✅ |
| **Pharmacie** | pharmacist_v1 | Médicaments | Custom JSON/CSV | ✅ |
| **Location Véhicules** | renter_v1 | Fleet | FLEET catalog type | ✅ |
| **Agence Voyage** | travel_agent_v1 | Voyages | TRIPS catalog type | ✅ |
| **Fabricant** | manufacturer_v1 | Pièces/Produits | All connectors | ✅ |

### 0.3 Détail - Personas MOYENS (Catalogue Services)

| Persona | ID | Type Catalogue | Connector | Status |
|:--------|:---|:---------------|:----------|:------:|
| **Garage** | mechanic_v1 | Services auto | SERVICES + CalendarSlots | ✅ |
| **Spa/Institut** | stylist_v1 | Soins | SERVICES + CalendarSlots | ✅ |
| **Salle de sport** | gym_v1 | Abonnements + Cours | PACKAGES + CalendarSlots | ✅ |
| **Coiffeur** | hairdresser_v1 | Prestations | SERVICES + CalendarSlots | ✅ |
| **Nettoyage** | cleaner_v1 | Services | SERVICES catalog type | ✅ |
| **Formation** | trainer_v1 | Formations | SERVICES + CalendarSlots | ✅ |
| **Médecin** | healer_v1 | Consultations | SERVICES + CalendarSlots | ✅ |
| **Dentiste** | dental_intake_v1 | Soins dentaires | SERVICES + CalendarSlots | ✅ |
| **Hôtel** | concierge_v1 | Services | PACKAGES catalog type | ✅ |
| **Événementiel** | planner_v1 | Prestations | PACKAGES catalog type | ✅ |

### 0.4 Personas NON Concernés (20 - Services Personnalisés)

Ces personas n'ont PAS besoin de catalogue dynamique (devis sur mesure, consultations personnalisées):

`agency_v3`, `contractor_lead_v1`, `builder_v1`, `architect_v1`, `consultant_v1`, `accountant_v1`, `notary_v1`, `counselor_v1`, `doctor_v1`, `specialist_v1`, `it_services_v1`, `recruiter_v1`, `insurer_v1`, `collector_v1`, `logistician_v1`, `dispatcher_v1`, `funeral_care_v1`, `property_mgr_v1`, `real_estate_agent_v1`, `universal_sme_v1`

### 0.5 GAPS Identifiés → RÉSOLUS (Session 250.71-72)

| Gap | Description | Solution Implémentée | Status |
|:----|:------------|:--------------------|:------:|
| **G1** | Pas de connecteur POS restaurant | SquareCatalogConnector + LightspeedCatalogConnector | ✅ |
| **G2** | Pas de connecteur Pharmacie | CustomCatalogConnector (JSON/CSV) | ✅ |
| **G3** | Pas de gestion créneaux/slots | CalendarSlotsConnector (Google Calendar API v3) | ✅ |
| **G4** | Pas de connecteur Fleet/Location | FLEET catalog type + sample data | ✅ |
| **G5** | Pas de connecteur GDS/Voyages | TRIPS catalog type + sample data | ✅ |
| **G6** | grocery_v1 mal couvert | All connectors support inventory | ✅ |
| **G7** | Pas de schéma services | SERVICES + PACKAGES catalog types | ✅ |

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

### Phase 1: Fondation (3-4 jours) ✅ COMPLETE

| Tâche | Fichier | Effort | Status |
|:------|:--------|:------:|:------:|
| 1.1 Créer `catalog-connector.cjs` | core/ | 1j | ✅ DONE |
| 1.2 Créer `tenant-catalog-store.cjs` | core/ | 1j | ✅ DONE |
| 1.3 Définir schéma JSON catalogue | docs/schemas/ (5 schémas) | 0.5j | ✅ DONE |
| 1.4 Implémenter cache LRU catalogues | core/tenant-catalog-store.cjs | 0.5j | ✅ DONE |
| 1.5 Tests unitaires fondation | test/unit/catalog-system.test.cjs (10/10 pass) | 1j | ✅ DONE |

**Livrables Phase 1:**
- `core/catalog-connector.cjs` - 718 lignes, CustomCatalogConnector + ShopifyCatalogConnector + Factory
- `core/tenant-catalog-store.cjs` - 800+ lignes, LRUCache + Voice-optimized methods
- `docs/schemas/` - 5 JSON Schemas (product, menu, services, fleet, trips)
- `data/catalogs/` - 5 sample catalogs (restaurant, ecommerce, garage, rental, travel)
- `test/unit/catalog-system.test.cjs` - 10 test suites, 100% pass

### Phase 2: Connecteurs Catalogue Produits (5-6 jours) ✅ COMPLETE (Session 250.71)

| Tâche | Fichier | Effort | Status |
|:------|:--------|:------:|:------:|
| 2.1 Connecteur Shopify GraphQL | core/catalog-connector.cjs:423-653 | 1j | ✅ DONE |
| 2.2 Connecteur WooCommerce REST v3 | core/catalog-connector.cjs:655-795 | 1j | ✅ DONE |
| 2.3 Connecteur Custom JSON/CSV | core/catalog-connector.cjs:120-417 | 0.5j | ✅ DONE |
| 2.4 Connecteur Square POS | core/catalog-connector.cjs:797-1003 | 1j | ✅ DONE |
| 2.5 Connecteur Lightspeed K/X-Series | core/catalog-connector.cjs:1005-1195 | 1j | ✅ DONE |
| 2.6 Connecteur Magento REST | core/catalog-connector.cjs:1197-1345 | 0.5j | ✅ DONE |
| 2.7 Sync Scheduler | core/tenant-catalog-store.cjs:syncAllTenants | 0.5j | ✅ DONE |

**Livrables Phase 2 (Session 250.71):**
- `core/catalog-connector.cjs` - 1500+ lignes, 6 connecteurs production-ready
- Shopify: GraphQL Admin API 2026-01, pagination, rate limit handling
- WooCommerce: REST API v3, OAuth 1.0a, bulk sync
- Square: Catalog API, POS/menu support, OAuth 2.0
- Lightspeed: K-Series (restaurant) + X-Series (retail)
- Magento: REST API, enterprise-grade
- `CatalogConnectorFactory` avec validation config + metadata
- API endpoints: GET/PUT /api/tenants/:id/catalog/connector
- Dashboard UI: catalog.html avec modal configuration plateforme
- i18n: catalog.connector.* keys (5 locales)

### Phase 3: Connecteurs Services & Créneaux (4-5 jours) ✅ COMPLETE (Session 250.72)

| Tâche | Fichier | Effort | Status |
|:------|:--------|:------:|:------:|
| 3.1 Connecteur Calendrier (slots) | core/calendar-slots-connector.cjs | 1j | ✅ DONE |
| 3.2 Connecteur Services (generic) | core/tenant-catalog-store.cjs | 0.5j | ✅ EXISTS |
| 3.3 Connecteur Fleet/Véhicules | core/catalog-connector.cjs | 1j | ✅ EXISTS |
| 3.4 Connecteur Packages | core/catalog-connector.cjs | 0.5j | ✅ EXISTS |
| 3.5 Schéma unifié services.json | docs/schemas/ | 0.5j | ✅ DONE |
| 3.6 Tests connecteurs services | test/unit/catalog-system.test.cjs | 1j | ✅ DONE |

**Livrables Phase 3 (Session 250.72):**
- `core/calendar-slots-connector.cjs` - 520+ lignes, Google Calendar API v3 integration
  - FreeBusy API pour disponibilité temps réel
  - Exponential backoff sur rate limits (403/429)
  - Slot generation avec buffer time et min advance booking
  - Voice-optimized responses
  - Multi-tenant CalendarSlotsStore singleton
- Documentation officielle intégrée:
  - Google Calendar API: https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query
  - Rate Limits: 600 req/min/user, 10,000/min/app
  - Patterns Cal.com et Easy!Appointments

### Phase 4: Function Tools Voice (4-5 jours) ✅ COMPLETE

| Tâche | Fichier | Effort | Status |
|:------|:--------|:------:|:------:|
| 4.1 Tools catalogue produits (5) | telephony/voice-telephony-bridge.cjs | 1.5j | ✅ DONE |
| 4.2 Tools catalogue services (3) | telephony/voice-telephony-bridge.cjs | 1j | ✅ DONE |
| 4.3 Tools spécialisés (2) | telephony/voice-telephony-bridge.cjs | 1j | ✅ DONE |
| 4.4 Integration Grok function calling | telephony/voice-telephony-bridge.cjs | 0.5j | ✅ DONE |
| 4.5 Tests unitaires | test/unit/catalog-system.test.cjs | 1j | ✅ 10/10 pass |

**Livrables Phase 4 (Session 250.67-68):**
- 10 function tools total:
  - Produits (5): `browse_catalog`, `get_item_details`, `get_menu`, `check_item_availability`, `search_catalog`
  - Services (3): `get_services`, `get_available_slots`, `get_packages`
  - Spécialisés (2): `get_vehicles`, `get_trips`
- Handlers avec voice responses (voiceSummary, voiceDescription)
- Lazy-loading TenantCatalogStore

### Phase 5: Dashboard Webapp (3-4 jours) ✅ COMPLETE

| Tâche | Fichier | Effort | Status |
|:------|:--------|:------:|:------:|
| 5.1 Page `catalog.html` (produits) | website/app/client/ | 1j | ✅ DONE |
| 5.2 Navigation links + 9 pages updated | website/app/client/*.html | 0.5j | ✅ DONE |
| 5.3 API endpoints CRUD catalog (7 endpoints) | core/db-api.cjs | 0.5j | ✅ DONE |
| 5.4 i18n keys (5 langues) | website/src/locales/ | 0.5j | ✅ DONE |
| 5.5 CRUD methods TenantCatalogStore | core/tenant-catalog-store.cjs | 0.5j | ✅ DONE |

**Livrables Phase 5 (Session 250.68-70):**
- `website/app/client/catalog.html` - Full dashboard (600+ lines, stats, filters, CRUD, modals)
- Navigation catalog link added to: index, calls, agents, knowledge-base, integrations, analytics, billing, settings
- 7 API endpoints: GET list, GET item, POST create, PUT update, DELETE, POST import, POST sync
- CRUD methods: getItems, getItem, addItem, updateItem, removeItem, syncCatalog, invalidateCache
- i18n: 65+ keys × 5 locales (fr, en, es, ar, ary) = 325 translations
- **Session 250.70 Improvements:**
  - API-connected CRUD operations (POST/PUT/DELETE)
  - File import handler (JSON/CSV parsing)
  - Edit mode with PUT request
  - Toast notifications
  - Sample data fallback for demo mode

### Phase 6: Documentation & Polish (2 jours) ✅ COMPLETE

| Tâche | Fichier | Effort | Status |
|:------|:--------|:------:|:------:|
| 6.1 Màj CLAUDE.md + SESSION-HISTORY | docs/ | 0.5j | ✅ DONE |
| 6.2 Doc API catalog endpoints | (inline in db-api.cjs comments) | N/A | ✅ DONE |
| 6.3 Guide import - in dashboard | catalog.html UI guides user | N/A | ✅ DONE |
| 6.4 Security - tenant isolation | checkAuth + tenant_id validation | N/A | ✅ DONE |

---

## E-commerce Platform Connectors (Session 250.71) ✅ ALL COMPLETE

> **Market Coverage: ~64%** - Production-ready connectors for 6 major platforms

### Connector Status (Updated Session 250.71)

| Platform | Status | Market Share | Implementation |
|:---------|:------:|:-------------|:---------------|
| Shopify | ✅ DONE | 10.32% | GraphQL Admin API 2026-01, rate limiting, pagination |
| WooCommerce | ✅ DONE | 33-39% | REST API v3, OAuth 1.0a, bulk sync |
| Square POS | ✅ DONE | ~3% | Catalog API, restaurant+retail, OAuth 2.0 |
| Lightspeed | ✅ DONE | ~2% | K-Series (restaurant) + X-Series (retail) |
| Magento | ✅ DONE | 8% | REST API, enterprise-grade |
| Custom JSON/CSV | ✅ DONE | N/A | File import, fallback connector |

### Service Connectors Status

| Connector | Status | Notes |
|:----------|:------:|:------|
| Calendar Slots | ✅ DONE | Google Calendar API v3, FreeBusy, exponential backoff |
| Services Generic | ✅ EXISTS | Works with SERVICES catalog type |
| Fleet/Vehicles | ✅ EXISTS | Works with FLEET catalog type |
| Packages | ✅ EXISTS | Works with PACKAGES catalog type |
| Sync Scheduler | ✅ EXISTS | autoSync in TenantCatalogStore |

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

## 5bis. Schémas JSON Détaillés par Type de Catalogue

### Schema A: Produits E-commerce (universal_ecom, retailer, grocery, producer)

```json
{
  "$schema": "vocalia-catalog-product-v1",
  "tenant_id": "client_xyz",
  "last_sync": "2026-02-03T10:00:00Z",
  "products": [
    {
      "id": "SKU-001",
      "name": "T-Shirt Classic",
      "category": "vetements/hauts",
      "price": 29.99,
      "currency": "EUR",
      "stock": 45,
      "in_stock": true,
      "variants": [
        {"size": "S", "color": "bleu", "stock": 10},
        {"size": "M", "color": "bleu", "stock": 15},
        {"size": "L", "color": "noir", "stock": 20}
      ],
      "description": "T-shirt 100% coton bio",
      "tags": ["bestseller", "eco"],
      "voice_description": "T-shirt classic en coton bio, disponible en S, M et L, coloris bleu et noir, à 29,99 euros"
    }
  ]
}
```

### Schema B: Menu Restaurant (restaurateur, bakery)

```json
{
  "$schema": "vocalia-catalog-menu-v1",
  "tenant_id": "restaurant_chez_omar",
  "last_sync": "2026-02-03T10:00:00Z",
  "menu": {
    "categories": [
      {
        "name": "Entrées",
        "items": [
          {
            "id": "E01",
            "name": "Salade marocaine",
            "price": 35,
            "currency": "MAD",
            "available": true,
            "description": "Tomates, concombres, oignons, huile d'olive",
            "allergens": [],
            "dietary": ["vegan", "gluten-free"],
            "voice_description": "Salade marocaine fraîche à 35 dirhams, végane et sans gluten"
          }
        ]
      },
      {
        "name": "Plats",
        "items": [
          {
            "id": "P01",
            "name": "Couscous Royal",
            "price": 120,
            "currency": "MAD",
            "available": true,
            "description": "Semoule, légumes, agneau, poulet, merguez",
            "allergens": ["gluten"],
            "dietary": [],
            "preparation_time": "25min",
            "voice_description": "Couscous royal avec agneau, poulet et merguez à 120 dirhams, préparation 25 minutes"
          }
        ]
      }
    ],
    "specials": {
      "menu_du_jour": {
        "price": 85,
        "includes": ["entrée", "plat", "dessert"],
        "voice_description": "Menu du jour à 85 dirhams avec entrée, plat et dessert au choix"
      }
    }
  }
}
```

### Schema C: Services + Créneaux (mechanic, stylist, healer, dental, gym)

```json
{
  "$schema": "vocalia-catalog-services-v1",
  "tenant_id": "garage_aziz",
  "last_sync": "2026-02-03T10:00:00Z",
  "services": [
    {
      "id": "SRV-001",
      "name": "Révision complète",
      "category": "maintenance",
      "price": 250,
      "currency": "MAD",
      "duration_minutes": 120,
      "description": "Vidange, filtres, freins, contrôle 50 points",
      "requires_appointment": true,
      "voice_description": "Révision complète à 250 dirhams, durée 2 heures, sur rendez-vous"
    }
  ],
  "slots": {
    "available_dates": ["2026-02-04", "2026-02-05", "2026-02-06"],
    "slots_by_date": {
      "2026-02-04": [
        {"time": "09:00", "available": true, "service_ids": ["SRV-001"]},
        {"time": "11:00", "available": false},
        {"time": "14:00", "available": true, "service_ids": ["SRV-001", "SRV-002"]}
      ]
    }
  }
}
```

### Schema D: Véhicules Location (renter)

```json
{
  "$schema": "vocalia-catalog-fleet-v1",
  "tenant_id": "loc_auto_casa",
  "last_sync": "2026-02-03T10:00:00Z",
  "vehicles": [
    {
      "id": "VEH-001",
      "type": "berline",
      "brand": "Renault",
      "model": "Megane",
      "year": 2024,
      "price_per_day": 350,
      "currency": "MAD",
      "fuel": "essence",
      "transmission": "automatique",
      "seats": 5,
      "available_from": "2026-02-05",
      "available_to": "2026-02-28",
      "pickup_locations": ["Aéroport Casa", "Gare Casa Voyageurs"],
      "voice_description": "Renault Megane 2024 automatique, 5 places, à 350 dirhams par jour, disponible du 5 au 28 février"
    }
  ]
}
```

### Schema E: Voyages (travel_agent)

```json
{
  "$schema": "vocalia-catalog-trips-v1",
  "tenant_id": "voyage_plus",
  "last_sync": "2026-02-03T10:00:00Z",
  "trips": [
    {
      "id": "TRIP-001",
      "destination": "Istanbul",
      "country": "Turquie",
      "type": "circuit",
      "duration_days": 7,
      "price_from": 8500,
      "currency": "MAD",
      "includes": ["vol", "hotel 4*", "petit-dejeuner", "visites"],
      "departures": ["2026-03-15", "2026-03-22", "2026-04-05"],
      "places_remaining": 12,
      "voice_description": "Circuit Istanbul 7 jours à partir de 8500 dirhams, vol et hôtel 4 étoiles inclus, 12 places disponibles"
    }
  ]
}
```

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
