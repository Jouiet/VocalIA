#!/usr/bin/env node
/**
 * Voice Telephony Bridge - Native Script (remplace n8n workflow)
 *
 * Bridge Twilio PSTN ↔ Grok Voice Realtime WebSocket
 *
 * Date: 2026-01-01
 * Version: 1.0.0
 *
 * Architecture:
 *   Twilio Inbound Call → HTTP Webhook → Grok WebSocket Session → Audio Bridge
 *
 * Avantages vs n8n:
 *   - Direct WebSocket (pas d'overhead n8n)
 *   - Latence réduite (~50ms vs ~200ms)
 *   - Contrôle total du flux audio
 *   - Intégration native avec modules existants
 */

const fs = require('fs');
const path = require('path');

// Portability Patch: Resilient .env loading
const envPaths = [
  path.join(__dirname, '.env'),
  path.join(__dirname, '../../../.env'),
  path.join(process.cwd(), '.env')
];
let envFound = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    console.log(`[Telemetry] Configuration loaded from: ${envPath}`);
    envFound = true;
    break;
  }
}
if (!envFound) {
  console.warn('[Telemetry] No .env file found in search paths. Using existing environment variables.');
}
const http = require('http');
const https = require('https');
const { URL } = require('url');
const crypto = require('crypto');

// Marketing Science Core
const MarketingScience = require('../core/marketing-science-core.cjs');
// Voice Persona Injector (The Director)
const { VoicePersonaInjector } = require('../personas/voice-persona-injector.cjs');

// Import Advanced Cognitive Modules (Session 167)
const { ServiceKnowledgeBase } = require('../core/knowledge-base-services.cjs');
const VoiceEcommerceTools = require('../integrations/voice-ecommerce-tools.cjs');
const ContextBox = require('../core/ContextBox.cjs');
const BillingAgent = require('../core/BillingAgent.cjs');

// Initialize Cognitive Modules
const KB = new ServiceKnowledgeBase();
KB.load();
const ECOM_TOOLS = VoiceEcommerceTools; // Already a singleton instance
// RAG Knowledge Base - Multilingual support (Session 167)
const KNOWLEDGE_BASES = {
  fr: require('./knowledge_base.json'),
  en: fs.existsSync(path.join(__dirname, 'knowledge_base_en.json')) ? require('./knowledge_base_en.json') : {}
};

// Dependency check
let WebSocket;
try {
  WebSocket = require('ws');
} catch (e) {
  console.error('❌ Missing dependency: ws');
  console.error('   Run: npm install ws');
  process.exit(1);
}

// Optional: Twilio SDK for signature validation
let twilio;
try {
  twilio = require('twilio');
} catch (e) {
  console.warn('⚠️ twilio package not installed - signature validation disabled');
  console.warn('   Run: npm install twilio');
}

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  port: parseInt(process.env.VOICE_TELEPHONY_PORT || '3009'),

  // Supported Languages - FR/EN Focus (Zero Gap)
  supportedLanguages: ['fr', 'en'],
  defaultLanguage: process.env.VOICE_DEFAULT_LANGUAGE || 'fr',

  // Twilio
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER
  },

  // Grok Voice
  grok: {
    apiKey: process.env.XAI_API_KEY,
    model: 'grok-4', // FRONTIER audio model (powered by Grok-4 family per xAI docs Jan 2026)
    voice: process.env.GROK_VOICE || 'Sal',
    realtimeUrl: 'wss://api.x.ai/v1/realtime'
  },

  // Atlas-Chat-9B (Session 170: Darija LLM fallback via HuggingFace)
  // Session 176ter: Fixed - Use Featherless AI provider (OpenAI-compatible)
  atlasChat: {
    apiKey: process.env.HUGGINGFACE_API_KEY,
    model: 'MBZUAI-Paris/Atlas-Chat-9B',
    url: 'https://router.huggingface.co/featherless-ai/v1/chat/completions',
    enabled: !!process.env.HUGGINGFACE_API_KEY,
    darijaOnly: true  // Used only for 'ary' language fallback
  },

  // Google Apps Script (booking)
  booking: {
    scriptUrl: process.env.GOOGLE_APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbw9JP0YCJV47HL5zahXHweJgjEfNsyiFYFKZXGFUTS9c3SKrmRZdJEg0tcWnvA-P2Jl/exec'
  },

  // WhatsApp
  whatsapp: {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID
  },

  // Security
  security: {
    maxBodySize: 1024 * 1024, // 1MB
    requestTimeout: 30000,
    maxActiveSessions: 50,
    sessionTimeout: 600000 // 10 minutes
  },

  // Rate limiting
  rateLimit: {
    windowMs: 60000,
    maxRequests: 30
  }
};

// ============================================================================
// TWIML MULTILINGUAL MESSAGES (Session 166sexies - Phase 1)
// ============================================================================
// Supported: FR, EN, ES, AR, ARY (Darija)
// Twilio TTS language codes: https://www.twilio.com/docs/voice/twiml/say#attributes-language

const TWIML_MESSAGES = {
  // Language mapping: internal code → Twilio language code
  // Twilio docs: https://www.twilio.com/docs/voice/twiml/say#attributes-language
  languageCodes: {
    'fr': 'fr-FR',
    'en': 'en-US',
    'es': 'es-ES',
    'ar': 'ar-SA',
    'ary': 'ar-SA'  // Darija fallback to Saudi Arabic for Twilio TTS
  },

  // Connection message
  connecting: {
    'fr': 'Connexion à l\'assistant vocal.',
    'en': 'Connecting to voice assistant.',
    'es': 'Conectando con el asistente de voz.',
    'ar': 'جاري الاتصال بالمساعد الصوتي.',
    'ary': 'كنتكونيكطا معا لاسيستون فوكال.'
  },

  // Service unavailable
  serviceUnavailable: {
    'fr': 'Désolé, le service est temporairement indisponible. Veuillez réessayer plus tard.',
    'en': 'Sorry, the service is temporarily unavailable. Please try again later.',
    'es': 'Lo sentimos, el servicio no está disponible temporalmente. Por favor, inténtelo más tarde.',
    'ar': 'عذراً، الخدمة غير متاحة مؤقتاً. يرجى المحاولة لاحقاً.',
    'ary': 'سمحلينا، الخدمة ماشي متوفرة دابا. عاود جرب من بعد.'
  },

  // Outbound greeting
  outboundGreeting: {
    'fr': 'Bonjour, ici VocalIA. Je vous passe mon collègue IA.',
    'en': 'Hello, this is VocalIA. I\'m connecting you to my AI colleague.',
    'es': 'Hola, aquí VocalIA. Le paso con mi colega de IA.',
    'ar': 'مرحباً، هنا VocalIA. سأحولك إلى زميلي الذكاء الاصطناعي.',
    'ary': 'سلام، هنا VocalIA. غادي نعطيك لصاحبي الذكاء الاصطناعي.'
  },

  // Connection error
  connectionError: {
    'fr': 'Une erreur est survenue lors de la connexion.',
    'en': 'An error occurred while connecting.',
    'es': 'Ocurrió un error al conectar.',
    'ar': 'حدث خطأ أثناء الاتصال.',
    'ary': 'كاين شي مشكل فالكونيكسيون.'
  },

  // Transfer to human
  transferToHuman: {
    'fr': 'Je vous transfère vers un conseiller humain. Veuillez patienter un instant.',
    'en': 'I\'m transferring you to a human advisor. Please wait a moment.',
    'es': 'Le estoy transfiriendo a un asesor humano. Por favor, espere un momento.',
    'ar': 'سأحولك إلى مستشار بشري. يرجى الانتظار لحظة.',
    'ary': 'غادي نوصلك بواحد المستشار. تسنى شوية عافاك.'
  }
};

/**
 * Get TwiML language code from internal language code
 * @param {string} lang - Internal language code (fr, en, es, ar, ary)
 * @returns {string} Twilio language code
 */
function getTwiMLLanguage(lang) {
  return TWIML_MESSAGES.languageCodes[lang] || TWIML_MESSAGES.languageCodes[CONFIG.defaultLanguage];
}

/**
 * Get localized TwiML message
 * @param {string} messageKey - Key in TWIML_MESSAGES
 * @param {string} lang - Language code
 * @returns {string} Localized message
 */
function getTwiMLMessage(messageKey, lang) {
  const messages = TWIML_MESSAGES[messageKey];
  if (!messages) return '';
  return messages[lang] || messages[CONFIG.defaultLanguage] || messages['fr'];
}

// ============================================================================
// HITL CONFIGURATION (Human In The Loop) - Session 165quater flexibility
// ============================================================================
// User configurable options via ENV variables:
//
//   HITL_VOICE_ENABLED: true | false (default: true)
//     - Master switch for all voice HITL checks
//
//   HITL_APPROVE_HOT_BOOKINGS: true | false (default: true)
//     - Require approval for bookings from hot leads (high BANT score)
//     - true = safer (review before confirming)
//     - false = faster (auto-confirm all bookings)
//
//   HITL_APPROVE_TRANSFERS: true | false (default: true)
//     - Require approval before transferring calls to human agents
//     - true = safer (prevent unnecessary transfers)
//     - false = faster (allow immediate transfers)
//
//   HITL_BOOKING_SCORE_THRESHOLD: 60 | 70 | 80 | 90 | custom (default: 70)
//     - BANT score threshold above which bookings require approval
//     - Lower = more bookings need approval (conservative)
//     - Higher = fewer bookings need approval (aggressive)

const HITL_CONFIG = {
  enabled: process.env.HITL_VOICE_ENABLED !== 'false',
  approveHotBookings: process.env.HITL_APPROVE_HOT_BOOKINGS !== 'false',
  approveTransfers: process.env.HITL_APPROVE_TRANSFERS !== 'false',
  approveFinancialComplaints: process.env.HITL_APPROVE_FINANCIAL_COMPLAINTS !== 'false',  // NEW: Session 250.12
  bookingScoreThreshold: parseInt(process.env.HITL_BOOKING_SCORE_THRESHOLD) || 70,  // 60 | 70 | 80 | 90
  bookingScoreThresholdOptions: [60, 70, 80, 90],  // Recommended options
  financialKeywords: (process.env.HITL_FINANCIAL_KEYWORDS || 'remboursement,gratuit,offert,compensation,sans frais,rembourse').split(',').map(k => k.trim().toLowerCase()),
  slackWebhook: process.env.HITL_SLACK_WEBHOOK || process.env.SLACK_WEBHOOK_URL,
  notifyOnPending: process.env.HITL_NOTIFY_ON_PENDING !== 'false'
};

// Financial commitment detection for complaint scenarios
function detectFinancialCommitment(response) {
  if (!response || typeof response !== 'string') return false;
  const responseLower = response.toLowerCase();
  return HITL_CONFIG.financialKeywords.some(keyword => responseLower.includes(keyword));
}

// Get matching financial keywords from response
function getMatchedFinancialKeywords(response) {
  if (!response || typeof response !== 'string') return [];
  const responseLower = response.toLowerCase();
  return HITL_CONFIG.financialKeywords.filter(keyword => responseLower.includes(keyword));
}

const DATA_DIR = process.env.VOICE_DATA_DIR || path.join(__dirname, '../../../data/voice');
const HITL_PENDING_DIR = path.join(DATA_DIR, 'hitl-pending');
const HITL_PENDING_FILE = path.join(HITL_PENDING_DIR, 'pending-actions.json');

// Ensure directories exist
function ensureHitlDir() {
  if (!fs.existsSync(HITL_PENDING_DIR)) {
    fs.mkdirSync(HITL_PENDING_DIR, { recursive: true });
  }
}
ensureHitlDir();

// HITL Functions
function loadPendingActions() {
  try {
    if (fs.existsSync(HITL_PENDING_FILE)) {
      return JSON.parse(fs.readFileSync(HITL_PENDING_FILE, 'utf8'));
    }
  } catch (error) {
    console.warn(`⚠️ Could not load HITL pending actions: ${error.message}`);
  }
  return [];
}

