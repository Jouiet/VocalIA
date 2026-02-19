/**
 * ProactiveScheduler.cjs - SOTA Pattern #3 (Proactive Automation)
 * Session 250.220: Rewritten as file-based (no Redis/BullMQ)
 *
 * Capabilities:
 * - Schedule delayed tasks (e.g., "Follow up in 24h")
 * - Recurring tasks via setInterval (e.g., "Daily KB Enrichment")
 * - JSONL persistence (matches AgencyEventBus pattern)
 *
 * Dependencies: fs, AgencyEventBus (no external deps)
 */

const fs = require('fs');
const path = require('path');
const AgencyEventBus = require('./AgencyEventBus.cjs');

const SCHEDULER_DIR = path.join(__dirname, '..', 'data', 'scheduler');
const TASKS_FILE = path.join(SCHEDULER_DIR, 'tasks.jsonl');
const CHECK_INTERVAL_MS = 60_000; // Check every 60s

class ProactiveScheduler {
  constructor() {
    this.isReady = true; // Always ready (no Redis dependency)
    this.cronIntervals = new Map(); // jobId -> intervalId
    this._checkTimer = null;

    // Ensure directory
    if (!fs.existsSync(SCHEDULER_DIR)) {
      fs.mkdirSync(SCHEDULER_DIR, { recursive: true });
    }

    // Start delayed-task checker
    this._checkTimer = setInterval(() => this._processDelayedTasks(), CHECK_INTERVAL_MS);
    if (this._checkTimer.unref) this._checkTimer.unref(); // Don't keep process alive
  }

  /**
   * Schedule a task
   * @param {string} taskType - e.g. 'lead_follow_up', 'kb_enrichment_cron'
   * @param {object} payload - Task data
   * @param {object} options - { delay (ms), repeat: { cron }, jobId }
   */
  async scheduleTask(taskType, payload, options = {}) {
    const jobId = options.jobId || `${taskType}_${Date.now()}`;

    // Recurring task (cron-like via setInterval)
    if (options.repeat && options.repeat.cron) {
      return this._scheduleCron(jobId, taskType, payload, options.repeat.cron);
    }

    // Delayed task (one-shot)
    if (options.delay) {
      return this._scheduleDelayed(jobId, taskType, payload, options.delay);
    }

    // Immediate execution
    await this._executeTask(jobId, taskType, payload);
    return { success: true, jobId };
  }

  /**
   * Schedule a cron-like recurring task
   */
  _scheduleCron(jobId, taskType, payload, cronExpr) {
    // Prevent duplicate cron registrations
    if (this.cronIntervals.has(jobId)) {
      return { success: true, jobId, note: 'already_scheduled' };
    }

    // Parse cron to interval (simple: daily = 24h, hourly = 1h)
    const intervalMs = this._cronToInterval(cronExpr);

    const id = setInterval(async () => {
      await this._executeTask(jobId, taskType, payload);
    }, intervalMs);

    if (id.unref) id.unref(); // Don't keep process alive
    this.cronIntervals.set(jobId, id);

    console.log(`[ProactiveScheduler] Cron "${jobId}" scheduled (every ${intervalMs / 3600000}h)`);
    return { success: true, jobId };
  }

  /**
   * Schedule a delayed one-shot task (persisted to JSONL)
   */
  async _scheduleDelayed(jobId, taskType, payload, delayMs) {
    const task = {
      jobId,
      taskType,
      payload,
      executeAt: new Date(Date.now() + delayMs).toISOString(),
      scheduledAt: new Date().toISOString(),
      status: 'pending'
    };

    fs.appendFileSync(TASKS_FILE, JSON.stringify(task) + '\n');
    console.log(`[ProactiveScheduler] Delayed "${jobId}" in ${delayMs / 3600000}h`);
    return { success: true, jobId };
  }

  /**
   * Check and execute delayed tasks that are due
   */
  async _processDelayedTasks() {
    if (!fs.existsSync(TASKS_FILE)) return;

    try {
      const content = fs.readFileSync(TASKS_FILE, 'utf8').trim();
      if (!content) return;

      const lines = content.split('\n');
      const remaining = [];
      const now = Date.now();

      for (const line of lines) {
        try {
          const task = JSON.parse(line);
          if (task.status !== 'pending') {
            continue; // Skip already processed
          }
          if (new Date(task.executeAt).getTime() <= now) {
            // Due — execute
            await this._executeTask(task.jobId, task.taskType, task.payload);
          } else {
            // Not yet — keep
            remaining.push(line);
          }
        } catch (e) {
          // Corrupt line — skip
        }
      }

      // Rewrite file with remaining tasks
      fs.writeFileSync(TASKS_FILE, remaining.length > 0 ? remaining.join('\n') + '\n' : '');
    } catch (e) {
      console.error(`[ProactiveScheduler] Process error: ${e.message}`);
    }
  }

  /**
   * Execute a task by emitting to EventBus
   */
  async _executeTask(jobId, taskType, payload) {
    const eventPayload = {
      jobId,
      taskType,
      payload,
      timestamp: new Date().toISOString()
    };

    AgencyEventBus.publish('scheduler.task_executed', eventPayload);
    console.log(`[ProactiveScheduler] Executed "${taskType}" (${jobId})`);
  }

  /**
   * Cancel a scheduled task
   */
  cancelTask(jobId) {
    // Cancel cron
    if (this.cronIntervals.has(jobId)) {
      clearInterval(this.cronIntervals.get(jobId));
      this.cronIntervals.delete(jobId);
      return true;
    }
    return false;
  }

  /**
   * Parse cron expression to interval (simplified)
   * Supports: daily (0 H * * *), hourly (0 * * * *), weekly
   */
  _cronToInterval(cronExpr) {
    const parts = cronExpr.split(/\s+/);
    // Default: daily (24h)
    if (parts.length >= 5) {
      const [, hour, dayOfMonth, , dayOfWeek] = parts;
      if (dayOfWeek !== '*' && dayOfMonth === '*') return 7 * 24 * 3600000; // weekly
      if (hour !== '*' && dayOfMonth === '*') return 24 * 3600000; // daily
      if (hour === '*') return 3600000; // hourly
    }
    return 24 * 3600000; // fallback: daily
  }

  /**
   * Graceful shutdown
   */
  close() {
    if (this._checkTimer) clearInterval(this._checkTimer);
    for (const [, id] of this.cronIntervals) {
      clearInterval(id);
    }
    this.cronIntervals.clear();
    this.isReady = false;
  }
}

// Singleton
module.exports = new ProactiveScheduler();
