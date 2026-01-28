#!/usr/bin/env node
/**
 * 3A Automation - Voice Agent Core (B2B Agency Context)
 *
 * DUAL-ROLE Voice-enabled AI Assistant for 3A Automation:
 * 1. SALES ASSISTANT - Automation discovery, recommendations, pricing
 * 2. CUSTOMER SUPPORT - Project status, questions, onboarding
 *
 * Technology Stack:
 * - Grok Voice API (xAI) for real-time voice interaction
 * - RAG (Retrieval-Augmented Generation) for service knowledge
 * - TF-IDF knowledge base for 119 automations
 * - Google Calendar integration for booking
 *
 * Transferred from MyDealz via Technology Shelf (adapted for B2B)
 * Original: MyDealz scripts/voice_agent_core.py
 *
 * Version: 1.0.0 | Session 144 | 23/01/2026
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Load environment variables
const envPaths = [
  path.join(__dirname, '../../../.env'),
  path.join(__dirname, '../../../.env.admin'),
  path.join(process.cwd(), '.env')
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
  }
}

// Import Knowledge Base
let ServiceKnowledgeBase;
try {
  ServiceKnowledgeBase = require('./knowledge-base-services.cjs').ServiceKnowledgeBase;
} catch (e) {
  ServiceKnowledgeBase = null;
}

// Configuration
const XAI_API_KEY = process.env.XAI_API_KEY || '';
const GROK_TEXT_ENDPOINT = 'https://api.x.ai/v1/chat/completions';
const GROK_MODEL = 'grok-4-1-fast-non-reasoning';

// Paths
const BASE_DIR = path.join(__dirname, '../../..');
const CONVERSATION_LOG_DIR = path.join(BASE_DIR, 'logs/voice_conversations');

// Service Packs (3A offerings)
const SERVICE_PACKS = {
  starter: {
    name: 'Starter Pack',
    name_fr: 'Pack Starter',
    price: '€500/mois',
    automations: 10,
    description: 'Ideal for small businesses starting with automation',
    description_fr: 'Idéal pour les petites entreprises débutant l\'automatisation'
  },
  growth: {
    name: 'Growth Pack',
    name_fr: 'Pack Growth',
    price: '€1,500/mois',
    automations: 30,
    description: 'For growing businesses needing comprehensive automation',
    description_fr: 'Pour les entreprises en croissance nécessitant une automatisation complète'
  },
  enterprise: {
    name: 'Enterprise Pack',
    name_fr: 'Pack Enterprise',
    price: 'Sur devis',
    automations: 'Unlimited',
    description: 'Full-scale automation with dedicated support',
    description_fr: 'Automatisation complète avec support dédié'
  }
};

/**
 * RAG Retrieval System
 */
class RAGRetrieval {
  constructor() {
    this.kb = null;
    this.isInitialized = false;
  }

  initialize() {
    if (!ServiceKnowledgeBase) {
      console.error('ERROR: ServiceKnowledgeBase module not available');
      return false;
    }

    try {
      this.kb = new ServiceKnowledgeBase();
      if (!this.kb.load()) {
        console.log('WARNING: Knowledge base not built yet');
        console.log('Run: node knowledge-base-services.cjs --build');
        return false;
      }
      this.isInitialized = true;
      const status = this.kb.getStatus();
      console.log(`RAG initialized: ${status.chunk_count} services indexed`);
      return true;
    } catch (e) {
      console.error(`ERROR initializing RAG: ${e.message}`);
      return false;
    }
  }

  retrieveContext(query, topK = 3) {
    if (!this.isInitialized) return [];
    try {
      return this.kb.search(query, topK);
    } catch (e) {
      console.error(`ERROR retrieving context: ${e.message}`);
      return [];
    }
  }

  formatContextForPrompt(context) {
    if (!context || context.length === 0) {
      return 'No relevant automation information found.';
    }

    let formatted = 'RELEVANT AUTOMATIONS:\n\n';
    for (let i = 0; i < context.length; i++) {
      const item = context[i];
      formatted += `[Automation ${i + 1}]: ${item.title}\n`;
      formatted += `Category: ${item.category_name || item.category}\n`;
      formatted += `Benefit: ${item.benefit_en || 'N/A'}\n`;
      formatted += `Frequency: ${item.frequency_en || 'On demand'}\n`;
      if (item.agentic_level) {
        formatted += `Agentic Level: L${item.agentic_level}\n`;
      }
      formatted += '\n';
    }
    return formatted;
  }
}

