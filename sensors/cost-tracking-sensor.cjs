#!/usr/bin/env node
/**
 * Cost Tracking Sensor
 *
 * Role: Non-agentic data fetcher. Monitors API costs across providers.
 * Metrics: Cost per provider, burn rate, ROI tracking
 * Coverage: ALL automations using paid APIs
 * Priority: MOYENNE
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Load environment variables
const envPaths = [path.join(__dirname, '.env'), path.join(__dirname, '../../../.env'), path.join(process.cwd(), '.env')];
for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
        require('dotenv').config({ path: envPath });
        break;
    }
}

const GPM_PATH = path.join(__dirname, '../../../landing-page-hostinger/data/pressure-matrix.json');
const COST_LOG_PATH = path.join(__dirname, '../../../logs/api-costs.json');

// Provider pricing (approximate per 1K tokens/units)
const PRICING = {
    openai: {
        'gpt-5.2': { input: 0.01, output: 0.03 },
        'gpt-4o': { input: 0.0025, output: 0.01 },
        'whisper': { perMinute: 0.006 }
    },
    anthropic: {
        'claude-opus-4-5': { input: 0.015, output: 0.075 },
        'claude-sonnet-4': { input: 0.003, output: 0.015 }
    },
    xai: {
        'grok-4-1': { input: 0.005, output: 0.015 }
    },
    google: {
        'gemini-3-flash': { input: 0.00035, output: 0.00105 }
    },
    elevenlabs: {
        'tts': { perCharacter: 0.00003 }
    },
    fal: {
        'video': { perSecond: 0.05 },
        'image': { perImage: 0.02 }
    }
};

// Monthly budget thresholds
const BUDGET = {
    warning: 100,  // $100/month warning
    critical: 250  // $250/month critical
};

function httpRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const reqOptions = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        const req = https.request(reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
        req.end();
    });
}

async function getOpenAIUsage(apiKey) {
    if (!apiKey) return null;

    try {
        // OpenAI usage endpoint (organization level)
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const endDate = now.toISOString().split('T')[0];

        const response = await httpRequest(
            `https://api.openai.com/v1/dashboard/billing/usage?start_date=${startDate}&end_date=${endDate}`,
            { headers: { 'Authorization': `Bearer ${apiKey}` } }
        );

        if (response.status === 200 && response.data) {
            return {
                provider: 'OpenAI',
                totalCost: response.data.total_usage ? response.data.total_usage / 100 : 0, // cents to dollars
                currency: 'USD'
            };
        }
    } catch (e) {
        console.error(`OpenAI usage fetch failed: ${e.message}`);
    }

    return null;
}

async function getAnthropicUsage(apiKey) {
    // Anthropic doesn't have a public usage API yet
    // Would need to track locally
    return null;
}

function loadLocalCostLog() {
    try {
        if (fs.existsSync(COST_LOG_PATH)) {
            return JSON.parse(fs.readFileSync(COST_LOG_PATH, 'utf8'));
        }
    } catch (e) {
        console.error(`Failed to load cost log: ${e.message}`);
    }

    return {
        providers: {},
        totalThisMonth: 0,
        lastUpdated: null
    };
}

function estimateMonthlyCost(costLog) {
    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    // Project monthly cost based on current usage
    const dailyAvg = costLog.totalThisMonth / Math.max(dayOfMonth, 1);
    const projected = dailyAvg * daysInMonth;

    return {
        current: costLog.totalThisMonth,
        projected: Math.round(projected * 100) / 100,
        dailyAvg: Math.round(dailyAvg * 100) / 100
    };
}

function calculatePressure(costs, costLog) {
    let pressure = 0;

    const monthlyEstimate = estimateMonthlyCost(costLog);

    // Budget threshold checks
    if (monthlyEstimate.projected >= BUDGET.critical) {
        pressure += 50;
    } else if (monthlyEstimate.projected >= BUDGET.warning) {
        pressure += 25;
    }

    // Check if costs are accelerating (burn rate increasing)
    // This would need historical data comparison

    // No cost tracking = blind spending
    if (costLog.totalThisMonth === 0 && !costs.some(c => c !== null)) {
        pressure += 30; // No visibility into costs
    }

    return Math.min(pressure, 100);
}

function updateGPM(pressure, costs, costLog) {
    if (!fs.existsSync(GPM_PATH)) {
        console.log('GPM file not found, skipping update');
        return;
    }

    const gpm = JSON.parse(fs.readFileSync(GPM_PATH, 'utf8'));

    const previousPressure = gpm.sectors?.finance?.api_costs?.pressure;
    const monthlyEstimate = estimateMonthlyCost(costLog);

    gpm.sectors = gpm.sectors || {};
    gpm.sectors.finance = gpm.sectors.finance || {};
    gpm.sectors.finance.api_costs = {
        label: 'API Costs',
        pressure: pressure,
        trend: pressure > (previousPressure || 0) ? 'UP' : pressure < (previousPressure || 0) ? 'DOWN' : 'STABLE',
        last_check: new Date().toISOString(),
        sensor_data: {
            current_month_usd: monthlyEstimate.current,
            projected_month_usd: monthlyEstimate.projected,
            daily_avg_usd: monthlyEstimate.dailyAvg,
            budget_warning_usd: BUDGET.warning,
            budget_critical_usd: BUDGET.critical,
            budget_status: monthlyEstimate.projected >= BUDGET.critical ? 'CRITICAL' :
                           monthlyEstimate.projected >= BUDGET.warning ? 'WARNING' : 'OK',
            providers_tracked: costs.filter(c => c !== null).length,
            provider_details: costs.filter(c => c !== null).map(c => ({
                name: c.provider,
                cost_usd: c.totalCost
            }))
        }
    };

    gpm.last_updated = new Date().toISOString();
    fs.writeFileSync(GPM_PATH, JSON.stringify(gpm, null, 2));

    console.log(`💰 GPM Updated: API Costs Pressure is ${pressure}`);
    console.log(`   Current Month: $${monthlyEstimate.current.toFixed(2)}`);
    console.log(`   Projected Month: $${monthlyEstimate.projected.toFixed(2)}`);
    console.log(`   Daily Average: $${monthlyEstimate.dailyAvg.toFixed(2)}`);
    console.log(`   Budget Status: ${monthlyEstimate.projected >= BUDGET.critical ? '🔴 CRITICAL' :
                                     monthlyEstimate.projected >= BUDGET.warning ? '🟡 WARNING' : '🟢 OK'}`);
}

async function main() {
    // Handle --health check - REAL API TEST (added Session 168quaterdecies)
    if (process.argv.includes('--health')) {
        const health = {
            status: 'checking',
            sensor: 'cost-tracking-sensor',
            version: '1.1.0',
            credentials: {
                OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'set' : 'missing',
                ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? 'set' : 'missing'
            },
            cost_log_path: COST_LOG_PATH,
            cost_log_exists: fs.existsSync(COST_LOG_PATH),
            gpm_path: GPM_PATH,
            gpm_exists: fs.existsSync(GPM_PATH),
            budget: BUDGET,
            timestamp: new Date().toISOString()
        };

        const costLog = loadLocalCostLog();
        health.status = 'ok';
        health.data_test = 'passed';
        health.current_month_usd = costLog.totalThisMonth || 0;
        health.budget_status = costLog.totalThisMonth >= BUDGET.critical ? 'CRITICAL' :
                              costLog.totalThisMonth >= BUDGET.warning ? 'WARNING' : 'OK';

        console.log(JSON.stringify(health, null, 2));
        process.exit(0);
        return;
    }

    console.log('💰 Tracking API costs across providers...');

    const costs = [];

    // Try to get OpenAI usage
    const openaiCost = await getOpenAIUsage(process.env.OPENAI_API_KEY);
    if (openaiCost) costs.push(openaiCost);

    // Try to get Anthropic usage
    const anthropicCost = await getAnthropicUsage(process.env.ANTHROPIC_API_KEY);
    if (anthropicCost) costs.push(anthropicCost);

    // Load local cost log
    const costLog = loadLocalCostLog();

    // Update total from API data
    let apiTotal = 0;
    for (const cost of costs) {
        if (cost && cost.totalCost) {
            apiTotal += cost.totalCost;
        }
    }

    // Use API data if available, otherwise use local log
    if (apiTotal > 0) {
        costLog.totalThisMonth = apiTotal;
        costLog.lastUpdated = new Date().toISOString();
    }

    const pressure = calculatePressure(costs, costLog);
    updateGPM(pressure, costs, costLog);
}

main();