function savePendingActions(actions) {
  try {
    const tempPath = `${HITL_PENDING_FILE}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(actions, null, 2));
    fs.renameSync(tempPath, HITL_PENDING_FILE);
  } catch (error) {
    console.error(`❌ Failed to save HITL pending actions: ${error.message}`);
  }
}

function queueActionForApproval(actionType, session, args, reason) {
  const pending = loadPendingActions();
  const pendingAction = {
    id: `hitl_voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    actionType,
    sessionId: session.sessionId,
    callSid: session.callSid,
    bookingData: session.bookingData,
    args,
    reason,
    queuedAt: new Date().toISOString(),
    status: 'pending'
  };

  pending.push(pendingAction);
  savePendingActions(pending);

  console.log(`🔒 Voice action "${actionType}" queued for HITL approval`);

  // Slack notification
  if (HITL_CONFIG.slackWebhook && HITL_CONFIG.notifyOnPending) {
    sendHitlVoiceNotification(pendingAction).catch(e => console.error(`❌ Slack notification failed: ${e.message}`));
  }

  return pendingAction;
}

async function sendHitlVoiceNotification(pendingAction) {
  if (!HITL_CONFIG.slackWebhook) return;

  const message = {
    text: `🔒 HITL Approval Required - Voice Action`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `🔒 HITL: ${pendingAction.actionType === 'transfer' ? 'Call Transfer' : 'Hot Booking'} Pending`, emoji: true }
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Action:* ${pendingAction.actionType}` },
          { type: 'mrkdwn', text: `*Call SID:* ${pendingAction.callSid || 'N/A'}` },
          { type: 'mrkdwn', text: `*Customer:* ${pendingAction.bookingData?.name || pendingAction.bookingData?.email || 'N/A'}` },
          { type: 'mrkdwn', text: `*Reason:* ${pendingAction.reason}` }
        ]
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `\`\`\`node voice-telephony-bridge.cjs --approve=${pendingAction.id}\`\`\`` }
      }
    ]
  };

  await fetch(HITL_CONFIG.slackWebhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message)
  });
}

async function approveAction(hitlId) {
  const pending = loadPendingActions();
  const index = pending.findIndex(a => a.id === hitlId);

  if (index === -1) {
    console.log(`❌ HITL action ${hitlId} not found`);
    return { success: false, error: 'Action not found' };
  }

  const action = pending[index];
  action.status = 'approved';
  action.approvedAt = new Date().toISOString();

  pending.splice(index, 1);
  savePendingActions(pending);

  console.log(`✅ HITL action "${action.actionType}" approved`);

  // Execute the action
  const session = activeSessions.get(action.sessionId);
  if (!session) {
    return { success: true, action, warning: 'Session no longer active - action logged but not executed' };
  }

  if (action.actionType === 'transfer') {
    const result = await handleTransferCallInternal(session, action.args);
    return { success: true, action, result };
  } else if (action.actionType === 'booking') {
    const result = await handleCreateBookingInternal(session, action.args);
    return { success: true, action, result };
  } else if (action.actionType === 'financial_complaint') {
    const result = await executeApprovedComplaint(session, action.args);
    return { success: true, action, result };
  }

  return { success: true, action };
}

function rejectAction(hitlId, reason = 'Rejected by operator') {
  const pending = loadPendingActions();
  const index = pending.findIndex(a => a.id === hitlId);

  if (index === -1) {
    console.log(`❌ HITL action ${hitlId} not found`);
    return { success: false, error: 'Action not found' };
  }

  const action = pending[index];
  action.status = 'rejected';
  action.rejectedAt = new Date().toISOString();
  action.rejectionReason = reason;

  pending.splice(index, 1);
  savePendingActions(pending);

  console.log(`❌ HITL action "${action.actionType}" rejected: ${reason}`);

  return { success: true, action };
}

function listPendingActions() {
  const pending = loadPendingActions();
  console.log(`\n🔒 Pending HITL Voice Actions (${pending.length}):\n`);

  if (pending.length === 0) {
    console.log('  No pending actions');
    return pending;
  }

  pending.forEach(a => {
    console.log(`  • ${a.id}`);
    console.log(`    Action: ${a.actionType}`);
    console.log(`    Customer: ${a.bookingData?.name || a.bookingData?.email || 'N/A'}`);
    console.log(`    Call SID: ${a.callSid || 'N/A'}`);
    console.log(`    Queued: ${a.queuedAt}`);
    console.log();
  });

  return pending;
}

// ============================================
// ACTIVE SESSIONS MANAGEMENT
// ============================================

const activeSessions = new Map();
const rateLimitMap = new Map();

function generateSessionId() {
  return `sess_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

function cleanupSession(sessionId) {
  const session = activeSessions.get(sessionId);
  if (session) {
    if (session.grokWs && session.grokWs.readyState === WebSocket.OPEN) {
      session.grokWs.close();
    }
    if (session.twilioWs && session.twilioWs.readyState === WebSocket.OPEN) {
      session.twilioWs.close();
    }
    activeSessions.delete(sessionId);
    console.log(`[Session] Cleaned up: ${sessionId}`);
  }
}

// Cleanup zombie sessions every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of activeSessions) {
    if (now - session.createdAt > CONFIG.security.sessionTimeout) {
      console.log(`[Session] Timeout cleanup: ${sessionId}`);
      cleanupSession(sessionId);
    }
  }
}, 60000);

// ============================================
// RATE LIMITING
// ============================================

function checkRateLimit(ip) {
  const now = Date.now();
  const windowStart = now - CONFIG.rateLimit.windowMs;

  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, []);
  }

  const requests = rateLimitMap.get(ip).filter(t => t > windowStart);
  rateLimitMap.set(ip, requests);

  if (requests.length >= CONFIG.rateLimit.maxRequests) {
    return false;
  }

  requests.push(now);
  return true;
}

// Cleanup old rate limit entries every 5 minutes (FIX: memory leak)
setInterval(() => {
  const now = Date.now();
  const windowStart = now - CONFIG.rateLimit.windowMs;

  for (const [ip, timestamps] of rateLimitMap) {
    const recent = timestamps.filter(t => t > windowStart);
    if (recent.length === 0) {
      rateLimitMap.delete(ip);
    } else {
      rateLimitMap.set(ip, recent);
    }
  }
}, 300000);

// ============================================
// TWILIO SIGNATURE VALIDATION
// ============================================

function validateTwilioSignature(req, body, rawBody) {
  // Skip validation if twilio SDK not installed or auth token not configured
  if (!twilio || !CONFIG.twilio.authToken) {
    console.warn('[Security] Twilio signature validation DISABLED');
    return true;
  }

  const signature = req.headers['x-twilio-signature'];
  if (!signature) {
    console.error('[Security] Missing X-Twilio-Signature header');
    return false;
  }

  // Reconstruct the URL
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;
  const url = `${protocol}://${host}${req.url}`;

  try {
    const isValid = twilio.validateRequest(
      CONFIG.twilio.authToken,
      signature,
      url,
      body
    );

    if (!isValid) {
      console.error('[Security] Invalid Twilio signature');
    }

    return isValid;
  } catch (error) {
    console.error(`[Security] Signature validation error: ${error.message}`);
    return false;
  }
}

// ============================================
// SAFE JSON PARSING
// ============================================

function safeJsonParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch (e) {
    console.error(`[JSON] Parse error: ${e.message}`);
    return fallback;
  }
}

// ============================================
// GROK VOICE SESSION
// ============================================

