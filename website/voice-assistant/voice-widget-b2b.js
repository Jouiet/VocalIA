/**
 * VocalIA Voice Widget - B2B/Lead Gen Specialized Kernel
 * Version: 2.7.0 (B2B) | Session 250.153
 *
 * DESIGN: SOBER & PROFESSIONAL - VocalIA Deep Indigo (#5E6AD2)
 * FEATURES: Voice Chat, Lead Qualification, Booking, FAQ, Exit Intent (Lead Magnet)
 * EXCLUDED: E-commerce, Product Cards, Carousels, Cart Recovery
 *
 * FIXES Session 250.91:
 * - Added missing initEventListeners() and togglePanel() functions
 * - Fixed logo path: /logo.png -> /public/images/logo.webp
 * - v2.2.0: CORRECT colors from DESIGN-BRANDING-SYSTEM.md:
 *   - Primary: #5E6AD2 (VocalIA Deep Indigo, Linear inspired)
 *   - Dark: #4f46e5 (indigo-600)
 *   - Accent: #818cf8 (indigo-400)
 *   - All rgba shadows: rgba(94, 106, 210, ...)
 */

(function () {
    'use strict';

    const CONFIG = {
        // Supported languages - All 5 languages
        SUPPORTED_LANGS: ['fr', 'en', 'es', 'ar', 'ary'],
        DEFAULT_LANG: 'fr',

        // API Endpoints
        VOICE_API_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:3004/respond'
            : 'https://api.vocalia.ma/respond',

        CONFIG_API_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:3004/config'
            : 'https://api.vocalia.ma/config',
        SOCIAL_PROOF_API_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:3004/social-proof'
            : 'https://api.vocalia.ma/social-proof',

        // Feature Flags - B2B Preset
        ECOMMERCE_MODE: false, // HARDCODED FALSE - no cart/checkout
        CATALOG_MODE: true,    // Show service/product cards from tenant catalog
        EXIT_INTENT_ENABLED: true,
        SOCIAL_PROOF_ENABLED: true,
        AI_MODE: true,

        // Catalog API for service/product display
        CATALOG_API_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:3013/api/tenants'
            : 'https://api.vocalia.ma/api/tenants',
        MAX_CATALOG_ITEMS: 4,

        // Social Proof Timing
        SOCIAL_PROOF_DELAY: 10000,
        SOCIAL_PROOF_INTERVAL: 25000,
        SOCIAL_PROOF_DURATION: 5000,
        SOCIAL_PROOF_MAX_SHOWN: 4,

        // UI Configuration - VocalIA Official Branding (DESIGN-BRANDING-SYSTEM.md)
        primaryColor: '#5E6AD2',    // VocalIA Deep Indigo (Linear inspired) - PRIMARY BRAND
        primaryDark: '#4f46e5',     // indigo-600 - Primary hover
        accentColor: '#818cf8',     // indigo-400 - Secondary accents
        darkBg: '#0f172a',          // slate-900 - Primary Dark BG

        // Timeouts
        API_TIMEOUT: 15000,
        EXIT_INTENT_DELAY: 5000,
        EXIT_INTENT_COOLDOWN: 24 * 60 * 60 * 1000,

        // Paths - FIXED Session 250.90: Correct path to language files
        LANG_PATH: '/voice-assistant/lang/voice-{lang}.json',
        LOGO_PATH: '/public/images/logo.webp',

        // Auto-detection
        AUTO_DETECT_LANGUAGES: {
            'fr': 'fr', 'fr-FR': 'fr', 'fr-CA': 'fr', 'fr-BE': 'fr',
            'en': 'en', 'en-US': 'en', 'en-GB': 'en',
            'es': 'es', 'es-ES': 'es',
            'ar': 'ar', 'ar-MA': 'ary', 'ar-SA': 'ar',
            'ary': 'ary'
        }
    };

    // State Management
    const state = {
        isOpen: false,
        isListening: false,
        currentLang: CONFIG.DEFAULT_LANG,
        langData: null,
        conversationHistory: [],
        tenantId: null,
        sessionId: `b2b_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,

        // Speech Synthesis/Recognition
        recognition: null,
        synthesis: window.speechSynthesis,

        // Context for Lead Gen
        conversationContext: {
            industry: null,
            need: null,
            stage: 'discovery',
            lastTopic: null,
            attribution: {
                utm_source: null,
                utm_medium: null,
                utm_campaign: null,
                referrer: document.referrer || null
            },
            bookingFlow: {
                active: false,
                step: null,
                data: { name: null, email: null, datetime: null, service: null }
            }
        },

        // Feature States
        exitIntent: {
            shown: false,
            dismissed: false,
            pageLoadTime: Date.now(),
            lastScrollY: 0,
            triggered: false
        },
        socialProof: {
            messages: [],
            notificationsShown: 0,
            intervalId: null,
            lastShownTime: 0
        },
        bookingConfig: {
            url: null,
            phone: null,
            enabled: false
        },
        availableSlotsCache: { slots: [], timestamp: 0 },
        // Session 250.146: Plan-based feature gating (from /config + /respond)
        planFeatures: null
    };

    // Browser capabilities
    const hasSpeechRecognition = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
    const hasSpeechSynthesis = 'speechSynthesis' in window;
    const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const needsTextFallback = !hasSpeechRecognition || isFirefox || isSafari;

    // ============================================================
    // LANGUAGE & INIT
    // ============================================================

    function detectLanguage() {
        const urlParams = new URLSearchParams(window.location.search);
        const urlLang = urlParams.get('lang');
        if (urlLang && CONFIG.SUPPORTED_LANGS.includes(urlLang)) return urlLang;
        const htmlLang = document.documentElement.lang?.toLowerCase()?.split('-')[0];
        if (htmlLang && CONFIG.SUPPORTED_LANGS.includes(htmlLang)) return htmlLang;
        const browserLang = navigator.language || navigator.userLanguage;
        const mappedLang = CONFIG.AUTO_DETECT_LANGUAGES[browserLang] || CONFIG.AUTO_DETECT_LANGUAGES[browserLang?.split('-')[0]];
        if (mappedLang && CONFIG.SUPPORTED_LANGS.includes(mappedLang)) return mappedLang;
        return CONFIG.DEFAULT_LANG;
    }

    async function loadLanguage(langCode) {
        const url = CONFIG.LANG_PATH.replace('{lang}', langCode);
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to load language: ${langCode}`);
            state.currentLang = langCode;
            state.langData = await response.json();
        } catch (error) {
            console.error('[VocalIA B2B] Language load error:', error);
            if (langCode !== 'fr') return loadLanguage('fr');
            // Ultimate fallback - minimal inline strings
            state.langData = {
                meta: { rtl: false, speechSynthesis: 'fr-FR', speechRecognition: 'fr-FR' },
                ui: {
                    headerTitle: 'VocalIA Assistant',
                    headerSubtitleVoice: 'Expert IA B2B',
                    placeholder: 'Posez votre question...',
                    ariaOpenAssistant: 'Ouvrir l\'assistant vocal VocalIA',
                    notifTitle: 'Besoin d\'aide ?',
                    errorMessage: 'Désolé, une erreur s\'est produite.'
                }
            };
        }
    }

    function captureAttribution() {
        const urlParams = new URLSearchParams(window.location.search);
        const attr = state.conversationContext.attribution;
        attr.utm_source = urlParams.get('utm_source') || attr.utm_source;
        attr.utm_medium = urlParams.get('utm_medium') || attr.utm_medium;
        attr.utm_campaign = urlParams.get('utm_campaign') || attr.utm_campaign;
    }

    // ============================================================
    // PAGE CONTEXT (Session 250.147: Proactive contextual greeting)
    // ============================================================

    function getPageContext() {
        const path = window.location.pathname;
        const title = document.title || '';
        const ogTitle = document.querySelector('meta[property="og:title"]')?.content || '';
        const description = document.querySelector('meta[name="description"]')?.content || '';
        const h1 = document.querySelector('h1')?.textContent?.trim() || '';

        // Detect page type from path
        let pageType = 'general';
        if (/\/(pricing|tarifs|prix)/i.test(path)) pageType = 'pricing';
        else if (/\/(booking|rendez-vous|demo|reservation)/i.test(path)) pageType = 'booking';
        else if (/\/(contact|nous-contacter)/i.test(path)) pageType = 'contact';
        else if (/\/(features|fonctionnalites|produits)/i.test(path)) pageType = 'features';
        else if (/\/(use-cases|cas-usage)/i.test(path)) pageType = 'use_cases';
        else if (/\/(about|a-propos)/i.test(path)) pageType = 'about';
        else if (/\/(blog|article)/i.test(path)) pageType = 'blog';
        else if (path === '/' || path === '/index.html') pageType = 'homepage';

        return { path, pageType, title: ogTitle || h1 || title, description: description.slice(0, 200) };
    }

    // ============================================================
    // GA4 ANALYTICS
    // ============================================================

    function trackEvent(eventName, params = {}) {
        if (typeof gtag === 'function') {
            gtag('event', eventName, { ...params, agent_type: 'b2b_specialized' });
        }
    }

    // ============================================================
    // WIDGET UI - Shadow DOM Encapsulated
    // ============================================================

    // Shadow root reference for scoped DOM queries
    let shadowRoot = null;

    function $id(id) { return shadowRoot ? shadowRoot.getElementById(id) : document.getElementById(id); }
    function $q(sel) { return shadowRoot ? shadowRoot.querySelector(sel) : document.querySelector(sel); }

    function createWidget() {
        if (document.getElementById('vocalia-widget')) return;

        const L = state.langData;
        const isRTL = L.meta.rtl;
        const position = isRTL ? 'left' : 'right';

        const host = document.createElement('div');
        host.id = 'vocalia-widget';
        host.style.cssText = `position:fixed;bottom:30px;${position}:25px;z-index:99999;${isRTL ? 'direction:rtl;' : ''}`;
        document.body.appendChild(host);

        shadowRoot = host.attachShadow({ mode: 'open' });
        shadowRoot.innerHTML = generateWidgetHTML(L, isRTL, position);

        initEventListeners();
        setTimeout(() => { if (!state.isOpen) showNotificationBubble(); }, 3000);
    }

    function generateWidgetHTML(L, isRTL, position) {
        return `
      <style>
        #vocalia-widget {
          --va-primary: ${CONFIG.primaryColor};
          --va-primary-dark: ${CONFIG.primaryDark};
          --va-accent: ${CONFIG.accentColor};
          --va-dark: ${CONFIG.darkBg};
        }
        .va-trigger {
          width: 60px; height: 60px; border-radius: 50%;
          background: linear-gradient(135deg, var(--va-primary) 0%, var(--va-primary-dark) 100%);
          border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 20px rgba(94, 106, 210, 0.4);
          transition: all 0.3s ease; position: relative;
          animation: vaTriggerPulse 2.5s ease-in-out infinite;
        }
        .va-trigger:hover { transform: scale(1.1); box-shadow: 0 6px 30px rgba(94, 106, 210, 0.6); animation: none; }
        @keyframes vaTriggerPulse {
          0%, 100% { box-shadow: 0 4px 20px rgba(94, 106, 210, 0.4); transform: scale(1); }
          50% { box-shadow: 0 4px 30px rgba(94, 106, 210, 0.7); transform: scale(1.02); }
        }
        .va-trigger img { width: 36px; height: 36px; object-fit: contain; border-radius: 50%; }

        .va-panel {
          display: none; position: absolute; bottom: 70px; ${position}: 0;
          width: 380px; max-height: 520px; background: var(--va-dark);
          border: 1px solid rgba(94, 106, 210, 0.3); border-radius: 16px;
          overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.5);
          flex-direction: column;
        }
        .va-panel.open { display: flex; animation: vaSlideUp 0.3s ease; }
        @keyframes vaSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

        .va-header {
          padding: 16px 20px; background: linear-gradient(135deg, var(--va-primary), var(--va-primary-dark));
          display: flex; align-items: center; gap: 12px;
        }
        .va-header-logo { width: 40px; height: 40px; border-radius: 50%; background: white; padding: 4px; }
        .va-header-logo img { width: 100%; height: 100%; object-fit: contain; }
        .va-header-text h3 { margin: 0; font-size: 16px; color: white; font-weight: 600; }
        .va-header-text p { margin: 2px 0 0; font-size: 12px; color: rgba(255,255,255,0.8); }
        .va-close { margin-${isRTL ? 'right' : 'left'}: auto; background: rgba(255,255,255,0.1); border: none; color: white; cursor: pointer; width: 28px; height: 28px; border-radius: 50%; font-size: 16px; transition: background 0.2s; }
        .va-close:hover { background: rgba(255,255,255,0.2); }

        .va-messages { flex: 1; overflow-y: auto; padding: 16px; min-height: 220px; max-height: 350px; }
        .va-message { margin-bottom: 12px; display: flex; gap: 8px; }
        .va-message-content { max-width: 85%; padding: 12px 16px; border-radius: 16px; font-size: 14px; line-height: 1.5; }
        .va-message.assistant .va-message-content { background: rgba(94, 106, 210, 0.15); color: #e5e5e5; border-bottom-left-radius: 4px; }
        .va-message.user { justify-content: flex-end; }
        .va-message.user .va-message-content { background: var(--va-primary); color: white; border-bottom-right-radius: 4px; }

        .va-input-area { padding: 12px 16px; border-top: 1px solid rgba(94, 106, 210, 0.2); display: flex; gap: 8px; background: rgba(0,0,0,0.2); }
        .va-input { flex: 1; background: rgba(255,255,255,0.05); border: 1px solid rgba(94, 106, 210, 0.3); border-radius: 24px; padding: 12px 18px; color: white; outline: none; font-size: 14px; }
        .va-input:focus { border-color: var(--va-primary); box-shadow: 0 0 0 2px rgba(94, 106, 210, 0.2); }
        .va-input::placeholder { color: rgba(255,255,255,0.5); }

        .va-btn { width: 44px; height: 44px; border-radius: 50%; background: var(--va-primary); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .va-btn:hover { background: var(--va-primary-dark); transform: scale(1.05); }
        .va-btn.listening { background: #DC2626; animation: vaPulse 1.5s infinite; }
        .va-btn-send { background: transparent; border: 1px solid rgba(94, 106, 210, 0.5); }
        .va-btn-send:hover { background: rgba(94, 106, 210, 0.2); border-color: var(--va-primary); }

        @keyframes vaPulse { 0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(220, 38, 38, 0); } 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); } }

        .va-visualizer { height: 40px; display: none; padding: 0 16px; align-items: center; justify-content: center; background: rgba(94, 106, 210, 0.1); }
        .va-visualizer.active { display: flex; }
        .va-visualizer-bar { width: 4px; background: var(--va-accent); margin: 0 3px; border-radius: 2px; animation: vaSound 0.5s infinite alternate; }
        .va-visualizer-bar:nth-child(1) { animation-delay: 0s; }
        .va-visualizer-bar:nth-child(2) { animation-delay: 0.1s; }
        .va-visualizer-bar:nth-child(3) { animation-delay: 0.2s; }
        .va-visualizer-bar:nth-child(4) { animation-delay: 0.3s; }
        .va-visualizer-bar:nth-child(5) { animation-delay: 0.15s; }
        .va-visualizer-bar:nth-child(6) { animation-delay: 0.25s; }
        .va-visualizer-bar:nth-child(7) { animation-delay: 0.05s; }
        .va-visualizer-bar:nth-child(8) { animation-delay: 0.35s; }
        @keyframes vaSound { 0% { height: 4px; opacity: 0.5; } 100% { height: 24px; opacity: 1; } }

        .va-notif-bubble { position: absolute; bottom: 70px; ${position}: 0; white-space: nowrap; z-index: 9999; animation: vaFadeIn 0.5s ease; }
        .va-notif-bubble-content { padding: 12px 16px; background: white; color: #0F172A; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.15); font-size: 14px; font-weight: 500; border-left: 4px solid var(--va-primary); }
        @keyframes vaFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        /* Service/Product Cards for Catalog Mode */
        .va-service-cards { display: flex; overflow-x: auto; gap: 10px; padding: 8px 0; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; }
        .va-service-cards::-webkit-scrollbar { height: 3px; }
        .va-service-cards::-webkit-scrollbar-thumb { background: var(--va-primary); border-radius: 3px; }
        .va-service-card { min-width: 200px; max-width: 220px; background: rgba(94, 106, 210, 0.08); border: 1px solid rgba(94, 106, 210, 0.2); border-radius: 12px; overflow: hidden; cursor: pointer; transition: all 0.2s; scroll-snap-align: start; flex-shrink: 0; }
        .va-service-card:hover { border-color: var(--va-primary); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(94, 106, 210, 0.2); }
        .va-service-card-img { width: 100%; height: 110px; object-fit: cover; background: rgba(94, 106, 210, 0.05); }
        .va-service-card-img-placeholder { width: 100%; height: 110px; display: flex; align-items: center; justify-content: center; font-size: 28px; background: rgba(94, 106, 210, 0.05); }
        .va-service-card-body { padding: 10px 12px; }
        .va-service-card-title { font-size: 13px; font-weight: 600; color: #e5e5e5; margin: 0 0 4px; line-height: 1.3; }
        .va-service-card-desc { font-size: 11px; color: rgba(255,255,255,0.6); margin: 0 0 8px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .va-service-card-price { font-size: 13px; font-weight: 700; color: var(--va-accent); }
        .va-service-card-cta { display: block; width: 100%; margin-top: 8px; padding: 6px; background: var(--va-primary); color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer; text-align: center; transition: background 0.2s; }
        .va-service-card-cta:hover { background: var(--va-primary-dark); }
        .va-catalog-header { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; color: #e5e5e5; font-size: 13px; font-weight: 600; }
        .va-catalog-header svg { width: 14px; height: 14px; fill: var(--va-primary); }

        @media (max-width: 480px) {
          .va-panel { width: calc(100vw - 40px); ${position}: -5px; }
        }
      </style>

      <button class="va-trigger" id="va-trigger" aria-label="${L.ui.ariaOpenAssistant}">
        <img src="${CONFIG.LOGO_PATH}" alt="VocalIA" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22white%22><path d=%22M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z%22/><path d=%22M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z%22/></svg>'"/>
      </button>

      <div class="va-panel" id="va-panel" role="dialog" aria-label="${L.ui.headerTitle || 'VocalIA Assistant'}" aria-modal="true">
        <div class="va-header">
          <div class="va-header-logo">
            <img src="${CONFIG.LOGO_PATH}" alt="VocalIA" onerror="this.style.display='none'"/>
          </div>
          <div class="va-header-text">
            <h3>${L.ui.headerTitle || 'VocalIA Assistant'}</h3>
            <p>${L.ui.headerSubtitleVoice || 'Expert IA'}</p>
          </div>
          <button class="va-close" id="va-close" aria-label="${L.ui.ariaClose || 'Fermer'}">✕</button>
        </div>

        <div class="va-visualizer" id="va-visualizer" aria-hidden="true">
          ${Array.from({ length: 8 }, () => '<div class="va-visualizer-bar"></div>').join('')}
        </div>

        <div class="va-messages" id="va-messages" aria-live="polite" aria-relevant="additions"></div>

        <div class="va-input-area">
          <input type="text" class="va-input" id="va-input" placeholder="${L.ui.placeholder || 'Posez votre question...'}" autocomplete="off">
          ${(hasSpeechRecognition || (typeof MediaRecorder !== 'undefined')) ? `
          <button class="va-btn" id="va-mic" aria-label="Activer le microphone">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="white"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
          </button>` : ''}
          <button class="va-btn va-btn-send" id="va-send" aria-label="Envoyer">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
      </div>
    `;
    }

    function showNotificationBubble() {
        const L = state.langData;
        const trigger = $id('va-trigger');
        if (!trigger) return;

        const bubble = document.createElement('div');
        bubble.className = 'va-notif-bubble';
        const bubbleContent = document.createElement('div');
        bubbleContent.className = 'va-notif-bubble-content';
        bubbleContent.textContent = '👋 ' + (L.ui.notifTitle || 'Besoin d\'aide ?');
        bubble.appendChild(bubbleContent);
        trigger.parentNode.appendChild(bubble);
        setTimeout(() => bubble.remove(), 6000);
    }

    // ============================================================
    // EVENT LISTENERS - CRITICAL FIX Session 250.91
    // ============================================================

    function initEventListeners() {
        const trigger = $id('va-trigger');
        const closeBtn = $id('va-close');
        const sendBtn = $id('va-send');
        const input = $id('va-input');
        const micBtn = $id('va-mic');

        if (trigger) trigger.addEventListener('click', togglePanel);
        if (closeBtn) closeBtn.addEventListener('click', togglePanel);

        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                const text = input?.value?.trim();
                if (text) sendMessage(text, 'text');
            });
        }

        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const text = e.target.value?.trim();
                    if (text) sendMessage(text, 'text');
                }
            });
        }

        if (micBtn) {
            initSpeechRecognition();
            if (state.sttMode !== 'none') {
                micBtn.addEventListener('click', toggleListening);
            } else {
                micBtn.style.display = 'none';
            }
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

        trackEvent('widget_initialized', { language: state.currentLang });
    }

    function togglePanel() {
        state.isOpen = !state.isOpen;
        const panel = $id('va-panel');
        if (panel) {
            panel.classList.toggle('open', state.isOpen);
        }

        if (state.isOpen) {
            trackEvent('widget_opened');
            // Focus input when opened
            setTimeout(() => {
                const input = $id('va-input');
                if (input) input.focus();
            }, 100);

            // Show welcome message if first open
            if (state.conversationHistory.length === 0) {
                const L = state.langData;
                const welcomeMsg = L.ui.welcomeMessage || 'Bonjour ! Comment puis-je vous aider aujourd\'hui ?';
                addMessage(welcomeMsg, 'assistant');
            }
        } else {
            trackEvent('widget_closed');
        }
    }

    // ============================================================
    // MESSAGING & VOICE
    // ============================================================

    function addMessage(text, type = 'assistant') {
        const container = $id('va-messages');
        if (!container) return;

        const div = document.createElement('div');
        div.className = `va-message ${type}`;
        div.innerHTML = `<div class="va-message-content">${escapeHtml(text)}</div>`;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;

        state.conversationHistory.push({ role: type, content: text });

        if (type === 'assistant' && hasSpeechSynthesis) {
            speak(text);
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ============================================================
    // CATALOG/SERVICE CARD DISPLAY
    // ============================================================

    function renderServiceCards(items, title) {
        if (!CONFIG.CATALOG_MODE || !items || items.length === 0) return;

        const container = $id('va-messages');
        if (!container) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'va-message assistant';

        const safeTitle = title ? escapeHtml(title) : '';
        let html = `<div class="va-message-content" style="max-width:100%;padding:10px 12px;">`;
        if (safeTitle) {
            html += `<div class="va-catalog-header"><svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/><path d="M7 12h2v5H7zm4-3h2v8h-2zm4-3h2v11h-2z"/></svg>${safeTitle}</div>`;
        }
        html += `<div class="va-service-cards">`;

        const limit = Math.min(items.length, CONFIG.MAX_CATALOG_ITEMS);
        for (let i = 0; i < limit; i++) {
            const item = items[i];
            const safeName = escapeHtml(item.name || item.title || '');
            const safeDesc = escapeHtml(item.description || item.subtitle || '');
            const safePrice = escapeHtml(item.price || item.pricing || '');
            const hasImage = item.image || item.images?.[0] || item.thumbnail;
            const imageUrl = hasImage || '';

            html += `<div class="va-service-card" data-item-id="${escapeHtml(item.id || '')}" data-index="${i}">`;
            if (imageUrl) {
                html += `<img class="va-service-card-img" src="${escapeHtml(imageUrl)}" alt="${safeName}" loading="lazy" onerror="this.outerHTML='<div class=\\'va-service-card-img-placeholder\\'>📋</div>'"/>`;
            } else {
                html += `<div class="va-service-card-img-placeholder">${item.icon || '📋'}</div>`;
            }
            html += `<div class="va-service-card-body">`;
            html += `<div class="va-service-card-title">${safeName}</div>`;
            if (safeDesc) html += `<div class="va-service-card-desc">${safeDesc}</div>`;
            if (safePrice) html += `<div class="va-service-card-price">${safePrice}</div>`;
            html += `<button class="va-service-card-cta">${escapeHtml(item.cta || 'En savoir plus')}</button>`;
            html += `</div></div>`;
        }

        html += `</div></div>`;
        wrapper.innerHTML = html;
        container.appendChild(wrapper);
        container.scrollTop = container.scrollHeight;

        // Click handlers for service cards
        wrapper.querySelectorAll('.va-service-card').forEach(card => {
            card.addEventListener('click', () => {
                const itemId = card.dataset.itemId;
                const itemIndex = parseInt(card.dataset.index);
                const item = items[itemIndex];
                if (item) {
                    trackEvent('service_card_click', { item_id: itemId, item_name: item.name || item.title });
                    // Send a follow-up message about the clicked service
                    sendMessage(item.name || item.title, 'text');
                }
            });
        });

        trackEvent('service_cards_displayed', { count: limit, title: title || 'catalog' });
    }

    function speak(text) {
        if (!hasSpeechSynthesis) return;
        state.synthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = state.langData?.meta?.speechSynthesis || 'fr-FR';
        utterance.onstart = () => {
            const viz = $id('va-visualizer');
            if (viz) viz.classList.add('active');
        };
        utterance.onend = () => {
            const viz = $id('va-visualizer');
            if (viz) viz.classList.remove('active');
        };
        state.synthesis.speak(utterance);
    }

    function initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (SpeechRecognition) {
            // Native Web Speech API (Chrome, Edge)
            state.recognition = new SpeechRecognition();
            state.recognition.lang = state.langData?.meta?.speechRecognition || 'fr-FR';
            state.recognition.continuous = false;
            state.recognition.interimResults = false;

            state.recognition.onresult = (e) => {
                const transcript = e.results[0][0].transcript;
                const input = $id('va-input');
                if (input) input.value = transcript;
                sendMessage(transcript, 'voice');
            };

            state.recognition.onend = () => {
                state.isListening = false;
                const micBtn = $id('va-mic');
                const viz = $id('va-visualizer');
                if (micBtn) micBtn.classList.remove('listening');
                if (viz) viz.classList.remove('active');
            };

            state.recognition.onerror = (e) => {
                console.warn('[VocalIA] Speech recognition error:', e.error);
                state.isListening = false;
                const micBtn = $id('va-mic');
                if (micBtn) micBtn.classList.remove('listening');
            };

            state.sttMode = 'native';
        } else if (navigator.mediaDevices && typeof MediaRecorder !== 'undefined') {
            // Fallback: MediaRecorder → backend /stt (Firefox, Safari)
            state.sttMode = 'fallback';
            console.log('[VocalIA B2B] Using MediaRecorder STT fallback');
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

                if (audioBlob.size < 1000) {
                    console.warn('[VocalIA] Audio too short');
                    return;
                }

                // Send to backend /stt
                const sttUrl = CONFIG.VOICE_API_URL.replace('/respond', '/stt');
                try {
                    const resp = await fetch(sttUrl, {
                        method: 'POST',
                        headers: { 'X-Language': state.currentLang },
                        body: audioBlob,
                        signal: AbortSignal.timeout(15000)
                    });
                    const result = await resp.json();
                    if (result.success && result.text) {
                        const input = $id('va-input');
                        if (input) input.value = result.text;
                        sendMessage(result.text, 'voice');
                    } else {
                        console.warn('[VocalIA] STT failed:', result.error);
                    }
                } catch (err) {
                    console.error('[VocalIA] STT request failed:', err.message);
                }
            };

            state.mediaRecorder.start();
            state.isListening = true;

            // Auto-stop after 10 seconds
            state.recordingTimeout = setTimeout(() => {
                if (state.mediaRecorder?.state === 'recording') {
                    state.mediaRecorder.stop();
                    state.isListening = false;
                    const micBtn = $id('va-mic');
                    const viz = $id('va-visualizer');
                    if (micBtn) micBtn.classList.remove('listening');
                    if (viz) viz.classList.remove('active');
                }
            }, 10000);

        } catch (err) {
            console.error('[VocalIA] Microphone access denied:', err.message);
            state.isListening = false;
            const micBtn = $id('va-mic');
            if (micBtn) micBtn.classList.remove('listening');
        }
    }

    function stopFallbackRecording() {
        if (state.recordingTimeout) clearTimeout(state.recordingTimeout);
        if (state.mediaRecorder?.state === 'recording') {
            state.mediaRecorder.stop();
        }
        state.isListening = false;
    }

    function toggleListening() {
        if (state.sttMode === 'native' && state.recognition) {
            if (state.isListening) {
                state.recognition.stop();
            } else {
                state.recognition.start();
                state.isListening = true;
                const micBtn = $id('va-mic');
                const viz = $id('va-visualizer');
                if (micBtn) micBtn.classList.add('listening');
                if (viz) viz.classList.add('active');
                trackEvent('voice_input_started', { mode: 'native' });
            }
        } else if (state.sttMode === 'fallback') {
            if (state.isListening) {
                stopFallbackRecording();
                const micBtn = $id('va-mic');
                const viz = $id('va-visualizer');
                if (micBtn) micBtn.classList.remove('listening');
                if (viz) viz.classList.remove('active');
            } else {
                startFallbackRecording();
                const micBtn = $id('va-mic');
                const viz = $id('va-visualizer');
                if (micBtn) micBtn.classList.add('listening');
                if (viz) viz.classList.add('active');
                trackEvent('voice_input_started', { mode: 'fallback' });
            }
        }
    }

    // ============================================================
    // A2UI RENDERER — Agent-to-UI dynamic components
    // ============================================================

    // Sanitize A2UI HTML — whitelist-based to prevent XSS from backend
    function sanitizeA2UIHtml(html) {
        const allowed = /^(div|span|button|p|h[1-6]|ul|ol|li|img|svg|path|line|circle|label|input|select|option|strong|em|br|a)$/i;
        const allowedAttrs = /^(class|id|style|data-[a-z-]+|aria-[a-z]+|role|type|placeholder|value|src|alt|href|viewBox|d|fill|stroke|stroke-width|stroke-linecap|stroke-linejoin|xmlns|width|height|x1|y1|x2|y2|cx|cy|r|loading|dir|disabled)$/i;
        const temp = document.createElement('div');
        temp.innerHTML = html;
        const walk = (node) => {
            const children = Array.from(node.childNodes);
            for (const child of children) {
                if (child.nodeType === 3) continue;
                if (child.nodeType !== 1) { child.remove(); continue; }
                if (!allowed.test(child.tagName)) { child.remove(); continue; }
                for (const attr of Array.from(child.attributes)) {
                    if (!allowedAttrs.test(attr.name)) child.removeAttribute(attr.name);
                }
                for (const attr of Array.from(child.attributes)) {
                    if (attr.name.startsWith('on')) child.removeAttribute(attr.name);
                }
                if (child.hasAttribute('href') && /^\s*javascript:/i.test(child.getAttribute('href'))) child.removeAttribute('href');
                if (child.hasAttribute('src') && /^\s*javascript:/i.test(child.getAttribute('src'))) child.removeAttribute('src');
                walk(child);
            }
        };
        walk(temp);
        return temp.innerHTML;
    }

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
        content.innerHTML = sanitizeA2UIHtml(a2ui.html);
        wrapper.appendChild(content);

        container.appendChild(wrapper);
        container.scrollTop = container.scrollHeight;

        // Attach action listeners for A2UI interactive elements
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

        // Slot selection — toggle selected class + enable confirm button
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

        // Close action — remove component
        if (action === 'close') {
            ctx.wrapper.remove();
            return;
        }

        // Actions that send to backend: confirm_booking, submit_lead, checkout
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
                    widget_type: 'B2B'
                })
            });
            const result = await resp.json();
            if (result.message) {
                addMessage(result.message, 'assistant');
            }
        } catch (e) {
            console.warn('[VocalIA B2B] A2UI action failed:', e.message);
        }
    }

    // ============================================================
    // CORE LOGIC & API
    // ============================================================

    async function sendMessage(text, inputMethod = 'text') {
        if (!text?.trim()) return;

        addMessage(text, 'user');
        const input = $id('va-input');
        if (input) input.value = '';

        trackEvent('message_sent', { input_method: inputMethod, length: text.length });

        // BOOKING FLOW INTERCEPT — handle inline booking before API call
        const booking = state.conversationContext.bookingFlow;
        if (booking.active) {
            const typingId = showTypingIndicator();
            const bookingResponse = await handleBookingFlow(text);
            removeTypingIndicator(typingId);

            if (booking.step === 'submitting') {
                const submitTypingId = showTypingIndicator();
                const confirmResult = await processBookingConfirmation();
                removeTypingIndicator(submitTypingId);
                if (confirmResult) addMessage(confirmResult, 'assistant');
            } else if (bookingResponse) {
                addMessage(bookingResponse, 'assistant');
            }
            return;
        }

        // Detect booking intent and start inline flow (if booking is enabled AND plan allows it)
        const planAllowsBooking = !state.planFeatures || state.planFeatures.booking !== false;
        if (state.bookingConfig.enabled && planAllowsBooking && isBookingIntent(text)) {
            showBookingCTA();
            // Still send to API for contextual response
        }

        // Show typing indicator
        const typingId = showTypingIndicator();

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT);

            const payload = {
                message: text,
                language: state.currentLang,
                sessionId: state.sessionId,
                tenant_id: state.tenantId,
                api_key: CONFIG.api_key || undefined,
                widget_type: 'B2B',
                history: state.conversationHistory.slice(-6)
            };
            // Session 250.147: Send page context on first message for contextual responses
            if (state.conversationHistory.length <= 2) {
                payload.page_context = getPageContext();
            }
            const response = await fetch(CONFIG.VOICE_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify(payload)
            });

            clearTimeout(timeout);
            removeTypingIndicator(typingId);

            const data = await response.json();
            if (data.response) {
                // Session 250.146: Update plan features from /respond (authoritative per-request)
                if (data.features) {
                    state.planFeatures = data.features;
                }
                addMessage(data.response, 'assistant');
                // Render A2UI component if backend sent one (booking, lead_form, etc.)
                if (data.a2ui) {
                    renderA2UIComponent(data.a2ui);
                }
                // Render catalog/service cards if backend returned them
                if (data.catalog && data.catalog.items && data.catalog.items.length > 0) {
                    renderServiceCards(data.catalog.items, data.catalog.title);
                }
            } else {
                addMessage(state.langData?.ui?.errorMessage || 'Désolé, une erreur s\'est produite.', 'assistant');
            }
        } catch (e) {
            removeTypingIndicator(typingId);
            const L = state.langData?.ui || {};
            if (e.name === 'AbortError') {
                addMessage(L.timeoutMessage || 'The request took too long. Please try again.', 'assistant');
            } else {
                addMessage(L.connectionError || L.errorMessage || 'Sorry, I\'m experiencing a connection issue.', 'assistant');
            }
            console.error('[VocalIA] API error:', e);
        }
    }

    function showTypingIndicator() {
        const container = $id('va-messages');
        if (!container) return null;

        const id = `typing-${Date.now()}`;
        const div = document.createElement('div');
        div.id = id;
        div.className = 'va-message assistant';
        div.innerHTML = `<div class="va-message-content" style="display:flex;gap:4px;padding:14px 18px;">
            <span style="width:8px;height:8px;background:var(--va-accent);border-radius:50%;animation:vaTyping 1s infinite;"></span>
            <span style="width:8px;height:8px;background:var(--va-accent);border-radius:50%;animation:vaTyping 1s infinite 0.2s;"></span>
            <span style="width:8px;height:8px;background:var(--va-accent);border-radius:50%;animation:vaTyping 1s infinite 0.4s;"></span>
        </div>
        <style>@keyframes vaTyping { 0%, 60%, 100% { transform: translateY(0); opacity: 0.5; } 30% { transform: translateY(-4px); opacity: 1; } }</style>`;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
        return id;
    }

    function removeTypingIndicator(id) {
        if (!id) return;
        const el = $id(id);
        if (el) el.remove();
    }

    // ============================================================
    // EXIT INTENT (Lead Magnet)
    // ============================================================

    function initExitIntent() {
        if (!CONFIG.EXIT_INTENT_ENABLED) return;

        // Check cooldown
        const lastShown = localStorage.getItem('vocalia_exit_intent');
        if (lastShown && Date.now() - parseInt(lastShown) < CONFIG.EXIT_INTENT_COOLDOWN) return;

        // Desktop: mouse leave detection
        document.addEventListener('mouseout', (e) => {
            if (e.clientY <= 10 && !state.exitIntent.triggered && !state.isOpen) {
                const timeSinceLoad = Date.now() - state.exitIntent.pageLoadTime;
                if (timeSinceLoad > CONFIG.EXIT_INTENT_DELAY) {
                    triggerExitIntent();
                }
            }
        });

        // Mobile: scroll up detection
        let lastScrollY = window.scrollY;
        window.addEventListener('scroll', () => {
            const currentY = window.scrollY;
            const scrollingUp = currentY < lastScrollY;
            const scrollRatio = (lastScrollY - currentY) / window.innerHeight;

            if (scrollingUp && scrollRatio > 0.3 && !state.exitIntent.triggered && !state.isOpen) {
                const timeSinceLoad = Date.now() - state.exitIntent.pageLoadTime;
                if (timeSinceLoad > CONFIG.EXIT_INTENT_DELAY) {
                    triggerExitIntent();
                }
            }
            lastScrollY = currentY;
        }, { passive: true });
    }

    function triggerExitIntent() {
        state.exitIntent.triggered = true;
        localStorage.setItem('vocalia_exit_intent', Date.now().toString());

        // Open widget with special message
        if (!state.isOpen) {
            togglePanel();
            setTimeout(() => {
                const L = state.langData;
                const exitMsg = L.ui.exitIntentMessage || 'Attendez ! Avez-vous des questions avant de partir ?';
                addMessage(exitMsg, 'assistant');
                // Session 250.146: Show booking CTA if plan allows booking
                const planAllowsBooking = !state.planFeatures || state.planFeatures.booking !== false;
                if (state.bookingConfig.enabled && planAllowsBooking) {
                    setTimeout(() => showBookingCTA(), 800);
                }
            }, 500);
        }

        trackEvent('exit_intent_triggered');
    }

    // ============================================================
    // SOCIAL PROOF (Real data from backend)
    // ============================================================

    async function initSocialProof() {
        if (!CONFIG.SOCIAL_PROOF_ENABLED) return;

        try {
            const url = `${CONFIG.SOCIAL_PROOF_API_URL}?lang=${state.currentLang}`;
            const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
            const data = await response.json();

            if (data.success && Array.isArray(data.messages) && data.messages.length > 0) {
                state.socialProof.messages = data.messages;
            } else {
                // No real data available - don't show fake notifications
                return;
            }
        } catch (e) {
            console.warn('[VocalIA B2B] Social proof fetch failed, skipping:', e.message);
            return;
        }

        // Start notification cycle only if we have real messages
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

        console.log('[VocalIA B2B] Social proof initialized with', state.socialProof.messages.length, 'messages');
    }

    function showSocialProofNotification() {
        if (state.isOpen) return;
        if (state.socialProof.messages.length === 0) return;

        const isRTL = state.currentLang === 'ar' || state.currentLang === 'ary';
        const proof = state.socialProof.messages[state.socialProof.notificationsShown % state.socialProof.messages.length];

        const notification = document.createElement('div');
        notification.className = 'va-b2b-social-proof';
        const notifId = `va-b2b-sp-${Date.now()}`;
        notification.id = notifId;

        // Build styles
        const style = document.createElement('style');
        style.textContent = `
            .va-b2b-social-proof {
                position: fixed; bottom: 100px; ${isRTL ? 'left' : 'right'}: 25px;
                max-width: 280px; background: linear-gradient(145deg, #1e2642, #191e35);
                border: 1px solid rgba(94, 106, 210, 0.25); border-radius: 12px;
                padding: 12px 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                z-index: 99997; font-family: Inter, -apple-system, sans-serif;
                animation: vaB2bSlideIn 0.4s ease, vaB2bFadeOut 0.3s ease ${CONFIG.SOCIAL_PROOF_DURATION - 300}ms forwards;
                ${isRTL ? 'direction: rtl;' : ''}
            }
            @keyframes vaB2bSlideIn {
                from { opacity: 0; transform: translateX(${isRTL ? '-' : ''}30px); }
                to { opacity: 1; transform: translateX(0); }
            }
            @keyframes vaB2bFadeOut { from { opacity: 1; } to { opacity: 0; } }
        `;
        notification.appendChild(style);

        // Build content safely with textContent (no innerHTML for dynamic data)
        const content = document.createElement('div');
        content.style.cssText = 'display:flex;align-items:center;gap:10px;';

        const iconDiv = document.createElement('div');
        iconDiv.style.cssText = 'width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#5E6AD2,#818cf8);display:flex;align-items:center;justify-content:center;flex-shrink:0;';
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('width', '18');
        svg.setAttribute('height', '18');
        svg.setAttribute('fill', 'white');
        const defaultIcon = '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>';
        const iconContent = proof.icon && /^<(?:path|circle|rect|line|polyline|polygon|ellipse|g)\s/.test(proof.icon.trim()) ? proof.icon : defaultIcon;
        svg.innerHTML = iconContent;
        iconDiv.appendChild(svg);

        const textWrap = document.createElement('div');
        const textEl = document.createElement('div');
        textEl.style.cssText = 'font-size:13px;color:rgba(255,255,255,0.9);line-height:1.4;';
        textEl.textContent = proof.text;
        const timeEl = document.createElement('div');
        timeEl.style.cssText = 'font-size:11px;color:rgba(94,106,210,0.7);margin-top:4px;';
        timeEl.textContent = proof.time || '';
        textWrap.appendChild(textEl);
        textWrap.appendChild(timeEl);

        content.appendChild(iconDiv);
        content.appendChild(textWrap);

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.style.cssText = 'position:absolute;top:6px;' + (isRTL ? 'left' : 'right') + ':6px;background:none;border:none;cursor:pointer;color:rgba(255,255,255,0.4);padding:2px;';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
        closeBtn.addEventListener('click', () => notification.remove());

        notification.appendChild(closeBtn);
        notification.appendChild(content);
        (shadowRoot || document.body).appendChild(notification);

        setTimeout(() => {
            const el = $id(notifId);
            if (el) el.remove();
        }, CONFIG.SOCIAL_PROOF_DURATION);

        state.socialProof.notificationsShown++;
        state.socialProof.lastShownTime = Date.now();
        trackEvent('social_proof_shown', { index: state.socialProof.notificationsShown });
    }

    // ============================================================
    // BOOKING INLINE SYSTEM (Inline calendar + conversational flow)
    // ============================================================

    function isBookingIntent(text) {
        const L = state.langData;
        if (L?.booking?.keywords) {
            return L.booking.keywords.some(kw => text.toLowerCase().includes(kw));
        }
        const keywords = {
            fr: ['rendez-vous', 'rdv', 'réserver', 'booking', 'prendre rdv', 'disponibilité', 'créneau', 'réservation'],
            en: ['appointment', 'book', 'booking', 'schedule', 'reserve', 'availability', 'slot'],
            es: ['cita', 'reservar', 'reserva', 'programar', 'disponibilidad', 'horario'],
            ar: ['موعد', 'حجز', 'احجز', 'متاح', 'وقت'],
            ary: ['موعد', 'حجز', 'نحجز', 'وقت', 'كريني', 'ردفو']
        };
        const langKeywords = keywords[state.currentLang] || keywords.fr;
        return langKeywords.some(kw => text.toLowerCase().includes(kw));
    }

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function getStaticSlots() {
        const now = new Date();
        const isArabic = state.currentLang === 'ar' || state.currentLang === 'ary';
        const locale = state.langData?.meta?.speechSynthesis || 'fr-FR';
        const slots = [];

        for (let d = 1; d <= 7; d++) {
            const date = new Date(now);
            date.setDate(now.getDate() + d);
            const day = date.getDay();
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

    async function fetchAvailableSlots() {
        const now = Date.now();
        if (state.availableSlotsCache.slots.length > 0 &&
            (now - state.availableSlotsCache.timestamp) < 300000) {
            return state.availableSlotsCache.slots;
        }

        // B2B uses booking URL API if available, otherwise static slots
        if (state.bookingConfig.url) {
            try {
                const response = await fetch(state.bookingConfig.url + (state.bookingConfig.url.includes('?') ? '&' : '?') + 'action=availability', {
                    method: 'GET',
                    mode: 'cors',
                    signal: AbortSignal.timeout(5000)
                });
                const result = await response.json();
                if (result.success && result.data?.slots) {
                    const locale = state.langData?.meta?.speechSynthesis || 'fr-FR';
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
                console.warn('[VocalIA B2B] Slots fetch error, using static:', error.message);
            }
        }

        const slots = getStaticSlots();
        state.availableSlotsCache = { slots, timestamp: now };
        return slots;
    }

    function getClientTimezone() {
        try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            return { iana: tz, offset: new Date().getTimezoneOffset() };
        } catch (e) {
            return { iana: null, offset: new Date().getTimezoneOffset() };
        }
    }

    async function submitBooking(data) {
        // Submit via voice API /respond with structured booking message
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT);

            const response = await fetch(CONFIG.VOICE_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    message: `[BOOKING] ${JSON.stringify(data)}`,
                    language: state.currentLang,
                    sessionId: state.sessionId,
                    tenant_id: state.tenantId,
                    widget_type: 'B2B',
                    booking_data: data,
                    history: state.conversationHistory.slice(-6)
                })
            });

            clearTimeout(timeout);
            const result = await response.json();
            return { success: !!result.response, message: result.response || 'Booking submitted' };
        } catch (error) {
            console.error('[VocalIA B2B] Booking submit error:', error);
            return { success: false, message: error.message };
        }
    }

    async function handleBookingFlow(userMessage) {
        const L = state.langData;
        if (!L?.booking) return null;

        const lower = userMessage.toLowerCase();
        const booking = state.conversationContext.bookingFlow;

        // Check for cancellation
        if (L.booking.cancelKeywords && L.booking.cancelKeywords.some(kw => lower.includes(kw))) {
            trackEvent('booking_cancelled', { step: booking.step });
            booking.active = false;
            booking.step = null;
            booking.data = { name: null, email: null, datetime: null, service: L.booking.service };
            return L.booking.messages.cancelled;
        }

        // Step: Name
        if (booking.step === 'name') {
            const name = userMessage.trim();
            if (name.length < 2) return L.booking.messages.askName;
            booking.data.name = name;
            booking.step = 'email';
            return L.booking.messages.askEmail.replace('{name}', name);
        }

        // Step: Email
        if (booking.step === 'email') {
            const email = userMessage.trim().toLowerCase();
            if (!isValidEmail(email)) return L.booking.messages.invalidEmail;
            booking.data.email = email;
            booking.step = 'datetime';

            const slots = await fetchAvailableSlots();
            if (slots.length === 0) return L.booking.messages.noSlots;

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
            if (L.booking.slotKeywords) {
                for (const [num, keywords] of Object.entries(L.booking.slotKeywords)) {
                    if (keywords.some(kw => lower.includes(kw))) {
                        selectedSlot = slots[parseInt(num) - 1];
                        break;
                    }
                }
            }

            if (selectedSlot) {
                booking.data.datetime = selectedSlot.iso;
                booking.step = 'confirm';
                trackEvent('booking_slot_selected', { slot_date: selectedSlot.date, slot_time: selectedSlot.time });

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
            if (L.booking.confirmKeywords && L.booking.confirmKeywords.some(kw => lower.includes(kw))) {
                booking.step = 'submitting';
                return null; // Triggers processBookingConfirmation
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
            service: booking.data.service || L.booking?.service || 'Consultation',
            notes: `Booking via B2B voice widget (${state.currentLang.toUpperCase()})`,
            timezone: clientTz.iana || `UTC${clientTz.offset > 0 ? '-' : '+'}${Math.abs(clientTz.offset / 60)}`
        });

        booking.active = false;
        booking.step = null;

        if (result.success) {
            trackEvent('booking_completed', { service: booking.data.service, datetime: booking.data.datetime });
            return L.booking?.messages?.success?.replace('{email}', booking.data.email) ||
                `Booking confirmed! Confirmation sent to ${booking.data.email}.`;
        } else {
            trackEvent('booking_failed', { error: result.message });
            return L.booking?.messages?.failure?.replace('{message}', result.message) ||
                'Sorry, the booking failed. Please try again.';
        }
    }

    function showBookingCTA() {
        if (!state.bookingConfig.enabled) return;

        const container = $id('va-messages');
        if (!container) return;

        const ctaDiv = document.createElement('div');
        ctaDiv.className = 'va-message assistant';
        const content = document.createElement('div');
        content.className = 'va-message-content';
        content.style.cssText = 'padding:12px 16px;';

        const labels = {
            fr: { inline: 'Réserver maintenant', online: 'Réserver en ligne', call: 'Appeler pour réserver' },
            en: { inline: 'Book now', online: 'Book online', call: 'Call to book' },
            es: { inline: 'Reservar ahora', online: 'Reservar en línea', call: 'Llamar para reservar' },
            ar: { inline: 'احجز الآن', online: 'احجز عبر الإنترنت', call: 'اتصل للحجز' },
            ary: { inline: 'احجز دابا', online: 'احجز أونلاين', call: 'عيط باش تحجز' }
        };
        const l = labels[state.currentLang] || labels.fr;

        const btnStyle = 'display:inline-block;padding:8px 16px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;margin:4px 4px 4px 0;transition:opacity 0.2s;cursor:pointer;';

        // Inline booking button (activates conversational booking flow)
        const inlineBtn = document.createElement('button');
        inlineBtn.type = 'button';
        inlineBtn.style.cssText = btnStyle + 'background:#5E6AD2;color:white;border:none;';
        inlineBtn.textContent = l.inline;
        inlineBtn.addEventListener('click', () => {
            startBookingFlow();
        });
        content.appendChild(inlineBtn);

        if (state.bookingConfig.url) {
            const bookLink = document.createElement('a');
            bookLink.href = state.bookingConfig.url;
            bookLink.target = '_blank';
            bookLink.rel = 'noopener noreferrer';
            bookLink.style.cssText = btnStyle + 'background:rgba(94,106,210,0.15);color:#818cf8;border:1px solid rgba(94,106,210,0.3);';
            bookLink.textContent = l.online;
            content.appendChild(bookLink);
        }

        if (state.bookingConfig.phone) {
            const phoneLink = document.createElement('a');
            phoneLink.href = `tel:${state.bookingConfig.phone}`;
            phoneLink.style.cssText = btnStyle + 'background:rgba(94,106,210,0.08);color:#a5b4fc;border:1px solid rgba(94,106,210,0.2);';
            phoneLink.textContent = l.call;
            content.appendChild(phoneLink);
        }

        ctaDiv.appendChild(content);
        container.appendChild(ctaDiv);
        container.scrollTop = container.scrollHeight;
        trackEvent('booking_cta_shown');
    }

    function startBookingFlow() {
        const L = state.langData;
        const booking = state.conversationContext.bookingFlow;
        booking.active = true;
        booking.step = 'name';
        booking.data = { name: null, email: null, datetime: null, service: L?.booking?.service || 'Consultation' };
        addMessage(L?.booking?.messages?.start || 'Let\'s book an appointment. What is your name?', 'assistant');
        trackEvent('booking_flow_started');
    }

    // ============================================================
    // INITIALIZATION
    // ============================================================

    async function init() {
        try {
            // Allow config override
            if (window.VOCALIA_CONFIG_INJECTED) {
                Object.assign(CONFIG, window.VOCALIA_CONFIG_INJECTED);
            }
            if (window.VOCALIA_CONFIG) {
                Object.assign(CONFIG, window.VOCALIA_CONFIG);
            }

            const lang = detectLanguage();
            await loadLanguage(lang);

            // Detect tenant ID
            const scriptTag = document.querySelector('script[data-vocalia-tenant]');
            if (scriptTag) state.tenantId = scriptTag.dataset.vocaliaTenant;
            else if (CONFIG.tenantId) state.tenantId = CONFIG.tenantId;

            captureAttribution();
            createWidget();
            initExitIntent();

            // Fetch tenant config for feature flags + booking data
            if (state.tenantId) {
                try {
                    const configResp = await fetch(`${CONFIG.CONFIG_API_URL}?tenantId=${encodeURIComponent(state.tenantId)}`, { signal: AbortSignal.timeout(5000) });
                    const configData = await configResp.json();
                    if (configData.success) {
                        // Session 250.146: Store plan-based features for client-side gating
                        if (configData.plan_features) {
                            state.planFeatures = configData.plan_features;
                        }
                        // Apply server feature flags (gate by plan)
                        if (configData.features) {
                            CONFIG.SOCIAL_PROOF_ENABLED = configData.features.social_proof_enabled !== false;
                            CONFIG.EXIT_INTENT_ENABLED = configData.features.exit_intent_enabled !== false;
                        }
                        // Gate booking by plan: booking requires plan_features.booking
                        if (configData.booking) {
                            state.bookingConfig.url = configData.booking.url || null;
                            state.bookingConfig.phone = configData.booking.phone || null;
                            const planAllowsBooking = state.planFeatures ? state.planFeatures.booking !== false : true;
                            state.bookingConfig.enabled = planAllowsBooking && configData.features?.booking_enabled && !!(configData.booking.url || configData.booking.phone);
                        }
                    }
                } catch (e) {
                    console.warn('[VocalIA B2B] Config fetch failed, using defaults:', e.message);
                }
            }

            initSocialProof();

            console.log(`[VocalIA B2B] Widget v2.7.0 initialized | Lang: ${state.currentLang} | Booking: ${state.bookingConfig.enabled} | PlanGating: ${!!state.planFeatures}`);
        } catch (error) {
            console.error('[VocalIA B2B] Init error:', error);
        }
    }

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
