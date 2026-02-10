#!/usr/bin/env node
/**
 * VocalIA - Knowledge Base Search Engine (BM25/TF-IDF)
 *
 * Role: Semantic search for Voice AI knowledge retrieval
 * Purpose: Powers Voice Widget & Telephony with contextual answers
 *
 * Note: STRATEGIC_META contains category metadata for RAG enrichment.
 * These are NOT VocalIA product offerings - they're knowledge domains
 * the Voice AI can discuss when helping client businesses.
 *
 * Version: 2.0.0 | Session 250.31 | 31/01/2026
 */

const fs = require('fs');
const path = require('path');
const EmbeddingService = require('./knowledge-embedding-service.cjs');

// Paths - KB now in project (Session 206)
const KNOWLEDGE_BASE_DIR = path.join(__dirname, '../data/knowledge-base');
const KB_SERVICES_FILE = path.join(__dirname, 'knowledge-base-services.json');
const CATALOG_PATH = path.join(__dirname, '../automations-registry.json');

// Knowledge base files
const KB_CHUNKS_FILE = path.join(KNOWLEDGE_BASE_DIR, 'chunks.json');
const KB_INDEX_FILE = path.join(KNOWLEDGE_BASE_DIR, 'tfidf_index.json');
const KB_STATUS_FILE = path.join(KNOWLEDGE_BASE_DIR, 'status.json');
const KB_GRAPH_FILE = path.join(KNOWLEDGE_BASE_DIR, 'knowledge-graph.json');
const KB_POLICY_FILE = path.join(KNOWLEDGE_BASE_DIR, 'knowledge_base_policies.json');
const LEGACY_KB_FILE = path.join(__dirname, '../telephony/knowledge_base.json');

/**
 * ARCHITECTURAL AUTHORITY DATA (Session 167 HARDENING)
 * This data provides the strategic "Why" and business "Outcome" behind products.
 */
