/**
 * VocalIA - Internationalization Module
 * Simple i18n without dependencies
 */

let currentLocale = 'fr';
let translations = {};

/**
 * Load translations for a locale
 * @param {string} locale - Locale code (fr, en)
 * @returns {Promise<Object>} Translations
 */
async function loadTranslations(locale) {
  if (translations[locale]) {
    return translations[locale];
  }

  try {
    const response = await fetch(`/src/locales/${locale}.json`);
    if (!response.ok) throw new Error(`Failed to load ${locale} translations`);
    translations[locale] = await response.json();
    return translations[locale];
  } catch (e) {
    console.error(`[i18n] Failed to load ${locale}:`, e);
    // Fallback to French
    if (locale !== 'fr') {
      return loadTranslations('fr');
    }
    return {};
  }
}

/**
 * Get nested translation by dot notation key
 * @param {string} key - Dot notation key (e.g., "hero.title")
 * @param {Object} data - Translations object
 * @returns {string} Translated string or key if not found
 */
function getNestedValue(key, data) {
  return key.split('.').reduce((obj, k) => (obj && obj[k] !== undefined) ? obj[k] : null, data);
}

/**
 * Translate a key
 * @param {string} key - Translation key
 * @param {Object} params - Optional interpolation params
 * @returns {string} Translated string
 */
function t(key, params = {}) {
  const trans = translations[currentLocale];
  if (!trans) return key;

  let value = getNestedValue(key, trans);
  if (!value) return key;

  // Simple interpolation: {{param}}
  Object.keys(params).forEach(param => {
    value = value.replace(new RegExp(`{{${param}}}`, 'g'), params[param]);
  });

  return value;
}

/**
 * Set current locale
 * @param {string} locale - Locale code
 */
async function setLocale(locale) {
  if (!['fr', 'en'].includes(locale)) {
    console.warn(`[i18n] Unsupported locale: ${locale}, falling back to fr`);
    locale = 'fr';
  }

  await loadTranslations(locale);
  currentLocale = locale;
  document.documentElement.lang = locale;
  localStorage.setItem('vocalia_lang', locale);

  // Dispatch event for UI updates
  window.dispatchEvent(new CustomEvent('localeChanged', { detail: { locale } }));

  return locale;
}

/**
 * Get current locale
 * @returns {string} Current locale
 */
function getLocale() {
  return currentLocale;
}

/**
 * Initialize i18n with geo-detected or stored locale
 * @param {string} geoLang - Geo-detected language
 * @returns {Promise<string>} Active locale
 */
async function initI18n(geoLang) {
  // Priority: URL param > localStorage > geo detection > default
  const urlParams = new URLSearchParams(window.location.search);
  const urlLang = urlParams.get('lang');
  const storedLang = localStorage.getItem('vocalia_lang');

  const locale = urlLang || storedLang || geoLang || 'fr';
  await setLocale(locale);

  return locale;
}

/**
 * Translate all elements with data-i18n attribute
 * Supports data-i18n-params for interpolation
 */
function translatePage() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    // Parse params from data-i18n-params attribute
    let params = {};
    const paramsAttr = el.getAttribute('data-i18n-params');
    if (paramsAttr) {
      try {
        params = JSON.parse(paramsAttr);
      } catch (e) {
        console.warn(`[i18n] Invalid params JSON for key ${key}:`, e);
      }
    }
    const translated = t(key, params);
    if (translated !== key) {
      el.textContent = translated;
    }
  });

  // Handle placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    let params = {};
    const paramsAttr = el.getAttribute('data-i18n-params');
    if (paramsAttr) {
      try {
        params = JSON.parse(paramsAttr);
      } catch (e) {
        console.warn(`[i18n] Invalid params JSON for placeholder ${key}:`, e);
      }
    }
    const translated = t(key, params);
    if (translated !== key) {
      el.placeholder = translated;
    }
  });

  // Handle titles
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    let params = {};
    const paramsAttr = el.getAttribute('data-i18n-params');
    if (paramsAttr) {
      try {
        params = JSON.parse(paramsAttr);
      } catch (e) {
        console.warn(`[i18n] Invalid params JSON for title ${key}:`, e);
      }
    }
    const translated = t(key, params);
    if (translated !== key) {
      el.title = translated;
    }
  });
}

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { loadTranslations, t, setLocale, getLocale, initI18n, translatePage };
}

// Export for browser
if (typeof window !== 'undefined') {
  window.VocaliaI18n = { loadTranslations, t, setLocale, getLocale, initI18n, translatePage };
}