async function createGrokSession(callInfo) {
  return new Promise((resolve, reject) => {
    const sessionId = generateSessionId();

    if (activeSessions.size >= CONFIG.security.maxActiveSessions) {
      reject(new Error('Maximum active sessions reached'));
      return;
    }

    console.log(`[Grok] Creating session for call ${callInfo.callSid}`);

    // Initialize ContextBox for this journey
    ContextBox.logEvent(callInfo.callSid, 'VoiceBridge', 'SESSION_INIT', {
      direction: callInfo.direction,
      from: callInfo.from
    });

    const ws = new WebSocket(CONFIG.grok.realtimeUrl, {
      headers: {
        'Authorization': `Bearer ${CONFIG.grok.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Grok WebSocket connection timeout'));
    }, 10000);

    ws.on('open', () => {
      clearTimeout(timeout);

      // SALES ASSISTANT CONFIG - Optimized for conversion (v2.0)
      // Based on Vapi lead qualification + Bland AI patterns + industry best practices
      const sessionConfig = {
        type: 'session.update',
        session: {
          model: CONFIG.grok.model,
          voice: CONFIG.grok.voice,
          modalities: ['audio', 'text'],
          input_audio_format: 'pcmu',
          output_audio_format: 'pcmu',
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 400 // SOTA Optimization: 400ms for snappier conversational flow (was 700ms)
          },
          // PHASE 1: THE DIRECTOR - Dynamic Persona Injection
          // Default instruction placeholder (will be overridden by Injector)
          instructions: '',
          // FUNCTION TOOLS - Sales Assistant (v2.0)
          tools: [
            {
              type: 'function',
              name: 'qualify_lead',
              description: 'Évaluer le prospect selon BANT (Budget, Authority, Need, Timeline). Appeler après avoir collecté les infos de qualification.',
              parameters: {
                type: 'object',
                properties: {
                  need: {
                    type: 'string',
                    enum: ['high', 'medium', 'low', 'unknown'],
                    description: 'Niveau de besoin exprimé: high=urgent, medium=intéressé, low=curieux, unknown=pas clair'
                  },
                  timeline: {
                    type: 'string',
                    enum: ['immediate', 'this_quarter', 'this_year', 'exploring'],
                    description: 'Urgence du projet: immediate=ce mois, this_quarter=3 mois, this_year=6-12 mois, exploring=pas de timeline'
                  },
                  budget: {
                    type: 'string',
                    enum: ['defined', 'flexible', 'limited', 'unknown'],
                    description: 'Situation budget: defined=budget alloué, flexible=peut investir, limited=contraint, unknown=pas discuté'
                  },
                  authority: {
                    type: 'string',
                    enum: ['decision_maker', 'influencer', 'user', 'unknown'],
                    description: 'Pouvoir de décision: decision_maker=décide, influencer=recommande, user=utilisateur final'
                  },
                  industry: {
                    type: 'string',
                    description: 'Secteur d\'activité du prospect (ecommerce, pme, agence, saas, etc.)'
                  },
                  company_size: {
                    type: 'string',
                    enum: ['solo', 'small', 'medium', 'large'],
                    description: 'Taille: solo=1 personne, small=2-10, medium=11-50, large=50+'
                  }
                },
                required: ['need', 'timeline']
              }
            },
            {
              type: 'function',
              name: 'handle_objection',
              description: 'Logger une objection du prospect pour analytics et adapter la réponse',
              parameters: {
                type: 'object',
                properties: {
                  objection_type: {
                    type: 'string',
                    enum: ['price', 'timing', 'competitor', 'authority', 'need', 'trust', 'other'],
                    description: 'Type d\'objection: price=trop cher, timing=pas maintenant, competitor=travaille avec autre, authority=pas décisionnaire, need=pas convaincu du besoin, trust=veut plus d\'infos'
                  },
                  objection_text: {
                    type: 'string',
                    description: 'Description de l\'objection'
                  }
                },
                required: ['objection_type', 'objection_text']
              }
            },
            {
              type: 'function',
              name: 'check_order_status',
              description: 'Vérifier le statut d\'une commande Shopify via l\'email du client.',
              parameters: {
                type: 'object',
                properties: {
                  email: {
                    type: 'string',
                    description: 'Email du client associé à la commande'
                  }
                },
                required: ['email']
              }
            },
            {
              type: 'function',
              name: 'check_product_stock',
              description: 'Vérifier la disponibilité en stock d\'un produit sur Shopify.',
              parameters: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description: 'Nom ou description du produit à rechercher'
                  }
                },
                required: ['query']
              }
            },
            {
              type: 'function',
              name: 'get_customer_tags',
              description: 'Récupérer les tags et segments d\'un client sur Klaviyo.',
              parameters: {
                type: 'object',
                properties: {
                  email: {
                    type: 'string',
                    description: 'Email du client'
                  }
                },
                required: ['email']
              }
            },
            {
              type: 'function',
              name: 'schedule_callback',
              description: 'Planifier un rappel ou une action de suivi quand le RDV n\'est pas possible maintenant',
              parameters: {
                type: 'object',
                properties: {
                  callback_time: {
                    type: 'string',
                    description: 'Moment du rappel souhaité (ex: "demain 10h", "lundi matin", "dans 1 semaine")'
                  },
                  next_action: {
                    type: 'string',
                    enum: ['call_back', 'send_email', 'send_sms_booking_link', 'send_info_pack'],
                    description: 'Action de suivi: call_back=rappeler, send_email=envoyer email, send_sms_booking_link=SMS avec lien RDV, send_info_pack=envoyer documentation'
                  },
                  notes: {
                    type: 'string',
                    description: 'Notes contextuelles pour le suivi (ex: "intéressé par automatisation email, rappeler après réunion équipe")'
                  }
                },
                required: ['next_action']
              }
            },
            {
              type: 'function',
              name: 'create_booking',
              description: 'Créer une réservation de RDV découverte quand le prospect est qualifié et a fourni ses coordonnées',
              parameters: {
                type: 'object',
                properties: {
                  name: {
                    type: 'string',
                    description: 'Nom complet du prospect'
                  },
                  email: {
                    type: 'string',
                    description: 'Adresse email professionnelle'
                  },
                  phone: {
                    type: 'string',
                    description: 'Numéro de téléphone'
                  },
                  slot: {
                    type: 'string',
                    description: 'Créneau choisi (ex: "Mardi 14h", "Jeudi 10h")'
                  },
                  meeting_type: {
                    type: 'string',
                    enum: ['discovery_call', 'demo', 'audit', 'consultation'],
                    description: 'Type de RDV: discovery_call=découverte 30min, demo=démonstration, audit=audit gratuit, consultation=conseil'
                  },
                  qualification_score: {
                    type: 'string',
                    enum: ['hot', 'warm', 'cold'],
                    description: 'Score de qualification: hot=BANT complet et urgent, warm=intéressé mais pas urgent, cold=exploratoire'
                  },
                  notes: {
                    type: 'string',
                    description: 'Contexte et besoins discutés pendant l\'appel'
                  }
                },
                required: ['name', 'email', 'slot']
              }
            },
            {
              type: 'function',
              name: 'track_conversion_event',
              description: 'Tracker les étapes du funnel pour analytics conversion',
              parameters: {
                type: 'object',
                properties: {
                  event: {
                    type: 'string',
                    enum: ['call_started', 'permission_granted', 'qualification_complete', 'objection_raised', 'objection_resolved', 'closing_attempted', 'booking_created', 'callback_scheduled', 'call_abandoned', 'call_completed'],
                    description: 'Événement du funnel de conversion'
                  },
                  stage: {
                    type: 'string',
                    enum: ['opening', 'qualification', 'value_prop', 'objection_handling', 'closing', 'follow_up'],
                    description: 'Phase actuelle de la conversation'
                  },
                  outcome: {
                    type: 'string',
                    enum: ['success', 'partial', 'failed', 'pending'],
                    description: 'Résultat de l\'étape'
                  }
                },
                required: ['event', 'stage']
              }
            },
            {
              type: 'function',
              name: 'search_knowledge_base',
              description: 'Rechercher des informations spécifiques (Horaires, Politiques, Services) dans la base de connaissances du client.',
              parameters: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description: 'La question ou le sujet recherché (ex: "return policy", "opening hours", "emergency")',
                  },
                  category: {
                    type: 'string',
                    description: 'Catégorie optionnelle pour affiner (shipping, returns, pricing, general)'
                  }
                },
                required: ['query']
              }
            },
            {
              type: 'function',
              name: 'send_payment_details',
              description: 'Envoyer les coordonnées bancaires (RIB/IBAN/Wise) ou un lien de paiement selon la configuration du client.',
              parameters: {
                type: 'object',
                properties: {
                  amount: {
                    type: 'number',
                    description: 'Montant à payer (ex: 50, 100)'
                  },
                  description: {
                    type: 'string',
                    description: 'Motif du paiement (ex: Acompte, Solde)'
                  },
                  method_override: {
                    type: 'string',
                    enum: ['BANK_TRANSFER', 'LINK', 'CASH'],
                    description: 'Forcer une méthode si besoin'
                  }
                },
                required: ['amount', 'description']
              }
            },
            {
              type: 'function',
              name: 'transfer_call',
              description: 'Transférer l\'appel à un agent humain (Urgence, Demande complexe, Handoff).',
              parameters: {
                type: 'object',
                properties: {
                  reason: {
                    type: 'string',
                    description: 'Raison du transfert (ex: "Client en colère", "Demande hors scope", "Urgence médicale")'
                  },
                  phone_number: {
                    type: 'string',
                    description: 'Numéro de destination optionnel (sinon utilise le numéro du client)'
                  }
                },
                required: ['reason']
              }
            },
            {
              type: 'function',
              name: 'handle_complaint',
              description: 'Gérer une réclamation client. OBLIGATOIRE pour toute promesse de remboursement, compensation ou offre gratuite. Appeler AVANT de promettre quoi que ce soit de financier.',
              parameters: {
                type: 'object',
                properties: {
                  complaint_type: {
                    type: 'string',
                    enum: ['defective_product', 'late_delivery', 'wrong_item', 'poor_service', 'billing_error', 'damaged_goods', 'missing_parts', 'warranty_claim', 'refund_request', 'other'],
                    description: 'Type de réclamation'
                  },
                  proposed_resolution: {
                    type: 'string',
                    description: 'Solution proposée au client (ex: "remboursement intégral", "échange produit", "avoir 20%")'
                  },
                  financial_commitment: {
                    type: 'boolean',
                    description: 'La résolution implique-t-elle un engagement financier (remboursement, offre gratuite, compensation)?'
                  },
                  estimated_value: {
                    type: 'number',
                    description: 'Valeur estimée de la compensation en euros (0 si non applicable)'
                  },
                  customer_email: {
                    type: 'string',
                    description: 'Email du client pour suivi'
                  },
                  severity: {
                    type: 'string',
                    enum: ['low', 'medium', 'high', 'critical'],
                    description: 'Sévérité de la réclamation'
                  }
                },
                required: ['complaint_type', 'proposed_resolution', 'financial_commitment']
              }
            }
          ]
        }
      };

      // Determine Persona based on Call Context
      const persona = VoicePersonaInjector.getPersona(
        callInfo.from,    // Caller ID
        callInfo.to,      // Called Number (maps to Vertical)
        callInfo.clientId // Multi-tenancy ID (optional)
      );

      console.log(`[The Director] Injecting Persona: ${persona.name} (${persona.id}) for Vertical: ${callInfo.to}`);

      // Inject Persona (Instructions + Voice)
      // This overwrites the default 'voice' and 'instructions' in sessionConfig
      const finalConfig = VoicePersonaInjector.inject(sessionConfig, persona);

      ws.send(JSON.stringify(finalConfig));

      const session = {
        id: sessionId,
        callSid: callInfo.callSid,
        from: callInfo.from,
        grokWs: ws,
        twilioWs: null,
        metadata: finalConfig.session_config?.metadata || finalConfig.metadata || {}, // Store injected persona metadata
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
        // Booking data
        bookingData: {
          phone: callInfo.from,
          name: null,
          email: null,
          slot: null,
          meeting_type: 'discovery_call',
          qualification_score: 'cold',
          notes: ''
        },
        // BANT Qualification (v2.0)
        qualification: {
          need: 'unknown',
          timeline: 'exploring',
          budget: 'unknown',
          authority: 'unknown',
          industry: null,
          company_size: null,
          score: 0 // 0-100 calculated
        },
        // Conversion Analytics (v2.0)
        analytics: {
          funnel_stage: 'opening',
          events: [],
          objections: [],
          call_duration: 0,
          outcome: 'pending' // pending, booked, callback, abandoned, completed
        },
        // Callback scheduling (v2.0)
        callback: {
          scheduled: false,
          time: null,
          action: null,
          notes: null
        },
        audioBuffer: []
      };

      activeSessions.set(sessionId, session);

      console.log(`[Grok] Session created: ${sessionId}`);
      resolve(session);
    });

    ws.on('message', (data) => {
      const message = safeJsonParse(data.toString());
      if (!message) return;

      handleGrokMessage(sessionId, message);
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      console.error(`[Grok] WebSocket error: ${error.message}`);
      cleanupSession(sessionId);
    });

    ws.on('close', () => {
      console.log(`[Grok] WebSocket closed for session: ${sessionId}`);
    });
  });
}

function handleGrokMessage(sessionId, message) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  switch (message.type) {
    case 'session.created':
      console.log(`[Grok] Session confirmed: ${sessionId}`);
      break;

    case 'response.audio.delta':
      // Forward audio to Twilio
      if (session.twilioWs && session.twilioWs.readyState === WebSocket.OPEN) {
        const twilioMessage = {
          event: 'media',
          streamSid: session.streamSid,
          media: {
            payload: message.delta // base64 audio
          }
        };
        session.twilioWs.send(JSON.stringify(twilioMessage));
      }
      break;

    case 'response.text.delta':
      // Log transcription for debugging
      if (message.delta) {
        console.log(`[Grok] AI: ${message.delta}`);
      }
      break;

    case 'input_audio_buffer.speech_started':
      console.log(`[Grok] User speaking...`);
      break;

    case 'response.done':
      // Check if booking data was extracted
      if (message.response && message.response.output) {
        extractBookingData(session, message.response.output);
      }
      break;

    case 'conversation.item.completed':
      // Check for function calls (v3.0 - Cognitive Tools)
      if (message.item && message.item.type === 'function_call') {
        handleFunctionCall(session, message.item).catch(err => {
          console.error(`[Cognitive-Tools] Execution Error: ${err.message}`);
        });
      }
      break;

    case 'error':
      console.error(`[Grok] Error: ${message.error?.message || 'Unknown error'}`);
      break;
  }
}

function extractBookingData(session, output) {
  // Simple extraction from conversation
  const text = typeof output === 'string' ? output : JSON.stringify(output);

  // Extract email pattern
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  if (emailMatch) {
    session.bookingData.email = emailMatch[0];
  }

  // Extract name (basic heuristic)
  const nameMatch = text.match(/(?:je m'appelle|mon nom est|c'est)\s+(\w+)/i);
  if (nameMatch) {
    session.bookingData.name = nameMatch[1];
  }
}

// ============================================
// BANT SCORE CALCULATION
// ============================================

function calculateBANTScore(qualification) {
  let score = 0;

  // Need scoring (0-30 points)
  const needScores = { high: 30, medium: 20, low: 10, unknown: 0 };
  score += needScores[qualification.need] || 0;

  // Timeline scoring (0-30 points)
  const timelineScores = { immediate: 30, this_quarter: 20, this_year: 10, exploring: 0 };
  score += timelineScores[qualification.timeline] || 0;

  // Budget scoring (0-20 points)
  const budgetScores = { defined: 20, flexible: 15, limited: 5, unknown: 0 };
  score += budgetScores[qualification.budget] || 0;

  // Authority scoring (0-20 points)
  const authorityScores = { decision_maker: 20, influencer: 10, user: 5, unknown: 0 };
  score += authorityScores[qualification.authority] || 0;

  return score;
}

function getQualificationLabel(score) {
  if (score >= 70) return 'hot';
  if (score >= 40) return 'warm';
  return 'cold';
}

// ============================================
// FUNCTION CALL HANDLERS (v2.0 - Sales Optimized)
// ============================================

async function handleFunctionCall(session, item) {
  const args = safeJsonParse(item.arguments, {});
  const callId = item.call_id;
  session.lastActivityAt = Date.now();

  console.log(`[Cognitive-Tools] ${item.name} called (ID: ${callId}) with args:`, JSON.stringify(args));

  let result = { success: false, error: "unknown_function" };

  try {
    switch (item.name) {
      case 'qualify_lead':
        result = await handleQualifyLead(session, args);
        break;

      case 'handle_objection':
        result = await handleObjection(session, args);
        break;

      case 'search_knowledge_base':
        result = await handleSearchKnowledgeBase(session, args);
        break;

      case 'transfer_call':
        result = await handleTransferCall(session, args);
        break;

      case 'handle_complaint':
        result = await handleComplaint(session, args);
        break;

      case 'check_order_status':
        result = await handleCheckOrderStatus(session, args);
        break;

      case 'check_product_stock':
        result = await handleCheckProductStock(session, args);
        break;

      case 'get_customer_tags':
        result = await handleGetCustomerTags(session, args);
        break;

      case 'schedule_callback':
        result = await handleScheduleCallback(session, args);
        break;

      case 'create_booking':
        result = await handleCreateBooking(session, args);
        break;

      case 'track_conversion_event':
        result = await handleTrackConversion(session, args);
        break;

      case 'send_payment_details':
        result = await handleSendPaymentDetails(session, args);
        break;

      default:
        console.log(`[Cognitive-Tools] Unknown function: ${item.name}`);
        result = { success: false, error: `Function ${item.name} not implemented` };
    }
  } catch (err) {
    console.error(`[Cognitive-Tools] Handler Error for ${item.name}:`, err);
    result = { success: false, error: err.message };
  }

  // Mandatory: Send output back to Grok Realtime
  if (callId) {
    await sendFunctionResult(session, callId, result);
  }
}

/**
 * Send Tool Output back to Grok WebSocket
 */
async function sendFunctionResult(session, callId, result) {
  if (session.grokWs && session.grokWs.readyState === 1 /* OPEN */) {
    console.log(`[Cognitive-Tools] Sending output for ${callId}`);
    const outputMessage = {
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: JSON.stringify(result)
      }
    };
    session.grokWs.send(JSON.stringify(outputMessage));

    // Trigger the AI to acknowledge and speak back
    session.grokWs.send(JSON.stringify({ type: 'response.create' }));
  } else {
    console.warn(`[Cognitive-Tools] Cannot send result: Grok WS not open`);
  }
}

// ============================================
// COMMERCE & CRM TOOL HANDLERS (v3.0)
// ============================================

async function handleCheckOrderStatus(session, args) {
  const email = args.email || session.bookingData.email;
  if (!email) return { success: false, error: "no_email_provided" };
  return await ECOM_TOOLS.getOrderStatus(email);
}

async function handleCheckProductStock(session, args) {
  return await ECOM_TOOLS.checkProductStock(args.query);
}

async function handleGetCustomerTags(session, args) {
  const email = args.email || session.bookingData.email;
  if (!email) return { success: false, error: "no_email_provided" };
  return await ECOM_TOOLS.getCustomerProfile(email);
}

async function handleQualifyLead(session, args) {
  // Update qualification data
  session.qualification = {
    ...session.qualification,
    need: args.need || session.qualification.need,
    timeline: args.timeline || session.qualification.timeline,
    budget: args.budget || session.qualification.budget,
    authority: args.authority || session.qualification.authority,
    industry: args.industry || session.qualification.industry,
    company_size: args.company_size || session.qualification.company_size
  };

  // Calculate BANT score
  session.qualification.score = calculateBANTScore(session.qualification);
  session.bookingData.qualification_score = getQualificationLabel(session.qualification.score);

  // Track event
  session.analytics.events.push({
    type: 'qualification_complete',
    timestamp: Date.now(),
    data: session.qualification
  });
  session.analytics.funnel_stage = 'value_prop';

  console.log(`[Qualify] Score: ${session.qualification.score}/100 (${session.bookingData.qualification_score})`);
  console.log(`[Qualify] BANT: N=${args.need}, T=${args.timeline}, B=${args.budget}, A=${args.authority}`);

  // Log to file for analytics
  logConversionEvent(session, 'lead_qualified', {
    score: session.qualification.score,
    label: session.bookingData.qualification_score,
    qualification: session.qualification
  });
}

/**
 * OBJECTION HANDLING - SOTA Implementation (Session 250.6)
 * Framework: LAER (Listen, Acknowledge, Explore, Respond) + Feel-Felt-Found
 * Sources: Gong.io Revenue AI, Sales Outcomes, Otter.ai
 */
const OBJECTION_HANDLERS = {
  price: {
    real_meaning: 'Le prospect ne voit pas le ROI pour sa situation spécifique',
    laer: {
      acknowledge: 'Je comprends parfaitement votre préoccupation concernant l\'investissement.',
      explore: 'Puis-je vous demander quel budget aviez-vous prévu pour cette solution ?',
      respond: 'Nos clients dans votre secteur constatent généralement un ROI de 3x en {timeframe}. Voulez-vous que je vous partage un cas concret ?'
    },
    feel_felt_found: {
      feel: 'Je comprends que l\'investissement puisse sembler important.',
      felt: 'D\'autres {industry} ont ressenti la même chose initialement.',
      found: 'Ils ont découvert que les gains d\'efficacité compensaient largement le coût dès le {timeframe}.'
    },
    proof_points: [
      'ROI moyen de 300% en 6 mois',
      'Réduction de 70% du temps de traitement',
      'Garantie satisfaction ou remboursement'
    ],
    next_action: 'Proposer une démonstration ROI personnalisée'
  },
  timing: {
    real_meaning: 'Le prospect est inquiet de la gestion du changement',
    laer: {
      acknowledge: 'C\'est tout à fait compréhensible de vouloir choisir le bon moment.',
      explore: 'Qu\'est-ce qui vous ferait dire que c\'est le bon moment ?',
      respond: 'L\'implémentation prend seulement {duration} et notre équipe gère tout. Quel serait le meilleur créneau pour démarrer ?'
    },
    feel_felt_found: {
      feel: 'Je comprends que le timing soit une préoccupation.',
      felt: 'Beaucoup de nos clients pensaient que ce n\'était pas le bon moment.',
      found: 'Ils ont réalisé qu\'attendre leur coûtait {cost} par mois en opportunités perdues.'
    },
    proof_points: [
      'Implémentation en 48h',
      'Aucune perturbation des opérations',
      'Support dédié pendant le déploiement'
    ],
    next_action: 'Proposer un calendrier de déploiement flexible'
  },
  competitor: {
    real_meaning: 'Le prospect a peur de perdre la relation existante ou les coûts de switching',
    laer: {
      acknowledge: 'C\'est une démarche prudente de comparer les solutions.',
      explore: 'Qu\'est-ce qui fonctionne bien avec votre solution actuelle ? Et qu\'aimeriez-vous améliorer ?',
      respond: 'Ce qui nous différencie c\'est {differentiator}. Voudriez-vous voir une comparaison côte à côte ?'
    },
    feel_felt_found: {
      feel: 'Je comprends l\'importance de votre relation actuelle.',
      felt: 'D\'autres clients étaient dans la même situation.',
      found: 'Ils ont constaté que notre approche {advantage} leur apportait {benefit} supplémentaire.'
    },
    proof_points: [
      'Migration gratuite depuis la concurrence',
      'Support parallèle pendant la transition',
      'Fonctionnalités exclusives non disponibles ailleurs'
    ],
    next_action: 'Proposer un test gratuit en parallèle'
  },
  authority: {
    real_meaning: 'Le prospect n\'est pas le décisionnaire final',
    laer: {
      acknowledge: 'C\'est tout à fait normal d\'impliquer les bonnes personnes dans cette décision.',
      explore: 'Qui d\'autre serait impliqué dans la décision ? Quels seraient leurs principaux critères ?',
      respond: 'Je peux préparer une présentation adaptée à chaque décideur. Quand serait-il possible de tous les réunir ?'
    },
    feel_felt_found: {
      feel: 'Je comprends que cette décision implique plusieurs parties.',
      felt: 'D\'autres responsables dans votre situation ont ressenti la même chose.',
      found: 'En préparant un business case clair, ils ont convaincu leur direction en une semaine.'
    },
    proof_points: [
      'Kit de présentation direction fourni',
      'Business case personnalisé avec ROI',
      'Appel avec votre direction si souhaité'
    ],
    next_action: 'Identifier tous les décideurs et préparer un business case'
  },
  need: {
    real_meaning: 'Le prospect ne perçoit pas clairement la valeur pour son cas',
    laer: {
      acknowledge: 'C\'est une question importante - s\'assurer que la solution répond à vos vrais besoins.',
      explore: 'Quel est votre principal défi au quotidien concernant {topic} ?',
      respond: 'Basé sur ce que vous décrivez, notre solution adresse exactement {pain_point}. Voulez-vous voir comment ?'
    },
    feel_felt_found: {
      feel: 'Je comprends l\'importance de s\'assurer de l\'adéquation.',
      felt: 'D\'autres {role} avaient les mêmes interrogations.',
      found: 'Après avoir vu la démo ciblée sur leur cas, ils ont compris exactement comment nous pouvions les aider.'
    },
    proof_points: [
      'Démo personnalisée sur votre cas d\'usage',
      'Période d\'essai gratuite sans engagement',
      'Témoignages clients de votre secteur'
    ],
    next_action: 'Proposer une démo ciblée sur le cas spécifique'
  },
  trust: {
    real_meaning: 'Le prospect veut réduire le risque perçu',
    laer: {
      acknowledge: 'C\'est tout à fait légitime de vouloir plus d\'informations avant de décider.',
      explore: 'Quelles informations vous seraient les plus utiles pour vous décider ?',
      respond: 'Je peux vous envoyer {materials}. Avez-vous des questions spécifiques auxquelles je peux répondre maintenant ?'
    },
    feel_felt_found: {
      feel: 'Je comprends votre besoin de vous assurer avant d\'avancer.',
      felt: 'De nombreux clients avaient les mêmes questions.',
      found: 'Notre documentation complète et nos références les ont rassurés pour passer à l\'action.'
    },
    proof_points: [
      'Références clients vérifiables',
      'Études de cas détaillées',
      'Garantie satisfaction 30 jours'
    ],
    next_action: 'Envoyer documentation + proposer appel avec client existant'
  }
};

async function handleObjection(session, args) {
  const objection = {
    type: args.objection_type,
    text: args.objection_text,
    resolved: args.resolved || false,
    timestamp: Date.now()
  };

  session.analytics.objections.push(objection);
  session.analytics.funnel_stage = 'objection_handling';

  // Track event
  session.analytics.events.push({
    type: args.resolved ? 'objection_resolved' : 'objection_raised',
    timestamp: Date.now(),
    data: objection
  });

  console.log(`[Objection] ${args.objection_type}: "${args.objection_text}" - ${args.resolved ? 'RESOLVED' : 'PENDING'}`);

  // Log for analytics
  logConversionEvent(session, 'objection', {
    type: args.objection_type,
    resolved: args.resolved,
    text: args.objection_text
  });

  // === SOTA: Return intelligent response suggestions ===
  const handler = OBJECTION_HANDLERS[args.objection_type];
  if (handler) {
    return {
      status: 'objection_logged',
      type: args.objection_type,
      real_meaning: handler.real_meaning,
      suggested_responses: {
        laer_framework: handler.laer,
        feel_felt_found: handler.feel_felt_found
      },
      proof_points: handler.proof_points,
      recommended_next_action: handler.next_action
    };
  }

  return {
    status: 'objection_logged',
    type: args.objection_type,
    note: 'Objection type non standard - utiliser réponse empathique générique'
  };
}

async function handleScheduleCallback(session, args) {
  session.callback = {
    scheduled: true,
    time: args.callback_time || 'unspecified',
    action: args.next_action,
    notes: args.notes || ''
  };

  session.analytics.outcome = 'callback';
  session.analytics.funnel_stage = 'follow_up';

  // Track event
  session.analytics.events.push({
    type: 'callback_scheduled',
    timestamp: Date.now(),
    data: session.callback
  });

  console.log(`[Callback] Scheduled: ${args.next_action} at ${args.callback_time || 'TBD'}`);

  // Execute follow-up action
  if (args.next_action === 'send_sms_booking_link') {
    await sendSMSBookingLink(session);
  } else if (args.next_action === 'send_email') {
    await sendFollowUpEmail(session);
  }

  // Log for analytics
  logConversionEvent(session, 'callback_scheduled', session.callback);
}

async function handleCreateBooking(session, args) {
  // Merge booking data
  session.bookingData = {
    ...session.bookingData,
    name: args.name || session.bookingData.name,
    email: args.email || session.bookingData.email,
    slot: args.slot || session.bookingData.slot,
    meeting_type: args.meeting_type || 'discovery_call',
    qualification_score: args.qualification_score || session.bookingData.qualification_score,
    notes: args.notes || session.bookingData.notes
  };

  // HITL Check: High-score bookings require approval (Session 165quater - flexible threshold)
  const bantScore = session.qualification?.score || 0;
  const meetsThreshold = bantScore >= HITL_CONFIG.bookingScoreThreshold;
  if (HITL_CONFIG.enabled && HITL_CONFIG.approveHotBookings && meetsThreshold) {
    const pendingAction = queueActionForApproval('booking', session, args, `Lead BANT score ${bantScore} >= ${HITL_CONFIG.bookingScoreThreshold} threshold`);
    return {
      status: 'pending_approval',
      hitlId: pendingAction.id,
      bantScore,
      threshold: HITL_CONFIG.bookingScoreThreshold,
      message: `Booking queued for HITL approval (score ${bantScore}). Use --approve=${pendingAction.id} to proceed.`
    };
  }

  return handleCreateBookingInternal(session, args);
}

async function handleCreateBookingInternal(session, args) {
  session.analytics.outcome = 'booked';
  session.analytics.funnel_stage = 'closing';

  // Track event
  session.analytics.events.push({
    type: 'booking_created',
    timestamp: Date.now(),
    data: session.bookingData
  });

  console.log(`[Booking] Creating for ${session.bookingData.name} (${session.bookingData.qualification_score})`);

  // Create the actual booking
  await createBooking(session);

  // Log for analytics
  logConversionEvent(session, 'booking_created', {
    ...session.bookingData,
    qualification: session.qualification
  });
}

async function handleTrackConversion(session, args) {
  const event = {
    type: args.event,
    stage: args.stage,
    outcome: args.outcome || 'pending',
    timestamp: Date.now()
  };

  session.analytics.events.push(event);
  session.analytics.funnel_stage = args.stage;

  console.log(`[Analytics] ${args.event} at ${args.stage} - ${args.outcome || 'pending'}`);
}

// RAG fallback messages - Multilingual (Session 166sexies)
const RAG_MESSAGES = {
  noKnowledgeBase: {
    'fr': "Je n'ai pas accès à cette information spécifique pour le moment.",
    'en': "I don't have access to that specific information right now.",
    'es': "No tengo acceso a esa información específica en este momento.",
    'ar': "ليس لدي إمكانية الوصول إلى هذه المعلومات المحددة في الوقت الحالي.",
    'ary': "معنديش هاد المعلومة دابا."
  },
  notFound: {
    'fr': "Désolé, je ne trouve pas cette information dans mes documents.",
    'en': "Sorry, I couldn't find that information in my documents.",
    'es': "Lo siento, no encuentro esa información en mis documentos.",
    'ar': "عذراً، لا أجد هذه المعلومات في مستنداتي.",
    'ary': "سمحلينا، ملقيتش هاد المعلومة."
  }
};

async function handleSearchKnowledgeBase(session, args) {
  const kbId = session.metadata?.knowledge_base_id || session.metadata?.persona_id || 'agency_v2';
  const sessionLang = session.metadata?.language || CONFIG.defaultLanguage;
  const query = args.query.toLowerCase();

  console.log(`[Cognitive-RAG] Semantic search for ${kbId}: "${query}" (lang: ${sessionLang})`);

  // 1. Semantic Search using TF-IDF Index (v3.0)
  try {
    const results = KB.search(query, 3);
    if (results && results.length > 0) {
      const bestMatch = KB.formatForVoice(results, sessionLang);
      console.log(`[Cognitive-RAG] Found semantic matches: ${results.length}`);
      return { found: true, result: bestMatch };
    }
  } catch (e) {
    console.error(`[Cognitive-RAG] Semantic search error: ${e.message}`);
  }

  // 2. Keyword Fallback (Legacy Logic)
  console.log(`[Cognitive-RAG] Falling back to keyword matching...`);
  const langKb = KNOWLEDGE_BASES[sessionLang] || KNOWLEDGE_BASES['fr'];
  let kbData = langKb[kbId];

  if (!kbData && sessionLang !== 'fr') {
    kbData = KNOWLEDGE_BASES['fr'][kbId];
  }

  if (!kbData) {
    return { found: false, result: RAG_MESSAGES.noKnowledgeBase[sessionLang] };
  }

  let bestMatch = null;
  let maxScore = 0;
  for (const [key, value] of Object.entries(kbData)) {
    if (key.toLowerCase().includes(query) || value.toLowerCase().includes(query)) {
      return { found: true, result: value };
    }
  }

  return { found: false, result: RAG_MESSAGES.notFound[sessionLang] };
}

async function handleTransferCall(session, args) {
  console.log(`[Handoff] Transfer requested. Reason: ${args.reason}`);

  // HITL Check: Call transfers require approval
  if (HITL_CONFIG.enabled && HITL_CONFIG.approveTransfers) {
    const pendingAction = queueActionForApproval('transfer', session, args, `Call transfer requested: ${args.reason}`);
    return {
      status: 'pending_approval',
      hitlId: pendingAction.id,
      message: `Transfer queued for HITL approval. Use --approve=${pendingAction.id} to proceed.`
    };
  }

  return handleTransferCallInternal(session, args);
}

async function handleTransferCallInternal(session, args) {
  if (!twilio) {
    console.error('[Handoff] Twilio SDK not available');
    return { success: false, error: "twilio_not_configured" };
  }

  // Instantiate Client
  const client = twilio(CONFIG.twilio.accountSid, CONFIG.twilio.authToken);
  const callSid = session.callSid;

  // Determine target phone
  // 1. Explicit arg
  // 2. Business Info from Metadata (Injected by Director)
  // 3. Fallback to Agency Default (defined in env or config)
  let targetPhone = args.phone_number || session.metadata?.business_info?.phone || CONFIG.twilio.phoneNumber;

  if (!targetPhone) {
    console.error('[Handoff] No target phone number available');
    return { success: false, error: "no_target_phone" };
  }

  console.log(`[Handoff] Executing transfer for Call ${callSid} to ${targetPhone}`);

  // Get session language (multilingual - Session 166sexies)
  const sessionLang = session.metadata?.language || CONFIG.defaultLanguage;
  const twimlLang = getTwiMLLanguage(sessionLang);
  const transferMessage = getTwiMLMessage('transferToHuman', sessionLang);

  // TwiML to execute the transfer
  const twiml = `
<Response>
  <Say language="${twimlLang}">${transferMessage}</Say>
  <Dial>${targetPhone}</Dial>
</Response>`;

  try {
    // Update the live call with new TwiML
    await client.calls(callSid).update({ twiml: twiml });

    // Log conversion event
    logConversionEvent(session, 'call_transfer', {
      reason: args.reason,
      target: targetPhone
    });

    return { success: true, status: "transfer_initiated" };
  } catch (error) {
    console.error(`[Handoff] Twilio Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// ============================================
// COMPLAINT HANDLING WITH HITL (Session 250.12)
// Financial commitments require human approval
// ============================================

/**
 * Handle complaint with HITL for financial commitments
 * @param {Object} session - Active session
 * @param {Object} args - Complaint details
 */
async function handleComplaint(session, args) {
  console.log(`[Complaint] Type: ${args.complaint_type}, Financial: ${args.financial_commitment}`);

  // Check if proposed resolution contains financial keywords
  const hasFinancialKeywords = detectFinancialCommitment(args.proposed_resolution);
  const matchedKeywords = getMatchedFinancialKeywords(args.proposed_resolution);

  // HITL Check: Financial commitments require approval
  const requiresHitl = HITL_CONFIG.enabled &&
                       HITL_CONFIG.approveFinancialComplaints &&
                       (args.financial_commitment || hasFinancialKeywords);

  if (requiresHitl) {
    console.log(`[Complaint-HITL] Financial commitment detected. Keywords: ${matchedKeywords.join(', ')}`);

    const pendingAction = queueActionForApproval('financial_complaint', session, {
      ...args,
      detected_keywords: matchedKeywords,
      customer_phone: session.bookingData?.phone || session.callSid
    }, `Financial complaint resolution: ${args.proposed_resolution} (€${args.estimated_value || 'N/A'})`);

    // Log complaint for tracking
    logConversionEvent(session, 'complaint_pending_hitl', {
      type: args.complaint_type,
      severity: args.severity,
      proposed_resolution: args.proposed_resolution,
      estimated_value: args.estimated_value,
      hitl_id: pendingAction.id
    });

    return {
      status: 'pending_approval',
      hitlId: pendingAction.id,
      message_to_customer: 'Je comprends votre situation et je note votre demande. Un responsable va examiner votre dossier et vous recontacter très rapidement pour vous confirmer la solution.',
      internal_note: `HITL required for financial commitment. Use --approve=${pendingAction.id} to authorize.`
    };
  }

  // Non-financial complaints can proceed immediately
  logConversionEvent(session, 'complaint_resolved', {
    type: args.complaint_type,
    severity: args.severity,
    resolution: args.proposed_resolution,
    financial: false
  });

  return {
    status: 'approved',
    message_to_customer: args.proposed_resolution,
    internal_note: 'Non-financial complaint - resolved immediately'
  };
}

/**
 * Execute approved financial complaint resolution
 * Called after HITL approval
 */
async function executeApprovedComplaint(session, args) {
  console.log(`[Complaint] Executing approved resolution: ${args.proposed_resolution}`);

  logConversionEvent(session, 'complaint_resolved_hitl', {
    type: args.complaint_type,
    severity: args.severity,
    resolution: args.proposed_resolution,
    estimated_value: args.estimated_value,
    financial: true,
    approved: true
  });

  return {
    success: true,
    status: 'resolved',
    message_to_customer: args.proposed_resolution
  };
}

// ============================================
// FOLLOW-UP & MESSAGING ACTIONS
// Session 249.18: Unified messaging with WhatsApp → Twilio SMS fallback
// ============================================

/**
 * Send SMS via Twilio API
 * Uses Twilio SDK (already installed: "twilio": "^4.19.0")
 * @param {string} to - Phone number (E.164 format, e.g., +33612345678)
 * @param {string} body - Message text
 * @returns {Promise<boolean>} Success status
 */
async function sendTwilioSMS(to, body) {
  if (!CONFIG.twilio.accountSid || !CONFIG.twilio.authToken || !CONFIG.twilio.phoneNumber) {
    console.log('[Twilio SMS] Credentials not configured');
    return false;
  }

  console.log(`[Twilio SMS] Sending to ${to}: "${body.substring(0, 50)}..."`);

  try {
    // Use Twilio SDK if available
    if (twilio) {
      const client = twilio(CONFIG.twilio.accountSid, CONFIG.twilio.authToken);
      const message = await client.messages.create({
        body: body,
        from: CONFIG.twilio.phoneNumber,
        to: to
      });
      console.log(`[Twilio SMS] Sent successfully (SID: ${message.sid})`);
      return true;
    }

    // Fallback: Direct REST API call
    const auth = Buffer.from(`${CONFIG.twilio.accountSid}:${CONFIG.twilio.authToken}`).toString('base64');
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${CONFIG.twilio.accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          To: to,
          From: CONFIG.twilio.phoneNumber,
          Body: body
        }),
        signal: AbortSignal.timeout(10000)
      }
    );

    const result = await response.json();
    if (result.sid) {
      console.log(`[Twilio SMS] Sent successfully (SID: ${result.sid})`);
      return true;
    } else {
      console.error('[Twilio SMS] Error:', JSON.stringify(result));
      return false;
    }
  } catch (error) {
    console.error(`[Twilio SMS] Error: ${error.message}`);
    return false;
  }
}

/**
 * Send message via WhatsApp Business API
 * @param {string} to - Phone number (E.164 format)
 * @param {string} body - Message text
 * @returns {Promise<boolean>} Success status
 */
async function sendWhatsAppMessage(to, body) {
  if (!CONFIG.whatsapp.accessToken || !CONFIG.whatsapp.phoneNumberId) {
    console.log('[WhatsApp] Credentials not configured');
    return false;
  }

  console.log(`[WhatsApp] Sending to ${to}: "${body.substring(0, 50)}..."`);

  try {
    const response = await fetch(
      `https://graph.facebook.com/v22.0/${CONFIG.whatsapp.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CONFIG.whatsapp.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to,
          type: 'text',
          text: { body }
        }),
        signal: AbortSignal.timeout(10000)
      }
    );

    const result = await response.json();
    if (result.messages) {
      console.log('[WhatsApp] Message sent successfully');
      return true;
    } else {
      console.error('[WhatsApp] Error:', JSON.stringify(result));
      return false;
    }
  } catch (error) {
    console.error(`[WhatsApp] Error: ${error.message}`);
    return false;
  }
}

/**
 * Unified message sender with fallback chain
 * Priority: 1. WhatsApp Business → 2. Twilio SMS (fallback)
 * @param {string} to - Phone number (E.164 format)
 * @param {string} body - Message text
 * @returns {Promise<{success: boolean, channel: string}>}
 */
async function sendMessage(to, body) {
  // Ensure E.164 format
  const phone = to.startsWith('+') ? to : `+${to.replace(/\D/g, '')}`;

  // Try WhatsApp first (free)
  const whatsappSent = await sendWhatsAppMessage(phone, body);
  if (whatsappSent) {
    return { success: true, channel: 'whatsapp' };
  }

  // Fallback to Twilio SMS
  console.log('[Messaging] WhatsApp failed, trying Twilio SMS fallback...');
  const smsSent = await sendTwilioSMS(phone, body);
  if (smsSent) {
    return { success: true, channel: 'twilio_sms' };
  }

  console.error('[Messaging] All channels failed');
  return { success: false, channel: 'none' };
}

async function sendSMSBookingLink(session) {
  const bookingLink = 'https://vocalia.ma/reserver';
  const phone = session.bookingData.phone?.replace(/\D/g, '');

  if (!phone) {
    console.log('[Booking] No phone number available for booking link');
    return { success: false, channel: 'none' };
  }

  const body = `Bonjour ! Voici le lien pour réserver votre appel découverte avec VocalIA: ${bookingLink}\n\nÀ très vite !`;
  return await sendMessage(phone, body);
}

async function handleSendPaymentDetails(session, args) {
  const amount = args.amount;
  const description = args.description;
  const config = session.metadata?.payment_config;

  if (!config) {
    console.error('[Payment] No payment config found in session metadata');
    return { success: false, error: "no_payment_config" };
  }

  const method = args.method_override || config.method;
  const details = config.details;
  const currency = config.currency || 'EUR';

  console.log(`[Payment] Sending ${amount} ${currency} via ${method} for ${description}`);

  let message = "";
  if (method === 'BANK_TRANSFER') {
    message = `Voici les coordonnées pour le règlement de ${amount}${currency} (${description}):\n\n${details}\n\nMerci de nous envoyer une preuve de virement.`;
  } else if (method === 'LINK') {
    message = `Voici votre lien de paiement de ${amount}${currency} (${description}): ${details}`;
  } else {
    message = `Pour le règlement de ${amount}${currency} (${description}), les modalités sont: ${details}`;
  }

  try {
    const phone = session.bookingData.phone?.replace(/\D/g, '');
    if (!phone) throw new Error("No phone number available");

    const result = await sendMessage(phone, message);

    if (result.success) {
      logConversionEvent(session, 'payment_details_sent', {
        amount,
        currency,
        method,
        description,
        channel: result.channel
      });
      return { success: true, message: `Les détails ont été envoyés via ${result.channel}.`, channel: result.channel };
    } else {
      return { success: false, error: "messaging_failed" };
    }
  } catch (error) {
    console.error(`[Payment] Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function sendFollowUpEmail(session) {
  // Action: Log email follow-up request for external processing
  console.log(`[Email] Follow-up email requested for ${session.bookingData.email || session.bookingData.phone} (Handled by CRM Pipeline)`);

  // Log the intent for manual follow-up
  logConversionEvent(session, 'email_follow_up_queued', {
    phone: session.bookingData.phone,
    notes: session.callback.notes
  });
}

// ============================================
// CONVERSION ANALYTICS LOGGING
// ============================================

function logConversionEvent(session, eventType, data) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    sessionId: session.id,
    callSid: session.callSid,
    phone: session.bookingData.phone,
    event: eventType,
    funnel_stage: session.analytics.funnel_stage,
    qualification_score: session.qualification.score,
    data: data
  };

  console.log(`[Analytics] LOGGING: ${eventType}`, JSON.stringify(logEntry));

  // Session 177: Integrated trackV2 (GA4 + JSONL)
  MarketingScience.trackV2(eventType, {
    ...logEntry,
    clientId: session.metadata?.persona_id, // Match for cookie-less measurement
    gclid: session.metadata?.attribution?.gclid,
    fbclid: session.metadata?.attribution?.fbclid
  }).catch(e => console.error(`[Analytics] trackV2 failed: ${e.message}`));

  // Internal log for dashboard
  try {
    const fs = require('fs');
    const path = require('path');
    const logFile = path.join(DATA_DIR, 'conversion_events.jsonl');
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
  } catch (e) {
    console.error(`[Analytics] Local log error: ${e.message}`);
  }

  // Agent Ops: Update Context Box (Session 178)
  try {
    ContextBox.logEvent(session.callSid, 'VoiceBridge', eventType, data);
    if (eventType === 'qualification_updated') {
      ContextBox.set(session.callSid, {
        pillars: {
          qualification: session.qualification
        }
      });
    }
  } catch (e) {
    console.error(`[Analytics] ContextBox error: ${e.message}`);
  }
}

// ============================================
// TWILIO WEBHOOKS
// ============================================

/**
 * Generate TwiML for incoming call connection
 * @param {string} streamUrl - WebSocket stream URL
 * @param {string} lang - Language code (fr, en, es, ar, ary)
 * @returns {string} TwiML XML
 */
function generateTwiML(streamUrl, lang = CONFIG.defaultLanguage) {
  const twimlLang = getTwiMLLanguage(lang);
  const message = getTwiMLMessage('connecting', lang);

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <!-- SOTA Optimization: Instant Connect -->
  <!-- <Say voice="alice" language="${twimlLang}">${message}</Say> -->
  <Connect>
    <Stream url="${streamUrl}">
      <Parameter name="codec" value="mulaw"/>
    </Stream>
  </Connect>
</Response>`;
}

/**
 * Generate error TwiML
 * @param {string} messageKey - Key in TWIML_MESSAGES
 * @param {string} lang - Language code
 * @param {boolean} hangup - Whether to hangup after message
 * @returns {string} TwiML XML
 */
function generateErrorTwiML(messageKey, lang = CONFIG.defaultLanguage, hangup = true) {
  const twimlLang = getTwiMLLanguage(lang);
  const message = getTwiMLMessage(messageKey, lang);

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="${twimlLang}">${message}</Say>
  ${hangup ? '<Hangup/>' : ''}
</Response>`;
}

async function handleInboundCall(req, res, body) {
  // FIX: Validate Twilio signature
  if (!validateTwilioSignature(req, body)) {
    console.error('[Security] Rejected request with invalid Twilio signature');
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden: Invalid signature');
    return;
  }

  const callInfo = {
    callSid: body.CallSid,
    from: body.From,
    to: body.To,
    direction: 'inbound',
    timestamp: new Date().toISOString()
  };

  console.log(`[Twilio] Inbound call from ${callInfo.from}`);

  try {
    const session = await createGrokSession(callInfo);

    // Get language from session metadata (injected by VoicePersonaInjector)
    const sessionLang = session.metadata?.language || CONFIG.defaultLanguage;
    console.log(`[Twilio] Session language: ${sessionLang}`);

    // Generate stream URL
    const host = req.headers.host || `localhost:${CONFIG.port}`;
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const streamUrl = `wss://${host}/stream/${session.id}`;

    // Respond with TwiML (multilingual - Session 166sexies)
    const twiml = generateTwiML(streamUrl, sessionLang);

    res.writeHead(200, {
      'Content-Type': 'text/xml',
      'Cache-Control': 'no-cache'
    });
    res.end(twiml);

  } catch (error) {
    console.error(`[Twilio] Error handling call: ${error.message}`);

    // Use default language for error (no session available)
    const errorTwiml = generateErrorTwiML('serviceUnavailable', CONFIG.defaultLanguage, true);

    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(errorTwiml);
  }
}

// ============================================
// OUTBOUND CALL HANDLERS (Agentic "Act")
// ============================================

async function handleOutboundTrigger(req, res, body) {
  if (!CONFIG.twilio.accountSid || !CONFIG.twilio.authToken || !CONFIG.twilio.phoneNumber) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Twilio credentials not configured' }));
    return;
  }

  // Basic validation
  if (!body.phone) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Phone number required' }));
    return;
  }

  if (!twilio) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Twilio SDK not installed' }));
    return;
  }

  const client = twilio(CONFIG.twilio.accountSid, CONFIG.twilio.authToken);
  const host = req.headers.host || `localhost:${CONFIG.port}`;
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const callbackUrl = `${protocol}://${host}/voice/outbound-twiml`;

  console.log(`[Outbound] Triggering call to ${body.phone}...`);

  try {
    const call = await client.calls.create({
      url: callbackUrl,
      to: body.phone,
      from: CONFIG.twilio.phoneNumber,
      statusCallback: `${protocol}://${host}/voice/status`,
      statusCallbackMethod: 'POST',
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
    });

    console.log(`[Outbound] Call initiated: ${call.sid}`);

    // Create pre-session to track this outbound call
    // Note: The actual websocket session will be created when TwiML connects
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      callSid: call.sid,
      status: call.status
    }));

  } catch (error) {
    console.error(`[Outbound] Failed to initiate call: ${error.message}`);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
}

