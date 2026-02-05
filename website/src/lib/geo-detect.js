/**
 * VocalIA Sovereign Geo-Detection & Routing Engine
 * Version: 2.0.0 (SOTA)
 * 
 * "Ne pas parler chinois à un espagnol"
 * Strict routing logic:
 * 1. Maroc (MA) -> Lang: FR, Curr: MAD
 * 2. Maghreb (DZ, TN) + Europe (EU) -> Lang: FR, Curr: EUR
 * 3. Rest of World (ROW) -> Lang: EN, Curr: USD
 */

const VocaliaGeo = (function () {
    'use strict';

    const CONFIG = {
        API_URL: 'https://ipapi.co/json/',
        CACHE_KEY: 'vocalia_geo_cache_v2',
        CACHE_TTL: 3600 * 1000, // 1 hour
        DEFAULT: {
            country: 'MA',
            lang: 'fr',
            currency: 'MAD',
            region: 'MA'
        }
    };

    // EU Countries (Broad definition for "Europe -> FR/EUR" rule)
    // using ISO Alpha-2 codes
    const EU_BLOC = [
        'FR', 'BE', 'LU', 'MC', 'CH', // Francophone-ish
        'DE', 'IT', 'ES', 'PT', 'NL', 'AT', 'GR', 'FI', 'SE', 'DK', 'PL', 'CZ', 'HU', 'RO', 'BG', 'HR', 'SI', 'SK', 'EE', 'LV', 'LT', 'CY', 'MT', 'IE', 'IS', 'NO', 'GB'
    ];

    const MAGHREB_EUR = ['DZ', 'TN'];

    /**
     * Determine Sovereign Config from Country Code
     */
    function resolveConfig(countryCode) {
        const code = (countryCode || 'MA').toUpperCase();

        // 1. MAROC
        if (code === 'MA') {
            return {
                country: 'MA',
                lang: 'fr',
                currency: 'MAD',
                symbol: 'DH',
                region: 'MA'
            };
        }

        // 2. ALGÉRIE, TUNISIE, EUROPE
        if (MAGHREB_EUR.includes(code) || EU_BLOC.includes(code)) {
            return {
                country: code,
                lang: 'fr',
                currency: 'EUR',
                symbol: '€',
                region: 'EU'
            };
        }

        // 3. REST OF WORLD (MENA, US, ASIA, etc.)
        return {
            country: code,
            lang: 'en',
            currency: 'USD',
            symbol: '$',
            region: 'INTL'
        };
    }

    async function detect() {
        // Check Cache
        const cached = localStorage.getItem(CONFIG.CACHE_KEY);
        if (cached) {
            try {
                const data = JSON.parse(cached);
                if (Date.now() - data.timestamp < CONFIG.CACHE_TTL) {
                    return data.config;
                }
            } catch (e) {
                localStorage.removeItem(CONFIG.CACHE_KEY);
            }
        }

        // Fetch Fresh
        try {
            const response = await fetch(CONFIG.API_URL);
            if (!response.ok) throw new Error('Geo API failed');

            const data = await response.json();
            const country = data.country_code || 'MA';
            const config = resolveConfig(country);

            // Cache it
            localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify({
                timestamp: Date.now(),
                config: config
            }));

            return config;

        } catch (error) {
            console.warn('[VocaliaGeo] Detection failed, using default (MA):', error);
            return resolveConfig('MA');
        }
    }

    /**
     * Get Currency Symbol for a given currency code
     */
    function getCurrencySymbol(code) {
        switch (code) {
            case 'MAD': return 'DH';
            case 'EUR': return '€';
            case 'USD': return '$';
            case 'GBP': return '£';
            default: return code;
        }
    }

    // Initialize and Apply
    async function init() {
        const config = await detect();

        // Expose globally
        window.VOCALIA_GEO = config;

        // Apply to Document
        document.documentElement.lang = config.lang;
        document.documentElement.setAttribute('data-currency', config.currency);

        // Auto-update currency elements if any exist
        document.querySelectorAll('[data-geo="currency"]').forEach(el => {
            el.textContent = config.symbol;
        });

        // Trigger event
        window.dispatchEvent(new CustomEvent('vocalia-geo-ready', { detail: config }));
    }

    // Auto-init
    if (typeof window !== 'undefined') {
        // If not already explicitly disabled
        if (!window.VOCALIA_GEO_DISABLE_AUTO) {
            // Wait for DOM
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', init);
            } else {
                init();
            }
        }
    }

    return {
        detect,
        resolveConfig,
        getCurrencySymbol
    };

})();

// Export for module systems if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VocaliaGeo;
}
