// VocalIA Widget NPM Entry Point
// Usage: import { initVocalia, initVocaliaB2B, initVocaliaEcommerce } from 'vocalia-widget';

/**
 * Initialize VocalIA Widget
 * @param {object} config - Configuration object
 */
export function initVocalia(config) {
    if (typeof window === 'undefined') return;

    // Map NPM config keys to widget SAFE_CONFIG_KEYS format
    const safeConfig = {};
    if (config.ecommerceMode !== undefined) safeConfig.ECOMMERCE_MODE = config.ecommerceMode;
    if (config.position) safeConfig.widgetPosition = config.position;
    if (config.language) safeConfig.DEFAULT_LANG = config.language === 'auto' ? undefined : config.language;
    if (config.exitIntent !== undefined) safeConfig.EXIT_INTENT_ENABLED = config.exitIntent;
    if (config.socialProof !== undefined) safeConfig.SOCIAL_PROOF_ENABLED = config.socialProof;
    if (config.aiMode !== undefined) safeConfig.AI_MODE = config.aiMode;
    if (config.apiTimeout) safeConfig.API_TIMEOUT = config.apiTimeout;

    // Set safe config keys (these pass through widget H8 filter)
    window.VOCALIA_CONFIG = safeConfig;

    // Load Script dynamically from CDN/API (Unified V3 Kernel)
    // tenantId is passed via data-vocalia-tenant attribute (widget reads this natively)
    // primaryColor is applied server-side via /config endpoint based on tenant
    if (!document.getElementById('vocalia-script')) {
        const script = document.createElement('script');
        script.id = 'vocalia-script';
        script.src = `https://api.vocalia.ma/voice-assistant/voice-widget-v3.js`;
        script.defer = true;
        // Pass tenantId via data attribute — widget detectTenantId() reads this (line 3704)
        if (config.tenantId) script.dataset.vocaliaTenant = config.tenantId;
        if (config.apiKey) script.dataset.vocaliaApiKey = config.apiKey;
        document.body.appendChild(script);
    }
}

/**
 * Initialize B2B-specialized Widget
 */
export function initVocaliaB2B(config) {
    initVocalia({ ...config, ecommerceMode: false });
}

/**
 * Initialize E-commerce-specialized Widget
 */
export function initVocaliaEcommerce(config) {
    initVocalia({ ...config, ecommerceMode: true });
}
