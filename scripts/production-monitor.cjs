#!/usr/bin/env node
/**
 * VocalIA Production Health Monitor v3.0
 *
 * Checks:
 *   - 7 HTTP endpoints WITH response body validation
 *   - 7 Docker containers (6 VocalIA + Traefik gateway)
 *   - Disk usage (root + vocalia-data breakdown, throttled to 1x/day)
 *   - Memory usage
 *   - SSL certificate expiry (api.vocalia.ma)
 *   - Docker daemon reachability
 *   - vocalia-data volume mount integrity
 *   - Container restart delta (new restarts since last check)
 *
 * State tracking:
 *   - Previous state comparison for DOWN/UP transitions
 *   - Recovery notifications ("service X is back up")
 *   - Restart count delta (not cumulative)
 *
 * Output: Console + JSONL + status.json
 * Alerts: ntfy.sh push (free, zero signup, 15min cooldown)
 *
 * Crontab (every 5 min):
 *   NTFY_TOPIC=vocalia-xxx /usr/bin/node /docker/vocalia/monitor.cjs >> /vocalia-data/monitoring/cron.log 2>&1
 *
 * @version 3.0.0
 * @date 2026-02-12
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ─── Configuration ───────────────────────────────────────────

const MONITORING_DIR = process.env.MONITORING_DIR || '/vocalia-data/monitoring';
const JSONL_PATH = path.join(MONITORING_DIR, 'checks.jsonl');
const STATUS_PATH = path.join(MONITORING_DIR, 'status.json');
const STATE_PATH = path.join(MONITORING_DIR, 'previous-state.json');
const COOLDOWN_PATH = path.join(MONITORING_DIR, 'alert-cooldown.json');
const BREAKDOWN_PATH = path.join(MONITORING_DIR, 'last-breakdown.json');
const MAX_LOG_BYTES = 5 * 1024 * 1024; // 5MB
const CRON_LOG_PATH = path.join(MONITORING_DIR, 'cron.log');

const NTFY_TOPIC = process.env.NTFY_TOPIC || '';
const NTFY_URL = `https://ntfy.sh/${NTFY_TOPIC}`;
const ALERT_COOLDOWN_MS = 15 * 60 * 1000; // 15 min
const COOLDOWN_PURGE_MS = 24 * 60 * 60 * 1000; // 24h

const DISK_WARN_PERCENT = 85;
const DISK_CRITICAL_PERCENT = 92;
const MEMORY_WARN_PERCENT = 90;
const DISK_BREAKDOWN_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1x/day (slow I/O)
const SSL_WARN_DAYS = 14;

const API_BASE = 'https://api.vocalia.ma';

// Each endpoint defines expected body field for deep validation
const ENDPOINTS = [
  { name: 'Website',    url: 'https://vocalia.ma',            expect: [200, 301, 302], timeout: 10000, bodyCheck: null },
  { name: 'Voice API',  url: `${API_BASE}/health`,            expect: [200],           timeout: 5000,  bodyCheck: 'healthy' },
  { name: 'DB API',     url: `${API_BASE}/api/db/health`,     expect: [200],           timeout: 5000,  bodyCheck: 'status' },
  { name: 'Realtime',   url: `${API_BASE}/realtime/health`,   expect: [200],           timeout: 5000,  bodyCheck: 'status' },
  { name: 'Telephony',  url: `${API_BASE}/telephony/health`,  expect: [200],           timeout: 5000,  bodyCheck: 'status' },
  { name: 'HITL',       url: `${API_BASE}/hitl/health`,       expect: [200],           timeout: 5000,  bodyCheck: 'status' },
  { name: 'OAuth',      url: `${API_BASE}/oauth/providers`,   expect: [200],           timeout: 5000,  bodyCheck: 'providers' },
];

// 6 VocalIA containers + Traefik gateway
const CONTAINERS = [
  'vocalia-api',
  'vocalia-db-api',
  'vocalia-realtime',
  'vocalia-telephony',
  'vocalia-hitl',
  'vocalia-oauth',
  'root-traefik-1',
];

// ─── Helpers ─────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function exec(cmd, timeoutMs = 10000) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: timeoutMs }).trim();
  } catch {
    return null;
  }
}

function loadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

// ─── HTTP Endpoint Checks (with body validation) ────────────

async function checkEndpoint(ep) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ep.timeout);

    const res = await fetch(ep.url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'VocalIA-Monitor/3.0' },
    });

    clearTimeout(timer);
    const latency = Date.now() - start;
    const statusOk = ep.expect.includes(res.status);

    // Deep body validation — 200 alone is NOT enough
    let bodyOk = true;
    let bodyError = null;

    if (statusOk && ep.bodyCheck) {
      try {
        const body = await res.json();
        const field = ep.bodyCheck;

        if (field === 'healthy') {
          // Voice API: { healthy: true }
          bodyOk = body.healthy === true;
          if (!bodyOk) bodyError = `body.healthy=${body.healthy}`;
        } else if (field === 'status') {
          // DB/Realtime/Telephony/HITL: { status: "ok"|"healthy" }
          bodyOk = body.status === 'ok' || body.status === 'healthy';
          if (!bodyOk) bodyError = `body.status="${body.status}"`;
        } else if (field === 'providers') {
          // OAuth: { providers: [...] }
          bodyOk = Array.isArray(body.providers) && body.providers.length > 0;
          if (!bodyOk) bodyError = 'body.providers empty or missing';
        }
      } catch (parseErr) {
        bodyOk = false;
        bodyError = `JSON parse: ${parseErr.message}`;
      }
    } else if (statusOk && !ep.bodyCheck) {
      // Website — just consume the body to avoid leaks
      try { await res.text(); } catch { /* ignore */ }
    }

    const ok = statusOk && bodyOk;

    return {
      name: ep.name,
      url: ep.url,
      status: res.status,
      latency,
      ok,
      error: !statusOk ? `HTTP ${res.status}` : bodyError,
    };
  } catch (err) {
    return {
      name: ep.name,
      url: ep.url,
      status: 0,
      latency: Date.now() - start,
      ok: false,
      error: err.name === 'AbortError' ? `Timeout (${ep.timeout}ms)` : err.message,
    };
  }
}

