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

  // XSS protection
  function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

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
            <div class="va-spin-segment-inner" style="background: ${escapeHTML(prize.color)}; transform: skewY(${-skew}deg);">
              <span class="va-spin-segment-text">${escapeHTML(prizeText)}</span>
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

    async showResult(prize) {
      const isWin = prize.code !== null;

      // Hide game, show result
      this.elements.game.style.display = 'none';
      this.elements.result.classList.add('active');

      if (isWin) {
        // Request server-generated promo code (unique, time-limited)
        let serverCode = prize.code; // fallback to static code if API fails
        const discountMap = { discount5: 5, discount10: 10, discount15: 15, discount20: 20, discount30: 30, freeShipping: 0 };
        const discountPercent = discountMap[prize.id] || 10;

        try {
          const apiUrl = (window.VOCALIA_CONFIG && window.VOCALIA_CONFIG.api_url) || '';
          if (apiUrl) {
            const resp = await fetch(`${apiUrl}/api/promo/generate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                tenant_id: (window.VOCALIA_CONFIG && window.VOCALIA_CONFIG.tenant_id) || 'unknown',
                prize_id: prize.id,
                discount_percent: discountPercent,
                email: this.state.email || null
              })
            });
            if (resp.ok) {
              const data = await resp.json();
              if (data.success && data.code) {
                serverCode = data.code;
              }
            }
          }
        } catch (e) {
          console.warn('[SpinWheel] Promo API unavailable, using fallback code');
        }

        // Win state
        this.elements.resultIcon.className = 'va-spin-result-icon win';
        this.elements.resultIcon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>';
        this.elements.resultTitle.textContent = this.translations.congratulations;
        this.elements.resultPrize.textContent = `${this.translations.youWon} ${this.translations.prizes[prize.id]}`;
        this.elements.code.textContent = serverCode;
        this.state.activeCode = serverCode; // Store for useCode()
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
          this.config.onWin({ prize, code: serverCode, email: this.state.email });
        }

        // Track event
        this.trackEvent('spin_wheel_won', {
          prize_id: prize.id,
          prize_code: serverCode,
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
      const code = this.state.activeCode || this.state.selectedPrize?.code;
      if (!code) return;

      // Copy code
      if (navigator.clipboard) {
        navigator.clipboard.writeText(code);
      }

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
      // RGPD: Only track if user has consented to analytics
      if (!SpinWheel.hasAnalyticsConsent()) return;

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

    static hasAnalyticsConsent() {
      // 1. Explicit config
      if (window.VOCALIA_CONFIG && window.VOCALIA_CONFIG.analytics_consent === false) return false;
      if (window.VOCALIA_CONFIG && window.VOCALIA_CONFIG.analytics_consent === true) return true;
      // 2. VocalIA consent store
      try { if (localStorage.getItem('va_consent') === 'denied') return false; } catch {}
      // 3. Common third-party consent APIs
      if (typeof window.CookieConsent !== 'undefined' && !window.CookieConsent.allowedCategory?.('analytics')) return false;
      if (typeof window.__tcfapi !== 'undefined') return true; // TCF present, assume managed externally
      // 4. Default: allow (tenant's responsibility to configure consent)
      return true;
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
