/**
 * Veo 3.1 Service Bridge - VocalIA
 * Orchestrates Google Veo 3.1 video generation via Vertex AI API.
 * Integrates with Remotion HITL for approval workflow.
 *
 * Architecture:
 * - Spawns Python veo_generator.py for authenticated Vertex AI calls
 * - Polls long-running operations for completion
 * - Downloads generated video from GCS URI
 * - Updates HITL state throughout lifecycle
 *
 * FACT: Veo 3.1 returns a long-running operation (LRO), not a direct task ID.
 * Polling checks operation.done, then extracts video URI from response.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const hitl = require('./remotion-hitl.cjs');

const PYTHON_SCRIPT = path.join(__dirname, '../scripts/veo_generator.py');
const OUTPUT_DIR = path.join(__dirname, '../data/remotion-hitl/outputs');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

class VeoService {
    /**
     * Queue a Veo 3.1 video for HITL approval.
     * @param {string} prompt - The video generation prompt
     * @param {object} options - Generation options
     * @param {string} options.language - Language code (default: 'fr')
     * @param {string} options.requestedBy - Requester identity
     * @param {string} options.aspectRatio - '16:9' or '9:16' (default: '16:9')
     * @param {string} options.resolution - '720p' or '1080p' (default: '1080p')
     * @param {number} options.duration - 4, 6, or 8 seconds (default: 8)
     * @param {boolean} options.generateAudio - Enable native audio (default: true)
     * @param {string} options.negativePrompt - Elements to exclude
     */
    async queueAdVideo(prompt, options = {}) {
        const {
            language = 'fr',
            requestedBy = 'admin',
            aspectRatio = '16:9',
            resolution = '1080p',
            duration = 8,
            generateAudio = true,
            negativePrompt = ''
        } = options;

        const item = hitl.queueVideo({
            type: 'veo_video',
            composition: 'VeoAd',
            language,
            props: {
                prompt,
                aspectRatio,
                resolution,
                duration,
                generateAudio,
                negativePrompt,
                reference: 'VocalIA_Veo31_Ads'
            },
            requestedBy
        });

        console.log(`[VeoService] Video queued for approval: ${item.id}`);
        return item;
    }

    /**
     * Execute Veo 3.1 generation after HITL approval.
     * Spawns Python bridge → Vertex AI → polls LRO → downloads result.
     */
    async generateApproved(id) {
        const video = hitl.getVideo(id);
        if (!video || video.type !== 'veo_video') {
            throw new Error(`Invalid or missing Veo task: ${id}`);
        }

        const { prompt, aspectRatio, resolution, duration, generateAudio, negativePrompt } = video.props;
        console.log(`[VeoService] Executing Veo 3.1 generation for ${id}...`);

        hitl.markGenerating(id);

        try {
            const operationName = await this._spawnVeoTask(prompt, {
                aspectRatio,
                resolution,
                duration,
                generateAudio,
                negativePrompt
            });

            hitl.updateVideo(id, { externalTaskId: operationName });

            // Start polling the long-running operation
            this._startPolling(id, operationName);

            return { success: true, operationName };
        } catch (error) {
            hitl.markFailed(id, error.message);
            throw error;
        }
    }

    /**
     * Spawn Python veo_generator.py with generation parameters.
     * Returns the Vertex AI operation name (LRO identifier).
     */
    async _spawnVeoTask(prompt, options = {}) {
        return new Promise((resolve, reject) => {
            const args = [
                PYTHON_SCRIPT,
                '--generate',
                '--prompt', prompt
            ];

            if (options.aspectRatio) {
                args.push('--aspect-ratio', options.aspectRatio);
            }
            if (options.resolution) {
                args.push('--resolution', options.resolution);
            }
            if (options.duration) {
                args.push('--duration', String(options.duration));
            }
            if (options.generateAudio === false) {
                args.push('--no-audio');
            }
            if (options.negativePrompt) {
                args.push('--negative-prompt', options.negativePrompt);
            }

            const pyProcess = spawn('python3', args);

            let stdout = '';
            let stderr = '';
            pyProcess.stdout.on('data', (data) => stdout += data.toString());
            pyProcess.stderr.on('data', (data) => {
                stderr += data.toString();
                console.error(`[Veo-Py-Err] ${data}`);
            });

            pyProcess.on('close', (code) => {
                if (code !== 0) {
                    return reject(new Error(`Veo Python bridge exited with code ${code}: ${stderr}`));
                }

                // Parse operation name from output (expects "OPERATION: <name>")
                const match = stdout.match(/OPERATION:\s*(.+)/);
                if (match) {
                    resolve(match[1].trim());
                } else {
                    reject(new Error(`Veo bridge did not return operation name. Output: ${stdout}`));
                }
            });
        });
    }

    /**
     * Poll a long-running operation until done or failed.
     * Vertex AI LRO pattern: check operation.done === true, then extract video.
     */
    _startPolling(hitlId, operationName) {
        let attempts = 0;
        let polling = false;
        const MAX_ATTEMPTS = 60;

        const interval = setInterval(async () => {
            if (polling) return;
            polling = true;
            attempts++;
            try {
                const status = await this.getTaskStatus(operationName);

                if (status.done && status.videoUri) {
                    console.log(`[VeoService] Operation completed for ${hitlId}: ${status.videoUri}`);

                    // Download video from GCS to local output
                    const localPath = await this._downloadVideo(hitlId, status.videoUri);
                    hitl.markCompleted(hitlId, localPath || status.videoUri);
                    clearInterval(interval);

                } else if (status.done && status.error) {
                    console.error(`[VeoService] Operation failed for ${hitlId}: ${status.error}`);
                    hitl.markFailed(hitlId, status.error);
                    clearInterval(interval);

                } else if (attempts >= MAX_ATTEMPTS) {
                    console.error(`[VeoService] Polling timeout for ${hitlId} after ${MAX_ATTEMPTS} attempts`);
                    hitl.markFailed(hitlId, 'Generation timeout after 30 minutes');
                    clearInterval(interval);
                }
                // else: still processing, continue polling
            } catch (error) {
                console.error(`[VeoService] Polling error for ${hitlId}:`, error.message);
            } finally {
                polling = false;
            }
        }, 30000);
    }

    /**
     * Check the status of a Vertex AI long-running operation.
     * Returns { done: boolean, videoUri?: string, error?: string }
     */
    async getTaskStatus(operationName) {
        return new Promise((resolve) => {
            const pyProcess = spawn('python3', [
                PYTHON_SCRIPT,
                '--status', operationName
            ]);

            let stdout = '';
            pyProcess.stdout.on('data', (data) => stdout += data.toString());
            pyProcess.stderr.on('data', (data) => console.error(`[Veo-Status-Err] ${data}`));

            pyProcess.on('close', (code) => {
                if (code !== 0) {
                    return resolve({ done: false });
                }

                try {
                    resolve(JSON.parse(stdout));
                } catch (e) {
                    console.error(`[VeoService] Failed to parse status output: ${stdout.substring(0, 200)}`);
                    resolve({ done: false });
                }
            });
        });
    }

    /**
     * Download a generated video from GCS URI to local storage.
     * Uses gsutil via Python bridge for authenticated download.
     */
    async _downloadVideo(hitlId, gcsUri) {
        const outputPath = path.join(OUTPUT_DIR, `${hitlId}.mp4`);

        return new Promise((resolve) => {
            const pyProcess = spawn('python3', [
                PYTHON_SCRIPT,
                '--download', gcsUri,
                '--output', outputPath
            ]);

            let stderr = '';
            pyProcess.stderr.on('data', (data) => stderr += data.toString());

            pyProcess.on('close', (code) => {
                if (code === 0 && fs.existsSync(outputPath)) {
                    console.log(`[VeoService] Video downloaded: ${outputPath}`);
                    resolve(outputPath);
                } else {
                    console.error(`[VeoService] Download failed: ${stderr}`);
                    // Return GCS URI as fallback — video exists but download failed
                    resolve(null);
                }
            });
        });
    }
}

module.exports = new VeoService();
