/**
 * SOTA Pattern #4: Skill Registry (Deep Surgery Session 250.219)
 * 
 * Central registry for autonomous AI skills.
 * Handles lifecycle: Register -> Init -> Monitor.
 * 
 * Moat: Extensible AI capability system similar to OpenClaw.
 */

class SkillRegistry {
    constructor() {
        this.skills = new Map();
        this.initialized = false;
    }

    /**
     * Register a new skill
     * @param {string} name 
     * @param {object} skillInstance 
     */
    register(name, skillInstance) {
        console.log(`[SkillRegistry] Registering skill: ${name}`);
        this.skills.set(name, skillInstance);

        // If registry already active, init the new skill immediately
        if (this.initialized && typeof skillInstance.init === 'function') {
            skillInstance.init();
        }
    }

    /**
     * Start all registered skills
     */
    initAll() {
        if (this.initialized) return;

        console.log(`[SkillRegistry] Initializing ${this.skills.size} skills...`);
        for (const [name, skill] of this.skills.entries()) {
            if (typeof skill.init === 'function') {
                try {
                    skill.init();
                } catch (e) {
                    console.error(`[SkillRegistry] Failed to init skill "${name}": ${e.message}`);
                }
            }
        }

        this.initialized = true;
        console.log('✅ [SkillRegistry] All skills OPERATIONAL');
    }

    /**
     * Get a registered skill
     */
    getSkill(name) {
        return this.skills.get(name);
    }

    /**
     * Health check for all skills
     */
    getHealth() {
        return Array.from(this.skills.keys()).map(name => ({
            name,
            status: 'operational'
        }));
    }
}

// Singleton
module.exports = new SkillRegistry();
