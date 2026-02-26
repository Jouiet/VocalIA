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
  path.join(__dirname, '..', '.env')
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
const AgencyEventBus = require('../core/AgencyEventBus.cjs');
// Session 250.219: LLM Gateway for Multimodal STT
const llmGateway = require('../core/gateways/llm-global-gateway.cjs');

// Session 250.44ter: ElevenLabs TTS for Darija (Ghizlane, Jawad, Ali)
// M11 fix: require inside try/catch to prevent process crash if module missing
let ElevenLabsClient = null;
let VOICE_IDS = {};
let elevenLabsClient = null;
try {
  ({ ElevenLabsClient, VOICE_IDS } = require('../core/elevenlabs-client.cjs'));
  elevenLabsClient = new ElevenLabsClient();
  if (elevenLabsClient.isConfigured()) {
    console.log('✅ ElevenLabs client initialized for Darija TTS');
    // Session 250.45: Pre-cache common phrases to reduce latency
    // This warms up the ElevenLabs cache for standard greetings/messages
    elevenLabsClient.preCacheCommonPhrases(['fr', 'en', 'ary']).catch(e => {
      console.warn('[Voice] TTS pre-cache warning:', e.message);
    });
  } else {
    console.warn('⚠️ ELEVENLABS_API_KEY not set - Darija TTS will use Twilio fallback (ar-SA)');
  }
} catch (e) {
  console.warn('⚠️ ElevenLabs client not loaded:', e.message);
}

// Initialize Cognitive Modules
const KB = new ServiceKnowledgeBase();
KB.load();
const ECOM_TOOLS = VoiceEcommerceTools; // Already a singleton instance

// Session 250.45: Multi-Tenant KB Loader (replaces static loading)
const { getInstance: getTenantKBLoader } = require('../core/tenant-kb-loader.cjs');
const TenantKB = getTenantKBLoader();
console.log('✅ Multi-tenant KB loader initialized');

// Session 250.57: Conversation Store - Multi-tenant persistence
// ⛔ RULE: Conversation History = CLIENT CONSULTATION ONLY (never for KB/RAG)
const { getInstance: getConversationStore } = require('../core/conversation-store.cjs');
const conversationStore = getConversationStore();
console.log('✅ Conversation store initialized for telephony');

// Session 250.239: Outbound webhook dispatcher (G8)
const webhookDispatcher = require('../core/webhook-dispatcher.cjs');

// Session 250.188: UCP auto-enrichment for telephony calls
const { getInstance: getUCPStore } = require('../core/ucp-store.cjs');

// Session 250.63: Google Sheets DB for tenant voice preferences
const { getDB } = require('../core/GoogleSheetsDB.cjs');
let tenantDB = null;


/**
 * Session 250.63: Fetch tenant voice preferences from DB
 * @param {string} tenantId - Tenant identifier
 * @returns {Promise<{voice_language: string, voice_gender: string}>}
 */
async function getTenantVoicePreferences(tenantId) {
  if (!tenantId || tenantId === 'default') {
    return { voice_language: 'fr', voice_gender: 'female' };
  }

  try {
    if (!tenantDB) {
      tenantDB = await getDB();
    }
    const tenant = await tenantDB.findById('tenants', tenantId);
    if (tenant) {
      return {
        voice_language: tenant.voice_language || 'fr',
        voice_gender: tenant.voice_gender || 'female'
      };
    }
  } catch (err) {
    console.warn(`[Voice] Failed to fetch tenant ${tenantId} preferences: ${err.message}`);
  }

  return { voice_language: 'fr', voice_gender: 'female' };
}
console.log('✅ Tenant voice preferences loader ready');

/**
 * Session 250.65: Grok Voice Mapping - Map language + gender to Grok voices
 * Enables tenant voice configuration to affect PRIMARY voice system (not just ElevenLabs Darija)
 *
 * Available Grok voices: ara, eve, leo, sal, rex, mika, valentin
 * - Female: ara (default), eve, mika
 * - Male: leo, sal, rex, valentin
 */
const GROK_VOICE_MAP = {
  // Default/French
  fr_female: 'ara',      // Ara - warm, professional female
  fr_male: 'leo',        // Leo - confident male
  // English
  en_female: 'eve',      // Eve - clear female
  en_male: 'sal',        // Sal - articulate male
  // Spanish
  es_female: 'mika',     // Mika - expressive female
  es_male: 'rex',        // Rex - authoritative male
  // Arabic
  ar_female: 'ara',      // Ara - warm female (works well for Arabic)
  ar_male: 'valentin',   // Valentin - deep male
  // Darija (Moroccan)
  ary_female: 'ara',     // Ara - ElevenLabs Ghizlane will override for actual TTS
  ary_male: 'leo',       // Leo - ElevenLabs Jawad will override for actual TTS
};

/**
 * Session 250.65: Get Grok voice from tenant preferences
 * @param {string} language - Voice language (fr, en, es, ar, ary)
 * @param {string} gender - Voice gender (male, female)
 * @returns {string} Grok voice name
 */
function getGrokVoiceFromPreferences(language = 'fr', gender = 'female') {
  const key = `${language}_${gender}`;
  return GROK_VOICE_MAP[key] || GROK_VOICE_MAP.fr_female;
}
console.log('✅ Grok voice mapping ready (Session 250.65)');

// RAG Knowledge Base - Legacy fallback (Universal KBs)
// NOTE: Now loaded via TenantKBLoader with per-client override support
const KNOWLEDGE_BASES = {
  fr: require('./knowledge_base.json'),
  en: fs.existsSync(path.join(__dirname, 'knowledge_base_en.json')) ? require('./knowledge_base_en.json') : {},
  es: fs.existsSync(path.join(__dirname, 'knowledge_base_es.json')) ? require('./knowledge_base_es.json') : {},
  ar: fs.existsSync(path.join(__dirname, 'knowledge_base_ar.json')) ? require('./knowledge_base_ar.json') : {},
  ary: fs.existsSync(path.join(__dirname, 'knowledge_base_ary.json')) ? require('./knowledge_base_ary.json') : {}
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

  // Supported Languages - ALL 5 LANGUAGES (Session 250.44ter)
  supportedLanguages: ['fr', 'en', 'es', 'ar', 'ary'],
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
    sessionTimeout: 600000, // 10 minutes
    internalKey: process.env.VOCALIA_INTERNAL_KEY // BL12/BL14: Auth for billable endpoints
  },

  // Rate limiting
  rateLimit: {
    windowMs: 60000,
    maxRequests: 30
  }
};

// BL12/BL14 fix: Bearer token check for internal endpoints that trigger billable actions
// BL36 fix: Use timing-safe comparison to prevent timing attacks on Bearer token
function checkInternalAuth(req, res) {
  if (!CONFIG.security.internalKey) return true; // Dev mode: no key set
  const auth = req.headers.authorization || '';
  const expected = `Bearer ${CONFIG.security.internalKey}`;
  const authBuf = Buffer.from(auth);
  const expectedBuf = Buffer.from(expected);
  if (authBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(authBuf, expectedBuf)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized: Bearer token required' }));
    return false;
  }
  return true;
}
if (!CONFIG.security.internalKey) {
  console.warn('⚠️ [Security] VOCALIA_INTERNAL_KEY not set — /voice/outbound and /messaging/send unprotected');
}

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
    'ary': 'ar-MA'  // Darija → Moroccan Arabic (better STT recognition than ar-SA)
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
  },

  // G9: Recording consent notice (GDPR/compliance)
  recordingConsent: {
    'fr': 'Cet appel peut être enregistré à des fins d\'amélioration du service.',
    'en': 'This call may be recorded for quality and training purposes.',
    'es': 'Esta llamada puede ser grabada con fines de calidad y formación.',
    'ar': 'قد يتم تسجيل هذه المكالمة لأغراض تحسين الجودة.',
    'ary': 'هاد لاپيل يقدر يتسجل باش نحسنو الخدمة ديالنا.'
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

const DATA_DIR = process.env.VOICE_DATA_DIR || path.join(__dirname, '..', 'data', 'voice');
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
    // Session 250.57: Persist conversation before cleanup
    // ⛔ RULE: This is for CLIENT CONSULTATION ONLY - NEVER for KB/RAG
    try {
      const tenantId = session.metadata?.tenant_id || 'default';
      const callDuration = Math.floor((Date.now() - session.createdAt) / 1000);

      // Save accumulated conversation transcript
      if (session.conversationLog && session.conversationLog.length > 0) {
        const conversationMetadata = {
          source: 'telephony',
          language: session.metadata?.language || CONFIG.defaultLanguage,
          persona: session.metadata?.persona_id,
          duration_sec: callDuration,
          lead_score: session.qualificationScore || null,
          call_sid: session.callSid
        };

        // Save full conversation
        conversationStore.save(tenantId, sessionId, session.conversationLog, conversationMetadata);
        console.log(`[ConversationStore] Saved ${session.conversationLog.length} messages for ${tenantId}/${sessionId}`);

        // G8: Fire outbound webhooks for call.completed + conversation.ended
        webhookDispatcher.dispatch(tenantId, 'call.completed', {
          sessionId,
          duration_sec: callDuration,
          messages: session.conversationLog.length,
          lead_score: session.qualificationScore || null,
          language: session.metadata?.language,
          call_sid: session.callSid
        });
        webhookDispatcher.dispatch(tenantId, 'conversation.ended', {
          sessionId,
          messageCount: session.conversationLog.length,
          duration: callDuration,
          channel: 'telephony'
        });

        // G7: Report voice minutes to Stripe Billing Meter (non-blocking)
        if (tenantId && tenantId !== 'default' && callDuration > 0) {
          try {
            const stripeService = require('../core/StripeService.cjs');
            stripeService.reportVoiceMinutes(tenantId, callDuration / 60);
          } catch (_e) { /* Stripe not configured — silent */ }
        }
      }
    } catch (convErr) {
      console.warn('[ConversationStore] Save warning:', convErr.message);
    }

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
// unref() allows Node.js to exit even if interval is active (for tests)
const sessionCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of activeSessions) {
    if (now - session.createdAt > CONFIG.security.sessionTimeout) {
      console.log(`[Session] Timeout cleanup: ${sessionId}`);
      cleanupSession(sessionId);
    }
  }
}, 60000);
sessionCleanupInterval.unref();

// ============================================
// RATE LIMITING
// ============================================

function checkRateLimit(ip) {
  const now = Date.now();
  const windowStart = now - CONFIG.rateLimit.windowMs;

  if (!rateLimitMap.has(ip)) {
    // BL23 fix: Cap max entries to prevent memory DoS from distributed IPs
    if (rateLimitMap.size >= 10000) {
      return false; // Reject when map is full (fail-closed)
    }
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
// unref() allows Node.js to exit even if interval is active (for tests)
const rateLimitCleanupInterval = setInterval(() => {
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
rateLimitCleanupInterval.unref();

// ============================================
// TWILIO SIGNATURE VALIDATION
// ============================================

const secretVault = require('../core/SecretVault.cjs');
const ClientRegistry = require('../core/client-registry.cjs');

/**
 * Validate Twilio Signature with Hybrid Support (Managed & BYOK)
 * Session 250.80: Enhanced for Multi-Tenant Credentials
 */
async function validateTwilioSignature(req, body, rawBody) {
  // Skip validation if twilio SDK not installed
  if (!twilio) {
    console.warn('[Security] Twilio signature validation DISABLED (SDK missing)');
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

  // Helper to check validity with a specific token
  const checkValidity = (token, context) => {
    try {
      const isValid = twilio.validateRequest(token, signature, url, body);
      if (isValid) {
        console.log(`[Security] Twilio signature VALID (${context})`);
        return true;
      }
    } catch (e) {
      console.warn(`[Security] Validation error (${context}): ${e.message}`);
    }
    return false;
  };

  // 1. Try Agency Token (Managed Mode - Most common)
  if (CONFIG.twilio.authToken && checkValidity(CONFIG.twilio.authToken, 'Managed/Agency')) {
    return true;
  }

  // 2. Try BYOK (Client Token)
  // Extract AccountSid to identify potential tenant
  const accountSid = body.AccountSid || (typeof body === 'string' ? safeJsonParse(body)?.AccountSid : null);

  if (accountSid && accountSid !== CONFIG.twilio.accountSid) {
    console.log(`[Security] Unknown AccountSid ${accountSid}, attempting BYOK lookup...`);

    // Enhanced BYOK Lookup (Session 250.80)
    // Uses Reverse Index from ClientRegistry
    const tenantId = ClientRegistry.getTenantIdByTwilioSid(accountSid);

    if (tenantId) {
      try {
        // B13 fix: use singleton vault instance directly (not constructor)
        const creds = await secretVault.loadCredentials(tenantId);

        if (creds && creds.TWILIO_AUTH_TOKEN) {
          if (checkValidity(creds.TWILIO_AUTH_TOKEN, `BYOK/${tenantId}`)) {
            return true;
          }
        } else {
          console.warn(`[Security] Tenant ${tenantId} found for SID ${accountSid} but no TWILIO_AUTH_TOKEN in vault.`);
        }
      } catch (err) {
        console.error(`[Security] BYOK Credential load failed for ${tenantId}: ${err.message}`);
      }
    } else {
      console.warn(`[Security] No Tenant found for AccountSid ${accountSid}.`);
    }
  }

  console.error('[Security] Invalid Twilio signature (Failed Managed & BYOK checks)');
  return false;
}

/**
 * Validate WhatsApp Signature (Meta Cloud API)
 * SOTA Pattern #2: Secure Webhook
 */
function validateWhatsAppSignature(req, bodyRaw) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    console.warn('[Security][WhatsApp] Missing X-Hub-Signature-256');
    return false;
  }

  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    console.warn('[Security][WhatsApp] WHATSAPP_APP_SECRET not configured');
    return true; // Fail open in dev if needed, or false? Better safe: true only if explicitly allowed, but here we warn.
  }

  const hmac = crypto.createHmac('sha256', appSecret);
  const digest = 'sha256=' + hmac.update(bodyRaw).digest('hex');

  if (signature !== digest) {
    console.warn('[Security][WhatsApp] Invalid signature');
    return false;
  }

  return true;
}

/**
 * SOTA Pattern #2: WhatsApp Idempotency Cache (Session 250.219)
 */
const whatsappMessageCache = new Map();
// Cleanup cache every 24h
const whatsappCacheCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [id, expiry] of whatsappMessageCache.entries()) {
    if (now > expiry) whatsappMessageCache.delete(id);
  }
}, 86400000);
whatsappCacheCleanupInterval.unref();

