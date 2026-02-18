/**
 * SOTA Pattern #1: Lead Follow-up Skill (Deep Surgery Session 250.219)
 * 
 * Logic:
 * 1. Subscribe to scheduler.task_executed (taskType: lead_follow_up)
 * 2. Generate personalized follow-up via LLM
 * 3. Emit messaging.send_whatsapp
 * 
 * Moat: Autonomous business logic that nurturing leads without human intervention.
 */

const AgencyEventBus = require('../AgencyEventBus.cjs');
const llmGateway = require('../gateways/llm-global-gateway.cjs');

class FollowUpSkill {
    constructor() {
        this.initialized = false;
    }

    /**
     * Start the skill worker
     */
    init() {
        if (this.initialized) return;

        console.log('🚀 [Skill] Lead Follow-up Skill Initializing...');

        // Listen for executed tasks from ProactiveScheduler
        AgencyEventBus.subscribe('scheduler.task_executed', async (event) => {
            // The ProactiveScheduler emits 'scheduler.task_executed' when a job completes
            if (event.taskType !== 'lead_follow_up') return;

            console.log(`[Skill] Processing follow-up for ${event.payload?.phone || 'unknown'}...`);
            await this.executeFollowUp(event.payload || {});
        });

        this.initialized = true;
        console.log('✅ [Skill] Lead Follow-up Skill Worker ACTIVE');
    }

    /**
     * Business Logic: Generate and sent follow-up
     */
    async executeFollowUp(payload) {
        const { phone, tenantId, userName, industry } = payload;

        if (!phone) {
            console.error('[Skill] Missing phone number for follow-up');
            return;
        }

        try {
            // SOTA: Generate personalized follow-up using LLM (Deep Context)
            // Use Gemini-3-flash for cost/speed efficiency on follow-ups
            const prompt = `Génère un message de suivi WhatsApp court et ultra-professionnel (max 2 phrases) pour un klayan (client) potentiel nommé ${userName || ''}. 
            Il a déjà parlé avec notre IA VocalIA pour son projet dans le secteur: ${industry || 'Général'}. 
            L'objectif est de lui proposer un créneau de démo finale demain. 
            Ton: Premium, Direct, Orienté-résultat. Langue: Français.`;

            const aiMessage = await llmGateway.generate('gemini', prompt);

            // 📢 BROADCAST: Message send request (Decoupled)
            // The Voice Telephony Bridge listens for this and sends via Meta Cloud API.
            AgencyEventBus.publish('messaging.send_whatsapp', {
                phone: phone,
                text: aiMessage,
                tenantId: tenantId || 'default',
                skill: 'lead_follow_up',
                timestamp: new Date().toISOString()
            });

            console.log(`✅ [Skill] Follow-up command dispatched for ${phone}`);

        } catch (e) {
            console.error(`[Skill] Follow-up execution failed: ${e.message}`);
        }
    }
}

// Singleton
module.exports = new FollowUpSkill();