const STRATEGIC_META = {
  // === CORE CATEGORIES ===
  'lead-gen': {
    intent: "Capture and disqualify noise to focus on high-LTV acquisition.",
    framework: "AIDA (Attention, Interest, Desire, Action)",
    outcome: "Conversion lift by filtering out low-intent traffic before manual touchpoints.",
    truth: "Automation cannot fix a weak offer; traffic must be pre-qualified at the creative level.",
    risk: "High bounce rates if the landing page experience doesn't match the ad promise."
  },
  'seo': {
    intent: "Build long-term organic leverage and AEO (AI Engine Optimization) visibility.",
    framework: "Authority Positioning",
    outcome: "Reduced CPA (Cost Per Acquisition) via compounding organic traffic.",
    truth: "SEO is a momentum game, not a switch; results require at least 90-120 days of consistent indexing.",
    risk: "Algorithmic updates can penalize over-optimized or thin content."
  },
  'email': {
    intent: "Counteract Customer Entropy through automated retention loops.",
    framework: "PAS (Pain-Agitate-Solution) for flows",
    outcome: "Retention pressure management, targeting 25-35% repeat purchase rate.",
    truth: "List hygiene is more important than list size; unengaged subscribers destroy deliverability.",
    risk: "Over-mailing leads to inbox fatigue and high unsubscribe spikes."
  },
  'shopify': {
    intent: "Maintain a Single Source of Truth (SSOT) across the architectural stack.",
    framework: "System Interoperability",
    outcome: "Zero-latency synchronization between order data and marketing triggers.",
    truth: "The system is only as good as the metafield structure; garbage in, garbage out.",
    risk: "Plugin conflicts can break webhook reliability."
  },
  'analytics': {
    intent: "Comprehensive visibility into business performance metrics.",
    framework: "Data-Driven Decision Making",
    outcome: "Identification of performance gaps and resource optimization.",
    truth: "Reports are useless without an action plan; data without decision is just noise.",
    risk: "Attribution bias can lead to false positives on channel performance."
  },
  'voice-ai': {
    intent: "Strike the balance between human-like empathy and algorithmic precision.",
    framework: "Conversational Closing (BANT)",
    outcome: "-95% qualifying time and immediate response to high-intent signals.",
    truth: "AI Voice requires clear knowledge boundaries; it cannot improvise legal or medical advice.",
    risk: "Latency in VAD (Voice Activity Detection) can lead to conversational 'step-overs'."
  },
  // === SESSION 168 EXTENSION - 100% Coverage ===
  'content': {
    intent: "Create scalable content assets that compound organic reach over time.",
    framework: "Content Lifecycle (Create → Distribute → Repurpose)",
    outcome: "Reduced content production cost by 60% through AI-assisted generation.",
    truth: "Quality trumps quantity; one viral piece beats 100 mediocre posts.",
    risk: "AI-generated content without human review can damage brand credibility."
  },
  'cinematicads': {
    intent: "Produce broadcast-quality video ads at startup speed and cost.",
    framework: "Cinematic Storytelling (Hook → Problem → Solution → CTA)",
    outcome: "3x higher engagement vs static ads, 40% lower CPM on video placements.",
    truth: "The first 3 seconds determine 80% of ad performance; hook is everything.",
    risk: "Over-polished ads can feel inauthentic; balance production with relatability."
  },
  'ai-avatar': {
    intent: "Scale human-like video presence without recurring talent costs.",
    framework: "Avatar Consistency (Voice + Face + Script alignment)",
    outcome: "24/7 video content capability, 90% cost reduction vs traditional shoots.",
    truth: "Avatars work best for educational/informational content, not emotional branding.",
    risk: "Uncanny valley effect if avatar quality is subpar; invest in premium models."
  },
  'whatsapp': {
    intent: "Meet customers on their preferred messaging platform with instant response.",
    framework: "Conversational Commerce (Inquiry → Qualify → Convert)",
    outcome: "98% open rate vs 20% email, 45% faster response-to-purchase cycle.",
    truth: "WhatsApp is personal space; over-messaging leads to blocks, not sales.",
    risk: "Meta's Business API rules can suspend accounts for policy violations."
  },
  'marketing': {
    intent: "Orchestrate multi-channel campaigns with unified attribution.",
    framework: "Full-Funnel Marketing (Awareness → Consideration → Decision)",
    outcome: "Unified view of customer journey across all touchpoints.",
    truth: "Marketing without measurement is gambling; always close the attribution loop.",
    risk: "Channel silos create blind spots; integration is non-negotiable."
  },
  'sms': {
    intent: "Deliver time-sensitive messages with guaranteed visibility.",
    framework: "Urgency Marketing (Scarcity + Deadline + Value)",
    outcome: "98% open rate within 3 minutes, ideal for flash sales and reminders.",
    truth: "SMS is premium real estate; abuse it once and you lose the customer forever.",
    risk: "Carrier filtering can block promotional messages; compliance is critical."
  },
  'retention': {
    intent: "Maximize Customer Lifetime Value through systematic re-engagement.",
    framework: "RFM Segmentation (Recency, Frequency, Monetary)",
    outcome: "20% increase in repeat purchase rate, 30% reduction in churn.",
    truth: "Acquiring a new customer costs 5x more than retaining an existing one.",
    risk: "Generic retention campaigns feel impersonal; personalization is mandatory."
  },
  'dropshipping': {
    intent: "Enable zero-inventory e-commerce with automated fulfillment.",
    framework: "Supplier-Customer Bridge (Order → Route → Track → Deliver)",
    outcome: "Launch products with zero upfront inventory investment.",
    truth: "Margins are thin; success requires volume or premium positioning.",
    risk: "Supplier reliability directly impacts customer experience and reviews."
  },
  'agency-ops': {
    intent: "Streamline internal agency operations for scalable service delivery.",
    framework: "Operational Excellence (Standardize → Automate → Optimize)",
    outcome: "50% reduction in manual tasks, improved client delivery timelines.",
    truth: "Internal inefficiency leaks directly into client pricing and margins.",
    risk: "Over-automation without human oversight can miss edge cases."
  },
  // === LEGACY CATEGORY ALIASES (For backward compatibility) ===
  'Lead Generation & Acquisition': {
    intent: "Capture and disqualify noise to focus on high-LTV acquisition.",
    framework: "AIDA (Attention, Interest, Desire, Action)",
    outcome: "Conversion lift by filtering out low-intent traffic before manual touchpoints.",
    truth: "Automation cannot fix a weak offer; traffic must be pre-qualified at the creative level.",
    risk: "High bounce rates if the landing page experience doesn't match the ad promise."
  },
  'Email Marketing & Klaviyo': {
    intent: "Counteract Customer Entropy through automated retention loops.",
    framework: "PAS (Pain-Agitate-Solution) for flows",
    outcome: "Retention pressure management, targeting 25-35% repeat purchase rate.",
    truth: "List hygiene is more important than list size; unengaged subscribers destroy deliverability.",
    risk: "Over-mailing leads to inbox fatigue and high unsubscribe spikes."
  },
  'SEO & Content': {
    intent: "Build long-term organic leverage and AEO (AI Engine Optimization) visibility.",
    framework: "Authority Positioning",
    outcome: "Reduced CPA (Cost Per Acquisition) via compounding organic traffic.",
    truth: "SEO is a momentum game, not a switch; results require at least 90-120 days of consistent indexing.",
    risk: "Algorithmic updates can penalize over-optimized or thin content."
  },
  'Analytics & Reporting': {
    intent: "Comprehensive visibility into business performance metrics.",
    framework: "Data-Driven Decision Making",
    outcome: "Identification of performance gaps and resource optimization.",
    truth: "Reports are useless without an action plan; data without decision is just noise.",
    risk: "Attribution bias can lead to false positives on channel performance."
  },
  'Shopify Admin & Operations': {
    intent: "Maintain a Single Source of Truth (SSOT) across the architectural stack.",
    framework: "System Interoperability",
    outcome: "Zero-latency synchronization between order data and marketing triggers.",
    truth: "The system is only as good as the metafield structure; garbage in, garbage out.",
    risk: "Plugin conflicts can break webhook reliability."
  }
};

