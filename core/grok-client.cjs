#!/usr/bin/env node
/**
 * 3A Automation - Grok/xAI Integration Client (Node.js)
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

// RAG Components (lazy loaded)
let ragQuery = null;
let getKnowledgeContext = null;
let getCatalog = null;
let ragInitialized = false;

/**
 * Initialize RAG components
 */
function initRAG() {
  if (ragInitialized) return true;

  try {
    const ragModule = require('../knowledge-base/src/rag-query.cjs');
    const catalogModule = require('../knowledge-base/src/catalog-extractor.cjs');

    ragQuery = ragModule.ragQuery;
    getKnowledgeContext = ragModule.getKnowledgeContext;
    getCatalog = catalogModule.getCatalog;
    ragInitialized = true;

    console.log('RAG Knowledge Base: ACTIVÉ');
    return true;
  } catch (error) {
    console.log('RAG Knowledge Base: NON DISPONIBLE');
    console.log(`   └─ ${error.message}`);
    return false;
  }
}

// Base System Prompt
const BASE_SYSTEM_PROMPT = `Tu es l'assistant IA de 3A Automation (AAA - AI Automation Agency), spécialisée en Automatisation E-commerce (B2C) et Workflows PME (B2B).

## IDENTITÉ

- Nom: 3A Automation (Automation, Analytics, AI)
- Type: Agence d'Automatisation AI (AAA)
- Site: https://3a-automation.com
- Email: contact@3a-automation.com
- Localisation: Maroc, servant MENA et monde entier
- Langues: Français (principal), Anglais, Arabe (sur demande)

## SPÉCIALISATION

- Automatisation E-commerce (B2C) - TOUTES plateformes
- Workflows PME (B2B) - TOUTES plateformes
- Analytics & Tracking
- Intégrations AI

## EXPERTISE TECHNIQUE (TOUTES PLATEFORMES)

E-commerce: Shopify, WooCommerce, Magento, PrestaShop, BigCommerce, etc.
Email Marketing: Klaviyo, Mailchimp, Omnisend, HubSpot, Brevo, etc.
Analytics: Google Analytics 4, Mixpanel, Amplitude, etc.
Automation: n8n, Make, Zapier, scripts natifs Node.js
Marketing: Meta Ads, Google Ads, TikTok Ads, LinkedIn Ads

## SERVICES OFFERTS

1. Automatisation E-commerce (TOUTES plateformes: sync, webhooks, flows)
2. Analytics & Reporting (audits, dashboards GA4)
3. AI Integration (génération contenu, SEO automatisé)

OFFRE GRATUITE: Audit e-commerce complet
URL: https://3a-automation.com/#contact

## CIBLE CLIENT

PME de tous secteurs (e-commerce, healthcare, B2B, retail)
Revenue: €10k-500k/mois
Budget: €300-1000/mois

## PRINCIPES

1. Factualité: Ne jamais faire de claims non vérifiés
2. Transparence: Honnête sur ce qui est possible
3. ROI Focus: Actions liées à résultats mesurables
4. Pas de bullshit: Réponses directes, actionnables

## FORMAT

- Réponses courtes et actionnables
- Listes pour la clarté
- Exemples concrets
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
  console.log('3A AUTOMATION - CHAT INTERACTIF GROK');
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
        console.log('\n--- CATALOGUE 3A AUTOMATION ---');
        console.log(`\nPackages: ${catalog.packages.length}`);
        for (const pkg of catalog.packages) {
          console.log(`  ${pkg.name}: Setup ${pkg.setup}, Monthly ${pkg.monthly}`);
        }
        console.log(`\nAutomations: ${catalog.automations.length}`);
        console.log(`Services: ${catalog.services.length}`);
        console.log(`MCPs: ${catalog.mcps.length}`);
        continue;
      }

      if (userInput === '/stats' && ragInitialized) {
        const { getKBStats } = require('../knowledge-base/src/rag-query.cjs');
        const stats = getKBStats();
        console.log('\n--- KNOWLEDGE BASE STATS ---');
        console.log(`Chunks: ${stats.totalDocuments}`);
        console.log(`Tokens: ${stats.uniqueTokens}`);
        console.log(`Avg chunk: ${stats.avgDocLength} tokens`);
        console.log('Categories:', Object.keys(stats.categories).join(', '));
        continue;
      }

      console.log('\nChargement...');
      const response = await chatCompletion(userInput);
      console.log(`\n3A Assistant: ${response}`);

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
 */
async function queryKnowledgeBase(query) {
  if (!ragInitialized) {
    return { error: 'RAG not initialized' };
  }

  return getKnowledgeContext(query, { topK: 5 });
}

/**
 * Main entry point
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('3A AUTOMATION - GROK CLIENT v2.0 (RAG Enhanced)');
  console.log('Projet: 3a-automations');
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