/**
 * Download Media from Meta Cloud API (Session 250.219)
 * Used for Voice Notes (SOTA "Voice First" approach)
 */
async function downloadMetaMedia(mediaId) {
  if (!CONFIG.whatsapp.accessToken) throw new Error('WhatsApp Access Token missing');

  // 1. Get Media URL
  const metaUrl = `https://graph.facebook.com/v21.0/${mediaId}`;
  const res = await fetch(metaUrl, {
    headers: { 'Authorization': `Bearer ${CONFIG.whatsapp.accessToken}` }
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Meta Media API Error (${res.status}): ${err}`);
  }

  const mediaData = await res.json();
  const downloadUrl = mediaData.url;

  // 2. Download binary
  const mediaRes = await fetch(downloadUrl, {
    headers: { 'Authorization': `Bearer ${CONFIG.whatsapp.accessToken}` }
  });

  if (!mediaRes.ok) throw new Error(`Meta Media Download Error (${mediaRes.status})`);

  const arrayBuffer = await mediaRes.arrayBuffer();
  return Buffer.from(arrayBuffer);
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

    ws.on('open', async () => {
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
            },
            // ============================================
            // CATALOG TOOLS (Session 250.63 - Dynamic Catalog)
            // ============================================
            {
              type: 'function',
              name: 'browse_catalog',
              description: 'Parcourir le catalogue de produits/services du client. Utilisé pour montrer ce qui est disponible par catégorie.',
              parameters: {
                type: 'object',
                properties: {
                  category: {
                    type: 'string',
                    description: 'Catégorie à parcourir (ex: "entrées", "plats", "véhicules", "services")'
                  },
                  limit: {
                    type: 'number',
                    description: 'Nombre maximum d\'articles à retourner (défaut: 5)'
                  },
                  in_stock_only: {
                    type: 'boolean',
                    description: 'Afficher uniquement les articles disponibles'
                  }
                },
                required: []
              }
            },
            {
              type: 'function',
              name: 'get_item_details',
              description: 'Obtenir les détails complets d\'un article spécifique (produit, plat, service, véhicule).',
              parameters: {
                type: 'object',
                properties: {
                  item_id: {
                    type: 'string',
                    description: 'Identifiant de l\'article (ex: "P01", "SKU-001", "VEH-003")'
                  },
                  item_name: {
                    type: 'string',
                    description: 'Nom de l\'article si l\'ID n\'est pas connu'
                  }
                },
                required: []
              }
            },
            {
              type: 'function',
              name: 'get_menu',
              description: 'Obtenir le menu complet d\'un restaurant ou boulangerie avec catégories, prix et allergènes.',
              parameters: {
                type: 'object',
                properties: {
                  category: {
                    type: 'string',
                    description: 'Catégorie spécifique (ex: "entrées", "plats", "desserts", "boissons")'
                  },
                  dietary: {
                    type: 'string',
                    enum: ['vegan', 'vegetarian', 'gluten-free', 'halal'],
                    description: 'Filtrer par régime alimentaire'
                  }
                },
                required: []
              }
            },
            {
              type: 'function',
              name: 'check_item_availability',
              description: 'Vérifier la disponibilité d\'un article (stock produit, disponibilité plat, créneau service, dates véhicule).',
              parameters: {
                type: 'object',
                properties: {
                  item_id: {
                    type: 'string',
                    description: 'Identifiant de l\'article'
                  },
                  item_name: {
                    type: 'string',
                    description: 'Nom de l\'article si l\'ID n\'est pas connu'
                  },
                  date: {
                    type: 'string',
                    description: 'Date souhaitée (format YYYY-MM-DD) pour services/véhicules'
                  },
                  quantity: {
                    type: 'number',
                    description: 'Quantité souhaitée (pour produits)'
                  }
                },
                required: []
              }
            },
            {
              type: 'function',
              name: 'search_catalog',
              description: 'Rechercher des articles dans le catalogue par mot-clé.',
              parameters: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description: 'Terme de recherche (ex: "couscous", "SUV", "révision")'
                  },
                  category: {
                    type: 'string',
                    description: 'Catégorie pour affiner la recherche'
                  },
                  max_price: {
                    type: 'number',
                    description: 'Prix maximum'
                  }
                },
                required: ['query']
              }
            },
            // ============================================
            // SERVICE CATALOG TOOLS (Phase 4.2)
            // ============================================
            {
              type: 'function',
              name: 'get_services',
              description: 'Obtenir la liste des services disponibles (garage, coiffeur, spa, médecin, etc.).',
              parameters: {
                type: 'object',
                properties: {
                  category: {
                    type: 'string',
                    description: 'Catégorie de service (ex: "maintenance", "soins", "consultation")'
                  },
                  date: {
                    type: 'string',
                    description: 'Date pour vérifier disponibilité (format YYYY-MM-DD)'
                  }
                },
                required: []
              }
            },
            {
              type: 'function',
              name: 'get_available_slots',
              description: 'Obtenir les créneaux horaires disponibles pour un service.',
              parameters: {
                type: 'object',
                properties: {
                  service_id: {
                    type: 'string',
                    description: 'Identifiant du service'
                  },
                  service_name: {
                    type: 'string',
                    description: 'Nom du service si ID inconnu'
                  },
                  date: {
                    type: 'string',
                    description: 'Date souhaitée (format YYYY-MM-DD)'
                  },
                  provider_id: {
                    type: 'string',
                    description: 'Identifiant du prestataire spécifique (optionnel)'
                  }
                },
                required: ['date']
              }
            },
            {
              type: 'function',
              name: 'get_packages',
              description: 'Obtenir les forfaits et packages disponibles (hôtel, événements, spa).',
              parameters: {
                type: 'object',
                properties: {
                  category: {
                    type: 'string',
                    description: 'Type de package (ex: "weekend", "mariage", "bien-être")'
                  },
                  max_price: {
                    type: 'number',
                    description: 'Budget maximum'
                  }
                },
                required: []
              }
            },
            // ============================================
            // SPECIALIZED CATALOG TOOLS (Phase 4.3)
            // ============================================
            {
              type: 'function',
              name: 'get_vehicles',
              description: 'Obtenir les véhicules disponibles à la location.',
              parameters: {
                type: 'object',
                properties: {
                  vehicle_type: {
                    type: 'string',
                    enum: ['citadine', 'berline', 'suv', 'utilitaire', 'luxe'],
                    description: 'Type de véhicule'
                  },
                  start_date: {
                    type: 'string',
                    description: 'Date de début de location (format YYYY-MM-DD)'
                  },
                  end_date: {
                    type: 'string',
                    description: 'Date de fin de location (format YYYY-MM-DD)'
                  },
                  transmission: {
                    type: 'string',
                    enum: ['manuelle', 'automatique'],
                    description: 'Type de transmission'
                  }
                },
                required: []
              }
            },
            {
              type: 'function',
              name: 'get_trips',
              description: 'Obtenir les voyages et circuits disponibles.',
              parameters: {
                type: 'object',
                properties: {
                  destination: {
                    type: 'string',
                    description: 'Destination souhaitée (ville ou pays)'
                  },
                  trip_type: {
                    type: 'string',
                    enum: ['circuit', 'sejour', 'weekend', 'croisiere'],
                    description: 'Type de voyage'
                  },
                  max_budget: {
                    type: 'number',
                    description: 'Budget maximum par personne'
                  },
                  departure_month: {
                    type: 'string',
                    description: 'Mois de départ souhaité (ex: "mars", "avril")'
                  }
                },
                required: []
              }
            },
            // ============================================
            // AI RECOMMENDATIONS (Session 250.79)
            // ============================================
            {
              type: 'function',
              name: 'get_recommendations',
              description: 'Obtenir des recommandations personnalisées (produits, services, contenus) basées sur le contexte. Utilisé pour: items similaires, souvent choisis ensemble, ou recommandations personnalisées UCP.',
              parameters: {
                type: 'object',
                properties: {
                  product_id: {
                    type: 'string',
                    description: 'ID de l\'item (produit/service) pour recommandations similaires'
                  },
                  product_ids: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Liste d\'IDs produits (pour recommandations de panier)'
                  },
                  recommendation_type: {
                    type: 'string',
                    enum: ['similar', 'bought_together', 'personalized'],
                    description: 'Type de recommandation: similar=produits similaires, bought_together=souvent achetés ensemble, personalized=basé sur le profil client'
                  },
                  limit: {
                    type: 'number',
                    description: 'Nombre de recommandations (défaut: 3)'
                  }
                },
                required: ['recommendation_type']
              }
            },
            {
              type: 'function',
              name: 'start_product_quiz',
              description: 'Démarrer un quiz vocal pour aider le client à trouver le produit idéal. Utilisé quand le client ne sait pas quoi choisir ou veut des conseils personnalisés.',
              parameters: {
                type: 'object',
                properties: {
                  quiz_type: {
                    type: 'string',
                    enum: ['skincare', 'electronics', 'generic'],
                    description: 'Type de quiz: skincare=soins peau, electronics=appareils, generic=universel'
                  },
                  first_question: {
                    type: 'string',
                    description: 'Première question personnalisée à poser (optionnel)'
                  }
                },
                required: []
              }
            }
          ]
        }
      };

      // Session 250.65: Fetch tenant voice preferences BEFORE injection
      // This allows tenant preferences to override persona default voice
      const tenantId = callInfo.clientId || 'default';
      const voicePrefs = await getTenantVoicePreferences(tenantId);
      const tenantGrokVoice = getGrokVoiceFromPreferences(voicePrefs.voice_language, voicePrefs.voice_gender);
      console.log(`[Voice] Tenant ${tenantId} preferences: lang=${voicePrefs.voice_language}, gender=${voicePrefs.voice_gender} → Grok voice: ${tenantGrokVoice}`);

      // Session 250.218: Load tenant actions configuration
      const tenantActions = loadTenantActions(tenantId);

      // Session 250.218: Inject custom action tools into session tools
      if (tenantActions?.custom?.length > 0) {
        for (const action of tenantActions.custom) {
          if (!action.name || !action.description) continue;
          const properties = {};
          const required = [];
          for (const p of (action.parameters || [])) {
            properties[p.name] = { type: p.type || 'string', description: p.description || p.name };
            if (p.required) required.push(p.name);
          }
          sessionConfig.session.tools.push({
            type: 'function',
            name: action.name,
            description: action.description,
            parameters: { type: 'object', properties, required }
          });
        }
        console.log(`[Actions] Injected ${tenantActions.custom.length} custom tool(s) for tenant ${tenantId}`);
      }

      // Determine Persona based on Call Context
      const persona = VoicePersonaInjector.getPersona(
        callInfo.from,    // Caller ID
        callInfo.to,      // Called Number (maps to Vertical)
        callInfo.clientId, // Multi-tenancy ID (optional)
        'TELEPHONY'
      );

      console.log(`[The Director] Injecting Persona: ${persona.name} (${persona.id}) for Vertical: ${callInfo.to}`);

      // Inject Persona (Instructions + Voice)
      // This overwrites the default 'voice' and 'instructions' in sessionConfig
      const finalConfig = VoicePersonaInjector.inject(sessionConfig, persona);

      // Session 250.65: Override voice with tenant preference if tenant has configured one
      // This makes tenant voice configuration affect the PRIMARY Grok voice system
      if (tenantId !== 'default' && finalConfig.session) {
        const originalVoice = finalConfig.session.voice;
        finalConfig.session.voice = tenantGrokVoice;
        console.log(`[Voice] Tenant override: ${originalVoice} → ${tenantGrokVoice} (Session 250.65)`);
      }

      ws.send(JSON.stringify(finalConfig));

      const session = {
        id: sessionId,
        callSid: callInfo.callSid,
        from: callInfo.from,
        grokWs: ws,
        twilioWs: null,
        metadata: {
          ...(finalConfig.session_config?.metadata || finalConfig.metadata || {}),
          tenant_id: tenantId,
          voice_language: voicePrefs.voice_language,
          voice_gender: voicePrefs.voice_gender,
          grok_voice: tenantGrokVoice // Session 250.65: Track actual Grok voice used
        }, // Store injected persona metadata + voice preferences
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
        audioBuffer: [],
        // Session 250.57: Conversation log for multi-tenant persistence
        // ⛔ RULE: For CLIENT CONSULTATION ONLY - NEVER for KB/RAG
        conversationLog: [],
        // Session 250.218: Tenant actions (external endpoints + custom tools)
        _actions: tenantActions
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

/**
 * Session 250.44ter: Generate Darija TTS using ElevenLabs
 * Uses Ghizlane (female) or Jawad (male) voices
 * @param {string} text - Darija text to convert
 * @param {string} gender - 'female' or 'male' (default: female/Ghizlane)
 * @returns {Promise<Buffer|null>} Audio buffer or null if not configured
 */
async function generateDarijaTTS(text, gender = 'female') {
  if (!elevenLabsClient || !elevenLabsClient.isConfigured()) {
    console.warn('[ElevenLabs] Not configured - skipping Darija TTS');
    return null;
  }

  try {
    const voiceId = gender === 'male' ? VOICE_IDS.ary_male_jawad : VOICE_IDS.ary_female;
    console.log(`[ElevenLabs] Generating Darija TTS with ${gender === 'male' ? 'Jawad' : 'Ghizlane'}`);

    const audioBuffer = await elevenLabsClient.textToSpeech(text, {
      voiceId: voiceId,
      modelId: 'eleven_multilingual_v2',
      outputFormat: 'ulaw_8000' // Twilio-compatible format
    });

    console.log(`[ElevenLabs] Generated ${audioBuffer.length} bytes of audio`);
    return audioBuffer;
  } catch (error) {
    console.error(`[ElevenLabs] TTS error: ${error.message}`);
    return null;
  }
}

/**
 * Send ElevenLabs audio to Twilio WebSocket
 * @param {Object} session - Active session
 * @param {Buffer} audioBuffer - Audio data
 */
function sendElevenLabsAudioToTwilio(session, audioBuffer) {
  if (!session.twilioWs || session.twilioWs.readyState !== WebSocket.OPEN) {
    console.warn('[Twilio] WebSocket not ready for audio');
    return;
  }

  // Send audio in chunks (Twilio expects base64 encoded mulaw)
  const chunkSize = 640; // ~40ms at 8kHz
  for (let i = 0; i < audioBuffer.length; i += chunkSize) {
    const chunk = audioBuffer.slice(i, Math.min(i + chunkSize, audioBuffer.length));
    const twilioMessage = {
      event: 'media',
      streamSid: session.streamSid,
      media: {
        payload: chunk.toString('base64')
      }
    };
    session.twilioWs.send(JSON.stringify(twilioMessage));
  }
}

function handleGrokMessage(sessionId, message) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  switch (message.type) {
    case 'session.created':
      console.log(`[Grok] Session confirmed: ${sessionId}`);
      break;

    case 'response.audio.delta':
      // Forward audio to Twilio (skip for Darija - use ElevenLabs instead)
      // Session 250.44ter: For Darija sessions with ElevenLabs configured,
      // we use ElevenLabs TTS instead of Grok's built-in audio
      if (session.metadata?.language === 'ary' && elevenLabsClient?.isConfigured()) {
        // Skip Grok audio for Darija - ElevenLabs will handle TTS
        break;
      }
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
      // Log transcription and accumulate for Darija TTS
      if (message.delta) {
        console.log(`[Grok] AI: ${message.delta}`);
        // Accumulate text for Darija sessions (Session 250.44ter)
        if (session.metadata?.language === 'ary' && elevenLabsClient?.isConfigured()) {
          session.pendingText = (session.pendingText || '') + message.delta;
        }
      }
      break;

    case 'input_audio_buffer.speech_started':
      console.log(`[Grok] User speaking...`);
      // Clear pending text when user starts speaking
      if (session.pendingText) {
        session.pendingText = '';
      }
      break;

    case 'response.done':
      // Check if booking data was extracted
      if (message.response && message.response.output) {
        extractBookingData(session, message.response.output);
      }
      // Session 250.57: Log AI response to conversation log
      // ⛔ RULE: For CLIENT CONSULTATION ONLY - NEVER for KB/RAG
      if (session.pendingText && session.conversationLog) {
        session.conversationLog.push({
          role: 'assistant',
          content: session.pendingText,
          timestamp: new Date().toISOString()
        });
      }
      // Session 250.44ter: Generate ElevenLabs TTS for Darija
      if (session.metadata?.language === 'ary' && session.pendingText && elevenLabsClient?.isConfigured()) {
        const textToSpeak = session.pendingText;
        session.pendingText = '';
        // Async TTS generation - Session 250.63: Use tenant voice preferences
        const voiceGender = session.metadata?.voice_gender || 'female';
        generateDarijaTTS(textToSpeak, voiceGender).then(audioBuffer => {
          if (audioBuffer) {
            sendElevenLabsAudioToTwilio(session, audioBuffer);
          }
        }).catch(err => {
          console.error(`[ElevenLabs] Darija TTS failed: ${err.message}`);
        });
      } else {
        session.pendingText = ''; // Clear for non-Darija
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
// SESSION 250.218: ACTIONS — Real-Time Business System Connections
// ============================================

// Mapping: tool name → override type.endpoint
const ACTION_TOOL_MAP = {
  browse_catalog: 'catalog.browse',
  get_item_details: 'catalog.item_details',
  get_menu: 'catalog.menu',
  check_item_availability: 'catalog.availability',
  search_catalog: 'catalog.search',
  get_services: 'catalog.browse',
  get_packages: 'catalog.browse',
  get_vehicles: 'catalog.browse',
  get_trips: 'catalog.browse',
  check_order_status: 'commerce.order_status',
  check_product_stock: 'commerce.product_stock',
  get_customer_tags: 'commerce.customer_tags',
  get_available_slots: 'booking.available_slots'
};

// Private IP ranges to block (SSRF protection)
const PRIVATE_IP_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^\[::1\]/
];

/**
 * Validate action URL: must be HTTPS, no private IPs
 */
function isValidActionUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== 'https:') return false;
    if (PRIVATE_IP_PATTERNS.some(p => p.test(u.hostname))) return false;
    return true;
  } catch { return false; }
}

/**
 * Substitute {{param}} templates in a URL path
 */
function substituteTemplate(template, params) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return encodeURIComponent(params[key] || '');
  });
}

/**
 * Execute an external action via HTTPS
 * @param {{ url: string, headers?: object, timeout?: number, method?: string }} actionConfig
 * @param {string} endpointPath - e.g. "/products?category={{category}}"
 * @param {object} params - template substitution values
 * @returns {Promise<{ success: boolean, data?: any, error?: string }>}
 */
function executeAction(actionConfig, endpointPath, params) {
  return new Promise((resolve) => {
    // B58 fix: normalize double slashes from URL + endpointPath concatenation
    const rawUrl = actionConfig.url.replace(/\/+$/, '') + (endpointPath.startsWith('/') || endpointPath.startsWith('?') ? '' : '/') + endpointPath;
    const fullUrl = substituteTemplate(rawUrl, params);
    if (!isValidActionUrl(fullUrl)) {
      resolve({ success: false, error: 'invalid_url' });
      return;
    }

    const urlObj = new URL(fullUrl);
    const timeout = actionConfig.timeout || 5000;
    const method = (actionConfig.method || 'GET').toUpperCase();
    const isBodyMethod = method === 'POST' || method === 'PUT' || method === 'PATCH';

    // B54 fix: POST/PUT/PATCH send params as JSON body
    const bodyData = isBodyMethod && params && Object.keys(params).length > 0
      ? JSON.stringify(params)
      : null;

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'VocalIA-Actions/1.0',
        ...(actionConfig.headers || {}),
        ...(bodyData ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyData) } : {})
      },
      timeout
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, data: parsed });
          } else {
            resolve({ success: false, error: `HTTP ${res.statusCode}` });
          }
        } catch {
          resolve({ success: false, error: 'invalid_json_response' });
        }
      });
    });
    req.on('error', (e) => resolve({ success: false, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ success: false, error: 'timeout' }); });
    if (bodyData) req.write(bodyData);
    req.end();
  });
}

/**
 * Load tenant actions config from config.json
 * @param {string} tenantId
 * @returns {{ overrides: object, custom: Array }|null}
 */
function loadTenantActions(tenantId) {
  if (!tenantId || tenantId === 'default') return null;
  // B55 fix: sanitize tenantId — block path traversal
  const safeTenantId = tenantId.replace(/[^a-z0-9_-]/gi, '');
  if (!safeTenantId || safeTenantId !== tenantId) {
    console.warn(`[Actions] Rejected unsafe tenantId: ${tenantId}`);
    return null;
  }
  try {
    const configPath = path.join(__dirname, '..', 'clients', safeTenantId, 'config.json');
    if (!fs.existsSync(configPath)) return null;
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.actions && (Object.keys(config.actions.overrides || {}).length > 0 || (config.actions.custom || []).length > 0)) {
      return config.actions;
    }
    return null;
  } catch (e) {
    console.warn(`[Actions] Failed to load actions for ${tenantId}:`, e.message);
    return null;
  }
}

/**
 * Try to execute an action override for a tool call
 * @returns {{ handled: boolean, result?: object }}
 */
async function tryActionOverride(session, toolName, args) {
  if (!session._actions) return { handled: false };

  const mapping = ACTION_TOOL_MAP[toolName];
  if (!mapping) return { handled: false };

  const [type, endpoint] = mapping.split('.');
  const override = session._actions.overrides?.[type];
  if (!override || !override.url || !override.endpoints?.[endpoint]) {
    return { handled: false };
  }

  console.log(`[Actions] Override found for ${toolName} → ${type}.${endpoint}`);
  const actionResult = await executeAction(override, override.endpoints[endpoint], args);

  if (actionResult.success) {
    console.log(`[Actions] External call succeeded for ${toolName}`);
    return { handled: true, result: { success: true, source: 'external', data: actionResult.data } };
  }

  console.warn(`[Actions] External call failed for ${toolName}: ${actionResult.error} — falling back to local`);
  return { handled: false };
}

/**
 * Handle a custom action (query_external or tenant-defined)
 */
async function handleCustomAction(session, actionDef, args) {
  if (!actionDef || !actionDef.url) {
    return { success: false, error: 'invalid_custom_action' };
  }

  // B59 fix: for GET → params in query string; for POST/PUT → params in body (handled by executeAction)
  const method = (actionDef.method || 'GET').toUpperCase();
  const isBodyMethod = method === 'POST' || method === 'PUT' || method === 'PATCH';

  const filteredParams = {};
  (actionDef.parameters || []).forEach(p => {
    if (args[p.name] !== undefined) filteredParams[p.name] = args[p.name];
  });

  let endpointPath = '';
  if (!isBodyMethod && Object.keys(filteredParams).length > 0) {
    const queryString = Object.entries(filteredParams)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    endpointPath = `?${queryString}`;
  }

  const actionResult = await executeAction(actionDef, endpointPath, filteredParams);
  if (actionResult.success) {
    const data = actionDef.response_path
      ? actionResult.data?.[actionDef.response_path] ?? actionResult.data
      : actionResult.data;
    return { success: true, source: 'external', data };
  }
  return { success: false, error: actionResult.error || 'external_call_failed' };
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

  // Session 250.218: Action override — try external endpoint before local handler
  if (session._actions) {
    // Custom action (query_external or tenant-defined)
    const customDef = (session._actions.custom || []).find(a => a.name === item.name);
    if (customDef) {
      result = await handleCustomAction(session, customDef, args);
      if (callId) await sendFunctionResult(session, callId, result);
      return;
    }
    // Override for existing tools
    const override = await tryActionOverride(session, item.name, args);
    if (override.handled) {
      result = override.result;
      if (callId) await sendFunctionResult(session, callId, result);
      return;
    }
  }

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

      // ============================================
      // CATALOG TOOLS (Session 250.63)
      // ============================================
      case 'browse_catalog':
        result = await handleBrowseCatalog(session, args);
        break;

      case 'get_item_details':
        result = await handleGetItemDetails(session, args);
        break;

      case 'get_menu':
        result = await handleGetMenu(session, args);
        break;

      case 'check_item_availability':
        result = await handleCheckItemAvailability(session, args);
        break;

      case 'search_catalog':
        result = await handleSearchCatalog(session, args);
        break;

      // SERVICE CATALOG TOOLS (Phase 4.2)
      case 'get_services':
        result = await handleGetServices(session, args);
        break;

      case 'get_available_slots':
        result = await handleGetAvailableSlots(session, args);
        break;

      case 'get_packages':
        result = await handleGetPackages(session, args);
        break;

      // SPECIALIZED CATALOG TOOLS (Phase 4.3)
      case 'get_vehicles':
        result = await handleGetVehicles(session, args);
        break;

      case 'get_trips':
        result = await handleGetTrips(session, args);
        break;

      case 'get_recommendations':
        result = await handleGetRecommendations(session, args);
        break;

      case 'start_product_quiz':
        result = await handleStartProductQuiz(session, args);
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
  // BL24 fix: Pass tenantId so per-tenant Shopify credentials are used
  const tenantId = session.metadata?.tenant_id || 'default';
  return await ECOM_TOOLS.getOrderStatus(email, { tenantId });
}

async function handleCheckProductStock(session, args) {
  // BL24 fix: Pass tenantId so per-tenant Shopify credentials are used
  const tenantId = session.metadata?.tenant_id || 'default';
  return await ECOM_TOOLS.checkProductStock(args.query, { tenantId });
}

// ============================================
// CATALOG TOOL HANDLERS (Session 250.63 - Dynamic Catalog)
// ============================================

// Lazy-load TenantCatalogStore to avoid circular dependency
let _catalogStore = null;
function getCatalogStore() {
  if (!_catalogStore) {
    const { getInstance } = require('../core/tenant-catalog-store.cjs');
    _catalogStore = getInstance();
  }
  return _catalogStore;
}

/**
 * Get currency symbol for a tenant from registry
 */
function getTenantCurrencySymbol(tenantId) {
  const CURRENCY_SYMBOLS = { 'MAD': 'DH', 'EUR': '€', 'USD': '$', 'GBP': '£' };
  try {
    const client = ClientRegistry.getClient(tenantId);
    const cur = client?.currency || 'EUR';
    return CURRENCY_SYMBOLS[cur] || cur;
  } catch {
    return '€';
  }
}

/**
 * Multilingual voice error/fallback messages for telephony handlers
 * B32 fix: Replace FR-hardcoded voiceResponse strings
 */
const VOICE_MSGS = {
  generic_error: { fr: "Une erreur s'est produite.", en: 'An error occurred.', es: 'Se produjo un error.', ar: 'حدث خطأ.', ary: 'وقع مشكل.' },
  catalog_unavail: { fr: "Je n'ai pas accès au catalogue pour le moment.", en: "I can't access the catalog right now.", es: 'No puedo acceder al catálogo ahora.', ar: 'لا أستطيع الوصول للكتالوج حاليا.', ary: 'مقدرتش نوصل للكاتالوغ دابا.' },
  catalog_error: { fr: "Une erreur s'est produite en consultant le catalogue.", en: 'An error occurred while browsing the catalog.', es: 'Error al consultar el catálogo.', ar: 'حدث خطأ أثناء تصفح الكتالوج.', ary: 'وقع مشكل فالكاتالوغ.' },
  item_not_found: { fr: "Je n'ai pas trouvé cet article.", en: "I couldn't find this item.", es: 'No encontré este artículo.', ar: 'لم أجد هذا المنتج.', ary: 'ملقيتش هاد المنتوج.' },
  item_not_in_catalog: { fr: "Je n'ai pas trouvé cet article dans notre catalogue.", en: "I couldn't find this item in our catalog.", es: 'No encontré este artículo en nuestro catálogo.', ar: 'لم أجد هذا المنتج في كتالوجنا.', ary: 'ملقيتش هاد المنتوج فالكاتالوغ ديالنا.' },
  menu_unavail: { fr: "Le menu n'est pas disponible pour le moment.", en: "The menu isn't available right now.", es: 'El menú no está disponible ahora.', ar: 'القائمة غير متاحة حاليا.', ary: 'المينو ماشي متوفر دابا.' },
  menu_error: { fr: "Une erreur s'est produite en consultant le menu.", en: 'An error occurred while viewing the menu.', es: 'Error al consultar el menú.', ar: 'حدث خطأ أثناء عرض القائمة.', ary: 'وقع مشكل فالمينو.' },
  search_failed: { fr: "Je n'ai pas pu effectuer la recherche.", en: "I couldn't complete the search.", es: 'No pude realizar la búsqueda.', ar: 'لم أتمكن من إتمام البحث.', ary: 'مقدرتش ندير البحث.' },
  search_error: { fr: "Une erreur s'est produite lors de la recherche.", en: 'An error occurred during the search.', es: 'Error durante la búsqueda.', ar: 'حدث خطأ أثناء البحث.', ary: 'وقع مشكل فالبحث.' },
  services_unavail: { fr: "Les services ne sont pas disponibles pour le moment.", en: "Services aren't available right now.", es: 'Los servicios no están disponibles ahora.', ar: 'الخدمات غير متاحة حاليا.', ary: 'الخدمات ماشي متوفرين دابا.' },
  slots_unavail: { fr: "Je ne peux pas consulter les créneaux disponibles.", en: "I can't check available time slots.", es: 'No puedo consultar los horarios disponibles.', ar: 'لا أستطيع التحقق من المواعيد المتاحة.', ary: 'مقدرتش نشوف الأوقات اللي فارغين.' },
  plans_unavail: { fr: "Les forfaits ne sont pas disponibles.", en: "Plans aren't available.", es: 'Los planes no están disponibles.', ar: 'الباقات غير متاحة.', ary: 'الفورفيات ماشي متوفرين.' },
  vehicles_unavail: { fr: "Les véhicules ne sont pas disponibles.", en: "Vehicles aren't available.", es: 'Los vehículos no están disponibles.', ar: 'المركبات غير متاحة.', ary: 'الطوموبيلات ماشي متوفرين.' },
  no_vehicles_match: { fr: "Aucun véhicule disponible avec ces critères. Voulez-vous élargir votre recherche?", en: 'No vehicles match these criteria. Would you like to broaden your search?', es: 'No hay vehículos con estos criterios. ¿Quiere ampliar su búsqueda?', ar: 'لا توجد مركبات بهذه المعايير. هل تريد توسيع البحث؟', ary: 'مكاينش طوموبيل بهاد الكريطيرات. بغيتي توسع البحث؟' },
  trips_unavail: { fr: "Les voyages ne sont pas disponibles.", en: "Trips aren't available.", es: 'Los viajes no están disponibles.', ar: 'الرحلات غير متاحة.', ary: 'الفوياجات ماشي متوفرين.' }
};

function getVoiceMsg(session, key) {
  const lang = session?.metadata?.voice_language || 'fr';
  const msgs = VOICE_MSGS[key];
  return msgs ? (msgs[lang] || msgs.fr) : VOICE_MSGS.generic_error.fr;
}

/**
 * Browse catalog by category
 */
async function handleBrowseCatalog(session, args) {
  const tenantId = session.metadata?.tenant_id || 'default';
  console.log(`[Catalog] Browsing catalog for tenant: ${tenantId}`);

  try {
    const store = getCatalogStore();
    const result = await store.browseCatalog(tenantId, {
      category: args.category,
      limit: args.limit || 5,
      inStock: args.in_stock_only
    });

    if (!result.success) {
      return { success: false, error: result.error, voiceResponse: getVoiceMsg(session, 'catalog_unavail') };
    }

    return {
      success: true,
      items: result.items,
      voiceResponse: result.voiceSummary
    };
  } catch (error) {
    console.error(`[Catalog] Browse error:`, error);
    return { success: false, error: error.message, voiceResponse: getVoiceMsg(session, 'catalog_error') };
  }
}

/**
 * Get detailed info for a specific item
 */
async function handleGetItemDetails(session, args) {
  const tenantId = session.metadata?.tenant_id || 'default';
  const itemId = args.item_id;
  const itemName = args.item_name;

  console.log(`[Catalog] Getting item details: ${itemId || itemName} for tenant: ${tenantId}`);

  try {
    const store = getCatalogStore();

    // If only name provided, search first
    let actualItemId = itemId;
    if (!actualItemId && itemName) {
      const searchResult = await store.searchCatalog(tenantId, itemName, { limit: 1 });
      if (searchResult.success && searchResult.results.length > 0) {
        actualItemId = searchResult.results[0].id;
      }
    }

    if (!actualItemId) {
      return { success: false, error: 'item_not_found', voiceResponse: getVoiceMsg(session, 'item_not_found') };
    }

    const result = await store.getItemDetails(tenantId, actualItemId);

    if (!result.success) {
      return { success: false, error: result.error, voiceResponse: getVoiceMsg(session, 'item_not_in_catalog') };
    }

    return {
      success: true,
      item: result.item,
      voiceResponse: result.item.voiceDescription
    };
  } catch (error) {
    console.error(`[Catalog] Item details error:`, error);
    return { success: false, error: error.message, voiceResponse: getVoiceMsg(session, 'generic_error') };
  }
}

/**
 * Get restaurant/bakery menu
 */
async function handleGetMenu(session, args) {
  const tenantId = session.metadata?.tenant_id || 'default';
  console.log(`[Catalog] Getting menu for tenant: ${tenantId}`);

  try {
    const store = getCatalogStore();
    const result = await store.getMenu(tenantId, {
      category: args.category,
      dietary: args.dietary
    });

    if (!result.success) {
      return { success: false, error: result.error, voiceResponse: getVoiceMsg(session, 'menu_unavail') };
    }

    return {
      success: true,
      menu: result.menu,
      voiceResponse: result.voiceSummary
    };
  } catch (error) {
    console.error(`[Catalog] Menu error:`, error);
    return { success: false, error: error.message, voiceResponse: getVoiceMsg(session, 'menu_error') };
  }
}

/**
 * Check item availability (stock, slots, dates)
 */
async function handleCheckItemAvailability(session, args) {
  const tenantId = session.metadata?.tenant_id || 'default';
  const itemId = args.item_id;
  const itemName = args.item_name;

  console.log(`[Catalog] Checking availability: ${itemId || itemName} for tenant: ${tenantId}`);

  try {
    const store = getCatalogStore();

    // If only name provided, search first
    let actualItemId = itemId;
    if (!actualItemId && itemName) {
      const searchResult = await store.searchCatalog(tenantId, itemName, { limit: 1 });
      if (searchResult.success && searchResult.results.length > 0) {
        actualItemId = searchResult.results[0].id;
      }
    }

    if (!actualItemId) {
      return { success: false, error: 'item_not_found', voiceResponse: getVoiceMsg(session, 'item_not_found') };
    }

    const result = await store.checkAvailability(tenantId, actualItemId, {
      date: args.date,
      quantity: args.quantity
    });

    return {
      success: true,
      available: result.available,
      stock: result.stock,
      slots: result.slots,
      voiceResponse: result.voiceResponse
    };
  } catch (error) {
    console.error(`[Catalog] Availability error:`, error);
    return { success: false, error: error.message, voiceResponse: getVoiceMsg(session, 'generic_error') };
  }
}

/**
 * Search catalog by keyword
 */
async function handleSearchCatalog(session, args) {
  const tenantId = session.metadata?.tenant_id || 'default';
  const query = args.query;

  console.log(`[Catalog] Searching "${query}" for tenant: ${tenantId}`);

  try {
    const store = getCatalogStore();
    const result = await store.searchCatalog(tenantId, query, {
      category: args.category,
      maxPrice: args.max_price,
      limit: 5
    });

    if (!result.success) {
      return { success: false, error: result.error, voiceResponse: getVoiceMsg(session, 'search_failed') };
    }

    return {
      success: true,
      results: result.results,
      count: result.count,
      voiceResponse: result.voiceSummary
    };
  } catch (error) {
    console.error(`[Catalog] Search error:`, error);
    return { success: false, error: error.message, voiceResponse: getVoiceMsg(session, 'search_error') };
  }
}

// ============================================
// SERVICE CATALOG HANDLERS (Phase 4.2)
// ============================================

/**
 * Get list of services (garage, spa, medical, etc.)
 */
async function handleGetServices(session, args) {
  const tenantId = session.metadata?.tenant_id || 'default';
  console.log(`[Catalog] Getting services for tenant: ${tenantId}`);

  try {
    const store = getCatalogStore();
    const result = await store.getServices(tenantId, {
      category: args.category,
      date: args.date
    });

    if (!result.success) {
      return { success: false, error: result.error, voiceResponse: getVoiceMsg(session, 'services_unavail') };
    }

    return {
      success: true,
      services: result.services,
      slots: result.slots,
      voiceResponse: result.voiceSummary
    };
  } catch (error) {
    console.error(`[Catalog] Services error:`, error);
    return { success: false, error: error.message, voiceResponse: getVoiceMsg(session, 'generic_error') };
  }
}

/**
 * Get available appointment slots for a service
 * Uses CalendarSlotsConnector for real-time Google Calendar availability,
 * or falls back to static slots from catalog
 *
 * @see core/calendar-slots-connector.cjs
 * @see core/tenant-catalog-store.cjs:getAvailableSlots()
 */
async function handleGetAvailableSlots(session, args) {
  const tenantId = session.metadata?.tenant_id || 'default';
  const date = args.date || new Date().toISOString().split('T')[0];

  console.log(`[Catalog] Getting slots for tenant: ${tenantId}, date: ${date}`);

  try {
    const store = getCatalogStore();

    // If service name provided, search for ID first
    let serviceId = args.service_id;
    if (!serviceId && args.service_name) {
      const searchResult = await store.searchCatalog(tenantId, args.service_name, { limit: 1 });
      if (searchResult.success && searchResult.results.length > 0) {
        serviceId = searchResult.results[0].id;
      }
    }

    // Use the new getAvailableSlots method which integrates CalendarSlotsConnector
    const result = await store.getAvailableSlots(tenantId, {
      date: date,
      serviceId: serviceId,
      calendarConfig: session.metadata?.calendar_config // Optional tenant calendar config
    });

    if (!result.success) {
      return { success: false, error: result.error, voiceResponse: getVoiceMsg(session, 'slots_unavail') };
    }

    const availableSlots = result.slots || [];

    // Use voice summary from store (includes Calendar or static source)
    const voiceResponse = result.voiceSummary || (availableSlots.length === 0
      ? `Aucun créneau disponible pour le ${date}. Voulez-vous essayer une autre date?`
      : `Créneaux disponibles le ${date}: ${availableSlots.slice(0, 3).map(s => s.time).join(', ')}. Quel horaire vous convient?`
    );

    return {
      success: true,
      date: date,
      slots: availableSlots,
      count: result.count || availableSlots.length,
      source: result.source || 'unknown',
      nextAvailable: result.nextAvailable,
      voiceResponse: voiceResponse
    };
  } catch (error) {
    console.error(`[Catalog] Slots error:`, error);
    return { success: false, error: error.message, voiceResponse: getVoiceMsg(session, 'generic_error') };
  }
}

/**
 * Get packages (hotel, events, spa packages)
 */
async function handleGetPackages(session, args) {
  const tenantId = session.metadata?.tenant_id || 'default';
  console.log(`[Catalog] Getting packages for tenant: ${tenantId}`);

  try {
    const store = getCatalogStore();
    const result = await store.browseCatalog(tenantId, {
      category: args.category || 'packages',
      limit: 5
    });

    if (!result.success) {
      return { success: false, error: result.error, voiceResponse: getVoiceMsg(session, 'plans_unavail') };
    }

    // Filter by max price if provided
    let packages = result.items || [];
    if (args.max_price) {
      packages = packages.filter(p => p.price <= args.max_price);
    }

    // Generate voice response
    let voiceResponse;
    if (packages.length === 0) {
      const sym = getTenantCurrencySymbol(tenantId);
      voiceResponse = args.max_price
        ? `Aucun forfait disponible dans votre budget de ${args.max_price} ${sym}.`
        : "Aucun forfait disponible actuellement.";
    } else {
      const names = packages.slice(0, 3).map(p => p.name).join(', ');
      voiceResponse = `Nous proposons: ${names}. Lequel vous intéresse?`;
    }

    return {
      success: true,
      packages: packages,
      count: packages.length,
      voiceResponse: voiceResponse
    };
  } catch (error) {
    console.error(`[Catalog] Packages error:`, error);
    return { success: false, error: error.message, voiceResponse: getVoiceMsg(session, 'generic_error') };
  }
}

// ============================================
// SPECIALIZED CATALOG HANDLERS (Phase 4.3)
// ============================================

/**
 * Get available rental vehicles
 */
async function handleGetVehicles(session, args) {
  const tenantId = session.metadata?.tenant_id || 'default';
  console.log(`[Catalog] Getting vehicles for tenant: ${tenantId}`);

  try {
    const store = getCatalogStore();
    const result = await store.browseCatalog(tenantId, {
      category: args.vehicle_type,
      limit: 5
    });

    if (!result.success) {
      return { success: false, error: result.error, voiceResponse: getVoiceMsg(session, 'vehicles_unavail') };
    }

    let vehicles = result.items || [];

    // Filter by date availability
    if (args.start_date) {
      vehicles = vehicles.filter(v => {
        const availFrom = v.available_from || '1970-01-01';
        const availTo = v.available_to || '2099-12-31';
        return args.start_date >= availFrom && args.start_date <= availTo;
      });
    }

    // Filter by transmission
    if (args.transmission) {
      vehicles = vehicles.filter(v => v.transmission === args.transmission);
    }

    // Generate voice response
    let voiceResponse;
    if (vehicles.length === 0) {
      voiceResponse = getVoiceMsg(session, 'no_vehicles_match');
    } else {
      const sym = getTenantCurrencySymbol(tenantId);
      const vehList = vehicles.slice(0, 3).map(v =>
        `${v.name} à ${v.price || v.price_per_day} ${sym} par jour`
      ).join(', ');
      voiceResponse = `Véhicules disponibles: ${vehList}. Lequel vous intéresse?`;
    }

    return {
      success: true,
      vehicles: vehicles,
      count: vehicles.length,
      voiceResponse: voiceResponse
    };
  } catch (error) {
    console.error(`[Catalog] Vehicles error:`, error);
    return { success: false, error: error.message, voiceResponse: getVoiceMsg(session, 'generic_error') };
  }
}

/**
 * Get available trips and travel packages
 */
async function handleGetTrips(session, args) {
  const tenantId = session.metadata?.tenant_id || 'default';
  console.log(`[Catalog] Getting trips for tenant: ${tenantId}`);

  try {
    const store = getCatalogStore();

    // Search by destination if provided
    let result;
    if (args.destination) {
      result = await store.searchCatalog(tenantId, args.destination, { limit: 5 });
    } else {
      result = await store.browseCatalog(tenantId, {
        category: args.trip_type,
        limit: 5
      });
    }

    if (!result.success) {
      return { success: false, error: result.error, voiceResponse: getVoiceMsg(session, 'trips_unavail') };
    }

    let trips = result.items || result.results || [];

    // Filter by type
    if (args.trip_type) {
      trips = trips.filter(t => t.type === args.trip_type);
    }

    // Filter by budget
    if (args.max_budget) {
      trips = trips.filter(t => (t.price || t.price_from) <= args.max_budget);
    }

    // Generate voice response
    let voiceResponse;
    if (trips.length === 0) {
      voiceResponse = args.destination
        ? `Aucun voyage disponible vers ${args.destination}. Voulez-vous une autre destination?`
        : "Aucun voyage disponible avec ces critères.";
    } else {
      const tripList = trips.slice(0, 3).map(t => {
        const price = t.price || t.price_from;
        const dest = t.destination || t.name;
        const sym = getTenantCurrencySymbol(tenantId);
        return `${dest} à partir de ${price} ${sym}`;
      }).join(', ');
      voiceResponse = `Voyages disponibles: ${tripList}. Lequel vous intéresse?`;
    }

    return {
      success: true,
      trips: trips,
      count: trips.length,
      voiceResponse: voiceResponse
    };
  } catch (error) {
    console.error(`[Catalog] Trips error:`, error);
    return { success: false, error: error.message, voiceResponse: getVoiceMsg(session, 'generic_error') };
  }
}

/**
 * AI Recommendations Handler (Session 250.79)
 * Returns personalized product recommendations via voice
 */
async function handleGetRecommendations(session, args) {
  const tenantId = session.metadata?.tenant_id || 'default';
  const lang = session.metadata?.voice_language || 'fr';
  console.log(`[Recommendations] Getting ${args.recommendation_type} recommendations for tenant: ${tenantId}`);

  try {
    const recommendationService = require('../core/recommendation-service.cjs');

    const context = {
      productId: args.product_id,
      productIds: args.product_ids,
      userId: session.metadata?.user_id,
      ucpProfile: session.metadata?.ucp_profile,
      type: args.recommendation_type || 'similar',
      persona: session.metadata?.persona || 'UNIVERSAL_ECOMMERCE'
    };

    const result = await recommendationService.getVoiceRecommendations(tenantId, context, lang);

    // Format for voice output
    let voiceResponse = result.text;

    // Enrich with product details if we have a catalog store
    if (result.recommendations.length > 0) {
      try {
        const store = getCatalogStore();
        const productNames = [];

        for (const rec of result.recommendations.slice(0, 3)) {
          const itemResult = await store.getItem(tenantId, rec.productId);
          if (itemResult.success && itemResult.item) {
            const item = itemResult.item;
            const name = item.title || item.name;
            const price = item.price;
            const sym = getTenantCurrencySymbol(tenantId);
            productNames.push(price ? `${name} à ${price} ${sym}` : name);
          } else {
            productNames.push(`Produit ${rec.productId}`);
          }
        }

        if (productNames.length > 0) {
          voiceResponse = `${result.text} ${productNames.join(', ')}. Lequel vous intéresse?`;
        }
      } catch (e) {
        console.warn('[Recommendations] Could not enrich with catalog:', e.message);
      }
    }

    return {
      success: true,
      recommendations: result.recommendations,
      count: result.recommendations.length,
      voiceResponse: voiceResponse,
      widgetAction: result.voiceWidget
    };
  } catch (error) {
    console.error(`[Recommendations] Error:`, error);

    // Graceful fallback responses by language
    const fallbacks = {
      fr: "Je n'ai pas de recommandations spécifiques pour le moment. Puis-je vous aider autrement?",
      en: "I don't have specific recommendations right now. Can I help you with something else?",
      es: "No tengo recomendaciones específicas ahora. ¿Puedo ayudarte con algo más?",
      ar: "ليس لدي توصيات محددة حاليًا. هل يمكنني مساعدتك في شيء آخر؟",
      ary: "ما عنديش توصيات دابا. واش نقدر نعاونك فشي حاجة خرا?"
    };

    return {
      success: false,
      error: error.message,
      voiceResponse: fallbacks[lang] || fallbacks.fr
    };
  }
}

/**
 * Voice Product Quiz Handler (Session 250.79)
 * Starts a guided quiz flow to help customer find ideal products
 */
async function handleStartProductQuiz(session, args) {
  const tenantId = session.metadata?.tenant_id || 'default';
  const lang = session.metadata?.voice_language || 'fr';
  const quizType = args.quiz_type || 'generic';

  console.log(`[ProductQuiz] Starting ${quizType} quiz for tenant: ${tenantId}`);

  // Quiz templates with voice-optimized questions
  const quizTemplates = {
    skincare: {
      fr: {
        intro: "Je vais vous aider à trouver votre routine parfaite. Première question: quel est votre type de peau? Sèche, grasse, mixte ou sensible?",
        questions: [
          { id: 'skin_type', text: "Quel est votre type de peau?", options: ['sèche', 'grasse', 'mixte', 'sensible'] },
          { id: 'concern', text: "Quelle est votre préoccupation principale?", options: ['acné', 'anti-âge', 'hydratation', 'éclat'] },
          { id: 'budget', text: "Quel est votre budget?", options: ['moins de 50 euros', 'entre 50 et 100 euros', 'plus de 100 euros'] }
        ]
      },
      en: {
        intro: "I'll help you find your perfect routine. First question: what is your skin type? Dry, oily, combination, or sensitive?",
        questions: [
          { id: 'skin_type', text: "What is your skin type?", options: ['dry', 'oily', 'combination', 'sensitive'] },
          { id: 'concern', text: "What is your main concern?", options: ['acne', 'anti-aging', 'hydration', 'brightening'] },
          { id: 'budget', text: "What is your budget?", options: ['under $50', '$50-100', 'over $100'] }
        ]
      },
      ar: {
        intro: "سأساعدك في العثور على روتينك المثالي. السؤال الأول: ما هو نوع بشرتك؟ جافة، دهنية، مختلطة، أو حساسة؟",
        questions: []
      },
      ary: {
        intro: "غادي نعاونك تلقى الروتين لي يناسبك. سؤال لول: شنو نوع جلدك؟ ناشف، دهني، مخلوط، ولا حساس?",
        questions: []
      }
    },
    electronics: {
      fr: {
        intro: "Je vais vous aider à trouver l'appareil idéal. Pour commencer: quelle sera l'utilisation principale? Travail, gaming, usage quotidien ou création?",
        questions: [
          { id: 'usage', text: "Quelle sera l'utilisation principale?", options: ['travail', 'gaming', 'quotidien', 'création'] },
          { id: 'priority', text: "Quelle est votre priorité?", options: ['performance', 'autonomie', 'portabilité', 'prix'] }
        ]
      },
      en: {
        intro: "I'll help you find the ideal device. To start: what will be the main use? Work, gaming, daily use, or creative work?",
        questions: []
      },
      ar: { intro: "سأساعدك في العثور على الجهاز المثالي. للبدء: ما هو الاستخدام الرئيسي؟", questions: [] },
      ary: { intro: "غادي نعاونك تلقى الجهاز لي يناسبك. باش غادي تخدم بيه بزاف?", questions: [] }
    },
    generic: {
      fr: {
        intro: "Je vais vous poser quelques questions pour trouver le produit idéal. Qu'est-ce que vous recherchez exactement?",
        questions: [
          { id: 'need', text: "Qu'est-ce que vous recherchez?", options: [] },
          { id: 'budget', text: "Quel est votre budget?", options: ['moins de 50 euros', '50 à 150 euros', 'plus de 150 euros'] }
        ]
      },
      en: {
        intro: "I'll ask you a few questions to find the ideal product. What exactly are you looking for?",
        questions: []
      },
      es: {
        intro: "Te haré algunas preguntas para encontrar el producto ideal. ¿Qué estás buscando exactamente?",
        questions: []
      },
      ar: { intro: "سأطرح عليك بعض الأسئلة للعثور على المنتج المثالي. ما الذي تبحث عنه بالضبط؟", questions: [] },
      ary: { intro: "غادي نسولك شي أسئلة باش نلقاو المنتوج لي يناسبك. شنو كتقلب عليه بالضبط?", questions: [] }
    }
  };

  // Get quiz for language (fallback to fr)
  const template = quizTemplates[quizType] || quizTemplates.generic;
  const quiz = template[lang] || template.fr || template.en;

  // Store quiz state in session
  session.quizState = {
    type: quizType,
    currentQuestion: 0,
    answers: {},
    startedAt: Date.now()
  };

  // Return intro and first question
  const voiceResponse = args.first_question || quiz.intro;

  return {
    success: true,
    quiz_type: quizType,
    quiz_state: 'started',
    current_question: quiz.questions?.[0] || null,
    voiceResponse: voiceResponse,
    widgetAction: {
      action: 'show_quiz',
      type: quizType
    }
  };
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

  return {
    success: true,
    score: session.qualification.score,
    label: session.bookingData.qualification_score,
    qualification: session.qualification
  };
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

  return {
    success: true,
    status: 'callback_scheduled',
    callback: session.callback
  };
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

  // G8: Webhook — appointment.booked event
  webhookDispatcher.dispatch(tenantId, 'appointment.booked', {
    sessionId: session.id, name: session.bookingData?.name,
    phone: session.bookingData?.phone, date: session.bookingData?.date,
    score: session.bookingData?.qualification_score,
    tenantId, timestamp: new Date().toISOString()
  });

  return {
    success: true,
    status: 'booking_created',
    booking: session.bookingData
  };
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

  return {
    success: true,
    status: 'event_tracked',
    event: args.event,
    stage: args.stage
  };
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

// =============================================================================
// QUERY TRANSLATION (tRAG) - Session 250.16
// Translates non-FR/EN queries to French for BM25 lexical matching
// Research: https://aclanthology.org/2025.findings-acl.295.pdf
// =============================================================================

/**
 * Detect if query contains non-Latin script (Arabic, etc.) or Spanish
 * @param {string} query - The search query
 * @returns {string} Detected language code or 'fr' if Latin
 */
function detectQueryLanguage(query) {
  // Arabic script detection (covers AR + ARY Darija)
  const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
  if (arabicPattern.test(query)) {
    return 'ar'; // Arabic or Darija
  }

  // Spanish detection: special chars + common Spanish words not shared with French
  // Words like "el/la/de/en" exist in both, so we use Spanish-specific terms
  const spanishChars = /[ñÑ¿¡]/;
  const spanishWords = /\b(pedido|entrega|envío|precio|quiero|dónde|cuándo|cuánto|tengo|necesito|ayuda|gracias|hola|buenos|buenas|cómo|está|están|muy|también|ahora|siempre|nunca|todo|nada|algo)\b/i;

  if (spanishChars.test(query) || spanishWords.test(query)) {
    return 'es';
  }

  // Default: assume French or English (both work with BM25)
  return 'fr';
}

/**
 * Translate query to French using Grok API (lightweight, fast model)
 * @param {string} query - Original query in any language
 * @param {string} sourceLang - Detected source language
 * @returns {Promise<string>} Translated query in French
 */
async function translateQueryToFrench(query, sourceLang) {
  if (!CONFIG.grok.apiKey) {
    console.warn('[tRAG] No Grok API key, skipping translation');
    return query;
  }

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.grok.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'grok-3-mini', // Fast, cheap model for translation
        messages: [{
          role: 'user',
          content: `Translate this search query to French. Return ONLY the French translation, nothing else.\n\nQuery: ${query}`
        }],
        max_tokens: 100,
        temperature: 0.1 // Low temperature for consistent translation
      })
    });

    if (!response.ok) {
      console.error(`[tRAG] Translation API error: ${response.status}`);
      return query;
    }

    const data = await response.json();
    const translated = data.choices?.[0]?.message?.content?.trim();

    if (translated && translated.length > 0) {
      console.log(`[tRAG] Translated "${query}" → "${translated}"`);
      return translated.toLowerCase();
    }

    return query;
  } catch (error) {
    console.error(`[tRAG] Translation error: ${error.message}`);
    return query;
  }
}

async function handleSearchKnowledgeBase(session, args) {
  const kbId = session.metadata?.knowledge_base_id || session.metadata?.persona_id || 'unknown';
  const sessionLang = session.metadata?.language || CONFIG.defaultLanguage;
  const tenantId = session.metadata?.tenant_id || 'default';  // Session 250.45: Per-tenant KB
  let query = args.query.toLowerCase();
  const originalQuery = query;

  console.log(`[Cognitive-RAG] Semantic search for ${kbId}: "${query}" (lang: ${sessionLang}, tenant: ${tenantId})`);

  // SESSION 250.16: Query Translation (tRAG) for cross-lingual retrieval
  // BM25 only matches FR/EN terms - translate AR/ES/ARY queries to French
  const detectedLang = detectQueryLanguage(query);
  if (detectedLang !== 'fr' && detectedLang !== 'en') {
    console.log(`[tRAG] Non-FR/EN query detected (${detectedLang}), translating...`);
    query = await translateQueryToFrench(query, detectedLang);
  }

  // 1. Semantic Search using TF-IDF Index (v3.0)
  try {
    const results = KB.search(query, 3);
    if (results && results.length > 0) {
      const bestMatch = KB.formatForVoice(results, sessionLang);
      console.log(`[Cognitive-RAG] Found semantic matches: ${results.length}${originalQuery !== query ? ` (translated: "${query}")` : ''}`);
      return { found: true, result: bestMatch };
    }
  } catch (e) {
    console.error(`[Cognitive-RAG] Semantic search error: ${e.message}`);
  }

  // 2. Session 250.45: Per-Tenant KB Search (with merge)
  console.log(`[Cognitive-RAG] Searching tenant KB: ${tenantId}/${sessionLang}...`);
  try {
    const tenantKb = await TenantKB.getKB(tenantId, sessionLang);

    // Search in tenant KB (includes merged client + universal)
    for (const [key, value] of Object.entries(tenantKb)) {
      if (key === '__meta') continue;

      // Check if this is the requested persona
      if (key === kbId && typeof value === 'object') {
        // Search within persona
        for (const [subKey, subValue] of Object.entries(value)) {
          const searchText = typeof subValue === 'string' ? subValue.toLowerCase() : JSON.stringify(subValue).toLowerCase();
          if (subKey.toLowerCase().includes(query) || searchText.includes(query)) {
            const result = typeof subValue === 'object' && subValue.response ? subValue.response : subValue;
            console.log(`[Cognitive-RAG] Tenant KB match: ${tenantId}/${kbId}/${subKey}`);
            return { found: true, result: typeof result === 'string' ? result : JSON.stringify(result) };
          }
        }
      }

      // Search across all entries (for client-specific keys like business_info, promotions)
      const searchText = typeof value === 'object' ? JSON.stringify(value).toLowerCase() : String(value).toLowerCase();
      if (key.toLowerCase().includes(query) || searchText.includes(query)) {
        const result = typeof value === 'object' && value.response ? value.response : value;
        console.log(`[Cognitive-RAG] Tenant KB match: ${tenantId}/${key}`);
        return { found: true, result: typeof result === 'string' ? result : JSON.stringify(result) };
      }
    }
  } catch (e) {
    console.error(`[Cognitive-RAG] Tenant KB error: ${e.message}`);
  }

  // 3. Legacy Fallback (static KNOWLEDGE_BASES)
  console.log(`[Cognitive-RAG] Falling back to legacy KB...`);
  const langKb = KNOWLEDGE_BASES[sessionLang] || KNOWLEDGE_BASES['fr'];
  let kbData = langKb[kbId];

  if (!kbData && sessionLang !== 'fr') {
    kbData = KNOWLEDGE_BASES['fr'][kbId];
  }

  if (!kbData) {
    return { found: false, result: RAG_MESSAGES.noKnowledgeBase[sessionLang] };
  }

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
      message_to_customer: {
        fr: 'Je comprends votre situation et je note votre demande. Un responsable va examiner votre dossier et vous recontacter très rapidement pour vous confirmer la solution.',
        en: 'I understand your situation and I\'m noting your request. A manager will review your case and get back to you very quickly to confirm the resolution.',
        es: 'Entiendo su situación y tomo nota de su solicitud. Un responsable revisará su caso y le contactará muy pronto para confirmarle la solución.',
        ar: 'أفهم وضعك وسأسجل طلبك. سيقوم مسؤول بمراجعة ملفك والتواصل معك قريبا لتأكيد الحل.',
        ary: 'فاهم الوضعية ديالك وكنسجل الطلب ديالك. شي مسؤول غادي يشوف الملف ديالك ويتواصل معاك بسرعة.'
      }[session?.metadata?.voice_language || 'fr'] || 'Je comprends votre situation et je note votre demande. Un responsable va examiner votre dossier et vous recontacter très rapidement pour vous confirmer la solution.',
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

  const lang = session.metadata?.voice_language || 'fr';
  const smsTexts = {
    fr: `Bonjour ! Voici le lien pour réserver votre appel découverte avec VocalIA: ${bookingLink}\n\nÀ très vite !`,
    en: `Hello! Here's the link to book your discovery call with VocalIA: ${bookingLink}\n\nSee you soon!`,
    es: `¡Hola! Aquí tienes el enlace para reservar tu llamada de descubrimiento con VocalIA: ${bookingLink}\n\n¡Hasta pronto!`,
    ar: `مرحبا! إليك رابط حجز مكالمتك الاستكشافية مع VocalIA: ${bookingLink}\n\nإلى اللقاء!`,
    ary: `سلام! هاهو اللينك باش تحجز المكالمة مع VocalIA: ${bookingLink}\n\nنتلاقاو!`
  };
  const body = smsTexts[lang] || smsTexts.fr;
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

  const lang = session.metadata?.voice_language || 'fr';
  const paymentMsgs = {
    fr: { bank: `Voici les coordonnées pour le règlement de ${amount}${currency} (${description}):\n\n${details}\n\nMerci de nous envoyer une preuve de virement.`, link: `Voici votre lien de paiement de ${amount}${currency} (${description}): ${details}`, other: `Pour le règlement de ${amount}${currency} (${description}), les modalités sont: ${details}` },
    en: { bank: `Here are the details for payment of ${amount}${currency} (${description}):\n\n${details}\n\nPlease send us proof of transfer.`, link: `Here's your payment link for ${amount}${currency} (${description}): ${details}`, other: `For payment of ${amount}${currency} (${description}), the details are: ${details}` },
    es: { bank: `Aquí están los datos para el pago de ${amount}${currency} (${description}):\n\n${details}\n\nPor favor envíenos comprobante de transferencia.`, link: `Aquí está su enlace de pago de ${amount}${currency} (${description}): ${details}`, other: `Para el pago de ${amount}${currency} (${description}), los detalles son: ${details}` },
    ar: { bank: `إليك تفاصيل الدفع ${amount}${currency} (${description}):\n\n${details}\n\nيرجى إرسال إثبات التحويل.`, link: `إليك رابط الدفع ${amount}${currency} (${description}): ${details}`, other: `لدفع ${amount}${currency} (${description})، التفاصيل: ${details}` },
    ary: { bank: `هاهي التفاصيل ديال الخلاص ${amount}${currency} (${description}):\n\n${details}\n\nعافاك صيفطلنا إثبات الفيرمون.`, link: `هاهو اللينك ديال الخلاص ${amount}${currency} (${description}): ${details}`, other: `باش تخلص ${amount}${currency} (${description})، التفاصيل: ${details}` }
  };
  const pm = paymentMsgs[lang] || paymentMsgs.fr;
  let message = "";
  if (method === 'BANK_TRANSFER') {
    message = pm.bank;
  } else if (method === 'LINK') {
    message = pm.link;
  } else {
    message = pm.other;
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
      const sentMsgs = { fr: `Les détails ont été envoyés via ${result.channel}.`, en: `Details sent via ${result.channel}.`, es: `Detalles enviados por ${result.channel}.`, ar: `تم إرسال التفاصيل عبر ${result.channel}.`, ary: `تصيفطو التفاصيل عبر ${result.channel}.` };
      return { success: true, message: sentMsgs[lang] || sentMsgs.fr, channel: result.channel };
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
// SESSION 250.82: CART RECOVERY VOICE CALLBACK
// Unique VocalIA feature: +25% recovery vs SMS/email
// ============================================

/**
 * Queue a voice callback for abandoned cart recovery
 * @param {Object} options - Recovery options
 * @param {string} options.phone - Customer phone number
 * @param {string} options.tenantId - Tenant ID
 * @param {Object} options.cart - Cart data (items, total)
 * @param {number} options.discount - Discount percentage
 * @param {string} options.language - Language code (fr, en, es, ar, ary)
 * @param {string} options.recoveryUrl - Checkout URL with discount
 * @returns {Promise<{success: boolean, callbackId: string}>}
 */
async function queueCartRecoveryCallback(options) {
  const { phone, tenantId, cart, discount, language, recoveryUrl } = options;

  // Validate phone
  const phoneClean = phone?.startsWith('+') ? phone : `+${(phone || '').replace(/\D/g, '')}`;
  if (!phoneClean || phoneClean.length < 10) {
    console.error('[CartRecovery] Invalid phone number:', phone);
    return { success: false, error: 'invalid_phone' };
  }

  // Generate callback ID
  const callbackId = `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Cart recovery messages by language
  const sym = getTenantCurrencySymbol(tenantId);
  const messages = {
    fr: {
      greeting: `Bonjour ! C'est l'assistant VocalIA. Vous avez laissé des articles dans votre panier d'une valeur de ${cart?.total || 0} ${sym}.`,
      offer: `J'ai une offre exclusive pour vous : ${discount}% de réduction si vous finalisez votre commande maintenant.`,
      action: `Voulez-vous que je vous envoie le lien par SMS pour finaliser votre achat ?`,
      confirm: `Parfait ! Je vous envoie le lien tout de suite. À très bientôt !`
    },
    en: {
      greeting: `Hello! This is the VocalIA assistant. You left items in your cart worth ${cart?.total || 0}.`,
      offer: `I have an exclusive offer for you: ${discount}% off if you complete your order now.`,
      action: `Would you like me to send you a link via SMS to complete your purchase?`,
      confirm: `Perfect! I'm sending you the link right away. See you soon!`
    },
    es: {
      greeting: `Hola! Soy el asistente de VocalIA. Dejaste artículos en tu carrito por valor de ${cart?.total || 0}.`,
      offer: `Tengo una oferta exclusiva para ti: ${discount}% de descuento si completas tu pedido ahora.`,
      action: `¿Te gustaría que te enviara un enlace por SMS para completar tu compra?`,
      confirm: `¡Perfecto! Te envío el enlace ahora mismo. ¡Hasta pronto!`
    },
    ar: {
      greeting: `مرحبا! أنا مساعد VocalIA. تركت منتجات في سلتك بقيمة ${cart?.total || 0}.`,
      offer: `لدي عرض حصري لك: خصم ${discount}% إذا أتممت طلبك الآن.`,
      action: `هل تريد أن أرسل لك الرابط عبر SMS لإتمام عملية الشراء؟`,
      confirm: `ممتاز! سأرسل لك الرابط الآن. إلى اللقاء!`
    },
    ary: {
      greeting: `سلام! أنا المساعد ديال VocalIA. خليتي منتوجات فالباني ديالك بـ ${cart?.total || 0} درهم.`,
      offer: `عندي عرض خاص ليك: ${discount}% تخفيض إلا كملتي الطلب دابا.`,
      action: `بغيتي نصيفط ليك اللينك عبر SMS باش تكمل الشرا؟`,
      confirm: `مزيان! غادي نصيفط ليك اللينك دابا. نتلاقاو!`
    }
  };

  const lang = language || 'fr';
  const msg = messages[lang] || messages.fr;

  // Store callback request for processing (BL10 fix: bounded array)
  if (!global.cartRecoveryCallbacks) {
    global.cartRecoveryCallbacks = [];
  }
  // Evict oldest entries if over limit
  const MAX_RECOVERY_CALLBACKS = 200;
  if (global.cartRecoveryCallbacks.length >= MAX_RECOVERY_CALLBACKS) {
    global.cartRecoveryCallbacks = global.cartRecoveryCallbacks.slice(-Math.floor(MAX_RECOVERY_CALLBACKS / 2));
  }

  const callbackRequest = {
    id: callbackId,
    phone: phoneClean,
    tenantId,
    cart,
    discount,
    language: lang,
    recoveryUrl,
    messages: msg,
    status: 'queued',
    created_at: new Date().toISOString(),
    scheduled_at: new Date(Date.now() + 60000).toISOString() // Schedule 1 min delay
  };

  global.cartRecoveryCallbacks.push(callbackRequest);

  console.log(`[CartRecovery] Callback queued: ${callbackId} for ${phoneClean}`);

  // If Twilio credentials are available, initiate outbound call
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
    try {
      const twilio = require('twilio');
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

      // Generate TwiML for voice callback
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="${lang === 'ary' ? 'ar-MA' : lang === 'ar' ? 'ar-SA' : lang === 'es' ? 'es-ES' : lang === 'en' ? 'en-US' : 'fr-FR'}">${msg.greeting}</Say>
  <Pause length="1"/>
  <Say language="${lang === 'ary' ? 'ar-MA' : lang === 'ar' ? 'ar-SA' : lang === 'es' ? 'es-ES' : lang === 'en' ? 'en-US' : 'fr-FR'}">${msg.offer}</Say>
  <Pause length="1"/>
  <Say language="${lang === 'ary' ? 'ar-MA' : lang === 'ar' ? 'ar-SA' : lang === 'es' ? 'es-ES' : lang === 'en' ? 'en-US' : 'fr-FR'}">${msg.action}</Say>
  <Gather numDigits="1" action="https://api.vocalia.ma/twilio/cart-recovery-response?callbackId=${callbackId}" method="POST">
    <Say language="${lang === 'ary' ? 'ar-MA' : lang === 'ar' ? 'ar-SA' : lang === 'es' ? 'es-ES' : lang === 'en' ? 'en-US' : 'fr-FR'}">${{ fr: 'Appuyez 1 pour oui, 2 pour non.', en: 'Press 1 for yes, 2 for no.', es: 'Presione 1 para sí, 2 para no.', ar: 'اضغط 1 للموافقة، 2 للرفض.', ary: 'عيّط على 1 إلا بغيتي، 2 إلا لا.' }[lang] || 'Appuyez 1 pour oui, 2 pour non.'}</Say>
  </Gather>
</Response>`;

      // Schedule call (1 minute delay)
      setTimeout(async () => {
        try {
          const call = await client.calls.create({
            twiml,
            to: phoneClean,
            from: process.env.TWILIO_PHONE_NUMBER,
            statusCallback: `https://api.vocalia.ma/twilio/callback-status?callbackId=${callbackId}`,
            statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
          });

          callbackRequest.callSid = call.sid;
          callbackRequest.status = 'calling';
          console.log(`[CartRecovery] Call initiated: ${call.sid}`);
        } catch (callError) {
          console.error(`[CartRecovery] Call failed: ${callError.message}`);
          callbackRequest.status = 'failed';
          callbackRequest.error = callError.message;

          // Fallback to SMS
          await sendMessage(phoneClean, `${msg.greeting} ${msg.offer} Lien: ${recoveryUrl}`);
          callbackRequest.fallback = 'sms';
        }
      }, 60000);

      return { success: true, callbackId, method: 'twilio_voice', scheduled: true };

    } catch (twilioError) {
      console.error(`[CartRecovery] Twilio init error: ${twilioError.message}`);
      // Continue with queue-only mode
    }
  }

  // No Twilio credentials - queue for manual processing or SMS fallback
  console.log('[CartRecovery] No Twilio credentials, using SMS fallback');

  // Send SMS immediately as fallback
  const smsResult = await sendMessage(phoneClean, `${msg.greeting} ${msg.offer} Lien: ${recoveryUrl}`);

  callbackRequest.status = smsResult.success ? 'sms_sent' : 'queued';
  callbackRequest.fallback = 'sms';

  return {
    success: true,
    callbackId,
    method: smsResult.success ? 'sms_fallback' : 'queued',
    smsResult
  };
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
function generateTwiML(streamUrl, lang = CONFIG.defaultLanguage, { recording = false, callbackUrl = '' } = {}) {
  const twimlLang = getTwiMLLanguage(lang);
  const consentMsg = getTwiMLMessage('recordingConsent', lang);

  // G9: Recording consent + Twilio call recording (Step 4.3 — Session 250.240)
  let recordingXml = '';
  if (recording) {
    recordingXml = `\n  <Say voice="alice" language="${twimlLang}">${consentMsg}</Say>`;
    // Twilio <Record> with dual-channel: records both legs of the call
    // recordingStatusCallback receives the recording URL when complete
    const cbUrl = callbackUrl || '';
    const cbAttr = cbUrl ? ` recordingStatusCallback="${cbUrl}" recordingStatusCallbackMethod="POST"` : '';
    recordingXml += `\n  <Record recordingChannels="dual" trim="trim-silence" maxLength="3600"${cbAttr} transcribe="false" playBeep="false"/>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>${recordingXml}
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
  if (!await validateTwilioSignature(req, body)) {
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

  // Session 250.57: Check quota before creating session
  // Determine tenant from phone number mapping (To number → tenant)
  const tenantId = body.clientId || body.tenant_id || 'default';
  const { getDB } = require('../core/GoogleSheetsDB.cjs');
  const db = getDB();
  const quotaCheck = db.checkQuota(tenantId, 'calls');
  if (!quotaCheck.allowed) {
    console.warn(`[Twilio] Quota exceeded for tenant ${tenantId}: ${quotaCheck.current}/${quotaCheck.limit}`);
    const errorTwiml = generateErrorTwiML('serviceUnavailable', CONFIG.defaultLanguage, true);
    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(errorTwiml);
    return;
  }

  try {
    const session = await createGrokSession(callInfo);

    // Session 250.57: Increment call usage
    db.incrementUsage(tenantId, 'calls');

    // Get language from session metadata (injected by VoicePersonaInjector)
    const sessionLang = session.metadata?.language || CONFIG.defaultLanguage;
    console.log(`[Twilio] Session language: ${sessionLang}`);

    // Generate stream URL
    const host = req.headers.host || `localhost:${CONFIG.port}`;
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const streamUrl = `wss://${host}/stream/${session.id}`;

    // G9: Check if tenant has recording enabled
    // Sanitize tenantId to prevent path traversal
    const safeTenantId = (tenantId || '').replace(/[^a-zA-Z0-9_-]/g, '') || 'default';
    const tenantConfigPath = path.join(__dirname, '..', 'clients', safeTenantId, 'config.json');
    let recordingEnabled = false;
    try {
      if (fs.existsSync(tenantConfigPath)) {
        const tConfig = JSON.parse(fs.readFileSync(tenantConfigPath, 'utf8'));
        recordingEnabled = tConfig.features?.call_recording === true;
      }
    } catch (_e) { /* default to false */ }

    // Step 4.3: Build recording callback URL for storing recording metadata
    const recordingCallbackUrl = recordingEnabled
      ? `https://${host}/recording-status?tenantId=${safeTenantId}&sessionId=${session.id}`
      : '';

    // Respond with TwiML (multilingual - Session 166sexies)
    const twiml = generateTwiML(streamUrl, sessionLang, { recording: recordingEnabled, callbackUrl: recordingCallbackUrl });

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

        // G8: Webhook — call.started event
        webhookDispatcher.dispatch(tenantId, 'call.started', {
          callSid: session.callSid, phone: session.bookingData?.phone,
          tenantId, timestamp: new Date().toISOString()
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

  // Session 250.188: UCP auto-enrichment for telephony calls
  try {
    const ucpStore = getUCPStore();
    const callTenantId = session.metadata?.tenant_id || 'default';
    const ucpCallerId = session.bookingData.phone || session.callSid || sessionId;
    const profileData = {
      last_channel: 'telephony',
      last_language: session.metadata?.language || CONFIG.defaultLanguage,
      last_persona: session.metadata?.persona_id
    };
    if (session.bookingData.name) profileData.name = session.bookingData.name;
    if (session.bookingData.email) profileData.email = session.bookingData.email;
    if (session.bookingData.phone) profileData.phone = session.bookingData.phone;
    ucpStore.upsertProfile(callTenantId, ucpCallerId, profileData);
    ucpStore.recordInteraction(callTenantId, ucpCallerId, {
      type: 'voice_call',
      channel: 'telephony',
      duration_sec: callDuration,
      outcome: session.analytics.outcome || 'completed',
      sessionId,
      qualification_score: session.qualification.score
    });
  } catch (ucpErr) {
    console.warn('[UCP] Telephony enrichment warning:', ucpErr.message);
  }

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
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

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

    // Step 4.3: Twilio recording status callback (Session 250.240)
    if (pathname === '/recording-status' && req.method === 'POST') {
      const body = await parseBody(req);
      const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
      const tenantId = (parsedUrl.searchParams.get('tenantId') || '').replace(/[^a-zA-Z0-9_-]/g, '');
      const sessionId = (parsedUrl.searchParams.get('sessionId') || '').replace(/[^a-zA-Z0-9_-]/g, '');

      if (body.RecordingUrl && tenantId && sessionId) {
        console.log(`[Recording] ${body.RecordingStatus}: ${body.RecordingUrl} (${body.RecordingDuration}s) for ${tenantId}/${sessionId}`);

        // Save recording metadata to conversation file
        try {
          const convPath = path.join(__dirname, '..', 'clients', tenantId, 'conversations', `${sessionId}.json`);
          if (fs.existsSync(convPath)) {
            const conv = JSON.parse(fs.readFileSync(convPath, 'utf8'));
            conv.recording = {
              url: body.RecordingUrl,
              sid: body.RecordingSid,
              duration: parseInt(body.RecordingDuration || '0', 10),
              status: body.RecordingStatus,
              timestamp: new Date().toISOString()
            };
            fs.writeFileSync(convPath, JSON.stringify(conv, null, 2));
          }
        } catch (e) {
          console.error(`[Recording] Failed to save metadata: ${e.message}`);
        }
      }
      res.writeHead(200);
      res.end();
      return;
    }

    // Outbound call trigger (Agentic Action)
    // BL12 fix: Require internal auth for billable endpoint
    if (pathname === '/voice/outbound' && req.method === 'POST') {
      if (!checkInternalAuth(req, res)) return;
      const body = await parseBody(req);
      await handleOutboundTrigger(req, res, body);
      return;
    }

    // Outbound TwiML handler
    // BL13 fix: Validate Twilio signature (this is a Twilio callback, like /voice/inbound)
    if (pathname === '/voice/outbound-twiml' && req.method === 'POST') {
      const body = await parseBody(req);
      if (!await validateTwilioSignature(req, body)) {
        console.error('[Security] Rejected outbound-twiml with invalid Twilio signature');
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden: Invalid signature');
        return;
      }
      await handleOutboundTwiML(req, res, body);
      return;
    }

    // Messaging endpoint (Session 249.18: WhatsApp + Twilio SMS fallback)
    // BL14 fix: Require internal auth for billable endpoint
    if (pathname === '/messaging/send' && req.method === 'POST') {
      if (!checkInternalAuth(req, res)) return;
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
        res.end(JSON.stringify(result));
      } catch (error) {
        console.error(`[Messaging] Error: ${error.message}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }

    // ========================================================================
    // SOTA PATTERN #2: WHATSAPP BIDIRECTIONAL WEBHOOK
    // ========================================================================

    // 1. Verification Endpoint (Meta Challenge)
    if (pathname === '/whatsapp/webhook' && req.method === 'GET') {
      const query = url.searchParams;
      const mode = query.get('hub.mode');
      const token = query.get('hub.verify_token');
      const challenge = query.get('hub.challenge');

      if (mode && token) {
        if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
          console.log('[WhatsApp] Webhook verified successfully');
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end(challenge);
        } else {
          console.warn('[WhatsApp] Webhook verification failed (token mismatch)');
          res.writeHead(403);
          res.end();
        }
      } else {
        res.writeHead(400);
        res.end();
      }
      return;
    }

    // 2. Inbound Message Handler
    if (pathname === '/whatsapp/webhook' && req.method === 'POST') {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', async () => {
        const rawBody = Buffer.concat(chunks);
        const bodyStr = rawBody.toString();

        // Security: Validate Signature
        if (!validateWhatsAppSignature(req, rawBody)) {
          res.writeHead(403);
          res.end();
          return;
        }

        // ACK immediately (Meta requirement)
        res.writeHead(200);
        res.end();

        try {
          const body = JSON.parse(bodyStr);
          await handleInboundWhatsApp(body);
        } catch (err) {
          console.error('[WhatsApp] Processing error:', err.message);
        }
      });
      return;
    }


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

// ============================================
// WHATSAPP INBOUND LOGIC (SOTA Pattern #2)
// ============================================
async function handleInboundWhatsApp(body) {
  // Check if this is a message
  const entry = body.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  if (!value || !value.messages || !value.messages[0]) {
    // WhatsApp Status Tracking (sent/delivered/read/failed)
    if (value?.statuses?.[0]) {
      const status = value.statuses[0];
      const AgencyEventBus = require('../core/AgencyEventBus.cjs');
      AgencyEventBus.publish('whatsapp.status_update', {
        messageId: status.id,
        recipientPhone: status.recipient_id,
        status: status.status, // sent, delivered, read, failed
        timestamp: status.timestamp ? new Date(parseInt(status.timestamp) * 1000).toISOString() : new Date().toISOString(),
        errors: status.errors || null
      });
      if (status.status === 'failed') {
        console.error(`[WhatsApp] Message ${status.id} FAILED to ${status.recipient_id}:`, status.errors?.[0]?.title);
      }
    }
    return;
  }

  const message = value.messages[0];
  const contact = value.contacts?.[0];
  const senderPhone = message.from; // e.g. "212600000000"
  const senderName = contact?.profile?.name || 'Unknown';

  // 1. Idempotency Check (Session 250.219)
  const messageId = message.id;
  if (whatsappMessageCache.has(messageId)) {
    console.log(`[WhatsApp] Skipping duplicate message: ${messageId}`);
    return;
  }
  whatsappMessageCache.set(messageId, Date.now() + 3600000); // 1h cache

  console.log(`[WhatsApp] Inbound from ${senderName} (${senderPhone}): ${message.type}`);

  // SOTA Session 250.221: Dynamic Tenant Mapping
  // Logic: Map WhatsApp Number ID or first digits to Tenant Registry
  const tenantId = await deriveTenantFromWhatsApp(value.metadata?.phone_number_id, senderPhone);
  let userText = '';

  // 2. Handle Message Types (SOTA "Voice First" approach)
  if (message.type === 'text') {
    userText = message.text.body;
  } else if (message.type === 'audio') {
    console.log(`[WhatsApp] Audio message received (id: ${message.audio.id}). Transcribing...`);
    try {
      const audioBuffer = await downloadMetaMedia(message.audio.id);
      userText = await llmGateway.transcribeAudio(audioBuffer, message.audio.mime_type || 'audio/ogg');
      console.log(`[WhatsApp] Transcription: "${userText}"`);
    } catch (e) {
      console.error(`[WhatsApp] STT Failed: ${e.message}`);
      await sendWhatsAppMessage(senderPhone, "Désolé, je n'ai pas pu écouter votre message vocal. Pouvez-vous répéter par écrit ?");
      return;
    }
  } else {
    console.log(`[WhatsApp] Unsupported message type: ${message.type}`);
    return;
  }

  if (!userText) return;

  try {
    // 3. Route to Voice API LLM
    const voiceApiUrl = process.env.VOCALIA_API_URL || 'http://localhost:3004';
    const payload = {
      message: userText,
      sessionId: `wa_${senderPhone}`,
      language: 'fr',
      metadata: {
        tenant_id: tenantId,
        channel: 'whatsapp',
        sender_phone: senderPhone,
        sender_name: senderName
      }
    };

    const response = await fetch(`${voiceApiUrl}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Voice API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.response;

    // 4. Send Reply
    if (aiResponse) {
      await sendWhatsAppMessage(senderPhone, aiResponse);
    }

    // 5. Analytics (MarketingScience)
    MarketingScience.trackV2('whatsapp_inbound', {
      tenant_id: tenantId,
      sender: senderPhone,
      message_type: message.type,
      length: userText.length,
      status: 'responded'
    });

  } catch (err) {
    console.error(`[WhatsApp] Error in inbound flow: ${err.message}`);
  }
}

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

  process.on('uncaughtException', (err) => {
    console.error('❌ [Telephony] Uncaught exception:', err.message);
    console.error(err.stack);
    shutdown();
  });

  process.on('unhandledRejection', (reason) => {
    console.error('❌ [Telephony] Unhandled rejection:', reason);
  });
}

// Only start server when run directly (not when require()'d)
if (require.main === module) {
  main().catch(console.error);
}

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
    // Messaging (Session 250.18)
    sendMessage,
    sendTwilioSMS,
    sendWhatsAppMessage,
    // Cart Recovery (Session 250.82)
    queueCartRecoveryCallback,
    // HITL
    listPendingActions,
    approveAction,
    rejectAction,
    HITL_CONFIG,
    // Pure logic utilities (exported for testing)
    getGrokVoiceFromPreferences,
    getTwiMLLanguage,
    getTwiMLMessage,
    detectFinancialCommitment,
    getMatchedFinancialKeywords,
    calculateBANTScore,
    getQualificationLabel,
    detectQueryLanguage,
    safeJsonParse,
    generateSessionId,
    checkRateLimit,
    CONFIG
  };
}

// SOTA Pattern #1: Event-Driven Messaging (Session 250.219)
// Enables Lead Follow-up skills to send messages without coupling to the bridge.
AgencyEventBus.subscribe('messaging.send_whatsapp', async (payload) => {
  console.log(`[EventBus] Received messaging.send_whatsapp for ${payload.phone}`);
  if (!payload.phone || !payload.text) {
    console.error('[EventBus] Invalid payload for messaging.send_whatsapp');
    return;
  }
  try {
    await sendWhatsAppMessage(payload.phone, payload.text);
  } catch (e) {
    console.error(`[EventBus] Failed to send WhatsApp from event: ${e.message}`);
  }
});