const SPECIFIC_OUTCOMES = {
  'abandoned-cart': "Benchmark: 10-15% recovery on lost revenue.",
  'welcome-series': "Benchmark: 40-50% Open Rate on brand indoctrination.",
  'meta-leads-sync': "Immediate sync eliminates lead decay (decay starts after 5 mins).",
  'system-audit': "Full gap analysis identifying at least 3 high-leverage optimization opportunities."
};

/**
 * BM25 Implementation (SOTA - Session 241)
 * Replaces TF-IDF for better retrieval (+15-25% recall per Anthropic research)
 *
 * Key improvements over TF-IDF:
 * - Document length normalization (b parameter)
 * - Term frequency saturation (k1 parameter)
 * - Better handling of short vs long documents
 *
 * Formula: score(D,Q) = Σ IDF(qi) * (f(qi,D) * (k1+1)) / (f(qi,D) + k1*(1-b+b*|D|/avgdl))
 *
 * Sources:
 * - https://www.anthropic.com/news/contextual-retrieval
 * - https://en.wikipedia.org/wiki/Okapi_BM25
 */
class BM25Index {
  constructor(options = {}) {
    this.documents = [];
    this.vocabulary = new Map();
    this.idf = new Map();
    this.docLengths = [];
    this.avgDocLength = 0;
    this.termFreqs = [];

    // BM25 parameters (tuned for service/automation content)
    this.k1 = options.k1 || 1.5;  // Term frequency saturation (1.2-2.0 typical)
    this.b = options.b || 0.75;   // Document length normalization (0.75 standard)
  }

