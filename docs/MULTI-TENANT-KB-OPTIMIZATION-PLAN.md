# Plan d'Optimisation Multi-Tenant KB & Voice Telephony

> **Session 250.57** | 02/02/2026 | Analyse Exhaustive
> **Exigence Clé**: Chaque client = son propre Knowledge Base personnalisé

---

## 1. Architecture Actuelle (GAPS IDENTIFIÉS)

### 1.1 Knowledge Base - État Actuel

```
┌─────────────────────────────────────────────────────────────────┐
│  ARCHITECTURE ACTUELLE (STATIQUE)                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  telephony/                                                     │
│  ├── knowledge_base.json      ← 40 personas FR (UNIVERSEL)     │
│  ├── knowledge_base_en.json   ← 40 personas EN (UNIVERSEL)     │
│  ├── knowledge_base_es.json   ← 40 personas ES (UNIVERSEL)     │
│  ├── knowledge_base_ar.json   ← 40 personas AR (UNIVERSEL)     │
│  └── knowledge_base_ary.json  ← 40 personas ARY (UNIVERSEL)    │
│                                                                 │
│  data/knowledge-base/                                           │
│  ├── chunks.json              ← Index BM25 (GLOBAL)             │
│  └── tfidf_index.json         ← Vocabulaire (GLOBAL)            │
│                                                                 │
│  ❌ PROBLÈME: Chargement statique au démarrage                  │
│  ❌ PROBLÈME: Pas de KB par client                              │
│  ❌ PROBLÈME: Pas de merge client + universel                   │
│  ❌ PROBLÈME: Pas de hot-reload                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Code Problématique

```javascript
// telephony/voice-telephony-bridge.cjs:76-82 (STATIQUE)
const KNOWLEDGE_BASES = {
  fr: require('./knowledge_base.json'),      // ❌ Loaded at startup
  en: require('./knowledge_base_en.json'),   // ❌ Same for ALL clients
  es: require('./knowledge_base_es.json'),
  ar: require('./knowledge_base_ar.json'),
  ary: require('./knowledge_base_ary.json')
};
```

---

## 2. Architecture Cible (MULTI-TENANT)

### 2.1 Structure de Fichiers Proposée

```
clients/
├── {tenant_id}/
│   ├── config.json                    ← Configuration client
│   ├── credentials.enc               ← Secrets chiffrés (AES-256)
│   └── knowledge_base/
│       ├── kb_fr.json                ← KB client FR (OVERRIDE)
│       ├── kb_en.json                ← KB client EN (OVERRIDE)
│       ├── kb_es.json                ← KB client ES (OVERRIDE)
│       ├── kb_ar.json                ← KB client AR (OVERRIDE)
│       ├── kb_ary.json               ← KB client ARY (OVERRIDE)
│       └── custom_personas.json      ← Personas custom client
│
telephony/
├── knowledge_base.json               ← KB UNIVERSEL (fallback)
└── knowledge_base_{lang}.json        ← KB UNIVERSEL par langue

data/knowledge-base/
├── global/                           ← Index global
│   ├── chunks.json
│   └── tfidf_index.json
└── tenants/
    └── {tenant_id}/                  ← Index par client
        ├── chunks.json
        └── tfidf_index.json
```

### 2.2 Logique de Merge (Priorité)

```
┌─────────────────────────────────────────────────────────────────┐
│  CHAÎNE DE RÉSOLUTION KB (PRIORITÉ DÉCROISSANTE)                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. KB Client [langue demandée]                                 │
│     └── clients/{tenant_id}/knowledge_base/kb_{lang}.json      │
│                                                                 │
│  2. KB Client [langue par défaut du client]                     │
│     └── clients/{tenant_id}/knowledge_base/kb_{default}.json   │
│                                                                 │
│  3. KB Universel [langue demandée]                              │
│     └── telephony/knowledge_base_{lang}.json                   │
│                                                                 │
│  4. KB Universel [FR] (fallback ultime)                         │
│     └── telephony/knowledge_base.json                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Optimisations KB Proposées

### 3.1 P0 - CRITIQUE: Per-Tenant KB Loading

