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

        // API Endpoints
        VOICE_API_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:3004/respond'
            : 'https://api.vocalia.ma/respond',
        AI_MODE: true, // true = use Voice API with personas, false = pattern matching fallback
        API_TIMEOUT: 10000, // 10 seconds

        // Catalog API (E-commerce Mode)
        CATALOG_API_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:3013/api/tenants'  // Dev: local DB API
            : 'https://api.vocalia.ma/api/tenants', // Prod: deployed API
        ECOMMERCE_MODE: true, // Enable product display in widget
        MAX_CAROUSEL_ITEMS: 5, // Maximum products in carousel

        // Base API URL (for recommendations, product details, quiz)
        API_BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:3013'
            : 'https://api.vocalia.ma',

        // Booking API (Google Apps Script)
        BOOKING_API: 'https://script.google.com/macros/s/AKfycbzXKtu88n0Z-oFiBm5kJYPmGOi29maowtMv2vEQ0o5Xhp4sayNdnm2cNBaAx2OlHkUK/exec',

        // Exit-Intent Voice Popup (UNIQUE COMPETITIVE ADVANTAGE - Session 250.78)
        EXIT_INTENT_ENABLED: true,
        EXIT_INTENT_DELAY: 3000,
        EXIT_INTENT_SENSITIVITY: 20,
        EXIT_INTENT_COOLDOWN: 86400000,
        EXIT_INTENT_MOBILE_SCROLL_RATIO: 0.3,
        EXIT_INTENT_PAGES: null,

        // Social Proof API (fetch real data from backend)
        SOCIAL_PROOF_API_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:3004/social-proof'
            : 'https://api.vocalia.ma/social-proof',

        // Social Proof/FOMO Notifications (Session 250.78)
        SOCIAL_PROOF_ENABLED: true,
        SOCIAL_PROOF_INTERVAL: 25000,
        SOCIAL_PROOF_DURATION: 5000,
        SOCIAL_PROOF_MAX_SHOWN: 5,
        SOCIAL_PROOF_DELAY: 8000,

        // Branding
        primaryColor: '#5E6AD2',
        primaryDark: '#4f46e5',
        accentColor: '#10B981',
        darkBg: '#0f172a',

        // Paths - FIXED Session 250.90: Correct path to language files
        LANG_PATH: '/voice-assistant/lang/voice-{lang}.json',

        // Cache
        SLOT_CACHE_TTL: 5 * 60 * 1000,
        CATALOG_CACHE_TTL: 5 * 60 * 1000,

        // Auto-detection
        AUTO_DETECT_ENABLED: true,
        AUTO_DETECT_LANGUAGES: {
            'fr-FR': 'fr', 'fr': 'fr',
            'en-US': 'en', 'en-GB': 'en', 'en': 'en',
            'es-ES': 'es', 'es-MX': 'es', 'es': 'es',
            'ar-SA': 'ar', 'ar-MA': 'ar', 'ar': 'ar',
            'ary': 'ary'
        }
    };

    // ============================================================
    // SECURITY UTILITIES
    // ============================================================

    function escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function escapeAttr(text) {
        return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

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
        tenantConfig: null, // Loaded from /config endpoint
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
    // SHADOW DOM - Scoped DOM queries
    // ============================================================

    let shadowRoot = null;

    function $id(id) { return shadowRoot ? shadowRoot.getElementById(id) : document.getElementById(id); }
    function $q(sel) { return shadowRoot ? shadowRoot.querySelector(sel) : document.querySelector(sel); }
    function $qa(sel) { return shadowRoot ? shadowRoot.querySelectorAll(sel) : document.querySelectorAll(sel); }

    // ============================================================
    // TENANT CONFIGURATION
    // ============================================================

    async function loadTenantConfig() {
        if (!state.tenantId) return null;

        const url = `${CONFIG.VOICE_API_URL.replace('/respond', '/config')}?tenantId=${encodeURIComponent(state.tenantId)}`;

        try {
            const response = await fetch(url, { signal: AbortSignal.timeout(CONFIG.API_TIMEOUT) });
            if (!response.ok) throw new Error('Config fetch failed');

            const data = await response.json();
            if (data.success) {
                if (data.branding && data.branding.primaryColor) {
                    CONFIG.primaryColor = data.branding.primaryColor;
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
            console.warn('[VocalIA ECOM] Config fetch failed, using static defaults:', error.message);
        }
        return null;
    }

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

        const host = document.createElement('div');
        host.id = 'voice-assistant-widget';
        host.style.cssText = `position:fixed;bottom:30px;${position}:25px;z-index:99999;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;${isRTL ? 'direction:rtl;' : ''}`;
        document.body.appendChild(host);

        shadowRoot = host.attachShadow({ mode: 'open' });
        shadowRoot.innerHTML = generateWidgetHTML(L, isRTL, position);

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
          box-shadow: 0 4px 20px rgba(94, 106, 210, 0.4);
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
          0%, 100% { box-shadow: 0 4px 20px rgba(94, 106, 210, 0.4); transform: scale(1); }
          50% { box-shadow: 0 4px 30px rgba(94, 106, 210, 0.7); transform: scale(1.02); }
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
          transform: scale(1.1); box-shadow: 0 6px 30px rgba(94, 106, 210, 0.6); animation: none;
        }
        .va-trigger:hover::before, .va-trigger:hover::after { animation: none; opacity: 0; }
        .va-trigger img { width: 40px; height: 40px; object-fit: contain; border-radius: 8px; }
        .va-trigger.listening { animation: pulse 1.5s infinite; }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(94, 106, 210, 0.7); }
          50% { box-shadow: 0 0 0 15px rgba(94, 106, 210, 0); }
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
          background: ${(hasSpeechRecognition || typeof MediaRecorder !== 'undefined') ? 'var(--va-primary)' : 'rgba(255,255,255,0.1)'};
          border: none; cursor: ${(hasSpeechRecognition || typeof MediaRecorder !== 'undefined') ? 'pointer' : 'not-allowed'};
          display: flex; align-items: center; justify-content: center; transition: all 0.2s;
        }
        .va-mic-btn.listening { background: #ef4444; animation: pulse 1s infinite; }
        .va-mic-btn svg { width: 20px; height: 20px; fill: white; }

        /* Voice Waveform Visualizer (SOTA 2026) */
        .va-visualizer {
          height: 48px; padding: 8px 16px; display: none;
          background: linear-gradient(180deg, rgba(94,106,210,0.1) 0%, transparent 100%);
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
          padding: 12px 16px; background: rgba(94, 106, 210, 0.1);
          border-top: 1px solid rgba(94, 106, 210, 0.2);
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
          box-shadow: 0 4px 12px rgba(94, 106, 210, 0.2);
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
          background: linear-gradient(135deg, rgba(94,106,210,0.1) 0%, rgba(16,185,129,0.1) 100%);
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

      <div class="va-panel" id="va-panel" role="dialog" aria-label="${L.ui.headerTitle}" aria-modal="true">
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
        <div class="va-visualizer" id="va-visualizer" aria-hidden="true">
          <div class="va-visualizer-bars" id="va-visualizer-bars">
            ${Array.from({ length: 10 }, () => '<div class="va-visualizer-bar"></div>').join('')}
          </div>
          <div class="va-visualizer-label" id="va-visualizer-label">${L.ui.voiceReady || 'Voice Ready'}</div>
        </div>

        <div class="va-messages" id="va-messages" aria-live="polite" aria-relevant="additions"></div>

        <div class="va-input-area">
          <input type="text" class="va-input" id="va-input" placeholder="${L.ui.placeholder}">
          ${(hasSpeechRecognition || typeof MediaRecorder !== 'undefined') ? `
          <button class="va-mic-btn" id="va-mic" aria-label="${L.ui.ariaMic || 'Microphone'}">
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

        const trigger = $id('va-trigger');
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
      border: 1px solid rgba(94, 106, 210, 0.3);
      padding: 12px 16px; border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), 0 0 20px rgba(94, 106, 210, 0.15);
      animation: notifSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      cursor: pointer; white-space: nowrap; z-index: 9999;
      ${isRTL ? 'direction: rtl; flex-direction: row-reverse;' : ''}
    `;

        // Style inner elements
        const icon = bubble.querySelector('.va-notif-icon');
        if (icon) icon.style.cssText = 'width: 32px; height: 32px; background: linear-gradient(135deg, rgba(94, 106, 210, 0.2) 0%, rgba(16, 185, 129, 0.1) 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #5E6AD2; flex-shrink: 0;';

        const textContainer = bubble.querySelector('.va-notif-text');
        if (textContainer) textContainer.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';

        const title = bubble.querySelector('.va-notif-title');
        if (title) title.style.cssText = 'font-size: 14px; font-weight: 600; color: #E4F4FC;';

        const sub = bubble.querySelector('.va-notif-sub');
        if (sub) sub.style.cssText = 'font-size: 11px; color: rgba(255, 255, 255, 0.7);';

        // Arrow
        const arrow = document.createElement('div');
        arrow.style.cssText = `position: absolute; bottom: -6px; ${position}: 24px; width: 12px; height: 12px; background: rgba(25, 30, 53, 0.95); border-${isRTL ? 'left' : 'right'}: 1px solid rgba(94, 106, 210, 0.3); border-bottom: 1px solid rgba(94, 106, 210, 0.3); transform: rotate(${isRTL ? '-' : ''}45deg);`;
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
        const messagesContainer = $id('va-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `va-message ${type}`;
        messageDiv.innerHTML = `<div class="va-message-content">${escapeHTML(text)}</div>`;
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
        const messagesContainer = $id('va-messages');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'va-message assistant';
        typingDiv.id = 'va-typing';
        typingDiv.innerHTML = '<div class="va-message-content"><div class="va-typing"><span></span><span></span><span></span></div></div>';
        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function hideTyping() {
        const typing = $id('va-typing');
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

        const messagesContainer = $id('va-messages');
        const productDiv = document.createElement('div');
        productDiv.className = 'va-message assistant';

        const hasImage = product.image || product.images?.[0];
        const inStock = product.available !== false && product.in_stock !== false;

        const safeId = escapeAttr(product.id);
        const safeName = escapeHTML(product.name || '');
        const safeDesc = product.description ? escapeHTML(product.description) : '';
        const safeImage = escapeAttr(product.image || product.images?.[0] || '');
        const safeUrl = product.url ? escapeAttr(product.url) : '';

        productDiv.innerHTML = `
      <div class="va-message-content">
        <div class="va-single-product" data-product-id="${safeId}">
          <div class="va-single-product-row">
            ${hasImage
                ? `<img class="va-single-product-img" src="${safeImage}" alt="${safeName}" />`
                : `<div class="va-single-product-img" style="display:flex;align-items:center;justify-content:center;font-size:32px;">📦</div>`
            }
            <div class="va-single-product-details">
              <h4 class="va-single-product-name">${safeName}</h4>
              ${safeDesc ? `<p class="va-single-product-desc">${safeDesc}</p>` : ''}
              <div class="va-single-product-price">${formatPrice(product.price, product.currency)}</div>
            </div>
          </div>
          <div class="va-product-actions">
            <button class="va-product-btn primary" onclick="window.VocalIA.viewProduct('${safeId}')" ${!inStock ? 'disabled' : ''}>
              ${inStock
                ? (state.langData?.ecommerce?.viewDetails || 'Voir détails')
                : (state.langData?.ecommerce?.notifyMe || 'Me notifier')
            }
            </button>
            ${safeUrl ? `<button class="va-product-btn secondary" onclick="window.open('${safeUrl}', '_blank')">
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
        const messagesContainer = $id('va-messages');
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
            <button onclick="this.getRootNode().getElementById('${carouselId}').scrollBy({left: ${isRTL ? '150' : '-150'}, behavior: 'smooth'})" aria-label="Previous">
              <svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
            </button>
            <button onclick="this.getRootNode().getElementById('${carouselId}').scrollBy({left: ${isRTL ? '-150' : '150'}, behavior: 'smooth'})" aria-label="Next">
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
                : `${CONFIG.CATALOG_API_URL}/${state.tenantId}/catalog`;

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
                `${CONFIG.CATALOG_API_URL}/${state.tenantId}/catalog/detail/${encodeURIComponent(productId)}`,
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
                `${CONFIG.API_BASE_URL}/api/tenants/${state.tenantId}/catalog/${encodeURIComponent(productId)}`
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
        if (widget === 'spinWheel' && window.VocaliaSpinWheel) {
            window.VocaliaSpinWheel.show({
                tenantId: state.tenantId,
                lang: state.currentLang
            });
        }
        if (widget === 'shippingBar' && window.VocaliaShippingBar) {
            window.VocaliaShippingBar.init({
                tenantId: state.tenantId,
                lang: state.currentLang
            });
        }
        if (widget === 'recommendations' && window.VocalIARecommendations) {
            const carousel = new window.VocalIARecommendations({
                tenantId: state.tenantId,
                lang: state.currentLang,
                apiBase: CONFIG.API_BASE_URL
            });
            carousel.render();
        }
    });

    WidgetOrchestrator.on('widget:deactivated', ({ widget }) => {
        if (widget === 'spinWheel' && window.VocaliaSpinWheel?.getInstance()) {
            window.VocaliaSpinWheel.getInstance().destroy();
        }
        if (widget === 'shippingBar' && window.VocaliaShippingBar?.getInstance()) {
            window.VocaliaShippingBar.getInstance().destroy();
        }
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
        if (hasSpeechRecognition) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            state.recognition = new SpeechRecognition();
            state.recognition.lang = state.langData.meta.speechRecognition;
            state.recognition.continuous = false;
            state.recognition.interimResults = false;

            state.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                $id('va-input').value = transcript;
                sendMessage(transcript, 'voice');

                if (event.results[0][0].confidence) {
                    trackEvent('voice_recognition_result', {
                        confidence: event.results[0][0].confidence,
                        detected_lang: state.recognition.lang
                    });
                }
            };

            state.recognition.onend = () => {
                state.isListening = false;
                $id('va-mic')?.classList.remove('listening');
                $id('va-trigger')?.classList.remove('listening');
                hideVisualizer();
            };

            state.recognition.onerror = (event) => {
                state.isListening = false;
                $id('va-mic')?.classList.remove('listening');
                hideVisualizer();
                trackEvent('voice_recognition_error', { error: event.error });
            };

            state.sttMode = 'native';
        } else if (navigator.mediaDevices && typeof MediaRecorder !== 'undefined') {
            state.sttMode = 'fallback';
            console.log('[VocalIA ECOM] Using MediaRecorder STT fallback');
        } else {
            state.sttMode = 'none';
        }
    }

    async function startFallbackRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            state.mediaRecorder = new MediaRecorder(stream, {
                mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg'
            });
            state.audioChunks = [];

            state.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) state.audioChunks.push(e.data);
            };

            state.mediaRecorder.onstop = async () => {
                stream.getTracks().forEach(t => t.stop());
                const audioBlob = new Blob(state.audioChunks, { type: state.mediaRecorder.mimeType });
                if (audioBlob.size < 1000) return;

                const sttUrl = CONFIG.API_BASE_URL + '/stt';
                try {
                    const resp = await fetch(sttUrl, {
                        method: 'POST',
                        headers: { 'X-Language': state.currentLang },
                        body: audioBlob,
                        signal: AbortSignal.timeout(15000)
                    });
                    const result = await resp.json();
                    if (result.success && result.text) {
                        $id('va-input').value = result.text;
                        sendMessage(result.text, 'voice');
                    }
                } catch (err) {
                    console.error('[VocalIA ECOM] STT request failed:', err.message);
                }
            };

            state.mediaRecorder.start();
            state.isListening = true;

            state.recordingTimeout = setTimeout(() => {
                if (state.mediaRecorder?.state === 'recording') {
                    state.mediaRecorder.stop();
                    state.isListening = false;
                    $id('va-mic')?.classList.remove('listening');
                    $id('va-trigger')?.classList.remove('listening');
                    hideVisualizer();
                }
            }, 10000);
        } catch (err) {
            console.error('[VocalIA ECOM] Microphone access denied:', err.message);
            state.isListening = false;
            $id('va-mic')?.classList.remove('listening');
        }
    }

    function stopFallbackRecording() {
        if (state.recordingTimeout) clearTimeout(state.recordingTimeout);
        if (state.mediaRecorder?.state === 'recording') state.mediaRecorder.stop();
        state.isListening = false;
    }

    function toggleListening() {
        if (state.sttMode === 'native' && state.recognition) {
            if (state.isListening) {
                state.recognition.stop();
                hideVisualizer();
            } else {
                state.recognition.start();
                state.isListening = true;
                $id('va-mic')?.classList.add('listening');
                $id('va-trigger')?.classList.add('listening');
                showVisualizer('listening');
                trackEvent('voice_mic_activated', { mode: 'native' });
            }
        } else if (state.sttMode === 'fallback') {
            if (state.isListening) {
                stopFallbackRecording();
                $id('va-mic')?.classList.remove('listening');
                $id('va-trigger')?.classList.remove('listening');
                hideVisualizer();
            } else {
                startFallbackRecording();
                $id('va-mic')?.classList.add('listening');
                $id('va-trigger')?.classList.add('listening');
                showVisualizer('listening');
                trackEvent('voice_mic_activated', { mode: 'fallback' });
            }
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
        const visualizer = $id('va-visualizer');
        const bars = $id('va-visualizer-bars');
        const label = $id('va-visualizer-label');
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
        const visualizer = $id('va-visualizer');
        const bars = $id('va-visualizer-bars');

        if (visualizer) {
            visualizer.classList.remove('active');
            bars.classList.remove('speaking', 'listening', 'processing');
            stopBarAnimation();
        }
    }

    // Animation frame for bars
    let barAnimationId = null;

    function startBarAnimation() {
        const bars = $qa('.va-visualizer-bar');
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
        const bars = $qa('.va-visualizer-bar');
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
          box-shadow: 0 25px 80px rgba(0,0,0,0.5), 0 0 60px rgba(94,106,210,0.15);
          position: relative; text-align: center;
          border: 1px solid rgba(94,106,210,0.2);
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
          background: linear-gradient(135deg, var(--va-primary, #5E6AD2) 0%, #10B981 100%);
          margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;
          box-shadow: 0 8px 32px rgba(94,106,210,0.4);
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
          background: linear-gradient(135deg, #5E6AD2 0%, #10B981 100%);
          color: white; box-shadow: 0 4px 20px rgba(94,106,210,0.4);
        }
        .va-exit-btn-primary:hover {
          transform: translateY(-2px); box-shadow: 0 6px 30px rgba(94,106,210,0.6);
        }
        .va-exit-btn-secondary {
          background: rgba(255,255,255,0.1); color: white;
        }
        .va-exit-btn-secondary:hover { background: rgba(255,255,255,0.15); }
        .va-exit-voice-hint {
          font-size: 12px; color: rgba(94,106,210,0.8); margin-top: 16px;
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

        (shadowRoot || document.body).appendChild(overlay);

        // Event listeners
        $id('va-exit-close').addEventListener('click', dismissExitIntent);
        $id('va-exit-chat').addEventListener('click', () => {
            dismissExitIntent();
            openWidget();
            trackEvent('exit_intent_chat_clicked');
        });
        $id('va-exit-demo').addEventListener('click', () => {
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
        const overlay = $id('va-exit-overlay');
        if (overlay) {
            overlay.style.animation = 'fadeOut 0.2s ease';
            setTimeout(() => overlay.remove(), 200);
        }
        trackEvent('exit_intent_dismissed');
    }

    function openWidget() {
        const panel = $id('va-panel');
        if (panel) {
            panel.classList.add('open');
            state.isOpen = true;
            const input = $id('va-input');
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
    async function initSocialProof() {
        if (!CONFIG.SOCIAL_PROOF_ENABLED) return;

        // Fetch real social proof data from backend (like B2B widget)
        try {
            const url = `${CONFIG.SOCIAL_PROOF_API_URL}?lang=${state.currentLang}`;
            const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
            const data = await response.json();
            if (data.success && Array.isArray(data.messages) && data.messages.length > 0) {
                state.socialProof.messages = data.messages;
            }
        } catch (e) {
            console.warn('[VocalIA ECOM] Social proof fetch failed, using fallback:', e.message);
        }

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
    }

    /**
     * Generate and show a social proof notification
     */
    function showSocialProofNotification() {
        // Don't show if widget is open
        if (state.isOpen) return;

        const L = state.langData || {};
        const isRTL = L?.meta?.rtl || false;
        const proofs = state.socialProof.messages.length > 0
            ? state.socialProof.messages
            : (L?.socialProof?.messages || getDefaultSocialProofMessages());

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
          border: 1px solid rgba(94,106,210,0.2); border-radius: 12px;
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
          background: linear-gradient(135deg, #5E6AD2, #10B981);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .va-sp-icon svg { width: 18px; height: 18px; fill: white; }
        .va-sp-text { font-size: 13px; color: rgba(255,255,255,0.9); line-height: 1.4; }
        .va-sp-time { font-size: 11px; color: rgba(94,106,210,0.7); margin-top: 4px; }
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

        (shadowRoot || document.body).appendChild(notification);

        // Close button
        notification.querySelector('.va-sp-close').addEventListener('click', () => {
            notification.remove();
        });

        // Auto-remove after duration
        setTimeout(() => {
            if ($id(notification.id)) {
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

    // ============================================================
    // A2UI RENDERER — Agent-to-UI dynamic components
    // ============================================================

    function renderA2UIComponent(a2ui) {
        if (!a2ui || !a2ui.html) return;
        const container = $id('va-messages');
        if (!container) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'va-message assistant va-a2ui-wrapper';

        if (a2ui.css) {
            const style = document.createElement('style');
            style.textContent = a2ui.css;
            wrapper.appendChild(style);
        }

        const content = document.createElement('div');
        content.className = 'va-message-content';
        content.innerHTML = a2ui.html;
        wrapper.appendChild(content);

        container.appendChild(wrapper);
        container.scrollTop = container.scrollHeight;

        wrapper.querySelectorAll('[data-a2ui-action]').forEach(el => {
            el.addEventListener('click', () => {
                handleA2UIAction(el.dataset.a2uiAction, {
                    type: a2ui.type,
                    value: el.dataset.slot || el.dataset.productId || null,
                    element: el,
                    wrapper
                });
            });
        });

        trackEvent('a2ui_rendered', { type: a2ui.type });
    }

    async function handleA2UIAction(action, ctx) {
        trackEvent('a2ui_action', { action, type: ctx.type });

        if (action === 'select_slot') {
            const comp = ctx.element.closest('[data-a2ui-component]');
            if (comp) {
                comp.querySelectorAll('.va-a2ui-slot').forEach(s => s.classList.remove('selected'));
                ctx.element.classList.add('selected');
                const btn = comp.querySelector('[data-a2ui-action="confirm_booking"]');
                if (btn) btn.disabled = false;
            }
            return;
        }

        if (action === 'close') {
            ctx.wrapper.remove();
            return;
        }

        const payload = {};
        const comp = ctx.element.closest('[data-a2ui-component]');
        if (action === 'confirm_booking' && comp) {
            const selected = comp.querySelector('.va-a2ui-slot.selected');
            payload.slot = selected?.dataset.slot;
        } else if (action === 'submit_lead' && comp) {
            const form = comp.querySelector('form');
            if (form) new FormData(form).forEach((v, k) => { payload[k] = v; });
        }

        try {
            const resp = await fetch(CONFIG.VOICE_API_URL.replace('/respond', '/a2ui/action'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    data: payload,
                    sessionId: state.sessionId,
                    tenant_id: state.tenantId,
                    widget_type: 'ECOM'
                })
            });
            const result = await resp.json();
            if (result.message) {
                addMessage(result.message, 'assistant');
            }
        } catch (e) {
            console.warn('[VocalIA ECOM] A2UI action failed:', e.message);
        }
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
                    tenant_id: state.tenantId,
                    widget_type: 'ECOM', // Enforce E-commerce Persona
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
                // Render A2UI component if backend sent one
                if (data.a2ui) {
                    renderA2UIComponent(data.a2ui);
                }
                // Render product catalog cards if backend returned them
                if (data.catalog && data.catalog.items && data.catalog.items.length > 0) {
                    addProductCarousel(data.catalog.items, data.catalog.title, 'api_response');
                }
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
        $id('va-input').value = '';
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
        const panel = $id('va-panel');

        if (state.isOpen) {
            panel.classList.add('open');
            trackEvent('voice_panel_opened');

            if (state.conversationHistory.length === 0) {
                const L = state.langData;
                const welcomeMsg = needsTextFallback ? L.ui.welcomeMessageTextOnly : L.ui.welcomeMessage;
                addMessage(welcomeMsg, 'assistant');
            }
            $id('va-input').focus();
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
        $id('va-trigger').addEventListener('click', togglePanel);
        $id('va-close').addEventListener('click', togglePanel);

        $id('va-send').addEventListener('click', () => {
            sendMessage($id('va-input').value, 'text');
        });

        $id('va-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage(e.target.value, 'text');
        });

        initSpeechRecognition();
        const micBtn = $id('va-mic');
        if (micBtn && state.sttMode !== 'none') {
            micBtn.addEventListener('click', toggleListening);
        } else if (micBtn && state.sttMode === 'none') {
            micBtn.style.display = 'none';
        }

        // Keyboard: Escape to close, Tab focus trap
        document.addEventListener('keydown', (e) => {
            if (!state.isOpen) return;
            if (e.key === 'Escape') {
                togglePanel();
                const trigger = $id('va-trigger');
                if (trigger) trigger.focus();
                return;
            }
            if (e.key === 'Tab') {
                const panel = $id('va-panel');
                if (!panel) return;
                const focusable = panel.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])');
                if (focusable.length === 0) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        });
    }

    // ============================================================
    // SUB-WIDGET AUTO-INITIALIZATION
    // ============================================================

    function initSubWidgets() {
        if (!CONFIG.ECOMMERCE_MODE || !state.tenantId) return;

        // Free Shipping Bar: auto-init if widget loaded (always-on for ECOM)
        if (window.VocaliaShippingBar) {
            try {
                window.VocaliaShippingBar.init({
                    tenantId: state.tenantId,
                    lang: state.currentLang,
                    voiceEnabled: true
                });
                WidgetOrchestrator.activate('shippingBar');
            } catch (e) {
                console.warn('[VocalIA] ShippingBar init failed:', e.message);
            }
        }

        // Spin Wheel: auto-show after delay if available (1x per 24h)
        if (window.VocaliaSpinWheel && window.VocalIA.isSpinWheelAvailable()) {
            setTimeout(() => {
                if (!state.isOpen && WidgetOrchestrator.canShow('spinWheel')) {
                    try {
                        window.VocaliaSpinWheel.show({
                            tenantId: state.tenantId,
                            lang: state.currentLang,
                            voiceEnabled: true
                        });
                        WidgetOrchestrator.activate('spinWheel');
                    } catch (e) {
                        console.warn('[VocalIA] SpinWheel init failed:', e.message);
                    }
                }
            }, 15000); // 15s delay — after social proof, before exit intent
        }

        // Recommendation Carousel: auto-init if widget loaded
        if (window.VocalIARecommendations) {
            try {
                window.VocalIA.RecommendationCarousel = window.VocalIARecommendations;
                WidgetOrchestrator.activate('recommendations');
            } catch (e) {
                console.warn('[VocalIA] RecommendationCarousel init failed:', e.message);
            }
        }
    }

    // ============================================================
    // INITIALIZATION
    // ============================================================

    async function init() {
        try {
            // Priority 1: Pick up injected config from distributions (WordPress/Shopify/Wix)
            if (window.VOCALIA_CONFIG_INJECTED) {
                Object.assign(CONFIG, window.VOCALIA_CONFIG_INJECTED);
            }
            if (window.VOCALIA_CONFIG) {
                Object.assign(CONFIG, window.VOCALIA_CONFIG);
            }

            const lang = detectLanguage();
            await loadLanguage(lang);

            // Detect tenant ID for e-commerce features
            detectTenantId();
            if (state.tenantId) {
                await loadTenantConfig();
                if (CONFIG.ECOMMERCE_MODE) {
                    UCP.syncPreference().catch(e => console.warn('[VocalIA] UCP init failed:', e.message));
                }
            }

            captureAttribution();
            createWidget();
            initExitIntent();
            initSocialProof();
            initSubWidgets();

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
        // 0. Priority: Global Config
        if (CONFIG.tenantId) {
            state.tenantId = CONFIG.tenantId;
            return;
        }

        // 1. Script data attribute
        const scriptTag = document.querySelector('script[data-vocalia-tenant]') ||
            document.querySelector('script[data-tenant-id]');
        if (scriptTag) {
            state.tenantId = scriptTag.dataset.vocaliaTenant || scriptTag.dataset.tenantId;
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
        const widgetElement = document.getElementById('vocalia-widget') ||
            document.getElementById('voice-assistant-widget');
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
/**
 * VocalIA - Voice Abandoned Cart Recovery Widget
 * Version: 1.0.0 | Session 250.82
 *
 * UNIQUE COMPETITIVE ADVANTAGE: Voice-based cart recovery
 * Estimated impact: +25% recovery vs SMS/email (benchmark data)
 *
 * Features:
 * - Cart abandonment detection (exit-intent + inactivity + tab blur)
 * - Voice reminder popup with TTS
 * - Multi-channel recovery: Voice callback, SMS, Email
 * - 5 languages: FR, EN, ES, AR, Darija (ary)
 * - RTL support for Arabic/Darija
 * - GA4 event tracking
 * - UCP integration for personalization
 * - Orchestrator integration
 */

(function () {
    'use strict';

    // ============================================================
    // TRANSLATIONS (5 LANGUAGES)
    // ============================================================

    const TRANSLATIONS = {
        fr: {
            title: 'Votre panier vous attend !',
            subtitle: 'Vous avez {{count}} article(s) dans votre panier',
            subtitleSingular: 'Vous avez 1 article dans votre panier',
            voiceReminder: 'Attendez ! Ne partez pas les mains vides...',
            valueLabel: 'Valeur totale :',
            offerLabel: 'Offre exclusive :',
            offerText: '{{discount}}% de reduction si vous finalisez maintenant',
            callbackTitle: 'Rappel vocal gratuit',
            callbackDesc: 'Recevez un rappel vocal personnalise',
            smsTitle: 'Rappel par SMS',
            smsDesc: 'Lien direct vers votre panier',
            emailTitle: 'Rappel par email',
            emailDesc: 'Recapitulatif de votre panier',
            phonePlaceholder: '+212 6XX XXX XXX',
            emailPlaceholder: 'votre@email.com',
            sendBtn: 'Recevoir le rappel',
            checkoutBtn: 'Finaliser ma commande',
            continueBrowsing: 'Continuer mes achats',
            successCallback: 'Parfait ! Vous recevrez un appel dans quelques minutes.',
            successSms: 'SMS envoye ! Verifiez votre telephone.',
            successEmail: 'Email envoye ! Verifiez votre boite de reception.',
            errorInvalid: 'Veuillez entrer un numero ou email valide',
            errorSend: 'Erreur lors de l\'envoi. Reessayez.',
            cartItemsLabel: 'Articles :',
            expiresIn: 'Offre valable encore {{minutes}} min'
        },
        en: {
            title: 'Your cart is waiting!',
            subtitle: 'You have {{count}} item(s) in your cart',
            subtitleSingular: 'You have 1 item in your cart',
            voiceReminder: 'Wait! Don\'t leave empty-handed...',
            valueLabel: 'Total value:',
            offerLabel: 'Exclusive offer:',
            offerText: '{{discount}}% off if you complete now',
            callbackTitle: 'Free voice callback',
            callbackDesc: 'Get a personalized voice reminder',
            smsTitle: 'SMS reminder',
            smsDesc: 'Direct link to your cart',
            emailTitle: 'Email reminder',
            emailDesc: 'Summary of your cart',
            phonePlaceholder: '+1 XXX XXX XXXX',
            emailPlaceholder: 'your@email.com',
            sendBtn: 'Get reminder',
            checkoutBtn: 'Complete my order',
            continueBrowsing: 'Continue shopping',
            successCallback: 'Perfect! You\'ll receive a call shortly.',
            successSms: 'SMS sent! Check your phone.',
            successEmail: 'Email sent! Check your inbox.',
            errorInvalid: 'Please enter a valid phone or email',
            errorSend: 'Error sending. Please retry.',
            cartItemsLabel: 'Items:',
            expiresIn: 'Offer valid for {{minutes}} more min'
        },
        es: {
            title: 'Tu carrito te espera!',
            subtitle: 'Tienes {{count}} articulo(s) en tu carrito',
            subtitleSingular: 'Tienes 1 articulo en tu carrito',
            voiceReminder: 'Espera! No te vayas con las manos vacias...',
            valueLabel: 'Valor total:',
            offerLabel: 'Oferta exclusiva:',
            offerText: '{{discount}}% de descuento si finalizas ahora',
            callbackTitle: 'Llamada de recordatorio gratis',
            callbackDesc: 'Recibe un recordatorio de voz personalizado',
            smsTitle: 'Recordatorio por SMS',
            smsDesc: 'Enlace directo a tu carrito',
            emailTitle: 'Recordatorio por email',
            emailDesc: 'Resumen de tu carrito',
            phonePlaceholder: '+34 XXX XXX XXX',
            emailPlaceholder: 'tu@email.com',
            sendBtn: 'Recibir recordatorio',
            checkoutBtn: 'Finalizar mi pedido',
            continueBrowsing: 'Seguir comprando',
            successCallback: 'Perfecto! Recibiras una llamada en breve.',
            successSms: 'SMS enviado! Revisa tu telefono.',
            successEmail: 'Email enviado! Revisa tu bandeja.',
            errorInvalid: 'Por favor ingresa un numero o email valido',
            errorSend: 'Error al enviar. Reintenta.',
            cartItemsLabel: 'Articulos:',
            expiresIn: 'Oferta valida por {{minutes}} min mas'
        },
        ar: {
            title: 'سلتك بانتظارك!',
            subtitle: 'لديك {{count}} منتج(ات) في سلتك',
            subtitleSingular: 'لديك منتج واحد في سلتك',
            voiceReminder: 'انتظر! لا تغادر بيدين فارغتين...',
            valueLabel: 'القيمة الإجمالية:',
            offerLabel: 'عرض حصري:',
            offerText: '{{discount}}% خصم إذا أتممت الآن',
            callbackTitle: 'مكالمة تذكير مجانية',
            callbackDesc: 'احصل على تذكير صوتي مخصص',
            smsTitle: 'تذكير عبر SMS',
            smsDesc: 'رابط مباشر لسلتك',
            emailTitle: 'تذكير عبر البريد',
            emailDesc: 'ملخص سلتك',
            phonePlaceholder: '+212 6XX XXX XXX',
            emailPlaceholder: 'بريدك@مثال.com',
            sendBtn: 'استلم التذكير',
            checkoutBtn: 'إتمام طلبي',
            continueBrowsing: 'متابعة التسوق',
            successCallback: 'ممتاز! ستتلقى مكالمة قريبًا.',
            successSms: 'تم إرسال SMS! تحقق من هاتفك.',
            successEmail: 'تم إرسال البريد! تحقق من صندوقك.',
            errorInvalid: 'يرجى إدخال رقم أو بريد صحيح',
            errorSend: 'خطأ في الإرسال. حاول مجددًا.',
            cartItemsLabel: 'المنتجات:',
            expiresIn: 'العرض صالح لمدة {{minutes}} دقيقة'
        },
        ary: {
            title: 'الباني ديالك كيتسناك!',
            subtitle: 'عندك {{count}} منتوج(ات) فالباني',
            subtitleSingular: 'عندك منتوج واحد فالباني',
            voiceReminder: 'تسنا! ما تمشيش بيديك خاويين...',
            valueLabel: 'المجموع:',
            offerLabel: 'عرض خاص:',
            offerText: '{{discount}}% تخفيض إلا كملتي دابا',
            callbackTitle: 'تيليفون مجاني',
            callbackDesc: 'غادي نعيطو ليك باش نفكروك',
            smsTitle: 'SMS للتذكير',
            smsDesc: 'لينك مباشر للباني',
            emailTitle: 'إيميل للتذكير',
            emailDesc: 'ملخص الباني ديالك',
            phonePlaceholder: '+212 6XX XXX XXX',
            emailPlaceholder: 'الإيميل ديالك',
            sendBtn: 'بغيت التذكير',
            checkoutBtn: 'نكمل الطلب',
            continueBrowsing: 'نكمل التسوق',
            successCallback: 'مزيان! غادي نعيطو ليك دابا.',
            successSms: 'SMS مشى! شوف التيليفون.',
            successEmail: 'الإيميل مشى! شوف البوات.',
            errorInvalid: 'دخل رقم ولا إيميل صحيح',
            errorSend: 'كاين مشكل. عاود.',
            cartItemsLabel: 'المنتوجات:',
            expiresIn: 'العرض صالح {{minutes}} دقيقة'
        }
    };

    // ============================================================
    // STYLES
    // ============================================================

    const STYLES = `
    .va-abandoned-cart-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
      z-index: 10001;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s ease, visibility 0.3s ease;
    }

    .va-abandoned-cart-overlay.active {
      opacity: 1;
      visibility: visible;
    }

    .va-abandoned-cart-modal {
      background: linear-gradient(135deg, #0f172a 0%, #0c1220 100%);
      border: 1px solid rgba(94, 106, 210, 0.3);
      border-radius: 24px;
      max-width: 480px;
      width: 95%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5), 0 0 40px rgba(94, 106, 210, 0.2);
      animation: vaCartSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .va-abandoned-cart-modal[dir="rtl"] {
      text-align: right;
    }

    @keyframes vaCartSlideIn {
      from {
        transform: translateY(-30px) scale(0.95);
        opacity: 0;
      }
      to {
        transform: translateY(0) scale(1);
        opacity: 1;
      }
    }

    .va-cart-header {
      padding: 24px 24px 16px;
      text-align: center;
      border-bottom: 1px solid rgba(94, 106, 210, 0.15);
    }

    .va-cart-icon {
      width: 64px;
      height: 64px;
      margin: 0 auto 16px;
      background: linear-gradient(135deg, #5E6AD2 0%, #10B981 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: vaPulseCart 2s infinite;
    }

    @keyframes vaPulseCart {
      0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(94, 106, 210, 0.4); }
      50% { transform: scale(1.05); box-shadow: 0 0 0 15px rgba(94, 106, 210, 0); }
    }

    .va-cart-icon svg {
      width: 32px;
      height: 32px;
      fill: white;
    }

    .va-cart-title {
      color: #FFFFFF;
      font-size: 24px;
      font-weight: 700;
      margin: 0 0 8px;
    }

    .va-cart-subtitle {
      color: rgba(255, 255, 255, 0.7);
      font-size: 16px;
      margin: 0;
    }

    .va-cart-value {
      background: rgba(94, 106, 210, 0.1);
      border-radius: 12px;
      padding: 12px 16px;
      margin: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .va-cart-value-label {
      color: rgba(255, 255, 255, 0.7);
      font-size: 14px;
    }

    .va-cart-value-amount {
      color: #5E6AD2;
      font-size: 20px;
      font-weight: 700;
    }

    .va-cart-offer {
      background: linear-gradient(90deg, rgba(16, 185, 129, 0.15) 0%, rgba(94, 106, 210, 0.15) 100%);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 12px;
      padding: 12px 16px;
      margin: 0 24px 16px;
      text-align: center;
    }

    .va-cart-offer-label {
      color: #10B981;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .va-cart-offer-text {
      color: #FFFFFF;
      font-size: 16px;
      font-weight: 600;
      margin-top: 4px;
    }

    .va-cart-timer {
      color: rgba(255, 255, 255, 0.6);
      font-size: 12px;
      margin-top: 8px;
    }

    .va-cart-items-preview {
      padding: 0 24px 16px;
    }

    .va-cart-items-label {
      color: rgba(255, 255, 255, 0.6);
      font-size: 12px;
      margin-bottom: 8px;
    }

    .va-cart-items-row {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 8px;
    }

    .va-cart-item-thumb {
      width: 48px;
      height: 48px;
      border-radius: 8px;
      object-fit: cover;
      border: 1px solid rgba(94, 106, 210, 0.2);
      flex-shrink: 0;
    }

    .va-cart-recovery-options {
      padding: 0 24px 16px;
    }

    .va-recovery-option {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .va-recovery-option:hover {
      background: rgba(94, 106, 210, 0.1);
      border-color: rgba(94, 106, 210, 0.3);
    }

    .va-recovery-option.selected {
      background: rgba(94, 106, 210, 0.15);
      border-color: #5E6AD2;
    }

    .va-recovery-option-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .va-recovery-option-icon.voice {
      background: linear-gradient(135deg, #5E6AD2 0%, #4f46e5 100%);
    }

    .va-recovery-option-icon.sms {
      background: linear-gradient(135deg, #10B981 0%, #059669 100%);
    }

    .va-recovery-option-icon.email {
      background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
    }

    .va-recovery-option-icon svg {
      width: 20px;
      height: 20px;
      fill: white;
    }

    .va-recovery-option-content {
      flex: 1;
    }

    .va-recovery-option-title {
      color: #FFFFFF;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 2px;
    }

    .va-recovery-option-desc {
      color: rgba(255, 255, 255, 0.6);
      font-size: 12px;
    }

    .va-recovery-option-radio {
      width: 20px;
      height: 20px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      position: relative;
    }

    .va-recovery-option.selected .va-recovery-option-radio {
      border-color: #5E6AD2;
    }

    .va-recovery-option.selected .va-recovery-option-radio::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 10px;
      height: 10px;
      background: #5E6AD2;
      border-radius: 50%;
    }

    .va-cart-input-group {
      padding: 0 24px 16px;
    }

    .va-cart-input {
      width: 100%;
      padding: 14px 16px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 12px;
      color: #FFFFFF;
      font-size: 16px;
      outline: none;
      transition: border-color 0.2s ease;
      box-sizing: border-box;
    }

    .va-cart-input:focus {
      border-color: #5E6AD2;
    }

    .va-cart-input::placeholder {
      color: rgba(255, 255, 255, 0.4);
    }

    .va-cart-input[dir="rtl"] {
      text-align: right;
    }

    .va-cart-actions {
      padding: 0 24px 24px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .va-cart-btn {
      padding: 14px 24px;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .va-cart-btn.primary {
      background: linear-gradient(135deg, #5E6AD2 0%, #10B981 100%);
      color: white;
    }

    .va-cart-btn.primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(94, 106, 210, 0.4);
    }

    .va-cart-btn.secondary {
      background: rgba(94, 106, 210, 0.1);
      color: #5E6AD2;
      border: 1px solid rgba(94, 106, 210, 0.3);
    }

    .va-cart-btn.secondary:hover {
      background: rgba(94, 106, 210, 0.2);
    }

    .va-cart-btn.text {
      background: transparent;
      color: rgba(255, 255, 255, 0.6);
    }

    .va-cart-btn.text:hover {
      color: #FFFFFF;
    }

    .va-cart-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    .va-cart-btn svg {
      width: 18px;
      height: 18px;
    }

    .va-cart-close {
      position: absolute;
      top: 16px;
      right: 16px;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s ease;
    }

    .va-cart-close:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .va-cart-close svg {
      width: 16px;
      height: 16px;
      fill: white;
    }

    [dir="rtl"] .va-cart-close {
      right: auto;
      left: 16px;
    }

    .va-cart-message {
      padding: 12px 16px;
      margin: 0 24px 16px;
      border-radius: 10px;
      font-size: 14px;
      text-align: center;
    }

    .va-cart-message.success {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #10B981;
    }

    .va-cart-message.error {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #EF4444;
    }

    /* Voice speaking animation */
    .va-cart-speaking .va-cart-icon {
      animation: vaSpeakingPulse 0.5s infinite;
    }

    @keyframes vaSpeakingPulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }

    /* Mobile responsive */
    @media (max-width: 480px) {
      .va-abandoned-cart-modal {
        border-radius: 20px 20px 0 0;
        max-width: 100%;
        width: 100%;
        position: fixed;
        bottom: 0;
        margin: 0;
        max-height: 85vh;
      }

      .va-cart-header {
        padding: 20px 20px 14px;
      }

      .va-cart-title {
        font-size: 20px;
      }

      .va-cart-value,
      .va-cart-offer,
      .va-cart-recovery-options,
      .va-cart-input-group,
      .va-cart-actions {
        padding-left: 20px;
        padding-right: 20px;
      }
    }
  `;

    // ============================================================
    // ABANDONED CART RECOVERY CLASS
    // ============================================================

    class AbandonedCartRecovery {
        constructor(options = {}) {
            this.config = {
                tenantId: options.tenantId || this.detectTenantId(),
                lang: options.lang || this.detectLanguage(),
                apiUrl: options.apiUrl || this.detectApiUrl(),
                discountPercent: options.discountPercent || 10,
                offerDurationMinutes: options.offerDurationMinutes || 15,
                inactivityTimeout: options.inactivityTimeout || 180000, // 3 minutes
                tabBlurTimeout: options.tabBlurTimeout || 60000, // 1 minute
                minCartValue: options.minCartValue || 0,
                cooldownPeriod: options.cooldownPeriod || 86400000, // 24 hours
                voiceEnabled: options.voiceEnabled !== false,
                checkoutUrl: options.checkoutUrl || '/checkout',
                cartSelector: options.cartSelector || null, // Custom cart data selector
                onShow: options.onShow || null,
                onHide: options.onHide || null,
                onRecovery: options.onRecovery || null
            };

            this.state = {
                isVisible: false,
                isSpeaking: false,
                selectedChannel: 'voice', // voice, sms, email
                cartData: null,
                timerInterval: null,
                remainingMinutes: this.config.offerDurationMinutes,
                inactivityTimer: null,
                tabBlurTimer: null,
                messageType: null,
                messageText: null
            };

            this.elements = {};
            this.translations = TRANSLATIONS[this.config.lang] || TRANSLATIONS.en;
            this.isRTL = ['ar', 'ary'].includes(this.config.lang);

            this.init();
        }

        detectTenantId() {
            const widget = document.querySelector('[data-vocalia-tenant]');
            if (widget) return widget.dataset.vocaliaTenant;
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('tenant') || 'default';
        }

        detectLanguage() {
            const widget = document.querySelector('[data-vocalia-lang]');
            if (widget) return widget.dataset.vocaliaLang;
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('lang')) return urlParams.get('lang');
            const browserLang = navigator.language?.split('-')[0];
            return ['fr', 'en', 'es', 'ar', 'ary'].includes(browserLang) ? browserLang : 'fr';
        }

        detectApiUrl() {
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            return isLocal ? 'http://localhost:3013/api' : 'https://api.vocalia.ma/api';
        }

        init() {
            // Inject styles
            if (!document.querySelector('#va-abandoned-cart-styles')) {
                const styleEl = document.createElement('style');
                styleEl.id = 'va-abandoned-cart-styles';
                styleEl.textContent = STYLES;
                document.head.appendChild(styleEl);
            }

            // Create modal structure
            this.createModal();

            // Setup detection triggers
            this.setupDetection();

            // Check cooldown
            this.checkCooldown();

            // Listen for orchestrator events
            this.setupOrchestratorIntegration();
        }

        createModal() {
            const overlay = document.createElement('div');
            overlay.className = 'va-abandoned-cart-overlay';
            overlay.id = 'va-abandoned-cart-overlay';
            overlay.innerHTML = this.getModalHTML();
            document.body.appendChild(overlay);

            this.elements.overlay = overlay;
            this.elements.modal = overlay.querySelector('.va-abandoned-cart-modal');
            this.elements.closeBtn = overlay.querySelector('.va-cart-close');
            this.elements.input = overlay.querySelector('.va-cart-input');
            this.elements.sendBtn = overlay.querySelector('.va-cart-send-btn');
            this.elements.checkoutBtn = overlay.querySelector('.va-cart-checkout-btn');
            this.elements.continueBtn = overlay.querySelector('.va-cart-continue-btn');
            this.elements.message = overlay.querySelector('.va-cart-message');
            this.elements.timer = overlay.querySelector('.va-cart-timer');
            this.elements.subtitle = overlay.querySelector('.va-cart-subtitle');
            this.elements.valueAmount = overlay.querySelector('.va-cart-value-amount');
            this.elements.itemsRow = overlay.querySelector('.va-cart-items-row');
            this.elements.offerText = overlay.querySelector('.va-cart-offer-text');

            // Event listeners
            this.elements.closeBtn.addEventListener('click', () => this.hide());
            this.elements.overlay.addEventListener('click', (e) => {
                if (e.target === this.elements.overlay) this.hide();
            });

            // Recovery options
            overlay.querySelectorAll('.va-recovery-option').forEach(opt => {
                opt.addEventListener('click', () => this.selectChannel(opt.dataset.channel));
            });

            // Send reminder
            this.elements.sendBtn.addEventListener('click', () => this.sendReminder());

            // Checkout
            this.elements.checkoutBtn.addEventListener('click', () => this.goToCheckout());

            // Continue browsing
            this.elements.continueBtn.addEventListener('click', () => this.hide());

            // Input placeholder update
            this.elements.input.addEventListener('focus', () => this.updateInputPlaceholder());
        }

        getModalHTML() {
            const t = this.translations;
            const dir = this.isRTL ? 'rtl' : 'ltr';

            return `
        <div class="va-abandoned-cart-modal" dir="${dir}" role="dialog" aria-modal="true" aria-labelledby="va-cart-title">
          <button class="va-cart-close" aria-label="Close">
            <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>

          <div class="va-cart-header">
            <div class="va-cart-icon">
              <svg viewBox="0 0 24 24"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>
            </div>
            <h2 class="va-cart-title" id="va-cart-title">${t.title}</h2>
            <p class="va-cart-subtitle">${t.subtitleSingular}</p>
          </div>

          <div class="va-cart-value">
            <span class="va-cart-value-label">${t.valueLabel}</span>
            <span class="va-cart-value-amount">0 MAD</span>
          </div>

          <div class="va-cart-offer">
            <div class="va-cart-offer-label">${t.offerLabel}</div>
            <div class="va-cart-offer-text">${t.offerText.replace('{{discount}}', this.config.discountPercent)}</div>
            <div class="va-cart-timer">${t.expiresIn.replace('{{minutes}}', this.config.offerDurationMinutes)}</div>
          </div>

          <div class="va-cart-items-preview">
            <div class="va-cart-items-label">${t.cartItemsLabel}</div>
            <div class="va-cart-items-row"></div>
          </div>

          <div class="va-cart-recovery-options">
            <div class="va-recovery-option selected" data-channel="voice">
              <div class="va-recovery-option-icon voice">
                <svg viewBox="0 0 24 24"><path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/></svg>
              </div>
              <div class="va-recovery-option-content">
                <div class="va-recovery-option-title">${t.callbackTitle}</div>
                <div class="va-recovery-option-desc">${t.callbackDesc}</div>
              </div>
              <div class="va-recovery-option-radio"></div>
            </div>

            <div class="va-recovery-option" data-channel="sms">
              <div class="va-recovery-option-icon sms">
                <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>
              </div>
              <div class="va-recovery-option-content">
                <div class="va-recovery-option-title">${t.smsTitle}</div>
                <div class="va-recovery-option-desc">${t.smsDesc}</div>
              </div>
              <div class="va-recovery-option-radio"></div>
            </div>

            <div class="va-recovery-option" data-channel="email">
              <div class="va-recovery-option-icon email">
                <svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
              </div>
              <div class="va-recovery-option-content">
                <div class="va-recovery-option-title">${t.emailTitle}</div>
                <div class="va-recovery-option-desc">${t.emailDesc}</div>
              </div>
              <div class="va-recovery-option-radio"></div>
            </div>
          </div>

          <div class="va-cart-input-group">
            <input type="text" class="va-cart-input" placeholder="${t.phonePlaceholder}" dir="${this.isRTL ? 'rtl' : 'ltr'}">
          </div>

          <div class="va-cart-message" style="display: none;"></div>

          <div class="va-cart-actions">
            <button class="va-cart-btn primary va-cart-send-btn">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
              ${t.sendBtn}
            </button>
            <button class="va-cart-btn secondary va-cart-checkout-btn">
              ${t.checkoutBtn}
            </button>
            <button class="va-cart-btn text va-cart-continue-btn">
              ${t.continueBrowsing}
            </button>
          </div>
        </div>
      `;
        }

        setupDetection() {
            // Exit intent detection (desktop)
            document.addEventListener('mouseout', (e) => {
                if (e.clientY < 10 && !this.state.isVisible) {
                    this.checkAndShow('exit_intent');
                }
            });

            // Tab visibility change
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    this.startTabBlurTimer();
                } else {
                    this.clearTabBlurTimer();
                }
            });

            // Inactivity detection
            this.resetInactivityTimer();
            ['mousemove', 'keydown', 'scroll', 'touchstart'].forEach(event => {
                document.addEventListener(event, () => this.resetInactivityTimer(), { passive: true });
            });

            // Before unload (for analytics)
            window.addEventListener('beforeunload', () => {
                if (this.hasCartItems()) {
                    this.trackEvent('cart_abandoned_page_exit');
                }
            });
        }

        setupOrchestratorIntegration() {
            // Integrate with Widget Orchestrator if available
            if (window.VocalIA?.Orchestrator) {
                window.VocalIA.Orchestrator.on('widgetActivated', (data) => {
                    // Pause abandoned cart detection when other widgets are active
                    if (data.widgetName !== 'abandonedCart' && this.state.isVisible) {
                        this.hide();
                    }
                });

                // Register with orchestrator
                window.VocalIA.Orchestrator.widgets.abandonedCart = {
                    priority: 6, // Lower priority than quiz (3) but shows for cart
                    isActive: false,
                    element: null,
                    triggers: ['cart_abandon', 'exit_with_cart']
                };
            }
        }

        checkCooldown() {
            const lastShown = localStorage.getItem('va_cart_recovery_last_shown');
            if (lastShown) {
                const elapsed = Date.now() - parseInt(lastShown, 10);
                if (elapsed < this.config.cooldownPeriod) {
                    this.cooldownActive = true;
                    return;
                }
            }
            this.cooldownActive = false;
        }

        startInactivityTimer() {
            this.state.inactivityTimer = setTimeout(() => {
                this.checkAndShow('inactivity');
            }, this.config.inactivityTimeout);
        }

        resetInactivityTimer() {
            if (this.state.inactivityTimer) {
                clearTimeout(this.state.inactivityTimer);
            }
            this.startInactivityTimer();
        }

        startTabBlurTimer() {
            this.state.tabBlurTimer = setTimeout(() => {
                this.checkAndShow('tab_blur');
            }, this.config.tabBlurTimeout);
        }

        clearTabBlurTimer() {
            if (this.state.tabBlurTimer) {
                clearTimeout(this.state.tabBlurTimer);
                this.state.tabBlurTimer = null;
            }
        }

        hasCartItems() {
            const cart = this.getCartData();
            return cart && cart.items && cart.items.length > 0;
        }

        getCartData() {
            // Try multiple sources for cart data

            // 1. Custom selector
            if (this.config.cartSelector) {
                const el = document.querySelector(this.config.cartSelector);
                if (el) {
                    try {
                        return JSON.parse(el.textContent || el.dataset.cart);
                    } catch (e) { }
                }
            }

            // 2. VocalIA cart state
            if (window.VocalIA?.cart) {
                return window.VocalIA.cart;
            }

            // 3. Common e-commerce platforms
            // Shopify
            if (window.Shopify?.checkout?.line_items) {
                return {
                    items: window.Shopify.checkout.line_items.map(item => ({
                        id: item.variant_id,
                        name: item.title,
                        price: item.price,
                        quantity: item.quantity,
                        image: item.image
                    })),
                    total: window.Shopify.checkout.total_price / 100,
                    currency: window.Shopify.checkout.currency || 'MAD'
                };
            }

            // WooCommerce
            if (window.wc_cart_fragments_params) {
                const cartHash = document.querySelector('.cart-contents-count');
                if (cartHash && parseInt(cartHash.textContent) > 0) {
                    return { items: [{}], total: 0, currency: 'MAD' };
                }
            }

            // 4. LocalStorage cart
            const storedCart = localStorage.getItem('va_cart') || localStorage.getItem('cart');
            if (storedCart) {
                try {
                    return JSON.parse(storedCart);
                } catch (e) { }
            }

            // 5. Demo cart for testing
            if (window.location.search.includes('demo_cart=1')) {
                return {
                    items: [
                        { id: '1', name: 'Produit Demo 1', price: 299, quantity: 1, image: 'https://placehold.co/100x100/191E35/4FBAF1?text=P1' },
                        { id: '2', name: 'Produit Demo 2', price: 199, quantity: 2, image: 'https://placehold.co/100x100/191E35/10B981?text=P2' }
                    ],
                    total: 697,
                    currency: 'MAD'
                };
            }

            return null;
        }

        checkAndShow(trigger) {
            // Check if we should show
            if (this.state.isVisible) return;
            if (this.cooldownActive) return;
            if (!this.hasCartItems()) return;

            // Check orchestrator permission
            if (window.VocalIA?.Orchestrator && !window.VocalIA.Orchestrator.canShow('abandonedCart')) {
                return;
            }

            // Get cart data
            this.state.cartData = this.getCartData();

            // Check minimum cart value
            if (this.state.cartData.total < this.config.minCartValue) return;

            // Show the modal
            this.show(trigger);
        }

        show(trigger = 'manual') {
            if (this.state.isVisible) return;

            this.state.isVisible = true;
            this.updateCartDisplay();
            this.elements.overlay.classList.add('active');

            // Start countdown timer
            this.startCountdown();

            // Speak voice reminder
            if (this.config.voiceEnabled) {
                setTimeout(() => this.speak(this.translations.voiceReminder), 500);
            }

            // Set cooldown
            localStorage.setItem('va_cart_recovery_last_shown', Date.now().toString());
            this.cooldownActive = true;

            // Notify orchestrator
            if (window.VocalIA?.Orchestrator) {
                window.VocalIA.Orchestrator.activate('abandonedCart');
            }

            // Track event
            this.trackEvent('cart_recovery_shown', {
                trigger,
                cart_value: this.state.cartData?.total || 0,
                items_count: this.state.cartData?.items?.length || 0
            });

            // Callback
            if (this.config.onShow) {
                this.config.onShow({ trigger, cartData: this.state.cartData });
            }
        }

        hide() {
            this.state.isVisible = false;
            this.elements.overlay.classList.remove('active');
            this.stopCountdown();
            this.stopSpeaking();

            // Notify orchestrator
            if (window.VocalIA?.Orchestrator) {
                window.VocalIA.Orchestrator.deactivate('abandonedCart');
            }

            // Track event
            this.trackEvent('cart_recovery_closed');

            // Callback
            if (this.config.onHide) {
                this.config.onHide();
            }
        }

        updateCartDisplay() {
            const cart = this.state.cartData;
            if (!cart) return;

            // Update subtitle with item count
            const count = cart.items?.length || 0;
            this.elements.subtitle.textContent = count === 1
                ? this.translations.subtitleSingular
                : this.translations.subtitle.replace('{{count}}', count);

            // Update total value
            const currency = cart.currency || 'MAD';
            const total = cart.total || 0;
            this.elements.valueAmount.textContent = `${total.toLocaleString()} ${currency}`;

            // Update items preview
            this.elements.itemsRow.innerHTML = '';
            if (cart.items) {
                cart.items.slice(0, 5).forEach(item => {
                    if (item.image) {
                        const img = document.createElement('img');
                        img.className = 'va-cart-item-thumb';
                        img.src = item.image;
                        img.alt = item.name || 'Product';
                        this.elements.itemsRow.appendChild(img);
                    }
                });
            }
        }

        startCountdown() {
            this.state.remainingMinutes = this.config.offerDurationMinutes;
            this.updateTimerDisplay();

            this.state.timerInterval = setInterval(() => {
                this.state.remainingMinutes -= 1;
                this.updateTimerDisplay();

                if (this.state.remainingMinutes <= 0) {
                    this.stopCountdown();
                    this.hide();
                }
            }, 60000); // Update every minute
        }

        stopCountdown() {
            if (this.state.timerInterval) {
                clearInterval(this.state.timerInterval);
                this.state.timerInterval = null;
            }
        }

        updateTimerDisplay() {
            this.elements.timer.textContent = this.translations.expiresIn.replace(
                '{{minutes}}',
                this.state.remainingMinutes
            );
        }

        selectChannel(channel) {
            this.state.selectedChannel = channel;

            // Update UI
            this.elements.overlay.querySelectorAll('.va-recovery-option').forEach(opt => {
                opt.classList.toggle('selected', opt.dataset.channel === channel);
            });

            // Update input placeholder
            this.updateInputPlaceholder();

            // Track event
            this.trackEvent('cart_recovery_channel_selected', { channel });
        }

        updateInputPlaceholder() {
            const t = this.translations;
            switch (this.state.selectedChannel) {
                case 'voice':
                case 'sms':
                    this.elements.input.placeholder = t.phonePlaceholder;
                    this.elements.input.type = 'tel';
                    break;
                case 'email':
                    this.elements.input.placeholder = t.emailPlaceholder;
                    this.elements.input.type = 'email';
                    break;
            }
        }

        async sendReminder() {
            const value = this.elements.input.value.trim();
            const channel = this.state.selectedChannel;

            // Validate input
            if (!this.validateInput(value, channel)) {
                this.showMessage('error', this.translations.errorInvalid);
                return;
            }

            // Disable button
            this.elements.sendBtn.disabled = true;

            try {
                // Send to API
                const response = await fetch(`${this.config.apiUrl}/cart-recovery`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        tenant_id: this.config.tenantId,
                        channel,
                        contact: value,
                        cart: this.state.cartData,
                        discount_percent: this.config.discountPercent,
                        language: this.config.lang,
                        checkout_url: window.location.origin + this.config.checkoutUrl
                    })
                });

                if (!response.ok) throw new Error('API error');

                // Show success message
                const successMessages = {
                    voice: this.translations.successCallback,
                    sms: this.translations.successSms,
                    email: this.translations.successEmail
                };
                this.showMessage('success', successMessages[channel]);

                // Speak confirmation
                if (this.config.voiceEnabled) {
                    this.speak(successMessages[channel]);
                }

                // Track event
                this.trackEvent('cart_recovery_reminder_sent', {
                    channel,
                    cart_value: this.state.cartData?.total || 0
                });

                // Callback
                if (this.config.onRecovery) {
                    this.config.onRecovery({ channel, contact: value, cartData: this.state.cartData });
                }

                // Close after delay
                setTimeout(() => this.hide(), 3000);

            } catch (error) {
                console.error('[AbandonedCartRecovery] Send error:', error);
                this.showMessage('error', this.translations.errorSend);
            } finally {
                this.elements.sendBtn.disabled = false;
            }
        }

        validateInput(value, channel) {
            if (!value) return false;

            switch (channel) {
                case 'voice':
                case 'sms':
                    // Phone validation (international format)
                    return /^\+?[0-9]{8,15}$/.test(value.replace(/[\s-]/g, ''));
                case 'email':
                    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
                default:
                    return false;
            }
        }

        showMessage(type, text) {
            this.elements.message.className = `va-cart-message ${type}`;
            this.elements.message.textContent = text;
            this.elements.message.style.display = 'block';

            setTimeout(() => {
                this.elements.message.style.display = 'none';
            }, 5000);
        }

        goToCheckout() {
            // Track event
            this.trackEvent('cart_recovery_checkout_clicked', {
                cart_value: this.state.cartData?.total || 0,
                discount_applied: this.config.discountPercent
            });

            // Apply discount code if possible
            const discountCode = `COMEBACK${this.config.discountPercent}`;
            const checkoutUrl = new URL(this.config.checkoutUrl, window.location.origin);
            checkoutUrl.searchParams.set('discount', discountCode);

            // Redirect
            window.location.href = checkoutUrl.toString();
        }

        speak(text) {
            if (!window.speechSynthesis) return;

            this.stopSpeaking();
            this.state.isSpeaking = true;
            this.elements.modal.classList.add('va-cart-speaking');

            const utterance = new SpeechSynthesisUtterance(text);

            // Language mapping
            const langMap = {
                'fr': 'fr-FR',
                'en': 'en-US',
                'es': 'es-ES',
                'ar': 'ar-SA',
                'ary': 'ar-MA'
            };
            utterance.lang = langMap[this.config.lang] || 'fr-FR';
            utterance.rate = 0.9;
            utterance.pitch = 1;

            utterance.onend = () => {
                this.state.isSpeaking = false;
                this.elements.modal.classList.remove('va-cart-speaking');
            };

            window.speechSynthesis.speak(utterance);
        }

        stopSpeaking() {
            if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
            }
            this.state.isSpeaking = false;
            this.elements.modal?.classList.remove('va-cart-speaking');
        }

        trackEvent(eventName, params = {}) {
            // GA4
            if (window.gtag) {
                window.gtag('event', eventName, {
                    event_category: 'cart_recovery',
                    tenant_id: this.config.tenantId,
                    language: this.config.lang,
                    ...params
                });
            }

            // Plausible
            if (window.plausible) {
                window.plausible(eventName, { props: params });
            }

            // VocalIA Analytics
            if (window.VocalIA?.trackEvent) {
                window.VocalIA.trackEvent(eventName, params);
            }
        }

        // Public API
        trigger(reason = 'manual') {
            this.checkAndShow(reason);
        }

        setCartData(cartData) {
            this.state.cartData = cartData;
            if (this.state.isVisible) {
                this.updateCartDisplay();
            }
        }

        setDiscount(percent) {
            this.config.discountPercent = percent;
            if (this.elements.offerText) {
                this.elements.offerText.textContent = this.translations.offerText.replace('{{discount}}', percent);
            }
        }

        destroy() {
            this.hide();
            this.elements.overlay?.remove();
            if (this.state.inactivityTimer) clearTimeout(this.state.inactivityTimer);
            if (this.state.tabBlurTimer) clearTimeout(this.state.tabBlurTimer);
        }
    }

    // ============================================================
    // EXPORT
    // ============================================================

    // Auto-initialize
    let cartRecoveryInstance = null;

    function initAbandonedCartRecovery(options = {}) {
        if (cartRecoveryInstance) {
            cartRecoveryInstance.destroy();
        }
        cartRecoveryInstance = new AbandonedCartRecovery(options);
        return cartRecoveryInstance;
    }

    // Expose to window
    window.VocaliaAbandonedCart = {
        init: initAbandonedCartRecovery,
        getInstance: () => cartRecoveryInstance,
        AbandonedCartRecovery
    };

    // Integrate with VocalIA namespace
    if (typeof window.VocalIA !== 'undefined') {
        window.VocalIA.AbandonedCart = window.VocaliaAbandonedCart;

        // Add convenience methods
        window.VocalIA.triggerCartRecovery = function (reason = 'manual') {
            if (!cartRecoveryInstance) {
                cartRecoveryInstance = initAbandonedCartRecovery();
            }
            cartRecoveryInstance.trigger(reason);
        };

        window.VocalIA.setCartData = function (cartData) {
            if (!cartRecoveryInstance) {
                cartRecoveryInstance = initAbandonedCartRecovery();
            }
            cartRecoveryInstance.setCartData(cartData);
        };
    }

    // Auto-init if data attribute present
    document.addEventListener('DOMContentLoaded', () => {
        const widget = document.querySelector('[data-vocalia-cart-recovery]');
        if (widget) {
            initAbandonedCartRecovery({
                tenantId: widget.dataset.vocaliaTenant,
                lang: widget.dataset.vocaliaLang,
                discountPercent: parseInt(widget.dataset.discount) || 10,
                voiceEnabled: widget.dataset.voice !== 'false'
            });
        }
    });

})();
/**
 * VocalIA - Voice-Guided Product Quiz Widget
 *
 * Conversational voice-driven product quiz for lead generation
 * and personalized product recommendations.
 *
 * Features:
 * - Voice-first interaction with text fallback
 * - Multi-step quiz flow with branching logic
 * - Zero-party data collection
 * - Product recommendations based on answers
 * - Lead capture integration
 * - 5 language support with RTL
 *
 * Benchmark Impact (Source: ConvertFlow, Octane AI):
 * - +52% CTR vs static content
 * - 2x lead generation
 * - +65% completion rate vs text-only quiz
 *
 * Version: 1.0.0 | Session 250.79 | 03/02/2026
 */

(function (global) {
    'use strict';

    // CSS for the quiz widget
    const QUIZ_CSS = `
    .va-quiz-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(8px);
      z-index: 10003;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
    }

    .va-quiz-overlay.va-quiz-visible {
      opacity: 1;
      visibility: visible;
    }

    .va-quiz-container {
      width: 90%;
      max-width: 500px;
      max-height: 90vh;
      background: linear-gradient(145deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.95));
      border-radius: 20px;
      border: 1px solid rgba(139, 92, 246, 0.3);
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(139, 92, 246, 0.15);
      overflow: hidden;
      transform: scale(0.9) translateY(20px);
      transition: transform 0.3s ease;
    }

    .va-quiz-visible .va-quiz-container {
      transform: scale(1) translateY(0);
    }

    .va-quiz-header {
      padding: 20px;
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(59, 130, 246, 0.15));
      border-bottom: 1px solid rgba(139, 92, 246, 0.2);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .va-quiz-title {
      color: #e2e8f0;
      font-size: 18px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .va-quiz-title svg {
      width: 24px;
      height: 24px;
      color: #8b5cf6;
    }

    .va-quiz-close {
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: #94a3b8;
      cursor: pointer;
      padding: 8px;
      border-radius: 8px;
      transition: all 0.2s;
    }

    .va-quiz-close:hover {
      background: rgba(255, 255, 255, 0.15);
      color: #e2e8f0;
    }

    .va-quiz-progress {
      padding: 0 20px;
      margin-top: 16px;
    }

    .va-quiz-progress-bar {
      height: 4px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 2px;
      overflow: hidden;
    }

    .va-quiz-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #8b5cf6, #3b82f6);
      border-radius: 2px;
      transition: width 0.3s ease;
    }

    .va-quiz-progress-text {
      color: #64748b;
      font-size: 12px;
      margin-top: 8px;
      text-align: right;
    }

    .va-quiz-content {
      padding: 24px 20px;
      max-height: 50vh;
      overflow-y: auto;
    }

    .va-quiz-question {
      color: #e2e8f0;
      font-size: 20px;
      font-weight: 500;
      line-height: 1.4;
      margin-bottom: 24px;
      text-align: center;
    }

    .va-quiz-options {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .va-quiz-option {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 16px 20px;
      color: #e2e8f0;
      font-size: 15px;
      text-align: left;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .va-quiz-option:hover {
      background: rgba(139, 92, 246, 0.15);
      border-color: rgba(139, 92, 246, 0.4);
      transform: translateX(4px);
    }

    .va-quiz-option.va-quiz-selected {
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(59, 130, 246, 0.2));
      border-color: #8b5cf6;
    }

    .va-quiz-option-icon {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .va-quiz-option.va-quiz-selected .va-quiz-option-icon {
      background: #8b5cf6;
    }

    .va-quiz-option-icon svg {
      width: 14px;
      height: 14px;
      color: #94a3b8;
    }

    .va-quiz-option.va-quiz-selected .va-quiz-option-icon svg {
      color: white;
    }

    .va-quiz-voice-section {
      margin-top: 20px;
      padding: 16px;
      background: rgba(139, 92, 246, 0.1);
      border-radius: 12px;
      text-align: center;
    }

    .va-quiz-voice-hint {
      color: #a78bfa;
      font-size: 13px;
      margin-bottom: 12px;
    }

    .va-quiz-voice-btn {
      background: linear-gradient(135deg, #8b5cf6, #6366f1);
      border: none;
      color: white;
      padding: 14px 24px;
      border-radius: 50px;
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .va-quiz-voice-btn:hover {
      transform: scale(1.05);
      box-shadow: 0 8px 20px rgba(139, 92, 246, 0.4);
    }

    .va-quiz-voice-btn.va-quiz-listening {
      animation: va-quiz-pulse 1.5s infinite;
    }

    @keyframes va-quiz-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.4); }
      50% { box-shadow: 0 0 0 15px rgba(139, 92, 246, 0); }
    }

    .va-quiz-voice-btn svg {
      width: 20px;
      height: 20px;
    }

    .va-quiz-footer {
      padding: 16px 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      justify-content: space-between;
      gap: 12px;
    }

    .va-quiz-btn {
      flex: 1;
      padding: 14px 20px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
    }

    .va-quiz-btn-back {
      background: rgba(255, 255, 255, 0.1);
      color: #94a3b8;
    }

    .va-quiz-btn-back:hover {
      background: rgba(255, 255, 255, 0.15);
      color: #e2e8f0;
    }

    .va-quiz-btn-next {
      background: linear-gradient(135deg, #8b5cf6, #6366f1);
      color: white;
    }

    .va-quiz-btn-next:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
    }

    .va-quiz-btn-next:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Results screen */
    .va-quiz-results {
      text-align: center;
      padding: 20px;
    }

    .va-quiz-results-icon {
      width: 64px;
      height: 64px;
      background: linear-gradient(135deg, #10b981, #059669);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }

    .va-quiz-results-icon svg {
      width: 32px;
      height: 32px;
      color: white;
    }

    .va-quiz-results-title {
      color: #e2e8f0;
      font-size: 22px;
      font-weight: 600;
      margin-bottom: 12px;
    }

    .va-quiz-results-subtitle {
      color: #94a3b8;
      font-size: 14px;
      margin-bottom: 24px;
    }

    .va-quiz-lead-form {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
    }

    .va-quiz-lead-form input {
      width: 100%;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      padding: 12px 16px;
      color: #e2e8f0;
      font-size: 14px;
      margin-bottom: 12px;
    }

    .va-quiz-lead-form input:focus {
      outline: none;
      border-color: #8b5cf6;
    }

    .va-quiz-lead-form input::placeholder {
      color: #64748b;
    }

    /* RTL Support */
    [dir="rtl"] .va-quiz-option:hover {
      transform: translateX(-4px);
    }

    [dir="rtl"] .va-quiz-progress-text {
      text-align: left;
    }

    /* Mobile responsive */
    @media (max-width: 480px) {
      .va-quiz-container {
        width: 95%;
        max-height: 95vh;
      }

      .va-quiz-question {
        font-size: 18px;
      }

      .va-quiz-option {
        padding: 14px 16px;
        font-size: 14px;
      }
    }
  `;

    /**
     * Default quiz templates for common industries
     */
    const QUIZ_TEMPLATES = {
        skincare: {
            title: { fr: 'Trouvez votre routine parfaite', en: 'Find Your Perfect Routine', es: 'Encuentra tu rutina perfecta', ar: 'اعثر على روتينك المثالي', ary: 'لقى روتينك لي يناسبك' },
            questions: [
                {
                    id: 'skin_type',
                    question: { fr: 'Quel est votre type de peau ?', en: 'What is your skin type?', es: '¿Cuál es tu tipo de piel?', ar: 'ما هو نوع بشرتك؟', ary: 'شنو نوع جلدك?' },
                    options: [
                        { value: 'dry', label: { fr: 'Sèche', en: 'Dry', es: 'Seca', ar: 'جافة', ary: 'ناشف' } },
                        { value: 'oily', label: { fr: 'Grasse', en: 'Oily', es: 'Grasa', ar: 'دهنية', ary: 'دهني' } },
                        { value: 'combination', label: { fr: 'Mixte', en: 'Combination', es: 'Mixta', ar: 'مختلطة', ary: 'مخلوط' } },
                        { value: 'sensitive', label: { fr: 'Sensible', en: 'Sensitive', es: 'Sensible', ar: 'حساسة', ary: 'حساس' } }
                    ],
                    tags: { dry: ['hydrating', 'moisturizing'], oily: ['mattifying', 'oil-control'], combination: ['balancing'], sensitive: ['gentle', 'calming'] }
                },
                {
                    id: 'concern',
                    question: { fr: 'Quelle est votre préoccupation principale ?', en: 'What is your main concern?', es: '¿Cuál es tu principal preocupación?', ar: 'ما هو قلقك الرئيسي؟', ary: 'شنو لي كيهمك بزاف?' },
                    options: [
                        { value: 'acne', label: { fr: 'Acné', en: 'Acne', es: 'Acné', ar: 'حب الشباب', ary: 'الحبوب' } },
                        { value: 'aging', label: { fr: 'Anti-âge', en: 'Anti-aging', es: 'Anti-edad', ar: 'مكافحة الشيخوخة', ary: 'ضد الشيخوخة' } },
                        { value: 'hydration', label: { fr: 'Hydratation', en: 'Hydration', es: 'Hidratación', ar: 'ترطيب', ary: 'الترطيب' } },
                        { value: 'brightening', label: { fr: 'Éclat', en: 'Brightening', es: 'Luminosidad', ar: 'إشراق', ary: 'البريق' } }
                    ],
                    tags: { acne: ['salicylic', 'anti-acne'], aging: ['retinol', 'anti-wrinkle'], hydration: ['hyaluronic', 'moisturizing'], brightening: ['vitamin-c', 'brightening'] }
                },
                {
                    id: 'budget',
                    question: { fr: 'Quel est votre budget ?', en: 'What is your budget?', es: '¿Cuál es tu presupuesto?', ar: 'ما هي ميزانيتك؟', ary: 'شحال معاك تصرف?' },
                    options: [
                        { value: 'budget', label: { fr: 'Économique (< 50€)', en: 'Budget (< $50)', es: 'Económico (< 50€)', ar: 'اقتصادي (< 50$)', ary: 'رخيص (< 500 DH)' } },
                        { value: 'mid', label: { fr: 'Moyen (50-100€)', en: 'Mid-range ($50-100)', es: 'Medio (50-100€)', ar: 'متوسط (50-100$)', ary: 'معتدل (500-1000 DH)' } },
                        { value: 'premium', label: { fr: 'Premium (100€+)', en: 'Premium ($100+)', es: 'Premium (100€+)', ar: 'ممتاز (100$+)', ary: 'غالي (+1000 DH)' } }
                    ],
                    priceRanges: { budget: { max: 50 }, mid: { min: 50, max: 100 }, premium: { min: 100 } }
                }
            ]
        },
        electronics: {
            title: { fr: 'Trouvez l\'appareil idéal', en: 'Find Your Ideal Device', es: 'Encuentra tu dispositivo ideal', ar: 'اعثر على جهازك المثالي', ary: 'لقى الجهاز لي يناسبك' },
            questions: [
                {
                    id: 'usage',
                    question: { fr: 'Quelle sera l\'utilisation principale ?', en: 'What will be the main use?', es: '¿Cuál será el uso principal?', ar: 'ما هو الاستخدام الرئيسي؟', ary: 'شنو غادي دير بيه؟' },
                    options: [
                        { value: 'work', label: { fr: 'Travail', en: 'Work', es: 'Trabajo', ar: 'عمل', ary: 'خدمة' } },
                        { value: 'gaming', label: { fr: 'Gaming', en: 'Gaming', es: 'Gaming', ar: 'ألعاب', ary: 'العاب' } },
                        { value: 'casual', label: { fr: 'Usage quotidien', en: 'Daily use', es: 'Uso diario', ar: 'استخدام يومي', ary: 'كل يوم' } },
                        { value: 'creative', label: { fr: 'Création', en: 'Creative work', es: 'Creación', ar: 'إبداعي', ary: 'إبداع' } }
                    ],
                    tags: { work: ['professional', 'productivity'], gaming: ['gaming', 'high-performance'], casual: ['everyday', 'budget-friendly'], creative: ['creative', 'high-specs'] }
                },
                {
                    id: 'priority',
                    question: { fr: 'Quelle est votre priorité ?', en: 'What is your priority?', es: '¿Cuál es tu prioridad?', ar: 'ما هي أولويتك؟', ary: 'شنو لي مهم عندك بزاف؟' },
                    options: [
                        { value: 'performance', label: { fr: 'Performance', en: 'Performance', es: 'Rendimiento', ar: 'أداء', ary: 'القوة' } },
                        { value: 'battery', label: { fr: 'Autonomie', en: 'Battery life', es: 'Batería', ar: 'عمر البطارية', ary: 'البطارية' } },
                        { value: 'portability', label: { fr: 'Portabilité', en: 'Portability', es: 'Portabilidad', ar: 'قابلية النقل', ary: 'خفيف' } },
                        { value: 'price', label: { fr: 'Prix', en: 'Price', es: 'Precio', ar: 'السعر', ary: 'الثمن' } }
                    ]
                }
            ]
        },
        generic: {
            title: { fr: 'Trouvez votre produit idéal', en: 'Find Your Ideal Product', es: 'Encuentra tu producto ideal', ar: 'اعثر على منتجك المثالي', ary: 'لقى المنتوج لي يناسبك' },
            questions: [
                {
                    id: 'need',
                    question: { fr: 'Qu\'est-ce que vous recherchez ?', en: 'What are you looking for?', es: '¿Qué estás buscando?', ar: 'ما الذي تبحث عنه؟', ary: 'شنو كتقلب عليه؟' },
                    voiceKeywords: { fr: ['cherche', 'besoin', 'voudrais'], en: ['looking', 'need', 'want'], es: ['busco', 'necesito', 'quiero'], ar: ['أبحث', 'أريد'], ary: ['كنقلب', 'بغيت'] }
                },
                {
                    id: 'budget',
                    question: { fr: 'Quel est votre budget ?', en: 'What is your budget?', es: '¿Cuál es tu presupuesto?', ar: 'ما هي ميزانيتك؟', ary: 'شحال معاك؟' },
                    options: [
                        { value: 'low', label: { fr: '< 50€', en: '< $50', es: '< 50€', ar: '< 50$', ary: '< 500 DH' } },
                        { value: 'mid', label: { fr: '50-150€', en: '$50-150', es: '50-150€', ar: '50-150$', ary: '500-1500 DH' } },
                        { value: 'high', label: { fr: '> 150€', en: '> $150', es: '> 150€', ar: '> 150$', ary: '> 1500 DH' } }
                    ]
                }
            ]
        }
    };

    /**
     * Voice Quiz Class
     */
    class VoiceQuiz {
        constructor(options = {}) {
            this.options = {
                tenantId: null,
                template: 'generic',
                customQuestions: null,
                lang: 'fr',
                voiceEnabled: true,
                onComplete: null,
                onLeadCapture: null,
                apiBaseUrl: 'https://api.vocalia.ma',
                ...options
            };

            this.container = null;
            this.isVisible = false;
            this.currentStep = 0;
            this.answers = {};
            this.questions = [];
            this.isListening = false;
            this.recognition = null;

            this._injectStyles();
            this._initQuestions();
            this._initVoiceRecognition();
        }

        /**
         * Inject CSS styles
         */
        _injectStyles() {
            if (document.getElementById('va-quiz-styles')) return;

            const style = document.createElement('style');
            style.id = 'va-quiz-styles';
            style.textContent = QUIZ_CSS;
            document.head.appendChild(style);
        }

        /**
         * Initialize questions from template or custom
         */
        _initQuestions() {
            if (this.options.customQuestions) {
                this.questions = this.options.customQuestions;
            } else {
                const template = QUIZ_TEMPLATES[this.options.template] || QUIZ_TEMPLATES.generic;
                this.questions = template.questions;
                this.title = template.title;
            }
        }

        /**
         * Initialize voice recognition
         */
        _initVoiceRecognition() {
            if (!this.options.voiceEnabled) return;

            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                console.warn('[VoiceQuiz] Speech Recognition not supported');
                return;
            }

            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = this._getSpeechLang();

            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript.toLowerCase();
                this._processVoiceAnswer(transcript);
            };

            this.recognition.onend = () => {
                this.isListening = false;
                this._updateVoiceButton();
            };

            this.recognition.onerror = (event) => {
                console.error('[VoiceQuiz] Speech error:', event.error);
                this.isListening = false;
                this._updateVoiceButton();
            };
        }

        /**
         * Get speech recognition language code
         */
        _getSpeechLang() {
            const langMap = {
                fr: 'fr-FR',
                en: 'en-US',
                es: 'es-ES',
                ar: 'ar-SA',
                ary: 'ar-MA'
            };
            return langMap[this.options.lang] || 'fr-FR';
        }

        /**
         * Get localized text
         */
        _t(textObj) {
            if (typeof textObj === 'string') return textObj;
            return textObj[this.options.lang] || textObj.fr || textObj.en || Object.values(textObj)[0];
        }

        /**
         * Get labels
         */
        _getLabels() {
            const labels = {
                fr: {
                    back: 'Retour',
                    next: 'Suivant',
                    finish: 'Voir mes recommandations',
                    voiceHint: 'Ou répondez par la voix',
                    listening: 'Je vous écoute...',
                    speak: 'Parler',
                    stepOf: 'Question {current} sur {total}',
                    resultsTitle: 'Vos recommandations sont prêtes !',
                    resultsSubtitle: 'Entrez vos coordonnées pour recevoir votre sélection personnalisée',
                    namePlaceholder: 'Votre nom',
                    emailPlaceholder: 'Votre email',
                    phonePlaceholder: 'Votre téléphone (optionnel)',
                    getResults: 'Recevoir mes recommandations',
                    skip: 'Voir sans email'
                },
                en: {
                    back: 'Back',
                    next: 'Next',
                    finish: 'See my recommendations',
                    voiceHint: 'Or answer by voice',
                    listening: 'I\'m listening...',
                    speak: 'Speak',
                    stepOf: 'Question {current} of {total}',
                    resultsTitle: 'Your recommendations are ready!',
                    resultsSubtitle: 'Enter your details to receive your personalized selection',
                    namePlaceholder: 'Your name',
                    emailPlaceholder: 'Your email',
                    phonePlaceholder: 'Your phone (optional)',
                    getResults: 'Get my recommendations',
                    skip: 'View without email'
                },
                es: {
                    back: 'Atrás',
                    next: 'Siguiente',
                    finish: 'Ver mis recomendaciones',
                    voiceHint: 'O responde por voz',
                    listening: 'Te escucho...',
                    speak: 'Hablar',
                    stepOf: 'Pregunta {current} de {total}',
                    resultsTitle: '¡Tus recomendaciones están listas!',
                    resultsSubtitle: 'Ingresa tus datos para recibir tu selección personalizada',
                    namePlaceholder: 'Tu nombre',
                    emailPlaceholder: 'Tu email',
                    phonePlaceholder: 'Tu teléfono (opcional)',
                    getResults: 'Recibir mis recomendaciones',
                    skip: 'Ver sin email'
                },
                ar: {
                    back: 'رجوع',
                    next: 'التالي',
                    finish: 'عرض توصياتي',
                    voiceHint: 'أو أجب بالصوت',
                    listening: 'أستمع...',
                    speak: 'تكلم',
                    stepOf: 'السؤال {current} من {total}',
                    resultsTitle: 'توصياتك جاهزة!',
                    resultsSubtitle: 'أدخل بياناتك لتلقي اختيارك المخصص',
                    namePlaceholder: 'اسمك',
                    emailPlaceholder: 'بريدك الإلكتروني',
                    phonePlaceholder: 'هاتفك (اختياري)',
                    getResults: 'استلم توصياتي',
                    skip: 'عرض بدون بريد'
                },
                ary: {
                    back: 'رجع',
                    next: 'كمل',
                    finish: 'شوف شنو يناسبني',
                    voiceHint: 'ولا جاوب بالصوت',
                    listening: 'كنسمعك...',
                    speak: 'هضر',
                    stepOf: 'سؤال {current} من {total}',
                    resultsTitle: 'التوصيات ديالك جاهزين!',
                    resultsSubtitle: 'دخل معلوماتك باش توصلك لائحة خاصة بيك',
                    namePlaceholder: 'سميتك',
                    emailPlaceholder: 'الإيميل ديالك',
                    phonePlaceholder: 'التيليفون (اختياري)',
                    getResults: 'توصلني التوصيات',
                    skip: 'شوف بلا إيميل'
                }
            };

            return labels[this.options.lang] || labels.fr;
        }

        /**
         * Create quiz DOM
         */
        _createQuizDOM() {
            const L = this._getLabels();
            const isRTL = this.options.lang === 'ar' || this.options.lang === 'ary';

            const overlay = document.createElement('div');
            overlay.className = 'va-quiz-overlay';
            overlay.id = 'va-quiz-overlay';
            if (isRTL) overlay.setAttribute('dir', 'rtl');

            overlay.innerHTML = `
        <div class="va-quiz-container">
          <div class="va-quiz-header">
            <div class="va-quiz-title">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>${this._t(this.title || { fr: 'Quiz Produit', en: 'Product Quiz' })}</span>
            </div>
            <button class="va-quiz-close" aria-label="Close">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="va-quiz-progress">
            <div class="va-quiz-progress-bar">
              <div class="va-quiz-progress-fill" style="width: 0%"></div>
            </div>
            <div class="va-quiz-progress-text"></div>
          </div>
          <div class="va-quiz-content"></div>
          <div class="va-quiz-footer">
            <button class="va-quiz-btn va-quiz-btn-back" style="display: none">${L.back}</button>
            <button class="va-quiz-btn va-quiz-btn-next" disabled>${L.next}</button>
          </div>
        </div>
      `;

            // Event listeners
            overlay.querySelector('.va-quiz-close').addEventListener('click', () => this.hide());
            overlay.querySelector('.va-quiz-btn-back').addEventListener('click', () => this._prevStep());
            overlay.querySelector('.va-quiz-btn-next').addEventListener('click', () => this._nextStep());

            // Close on overlay click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) this.hide();
            });

            return overlay;
        }

        /**
         * Render current question
         */
        _renderQuestion() {
            const L = this._getLabels();
            const question = this.questions[this.currentStep];
            const content = this.container.querySelector('.va-quiz-content');
            const progress = this.container.querySelector('.va-quiz-progress-fill');
            const progressText = this.container.querySelector('.va-quiz-progress-text');
            const backBtn = this.container.querySelector('.va-quiz-btn-back');
            const nextBtn = this.container.querySelector('.va-quiz-btn-next');

            // Update progress
            const progressPct = ((this.currentStep + 1) / this.questions.length) * 100;
            progress.style.width = `${progressPct}%`;
            progressText.textContent = L.stepOf
                .replace('{current}', this.currentStep + 1)
                .replace('{total}', this.questions.length);

            // Show/hide back button
            backBtn.style.display = this.currentStep > 0 ? 'block' : 'none';

            // Update next button text
            nextBtn.textContent = this.currentStep === this.questions.length - 1 ? L.finish : L.next;
            nextBtn.disabled = !this.answers[question.id];

            // Render question content
            content.innerHTML = `
        <div class="va-quiz-question">${this._t(question.question)}</div>
        <div class="va-quiz-options">
          ${(question.options || []).map(opt => `
            <button class="va-quiz-option ${this.answers[question.id] === opt.value ? 'va-quiz-selected' : ''}" data-value="${opt.value}">
              <span class="va-quiz-option-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </span>
              <span>${this._t(opt.label)}</span>
            </button>
          `).join('')}
        </div>
        ${this.recognition ? `
          <div class="va-quiz-voice-section">
            <div class="va-quiz-voice-hint">${L.voiceHint}</div>
            <button class="va-quiz-voice-btn" id="va-quiz-voice-btn">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
              <span>${L.speak}</span>
            </button>
          </div>
        ` : ''}
      `;

            // Add option click handlers
            content.querySelectorAll('.va-quiz-option').forEach(btn => {
                btn.addEventListener('click', () => {
                    const value = btn.dataset.value;
                    this._selectOption(question.id, value);
                });
            });

            // Add voice button handler
            const voiceBtn = content.querySelector('#va-quiz-voice-btn');
            if (voiceBtn) {
                voiceBtn.addEventListener('click', () => this._toggleVoice());
            }
        }

        /**
         * Select an option
         */
        _selectOption(questionId, value) {
            this.answers[questionId] = value;
            this._renderQuestion();
            this._trackAnswer(questionId, value);
        }

        /**
         * Toggle voice recognition
         */
        _toggleVoice() {
            if (!this.recognition) return;

            if (this.isListening) {
                this.recognition.stop();
            } else {
                this.isListening = true;
                this._updateVoiceButton();
                this.recognition.start();
            }
        }

        /**
         * Update voice button state
         */
        _updateVoiceButton() {
            const L = this._getLabels();
            const btn = this.container?.querySelector('#va-quiz-voice-btn');
            if (!btn) return;

            if (this.isListening) {
                btn.classList.add('va-quiz-listening');
                btn.querySelector('span').textContent = L.listening;
            } else {
                btn.classList.remove('va-quiz-listening');
                btn.querySelector('span').textContent = L.speak;
            }
        }

        /**
         * Process voice answer
         */
        _processVoiceAnswer(transcript) {
            const question = this.questions[this.currentStep];
            if (!question.options) return;

            // Try to match transcript to option
            for (const opt of question.options) {
                const label = this._t(opt.label).toLowerCase();
                if (transcript.includes(label) || label.includes(transcript)) {
                    this._selectOption(question.id, opt.value);
                    // Auto-advance after voice selection
                    setTimeout(() => this._nextStep(), 800);
                    return;
                }
            }

            // Check voice keywords if defined
            if (question.voiceKeywords) {
                const keywords = question.voiceKeywords[this.options.lang] || [];
                for (const keyword of keywords) {
                    if (transcript.includes(keyword)) {
                        // For free-form questions, store transcript
                        this.answers[question.id] = transcript;
                        this._renderQuestion();
                        setTimeout(() => this._nextStep(), 800);
                        return;
                    }
                }
            }
        }

        /**
         * Go to previous step
         */
        _prevStep() {
            if (this.currentStep > 0) {
                this.currentStep--;
                this._renderQuestion();
            }
        }

        /**
         * Go to next step or show results
         */
        _nextStep() {
            if (this.currentStep < this.questions.length - 1) {
                this.currentStep++;
                this._renderQuestion();
            } else {
                this._showResults();
            }
        }

        /**
         * Show results/lead capture screen
         */
        _showResults() {
            const L = this._getLabels();
            const content = this.container.querySelector('.va-quiz-content');
            const footer = this.container.querySelector('.va-quiz-footer');

            // Update progress to 100%
            this.container.querySelector('.va-quiz-progress-fill').style.width = '100%';
            this.container.querySelector('.va-quiz-progress-text').textContent = '';

            content.innerHTML = `
        <div class="va-quiz-results">
          <div class="va-quiz-results-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <h3 class="va-quiz-results-title">${L.resultsTitle}</h3>
          <p class="va-quiz-results-subtitle">${L.resultsSubtitle}</p>
          <div class="va-quiz-lead-form">
            <input type="text" id="va-quiz-name" placeholder="${L.namePlaceholder}" required>
            <input type="email" id="va-quiz-email" placeholder="${L.emailPlaceholder}" required>
            <input type="tel" id="va-quiz-phone" placeholder="${L.phonePlaceholder}">
          </div>
        </div>
      `;

            footer.innerHTML = `
        <button class="va-quiz-btn va-quiz-btn-back">${L.skip}</button>
        <button class="va-quiz-btn va-quiz-btn-next">${L.getResults}</button>
      `;

            footer.querySelector('.va-quiz-btn-back').addEventListener('click', () => {
                this._completeQuiz(false);
            });

            footer.querySelector('.va-quiz-btn-next').addEventListener('click', () => {
                const name = this.container.querySelector('#va-quiz-name').value.trim();
                const email = this.container.querySelector('#va-quiz-email').value.trim();
                const phone = this.container.querySelector('#va-quiz-phone').value.trim();

                if (name && email) {
                    this._captureLead({ name, email, phone });
                    this._completeQuiz(true);
                }
            });
        }

        /**
         * Capture lead data
         */
        async _captureLead(lead) {
            if (this.options.onLeadCapture) {
                this.options.onLeadCapture({ ...lead, answers: this.answers });
            }

            // Track lead capture
            this._track('quiz_lead_captured', { ...lead, answers_count: Object.keys(this.answers).length });

            // Send to backend if tenant configured
            if (this.options.tenantId) {
                try {
                    await fetch(`${this.options.apiBaseUrl}/api/leads`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            tenant_id: this.options.tenantId,
                            source: 'voice_quiz',
                            ...lead,
                            quiz_answers: this.answers
                        })
                    });
                } catch (e) {
                    console.error('[VoiceQuiz] Lead capture error:', e);
                }
            }
        }

        /**
         * Complete quiz and get recommendations
         */
        async _completeQuiz(withLead) {
            // Collect tags from answers
            const tags = [];
            for (const question of this.questions) {
                const answer = this.answers[question.id];
                if (answer && question.tags?.[answer]) {
                    tags.push(...question.tags[answer]);
                }
            }

            // Track completion
            this._track('quiz_completed', {
                with_lead: withLead,
                answers: this.answers,
                tags: tags
            });

            // Callback with results
            if (this.options.onComplete) {
                this.options.onComplete({
                    answers: this.answers,
                    tags: tags,
                    withLead: withLead
                });
            }

            // Show recommendations if VocalIA widget available
            if (window.VocalIA?.getAIRecommendations) {
                // Close quiz
                this.hide();

                // Get personalized recommendations based on quiz
                await window.VocalIA.getAIRecommendations(null, [], 'personalized');
            } else {
                this.hide();
            }
        }

        /**
         * Track analytics event
         */
        _track(event, data = {}) {
            if (typeof gtag === 'function') {
                gtag('event', event, {
                    event_category: 'voice_quiz',
                    ...data
                });
            }
        }

        /**
         * Track answer
         */
        _trackAnswer(questionId, value) {
            this._track('quiz_answer', {
                question_id: questionId,
                answer: value,
                step: this.currentStep + 1
            });
        }

        /**
         * Show quiz
         */
        show() {
            if (this.isVisible) return this;

            // Track quiz start
            this._track('quiz_started', { template: this.options.template });

            // Create and append
            this.container = this._createQuizDOM();
            document.body.appendChild(this.container);

            // Render first question
            this._renderQuestion();

            // Animate in
            requestAnimationFrame(() => {
                this.container.classList.add('va-quiz-visible');
            });

            this.isVisible = true;
            return this;
        }

        /**
         * Hide quiz
         */
        hide() {
            if (!this.isVisible) return this;

            // Stop listening if active
            if (this.isListening && this.recognition) {
                this.recognition.stop();
            }

            // Track if abandoned
            if (this.currentStep < this.questions.length) {
                this._track('quiz_abandoned', {
                    step: this.currentStep + 1,
                    total: this.questions.length
                });
            }

            this.container?.classList.remove('va-quiz-visible');
            setTimeout(() => {
                this.container?.remove();
                this.container = null;
            }, 300);

            this.isVisible = false;
            return this;
        }

        /**
         * Reset quiz
         */
        reset() {
            this.currentStep = 0;
            this.answers = {};
            if (this.isVisible) {
                this._renderQuestion();
            }
            return this;
        }

        /**
         * Set language
         */
        setLanguage(lang) {
            this.options.lang = lang;
            if (this.recognition) {
                this.recognition.lang = this._getSpeechLang();
            }
            return this;
        }
    }

    // Export
    global.VocalIAQuiz = VoiceQuiz;
    global.QUIZ_TEMPLATES = QUIZ_TEMPLATES;

    // Auto-register with VocalIA if available
    if (global.VocalIA) {
        global.VocalIA.Quiz = VoiceQuiz;
        global.VocalIA.QuizTemplates = QUIZ_TEMPLATES;
    }

})(typeof window !== 'undefined' ? window : this);
/**
 * VocalIA - Spin Wheel Gamification Widget
 * Version: 1.0.0 | Session 250.83
 *
 * E-commerce gamification widget with voice feedback
 * Benchmark Impact: +10-15% conversion, +45% email list growth, -20% cart abandonment
 *
 * Features:
 * - Animated prize wheel with CSS3 transforms
 * - Configurable prizes with weighted probabilities
 * - Voice announcements for spin results
 * - Email capture for lead generation
 * - 5 languages: FR, EN, ES, AR, Darija (ary)
 * - RTL support for Arabic/Darija
 * - GA4 event tracking
 * - Discount code generation
 */