  /**
   * Tokenize and normalize text (multilingual FR/EN/AR support)
   */
  tokenize(text) {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^\w\sàâäéèêëïîôùûüçأ-ي-]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2);
  }

  /**
   * Build BM25 index from documents
   */
  build(documents) {
    this.documents = documents;
    this.vocabulary = new Map();
    this.idf = new Map();
    this.docLengths = [];
    this.termFreqs = [];
    const docCount = documents.length;

    // Build vocabulary, document frequency, and doc lengths
    const docFreq = new Map();
    let totalLength = 0;

    for (const doc of documents) {
      const tokens = this.tokenize(doc.text);
      const termFreq = new Map();
      const docLength = tokens.length;

      for (const token of tokens) {
        termFreq.set(token, (termFreq.get(token) || 0) + 1);
        if (!this.vocabulary.has(token)) {
          this.vocabulary.set(token, this.vocabulary.size);
        }
      }

      // Update document frequency
      for (const token of termFreq.keys()) {
        docFreq.set(token, (docFreq.get(token) || 0) + 1);
      }

      this.termFreqs.push(termFreq);
      this.docLengths.push(docLength);
      totalLength += docLength;
    }

    // Calculate average document length
    this.avgDocLength = totalLength / docCount;

    // Calculate IDF using BM25 variant (Robertson-Sparck Jones)
    for (const [token, df] of docFreq) {
      // BM25 IDF: log((N - df + 0.5) / (df + 0.5))
      const idf = Math.log((docCount - df + 0.5) / (df + 0.5) + 1);
      this.idf.set(token, Math.max(idf, 0)); // Ensure non-negative
    }
  }

  /**
   * Search using BM25 scoring (SOTA)
   * Formula: score(D,Q) = Σ IDF(qi) * (f(qi,D) * (k1+1)) / (f(qi,D) + k1*(1-b+b*|D|/avgdl))
   */
  search(query, topK = 5) {
    const queryTokens = this.tokenize(query);
    const queryTerms = new Set(queryTokens);

    // Calculate BM25 score for each document
    const scores = [];
    for (let i = 0; i < this.documents.length; i++) {
      let score = 0;
      const termFreq = this.termFreqs[i];
      const docLength = this.docLengths[i];

      // Length normalization factor
      const lengthNorm = 1 - this.b + this.b * (docLength / this.avgDocLength);

      for (const term of queryTerms) {
        if (termFreq.has(term)) {
          const tf = termFreq.get(term);
          const idf = this.idf.get(term) || 0;

          // BM25 term score
          const numerator = tf * (this.k1 + 1);
          const denominator = tf + this.k1 * lengthNorm;
          score += idf * (numerator / denominator);
        }
      }

      if (score > 0) {
        scores.push({ index: i, score });
      }
    }

    // Sort by score and return top K
    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK).map(s => ({
      ...this.documents[s.index],
      score: s.score
    }));
  }

  /**
   * Serialize index to JSON
   */
  toJSON() {
    return {
      type: 'bm25',
      vocabulary: Array.from(this.vocabulary.entries()),
      idf: Array.from(this.idf.entries()),
      termFreqs: this.termFreqs.map(v => Array.from(v.entries())),
      docLengths: this.docLengths,
      avgDocLength: this.avgDocLength,
      k1: this.k1,
      b: this.b,
      document_count: this.documents.length
    };
  }

  /**
   * Clear the index
   */
  clear() {
    this.vocabulary = new Map();
    this.idf = new Map();
    this.termFreqs = [];
    this.docLengths = [];
    this.avgDocLength = 0;
    this.documents = [];
  }

  /**
   * Load index from JSON
   */
  fromJSON(data) {
    this.vocabulary = new Map(data.vocabulary);
    this.idf = new Map(data.idf);
    this.termFreqs = data.termFreqs.map(v => new Map(v));
    this.docLengths = data.docLengths || [];
    this.avgDocLength = data.avgDocLength || 0;
    this.k1 = data.k1 || 1.5;
    this.b = data.b || 0.75;
  }
}

// Alias for backward compatibility
const TFIDFIndex = BM25Index;

/**
 * Knowledge Base Manager for VocalIA Services
 */
class ServiceKnowledgeBase {
  constructor() {
    this.chunks = [];
    this.index = new BM25Index();
    this.graph = { nodes: [], edges: [] };
    this.isLoaded = false;
  }

