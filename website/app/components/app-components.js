/**
 * VocalIA App Component Loader
 * Loads reusable sidebar/header components for the authenticated app
 *
 * Usage:
 * <div data-app-component="sidebar"></div>
 * <script src="/app/components/app-components.js" defer></script>
 */

(function() {
  'use strict';

  var COMPONENTS = {
    'sidebar': '/app/components/sidebar.html',
    'admin-sidebar': '/app/components/admin-sidebar.html',
    'nlp-operator': '/app/components/nlp-operator.html'
  };

  var cache = {};

  async function loadComponent(name) {
    if (cache[name]) return cache[name];

    var url = COMPONENTS[name];
    if (!url) {
      console.warn('[AppComponents] Unknown component: ' + name);
      return '';
    }

    try {
      var response = await fetch(url);
      if (!response.ok) throw new Error('HTTP ' + response.status);
      var html = await response.text();
      cache[name] = html;
      return html;
    } catch (error) {
      console.error('[AppComponents] Failed to load ' + name + ':', error.message);
      return '';
    }
  }

  async function initComponents() {
    var elements = document.querySelectorAll('[data-app-component]');
    if (elements.length === 0) return;

    var promises = Array.from(elements).map(async function(el) {
      var name = el.dataset.appComponent;
      var html = await loadComponent(name);

      if (html) {
        var temp = document.createElement('div');
        temp.innerHTML = html;

        // Extract scripts (innerHTML doesn't execute them)
        var scripts = Array.from(temp.querySelectorAll('script'));
        scripts.forEach(function(s) { s.remove(); });

        // Replace placeholder with component HTML
        el.outerHTML = temp.innerHTML;

        // Execute scripts by creating fresh elements
        scripts.forEach(function(oldScript) {
          var newScript = document.createElement('script');
          if (oldScript.src) {
            newScript.src = oldScript.src;
          } else {
            newScript.textContent = oldScript.textContent;
          }
          document.body.appendChild(newScript);
        });
      }
    });

    await Promise.all(promises);

    // Session 250.218: Auto-inject NLP Operator (floating chat panel)
    try {
      var nlpHtml = await loadComponent('nlp-operator');
      if (nlpHtml) {
        var nlpContainer = document.createElement('div');
        nlpContainer.id = 'nlp-operator-container';
        nlpContainer.innerHTML = nlpHtml;
        var nlpScripts = Array.from(nlpContainer.querySelectorAll('script'));
        nlpScripts.forEach(function(s) { s.remove(); });
        document.body.appendChild(nlpContainer);
        nlpScripts.forEach(function(oldScript) {
          var newScript = document.createElement('script');
          newScript.textContent = oldScript.textContent;
          document.body.appendChild(newScript);
        });
      }
    } catch (e) {
      console.warn('[AppComponents] NLP Operator load skipped:', e.message);
    }

    // Re-init Lucide icons
    if (window.lucide) window.lucide.createIcons();

    // Re-apply i18n if available
    if (window.applyTranslations) window.applyTranslations();

    document.dispatchEvent(new CustomEvent('app-components:loaded'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initComponents);
  } else {
    initComponents();
  }

  window.VocalIAAppComponents = { load: loadComponent, init: initComponents };
})();