| # | Tâche | Fichier | Effort | Impact |
|:-:|:------|:--------|:------:|:------:|
| 1 | Créer TenantKBLoader class | `core/tenant-kb-loader.cjs` | 2h | 🔴 CRITIQUE |
| 2 | Ajouter cache LRU pour KB | `core/tenant-kb-loader.cjs` | 1h | 🔴 CRITIQUE |
| 3 | Hot-reload KB sans restart | `core/tenant-kb-loader.cjs` | 2h | 🔴 CRITIQUE |
| 4 | Modifier handleSearchKB | `telephony/voice-telephony-bridge.cjs` | 1h | 🔴 CRITIQUE |

**Code Proposé - TenantKBLoader:**

```javascript
// core/tenant-kb-loader.cjs
class TenantKBLoader {
  constructor() {
    this.cache = new Map();  // LRU cache
    this.maxCacheSize = 100;
    this.cacheTTL = 5 * 60 * 1000;  // 5 min
  }

  async getKB(tenantId, language) {
    const cacheKey = `${tenantId}:${language}`;

    // 1. Check cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTTL) {
        return cached.data;
      }
    }

    // 2. Load with priority chain
    const kb = await this.loadWithFallback(tenantId, language);

    // 3. Cache result
    this.cache.set(cacheKey, { data: kb, timestamp: Date.now() });

    return kb;
  }

  async loadWithFallback(tenantId, lang) {
    const paths = [
      `clients/${tenantId}/knowledge_base/kb_${lang}.json`,      // P1: Client[lang]
      `clients/${tenantId}/knowledge_base/kb_fr.json`,           // P2: Client[default]
      `telephony/knowledge_base_${lang}.json`,                   // P3: Universal[lang]
      `telephony/knowledge_base.json`                            // P4: Universal[fr]
    ];

    for (const p of paths) {
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
      }
    }
    return {};
  }

  invalidateCache(tenantId) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(tenantId + ':')) {
        this.cache.delete(key);
      }
    }
  }
}
```

### 3.2 P0 - CRITIQUE: KB Management API

| # | Endpoint | Method | Description |
|:-:|:---------|:-------|:------------|
| 1 | `/api/tenants/{id}/kb` | GET | Lister toutes les entrées KB |
| 2 | `/api/tenants/{id}/kb` | POST | Ajouter entrée KB |
| 3 | `/api/tenants/{id}/kb/{key}` | PUT | Modifier entrée KB |
| 4 | `/api/tenants/{id}/kb/{key}` | DELETE | Supprimer entrée KB |
| 5 | `/api/tenants/{id}/kb/import` | POST | Import bulk (CSV/JSON) |
| 6 | `/api/tenants/{id}/kb/rebuild-index` | POST | Rebuild TF-IDF index |

### 3.3 P1 - IMPORTANT: Per-Tenant TF-IDF Index

```javascript
// Rebuild index pour un tenant spécifique
async function rebuildTenantIndex(tenantId) {
  const indexDir = `data/knowledge-base/tenants/${tenantId}`;
  fs.mkdirSync(indexDir, { recursive: true });

  // 1. Charger KB client
  const clientKB = await loadClientKB(tenantId);

  // 2. Merger avec KB universel
  const mergedKB = mergeKnowledgeBases(clientKB, universalKB);

  // 3. Construire chunks
  const chunks = buildChunks(mergedKB);

  // 4. Construire TF-IDF index
  const index = new TFIDFIndex();
  index.buildFromChunks(chunks);

  // 5. Sauvegarder
  fs.writeFileSync(`${indexDir}/chunks.json`, JSON.stringify(chunks));
  fs.writeFileSync(`${indexDir}/tfidf_index.json`, JSON.stringify(index.toJSON()));
}
```

---

## 4. Optimisations Personas

### 4.1 Custom Personas par Client

**Structure proposée:**

```json
// clients/{tenant_id}/knowledge_base/custom_personas.json
{
  "my_salon_v1": {
    "id": "my_salon_v1",
    "name": "Sarah - Mon Salon de Beauté",
    "voice": "nova",
    "extends": "stylist_v1",  // ← Hérite du persona universel
    "overrides": {
      "business_name": "Salon Élégance",
      "address": "45 Rue Mohammed V, Casablanca",
      "phone": "+212 5 22 XX XX XX",
      "services": ["Coiffure", "Maquillage", "Ongles", "Hammam"],
      "opening_hours": "Mar-Sam 9h-19h"
    },
    "custom_knowledge": {
      "promotions": "Offre découverte: -20% sur le premier soin",
      "team": "Équipe de 5 stylistes professionnels",
      "parking": "Parking gratuit devant le salon"
    }
  }
}
```

