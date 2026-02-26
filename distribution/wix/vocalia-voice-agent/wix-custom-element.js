/**
 * VocalIA Voice Agent - Wix Custom Element
 * Wraps the standard widget in a Web Component for Wix Editor compatibility.
 */
class VocaliaVoiceWidget extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.tenantId = this.getAttribute('tenant-id');
        this.position = this.getAttribute('position') || 'bottom-right';
        this.primaryColor = this.getAttribute('primary-color') || '#5E6AD2';

        this.initWidget();
    }

    static get observedAttributes() {
        return ['tenant-id', 'position', 'primary-color'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            // Re-init if attributes change (Wix Editor preview support)
            // In a real scenario, we might just update config, but reload is safer for preview.
            this.innerHTML = '';
            this.initWidget();
        }
    }

    initWidget() {
        // Inject Configuration Global
        window.VOCALIA_CONFIG = {
            tenantId: this.tenantId,
            position: this.position,
            themeColor: this.primaryColor,
            ecommerceMode: true // Assuming Wix stores
        };

        // Create Script Tag
        const script = document.createElement('script');
        // Wix is predominantly e-commerce, but we load the split kernel
        const kernel = 'voice-widget-ecommerce.js';
        script.src = `https://vocalia.ma/voice-assistant/${kernel}`;
        script.async = true;

        // Shadow DOM is tricky with external widget side-effects (like fixed positioning on body).
        // Since our widget appends to body, we just need this component to trigger the load.
        this.appendChild(script);
        console.log('[VocalIA] Wix Custom Element Initialized');
    }
}

customElements.define('vocalia-voice-widget', VocaliaVoiceWidget);
