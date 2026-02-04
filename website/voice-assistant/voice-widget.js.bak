/**
 * VocalIA - Voice Assistant Widget Core
 * Version: 2.0.0
 *
 * Unified widget that loads language-specific translations
 * Supports: FR, EN, ES, AR, Darija (ary)
 * Features: Auto-detection of speaker language (limited to 5 supported languages)
 */

(function () {
  'use strict';

  // ============================================================
  // CONFIGURATION
  // ============================================================

  const CONFIG = {
    // Supported languages - FR/EN Focus
    SUPPORTED_LANGS: ['fr', 'en'],
    DEFAULT_LANG: 'fr',

    // Paths
    LANG_PATH: '/voice-assistant/lang/voice-{lang}.json',
    // Security: API Config
    BOOKING_API: window.VOCALIA_BOOKING_API || 'https://api.vocalia.ma/v1/booking',
    VOICE_API: window.VOCALIA_VOICE_API || (
      ['localhost', '127.0.0.1'].includes(window.location.hostname)
        ? 'http://localhost:3004/respond'
        : 'https://api.vocalia.ma/respond'
    ),
    A2UI_API: window.VOCALIA_A2UI_API || 'https://api.vocalia.ma/v1/a2ui',

    // Branding
    primaryColor: '#4FBAF1',
    primaryDark: '#2B6685',
    accentColor: '#10B981',
    darkBg: '#191E35',

    // Cache
    SLOT_CACHE_TTL: 5 * 60 * 1000, // 5 minutes

    // Auto-detection
    AUTO_DETECT_ENABLED: true,
    AUTO_DETECT_LANGUAGES: {
      'fr-FR': 'fr', 'fr': 'fr',
      'en-US': 'en', 'en-GB': 'en', 'en': 'en',
      'es-ES': 'es', 'es-MX': 'es', 'es': 'es',
      'ar-SA': 'ar', 'ar-MA': 'ar', 'ar': 'ar',
      'ary': 'ary' // Darija (Moroccan Arabic)
    }
  };

  // ============================================================
  // STATE
  // ============================================================

  let state = {
    isOpen: false,
    isListening: false,
    recognition: null,
    synthesis: window.speechSynthesis,
    conversationHistory: [],
    currentLang: null,
    langData: null,
    availableSlotsCache: { slots: [], timestamp: 0 },
    conversationContext: {
      industry: null,
      need: null,
      stage: 'discovery',
      lastTopic: null,
      attribution: {
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
        gclid: null,
        fbclid: null,
        referrer: document.referrer || null
      },
      bookingFlow: {
        active: false,
        step: null,
        data: { name: null, email: null, datetime: null, service: null }
      }
    }
  };

  // Browser capabilities
  const hasSpeechRecognition = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  const hasSpeechSynthesis = 'speechSynthesis' in window;
  const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const needsTextFallback = !hasSpeechRecognition || isFirefox || isSafari;

  // ============================================================
  // AG-UI PROTOCOL (Agent-User Interaction Protocol)
  // https://docs.ag-ui.com/ - CopilotKit Open Standard
  // Session 250.29 - SOTA Implementation
  // ============================================================

  const AGUI = {
    // AG-UI Event Types (17 standard events)
    EventType: {
      TEXT_MESSAGE_START: 'TEXT_MESSAGE_START',
      TEXT_MESSAGE_CONTENT: 'TEXT_MESSAGE_CONTENT',
      TEXT_MESSAGE_END: 'TEXT_MESSAGE_END',
      TOOL_CALL_START: 'TOOL_CALL_START',
      TOOL_CALL_ARGS: 'TOOL_CALL_ARGS',
      TOOL_CALL_END: 'TOOL_CALL_END',
      TOOL_CALL_RESULT: 'TOOL_CALL_RESULT',
      STATE_SNAPSHOT: 'STATE_SNAPSHOT',
      STATE_DELTA: 'STATE_DELTA',
      MESSAGES_SNAPSHOT: 'MESSAGES_SNAPSHOT',
      RAW: 'RAW',
      CUSTOM: 'CUSTOM',
      RUN_STARTED: 'RUN_STARTED',
      RUN_FINISHED: 'RUN_FINISHED',
      RUN_ERROR: 'RUN_ERROR',
      STEP_STARTED: 'STEP_STARTED',
      STEP_FINISHED: 'STEP_FINISHED'
    },

    // Current run context
    currentRun: null,
    messageCounter: 0,
    toolCallCounter: 0,

    // Event listeners
    listeners: new Map(),

    /**
     * Generate unique IDs
     */
    generateId(prefix) {
      return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * Subscribe to AG-UI events
     */
    on(eventType, callback) {
      if (!this.listeners.has(eventType)) {
        this.listeners.set(eventType, []);
      }
      this.listeners.get(eventType).push(callback);
    },

    /**
     * Emit AG-UI event
     */
    emit(event) {
      const baseEvent = {
        timestamp: new Date().toISOString(),
        threadId: this.currentRun?.threadId || 'thread_default',
        runId: this.currentRun?.runId || null,
        ...event
      };

      // Notify listeners
      const typeListeners = this.listeners.get(event.type) || [];
      const allListeners = this.listeners.get('*') || [];
      [...typeListeners, ...allListeners].forEach(cb => cb(baseEvent));

      // Debug logging (can be disabled in production)
      if (CONFIG.AGUI_DEBUG) {
      }

      // Dispatch custom DOM event for external integrations
      window.dispatchEvent(new CustomEvent('vocalia:agui', { detail: baseEvent }));

      return baseEvent;
    },

    /**
     * Start a new agent run
     */
    startRun(input = {}) {
      const runId = this.generateId('run');
      const threadId = input.threadId || this.generateId('thread');

      this.currentRun = { runId, threadId, startedAt: Date.now() };

      return this.emit({
        type: this.EventType.RUN_STARTED,
        runId,
        threadId
      });
    },

    /**
     * Finish current run
     */
    finishRun() {
      if (!this.currentRun) return null;

      const event = this.emit({
        type: this.EventType.RUN_FINISHED,
        runId: this.currentRun.runId,
        duration: Date.now() - this.currentRun.startedAt
      });

      this.currentRun = null;
      return event;
    },

    /**
     * Report run error
     */
    errorRun(error) {
      const event = this.emit({
        type: this.EventType.RUN_ERROR,
        runId: this.currentRun?.runId,
        error: error.message || String(error)
      });

      this.currentRun = null;
      return event;
    },

    /**
     * Emit text message events (streaming pattern)
     */
    textMessage(content, role = 'assistant') {
      const messageId = this.generateId('msg');

      // START
      this.emit({
        type: this.EventType.TEXT_MESSAGE_START,
        messageId,
        role
      });

      // CONTENT (single chunk for non-streaming)
      this.emit({
        type: this.EventType.TEXT_MESSAGE_CONTENT,
        messageId,
        delta: content
      });

      // END
      return this.emit({
        type: this.EventType.TEXT_MESSAGE_END,
        messageId
      });
    },

    /**
     * Emit tool call events
     */
    toolCall(toolName, args, result) {
      const toolCallId = this.generateId('tool');

      // START
      this.emit({
        type: this.EventType.TOOL_CALL_START,
        toolCallId,
        toolCallName: toolName
      });

      // ARGS
      this.emit({
        type: this.EventType.TOOL_CALL_ARGS,
        toolCallId,
        args: JSON.stringify(args)
      });

      // END
      this.emit({
        type: this.EventType.TOOL_CALL_END,
        toolCallId
      });

      // RESULT
      return this.emit({
        type: this.EventType.TOOL_CALL_RESULT,
        toolCallId,
        result: JSON.stringify(result)
      });
    },

    /**
     * Emit state snapshot
     */
    stateSnapshot(snapshot) {
      return this.emit({
        type: this.EventType.STATE_SNAPSHOT,
        snapshot
      });
    },

    /**
     * Emit state delta (RFC 6902 JSON Patch)
     */
    stateDelta(delta) {
      return this.emit({
        type: this.EventType.STATE_DELTA,
        delta
      });
    },

    /**
     * Emit custom event
     */
    custom(name, data) {
      return this.emit({
        type: this.EventType.CUSTOM,
        name,
        data
      });
    }
  };

  // Add AG-UI debug flag to CONFIG
  CONFIG.AGUI_DEBUG = false; // Set to true for development

  // ============================================================
  // LANGUAGE DETECTION & LOADING
  // ============================================================

  /**
   * Detect language from multiple sources
   * Priority: 1. URL param 2. HTML lang 3. Browser 4. Default
   */
  function detectLanguage() {
    // 1. URL parameter ?lang=xx
    const urlParams = new URLSearchParams(window.location.search);
    const urlLang = urlParams.get('lang');
    if (urlLang && CONFIG.SUPPORTED_LANGS.includes(urlLang)) {
      return urlLang;
    }

    // 2. HTML lang attribute
    const htmlLang = document.documentElement.lang?.toLowerCase()?.split('-')[0];
    if (htmlLang && CONFIG.SUPPORTED_LANGS.includes(htmlLang)) {
      return htmlLang;
    }

    // 3. Browser language (mapped to supported)
    const browserLang = navigator.language || navigator.userLanguage;
    const mappedLang = CONFIG.AUTO_DETECT_LANGUAGES[browserLang] ||
      CONFIG.AUTO_DETECT_LANGUAGES[browserLang?.split('-')[0]];
    if (mappedLang && CONFIG.SUPPORTED_LANGS.includes(mappedLang)) {
      return mappedLang;
    }

    // 4. Default
    return CONFIG.DEFAULT_LANG;
  }

  /**
   * Load language file
   */
  async function loadLanguage(langCode) {
    // Session 167 - Darija is now supported!
    const url = CONFIG.LANG_PATH.replace('{lang}', langCode);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load language: ${langCode}`);
      }
      const data = await response.json();
      state.currentLang = langCode;
      state.langData = data;
      return data;
    } catch (error) {
      console.error('[VocalIA] Language load error:', error);
      // Fallback to French
      if (langCode !== 'fr') {
        return loadLanguage('fr');
      }
      throw error;
    }
  }

  // ============================================================
  // GA4 ANALYTICS
  // ============================================================

  function trackEvent(eventName, params = {}) {
    const eventData = {
      event_category: 'voice_assistant',
      language: state.currentLang,
      attribution: state.conversationContext.attribution,
      ...params
    };

    if (typeof gtag === 'function') {
      gtag('event', eventName, eventData);
    }
    if (typeof dataLayer !== 'undefined' && Array.isArray(dataLayer)) {
      dataLayer.push({ event: eventName, ...eventData });
    }

    // SOTA: Signal bridge to backend (Agent Ops Dashboard ingestion)
  }

  /**
   * Capture marketing attribution signals on init
   */
  function captureAttribution() {
    const urlParams = new URLSearchParams(window.location.search);
    const attr = state.conversationContext.attribution;

    attr.utm_source = urlParams.get('utm_source') || attr.utm_source;
    attr.utm_medium = urlParams.get('utm_medium') || attr.utm_medium;
    attr.utm_campaign = urlParams.get('utm_campaign') || attr.utm_campaign;
    attr.gclid = urlParams.get('gclid') || attr.gclid;
    attr.fbclid = urlParams.get('fbclid') || attr.fbclid;

    if (attr.gclid || attr.fbclid) {
    }
  }

  // ============================================================
  // WIDGET UI
  // ============================================================

  function createWidget() {
    if (document.getElementById('voice-assistant-widget')) {
      return;
    }

    const L = state.langData;
    const isRTL = L.meta.rtl;
    const position = isRTL ? 'left' : 'right';

    const widget = document.createElement('div');
    widget.id = 'voice-assistant-widget';
    widget.style.cssText = `position:fixed;bottom:30px;${position}:25px;z-index:99999;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;${isRTL ? 'direction:rtl;' : ''}`;

    widget.innerHTML = generateWidgetHTML(L, isRTL, position);
    document.body.appendChild(widget);

    initEventListeners();

    // Show notification bubble after delay
    setTimeout(() => {
      if (!state.isOpen) showNotificationBubble();
    }, 2000);
  }

  function generateWidgetHTML(L, isRTL, position) {
    const headerDirection = isRTL ? 'flex-direction: row-reverse;' : '';
    const inputDirection = isRTL ? 'flex-direction: row-reverse; direction: rtl; text-align: right;' : '';
    const sendIconTransform = isRTL ? 'transform: scaleX(-1);' : '';

    return `
      <style>
        #voice-assistant-widget {
          --va-primary: ${CONFIG.primaryColor};
          --va-primary-dark: ${CONFIG.primaryDark};
          --va-accent: ${CONFIG.accentColor};
          --va-dark: ${CONFIG.darkBg};
        }
        .va-trigger {
          width: 60px; height: 60px; border-radius: 50%;
          background: linear-gradient(135deg, var(--va-primary) 0%, var(--va-primary-dark) 50%, var(--va-accent) 100%);
          border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 20px rgba(79, 186, 241, 0.4);
          transition: all 0.3s ease; position: relative;
          animation: pulse-glow 2s ease-in-out infinite;
        }
        .va-trigger::before {
          content: ''; position: absolute; top: -4px; left: -4px; right: -4px; bottom: -4px;
          border-radius: 50%; background: linear-gradient(135deg, var(--va-primary), var(--va-accent));
          opacity: 0; z-index: -1; animation: pulse-ring 2s ease-out infinite;
        }
        .va-trigger::after {
          content: ''; position: absolute; top: -8px; left: -8px; right: -8px; bottom: -8px;
          border-radius: 50%; border: 2px solid var(--va-primary);
          opacity: 0; animation: pulse-ring-outer 2s ease-out infinite 0.5s;
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 4px 20px rgba(79, 186, 241, 0.4); transform: scale(1); }
          50% { box-shadow: 0 4px 30px rgba(79, 186, 241, 0.7); transform: scale(1.02); }
        }
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes pulse-ring-outer {
          0% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .va-trigger:hover {
          transform: scale(1.1); box-shadow: 0 6px 30px rgba(79, 186, 241, 0.6); animation: none;
        }
        .va-trigger:hover::before, .va-trigger:hover::after { animation: none; opacity: 0; }
        .va-trigger img { width: 40px; height: 40px; object-fit: contain; border-radius: 8px; }
        .va-trigger.listening { animation: pulse 1.5s infinite; }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(79, 186, 241, 0.7); }
          50% { box-shadow: 0 0 0 15px rgba(79, 186, 241, 0); }
        }
        .va-panel {
          display: none; position: absolute; bottom: 70px; ${position}: 0;
          width: 360px; max-height: 500px; background: var(--va-dark);
          border: 1px solid rgba(255,255,255,0.1); border-radius: 16px;
          overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.5);
          ${isRTL ? 'direction: rtl; text-align: right;' : ''}
        }
        .va-panel.open { display: flex; flex-direction: column; animation: slideUp 0.3s ease; }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .va-header {
          padding: 16px;
          background: linear-gradient(135deg, var(--va-primary) 0%, var(--va-primary-dark) 50%, var(--va-accent) 100%);
          display: flex; align-items: center; gap: 12px; ${headerDirection}
        }
        .va-header-icon {
          width: 40px; height: 40px; background: rgba(255,255,255,0.2);
          border-radius: 50%; display: flex; align-items: center; justify-content: center;
        }
        .va-header-icon img { width: 24px; height: 24px; object-fit: contain; border-radius: 4px; }
        .va-header-text h3 { margin: 0; font-size: 16px; font-weight: 600; color: white; }
        .va-header-text p { margin: 2px 0 0; font-size: 12px; color: rgba(255,255,255,0.8); }
        .va-close {
          margin-${isRTL ? 'right' : 'left'}: auto; background: none; border: none;
          color: white; cursor: pointer; padding: 4px; opacity: 0.8;
        }
        .va-close:hover { opacity: 1; }
        .va-messages { flex: 1; overflow-y: auto; padding: 16px; max-height: 300px; }
        .va-message { margin-bottom: 12px; display: flex; gap: 8px; }
        .va-message.user { flex-direction: ${isRTL ? 'row' : 'row-reverse'}; }
        .va-message.assistant { flex-direction: ${isRTL ? 'row-reverse' : 'row'}; }
        .va-message-content {
          max-width: 80%; padding: 10px 14px; border-radius: 12px;
          font-size: 14px; line-height: 1.5;
        }
        .va-message.assistant .va-message-content { background: rgba(255,255,255,0.1); color: #e5e5e5; }
        .va-message.user .va-message-content { background: var(--va-primary); color: white; }
        .va-input-area {
          padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.1);
          display: flex; gap: 8px; ${inputDirection}
        }
        .va-input {
          flex: 1; background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.1); border-radius: 24px;
          padding: 10px 16px; color: white; font-size: 14px; outline: none;
          ${isRTL ? 'direction: rtl; text-align: right;' : ''}
        }
        .va-input::placeholder { color: rgba(255,255,255,0.5); }
        .va-input:focus { border-color: var(--va-primary); }
        .va-mic-btn {
          width: 40px; height: 40px; border-radius: 50%;
          background: ${hasSpeechRecognition ? 'var(--va-primary)' : 'rgba(255,255,255,0.1)'};
          border: none; cursor: ${hasSpeechRecognition ? 'pointer' : 'not-allowed'};
          display: flex; align-items: center; justify-content: center; transition: all 0.2s;
        }
        .va-mic-btn.listening { background: #ef4444; animation: pulse 1s infinite; }
        .va-mic-btn svg { width: 20px; height: 20px; fill: white; }
        .va-send-btn {
          width: 40px; height: 40px; border-radius: 50%; background: var(--va-primary);
          border: none; cursor: pointer; display: flex; align-items: center;
          justify-content: center; transition: all 0.2s;
        }
        .va-send-btn:hover { transform: scale(1.1); }
        .va-send-btn svg { width: 20px; height: 20px; fill: white; ${sendIconTransform} }
        .va-typing { display: flex; gap: 4px; padding: 10px 14px; direction: ltr; }
        .va-typing span {
          width: 8px; height: 8px; background: rgba(255,255,255,0.5);
          border-radius: 50%; animation: typing 1.4s infinite ease-in-out;
        }
        .va-typing span:nth-child(2) { animation-delay: 0.2s; }
        .va-typing span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes typing {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
        .va-cta {
          padding: 12px 16px; background: rgba(79, 186, 241, 0.1);
          border-top: 1px solid rgba(79, 186, 241, 0.2);
        }
        .va-cta a {
          display: block; text-align: center; padding: 10px;
          background: var(--va-primary); color: white; text-decoration: none;
          border-radius: 8px; font-size: 14px; font-weight: 500; transition: all 0.2s;
        }
        .va-cta a:hover { background: var(--va-primary-dark); }
        @keyframes notifSlideIn {
          from { opacity: 0; transform: translateX(${isRTL ? '-' : ''}20px) scale(0.9); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes notifSlideOut {
          from { opacity: 1; transform: translateX(0) scale(1); }
          to { opacity: 0; transform: translateX(${isRTL ? '-' : ''}20px) scale(0.9); }
        }
        
        /* A2UI Overlay (status bar) */
        .va-a2ui-overlay {
          position: absolute; top: 72px; left: 0; right: 0;
          padding: 6px 12px;
          background: rgba(16, 185, 129, 0.95); /* Emerald */
          color: white; font-size: 11px; font-weight: 600;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          transform: translateY(-100%); transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 10; box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          backdrop-filter: blur(4px); border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .va-a2ui-overlay.visible { transform: translateY(0); }
        .va-a2ui-overlay.corrected { background: rgba(245, 158, 11, 0.95); } /* Amber */

        /* A2UI Container (dynamic components) - Session 250.39 */
        .va-a2ui-container {
          padding: 12px; margin: 8px 0;
          animation: a2uiSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes a2uiSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        /* A2UI Booking Component */
        .va-a2ui-booking { padding: 12px; background: rgba(30,41,59,0.95); border-radius: 12px; }
        .va-a2ui-title { font-size: 14px; font-weight: 600; margin-bottom: 12px; color: #fff; }
        .va-a2ui-date-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
        .va-a2ui-slot { padding: 8px; background: rgba(94,106,210,0.2); border: 1px solid rgba(94,106,210,0.3); border-radius: 8px; color: #a5b4fc; font-size: 12px; cursor: pointer; transition: all 0.2s; }
        .va-a2ui-slot:hover { background: rgba(94,106,210,0.4); transform: translateY(-1px); }
        .va-a2ui-slot.selected { background: #5e6ad2; color: #fff; border-color: #5e6ad2; }
        .va-a2ui-confirm { width: 100%; padding: 10px; background: #10b981; border: none; border-radius: 8px; color: #fff; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .va-a2ui-confirm:disabled { background: #374151; color: #6b7280; cursor: not-allowed; }
        .va-a2ui-confirm:not(:disabled):hover { background: #059669; }
        /* A2UI Lead Form Component */
        .va-a2ui-lead-form { padding: 12px; background: rgba(30,41,59,0.95); border-radius: 12px; }
        .va-a2ui-form { display: flex; flex-direction: column; gap: 10px; }
        .va-a2ui-field label { display: block; font-size: 11px; color: #94a3b8; margin-bottom: 4px; }
        .va-a2ui-field input { width: 100%; padding: 8px 10px; background: rgba(15,23,42,0.8); border: 1px solid rgba(148,163,184,0.2); border-radius: 6px; color: #fff; font-size: 13px; box-sizing: border-box; }
        .va-a2ui-field input:focus { outline: none; border-color: #5e6ad2; }
        .va-a2ui-submit { padding: 10px; background: #5e6ad2; border: none; border-radius: 8px; color: #fff; font-weight: 600; cursor: pointer; }
        .va-a2ui-submit:hover { background: #4f5bc7; }
        /* A2UI Cart Component */
        .va-a2ui-cart { padding: 12px; background: rgba(30,41,59,0.95); border-radius: 12px; }
        .va-a2ui-items { margin: 10px 0; }
        .va-a2ui-item { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(148,163,184,0.1); font-size: 12px; }
        .va-a2ui-item-name { color: #fff; flex: 1; }
        .va-a2ui-item-qty { color: #94a3b8; margin: 0 8px; }
        .va-a2ui-item-price { color: #10b981; font-weight: 600; }
        .va-a2ui-total { display: flex; justify-content: space-between; padding: 10px 0; font-weight: 600; }
        .va-a2ui-total-value { color: #10b981; font-size: 16px; }
        .va-a2ui-checkout { width: 100%; padding: 10px; background: #10b981; border: none; border-radius: 8px; color: #fff; font-weight: 600; cursor: pointer; }
        .va-a2ui-checkout:hover { background: #059669; }
        /* A2UI Confirmation Component */
        .va-a2ui-confirmation { padding: 16px; background: rgba(30,41,59,0.95); border-radius: 12px; text-align: center; }
        .va-a2ui-icon { font-size: 32px; margin-bottom: 8px; }
        .va-a2ui-message { font-size: 13px; color: #94a3b8; margin: 8px 0; }
        .va-a2ui-details { background: rgba(15,23,42,0.5); border-radius: 8px; padding: 10px; margin: 12px 0; text-align: left; }
        .va-a2ui-detail-row { display: flex; justify-content: space-between; font-size: 12px; padding: 4px 0; }
        .va-a2ui-detail-row span:first-child { color: #94a3b8; }
        .va-a2ui-detail-row span:last-child { color: #fff; font-weight: 500; }
        .va-a2ui-close { margin-top: 12px; padding: 8px 24px; background: #5e6ad2; border: none; border-radius: 8px; color: #fff; cursor: pointer; }
        
        @media (max-width: 480px) { .va-panel { width: calc(100vw - 40px); ${position}: -10px; } }
      </style>

      <button class="va-trigger" id="va-trigger" aria-label="${L.ui.ariaOpenAssistant}">
        <img src="/public/images/logo.webp" alt="VocalIA" width="32" height="32" loading="lazy" />
      </button>

      <div class="va-panel" id="va-panel">
        <div class="va-header">
          <div class="va-header-icon">
            <img src="/public/images/logo.webp" alt="VocalIA" width="32" height="32" loading="lazy" />
          </div>
          <div class="va-header-text">
            <h3>${L.ui.headerTitle}</h3>
            <p>${needsTextFallback ? L.ui.headerSubtitleText : L.ui.headerSubtitleVoice}</p>
          </div>
          <button class="va-close" id="va-close" aria-label="${L.ui.ariaClose}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
        <div id="va-a2ui-overlay" class="va-a2ui-overlay"></div>

        <div class="va-messages" id="va-messages"></div>

        <div class="va-input-area">
          <input type="text" class="va-input" id="va-input" placeholder="${L.ui.placeholder}">
          ${!needsTextFallback && hasSpeechRecognition ? `
          <button class="va-mic-btn" id="va-mic" aria-label="${L.ui.ariaMic}">
            <svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1 1.93c-3.94-.49-7-3.85-7-7.93h2c0 3.31 2.69 6 6 6s6-2.69 6-6h2c0 4.08-3.06 7.44-7 7.93V20h4v2H8v-2h4v-4.07z"/></svg>
          </button>
          ` : ''}
          <button class="va-send-btn" id="va-send" aria-label="${L.ui.ariaSend}">
            <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>

        <div class="va-cta">
          <a href="${L.ui.ctaLink}">${L.ui.ctaButton}</a>
        </div>
      </div>
    `;
  }

  function showNotificationBubble() {
    const L = state.langData;
    const isRTL = L.meta.rtl;
    const position = isRTL ? 'left' : 'right';

    const trigger = document.getElementById('va-trigger');
    const bubble = document.createElement('div');
    bubble.className = 'va-notification';
    bubble.innerHTML = `
      <div class="va-notif-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </div>
      <div class="va-notif-text">
        <span class="va-notif-title">${L.ui.notifTitle}</span>
        <span class="va-notif-sub">${L.ui.notifSub}</span>
      </div>
    `;

    bubble.style.cssText = `
      position: absolute; bottom: 75px; ${position}: 0;
      display: flex; align-items: center; gap: 10px;
      background: rgba(25, 30, 53, 0.95);
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(79, 186, 241, 0.3);
      padding: 12px 16px; border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), 0 0 20px rgba(79, 186, 241, 0.15);
      animation: notifSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      cursor: pointer; white-space: nowrap; z-index: 9999;
      ${isRTL ? 'direction: rtl; flex-direction: row-reverse;' : ''}
    `;

    // Style inner elements
    const icon = bubble.querySelector('.va-notif-icon');
    if (icon) icon.style.cssText = 'width: 32px; height: 32px; background: linear-gradient(135deg, rgba(79, 186, 241, 0.2) 0%, rgba(16, 185, 129, 0.1) 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #4FBAF1; flex-shrink: 0;';

    const textContainer = bubble.querySelector('.va-notif-text');
    if (textContainer) textContainer.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';

    const title = bubble.querySelector('.va-notif-title');
    if (title) title.style.cssText = 'font-size: 14px; font-weight: 600; color: #E4F4FC;';

    const sub = bubble.querySelector('.va-notif-sub');
    if (sub) sub.style.cssText = 'font-size: 11px; color: rgba(255, 255, 255, 0.7);';

    // Arrow
    const arrow = document.createElement('div');
    arrow.style.cssText = `position: absolute; bottom: -6px; ${position}: 24px; width: 12px; height: 12px; background: rgba(25, 30, 53, 0.95); border-${isRTL ? 'left' : 'right'}: 1px solid rgba(79, 186, 241, 0.3); border-bottom: 1px solid rgba(79, 186, 241, 0.3); transform: rotate(${isRTL ? '-' : ''}45deg);`;
    bubble.appendChild(arrow);

    trigger.parentNode.appendChild(bubble);
    bubble.addEventListener('click', togglePanel);

    setTimeout(() => {
      bubble.style.animation = 'notifSlideOut 0.3s ease forwards';
      setTimeout(() => bubble.remove(), 300);
    }, 6000);
  }

  // ============================================================
  // MESSAGING
  // ============================================================

  function addMessage(text, type = 'assistant') {
    const messagesContainer = document.getElementById('va-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `va-message ${type}`;
    const contentDiv = document.createElement('div');
    contentDiv.className = 'va-message-content';
    contentDiv.textContent = text;
    messageDiv.appendChild(contentDiv);
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    if (type === 'assistant' && hasSpeechSynthesis) {
      speak(text);
    }

    state.conversationHistory.push({
      role: type === 'user' ? 'user' : 'assistant',
      content: text
    });
  }

  function showTyping() {
    const messagesContainer = document.getElementById('va-messages');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'va-message assistant';
    typingDiv.id = 'va-typing';
    typingDiv.innerHTML = '<div class="va-message-content"><div class="va-typing"><span></span><span></span><span></span></div></div>';
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function hideTyping() {
    const typing = document.getElementById('va-typing');
    if (typing) typing.remove();
  }

  // ============================================================
  // SPEECH SYNTHESIS & RECOGNITION
  // ============================================================

  function speak(text) {
    if (!hasSpeechSynthesis) return;
    state.synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = state.langData.meta.speechSynthesis;
    utterance.rate = state.langData.meta.code === 'ar' ? 0.9 : 1.0;
    state.synthesis.speak(utterance);
  }

  function initSpeechRecognition() {
    if (!hasSpeechRecognition) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    state.recognition = new SpeechRecognition();

    // Start with page language, but allow auto-detection
    state.recognition.lang = state.langData.meta.speechRecognition;
    state.recognition.continuous = false;
    state.recognition.interimResults = false;

    state.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      document.getElementById('va-input').value = transcript;
      sendMessage(transcript);

      // Log detected language for analytics
      if (event.results[0][0].confidence) {
        trackEvent('voice_recognition_result', {
          confidence: event.results[0][0].confidence,
          detected_lang: state.recognition.lang
        });
      }
    };

    state.recognition.onend = () => {
      state.isListening = false;
      document.getElementById('va-mic')?.classList.remove('listening');
      document.getElementById('va-trigger').classList.remove('listening');
    };

    state.recognition.onerror = (event) => {
      state.isListening = false;
      document.getElementById('va-mic')?.classList.remove('listening');
      trackEvent('voice_recognition_error', { error: event.error });
    };
  }

  function toggleListening() {
    if (!state.recognition) return;

    if (state.isListening) {
      state.recognition.stop();
    } else {
      state.recognition.start();
      state.isListening = true;
      document.getElementById('va-mic').classList.add('listening');
      document.getElementById('va-trigger').classList.add('listening');
      trackEvent('voice_mic_activated');
    }
  }

  // ============================================================
  // BOOKING SYSTEM
  // ============================================================

  function isBookingIntent(text) {
    const L = state.langData;
    const lower = text.toLowerCase();
    return L.booking.keywords.some(kw => lower.includes(kw));
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async function fetchAvailableSlots() {
    const now = Date.now();
    if (state.availableSlotsCache.slots.length > 0 &&
      (now - state.availableSlotsCache.timestamp) < CONFIG.SLOT_CACHE_TTL) {
      return state.availableSlotsCache.slots;
    }

    try {
      const response = await fetch(CONFIG.BOOKING_API + '?action=availability', {
        method: 'GET',
        mode: 'cors'
      });
      const result = await response.json();

      if (result.success && result.data?.slots) {
        const locale = state.langData.meta.speechSynthesis;
        const formattedSlots = result.data.slots.slice(0, 6).map(slot => {
          const date = new Date(slot.start);
          return {
            date: date.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' }),
            time: date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' }),
            iso: slot.start
          };
        });
        state.availableSlotsCache = { slots: formattedSlots, timestamp: now };
        return formattedSlots;
      }
    } catch (error) {
      console.error('[VocalIA] Slots fetch error:', error);
    }

    return getStaticSlots();
  }

  function getStaticSlots() {
    const now = new Date();
    const locale = state.langData.meta.speechSynthesis;
    const isArabic = state.langData.meta.code === 'ar';
    const slots = [];

    for (let d = 1; d <= 7; d++) {
      const date = new Date(now);
      date.setDate(now.getDate() + d);
      const day = date.getDay();

      // Sunday-Thursday for Arabic markets, Monday-Friday for others
      const validDays = isArabic ? [0, 1, 2, 3, 4] : [1, 2, 3, 4, 5];

      if (validDays.includes(day)) {
        date.setHours(10, 0, 0, 0);
        slots.push({
          date: date.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' }),
          time: '10:00',
          iso: date.toISOString()
        });
        if (slots.length >= 3) break;
      }
    }
    return slots;
  }

  async function submitBooking(data) {
    // AG-UI: Tool call start
    AGUI.emit({
      type: AGUI.EventType.TOOL_CALL_START,
      toolCallId: AGUI.generateId('tool'),
      toolCallName: 'booking_create'
    });

    try {
      const response = await fetch(CONFIG.BOOKING_API, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(data)
      });
      const result = await response.json();

      // AG-UI: Tool call result
      AGUI.emit({
        type: AGUI.EventType.TOOL_CALL_RESULT,
        toolCallId: AGUI.generateId('tool'),
        result: JSON.stringify({ success: result.success })
      });

      return result;
    } catch (error) {
      console.error('[VocalIA] Booking error:', error);

      // AG-UI: Tool call error
      AGUI.emit({
        type: AGUI.EventType.TOOL_CALL_RESULT,
        toolCallId: AGUI.generateId('tool'),
        result: JSON.stringify({ success: false, error: error.message })
      });

      return { success: false, message: error.message };
    }
  }

  function getClientTimezone() {
    if (window.GeoLocale && typeof window.GeoLocale.getTimezone === 'function') {
      return window.GeoLocale.getTimezone();
    }
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return { iana: tz, offset: new Date().getTimezoneOffset() };
    } catch (e) {
      return { iana: null, offset: new Date().getTimezoneOffset() };
    }
  }

  async function handleBookingFlow(userMessage) {
    const L = state.langData;
    const lower = userMessage.toLowerCase();
    const booking = state.conversationContext.bookingFlow;

    // Check for cancellation
    if (L.booking.cancelKeywords.some(kw => lower.includes(kw))) {
      trackEvent('voice_booking_cancelled', { step: booking.step });
      booking.active = false;
      booking.step = null;
      booking.data = { name: null, email: null, datetime: null, service: L.booking.service };
      return L.booking.messages.cancelled;
    }

    // Step: Name
    if (booking.step === 'name') {
      const name = userMessage.trim();
      if (name.length < 2) {
        return L.booking.messages.askName;
      }
      booking.data.name = name;
      booking.step = 'email';
      return L.booking.messages.askEmail.replace('{name}', name);
    }

    // Step: Email
    if (booking.step === 'email') {
      const email = userMessage.trim().toLowerCase();
      if (!isValidEmail(email)) {
        return L.booking.messages.invalidEmail;
      }
      booking.data.email = email;
      booking.step = 'datetime';

      const slots = await fetchAvailableSlots();
      if (slots.length === 0) {
        return L.booking.messages.noSlots;
      }

      let response = L.booking.messages.slotsIntro;
      slots.slice(0, 3).forEach((s, i) => {
        response += L.booking.messages.slotFormat
          .replace('{index}', i + 1)
          .replace('{date}', s.date)
          .replace('{time}', s.time) + '\n';
      });
      response += L.booking.messages.slotsOutro;
      return response;
    }

    // Step: DateTime selection
    if (booking.step === 'datetime') {
      const slots = state.availableSlotsCache.slots.length > 0
        ? state.availableSlotsCache.slots.slice(0, 3)
        : getStaticSlots();

      let selectedSlot = null;

      for (const [num, keywords] of Object.entries(L.booking.slotKeywords)) {
        if (keywords.some(kw => lower.includes(kw))) {
          selectedSlot = slots[parseInt(num) - 1];
          break;
        }
      }

      if (selectedSlot) {
        booking.data.datetime = selectedSlot.iso;
        booking.step = 'confirm';
        trackEvent('voice_booking_slot_selected', {
          slot_date: selectedSlot.date,
          slot_time: selectedSlot.time
        });

        return L.booking.messages.confirmIntro +
          L.booking.messages.confirmName.replace('{name}', booking.data.name) + '\n' +
          L.booking.messages.confirmEmail.replace('{email}', booking.data.email) + '\n' +
          L.booking.messages.confirmDate.replace('{date}', selectedSlot.date).replace('{time}', selectedSlot.time) +
          L.booking.messages.confirmOutro;
      }

      return L.booking.messages.slotNotUnderstood;
    }

    // Step: Confirmation
    if (booking.step === 'confirm') {
      if (L.booking.confirmKeywords.some(kw => lower.includes(kw))) {
        booking.step = 'submitting';
        return null; // Will trigger processBookingConfirmation
      }
      return L.booking.messages.confirmPrompt;
    }

    return null;
  }

  async function processBookingConfirmation() {
    const L = state.langData;
    const booking = state.conversationContext.bookingFlow;
    const clientTz = getClientTimezone();

    const result = await submitBooking({
      name: booking.data.name,
      email: booking.data.email,
      datetime: booking.data.datetime,
      service: booking.data.service || L.booking.service,
      phone: '',
      notes: `Booking via voice assistant (${state.currentLang.toUpperCase()})`,
      timezone: clientTz.iana || `UTC${clientTz.offset > 0 ? '-' : '+'}${Math.abs(clientTz.offset / 60)}`
    });

    booking.active = false;
    booking.step = null;

    if (result.success) {
      trackEvent('voice_booking_completed', {
        service: booking.data.service,
        datetime: booking.data.datetime
      });
      return L.booking.messages.success.replace('{email}', booking.data.email);
    } else {
      trackEvent('voice_booking_failed', { error: result.message });
      return L.booking.messages.failure.replace('{message}', result.message);
    }
  }

  // ============================================================
  // INTELLIGENT RESPONSE SYSTEM
  // ============================================================

  function detectIndustry(text) {
    const L = state.langData;
    const lower = text.toLowerCase();

    for (const [industry, data] of Object.entries(L.industries)) {
      if (data.keywords.some(kw => lower.includes(kw))) {
        return industry;
      }
    }
    return null;
  }

  function detectNeed(text) {
    const L = state.langData;
    const lower = text.toLowerCase();

    for (const [need, keywords] of Object.entries(L.needs)) {
      if (keywords.some(kw => lower.includes(kw))) {
        return need;
      }
    }
    return null;
  }

  async function getAIResponse(userMessage) {
    const L = state.langData;
    const lower = userMessage.toLowerCase();
    const ctx = state.conversationContext;

    // 1. Active booking flow takes priority
    if (ctx.bookingFlow.active) {
      const bookingResponse = await handleBookingFlow(userMessage);
      if (ctx.bookingFlow.step === 'submitting') {
        return await processBookingConfirmation();
      }
      if (bookingResponse) return { text: bookingResponse };
    }

    // 2. Try Remote Voice API (The "Real" Intelligence with A2UI)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

      // Generate Session ID if missing
      if (!state.sessionId) state.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

      const responseVal = await fetch(CONFIG.VOICE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          sessionId: state.sessionId,
          language: state.currentLang,
          history: state.conversationHistory.slice(-6) // Send context
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (responseVal.ok) {
        const data = await responseVal.json();
        if (data.success && data.response) {
          // Process Lead Data if present
          if (data.lead && data.lead.score) {
            state.conversationContext.leadScore = data.lead.score;
            // Could trigger specific UI update here too
          }

          return {
            text: data.response,
            a2ui: data.a2ui || null
          };
        }
      } else {
        throw new Error(`API Error: ${responseVal.status}`);
      }
    } catch (e) {
      console.error("[VocalIA] Voice API failed:", e.message);
      // STRICTLY RETURN ERROR MESSAGE - NO FALLBACKS
      return {
        text: L.ui.errorMessage || "Désolé, je suis temporairement indisponible. Veuillez réessayer.",
        error: true
      };
    }

    // --- FALLBACK DISABLED ---
    // Rule-based fallback removed as per strategic directive.
    return {
      text: L.ui.errorMessage || "Désolé, je suis temporairement indisponible. Veuillez réessayer.",
      error: true
    };
  }


  // ============================================================
  // MESSAGE HANDLING
  // ============================================================

  async function sendMessage(text) {
    if (!text.trim()) return;

    // AG-UI: Start run
    AGUI.startRun({ threadId: state.conversationContext.sessionId });

    // AG-UI: User message
    AGUI.textMessage(text, 'user');

    addMessage(text, 'user');
    document.getElementById('va-input').value = '';
    showTyping();

    // AG-UI: State snapshot before processing
    AGUI.stateSnapshot({
      conversationLength: state.conversationHistory.length,
      bookingActive: state.conversationContext.bookingFlow.active,
      language: state.currentLang
    });

    try {
      const result = await getAIResponse(text);
      hideTyping();

      const responseText = result.text || result;

      // AG-UI: Assistant message
      AGUI.textMessage(responseText, 'assistant');

      addMessage(responseText, 'assistant');

      // Update A2UI
      if (result.a2ui) {
        updateA2UI(result.a2ui);
        // AG-UI: Custom event for A2UI
        AGUI.custom('a2ui_update', result.a2ui);
      }

      // AG-UI: Tool call if booking flow triggered
      if (result.toolCall) {
        AGUI.toolCall(result.toolCall.name, result.toolCall.args, result.toolCall.result);
      }

      // AG-UI: Finish run
      AGUI.finishRun();

    } catch (error) {
      hideTyping();
      addMessage(state.langData.ui.errorMessage, 'assistant');
      console.error('[VocalIA] Response error:', error);

      // AG-UI: Error run
      AGUI.errorRun(error);
    }
  }

  // ============================================================
  // A2UI RENDERER (Agentic UI) - Session 250.39: Full Pipeline
  // Pipeline: Agent Context → API → Widget DOM → User → AG-UI Events
  // ============================================================

  // A2UI State
  const a2uiState = {
    currentComponent: null,
    selectedSlot: null,
    formData: {}
  };

  /**
   * Update A2UI status overlay (verification badge)
   */
  function updateA2UI(metadata) {
    if (!metadata) return;
    const overlay = document.getElementById('va-a2ui-overlay');
    if (!overlay) return;

    // Reset classes
    overlay.className = 'va-a2ui-overlay';

    // Handle status metadata (verification overlay)
    if (metadata.verification) {
      let content = '';
      let isVisible = false;

      if (metadata.verification === 'corrected') {
        content = `<span style="font-size: 14px;">⚡</span> <span>Auto-Corrected (${metadata.latency}ms)</span>`;
        overlay.classList.add('corrected');
        isVisible = true;
      } else if (metadata.verification === 'approved') {
        content = `<span style="font-size: 14px;">🛡️</span> <span>Verified (${metadata.latency}ms)</span>`;
        isVisible = true;
      }

      if (isVisible) {
        overlay.innerHTML = content;
        void overlay.offsetWidth;
        overlay.classList.add('visible');
        setTimeout(() => overlay.classList.remove('visible'), 4000);
      }
      return;
    }

    // Handle full A2UI component injection
    if (metadata.ui) {
      injectA2UIComponent(metadata.ui);
    }
  }

  /**
   * Request A2UI component from API
   * @param {string} type - Component type: booking, lead_form, cart, confirmation
   * @param {Object} context - Context data for generation
   */
  async function requestA2UI(type, context = {}) {
    try {
      AGUI.custom('a2ui_request', { type, context });

      const response = await fetch(`${CONFIG.A2UI_API}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          context,
          language: state.locale || 'fr',
          useStitch: false // Use templates for speed
        })
      });

      if (!response.ok) {
        throw new Error(`A2UI API error: ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.ui) {
        injectA2UIComponent(data.ui);
        AGUI.custom('a2ui_generated', { type, source: data.meta?.source, latency: data.meta?.latency });
      }

      return data;
    } catch (error) {
      console.error('[A2UI] Request failed:', error);
      AGUI.custom('a2ui_error', { type, error: error.message });
      return null;
    }
  }

  /**
   * Inject A2UI component into messages area
   * @param {Object} ui - UI object with html, css, type, actions
   */
  function injectA2UIComponent(ui) {
    if (!ui || !ui.html) return;

    const messagesEl = document.getElementById('va-messages');
    if (!messagesEl) return;

    // Remove existing A2UI container
    const existingContainer = messagesEl.querySelector('.va-a2ui-container');
    if (existingContainer) {
      existingContainer.remove();
    }

    // Sanitize HTML (basic XSS prevention)
    const sanitizedHTML = sanitizeA2UIHTML(ui.html);

    // Create container
    const container = document.createElement('div');
    container.className = 'va-a2ui-container';
    container.setAttribute('data-a2ui-type', ui.type);
    container.innerHTML = sanitizedHTML;

    // Inject CSS if provided
    if (ui.css) {
      const styleId = 'va-a2ui-dynamic-css';
      let styleEl = document.getElementById(styleId);
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = ui.css;
    }

    // Append to messages
    messagesEl.appendChild(container);

    // Scroll to show component
    messagesEl.scrollTop = messagesEl.scrollHeight;

    // Bind event listeners
    bindA2UIEvents(container, ui.type, ui.actions || []);

    // Update state
    a2uiState.currentComponent = ui.type;

    // AG-UI event
    AGUI.custom('a2ui_injected', { type: ui.type });

    console.log(`[A2UI] Injected ${ui.type} component`);
  }

  /**
   * Sanitize A2UI HTML to prevent XSS
   */
  function sanitizeA2UIHTML(html) {
    // Remove script tags
    let clean = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    // Remove event handlers
    clean = clean.replace(/\son\w+="[^"]*"/gi, '');
    clean = clean.replace(/\son\w+='[^']*'/gi, '');
    // Remove javascript: URLs
    clean = clean.replace(/javascript:/gi, '');
    return clean;
  }

  /**
   * Bind AG-UI events to A2UI component
   */
  function bindA2UIEvents(container, type, actions) {
    // Booking: slot selection + confirm
    if (type === 'booking') {
      const slots = container.querySelectorAll('[data-a2ui-action="select_slot"]');
      const confirmBtn = container.querySelector('[data-a2ui-action="confirm_booking"]');

      slots.forEach(slot => {
        slot.addEventListener('click', () => {
          // Deselect all
          slots.forEach(s => s.classList.remove('selected'));
          // Select this one
          slot.classList.add('selected');
          a2uiState.selectedSlot = slot.dataset.slot;
          // Enable confirm
          if (confirmBtn) confirmBtn.disabled = false;
          // AG-UI event
          AGUI.custom('a2ui_slot_selected', { slot: a2uiState.selectedSlot });
          trackEvent('a2ui_slot_selected');
        });
      });

      if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
          if (a2uiState.selectedSlot) {
            AGUI.custom('a2ui_booking_confirmed', { slot: a2uiState.selectedSlot });
            trackEvent('a2ui_booking_confirmed');
            // Show confirmation
            requestA2UI('confirmation', {
              icon: '✅',
              title: state.langData?.ui?.bookingConfirmed || 'Rendez-vous confirmé !',
              message: `Créneau: ${a2uiState.selectedSlot}`
            });
          }
        });
      }
    }

    // Lead Form: submission
    if (type === 'lead_form') {
      const form = container.querySelector('[data-a2ui-action="submit_lead"]');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const formData = new FormData(form);
          const data = Object.fromEntries(formData.entries());
          a2uiState.formData = data;
          AGUI.custom('a2ui_lead_submitted', { data });
          trackEvent('a2ui_lead_submitted');
          // Remove form, show confirmation
          requestA2UI('confirmation', {
            icon: '📧',
            title: state.langData?.ui?.leadSubmitted || 'Merci !',
            message: 'Nous vous contacterons bientôt.'
          });
        });
      }
    }

    // Cart: checkout
    if (type === 'cart') {
      const checkoutBtn = container.querySelector('[data-a2ui-action="checkout"]');
      if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
          AGUI.custom('a2ui_checkout_clicked', {});
          trackEvent('a2ui_checkout_clicked');
          // This would typically redirect to payment
          addMessage(state.langData?.ui?.checkoutRedirect || 'Redirection vers le paiement...', 'assistant');
        });
      }
    }

    // Confirmation: close
    if (type === 'confirmation') {
      const closeBtn = container.querySelector('[data-a2ui-action="close"]');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          container.remove();
          a2uiState.currentComponent = null;
          AGUI.custom('a2ui_closed', { type });
        });
      }
    }
  }

  /**
   * Expose A2UI API to window for external use
   */
  window.VocaliaA2UI = {
    request: requestA2UI,
    inject: injectA2UIComponent,
    getState: () => ({ ...a2uiState })
  };

  // ============================================================
  // PANEL CONTROL
  // ============================================================

  function togglePanel() {
    state.isOpen = !state.isOpen;
    const panel = document.getElementById('va-panel');

    if (state.isOpen) {
      panel.classList.add('open');
      trackEvent('voice_panel_opened');

      if (state.conversationHistory.length === 0) {
        const L = state.langData;
        const welcomeMsg = needsTextFallback ? L.ui.welcomeMessageTextOnly : L.ui.welcomeMessage;
        addMessage(welcomeMsg, 'assistant');
      }
      document.getElementById('va-input').focus();
    } else {
      panel.classList.remove('open');
      if (state.synthesis) state.synthesis.cancel();
      trackEvent('voice_panel_closed');
    }
  }

  // ============================================================
  // EVENT LISTENERS
  // ============================================================

  function initEventListeners() {
    document.getElementById('va-trigger').addEventListener('click', togglePanel);
    document.getElementById('va-close').addEventListener('click', togglePanel);

    document.getElementById('va-send').addEventListener('click', () => {
      sendMessage(document.getElementById('va-input').value);
    });

    document.getElementById('va-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage(e.target.value);
    });

    if (hasSpeechRecognition) {
      initSpeechRecognition();
      const micBtn = document.getElementById('va-mic');
      if (micBtn) {
        micBtn.addEventListener('click', toggleListening);
      }
    }
  }

  // ============================================================
  // KB-POWERED FALLBACK LOADER
  // ============================================================

  /**
   * Load tenant-specific KB fallback from server
   * This enables intelligent responses even when main API fails
   */
  /**
   * Load tenant-specific KB fallback from server
   * DISABLED - Zero Regex Policy
   */
  async function loadTenantFallback(lang) {
    // Feature disabled by strict policy
  }


  // ============================================================
  // INITIALIZATION
  // ============================================================

  async function init() {
    try {
      const lang = detectLanguage();
      await loadLanguage(lang);

      // Load KB-powered fallback for this tenant
      await loadTenantFallback(lang);

      // Generate session ID for AG-UI threading
      state.conversationContext.sessionId = AGUI.generateId('session');

      captureAttribution(); // Session 177: MarEng Injector
      createWidget();
      trackEvent('voice_widget_loaded', { language: state.currentLang });

      // AG-UI: Initial state snapshot
      AGUI.stateSnapshot({
        version: '2.1.0',
        language: state.currentLang,
        capabilities: {
          speechRecognition: hasSpeechRecognition,
          speechSynthesis: hasSpeechSynthesis,
          textFallback: needsTextFallback
        },
        sessionId: state.conversationContext.sessionId
      });
    } catch (error) {
      console.error('[VocalIA] Init error:', error);
    }
  }

  // Expose AG-UI module for external integrations
  window.VocaliaAGUI = AGUI;

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
