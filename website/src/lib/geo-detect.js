/**
 * VocalIA - Geo Detection & Currency Module (v246 - Strict Market Rules)
 * Auto-detects user location and sets language/currency
 *
 * STRICT MARKET RULES (Session 246):
 * 1. Maroc -> FR + MAD
 * 2. Europe/Maghreb -> FR + EUR
 * 3. MENA (Gulf) -> EN + USD
 * 4. International -> EN + USD
 */

const GEO_CONFIG = {
  // 1. MAROC
  MA: { lang: 'fr', currency: 'MAD', symbol: 'DH', locale: 'fr-MA', region: 'maroc' },

  // 2. EUROPE & MAGHREB (Strict: FR + EUR)
  DZ: { lang: 'fr', currency: 'EUR', symbol: '€', locale: 'fr-DZ', region: 'maghreb' },
  TN: { lang: 'fr', currency: 'EUR', symbol: '€', locale: 'fr-TN', region: 'maghreb' },
  FR: { lang: 'fr', currency: 'EUR', symbol: '€', locale: 'fr-FR', region: 'europe' },
  BE: { lang: 'fr', currency: 'EUR', symbol: '€', locale: 'fr-BE', region: 'europe' },
  CH: { lang: 'fr', currency: 'EUR', symbol: '€', locale: 'fr-CH', region: 'europe' },
  LU: { lang: 'fr', currency: 'EUR', symbol: '€', locale: 'fr-LU', region: 'europe' },
  DE: { lang: 'fr', currency: 'EUR', symbol: '€', locale: 'fr-DE', region: 'europe' },
  IT: { lang: 'fr', currency: 'EUR', symbol: '€', locale: 'fr-IT', region: 'europe' },
  ES: { lang: 'es', currency: 'EUR', symbol: '€', locale: 'es-ES', region: 'europe' }, // Spanish users get Spanish
  PT: { lang: 'fr', currency: 'EUR', symbol: '€', locale: 'fr-PT', region: 'europe' },
  NL: { lang: 'fr', currency: 'EUR', symbol: '€', locale: 'fr-NL', region: 'europe' },

  // 3. MENA (Gulf) - English + USD
  AE: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-AE', region: 'mena' },
  SA: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-SA', region: 'mena' },
  QA: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-QA', region: 'mena' },
  KW: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-KW', region: 'mena' },
  BH: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-BH', region: 'mena' },
  OM: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-OM', region: 'mena' },
  EG: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-EG', region: 'mena' },
  JO: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-JO', region: 'mena' },
  LB: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-LB', region: 'mena' },
  IQ: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-IQ', region: 'mena' },

  // 4. INTERNATIONAL
  US: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-US', region: 'intl' },
  GB: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-GB', region: 'intl' },
  CA: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-CA', region: 'intl' },
  AU: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-AU', region: 'intl' },

  // DEFAULT
  DEFAULT: { lang: 'en', currency: 'USD', symbol: '$', locale: 'en-US', region: 'intl' }
};

const PRICING = {
  MAD: { starter: 990, pro: 2990, overage: 0.60 },
  EUR: { starter: 99, pro: 299, overage: 0.06 },
  USD: { starter: 99, pro: 299, overage: 0.06 }
};

/**
 * Detect user's country from timezone or IP (Client-side)
 */
async function detectCountry() {
  // 1. URL Override (Testing)
  const params = new URLSearchParams(window.location.search);
  const testCountry = params.get('test_country');
  if (testCountry && GEO_CONFIG[testCountry.toUpperCase()]) {
    return testCountry.toUpperCase();
  }

  // 2. IP API with Timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);
    const response = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (response.ok) {
      const data = await response.json();
      return data.country_code || 'US';
    }
  } catch (e) {
    // console.warn('[VocaliaGeo] IP detection fallback');
  }

  // 3. Timezone Fallback
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tzMap = {
    'Africa/Casablanca': 'MA',
    'Europe/Paris': 'FR',
    'Europe/London': 'GB',
    'America/New_York': 'US',
    'Asia/Dubai': 'AE'
  };

  // Simple heuristic
  for (const [key, val] of Object.entries(tzMap)) {
    if (tz.includes(key)) return val;
  }
  return 'US';
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
  // Check cache (24h)
  const stored = localStorage.getItem('vocalia_geo_v2');
  let countryCode = 'US';

  if (stored) {
    try {
      const parsed = JSON.parse(stored);
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

  localStorage.setItem('vocalia_geo_v2', JSON.stringify({
    country: countryCode,
    timestamp: Date.now(),
    ...config
  }));

  // ONLY set geo language if user hasn't manually chosen a language
  // This preserves user's manual language choice across page navigation
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

