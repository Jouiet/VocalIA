#!/usr/bin/env node
/**
 * RAG QUERY INTERFACE - Knowledge Base
 * ====================================
 * Main interface for RAG queries
 * Combines vector search with LLM response generation
 *
 * Usage:
 *   const { ragQuery, getKnowledgeContext } = require('./rag-query.cjs');
 *   const response = await ragQuery('Combien coûte le package Growth?');
 */

const { createVectorStore } = require('./vector-store.cjs');

// Initialize store once
let vectorStore = null;

/**
 * Initialize the vector store (lazy loading)
 */
function getStore() {
  if (!vectorStore) {
    vectorStore = createVectorStore();
  }
  return vectorStore;
}

/**
 * Get knowledge context for a query
 * Returns structured context ready for LLM
 */
function getKnowledgeContext(query, options = {}) {
  const store = getStore();
  const { context, sources, confidence } = store.getContext(query, {
    topK: options.topK || 5,
    category: options.category || null
  });

  return {
    context,
    sources,
    confidence,
    hasResults: context.length > 0
  };
}

/**
 * Build system prompt with RAG context
 */
function buildRAGPrompt(query, knowledgeContext) {
  const basePrompt = `Tu es l'assistant intelligent de 3A Automation, expert en automatisation e-commerce, analytics et IA.

RÈGLES STRICTES:
1. Réponds UNIQUEMENT basé sur le contexte fourni ci-dessous
2. Si l'information n'est pas dans le contexte, dis "Je n'ai pas cette information dans ma base de connaissances"
3. Cite tes sources avec [Source: nom_du_document]
4. Sois précis, factuel et professionnel
5. Réponds en français

CONTEXTE DE LA BASE DE CONNAISSANCES:
${knowledgeContext.context || 'Aucun contexte pertinent trouvé.'}

SOURCES DISPONIBLES:
${knowledgeContext.sources.map(s => `- ${s.source} (${s.section || 'root'}) - Score: ${s.score}`).join('\n')}

CONFIANCE: ${(knowledgeContext.confidence * 100).toFixed(1)}%`;

  return basePrompt;
}

/**
 * Format response with sources
 */
function formatResponse(response, sources) {
  let formatted = response;

  if (sources.length > 0) {
    formatted += '\n\n---\n📚 Sources:\n';
    for (const src of sources) {
      formatted += `• ${src.source}`;
      if (src.section) {
        formatted += ` > ${src.section}`;
      }
      formatted += '\n';
    }
  }

  return formatted;
}

/**
 * Main RAG query function
 * Returns context and prompt for LLM integration
 */
async function ragQuery(query, options = {}) {
  console.log(`\n🔍 RAG Query: "${query}"`);

  // Get knowledge context
  const knowledgeContext = getKnowledgeContext(query, options);

  console.log(`   └─ Confidence: ${(knowledgeContext.confidence * 100).toFixed(1)}%`);
  console.log(`   └─ Sources: ${knowledgeContext.sources.length}`);

  // Build RAG prompt
  const systemPrompt = buildRAGPrompt(query, knowledgeContext);

  return {
    systemPrompt,
    context: knowledgeContext.context,
    sources: knowledgeContext.sources,
    confidence: knowledgeContext.confidence,
    hasResults: knowledgeContext.hasResults
  };
}

/**
 * Search for specific product/service information
 */
function searchCatalog(query) {
  return getKnowledgeContext(query, { category: 'catalog' });
}

/**
 * Search methodology/process information
 */
function searchMethodology(query) {
  return getKnowledgeContext(query, { category: 'methodology' });
}

/**
 * Search pricing/business information
 */
function searchPricing(query) {
  const store = getStore();

  // Multi-category search for pricing
  const catalogResults = store.search(query, { category: 'catalog', topK: 3 });
  const businessResults = store.search(query, { category: 'business', topK: 3 });

  // Merge and sort
  const allResults = [...catalogResults, ...businessResults];
  allResults.sort((a, b) => b.score - a.score);

  return allResults.slice(0, 5);
}

/**
 * Get all available categories
 */
function getCategories() {
  const store = getStore();
  const categories = new Set();

  for (const doc of store.documents) {
    categories.add(doc.category);
  }

  return Array.from(categories);
}

/**
 * Get stats about the knowledge base
 */
function getKBStats() {
  const store = getStore();

  const statsByCategory = {};
  for (const doc of store.documents) {
    statsByCategory[doc.category] = (statsByCategory[doc.category] || 0) + 1;
  }

  return {
    totalDocuments: store.totalDocs,
    uniqueTokens: Object.keys(store.docFrequencies).length,
    avgDocLength: Math.round(store.avgDocLength),
    categories: statsByCategory
  };
}

// CLI Test
if (require.main === module) {
  console.log('\n' + '═'.repeat(60));
  console.log('  RAG QUERY INTERFACE - Test');
  console.log('═'.repeat(60));

  // Get stats
  const stats = getKBStats();
  console.log('\n📊 Knowledge Base Stats:');
  console.log(`   ├─ Total chunks: ${stats.totalDocuments}`);
  console.log(`   ├─ Unique tokens: ${stats.uniqueTokens}`);
  console.log(`   ├─ Avg chunk size: ${stats.avgDocLength} tokens`);
  console.log(`   └─ Categories: ${Object.keys(stats.categories).join(', ')}`);

  // Test queries
  const testQueries = [
    'Quel est le prix du package Growth?',
    'Quelles automatisations Klaviyo sont disponibles?',
    'Comment fonctionne la méthodologie Flywheel?',
    'Quels sont les services proposés par 3A Automation?'
  ];

  (async () => {
    for (const query of testQueries) {
      const result = await ragQuery(query);
      console.log(`\n📝 System Prompt Length: ${result.systemPrompt.length} chars`);
      console.log(`   Has Results: ${result.hasResults}`);
    }

    console.log('\n' + '═'.repeat(60) + '\n');
  })();
}

module.exports = {
  ragQuery,
  getKnowledgeContext,
  buildRAGPrompt,
  formatResponse,
  searchCatalog,
  searchMethodology,
  searchPricing,
  getCategories,
  getKBStats
};