/**
 * Generate outbound TwiML with greeting
 * @param {string} streamUrl - WebSocket stream URL
 * @param {string} lang - Language code
 * @returns {string} TwiML XML
 */
function generateOutboundTwiML(streamUrl, lang = CONFIG.defaultLanguage) {
  const twimlLang = getTwiMLLanguage(lang);
  const message = getTwiMLMessage('outboundGreeting', lang);

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="${twimlLang}">${message}</Say>
  <Connect>
    <Stream url="${streamUrl}">
      <Parameter name="codec" value="mulaw"/>
    </Stream>
  </Connect>
</Response>`;
}

async function handleOutboundTwiML(req, res, body) {
  const callSid = body.CallSid;
  const to = body.To;

  console.log(`[Outbound] Connecting call ${callSid} to Grok Stream`);

  // Create session for outbound call
  const callInfo = {
    callSid: callSid,
    from: to, // For outbound, "from" is the person we called (the user)
    to: body.From, // Our number
    direction: 'outbound',
    timestamp: new Date().toISOString()
  };

  try {
    const session = await createGrokSession(callInfo);

    // Get language from session metadata (injected by VoicePersonaInjector)
    const sessionLang = session.metadata?.language || CONFIG.defaultLanguage;
    console.log(`[Outbound] Session language: ${sessionLang}`);

    // Generate stream URL
    const host = req.headers.host || `localhost:${CONFIG.port}`;
    const streamUrl = `wss://${host}/stream/${session.id}`;

    // TwiML for outbound: Say hello, then connect stream (multilingual - Session 166sexies)
    const twiml = generateOutboundTwiML(streamUrl, sessionLang);

    res.writeHead(200, {
      'Content-Type': 'text/xml',
      'Cache-Control': 'no-cache'
    });
    res.end(twiml);

  } catch (error) {
    console.error(`[Outbound] Error generating TwiML: ${error.message}`);
    const errorTwiml = generateErrorTwiML('connectionError', CONFIG.defaultLanguage, true);
    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(errorTwiml);
  }
}