async function checkAllEndpoints() {
  return Promise.all(ENDPOINTS.map(checkEndpoint));
}

// ─── Docker Daemon Check ────────────────────────────────────

function checkDockerDaemon() {
  const raw = exec('docker info --format "{{.ServerVersion}}" 2>/dev/null', 5000);
  return { reachable: !!raw, version: raw || 'unreachable' };
}

// ─── Docker Container Checks (with uptime + restart delta) ──

function checkContainer(name, prevRestarts) {
  // Use conditional template to handle containers without HEALTHCHECK (e.g., Traefik)
  const format = '{{.State.Status}}|{{.State.Running}}|{{.RestartCount}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}|{{.State.StartedAt}}';
  const raw = exec(`docker inspect --format '${format}' ${name} 2>/dev/null`);

  if (!raw) {
    return { name, status: 'not_found', running: false, restarts: 0, restartDelta: 0, health: 'unknown', uptime: null, ok: false };
  }

  const parts = raw.split('|');
  const status = parts[0] || 'unknown';
  const isRunning = parts[1] === 'true';
  const restartCount = parseInt(parts[2]) || 0;
  const health = parts[3] || 'none';
  const startedAt = parts[4] || null;

  // Delta = new restarts since last check (not cumulative)
  const prev = prevRestarts[name] || 0;
  const restartDelta = Math.max(0, restartCount - prev);

  // Uptime in human-readable format
  let uptime = null;
  if (startedAt && isRunning) {
    const ms = Date.now() - new Date(startedAt).getTime();
    const hours = Math.floor(ms / 3600000);
    const days = Math.floor(hours / 24);
    uptime = days > 0 ? `${days}d ${hours % 24}h` : `${hours}h ${Math.floor((ms % 3600000) / 60000)}m`;
  }

  return {
    name,
    status,
    running: isRunning,
    restarts: restartCount,
    restartDelta,
    health,
    uptime,
    ok: isRunning,
  };
}

function checkAllContainers(prevRestarts) {
  return CONTAINERS.map(name => checkContainer(name, prevRestarts));
}

// ─── SSL Certificate Check ──────────────────────────────────