  /**
   * Build knowledge base from automations catalog
   */
  async build() {
    console.log('📚 Building VocalIA Services Knowledge Base...');

    // Ensure directory exists
    if (!fs.existsSync(KNOWLEDGE_BASE_DIR)) {
      fs.mkdirSync(KNOWLEDGE_BASE_DIR, { recursive: true });
    }

    // Load automations catalog
    if (!fs.existsSync(CATALOG_PATH)) {
      throw new Error(`Catalog not found: ${CATALOG_PATH}`);
    }

    let catalog;
    try {
      catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
    } catch (e) {
      console.error(`❌ [KB] Corrupted catalog file: ${CATALOG_PATH}`, e.message);
      catalog = { automations: [], categories: {} };
    }
    const automations = catalog.automations || [];
    const categories = catalog.categories || {};

    console.log(`   Found ${automations.length} automations`);

    // Create chunks for each automation
    this.chunks = [];
    for (const auto of automations) {
      const categoryInfo = categories[auto.category] || {};
      const meta = STRATEGIC_META[auto.category] || { intent: "", framework: "", outcome: "", truth: "", risk: "" };

      // SESSION 250.16: Direct registry values take priority over STRATEGIC_META fallback
      const strategicIntent = auto.strategic_intent || meta.intent || '';
      const businessOutcome = auto.business_outcome || SPECIFIC_OUTCOMES[auto.id] || meta.outcome || '';
      const marketingScience = auto.marketing_science || meta.framework || '';
      const diagnosticTruth = auto.diagnostic_truth || meta.truth || '';
      const systemicRisk = auto.systemic_risk || meta.risk || '';

      // Build rich text for BM25 indexing (Session 250.16: + keywords for vocabulary enrichment)
      const textParts = [
        auto.name_en || auto.name || '',
        auto.name_fr || '',
        auto.benefit_en || auto.benefit || '',
        auto.benefit_fr || '',
        auto.semantic_description || '',
        categoryInfo.name_en || '',
        categoryInfo.name_fr || '',
        auto.category || '',
        (auto.capabilities || []).join(' '),
        (auto.features || []).join(' '),
        (auto.platforms || []).join(' '),
        (auto.use_cases || []).join(' '),
        (auto.integrations || []).join(' '),
        (auto.keywords || []).join(' ')  // SESSION 250.16: Context-specific keywords
      ];

      const chunk = {
        id: auto.id,
        type: 'automation',
        title: auto.name_en || auto.name_fr || auto.id,
        title_fr: auto.name_fr || '',
        category: auto.category,
        category_name: categoryInfo.name_en || auto.category,
        category_name_fr: categoryInfo.name_fr || '',
        benefit_en: auto.benefit_en || auto.benefit || '',
        benefit_fr: auto.benefit_fr || '',
        frequency_en: auto.frequency_en || '',
        frequency_fr: auto.frequency_fr || '',
        agentic_level: auto.agentic_level || 1,
        // IP SHIELD: We include the ID for reference but never full script logic in RAG
        script_ref: auto.script ? path.basename(auto.script) : null,

        // ARCHITECTURAL AUTHORITY INJECTION (registry values take priority)
        strategic_intent: strategicIntent,
        business_outcome: businessOutcome,
        marketing_science: marketingScience,
        diagnostic_truth: diagnosticTruth,
        systemic_risk: systemicRisk,
        tenant_id: 'shared', // Shared knowledge available to all tenants

        text: [
          ...textParts,
          strategicIntent,
          marketingScience,
          businessOutcome,
          diagnosticTruth,
          systemicRisk,
          "Architectural Priority: " + (auto.agentic_level > 2 ? "High Systemic Impact" : "Structural Foundation")
        ].filter(Boolean).join(' ')
      };

      this.chunks.push(chunk);
    }

    // Also add category summaries as searchable chunks
    for (const [catId, catInfo] of Object.entries(categories)) {
      const catAutomations = automations.filter(a => a.category === catId);
      const chunk = {
        id: `category-${catId}`,
        type: 'category',
        title: catInfo.name_en || catId,
        title_fr: catInfo.name_fr || '',
        category: catId,
        automation_count: catInfo.count || catAutomations.length,
        text: [
          catInfo.name_en || '',
          catInfo.name_fr || '',
          catId,
          `${catAutomations.length} automations`,
          catAutomations.map(a => a.name_en || a.id).join(' ')
        ].join(' ')
      };
      this.chunks.push(chunk);
    }

    // Merge Legacy Knowledge Base (Session 250.15 - 38 Personas FAQ)
    if (fs.existsSync(LEGACY_KB_FILE)) {
      console.log('   Merging legacy knowledge base (persona FAQ)...');
      let legacyKB;
      try {
        legacyKB = JSON.parse(fs.readFileSync(LEGACY_KB_FILE, 'utf8'));
      } catch (e) {
        console.error(`❌ [KB] Corrupted legacy KB file: ${LEGACY_KB_FILE}`, e.message);
        legacyKB = {};
      }
      let faqCount = 0;

      for (const [personaId, faqEntries] of Object.entries(legacyKB)) {
        for (const [topic, answer] of Object.entries(faqEntries)) {
          // Generate English title from topic (snake_case to Title Case)
          const titleEn = topic.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          const titleFr = topic.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

          // Build searchable text (multilingual - answer is usually French)
          const searchText = [
            personaId.replace(/_v\d+$/, '').replace(/_/g, ' '),
            titleEn,
            topic,
            answer,
            // Add common synonyms for key topics
            topic.includes('livraison') ? 'delivery shipping transport' : '',
            topic.includes('retour') ? 'return refund exchange' : '',
            topic.includes('paiement') ? 'payment pay credit card' : '',
            topic.includes('urgence') ? 'urgency emergency critical' : '',
            topic.includes('rdv') ? 'appointment booking schedule' : '',
            topic.includes('horaires') ? 'hours schedule opening time' : '',
            topic.includes('tarif') ? 'price pricing cost fee' : ''
          ].filter(Boolean).join(' ');

          const faqChunk = {
            id: `faq_${personaId}_${topic}`,
            type: 'faq',
            title: `${titleEn} FAQ`,
            title_fr: `FAQ ${titleFr}`,
            category: 'faq',
            persona_id: personaId,
            topic: topic,
            answer_fr: answer,
            tenant_id: 'shared',
            text: searchText
          };

          this.chunks.push(faqChunk);
          faqCount++;
        }
      }
      console.log(`   Merged ${faqCount} FAQ entries from ${Object.keys(legacyKB).length} personas`);
    }

    console.log(`   Created ${this.chunks.length} searchable chunks`);

    // Build TF-IDF index
    this.index.build(this.chunks);
    console.log(`   TF-IDF index built: ${this.index.vocabulary.size} terms`);

    // Generate/Update Embeddings for Dense Retrieval
    console.log('   Generating dense embeddings (Hybrid Frontier)...');
    await EmbeddingService.batchEmbed(this.chunks);

    // Add Manual Policy Knowledge (Phase 15)
    if (fs.existsSync(KB_POLICY_FILE)) {
      let policies;
      try {
        policies = JSON.parse(fs.readFileSync(KB_POLICY_FILE, 'utf8'));
      } catch (e) {
        console.error(`❌ [KB] Corrupted policy file: ${KB_POLICY_FILE}`, e.message);
        policies = {};
      }
      for (const [key, policy] of Object.entries(policies)) {
        this.chunks.push({
          id: `policy_${key}`,
          title: key.replace(/_/g, ' ').toUpperCase(),
          text: `${policy.text} ${policy.keywords ? policy.keywords.join(' ') : ''}`,
          tenant_id: policy.tenant_id || 'shared',
          metadata: { type: 'policy', key }
        });
      }
    }
    this.chunks = this.chunks; // This.chunks already populated in previous step

    // Build Sparse Index
    this.index.build(this.chunks);

    // Save
    fs.writeFileSync(KB_CHUNKS_FILE, JSON.stringify(this.chunks, null, 2));
    fs.writeFileSync(KB_INDEX_FILE, JSON.stringify(this.index.toJSON(), null, 2));

    // Status
    const status = {
      version: '1.0.0',
      built_at: new Date().toISOString(),
      chunk_count: this.chunks.length,
      term_count: this.index.vocabulary.size,
      source: CATALOG_PATH,
      automations_count: automations.length,
      categories_count: Object.keys(categories).length
    };
    fs.writeFileSync(KB_STATUS_FILE, JSON.stringify(status, null, 2));

    console.log('✅ Knowledge Base built successfully');
    console.log('\nBuild Summary:');
    console.log(JSON.stringify(status, null, 2));

    return true;
  }

