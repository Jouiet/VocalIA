#!/usr/bin/env node
/**
 * VocalIA - Voice Agent B2B Sales & Support
 *
 * DUAL-ROLE Voice-enabled AI Assistant for VocalIA platform:
 * 1. SALES ASSISTANT - Voice AI product demos, pricing, use cases
 * 2. CUSTOMER SUPPORT - Integration help, persona guidance, troubleshooting
 *
 * VocalIA Platform (2 Products):
 * - Voice Widget: Browser-based voice assistant (Web Speech API, free tier)
 * - Voice Telephony: PSTN AI Bridge (Twilio, per-minute pricing)
 *
 * Technology Stack:
 * - Grok Voice API (xAI) for real-time voice
 * - Multi-AI fallback (Grok → Gemini → Claude → Atlas for Darija)
 * - 40 Industry Personas (SOTA structure)
 * - 5 Languages: FR, EN, ES, AR, Darija
 * - MCP Server with 182 tools
 *
 * A2A Protocol Compliance: Agent Card + Task Lifecycle
 *
 * Version: 2.0.0 | Session 250.31 | 31/01/2026
 */

// ─────────────────────────────────────────────────────────────────────────────
// A2A AGENT CARD (Google A2A Protocol Spec)
// https://a2a-protocol.org/latest/specification/
// ─────────────────────────────────────────────────────────────────────────────

const AGENT_CARD = {
    name: "VoiceAgentB2B",
    version: "2.0.0",
    description: "Voice AI sales and support assistant for VocalIA platform",
    provider: {
        organization: "VocalIA",
        url: "https://vocalia.ma"
    },
    capabilities: {
        streaming: true,
        pushNotifications: false,
        stateTransitionHistory: true
    },
    skills: [
        {
            id: "voice_widget_demo",
            name: "Voice Widget Demo",
            description: "Demonstrate browser-based Voice Widget features and use cases",
            inputModes: ["audio", "text"],
            outputModes: ["audio", "text"]
        },
        {
            id: "telephony_demo",
            name: "Telephony Demo",
            description: "Explain PSTN AI Bridge capabilities and Twilio integration",
            inputModes: ["audio", "text"],
            outputModes: ["audio", "text"]
        },
        {
            id: "persona_guidance",
            name: "Persona Guidance",
            description: "Help select from 40 industry personas (dental, property, contractor, etc.)",
            inputModes: ["audio", "text"],
            outputModes: ["audio", "text"]
        },
        {
            id: "integration_support",
            name: "Integration Support",
            description: "Guide MCP Server setup, CRM/e-commerce integrations",
            inputModes: ["text"],
            outputModes: ["application/json"]
        }
    ],
    authentication: {
        schemes: ["bearer"]
    },
    defaultInputModes: ["audio", "text"],
    defaultOutputModes: ["audio", "text"]
};

// A2A Task States
const TASK_STATES = {
    SUBMITTED: 'submitted',
    WORKING: 'working',
    INPUT_REQUIRED: 'input-required',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELED: 'canceled'
};

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