/**
 * B2B Voice Agent Core
 */
class VoiceAgentB2B {
  constructor() {
    this.rag = new RAGRetrieval();
    this.currentSession = null;
    this.systemPrompt = this._buildSystemPrompt();

    // Ensure log directory exists
    if (!fs.existsSync(CONVERSATION_LOG_DIR)) {
      fs.mkdirSync(CONVERSATION_LOG_DIR, { recursive: true });
    }
  }

  _buildSystemPrompt() {
    return `You are the 3A Automation AI Assistant, a dual-role voice assistant for 3A Automation agency that handles BOTH sales assistance AND customer support.

═══════════════════════════════════════════════════════════════════
ABOUT 3A AUTOMATION
═══════════════════════════════════════════════════════════════════
- Agency: https://3a-automation.com
- Specialization: Marketing automation for e-commerce and B2B
- Services: 119 automation solutions across 10 categories
- Markets: France, Europe, North America
- Languages: French (native), English (fluent)

═══════════════════════════════════════════════════════════════════
ROLE 1: SALES ASSISTANT (60%)
═══════════════════════════════════════════════════════════════════
Help potential clients discover and choose automation solutions:

CAPABILITIES:
- Automation search by category, use case, industry
- Personalized recommendations based on business needs
- Solution comparisons ("What's better for abandoned carts?")
- ROI estimations and benefit explanations
- Service pack recommendations (Starter/Growth/Enterprise)
- Booking discovery calls

SALES TRIGGERS:
- "looking for", "need", "want", "searching for"
- "recommend", "suggest", "best solution"
- "compare", "difference between", "which is better"
- "price", "cost", "pricing", "pack", "package"
- "ROI", "benefit", "results"

SALES RESPONSE STYLE:
- Consultative and professional
- Focus on business outcomes, not features
- Quantify benefits when possible ("+15% leads", "-30% no-shows")
- Recommend booking a call for complex needs

SERVICE PACKS:
- Starter Pack: €500/month - 10 automations - Small businesses
- Growth Pack: €1,500/month - 30 automations - Growing companies
- Enterprise Pack: Custom pricing - Unlimited - Full-scale automation

═══════════════════════════════════════════════════════════════════
ROLE 2: CUSTOMER SUPPORT (40%)
═══════════════════════════════════════════════════════════════════
Help existing clients with their projects and questions:

CAPABILITIES:
- Automation explanations and how-tos
- Best practices recommendations
- Integration guidance
- Troubleshooting common issues
- Escalation to human support

SUPPORT TRIGGERS:
- "how do I", "how does", "explain"
- "problem", "issue", "not working"
- "help", "support", "question"
- "integrate", "connect", "setup"

SUPPORT RESPONSE STYLE:
- Patient and educational
- Step-by-step when explaining processes
- Offer to escalate for complex technical issues

═══════════════════════════════════════════════════════════════════
AUTOMATION CATEGORIES (119 total)
═══════════════════════════════════════════════════════════════════
1. Lead Generation & Acquisition (20 automations)
   - Meta/Google/TikTok leads sync
   - Lead scoring AI
   - LinkedIn/Google Maps sourcing

2. Email Marketing & CRM (9 automations)
   - Welcome series, Abandoned cart, Win-back
   - A/B sender rotation, Flows audit

3. SEO & Content (9 automations)
   - Alt text fix, Meta tags, Image sitemap
   - Blog generator, Schema.org

4. Shopify Admin (13 automations)
   - Product enrichment, Collection management
   - Store audit, Google taxonomy

5. Analytics & Reporting (9 automations)
   - Looker dashboards, GA4 reports
   - Inventory analysis, BNPL tracking

6. Content & Video (8 automations)
   - Promo videos, Blog + social distribution
   - Google Shopping feeds

7. AI Avatar & Influencer (2 automations)
   - AI avatar generator, Talking video

8. Voice AI & Telephony (3 automations)
   - Web voice widget, Phone assistant
   - Real-time voice (Grok)

9. WhatsApp Business (2 automations)
   - Booking confirmations, Reminders

10. Retention & Churn (5+ automations)
    - Churn prediction, At-risk flows
    - Price drop alerts, Replenishment

11. Dropshipping (3 automations)
    - CJDropshipping, BigBuy sync
    - Multi-supplier orchestration

═══════════════════════════════════════════════════════════════════
VOICE RESPONSE GUIDELINES
═══════════════════════════════════════════════════════════════════
- Keep responses under 3 sentences for voice clarity
- Use natural, professional language
- Avoid technical jargon unless the client is technical
- Confirm understanding before detailed explanations
- For complex needs, offer to book a discovery call

═══════════════════════════════════════════════════════════════════
BOOKING A CALL
═══════════════════════════════════════════════════════════════════
When a client wants to discuss further:
"I'd be happy to arrange a discovery call with our team. You can book directly at 3a-automation.com/booking or I can have someone reach out to you. What works best?"

═══════════════════════════════════════════════════════════════════
ESCALATION TO HUMAN
═══════════════════════════════════════════════════════════════════
Transfer when:
- Client explicitly requests human agent
- Complex technical integration questions
- Pricing negotiations
- Custom development requests
- Complaints or issues

Say: "I'll connect you with one of our specialists who can help further. You can also email contact@3a-automation.com or book a call at 3a-automation.com/booking."

═══════════════════════════════════════════════════════════════════
IMPORTANT RULES
═══════════════════════════════════════════════════════════════════
- Use provided automation context from RAG when available
- Never make up ROI numbers unless from documentation
- Say "Let me find that for you" when searching
- Always be honest about capabilities and limitations
- Speak naturally - this is a voice conversation
`;
  }

