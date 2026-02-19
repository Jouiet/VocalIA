/**
 * SOTA Pattern #11: Automatic KB Enrichment Skill (Deep Surgery Session 250.219)
 * 
 * Logic:
 * 1. Periodic Cron task (e.g. daily)
 * 2. Scan TenantMemory facts.jsonl for recurring patterns or missing info
 * 3. Compare with current KB
 * 4. Generate "Proposed Update" -> Create HITL Action for Approval
 * 
 * Moat: The system gets smarter with every conversation, automatically.
 */

const AgencyEventBus = require('../AgencyEventBus.cjs');
const llmGateway = require('../gateways/llm-global-gateway.cjs');
const tenantMemory = require('../tenant-memory.cjs');
const { ServiceKnowledgeBase } = require('../knowledge-base-services.cjs');

class KBEnrichmentSkill {
    constructor() {
        this.initialized = false;
        this.tenantMemory = tenantMemory;
        this.kb = new ServiceKnowledgeBase();
    }

    /**
     * Start the skill worker
     */
    init() {
        if (this.initialized) return;

        console.log('🚀 [Skill] KB Enrichment Skill Initializing...');

        // Listen for scheduled enrichment tasks
        AgencyEventBus.subscribe('scheduler.task_executed', async (event) => {
            if (event.taskType !== 'kb_enrichment_cron') return;

            console.log(`[Skill] Running daily KB reflection for tenant: ${event.payload?.tenantId || 'all'}...`);
            await this.reflectAndEnrich(event.payload?.tenantId);
        });

        this.initialized = true;
        console.log('✅ [Skill] KB Enrichment Skill Worker ACTIVE');
    }

    /**
     * Reflection Logic: Facts -> KB Suggestions
     */
    async reflectAndEnrich(tenantId = 'demo_vocalia') {
        try {
            // 1. Fetch recent facts from TenantMemory
            const facts = await this.tenantMemory.getFacts(tenantId);
            if (!facts || facts.length < 5) {
                console.log(`[Skill] Not enough facts for ${tenantId} to generate meaningful enrichment yet.`);
                return;
            }

            // 2. Fetch current KB context
            // In a real SOTA setup, we'd use HybridRAG to find gaps. 
            // Here we'll do a "Global Reflection" on the facts.
            const factSummary = facts.slice(-50).map(f => `- ${f.type}: ${f.value}`).join('\n');

            // 3. Ask LLM to identify gaps or updates
            const prompt = `Voici les derniers faits extraits des conversations clients pour le tenant "${tenantId}":
            ${factSummary}
            
            Analyse ces données et suggère 1 ou 2 nouvelles entrées pour la Knowledge Base (FAQ ou Information produit) qui aideraient l'IA à mieux répondre.
            Format de réponse: JSON validatable [ { "question": "...", "answer": "...", "reason": "..." } ]`;

            const suggestionRaw = await llmGateway.generate('gemini', prompt);

            // Clean JSON from Markdown if needed
            const jsonMatch = suggestionRaw.match(/\[.*\]/s);
            if (!jsonMatch) return;
            const suggestions = JSON.parse(jsonMatch[0]);

            // 4. Create HITL Actions (Human-In-The-Loop)
            for (const sugg of suggestions) {
                AgencyEventBus.publish('hitl.action_required', {
                    type: 'KB_ENRICHMENT',
                    tenantId: tenantId,
                    data: {
                        proposed_question: sugg.question,
                        proposed_answer: sugg.answer,
                        reason: sugg.reason
                    },
                    severity: 'low',
                    message: `Nouvelle suggestion pour la base de connaissances: ${sugg.reason}`
                });
            }

            console.log(`✅ [Skill] Enrichment reflection complete for ${tenantId}. ${suggestions.length} suggestions sent to HITL.`);

        } catch (e) {
            console.error(`[Skill] KB Enrichment failed: ${e.message}`);
        }
    }
}

// Singleton
module.exports = new KBEnrichmentSkill();