function handleTwilioStream(ws, sessionId) {
  const session = activeSessions.get(sessionId);

  if (!session) {
    console.error(`[Twilio] Session not found: ${sessionId}`);
    ws.close();
    return;
  }

  session.twilioWs = ws;
  console.log(`[Twilio] Stream connected for session: ${sessionId}`);

  // ============================================
  // ABANDONMENT DETECTION (P1 - +15% recovery)
  // ============================================
  const INACTIVITY_THRESHOLD = 15000; // 15 seconds silence = potential abandon
  const RECOVERY_THRESHOLD = 30000;   // 30 seconds = trigger recovery
  let lastAudioTime = Date.now();
  let inactivityWarned = false;

  const inactivityChecker = setInterval(() => {
    const silenceDuration = Date.now() - lastAudioTime;

    // Warn after 15 seconds of silence
    if (silenceDuration > INACTIVITY_THRESHOLD && !inactivityWarned) {
      inactivityWarned = true;
      console.log(`[Abandon] Inactivity detected: ${Math.round(silenceDuration / 1000)}s for ${sessionId}`);

      // Track abandonment signal
      session.analytics.events.push({
        type: 'inactivity_detected',
        timestamp: new Date().toISOString(),
        silence_duration: silenceDuration
      });

      // Signal Grok to trigger recovery prompt
      if (session.grokWs && session.grokWs.readyState === WebSocket.OPEN) {
        session.grokWs.send(JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [{ type: 'input_text', text: '[SYSTEM: User silent for 15+ seconds. Trigger recovery: Ask if they want a callback or SMS with booking link.]' }]
          }
        }));
        session.grokWs.send(JSON.stringify({ type: 'response.create' }));
      }
    }

    // Full abandonment after 30 seconds
    if (silenceDuration > RECOVERY_THRESHOLD) {
      console.log(`[Abandon] Full abandonment detected for ${sessionId}`);
      session.analytics.outcome = 'abandoned';
      session.analytics.funnel_stage = 'abandoned';

      // Log abandonment event
      logConversionEvent(session, 'call_abandoned', {
        silence_duration: silenceDuration,
        last_stage: session.analytics.funnel_stage,
        qualification_score: session.qualification.score
      });

      // Clear checker and finalize
      clearInterval(inactivityChecker);
      finalizeSession(sessionId, true); // true = abandoned
    }
  }, 5000); // Check every 5 seconds

  ws.on('message', (data) => {
    const message = safeJsonParse(data.toString());
    if (!message) return;

    switch (message.event) {
      case 'connected':
        console.log(`[Twilio] Media stream connected`);
        break;

      case 'start':
        session.streamSid = message.start?.streamSid;
        session.streamStartTime = Date.now(); // Track stream start for duration
        console.log(`[Twilio] Stream started: ${session.streamSid}`);

        // Track call started event
        logConversionEvent(session, 'call_started', {
          phone: session.bookingData.phone,
          callSid: session.callSid
        });
        break;

      case 'media':
        // Reset inactivity timer on audio
        lastAudioTime = Date.now();
        inactivityWarned = false;

        // Forward audio to Grok
        if (session.grokWs && session.grokWs.readyState === WebSocket.OPEN) {
          const grokMessage = {
            type: 'input_audio_buffer.append',
            audio: message.media.payload
          };
          session.grokWs.send(JSON.stringify(grokMessage));
        }
        break;

      case 'stop':
        console.log(`[Twilio] Stream stopped`);
        clearInterval(inactivityChecker);

        // Finalize session
        finalizeSession(sessionId, false);
        break;
    }
  });

  ws.on('close', () => {
    console.log(`[Twilio] Stream closed for session: ${sessionId}`);
    clearInterval(inactivityChecker);
  });

  ws.on('error', (error) => {
    console.error(`[Twilio] Stream error: ${error.message}`);
    clearInterval(inactivityChecker);
  });
}

