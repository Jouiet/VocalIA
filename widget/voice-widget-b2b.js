/**
 * VocalIA Voice Widget - B2B/Lead Gen Specialized Kernel
 * Version: 2.2.0 (B2B) | Session 250.91
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
        ECOMMERCE_MODE: false, // HARDCODED FALSE
        EXIT_INTENT_ENABLED: true,
        SOCIAL_PROOF_ENABLED: true,
        AI_MODE: true,

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
        availableSlotsCache: { slots: [], timestamp: 0 }
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
    // GA4 ANALYTICS
    // ============================================================

    function trackEvent(eventName, params = {}) {
        if (typeof gtag === 'function') {
            gtag('event', eventName, { ...params, agent_type: 'b2b_specialized' });
        }
    }

    // ============================================================
    // WIDGET UI - VocalIA Branding
    // ============================================================

    function createWidget() {
        if (document.getElementById('vocalia-widget')) return;

        const L = state.langData;
        const isRTL = L.meta.rtl;
        const position = isRTL ? 'left' : 'right';

        const widget = document.createElement('div');
        widget.id = 'vocalia-widget';
        widget.style.cssText = `position:fixed;bottom:30px;${position}:25px;z-index:99999;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;${isRTL ? 'direction:rtl;' : ''}`;
        widget.innerHTML = generateWidgetHTML(L, isRTL, position);
        document.body.appendChild(widget);

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
        }
        .va-trigger:hover { transform: scale(1.1); box-shadow: 0 6px 30px rgba(94, 106, 210, 0.6); }
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

        @media (max-width: 480px) {
          .va-panel { width: calc(100vw - 40px); ${position}: -5px; }
        }
      </style>

      <button class="va-trigger" id="va-trigger" aria-label="${L.ui.ariaOpenAssistant}">
        <img src="${CONFIG.LOGO_PATH}" alt="VocalIA" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22white%22><path d=%22M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z%22/><path d=%22M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z%22/></svg>'"/>
      </button>

      <div class="va-panel" id="va-panel">
        <div class="va-header">
          <div class="va-header-logo">
            <img src="${CONFIG.LOGO_PATH}" alt="VocalIA" onerror="this.style.display='none'"/>
          </div>
          <div class="va-header-text">
            <h3>${L.ui.headerTitle || 'VocalIA Assistant'}</h3>
            <p>${L.ui.headerSubtitleVoice || 'Expert IA'}</p>
          </div>
          <button class="va-close" id="va-close" aria-label="Fermer">✕</button>
        </div>

        <div class="va-visualizer" id="va-visualizer">
          ${Array.from({ length: 8 }, () => '<div class="va-visualizer-bar"></div>').join('')}
        </div>

        <div class="va-messages" id="va-messages"></div>

        <div class="va-input-area">
          <input type="text" class="va-input" id="va-input" placeholder="${L.ui.placeholder || 'Posez votre question...'}" autocomplete="off">
          ${hasSpeechRecognition ? `
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
        const trigger = document.getElementById('va-trigger');
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
        const trigger = document.getElementById('va-trigger');
        const closeBtn = document.getElementById('va-close');
        const sendBtn = document.getElementById('va-send');
        const input = document.getElementById('va-input');
        const micBtn = document.getElementById('va-mic');

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

        if (hasSpeechRecognition && micBtn) {
            initSpeechRecognition();
            micBtn.addEventListener('click', toggleListening);
        }

        trackEvent('widget_initialized', { language: state.currentLang });
    }

    function togglePanel() {
        state.isOpen = !state.isOpen;
        const panel = document.getElementById('va-panel');
        if (panel) {
            panel.classList.toggle('open', state.isOpen);
        }

        if (state.isOpen) {
            trackEvent('widget_opened');
            // Focus input when opened
            setTimeout(() => {
                const input = document.getElementById('va-input');
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
        const container = document.getElementById('va-messages');
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

    function speak(text) {
        if (!hasSpeechSynthesis) return;
        state.synthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = state.langData?.meta?.speechSynthesis || 'fr-FR';
        utterance.onstart = () => {
            const viz = document.getElementById('va-visualizer');
            if (viz) viz.classList.add('active');
        };
        utterance.onend = () => {
            const viz = document.getElementById('va-visualizer');
            if (viz) viz.classList.remove('active');
        };
        state.synthesis.speak(utterance);
    }

    function initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        state.recognition = new SpeechRecognition();
        state.recognition.lang = state.langData?.meta?.speechRecognition || 'fr-FR';
        state.recognition.continuous = false;
        state.recognition.interimResults = false;

        state.recognition.onresult = (e) => {
            const transcript = e.results[0][0].transcript;
            const input = document.getElementById('va-input');
            if (input) input.value = transcript;
            sendMessage(transcript, 'voice');
        };

        state.recognition.onend = () => {
            state.isListening = false;
            const micBtn = document.getElementById('va-mic');
            const viz = document.getElementById('va-visualizer');
            if (micBtn) micBtn.classList.remove('listening');
            if (viz) viz.classList.remove('active');
        };

        state.recognition.onerror = (e) => {
            console.warn('[VocalIA] Speech recognition error:', e.error);
            state.isListening = false;
            const micBtn = document.getElementById('va-mic');
            if (micBtn) micBtn.classList.remove('listening');
        };
    }

    function toggleListening() {
        if (!state.recognition) return;

        if (state.isListening) {
            state.recognition.stop();
        } else {
            state.recognition.start();
            state.isListening = true;
            const micBtn = document.getElementById('va-mic');
            const viz = document.getElementById('va-visualizer');
            if (micBtn) micBtn.classList.add('listening');
            if (viz) viz.classList.add('active');
            trackEvent('voice_input_started');
        }
    }

    // ============================================================
    // CORE LOGIC & API
    // ============================================================

    async function sendMessage(text, inputMethod = 'text') {
        if (!text?.trim()) return;

        addMessage(text, 'user');
        const input = document.getElementById('va-input');
        if (input) input.value = '';

        trackEvent('message_sent', { input_method: inputMethod, length: text.length });

        // Show typing indicator
        const typingId = showTypingIndicator();

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT);

            const response = await fetch(CONFIG.VOICE_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    message: text,
                    language: state.currentLang,
                    sessionId: state.sessionId,
                    tenantId: state.tenantId,
                    widget_type: 'B2B',
                    history: state.conversationHistory.slice(-6)
                })
            });

            clearTimeout(timeout);
            removeTypingIndicator(typingId);

            const data = await response.json();
            if (data.response) {
                addMessage(data.response, 'assistant');
                // Check if user had booking intent and show CTA
                if (state.bookingConfig.enabled && isBookingIntent(text)) {
                    showBookingCTA();
                }
            } else {
                addMessage(state.langData?.ui?.errorMessage || 'Désolé, une erreur s\'est produite.', 'assistant');
            }
        } catch (e) {
            removeTypingIndicator(typingId);
            if (e.name === 'AbortError') {
                addMessage('La requête a pris trop de temps. Veuillez réessayer.', 'assistant');
            } else {
                addMessage('Désolé, je rencontre un problème de connexion.', 'assistant');
            }
            console.error('[VocalIA] API error:', e);
        }
    }

    function showTypingIndicator() {
        const container = document.getElementById('va-messages');
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
        const el = document.getElementById(id);
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
        document.body.appendChild(notification);

        setTimeout(() => {
            const el = document.getElementById(notifId);
            if (el) el.remove();
        }, CONFIG.SOCIAL_PROOF_DURATION);

        state.socialProof.notificationsShown++;
        state.socialProof.lastShownTime = Date.now();
        trackEvent('social_proof_shown', { index: state.socialProof.notificationsShown });
    }

    // ============================================================
    // BOOKING REDIRECT (Real booking URL from backend config)
    // ============================================================

    function isBookingIntent(text) {
        const lower = text.toLowerCase();
        const keywords = {
            fr: ['rendez-vous', 'rdv', 'réserver', 'booking', 'prendre rdv', 'disponibilité', 'créneau', 'réservation'],
            en: ['appointment', 'book', 'booking', 'schedule', 'reserve', 'availability', 'slot'],
            es: ['cita', 'reservar', 'reserva', 'programar', 'disponibilidad', 'horario'],
            ar: ['موعد', 'حجز', 'احجز', 'متاح', 'وقت'],
            ary: ['موعد', 'حجز', 'نحجز', 'وقت', 'كريني', 'ردفو']
        };
        const langKeywords = keywords[state.currentLang] || keywords.fr;
        return langKeywords.some(kw => lower.includes(kw));
    }

    function showBookingCTA() {
        if (!state.bookingConfig.enabled) return;

        const container = document.getElementById('va-messages');
        if (!container) return;

        const ctaDiv = document.createElement('div');
        ctaDiv.className = 'va-message assistant';
        const content = document.createElement('div');
        content.className = 'va-message-content';
        content.style.cssText = 'padding:12px 16px;';

        const labels = {
            fr: { online: 'Réserver en ligne', call: 'Appeler pour réserver' },
            en: { online: 'Book online', call: 'Call to book' },
            es: { online: 'Reservar en línea', call: 'Llamar para reservar' },
            ar: { online: 'احجز عبر الإنترنت', call: 'اتصل للحجز' },
            ary: { online: 'احجز أونلاين', call: 'عيط باش تحجز' }
        };
        const l = labels[state.currentLang] || labels.fr;

        const btnStyle = 'display:inline-block;padding:8px 16px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;margin:4px 4px 4px 0;transition:opacity 0.2s;';

        if (state.bookingConfig.url) {
            const bookLink = document.createElement('a');
            bookLink.href = state.bookingConfig.url;
            bookLink.target = '_blank';
            bookLink.rel = 'noopener noreferrer';
            bookLink.style.cssText = btnStyle + 'background:#5E6AD2;color:white;';
            bookLink.textContent = l.online;
            content.appendChild(bookLink);
        }

        if (state.bookingConfig.phone) {
            const phoneLink = document.createElement('a');
            phoneLink.href = `tel:${state.bookingConfig.phone}`;
            phoneLink.style.cssText = btnStyle + 'background:rgba(94,106,210,0.15);color:#818cf8;border:1px solid rgba(94,106,210,0.3);';
            phoneLink.textContent = l.call;
            content.appendChild(phoneLink);
        }

        ctaDiv.appendChild(content);
        container.appendChild(ctaDiv);
        container.scrollTop = container.scrollHeight;
        trackEvent('booking_cta_shown');
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
                        // Apply server feature flags
                        if (configData.features) {
                            CONFIG.SOCIAL_PROOF_ENABLED = configData.features.social_proof_enabled !== false;
                            CONFIG.EXIT_INTENT_ENABLED = configData.features.exit_intent_enabled !== false;
                        }
                        // Store booking config
                        if (configData.booking) {
                            state.bookingConfig.url = configData.booking.url || null;
                            state.bookingConfig.phone = configData.booking.phone || null;
                            state.bookingConfig.enabled = configData.features?.booking_enabled && !!(configData.booking.url || configData.booking.phone);
                        }
                    }
                } catch (e) {
                    console.warn('[VocalIA B2B] Config fetch failed, using defaults:', e.message);
                }
            }

            initSocialProof();

            console.log(`[VocalIA B2B] Widget v2.2.0 initialized | Lang: ${state.currentLang} | Booking: ${state.bookingConfig.enabled}`);
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