  /**
   * Load existing knowledge base
   */
  load() {
    if (!fs.existsSync(KB_CHUNKS_FILE) || !fs.existsSync(KB_INDEX_FILE)) {
      return false;
    }

    try {
      this.chunks = JSON.parse(fs.readFileSync(KB_CHUNKS_FILE, 'utf8'));
      const indexData = JSON.parse(fs.readFileSync(KB_INDEX_FILE, 'utf8'));
      this.index.fromJSON(indexData);
      this.index.documents = this.chunks;

      // Load Graph
      if (fs.existsSync(KB_GRAPH_FILE)) {
        this.graph = JSON.parse(fs.readFileSync(KB_GRAPH_FILE, 'utf8'));
      }

      this.isLoaded = true;
      return true;
    } catch (e) {
      console.error(`Error loading knowledge base: ${e.message}`);
      return false;
    }
  }

  /**
   * Search for relevant services
   */
  search(query, topK = 5) {
    if (!this.isLoaded) {
      throw new Error('Knowledge base not loaded. Run --build first.');
    }
    return this.index.search(query, topK);
  }

  /**
   * HYBRID SEARCH Frontier (v3.0)
   * Combines BM25 (Sparse) and Dense Embeddings (Cosine Similarity)
   * Logic: Reciprocal Rank Fusion (RRF) with Strict Tenant Isolation
   */
  async asyncSearchHybrid(query, limit = 5, options = {}) {
    if (!this.isLoaded) this.load();
    const tenantId = options.tenantId || 'unknown';
    const language = options.language || 'fr';

    if (!options.tenantId) console.warn('[RAG] No tenantId provided, using "unknown"');
    console.log(`[RAG] Hybrid search for tenant: ${tenantId}, language: ${language}`);

    // 1. Strict Tenant Isolation - Filter Chunks BEFORE Search
    const tenantChunks = this.chunks.filter(c =>
      c.tenant_id === tenantId ||
      c.tenant_id === 'shared' ||
      c.tenant_id === 'universal'
    );

    // 2. Sparse Search (BM25)
    // We create a temporary index for the tenant's chunks to ensure absolute isolation and speed
    const tenantIndex = new BM25Index();
    tenantIndex.build(tenantChunks);
    const sparseResults = tenantIndex.search(query, limit * 2);

    // 3. Dense Search (Embeddings)
    const queryVector = await EmbeddingService.getQueryEmbedding(query);
    const denseResults = [];

    if (queryVector) {
      for (const chunk of tenantChunks) {
        // Retrieve or generate embedding for chunk
        const chunkVector = await EmbeddingService.getEmbedding(chunk.id, chunk.text, null, tenantId);
        if (chunkVector) {
          const similarity = EmbeddingService.cosineSimilarity(queryVector, chunkVector);
          // Threshold for semantic relevance (Session 250.81)
          if (similarity > 0.65) {
            denseResults.push({ ...chunk, similarity });
          }
        }
      }
    }
    denseResults.sort((a, b) => b.similarity - a.similarity);

    // 4. Reciprocal Rank Fusion (RRF)
    const combined = new Map();
    const K = 60; // Smoothing constant

    sparseResults.forEach((res, i) => {
      const score = 1 / (i + K);
      combined.set(res.id, {
        ...res,
        rrfScore: score,
        sparseRank: i + 1,
        sparseScore: res.score
      });
    });

    denseResults.forEach((res, i) => {
      const score = 1 / (i + K);
      if (combined.has(res.id)) {
        const item = combined.get(res.id);
        item.rrfScore += score;
        item.denseRank = i + 1;
        item.denseScore = res.similarity;
      } else {
        combined.set(res.id, {
          ...res,
          rrfScore: score,
          denseRank: i + 1,
          denseScore: res.similarity
        });
      }
    });

    // 5. Policy & Authority Boost (Session 250.82)
    const lowerQuery = query.toLowerCase();
    combined.forEach(res => {
      // Direct Policy Match
      if (res.id.startsWith('policy_')) {
        const policyKey = res.id.replace('policy_', '').replace(/_/g, ' ');
        if (lowerQuery.includes(policyKey)) {
          res.rrfScore += 1.0; // Significant boost for direct policy hits
          console.log(`[RAG] Policy boost applied: ${policyKey}`);
        }
      }

      // Intent Match
      if (res.strategic_intent && lowerQuery.includes(res.strategic_intent.toLowerCase().substring(0, 10))) {
        res.rrfScore += 0.1;
      }
    });

    return Array.from(combined.values())
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .slice(0, limit);
  }

