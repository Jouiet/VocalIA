/**
 * Kling Service Bridge - VocalIA
 * Orchestrates Kling AI video generation (Internal-only)
 * Integrates with Remotion HITL for approval workflow.
 * 
 * SOTA Architecture:
 * - Spawns Python kling_generator.py for API calls
 * - Monitors task status via polling
 * - Updates HITL state
 */

const { spawn } = require('child_process');
const path = require('path');
const hitl = require('./remotion-hitl.cjs');

const PYTHON_SCRIPT = path.join(__dirname, '../scripts/kling_generator.py');

class KlingService {
    /**
     * Trigger a new Kling video generation (Queues for HITL first)
     */
    async queueAdVideo(prompt, options = {}) {
        const {
            language = 'fr',
            requestedBy = 'admin',
            duration = 5,
            aspectRatio = '16:9',
            mode = 'pro',
            negativePrompt = ''
        } = options;

        const item = hitl.queueVideo({
            type: 'kling_video',
            composition: 'KlingAd',
            language,
            props: {
                prompt,
                duration,
                aspectRatio,
                mode,
                negativePrompt,
                reference: 'VocalIA_Ads_2026'
            },
            requestedBy
        });

        console.log(`[KlingService] Ad video queued for approval: ${item.id}`);
        return item;
    }

    /**
     * Execute Kling generation after HITL approval
     */
    async generateApproved(id) {
        const video = hitl.getVideo(id);
        if (!video || video.type !== 'kling_video') {
            throw new Error(`Invalid or missing Kling task: ${id}`);
        }

        // 1. Submit to Kling API via Python
        const { prompt, duration, aspectRatio, mode, negativePrompt } = video.props;
        console.log(`[KlingService] Executing generation for ${id}...`);

        hitl.markGenerating(id);

        try {
            const taskId = await this._spawnKlingTask(prompt, { duration, aspectRatio, mode, negativePrompt });
            hitl.updateVideo(id, { externalTaskId: taskId });

            // 2. Start Polling for completion
            this._startPolling(id, taskId);

            return { success: true, taskId };
        } catch (error) {
            hitl.markFailed(id, error.message);
            throw error;
        }
    }

    /**
     * Private: Spawn Python task
     */
    async _spawnKlingTask(prompt, options = {}) {
        return new Promise((resolve, reject) => {
            // Factual Note: We use the Python script for its native PyJWT/requests handling
            const args = [PYTHON_SCRIPT, '--prompt', prompt];
            if (options.duration) args.push('--duration', String(options.duration));
            if (options.aspectRatio) args.push('--ratio', options.aspectRatio);
            if (options.mode) args.push('--mode', options.mode);
            if (options.negativePrompt) args.push('--negative-prompt', options.negativePrompt);

            const pyProcess = spawn('python3', args);

            let output = '';
            pyProcess.stdout.on('data', (data) => output += data.toString());
            pyProcess.stderr.on('data', (data) => console.error(`[Kling-Py-Error] ${data}`));

            pyProcess.on('close', (code) => {
                if (code !== 0) return reject(new Error(`Python process exited with code ${code}`));

                // Parse task ID from output (expects "TASK_ID: <id>")
                const match = output.match(/TASK_ID:\s*(\S+)/);
                if (match) {
                    resolve(match[1]);
                } else {
                    reject(new Error(`Kling bridge did not return task ID. Output: ${output}`));
                }
            });
        });
    }

    /**
     * Private: Polling loop with timeout
     */
    _startPolling(hitlId, externalId) {
        let attempts = 0;
        let polling = false;
        const MAX_ATTEMPTS = 60;

        const interval = setInterval(async () => {
            if (polling) return;
            polling = true;
            attempts++;
            try {
                const status = await this.getTaskStatus(externalId);

                if (status.state === 'COMPLETED') {
                    console.log(`[KlingService] Task ${externalId} Completed for ${hitlId}`);
                    hitl.markCompleted(hitlId, status.videoUrl);
                    clearInterval(interval);
                } else if (status.state === 'FAILED') {
                    console.error(`[KlingService] Task ${externalId} Failed for ${hitlId}: ${status.error}`);
                    hitl.markFailed(hitlId, status.error);
                    clearInterval(interval);
                } else if (attempts >= MAX_ATTEMPTS) {
                    console.error(`[KlingService] Polling timeout for ${hitlId} after ${MAX_ATTEMPTS} attempts`);
                    hitl.markFailed(hitlId, 'Generation timeout after 30 minutes');
                    clearInterval(interval);
                }
            } catch (error) {
                console.error(`[KlingService] Polling error for ${hitlId}:`, error.message);
            } finally {
                polling = false;
            }
        }, 30000);
    }

    /**
     * Get task status via Python bridge
     */
    async getTaskStatus(taskId) {
        return new Promise((resolve) => {
            const pyProcess = spawn('python3', [PYTHON_SCRIPT, '--status', taskId]);
            let stdout = '';
            let stderr = '';
            pyProcess.stdout.on('data', (data) => stdout += data.toString());
            pyProcess.stderr.on('data', (data) => stderr += data.toString());
            pyProcess.on('close', (code) => {
                if (code !== 0) {
                    if (stderr) console.error(`[Kling-Status-Err] ${stderr}`);
                    return resolve({ state: 'PENDING' });
                }
                try {
                    resolve(JSON.parse(stdout));
                } catch (e) {
                    console.error(`[KlingService] Failed to parse status output: ${stdout.substring(0, 200)}`);
                    resolve({ state: 'PENDING' });
                }
            });
        });
    }
}

module.exports = new KlingService();
