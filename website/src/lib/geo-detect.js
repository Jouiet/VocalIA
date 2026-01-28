/**
 * VocalIA - Geo Detection & Currency Module
 * Auto-detects user location and sets language/currency
 *
 * Rules:
 * - Morocco → French + MAD
 * - Algeria, Tunisia, Europe → French + EUR
 * - Gulf/MENA (excl. above) → English + USD
 * - Others → English + USD
 */

const GEO_CONFIG = {
  // Morocco
  MA: { lang: 'fr', currency: 'MAD', symbol: 'DH', locale: 'fr-MA' },

  // Francophone + Euro
  FR: { lang: 'fr', currency: 'EUR', symbol: '€', locale: 'fr-FR' },
  BE: { lang: 'fr', currency: 'EUR', symbol: '€', locale: 'fr-BE' },
  CH: { lang: 'fr', currency: 'EUR', symbol: '€', locale: 'fr-CH' },
  LU: { lang: 'fr', currency: 'EUR', symbol: '€', locale: 'fr-LU' },
  DZ: { lang: 'fr', currency: 'EUR', symbol: '€', locale: 'fr-DZ' },
  TN: { lang: 'fr', currency: 'EUR', symbol: '€', locale: 'fr-TN' },

  // Euro zone (default to French for proximity)
  DE: { lang: 'fr', currency: 'EUR', symbol: '€', locale: 'de-DE' },
  ES: { lang: 'fr', currency: 'EUR', symbol: '€', locale: 'es-ES' },
  IT: { lang: 'fr', currency: 'EUR', symbol: '€', locale: 'it-IT' },
  PT: { lang: 'fr', currency: 'EUR', symbol: '€', locale: 'pt-PT' },
  NL: { lang: 'fr', currency: 'EUR', symbol: '€', locale: 'nl-NL' },
  AT: { lang: 'fr', currency: 'EUR', symbol: '€', locale: 'de-AT' },
  IE: { lang: 'en', currency: 'EUR', symbol: '€', locale: 'en-IE' },

  // Gulf/MENA (English + USD)
  AE: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-AE' },
  SA: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-SA' },
  QA: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-QA' },
  KW: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-KW' },
  BH: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-BH' },
  OM: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-OM' },
  EG: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-EG' },
  JO: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-JO' },
  LB: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-LB' },

  // English speaking
  US: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-US' },
  GB: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-GB' },
  CA: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-CA' },
  AU: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-AU' },

  // Default
  DEFAULT: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-US' }
};

// Pricing by currency (Widget is free, these are for Telephony)
const PRICING = {
  MAD: {
    starter: 499,
    pro: 1499,
    overage: 0.60  // per minute
  },
  EUR: {
    starter: 49,
    pro: 149,
    overage: 0.06
  },
  USD: {
    starter: 49,
    pro: 149,
    overage: 0.06
  }
};

/**
 * Detect user's country from timezone or IP
 * @returns {Promise<string>} ISO country code
 */
async function detectCountry() {
  // Method 1: Try IP geolocation API
  try {
    const response = await fetch('https://ipapi.co/json/', {
      signal: AbortSignal.timeout(2000)
    });
    if (response.ok) {
      const data = await response.json();
      return data.country_code || 'US';
    }
  } catch (e) {
    console.log('[GeoDetect] IP API failed, using timezone fallback');
  }

  // Method 2: Timezone-based detection
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tzCountryMap = {
    'Africa/Casablanca': 'MA',
    'Africa/Algiers': 'DZ',
    'Africa/Tunis': 'TN',
    'Europe/Paris': 'FR',
    'Europe/Brussels': 'BE',
    'Europe/Zurich': 'CH',
    'Europe/London': 'GB',
    'America/New_York': 'US',
    'America/Los_Angeles': 'US',
    'Asia/Dubai': 'AE',
    'Asia/Riyadh': 'SA'
  };

  return tzCountryMap[tz] || 'US';
}

/**
 * Get geo configuration for a country
 * @param {string} countryCode - ISO country code
 * @returns {Object} Configuration object
 */
function getGeoConfig(countryCode) {
  return GEO_CONFIG[countryCode] || GEO_CONFIG.DEFAULT;
}

/**
 * Get pricing for a currency
 * @param {string} currency - Currency code (MAD, EUR, USD)
 * @returns {Object} Pricing object
 */
function getPricing(currency) {
  return PRICING[currency] || PRICING.USD;
}

/**
 * Format price with currency symbol
 * @param {number} amount - Price amount
 * @param {string} currency - Currency code
 * @returns {string} Formatted price
 */
function formatPrice(amount, currency) {
  const config = Object.values(GEO_CONFIG).find(c => c.currency === currency) || GEO_CONFIG.DEFAULT;

  if (currency === 'MAD') {
    return `${amount} ${config.symbol}`;
  }
  return `${config.symbol}${amount}`;
}

/**
 * Initialize geo detection and apply to page
 * @returns {Promise<Object>} Geo config
 */
async function initGeoDetection() {
  const countryCode = await detectCountry();
  const config = getGeoConfig(countryCode);
  const pricing = getPricing(config.currency);

  // Store in localStorage for persistence
  localStorage.setItem('vocalia_geo', JSON.stringify({
    country: countryCode,
    ...config,
    pricing,
    detected: new Date().toISOString()
  }));

  return { country: countryCode, ...config, pricing };
}

/**
 * Get stored geo config or detect
 * @returns {Promise<Object>} Geo config
 */
async function getGeo() {
  const stored = localStorage.getItem('vocalia_geo');
  if (stored) {
    const parsed = JSON.parse(stored);
    // Refresh if older than 24h
    const age = Date.now() - new Date(parsed.detected).getTime();
    if (age < 24 * 60 * 60 * 1000) {
      return parsed;
    }
  }
  return initGeoDetection();
}

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { detectCountry, getGeoConfig, getPricing, formatPrice, initGeoDetection, getGeo, GEO_CONFIG, PRICING };
}

// Export for browser
if (typeof window !== 'undefined') {
  window.VocaliaGeo = { detectCountry, getGeoConfig, getPricing, formatPrice, initGeoDetection, getGeo, GEO_CONFIG, PRICING };
}