  initialize() {
    const result = {
      success: true,
      rag_status: 'not_initialized',
      voice_api_status: 'not_configured',
      errors: []
    };

    // Initialize RAG
    if (this.rag.initialize()) {
      result.rag_status = 'ready';
    } else {
      result.rag_status = 'failed';
      result.errors.push('RAG initialization failed');
    }

    // Check Voice API
    if (XAI_API_KEY) {
      result.voice_api_status = 'configured';
    } else {
      result.voice_api_status = 'missing_api_key';
      result.errors.push('XAI_API_KEY not set');
    }

    if (result.errors.length > 0) {
      result.success = false;
    }

    return result;
  }

  startSession() {
    const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    this.currentSession = {
      session_id: sessionId,
      started_at: new Date().toISOString(),
      messages: [],
      automations_discussed: [],
      intent: null
    };
    return sessionId;
  }

  async processTextInput(userInput) {
    if (!this.currentSession) {
      this.startSession();
    }

    // Retrieve RAG context
    const ragContext = this.rag.retrieveContext(userInput);

    // Add user message
    this.currentSession.messages.push({
      role: 'user',
      content: userInput,
      timestamp: new Date().toISOString(),
      rag_context: ragContext
    });

    // Build context string
    const contextStr = this.rag.formatContextForPrompt(ragContext);

    // Generate response
    const response = await this._generateResponse(userInput, contextStr);

    // Add assistant message
    this.currentSession.messages.push({
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString()
    });

    // Track automations discussed
    for (const item of ragContext) {
      if (!this.currentSession.automations_discussed.includes(item.id)) {
        this.currentSession.automations_discussed.push(item.id);
      }
    }

    return {
      session_id: this.currentSession.session_id,
      response,
      rag_context: ragContext,
      automations_discussed: this.currentSession.automations_discussed
    };
  }

  async _generateResponse(userInput, context) {
    if (!XAI_API_KEY) {
      return this._generateFallbackResponse(userInput, context);
    }

    try {
      const response = await this._callGrokAPI(userInput, context);
      return response;
    } catch (e) {
      console.error(`Grok API error: ${e.message}`);
      return this._generateFallbackResponse(userInput, context);
    }
  }

