/**
 * VocalIA Unified Component Loader
 * Loads reusable HTML components dynamically for ALL pages.
 *
 * Components are registered in two scopes:
 * - Public (marketing pages): header, footer, newsletter-cta
 * - App (authenticated pages): sidebar, admin-sidebar, nlp-operator
 *
 * Usage:
 *   <div data-component="header"></div>
 *   <div data-component="sidebar"></div>
 *   <script src="/src/lib/components.js" defer></script>
 *
 * Both data-component and data-app-component are supported (backwards compat).
 */

(function() {
  'use strict';

  var COMPONENTS = {
    // Public (marketing)
    'header': '/components/header.html',
    'footer': '/components/footer.html',
    'newsletter-cta': '/components/newsletter-cta.html',
    // App (authenticated)
    'sidebar': '/app/components/sidebar.html',
    'admin-sidebar': '/app/components/admin-sidebar.html',
    'nlp-operator': '/app/components/nlp-operator.html'
  };

  var cache = {};

  function loadComponent(name) {
    if (cache[name]) return Promise.resolve(cache[name]);

    var url = COMPONENTS[name];
    if (!url) {
      console.warn('[Components] Unknown component: ' + name);
      return Promise.resolve('');
    }

    return fetch(url).then(function(response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.text();
    }).then(function(html) {
      cache[name] = html;
      return html;
    }).catch(function(error) {
      console.error('[Components] Failed to load ' + name + ':', error.message);
      return '';
    });
  }

  function injectHTML(el, html) {
    var temp = document.createElement('div');
    temp.innerHTML = html;

    var scripts = Array.from(temp.querySelectorAll('script'));
    scripts.forEach(function(s) { s.remove(); });

    el.outerHTML = temp.innerHTML;

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

  function initComponents() {
    // Support both data-component and data-app-component (backwards compat)
    var elements = Array.from(document.querySelectorAll('[data-component], [data-app-component]'));
    if (elements.length === 0) return Promise.resolve();

    var promises = elements.map(function(el) {
      var name = el.dataset.component || el.dataset.appComponent;
      return loadComponent(name).then(function(html) {
        if (html) injectHTML(el, html);
      });
    });

    return Promise.all(promises).then(function() {
      // Auto-inject NLP Operator on app pages (sidebar = app page indicator)
      var isAppPage = document.getElementById('sidebar') !== null;

      if (isAppPage && !document.getElementById('nlp-operator-container')) {
        return loadComponent('nlp-operator').then(function(nlpHtml) {
          if (!nlpHtml) return;
          var container = document.createElement('div');
          container.id = 'nlp-operator-container';
          container.innerHTML = nlpHtml;
          var nlpScripts = Array.from(container.querySelectorAll('script'));
          nlpScripts.forEach(function(s) { s.remove(); });
          document.body.appendChild(container);
          nlpScripts.forEach(function(oldScript) {
            var newScript = document.createElement('script');
            newScript.textContent = oldScript.textContent;
            document.body.appendChild(newScript);
          });
        }).catch(function(e) {
          console.warn('[Components] NLP Operator load skipped:', e.message);
        });
      }
    }).then(function() {
      if (window.lucide) window.lucide.createIcons();
      if (window.applyTranslations) window.applyTranslations();

      document.dispatchEvent(new CustomEvent('components:loaded'));
      document.dispatchEvent(new CustomEvent('app-components:loaded'));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initComponents);
  } else {
    initComponents();
  }

  // Unified API (expose both names for backwards compat)
  var api = { load: loadComponent, init: initComponents };
  window.VocalIAComponents = api;
  window.VocalIAAppComponents = api;
})();
