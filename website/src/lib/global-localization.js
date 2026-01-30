/**
 * VocalIA - Global Localization Engine (Strict Market Rules)
 * Enforces the 4-Region Strategy:
 * 1. Maroc -> FR + MAD
 * 2. Europe/Maghreb -> FR + EUR
 * 3. MENA (Gulf) -> EN + USD
 * 4. International -> EN + USD
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

    // 2. EUROPE & MAGHREB (neighbors)
    // Strict Rule: Français + EUR
    DZ: { id: 'maghreb', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Maghreb' },
    TN: { id: 'maghreb', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Maghreb' },
    FR: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    BE: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    CH: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    LU: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    DE: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    IT: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    ES: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    PT: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },
    NL: { id: 'europe', lang: 'fr', currency: 'EUR', symbol: '€', label: 'Europe' },

    // 3. MENA (Gulf)
    // Strict Rule: English + USD
    AE: { id: 'mena', lang: 'en', currency: 'USD', symbol: '$', label: 'MENA' },
    SA: { id: 'mena', lang: 'en', currency: 'USD', symbol: '$', label: 'MENA' },
    QA: { id: 'mena', lang: 'en', currency: 'USD', symbol: '$', label: 'MENA' },
    KW: { id: 'mena', lang: 'en', currency: 'USD', symbol: '$', label: 'MENA' },
    BH: { id: 'mena', lang: 'en', currency: 'USD', symbol: '$', label: 'MENA' },
    OM: { id: 'mena', lang: 'en', currency: 'USD', symbol: '$', label: 'MENA' },
    EG: { id: 'mena', lang: 'en', currency: 'USD', symbol: '$', label: 'MENA' },
    JO: { id: 'mena', lang: 'en', currency: 'USD', symbol: '$', label: 'MENA' },
    LB: { id: 'mena', lang: 'en', currency: 'USD', symbol: '$', label: 'MENA' },
    IQ: { id: 'mena', lang: 'en', currency: 'USD', symbol: '$', label: 'MENA' },

    // Defaults
    DEFAULT_INTL: { id: 'intl', lang: 'en', currency: 'USD', symbol: '$', label: 'International' }
};

// Pricing strategies (Free Widget, Telephony Pricing)
// Telephony: Base price for Starter/Pro plans
const PRICING_TABLE = {
    MAD: { starter: 499, pro: 1499, overage: 0.60 },
    EUR: { starter: 49, pro: 149, overage: 0.06 },
    USD: { starter: 49, pro: 149, overage: 0.06 }
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
                console.log(`[GlobalLocalization] Using URL override: ${testCountry}`);
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
            const stored = localStorage.getItem('vocal_geo_cache');
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
            localStorage.setItem('vocal_geo_cache', JSON.stringify({
                countryCode,
                timestamp: Date.now()
            }));
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
