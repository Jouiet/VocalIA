#!/usr/bin/env node
/**
 * VocalIA E2E Test Services Launcher
 * Session 250.75
 *
 * Starts all backend services required for real E2E testing:
 * - db-api.cjs (port 3013) - Database API
 * - voice-api-resilient.cjs (port 3004) - Voice API
 * - grok-voice-realtime.cjs (port 3007) - WebSocket Realtime
 * - voice-telephony-bridge.cjs (port 3009) - Telephony
 * - http-server (port 8080) - Frontend
 */

const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');

const SERVICES = [
  {
    name: 'db-api',
    cmd: 'node',
    args: ['core/db-api.cjs'],
    port: 3013,
    healthPath: '/health',
    critical: true
  },
  {
    name: 'voice-api',
    cmd: 'node',
    args: ['core/voice-api-resilient.cjs'],
    port: 3004,
    healthPath: '/health',
    critical: false // Can run without external APIs
  },
  {
    name: 'grok-realtime',
    cmd: 'node',
    args: ['core/grok-voice-realtime.cjs'],
    port: 3007,
    healthPath: null, // WebSocket only
    critical: false
  },
  {
    name: 'telephony',
    cmd: 'node',
    args: ['telephony/voice-telephony-bridge.cjs'],
    port: 3009,
    healthPath: '/health',
    critical: false
  },
  {
    name: 'frontend',
    cmd: 'npx',
    args: ['http-server', 'website', '-p', '8080', '-c-1', '--cors'],
    port: 8080,
    healthPath: '/',
    critical: true
  }
];

const processes = new Map();
let shuttingDown = false;

function log(service, message, type = 'info') {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warn: '\x1b[33m'
  };
  const reset = '\x1b[0m';
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`${colors[type]}[${timestamp}] [${service}]${reset} ${message}`);
}

function checkPort(port, timeout = 5000) {
  return new Promise((resolve) => {
    const start = Date.now();

    const check = () => {
      const req = http.request({ host: 'localhost', port, method: 'HEAD', timeout: 1000 }, (res) => {
        resolve(true);
      });

      req.on('error', () => {
        if (Date.now() - start < timeout) {
          setTimeout(check, 200);
        } else {
          resolve(false);
        }
      });

      req.end();
    };

    check();
  });
}

async function startService(service) {
  return new Promise((resolve, reject) => {
    log(service.name, `Starting on port ${service.port}...`);

    const proc = spawn(service.cmd, service.args, {
      cwd: ROOT,
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    processes.set(service.name, proc);

    proc.stdout.on('data', (data) => {
      const lines = data.toString().trim().split('\n');
      lines.forEach(line => {
        if (line.includes('listening') || line.includes('started') || line.includes('ready') || line.includes('✅')) {
          log(service.name, line, 'success');
        }
      });
    });

    proc.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      if (!msg.includes('ExperimentalWarning') && !msg.includes('punycode')) {
        log(service.name, msg, 'warn');
      }
    });

    proc.on('error', (err) => {
      log(service.name, `Failed to start: ${err.message}`, 'error');
      reject(err);
    });

    proc.on('exit', (code) => {
      if (!shuttingDown) {
        log(service.name, `Exited with code ${code}`, code === 0 ? 'info' : 'error');
      }
    });

    // Wait for port to be ready
    checkPort(service.port, 15000).then((ready) => {
      if (ready) {
        log(service.name, `✅ Ready on port ${service.port}`, 'success');
        resolve(true);
      } else if (service.critical) {
        log(service.name, `❌ Failed to start on port ${service.port}`, 'error');
        reject(new Error(`${service.name} failed to start`));
      } else {
        log(service.name, `⚠️ Not responding on port ${service.port} (non-critical)`, 'warn');
        resolve(false);
      }
    });
  });
}

async function startAllServices() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║        VocalIA E2E Services - Production Simulation        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const results = [];

  for (const service of SERVICES) {
    try {
      const ready = await startService(service);
      results.push({ name: service.name, port: service.port, ready });
    } catch (err) {
      if (service.critical) {
        throw err;
      }
      results.push({ name: service.name, port: service.port, ready: false });
    }
  }

  console.log('\n┌────────────────────────────────────────────────────────────┐');
  console.log('│                    Services Status                         │');
  console.log('├────────────────────────────────────────────────────────────┤');
  results.forEach(r => {
    const status = r.ready ? '✅ READY' : '⚠️ UNAVAILABLE';
    console.log(`│  ${r.name.padEnd(15)} :${r.port}  ${status.padEnd(20)} │`);
  });
  console.log('└────────────────────────────────────────────────────────────┘\n');

  const readyCount = results.filter(r => r.ready).length;
  console.log(`\n🚀 ${readyCount}/${results.length} services ready for E2E testing\n`);

  return results;
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log('\n\n🛑 Shutting down services...');

  for (const [name, proc] of processes) {
    log(name, 'Stopping...', 'info');
    proc.kill('SIGTERM');
  }

  setTimeout(() => {
    for (const [name, proc] of processes) {
      if (!proc.killed) {
        log(name, 'Force killing...', 'warn');
        proc.kill('SIGKILL');
      }
    }
    process.exit(0);
  }, 3000);
}

// Handle termination
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// CLI
if (require.main === module) {
  startAllServices()
    .then(() => {
      console.log('Press Ctrl+C to stop all services\n');
    })
    .catch((err) => {
      console.error('❌ Failed to start services:', err.message);
      shutdown();
      process.exit(1);
    });
}

module.exports = { startAllServices, shutdown, SERVICES };
