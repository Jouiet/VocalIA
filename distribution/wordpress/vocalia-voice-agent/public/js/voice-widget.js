/**
 * VocalIA - Voice Assistant Widget Loader for WordPress
 * This loader determines whether to load the B2B or E-commerce kernel
 * based on the configuration injected by the WordPress plugin.
 */
(function () {
    'use strict';

    // Config injected via wp_localize_script
    const config = window.VOCALIA_CONFIG_INJECTED || {};

    // Fallback to global config if needed
    const globalConfig = window.VOCALIA_CONFIG || {};

    // Determine mode: explicitly from config, or default to ecommerce for WordPress
    const isEcommerce = (config.ecommerceMode !== undefined) ? config.ecommerceMode : true;
    const mode = isEcommerce ? 'ecommerce' : 'b2b';

    // Determine base URL (default to production API)
    const baseUrl = config.assetsUrl || 'https://api.vocalia.ma/voice-assistant/';

    console.log(`[VocalIA] Initializing ${mode} widget...`);

    const script = document.createElement('script');
    script.src = `${baseUrl}voice-widget-${mode}.js`;
    script.defer = true;
    script.async = true;

    // Handle loading errors
    script.onerror = function () {
        console.error(`[VocalIA] Failed to load ${mode} widget kernel. Falling back to unified widget.`);
        const fallback = document.createElement('script');
        fallback.src = `${baseUrl}voice-widget.js`;
        document.body.appendChild(fallback);
    };

    document.body.appendChild(script);
})();
