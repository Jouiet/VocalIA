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
const { getInstance: getTenantKB } = require('../tenant-kb-loader.cjs');

class KBEnrichmentSkill {
    constructor() {
        this.initialized = false;
        this.tenantMemory = tenantMemory;
        this.kbLoader = getTenantKB();
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

            // 2. SOTA Moat #6 (250.222): Load current KB for real gap comparison
            let kbSummary = '';
            try {
                const kbEntries = await this.kbLoader.getKB(tenantId, 'fr');
                if (kbEntries && Object.keys(kbEntries).length > 0) {
                    kbSummary = '\n\nBASE DE CONNAISSANCES ACTUELLE:\n' +
                        Object.entries(kbEntries).slice(0, 30)
                            .filter(([k]) => k !== '__meta')
                            .map(([k, v]) => `- ${k}: ${typeof v === 'string' ? v.substring(0, 100) : JSON.stringify(v).substring(0, 100)}`)
                            .join('\n');
                }
            } catch (e) { /* KB may not exist yet for this tenant */ }

            const factSummary = facts.slice(-50).map(f => `- ${f.type}: ${f.value}`).join('\n');

            // 3. Ask LLM to identify gaps (with KB context for dedup)
            const prompt = `Voici les faits extraits des conversations clients:
${factSummary}
${kbSummary}

Identifie 1-2 LACUNES: questions fréquentes des clients auxquelles la KB ne répond PAS encore.
NE PAS suggérer ce qui existe déjà dans la KB.
Format: [ { "question": "...", "answer": "...", "reason": "..." } ]`;

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
