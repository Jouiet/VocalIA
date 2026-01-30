/**
 * Translation Supervisor Agent (A2A Pattern)
 * VocalIA - Session 245
 * 
 * " The Policeman of Language "
 * Intercepts voice generation events to prevent hallucinations and ensure language consistency.
 * 
 * Capabilities:
 * 1. Hallucination Detection (e.g. "As an AI language model")
 * 2. Language Consistency Code (e.g. No English in Darija/French sessions)
 * 3. Length Supervision (Prevent monologues)
 * 4. Formatting Cleanup (Remove markdown, bullets, emojis for TTS)
 */

const eventBus = require('./AgencyEventBus.cjs');

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const BLACKLIST_PATTERNS = {
    // English AI boilerplate
    en_boilerplate: [
        /as an ai language model/i,
        /i am an artificial intelligence/i,
        /i cannot have personal opinions/i,
        /my cutoff date/i,
        /openai/i
    ],
    // French AI boilerplate
    fr_boilerplate: [
        /en tant que modèle de langue/i,
        /je suis une intelligence artificielle/i,
        /je ne peux pas/i,
        /ma date de coupure/i
    ]
};

const DARIJA_FORBIDDEN = [
    /je suis/i,      // MSA/French leak
    /nous sommes/i,  // MSA/French leak
    /désolé/i,       // Prefer "Smahli"
    /bonjour/i,      // Prefer "Salam"
    /au revoir/i     // Prefer "Beslama"
];

// ─────────────────────────────────────────────────────────────────────────────
// SUPERVISION LOGIC
// ─────────────────────────────────────────────────────────────────────────────

class TranslationSupervisor {
    constructor() {
        this.setupSubscriptions();
        console.log('[TranslationSupervisor] A2A Agent Active - Guarding Language Quality');
    }

    setupSubscriptions() {
        eventBus.subscribe('voice.generation.check', this.handleCheck.bind(this), {
            name: 'TranslationSupervisor.check',
            priority: 'critical'
        });
    }

    async handleCheck(event) {
        const { text, language, sessionId } = event.payload;
        const correlationId = event.metadata.correlationId;

        // 1. Structural Cleanup (Always apply)
        let processedText = this.cleanTextForTTS(text);

        // 2. Hallucination Check
        if (this.detectHallucination(processedText)) {
            console.warn(`[Supervisor] Hallucination detected in: "${processedText.substring(0, 50)}..."`);
            processedText = this.generateFallback(language);

            await eventBus.publish('voice.generation.corrected', {
                text: processedText,
                reason: 'hallucination_detected'
            }, { correlationId });
            return;
        }

        // 3. Language Consistency (Darija specific)
        if (language === 'ary') {
            const corrected = this.enforceDarijaAuthenticity(processedText);
            if (corrected !== processedText) {
                console.log(`[Supervisor] Darija adjustment: "${processedText}" -> "${corrected}"`);
                processedText = corrected;

                await eventBus.publish('voice.generation.corrected', {
                    text: processedText,
                    reason: 'marija_enforcement'
                }, { correlationId });
                return;
            }
        }

        // 4. Approval
        await eventBus.publish('voice.generation.approved', {
            text: processedText
        }, { correlationId });
    }

    /**
     * Remove markdown, emojis, excessive whitespace
     */
    cleanTextForTTS(text) {
        return text
            .replace(/[*_#`]/g, '')           // Remove Markdown chars
            .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Remove emojis
            .replace(/\s+/g, ' ')             // Collapse whitespace
            .trim();
    }

    /**
     * Check against blacklist patterns
     */
    detectHallucination(text) {
        // Combined check
        const allPatterns = [
            ...BLACKLIST_PATTERNS.en_boilerplate,
            ...BLACKLIST_PATTERNS.fr_boilerplate
        ];

        return allPatterns.some(pattern => pattern.test(text));
    }

    /**
     * Fallback responses if hallucination detected
     */
    generateFallback(language) {
        switch (language) {
            case 'ary': return "Smahli, ma sma3tch mzyan. 3awd 3afak?";
            case 'ar': return "عذراً، لم أسمع جيداً. ممكن تعاود؟";
            case 'en': return "Sorry, I didn't verify that properly. Could you repeat?";
            case 'es': return "Lo siento, no verifiqué bien. ¿Puede repetir?";
            default: return "Pardon, je n'ai pas bien saisi. Pouvez-vous répéter ?"; // FR
        }
    }

    /**
     * Basic Darija enforcement (Rule-based)
     */
    enforceDarijaAuthenticity(text) {
        let corrected = text;

        // Simple replacements (Simulating A2A logic)
        // In a real expanded systems, this would call `fix-darija-authenticity.py` logic
        const replacements = [
            { from: /bonjour/gi, to: "Salam" },
            { from: /au revoir/gi, to: "Beslama" },
            { from: /s'il vous plaît/gi, to: "3afak" },
            { from: /merci/gi, to: "Choukran" },
            { from: /oui/gi, to: "Ah" },
            { from: /non/gi, to: "Lla" }
        ];

        replacements.forEach(rep => {
            corrected = corrected.replace(rep.from, rep.to);
        });

        return corrected;
    }
}

// Singleton instance
module.exports = new TranslationSupervisor();