  /**
   * GRAPH SEARCH (Phase 11 Activation)
   * Finds related concepts based on operational mapping
   */
  graphSearch(query, options = {}) {
    if (!this.isLoaded) this.load();
    const lower = query.toLowerCase();
    const tenantId = options.tenantId || 'unknown';

    // Find matching nodes
    const matches = this.graph.nodes.filter(n =>
      (n.label.toLowerCase().includes(lower) || n.id.toLowerCase().includes(lower)) &&
      (!n.tenant_id || n.tenant_id === tenantId || n.tenant_id === 'shared')
    );

    const related = [];
    for (const match of matches) {
      // Find direct edges
      const edges = this.graph.edges.filter(e => e.from === match.id || e.to === match.id);
      for (const edge of edges) {
        const relatedId = edge.from === match.id ? edge.to : edge.from;
        const relatedNode = this.graph.nodes.find(n => n.id === relatedId);
        if (relatedNode) {
          related.push({
            node: relatedNode,
            relation: edge.relation,
            context: `Relates to ${match.label} via ${edge.relation}`
          });
        }
      }
    }

    return related;
  }

  /**
   * Get knowledge base status
   */
  getStatus() {
    if (!fs.existsSync(KB_STATUS_FILE)) {
      return { exists: false };
    }

    try {
      const status = JSON.parse(fs.readFileSync(KB_STATUS_FILE, 'utf8'));
      status.exists = true;
      status.knowledge_base_dir = KNOWLEDGE_BASE_DIR;
      return status;
    } catch (e) {
      console.error(`❌ [KB] Corrupted status file: ${KB_STATUS_FILE}`, e.message);
      return { exists: false, error: 'corrupted_status_file' };
    }
  }