function checkSSLCert() {
  // Use openssl to check cert expiry for api.vocalia.ma
  const raw = exec(
    'echo | openssl s_client -servername api.vocalia.ma -connect api.vocalia.ma:443 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null',
    15000
  );

  if (!raw) return { domain: 'api.vocalia.ma', daysLeft: -1, ok: false, error: 'SSL check failed (openssl)' };

  // Output: "notAfter=Mar 15 12:00:00 2026 GMT"
  const match = raw.match(/notAfter=(.+)/);
  if (!match) return { domain: 'api.vocalia.ma', daysLeft: -1, ok: false, error: 'Cannot parse cert date' };

  const expiryDate = new Date(match[1]);
  const daysLeft = Math.floor((expiryDate - Date.now()) / 86400000);

  return {
    domain: 'api.vocalia.ma',
    expiresAt: expiryDate.toISOString(),
    daysLeft,
    ok: daysLeft > SSL_WARN_DAYS,
    error: daysLeft <= SSL_WARN_DAYS ? `SSL expires in ${daysLeft} days` : null,
  };
}

// ─── System Checks ──────────────────────────────────────────

function checkDisk() {
  const raw = exec("df / | tail -1 | awk '{print $5}'");
  if (!raw) return { partition: '/', percent: -1, ok: false, error: 'df failed' };

  const percent = parseInt(raw.replace('%', ''));
  const isCritical = percent >= DISK_CRITICAL_PERCENT;
  const isWarn = percent >= DISK_WARN_PERCENT;

  return {
    partition: '/',
    percent,
    ok: !isWarn,
    critical: isCritical,
    error: isWarn ? `Disk at ${percent}% (warn: ${DISK_WARN_PERCENT}%, critical: ${DISK_CRITICAL_PERCENT}%)` : null,
  };
}

function checkMemory() {
  const raw = exec("free -m | awk '/^Mem:/ {printf \"%d|%d|%.0f\", $3, $2, $3/$2*100}'");
  if (!raw) return { usedMB: -1, totalMB: -1, percent: -1, ok: false, error: 'free failed' };

  const [used, total, pct] = raw.split('|').map(Number);
  return {
    usedMB: used,
    totalMB: total,
    percent: pct,
    ok: pct < MEMORY_WARN_PERCENT,
    error: pct >= MEMORY_WARN_PERCENT ? `Memory at ${pct}% (threshold: ${MEMORY_WARN_PERCENT}%)` : null,
  };
}

function getDiskBreakdownThrottled() {
  // SLOW operation (du -sh on docker dirs). Limit to 1x/day.
  const info = loadJson(BREAKDOWN_PATH);
  const now = Date.now();

  if (info && info.timestamp && (now - info.timestamp) < DISK_BREAKDOWN_INTERVAL_MS) {
    return { cached: true, data: info.data, age: Math.round((now - info.timestamp) / 3600000) + 'h ago' };
  }

  // Fresh scan — /vocalia-data + Docker volumes (fast). Excludes overlay2 (very slow).
  const raw = exec('du -sh /vocalia-data/* /var/lib/docker/volumes/* /var/log/* 2>/dev/null | sort -rh | head -15', 60000);
  const data = raw || 'unavailable';

  try {
    saveJson(BREAKDOWN_PATH, { timestamp: now, data });
  } catch { /* non-critical */ }

  return { cached: false, data, age: 'fresh' };
}

// ─── Volume Mount Check ─────────────────────────────────────

function checkVolumeMount() {
  // Verify /vocalia-data is a mount point and writable
  const isMounted = exec('mountpoint -q /vocalia-data 2>/dev/null && echo yes || echo no');
  const sentinel = '/vocalia-data/.monitor-sentinel';

  let writable = false;
  try {
    fs.writeFileSync(sentinel, new Date().toISOString());
    writable = true;
  } catch { /* not writable */ }

  return {
    path: '/vocalia-data',
    mounted: isMounted === 'yes',
    writable,
    ok: writable, // Writable is the essential check (mount can be bind or direct)
  };
}

// ─── Logging ────────────────────────────────────────────────

function rotateIfNeeded(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > MAX_LOG_BYTES) {
      // Keep last 500 lines. Read line-by-line to avoid loading entire file.
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      const keep = lines.slice(-500).join('\n');
      fs.writeFileSync(filePath, keep + '\n');
      console.log(`  [Log] Rotated ${path.basename(filePath)} (${(stat.size / 1024 / 1024).toFixed(1)}MB -> kept 500 lines)`);
    }
  } catch {
    // File doesn't exist yet
  }
}

function appendJsonl(record) {
  rotateIfNeeded(JSONL_PATH);
  fs.appendFileSync(JSONL_PATH, JSON.stringify(record) + '\n');
}

function writeStatus(record) {
  fs.writeFileSync(STATUS_PATH, JSON.stringify(record, null, 2) + '\n');
}

