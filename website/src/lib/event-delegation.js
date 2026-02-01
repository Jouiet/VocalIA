/**
 * Event Delegation System - CSP Compliant
 * Session 250.43 - Replaces inline onclick/onsubmit handlers
 *
 * Usage: Add data-action="actionName" and data-params="value" to elements
 * Example: <button data-action="switchLang" data-params="fr">FR</button>
 */

(function() {
  'use strict';

  // Action registry
  const actions = {
    // Language switching
    switchLang: function(lang) {
      if (typeof window.switchLang === 'function') {
        window.switchLang(lang);
      }
    },

    toggleLangDropdown: function() {
      if (typeof window.toggleLangDropdown === 'function') {
        window.toggleLangDropdown();
      }
    },

    // Demo modal
    openDemoModal: function() {
      if (typeof window.openDemoModal === 'function') {
        window.openDemoModal();
      }
    },

    closeDemoModal: function() {
      if (typeof window.closeDemoModal === 'function') {
        window.closeDemoModal();
      }
    },

    // Pricing plans
    selectPlan: function(plan) {
      if (typeof window.selectPlan === 'function') {
        window.selectPlan(plan);
      }
    },

    // Auth
    signInWithGoogle: function() {
      if (typeof window.signInWithGoogle === 'function') {
        window.signInWithGoogle();
      }
    },

    togglePassword: function() {
      if (typeof window.togglePassword === 'function') {
        window.togglePassword();
      }
    },

    // Video controls
    toggleVideoMute: function(buttonEl) {
      const video = document.getElementById('heroVideo');
      if (video) {
        video.muted = !video.muted;
        const iconMuted = buttonEl.querySelector('.icon-muted');
        const iconUnmuted = buttonEl.querySelector('.icon-unmuted');
        if (iconMuted) iconMuted.classList.toggle('hidden', !video.muted);
        if (iconUnmuted) iconUnmuted.classList.toggle('hidden', video.muted);
      }
    },

    // Newsletter form
    submitNewsletter: function(formEl) {
      const btn = formEl.querySelector('button');
      if (btn) {
        btn.textContent = '✓ Inscrit!';
        btn.disabled = true;
      }
    },

    // Contact form
    submitContactForm: function(formEl) {
      if (formEl.checkValidity()) {
        const btn = formEl.querySelector('button[type=submit]');
        if (btn) {
          btn.innerHTML = '<i data-lucide="check" class="w-5 h-5 mr-2"></i> Message Envoyé!';
          btn.disabled = true;
          btn.classList.add('opacity-75');
          if (typeof lucide !== 'undefined') lucide.createIcons();
        }
      }
    },

    // Dashboard actions
    closeModal: function(el) {
      const modal = el.closest('.fixed');
      if (modal) modal.remove();
      if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    closeConfigModal: function() {
      const modal = document.getElementById('config-modal');
      if (modal) modal.remove();
    },

    reload: function() {
      location.reload();
    },

    queueVideo: function(type) {
      if (typeof window.queueVideo === 'function') window.queueVideo(type);
    },

    quickAction: function(action) {
      if (typeof window.quickAction === 'function') window.quickAction(action);
    },

    viewAllTenants: function() {
      if (typeof window.viewAllTenants === 'function') window.viewAllTenants();
    },

    viewAllCalls: function() {
      if (typeof window.viewAllCalls === 'function') window.viewAllCalls();
    },

    viewAllSessions: function() {
      if (typeof window.viewAllSessions === 'function') window.viewAllSessions();
    },

    refreshHITLQueue: function() {
      if (typeof window.refreshHITLQueue === 'function') window.refreshHITLQueue();
    },

    showActivityPanel: function() {
      if (typeof window.showActivityPanel === 'function') window.showActivityPanel();
    },

    configureAgents: function() {
      if (typeof window.configureAgents === 'function') window.configureAgents();
    },

    agentSettings: function(agentId) {
      if (typeof window.agentSettings === 'function') window.agentSettings(agentId);
    },

    exportWidgetAnalytics: function() {
      if (typeof window.exportWidgetAnalytics === 'function') window.exportWidgetAnalytics();
    },

    saveConfig: function() {
      alert('Configuration sauvegardée');
      const modal = document.getElementById('config-modal');
      if (modal) modal.remove();
    },

    saveSettings: function(el) {
      alert('Paramètres sauvegardés!');
      const modal = el.closest('.fixed');
      if (modal) modal.remove();
    },

    newAgentPlaceholder: function() {
      alert('Création nouvel agent - fonctionnalité à venir');
    },

    // Code copy
    copyCode: function(el) {
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
  document.addEventListener('click', function(e) {
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
  document.addEventListener('submit', function(e) {
    const form = e.target;
    const action = form.dataset.formAction;

    if (action && actions[action]) {
      e.preventDefault();
      actions[action](form);
    }
  });

  // Export for direct calls if needed
  window.VocaliaActions = actions;

})();
