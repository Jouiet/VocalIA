#!/usr/bin/env node
/**
 * VocalIA Production Health Monitor
 *
 * Probes all production endpoints and reports status.
 * Sends alerts via Slack webhook if any endpoint is down.
 *
 * Usage:
 *   node scripts/production-monitor.cjs              # One-shot check
 *   node scripts/production-monitor.cjs --loop 60    # Check every 60s
 *   SLACK_WEBHOOK=https://... node scripts/production-monitor.cjs  # With Slack alerts
 *
 * Crontab example (every 5 minutes):
 *   0,5,10,15,20,25,30,35,40,45,50,55 * * * * node scripts/production-monitor.cjs
 *
 * @version 1.0.0
 * @date 2026-02-06
 */

'use strict';

const ENDPOINTS = [
  {
    name: 'Website',
    url: 'https://vocalia.ma',
    expectedStatus: [200, 301, 302],
    timeout: 10000
  },
  {
    name: 'Voice API',
    url: 'https://api.vocalia.ma/health',
    expectedStatus: [200],
    timeout: 5000
  },
  {
    name: 'Voice API Respond',
    url: 'https://api.vocalia.ma/respond',
    method: 'OPTIONS',
    expectedStatus: [200, 204],
    timeout: 5000
  }
];

const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK || process.env.SLACK_MONITOR_WEBHOOK;
const ALERT_COOLDOWN_MS = 15 * 60 * 1000; // 15 min between repeat alerts
const lastAlerts = new Map();

async function checkEndpoint(endpoint) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), endpoint.timeout);

    const response = await fetch(endpoint.url, {
      method: endpoint.method || 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'VocalIA-Monitor/1.0' }
    });

    clearTimeout(timer);
    const latency = Date.now() - start;
    const ok = endpoint.expectedStatus.includes(response.status);

    return {
      name: endpoint.name,
      url: endpoint.url,
      status: response.status,
      latency,
      ok,
      error: ok ? null : `Unexpected status ${response.status}`
    };
  } catch (error) {
    return {
      name: endpoint.name,
      url: endpoint.url,
      status: 0,
      latency: Date.now() - start,
      ok: false,
      error: error.name === 'AbortError' ? 'Timeout' : error.message
    };
  }
}

async function sendSlackAlert(results) {
  if (!SLACK_WEBHOOK) return;

  const failures = results.filter(r => !r.ok);
  if (failures.length === 0) return;

  // Check cooldown
  const alertKey = failures.map(f => f.name).sort().join(',');
  const lastAlert = lastAlerts.get(alertKey);
  if (lastAlert && Date.now() - lastAlert < ALERT_COOLDOWN_MS) return;
  lastAlerts.set(alertKey, Date.now());

  const blocks = failures.map(f =>
    `*${f.name}* (${f.url}): ${f.error || 'DOWN'} [${f.latency}ms]`
  );

  const payload = {
    text: `🚨 VocalIA Monitor Alert`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🚨 *VocalIA Production Alert*\n${failures.length} endpoint(s) DOWN:\n\n${blocks.join('\n')}`
        }
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `_${new Date().toISOString()}_` }]
      }
    ]
  };

  try {
    await fetch(SLACK_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log('  [Slack] Alert sent');
  } catch (e) {
    console.error(`  [Slack] Failed to send alert: ${e.message}`);
  }
}

async function runCheck() {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] VocalIA Health Probe`);

  const results = await Promise.all(ENDPOINTS.map(checkEndpoint));

  let allOk = true;
  for (const r of results) {
    const icon = r.ok ? '✅' : '❌';
    const latency = r.latency < 1000 ? `${r.latency}ms` : `${(r.latency / 1000).toFixed(1)}s`;
    console.log(`  ${icon} ${r.name.padEnd(20)} ${String(r.status).padEnd(4)} ${latency}${r.error ? ` — ${r.error}` : ''}`);
    if (!r.ok) allOk = false;
  }

  if (!allOk) {
    await sendSlackAlert(results);
  }

  return { results, allOk, timestamp };
}

// Main
(async () => {
  const loopArg = process.argv.indexOf('--loop');

  if (loopArg !== -1) {
    const intervalSec = parseInt(process.argv[loopArg + 1]) || 60;
    console.log(`Starting monitoring loop (every ${intervalSec}s). CTRL+C to stop.`);
    if (SLACK_WEBHOOK) console.log('Slack alerts: ENABLED');
    else console.log('Slack alerts: disabled (set SLACK_WEBHOOK env)');

    while (true) {
      await runCheck();
      await new Promise(r => setTimeout(r, intervalSec * 1000));
    }
  } else {
    const { allOk } = await runCheck();

    if (!SLACK_WEBHOOK) {
      console.log('\n  Tip: Set SLACK_WEBHOOK env var to enable Slack alerts');
    }

    process.exit(allOk ? 0 : 1);
  }
})();
