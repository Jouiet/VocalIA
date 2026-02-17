/**
 * VocalIA - Global Localization Engine (Strict Market Rules)
 * Enforces the 6-Region Strategy:
 * 1. Maroc -> FR + MAD
 * 2. Europe (hors ES) + Maghreb -> FR + EUR
 * 3. Espagne -> ES + EUR
 * 4. MENA (Gulf) -> AR + USD
 * 5. Amérique Latine / Hispanique -> ES + USD
 * 6. International -> EN + USD
 */

const MARKET_RULES = {
    // 1. MAROC
    MA: {
        id: 'maroc',
        lang: 'fr',
        currency: 'MAD',
        symbol: 'DH',
        label: 'Maroc'
    },

    // 2. EUROPE & MAGHREB (hors Espagne)
    // Strict Rule: Français + EUR
    DZ: { id: 'maghreb', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Maghreb' },
    TN: { id: 'maghreb', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Maghreb' },
    FR: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    BE: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    CH: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    LU: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    DE: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    IT: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    PT: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    NL: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    AT: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    GR: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    FI: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    SE: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    DK: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    PL: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    CZ: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    HU: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    RO: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    BG: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    HR: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    SI: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    SK: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    EE: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    LV: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    LT: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    CY: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    MT: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    IE: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    IS: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    NO: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    GB: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    MC: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },

    // 3. ESPAGNE -> Espagnol + EUR (marché hispanique en Europe)
    ES: { id: 'hispanic_eu', lang: 'es', currency: 'EUR', symbol: '€', label: 'Espagne' },

    // 4. MENA (Gulf) -> Arabe + USD
    SA: { id: 'mena', lang: 'ar', currency: 'USD', symbol: '$', label: 'MENA' },
    AE: { id: 'mena', lang: 'ar', currency: 'USD', symbol: '$', label: 'MENA' },
    QA: { id: 'mena', lang: 'ar', currency: 'USD', symbol: '$', label: 'MENA' },
    KW: { id: 'mena', lang: 'ar', currency: 'USD', symbol: '$', label: 'MENA' },
    BH: { id: 'mena', lang: 'ar', currency: 'USD', symbol: '$', label: 'MENA' },
    OM: { id: 'mena', lang: 'ar', currency: 'USD', symbol: '$', label: 'MENA' },
    EG: { id: 'mena', lang: 'ar', currency: 'USD', symbol: '$', label: 'MENA' },
    JO: { id: 'mena', lang: 'ar', currency: 'USD', symbol: '$', label: 'MENA' },
    LB: { id: 'mena', lang: 'ar', currency: 'USD', symbol: '$', label: 'MENA' },
    IQ: { id: 'mena', lang: 'ar', currency: 'USD', symbol: '$', label: 'MENA' },
    LY: { id: 'mena', lang: 'ar', currency: 'USD', symbol: '$', label: 'MENA' },
    SD: { id: 'mena', lang: 'ar', currency: 'USD', symbol: '$', label: 'MENA' },
    SY: { id: 'mena', lang: 'ar', currency: 'USD', symbol: '$', label: 'MENA' },
    YE: { id: 'mena', lang: 'ar', currency: 'USD', symbol: '$', label: 'MENA' },

    // 5. AMÉRIQUE LATINE / HISPANIQUE -> Espagnol + USD
    MX: { id: 'hispanic', lang: 'es', currency: 'USD', symbol: '$', label: 'Hispanique' },
    CO: { id: 'hispanic', lang: 'es', currency: 'USD', symbol: '$', label: 'Hispanique' },
    AR: { id: 'hispanic', lang: 'es', currency: 'USD', symbol: '$', label: 'Hispanique' },
    CL: { id: 'hispanic', lang: 'es', currency: 'USD', symbol: '$', label: 'Hispanique' },
    PE: { id: 'hispanic', lang: 'es', currency: 'USD', symbol: '$', label: 'Hispanique' },
    VE: { id: 'hispanic', lang: 'es', currency: 'USD', symbol: '$', label: 'Hispanique' },
    EC: { id: 'hispanic', lang: 'es', currency: 'USD', symbol: '$', label: 'Hispanique' },
    GT: { id: 'hispanic', lang: 'es', currency: 'USD', symbol: '$', label: 'Hispanique' },
    CU: { id: 'hispanic', lang: 'es', currency: 'USD', symbol: '$', label: 'Hispanique' },
    DO: { id: 'hispanic', lang: 'es', currency: 'USD', symbol: '$', label: 'Hispanique' },
    HN: { id: 'hispanic', lang: 'es', currency: 'USD', symbol: '$', label: 'Hispanique' },
    SV: { id: 'hispanic', lang: 'es', currency: 'USD', symbol: '$', label: 'Hispanique' },
    NI: { id: 'hispanic', lang: 'es', currency: 'USD', symbol: '$', label: 'Hispanique' },
    CR: { id: 'hispanic', lang: 'es', currency: 'USD', symbol: '$', label: 'Hispanique' },
    PA: { id: 'hispanic', lang: 'es', currency: 'USD', symbol: '$', label: 'Hispanique' },
    UY: { id: 'hispanic', lang: 'es', currency: 'USD', symbol: '$', label: 'Hispanique' },
    PY: { id: 'hispanic', lang: 'es', currency: 'USD', symbol: '$', label: 'Hispanique' },
    BO: { id: 'hispanic', lang: 'es', currency: 'USD', symbol: '$', label: 'Hispanique' },
    GQ: { id: 'hispanic', lang: 'es', currency: 'USD', symbol: '$', label: 'Hispanique' },

    // 6. Defaults (International)
    DEFAULT_INTL: { id: 'intl', lang: 'en', currency: 'USD', symbol: '$', label: 'International' }
};

// Pricing strategies (Free Widget, Telephony Pricing)
// Telephony: Base price for Starter/Pro plans
const PRICING_TABLE = {
    MAD: { starter: 490, pro: 990, ecom: 990, expert_clone: 1490, telephony: 1990, overage: 1.00 },
    EUR: { starter: 49, pro: 99, ecom: 99, expert_clone: 149, telephony: 199, overage: 0.10 },
    USD: { starter: 49, pro: 99, ecom: 99, expert_clone: 149, telephony: 199, overage: 0.10 }
};

class GlobalLocalization {
    /**
     * Detect country via IP API or Timezone Fallback
     */
    static async detectCountry() {
        // 1. Try URL override for testing (?test_country=MA)
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const testCountry = params.get('test_country');
            if (testCountry && MARKET_RULES[testCountry.toUpperCase()]) {
                return testCountry.toUpperCase();
            }
        }

        // 2. Try IP API
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);

            const response = await fetch('https://ipapi.co/json/', { signal: controller.signal });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                return data.country_code || 'US';
            }
        } catch (e) {
            console.warn('[GlobalLocalization] IP detection failed, using fallback');
        }

        // 3. Timezone Fallback
        try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const tzMap = {
                'Africa/Casablanca': 'MA',
                'Europe/Paris': 'FR',
                'Europe/London': 'GB',
                'America/New_York': 'US',
                'Asia/Dubai': 'AE'
            };
            // Simple lookup or default to US
            for (const [key, val] of Object.entries(tzMap)) {
                if (tz.includes(key)) return val;
            }
            return 'US';
        } catch {
            return 'US';
        }
    }

    /**
     * Get Market Configuration for a Country Code
     */
    static getMarketConfig(countryCode) {
        const code = countryCode ? countryCode.toUpperCase() : 'US';
        return MARKET_RULES[code] || MARKET_RULES.DEFAULT_INTL;
    }

    /**
     * Initialize Localization
     * Returns complete config object
     */
    static async init() {
        let countryCode = 'US';

        // Check localStorage cache (24h)
        if (typeof localStorage !== 'undefined') {
            let stored = null;
            try { stored = localStorage.getItem('vocal_geo_cache'); } catch (e) { /* Safari private mode / Firefox SecurityError */ }
            if (stored) {
                try {
                    const cache = JSON.parse(stored);
                    const age = Date.now() - (cache.timestamp || 0);
                    if (age < 86400000) { // 24h
                        countryCode = cache.countryCode;
                    } else {
                        countryCode = await this.detectCountry();
                    }
                } catch {
                    countryCode = await this.detectCountry();
                }
            } else {
                countryCode = await this.detectCountry();
            }

            // Update cache
            try {
                localStorage.setItem('vocal_geo_cache', JSON.stringify({
                    countryCode,
                    timestamp: Date.now()
                }));
            } catch (e) { /* Safari private mode */ }
        }

        const config = this.getMarketConfig(countryCode);
        const pricing = PRICING_TABLE[config.currency] || PRICING_TABLE.USD;

        return {
            countryCode,
            ...config,
            pricing
        };
    }

    /**
     * Format price
     */
    static formatPrice(amount, currency) {
        const config = Object.values(MARKET_RULES).find(r => r.currency === currency) || MARKET_RULES.DEFAULT_INTL;
        if (currency === 'MAD') return `${amount} ${config.symbol}`;
        return `${config.symbol}${amount}`;
    }
}

// Export for ES Modules and Browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GlobalLocalization, MARKET_RULES, PRICING_TABLE };
}
if (typeof window !== 'undefined') {
    window.GlobalLocalization = GlobalLocalization;
}
