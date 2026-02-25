# vocalia-widget

AI-powered voice assistant widget for websites. 40 industry personas, 5 languages (FR/EN/ES/AR/Darija), BANT lead qualification, RTL support.

## Installation

```bash
npm install vocalia-widget
```

## Usage

### General purpose

```js
import { initVocalia } from 'vocalia-widget';

initVocalia({
  tenantId: 'your_tenant_id',
  apiKey: 'voc_xxxxxxxxxxxx',
  position: 'bottom-right',
  primaryColor: '#5E6AD2',
  language: 'auto',
  persona: 'AGENCY'
});
```

### B2B (lead qualification)

```js
import { initVocaliaB2B } from 'vocalia-widget';

initVocaliaB2B({
  tenantId: 'your_tenant_id',
  persona: 'SAAS'
});
```

### E-commerce (product catalog)

```js
import { initVocaliaEcommerce } from 'vocalia-widget';

initVocaliaEcommerce({
  tenantId: 'your_tenant_id',
  persona: 'ECOMMERCE'
});
```

## CDN Alternative

```html
<script>
  window.VOCALIA_CONFIG = {
    tenantId: 'your_tenant_id',
    position: 'bottom-right',
    primaryColor: '#5E6AD2'
  };
</script>
<script src="https://cdn.jsdelivr.net/npm/vocalia-widget/src/voice-widget.js" defer></script>
```

## Configuration

| Option | Type | Default | Description |
|:-------|:-----|:--------|:------------|
| `tenantId` | string | *required* | Your VocalIA tenant identifier. |
| `apiKey` | string | — | API key for authenticated operations (BANT/CRM). |
| `position` | string | `'bottom-right'` | Widget position: `bottom-right`, `bottom-left`, `top-right`, `top-left`. |
| `primaryColor` | hex | `'#5E6AD2'` | Button and accent color. |
| `buttonSize` | number | `60` | Button diameter in pixels. |
| `language` | string | `'auto'` | Force language: `fr`, `en`, `es`, `ar`, `ary`. |
| `persona` | string | `'AGENCY'` | Initial AI personality (see Personas list). |
| `ecommerceMode` | boolean | `true` | Enable catalog search & cart intent detection. |
| `autoStart` | boolean | `false` | Start voice synthesis immediately on open. |
| `debug` | boolean | `false` | Enable console logging for voice events. |

## Programmatic Control

The widget can be controlled programmatically via the `window.VocalIA` object:

```js
// Open the widget
VocalIA.open();

// Close the widget
VocalIA.close();

// Toggle state
VocalIA.toggle();

// Switch persona on the fly
VocalIA.setPersona('RESTAURANT');

// Send data to the AI (e.g., current product context)
VocalIA.sendContext({
  productId: '123',
  price: '99.99',
  currency: 'EUR'
});
```

## Event Hooks

Listen to widget lifecycle events to trigger custom site logic:

```js
window.addEventListener('vocalia:ready', (e) => {
  console.log('VocalIA is loaded and ready.');
});

window.addEventListener('vocalia:message', (e) => {
  const { role, text } = e.detail;
  console.log(`New ${role} message: ${text}`);
});

window.addEventListener('vocalia:qualify', (e) => {
  const { score, bant } = e.detail;
  // Trigger your own CRM conversion pixels here
  console.log('Lead qualified:', bant);
});

window.addEventListener('vocalia:error', (e) => {
  console.error('VocalIA Error:', e.detail.message);
});
```

## Advanced Customization (CSS)

The widget uses CSS Variables for style overrides. You can define these in your main stylesheet:

```css
:root {
  --vocalia-primary: #FF5733;
  --vocalia-font: 'Inter', sans-serif;
  --vocalia-z-index: 9999;
}
```

## Data Attributes

Control widget behavior without writing JavaScript using HTML data attributes:

```html
<!-- Trigger widget open from any button -->
<button data-vocalia-action="open">Speak with AI</button>

<!-- Switch persona based on page section -->
<section data-vocalia-persona="DENTAL"> ... </section>
```

## Personas

VocalIA includes 40 fine-tuned personas, categorized by industry:

* **Real Estate:** `PROPERTY`, `LISTINGS`, `CLIENT_RELATIONS`
* **Healthcare:** `DENTAL`, `HEALTHCARE`, `WELLNESS`
* **Professional Services:** `LAWYER`, `INSURANCE`, `FINANCE`, `AGENCY`
* **Home Services:** `CONTRACTOR`, `PLUMBING`, `ROOFING`
* **E-commerce & Retail:** `ECOMMERCE`, `RESTAURANT`, `HOTEL`, `TRAVEL`
* **Tech & Education:** `SAAS`, `EDUCATION`, `CUSTOMER_SUPPORT`

## Languages & Localization

VocalIA is a global-first platform with deep regional intelligence:

* **RTL Support:** Automatically adjusts UI layout for Arabic and Darija.
* **Auto-Detection:** Uses sophisticated visitor logic:
  * Geo: Morocco -> French (Primary) / Darija (Secondary)
  * Geo: MENA -> Arabic
  * Geo: Europe/Americas -> English / Local
* **Manual Override:** Set `language: 'ary'` to force Moroccan Darija specifically.

## Requirements

* **HTTPS:** Browsers block microphone access on insecure connections.
* **Supported Browsers:** Chrome (v33+), Safari (v14.1+), Edge (v79+).
* **Network:** Access to `api.vocalia.ma` (Port 443).

## Enterprise Support

For white-label solutions, custom personas training, or on-premise deployments, contact [enterprise@vocalia.ma](mailto:enterprise@vocalia.ma).

## License

MIT © [Jouiet/VocalIA](https://github.com/Jouiet/VocalIA)
