#!/usr/bin/env node
/**
 * VocalIA - Grok/xAI Integration Client (Node.js)
 * Version: 2.0 - RAG Enhanced
 * Created: 2025-12-17
 * Updated: 2025-12-18 - Added RAG Knowledge Base Integration
 *
 * Usage:
 *     node scripts/grok-client.cjs
 *     node scripts/grok-client.cjs --no-rag    # Disable RAG
 *
 * Configuration:
 *     Set XAI_API_KEY in .env file
 *     Get key from: https://console.x.ai/api-keys
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const readline = require('readline');

// Configuration
const XAI_API_KEY = process.env.XAI_API_KEY;
const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';
const USE_RAG = !process.argv.includes('--no-rag');

// RAG Components (lazy loaded) - Uses knowledge-base-services.cjs (SOTA)
let knowledgeBase = null;
let ragInitialized = false;

/**
 * Initialize RAG components using ServiceKnowledgeBase
 * Fixed Session 205: Now uses the working knowledge-base-services.cjs
 */
function initRAG() {
  if (ragInitialized) return true;

  try {
    const { ServiceKnowledgeBase } = require('./knowledge-base-services.cjs');
    knowledgeBase = new ServiceKnowledgeBase();

    if (!knowledgeBase.load()) {
      console.log('RAG Knowledge Base: BUILD REQUIRED');
      console.log('   └─ Run: node core/knowledge-base-services.cjs --build');
      return false;
    }

    const status = knowledgeBase.getStatus();
    ragInitialized = true;
    console.log(`RAG Knowledge Base: ACTIVÉ (${status.chunk_count} chunks)`);
    return true;
  } catch (error) {
    console.log('RAG Knowledge Base: NON DISPONIBLE');
    console.log(`   └─ ${error.message}`);
    return false;
  }
}

/**
 * RAG Query - wrapper for ServiceKnowledgeBase.search()
 */
async function ragQuery(query, options = {}) {
  if (!knowledgeBase) {
    return { hasResults: false, context: '', sources: [], confidence: 0 };
  }

  const topK = options.topK || 5;
  const results = knowledgeBase.search(query, topK);

  if (!results || results.length === 0) {
    return { hasResults: false, context: '', sources: [], confidence: 0 };
  }

  // Format results for prompt injection
  const context = results.map(r => `[${r.id}] ${r.text || r.description}`).join('\n\n');
  const sources = results.map(r => ({ source: r.id, section: r.category || 'general' }));
  const confidence = results[0]?.score || 0.5;

  return { hasResults: true, context, sources, confidence };
}

/**
 * Get knowledge context - wrapper for backward compatibility
 */
function getKnowledgeContext(query, options = {}) {
  if (!knowledgeBase) {
    return null;
  }

  const topK = options.topK || 5;
  const results = knowledgeBase.search(query, topK);

  if (!results || results.length === 0) {
    return null;
  }

  return {
    results,
    query,
    count: results.length
  };
}

// Base System Prompt - VocalIA Voice AI Platform
const BASE_SYSTEM_PROMPT = `Tu es l'assistant IA de VocalIA, une plateforme Voice AI.

## IDENTITÉ

- Nom: VocalIA
- Type: Plateforme Voice AI (SaaS)
- Site: https://vocalia.ma
- Email: contact@vocalia.ma
- Localisation: Maroc, servant le monde entier
- Langues: Français, English, Español, العربية, Darija

## NOS 2 PRODUITS

1. VOICE WIDGET (Browser)
   - Widget JavaScript à intégrer sur n'importe quel site
   - Basé sur Web Speech API (gratuit pour les utilisateurs)
   - Support client 24/7, FAQ, prise de RDV
   - Tier gratuit disponible

2. VOICE TELEPHONY (PSTN)
   - Ligne téléphonique avec IA répondant aux appels
   - Intégration Twilio pour vrais appels téléphoniques
   - Qualification BANT, rappels automatiques
   - Tarification compétitive à la minute

## 40 PERSONAS INDUSTRIE

Personas pré-configurés pour: dentistes, immobilier, contractors,
restaurants, e-commerce, PME, salons, avocats, médecins, etc.

## INTÉGRATIONS (via MCP Server - 182 tools)

- CRM: HubSpot, Pipedrive, Zoho
- E-commerce: Shopify, WooCommerce, Magento, PrestaShop
- Paiements: Stripe (19 tools)
- Calendrier: Google Calendar, Calendly

## PRINCIPES

1. Factualité: Ne jamais faire de claims non vérifiés
2. Transparence: Honnête sur ce qui est possible
3. Pas de bullshit: Réponses directes, actionnables

## FORMAT

- Réponses courtes et actionnables
- Listes pour la clarté
- Pas d'emojis sauf demande explicite`;