  _callGrokAPI(userInput, context) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        model: GROK_MODEL,
        messages: [
          { role: 'system', content: this.systemPrompt + '\n\n' + context },
          { role: 'user', content: userInput }
        ],
        max_tokens: 300,
        temperature: 0.7
      });

      const options = {
        hostname: 'api.x.ai',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${XAI_API_KEY}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        },
        timeout: 30000
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            if (json.choices && json.choices[0]) {
              resolve(json.choices[0].message.content);
            } else {
              reject(new Error('Invalid API response'));
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Request timeout')));
      req.write(data);
      req.end();
    });
  }

  _generateFallbackResponse(userInput, context) {
    const input = userInput.toLowerCase();

    // PRICING / PACKS
    if (input.includes('price') || input.includes('cost') || input.includes('pricing') || input.includes('pack')) {
      return "We offer three service packs: Starter at €500/month for 10 automations, Growth at €1,500/month for 30 automations, and Enterprise with custom pricing for unlimited automations. Which level fits your needs?";
    }

    // BOOKING
    if (input.includes('book') || input.includes('call') || input.includes('meeting') || input.includes('appointment')) {
      return "I'd be happy to arrange a discovery call. You can book directly at 3a-automation.com/booking, or I can have one of our specialists reach out to you. What works best?";
    }

    // EMAIL AUTOMATION
    if (input.includes('email') || input.includes('abandoned cart') || input.includes('klaviyo')) {
      return "We have 9 email marketing automations including abandoned cart recovery, welcome series, and win-back flows. Our abandoned cart series recovers up to 15% of lost sales. Would you like more details?";
    }

    // LEAD GENERATION
    if (input.includes('lead') || input.includes('acquisition') || input.includes('prospect')) {
      return "Our lead generation suite includes 20 automations for Meta, Google, and TikTok leads sync, plus AI-powered lead scoring and LinkedIn sourcing. What type of leads are you looking to capture?";
    }

    // VOICE AI
    if (input.includes('voice') || input.includes('telephony') || input.includes('phone')) {
      return "Our Voice AI solutions include web widgets for 24/7 customer support and phone assistants for automated booking. We use Grok real-time voice with fallback to Gemini. Would this fit your business?";
    }

    // SEO
    if (input.includes('seo') || input.includes('content') || input.includes('blog')) {
      return "Our SEO automations include AI blog generation with social distribution, alt text fixes for images, and schema markup. Our blog generator posts to Facebook and LinkedIn automatically. Interested?";
    }

    // SHOPIFY
    if (input.includes('shopify') || input.includes('store') || input.includes('ecommerce')) {
      return "We have 13 Shopify automations including product enrichment, collection management, and comprehensive store audits. These help optimize your store's conversion rate. Which area needs attention?";
    }

    // DROPSHIPPING
    if (input.includes('dropship') || input.includes('supplier') || input.includes('cj') || input.includes('bigbuy')) {
      return "Our dropshipping suite automates orders with CJDropshipping and BigBuy, including multi-supplier routing and real-time tracking sync. Perfect for hands-off fulfillment.";
    }

    // GREETINGS
    if (input.includes('hello') || input.includes('hi') || input.includes('bonjour')) {
      return "Hello! Welcome to 3A Automation. I'm your AI assistant, here to help you discover the right automation solutions for your business or answer questions about our services. How can I help you today?";
    }

    // WHAT DO YOU DO
    if (input.includes('what do you') || input.includes('services') || input.includes('do you offer')) {
      return "3A Automation offers 119 marketing automation solutions across email marketing, lead generation, SEO, Shopify admin, analytics, Voice AI, and more. We serve e-commerce and B2B businesses. What area interests you most?";
    }

    // CONTEXT-BASED (if RAG found something)
    if (context.includes('RELEVANT AUTOMATIONS')) {
      return "Based on your question, I found some relevant automations. " + context.slice(0, 300) + "... Would you like more details on any of these?";
    }

    // DEFAULT
    return "I can help you find the right automation solutions. We offer 119 automations across lead generation, email marketing, SEO, Shopify, analytics, Voice AI, and more. What area of your business needs automation?";
  }

  endSession() {
    if (!this.currentSession) {
      return { success: false, error: 'No active session' };
    }

    // Save conversation log
    const logFile = path.join(
      CONVERSATION_LOG_DIR,
      `conversation_${this.currentSession.session_id}_${new Date().toISOString().slice(0, 10)}.json`
    );

    const sessionData = {
      session_id: this.currentSession.session_id,
      started_at: this.currentSession.started_at,
      ended_at: new Date().toISOString(),
      message_count: this.currentSession.messages.length,
      automations_discussed: this.currentSession.automations_discussed,
      messages: this.currentSession.messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp
      }))
    };

    fs.writeFileSync(logFile, JSON.stringify(sessionData, null, 2));

    const result = {
      success: true,
      session_id: this.currentSession.session_id,
      message_count: this.currentSession.messages.length,
      automations_discussed: this.currentSession.automations_discussed,
      log_file: logFile
    };

    this.currentSession = null;
    return result;
  }

  getStatus() {
    return {
      rag_initialized: this.rag.isInitialized,
      api_key_configured: Boolean(XAI_API_KEY),
      active_session: this.currentSession?.session_id || null,
      service_packs: Object.keys(SERVICE_PACKS),
      knowledge_base_status: this.rag.kb?.getStatus() || 'not_initialized'
    };
  }
}

