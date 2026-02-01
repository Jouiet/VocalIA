/**
 * VocalIA Homepage Specific Scripts - CSP Compliant
 * Session 250.44
 *
 * Contains all scripts specific to index.html that were previously inline.
 */

(function() {
  'use strict';

  // ============================================
  // 1. LANGUAGE DROPDOWN (Homepage specific with langBtn ID)
  // ============================================
  function initLangDropdown() {
    const langBtn = document.getElementById('langBtn');
    const langDropdown = document.getElementById('langDropdown');

    if (!langBtn || !langDropdown) return;

    langBtn.addEventListener('click', () => langDropdown.classList.toggle('hidden'));

    document.addEventListener('click', (e) => {
      if (!langBtn.contains(e.target) && !langDropdown.contains(e.target)) {
        langDropdown.classList.add('hidden');
      }
    });
  }

  // ============================================
  // 2. SWITCH LANGUAGE (Global function)
  // ============================================
  const LANG_LABELS = {
    fr: 'FR',
    en: 'EN',
    es: 'ES',
    ar: 'AR',
    ary: 'دارجة'
  };

  async function switchLang(lang) {
    if (typeof VocaliaI18n === 'undefined') return;

    await VocaliaI18n.setLocale(lang);
    const currentLangEl = document.getElementById('currentLang');
    if (currentLangEl) {
      currentLangEl.textContent = LANG_LABELS[lang] || lang.toUpperCase();
    }

    const langDropdown = document.getElementById('langDropdown');
    if (langDropdown) langDropdown.classList.add('hidden');

    VocaliaI18n.translatePage();
    localStorage.setItem('vocalia_lang', lang);
  }

  // ============================================
  // 3. MOBILE MENU TOGGLE
  // ============================================
  function initMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    const menuIconOpen = document.getElementById('menuIconOpen');
    const menuIconClose = document.getElementById('menuIconClose');

    if (!mobileMenuBtn || !mobileMenu) return;

    function openMobileMenu() {
      mobileMenu.classList.remove('translate-x-full', 'invisible', 'opacity-0', 'pointer-events-none');
      mobileMenu.classList.add('translate-x-0', 'opacity-100', 'pointer-events-auto');
      mobileMenu.setAttribute('aria-hidden', 'false');
      mobileMenuBtn.setAttribute('aria-expanded', 'true');
      if (menuIconOpen) menuIconOpen.classList.add('hidden');
      if (menuIconClose) menuIconClose.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }

    function closeMobileMenu() {
      mobileMenu.classList.remove('translate-x-0', 'opacity-100', 'pointer-events-auto');
      mobileMenu.classList.add('translate-x-full', 'invisible', 'opacity-0', 'pointer-events-none');
      mobileMenu.setAttribute('aria-hidden', 'true');
      mobileMenuBtn.setAttribute('aria-expanded', 'false');
      if (menuIconOpen) menuIconOpen.classList.remove('hidden');
      if (menuIconClose) menuIconClose.classList.add('hidden');
      document.body.style.overflow = '';
    }

    mobileMenuBtn.addEventListener('click', () => {
      const isOpen = mobileMenu.classList.contains('translate-x-0');
      isOpen ? closeMobileMenu() : openMobileMenu();
    });

    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', closeMobileMenu);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileMenu.classList.contains('translate-x-0')) {
        closeMobileMenu();
      }
    });

    mobileMenu.addEventListener('click', (e) => {
      if (e.target === mobileMenu) {
        closeMobileMenu();
      }
    });
  }

  // ============================================
  // 4. DEMO MODAL
  // ============================================
  function initDemoModal() {
    const modal = document.getElementById('demoModal');
    const backdrop = document.getElementById('modalBackdrop');
    const panel = document.getElementById('modalPanel');

    if (!modal) return;

    window.openDemoModal = function() {
      modal.classList.remove('hidden');
      setTimeout(() => {
        if (backdrop) backdrop.classList.remove('opacity-0');
        if (panel) {
          panel.classList.remove('opacity-0', 'scale-95');
          panel.classList.add('opacity-100', 'scale-100');
        }
      }, 10);
    };

    window.closeDemoModal = function() {
      if (backdrop) backdrop.classList.remove('opacity-100');
      if (panel) {
        panel.classList.remove('opacity-100', 'scale-100');
        panel.classList.add('opacity-0', 'scale-95');
      }
      setTimeout(() => {
        modal.classList.add('hidden');
      }, 300);
    };

    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target === backdrop) {
        window.closeDemoModal();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
        window.closeDemoModal();
      }
    });
  }

  // ============================================
  // 5. SCROLL PROGRESS INDICATOR
  // ============================================
  function initScrollProgress() {
    window.addEventListener('scroll', () => {
      const scrollProgress = document.getElementById('scrollProgress');
      if (scrollProgress) {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
        scrollProgress.style.width = progress + '%';
      }
    });
  }

  // ============================================
  // 6. VOICE VISUALIZERS (Lazy Load)
  // ============================================
  function initVisualizers() {
    if (typeof VoiceVisualizer === 'undefined') return;

    const visualizerConfigs = [
      { id: '#visualizer-wave', mode: 'wave', barCount: null },
      { id: '#visualizer-bars', mode: 'bars', barCount: 24 },
      { id: '#visualizer-orb', mode: 'orb', barCount: null },
      { id: '#visualizer-pulse', mode: 'pulse', barCount: null }
    ];

    const loadedVisualizers = new Map();

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const canvas = entry.target;
        const config = visualizerConfigs.find(c => document.querySelector(c.id) === canvas);

        if (entry.isIntersecting && config && !loadedVisualizers.has(config.id)) {
          const viz = new VoiceVisualizer(config.id, {
            mode: config.mode,
            primaryColor: '#5DADE2',
            secondaryColor: '#85C1E9',
            accentColor: '#5DADE2',
            glowColor: '#5DADE2',
            barCount: config.barCount || 32,
            animate: true
          });
          loadedVisualizers.set(config.id, viz);
          viz.start();
        } else if (!entry.isIntersecting && loadedVisualizers.has(config?.id)) {
          loadedVisualizers.get(config.id).stop();
        }
      });
    }, { threshold: 0.1 });

    visualizerConfigs.forEach(config => {
      const el = document.querySelector(config.id);
      if (el) observer.observe(el);
    });
  }

  // ============================================
  // 7. PWA SERVICE WORKER
  // ============================================
  function initPWA() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
      });
    }

    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      const installBtn = document.getElementById('pwaInstallBtn');
      if (installBtn) installBtn.classList.remove('hidden');
    });
  }

  // ============================================
  // 8. I18N INITIALIZATION
  // ============================================
  async function initI18n() {
    if (typeof VocaliaGeo === 'undefined' || typeof VocaliaI18n === 'undefined') return;

    try {
      const geo = await VocaliaGeo.getGeo();
      await VocaliaI18n.initI18n(geo.lang);

      const currentLangEl = document.getElementById('currentLang');
      if (currentLangEl) {
        currentLangEl.textContent = VocaliaI18n.getLocale().toUpperCase();
      }

      VocaliaI18n.translatePage();

      window.addEventListener('localeChanged', () => {
        VocaliaI18n.translatePage();
      });
    } catch (e) {
      console.error('[home-page] i18n init failed:', e);
    }
  }

  // ============================================
  // 9. LUCIDE ICONS
  // ============================================
  function initLucide() {
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
      lucide.createIcons();
    }
  }

  // ============================================
  // MAIN INITIALIZATION
  // ============================================
  function init() {
    initLangDropdown();
    initMobileMenu();
    initDemoModal();
    initScrollProgress();
    initPWA();
    initLucide();
  }

  // Export global functions
  window.switchLang = switchLang;
  window.openDemoModal = window.openDemoModal || function() {};
  window.closeDemoModal = window.closeDemoModal || function() {};

  // Run initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      init();
      initI18n();
      initVisualizers();
    });
  } else {
    init();
    initI18n();
    initVisualizers();
  }

  // Re-init Lucide on load for late-loaded content
  window.addEventListener('load', initLucide);

})();