/**
 * Build enhanced system prompt with RAG context
 */
async function buildEnhancedPrompt(userMessage) {
  if (!USE_RAG || !ragInitialized) {
    return BASE_SYSTEM_PROMPT;
  }

  try {
    // Get relevant context from knowledge base
    const result = await ragQuery(userMessage, { topK: 5 });

    if (!result.hasResults || result.confidence < 0.3) {
      return BASE_SYSTEM_PROMPT;
    }

    // Build enhanced prompt
    const enhancedPrompt = `${BASE_SYSTEM_PROMPT}

## CONTEXTE KNOWLEDGE BASE (Confiance: ${(result.confidence * 100).toFixed(1)}%)

${result.context}

## SOURCES DISPONIBLES
${result.sources.map(s => `- ${s.source} > ${s.section || 'root'}`).join('\n')}

## INSTRUCTIONS RAG

1. Utilise PRIORITAIREMENT les informations du contexte ci-dessus
2. Cite tes sources avec [Source: nom_du_document]
3. Si l'information n'est pas dans le contexte, utilise tes connaissances générales
4. Précise quand tu utilises des infos hors contexte`;

    return enhancedPrompt;
  } catch (error) {
    console.log(`   └─ RAG fallback: ${error.message}`);
    return BASE_SYSTEM_PROMPT;
  }
}

/**
 * Check if API key is configured
 */
function checkApiKey() {
  if (!XAI_API_KEY) {
    console.log('\n' + '='.repeat(60));
    console.log('ERREUR: XAI_API_KEY non configuré');
    console.log('='.repeat(60));
    console.log('\nPour configurer:');
    console.log('1. Aller sur https://console.x.ai/api-keys');
    console.log('2. Créer une nouvelle clé API');
    console.log('3. Ajouter dans .env: XAI_API_KEY=your_key_here');
    console.log('\n' + '='.repeat(60));
    return false;
  }
  return true;
}

/**
 * Call xAI API for chat completion
 */
