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

  // RGPD: Check analytics consent before tracking
  function hasAnalyticsConsent() {
    if (window.VOCALIA_CONFIG && window.VOCALIA_CONFIG.analytics_consent === false) return false;
    try { if (localStorage.getItem('va_consent') === 'denied') return false; } catch {}
    return true;
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
        tenantId: options.tenantId || this._detectTenantId(),
        ...options
      };

      this.container = null;
      this.isVisible = false;
      this.autoCloseTimer = null;
      this.items = [];
    }

    _detectTenantId() {
      if (global.VOCALIA_CONFIG && global.VOCALIA_CONFIG.tenant_id) return global.VOCALIA_CONFIG.tenant_id;
      const widget = typeof document !== 'undefined' && (document.querySelector('[data-vocalia-tenant]') || document.querySelector('[data-tenant-id]'));
      return widget ? (widget.dataset.vocaliaTenant || widget.dataset.tenantId) : 'default';
    }

    /**
     * Inject CSS styles
     */
    _injectStyles(root) {
      if (root.querySelector('#va-reco-styles')) return;

      const style = document.createElement('style');
      style.id = 'va-reco-styles';
      style.textContent = CAROUSEL_CSS;
      root.appendChild(style);
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
      const price = item.price ? this._formatPrice(item.price, item.currency) : '';
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
    _formatPrice(price, currency) {
      const num = parseFloat(price);
      if (isNaN(num)) return price;

      // Use product currency, then tenant currency from VocalIA state, then default EUR
      const cur = currency || window.VocalIA?.cart?.currency || 'EUR';
      const symbols = { 'MAD': 'DH', 'EUR': '€', 'USD': '$', 'GBP': '£' };
      const symbol = symbols[cur] || cur;
      const formatted = num.toFixed(cur === 'MAD' ? 0 : 2);
      return (cur === 'EUR' || cur === 'USD' || cur === 'GBP') ? `${symbol}${formatted}` : `${formatted} ${symbol}`;
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

      // Create Shadow DOM host
      this.host = document.createElement('div');
      this.host.id = 'va-reco-host';
      this.host.style.cssText = 'position:fixed;inset:0;z-index:10003;pointer-events:none;';
      document.body.appendChild(this.host);
      this.shadowRoot = this.host.attachShadow({ mode: 'open' });
      this._injectStyles(this.shadowRoot);

      // Create and append inside shadow root
      this.container = this._createCarouselDOM(this.items, displayTitle);
      this.container.style.pointerEvents = 'auto';
      this.shadowRoot.appendChild(this.container);

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
          this.host?.remove();
          this.host = null;
          this.shadowRoot = null;
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
      if (!hasAnalyticsConsent()) return;
      if (typeof gtag === 'function') {
        gtag('event', 'reco_carousel_impression', {
          event_category: 'recommendations',
          recommendation_type: type,
          items_shown: count,
          tenant_id: this.options.tenantId
        });
      }
    }

    /**
     * Track click on item
     */
    _trackClick(item, index) {
      if (!hasAnalyticsConsent()) return;
      if (typeof gtag === 'function') {
        gtag('event', 'reco_carousel_click', {
          event_category: 'recommendations',
          product_id: item.id || item.productId,
          position: index + 1,
          reason: item.reason,
          tenant_id: this.options.tenantId
        });
      }
    }

    /**
     * Track view all click
     */
    _trackViewAll() {
      if (!hasAnalyticsConsent()) return;
      if (typeof gtag === 'function') {
        gtag('event', 'reco_carousel_view_all', {
          event_category: 'recommendations',
          items_shown: this.items.length,
          tenant_id: this.options.tenantId
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