### 4.2 Persona Inheritance System

```javascript
// Merge persona universel + custom client
function resolvePersona(universalPersona, customPersona) {
  if (!customPersona) return universalPersona;

  return {
    ...universalPersona,
    ...customPersona,
    // Deep merge knowledge
    knowledge: {
      ...(universalPersona.knowledge || {}),
      ...(customPersona.custom_knowledge || {}),
      ...(customPersona.overrides || {})
    },
    // Keep universal system prompt, inject client data
    systemPrompt: injectClientData(
      universalPersona.systemPrompt,
      customPersona.overrides
    )
  };
}
```

---

## 5. Optimisations Voice Telephony

### 5.1 Latency Optimizations

| # | Optimisation | Gain Estimé | Effort |
|:-:|:-------------|:-----------:|:------:|
| 1 | **Audio Streaming** (chunked response) | -500ms | 4h |
| 2 | **KB Pre-warming** au début d'appel | -200ms | 2h |
| 3 | **TTS Caching** (phrases fréquentes) | -800ms | 3h |
| 4 | **LLM Response Streaming** | -1000ms | 4h |
| 5 | **Parallel STT+KB lookup** | -300ms | 2h |

### 5.2 Audio Streaming Implementation

```javascript
// Streaming TTS au lieu d'attendre la réponse complète
async function streamTTSResponse(text, language, ws) {
  const sentences = splitIntoSentences(text);

  for (const sentence of sentences) {
    const audio = await generateTTS(sentence, language);
    ws.send(JSON.stringify({ type: 'audio_chunk', data: audio }));
    // Client peut commencer à jouer pendant génération suivante
  }

  ws.send(JSON.stringify({ type: 'audio_complete' }));
}
```

### 5.3 TTS Phrase Caching

```javascript
// Cache les phrases fréquentes (greetings, closings, etc.)
const TTS_CACHE = new Map();

async function getCachedTTS(text, language, voice) {
  const key = `${language}:${voice}:${hash(text)}`;

  if (TTS_CACHE.has(key)) {
    return TTS_CACHE.get(key);
  }

  const audio = await elevenLabsClient.generateSpeech(text, voice);
  TTS_CACHE.set(key, audio);

  return audio;
}

// Pre-cache common phrases
const COMMON_PHRASES = {
  fr: ['Bonjour', 'Merci', 'Au revoir', 'Un instant s\'il vous plaît'],
  en: ['Hello', 'Thank you', 'Goodbye', 'One moment please'],
  // ... autres langues
};
```

### 5.4 Per-Language Voice Quality

| Langue | TTS Provider | Voice ID | Latence Cible |
|:-------|:-------------|:---------|:-------------:|
| FR | Twilio/ElevenLabs | fr-FR-Neural | <1s |
| EN | Twilio/ElevenLabs | en-US-Neural | <1s |
| ES | Twilio/ElevenLabs | es-ES-Neural | <1s |
| AR | ElevenLabs | ar-SA | <1.5s |
| **ARY** | **ElevenLabs Ghizlane** | `OfGMGmhShO8iL9jCkXy8` | <1.5s |

---

## 6. KB Content Structure (Per-Client)

### 6.1 Template KB Client