// Also rotate cron.log
function rotateCronLog() {
  try {
    const stat = fs.statSync(CRON_LOG_PATH);
    if (stat.size > MAX_LOG_BYTES) {
      // Archive old, don't truncate to zero
      const archivePath = CRON_LOG_PATH + '.1';
      // Overwrite previous archive (keep only 1 generation)
      if (fs.existsSync(archivePath)) fs.unlinkSync(archivePath);
      fs.renameSync(CRON_LOG_PATH, archivePath);
      fs.writeFileSync(CRON_LOG_PATH, `[${new Date().toISOString()}] Log rotated (previous archived as cron.log.1)\n`);
      console.log('  [Log] Rotated cron.log -> cron.log.1');
    }
  } catch { /* file doesn't exist yet */ }
}

// ─── State Tracking (DOWN/UP transitions) ───────────────────

function loadPreviousState() {
  return loadJson(STATE_PATH) || { endpoints: {}, containers: {}, restarts: {}, disk: true, memory: true, ssl: true };
}

function savePreviousState(state) {
  try { saveJson(STATE_PATH, state); } catch { /* non-critical */ }
}

function detectTransitions(prevState, currentChecks) {
  const recoveries = [];
  const newFailures = [];

  // Endpoint transitions
  for (const ep of currentChecks.endpoints) {
    const wasOk = prevState.endpoints[ep.name] !== false; // default true (first run)
    if (ep.ok && !wasOk) {
      recoveries.push({ key: `http:${ep.name}`, name: ep.name, icon: '🟢', detail: 'RECOVERED' });
    } else if (!ep.ok && wasOk) {
      newFailures.push({ key: `http:${ep.name}`, name: ep.name, icon: '🌐', detail: ep.error || 'DOWN' });
    }
  }

  // Container transitions
  for (const ct of currentChecks.containers) {
    const wasOk = prevState.containers[ct.name] !== false;
    if (ct.ok && !wasOk) {
      recoveries.push({ key: `docker:${ct.name}`, name: ct.name, icon: '🟢', detail: 'Container RECOVERED' });
    } else if (!ct.ok && wasOk) {
      newFailures.push({ key: `docker:${ct.name}`, name: ct.name, icon: '🐳', detail: ct.status });
    }
    // New restarts (delta > 0) — alert even if container is running
    if (ct.restartDelta > 0) {
      newFailures.push({ key: `restart:${ct.name}`, name: ct.name, icon: '🔄', detail: `${ct.restartDelta} new restart(s) (total: ${ct.restarts})` });
    }
  }

  // System transitions
  if (currentChecks.disk.ok && prevState.disk === false) {
    recoveries.push({ key: 'sys:disk', name: 'Disk', icon: '🟢', detail: 'Disk usage RECOVERED' });
  }
  if (currentChecks.memory.ok && prevState.memory === false) {
    recoveries.push({ key: 'sys:memory', name: 'Memory', icon: '🟢', detail: 'Memory usage RECOVERED' });
  }
  if (currentChecks.ssl.ok && prevState.ssl === false) {
    recoveries.push({ key: 'sys:ssl', name: 'SSL', icon: '🟢', detail: 'SSL cert RECOVERED' });
  }

  return { recoveries, newFailures };
}

// ─── ntfy.sh Alerting ───────────────────────────────────────

function loadCooldowns() {
  const data = loadJson(COOLDOWN_PATH) || {};
  // Purge entries older than 24h
  const now = Date.now();
  let purged = 0;
  for (const [key, ts] of Object.entries(data)) {
    if ((now - ts) > COOLDOWN_PURGE_MS) {
      delete data[key];
      purged++;
    }
  }
  if (purged > 0) {
    try { fs.writeFileSync(COOLDOWN_PATH, JSON.stringify(data) + '\n'); } catch { /* */ }
  }
  return data;
}

function saveCooldowns(data) {
  fs.writeFileSync(COOLDOWN_PATH, JSON.stringify(data) + '\n');
}

