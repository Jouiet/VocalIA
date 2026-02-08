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

    // XSS protection — escapes tenant-provided content before innerHTML
    function escapeHTML(str) {
      if (!str) return '';
      return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }
    function escapeAttr(str) {
      if (!str) return '';
      return String(str).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

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
                tenantId: options.tenantId || this._detectTenantId(),
                template: 'generic',
                customQuestions: null,
                lang: 'fr',
                voiceEnabled: true,
                onComplete: null,
                onLeadCapture: null,
                apiBaseUrl: (typeof window !== 'undefined' && window.VOCALIA_CONFIG && window.VOCALIA_CONFIG.api_url)
                  || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                    ? 'http://localhost:3013' : 'https://api.vocalia.ma'),
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

        _detectTenantId() {
            if (typeof window !== 'undefined' && window.VOCALIA_CONFIG && window.VOCALIA_CONFIG.tenant_id) {
                return window.VOCALIA_CONFIG.tenant_id;
            }
            const widget = typeof document !== 'undefined' && document.querySelector('[data-vocalia-tenant]');
            return widget ? widget.dataset.vocaliaTenant : null;
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
              <span>${escapeHTML(this._t(this.title || { fr: 'Quiz Produit', en: 'Product Quiz' }))}</span>
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
        <div class="va-quiz-question">${escapeHTML(this._t(question.question))}</div>
        <div class="va-quiz-options">
          ${(question.options || []).map(opt => `
            <button class="va-quiz-option ${this.answers[question.id] === opt.value ? 'va-quiz-selected' : ''}" data-value="${escapeAttr(opt.value)}">
              <span class="va-quiz-option-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </span>
              <span>${escapeHTML(this._t(opt.label))}</span>
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
            // RGPD: Only track if analytics consent given
            if (window.VOCALIA_CONFIG && window.VOCALIA_CONFIG.analytics_consent === false) return;
            try { if (localStorage.getItem('va_consent') === 'denied') return; } catch {}

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
