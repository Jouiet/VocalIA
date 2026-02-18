/**
 * ProactiveScheduler.cjs - SOTA Pattern #3 (Proactive Automation)
 * 
 * Capabilities:
 * - Schedule delayed tasks (e.g., "Follow up in 2 days")
 * - Recurring tasks (Cron) (e.g., "Weekly Report")
 * - Persistent Job Queue (Redis-backed via BullMQ)
 * 
 * Dependencies:
 * - bullmq
 * - ioredis
 * - AgencyEventBus
 */

const { Queue, Worker, QueueEvents } = require('bullmq');
const IORedis = require('ioredis');
const AgencyEventBus = require('./AgencyEventBus.cjs');

// Configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const QUEUE_NAME = 'vocalia-proactive-tasks';

class ProactiveScheduler {
    constructor() {
        this.connection = null;
        this.queue = null;
        this.worker = null;
        this.queueEvents = null;
        this.isReady = false;

        // Initialize if Redis is available
        this._init().catch(err => {
            console.warn(`[ProactiveScheduler] Initialization failed (Redis missing?): ${err.message}`);
        });
    }

    async _init() {
        try {
            this.connection = new IORedis(REDIS_URL, {
                maxRetriesPerRequest: null,
                retryStrategy: (times) => {
                    if (times > 3) {
                        console.warn('[ProactiveScheduler] Redis reconnection failed, disabling scheduler.');
                        return null; // Stop retrying
                    }
                    return Math.min(times * 50, 2000);
                }
            });

            this.connection.on('error', (err) => {
                // Suppress excessive error logs if Redis is down
            });

            await this.connection.ping(); // Fail early if no Redis

            // 1. Job Queue
            this.queue = new Queue(QUEUE_NAME, { connection: this.connection });

            // 2. Job Worker (Processor)
            this.worker = new Worker(QUEUE_NAME, async (job) => {
                console.log(`[ProactiveScheduler] Processing job ${job.id} (${job.name})...`);
                await this._processJob(job);
            }, { connection: this.connection });

            this.worker.on('completed', (job) => {
                console.log(`[ProactiveScheduler] Job ${job.id} completed.`);
            });

            this.worker.on('failed', (job, err) => {
                console.error(`[ProactiveScheduler] Job ${job.id} failed: ${err.message}`);
            });

            this.isReady = true;
            console.log(`✅ [ProactiveScheduler] Connected to Redis at ${REDIS_URL}`);

        } catch (err) {
            // Redis likely not available - operating in "disabled" mode
            // This is acceptable for environments without Redis
            // console.warn(`[ProactiveScheduler] Disabled: ${err.message}`);
        }
    }

    /**
     * Schedule a task
     * @param {string} tenantId - Tenant ID
     * @param {string} taskType - 'follow_up', 'report', 'alert'
     * @param {object} payload - Task data
     * @param {object} options - { delay (ms), cron (string), jobId (optional) }
     */
    async scheduleTask(tenantId, taskType, payload, options = {}) {
        if (!this.isReady) return { success: false, error: 'Scheduler not ready (Redis missing)' };

        const jobId = options.jobId || `${tenantId}_${taskType}_${Date.now()}`;
        const jobData = {
            tenantId,
            taskType,
            payload,
            scheduledAt: new Date().toISOString()
        };

        const jobOptions = {
            jobId,
            delay: options.delay,
            repeat: options.cron ? { pattern: options.cron } : undefined,
            removeOnComplete: true, // Keep history clean
            removeOnFail: false     // Keep failed jobs for inspection
        };

        try {
            await this.queue.add(taskType, jobData, jobOptions);
            console.log(`[ProactiveScheduler] Scheduled "${taskType}" for ${tenantId} (Job: ${jobId})`);
            return { success: true, jobId };
        } catch (err) {
            console.error(`[ProactiveScheduler] Schedule error: ${err.message}`);
            return { success: false, error: err.message };
        }
    }

    /**
     * Cancel a specific job
     */
    async cancelTask(jobId) {
        if (!this.isReady) return false;
        try {
            const job = await this.queue.getJob(jobId);
            if (job) {
                await job.remove();
                return true;
            }
            // Also check repeatable jobs
            const repeatables = await this.queue.getRepeatableJobs();
            const repeatable = repeatables.find(j => j.id === jobId || j.key.includes(jobId)); // BullMQ key format is complex
            if (repeatable) {
                await this.queue.removeRepeatableByKey(repeatable.key);
                return true;
            }
            return false;
        } catch (err) {
            return false;
        }
    }

    /**
     * Internal Job Processor
     */
    async _processJob(job) {
        const { tenantId, taskType, payload } = job.data;

        // Route to appropriate handler or emit event
        // We use AgencyEventBus to decouple execution
        // The "Brain" (VoiceAPI or other agents) should subscribe to these events

        const eventName = `scheduler.task_executed`;
        const eventPayload = {
            jobId: job.id,
            taskType,
            tenantId,
            payload,
            timestamp: new Date().toISOString()
        };

        // Publish event for system reaction
        await AgencyEventBus.publish(eventName, eventPayload, { tenantId });

        // Specific Built-in Handlers (if needed)
        if (taskType === 'whatsapp_push') {
            // Example: Outbound WhatsApp notification logic could be here or subscribed via EventBus
            // For architecture purity, we prefer EventBus subscribers.
        }
    }

    /**
     * Graceful Shutdown
     */
    async close() {
        if (this.worker) await this.worker.close();
        if (this.queue) await this.queue.close();
        if (this.connection) await this.connection.quit();
        this.isReady = false;
    }
}

// Singleton
const instance = new ProactiveScheduler();
module.exports = instance;
