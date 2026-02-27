/**
 * VocalIA App Component Loader — Backwards Compatibility Shim
 *
 * This file now delegates to the unified component loader at /src/lib/components.js.
 * Both data-component and data-app-component are handled by the unified loader.
 *
 * App pages that reference this file will continue to work.
 * New pages should use: <script src="/src/lib/components.js" defer></script>
 */

(function() {
  'use strict';

  // If the unified loader is already loaded, do nothing
  if (window.VocalIAComponents) return;

  // Dynamically load the unified component loader
  var script = document.createElement('script');
  script.src = '/src/lib/components.js';
  document.head.appendChild(script);
})();
