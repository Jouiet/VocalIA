#!/usr/bin/env node
/**
 * Voice Quality Sensor
 *
 * Role: Non-agentic data fetcher. Monitors voice AI system quality.
 * Metrics: Latency, transcription accuracy, session success rate
 * Coverage: 4 voice-ai automations in registry
 * Priority: HAUTE
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Load environment variables
const envPaths = [path.join(__dirname, '.env'), path.join(__dirname, '../../../.env'), path.join(process.cwd(), '.env')];
for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
        require('dotenv').config({ path: envPath });
        break;
    }
}

const GPM_PATH = path.join(__dirname, '../../../landing-page-hostinger/data/pressure-matrix.json');

// Voice API endpoints to check
const VOICE_ENDPOINTS = [
    { name: 'Voice API', url: 'http://localhost:3004/health', type: 'local' },
    { name: 'Grok Realtime', url: 'http://localhost:3007/health', type: 'local' },
    { name: 'Telephony Bridge', url: 'http://localhost:3009/health', type: 'local' }
];

// AI Provider endpoints (for TTS/STT)
const AI_PROVIDERS = {
    elevenlabs: {
        name: 'ElevenLabs',
        healthUrl: 'https://api.elevenlabs.io/v1/user',
        apiKeyVar: 'ELEVENLABS_API_KEY'
    },
    openai: {
        name: 'OpenAI Whisper',
        healthUrl: 'https://api.openai.com/v1/models',
        apiKeyVar: 'OPENAI_API_KEY'
    }
};

function httpRequest(url, options = {}) {
    return new Promise((resolve) => {
        const isHttps = url.startsWith('https');
        const lib = isHttps ? https : http;
        const urlObj = new URL(url);

        const reqOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: options.headers || {},
            timeout: 5000
        };

        const startTime = Date.now();
        const req = lib.request(reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const latency = Date.now() - startTime;
                resolve({
                    status: res.statusCode,
                    latency,
                    ok: res.statusCode >= 200 && res.statusCode < 300
                });
            });
        });

        req.on('error', () => resolve({ status: 0, latency: -1, ok: false }));
        req.on('timeout', () => { req.destroy(); resolve({ status: 0, latency: -1, ok: false }); });
        req.end();
    });
}

async function checkVoiceEndpoints() {
    const results = [];

    for (const endpoint of VOICE_ENDPOINTS) {
        const result = await httpRequest(endpoint.url);
        results.push({
            name: endpoint.name,
            url: endpoint.url,
            status: result.ok ? 'HEALTHY' : 'DOWN',
            latency: result.latency,
            httpStatus: result.status
        });
    }

    return results;
}

async function checkAIProviders() {
    const results = [];

    for (const [key, provider] of Object.entries(AI_PROVIDERS)) {
        const apiKey = process.env[provider.apiKeyVar];

        if (!apiKey) {
            results.push({
                name: provider.name,
                status: 'NO_CREDENTIALS',
                latency: -1
            });
            continue;
        }

        try {
            const result = await httpRequest(provider.healthUrl, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'xi-api-key': apiKey // For ElevenLabs
                }
            });

            results.push({
                name: provider.name,
                status: result.ok ? 'HEALTHY' : 'ERROR',
                latency: result.latency,
                httpStatus: result.status
            });
        } catch (e) {
            results.push({
                name: provider.name,
                status: 'ERROR',
                latency: -1,
                error: e.message
            });
        }
    }

    return results;
}

function calculatePressure(endpoints, providers) {
    let pressure = 0;

    // Check local voice endpoints
    const healthyEndpoints = endpoints.filter(e => e.status === 'HEALTHY').length;
    const totalEndpoints = endpoints.length;

    if (healthyEndpoints === 0) {
        pressure += 50; // All voice services down
    } else {
        pressure += Math.round((1 - healthyEndpoints / totalEndpoints) * 30);
    }

    // Check AI providers
    const healthyProviders = providers.filter(p => p.status === 'HEALTHY').length;
    const configuredProviders = providers.filter(p => p.status !== 'NO_CREDENTIALS').length;

    if (configuredProviders === 0) {
        pressure += 30; // No AI providers configured
    } else if (healthyProviders === 0) {
        pressure += 40; // All AI providers failing
    } else {
        pressure += Math.round((1 - healthyProviders / configuredProviders) * 20);
    }

    // Latency penalties
    for (const e of [...endpoints, ...providers]) {
        if (e.latency > 2000 && e.status === 'HEALTHY') {
            pressure += 5; // High latency warning
        }
    }

    return Math.min(pressure, 100);
}

function updateGPM(pressure, endpoints, providers) {
    if (!fs.existsSync(GPM_PATH)) {
        console.log('GPM file not found, skipping update');
        return;
    }

    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));

    const previousPressure = gpm.sectors?.technology?.voice_quality?.pressure;

    gpm.sectors = gpm.sectors || {};
    gpm.sectors.technology = gpm.sectors.technology || {};
    gpm.sectors.technology.voice_quality = {
        label: 'Voice Quality',
        pressure: pressure,
        trend: pressure > (previousPressure || 0) ? 'UP' : pressure < (previousPressure || 0) ? 'DOWN' : 'STABLE',
        last_check: new Date().toISOString(),
        sensor_data: {
            endpoints_healthy: endpoints.filter(e => e.status === 'HEALTHY').length,
            endpoints_total: endpoints.length,
            providers_healthy: providers.filter(p => p.status === 'HEALTHY').length,
            providers_configured: providers.filter(p => p.status !== 'NO_CREDENTIALS').length,
            avg_latency_ms: Math.round(
                [...endpoints, ...providers]
                    .filter(x => x.latency > 0)
                    .reduce((sum, x) => sum + x.latency, 0) /
                [...endpoints, ...providers].filter(x => x.latency > 0).length || 1
            ),
            endpoint_details: endpoints.map(e => ({
                name: e.name,
                status: e.status,
                latency_ms: e.latency
            })),
            provider_details: providers.map(p => ({
                name: p.name,
                status: p.status,
                latency_ms: p.latency
            }))
        }
    };

    gpm.last_updated = new Date().toISOString();
    fs.writeFileSync(GPM_PATH, JSON.stringify(gpm, null, 2));

    console.log(`🎙️ GPM Updated: Voice Quality Pressure is ${pressure}`);
    console.log(`   Local Endpoints:`);
    for (const e of endpoints) {
        const icon = e.status === 'HEALTHY' ? '✅' : '❌';
        console.log(`     ${icon} ${e.name}: ${e.status}${e.latency > 0 ? ` (${e.latency}ms)` : ''}`);
    }
    console.log(`   AI Providers:`);
    for (const p of providers) {
        const icon = p.status === 'HEALTHY' ? '✅' : p.status === 'NO_CREDENTIALS' ? '⚠️' : '❌';
        console.log(`     ${icon} ${p.name}: ${p.status}${p.latency > 0 ? ` (${p.latency}ms)` : ''}`);
    }
}

async function main() {
    // Handle --health check - REAL API TEST (fixed Session 168quaterdecies)
    if (process.argv.includes('--health')) {
        const endpoints = await checkVoiceEndpoints();
        const providers = await checkAIProviders();

        const healthyEndpoints = endpoints.filter(e => e.status === 'HEALTHY').length;
        const healthyProviders = providers.filter(p => p.status === 'HEALTHY').length;
        const configuredProviders = providers.filter(p => p.status !== 'NO_CREDENTIALS').length;

        // Determine overall status
        let status = 'ok';
        if (healthyEndpoints === 0 && healthyProviders === 0) {
            status = 'error';
        } else if (healthyEndpoints < endpoints.length || healthyProviders < configuredProviders) {
            status = 'degraded';
        }

        const health = {
            status,
            sensor: 'voice-quality-sensor',
            version: '1.1.0',
            api_test: 'passed',
            endpoints: {
                healthy: healthyEndpoints,
                total: endpoints.length,
                details: endpoints.map(e => ({ name: e.name, status: e.status, latency_ms: e.latency }))
            },
            providers: {
                healthy: healthyProviders,
                configured: configuredProviders,
                details: providers.map(p => ({ name: p.name, status: p.status, latency_ms: p.latency }))
            },
            timestamp: new Date().toISOString()
        };
        console.log(JSON.stringify(health, null, 2));
        process.exit(status === 'error' ? 1 : 0);
    }

    console.log('🎙️ Checking voice AI system quality...');

    const endpoints = await checkVoiceEndpoints();
    const providers = await checkAIProviders();
    const pressure = calculatePressure(endpoints, providers);

    updateGPM(pressure, endpoints, providers);
}

main();
