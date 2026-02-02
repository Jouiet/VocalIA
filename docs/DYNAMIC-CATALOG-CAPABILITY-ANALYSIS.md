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

### 3.2 Nouveaux Function Tools Proposés

| Tool | Description | Paramètres | Retour |
|:-----|:------------|:-----------|:-------|
| `browse_catalog` | Parcourir le catalogue par catégorie | `category`, `filters`, `limit` | Liste produits avec prix, stock |
| `get_product_details` | Détails complet d'un produit | `product_id` ou `sku` | Nom, prix, tailles, couleurs, stock, description |
| `get_menu` | Menu restaurant complet | `category`, `dietary` | Plats avec prix, ingrédients, allergènes |
| `check_availability` | Disponibilité (produit/véhicule/slot) | `item_type`, `item_id`, `date` | Disponible: oui/non + alternatives |
| `search_catalog` | Recherche sémantique produits | `query`, `category` | Top 5 résultats pertinents |
| `get_recommendations` | Recommandations contextuelles | `context`, `limit` | Produits recommandés |

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

### Phase 2: Connecteurs (4-5 jours)

| Tâche | Fichier | Effort | Dépendance |
|:------|:--------|:------:|:-----------|
| 2.1 Connecteur Shopify (bridge MCP) | core/connectors/ | 1j | Phase 1 |
| 2.2 Connecteur WooCommerce | core/connectors/ | 1j | Phase 1 |
| 2.3 Connecteur Custom JSON/CSV | core/connectors/ | 0.5j | Phase 1 |
| 2.4 Connecteur Menu POS (structure) | core/connectors/ | 1j | Phase 1 |
| 2.5 Sync scheduler (cron-like) | core/ | 0.5j | 2.1-2.4 |
| 2.6 Tests connecteurs | test/ | 1j | 2.1-2.5 |

### Phase 3: Function Tools Voice (3-4 jours)

| Tâche | Fichier | Effort | Dépendance |
|:------|:--------|:------:|:-----------|
| 3.1 Ajouter `browse_catalog` tool | telephony/ | 0.5j | Phase 2 |
| 3.2 Ajouter `get_product_details` tool | telephony/ | 0.5j | Phase 2 |
| 3.3 Ajouter `get_menu` tool | telephony/ | 0.5j | Phase 2 |
| 3.4 Ajouter `check_availability` tool | telephony/ | 0.5j | Phase 2 |
| 3.5 Ajouter `search_catalog` tool (RAG) | telephony/ | 1j | Phase 2 |
| 3.6 Tests E2E Voice + Catalog | test/e2e/ | 1j | 3.1-3.5 |

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

## 5. Estimation Totale

| Phase | Effort | Complexité |
|:------|:------:|:-----------|
| Phase 1: Fondation | 3-4j | Moyenne |
| Phase 2: Connecteurs | 4-5j | Haute |
| Phase 3: Function Tools | 3-4j | Moyenne |
| Phase 4: Dashboard | 2-3j | Basse |
| Phase 5: Doc & Polish | 1-2j | Basse |
| **TOTAL** | **13-18 jours** | |

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