```json
// clients/{tenant_id}/knowledge_base/kb_fr.json
{
  "__meta": {
    "tenant_id": "salon_elegance",
    "version": "1.0.0",
    "last_updated": "2026-02-02T00:00:00Z",
    "default_language": "fr",
    "persona": "my_salon_v1"
  },

  "business_info": {
    "name": "Salon Élégance",
    "address": "45 Rue Mohammed V, Casablanca",
    "phone": "+212 5 22 XX XX XX",
    "email": "contact@salon-elegance.ma",
    "website": "www.salon-elegance.ma"
  },

  "horaires": {
    "response": "Nous sommes ouverts du mardi au samedi de 9h à 19h.",
    "details": {
      "lundi": "Fermé",
      "mardi": "09:00-19:00",
      "mercredi": "09:00-19:00",
      "jeudi": "09:00-21:00",
      "vendredi": "09:00-19:00",
      "samedi": "09:00-19:00",
      "dimanche": "Fermé"
    }
  },

  "services": {
    "response": "Nous proposons coiffure, maquillage, ongles et hammam.",
    "catalogue": [
      { "nom": "Coupe femme", "prix": 250, "duree": 45 },
      { "nom": "Coloration", "prix": 400, "duree": 90 },
      { "nom": "Brushing", "prix": 150, "duree": 30 },
      { "nom": "Maquillage", "prix": 300, "duree": 60 },
      { "nom": "Hammam", "prix": 200, "duree": 60 }
    ]
  },

  "tarifs": {
    "response": "Nos prix varient selon le service. Coupe femme à partir de 250 DH.",
    "currency": "MAD"
  },

  "promotions": {
    "response": "Offre découverte: -20% sur votre premier soin!",
    "conditions": "Valable une fois par nouveau client"
  },

  "rdv": {
    "response": "Je peux vous proposer un rendez-vous. Quel service souhaitez-vous?",
    "booking_url": "https://calendly.com/salon-elegance",
    "min_notice": "2h"
  },

  "faq": {
    "parking": "Parking gratuit devant le salon.",
    "paiement": "Nous acceptons espèces, carte bancaire et CMI.",
    "annulation": "Annulation gratuite jusqu'à 2h avant le rendez-vous."
  }
}
```

### 6.2 Multi-Language Client KB

```
clients/salon_elegance/knowledge_base/
├── kb_fr.json     ← KB principal (Français)
├── kb_ar.json     ← Traduction Arabe MSA
└── kb_ary.json    ← Traduction Darija
```

---

## 7. API Endpoints à Implémenter

### 7.1 KB Management

```
# CRUD Knowledge Base
GET    /api/tenants/{id}/kb                 → List all KB entries
POST   /api/tenants/{id}/kb                 → Add KB entry
PUT    /api/tenants/{id}/kb/{key}           → Update KB entry
DELETE /api/tenants/{id}/kb/{key}           → Delete KB entry

# Bulk Operations
POST   /api/tenants/{id}/kb/import          → Import from CSV/JSON
POST   /api/tenants/{id}/kb/export          → Export to JSON
POST   /api/tenants/{id}/kb/translate       → Auto-translate to other langs

# Index Management
POST   /api/tenants/{id}/kb/rebuild-index   → Rebuild TF-IDF index
GET    /api/tenants/{id}/kb/search          → Test search query
```

### 7.2 Persona Management

```
# Custom Personas
GET    /api/tenants/{id}/personas           → List client personas
POST   /api/tenants/{id}/personas           → Create custom persona
PUT    /api/tenants/{id}/personas/{pid}     → Update persona
DELETE /api/tenants/{id}/personas/{pid}     → Delete persona

# Persona Testing
POST   /api/tenants/{id}/personas/{pid}/test → Test persona with sample query
```

---

## 8. Dashboard Intégration

### 8.1 KB Editor (Client Portal)

| Feature | Description |
|:--------|:------------|
| **Visual Editor** | WYSIWYG pour éditer KB sans JSON |
| **Import CSV** | Upload fichier CSV pour bulk import |
| **Auto-Translate** | Bouton "Traduire en AR/ARY" |
| **Preview** | Test chatbot avec KB avant publication |
| **Version History** | Historique des changements KB |

### 8.2 Analytics KB

| Métrique | Description |
|:---------|:------------|
| **Top Queries** | Questions les plus fréquentes |
| **Miss Rate** | % de questions sans réponse KB |
| **Language Distribution** | Répartition par langue |
| **Response Time** | Latence moyenne KB search |

---

## 9. Plan d'Implémentation

### Phase 1: Core Infrastructure (P0) - 2 jours

| # | Tâche | Fichier | Status |
|:-:|:------|:--------|:------:|
| 1 | Créer TenantKBLoader | `core/tenant-kb-loader.cjs` | ✅ DONE |
| 2 | Modifier handleSearchKB | `telephony/voice-telephony-bridge.cjs` | ✅ DONE |
| 3 | Créer structure dossiers clients | `clients/{id}/knowledge_base/` | ✅ DONE |
| 4 | KB cache LRU + hot-reload | `core/tenant-kb-loader.cjs` | ✅ DONE |

### Phase 2: API Endpoints (P0) - 1 jour

