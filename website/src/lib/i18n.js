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
 * Supported locales
 * - fr: French (default)
 * - en: English
 * - es: Spanish
 * - ar: Arabic (MSA)
 * - ary: Darija (Moroccan Arabic)
 */
const SUPPORTED_LOCALES = ['fr', 'en', 'es', 'ar', 'ary'];

/**
 * RTL (Right-to-Left) locales
 */
const RTL_LOCALES = ['ar', 'ary'];

/**
 * Set current locale
 * @param {string} locale - Locale code
 */
async function setLocale(locale) {
  if (!SUPPORTED_LOCALES.includes(locale)) {
    console.warn(`[i18n] Unsupported locale: ${locale}, falling back to fr`);
    locale = 'fr';
  }

  await loadTranslations(locale);
  currentLocale = locale;
  document.documentElement.lang = locale;
  localStorage.setItem('vocalia_lang', locale);

  // Set text direction for RTL languages
  if (RTL_LOCALES.includes(locale)) {
    document.documentElement.dir = 'rtl';
    document.body.classList.add('rtl');
  } else {
    document.documentElement.dir = 'ltr';
    document.body.classList.remove('rtl');
  }

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
 * Geo-IP Mapping configuration
 */
const GEO_MAPPING = {
  'MA': { lang: 'fr', currency: 'MAD', symbol: 'DH' },
  'FR': { lang: 'fr', currency: 'EUR', symbol: '€' },
  'ES': { lang: 'es', currency: 'EUR', symbol: '€' },
  'SA': { lang: 'en', currency: 'USD', symbol: '$' },
  'AE': { lang: 'en', currency: 'USD', symbol: '$' },
  'QA': { lang: 'en', currency: 'USD', symbol: '$' },
  'US': { lang: 'en', currency: 'USD', symbol: '$' }
};

const DEFAULT_GEO = { lang: 'en', currency: 'USD', symbol: '$' };

/**
 * Detect user location and return suggested config
 * @returns {Promise<Object>} Geo config
 */
async function detectUserGeo() {
  try {
    const response = await fetch('https://ipapi.co/json/');
    if (!response.ok) throw new Error('Geo-IP service unavailable');
    const data = await response.json();
    const config = GEO_MAPPING[data.country_code] || DEFAULT_GEO;
    console.log(`[i18n] Detected location: ${data.country_name} (${data.country_code}). Using: ${config.lang}/${config.currency}`);
    return config;
  } catch (e) {
    console.warn('[i18n] Geo detection failed, using defaults:', e);
    return DEFAULT_GEO;
  }
}

/**
 * Get currency information for the active locale
 * @returns {Object} { currency: 'MAD', symbol: 'DH' }
 */
function getCurrencyInfo() {
  return {
    currency: localStorage.getItem('vocalia_currency') || 'USD',
    symbol: localStorage.getItem('vocalia_symbol') || '$'
  };
}

/**
 * Initialize i18n with geo-detected or stored locale
 * @returns {Promise<string>} Active locale
 */
async function initI18n() {
  // 1. Detect Geo (but don't override explicit choices yet)
  let geoConfig = DEFAULT_GEO;
  try {
    geoConfig = await detectUserGeo();
  } catch (e) {
    console.warn('[i18n] Initialization geo-detection fail:', e);
  }

  // Set defaults if not present
  if (!localStorage.getItem('vocalia_currency')) {
    localStorage.setItem('vocalia_currency', geoConfig.currency);
    localStorage.setItem('vocalia_symbol', geoConfig.symbol);
  }

  // 2. Priority: URL param > localStorage > geo detection > default
  const urlParams = new URLSearchParams(window.location.search);
  const urlLang = urlParams.get('lang');
  const storedLang = localStorage.getItem('vocalia_lang');

  const locale = urlLang || storedLang || geoConfig.lang || 'fr';
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
      // For <title> element, set document.title; for others set title attribute
      if (el.tagName === 'TITLE') {
        document.title = translated;
      } else {
        el.title = translated;
      }
    }
  });
}

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { loadTranslations, t, setLocale, getLocale, initI18n, translatePage, getCurrencyInfo };
}

// Export for browser
if (typeof window !== 'undefined') {
  window.VocaliaI18n = { loadTranslations, t, setLocale, getLocale, initI18n, translatePage, getCurrencyInfo };
}
