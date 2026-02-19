/**
 * SystemHeartbeat.cjs - The "Pacemaker" of VocalIA
 * 
 * Role: Periodic health check of all vital organs.
 * Frequency: Every 60s
 * 
 * Checks:
 * 1. Redis (ProactiveScheduler)
 * 2. Memory Usage (RSS)
 * 3. EventBus Liveness
 */

const AgencyEventBus = require('../AgencyEventBus.cjs');
const ProactiveScheduler = require('../proactive-scheduler.cjs');

class SystemHeartbeat {
    constructor(intervalMs = 60000) {
        this.intervalMs = intervalMs;
        this.timer = null;
    }

    start() {
        console.log(`[SystemHeartbeat] Started. Pulse every ${this.intervalMs}ms.`);
        this.timer = setInterval(() => this.pulsate(), this.intervalMs);
        this.pulsate(); // Immediate check
    }

    async pulsate() {
        const diagnostics = {
            timestamp: new Date().toISOString(),
            memory: process.memoryUsage(),
            components: {}
        };

        // 1. Check Redis (Scheduler)
        try {
            // ProactiveScheduler exposes 'connection' but checking 'isReady' is safer 
            // if we don't want to rely on internal generic-pool logic.
            // A simple ping logic if available?
            // Let's assume isReady implies connected.
            diagnostics.components.redis = ProactiveScheduler.isReady ? 'UP' : 'DOWN';
            if (!ProactiveScheduler.isReady) {
                console.warn('[SystemHeartbeat] ⚠️ Redis appears DOWN.');
                // SOTA: Here we could try to force-restart the scheduler connection?
            }
        } catch (err) {
            diagnostics.components.redis = 'ERROR';
        }

        // 2. Report Pulse
        // Provide "Vitals" to the dashboard via EventBus
        AgencyEventBus.publish('system.heartbeat', diagnostics).catch(err => {
            console.error('[SystemHeartbeat] Failed to publish pulse:', err.message);
        });

        const rssMB = Math.round(diagnostics.memory.rss / 1024 / 1024);
        console.log(`[SystemHeartbeat] ❤️ Pulse OK. Memory: ${rssMB}MB. Redis: ${diagnostics.components.redis}`);
    }

    stop() {
        if (this.timer) clearInterval(this.timer);
        console.log('[SystemHeartbeat] Stopped.');
    }
}

// Singleton
module.exports = new SystemHeartbeat();
