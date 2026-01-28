/**
 * 3A Automation - Voice Assistant Widget Core
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
    BOOKING_API: 'https://script.google.com/macros/s/AKfycbw9JP0YCJV47HL5zahXHweJgjEfNsyiFYFKZXGFUTS9c3SKrmRZdJEg0tcWnvA-P2Jl/exec',

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
      console.error('[3A Voice] Language load error:', error);
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
    console.log(`[3A Voice] SOTA Signal: ${eventName}`, eventData);
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
      console.log('[3A Voice] Attribution Captured:', attr);
    }
  }

  // ============================================================
  // WIDGET UI
  // ============================================================

  function createWidget() {
    if (document.getElementById('voice-assistant-widget')) {
      console.log('[3A Voice] Widget already exists');
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
        @media (max-width: 480px) { .va-panel { width: calc(100vw - 40px); ${position}: -10px; } }
      </style>

      <button class="va-trigger" id="va-trigger" aria-label="${L.ui.ariaOpenAssistant}">
        <img src="/logo.png" alt="3A" />
      </button>

      <div class="va-panel" id="va-panel">
        <div class="va-header">
          <div class="va-header-icon">
            <img src="/logo.png" alt="3A" />
          </div>
          <div class="va-header-text">
            <h3>${L.ui.headerTitle}</h3>
            <p>${needsTextFallback ? L.ui.headerSubtitleText : L.ui.headerSubtitleVoice}</p>
          </div>
          <button class="va-close" id="va-close" aria-label="${L.ui.ariaClose}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>

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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
    messageDiv.innerHTML = `<div class="va-message-content">${text}</div>`;
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
      console.error('[3A Voice] Slots fetch error:', error);
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
    try {
      const response = await fetch(CONFIG.BOOKING_API, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(data)
      });
      return await response.json();
    } catch (error) {
      console.error('[3A Voice] Booking error:', error);
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
      if (bookingResponse) return bookingResponse;
    }

    // 2. Check for booking intent
    if (isBookingIntent(lower)) {
      ctx.bookingFlow.active = true;
      ctx.bookingFlow.step = 'name';
      ctx.bookingFlow.data.service = L.booking.service;
      trackEvent('voice_booking_started', { step: 'name' });
      return L.booking.messages.start;
    }

    // 3. Update context with detected industry/need
    const detectedIndustry = detectIndustry(userMessage);
    if (detectedIndustry) ctx.industry = detectedIndustry;

    const detectedNeed = detectNeed(userMessage);
    if (detectedNeed) ctx.need = detectedNeed;

    // 4. Check for "yes" confirmation based on last topic
    if (L.topics.yes.keywords.some(kw => lower.includes(kw))) {
      const yesResponses = L.topics.yes.responses;
      if (ctx.lastTopic && yesResponses[ctx.lastTopic]) {
        return yesResponses[ctx.lastTopic];
      }
      return yesResponses.default;
    }

    // 5. Check all topics
    for (const [topic, data] of Object.entries(L.topics)) {
      if (topic === 'yes') continue; // Already handled above

      if (data.keywords.some(kw => lower.includes(kw))) {
        ctx.lastTopic = topic;

        // Special case: leads -> adapt to industry
        if (topic === 'leads' && ctx.industry && L.industries[ctx.industry]?.leads) {
          return L.industries[ctx.industry].leads + L.defaults.leadsFollowup;
        }

        if (data.response) return data.response;
      }
    }

    // 6. Industry-specific response
    if (ctx.industry && L.industries[ctx.industry]) {
      const industryData = L.industries[ctx.industry];

      // If asking about services
      if (lower.includes('service') || lower.includes('automation') || lower.includes('أتمتة') || lower.includes('automatisation')) {
        ctx.lastTopic = 'services';
        return industryData.services + L.defaults.servicesFollowup;
      }

      // First time mentioning industry
      const introStart = industryData.intro.substring(0, 30);
      if (!state.conversationHistory.some(m => m.content.includes(introStart))) {
        return industryData.intro + L.defaults.industryFollowup;
      }
    }

    // 7. If quote need detected
    if (ctx.need === 'quote') {
      ctx.lastTopic = 'pricing';
      return L.topics.pricing.response;
    }

    // 8. Industry-based smart default
    if (ctx.industry) {
      return L.defaults.industryResponse.replace('{industry}', ctx.industry.toUpperCase());
    }

    // 9. True default - qualification question
    return L.defaults.qualificationQuestion;
  }

  // ============================================================
  // MESSAGE HANDLING
  // ============================================================

  async function sendMessage(text) {
    if (!text.trim()) return;

    addMessage(text, 'user');
    document.getElementById('va-input').value = '';
    showTyping();

    try {
      const response = await getAIResponse(text);
      hideTyping();
      addMessage(response, 'assistant');
    } catch (error) {
      hideTyping();
      addMessage(state.langData.ui.errorMessage, 'assistant');
      console.error('[3A Voice] Response error:', error);
    }
  }

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
  // INITIALIZATION
  // ============================================================

  async function init() {
    try {
      const lang = detectLanguage();
      console.log(`[3A Voice] Detected language: ${lang}`);

      await loadLanguage(lang);
      console.log(`[3A Voice] Loaded language: ${state.currentLang}`);

      captureAttribution(); // Session 177: MarEng Injector
      createWidget();
      trackEvent('voice_widget_loaded', { language: state.currentLang });

    } catch (error) {
      console.error('[3A Voice] Init error:', error);
    }
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
