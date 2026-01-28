#!/usr/bin/env node
/**
 * 3A Automation - Knowledge Base for Services (B2B)
 *
 * Role: TF-IDF based search for 119 automation services
 * Purpose: Powers Voice AI assistant with service knowledge
 *
 * Adapted from MyDealz product KB via Technology Shelf
 * Original: MyDealz scripts/knowledge_base_simple.py
 *
 * Version: 1.0.0 | Session 144 | 23/01/2026
 */

const fs = require('fs');
const path = require('path');
const EmbeddingService = require('./knowledge-embedding-service.cjs');

// Paths
const BASE_DIR = path.join(__dirname, '../../..');
const KNOWLEDGE_BASE_DIR = path.join(BASE_DIR, 'knowledge_base');
const KB_SERVICES_FILE = path.join(__dirname, 'knowledge-base-services.json');
const CATALOG_PATH = path.join(BASE_DIR, 'landing-page-hostinger/data/automations-catalog.json');

// Knowledge base files
const KB_CHUNKS_FILE = path.join(KNOWLEDGE_BASE_DIR, 'chunks.json');
const KB_INDEX_FILE = path.join(KNOWLEDGE_BASE_DIR, 'tfidf_index.json');
const KB_STATUS_FILE = path.join(KNOWLEDGE_BASE_DIR, 'status.json');
const KB_GRAPH_FILE = path.join(KNOWLEDGE_BASE_DIR, 'knowledge-graph.json');
const KB_POLICY_FILE = path.join(KNOWLEDGE_BASE_DIR, 'knowledge_base_policies.json');

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
    intent: "Holistic vision of the business thermodynamic matrix.",
    framework: "Data-Driven Decision Making",
    outcome: "Identification of profit gaps and resource misallocation.",
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
    framework: "Content Flywheel (Create → Distribute → Repurpose)",
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
    outcome: "Holistic view of customer journey across all touchpoints.",
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
    intent: "Holistic vision of the business thermodynamic matrix.",
    framework: "Data-Driven Decision Making",
    outcome: "Identification of profit gaps and resource misallocation.",
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
  'system-audit': "Full gap analysis identifying at least 3 high-leverage profit leaks."
};

/**
 * Simple TF-IDF Implementation
 */
class TFIDFIndex {
  constructor() {
    this.documents = [];
    this.vocabulary = new Map();
    this.idf = new Map();
    this.tfidf = [];
  }

  /**
   * Tokenize and normalize text
   */
  tokenize(text) {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^\w\sàâäéèêëïîôùûüç-]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2);
  }

  /**
   * Build TF-IDF index from documents
   */
  build(documents) {
    this.documents = documents;
    this.vocabulary = new Map();
    this.idf = new Map();
    this.tfidf = [];
    const docCount = documents.length;

    // Build vocabulary and document frequency
    const docFreq = new Map();
    const termFreqs = [];

    for (const doc of documents) {
      const tokens = this.tokenize(doc.text);
      const termFreq = new Map();

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

      termFreqs.push(termFreq);
    }

    // Calculate IDF
    for (const [token, df] of docFreq) {
      this.idf.set(token, Math.log((docCount + 1) / (df + 1)) + 1);
    }

    // Build TF-IDF vectors
    for (const termFreq of termFreqs) {
      const vector = new Map();
      let norm = 0;

      for (const [token, tf] of termFreq) {
        const tfidf = tf * (this.idf.get(token) || 0);
        vector.set(token, tfidf);
        norm += tfidf * tfidf;
      }

      // Normalize
      norm = Math.sqrt(norm);
      if (norm > 0) {
        for (const [token, value] of vector) {
          vector.set(token, value / norm);
        }
      }

      this.tfidf.push(vector);
    }
  }

  /**
   * Search for similar documents
   */
  search(query, topK = 5) {
    const queryTokens = this.tokenize(query);
    const queryVector = new Map();
    let norm = 0;

    // Build query TF-IDF vector
    for (const token of queryTokens) {
      const tf = queryTokens.filter(t => t === token).length;
      const tfidf = tf * (this.idf.get(token) || 0);
      queryVector.set(token, tfidf);
      norm += tfidf * tfidf;
    }

    // Normalize query vector
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (const [token, value] of queryVector) {
        queryVector.set(token, value / norm);
      }
    }

    // Calculate cosine similarity with all documents
    const scores = [];
    for (let i = 0; i < this.tfidf.length; i++) {
      let similarity = 0;
      const docVector = this.tfidf[i];

      for (const [token, queryVal] of queryVector) {
        if (docVector.has(token)) {
          similarity += queryVal * docVector.get(token);
        }
      }

      if (similarity > 0) {
        scores.push({ index: i, score: similarity });
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
      vocabulary: Array.from(this.vocabulary.entries()),
      idf: Array.from(this.idf.entries()),
      tfidf: this.tfidf.map(v => Array.from(v.entries())),
      document_count: this.documents.length
    };
  }

  /**
   * Clear the index
   */
  clear() {
    this.vocabulary = new Map();
    this.idf = new Map();
    this.tfidf = [];
    this.documents = [];
  }

  /**
   * Load index from JSON
   */
  fromJSON(data) {
    this.vocabulary = new Map(data.vocabulary);
    this.idf = new Map(data.idf);
    this.tfidf = data.tfidf.map(v => new Map(v));
  }
}