// ============================================
// BOOKING & WHATSAPP
// ============================================

async function createBooking(session) {
  if (!session.bookingData.name || !session.bookingData.email) {
    console.log(`[Booking] Incomplete data, skipping`);
    return;
  }

  console.log(`[Booking] Creating booking for ${session.bookingData.name}`);

  try {
    const response = await fetch(CONFIG.booking.scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'createBooking',
        data: session.bookingData
      }),
      signal: AbortSignal.timeout(10000)
    });

    const result = await response.json();

    if (result.success) {
      console.log(`[Booking] Created successfully`);

      // Send WhatsApp confirmation (multilingual - Session 166sexies)
      const sessionLang = session.metadata?.language || CONFIG.defaultLanguage;
      await sendWhatsAppConfirmation(session.bookingData, sessionLang);
    }
  } catch (error) {
    console.error(`[Booking] Error: ${error.message}`);
  }
}

/**
 * WhatsApp language codes mapping (ISO 639-1 to WhatsApp codes)
 * Note: WhatsApp templates must exist for each language
 */
const WHATSAPP_LANG_CODES = {
  'fr': 'fr',
  'en': 'en',
  'es': 'es',
  'ar': 'ar',
  'ary': 'ar'  // Darija uses Arabic template (no native WhatsApp support)
};