async function sendNtfyAlert(items, isRecovery = false) {
  if (!NTFY_TOPIC) return;
  if (items.length === 0) return;

  const cooldowns = loadCooldowns();
  const now = Date.now();

  // Recoveries bypass cooldown (always notify)
  const alertable = isRecovery ? items : items.filter(f => {
    const last = cooldowns[f.key] || 0;
    return (now - last) > ALERT_COOLDOWN_MS;
  });

  if (alertable.length === 0) return;

  // Update cooldowns for non-recovery alerts
  if (!isRecovery) {
    for (const f of alertable) {
      cooldowns[f.key] = now;
    }
    saveCooldowns(cooldowns);
  }

  const lines = alertable.map(f => `${f.icon} ${f.name}: ${f.detail}`);
  const title = isRecovery
    ? `VocalIA: ${alertable.length} service(s) RECOVERED`
    : `VocalIA: ${alertable.length} issue(s) detected`;
  const priority = isRecovery ? 'default' : 'high';
  const tags = isRecovery ? 'white_check_mark' : 'warning';

  try {
    await fetch(NTFY_URL, {
      method: 'POST',
      headers: { 'Title': title, 'Priority': priority, 'Tags': tags },
      body: lines.join('\n'),
    });
    console.log(`  [ntfy] ${isRecovery ? 'Recovery' : 'Alert'} sent (${alertable.length} item(s))`);
  } catch (err) {
    console.error(`  [ntfy] Failed: ${err.message}`);
  }
}

// ─── Main ───────────────────────────────────────────────────

