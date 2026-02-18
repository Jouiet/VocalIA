/**
 * VocalIA Dark Mode Init — loaded in <head> before CSS to prevent FOUC.
 * Reads localStorage and applies .dark class immediately.
 * Canonical key: 'vocalia_theme'. Legacy key: 'theme' (migrated on read).
 * Strategy: class-based (Tailwind v4 @custom-variant dark).
 */
(function() {
  var theme = localStorage.getItem('vocalia_theme') || localStorage.getItem('theme');
  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
})();
