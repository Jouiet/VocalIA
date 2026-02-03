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
      background: linear-gradient(135deg, #191E35 0%, #0F1225 100%);
      border-bottom: 1px solid rgba(79, 186, 241, 0.3);
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
      color: #4FBAF1;
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
      background: linear-gradient(90deg, #4FBAF1 0%, #10B981 100%);
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
        container.style.borderTop = '1px solid rgba(79, 186, 241, 0.3)';
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
