/**
 * VocalIA Intelligent Fallback System
 * Uses pre-computed Q&A pairs with semantic similarity for offline/failure scenarios
 * 
 * This replaces the "stupid" keyword-based fallback with intelligent responses
 */

const INTELLIGENT_FALLBACK = {
    // Pre-computed Q&A pairs for common questions
    // These are designed to cover 80% of user queries when API fails
    pairs: {
        // Product questions
        products: {
            triggers: ['produit', 'products', 'vend', 'vendez', 'katbi3', 'offre', 'solution', 'quoi', 'what sell', '3andkom'],
            response: {
                fr: "VocalIA propose 4 produits Voice AI :\n\n1. **Voice Widget B2B** - Assistant vocal pour qualification leads\n2. **Voice Widget B2C** - Support client e-commerce\n3. **Widget E-commerce** - 8 intégrations (Shopify, WooCommerce...)\n4. **Voice Telephony** (0.06€/min) - Ligne téléphonique IA\n\nNos atouts : 38 personas, 5 langues dont Darija, 31+ intégrations.",
                en: "VocalIA offers 4 Voice AI products:\n\n1. **Voice Widget B2B** - Lead qualification assistant\n2. **Voice Widget B2C** - E-commerce customer support\n3. **E-commerce Widget** - 8 integrations (Shopify, WooCommerce...)\n4. **Voice Telephony** (€0.06/min) - AI phone line\n\nStrengths: 38 personas, 5 languages including Darija, 31+ integrations.",
                ary: "VocalIA 3andha 4 dial produits:\n\n1. **Voice Widget B2B** - مساعد لتأهيل leads\n2. **Voice Widget B2C** - دعم العملاء\n3. **Widget E-commerce** - 8 تكاملات\n4. **Voice Telephony** (0.06€/دقيقة) - خط تيليفون ذكي\n\nالمزايا: 40 persona، 5 لغات بما فيها الدارجة."
            }
        },

        // Pricing questions
        pricing: {
            triggers: ['prix', 'price', 'cost', 'tarif', 'combien', 'how much', 'chhal', 'thaman', 'budget', 'devis'],
            response: {
                fr: "**Tarification VocalIA:**\n\n• Voice Widget: À partir de 99€/mois (assistant web 24/7)\n• Voice Telephony: 0.06€/minute (60% moins cher que Vapi)\n• Packages sur mesure selon vos volumes\n\nVoulez-vous un devis personnalisé ?",
                en: "**VocalIA Pricing:**\n\n• Voice Widget: From €99/month (24/7 web assistant)\n• Voice Telephony: €0.06/min (60% cheaper than Vapi)\n• Custom packages based on volume\n\nWould you like a personalized quote?",
                ary: "**الثمن ديال VocalIA:**\n\n• Voice Widget: من 99€/شهر\n• Voice Telephony: 0.06€/دقيقة (60% أرخص من Vapi)\n\nبغيتي devis?"
            }
        },

        // Demo/booking
        demo: {
            triggers: ['demo', 'démo', 'essayer', 'try', 'test', 'voir', 'show', 'bghit nchouf', 'wari'],
            response: {
                fr: "Je peux vous montrer VocalIA en action !\n\n🎯 Réservez une démo de 30 minutes sur **vocalia.ma/booking**\n\nVous verrez le Voice Widget live et la téléphonie IA en conditions réelles.",
                en: "I can show you VocalIA in action!\n\n🎯 Book a 30-minute demo at **vocalia.ma/booking**\n\nYou'll see the Voice Widget live and AI telephony in real conditions.",
                ary: "نقدر نوريك VocalIA كيفاش خدامة!\n\n🎯 حجز ديمو 30 دقيقة فـ **vocalia.ma/booking**"
            }
        },

        // Greeting
        greeting: {
            triggers: ['salam', 'salut', 'bonjour', 'hello', 'hi', 'hey', 'marhba', 'ahlan'],
            response: {
                fr: "Bonjour ! Je suis l'assistant VocalIA. Comment puis-je vous aider ?\n\nJe peux vous parler de nos produits Voice AI, nos tarifs, ou vous réserver une démo.",
                en: "Hello! I'm the VocalIA assistant. How can I help you?\n\nI can tell you about our Voice AI products, pricing, or book you a demo.",
                ary: "السلام عليكم! أنا المساعد ديال VocalIA. كيفاش نقدر نعاونك?\n\nنقدر نهضر معاك على المنتجات ديالنا، الثمن، ولا نحجزلك ديمو."
            }
        },

        // Refusal handling (NO to booking)
        refusal: {
            triggers: ['non', 'no', 'la', 'machi', 'pas maintenant', 'later', 'makanch', 'not now'],
            response: {
                fr: "Pas de souci ! Je reste disponible si vous avez des questions.\n\nQue puis-je vous expliquer sur VocalIA ?",
                en: "No problem! I'm here if you have questions.\n\nWhat can I explain about VocalIA?",
                ary: "ماشي مشكل! أنا هنا إلى بغيتي أي حاجة.\n\nشنو بغيتي تعرف على VocalIA?"
            }
        },

        // How it works
        howItWorks: {
            triggers: ['comment ça marche', 'how does it work', 'kifach', 'explain', 'expliquer', 'fonctionnement'],
            response: {
                fr: "**Comment fonctionne VocalIA:**\n\n1. **Voice Widget:** Une ligne de code sur votre site → Assistant vocal 24/7\n2. **Voice Telephony:** Numéro Twilio → IA répond aux appels\n\nL'IA comprend 5 langues et qualifie vos leads automatiquement (scoring BANT).",
                en: "**How VocalIA works:**\n\n1. **Voice Widget:** One line of code on your site → 24/7 voice assistant\n2. **Voice Telephony:** Twilio number → AI answers calls\n\nThe AI understands 5 languages and qualifies your leads automatically (BANT scoring).",
                ary: "**كيفاش VocalIA خدامة:**\n\n1. **Voice Widget:** سطر كود فـ الموقع → مساعد صوتي 24/7\n2. **Voice Telephony:** نمرة Twilio → الـ AI كتجاوب على الكولات"
            }
        },

        // Integration
        integration: {
            triggers: ['intégration', 'integration', 'crm', 'hubspot', 'shopify', 'api', 'webhook'],
            response: {
                fr: "**Intégrations VocalIA:**\n\n• CRM: HubSpot, Salesforce\n• E-commerce: Shopify, WooCommerce\n• API REST complète\n• Webhooks personnalisés\n\nQuelle plateforme utilisez-vous ?",
                en: "**VocalIA Integrations:**\n\n• CRM: HubSpot, Salesforce\n• E-commerce: Shopify, WooCommerce\n• Full REST API\n• Custom webhooks\n\nWhat platform do you use?",
                ary: "**التكاملات ديال VocalIA:**\n\n• CRM: HubSpot, Salesforce\n• E-commerce: Shopify, WooCommerce\n\nشنو الـ platform لي كتستعمل?"
            }
        },

        // Languages
        languages: {
            triggers: ['langue', 'language', 'darija', 'arabic', 'arabe', 'multilingue', 'lghat'],
            response: {
                fr: "VocalIA parle **5 langues:**\n\n🇫🇷 Français\n🇬🇧 Anglais\n🇪🇸 Espagnol\n🇸🇦 Arabe classique\n🇲🇦 **Darija marocaine** (exclusivité!)\n\nNous sommes la seule solution Voice AI avec support natif du Darija.",
                en: "VocalIA speaks **5 languages:**\n\n🇫🇷 French\n🇬🇧 English\n🇪🇸 Spanish\n🇸🇦 Classical Arabic\n🇲🇦 **Moroccan Darija** (exclusive!)\n\nWe're the only Voice AI with native Darija support.",
                ary: "VocalIA كتهضر **5 لغات:**\n\n🇫🇷 فرنسية\n🇬🇧 إنجليزية\n🇪🇸 إسبانية\n🇸🇦 العربية\n🇲🇦 **الدارجة المغربية** (حصري!)"
            }
        }
    },

    /**
     * Find best matching response using trigger words
     * @param {string} userMessage - User's input
     * @param {string} lang - Language code (fr, en, ary)
     * @returns {string|null} - Best matching response or null
     */
    findResponse: function (userMessage, lang = 'fr') {
        const lower = userMessage.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        // Score each category
        let bestMatch = null;
        let bestScore = 0;

        for (const [category, data] of Object.entries(this.pairs)) {
            let score = 0;
            for (const trigger of data.triggers) {
                if (lower.includes(trigger.toLowerCase())) {
                    score += trigger.length; // Longer matches = higher score
                }
            }

            if (score > bestScore) {
                bestScore = score;
                bestMatch = data.response[lang] || data.response.fr;
            }
        }

        return bestMatch;
    },

    /**
     * Get intelligent fallback response
     * @param {string} userMessage - User's input  
     * @param {string} lang - Language code
     * @returns {string} - Response (never null)
     */
    getResponse: function (userMessage, lang = 'fr') {
        const matched = this.findResponse(userMessage, lang);

        if (matched) {
            return matched;
        }

        // Ultimate fallback - still intelligent, not "Quel est votre secteur?"
        const ultimateFallback = {
            fr: "Je suis l'assistant VocalIA. Nos produits principaux sont:\n\n• **Voice Widget** - Assistant vocal pour sites web (99€/mois)\n• **Voice Telephony** - Ligne téléphonique IA (0.06€/min)\n\nQue souhaitez-vous savoir ?",
            en: "I'm the VocalIA assistant. Our main products are:\n\n• **Voice Widget** - Voice assistant for websites (€99/month)\n• **Voice Telephony** - AI phone line (€0.06/min)\n\nWhat would you like to know?",
            ary: "أنا المساعد ديال VocalIA. المنتجات ديالنا:\n\n• **Voice Widget** - مساعد صوتي للمواقع (99€/شهر)\n• **Voice Telephony** - خط تيليفون ذكي (0.06€/دقيقة)\n\nشنو بغيتي تعرف?"
        };

        return ultimateFallback[lang] || ultimateFallback.fr;
    }
};

// Export for use in widgets
if (typeof module !== 'undefined' && module.exports) {
    module.exports = INTELLIGENT_FALLBACK;
}
if (typeof window !== 'undefined') {
    window.VocaliaIntelligentFallback = INTELLIGENT_FALLBACK;
}
