/**
 * VocalIA Site Initialization - CSP Compliant
 * Session 250.44 - Replaces ALL inline scripts
 *
 * This file MUST be loaded synchronously (no defer) to ensure:
 * 1. Plausible analytics queue is available immediately
 * 2. Mobile menu works on page load
 * 3. Lucide icons are initialized
 */

(function() {
  'use strict';

  // ============================================
  // 1. PLAUSIBLE ANALYTICS QUEUE (before script loads)
  // ============================================
  window.plausible = window.plausible || function() {
    (window.plausible.q = window.plausible.q || []).push(arguments);
  };

  // ============================================
  // 2. MOBILE MENU TOGGLE
  // ============================================
  function initMobileMenu() {
    const btn = document.getElementById('mobileMenuBtn');
    const menu = document.getElementById('mobileMenu');
    const iconOpen = document.getElementById('menuIconOpen');
    const iconClose = document.getElementById('menuIconClose');

    if (!btn || !menu) return;

    function openMenu() {
      menu.classList.remove('translate-x-full', 'invisible', 'opacity-0', 'pointer-events-none');
      menu.classList.add('translate-x-0', 'opacity-100', 'pointer-events-auto');
      menu.setAttribute('aria-hidden', 'false');
      btn.setAttribute('aria-expanded', 'true');
      if (iconOpen) iconOpen.classList.add('hidden');
      if (iconClose) iconClose.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }

    function closeMenu() {
      menu.classList.remove('translate-x-0', 'opacity-100', 'pointer-events-auto');
      menu.classList.add('translate-x-full', 'invisible', 'opacity-0', 'pointer-events-none');
      menu.setAttribute('aria-hidden', 'true');
      btn.setAttribute('aria-expanded', 'false');
      if (iconOpen) iconOpen.classList.remove('hidden');
      if (iconClose) iconClose.classList.add('hidden');
      document.body.style.overflow = '';
    }

    btn.addEventListener('click', function() {
      const isOpen = menu.classList.contains('translate-x-0') || !menu.classList.contains('translate-x-full');
      isOpen ? closeMenu() : openMenu();
    });

    // Close on link click
    menu.querySelectorAll('a').forEach(function(link) {
      link.addEventListener('click', closeMenu);
    });

    // Close on Escape
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && !menu.classList.contains('translate-x-full')) {
        closeMenu();
      }
    });

    // Close on backdrop click
    menu.addEventListener('click', function(e) {
      if (e.target === menu) {
        closeMenu();
      }
    });
  }

  // ============================================
  // 3. LUCIDE ICONS INITIALIZATION
  // ============================================
  function initLucide() {
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
      lucide.createIcons();
    }
  }

  // ============================================
  // 4. I18N INITIALIZATION (if available)
  // ============================================
  async function initI18n() {
    if (typeof window.VocaliaGeo === 'undefined' || typeof window.VocaliaI18n === 'undefined') {
      return;
    }

    try {
      const geo = await window.VocaliaGeo.getGeo();
      await window.VocaliaI18n.initI18n(geo.lang);

      const currentLangEl = document.getElementById('currentLang');
      if (currentLangEl) {
        const LANG_LABELS = { fr: 'FR', en: 'EN', es: 'ES', ar: 'AR', ary: 'دارجة' };
        const locale = window.VocaliaI18n.getLocale();
        currentLangEl.textContent = LANG_LABELS[locale] || locale.toUpperCase();
      }

      window.VocaliaI18n.translatePage();
    } catch (e) {
      console.error('[site-init] i18n init failed:', e);
    }
  }

  // ============================================
  // 5. SCROLL PROGRESS INDICATOR
  // ============================================
  function initScrollProgress() {
    const scrollProgress = document.getElementById('scrollProgress');
    if (!scrollProgress) return;

    window.addEventListener('scroll', function() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      scrollProgress.style.width = progress + '%';
    });
  }

  // ============================================
  // INITIALIZATION
  // ============================================
  function init() {
    initMobileMenu();
    initLucide();
    initScrollProgress();
    initI18n();

    // Re-init Lucide after a delay for dynamically loaded content
    setTimeout(initLucide, 100);
    setTimeout(initLucide, 500);
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Also run on window load for late-loading scripts
  window.addEventListener('load', function() {
    initLucide();
  });

  // Export for external use
  window.VocaliaSiteInit = {
    initMobileMenu: initMobileMenu,
    initLucide: initLucide,
    initI18n: initI18n
  };

})();
