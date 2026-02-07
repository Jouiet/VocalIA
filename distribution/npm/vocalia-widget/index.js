// VocalIA Widget NPM Entry Point
// Usage: import { initVocalia, initVocaliaB2B, initVocaliaEcommerce } from 'vocalia-widget';

/**
 * Initialize VocalIA Widget
 * @param {object} config - Configuration object
 */
export function initVocalia(config) {
    if (typeof window === 'undefined') return;

    // Set Global Config
    window.VOCALIA_CONFIG = {
        tenantId: config.tenantId,
        position: config.position || 'bottom-right',
        themeColor: config.primaryColor || '#5E6AD2',
        ecommerceMode: config.ecommerceMode !== undefined ? config.ecommerceMode : true,
        ...config
    };

    // Load Script dynamically from CDN/API (Unified V3 Kernel)
    if (!document.getElementById('vocalia-script')) {
        const script = document.createElement('script');
        script.id = 'vocalia-script';
        script.src = `https://api.vocalia.ma/voice-assistant/voice-widget-v3.js`;
        script.defer = true;
        document.body.appendChild(script);
        console.log(`[VocalIA] Initializing unified V3 widget via NPM`);
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