  /**
   * Format search results for voice response
   */
  formatForVoice(results, language = 'en') {
    if (!results || results.length === 0) {
      return language === 'fr'
        ? "Je n'ai pas trouvé d'automation correspondante."
        : "I couldn't find a matching automation.";
    }

    const lines = [];
    for (const r of results.slice(0, 3)) {
      const title = language === 'fr' && r.title_fr ? r.title_fr : r.title;
      const benefit = language === 'fr' && r.benefit_fr ? r.benefit_fr : r.benefit_en;
      const intent = r.strategic_intent;
      const outcome = r.business_outcome;
      const truth = r.diagnostic_truth;

      lines.push(`${title.toUpperCase()}: ${benefit}`);
      lines.push(`Strategic Intent: ${intent}`);
      lines.push(`Expected Outcome: ${outcome}`);
      lines.push(`Diagnostic Truth: ${truth}`);
      lines.push('---');
    }

    return lines.join('\n');
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const kb = new ServiceKnowledgeBase();

  if (args.includes('--health')) {
    console.log('✅ VocalIA Service Knowledge Base: Module OK');
    const status = kb.getStatus();
    console.log(`   Knowledge Base: ${status.exists ? 'Built' : 'Not built'}`);
    if (status.exists) {
      console.log(`   Chunks: ${status.chunk_count}`);
      console.log(`   Terms: ${status.term_count}`);
      console.log(`   Built: ${status.built_at}`);
    }
    console.log(`   Directory: ${KNOWLEDGE_BASE_DIR}`);
    process.exit(0);
  }

  if (args.includes('--build')) {
    try {
      const status = await kb.build();
      console.log('\nBuild Summary:');
      console.log(JSON.stringify(status, null, 2));
    } catch (e) {
      console.error(`❌ Build failed: ${e.message}`);
      process.exit(1);
    }
    return;
  }

  if (args.includes('--status')) {
    const status = kb.getStatus();
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  if (args.includes('--search')) {
    const queryIndex = args.indexOf('--search') + 1;
    let query = args.slice(queryIndex).join(' ');

    const tenantIndex = args.indexOf('--tenant');
    let tenantId = 'shared'; // CLI default — use --tenant to specify
    if (tenantIndex !== -1) {
      tenantId = args[tenantIndex + 1];
      // Remove tenant args from query
      const parts = query.split(' ');
      const tIdx = parts.indexOf('--tenant');
      if (tIdx !== -1) parts.splice(tIdx, 2);
      query = parts.join(' ');
    }

    if (!query) {
      console.error('Usage: --search <query> [--tenant <id>]');
      process.exit(1);
    }

    if (!kb.load()) {
      console.error('❌ Knowledge base not built. Run --build first.');
      process.exit(1);
    }

    (async () => {
      const results = await kb.asyncSearchHybrid(query, 5, { tenantId });
      console.log(`\nSearch: "${query}" (Hybrid RRF Optimization | Tenant: ${tenantId})`);
      console.log(`Found: ${results.length} results`);
      results.forEach((res, i) => {
        console.log(`\n[${(res.score || 0).toFixed(4)}] ${res.title}`);
        if (res.strategic_intent) console.log(`   Intent: ${res.strategic_intent}`);
        if (res.business_outcome) console.log(`   Outcome: ${res.business_outcome}`);
        if (res.text && res.id.startsWith('policy_')) console.log(`   Text: ${res.text}`);
        console.log(`   ID: ${res.id}`);
      });
      console.log('');
    })();
    return;
  }

  if (args.includes('--graph-search')) {
    const queryIndex = args.indexOf('--graph-search') + 1;
    const query = args.slice(queryIndex).join(' ');

    if (!query) {
      console.error('Usage: --graph-search <query>');
      process.exit(1);
    }

    const results = kb.graphSearch(query);
    console.log(`\nGraph Search: "${query}" (Operations RAG Relation Mapping)`);
    console.log(`Found: ${results.length} relations\n`);

    for (const r of results) {
      console.log(`[${r.node.type}] ${r.node.label}`);
      console.log(`   Context: ${r.context}`);
      console.log(`   ID: ${r.node.id}`);
      console.log('');
    }
    return;
  }

  // Default: show help
  console.log(`
VocalIA - Service Knowledge Base

Usage:
  node knowledge-base-services.cjs --build     Build knowledge base from catalog
  node knowledge-base-services.cjs --search <query>  Search for services
  node knowledge-base-services.cjs --graph-search <query>  Search for related concepts
  node knowledge-base-services.cjs --status    Show knowledge base status
  node knowledge-base-services.cjs --health    Health check

Examples:
  node knowledge-base-services.cjs --search "email abandoned cart"
  node knowledge-base-services.cjs --search "lead generation B2B"
  node knowledge-base-services.cjs --search "voice AI telephony"
`);
}

// Export for use as module
module.exports = { ServiceKnowledgeBase, TFIDFIndex };

// Run if called directly
if (require.main === module) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
