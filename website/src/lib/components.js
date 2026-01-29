/**
 * VocalIA Component Loader
 * Loads reusable HTML components dynamically
 *
 * Usage:
 * <div data-component="newsletter-cta"></div>
 * <script src="/src/lib/components.js" defer></script>
 */

(function() {
  'use strict';

  const COMPONENTS = {
    'newsletter-cta': '/components/newsletter-cta.html',
    'footer': '/components/footer.html',
    'header': '/components/header.html'
  };

  // Cache for loaded components
  const cache = new Map();

  /**
   * Load a component HTML
   */
  async function loadComponent(name) {
    if (cache.has(name)) {
      return cache.get(name);
    }

    const url = COMPONENTS[name];
    if (!url) {
      console.warn(`[Components] Unknown component: ${name}`);
      return '';
    }

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      cache.set(name, html);
      return html;
    } catch (error) {
      console.error(`[Components] Failed to load ${name}:`, error.message);
      return '';
    }
  }

  /**
   * Initialize all components on the page
   */
  async function initComponents() {
    const elements = document.querySelectorAll('[data-component]');

    if (elements.length === 0) return;

    const loadPromises = Array.from(elements).map(async (el) => {
      const componentName = el.dataset.component;
      const html = await loadComponent(componentName);

      if (html) {
        // Replace placeholder with component
        el.outerHTML = html;
      }
    });

    await Promise.all(loadPromises);

    // Re-initialize Lucide icons if available
    if (window.lucide) {
      window.lucide.createIcons();
    }

    // Dispatch event for other scripts
    document.dispatchEvent(new CustomEvent('components:loaded'));
  }

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initComponents);
  } else {
    initComponents();
  }

  // Expose for manual use
  window.VocalIAComponents = {
    load: loadComponent,
    init: initComponents
  };
})();
