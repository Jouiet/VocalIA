/**
 * VocalIA - Geo Detection & Currency Module (v250.80 - Sovereign)
 * Auto-detects user location and sets language/currency
 *
 * STRICT MARKET RULES (User Directive Session 250):
 * 1. Maroc -> Lang: Français | Devise: MAD
 * 2. Europe -> Lang: Français | Devise: Euro (€)
 * 3. MENA (Gulf) -> Lang: English | Devise: Dollar ($)
 * 4. International (Rest of World) -> Lang: English | Devise: Dollar ($)
 */

const GEO_CONFIG = {
  // 1. MAROC (Sovereign Market)
  MA: { lang: 'fr', currency: 'MAD', symbol: 'DH', locale: 'fr-MA', region: 'maroc' },

  // 2. EUROPE (Strict Directive: FR + EUR)
  // Focusing on major Eurozone. UK/CH fallback to Intl unless specified.
  FR: { lang: 'fr', currency: 'EUR', symbol: '€', locale: 'fr-FR', region: 'europe' },
  BE: { lang: 'fr', currency: 'EUR', symbol: '€', locale: 'fr-BE', region: 'europe' },
  LU: { lang: 'fr', currency: 'EUR', symbol: '€', locale: 'fr-LU', region: 'europe' },
  DE: { lang: 'fr', currency: 'EUR', symbol: '€', locale: 'fr-DE', region: 'europe' },
  IT: { lang: 'fr', currency: 'EUR', symbol: '€', locale: 'fr-IT', region: 'europe' },
  ES: { lang: 'es', currency: 'EUR', symbol: '€', locale: 'es-ES', region: 'europe' }, // Exception: Explicitly supported language
  PT: { lang: 'fr', currency: 'EUR', symbol: '€', locale: 'fr-PT', region: 'europe' },
  NL: { lang: 'fr', currency: 'EUR', symbol: '€', locale: 'fr-NL', region: 'europe' },

  // Maghreb (non-Maroc) -> Europe Zone Alignment (FR + EUR)
  DZ: { lang: 'fr', currency: 'EUR', symbol: '€', locale: 'fr-DZ', region: 'maghreb' },
  TN: { lang: 'fr', currency: 'EUR', symbol: '€', locale: 'fr-TN', region: 'maghreb' },

  // 3. MENA (Gulf) -> English + USD
  AE: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-AE', region: 'mena' }, // UAE
  SA: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-SA', region: 'mena' }, // Saudi
  QA: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-QA', region: 'mena' }, // Qatar
  KW: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-KW', region: 'mena' }, // Kuwait
  BH: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-BH', region: 'mena' }, // Bahrain
  OM: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-OM', region: 'mena' }, // Oman
  EG: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-EG', region: 'mena' },
  JO: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-JO', region: 'mena' },
  LB: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-LB', region: 'mena' },

  // 4. INTERNATIONAL (Default)
  US: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-US', region: 'intl' },
  GB: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-GB', region: 'intl' },
  CA: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-CA', region: 'intl' },
  AU: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-AU', region: 'intl' },
  CH: { lang: 'fr', currency: 'EUR', symbol: '€', locale: 'fr-CH', region: 'europe' }, // Forced to EUR/FR per "Europe" rule

  // DEFAULT FALLBACK
  DEFAULT: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-US', region: 'intl' }
};

const PRICING = {
  MAD: { b2b: 490, b2c: 790, ecom: 1490, telephony: 1990, overage: 0.60 },
  EUR: { b2b: 49, b2c: 79, ecom: 149, telephony: 199, overage: 0.06 },
  USD: { b2b: 49, b2c: 79, ecom: 149, telephony: 199, overage: 0.06 }
};

/**
 * Detect user's country from timezone or IP (Client-side)
 */
async function detectCountry() {
  // 1. URL Override (Testing & Forced Routing)
  const params = new URLSearchParams(window.location.search);
  const testCountry = params.get('force_country') || params.get('test_country');
  if (testCountry && GEO_CONFIG[testCountry.toUpperCase()]) {
    return testCountry.toUpperCase();
  }

  // 2. IP API with Aggressive Timeout (Performance First)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200); // 1.2s max wait

    // Using ipapi.co (Free Tier limits apply - consider fallback if high volume)
    const response = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return data.country_code || 'US';
    }
  } catch (e) {
    // Silent fail to timezone fallback
  }

  // 3. Timezone Heuristic Fallback (Zero Latency)
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Critical Markets Mapping
    if (tz.startsWith('Africa/Casablanca')) return 'MA';
    if (tz.startsWith('Europe/')) return 'FR'; // Default to Europe rules
    if (tz.startsWith('Asia/Dubai') || tz.startsWith('Asia/Riyadh')) return 'AE';
  } catch (e) { }

  return 'US'; // Default Global
}

function getGeoConfig(countryCode) {
  return GEO_CONFIG[countryCode] || GEO_CONFIG.DEFAULT;
}

function getPricing(currency) {
  return PRICING[currency] || PRICING.USD;
}

function formatPrice(amount, currency) {
  const config = Object.values(GEO_CONFIG).find(c => c.currency === currency) || GEO_CONFIG.DEFAULT;
  if (currency === 'MAD') return `${amount} ${config.symbol}`;
  return `${config.symbol}${amount}`;
}

async function initGeoDetection() {
  // Check cache (24h) to minimize API calls
  const stored = localStorage.getItem('vocalia_geo_v3');
  let countryCode = 'US';

  // Force refresh if config version changed (v2 -> v3)
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Valid for 24 hours
      if (Date.now() - parsed.timestamp < 86400000) {
        countryCode = parsed.country;
      } else {
        countryCode = await detectCountry();
      }
    } catch {
      countryCode = await detectCountry();
    }
  } else {
    countryCode = await detectCountry();
  }

  const config = getGeoConfig(countryCode);
  const pricing = getPricing(config.currency);

  localStorage.setItem('vocalia_geo_v3', JSON.stringify({
    country: countryCode,
    timestamp: Date.now(),
    ...config
  }));

  // ONLY set geo language if user hasn't manually chosen a language
  const userChosenLang = localStorage.getItem('vocalia_lang');
  if (!userChosenLang) {
    localStorage.setItem('vocalia_lang', config.lang);
  }

  return { country: countryCode, ...config, pricing };
}

async function getGeo() {
  return initGeoDetection();
}

// Browser Export
if (typeof window !== 'undefined') {
  window.VocaliaGeo = { detectCountry, getGeoConfig, getPricing, formatPrice, initGeoDetection, getGeo, GEO_CONFIG, PRICING };
}