// VocalIA Pricing Plans (Voice AI Platform)
const SERVICE_PACKS = {
  free: {
    name: 'Free',
    name_fr: 'Gratuit',
    price: '0 DH/mois',
    description: 'Voice Widget with limited interactions',
    description_fr: 'Widget Voice avec interactions limitées',
    includes: ['Voice Widget', '1000 interactions/mois', '3 personas']
  },
  pro: {
    name: 'Pro',
    name_fr: 'Pro',
    price: '990 DH/mois',
    price_eur: '99€/mois',
    price_usd: '$99/mois',
    description: 'Full Voice Widget + Telephony minutes included',
    description_fr: 'Widget Voice complet + minutes Téléphonie incluses',
    includes: ['Voice Widget illimité', 'Telephony 100 min/mois', '20 personas', 'MCP Server access']
  },
  enterprise: {
    name: 'Enterprise',
    name_fr: 'Enterprise',
    price: 'Sur devis',
    description: 'Unlimited Voice AI with dedicated support',
    description_fr: 'Voice AI illimité avec support dédié',
    includes: ['Telephony illimité', '40 personas', 'Multi-tenant', 'SLA dédié', 'Intégrations custom']
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
    return `You are the VocalIA AI Assistant, helping businesses adopt Voice AI solutions.

═══════════════════════════════════════════════════════════════════
ABOUT VOCALIA - Voice AI Platform
═══════════════════════════════════════════════════════════════════
- Platform: https://vocalia.ma
- Specialization: Voice AI for customer service and sales automation
- Markets: Morocco (FR/MAD), Europe (FR/EUR), International (EN/USD)
- Languages: French, English, Spanish, Arabic, Darija (Moroccan Arabic)

═══════════════════════════════════════════════════════════════════
OUR 2 PRODUCTS
═══════════════════════════════════════════════════════════════════

PRODUCT 1: VOICE WIDGET (Browser-based)
- Technology: Web Speech API (free for users)
- Deployment: JavaScript embed on any website
- Use cases: 24/7 customer support, FAQ, appointment booking
- Languages: 5 languages with real-time switching
- Cost: Free tier available, Pro from 990 DH/month

PRODUCT 2: VOICE TELEPHONY (PSTN AI Bridge)
- Technology: Twilio integration for real phone calls
- Deployment: Phone number with AI answering
- Use cases: Inbound calls, outbound campaigns, appointment reminders
- Languages: 5 languages including Darija
- Cost: Competitive per-minute pricing

═══════════════════════════════════════════════════════════════════
40 INDUSTRY PERSONAS
═══════════════════════════════════════════════════════════════════
VocalIA offers pre-configured AI personas for specific industries:

Tier 1 (Core): AGENCY, DENTAL, PROPERTY, CONTRACTOR, FUNERAL
Tier 2 (Expansion): HEALER, MECHANIC, COUNSELOR, CONCIERGE, STYLIST,
                   RECRUITER, DISPATCHER, COLLECTOR, INSURER, etc.
Tier 3 (Universal): UNIVERSAL_ECOMMERCE, UNIVERSAL_SME
Tier 4 (NEW Economy): RETAILER, BUILDER, RESTAURATEUR, TRAVEL_AGENT,
                      CONSULTANT, IT_SERVICES, DOCTOR, NOTARY, BAKERY, GROCERY

Each persona includes:
- Industry-specific vocabulary and tone
- Common FAQs and responses
- BANT lead qualification logic
- Multi-language support (FR, EN, ES, AR, ARY)

═══════════════════════════════════════════════════════════════════
TECHNICAL CAPABILITIES
═══════════════════════════════════════════════════════════════════
- Multi-AI Fallback: Grok → Gemini → Claude → Atlas (for Darija)
- MCP Server: 182 tools for CRM, e-commerce, calendar integration
- E-commerce: Shopify, WooCommerce, Magento, PrestaShop, etc.
- CRM: HubSpot, Pipedrive, Zoho
- Payments: Stripe integration (19 tools)
- Multi-tenant: Each client gets isolated configuration

═══════════════════════════════════════════════════════════════════
PRICING
═══════════════════════════════════════════════════════════════════
- Free: Voice Widget basic, 1000 interactions/month
- Pro: 990 DH/99€/$99 - Full widget + 100 telephony minutes
- Enterprise: Custom - Unlimited, dedicated support, SLA

═══════════════════════════════════════════════════════════════════
VOICE RESPONSE GUIDELINES
═══════════════════════════════════════════════════════════════════
- Keep responses under 3 sentences for voice clarity
- Use natural, professional language
- Focus on Voice AI benefits: 24/7 availability, cost reduction, scalability
- For complex needs, offer to book a discovery call at vocalia.ma/booking

═══════════════════════════════════════════════════════════════════
IMPORTANT RULES
═══════════════════════════════════════════════════════════════════
- VocalIA = Voice AI Platform: Voice Widget + Voice Telephony
- 40 industry personas across 5 languages
- Always be honest about capabilities and limitations
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
    if (input.includes('price') || input.includes('cost') || input.includes('pricing') || input.includes('pack') || input.includes('tarif')) {
      return "We have three plans: Free for basic Voice Widget, Pro at 990 DH per month for full widget plus 100 telephony minutes, and Enterprise with custom pricing for unlimited usage. Which fits your needs?";
    }

    // BOOKING
    if (input.includes('book') || input.includes('call') || input.includes('meeting') || input.includes('appointment') || input.includes('demo')) {
      return "I'd be happy to arrange a discovery call. You can book directly at vocalia.ma/booking, or I can have one of our specialists reach out to you. What works best?";
    }

    // VOICE WIDGET
    if (input.includes('widget') || input.includes('website') || input.includes('embed')) {
      return "Our Voice Widget is a JavaScript embed that adds 24/7 voice AI to your website. It supports 5 languages including Darija, handles FAQs, and can book appointments. Free tier available.";
    }

    // TELEPHONY
    if (input.includes('phone') || input.includes('telephon') || input.includes('pstn') || input.includes('twilio') || input.includes('call center')) {
      return "Voice Telephony gives you an AI-powered phone line. It answers calls 24/7, qualifies leads with BANT scoring, and integrates with your calendar and CRM. Competitive per-minute pricing.";
    }

    // VOICE AI GENERAL
    if (input.includes('voice') || input.includes('ai assistant')) {
      return "VocalIA offers two Voice AI products: a browser-based Widget for websites and Telephony for real phone calls. Both support 5 languages including Darija and have 40 industry personas. Which interests you?";
    }

    // PERSONAS
    if (input.includes('persona') || input.includes('industry') || input.includes('sector') || input.includes('template')) {
      return "We have 40 pre-configured industry personas: dental clinics, real estate, contractors, restaurants, e-commerce, and more. Each includes industry-specific vocabulary and lead qualification. What's your industry?";
    }

    // LANGUAGES / DARIJA
    if (input.includes('language') || input.includes('darija') || input.includes('arabic') || input.includes('french') || input.includes('multilingual')) {
      return "VocalIA supports 5 languages: French, English, Spanish, Arabic, and Darija (Moroccan Arabic). We're the only Voice AI platform with native Darija support. Perfect for the Moroccan market.";
    }

    // INTEGRATIONS
    if (input.includes('integrat') || input.includes('crm') || input.includes('shopify') || input.includes('hubspot') || input.includes('connect')) {
      return "Our MCP Server provides 182 tools for integration with Shopify, WooCommerce, HubSpot, Pipedrive, Stripe, Google Calendar, and more. The Voice AI can check orders, book appointments, and update CRM records.";
    }

    // E-COMMERCE (redirect to integration, not standalone)
    if (input.includes('ecommerce') || input.includes('store') || input.includes('shop')) {
      return "For e-commerce, our Voice AI can answer product questions, check order status, and handle returns via Shopify or WooCommerce integration. It's a voice assistant for your store, not a store management tool.";
    }

    // GREETINGS
    if (input.includes('hello') || input.includes('hi') || input.includes('bonjour') || input.includes('salam')) {
      return "Hello! Welcome to VocalIA, the Voice AI platform. I can help you with our Voice Widget for websites or Voice Telephony for phone calls. What brings you here today?";
    }

    // WHAT DO YOU DO / SERVICES
    if (input.includes('what do you') || input.includes('services') || input.includes('do you offer') || input.includes('about')) {
      return "VocalIA is a Voice AI platform with two products: Voice Widget for websites and Voice Telephony for phone calls. We have 40 industry personas and support 5 languages including Darija. How can I help?";
    }

    // CONTEXT-BASED (if RAG found something)
    if (context.includes('RELEVANT')) {
      return "Based on your question, I found some relevant information. Would you like me to explain our Voice Widget or Telephony product in more detail?";
    }

    // DEFAULT
    return "VocalIA provides Voice AI solutions: a browser Widget for 24/7 website support and Telephony for AI-powered phone lines. We support 5 languages and have 40 industry personas. What would you like to know?";
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
  console.log('VOCALIA - Voice Agent B2B - Interactive CLI');
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
    console.log('✅ VocalIA Voice Agent B2B: Module OK');

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
VocalIA - Voice Agent B2B

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