| # | Tâche | Fichier | Status |
|:-:|:------|:--------|:------:|
| 5 | KB CRUD endpoints | `core/db-api.cjs` | ✅ DONE |
| 6 | KB search endpoint | `core/db-api.cjs` | ✅ DONE |
| 7 | KB stats endpoint | `core/db-api.cjs` | ✅ DONE |
| 7b | KB Import bulk endpoint | `core/db-api.cjs` | ✅ DONE |
| 7c | KB Rebuild index endpoint | `core/db-api.cjs` | ✅ DONE |
| 7d | KB Quota endpoint | `core/db-api.cjs` | ✅ DONE |
| 7e | KB Crawl endpoint | `core/db-api.cjs` | ✅ DONE |

### Phase 3: Dashboard UI (P1) - 2 jours

| # | Tâche | Fichier | Status |
|:-:|:------|:--------|:------:|
| 8 | KB Editor page | `website/app/client/knowledge-base.html` | ✅ DONE |
| 9 | Import modal (JSON/CSV) | `website/app/client/knowledge-base.html` | ✅ DONE |
| 10 | Preview/Test chatbot | `website/app/client/knowledge-base.html` | ✅ DONE |
| 10b | Quota display UI | `website/app/client/knowledge-base.html` | ✅ DONE |
| 10c | Web crawler modal | `website/app/client/knowledge-base.html` | ✅ DONE |

### Phase 5: Advanced Features (NEW)

| # | Tâche | Fichier | Status |
|:-:|:------|:--------|:------:|
| 16 | KB Multi-format parser | `core/kb-parser.cjs` | ✅ DONE |
| 17 | Web crawler KB extractor | `core/kb-crawler.cjs` | ✅ DONE |
| 18 | Quota management system | `core/kb-quotas.cjs` | ✅ DONE |
| 19 | Plan-based limits (free/starter/pro/enterprise) | `core/kb-quotas.cjs` | ✅ DONE |

### Phase 4: Voice Optimizations (P1) - 1 jour

| # | Tâche | Fichier | Status |
|:-:|:------|:--------|:------:|
| 11 | TTS phrase caching | `core/elevenlabs-client.cjs` | ✅ DONE |
| 12 | optimize_streaming_latency=3 | `core/elevenlabs-client.cjs` | ✅ DONE |
| 13 | Flash v2.5 model for streaming | `core/elevenlabs-client.cjs` | ✅ DONE |
| 14 | Low-latency voice settings | `core/elevenlabs-client.cjs` | ✅ DONE |
| 15 | preCacheCommonPhrases() | `core/elevenlabs-client.cjs` | ✅ DONE |

---

## 10. Vérification Empirique

```bash
# 1. Vérifier structure client KB
ls -la clients/client_demo/knowledge_base/

# 2. Tester chargement KB
node -e "
const TenantKBLoader = require('./core/tenant-kb-loader.cjs');
const loader = new TenantKBLoader();
loader.getKB('client_demo', 'fr').then(console.log);
"

# 3. Tester API KB
curl -X POST http://localhost:3013/api/tenants/client_demo/kb \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key": "horaires", "value": {"response": "Ouvert 9h-18h"}}'

# 4. Tester recherche
curl http://localhost:3013/api/tenants/client_demo/kb/search?q=horaires
```

---

---

## 11. Benchmarks Industry (Sources Vérifiées)

### 11.1 Comparaison Concurrents Voice AI 2026