(function() {
  'use strict';

  // ============================================================
  // TRANSLATIONS (5 LANGUAGES)
  // ============================================================

  const TRANSLATIONS = {
    fr: {
      title: 'Tentez votre chance !',
      subtitle: 'Tournez la roue pour gagner une surprise',
      spinButton: 'TOURNER',
      spinning: 'En cours...',
      emailPlaceholder: 'Votre email pour recevoir le code',
      emailLabel: 'Entrez votre email pour jouer',
      submitEmail: 'Jouer maintenant',
      congratulations: 'Felicitations !',
      youWon: 'Vous avez gagne',
      discountCode: 'Votre code promo',
      copyCode: 'Copier le code',
      copied: 'Copie !',
      useNow: 'Utiliser maintenant',
      tryAgain: 'Peut-etre la prochaine fois !',
      noLuck: 'Pas de chance cette fois',
      alreadyPlayed: 'Vous avez deja joue aujourd\'hui',
      comeBackTomorrow: 'Revenez demain pour une nouvelle chance !',
      voiceIntro: 'Bienvenue ! Tournez la roue pour gagner des reductions exclusives.',
      voiceSpinning: 'La roue tourne...',
      voiceWin: 'Felicitations ! Vous avez gagne {{prize}} !',
      voiceLose: 'Pas de chance cette fois. Revenez demain !',
      prizes: {
        discount5: '5% de reduction',
        discount10: '10% de reduction',
        discount15: '15% de reduction',
        discount20: '20% de reduction',
        discount30: '30% de reduction',
        freeShipping: 'Livraison gratuite',
        tryAgain: 'Reessayez'
      }
    },
    en: {
      title: 'Try Your Luck!',
      subtitle: 'Spin the wheel to win a surprise',
      spinButton: 'SPIN',
      spinning: 'Spinning...',
      emailPlaceholder: 'Your email to receive the code',
      emailLabel: 'Enter your email to play',
      submitEmail: 'Play now',
      congratulations: 'Congratulations!',
      youWon: 'You won',
      discountCode: 'Your promo code',
      copyCode: 'Copy code',
      copied: 'Copied!',
      useNow: 'Use now',
      tryAgain: 'Maybe next time!',
      noLuck: 'No luck this time',
      alreadyPlayed: 'You already played today',
      comeBackTomorrow: 'Come back tomorrow for another chance!',
      voiceIntro: 'Welcome! Spin the wheel to win exclusive discounts.',
      voiceSpinning: 'The wheel is spinning...',
      voiceWin: 'Congratulations! You won {{prize}}!',
      voiceLose: 'No luck this time. Come back tomorrow!',
      prizes: {
        discount5: '5% off',
        discount10: '10% off',
        discount15: '15% off',
        discount20: '20% off',
        discount30: '30% off',
        freeShipping: 'Free shipping',
        tryAgain: 'Try again'
      }
    },
    es: {
      title: 'Prueba tu suerte!',
      subtitle: 'Gira la rueda para ganar una sorpresa',
      spinButton: 'GIRAR',
      spinning: 'Girando...',
      emailPlaceholder: 'Tu email para recibir el codigo',
      emailLabel: 'Ingresa tu email para jugar',
      submitEmail: 'Jugar ahora',
      congratulations: 'Felicidades!',
      youWon: 'Ganaste',
      discountCode: 'Tu codigo promocional',
      copyCode: 'Copiar codigo',
      copied: 'Copiado!',
      useNow: 'Usar ahora',
      tryAgain: 'Quizas la proxima!',
      noLuck: 'Sin suerte esta vez',
      alreadyPlayed: 'Ya jugaste hoy',
      comeBackTomorrow: 'Vuelve manana para otra oportunidad!',
      voiceIntro: 'Bienvenido! Gira la rueda para ganar descuentos exclusivos.',
      voiceSpinning: 'La rueda esta girando...',
      voiceWin: 'Felicidades! Ganaste {{prize}}!',
      voiceLose: 'Sin suerte esta vez. Vuelve manana!',
      prizes: {
        discount5: '5% de descuento',
        discount10: '10% de descuento',
        discount15: '15% de descuento',
        discount20: '20% de descuento',
        discount30: '30% de descuento',
        freeShipping: 'Envio gratis',
        tryAgain: 'Intenta de nuevo'
      }
    },
    ar: {
      title: 'جرب حظك!',
      subtitle: 'ادر العجلة لتربح مفاجأة',
      spinButton: 'ادر',
      spinning: 'جاري الدوران...',
      emailPlaceholder: 'بريدك لاستلام الكود',
      emailLabel: 'ادخل بريدك للعب',
      submitEmail: 'العب الآن',
      congratulations: 'مبروك!',
      youWon: 'ربحت',
      discountCode: 'كود الخصم',
      copyCode: 'نسخ الكود',
      copied: 'تم النسخ!',
      useNow: 'استخدم الآن',
      tryAgain: 'ربما المرة القادمة!',
      noLuck: 'لا حظ هذه المرة',
      alreadyPlayed: 'لقد لعبت اليوم',
      comeBackTomorrow: 'عد غداً لفرصة جديدة!',
      voiceIntro: 'مرحبا! ادر العجلة لتربح خصومات حصرية.',
      voiceSpinning: 'العجلة تدور...',
      voiceWin: 'مبروك! ربحت {{prize}}!',
      voiceLose: 'لا حظ هذه المرة. عد غداً!',
      prizes: {
        discount5: 'خصم 5%',
        discount10: 'خصم 10%',
        discount15: 'خصم 15%',
        discount20: 'خصم 20%',
        discount30: 'خصم 30%',
        freeShipping: 'شحن مجاني',
        tryAgain: 'حاول مرة أخرى'
      }
    },
    ary: {
      title: 'جرب الزهر ديالك!',
      subtitle: 'دور الروضة باش تربح كادو',
      spinButton: 'دور',
      spinning: 'كتدور...',
      emailPlaceholder: 'الإيميل ديالك باش تاخد الكود',
      emailLabel: 'دخل الإيميل باش تلعب',
      submitEmail: 'لعب دابا',
      congratulations: 'مبروك عليك!',
      youWon: 'ربحتي',
      discountCode: 'الكود ديال التخفيض',
      copyCode: 'كوبي الكود',
      copied: 'تكوبيا!',
      useNow: 'استعملو دابا',
      tryAgain: 'يمكن المرة الجاية!',
      noLuck: 'ما كانش الزهر هاد المرة',
      alreadyPlayed: 'لعبتي هاد النهار',
      comeBackTomorrow: 'رجع غدا باش تلعب!',
      voiceIntro: 'مرحبا! دور الروضة باش تربح تخفيضات خاصة.',
      voiceSpinning: 'الروضة كتدور...',
      voiceWin: 'مبروك! ربحتي {{prize}}!',
      voiceLose: 'ما كانش الزهر. رجع غدا!',
      prizes: {
        discount5: 'تخفيض 5%',
        discount10: 'تخفيض 10%',
        discount15: 'تخفيض 15%',
        discount20: 'تخفيض 20%',
        discount30: 'تخفيض 30%',
        freeShipping: 'التوصيل بلاش',
        tryAgain: 'عاود'
      }
    }
  };

  // ============================================================
  // DEFAULT PRIZES CONFIGURATION
  // ============================================================

  const DEFAULT_PRIZES = [
    { id: 'discount5', probability: 30, color: '#5E6AD2', code: 'SPIN5' },
    { id: 'discount10', probability: 25, color: '#10B981', code: 'SPIN10' },
    { id: 'discount15', probability: 15, color: '#F59E0B', code: 'SPIN15' },
    { id: 'discount20', probability: 10, color: '#8B5CF6', code: 'SPIN20' },
    { id: 'discount30', probability: 5, color: '#EF4444', code: 'SPIN30' },
    { id: 'freeShipping', probability: 5, color: '#EC4899', code: 'FREESHIP' },
    { id: 'tryAgain', probability: 10, color: '#6B7280', code: null }
  ];

  // ============================================================
  // STYLES
  // ============================================================

  const STYLES = `
    .va-spin-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(8px);
      z-index: 10002;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s ease, visibility 0.3s ease;
    }

    .va-spin-overlay.active {
      opacity: 1;
      visibility: visible;
    }

    .va-spin-modal {
      background: linear-gradient(135deg, #0f172a 0%, #0F1225 100%);
      border: 2px solid rgba(94, 106, 210, 0.3);
      border-radius: 24px;
      max-width: 440px;
      width: 95%;
      padding: 32px;
      text-align: center;
      box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5), 0 0 60px rgba(94, 106, 210, 0.2);
      animation: vaSpinModalIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .va-spin-modal[dir="rtl"] {
      text-align: right;
    }

    @keyframes vaSpinModalIn {
      from { transform: scale(0.8) rotate(-10deg); opacity: 0; }
      to { transform: scale(1) rotate(0deg); opacity: 1; }
    }

    .va-spin-close {
      position: absolute;
      top: 16px;
      right: 16px;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s ease;
      z-index: 10;
    }

    .va-spin-close:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .va-spin-close svg {
      width: 16px;
      height: 16px;
      fill: white;
    }

    [dir="rtl"] .va-spin-close {
      right: auto;
      left: 16px;
    }

    .va-spin-title {
      color: #FFFFFF;
      font-size: 28px;
      font-weight: 700;
      margin: 0 0 8px;
      background: linear-gradient(135deg, #5E6AD2 0%, #10B981 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .va-spin-subtitle {
      color: rgba(255, 255, 255, 0.7);
      font-size: 16px;
      margin: 0 0 24px;
    }

    .va-spin-wheel-container {
      position: relative;
      width: 280px;
      height: 280px;
      margin: 0 auto 24px;
    }

    .va-spin-wheel {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      position: relative;
      transition: transform 5s cubic-bezier(0.17, 0.67, 0.12, 0.99);
      box-shadow: 0 0 0 8px rgba(94, 106, 210, 0.3), 0 0 0 12px rgba(94, 106, 210, 0.15);
    }

    .va-spin-wheel.spinning {
      animation: none;
    }

    .va-spin-segment {
      position: absolute;
      width: 50%;
      height: 50%;
      left: 50%;
      top: 0;
      transform-origin: 0% 100%;
      overflow: hidden;
    }

    .va-spin-segment-inner {
      position: absolute;
      width: 200%;
      height: 200%;
      left: -100%;
      transform-origin: 50% 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding-top: 20px;
      box-sizing: border-box;
    }

    .va-spin-segment-text {
      transform: rotate(90deg);
      color: white;
      font-size: 11px;
      font-weight: 600;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
      max-width: 70px;
      text-align: center;
      line-height: 1.2;
    }

    .va-spin-pointer {
      position: absolute;
      top: -15px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 15px solid transparent;
      border-right: 15px solid transparent;
      border-top: 30px solid #F59E0B;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
      z-index: 10;
    }

    .va-spin-center {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #0f172a 0%, #0F1225 100%);
      border: 4px solid #5E6AD2;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 5;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    }

    .va-spin-center svg {
      width: 24px;
      height: 24px;
      fill: #5E6AD2;
    }

    .va-spin-email-form {
      margin-bottom: 20px;
    }

    .va-spin-email-label {
      color: rgba(255, 255, 255, 0.8);
      font-size: 14px;
      margin-bottom: 12px;
      display: block;
    }

    .va-spin-email-input {
      width: 100%;
      padding: 14px 16px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 12px;
      color: #FFFFFF;
      font-size: 16px;
      margin-bottom: 12px;
      outline: none;
      box-sizing: border-box;
      transition: border-color 0.2s ease;
    }

    .va-spin-email-input:focus {
      border-color: #5E6AD2;
    }

    .va-spin-email-input::placeholder {
      color: rgba(255, 255, 255, 0.4);
    }

    .va-spin-btn {
      width: 100%;
      padding: 16px 24px;
      border-radius: 12px;
      font-size: 18px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.3s ease;
      border: none;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .va-spin-btn.primary {
      background: linear-gradient(135deg, #F59E0B 0%, #EF4444 100%);
      color: white;
      box-shadow: 0 4px 20px rgba(245, 158, 11, 0.4);
    }

    .va-spin-btn.primary:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 30px rgba(245, 158, 11, 0.5);
    }

    .va-spin-btn.primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .va-spin-btn.secondary {
      background: rgba(94, 106, 210, 0.1);
      color: #5E6AD2;
      border: 1px solid rgba(94, 106, 210, 0.3);
    }

    .va-spin-btn.secondary:hover {
      background: rgba(94, 106, 210, 0.2);
    }

    /* Result state */
    .va-spin-result {
      display: none;
    }

    .va-spin-result.active {
      display: block;
      animation: vaFadeIn 0.5s ease;
    }

    @keyframes vaFadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .va-spin-result-icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 16px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .va-spin-result-icon.win {
      background: linear-gradient(135deg, #10B981 0%, #059669 100%);
      animation: vaPulse 1s infinite;
    }

    .va-spin-result-icon.lose {
      background: rgba(107, 114, 128, 0.3);
    }

    @keyframes vaPulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }

    .va-spin-result-icon svg {
      width: 40px;
      height: 40px;
      fill: white;
    }

    .va-spin-result-title {
      color: #FFFFFF;
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .va-spin-result-prize {
      color: #10B981;
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 16px;
    }

    .va-spin-code-container {
      background: rgba(94, 106, 210, 0.1);
      border: 1px dashed #5E6AD2;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
    }

    .va-spin-code-label {
      color: rgba(255, 255, 255, 0.7);
      font-size: 12px;
      margin-bottom: 8px;
    }

    .va-spin-code {
      color: #5E6AD2;
      font-size: 28px;
      font-weight: 700;
      font-family: 'Courier New', monospace;
      letter-spacing: 3px;
    }

    .va-spin-copy-btn {
      margin-top: 12px;
      padding: 8px 16px;
      background: transparent;
      border: 1px solid rgba(94, 106, 210, 0.5);
      border-radius: 8px;
      color: #5E6AD2;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .va-spin-copy-btn:hover {
      background: rgba(94, 106, 210, 0.1);
    }

    .va-spin-copy-btn.copied {
      background: rgba(16, 185, 129, 0.2);
      border-color: #10B981;
      color: #10B981;
    }

    /* Confetti */
    .va-confetti {
      position: fixed;
      pointer-events: none;
      z-index: 10003;
    }

    /* Mobile responsive */
    @media (max-width: 480px) {
      .va-spin-modal {
        padding: 24px 20px;
        border-radius: 20px 20px 0 0;
        position: fixed;
        bottom: 0;
        max-height: 90vh;
        overflow-y: auto;
      }

      .va-spin-title {
        font-size: 24px;
      }

      .va-spin-wheel-container {
        width: 240px;
        height: 240px;
      }

      .va-spin-btn {
        font-size: 16px;
        padding: 14px 20px;
      }
    }
  `;

  // ============================================================
  // SPIN WHEEL CLASS
  // ============================================================

  class SpinWheel {
    constructor(options = {}) {
      this.config = {
        tenantId: options.tenantId || this.detectTenantId(),
        lang: options.lang || this.detectLanguage(),
        prizes: options.prizes || DEFAULT_PRIZES,
        voiceEnabled: options.voiceEnabled !== false,
        requireEmail: options.requireEmail !== false,
        cooldownHours: options.cooldownHours || 24,
        spinDuration: options.spinDuration || 5000,
        onSpin: options.onSpin || null,
        onWin: options.onWin || null,
        onLose: options.onLose || null,
        onEmailCapture: options.onEmailCapture || null
      };

      this.state = {
        isVisible: false,
        isSpinning: false,
        hasPlayed: false,
        selectedPrize: null,
        email: null,
        currentRotation: 0
      };

      this.elements = {};
      this.translations = TRANSLATIONS[this.config.lang] || TRANSLATIONS.fr;
      this.isRTL = ['ar', 'ary'].includes(this.config.lang);

      this.init();
    }

    detectTenantId() {
      const widget = document.querySelector('[data-vocalia-tenant]');
      return widget?.dataset.vocaliaTenant || 'default';
    }

    detectLanguage() {
      const widget = document.querySelector('[data-vocalia-lang]');
      if (widget) return widget.dataset.vocaliaLang;
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('lang')) return urlParams.get('lang');
      const browserLang = navigator.language?.split('-')[0];
      return ['fr', 'en', 'es', 'ar', 'ary'].includes(browserLang) ? browserLang : 'fr';
    }

    init() {
      // Inject styles
      if (!document.querySelector('#va-spin-wheel-styles')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'va-spin-wheel-styles';
        styleEl.textContent = STYLES;
        document.head.appendChild(styleEl);
      }

      // Check cooldown
      this.checkCooldown();

      console.log('[SpinWheel] Initialized', {
        tenant: this.config.tenantId,
        lang: this.config.lang,
        hasPlayed: this.state.hasPlayed
      });
    }

    checkCooldown() {
      const lastPlayed = localStorage.getItem('va_spin_wheel_last_played');
      if (lastPlayed) {
        const elapsed = Date.now() - parseInt(lastPlayed, 10);
        const cooldownMs = this.config.cooldownHours * 60 * 60 * 1000;
        if (elapsed < cooldownMs) {
          this.state.hasPlayed = true;
        }
      }
    }

    createModal() {
      const overlay = document.createElement('div');
      overlay.className = 'va-spin-overlay';
      overlay.id = 'va-spin-overlay';

      overlay.innerHTML = `
        <div class="va-spin-modal" dir="${this.isRTL ? 'rtl' : 'ltr'}" role="dialog" aria-modal="true">
          <button class="va-spin-close" aria-label="Close">
            <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>

          <div class="va-spin-game">
            <h2 class="va-spin-title">${this.translations.title}</h2>
            <p class="va-spin-subtitle">${this.translations.subtitle}</p>

            <div class="va-spin-wheel-container">
              <div class="va-spin-pointer"></div>
              <div class="va-spin-wheel" id="va-spin-wheel">
                ${this.generateWheelSegments()}
              </div>
              <div class="va-spin-center">
                <svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
              </div>
            </div>

            ${this.config.requireEmail ? `
              <div class="va-spin-email-form">
                <label class="va-spin-email-label">${this.translations.emailLabel}</label>
                <input type="email" class="va-spin-email-input" placeholder="${this.translations.emailPlaceholder}" id="va-spin-email">
                <button class="va-spin-btn primary" id="va-spin-submit">${this.translations.submitEmail}</button>
              </div>
            ` : `
              <button class="va-spin-btn primary" id="va-spin-btn">${this.translations.spinButton}</button>
            `}
          </div>

          <div class="va-spin-result" id="va-spin-result">
            <div class="va-spin-result-icon win" id="va-spin-result-icon">
              <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            </div>
            <h3 class="va-spin-result-title" id="va-spin-result-title">${this.translations.congratulations}</h3>
            <p class="va-spin-result-prize" id="va-spin-result-prize"></p>

            <div class="va-spin-code-container" id="va-spin-code-container">
              <div class="va-spin-code-label">${this.translations.discountCode}</div>
              <div class="va-spin-code" id="va-spin-code"></div>
              <button class="va-spin-copy-btn" id="va-spin-copy">${this.translations.copyCode}</button>
            </div>

            <button class="va-spin-btn primary" id="va-spin-use">${this.translations.useNow}</button>
          </div>

          <div class="va-spin-already-played" id="va-spin-already-played" style="display: none;">
            <h3 class="va-spin-result-title">${this.translations.alreadyPlayed}</h3>
            <p class="va-spin-subtitle">${this.translations.comeBackTomorrow}</p>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      this.elements.overlay = overlay;
      this.elements.wheel = overlay.querySelector('#va-spin-wheel');
      this.elements.spinBtn = overlay.querySelector('#va-spin-btn') || overlay.querySelector('#va-spin-submit');
      this.elements.emailInput = overlay.querySelector('#va-spin-email');
      this.elements.closeBtn = overlay.querySelector('.va-spin-close');
      this.elements.result = overlay.querySelector('#va-spin-result');
      this.elements.resultIcon = overlay.querySelector('#va-spin-result-icon');
      this.elements.resultTitle = overlay.querySelector('#va-spin-result-title');
      this.elements.resultPrize = overlay.querySelector('#va-spin-result-prize');
      this.elements.codeContainer = overlay.querySelector('#va-spin-code-container');
      this.elements.code = overlay.querySelector('#va-spin-code');
      this.elements.copyBtn = overlay.querySelector('#va-spin-copy');
      this.elements.useBtn = overlay.querySelector('#va-spin-use');
      this.elements.alreadyPlayed = overlay.querySelector('#va-spin-already-played');
      this.elements.game = overlay.querySelector('.va-spin-game');

      // Event listeners
      this.elements.closeBtn.addEventListener('click', () => this.hide());
      this.elements.overlay.addEventListener('click', (e) => {
        if (e.target === this.elements.overlay) this.hide();
      });

      if (this.elements.spinBtn) {
        this.elements.spinBtn.addEventListener('click', () => this.handleSpinClick());
      }

      if (this.elements.copyBtn) {
        this.elements.copyBtn.addEventListener('click', () => this.copyCode());
      }

      if (this.elements.useBtn) {
        this.elements.useBtn.addEventListener('click', () => this.useCode());
      }
    }

    generateWheelSegments() {
      const prizes = this.config.prizes;
      const segmentAngle = 360 / prizes.length;
      let html = '';

      prizes.forEach((prize, index) => {
        const rotation = index * segmentAngle;
        const skew = 90 - segmentAngle;
        const prizeText = this.translations.prizes[prize.id] || prize.id;

        html += `
          <div class="va-spin-segment" style="transform: rotate(${rotation}deg) skewY(${skew}deg);">
            <div class="va-spin-segment-inner" style="background: ${prize.color}; transform: skewY(${-skew}deg);">
              <span class="va-spin-segment-text">${prizeText}</span>
            </div>
          </div>
        `;
      });

      return html;
    }

    show() {
      if (!this.elements.overlay) {
        this.createModal();
      }

      if (this.state.hasPlayed) {
        this.elements.game.style.display = 'none';
        this.elements.alreadyPlayed.style.display = 'block';
      } else {
        this.elements.game.style.display = 'block';
        this.elements.alreadyPlayed.style.display = 'none';
      }

      this.state.isVisible = true;
      this.elements.overlay.classList.add('active');

      // Voice intro
      if (this.config.voiceEnabled && !this.state.hasPlayed) {
        setTimeout(() => this.speak(this.translations.voiceIntro), 500);
      }

      // Track event
      this.trackEvent('spin_wheel_shown', {
        has_played: this.state.hasPlayed
      });
    }

    hide() {
      this.state.isVisible = false;
      this.elements.overlay?.classList.remove('active');
    }

    handleSpinClick() {
      if (this.state.isSpinning) return;

      // Check email if required
      if (this.config.requireEmail && this.elements.emailInput) {
        const email = this.elements.emailInput.value.trim();
        if (!email || !this.validateEmail(email)) {
          this.elements.emailInput.style.borderColor = '#EF4444';
          return;
        }
        this.state.email = email;
        this.elements.emailInput.style.borderColor = '';

        // Callback
        if (this.config.onEmailCapture) {
          this.config.onEmailCapture({ email });
        }

        // Track email capture
        this.trackEvent('spin_wheel_email_captured', { email });
      }

      this.spin();
    }

    validateEmail(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    spin() {
      if (this.state.isSpinning || this.state.hasPlayed) return;

      this.state.isSpinning = true;
      this.elements.spinBtn.disabled = true;
      this.elements.spinBtn.textContent = this.translations.spinning;

      // Voice feedback
      if (this.config.voiceEnabled) {
        this.speak(this.translations.voiceSpinning);
      }

      // Select prize based on probability
      const prize = this.selectPrize();
      this.state.selectedPrize = prize;

      // Calculate rotation
      const prizes = this.config.prizes;
      const prizeIndex = prizes.findIndex(p => p.id === prize.id);
      const segmentAngle = 360 / prizes.length;
      const prizeAngle = prizeIndex * segmentAngle + segmentAngle / 2;
      const extraSpins = 5; // Full rotations
      const finalRotation = 360 * extraSpins + (360 - prizeAngle);

      this.state.currentRotation = finalRotation;
      this.elements.wheel.style.transform = `rotate(${finalRotation}deg)`;

      // Callback
      if (this.config.onSpin) {
        this.config.onSpin({ prize });
      }

      // Track event
      this.trackEvent('spin_wheel_spun', {
        prize_id: prize.id,
        prize_code: prize.code,
        email: this.state.email
      });

      // Show result after spin
      setTimeout(() => {
        this.showResult(prize);
      }, this.config.spinDuration + 500);
    }

    selectPrize() {
      const prizes = this.config.prizes;
      const totalProbability = prizes.reduce((sum, p) => sum + p.probability, 0);
      let random = Math.random() * totalProbability;

      for (const prize of prizes) {
        random -= prize.probability;
        if (random <= 0) {
          return prize;
        }
      }

      return prizes[prizes.length - 1];
    }

    showResult(prize) {
      const isWin = prize.code !== null;

      // Hide game, show result
      this.elements.game.style.display = 'none';
      this.elements.result.classList.add('active');

      if (isWin) {
        // Win state
        this.elements.resultIcon.className = 'va-spin-result-icon win';
        this.elements.resultIcon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>';
        this.elements.resultTitle.textContent = this.translations.congratulations;
        this.elements.resultPrize.textContent = `${this.translations.youWon} ${this.translations.prizes[prize.id]}`;
        this.elements.code.textContent = prize.code;
        this.elements.codeContainer.style.display = 'block';
        this.elements.useBtn.style.display = 'block';

        // Confetti
        this.showConfetti();

        // Voice feedback
        if (this.config.voiceEnabled) {
          const message = this.translations.voiceWin.replace('{{prize}}', this.translations.prizes[prize.id]);
          this.speak(message);
        }

        // Callback
        if (this.config.onWin) {
          this.config.onWin({ prize, email: this.state.email });
        }

        // Track event
        this.trackEvent('spin_wheel_won', {
          prize_id: prize.id,
          prize_code: prize.code,
          email: this.state.email
        });
      } else {
        // Lose state
        this.elements.resultIcon.className = 'va-spin-result-icon lose';
        this.elements.resultIcon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>';
        this.elements.resultTitle.textContent = this.translations.tryAgain;
        this.elements.resultPrize.textContent = this.translations.noLuck;
        this.elements.codeContainer.style.display = 'none';
        this.elements.useBtn.style.display = 'none';

        // Voice feedback
        if (this.config.voiceEnabled) {
          this.speak(this.translations.voiceLose);
        }

        // Callback
        if (this.config.onLose) {
          this.config.onLose({ email: this.state.email });
        }

        // Track event
        this.trackEvent('spin_wheel_lost', {
          email: this.state.email
        });
      }

      // Set cooldown
      this.state.hasPlayed = true;
      localStorage.setItem('va_spin_wheel_last_played', Date.now().toString());
    }

    showConfetti() {
      const colors = ['#5E6AD2', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
      const confettiCount = 50;

      for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'va-confetti';
        confetti.style.cssText = `
          position: fixed;
          width: ${Math.random() * 10 + 5}px;
          height: ${Math.random() * 10 + 5}px;
          background: ${colors[Math.floor(Math.random() * colors.length)]};
          left: ${Math.random() * 100}vw;
          top: -20px;
          border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
          animation: confettiFall ${Math.random() * 3 + 2}s linear forwards;
          z-index: 10003;
        `;

        document.body.appendChild(confetti);

        setTimeout(() => confetti.remove(), 5000);
      }

      // Add confetti animation
      if (!document.querySelector('#va-confetti-style')) {
        const style = document.createElement('style');
        style.id = 'va-confetti-style';
        style.textContent = `
          @keyframes confettiFall {
            0% { transform: translateY(0) rotate(0deg); opacity: 1; }
            100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
          }
        `;
        document.head.appendChild(style);
      }
    }

    copyCode() {
      const code = this.state.selectedPrize?.code;
      if (!code) return;

      navigator.clipboard.writeText(code).then(() => {
        this.elements.copyBtn.textContent = this.translations.copied;
        this.elements.copyBtn.classList.add('copied');

        setTimeout(() => {
          this.elements.copyBtn.textContent = this.translations.copyCode;
          this.elements.copyBtn.classList.remove('copied');
        }, 2000);

        this.trackEvent('spin_wheel_code_copied', { code });
      });
    }

    useCode() {
      const code = this.state.selectedPrize?.code;
      if (!code) return;

      // Copy code and redirect to checkout
      navigator.clipboard.writeText(code);

      // Track event
      this.trackEvent('spin_wheel_code_used', { code });

      // Redirect to checkout with discount
      const checkoutUrl = new URL('/checkout', window.location.origin);
      checkoutUrl.searchParams.set('discount', code);
      window.location.href = checkoutUrl.toString();
    }

    speak(text) {
      if (!window.speechSynthesis) return;

      const utterance = new SpeechSynthesisUtterance(text);
      const langMap = {
        'fr': 'fr-FR',
        'en': 'en-US',
        'es': 'es-ES',
        'ar': 'ar-SA',
        'ary': 'ar-MA'
      };
      utterance.lang = langMap[this.config.lang] || 'fr-FR';
      utterance.rate = 0.9;
      utterance.pitch = 1;

      window.speechSynthesis.speak(utterance);
    }

    trackEvent(eventName, params = {}) {
      if (window.gtag) {
        window.gtag('event', eventName, {
          event_category: 'gamification',
          tenant_id: this.config.tenantId,
          ...params
        });
      }

      if (window.plausible) {
        window.plausible(eventName, { props: params });
      }

      if (window.VocalIA?.trackEvent) {
        window.VocalIA.trackEvent(eventName, params);
      }
    }

    // Public API
    reset() {
      this.state.hasPlayed = false;
      this.state.isSpinning = false;
      this.state.selectedPrize = null;
      localStorage.removeItem('va_spin_wheel_last_played');

      if (this.elements.wheel) {
        this.elements.wheel.style.transform = 'rotate(0deg)';
      }
    }

    destroy() {
      this.hide();
      this.elements.overlay?.remove();
    }
  }

  // ============================================================
  // EXPORT
  // ============================================================

  let spinWheelInstance = null;

  function initSpinWheel(options = {}) {
    if (spinWheelInstance) {
      spinWheelInstance.destroy();
    }
    spinWheelInstance = new SpinWheel(options);
    return spinWheelInstance;
  }

  function showSpinWheel(options = {}) {
    if (!spinWheelInstance) {
      spinWheelInstance = new SpinWheel(options);
    }
    spinWheelInstance.show();
    return spinWheelInstance;
  }

  // Expose to window
  window.VocaliaSpinWheel = {
    init: initSpinWheel,
    show: showSpinWheel,
    getInstance: () => spinWheelInstance,
    SpinWheel
  };

  // Integrate with VocalIA namespace
  if (typeof window.VocalIA !== 'undefined') {
    window.VocalIA.SpinWheel = window.VocaliaSpinWheel;

    window.VocalIA.showSpinWheel = function(options = {}) {
      return showSpinWheel(options);
    };

    window.VocalIA.isSpinWheelAvailable = function() {
      const lastPlayed = localStorage.getItem('va_spin_wheel_last_played');
      if (!lastPlayed) return true;
      const elapsed = Date.now() - parseInt(lastPlayed, 10);
      return elapsed >= 24 * 60 * 60 * 1000;
    };
  }

  // Auto-init if data attribute present
  document.addEventListener('DOMContentLoaded', () => {
    const widget = document.querySelector('[data-vocalia-spin-wheel]');
    if (widget) {
      initSpinWheel({
        tenantId: widget.dataset.vocaliaTenant,
        lang: widget.dataset.vocaliaLang,
        voiceEnabled: widget.dataset.voice !== 'false',
        requireEmail: widget.dataset.requireEmail !== 'false'
      });

      // Auto-show based on trigger
      const trigger = widget.dataset.trigger || 'manual';
      if (trigger === 'auto') {
        setTimeout(() => showSpinWheel(), parseInt(widget.dataset.delay) || 5000);
      }
    }
  });

})();
/**
 * VocalIA - Free Shipping Progress Bar Widget
 * Version: 1.0.0 | Session 250.83
 *
 * E-commerce conversion widget with voice feedback
 * Benchmark Impact: +15-20% AOV, -10-18% cart abandonment
 *
 * Features:
 * - Dynamic progress bar toward free shipping threshold
 * - Real-time cart value tracking
 * - Voice encouragement at milestones (25%, 50%, 75%, 100%)
 * - 5 languages: FR, EN, ES, AR, Darija (ary)
 * - RTL support for Arabic/Darija
 * - GA4 event tracking
 * - Customizable threshold per tenant
 */

(function() {
  'use strict';

  // ============================================================
  // TRANSLATIONS (5 LANGUAGES)
  // ============================================================

  const TRANSLATIONS = {
    fr: {
      freeShipping: 'Livraison GRATUITE',
      addMore: 'Plus que {{amount}} pour la livraison gratuite !',
      almostThere: 'Presque ! {{amount}} de plus et c\'est gratuit !',
      unlocked: 'Livraison gratuite debloquee !',
      voiceMilestone25: 'Vous avez deja un quart du chemin pour la livraison gratuite.',
      voiceMilestone50: 'A mi-chemin ! Continuez pour debloquer la livraison gratuite.',
      voiceMilestone75: 'Presque la livraison gratuite ! Plus que quelques articles.',
      voiceMilestone100: 'Felicitations ! Vous avez debloque la livraison gratuite !',
      threshold: 'Seuil livraison gratuite',
      currentCart: 'Panier actuel',
      remaining: 'Restant',
      currency: {
        MAD: 'DH',
        EUR: '€',
        USD: '$'
      }
    },
    en: {
      freeShipping: 'FREE Shipping',
      addMore: 'Add {{amount}} more for free shipping!',
      almostThere: 'Almost there! {{amount}} more for free shipping!',
      unlocked: 'Free shipping unlocked!',
      voiceMilestone25: 'You\'re a quarter of the way to free shipping.',
      voiceMilestone50: 'Halfway there! Keep going to unlock free shipping.',
      voiceMilestone75: 'Almost at free shipping! Just a few more items.',
      voiceMilestone100: 'Congratulations! You\'ve unlocked free shipping!',
      threshold: 'Free shipping threshold',
      currentCart: 'Current cart',
      remaining: 'Remaining',
      currency: {
        MAD: 'MAD',
        EUR: '€',
        USD: '$'
      }
    },
    es: {
      freeShipping: 'Envio GRATIS',
      addMore: 'Anade {{amount}} mas para envio gratis!',
      almostThere: 'Casi ahi! {{amount}} mas para envio gratis!',
      unlocked: 'Envio gratis desbloqueado!',
      voiceMilestone25: 'Llevas un cuarto del camino para envio gratis.',
      voiceMilestone50: 'A mitad de camino! Sigue para desbloquear envio gratis.',
      voiceMilestone75: 'Casi envio gratis! Solo unos articulos mas.',
      voiceMilestone100: 'Felicidades! Has desbloqueado el envio gratis!',
      threshold: 'Umbral envio gratis',
      currentCart: 'Carrito actual',
      remaining: 'Restante',
      currency: {
        MAD: 'MAD',
        EUR: '€',
        USD: '$'
      }
    },
    ar: {
      freeShipping: 'شحن مجاني',
      addMore: 'اضف {{amount}} للحصول على شحن مجاني!',
      almostThere: 'قريب جدا! {{amount}} فقط للشحن المجاني!',
      unlocked: 'تم فتح الشحن المجاني!',
      voiceMilestone25: 'انت في ربع الطريق للشحن المجاني.',
      voiceMilestone50: 'في منتصف الطريق! استمر للحصول على الشحن المجاني.',
      voiceMilestone75: 'قريب جدا من الشحن المجاني! فقط بعض المنتجات.',
      voiceMilestone100: 'مبروك! لقد حصلت على الشحن المجاني!',
      threshold: 'حد الشحن المجاني',
      currentCart: 'السلة الحالية',
      remaining: 'المتبقي',
      currency: {
        MAD: 'درهم',
        EUR: '€',
        USD: '$'
      }
    },
    ary: {
      freeShipping: 'التوصيل بلاش',
      addMore: 'زيد {{amount}} باش يوصلك بلاش!',
      almostThere: 'قريب! غير {{amount}} و يوصلك مجانا!',
      unlocked: 'مبروك! التوصيل بلاش!',
      voiceMilestone25: 'وصلتي الربع باش يجيك التوصيل بلاش.',
      voiceMilestone50: 'فالنص! كمل باش تحصل على التوصيل المجاني.',
      voiceMilestone75: 'قريب بزاف من التوصيل بلاش! غير شوية.',
      voiceMilestone100: 'مبروك! دابا التوصيل بلاش!',
      threshold: 'الحد ديال التوصيل بلاش',
      currentCart: 'الباني دابا',
      remaining: 'اللي باقي',
      currency: {
        MAD: 'درهم',
        EUR: '€',
        USD: '$'
      }
    }
  };

  // ============================================================
  // STYLES
  // ============================================================

  const STYLES = `
    .va-shipping-bar-container {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 9999;
      background: linear-gradient(135deg, #0f172a 0%, #0F1225 100%);
      border-bottom: 1px solid rgba(94, 106, 210, 0.3);
      padding: 12px 20px;
      transform: translateY(-100%);
      transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }

    .va-shipping-bar-container.visible {
      transform: translateY(0);
    }

    .va-shipping-bar-container.unlocked {
      background: linear-gradient(135deg, #10B981 0%, #059669 100%);
    }

    .va-shipping-bar-container[dir="rtl"] {
      text-align: right;
    }

    .va-shipping-bar-inner {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }

    .va-shipping-icon {
      width: 36px;
      height: 36px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 50%;
      animation: vaShippingPulse 2s infinite;
    }

    @keyframes vaShippingPulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }

    .va-shipping-icon svg {
      width: 20px;
      height: 20px;
      fill: white;
    }

    .va-shipping-content {
      flex: 1;
      min-width: 200px;
    }

    .va-shipping-text {
      color: #FFFFFF;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }

    .va-shipping-message {
      flex: 1;
    }

    .va-shipping-amount {
      color: #5E6AD2;
      font-size: 16px;
      font-weight: 700;
    }

    .va-shipping-bar-container.unlocked .va-shipping-amount {
      color: #FFFFFF;
    }

    .va-shipping-progress-wrapper {
      position: relative;
      height: 8px;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 4px;
      overflow: hidden;
    }

    .va-shipping-progress {
      height: 100%;
      background: linear-gradient(90deg, #5E6AD2 0%, #10B981 100%);
      border-radius: 4px;
      transition: width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
      position: relative;
    }

    .va-shipping-progress::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(255, 255, 255, 0.3) 50%,
        transparent 100%
      );
      animation: vaShimmer 2s infinite;
    }

    @keyframes vaShimmer {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }

    .va-shipping-bar-container.unlocked .va-shipping-progress {
      background: rgba(255, 255, 255, 0.3);
    }

    .va-shipping-milestones {
      display: flex;
      justify-content: space-between;
      margin-top: 4px;
      font-size: 10px;
      color: rgba(255, 255, 255, 0.5);
    }

    .va-shipping-milestone {
      position: relative;
    }

    .va-shipping-milestone.reached {
      color: #10B981;
    }

    .va-shipping-close {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s ease;
      flex-shrink: 0;
    }

    .va-shipping-close:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .va-shipping-close svg {
      width: 14px;
      height: 14px;
      fill: white;
    }

    /* Confetti animation when unlocked */
    .va-shipping-confetti {
      position: absolute;
      width: 10px;
      height: 10px;
      opacity: 0;
    }

    .va-shipping-bar-container.unlocked .va-shipping-confetti {
      animation: vaConfetti 1s ease-out forwards;
    }

    @keyframes vaConfetti {
      0% { opacity: 1; transform: translateY(0) rotate(0deg); }
      100% { opacity: 0; transform: translateY(-50px) rotate(720deg); }
    }

    /* Mobile responsive */
    @media (max-width: 640px) {
      .va-shipping-bar-container {
        padding: 10px 16px;
      }

      .va-shipping-icon {
        width: 30px;
        height: 30px;
      }

      .va-shipping-icon svg {
        width: 16px;
        height: 16px;
      }

      .va-shipping-text {
        font-size: 12px;
      }

      .va-shipping-amount {
        font-size: 14px;
      }

      .va-shipping-milestones {
        display: none;
      }
    }
  `;

  // ============================================================
  // FREE SHIPPING BAR CLASS
  // ============================================================

  class FreeShippingBar {
    constructor(options = {}) {
      this.config = {
        tenantId: options.tenantId || this.detectTenantId(),
        lang: options.lang || this.detectLanguage(),
        threshold: options.threshold || 500, // Default 500 MAD
        currency: options.currency || 'MAD',
        position: options.position || 'top', // top, bottom
        voiceEnabled: options.voiceEnabled !== false,
        showMilestones: options.showMilestones !== false,
        autoHide: options.autoHide !== false, // Hide when unlocked after 5s
        autoHideDelay: options.autoHideDelay || 5000,
        dismissible: options.dismissible !== false,
        onUnlock: options.onUnlock || null,
        onMilestone: options.onMilestone || null
      };

      this.state = {
        isVisible: false,
        currentValue: 0,
        percentage: 0,
        isUnlocked: false,
        lastMilestone: 0,
        dismissed: false,
        announcedMilestones: new Set()
      };

      this.elements = {};
      this.translations = TRANSLATIONS[this.config.lang] || TRANSLATIONS.fr;
      this.isRTL = ['ar', 'ary'].includes(this.config.lang);

      this.init();
    }

    detectTenantId() {
      const widget = document.querySelector('[data-vocalia-tenant]');
      if (widget) return widget.dataset.vocaliaTenant;
      return 'default';
    }

    detectLanguage() {
      const widget = document.querySelector('[data-vocalia-lang]');
      if (widget) return widget.dataset.vocaliaLang;
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('lang')) return urlParams.get('lang');
      const browserLang = navigator.language?.split('-')[0];
      return ['fr', 'en', 'es', 'ar', 'ary'].includes(browserLang) ? browserLang : 'fr';
    }

    init() {
      // Inject styles
      if (!document.querySelector('#va-shipping-bar-styles')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'va-shipping-bar-styles';
        styleEl.textContent = STYLES;
        document.head.appendChild(styleEl);
      }

      // Create bar element
      this.createBar();

      // Check for stored cart value
      this.loadCartValue();

      // Listen for cart updates
      this.setupCartListeners();

      console.log('[FreeShippingBar] Initialized', {
        tenant: this.config.tenantId,
        threshold: this.config.threshold,
        currency: this.config.currency
      });
    }

    createBar() {
      const container = document.createElement('div');
      container.className = 'va-shipping-bar-container';
      container.id = 'va-shipping-bar';
      container.setAttribute('dir', this.isRTL ? 'rtl' : 'ltr');
      container.setAttribute('role', 'status');
      container.setAttribute('aria-live', 'polite');

      if (this.config.position === 'bottom') {
        container.style.top = 'auto';
        container.style.bottom = '0';
        container.style.borderBottom = 'none';
        container.style.borderTop = '1px solid rgba(94, 106, 210, 0.3)';
      }

      container.innerHTML = this.getBarHTML();
      document.body.appendChild(container);

      this.elements.container = container;
      this.elements.progress = container.querySelector('.va-shipping-progress');
      this.elements.message = container.querySelector('.va-shipping-message');
      this.elements.amount = container.querySelector('.va-shipping-amount');
      this.elements.closeBtn = container.querySelector('.va-shipping-close');

      // Close button event
      if (this.elements.closeBtn) {
        this.elements.closeBtn.addEventListener('click', () => this.dismiss());
      }
    }

    getBarHTML() {
      const t = this.translations;
      const currencySymbol = t.currency[this.config.currency] || this.config.currency;

      return `
        <div class="va-shipping-bar-inner">
          <div class="va-shipping-icon">
            <svg viewBox="0 0 24 24">
              <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
            </svg>
          </div>

          <div class="va-shipping-content">
            <div class="va-shipping-text">
              <span class="va-shipping-message">${t.addMore.replace('{{amount}}', `<strong>${this.config.threshold} ${currencySymbol}</strong>`)}</span>
              <span class="va-shipping-amount">0 / ${this.config.threshold} ${currencySymbol}</span>
            </div>

            <div class="va-shipping-progress-wrapper">
              <div class="va-shipping-progress" style="width: 0%"></div>
            </div>

            ${this.config.showMilestones ? `
              <div class="va-shipping-milestones">
                <span class="va-shipping-milestone" data-milestone="0">0</span>
                <span class="va-shipping-milestone" data-milestone="25">25%</span>
                <span class="va-shipping-milestone" data-milestone="50">50%</span>
                <span class="va-shipping-milestone" data-milestone="75">75%</span>
                <span class="va-shipping-milestone" data-milestone="100">${t.freeShipping}</span>
              </div>
            ` : ''}
          </div>

          ${this.config.dismissible ? `
            <button class="va-shipping-close" aria-label="Close">
              <svg viewBox="0 0 24 24">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          ` : ''}
        </div>
      `;
    }

    setupCartListeners() {
      // Listen for VocalIA cart updates
      if (window.VocalIA) {
        const originalSetCartData = window.VocalIA.setCartData;
        window.VocalIA.setCartData = (cartData) => {
          if (originalSetCartData) originalSetCartData.call(window.VocalIA, cartData);
          this.updateCartValue(cartData?.total || 0);
        };
      }

      // Listen for custom cart events
      window.addEventListener('va:cart:updated', (e) => {
        this.updateCartValue(e.detail?.total || 0);
      });

      // Shopify integration
      if (window.Shopify) {
        document.addEventListener('cart:updated', (e) => {
          const total = e.detail?.total || window.Shopify?.checkout?.total_price / 100;
          if (total) this.updateCartValue(total);
        });
      }

      // WooCommerce integration
      if (window.jQuery) {
        window.jQuery(document.body).on('added_to_cart removed_from_cart', () => {
          const cartTotal = document.querySelector('.cart-contents-count, .woocommerce-Price-amount');
          if (cartTotal) {
            const value = parseFloat(cartTotal.textContent.replace(/[^\d.]/g, ''));
            if (!isNaN(value)) this.updateCartValue(value);
          }
        });
      }
    }

    loadCartValue() {
      // Try to get cart value from various sources
      const stored = localStorage.getItem('va_cart_total');
      if (stored) {
        this.updateCartValue(parseFloat(stored));
        return;
      }

      // Check VocalIA cart
      if (window.VocalIA?.cart?.total) {
        this.updateCartValue(window.VocalIA.cart.total);
        return;
      }

      // Check Shopify
      if (window.Shopify?.checkout?.total_price) {
        this.updateCartValue(window.Shopify.checkout.total_price / 100);
        return;
      }
    }

    updateCartValue(value) {
      this.state.currentValue = value;
      this.state.percentage = Math.min((value / this.config.threshold) * 100, 100);
      this.state.isUnlocked = value >= this.config.threshold;

      // Store for persistence
      localStorage.setItem('va_cart_total', value.toString());

      // Update UI
      this.updateUI();

      // Check milestones
      this.checkMilestones();

      // Show bar if not dismissed
      if (!this.state.dismissed && value > 0) {
        this.show();
      }

      // Track event
      this.trackEvent('shipping_bar_updated', {
        cart_value: value,
        threshold: this.config.threshold,
        percentage: this.state.percentage,
        unlocked: this.state.isUnlocked
      });
    }

    updateUI() {
      const t = this.translations;
      const currencySymbol = t.currency[this.config.currency] || this.config.currency;
      const remaining = Math.max(this.config.threshold - this.state.currentValue, 0);

      // Update progress bar
      this.elements.progress.style.width = `${this.state.percentage}%`;

      // Update amount display
      this.elements.amount.textContent = `${this.state.currentValue.toFixed(0)} / ${this.config.threshold} ${currencySymbol}`;

      // Update message
      if (this.state.isUnlocked) {
        this.elements.message.innerHTML = `<strong>${t.unlocked}</strong>`;
        this.elements.container.classList.add('unlocked');
        this.elements.container.classList.add('va-celebrate');

        // Auto-hide after unlock
        if (this.config.autoHide) {
          setTimeout(() => this.hide(), this.config.autoHideDelay);
        }

        // Callback
        if (this.config.onUnlock) {
          this.config.onUnlock({ value: this.state.currentValue, threshold: this.config.threshold });
        }
      } else if (this.state.percentage >= 75) {
        this.elements.message.innerHTML = t.almostThere.replace('{{amount}}', `<strong>${remaining.toFixed(0)} ${currencySymbol}</strong>`);
        this.elements.container.classList.remove('unlocked');
      } else {
        this.elements.message.innerHTML = t.addMore.replace('{{amount}}', `<strong>${remaining.toFixed(0)} ${currencySymbol}</strong>`);
        this.elements.container.classList.remove('unlocked');
      }

      // Update milestones
      if (this.config.showMilestones) {
        this.elements.container.querySelectorAll('.va-shipping-milestone').forEach(el => {
          const milestone = parseInt(el.dataset.milestone);
          if (this.state.percentage >= milestone) {
            el.classList.add('reached');
          } else {
            el.classList.remove('reached');
          }
        });
      }
    }

    checkMilestones() {
      const milestones = [25, 50, 75, 100];

      for (const milestone of milestones) {
        if (this.state.percentage >= milestone && !this.state.announcedMilestones.has(milestone)) {
          this.state.announcedMilestones.add(milestone);
          this.announceMilestone(milestone);

          // Callback
          if (this.config.onMilestone) {
            this.config.onMilestone({ milestone, percentage: this.state.percentage, value: this.state.currentValue });
          }
        }
      }
    }

    announceMilestone(milestone) {
      if (!this.config.voiceEnabled) return;

      const t = this.translations;
      const messages = {
        25: t.voiceMilestone25,
        50: t.voiceMilestone50,
        75: t.voiceMilestone75,
        100: t.voiceMilestone100
      };

      const message = messages[milestone];
      if (message) {
        this.speak(message);
      }

      // Track event
      this.trackEvent('shipping_milestone_reached', {
        milestone,
        cart_value: this.state.currentValue,
        threshold: this.config.threshold
      });
    }

    speak(text) {
      if (!window.speechSynthesis) return;

      const utterance = new SpeechSynthesisUtterance(text);
      const langMap = {
        'fr': 'fr-FR',
        'en': 'en-US',
        'es': 'es-ES',
        'ar': 'ar-SA',
        'ary': 'ar-MA'
      };
      utterance.lang = langMap[this.config.lang] || 'fr-FR';
      utterance.rate = 0.9;
      utterance.pitch = 1;

      window.speechSynthesis.speak(utterance);
    }

    show() {
      if (this.state.isVisible || this.state.dismissed) return;

      this.state.isVisible = true;
      this.elements.container.classList.add('visible');

      // Adjust body padding
      if (this.config.position === 'top') {
        document.body.style.paddingTop = '60px';
      }

      this.trackEvent('shipping_bar_shown', {
        cart_value: this.state.currentValue,
        threshold: this.config.threshold
      });
    }

    hide() {
      this.state.isVisible = false;
      this.elements.container.classList.remove('visible');

      // Reset body padding
      if (this.config.position === 'top') {
        document.body.style.paddingTop = '';
      }
    }

    dismiss() {
      this.state.dismissed = true;
      this.hide();
      localStorage.setItem('va_shipping_bar_dismissed', 'true');

      this.trackEvent('shipping_bar_dismissed', {
        cart_value: this.state.currentValue,
        percentage: this.state.percentage
      });
    }

    trackEvent(eventName, params = {}) {
      if (window.gtag) {
        window.gtag('event', eventName, {
          event_category: 'free_shipping',
          tenant_id: this.config.tenantId,
          ...params
        });
      }

      if (window.plausible) {
        window.plausible(eventName, { props: params });
      }

      if (window.VocalIA?.trackEvent) {
        window.VocalIA.trackEvent(eventName, params);
      }
    }

    // Public API
    setThreshold(threshold) {
      this.config.threshold = threshold;
      this.updateCartValue(this.state.currentValue);
    }

    setCurrency(currency) {
      this.config.currency = currency;
      // Re-render
      this.elements.container.innerHTML = this.getBarHTML();
      this.elements.progress = this.elements.container.querySelector('.va-shipping-progress');
      this.elements.message = this.elements.container.querySelector('.va-shipping-message');
      this.elements.amount = this.elements.container.querySelector('.va-shipping-amount');
      this.updateUI();
    }

    reset() {
      this.state.dismissed = false;
      this.state.announcedMilestones.clear();
      localStorage.removeItem('va_shipping_bar_dismissed');
      this.updateCartValue(0);
    }

    destroy() {
      this.hide();
      this.elements.container?.remove();
      document.body.style.paddingTop = '';
    }
  }

  // ============================================================
  // EXPORT
  // ============================================================

  let shippingBarInstance = null;

  function initFreeShippingBar(options = {}) {
    // Check if dismissed
    if (localStorage.getItem('va_shipping_bar_dismissed') === 'true' && options.respectDismissal !== false) {
      console.log('[FreeShippingBar] Previously dismissed, not showing');
      return null;
    }

    if (shippingBarInstance) {
      shippingBarInstance.destroy();
    }
    shippingBarInstance = new FreeShippingBar(options);
    return shippingBarInstance;
  }

  // Expose to window
  window.VocaliaShippingBar = {
    init: initFreeShippingBar,
    getInstance: () => shippingBarInstance,
    FreeShippingBar
  };

  // Integrate with VocalIA namespace
  if (typeof window.VocalIA !== 'undefined') {
    window.VocalIA.ShippingBar = window.VocaliaShippingBar;

    window.VocalIA.initShippingBar = function(options = {}) {
      return initFreeShippingBar(options);
    };

    window.VocalIA.updateShippingProgress = function(cartValue) {
      if (!shippingBarInstance) {
        shippingBarInstance = initFreeShippingBar();
      }
      if (shippingBarInstance) {
        shippingBarInstance.updateCartValue(cartValue);
      }
    };
  }

  // Auto-init if data attribute present
  document.addEventListener('DOMContentLoaded', () => {
    const widget = document.querySelector('[data-vocalia-shipping-bar]');
    if (widget) {
      initFreeShippingBar({
        tenantId: widget.dataset.vocaliaTenant,
        lang: widget.dataset.vocaliaLang,
        threshold: parseInt(widget.dataset.threshold) || 500,
        currency: widget.dataset.currency || 'MAD',
        voiceEnabled: widget.dataset.voice !== 'false'
      });
    }
  });

})();
/**
 * VocalIA - Recommendation Carousel Widget
 *
 * Voice-activated product recommendation carousel integrated with
 * the VocalIA Voice Widget. Shows AI-powered recommendations:
 * - Similar products
 * - Frequently bought together
 * - Personalized recommendations
 *
 * Version: 1.0.0 | Session 250.79 | 03/02/2026
 */

(function(global) {
  'use strict';

  // SECURITY: HTML escape for dynamic content (XSS prevention)
  function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // CSS for the carousel
  const CAROUSEL_CSS = `
    .va-reco-overlay {
      position: fixed;
      bottom: 100px;
      right: 20px;
      width: 380px;
      max-height: 320px;
      background: linear-gradient(145deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.95));
      border-radius: 16px;
      border: 1px solid rgba(139, 92, 246, 0.3);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4), 0 0 20px rgba(139, 92, 246, 0.1);
      backdrop-filter: blur(20px);
      z-index: 10002;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      opacity: 0;
      transform: translateY(20px) scale(0.95);
      transition: all 0.3s ease;
      overflow: hidden;
    }

    .va-reco-overlay.va-reco-visible {
      opacity: 1;
      transform: translateY(0) scale(1);
    }

    .va-reco-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: linear-gradient(90deg, rgba(139, 92, 246, 0.15), rgba(59, 130, 246, 0.15));
      border-bottom: 1px solid rgba(139, 92, 246, 0.2);
    }

    .va-reco-title {
      color: #e2e8f0;
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .va-reco-title svg {
      width: 18px;
      height: 18px;
      color: #8b5cf6;
    }

    .va-reco-close {
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: #94a3b8;
      cursor: pointer;
      padding: 4px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .va-reco-close:hover {
      background: rgba(255, 255, 255, 0.15);
      color: #e2e8f0;
    }

    .va-reco-content {
      padding: 12px;
      display: flex;
      gap: 10px;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }

    .va-reco-content::-webkit-scrollbar {
      display: none;
    }

    .va-reco-card {
      flex: 0 0 140px;
      scroll-snap-align: start;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      overflow: hidden;
      transition: all 0.2s;
      cursor: pointer;
    }

    .va-reco-card:hover {
      border-color: rgba(139, 92, 246, 0.4);
      transform: translateY(-2px);
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
    }

    .va-reco-image {
      width: 100%;
      height: 100px;
      object-fit: cover;
      background: linear-gradient(145deg, #1e293b, #334155);
    }

    .va-reco-image-placeholder {
      width: 100%;
      height: 100px;
      background: linear-gradient(145deg, #1e293b, #334155);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #64748b;
    }

    .va-reco-image-placeholder svg {
      width: 32px;
      height: 32px;
    }

    .va-reco-info {
      padding: 10px;
    }

    .va-reco-name {
      color: #e2e8f0;
      font-size: 13px;
      font-weight: 500;
      line-height: 1.3;
      margin-bottom: 6px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .va-reco-price {
      color: #8b5cf6;
      font-size: 14px;
      font-weight: 600;
    }

    .va-reco-reason {
      font-size: 10px;
      color: #64748b;
      margin-top: 4px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .va-reco-badge {
      display: inline-block;
      padding: 2px 6px;
      background: rgba(139, 92, 246, 0.2);
      color: #a78bfa;
      font-size: 10px;
      border-radius: 4px;
      margin-top: 6px;
    }

    .va-reco-cta {
      display: flex;
      gap: 8px;
      padding: 12px 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .va-reco-btn {
      flex: 1;
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    .va-reco-btn-primary {
      background: linear-gradient(135deg, #8b5cf6, #6366f1);
      color: white;
    }

    .va-reco-btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
    }

    .va-reco-btn-secondary {
      background: rgba(255, 255, 255, 0.1);
      color: #94a3b8;
    }

    .va-reco-btn-secondary:hover {
      background: rgba(255, 255, 255, 0.15);
      color: #e2e8f0;
    }

    /* RTL Support */
    [dir="rtl"] .va-reco-overlay {
      right: auto;
      left: 20px;
    }

    /* Mobile responsive */
    @media (max-width: 480px) {
      .va-reco-overlay {
        width: calc(100vw - 40px);
        right: 20px;
        bottom: 90px;
      }

      .va-reco-card {
        flex: 0 0 120px;
      }

      .va-reco-image,
      .va-reco-image-placeholder {
        height: 80px;
      }
    }
  `;

  /**
   * Recommendation Carousel Class
   */
  class RecommendationCarousel {
    constructor(options = {}) {
      this.options = {
        containerId: 'va-reco-carousel',
        maxItems: 5,
        autoClose: 30000, // Auto-close after 30s
        onItemClick: null,
        onClose: null,
        lang: 'fr',
        ...options
      };

      this.container = null;
      this.isVisible = false;
      this.autoCloseTimer = null;
      this.items = [];

      this._injectStyles();
    }

    /**
     * Inject CSS styles
     */
    _injectStyles() {
      if (document.getElementById('va-reco-styles')) return;

      const style = document.createElement('style');
      style.id = 'va-reco-styles';
      style.textContent = CAROUSEL_CSS;
      document.head.appendChild(style);
    }

    /**
     * Create carousel DOM
     */
    _createCarouselDOM(items, title) {
      const L = this._getLabels();

      const container = document.createElement('div');
      container.id = this.options.containerId;
      container.className = 'va-reco-overlay';
      container.setAttribute('role', 'dialog');
      container.setAttribute('aria-label', title);

      // Check RTL
      if (this.options.lang === 'ar' || this.options.lang === 'ary') {
        container.setAttribute('dir', 'rtl');
      }

      container.innerHTML = `
        <div class="va-reco-header">
          <div class="va-reco-title">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>${escapeHTML(title)}</span>
          </div>
          <button class="va-reco-close" aria-label="${L.close}">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="va-reco-content">
          ${items.map((item, index) => this._renderCard(item, index)).join('')}
        </div>
        <div class="va-reco-cta">
          <button class="va-reco-btn va-reco-btn-secondary" data-action="voice">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
              <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
            ${L.askVoice}
          </button>
          <button class="va-reco-btn va-reco-btn-primary" data-action="viewAll">
            ${L.viewAll}
          </button>
        </div>
      `;

      // Event listeners
      container.querySelector('.va-reco-close').addEventListener('click', () => this.hide());

      container.querySelectorAll('.va-reco-card').forEach((card, index) => {
        card.addEventListener('click', () => {
          if (this.options.onItemClick) {
            this.options.onItemClick(items[index], index);
          }
          this._trackClick(items[index], index);
        });
      });

      container.querySelector('[data-action="voice"]').addEventListener('click', () => {
        this.hide();
        // Trigger voice widget if available
        if (window.VocalIA?.openVoiceWidget) {
          window.VocalIA.openVoiceWidget();
        }
      });

      container.querySelector('[data-action="viewAll"]').addEventListener('click', () => {
        this._trackViewAll();
        // Navigate to catalog or trigger custom action
        if (this.options.onViewAll) {
          this.options.onViewAll();
        }
      });

      return container;
    }

    /**
     * Render individual product card
     */
    _renderCard(item, index) {
      const L = this._getLabels();
      const name = item.title || item.name || `Product ${index + 1}`;
      const price = item.price ? this._formatPrice(item.price) : '';
      const image = item.image || item.images?.[0]?.src;
      const reason = this._getReasonLabel(item.reason);

      const safeId = escapeHTML(String(item.id || item.productId || ''));
      const safeName = escapeHTML(name);
      const safeImage = image ? escapeHTML(image) : '';
      const safeReason = reason ? escapeHTML(reason) : '';

      return `
        <div class="va-reco-card" data-product-id="${safeId}" tabindex="0">
          ${safeImage
            ? `<img class="va-reco-image" src="${safeImage}" alt="${safeName}" loading="lazy" onerror="this.style.display='none'">`
            : `<div class="va-reco-image-placeholder">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>`
          }
          <div class="va-reco-info">
            <div class="va-reco-name">${safeName}</div>
            ${price ? `<div class="va-reco-price">${price}</div>` : ''}
            ${safeReason ? `<div class="va-reco-reason">${safeReason}</div>` : ''}
            ${item.similarity ? `<span class="va-reco-badge">${parseInt(item.similarity) || 0}% ${escapeHTML(L.match)}</span>` : ''}
          </div>
        </div>
      `;
    }

    /**
     * Format price with currency
     */
    _formatPrice(price) {
      const num = parseFloat(price);
      if (isNaN(num)) return price;

      // Use MAD for Moroccan locale, EUR for European, USD otherwise
      const lang = this.options.lang;
      if (lang === 'ar' || lang === 'ary') {
        return `${num.toFixed(0)} DH`;
      } else if (lang === 'fr' || lang === 'es') {
        return `${num.toFixed(2)} €`;
      }
      return `$${num.toFixed(2)}`;
    }

    /**
     * Get reason label
     */
    _getReasonLabel(reason) {
      const L = this._getLabels();
      const reasonLabels = {
        similar_product: L.similarProduct,
        frequently_bought_together: L.boughtTogether,
        based_on_viewed: L.basedOnViewed,
        based_on_purchases: L.basedOnPurchases,
        personalized: L.personalized
      };
      return reasonLabels[reason] || '';
    }

    /**
     * Get localized labels
     */
    _getLabels() {
      const labels = {
        fr: {
          close: 'Fermer',
          askVoice: 'Demander',
          viewAll: 'Voir tout',
          match: 'match',
          similarProduct: 'Similaire',
          boughtTogether: 'Souvent acheté avec',
          basedOnViewed: 'Vu récemment',
          basedOnPurchases: 'Pour vous',
          personalized: 'Recommandé'
        },
        en: {
          close: 'Close',
          askVoice: 'Ask',
          viewAll: 'View All',
          match: 'match',
          similarProduct: 'Similar',
          boughtTogether: 'Often bought together',
          basedOnViewed: 'Recently viewed',
          basedOnPurchases: 'For you',
          personalized: 'Recommended'
        },
        es: {
          close: 'Cerrar',
          askVoice: 'Preguntar',
          viewAll: 'Ver todo',
          match: 'coincide',
          similarProduct: 'Similar',
          boughtTogether: 'Comprado junto',
          basedOnViewed: 'Visto reciente',
          basedOnPurchases: 'Para ti',
          personalized: 'Recomendado'
        },
        ar: {
          close: 'إغلاق',
          askVoice: 'اسأل',
          viewAll: 'عرض الكل',
          match: 'تطابق',
          similarProduct: 'مشابه',
          boughtTogether: 'يشترى معًا',
          basedOnViewed: 'شوهد مؤخرًا',
          basedOnPurchases: 'لك',
          personalized: 'موصى به'
        },
        ary: {
          close: 'سد',
          askVoice: 'سول',
          viewAll: 'شوف كلشي',
          match: 'تطابق',
          similarProduct: 'بحال هادا',
          boughtTogether: 'كيتشرا مع',
          basedOnViewed: 'شفتي مؤخراً',
          basedOnPurchases: 'ليك',
          personalized: 'منصوح بيه'
        }
      };

      return labels[this.options.lang] || labels.fr;
    }

    /**
     * Show carousel with recommendations
     */
    show(items, options = {}) {
      const { title, type = 'similar' } = options;
      const L = this._getLabels();

      // Default titles by type
      const defaultTitles = {
        similar: { fr: 'Produits similaires', en: 'Similar Products', es: 'Productos similares', ar: 'منتجات مشابهة', ary: 'منتوجات بحال هادو' },
        bought_together: { fr: 'Souvent achetés ensemble', en: 'Frequently Bought Together', es: 'Comprados juntos', ar: 'يُشترى معًا', ary: 'كيتشرا مع بعض' },
        personalized: { fr: 'Recommandé pour vous', en: 'Recommended for You', es: 'Recomendado para ti', ar: 'موصى به لك', ary: 'منصوح بيه ليك' }
      };

      const displayTitle = title || (defaultTitles[type]?.[this.options.lang] || defaultTitles[type]?.fr || 'Recommendations');

      // Limit items
      this.items = items.slice(0, this.options.maxItems);

      // Remove existing
      this.hide();

      // Create and append
      this.container = this._createCarouselDOM(this.items, displayTitle);
      document.body.appendChild(this.container);

      // Animate in
      requestAnimationFrame(() => {
        this.container.classList.add('va-reco-visible');
      });

      this.isVisible = true;

      // Track impression
      this._trackImpression(type, this.items.length);

      // Auto-close timer
      if (this.options.autoClose) {
        this.autoCloseTimer = setTimeout(() => this.hide(), this.options.autoClose);
      }

      return this;
    }

    /**
     * Hide carousel
     */
    hide() {
      if (this.autoCloseTimer) {
        clearTimeout(this.autoCloseTimer);
        this.autoCloseTimer = null;
      }

      if (this.container) {
        this.container.classList.remove('va-reco-visible');
        setTimeout(() => {
          this.container?.remove();
          this.container = null;
        }, 300);
      }

      this.isVisible = false;

      if (this.options.onClose) {
        this.options.onClose();
      }

      return this;
    }

    /**
     * Track impression for analytics
     */
    _trackImpression(type, count) {
      if (typeof gtag === 'function') {
        gtag('event', 'reco_carousel_impression', {
          event_category: 'recommendations',
          recommendation_type: type,
          items_shown: count
        });
      }
    }

    /**
     * Track click on item
     */
    _trackClick(item, index) {
      if (typeof gtag === 'function') {
        gtag('event', 'reco_carousel_click', {
          event_category: 'recommendations',
          product_id: item.id || item.productId,
          position: index + 1,
          reason: item.reason
        });
      }
    }

    /**
     * Track view all click
     */
    _trackViewAll() {
      if (typeof gtag === 'function') {
        gtag('event', 'reco_carousel_view_all', {
          event_category: 'recommendations',
          items_shown: this.items.length
        });
      }
    }

    /**
     * Set language
     */
    setLanguage(lang) {
      this.options.lang = lang;
      return this;
    }
  }

  // Export
  global.VocalIARecommendations = RecommendationCarousel;

  // Auto-initialize if VocalIA widget exists
  if (global.VocalIA) {
    global.VocalIA.RecommendationCarousel = RecommendationCarousel;
  }

})(typeof window !== 'undefined' ? window : this);
