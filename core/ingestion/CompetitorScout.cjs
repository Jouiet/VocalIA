/**
 * VocalIA - Competitor Scout Agent
 * 
 * Role: Competitive Intelligence Monitor
 * Tech: KnowledgeIngestion + Resilient Polling
 * 
 * Features:
 * - Periodic Monitoring of Competitor URLs
 * - Content Diffing (Current vs Previous)
 * - Alert Generation (Price changes, new offers)
 * - Integration with ProactiveScheduler (planned)
 */

const { fork } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const AgencyEventBus = require('../AgencyEventBus.cjs');
const DATA_DIR = path.join(__dirname, '../../data/competitor_intel');

class CompetitorScout {
    constructor() {
        this.worker = null;
        this.pendingRequests = new Map();
        this.restartCount = 0; // SOTA Safety: Track crashes
        this.maxRestarts = 5;
        this.backoffMs = 1000;

        this.ensureDataDir();
        this._startWorker();
        this._setupEventListeners();
    }

    _startWorker() {
        const workerPath = path.join(__dirname, 'ingestion-worker.cjs');
        this.worker = fork(workerPath);

        console.log(`[CompetitorScout] Spawned Ingestion Worker (PID: ${this.worker.pid})`);

        this.worker.on('message', (msg) => {
            if (msg.type === 'READY') {
                console.log('[CompetitorScout] Worker is READY.');
            } else if (msg.type === 'SCRAPE_SUCCESS' || msg.type === 'SCRAPE_ERROR') {
                const resolver = this.pendingRequests.get(msg.requestId);
                if (resolver) {
                    if (msg.type === 'SCRAPE_SUCCESS') resolver.resolve(msg.data);
                    else resolver.reject(new Error(msg.error));
                    this.pendingRequests.delete(msg.requestId);
                }
            }
        });

        this.worker.on('exit', (code) => {
            console.warn(`[CompetitorScout] Worker died (Code: ${code}).`);

            // Reject all pending tasks
            for (const [id, resolver] of this.pendingRequests) {
                resolver.reject(new Error('Worker died'));
            }
            this.pendingRequests.clear();

            // SOTA Safety: Exponential Backoff prevention
            this.restartCount++;
            if (this.restartCount > this.maxRestarts) {
                console.error(`[CompetitorScout] 🚨 CRITIQUE: Worker crashed ${this.restartCount} times. Giving up.`);
                AgencyEventBus.publish('system.alert', { component: 'CompetitorScout', error: 'Max restarts exceeded' });
                return;
            }

            console.log(`[CompetitorScout] Restarting in ${this.backoffMs}ms (Attempt ${this.restartCount}/${this.maxRestarts})...`);
            setTimeout(() => {
                this._startWorker();
                this.backoffMs = Math.min(this.backoffMs * 2, 60000); // Cap at 60s
            }, this.backoffMs);
        });
    }

    _setupEventListeners() {
        AgencyEventBus.subscribe('scheduler.task_executed', async (event) => {
            // Check the task type inside the event payload
            if (event.payload && event.payload.taskType === 'competitor_scan') {
                const { competitorName, url } = event.payload.payload || {}; // Nested payload from job
                console.log(`[CompetitorScout] Received scan task for ${competitorName}`);
                if (url) {
                    await this.scout(competitorName, url);
                }
            }
        });
        console.log('[CompetitorScout] Listening for "competitor_scan" tasks');
    }

    ensureDataDir() {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
    }

    getHash(content) {
        return crypto.createHash('md5').update(content).digest('hex');
    }

    /**
     * Scout a specific competitor page
     * @param {string} competitorName - ID/Name of competitor
     * @param {string} url - URL to monitor
     */
    async scout(competitorName, url) {
        console.log(`[CompetitorScout] Scouting ${competitorName} (${url})...`);

        try {
            // Send task to worker
            const requestId = crypto.randomUUID();
            const promise = new Promise((resolve, reject) => {
                this.pendingRequests.set(requestId, { resolve, reject });
            });

            if (!this.worker || !this.worker.connected) {
                throw new Error('Worker not connected');
            }

            this.worker.send({ type: 'SCRAPE', payload: { url, id: requestId } });

            // Await worker result (IPC)
            const result = await promise;

            const snapshotPath = path.join(DATA_DIR, `${competitorName}.json`);

            let previous = null;
            if (fs.existsSync(snapshotPath)) {
                previous = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
            }

            const currentHash = this.getHash(result.markdown);

            const report = {
                competitorName,
                url,
                timestamp: new Date().toISOString(),
                hash: currentHash,
                title: result.title,
                markdown: result.markdown,
                changed: false,
                diffDetails: null
            };

            if (previous) {
                if (previous.hash !== currentHash) {
                    console.log(`[CompetitorScout] 🚨 CHANGE DETECTED for ${competitorName}!`);
                    report.changed = true;
                    report.diffDetails = `Content changed. Length: ${previous.markdown.length} -> ${result.markdown.length}`;

                    // SOTA Event: Trigger reaction
                    AgencyEventBus.publish('competitor.change_detected', report).catch(console.error);
                } else {
                    console.log(`[CompetitorScout] No change for ${competitorName}.`);
                }
            } else {
                console.log(`[CompetitorScout] Initial snapshot for ${competitorName}.`);
                report.changed = true;
            }

            fs.writeFileSync(snapshotPath, JSON.stringify(report, null, 2));
            return report;

        } catch (error) {
            console.error(`[CompetitorScout] Failed to scout ${competitorName}:`, error.message);
            return { error: error.message };
        }
    }

    async close() {
        if (this.worker) {
            this.worker.send({ type: 'SHUTDOWN' });
            // Wait a bit then kill if needed? 
            // process.kill(this.worker.pid);
        }
    }
}

// CLI
if (require.main === module) {
    (async () => {
        const scout = new CompetitorScout();
        const url = process.argv[3] || 'https://example.com'; // Arg 2 is name, 3 is URL
        const name = process.argv[2] || 'example_competitor';

        await scout.scout(name, url);
        await scout.close();
    })();
}

module.exports = CompetitorScout;