async function chatCompletion(userMessage, systemPrompt = null) {
  try {
    // Build enhanced prompt if RAG is enabled
    const finalPrompt = systemPrompt || await buildEnhancedPrompt(userMessage);

    const response = await fetch(XAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${XAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-4-1-fast-reasoning',
        messages: [
          { role: 'system', content: finalPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 2048
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error (${response.status}): ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    return `Erreur: ${error.message}`;
  }
}

/**
 * Test API connection
 */
async function testConnection() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST CONNEXION xAI/GROK');
  console.log('='.repeat(60));

  const testMessage = "Présente-toi brièvement en une phrase.";
  console.log(`\nEnvoi message test: '${testMessage}'`);
  console.log('-'.repeat(40));

  const response = await chatCompletion(testMessage, BASE_SYSTEM_PROMPT);

  console.log('\nRéponse Grok:');
  console.log(response);
  console.log('\n' + '='.repeat(60));

  const success = !response.startsWith('Erreur');
  console.log(success ? 'CONNEXION OK' : 'CONNEXION ÉCHOUÉE');
  console.log('='.repeat(60));

  return success;
}

/**
 * Interactive chat mode
 */
async function interactiveChat() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('\n' + '='.repeat(60));
  console.log('VOCALIA - CHAT INTERACTIF GROK');
  console.log(`RAG: ${USE_RAG && ragInitialized ? 'ACTIVÉ' : 'DÉSACTIVÉ'}`);
  console.log('='.repeat(60));
  console.log("Tapez 'quit' pour quitter");
  console.log("Tapez 'help' pour les commandes disponibles");
  console.log('-'.repeat(60));

  const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

  while (true) {
    try {
      const userInput = (await question('\nVous: ')).trim();

      if (!userInput) continue;

      if (userInput.toLowerCase() === 'quit') {
        console.log('Au revoir!');
        rl.close();
        break;
      }

      if (userInput.toLowerCase() === 'help') {
        console.log('\nCommandes disponibles:');
        console.log('  quit     - Quitter le chat');
        console.log('  help     - Afficher cette aide');
        console.log('  /catalog - Afficher le catalogue (packages, automations)');
        console.log('  /stats   - Statistiques de la knowledge base');
        console.log('\nPosez n\'importe quelle question sur l\'automation,');
        console.log('les analytics, ou l\'IA pour PME.');
        continue;
      }

      // Special commands
      if (userInput === '/catalog' && ragInitialized) {
        const catalog = getCatalog();
        console.log('\n--- CATALOGUE VOCALIA ---');
        console.log(`\nPackages: ${catalog.packages.length}`);
        for (const pkg of catalog.packages) {
          console.log(`  ${pkg.name}: Setup ${pkg.setup}, Monthly ${pkg.monthly}`);
        }
        console.log(`\nAutomations: ${catalog.automations.length}`);
        console.log(`Services: ${catalog.services.length}`);
        console.log(`MCPs: ${catalog.mcps.length}`);
        continue;
      }

      if (userInput === '/stats' && ragInitialized && knowledgeBase) {
        const stats = knowledgeBase.getStatus();
        console.log('\n--- KNOWLEDGE BASE STATS ---');
        console.log(`Chunks: ${stats.chunk_count}`);
        console.log(`Terms: ${stats.term_count}`);
        console.log(`Automations: ${stats.automations_count}`);
        console.log(`Categories: ${stats.categories_count}`);
        continue;
      }

      console.log('\nChargement...');
      const response = await chatCompletion(userInput);
      console.log(`\nVocalIA Assistant: ${response}`);

    } catch (error) {
      if (error.message === 'readline was closed') {
        break;
      }
      console.error('Erreur:', error.message);
    }
  }
}

/**
 * Generate audit analysis (RAG enhanced)
 */
async function generateAuditAnalysis(dataJson) {
  const prompt = `Analyse les données suivantes et génère un rapport d'audit avec:
1. Points forts identifiés
2. Problèmes critiques (priorité haute)
3. Opportunités d'amélioration
4. Recommandations actionnables avec estimation d'impact

Données: ${dataJson}

Format: Markdown structuré, factuel uniquement.`;

  return chatCompletion(prompt);
}

/**
 * Generate email content (RAG enhanced)
 */
async function generateEmailContent(flowType, productName, price) {
  const prompt = `Génère le contenu email pour un flow ${flowType}.
Produit: ${productName}
Prix: ${price}

Retourne:
- Subject line (50 chars max)
- Preview text (90 chars max)
- Body HTML structure avec CTA clair`;

  return chatCompletion(prompt);
}

/**
 * Query knowledge base directly
 * Fixed Session 205: Uses ServiceKnowledgeBase
 */
async function queryKnowledgeBase(query) {
  if (!ragInitialized || !knowledgeBase) {
    return { error: 'RAG not initialized. Run initRAG() first.' };
  }

  const results = knowledgeBase.search(query, 5);

  if (!results || results.length === 0) {
    return { found: false, results: [], query };
  }

  return {
    found: true,
    results: results.map(r => ({
      id: r.id,
      text: r.text || r.description,
      score: r.score,
      category: r.category
    })),
    query,
    count: results.length
  };
}

/**
 * Main entry point
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('VOCALIA - GROK CLIENT v2.0 (RAG Enhanced)');
  console.log('Projet: vocalia');
  console.log('='.repeat(60));

  // Check API key
  if (!checkApiKey()) {
    process.exit(1);
  }

  // Initialize RAG
  if (USE_RAG) {
    initRAG();
  } else {
    console.log('RAG Knowledge Base: DÉSACTIVÉ (--no-rag)');
  }

  // Test connection
  const connected = await testConnection();
  if (!connected) {
    process.exit(1);
  }

  // Start interactive chat
  await interactiveChat();
}

// Export for use as module
module.exports = {
  chatCompletion,
  generateAuditAnalysis,
  generateEmailContent,
  queryKnowledgeBase,
  initRAG,
  BASE_SYSTEM_PROMPT
};

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
