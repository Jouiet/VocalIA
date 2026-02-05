/**
 * VocalIA - Voice Assistant Widget Core
 * Version: 3.0.0
 *
 * Unified widget that loads language-specific translations
 * Supports: FR, EN, ES, AR, Darija (ary)
 * Features:
 * - Auto-detection of speaker language (5 supported languages)
 * - Hybrid text+voice input (text default, voice opt-in)
 * - E-commerce product display (Phase 1 - Session 250.74)
 *   - Product cards with image, price, stock status
 *   - Product carousel for recommendations/search results
 *   - Voice vs text input tracking for A/B testing
 *   - Catalog API integration with tenant isolation
 */

(function () {
  'use strict';

  // ============================================================
  // CONFIGURATION
  // ============================================================

  const CONFIG = {
    // Supported languages - All 5 languages
    SUPPORTED_LANGS: ['fr', 'en', 'es', 'ar', 'ary'],
    DEFAULT_LANG: 'fr',

    // Paths
    LANG_PATH: '/voice-assistant/lang/voice-{lang}.json',
    BOOKING_API: 'https://script.google.com/macros/s/AKfycbw9JP0YCJV47HL5zahXHweJgjEfNsyiFYFKZXGFUTS9c3SKrmRZdJEg0tcWnvA-P2Jl/exec',

    // Voice API (AI Mode)
    // Auto-detect: localhost = dev, otherwise = prod
    VOICE_API_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:3004/respond'  // Dev: local Voice API
      : 'https://api.vocalia.ma/respond', // Prod: deployed API
    AI_MODE: true, // true = use Voice API with personas, false = pattern matching fallback
    API_TIMEOUT: 10000, // 10 seconds

    // Catalog API (E-commerce Mode)
    CATALOG_API_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:3013/api/tenants'  // Dev: local DB API
      : 'https://api.vocalia.ma/api/tenants', // Prod: deployed API
    ECOMMERCE_MODE: true, // Enable product display in widget
    MAX_CAROUSEL_ITEMS: 5, // Maximum products in carousel

    // Exit-Intent Voice Popup (UNIQUE COMPETITIVE ADVANTAGE - Session 250.78)
    EXIT_INTENT_ENABLED: true,
    EXIT_INTENT_DELAY: 3000, // Min time on page before showing (ms)
    EXIT_INTENT_SENSITIVITY: 20, // Mouse exit threshold (px from top)
    EXIT_INTENT_COOLDOWN: 86400000, // Once per 24h per user
    EXIT_INTENT_MOBILE_SCROLL_RATIO: 0.3, // Show on 30% scroll up
    EXIT_INTENT_PAGES: null, // null = all pages, array = specific paths

    // Social Proof/FOMO Notifications (Session 250.78)
    SOCIAL_PROOF_ENABLED: true,
    SOCIAL_PROOF_INTERVAL: 25000, // Show every 25 seconds
    SOCIAL_PROOF_DURATION: 5000, // Toast visible for 5 seconds
    SOCIAL_PROOF_MAX_SHOWN: 5, // Max notifications per session
    SOCIAL_PROOF_DELAY: 8000, // Initial delay before first notification

    // Branding
    primaryColor: '#4FBAF1',
    primaryDark: '#2B6685',
    accentColor: '#10B981',
    darkBg: '#191E35',

    // Cache
    SLOT_CACHE_TTL: 5 * 60 * 1000, // 5 minutes
    CATALOG_CACHE_TTL: 5 * 60 * 1000, // 5 minutes

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
    sessionId: `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    tenantId: null, // Set via data attribute or URL
    availableSlotsCache: { slots: [], timestamp: 0 },
    catalogCache: { products: [], timestamp: 0 },
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
    },
    // E-commerce tracking (Phase 1)
    ecommerce: {
      inputMethodStats: { voice: 0, text: 0 },
      productsViewed: [],
      carouselsDisplayed: 0,
      productClicks: 0,
      lastInputMethod: null
    },
    // Exit-Intent Voice Popup (Session 250.78)
    exitIntent: {
      shown: false,
      dismissed: false,
      pageLoadTime: Date.now(),
      lastScrollY: 0,
      triggered: false
    },
    // Social Proof/FOMO (Session 250.78)
    socialProof: {
      notificationsShown: 0,
      intervalId: null,
      lastShownTime: 0
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
   * SOTA: Sovereign Dynamic Pull - Load tenant-specific configuration
   */
  async function loadTenantConfig() {
    if (!state.tenantId) return;

    console.log(`[VocalIA] SOTA: Pulling dynamic config for tenant: ${state.tenantId}`);
    const url = `${CONFIG.VOICE_API_URL.replace('/respond', '/config')}?tenantId=${encodeURIComponent(state.tenantId)}`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Config pull failed');

      const data = await response.json();
      if (data.success) {
        // Apply branding
        if (data.branding.primaryColor) {
          CONFIG.primaryColor = data.branding.primaryColor;
          // Update CSS variables if widget already created
          const root = document.getElementById('voice-assistant-widget');
          if (root) {
            root.style.setProperty('--va-primary', CONFIG.primaryColor);
          }
        }

        state.tenantConfig = data;
        trackEvent('tenant_config_loaded', { tenantId: state.tenantId });
        return data;
      }
    } catch (error) {
      console.warn('[VocalIA] Sovereign Pull failed, using static defaults:', error.message);
    }
    return null;
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
    console.log(`[VocalIA] SOTA Signal: ${eventName}`, eventData);
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
      console.log('[VocalIA] Attribution Captured:', attr);
    }
  }

  // ============================================================
  // WIDGET UI
  // ============================================================

  function createWidget() {
    if (document.getElementById('voice-assistant-widget')) {
      console.log('[VocalIA] Widget already exists');
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

        /* Voice Waveform Visualizer (SOTA 2026) */
        .va-visualizer {
          height: 48px; padding: 8px 16px; display: none;
          background: linear-gradient(180deg, rgba(79,186,241,0.1) 0%, transparent 100%);
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .va-visualizer.active { display: block; animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .va-visualizer-canvas {
          width: 100%; height: 100%; display: block;
        }
        .va-visualizer-bars {
          display: flex; align-items: center; justify-content: center;
          gap: 3px; height: 100%;
        }
        .va-visualizer-bar {
          width: 3px; border-radius: 2px; background: var(--va-primary);
          transition: height 0.1s ease;
        }
        .va-visualizer-bars.speaking .va-visualizer-bar {
          animation: soundBar 0.5s ease-in-out infinite alternate;
        }
        @keyframes soundBar {
          0% { height: 4px; opacity: 0.5; }
          100% { height: var(--bar-height, 24px); opacity: 1; }
        }
        .va-visualizer-bar:nth-child(1) { animation-delay: 0.0s; --bar-height: 20px; }
        .va-visualizer-bar:nth-child(2) { animation-delay: 0.1s; --bar-height: 32px; }
        .va-visualizer-bar:nth-child(3) { animation-delay: 0.2s; --bar-height: 24px; }
        .va-visualizer-bar:nth-child(4) { animation-delay: 0.1s; --bar-height: 28px; }
        .va-visualizer-bar:nth-child(5) { animation-delay: 0.15s; --bar-height: 36px; }
        .va-visualizer-bar:nth-child(6) { animation-delay: 0.2s; --bar-height: 32px; }
        .va-visualizer-bar:nth-child(7) { animation-delay: 0.25s; --bar-height: 20px; }
        .va-visualizer-bar:nth-child(8) { animation-delay: 0.15s; --bar-height: 28px; }
        .va-visualizer-bar:nth-child(9) { animation-delay: 0.1s; --bar-height: 24px; }
        .va-visualizer-bar:nth-child(10) { animation-delay: 0.05s; --bar-height: 16px; }
        .va-visualizer-label {
          font-size: 10px; color: rgba(255,255,255,0.5); text-align: center;
          margin-top: 4px; text-transform: uppercase; letter-spacing: 1px;
        }
        .va-visualizer-label.listening { color: #ef4444; }
        .va-visualizer-label.speaking { color: var(--va-primary); }
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

        /* E-commerce Product Cards & Carousel (Phase 1) */
        .va-product-carousel {
          display: flex; gap: 12px; overflow-x: auto; padding: 8px 0 12px;
          scrollbar-width: thin; scrollbar-color: var(--va-primary) transparent;
          scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch;
        }
        .va-product-carousel::-webkit-scrollbar { height: 4px; }
        .va-product-carousel::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 4px; }
        .va-product-carousel::-webkit-scrollbar-thumb { background: var(--va-primary); border-radius: 4px; }
        .va-product-card {
          flex: 0 0 auto; width: 140px; background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
          overflow: hidden; cursor: pointer; transition: all 0.2s ease;
          scroll-snap-align: start;
        }
        .va-product-card:hover {
          border-color: var(--va-primary); transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(79, 186, 241, 0.2);
        }
        .va-product-card.featured {
          border-color: var(--va-accent);
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(255,255,255,0.05) 100%);
        }
        .va-product-img {
          width: 100%; height: 100px; object-fit: cover;
          background: rgba(255,255,255,0.1);
        }
        .va-product-img-placeholder {
          width: 100%; height: 100px; display: flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, rgba(79,186,241,0.1) 0%, rgba(16,185,129,0.1) 100%);
          color: rgba(255,255,255,0.3); font-size: 32px;
        }
        .va-product-info { padding: 10px; }
        .va-product-name {
          font-size: 12px; font-weight: 600; color: #e5e5e5;
          margin: 0 0 4px; line-height: 1.3;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        .va-product-price {
          font-size: 14px; font-weight: 700; color: var(--va-primary);
          display: flex; align-items: baseline; gap: 4px;
        }
        .va-product-price-old {
          font-size: 10px; color: rgba(255,255,255,0.4);
          text-decoration: line-through; font-weight: 400;
        }
        .va-product-badge {
          position: absolute; top: 8px; ${position}: 8px;
          background: var(--va-accent); color: white; font-size: 9px;
          padding: 2px 6px; border-radius: 4px; font-weight: 600; text-transform: uppercase;
        }
        .va-product-badge.sale { background: #ef4444; }
        .va-product-badge.new { background: var(--va-primary); }
        .va-product-stock {
          font-size: 10px; color: rgba(255,255,255,0.5); margin-top: 4px;
        }
        .va-product-stock.low { color: #f59e0b; }
        .va-product-stock.out { color: #ef4444; }
        .va-carousel-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 8px 0; margin-bottom: 4px;
        }
        .va-carousel-title {
          font-size: 13px; font-weight: 600; color: #e5e5e5;
          display: flex; align-items: center; gap: 6px;
        }
        .va-carousel-title svg { width: 16px; height: 16px; fill: var(--va-primary); }
        .va-carousel-nav {
          display: flex; gap: 4px;
        }
        .va-carousel-nav button {
          width: 24px; height: 24px; border-radius: 50%; border: none;
          background: rgba(255,255,255,0.1); color: white; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s;
        }
        .va-carousel-nav button:hover { background: var(--va-primary); }
        .va-carousel-nav button:disabled { opacity: 0.3; cursor: not-allowed; }
        .va-carousel-nav button svg { width: 14px; height: 14px; fill: currentColor; }
        .va-product-actions {
          display: flex; gap: 4px; margin-top: 8px;
        }
        .va-product-btn {
          flex: 1; padding: 6px 8px; border-radius: 6px; border: none;
          font-size: 10px; font-weight: 600; cursor: pointer; transition: all 0.2s;
        }
        .va-product-btn.primary {
          background: var(--va-primary); color: white;
        }
        .va-product-btn.primary:hover { background: var(--va-primary-dark); }
        .va-product-btn.secondary {
          background: rgba(255,255,255,0.1); color: #e5e5e5;
        }
        .va-product-btn.secondary:hover { background: rgba(255,255,255,0.2); }
        .va-single-product {
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px; padding: 12px; margin: 8px 0;
        }
        .va-single-product-row { display: flex; gap: 12px; }
        .va-single-product-img {
          width: 80px; height: 80px; border-radius: 8px; object-fit: cover;
          background: rgba(255,255,255,0.1); flex-shrink: 0;
        }
        .va-single-product-details { flex: 1; min-width: 0; }
        .va-single-product-name {
          font-size: 14px; font-weight: 600; color: #e5e5e5; margin: 0 0 4px;
        }
        .va-single-product-desc {
          font-size: 11px; color: rgba(255,255,255,0.6); margin: 0 0 8px;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        .va-single-product-price {
          font-size: 16px; font-weight: 700; color: var(--va-primary);
        }
        .va-input-method-indicator {
          position: absolute; top: 12px; ${isRTL ? 'left' : 'right'}: 50px;
          font-size: 10px; color: rgba(255,255,255,0.4); display: flex; gap: 8px;
        }
        .va-input-method-indicator span {
          display: flex; align-items: center; gap: 3px;
        }
        .va-input-method-indicator svg { width: 12px; height: 12px; fill: currentColor; }
        .va-input-method-indicator .active { color: var(--va-primary); }
      </style>

      <button class="va-trigger" id="va-trigger" aria-label="${L.ui.ariaOpenAssistant}">
        <img src="/logo.png" alt="VocalIA" />
      </button>

      <div class="va-panel" id="va-panel">
        <div class="va-header">
          <div class="va-header-icon">
            <img src="/logo.png" alt="VocalIA" />
          </div>
          <div class="va-header-text">
            <h3>${L.ui.headerTitle}</h3>
            <p>${needsTextFallback ? L.ui.headerSubtitleText : L.ui.headerSubtitleVoice}</p>
          </div>
          <button class="va-close" id="va-close" aria-label="${L.ui.ariaClose}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>

        <!-- Voice Waveform Visualizer (SOTA 2026) -->
        <div class="va-visualizer" id="va-visualizer">
          <div class="va-visualizer-bars" id="va-visualizer-bars">
            ${Array.from({ length: 10 }, () => '<div class="va-visualizer-bar"></div>').join('')}
          </div>
          <div class="va-visualizer-label" id="va-visualizer-label">${L.ui.voiceReady || 'Voice Ready'}</div>
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
  // E-COMMERCE PRODUCT DISPLAY (Phase 1)
  // ============================================================

  /**
   * Track input method (voice vs text)
   * @param {string} method - 'voice' or 'text'
   */
  function trackInputMethod(method) {
    if (method !== 'voice' && method !== 'text') return;

    state.ecommerce.inputMethodStats[method]++;
    state.ecommerce.lastInputMethod = method;

    trackEvent('input_method_used', {
      method,
      total_voice: state.ecommerce.inputMethodStats.voice,
      total_text: state.ecommerce.inputMethodStats.text,
      voice_ratio: state.ecommerce.inputMethodStats.voice /
        (state.ecommerce.inputMethodStats.voice + state.ecommerce.inputMethodStats.text)
    });
  }

  /**
   * Format price with currency
   * @param {number} price - Price value
   * @param {string} currency - Currency code (default: MAD)
   * @returns {string} Formatted price
   */
  function formatPrice(price, currency = 'MAD') {
    const currencySymbols = {
      'MAD': 'DH',
      'EUR': '€',
      'USD': '$',
      'GBP': '£'
    };

    const symbol = currencySymbols[currency] || currency;
    const formatted = price.toLocaleString(state.currentLang || 'fr', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });

    // Position based on currency
    if (currency === 'EUR' || currency === 'USD' || currency === 'GBP') {
      return `${symbol}${formatted}`;
    }
    return `${formatted} ${symbol}`;
  }

  /**
   * Generate product card HTML
   * @param {object} product - Product data
   * @param {boolean} featured - Is featured product
   * @returns {string} HTML string
   */
  function generateProductCardHTML(product, featured = false) {
    const hasImage = product.image || product.images?.[0];
    const inStock = product.available !== false && product.in_stock !== false;
    const stockLevel = product.stock;
    const isOnSale = product.compare_at_price && product.compare_at_price > product.price;
    const isNew = product.created_at &&
      (Date.now() - new Date(product.created_at).getTime()) < 7 * 24 * 60 * 60 * 1000;

    let stockClass = '';
    let stockText = '';
    if (!inStock) {
      stockClass = 'out';
      stockText = state.langData?.ecommerce?.outOfStock || 'Rupture';
    } else if (stockLevel !== undefined && stockLevel < 5) {
      stockClass = 'low';
      stockText = state.langData?.ecommerce?.lowStock?.replace('{n}', stockLevel) || `Plus que ${stockLevel}`;
    }

    let badgeHTML = '';
    if (isOnSale) {
      const discount = Math.round((1 - product.price / product.compare_at_price) * 100);
      badgeHTML = `<span class="va-product-badge sale">-${discount}%</span>`;
    } else if (isNew) {
      badgeHTML = `<span class="va-product-badge new">${state.langData?.ecommerce?.new || 'Nouveau'}</span>`;
    }

    return `
      <div class="va-product-card ${featured ? 'featured' : ''}" data-product-id="${product.id}" style="position: relative;">
        ${badgeHTML}
        ${hasImage
        ? `<img class="va-product-img" src="${product.image || product.images[0]}" alt="${product.name}" loading="lazy" />`
        : `<div class="va-product-img-placeholder">📦</div>`
      }
        <div class="va-product-info">
          <p class="va-product-name">${product.name}</p>
          <div class="va-product-price">
            ${formatPrice(product.price, product.currency)}
            ${isOnSale ? `<span class="va-product-price-old">${formatPrice(product.compare_at_price, product.currency)}</span>` : ''}
          </div>
          ${stockText ? `<p class="va-product-stock ${stockClass}">${stockText}</p>` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Add a single product card to messages
   * @param {object} product - Product data
   * @param {string} context - Display context ('recommendation', 'search', 'detail')
   */
  function addProductCard(product, context = 'detail') {
    if (!product) return;

    const messagesContainer = document.getElementById('va-messages');
    const productDiv = document.createElement('div');
    productDiv.className = 'va-message assistant';

    const hasImage = product.image || product.images?.[0];
    const inStock = product.available !== false && product.in_stock !== false;

    productDiv.innerHTML = `
      <div class="va-message-content">
        <div class="va-single-product" data-product-id="${product.id}">
          <div class="va-single-product-row">
            ${hasImage
        ? `<img class="va-single-product-img" src="${product.image || product.images[0]}" alt="${product.name}" />`
        : `<div class="va-single-product-img" style="display:flex;align-items:center;justify-content:center;font-size:32px;">📦</div>`
      }
            <div class="va-single-product-details">
              <h4 class="va-single-product-name">${product.name}</h4>
              ${product.description ? `<p class="va-single-product-desc">${product.description}</p>` : ''}
              <div class="va-single-product-price">${formatPrice(product.price, product.currency)}</div>
            </div>
          </div>
          <div class="va-product-actions">
            <button class="va-product-btn primary" onclick="window.VocalIA.viewProduct('${product.id}')" ${!inStock ? 'disabled' : ''}>
              ${inStock
        ? (state.langData?.ecommerce?.viewDetails || 'Voir détails')
        : (state.langData?.ecommerce?.notifyMe || 'Me notifier')
      }
            </button>
            ${product.url ? `<button class="va-product-btn secondary" onclick="window.open('${product.url}', '_blank')">
              ${state.langData?.ecommerce?.buyNow || 'Acheter'}
            </button>` : ''}
          </div>
        </div>
      </div>
    `;

    messagesContainer.appendChild(productDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Track product view
    state.ecommerce.productsViewed.push(product.id);
    trackEvent('product_viewed', {
      product_id: product.id,
      product_name: product.name,
      price: product.price,
      context,
      input_method: state.ecommerce.lastInputMethod
    });
  }

  /**
   * Add a product carousel to messages
   * @param {array} products - Array of products
   * @param {string} title - Carousel title
   * @param {string} context - Display context ('recommendations', 'search_results', 'category')
   */
  function addProductCarousel(products, title = null, context = 'recommendations') {
    if (!products || products.length === 0) return;

    const L = state.langData;
    const isRTL = L?.meta?.rtl;
    const messagesContainer = document.getElementById('va-messages');
    const carouselDiv = document.createElement('div');
    carouselDiv.className = 'va-message assistant';

    const carouselId = `carousel-${Date.now()}`;
    const displayProducts = products.slice(0, CONFIG.MAX_CAROUSEL_ITEMS);

    const defaultTitles = {
      recommendations: L?.ecommerce?.recommendedForYou || 'Recommandé pour vous',
      search_results: L?.ecommerce?.searchResults || 'Résultats',
      category: L?.ecommerce?.fromCategory || 'De cette catégorie',
      popular: L?.ecommerce?.popular || 'Populaires',
      related: L?.ecommerce?.relatedProducts || 'Produits similaires'
    };

    const displayTitle = title || defaultTitles[context] || defaultTitles.recommendations;

    carouselDiv.innerHTML = `
      <div class="va-message-content" style="padding: 8px 10px;">
        <div class="va-carousel-header">
          <span class="va-carousel-title">
            <svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            ${displayTitle}
          </span>
          <div class="va-carousel-nav">
            <button onclick="document.getElementById('${carouselId}').scrollBy({left: ${isRTL ? '150' : '-150'}, behavior: 'smooth'})" aria-label="Previous">
              <svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
            </button>
            <button onclick="document.getElementById('${carouselId}').scrollBy({left: ${isRTL ? '-150' : '150'}, behavior: 'smooth'})" aria-label="Next">
              <svg viewBox="0 0 24 24"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>
            </button>
          </div>
        </div>
        <div class="va-product-carousel" id="${carouselId}">
          ${displayProducts.map((product, index) =>
      generateProductCardHTML(product, index === 0)
    ).join('')}
        </div>
      </div>
    `;

    messagesContainer.appendChild(carouselDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Add click handlers to product cards
    carouselDiv.querySelectorAll('.va-product-card').forEach(card => {
      card.addEventListener('click', () => {
        const productId = card.dataset.productId;
        const product = displayProducts.find(p => p.id === productId);
        if (product) {
          state.ecommerce.productClicks++;
          trackEvent('product_card_clicked', {
            product_id: productId,
            product_name: product.name,
            price: product.price,
            position: displayProducts.indexOf(product),
            carousel_context: context,
            input_method: state.ecommerce.lastInputMethod
          });

          // Show product details
          addProductCard(product, 'carousel_click');
        }
      });
    });

    // Track carousel display
    state.ecommerce.carouselsDisplayed++;
    trackEvent('product_carousel_displayed', {
      products_count: displayProducts.length,
      context,
      product_ids: displayProducts.map(p => p.id),
      input_method: state.ecommerce.lastInputMethod
    });
  }

  /**
   * Fetch products from catalog API
   * @param {object} options - Fetch options
   * @returns {Promise<array>} Products array
   */
  async function fetchCatalogProducts(options = {}) {
    if (!CONFIG.ECOMMERCE_MODE || !state.tenantId) {
      return [];
    }

    // Check cache
    const cacheKey = JSON.stringify({ tenantId: state.tenantId, ...options });
    const now = Date.now();
    if (state.catalogCache.key === cacheKey &&
      (now - state.catalogCache.timestamp) < CONFIG.CATALOG_CACHE_TTL) {
      return state.catalogCache.products;
    }

    try {
      const endpoint = options.search
        ? `${CONFIG.CATALOG_API_URL}/${state.tenantId}/catalog/search`
        : `${CONFIG.CATALOG_API_URL}/${state.tenantId}/catalog/items`;

      const params = new URLSearchParams();
      if (options.category) params.append('category', options.category);
      if (options.search) params.append('q', options.search);
      if (options.limit) params.append('limit', options.limit);

      const url = params.toString() ? `${endpoint}?${params}` : endpoint;

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(CONFIG.API_TIMEOUT)
      });

      if (!response.ok) {
        console.warn('[VocalIA] Catalog API error:', response.status);
        return [];
      }

      const data = await response.json();
      const products = data.items || data.results || data.products || [];

      // Update cache
      state.catalogCache = {
        key: cacheKey,
        products,
        timestamp: now
      };

      return products;
    } catch (error) {
      console.warn('[VocalIA] Catalog fetch error:', error.message);
      return [];
    }
  }

  /**
   * Detect product intent in user message
   * @param {string} text - User message
   * @returns {object|null} Product intent data
   */
  function detectProductIntent(text) {
    const lower = text.toLowerCase();
    const L = state.langData;

    // Product search keywords
    const searchKeywords = L?.ecommerce?.searchKeywords || [
      'cherche', 'recherche', 'trouve', 'looking for', 'search', 'find',
      'busco', 'necesito', 'quiero', 'بحث', 'نبغي', 'باغي'
    ];

    // Category keywords
    const categoryKeywords = L?.ecommerce?.categoryKeywords || {
      'electronics': ['téléphone', 'phone', 'laptop', 'ordinateur', 'إلكترونيات'],
      'clothing': ['vêtement', 'clothes', 'robe', 'pantalon', 'ملابس', 'حوايج'],
      'food': ['nourriture', 'food', 'manger', 'أكل', 'ماكلة'],
      'beauty': ['beauté', 'cosmétique', 'beauty', 'makeup', 'زينة', 'جمال']
    };

    // Recommendation keywords
    const recommendKeywords = L?.ecommerce?.recommendKeywords || [
      'recommande', 'suggère', 'propose', 'recommend', 'suggest',
      'recomienda', 'sugiere', 'نصحني', 'شوف لي', 'قترح'
    ];

    // Check for search intent
    const isSearch = searchKeywords.some(kw => lower.includes(kw));

    // Check for recommendation intent
    const isRecommend = recommendKeywords.some(kw => lower.includes(kw));

    // Detect category
    let category = null;
    for (const [cat, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(kw => lower.includes(kw))) {
        category = cat;
        break;
      }
    }

    // Extract search query (simple extraction)
    let searchQuery = null;
    if (isSearch) {
      // Remove common words and extract potential product name
      const words = text.split(/\s+/).filter(w =>
        w.length > 2 && !searchKeywords.includes(w.toLowerCase())
      );
      if (words.length > 0) {
        searchQuery = words.slice(-3).join(' '); // Last 3 words as query
      }
    }

    if (isSearch || isRecommend || category) {
      return {
        type: isSearch ? 'search' : (isRecommend ? 'recommend' : 'category'),
        category,
        query: searchQuery
      };
    }

    return null;
  }

  // Expose functions for external access
  window.VocalIA = window.VocalIA || {};
  window.VocalIA.viewProduct = async function (productId) {
    if (!state.tenantId) return;

    try {
      const response = await fetch(
        `${CONFIG.CATALOG_API_URL}/${state.tenantId}/catalog/items/${productId}`,
        { signal: AbortSignal.timeout(CONFIG.API_TIMEOUT) }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.item) {
          addProductCard(data.item, 'detail_view');
        }
      }
    } catch (error) {
      console.warn('[VocalIA] Product detail error:', error.message);
    }
  };

  window.VocalIA.displayProducts = function (products, title, context) {
    addProductCarousel(products, title, context);
  };

  window.VocalIA.getEcommerceStats = function () {
    return {
      ...state.ecommerce,
      voiceRatio: state.ecommerce.inputMethodStats.voice /
        Math.max(1, state.ecommerce.inputMethodStats.voice + state.ecommerce.inputMethodStats.text)
    };
  };

  // ============================================================
  // AI RECOMMENDATIONS INTEGRATION (Session 250.79)
  // ============================================================

  /**
   * Show AI-powered product recommendations
   * @param {Array} products - Array of product objects
   * @param {string} type - Type: 'similar', 'bought_together', 'personalized'
   * @param {string} title - Optional custom title
   */
  window.VocalIA.showRecommendations = function (products, type = 'similar', title = null) {
    if (!products || products.length === 0) return;

    const contextMap = {
      similar: 'related',
      bought_together: 'recommendations',
      personalized: 'recommendations'
    };

    // Track recommendation display
    if (typeof gtag === 'function') {
      gtag('event', 'ai_recommendations_shown', {
        event_category: 'recommendations',
        recommendation_type: type,
        items_count: products.length
      });
    }

    addProductCarousel(products, title, contextMap[type] || 'recommendations');
  };

  /**
   * Fetch and display AI recommendations from backend
   * @param {string} productId - Current product ID for similar/bought_together
   * @param {Array} productIds - Array of product IDs for cart-based recommendations
   * @param {string} type - Recommendation type
   */
  window.VocalIA.getAIRecommendations = async function (productId, productIds = [], type = 'similar') {
    if (!state.tenantId) return null;

    try {
      const body = {
        tenant_id: state.tenantId,
        recommendation_type: type
      };

      if (productId) body.product_id = productId;
      if (productIds.length > 0) body.product_ids = productIds;

      const response = await fetch(`${CONFIG.API_BASE_URL}/api/recommendations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.API_KEY || ''}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) return null;

      const data = await response.json();

      if (data.success && data.recommendations?.length > 0) {
        // Enrich recommendations with full product data if available
        const enrichedProducts = await Promise.all(
          data.recommendations.map(async (rec) => {
            if (rec.productId && !rec.title) {
              // Fetch full product data
              const productData = await fetchProductDetails(rec.productId);
              return { ...rec, ...productData };
            }
            return rec;
          })
        );

        window.VocalIA.showRecommendations(enrichedProducts, type);
        return enrichedProducts;
      }

      return null;
    } catch (error) {
      console.error('[VocalIA] Recommendations error:', error);
      return null;
    }
  };

  // Helper to fetch product details
  async function fetchProductDetails(productId) {
    if (!state.tenantId) return {};

    try {
      const response = await fetch(
        `${CONFIG.API_BASE_URL}/api/tenants/${state.tenantId}/catalog/items/${productId}`
      );
      if (response.ok) {
        const data = await response.json();
        return data.item || {};
      }
    } catch (e) {
      // Silently fail - product will show with limited info
    }
    return {};
  }

  // ============================================================
  // VOICE QUIZ INTEGRATION (Sprint 3 - Session 250.79)
  // ============================================================

  /**
   * Start a voice-guided product quiz
   * @param {string} template - Quiz template ('skincare', 'electronics', 'generic')
   * @param {object} options - Custom options
   */
  window.VocalIA.startQuiz = function (template = 'generic', options = {}) {
    // Lazy load quiz if not already loaded
    if (!window.VocalIAQuiz) {
      console.warn('[VocalIA] Voice Quiz not loaded. Include voice-quiz.js');
      return null;
    }

    const quiz = new window.VocalIAQuiz({
      tenantId: state.tenantId,
      template: template,
      lang: state.langData?.meta?.code || 'fr',
      apiBaseUrl: CONFIG.API_BASE_URL,
      voiceEnabled: true,
      onComplete: (result) => {
        // Track quiz completion
        if (typeof gtag === 'function') {
          gtag('event', 'quiz_completed', {
            event_category: 'voice_quiz',
            template: template,
            answers_count: Object.keys(result.answers).length,
            with_lead: result.withLead
          });
        }

        // Show personalized recommendations based on quiz answers
        if (result.tags?.length > 0) {
          window.VocalIA.getAIRecommendations(null, [], 'personalized');
        }
      },
      onLeadCapture: (lead) => {
        // Track lead capture
        if (typeof gtag === 'function') {
          gtag('event', 'quiz_lead_captured', {
            event_category: 'voice_quiz',
            template: template
          });
        }

        // Sync with UCP
        if (UCP.syncPreference) {
          UCP.recordInteraction({
            type: 'quiz_completed',
            product_id: null,
            metadata: { template, answers: lead.answers }
          });
        }
      },
      ...options
    });

    quiz.show();
    return quiz;
  };

  /**
   * Check if quiz is supported
   */
  window.VocalIA.isQuizSupported = function () {
    return !!window.VocalIAQuiz;
  };

  // ============================================================
  // ABANDONED CART RECOVERY INTEGRATION (Session 250.82)
  // UNIQUE COMPETITIVE ADVANTAGE: +25% recovery vs SMS/email
  // ============================================================

  /**
   * Initialize abandoned cart recovery widget
   * @param {Object} options - Configuration options
   */
  window.VocalIA.initCartRecovery = function (options = {}) {
    if (window.VocaliaAbandonedCart) {
      return window.VocaliaAbandonedCart.init({
        tenantId: state.tenantId || options.tenantId,
        lang: state.currentLang || options.lang,
        ...options
      });
    }
    console.warn('[VocalIA] Abandoned cart widget not loaded. Include abandoned-cart-recovery.js');
    return null;
  };

  /**
   * Trigger cart recovery popup manually
   * @param {string} reason - Reason for triggering (manual, exit, inactivity)
   */
  window.VocalIA.triggerCartRecovery = function (reason = 'manual') {
    if (window.VocaliaAbandonedCart?.getInstance()) {
      window.VocaliaAbandonedCart.getInstance().trigger(reason);
    } else {
      // Auto-init and trigger
      const instance = window.VocalIA.initCartRecovery();
      if (instance) {
        setTimeout(() => instance.trigger(reason), 100);
      }
    }
  };

  /**
   * Set cart data for recovery tracking
   * @param {Object} cartData - Cart data { items: [], total: number, currency: string }
   */
  window.VocalIA.setCartData = function (cartData) {
    // Store locally for widget access
    window.VocalIA.cart = cartData;

    // Update widget if initialized
    if (window.VocaliaAbandonedCart?.getInstance()) {
      window.VocaliaAbandonedCart.getInstance().setCartData(cartData);
    }

    // Track cart value for analytics
    if (typeof gtag === 'function' && cartData.total > 0) {
      gtag('event', 'cart_updated', {
        event_category: 'ecommerce',
        cart_value: cartData.total,
        items_count: cartData.items?.length || 0,
        currency: cartData.currency || 'MAD'
      });
    }
  };

  /**
   * Check if cart recovery is supported
   */
  window.VocalIA.isCartRecoverySupported = function () {
    return !!window.VocaliaAbandonedCart;
  };

  // ============================================================
  // FREE SHIPPING BAR INTEGRATION (P3 - Session 250.83)
  // Benchmark Impact: +15-20% AOV, -10-18% cart abandonment
  // ============================================================

  /**
   * Initialize free shipping progress bar
   * @param {Object} options - Configuration options
   */
  window.VocalIA.initShippingBar = function (options = {}) {
    if (window.VocaliaShippingBar) {
      return window.VocaliaShippingBar.init({
        tenantId: state.tenantId || options.tenantId,
        lang: state.currentLang || options.lang,
        ...options
      });
    }
    console.warn('[VocalIA] Shipping bar widget not loaded. Include free-shipping-bar.js');
    return null;
  };

  /**
   * Update shipping bar progress
   * @param {number} cartValue - Current cart value
   */
  window.VocalIA.updateShippingProgress = function (cartValue) {
    if (window.VocaliaShippingBar?.getInstance()) {
      window.VocaliaShippingBar.getInstance().updateCartValue(cartValue);
    } else if (window.VocaliaShippingBar) {
      const instance = window.VocalIA.initShippingBar();
      if (instance) instance.updateCartValue(cartValue);
    }
  };

  /**
   * Check if shipping bar is supported
   */
  window.VocalIA.isShippingBarSupported = function () {
    return !!window.VocaliaShippingBar;
  };

  // ============================================================
  // SPIN WHEEL GAMIFICATION INTEGRATION (P3 - Session 250.83)
  // Benchmark Impact: +10-15% conversion, +45% email list growth
  // ============================================================

  /**
   * Show spin wheel gamification popup
   * @param {Object} options - Configuration options
   */
  window.VocalIA.showSpinWheel = function (options = {}) {
    if (window.VocaliaSpinWheel) {
      return window.VocaliaSpinWheel.show({
        tenantId: state.tenantId || options.tenantId,
        lang: state.currentLang || options.lang,
        ...options
      });
    }
    console.warn('[VocalIA] Spin wheel widget not loaded. Include spin-wheel.js');
    return null;
  };

  /**
   * Check if spin wheel is available (cooldown check)
   */
  window.VocalIA.isSpinWheelAvailable = function () {
    const lastPlayed = localStorage.getItem('va_spin_wheel_last_played');
    if (!lastPlayed) return true;
    const elapsed = Date.now() - parseInt(lastPlayed, 10);
    return elapsed >= 24 * 60 * 60 * 1000; // 24 hours
  };

  /**
   * Check if spin wheel is supported
   */
  window.VocalIA.isSpinWheelSupported = function () {
    return !!window.VocaliaSpinWheel;
  };

  // ============================================================
  // WIDGET ORCHESTRATOR (Sprint 4 - Session 250.79)
  // ============================================================

  /**
   * Widget Orchestrator - Centralized control for all VocalIA widgets
   * Manages: Voice Widget, Recommendations, Quiz, Exit-Intent, Social Proof, Abandoned Cart, Shipping Bar, Spin Wheel
   * E-commerce Widget Suite: Sprint 1-5 + P3 Widgets Complete (Session 250.83)
   */
  const WidgetOrchestrator = {
    // Widget states (priority: lower = higher priority)
    widgets: {
      voiceChat: { active: false, priority: 1 },
      recommendations: { active: false, priority: 2 },
      quiz: { active: false, priority: 3 },
      exitIntent: { active: false, priority: 4 },
      socialProof: { active: true, priority: 5 },
      abandonedCart: { active: false, priority: 6 },
      spinWheel: { active: false, priority: 7 },
      shippingBar: { active: true, priority: 8 } // Always visible when cart has items
    },

    // Event bus for inter-widget communication
    events: new Map(),

    /**
     * Register event listener
     */
    on(event, callback) {
      if (!this.events.has(event)) {
        this.events.set(event, []);
      }
      this.events.get(event).push(callback);
    },

    /**
     * Emit event to all listeners
     */
    emit(event, data) {
      const listeners = this.events.get(event) || [];
      listeners.forEach(cb => {
        try { cb(data); } catch (e) { console.error('[Orchestrator] Event error:', e); }
      });
    },

    /**
     * Activate a widget (deactivate lower priority if needed)
     */
    activate(widgetName) {
      const widget = this.widgets[widgetName];
      if (!widget) return false;

      widget.active = true;
      this.emit('widget:activated', { widget: widgetName });

      // Track activation
      if (typeof gtag === 'function') {
        gtag('event', 'widget_activated', {
          event_category: 'orchestrator',
          widget_name: widgetName
        });
      }

      return true;
    },

    /**
     * Deactivate a widget
     */
    deactivate(widgetName) {
      const widget = this.widgets[widgetName];
      if (!widget) return false;

      widget.active = false;
      this.emit('widget:deactivated', { widget: widgetName });
      return true;
    },

    /**
     * Check if widget should show (based on priority)
     */
    canShow(widgetName) {
      const widget = this.widgets[widgetName];
      if (!widget) return false;

      // Check if higher priority widget is active
      for (const [name, w] of Object.entries(this.widgets)) {
        if (w.active && w.priority < widget.priority) {
          return false; // Higher priority widget is active
        }
      }
      return true;
    },

    /**
     * Get orchestrator stats
     */
    getStats() {
      return {
        activeWidgets: Object.entries(this.widgets)
          .filter(([_, w]) => w.active)
          .map(([name, _]) => name),
        totalWidgets: Object.keys(this.widgets).length,
        eventListeners: this.events.size
      };
    }
  };

  // Export orchestrator
  window.VocalIA.Orchestrator = WidgetOrchestrator;

  // Wire up existing widgets to orchestrator
  WidgetOrchestrator.on('widget:activated', ({ widget }) => {
    console.log(`[Orchestrator] Widget activated: ${widget}`);
  });

  // ============================================================
  // UCP & MCP INTEGRATION (Phase 1 - Session 250.74)
  // ============================================================

  /**
   * UCP (Unified Customer Profile) Integration
   * Leverages existing VocalIA UCP for personalized recommendations
   */
  const UCP = {
    profile: null,
    ltvTier: 'bronze',

    /**
     * Sync user preferences with UCP
     * @param {string} countryCode - ISO country code
     * @returns {Promise<object>} User profile
     */
    async syncPreference(countryCode = null) {
      if (!state.tenantId) return null;

      try {
        const detected = countryCode || detectCountryCode();
        const endpoint = CONFIG.CATALOG_API_URL.replace('/api/tenants', '/api/ucp/sync');

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: state.tenantId,
            userId: state.sessionId,
            countryCode: detected
          }),
          signal: AbortSignal.timeout(CONFIG.API_TIMEOUT)
        });

        if (response.ok) {
          const data = await response.json();
          UCP.profile = data.profile;
          UCP.ltvTier = data.ltvTier || 'bronze';

          trackEvent('ucp_synced', {
            country: detected,
            ltv_tier: UCP.ltvTier,
            locale: UCP.profile?.locale
          });

          return data;
        }
      } catch (error) {
        console.warn('[VocalIA] UCP sync error:', error.message);
      }
      return null;
    },

    /**
     * Record interaction in UCP
     * @param {string} type - Interaction type
     * @param {object} metadata - Additional data
     */
    async recordInteraction(type, metadata = {}) {
      if (!state.tenantId || !UCP.profile) return;

      try {
        const endpoint = CONFIG.CATALOG_API_URL.replace('/api/tenants', '/api/ucp/interaction');

        await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: state.tenantId,
            userId: state.sessionId,
            type: 'widget_chat',
            channel: 'web_widget',
            metadata: {
              ...metadata,
              input_method: state.ecommerce.lastInputMethod,
              interaction_type: type
            }
          }),
          signal: AbortSignal.timeout(5000)
        });
      } catch (error) {
        // Silent fail for interaction tracking
      }
    },

    /**
     * Track behavioral event
     * @param {string} event - Event name
     * @param {any} value - Event value
     */
    async trackEvent(event, value = null) {
      if (!state.tenantId) return;

      try {
        const endpoint = CONFIG.CATALOG_API_URL.replace('/api/tenants', '/api/ucp/event');

        await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: state.tenantId,
            userId: state.sessionId,
            event,
            value,
            source: state.ecommerce.lastInputMethod === 'voice' ? 'voice' : 'widget'
          }),
          signal: AbortSignal.timeout(5000)
        });
      } catch (error) {
        // Silent fail
      }
    },

    /**
     * Get personalized recommendations based on LTV tier
     * @returns {object} Recommendation strategy
     */
    getRecommendationStrategy() {
      const strategies = {
        bronze: { limit: 3, showPrices: true, upsell: false },
        silver: { limit: 4, showPrices: true, upsell: true },
        gold: { limit: 5, showPrices: true, upsell: true, prioritySupport: true },
        platinum: { limit: 6, showPrices: true, upsell: true, prioritySupport: true, exclusiveOffers: true },
        diamond: { limit: 8, showPrices: true, upsell: true, prioritySupport: true, exclusiveOffers: true, personalAssistant: true }
      };
      return strategies[UCP.ltvTier] || strategies.bronze;
    }
  };

  /**
   * MCP Tools Integration
   * Connect to VocalIA MCP Server for e-commerce operations
   */
  const MCP = {
    /**
     * Fetch products via MCP (Shopify, WooCommerce, etc.)
     * @param {object} options - Fetch options
     * @returns {Promise<array>} Products
     */
    async fetchProducts(options = {}) {
      if (!state.tenantId) return [];

      try {
        // Use tenant-specific catalog endpoint which routes to appropriate connector
        const endpoint = `${CONFIG.CATALOG_API_URL}/${state.tenantId}/catalog/browse`;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: options.category,
            query: options.search,
            limit: options.limit || UCP.getRecommendationStrategy().limit,
            inStock: options.inStock !== false,
            ltvTier: UCP.ltvTier // Pass LTV for prioritization
          }),
          signal: AbortSignal.timeout(CONFIG.API_TIMEOUT)
        });

        if (response.ok) {
          const data = await response.json();
          return data.items || [];
        }
      } catch (error) {
        console.warn('[VocalIA] MCP fetch error:', error.message);
      }
      return [];
    },

    /**
     * Search products across all connected platforms
     * @param {string} query - Search query
     * @returns {Promise<array>} Search results
     */
    async searchProducts(query) {
      if (!state.tenantId || !query) return [];

      try {
        const endpoint = `${CONFIG.CATALOG_API_URL}/${state.tenantId}/catalog/search`;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            q: query,
            limit: UCP.getRecommendationStrategy().limit
          }),
          signal: AbortSignal.timeout(CONFIG.API_TIMEOUT)
        });

        if (response.ok) {
          const data = await response.json();
          return data.results || [];
        }
      } catch (error) {
        console.warn('[VocalIA] MCP search error:', error.message);
      }
      return [];
    },

    /**
     * Get personalized recommendations
     * Uses UCP profile + LTV tier for smart recommendations
     * @returns {Promise<array>} Recommended products
     */
    async getRecommendations() {
      if (!state.tenantId) return [];

      try {
        const endpoint = `${CONFIG.CATALOG_API_URL}/${state.tenantId}/catalog/recommendations`;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: state.sessionId,
            ltvTier: UCP.ltvTier,
            productsViewed: state.ecommerce.productsViewed.slice(-10),
            locale: UCP.profile?.locale || state.currentLang,
            limit: UCP.getRecommendationStrategy().limit
          }),
          signal: AbortSignal.timeout(CONFIG.API_TIMEOUT)
        });

        if (response.ok) {
          const data = await response.json();
          return data.recommendations || [];
        }
      } catch (error) {
        console.warn('[VocalIA] MCP recommendations error:', error.message);
      }
      return [];
    }
  };

  /**
   * Detect country code from various sources
   */
  function detectCountryCode() {
    // 1. Navigator language (rough estimate)
    const lang = navigator.language || navigator.userLanguage || '';
    const langMap = {
      'fr-FR': 'FR', 'fr-MA': 'MA', 'fr-BE': 'BE', 'fr-CA': 'CA',
      'en-US': 'US', 'en-GB': 'GB', 'en-CA': 'CA',
      'es-ES': 'ES', 'es-MX': 'MX',
      'ar-MA': 'MA', 'ar-SA': 'SA', 'ar-AE': 'AE'
    };

    if (langMap[lang]) return langMap[lang];

    // 2. Timezone heuristic
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz.includes('Casablanca')) return 'MA';
    if (tz.includes('Paris')) return 'FR';
    if (tz.includes('London')) return 'GB';
    if (tz.includes('New_York') || tz.includes('Los_Angeles')) return 'US';

    // 3. Default based on widget language
    const langDefaults = { fr: 'FR', en: 'US', es: 'ES', ar: 'MA', ary: 'MA' };
    return langDefaults[state.currentLang] || 'FR';
  }

  // Expose UCP and MCP for external access
  window.VocalIA.UCP = UCP;
  window.VocalIA.MCP = MCP;

  // ============================================================
  // SPEECH SYNTHESIS & RECOGNITION
  // ============================================================

  function speak(text) {
    const lang = state.langData?.meta?.code || state.currentLang || 'fr';

    // For Darija (ary), use ElevenLabs TTS via Voice API
    // Web Speech API doesn't support ar-MA in most browsers
    if (lang === 'ary') {
      speakWithElevenLabs(text, lang);
      return;
    }

    // For other languages, use native Web Speech API
    if (!hasSpeechSynthesis) return;
    state.synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = state.langData.meta.speechSynthesis;
    utterance.rate = lang === 'ar' ? 0.9 : 1.0;

    // Visualizer hooks
    utterance.onstart = () => showVisualizer('speaking');
    utterance.onend = () => hideVisualizer();
    utterance.onerror = () => hideVisualizer();

    state.synthesis.speak(utterance);
  }

  // Session 250.44: ElevenLabs TTS fallback for Darija
  async function speakWithElevenLabs(text, language) {
    const ttsUrl = CONFIG.VOICE_API_URL.replace('/respond', '/tts');

    try {
      const response = await fetch(ttsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language })
      });

      if (!response.ok) {
        console.warn('[TTS] ElevenLabs request failed, falling back to Web Speech API');
        fallbackToWebSpeech(text);
        return;
      }

      const data = await response.json();
      if (data.success && data.audio) {
        // Play base64 audio with visualizer
        const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);

        // Visualizer hooks for ElevenLabs audio
        audio.onplay = () => showVisualizer('speaking');
        audio.onended = () => hideVisualizer();
        audio.onerror = () => hideVisualizer();
        audio.onpause = () => hideVisualizer();

        audio.play().catch(err => {
          console.warn('[TTS] Audio playback failed:', err.message);
          hideVisualizer();
          fallbackToWebSpeech(text);
        });
      } else {
        fallbackToWebSpeech(text);
      }
    } catch (err) {
      console.warn('[TTS] ElevenLabs error:', err.message);
      fallbackToWebSpeech(text);
    }
  }

  function fallbackToWebSpeech(text) {
    if (!hasSpeechSynthesis) return;
    state.synthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    // Use ar-SA as fallback for Darija (not ideal but better than nothing)
    utterance.lang = 'ar-SA';
    utterance.rate = 0.9;
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
      sendMessage(transcript, 'voice'); // Track as voice input

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
      hideVisualizer();
    };

    state.recognition.onerror = (event) => {
      state.isListening = false;
      document.getElementById('va-mic')?.classList.remove('listening');
      hideVisualizer();
      trackEvent('voice_recognition_error', { error: event.error });
    };
  }

  function toggleListening() {
    if (!state.recognition) return;

    if (state.isListening) {
      state.recognition.stop();
      hideVisualizer();
    } else {
      state.recognition.start();
      state.isListening = true;
      document.getElementById('va-mic').classList.add('listening');
      document.getElementById('va-trigger').classList.add('listening');
      showVisualizer('listening');
      trackEvent('voice_mic_activated');
    }
  }

  // ============================================================
  // VOICE WAVEFORM VISUALIZER (SOTA 2026)
  // ============================================================

  /**
   * Show the voice visualizer with specified mode
   * @param {string} mode - 'listening' | 'speaking' | 'processing'
   */
  function showVisualizer(mode = 'listening') {
    const visualizer = document.getElementById('va-visualizer');
    const bars = document.getElementById('va-visualizer-bars');
    const label = document.getElementById('va-visualizer-label');
    const L = state.langData;

    if (!visualizer) return;

    visualizer.classList.add('active');
    bars.classList.remove('speaking', 'listening', 'processing');
    bars.classList.add(mode);
    label.classList.remove('speaking', 'listening', 'processing');
    label.classList.add(mode);

    const labels = {
      listening: L?.ui?.voiceListening || 'Listening...',
      speaking: L?.ui?.voiceSpeaking || 'Speaking...',
      processing: L?.ui?.voiceProcessing || 'Processing...'
    };
    label.textContent = labels[mode] || mode;

    // Animate bars with random heights for realistic effect
    if (mode === 'speaking') {
      startBarAnimation();
    }
  }

  /**
   * Hide the voice visualizer
   */
  function hideVisualizer() {
    const visualizer = document.getElementById('va-visualizer');
    const bars = document.getElementById('va-visualizer-bars');

    if (visualizer) {
      visualizer.classList.remove('active');
      bars.classList.remove('speaking', 'listening', 'processing');
      stopBarAnimation();
    }
  }

  // Animation frame for bars
  let barAnimationId = null;

  function startBarAnimation() {
    const bars = document.querySelectorAll('.va-visualizer-bar');
    if (!bars.length) return;

    function animateBars() {
      bars.forEach(bar => {
        const height = 8 + Math.random() * 28;
        bar.style.height = `${height}px`;
        bar.style.opacity = 0.6 + Math.random() * 0.4;
      });
      barAnimationId = requestAnimationFrame(() => {
        setTimeout(animateBars, 100);
      });
    }
    animateBars();
  }

  function stopBarAnimation() {
    if (barAnimationId) {
      cancelAnimationFrame(barAnimationId);
      barAnimationId = null;
    }
    const bars = document.querySelectorAll('.va-visualizer-bar');
    bars.forEach(bar => {
      bar.style.height = '4px';
      bar.style.opacity = '0.5';
    });
  }

  // ============================================================
  // EXIT-INTENT VOICE POPUP (UNIQUE COMPETITIVE ADVANTAGE - Session 250.78)
  // ============================================================

  /**
   * Initialize exit-intent detection
   * - Desktop: Mouse leaving viewport
   * - Mobile: Rapid scroll up (returning to top)
   */
  function initExitIntent() {
    if (!CONFIG.EXIT_INTENT_ENABLED) return;

    // Check cooldown (once per 24h per user)
    const lastShown = localStorage.getItem('vocalia_exit_intent_shown');
    if (lastShown && Date.now() - parseInt(lastShown) < CONFIG.EXIT_INTENT_COOLDOWN) {
      return;
    }

    // Check page restrictions
    if (CONFIG.EXIT_INTENT_PAGES && !CONFIG.EXIT_INTENT_PAGES.includes(window.location.pathname)) {
      return;
    }

    // Desktop: Mouse leave detection
    if (!isMobileDevice()) {
      document.addEventListener('mouseleave', handleDesktopExitIntent);
      document.addEventListener('mouseout', handleMouseOut);
    } else {
      // Mobile: Scroll up detection
      window.addEventListener('scroll', handleMobileExitIntent, { passive: true });
    }

    console.log('[VocalIA] Exit-intent detection initialized');
  }

  function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  function handleDesktopExitIntent(e) {
    if (shouldTriggerExitIntent(e)) {
      triggerExitIntentPopup('desktop_mouseleave');
    }
  }

  function handleMouseOut(e) {
    if (!e.relatedTarget && e.clientY < CONFIG.EXIT_INTENT_SENSITIVITY) {
      if (shouldTriggerExitIntent(e)) {
        triggerExitIntentPopup('desktop_mouseout');
      }
    }
  }

  function handleMobileExitIntent() {
    const currentScrollY = window.scrollY;
    const scrollDelta = state.exitIntent.lastScrollY - currentScrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const scrollRatio = scrollDelta / maxScroll;

    // Detect rapid scroll up
    if (scrollRatio > CONFIG.EXIT_INTENT_MOBILE_SCROLL_RATIO && currentScrollY < maxScroll * 0.3) {
      if (shouldTriggerExitIntent()) {
        triggerExitIntentPopup('mobile_scroll');
      }
    }

    state.exitIntent.lastScrollY = currentScrollY;
  }

  function shouldTriggerExitIntent(e = null) {
    // Already shown or dismissed
    if (state.exitIntent.shown || state.exitIntent.dismissed) return false;

    // Widget already open
    if (state.isOpen) return false;

    // Not enough time on page
    if (Date.now() - state.exitIntent.pageLoadTime < CONFIG.EXIT_INTENT_DELAY) return false;

    // Don't trigger if user is engaged (recent conversation)
    if (state.conversationHistory.length > 2) return false;

    return true;
  }

  function triggerExitIntentPopup(trigger = 'unknown') {
    if (state.exitIntent.triggered) return;
    state.exitIntent.triggered = true;
    state.exitIntent.shown = true;

    // Save to localStorage for cooldown
    localStorage.setItem('vocalia_exit_intent_shown', Date.now().toString());

    // Track event
    trackEvent('exit_intent_triggered', { trigger, page: window.location.pathname });

    // Show exit-intent overlay
    showExitIntentOverlay();
  }

  function showExitIntentOverlay() {
    const L = state.langData || {};
    const isRTL = L?.meta?.rtl || false;

    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'va-exit-overlay';
    overlay.innerHTML = `
      <style>
        #va-exit-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.7); backdrop-filter: blur(8px);
          z-index: 999998; display: flex; align-items: center; justify-content: center;
          animation: fadeIn 0.3s ease;
        }
        .va-exit-popup {
          background: linear-gradient(145deg, #1e2642 0%, #191e35 100%);
          border-radius: 24px; padding: 32px; max-width: 420px; width: 90%;
          box-shadow: 0 25px 80px rgba(0,0,0,0.5), 0 0 60px rgba(79,186,241,0.15);
          position: relative; text-align: center;
          border: 1px solid rgba(79,186,241,0.2);
          ${isRTL ? 'direction: rtl;' : ''}
        }
        .va-exit-close {
          position: absolute; top: 12px; ${isRTL ? 'left' : 'right'}: 12px;
          background: rgba(255,255,255,0.1); border: none; border-radius: 50%;
          width: 32px; height: 32px; cursor: pointer; display: flex;
          align-items: center; justify-content: center; transition: all 0.2s;
        }
        .va-exit-close:hover { background: rgba(255,255,255,0.2); }
        .va-exit-close svg { width: 16px; height: 16px; fill: white; }
        .va-exit-icon {
          width: 80px; height: 80px; border-radius: 50%;
          background: linear-gradient(135deg, var(--va-primary, #4FBAF1) 0%, #10B981 100%);
          margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;
          box-shadow: 0 8px 32px rgba(79,186,241,0.4);
          animation: pulse-glow 2s ease-in-out infinite;
        }
        .va-exit-icon svg { width: 40px; height: 40px; fill: white; }
        .va-exit-title {
          font-size: 24px; font-weight: 700; color: white; margin: 0 0 8px;
          font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
        }
        .va-exit-subtitle {
          font-size: 15px; color: rgba(255,255,255,0.7); margin: 0 0 24px;
          line-height: 1.5;
        }
        .va-exit-cta {
          display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;
        }
        .va-exit-btn {
          padding: 14px 28px; border-radius: 12px; font-size: 15px;
          font-weight: 600; cursor: pointer; transition: all 0.2s;
          font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
          border: none;
        }
        .va-exit-btn-primary {
          background: linear-gradient(135deg, #4FBAF1 0%, #10B981 100%);
          color: white; box-shadow: 0 4px 20px rgba(79,186,241,0.4);
        }
        .va-exit-btn-primary:hover {
          transform: translateY(-2px); box-shadow: 0 6px 30px rgba(79,186,241,0.6);
        }
        .va-exit-btn-secondary {
          background: rgba(255,255,255,0.1); color: white;
        }
        .va-exit-btn-secondary:hover { background: rgba(255,255,255,0.15); }
        .va-exit-voice-hint {
          font-size: 12px; color: rgba(79,186,241,0.8); margin-top: 16px;
          display: flex; align-items: center; justify-content: center; gap: 6px;
        }
        .va-exit-voice-hint svg { width: 14px; height: 14px; fill: currentColor; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      </style>

      <div class="va-exit-popup">
        <button class="va-exit-close" id="va-exit-close" aria-label="Fermer">
          <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>

        <div class="va-exit-icon">
          <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
        </div>

        <h3 class="va-exit-title">${L?.exitIntent?.title || 'Attendez !'}</h3>
        <p class="va-exit-subtitle">${L?.exitIntent?.subtitle || 'Avez-vous des questions ? Notre assistant IA peut vous aider instantanément.'}</p>

        <div class="va-exit-cta">
          <button class="va-exit-btn va-exit-btn-primary" id="va-exit-chat">
            ${L?.exitIntent?.ctaChat || '💬 Discuter maintenant'}
          </button>
          <button class="va-exit-btn va-exit-btn-secondary" id="va-exit-demo">
            ${L?.exitIntent?.ctaDemo || '📅 Réserver une démo'}
          </button>
        </div>

        <p class="va-exit-voice-hint">
          <svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
          ${L?.exitIntent?.voiceHint || 'Support vocal disponible'}
        </p>
      </div>
    `;

    document.body.appendChild(overlay);

    // Event listeners
    document.getElementById('va-exit-close').addEventListener('click', dismissExitIntent);
    document.getElementById('va-exit-chat').addEventListener('click', () => {
      dismissExitIntent();
      openWidget();
      trackEvent('exit_intent_chat_clicked');
    });
    document.getElementById('va-exit-demo').addEventListener('click', () => {
      dismissExitIntent();
      window.location.href = '/booking';
      trackEvent('exit_intent_demo_clicked');
    });

    // Click outside to dismiss
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) dismissExitIntent();
    });

    // Track view
    trackEvent('exit_intent_viewed');
  }

  function dismissExitIntent() {
    state.exitIntent.dismissed = true;
    const overlay = document.getElementById('va-exit-overlay');
    if (overlay) {
      overlay.style.animation = 'fadeOut 0.2s ease';
      setTimeout(() => overlay.remove(), 200);
    }
    trackEvent('exit_intent_dismissed');
  }

  function openWidget() {
    const panel = document.getElementById('va-panel');
    if (panel) {
      panel.classList.add('open');
      state.isOpen = true;
      const input = document.getElementById('va-input');
      if (input) input.focus();
    }
  }

  // ============================================================
  // SOCIAL PROOF/FOMO NOTIFICATIONS (Session 250.78)
  // ============================================================

  /**
   * Initialize social proof notifications
   * Shows recent activity to create urgency/trust
   */
  function initSocialProof() {
    if (!CONFIG.SOCIAL_PROOF_ENABLED) return;

    // Initial delay before starting notifications
    setTimeout(() => {
      showSocialProofNotification();
      state.socialProof.intervalId = setInterval(() => {
        if (state.socialProof.notificationsShown < CONFIG.SOCIAL_PROOF_MAX_SHOWN) {
          showSocialProofNotification();
        } else {
          clearInterval(state.socialProof.intervalId);
        }
      }, CONFIG.SOCIAL_PROOF_INTERVAL);
    }, CONFIG.SOCIAL_PROOF_DELAY);

    console.log('[VocalIA] Social proof notifications initialized');
  }

  /**
   * Generate and show a social proof notification
   */
  function showSocialProofNotification() {
    // Don't show if widget is open
    if (state.isOpen) return;

    const L = state.langData || {};
    const isRTL = L?.meta?.rtl || false;
    const proofs = L?.socialProof?.messages || getDefaultSocialProofMessages();

    // Pick a random proof message
    const proof = proofs[Math.floor(Math.random() * proofs.length)];

    // Create notification
    const notification = document.createElement('div');
    notification.className = 'va-social-proof';
    notification.id = `va-sp-${Date.now()}`;
    notification.innerHTML = `
      <style>
        .va-social-proof {
          position: fixed; bottom: 100px; ${isRTL ? 'left' : 'right'}: 25px;
          max-width: 280px; background: linear-gradient(145deg, #1e2642, #191e35);
          border: 1px solid rgba(79,186,241,0.2); border-radius: 12px;
          padding: 12px 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.3);
          z-index: 99997; font-family: Inter, -apple-system, sans-serif;
          animation: slideInRight 0.4s ease, fadeOut 0.3s ease ${CONFIG.SOCIAL_PROOF_DURATION - 300}ms forwards;
          ${isRTL ? 'direction: rtl;' : ''}
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(${isRTL ? '-' : ''}30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        .va-sp-content { display: flex; align-items: center; gap: 10px; }
        .va-sp-icon {
          width: 36px; height: 36px; border-radius: 50%;
          background: linear-gradient(135deg, #4FBAF1, #10B981);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .va-sp-icon svg { width: 18px; height: 18px; fill: white; }
        .va-sp-text { font-size: 13px; color: rgba(255,255,255,0.9); line-height: 1.4; }
        .va-sp-time { font-size: 11px; color: rgba(79,186,241,0.7); margin-top: 4px; }
        .va-sp-close {
          position: absolute; top: 6px; ${isRTL ? 'left' : 'right'}: 6px;
          background: none; border: none; cursor: pointer;
          color: rgba(255,255,255,0.4); padding: 2px;
        }
        .va-sp-close:hover { color: rgba(255,255,255,0.7); }
      </style>

      <button class="va-sp-close" aria-label="Fermer">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>

      <div class="va-sp-content">
        <div class="va-sp-icon">
          <svg viewBox="0 0 24 24">${proof.icon || '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>'}</svg>
        </div>
        <div>
          <div class="va-sp-text">${proof.text}</div>
          <div class="va-sp-time">${proof.time || getRandomTimeAgo(L)}</div>
        </div>
      </div>
    `;

    document.body.appendChild(notification);

    // Close button
    notification.querySelector('.va-sp-close').addEventListener('click', () => {
      notification.remove();
    });

    // Auto-remove after duration
    setTimeout(() => {
      if (document.getElementById(notification.id)) {
        notification.remove();
      }
    }, CONFIG.SOCIAL_PROOF_DURATION);

    state.socialProof.notificationsShown++;
    state.socialProof.lastShownTime = Date.now();
    trackEvent('social_proof_shown', { index: state.socialProof.notificationsShown });
  }

  function getRandomTimeAgo(L) {
    const times = L?.socialProof?.times || [
      'Il y a 2 min', 'Il y a 5 min', 'Il y a 12 min', 'Il y a 23 min', 'Il y a 1h'
    ];
    return times[Math.floor(Math.random() * times.length)];
  }

  function getDefaultSocialProofMessages() {
    return [
      { text: 'Sophie de Paris vient de demander une démo', icon: '<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>' },
      { text: 'Une entreprise a automatisé 500 appels ce mois', icon: '<path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>' },
      { text: 'Nouveau client: Cabinet dentaire à Casablanca', icon: '<path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>' },
      { text: 'Ahmed a réservé un rendez-vous via l\'assistant', icon: '<path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zm-7-9c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>' },
      { text: '12 leads qualifiés générés aujourd\'hui', icon: '<path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/>' }
    ];
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
    try {
      const response = await fetch(CONFIG.BOOKING_API, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(data)
      });
      return await response.json();
    } catch (error) {
      console.error('[VocalIA] Booking error:', error);
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

  /**
   * Call Voice API with persona-powered AI response
   * Falls back to pattern matching if API fails or AI_MODE is disabled
   */
  async function callVoiceAPI(userMessage) {
    if (!CONFIG.AI_MODE) return null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT);

      const response = await fetch(CONFIG.VOICE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          language: state.currentLang,
          sessionId: state.sessionId || `widget_${Date.now()}`,
          widget_type: 'B2C',
          history: state.conversationHistory.slice(-10).map(m => ({
            role: m.role,
            content: m.content
          }))
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn('[VocalIA] API error:', response.status);
        return null;
      }

      const data = await response.json();
      if (data.response) {
        trackEvent('voice_api_response', { language: state.currentLang, latency: data.latencyMs });
        return data.response;
      }
      return null;
    } catch (err) {
      if (err.name === 'AbortError') {
        console.error('[VocalIA] API timeout');
      } else {
        console.error('[VocalIA] API error:', err.message);
      }
      // Use INTELLIGENT fallback instead of error message
      // DIRECT ERROR RETURN - NO LOCAL FALLBACK
      const L = state.langData;
      return L?.ui?.errorMessage || "Désolé, je suis temporairement indisponible. Veuillez réessayer.";
    }
  }

  /**
   * Pattern matching fallback (offline mode)
   */
  function getPatternMatchResponse(userMessage) {
    const L = state.langData;
    const lower = userMessage.toLowerCase();
    const ctx = state.conversationContext;

    // Update context with detected industry/need
    const detectedIndustry = detectIndustry(userMessage);
    if (detectedIndustry) ctx.industry = detectedIndustry;

    const detectedNeed = detectNeed(userMessage);
    if (detectedNeed) ctx.need = detectedNeed;

    // Check for "yes" confirmation based on last topic
    if (L.topics.yes.keywords.some(kw => lower.includes(kw))) {
      const yesResponses = L.topics.yes.responses;
      if (ctx.lastTopic && yesResponses[ctx.lastTopic]) {
        return yesResponses[ctx.lastTopic];
      }
      return yesResponses.default;
    }

    // Check all topics
    for (const [topic, data] of Object.entries(L.topics)) {
      if (topic === 'yes') continue;

      if (data.keywords.some(kw => lower.includes(kw))) {
        ctx.lastTopic = topic;

        if (topic === 'leads' && ctx.industry && L.industries[ctx.industry]?.leads) {
          return L.industries[ctx.industry].leads + L.defaults.leadsFollowup;
        }

        if (data.response) return data.response;
      }
    }

    // Industry-specific response
    if (ctx.industry && L.industries[ctx.industry]) {
      const industryData = L.industries[ctx.industry];

      if (lower.includes('service') || lower.includes('automation') || lower.includes('أتمتة') || lower.includes('automatisation')) {
        ctx.lastTopic = 'services';
        return industryData.services + L.defaults.servicesFollowup;
      }

      const introStart = industryData.intro.substring(0, 30);
      if (!state.conversationHistory.some(m => m.content.includes(introStart))) {
        return industryData.intro + L.defaults.industryFollowup;
      }
    }

    // Quote need
    if (ctx.need === 'quote') {
      ctx.lastTopic = 'pricing';
      return L.topics.pricing.response;
    }

    // Industry-based smart default
    if (ctx.industry) {
      return L.defaults.industryResponse.replace('{industry}', ctx.industry.toUpperCase());
    }

    // True default
    return L.defaults.qualificationQuestion;
  }

  async function getAIResponse(userMessage) {
    const L = state.langData;
    const lower = userMessage.toLowerCase();
    const ctx = state.conversationContext;

    // 1. Active booking flow takes priority (always local)
    if (ctx.bookingFlow.active) {
      const bookingResponse = await handleBookingFlow(userMessage);
      if (ctx.bookingFlow.step === 'submitting') {
        return await processBookingConfirmation();
      }
      if (bookingResponse) return bookingResponse;
    }

    // 2. Check for booking intent (always local)
    if (isBookingIntent(lower)) {
      ctx.bookingFlow.active = true;
      ctx.bookingFlow.step = 'name';
      ctx.bookingFlow.data.service = L.booking.service;
      trackEvent('voice_booking_started', { step: 'name' });
      return L.booking.messages.start;
    }

    // 3. Try Voice API (AI Mode)
    // CRITICAL CHANGE: We ONLY use the API. No "stupid" fallback.
    const apiResponse = await callVoiceAPI(userMessage);
    if (apiResponse) {
      return apiResponse;
    }

    // 4. API Failed - Return error message directly
    // Do NOT fall back to getPatternMatchResponse(userMessage)
    return L?.ui?.errorMessage || "Désolé, je suis temporairement indisponible. Veuillez réessayer.";
  }

  // ============================================================
  // MESSAGE HANDLING
  // ============================================================

  async function sendMessage(text, inputMethod = 'text') {
    if (!text.trim()) return;

    // Track input method (voice vs text)
    trackInputMethod(inputMethod);

    addMessage(text, 'user');
    document.getElementById('va-input').value = '';
    showTyping();

    try {
      // Check for product intent (E-commerce Phase 1)
      if (CONFIG.ECOMMERCE_MODE && state.tenantId) {
        const productIntent = detectProductIntent(text);
        if (productIntent) {
          trackEvent('product_intent_detected', {
            intent_type: productIntent.type,
            category: productIntent.category,
            query: productIntent.query,
            input_method: inputMethod
          });

          // Use MCP for product fetching (integrates with Shopify, WooCommerce, etc.)
          let products = [];

          if (productIntent.type === 'search' && productIntent.query) {
            // Search via MCP
            products = await MCP.searchProducts(productIntent.query);
          } else if (productIntent.type === 'recommend') {
            // Get personalized recommendations via MCP
            products = await MCP.getRecommendations();
          } else {
            // Browse by category via MCP
            products = await MCP.fetchProducts({
              category: productIntent.category,
              limit: CONFIG.MAX_CAROUSEL_ITEMS
            });
          }

          // Fallback to direct catalog fetch if MCP returns empty
          if (products.length === 0) {
            products = await fetchCatalogProducts({
              category: productIntent.category,
              search: productIntent.query,
              limit: CONFIG.MAX_CAROUSEL_ITEMS
            });
          }

          if (products.length > 0) {
            hideTyping();

            // Record UCP interaction
            UCP.recordInteraction('product_search', {
              intent: productIntent.type,
              category: productIntent.category,
              query: productIntent.query,
              results_count: products.length
            });

            // Show products in carousel
            const title = productIntent.query
              ? `${state.langData?.ecommerce?.resultsFor || 'Résultats pour'} "${productIntent.query}"`
              : null;
            addProductCarousel(products, title, productIntent.type);

            // Also get AI response for context
            const response = await getAIResponse(text);
            addMessage(response, 'assistant');
            return;
          }
        }
      }

      const response = await getAIResponse(text);
      hideTyping();
      addMessage(response, 'assistant');
    } catch (error) {
      hideTyping();
      addMessage(state.langData.ui.errorMessage, 'assistant');
      console.error('[VocalIA] Response error:', error);
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
      sendMessage(document.getElementById('va-input').value, 'text');
    });

    document.getElementById('va-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage(e.target.value, 'text');
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
      console.log('[VocalIA] Initializing Widget v3.0.0 (Unified Kernel)');
      captureAttribution();

      // 1. Detect language
      const lang = detectLanguage();
      console.log(`[VocalIA] Detected language: ${lang}`);

      // 2. Load tenant config (SOTA Sovereign Pull)
      await loadTenantConfig();

      // 3. Load language data
      await loadLanguage(lang);
      console.log(`[VocalIA] Loaded language: ${state.currentLang}`);

      // Detect tenant ID for e-commerce features
      detectTenantId();
      if (state.tenantId) {
        console.log(`[VocalIA] E-commerce mode: tenant ${state.tenantId}`);

        // Initialize UCP for personalized experience
        if (CONFIG.ECOMMERCE_MODE) {
          UCP.syncPreference().then(data => {
            if (data) {
              console.log(`[VocalIA] UCP synced: ${data.ltvTier} tier, ${data.profile?.locale}`);
            }
          }).catch(e => console.warn('[VocalIA] UCP init failed:', e.message));
        }
      }

      captureAttribution(); // Session 177: MarEng Injector
      createWidget();
      initExitIntent(); // Session 250.78: Voice Exit-Intent Popup
      initSocialProof(); // Session 250.78: Social Proof/FOMO
      trackEvent('voice_widget_loaded', {
        language: state.currentLang,
        ecommerce_mode: CONFIG.ECOMMERCE_MODE && !!state.tenantId,
        tenant_id: state.tenantId,
        exit_intent_enabled: CONFIG.EXIT_INTENT_ENABLED,
        social_proof_enabled: CONFIG.SOCIAL_PROOF_ENABLED
      });

    } catch (error) {
      console.error('[VocalIA] Init error:', error);
    }
  }

  /**
   * Detect tenant ID from various sources
   * Priority: 1. Script data attribute 2. URL param 3. Meta tag 4. Global variable
   */
  function detectTenantId() {
    // 1. Script data attribute
    const scriptTag = document.querySelector('script[data-vocalia-tenant]');
    if (scriptTag) {
      state.tenantId = scriptTag.dataset.vocaliaTenant;
      return;
    }

    // 2. URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const urlTenant = urlParams.get('tenant_id') || urlParams.get('tenantId');
    if (urlTenant) {
      state.tenantId = urlTenant;
      return;
    }

    // 3. Meta tag
    const metaTag = document.querySelector('meta[name="vocalia-tenant"]');
    if (metaTag) {
      state.tenantId = metaTag.content;
      return;
    }

    // 4. Global variable
    if (window.VOCALIA_TENANT_ID) {
      state.tenantId = window.VOCALIA_TENANT_ID;
      return;
    }

    // 5. Widget element data attribute
    const widgetElement = document.getElementById('vocalia-widget');
    if (widgetElement?.dataset.tenantId) {
      state.tenantId = widgetElement.dataset.tenantId;
      return;
    }
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
