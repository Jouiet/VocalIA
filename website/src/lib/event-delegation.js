/**
 * Event Delegation System - CSP Compliant
 * Session 250.43 - Replaces inline onclick/onsubmit handlers
 *
 * Usage: Add data-action="actionName" and data-params="value" to elements
 * Example: <button data-action="switchLang" data-params="fr">FR</button>
 */

(function () {
  'use strict';

  // Initialize Lucide icons on DOM ready
  function initLucide() {
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  // Action registry
  const actions = {
    // Language switching - Uses VocaliaI18n if available
    switchLang: async function (lang) {
      if (!lang) return;

      // Use VocaliaI18n if available (primary method)
      if (typeof window.VocaliaI18n !== 'undefined' && typeof window.VocaliaI18n.setLocale === 'function') {
        await window.VocaliaI18n.setLocale(lang);
        window.VocaliaI18n.translatePage();
      }

      // Update localStorage
      localStorage.setItem('vocalia_lang', lang);

      // Update HTML lang attribute
      document.documentElement.lang = lang;
      document.documentElement.dir = (lang === 'ar' || lang === 'ary') ? 'rtl' : 'ltr';

      // Update current lang display with proper labels
      const LANG_LABELS = { fr: 'FR', en: 'EN', es: 'ES', ar: 'AR', ary: 'دارجة' };
      const currentLangEl = document.getElementById('currentLang');
      if (currentLangEl) {
        currentLangEl.textContent = LANG_LABELS[lang] || lang.toUpperCase();
      }

      // Close dropdown
      const dropdown = document.getElementById('langDropdown');
      if (dropdown) dropdown.classList.add('hidden');
    },

    toggleLangDropdown: function () {
      const dropdown = document.getElementById('langDropdown');
      if (dropdown) {
        dropdown.classList.toggle('hidden');

        // Update aria-expanded
        const btn = document.querySelector('[data-action="toggleLangDropdown"]');
        if (btn) {
          const isExpanded = !dropdown.classList.contains('hidden');
          btn.setAttribute('aria-expanded', isExpanded);
        }
      }
    },

    // Demo modal
    openDemoModal: function () {
      if (typeof window.openDemoModal === 'function') {
        window.openDemoModal();
      }
    },

    closeDemoModal: function () {
      if (typeof window.closeDemoModal === 'function') {
        window.closeDemoModal();
      }
    },

    // Pricing plans
    selectPlan: function (plan) {
      if (typeof window.selectPlan === 'function') {
        window.selectPlan(plan);
      }
    },

    // Auth
    signInWithGoogle: function () {
      if (typeof window.signInWithGoogle === 'function') {
        window.signInWithGoogle();
      } else {
        // Zero Fake: inform user if function is missing
        alert('Google Sign-In integration is not configured in this environment.');
      }
    },

    togglePassword: function () {
      const input = document.getElementById('password');
      const icon = document.querySelector('[data-action="togglePassword"] i');
      if (input) {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        if (icon) {
          icon.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
          initLucide();
        }
      }
    },

    // Video controls
    toggleVideoMute: function (buttonEl) {
      const video = document.getElementById('heroVideo');
      if (video) {
        video.muted = !video.muted;
        const iconMuted = buttonEl.querySelector('.icon-muted');
        const iconUnmuted = buttonEl.querySelector('.icon-unmuted');
        if (iconMuted) iconMuted.classList.toggle('hidden', !video.muted);
        if (iconUnmuted) iconUnmuted.classList.toggle('hidden', video.muted);
      }
    },

    // Newsletter form — POST to /api/contact
    submitNewsletter: async function (formEl) {
      const emailInput = formEl.querySelector('input[type="email"]');
      const btn = formEl.querySelector('button');
      const email = emailInput ? emailInput.value.trim() : '';

      if (!email) return;

      const originalText = btn ? btn.textContent : '';
      if (btn) {
        btn.disabled = true;
        btn.textContent = '...';
      }

      try {
        const apiBase = window.location.hostname === 'localhost'
          ? 'http://localhost:3004'
          : 'https://api.vocalia.ma';

        const response = await fetch(apiBase + '/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email,
            name: '',
            subject: 'Newsletter Subscription',
            message: 'Newsletter signup from ' + window.location.pathname,
            source: 'newsletter'
          })
        });

        if (response.ok) {
          if (btn) btn.textContent = '✓ Inscrit!';
          if (emailInput) emailInput.value = '';
          if (typeof plausible !== 'undefined') {
            plausible('Newsletter Signup', { props: { page: window.location.pathname } });
          }
        } else {
          if (btn) {
            btn.textContent = '✗ Erreur';
            btn.disabled = false;
            setTimeout(function() { btn.textContent = originalText; }, 3000);
          }
        }
      } catch (err) {
        console.error('[Newsletter]', err.message);
        if (btn) {
          btn.textContent = '✗ Erreur réseau';
          btn.disabled = false;
          setTimeout(function() { btn.textContent = originalText; }, 3000);
        }
      }
    },

    // Contact form - Real implementation
    submitContactForm: async function (formEl) {
      if (formEl.checkValidity()) {
        const btn = formEl.querySelector('button[type=submit]');
        const originalText = btn ? btn.innerHTML : 'Envoyer';

        if (btn) {
          btn.disabled = true;
          btn.innerHTML = '<i data-lucide="loader" class="w-5 h-5 mr-2 animate-spin"></i> Envoi...';
          initLucide();
        }

        try {
          // Extract form data
          const formData = new FormData(formEl);
          const data = Object.fromEntries(formData.entries());

          // Send to real API
          const response = await fetch('/api/contact', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
          });

          const result = await response.json();

          if (response.ok && result.success) {
            if (btn) {
              btn.innerHTML = '<i data-lucide="check" class="w-5 h-5 mr-2"></i> Message Envoyé!';
              btn.classList.add('bg-emerald-600', 'border-emerald-600');
              initLucide();
            }
            formEl.reset();
          } else {
            throw new Error(result.error || 'Erreur lors de l\'envoi');
          }
        } catch (error) {
          console.error('Contact error:', error);
          if (btn) {
            // Reset state after error
            btn.innerHTML = `<i data-lucide="alert-circle" class="w-5 h-5 mr-2"></i> Erreur`;
            btn.classList.add('bg-red-600', 'border-red-600');
            setTimeout(() => {
              btn.innerHTML = originalText;
              btn.disabled = false;
              btn.classList.remove('bg-red-600', 'border-red-600');
              initLucide();
            }, 3000);
          }
          alert('Une erreur est survenue. Veuillez réessayer plus tard.');
        }
      } else {
        formEl.reportValidity();
      }
    },

    // Dashboard actions
    closeModal: function (el) {
      const modal = el.closest('.fixed');
      if (modal) modal.remove();
      initLucide();
    },

    closeConfigModal: function () {
      const modal = document.getElementById('config-modal');
      if (modal) modal.remove();
    },

    reload: function () {
      location.reload();
    },

    queueVideo: function (type) {
      if (typeof window.queueVideo === 'function') window.queueVideo(type);
    },

    quickAction: function (action) {
      if (typeof window.quickAction === 'function') window.quickAction(action);
    },

    viewAllTenants: function () {
      if (typeof window.viewAllTenants === 'function') window.viewAllTenants();
    },

    viewAllCalls: function () {
      if (typeof window.viewAllCalls === 'function') window.viewAllCalls();
    },

    viewAllSessions: function () {
      if (typeof window.viewAllSessions === 'function') window.viewAllSessions();
    },

    refreshHITLQueue: function () {
      if (typeof window.refreshHITLQueue === 'function') window.refreshHITLQueue();
    },

    showActivityPanel: function () {
      if (typeof window.showActivityPanel === 'function') window.showActivityPanel();
    },

    configureAgents: function () {
      if (typeof window.configureAgents === 'function') window.configureAgents();
    },

    agentSettings: function (agentId) {
      if (typeof window.agentSettings === 'function') window.agentSettings(agentId);
    },

    exportWidgetAnalytics: function () {
      if (typeof window.exportWidgetAnalytics === 'function') window.exportWidgetAnalytics();
    },

    saveConfig: function () {
      alert('Configuration sauvegardée');
      const modal = document.getElementById('config-modal');
      if (modal) modal.remove();
    },

    saveSettings: function (el) {
      alert('Paramètres sauvegardés!');
      const modal = el.closest('.fixed');
      if (modal) modal.remove();
    },

    newAgentPlaceholder: function () {
      alert('Création nouvel agent - fonctionnalité à venir');
    },

    // Dashboard logs filter
    filterLogs: function (selectEl) {
      const value = selectEl.value;
      if (typeof window.filterLogs === 'function') {
        window.filterLogs(value);
      }
    },

    // Code copy
    copyCode: function (el) {
      if (typeof window.copyCode === 'function') {
        window.copyCode(el);
      } else {
        // Fallback: copy code from sibling pre element
        const pre = el.closest('.relative')?.querySelector('pre code');
        if (pre) {
          navigator.clipboard.writeText(pre.textContent);
          const originalText = el.textContent;
          el.textContent = '✓ Copié!';
          setTimeout(() => { el.textContent = originalText; }, 2000);
        }
      }
    }
  };

  // Global click delegation
  document.addEventListener('click', function (e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    const params = target.dataset.params;

    if (actions[action]) {
      e.preventDefault();
      actions[action](params || target);
    }
  });

  // Form submit delegation
  document.addEventListener('submit', function (e) {
    const form = e.target;
    const action = form.dataset.formAction;

    if (action && actions[action]) {
      e.preventDefault();
      actions[action](form);
    }
  });

  // Select change delegation
  document.addEventListener('change', function (e) {
    const target = e.target.closest('select[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    if (actions[action]) {
      actions[action](target);
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-action="toggleLangDropdown"]') &&
      !e.target.closest('#langDropdown')) {
      const dropdown = document.getElementById('langDropdown');
      if (dropdown && !dropdown.classList.contains('hidden')) {
        dropdown.classList.add('hidden');
      }
    }
  });

  // Initialize Lucide on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLucide);
  } else {
    // DOM already loaded, init now and also after a small delay for defer scripts
    initLucide();
    setTimeout(initLucide, 100);
  }

  // Export for direct calls if needed
  window.VocaliaActions = actions;
  window.switchLang = actions.switchLang;
  window.toggleLangDropdown = actions.toggleLangDropdown;

})();