/**
 * Interactive CLI for testing
 */
async function runInteractiveCLI() {
  const readline = require('readline');

  console.log('\n' + '='.repeat(60));
  console.log('3A AUTOMATION - Voice Agent B2B - Interactive CLI');
  console.log('='.repeat(60));
  console.log("Type 'quit' to exit, 'status' to check agent status");
  console.log('='.repeat(60) + '\n');

  const agent = new VoiceAgentB2B();
  const initResult = agent.initialize();

  console.log(`Initialization: ${JSON.stringify(initResult, null, 2)}`);

  if (!initResult.success) {
    console.log('\nWARNING: Agent initialized with errors. Some features may not work.');
  }

  agent.startSession();
  console.log(`\nSession started: ${agent.currentSession.session_id}`);
  console.log('-'.repeat(40));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const askQuestion = () => {
    rl.question('\nYou: ', async (input) => {
      input = input.trim();

      if (!input) {
        askQuestion();
        return;
      }

      if (input.toLowerCase() === 'quit') {
        const result = agent.endSession();
        console.log(`\nSession ended: ${JSON.stringify(result, null, 2)}`);
        rl.close();
        return;
      }

      if (input.toLowerCase() === 'status') {
        console.log(`\nStatus: ${JSON.stringify(agent.getStatus(), null, 2)}`);
        askQuestion();
        return;
      }

      try {
        const result = await agent.processTextInput(input);
        console.log(`\nAssistant: ${result.response}`);

        if (result.rag_context && result.rag_context.length > 0) {
          console.log(`\n[RAG: Found ${result.rag_context.length} relevant automations]`);
        }
      } catch (e) {
        console.error(`Error: ${e.message}`);
      }

      askQuestion();
    });
  };

  askQuestion();
}

// CLI
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--health')) {
    console.log('✅ 3A Voice Agent B2B: Module OK');

    const agent = new VoiceAgentB2B();
    const initResult = agent.initialize();

    console.log(`   RAG Status: ${initResult.rag_status}`);
    console.log(`   Voice API: ${initResult.voice_api_status}`);
    console.log(`   Service Packs: ${Object.keys(SERVICE_PACKS).length}`);

    if (initResult.rag_status === 'ready') {
      const kbStatus = agent.rag.kb.getStatus();
      console.log(`   Knowledge Base: ${kbStatus.chunk_count} services indexed`);
    }

    process.exit(initResult.success ? 0 : 1);
  }

  if (args.includes('--interactive')) {
    await runInteractiveCLI();
    return;
  }

  if (args.includes('--status')) {
    const agent = new VoiceAgentB2B();
    agent.initialize();
    console.log(JSON.stringify(agent.getStatus(), null, 2));
    return;
  }

  if (args.includes('--test')) {
    const queryIndex = args.indexOf('--test') + 1;
    const query = args.slice(queryIndex).join(' ') || 'What automations do you offer?';

    const agent = new VoiceAgentB2B();
    agent.initialize();
    agent.startSession();

    const result = await agent.processTextInput(query);
    console.log(`\nQuery: ${query}`);
    console.log(`Response: ${result.response}`);
    console.log(`RAG Context: ${result.rag_context.length} items`);

    agent.endSession();
    return;
  }

  // Default: show help
  console.log(`
3A Automation - Voice Agent B2B

Usage:
  node voice-agent-b2b.cjs --health       Health check
  node voice-agent-b2b.cjs --interactive  Interactive CLI for testing
  node voice-agent-b2b.cjs --status       Show agent status
  node voice-agent-b2b.cjs --test <query> Test with a single query

Examples:
  node voice-agent-b2b.cjs --test "What email automations do you have?"
  node voice-agent-b2b.cjs --test "How much does the Growth pack cost?"
  node voice-agent-b2b.cjs --test "I need help with lead generation"
`);
}

// Export for use as module
module.exports = { VoiceAgentB2B, RAGRetrieval, SERVICE_PACKS };

// Run if called directly
if (require.main === module) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
