=== VocalIA Voice Widget ===
Contributors: vocalia
Tags: voice assistant, AI, chatbot, voice chat, multilingual, customer service
Requires at least: 5.0
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Add an AI-powered voice assistant to your WordPress site. 38 industry personas, 5 languages (FR, EN, ES, AR, Darija), BANT lead qualification.

== Description ==

VocalIA Voice Widget brings conversational AI to your WordPress site. Your visitors can speak naturally with an intelligent voice assistant that understands context, qualifies leads, and provides instant answers.

**This plugin loads a JavaScript file from vocalia.ma** to power the voice assistant. An explicit opt-in checkbox is provided in settings before any external script is loaded.

= Key Features =

* **38 Industry Personas** - Pre-configured AI personalities for dental, real estate, e-commerce, SaaS, healthcare, and more
* **5 Languages** - French, English, Spanish, Arabic (MSA), and Moroccan Darija
* **Zero API Costs for Speech** - Uses Web Speech API (browser-native) for speech recognition
* **RTL Support** - Full right-to-left support for Arabic languages
* **Lead Qualification** - Built-in BANT scoring for sales-ready conversations
* **Customizable** - Match your brand colors and widget position
* **Mobile Responsive** - Works on all devices
* **External Script Consent** - Explicit opt-in before loading any external resource

= How It Works =

1. Install and activate the plugin
2. Go to Settings > VocalIA Widget
3. Check "External Script" to consent to loading the widget from vocalia.ma
4. Enter your VocalIA Tenant ID and API Key
5. Choose your industry persona
6. Enable the widget — done!

= Use Cases =

* **Customer Support** - Answer FAQs 24/7
* **Lead Generation** - Qualify visitors while they browse
* **Appointment Booking** - Voice-driven scheduling
* **Product Information** - Help customers find what they need
* **Multilingual Support** - Serve international audiences

= External Service =

This plugin connects to **vocalia.ma** to load the voice widget JavaScript and to process AI conversations:

* Service URL: [https://vocalia.ma](https://vocalia.ma)
* Privacy Policy: [https://vocalia.ma/mentions-legales](https://vocalia.ma/mentions-legales)
* The external script is loaded only after the site administrator explicitly enables it in plugin settings
* Voice recognition is performed locally in the browser via Web Speech API
* Only the transcribed text is sent to VocalIA servers for AI response generation

= Requirements =

* VocalIA account ([vocalia.ma](https://vocalia.ma))
* WordPress 5.0+
* PHP 7.4+
* HTTPS (required for microphone access)

== Installation ==

1. Upload the `vocalia-voice-widget` folder to `/wp-content/plugins/`
2. Activate the plugin through the 'Plugins' menu
3. Go to Settings > VocalIA Widget
4. Check "External Script" to consent to loading the widget
5. Enter your Tenant ID from vocalia.ma/dashboard
6. Configure your preferences and save

== Frequently Asked Questions ==

= Does VocalIA cost money per minute? =
No. Because we use the native Web Speech API built into browsers like Chrome and Safari, transcription and speech synthesis are handled locally on the visitor's device. You don't pay per-minute "utility" bills for voice. You only pay for the AI reasoning layer via your VocalIA subscription.

= Is it compliant with GDPR and privacy laws? =
Absolutely. Our "Edge-AI" approach means that raw audio data never leaves the user's browser. We only process the transcribed text on our secure servers to generate AI responses. This ensures maximum privacy and compliance with global data protection standards.

= Which browsers are supported? =
VocalIA works on all modern browsers that support the Web Speech API:
*   Google Chrome (Desktop & Mobile)
*   Microsoft Edge
*   Apple Safari (iOS & macOS)
*   Mozilla Firefox (Limited support for synthesis)
On mobile devices, it requires a secure (HTTPS) connection to access the microphone.

= Can I use it on an e-commerce site? =
Yes! VocalIA has a specialized "E-commerce Mode" that helps users search for products and navigate your catalog using only their voice. It's fully compatible with WooCommerce and other major WP e-commerce plugins.

= How do the 38 Personas work? =
Each persona is a fine-tuned AI personality trained on industry-specific data. For example, the "Real Estate" persona knows how to discuss property features, while the "Dental" persona is expert at discussing appointment types. You can switch personas instantly in the plugin settings.

= Does it support RTL languages like Arabic? =
Yes. VocalIA has native, high-fidelity support for Arabic (MSA) and Moroccan Darija. When an Arabic language is detected or set, the widget UI automatically flips to a mirrored RTL (Right-to-Left) layout for a premium user experience.

= Can I customize the widget's appearance? =
Yes. You can change the primary color, icon size, and position (Bottom-Right, Bottom-Left, etc.) directly from the WordPress admin panel. Advanced users can also override styles using CSS variables.

== Screenshots ==

1. Widget button on your site
2. Voice conversation interface
3. Admin settings panel
4. Persona selection
5. Color customization

== Changelog ==

= 1.0.0 =
* Initial release
* 38 industry personas
* 5 language support (FR, EN, ES, AR, Darija)
* Customizable appearance (color, position, size)
* Page exclusion rules
* Mobile toggle
* External script opt-in consent

== Upgrade Notice ==

= 1.0.0 =
Initial release of VocalIA Voice Widget for WordPress.