async function sendWhatsAppConfirmation(bookingData, lang = CONFIG.defaultLanguage) {
  if (!CONFIG.whatsapp.accessToken || !CONFIG.whatsapp.phoneNumberId) {
    console.log(`[WhatsApp] Credentials not configured, skipping`);
    return;
  }

  // Get WhatsApp language code
  const whatsappLang = WHATSAPP_LANG_CODES[lang] || 'fr';
  console.log(`[WhatsApp] Sending confirmation to ${bookingData.phone} in language: ${whatsappLang}`);

  try {
    const response = await fetch(
      `https://graph.facebook.com/v22.0/${CONFIG.whatsapp.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CONFIG.whatsapp.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: bookingData.phone.replace(/\D/g, ''),
          type: 'template',
          template: {
            name: 'booking_confirmation',
            language: { code: whatsappLang },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: bookingData.name },
                  { type: 'text', text: bookingData.slot || 'À confirmer' }
                ]
              }
            ]
          }
        }),
        signal: AbortSignal.timeout(10000)
      }
    );

    const result = await response.json();

    if (result.messages) {
      console.log(`[WhatsApp] Confirmation sent`);
    } else {
      console.error(`[WhatsApp] Error: ${JSON.stringify(result)}`);
    }
  } catch (error) {
    console.error(`[WhatsApp] Error: ${error.message}`);
  }
}

async function finalizeSession(sessionId, wasAbandoned = false) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  // Prevent duplicate finalization
  if (session.finalized) return;
  session.finalized = true;

  console.log(`[Session] Finalizing ${sessionId} (abandoned: ${wasAbandoned})`);

  // ============================================
  // CALCULATE CALL ANALYTICS (P2)
  // ============================================
  const endTime = Date.now();
  const callDuration = session.streamStartTime
    ? Math.round((endTime - session.streamStartTime) / 1000)
    : 0;
  session.analytics.call_duration = callDuration;

  // Determine final outcome
  if (!wasAbandoned) {
    if (session.analytics.outcome === 'booked') {
      // Already set by create_booking function
    } else if (session.callback.scheduled) {
      session.analytics.outcome = 'callback';
    } else if (session.bookingData.name || session.bookingData.email) {
      // Some data collected but no booking
      session.analytics.outcome = 'partial';
    } else {
      session.analytics.outcome = 'completed';
    }
  }
  // If wasAbandoned, outcome already set to 'abandoned'

  // ============================================
  // HANDLE DIFFERENT OUTCOMES
  // ============================================

  if (session.analytics.outcome === 'booked') {
    // Success path: create booking + send WhatsApp
    if (session.bookingData.name && session.bookingData.email) {
      await createBooking(session);
    }
  }
  else if (session.analytics.outcome === 'callback') {
    // Callback scheduled - log for CRM follow-up
    console.log(`[Callback] Scheduled for ${session.callback.time} - ${session.bookingData.phone}`);
    // In production: create CRM task, calendar event, etc.
  }
  else if (session.analytics.outcome === 'abandoned' || session.analytics.outcome === 'partial') {
    // RECOVERY: Send SMS with booking link for abandoned/partial leads
    console.log(`[Recovery] Attempting SMS recovery for ${session.bookingData.phone}`);
    await sendRecoverySMS(session);
  }

  // ============================================
  // LOG FINAL CONVERSION ANALYTICS
  // ============================================
  const finalAnalytics = {
    session_id: sessionId,
    phone: session.bookingData.phone,
    call_sid: session.callSid,
    duration_seconds: callDuration,
    outcome: session.analytics.outcome,
    funnel_stage: session.analytics.funnel_stage,
    qualification: {
      score: session.qualification.score,
      label: session.bookingData.qualification_score,
      need: session.qualification.need,
      timeline: session.qualification.timeline,
      budget: session.qualification.budget,
      authority: session.qualification.authority
    },
    objections_count: session.analytics.objections.length,
    objections: session.analytics.objections.map(o => o.type),
    events_count: session.analytics.events.length,
    booking_created: session.analytics.outcome === 'booked',
    callback_scheduled: session.callback.scheduled
  };

  console.log(`[Analytics] Final: ${JSON.stringify(finalAnalytics)}`);
  logConversionEvent(session, 'call_completed', finalAnalytics);

  // Agent Ops: Store full context pillars for post-call agents
  const finalContext = ContextBox.set(session.callSid, {
    status: 'completed',
    pillars: {
      identity: {
        phone: session.bookingData.phone,
        name: session.bookingData.name,
        email: session.bookingData.email
      },
      intent: {
        outcome: session.analytics.outcome,
        need: session.qualification.need
      },
      qualification: session.qualification
    }
  });

  // Agent Ops: TRIGGER HORIZONTAL BILLING (P3 - 7% Efficiency)
  if (session.analytics.outcome === 'booked' || session.qualification.score >= 75) {
    BillingAgent.processSessionBilling(finalContext).then(res => {
      if (res.success) {
        console.log(`[BillingAgent] SUCCESS: Invoice ${res.invoiceId} created for ${session.callSid}`);
        ContextBox.logEvent(session.callSid, 'BillingAgent', 'INVOICE_CREATED', res);
      }
    }).catch(err => {
      console.error(`[BillingAgent] CRITICAL ERROR: ${err.message}`);
    });
  }

  // ============================================
  // CONVERSION SUMMARY (for console visibility)
  // ============================================
  const outcomeEmoji = {
    'booked': '✅',
    'callback': '📞',
    'abandoned': '🚪',
    'partial': '📝',
    'completed': '💬'
  };

  console.log(`
╔════════════════════════════════════════════╗
║ CALL SUMMARY                               ║
╠════════════════════════════════════════════╣
║ ${outcomeEmoji[session.analytics.outcome] || '❓'} Outcome: ${session.analytics.outcome.toUpperCase().padEnd(12)} ║
║ ⏱️  Duration: ${String(callDuration).padStart(3)}s                       ║
║ 🎯 BANT Score: ${String(session.qualification.score).padStart(3)}/100 (${session.bookingData.qualification_score.padEnd(4)})     ║
║ 📊 Stage: ${session.analytics.funnel_stage.padEnd(20)} ║
║ ⚡ Objections: ${String(session.analytics.objections.length).padStart(2)}                        ║
╚════════════════════════════════════════════╝
`);

  // Cleanup after delay
  setTimeout(() => cleanupSession(sessionId), 5000);
}

// ============================================
// RECOVERY MESSAGE FOR ABANDONED LEADS
// Session 249.18: Unified messaging with WhatsApp → Twilio SMS fallback
// ============================================
async function sendRecoverySMS(session) {
  const phone = session.bookingData.phone;
  if (!phone) {
    console.log(`[Recovery] No phone number, skipping message`);
    return { success: false, channel: 'none' };
  }

  const bookingLink = 'https://vocalia.ma/reserver';
  const message = session.bookingData.name
    ? `Bonjour ${session.bookingData.name}, nous avons été coupés! Réservez votre appel découverte ici: ${bookingLink}`
    : `Bonjour, réservez votre appel découverte VocalIA: ${bookingLink}`;

  try {
    const result = await sendMessage(phone, message);

    if (result.success) {
      console.log(`[Recovery] Message sent successfully to ${phone} via ${result.channel}`);
      logConversionEvent(session, 'recovery_message_sent', {
        phone,
        message,
        channel: result.channel
      });
    } else {
      console.log(`[Recovery] All messaging channels failed for ${phone}`);
      logConversionEvent(session, 'recovery_message_failed', {
        phone,
        reason: 'all_channels_failed',
        qualification_score: session.qualification.score
      });
    }
    return result;
  } catch (error) {
    console.error(`[Recovery] Error: ${error.message}`);
    return { success: false, channel: 'none', error: error.message };
  }
}

// ============================================
// HTTP SERVER
// ============================================

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > CONFIG.security.maxBodySize) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      body += chunk;
    });

    req.on('end', () => {
      const contentType = req.headers['content-type'] || '';

      if (contentType.includes('application/json')) {
        resolve(safeJsonParse(body, {}));
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const params = new URLSearchParams(body);
        const obj = {};
        for (const [key, value] of params) {
          obj[key] = value;
        }
        resolve(obj);
      } else {
        resolve({ raw: body });
      }
    });

    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  // Rate limiting
  if (!checkRateLimit(clientIp)) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Rate limit exceeded' }));
    return;
  }

  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  try {
    // Health check
    if (pathname === '/health' && req.method === 'GET') {
      const health = {
        status: 'ok',
        service: 'voice-telephony-bridge',
        version: '1.0.0',
        activeSessions: activeSessions.size,
        maxSessions: CONFIG.security.maxActiveSessions,
        twilio: !!CONFIG.twilio.accountSid,
        grok: !!CONFIG.grok.apiKey,
        whatsapp: !!CONFIG.whatsapp.accessToken,
        timestamp: new Date().toISOString()
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(health, null, 2));
      return;
    }

    // Twilio inbound call webhook
    if (pathname === '/voice/inbound' && req.method === 'POST') {
      const body = await parseBody(req);
      await handleInboundCall(req, res, body);
      return;
    }

    // Twilio status callback
    if (pathname === '/voice/status' && req.method === 'POST') {
      const body = await parseBody(req);
      console.log(`[Twilio] Call status: ${body.CallStatus} for ${body.CallSid}`);
      res.writeHead(200);
      res.end();
      return;
    }

    // Outbound call trigger (Agentic Action)
    if (pathname === '/voice/outbound' && req.method === 'POST') {
      const body = await parseBody(req);
      await handleOutboundTrigger(req, res, body);
      return;
    }

    // Outbound TwiML handler
    if (pathname === '/voice/outbound-twiml' && req.method === 'POST') {
      const body = await parseBody(req); // To get CallSid if needed
      await handleOutboundTwiML(req, res, body);
      return;
    }

    // Messaging endpoint (Session 249.18: WhatsApp + Twilio SMS fallback)
    if (pathname === '/messaging/send' && req.method === 'POST') {
      const body = await parseBody(req);
      const { to, message, channel = 'auto' } = body;

      if (!to || !message) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required fields: to, message' }));
        return;
      }

      try {
        let result;
        if (channel === 'whatsapp') {
          const success = await sendWhatsAppMessage(to, message);
          result = { success, channel: success ? 'whatsapp' : 'none' };
        } else if (channel === 'sms') {
          const success = await sendTwilioSMS(to, message);
          result = { success, channel: success ? 'twilio_sms' : 'none' };
        } else {
          // Auto: WhatsApp first, then SMS fallback
          result = await sendMessage(to, message);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: result.success ? 'sent' : 'failed',
          channel: result.channel,
          to,
          message_preview: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
          timestamp: new Date().toISOString()
        }));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));

  } catch (error) {
    console.error(`[HTTP] Error: ${error.message}`);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

// WebSocket server for Twilio media streams
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const match = url.pathname.match(/^\/stream\/(.+)$/);

  if (match) {
    const sessionId = match[1];
    handleTwilioStream(ws, sessionId);
  } else {
    console.error(`[WebSocket] Invalid path: ${url.pathname}`);
    ws.close();
  }
});

// ============================================
// CLI INTERFACE
// ============================================

function printUsage() {
  console.log(`
Voice Telephony Bridge - Native Script
======================================

Usage:
  node voice-telephony-bridge.cjs [options]

Options:
  --server          Start HTTP/WebSocket server (default)
  --port=PORT       Server port (default: 3009)
  --health          Check system health
  --test-grok       Test Grok connection
  --list-pending    List HITL pending voice actions
  --approve=ID      Approve HITL pending action
  --reject=ID       Reject HITL pending action
  --help            Show this help

HITL (Human In The Loop):
  Hot bookings and call transfers require approval.
  ENV: HITL_APPROVE_HOT_BOOKINGS (default: true)
  ENV: HITL_APPROVE_TRANSFERS (default: true)
  ENV: HITL_SLACK_WEBHOOK (Slack notifications)
  ENV: HITL_VOICE_ENABLED (default: true)

Environment Variables:
  TWILIO_ACCOUNT_SID     Twilio Account SID
  TWILIO_AUTH_TOKEN      Twilio Auth Token
  TWILIO_PHONE_NUMBER    Twilio Phone Number
  XAI_API_KEY            xAI/Grok API Key
  GROK_VOICE             Grok voice (Sal, Rex, Eve, Leo, Mika, Valentin)
  WHATSAPP_ACCESS_TOKEN  WhatsApp Business API Token
  WHATSAPP_PHONE_NUMBER_ID  WhatsApp Phone Number ID

Twilio Webhook Configuration:
  Voice URL: https://your-domain.com/voice/inbound (POST)
  Status URL: https://your-domain.com/voice/status (POST)
`);
}

async function testGrokConnection() {
  console.log('[Test] Testing Grok connection...');

  if (!CONFIG.grok.apiKey) {
    console.error('❌ XAI_API_KEY not configured');
    return false;
  }

  try {
    const response = await fetch('https://api.x.ai/v1/models', {
      headers: { 'Authorization': `Bearer ${CONFIG.grok.apiKey}` },
      signal: AbortSignal.timeout(10000)
    });

    if (response.ok) {
      console.log('✅ Grok API connection OK');
      return true;
    } else {
      console.error(`❌ Grok API error: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Grok connection failed: ${error.message}`);
    return false;
  }
}

async function checkHealth() {
  console.log('\n=== Voice Telephony Bridge - Health Check ===\n');

  // Twilio
  console.log('Twilio:');
  console.log(`  Account SID: ${CONFIG.twilio.accountSid ? '✅ Configured' : '❌ Missing'}`);
  console.log(`  Auth Token: ${CONFIG.twilio.authToken ? '✅ Configured' : '❌ Missing'}`);
  console.log(`  Phone: ${CONFIG.twilio.phoneNumber || 'Not set'}`);

  // Grok
  console.log('\nGrok Voice:');
  console.log(`  API Key: ${CONFIG.grok.apiKey ? '✅ Configured' : '❌ Missing'}`);
  console.log(`  Voice: ${CONFIG.grok.voice}`);
  if (CONFIG.grok.apiKey) {
    await testGrokConnection();
  }

  // WhatsApp
  console.log('\nWhatsApp:');
  console.log(`  Access Token: ${CONFIG.whatsapp.accessToken ? '✅ Configured' : '❌ Missing'}`);
  console.log(`  Phone Number ID: ${CONFIG.whatsapp.phoneNumberId ? '✅ Configured' : '❌ Missing'}`);

  // Summary
  console.log('\n=== Summary ===');
  const twilioReady = CONFIG.twilio.accountSid && CONFIG.twilio.authToken;
  const grokReady = !!CONFIG.grok.apiKey;

  if (twilioReady && grokReady) {
    console.log('✅ System ready for telephony');
  } else {
    console.log('⚠️ System NOT ready:');
    if (!twilioReady) console.log('  - Configure Twilio credentials');
    if (!grokReady) console.log('  - Configure XAI_API_KEY');
  }

  console.log('');
}

// ============================================
// ATLAS-CHAT-9B DARIJA FALLBACK (Session 174)
// ============================================

async function callAtlasChat(messages) {
  if (!CONFIG.atlasChat.enabled) return null;

  console.log('[Atlas-Chat] Calling 9B model for Darija fallback via Featherless AI...');
  try {
    // Session 176ter: Use OpenAI-compatible format via Featherless AI provider
    const response = await fetch(CONFIG.atlasChat.url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CONFIG.atlasChat.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: CONFIG.atlasChat.model,
        messages: messages,
        max_tokens: 150,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`Featherless AI error: ${response.status}`);
    }

    const result = await response.json();
    // Featherless AI returns OpenAI-compatible response format
    const text = result?.choices?.[0]?.message?.content;

    console.log('[Atlas-Chat] Response received');
    return text ? text.trim() : null;
  } catch (error) {
    console.error(`[Atlas-Chat] Error: ${error.message}`);
    return null;
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    printUsage();
    return;
  }

  // HITL Commands
  if (args.includes('--list-pending')) {
    listPendingActions();
    return;
  }

  const approveArg = args.find(a => a.startsWith('--approve='));
  if (approveArg) {
    const hitlId = approveArg.split('=')[1];
    const result = await approveAction(hitlId);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const rejectArg = args.find(a => a.startsWith('--reject='));
  if (rejectArg) {
    const hitlId = rejectArg.split('=')[1];
    const reasonArg = args.find(a => a.startsWith('--reason='));
    const reason = reasonArg ? reasonArg.split('=')[1] : 'Rejected by operator';
    const result = rejectAction(hitlId, reason);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (args.includes('--health')) {
    await checkHealth();
    return;
  }

  if (args.includes('--test-grok')) {
    await testGrokConnection();
    return;
  }

  // Parse port
  const portArg = args.find(a => a.startsWith('--port='));
  if (portArg) {
    CONFIG.port = parseInt(portArg.split('=')[1]);
  }

  // Start server
  server.listen(CONFIG.port, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║         Voice Telephony Bridge - Native Script               ║
║                      Version 1.0.0                           ║
╠══════════════════════════════════════════════════════════════╣
║  HTTP Server:  http://localhost:${CONFIG.port.toString().padEnd(25)}║
║  WebSocket:    ws://localhost:${CONFIG.port}/stream/{sessionId}       ║
╠══════════════════════════════════════════════════════════════╣
║  Endpoints:                                                  ║
║    POST /voice/inbound    Twilio inbound call webhook        ║
║    POST /voice/status     Twilio status callback             ║
║    GET  /health           Health check                       ║
║    WS   /stream/:id       Twilio media stream                ║
╠══════════════════════════════════════════════════════════════╣
║  Status:                                                     ║
║    Twilio:   ${(CONFIG.twilio.accountSid ? '✅ Ready' : '❌ Missing credentials').padEnd(43)}║
║    Grok:     ${(CONFIG.grok.apiKey ? '✅ Ready' : '❌ Missing XAI_API_KEY').padEnd(43)}║
║    WhatsApp: ${(CONFIG.whatsapp.accessToken ? '✅ Ready' : '⏳ Awaiting credentials').padEnd(43)}║
╚══════════════════════════════════════════════════════════════╝
`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n[Server] Shutting down...');

    // Close all sessions
    for (const [sessionId] of activeSessions) {
      cleanupSession(sessionId);
    }

    wss.close();
    server.close(() => {
      console.log('[Server] Closed');
      process.exit(0);
    });

    // Force exit after 5s
    setTimeout(() => process.exit(1), 5000);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(console.error);

// Module Exports for Verification/External Integration
if (typeof module !== 'undefined') {
  module.exports = {
    handleSearchKnowledgeBase,
    handleTransferCall,
    handleTransferCallInternal,
    handleSendPaymentDetails,
    handleQualifyLead,
    handleObjection,
    handleScheduleCallback,
    handleCreateBooking,
    handleCreateBookingInternal,
    handleTrackConversion,
    // HITL
    listPendingActions,
    approveAction,
    rejectAction,
    HITL_CONFIG
  };
}
