/**
 * VocalIA Voice Assistant — Wix Custom Element
 * =============================================
 * Version: 1.0.0
 *
 * INSTALLATION (Wix Editor / Wix Studio):
 *
 * METHOD 1 — Custom Code (easiest):
 *   1. Go to Settings → Custom Code → Add Custom Code
 *   2. Paste the snippet below in the code field
 *   3. Set placement to "Body - end"
 *   4. Apply to "All pages"
 *   5. Save and publish
 *
 *   Snippet:
 *   <script src="https://vocalia.ma/voice-assistant/voice-widget-b2b.js"
 *     integrity="sha384-3MldGAd6hn/SpDyGMM8as1PUfJghkrjmoKIfQfVONxcCVsBcxmhlC3TCbRUJ12e9" crossorigin="anonymous"
 *     data-vocalia-tenant="YOUR_TENANT_ID" defer></script>
 *
 * METHOD 2 — Velo (advanced):
 *   1. Enable Velo (Developer Mode)
 *   2. In masterPage.js, add this code:
 *
 *   import { vocalia } from 'public/vocalia-loader.js';
 *   $w.onReady(() => vocalia('YOUR_TENANT_ID'));
 *
 *   3. Create public/vocalia-loader.js with the content below
 *
 * IMPORTANT: Add your Wix domain to Allowed Origins in your VocalIA dashboard.
 * Both your-site.wixsite.com/... AND your custom domain if any.
 */

// Velo loader — place in public/vocalia-loader.js
export function vocalia(tenantId, widgetType = 'b2b') {
  if (!tenantId) {
    console.error('VocalIA: tenantId is required');
    return;
  }
  const file = widgetType === 'ecommerce'
    ? 'voice-widget-ecommerce.js'
    : 'voice-widget-b2b.js';
  const script = document.createElement('script');
  script.src = `https://vocalia.ma/voice-assistant/${file}`;
  script.defer = true;
  script.dataset.vocaliaTenant = tenantId;
  document.body.appendChild(script);
}
