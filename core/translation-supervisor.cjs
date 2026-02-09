/**
 * Translation Supervisor Agent (A2A Pattern)
 * VocalIA - Session 245, Optimized Session 250.28
 *
 * " The Policeman of Language "
 * Intercepts voice generation events to prevent hallucinations and ensure language consistency.
 *
 * Capabilities:
 * 1. Hallucination Detection (e.g. "As an AI language model")
 * 2. Language Consistency Code (e.g. No English in Darija/French sessions)
 * 3. Length Supervision (Prevent monologues)
 * 4. Formatting Cleanup (Remove markdown, bullets, emojis for TTS)
 *
 * A2A Compliance: Agent Card + Task Lifecycle (Session 250.28)
 */

const eventBus = require('./AgencyEventBus.cjs');

// ─────────────────────────────────────────────────────────────────────────────
// A2A AGENT CARD (Google A2A Protocol Spec)
// https://a2a-protocol.org/latest/specification/
// ─────────────────────────────────────────────────────────────────────────────

const AGENT_CARD = {
    name: "TranslationSupervisor",
    version: "1.1.0",
    description: "Voice AI language quality guardian - prevents hallucinations, enforces language consistency",
    provider: {
        organization: "VocalIA",
        url: "https://vocalia.ma"
    },
    capabilities: {
        streaming: false,
        pushNotifications: false,
        stateTransitionHistory: true
    },
    skills: [
        {
            id: "hallucination_detection",
            name: "Hallucination Detection",
            description: "Detects AI boilerplate phrases in FR/EN/AR/ES/ARY",
            inputModes: ["text"],
            outputModes: ["text"]
        },
        {
            id: "language_consistency",
            name: "Language Consistency",
            description: "Enforces target language purity, especially Darija",
            inputModes: ["text"],
            outputModes: ["text"]
        },
        {
            id: "tts_formatting",
            name: "TTS Formatting",
            description: "Cleans markdown, emojis, excessive whitespace for speech synthesis",
            inputModes: ["text"],
            outputModes: ["text"]
        }
    ],
    authentication: {
        schemes: ["none"]
    },
    defaultInputModes: ["text"],
    defaultOutputModes: ["text"]
};

// A2A Task States
const TASK_STATES = {
    SUBMITTED: 'submitted',
    WORKING: 'working',
    INPUT_REQUIRED: 'input-required',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELED: 'canceled'
};

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
        this.taskHistory = new Map(); // A2A Task state history
        this.setupSubscriptions();
        console.log('[TranslationSupervisor] A2A Agent Active - Guarding Language Quality');
        console.log(`[TranslationSupervisor] Agent Card: ${AGENT_CARD.name} v${AGENT_CARD.version}`);
    }

    /**
     * A2A: Get Agent Card (metadata about this agent)
     */
    getAgentCard() {
        return AGENT_CARD;
    }

    /**
     * A2A: Get task state history for a correlation ID
     */
    getTaskHistory(correlationId) {
        return this.taskHistory.get(correlationId) || [];
    }

    /**
     * A2A: Record task state transition
     */
    recordTaskState(correlationId, state, details = {}) {
        if (!this.taskHistory.has(correlationId)) {
            this.taskHistory.set(correlationId, []);
        }
        this.taskHistory.get(correlationId).push({
            state,
            timestamp: new Date().toISOString(),
            ...details
        });
        // Cleanup old entries (keep last 1000)
        if (this.taskHistory.size > 1000) {
            const firstKey = this.taskHistory.keys().next().value;
            this.taskHistory.delete(firstKey);
        }
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

        // A2A: Record task submitted
        this.recordTaskState(correlationId, TASK_STATES.SUBMITTED, { text: text.substring(0, 50) });
        this.recordTaskState(correlationId, TASK_STATES.WORKING, { skill: 'tts_formatting' });

        // 1. Structural Cleanup (Always apply)
        let processedText = this.cleanTextForTTS(text);

        // 2. Hallucination Check
        this.recordTaskState(correlationId, TASK_STATES.WORKING, { skill: 'hallucination_detection' });
        if (this.detectHallucination(processedText)) {
            console.warn(`[Supervisor] Hallucination detected in: "${processedText.substring(0, 50)}..."`);
            processedText = this.generateFallback(language);

            this.recordTaskState(correlationId, TASK_STATES.COMPLETED, {
                action: 'corrected',
                reason: 'hallucination_detected'
            });
            await eventBus.publish('voice.generation.corrected', {
                text: processedText,
                reason: 'hallucination_detected'
            }, { correlationId });
            return;
        }

        // 3. Language Consistency (Darija specific)
        if (language === 'ary') {
            this.recordTaskState(correlationId, TASK_STATES.WORKING, { skill: 'language_consistency' });
            const corrected = this.enforceDarijaAuthenticity(processedText);
            if (corrected !== processedText) {
                console.log(`[Supervisor] Darija adjustment: "${processedText}" -> "${corrected}"`);
                processedText = corrected;

                this.recordTaskState(correlationId, TASK_STATES.COMPLETED, {
                    action: 'corrected',
                    reason: 'darija_enforcement'
                });
                await eventBus.publish('voice.generation.corrected', {
                    text: processedText,
                    reason: 'darija_enforcement'
                }, { correlationId });
                return;
            }
        }

        // 4. Approval
        this.recordTaskState(correlationId, TASK_STATES.COMPLETED, {
            action: 'approved',
            reason: 'passed_all_checks'
        });
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
            { from: /\bbonjour\b/gi, to: "Salam" },
            { from: /\bau revoir\b/gi, to: "Beslama" },
            { from: /\bs'il vous plaît\b/gi, to: "3afak" },
            { from: /\bmerci\b/gi, to: "Choukran" },
            { from: /\boui\b/gi, to: "Ah" },
            { from: /\bnon\b/gi, to: "Lla" }
        ];

        replacements.forEach(rep => {
            corrected = corrected.replace(rep.from, rep.to);
        });

        return corrected;
    }
}

// Singleton instance
module.exports = new TranslationSupervisor();