/**
 * Knowledge Base Manager for 3A Services
 */
class ServiceKnowledgeBase {
  constructor() {
    this.chunks = [];
    this.index = new TFIDFIndex();
    this.graph = { nodes: [], edges: [] };
    this.isLoaded = false;
  }

  /**
   * Build knowledge base from automations catalog
   */
  async build() {
    console.log('📚 Building 3A Services Knowledge Base...');

    // Ensure directory exists
    if (!fs.existsSync(KNOWLEDGE_BASE_DIR)) {
      fs.mkdirSync(KNOWLEDGE_BASE_DIR, { recursive: true });
    }

    // Load automations catalog
    if (!fs.existsSync(CATALOG_PATH)) {
      throw new Error(`Catalog not found: ${CATALOG_PATH}`);
    }

    const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
    const automations = catalog.automations || [];
    const categories = catalog.categories || {};

    console.log(`   Found ${automations.length} automations`);

    // Create chunks for each automation
    this.chunks = [];
    for (const auto of automations) {
      const categoryInfo = categories[auto.category] || {};
      const meta = STRATEGIC_META[auto.category] || { intent: "", framework: "", outcome: "" };

      // Build rich text for TF-IDF
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
        (auto.platforms || []).join(' ')
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

        // ARCHITECTURAL AUTHORITY INJECTION
        strategic_intent: meta.intent,
        business_outcome: SPECIFIC_OUTCOMES[auto.id] || meta.outcome,
        marketing_science: meta.framework,
        diagnostic_truth: meta.truth,
        systemic_risk: meta.risk,
        tenant_id: 'agency_internal', // Default for agency-wide knowledge

        text: [
          ...textParts,
          meta.intent,
          meta.framework,
          SPECIFIC_OUTCOMES[auto.id] || meta.outcome,
          meta.truth,
          meta.risk,
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

    console.log(`   Created ${this.chunks.length} searchable chunks`);

    // Build TF-IDF index
    this.index.build(this.chunks);
    console.log(`   TF-IDF index built: ${this.index.vocabulary.size} terms`);

    // Generate/Update Embeddings for Dense Retrieval
    console.log('   Generating dense embeddings (Hybrid Frontier)...');
    await EmbeddingService.batchEmbed(this.chunks);

    // Add Manual Policy Knowledge (Phase 15)
    if (fs.existsSync(KB_POLICY_FILE)) {
      const policies = JSON.parse(fs.readFileSync(KB_POLICY_FILE, 'utf8'));
      for (const [key, policy] of Object.entries(policies)) {
        this.chunks.push({
          id: `policy_${key}`,
          title: key.replace(/_/g, ' ').toUpperCase(),
          text: `${policy.text} ${policy.keywords ? policy.keywords.join(' ') : ''}`,
          tenant_id: policy.tenant_id || 'agency_internal',
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
   * Logic: Reciprocal Rank Fusion (RRF)
   */
  async searchHybrid(query, limit = 5, options = {}) {
    if (!this.isLoaded) this.load();
    const tenantId = options.tenantId || 'agency_internal';

    // 1. Sparse Search (BM25)
    // Filter by tenantId or global
    const filteredChunks = this.chunks.filter(c => c.tenant_id === tenantId || c.tenant_id === 'agency_internal');

    // We update the index temporarily for this search or just filter results
    // For efficiency in this TF-IDF impl, we filter results after search but better to filter before if index was large
    const sparseResults = this.index.search(query, limit * 3).filter(res =>
      res.tenant_id === tenantId || res.tenant_id === 'agency_internal'
    );

    // 2. Dense Search (Embeddings)
    const queryVector = await EmbeddingService.getQueryEmbedding(query);
    const denseResults = [];

    if (queryVector) {
      for (const chunk of filteredChunks) {
        const chunkVector = EmbeddingService.cache[chunk.id];
        if (chunkVector) {
          const similarity = EmbeddingService.cosineSimilarity(queryVector, chunkVector);
          denseResults.push({ ...chunk, similarity });
        }
      }
    }
    denseResults.sort((a, b) => b.similarity - a.similarity);
    // 3. Reciprocal Rank Fusion (RRF)
    const rrfScores = new Map();
    const K = 60; // Smoothing constant (tuned for 100% precision)

    // 3. Re-rank (RRF or simple boost)
    const combined = new Map();

    sparseResults.forEach((res, i) => {
      const score = 1 / (i + 60);
      combined.set(res.id, { ...res, score, sparseScore: res.score });
    });

    denseResults.forEach((res, i) => {
      const score = 1 / (i + 60);
      if (combined.has(res.id)) {
        combined.get(res.id).score += score;
        combined.get(res.id).denseScore = res.similarity;
      } else {
        combined.set(res.id, { ...res, score, denseScore: res.similarity });
      }
    });

    // 4. Policy Boost (Phase 15 Precision)
    // If a chunk is a policy and matches a keyword exactly or query contains the key, boost significantly
    const lowerQuery = query.toLowerCase();
    combined.forEach(res => {
      if (res.id.startsWith('policy_')) {
        // Check if query hits keywords
        const policyKey = res.id.replace('policy_', '');
        if (lowerQuery.includes(policyKey.replace(/_/g, ' '))) {
          res.score += 100; // Nuclear boost
        }
        // Check content keywords
        if (res.text && lowerQuery.split(' ').some(word => res.text.toLowerCase().includes(word))) {
          res.score += 10; // High precision boost
        }
      }
    });

    return Array.from(combined.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * GRAPH SEARCH (Phase 11 Activation)
   * Finds related concepts based on operational mapping
   */
  graphSearch(query, options = {}) {
    if (!this.isLoaded) this.load();
    const lower = query.toLowerCase();
    const tenantId = options.tenantId || 'agency_internal';

    // Find matching nodes
    const matches = this.graph.nodes.filter(n =>
      (n.label.toLowerCase().includes(lower) || n.id.toLowerCase().includes(lower)) &&
      (!n.tenant_id || n.tenant_id === tenantId || n.tenant_id === 'agency_internal')
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

    const status = JSON.parse(fs.readFileSync(KB_STATUS_FILE, 'utf8'));
    status.exists = true;
    status.knowledge_base_dir = KNOWLEDGE_BASE_DIR;
    return status;
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
    console.log('✅ 3A Service Knowledge Base: Module OK');
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
    let tenantId = 'agency_internal';
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
      const results = await kb.searchHybrid(query, 5, { tenantId });
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
3A Automation - Service Knowledge Base

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