async function run() {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] VocalIA Production Monitor v3.0`);

  ensureDir(MONITORING_DIR);

  // Rotate cron.log (archive, not truncate)
  rotateCronLog();

  // Load previous state for transition detection
  const prevState = loadPreviousState();

  // ── Pre-flight: Docker daemon ──
  const docker = checkDockerDaemon();
  console.log(`\n  Docker Daemon: ${docker.reachable ? '✅' : '❌'} ${docker.version}`);

  // ── Run all checks in parallel ──
  const [endpoints, disk, memory, ssl] = await Promise.all([
    checkAllEndpoints(),
    Promise.resolve(checkDisk()),
    Promise.resolve(checkMemory()),
    Promise.resolve(checkSSLCert()),
  ]);

  const containers = docker.reachable
    ? checkAllContainers(prevState.restarts || {})
    : CONTAINERS.map(name => ({ name, status: 'daemon_unreachable', running: false, restarts: 0, restartDelta: 0, health: 'unknown', uptime: null, ok: false }));

  const volume = checkVolumeMount();

  // ── Collect all failures ──
  const failures = [];

  // Print endpoints
  console.log('\n  HTTP Endpoints:');
  for (const r of endpoints) {
    const icon = r.ok ? '✅' : '❌';
    const lat = r.latency < 1000 ? `${r.latency}ms` : `${(r.latency / 1000).toFixed(1)}s`;
    console.log(`    ${icon} ${r.name.padEnd(14)} ${String(r.status).padEnd(4)} ${lat}${r.error ? ` — ${r.error}` : ''}`);
    if (!r.ok) {
      failures.push({ key: `http:${r.name}`, name: r.name, icon: '🌐', detail: r.error || 'DOWN' });
    }
  }

  // Print containers
  console.log('\n  Docker Containers:');
  if (!docker.reachable) {
    console.log('    ❌ Docker daemon unreachable — all container checks skipped');
    failures.push({ key: 'docker:daemon', name: 'Docker', icon: '🐳', detail: 'Daemon unreachable' });
  }
  for (const c of containers) {
    const icon = c.ok ? '✅' : '❌';
    const uptimeStr = c.uptime ? ` (up ${c.uptime})` : '';
    const restartStr = c.restartDelta > 0 ? ` ⚠️ +${c.restartDelta} restart(s)` : '';
    const healthStr = c.health !== 'none' && c.health !== 'unknown' ? ` [${c.health}]` : '';
    console.log(`    ${icon} ${c.name.padEnd(22)} ${c.status}${healthStr}${uptimeStr}${restartStr}`);
    if (!c.ok) {
      failures.push({ key: `docker:${c.name}`, name: c.name, icon: '🐳', detail: c.status });
    }
  }

  // Print SSL
  console.log('\n  SSL Certificate:');
  const sslIcon = ssl.ok ? '✅' : '❌';
  console.log(`    ${sslIcon} ${ssl.domain} — ${ssl.daysLeft >= 0 ? `${ssl.daysLeft} days left` : ssl.error}`);
  if (!ssl.ok) {
    failures.push({ key: 'sys:ssl', name: 'SSL', icon: '🔒', detail: ssl.error });
  }

  // Print system
  console.log('\n  System:');
  const diskIcon = disk.ok ? '✅' : (disk.critical ? '🔴' : '❌');
  console.log(`    ${diskIcon} Disk   ${disk.percent}%${disk.error ? ` — ${disk.error}` : ''}`);
  if (!disk.ok) {
    failures.push({ key: 'sys:disk', name: 'Disk', icon: '💾', detail: disk.error });
    // Disk breakdown throttled to 1x/day (du is slow)
    const breakdown = getDiskBreakdownThrottled();
    console.log(`    Breakdown (${breakdown.age}):`);
    console.log(breakdown.data.split('\n').map(l => `      ${l}`).join('\n'));
  }

  const memIcon = memory.ok ? '✅' : '❌';
  console.log(`    ${memIcon} Memory ${memory.percent}% (${memory.usedMB}/${memory.totalMB} MB)${memory.error ? ` — ${memory.error}` : ''}`);
  if (!memory.ok) {
    failures.push({ key: 'sys:memory', name: 'Memory', icon: '🧠', detail: memory.error });
  }

  // Volume
  const volIcon = volume.ok ? '✅' : '❌';
  console.log(`    ${volIcon} Volume ${volume.path} — mounted: ${volume.mounted}, writable: ${volume.writable}`);
  if (!volume.ok) {
    failures.push({ key: 'sys:volume', name: 'Volume', icon: '📁', detail: `${volume.path} not writable` });
  }

  // ── Transition detection (DOWN→UP, UP→DOWN) ──
  const currentChecks = { endpoints, containers, disk, memory, ssl };
  const { recoveries, newFailures } = detectTransitions(prevState, currentChecks);

  if (recoveries.length > 0) {
    console.log(`\n  🟢 Recoveries: ${recoveries.map(r => r.name).join(', ')}`);
  }

  // ── Summary ──
  const allOk = failures.length === 0;
  const epOk = endpoints.filter(e => e.ok).length;
  const ctOk = containers.filter(c => c.ok).length;
  console.log(`\n  Summary: ${allOk ? '✅ ALL OK' : `❌ ${failures.length} ISSUE(S)`} — ${epOk}/${endpoints.length} endpoints, ${ctOk}/${containers.length} containers, disk ${disk.percent}%, mem ${memory.percent}%, SSL ${ssl.daysLeft}d`);

  if (NTFY_TOPIC) {
    console.log(`  Alerts: ntfy.sh/${NTFY_TOPIC}`);
  } else {
    console.log('  Alerts: DISABLED (set NTFY_TOPIC env to enable)');
  }

  // ── Build and persist record ──
  const record = {
    timestamp,
    version: '3.0.0',
    ok: allOk,
    endpoints: endpoints.map(e => ({ name: e.name, status: e.status, latency: e.latency, ok: e.ok, error: e.error })),
    containers: containers.map(c => ({ name: c.name, status: c.status, running: c.running, restarts: c.restarts, restartDelta: c.restartDelta, health: c.health, uptime: c.uptime, ok: c.ok })),
    docker: { daemon: docker.reachable, version: docker.version },
    ssl: { domain: ssl.domain, daysLeft: ssl.daysLeft, ok: ssl.ok },
    disk: { percent: disk.percent, ok: disk.ok, critical: disk.critical || false },
    memory: { percent: memory.percent, usedMB: memory.usedMB, totalMB: memory.totalMB, ok: memory.ok },
    volume: { ok: volume.ok, mounted: volume.mounted, writable: volume.writable },
    failures: failures.length,
    recoveries: recoveries.length,
  };

  try {
    appendJsonl(record);
    writeStatus(record);
  } catch (err) {
    console.error(`  [Log] Write failed: ${err.message}`);
  }

  // ── Save current state for next run's transition detection ──
  const newState = {
    endpoints: {},
    containers: {},
    restarts: {},
    disk: disk.ok,
    memory: memory.ok,
    ssl: ssl.ok,
  };
  for (const ep of endpoints) newState.endpoints[ep.name] = ep.ok;
  for (const ct of containers) {
    newState.containers[ct.name] = ct.ok;
    newState.restarts[ct.name] = ct.restarts;
  }
  savePreviousState(newState);

  // ── Send alerts ──
  // Failures: respect cooldown
  if (failures.length > 0) {
    await sendNtfyAlert(failures, false);
  }
  // Recoveries: always notify (bypass cooldown)
  if (recoveries.length > 0) {
    await sendNtfyAlert(recoveries, true);
  }

  return allOk;
}

run().then(ok => {
  process.exit(ok ? 0 : 1);
}).catch(err => {
  console.error(`❌ Monitor crash: ${err.message}`);
  process.exit(2);
});