| Platform | KB Architecture | Latence | Pricing | Source |
|:---------|:----------------|:-------:|:--------|:-------|
| **Vapi** | Query Tool + CSV import | <600ms | ~$0.05/min + LLM/TTS | [Retell Blog](https://www.retellai.com/blog/vapi-ai-review) |
| **Retell** | Native multi-turn KB | ~800ms | $0.07/min flat | [Retell Blog](https://www.retellai.com/blog/vapi-ai-review) |
| **Bland AI** | Self-hosted + fine-tuned | Low | $0.09/min | [Bland Blog](https://www.bland.ai/blogs/bland-ai-vs-retell-vs-vapi-vs-air) |
| **VocalIA** | BM25 + tenant KB merge | TBD | $0.08-0.12/min | Internal |

> **Différenciateur VocalIA**: Multi-tenant natif + 5 langues (incl. Darija) + per-tenant KB merge

### 11.2 RAG Best Practices 2025-2026

| Technique | Recommandation | Source |
|:----------|:---------------|:-------|
| **Hybrid Retrieval** | BM25 (30%) + Embeddings (70%) | [Medium - RAG Techniques](https://medium.com/@siddharth_58896/rag-techniques-bm25-vs-dense-retrievers-a-complete-practical-guide-b1302ee35b7b) |
| **Reranking** | BM25 top-1000 → LLM rerank | [From BM25 to Agentic RAG](https://interestingengineering.substack.com/p/from-bm25-to-agentic-rag-the-evolution) |
| **Storage** | BM25 = 100x moins de stockage vs embeddings | [RAGFlow 2025 Review](https://ragflow.io/blog/rag-review-2025-from-rag-to-context) |
| **Domain Text** | BM25 > embeddings pour logs, legal, finance | [Neo4j Advanced RAG](https://neo4j.com/blog/genai/advanced-rag-techniques/) |

> **Conclusion**: Notre stack BM25 actuel est VALIDE. Ajouter hybrid retrieval (embeddings 70%) en P2.

### 11.3 ElevenLabs Latency Optimization

| Paramètre | Valeur | Gain | Source |
|:----------|:-------|:-----|:-------|
| `optimize_streaming_latency` | 4 (max) | -50% latence | [ElevenLabs Docs](https://elevenlabs.io/docs/developers/best-practices/latency-optimization) |
| Flash v2.5 model | TTFB 135ms | -75% vs standard | [ElevenLabs Blog](https://elevenlabs.io/blog/how-do-you-optimize-latency-for-conversational-ai) |
| Geographic routing | `api-global-preview.elevenlabs.io` | Variable | [ElevenLabs Docs](https://elevenlabs.io/docs/developers/best-practices/latency-optimization) |
| WebSocket input streaming | Text chunks pendant génération | -500ms+ | [ElevenLabs TTS Pipelines](https://elevenlabs.io/blog/enhancing-conversational-ai-latency-with-efficient-tts-pipelines) |
| Premade voices | Vs cloned voices | -200ms | [ElevenLabs Docs](https://elevenlabs.io/docs/developers/best-practices/latency-optimization) |

### 11.4 Darija ASR Models (HuggingFace)

| Model | Type | Status | Source |
|:------|:-----|:-------|:-------|
| `speechbrain/asr-wav2vec2-dvoice-darija` | ASR | ⚠️ Inactif 2022 | [HuggingFace](https://huggingface.co/speechbrain/asr-wav2vec2-dvoice-darija) |
| `aioxlabs/dvoice-darija` | ASR | ⚠️ Inactif 2022 | [HuggingFace](https://huggingface.co/aioxlabs/dvoice-darija) |
| `medmac01/Darija-Arabic-TTS` | TTS | ✅ Actif | [HuggingFace Space](https://huggingface.co/spaces/medmac01/Darija-Arabic-TTS) |
| **ElevenLabs Scribe** | STT | ✅ PRODUCTION | [ElevenLabs](https://elevenlabs.io/speech-to-text) |

> **Recommandation**: ElevenLabs Scribe (Maghrebi) reste le meilleur choix STT Darija production.

### 11.5 Voice RAG Implementations (GitHub)

| Repo | Features | Stars | Source |
|:-----|:---------|:-----:|:-------|
| **petermartens98/VoiceRAG** | ElevenLabs + Supabase + n8n | Active | [GitHub](https://github.com/petermartens98/VoiceRAG-AI-Powered-Voice-Assistant-with-Knowledge-Retrieval) |
| **Azure VoiceRAG** | Azure AI Search + GPT-4o Realtime | Official | [GitHub](https://github.com/Azure-Samples/aisearch-openai-rag-audio) |
| **livekit-rag-voice-agent** | LiveKit + LangChain + Multiple VectorDBs | Active | [GitHub](https://github.com/Arjunheregeek/livekit-rag-voice-agent) |
| **ragieai/basechat** | Multi-tenant RAG + Organization KB | Active | [GitHub](https://github.com/ragieai/basechat) |

### 11.6 Multi-Tenant AI Architecture (Microsoft)

| Approach | Use Case | Data Isolation | Source |
|:---------|:---------|:---------------|:-------|
| **Tenant-specific models** | Sensitive data | ✅ Full | [Azure Docs](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/approaches/ai-ml) |
| **Shared models** | Common use cases | ⚠️ Shared | [Azure Docs](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/approaches/ai-ml) |
| **Tuned shared models** | Hybrid approach | 🟡 Semi | [Azure Docs](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/approaches/ai-ml) |

> **Notre choix**: Shared KB universelle + Tenant-specific KB overlay = meilleur des deux mondes

---

## 12. Optimisations ElevenLabs Spécifiques

### 12.1 Configuration Optimale TTS

```javascript
// core/elevenlabs-client.cjs - OPTIMISATIONS À AJOUTER
const ELEVENLABS_CONFIG = {
  // Latency optimization (0-4, 4 = max speed)
  optimize_streaming_latency: 4,

  // Model selection
  model_id: 'eleven_flash_v2_5',  // 135ms TTFB vs 400ms+ standard

  // Geographic routing
  baseUrl: 'https://api-global-preview.elevenlabs.io',

  // Streaming config
  output_format: 'pcm_22050',  // Lower quality = lower latency
  chunk_length_schedule: [50, 100, 150, 200],  // Progressive chunks

  // Voice settings for speed
  voice_settings: {
    stability: 0.5,      // Lower = faster
    similarity_boost: 0.75,
    style: 0,            // Disable style for speed
    use_speaker_boost: false
  }
};
```

### 12.2 WebSocket Input Streaming

```javascript
// Streaming text to ElevenLabs pendant LLM génère
async function streamToElevenLabs(textStream, voiceId) {
  const ws = new WebSocket('wss://api.elevenlabs.io/v1/text-to-speech/' + voiceId + '/stream-input');

  ws.on('open', () => {
    ws.send(JSON.stringify({
      text: ' ',  // Initial space
      voice_settings: ELEVENLABS_CONFIG.voice_settings,
      generation_config: { chunk_length_schedule: [50] }
    }));
  });

  // Stream LLM output word by word
  for await (const word of textStream) {
    ws.send(JSON.stringify({ text: word + ' ' }));
  }

  // Signal end
  ws.send(JSON.stringify({ text: '' }));
}
```

---

## 13. Hybrid RAG Implementation

### 13.1 Architecture Proposée

```javascript
// core/hybrid-rag.cjs - NOUVEAU FICHIER
class HybridRAG {
  constructor(tenantId) {
    this.tenantId = tenantId;
    this.bm25 = new TFIDFIndex();
    this.embeddings = null;  // Lazy load
    this.weights = { bm25: 0.3, embeddings: 0.7 };
  }

  async search(query, topK = 5) {
    // 1. BM25 search (fast, keyword-based)
    const bm25Results = this.bm25.search(query, topK * 2);

    // 2. Embedding search (semantic)
    let embeddingResults = [];
    if (this.embeddings) {
      const queryEmbedding = await this.getEmbedding(query);
      embeddingResults = this.embeddings.search(queryEmbedding, topK * 2);
    }

    // 3. Reciprocal Rank Fusion (RRF)
    const fused = this.reciprocalRankFusion(bm25Results, embeddingResults);

    return fused.slice(0, topK);
  }

  reciprocalRankFusion(bm25Results, embeddingResults, k = 60) {
    const scores = new Map();

    bm25Results.forEach((doc, i) => {
      const rrf = 1 / (k + i + 1);
      scores.set(doc.id, (scores.get(doc.id) || 0) + this.weights.bm25 * rrf);
    });

    embeddingResults.forEach((doc, i) => {
      const rrf = 1 / (k + i + 1);
      scores.set(doc.id, (scores.get(doc.id) || 0) + this.weights.embeddings * rrf);
    });

    return [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, score]) => ({ id, score }));
  }
}
```

---

## 14. Statistiques Marché 2026

| Métrique | Valeur | Source |
|:---------|:-------|:-------|
| Customer interactions with AI | 70% by 2026 | Gartner |
| Voice AI inflection point | 2026 | [Vellum](https://www.vellum.ai/blog/ai-voice-agent-platforms-guide) |
| MENA Voice Recognition | $1.3B (2024) | Research and Markets |
| Concurrents Vapi/Retell/Bland | 3 majeurs | Industry Analysis |

---

*Document: Session 250.45 | 02/02/2026*
*Exigence: Multi-Tenant KB - Chaque client = KB unique*
*Sources: ElevenLabs, Microsoft Azure, GitHub, HuggingFace, Industry Blogs*
