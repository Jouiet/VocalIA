/**
 * VocalIA Quick Smoke Test (Node.js)
 * Session 250.12 - No external dependencies
 *
 * Run with: node test/k6/smoke-test.cjs
 *
 * This is a lightweight alternative to k6 for quick validation.
 */

const http = require('http');
const https = require('https');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3004';
const CONCURRENT_USERS = parseInt(process.env.CONCURRENT_USERS || '10', 10);
const DURATION_SECONDS = parseInt(process.env.DURATION || '30', 10);
const VERBOSE = process.env.VERBOSE === 'true';

// Metrics
const metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  responseTimes: [],
  errors: [],
  startTime: null,
  endTime: null,
};

// Test data
const PERSONAS = ['AGENCY', 'DENTAL', 'PROPERTY', 'UNIVERSAL_ECOMMERCE'];
const MESSAGES = [
  'Bonjour, je voudrais prendre rendez-vous',
  'What are your business hours?',
  'Quel est le prix de vos services?',
  'I need help with my order',
];

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeRequest(endpoint, method = 'GET', body = null) {
  return new Promise((resolve) => {
    const url = new URL(endpoint, BASE_URL);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 10000,
    };

    const startTime = Date.now();

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        const duration = Date.now() - startTime;
        resolve({
          status: res.statusCode,
          duration: duration,
          body: data,
          success: res.statusCode >= 200 && res.statusCode < 300,
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        status: 0,
        duration: Date.now() - startTime,
        body: null,
        success: false,
        error: err.message,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        status: 0,
        duration: Date.now() - startTime,
        body: null,
        success: false,
        error: 'timeout',
      });
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function runVirtualUser(userId, durationMs) {
  const endTime = Date.now() + durationMs;

  while (Date.now() < endTime) {
    // Health check
    const healthResult = await makeRequest('/health');
    metrics.totalRequests++;
    if (healthResult.success) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
      metrics.errors.push({ type: 'health', error: healthResult.error });
    }
    metrics.responseTimes.push(healthResult.duration);

    // Voice respond
    const respondResult = await makeRequest('/respond', 'POST', {
      message: randomElement(MESSAGES),
      sessionId: `user-${userId}-${Date.now()}`,
      persona: randomElement(PERSONAS),
      lang: 'fr',
      conversationHistory: [],
    });

    metrics.totalRequests++;
    if (respondResult.success) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
      metrics.errors.push({ type: 'respond', error: respondResult.error });
    }
    metrics.responseTimes.push(respondResult.duration);

    if (VERBOSE) {
      console.log(
        `[User ${userId}] Health: ${healthResult.duration}ms, Respond: ${respondResult.duration}ms`
      );
    }

    // Think time (1-2 seconds)
    await new Promise((r) => setTimeout(r, 1000 + Math.random() * 1000));
  }
}

function calculatePercentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function printResults() {
  const duration = (metrics.endTime - metrics.startTime) / 1000;
  const rps = metrics.totalRequests / duration;
  const errorRate = (metrics.failedRequests / metrics.totalRequests) * 100;

  const avg =
    metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length;
  const p50 = calculatePercentile(metrics.responseTimes, 50);
  const p95 = calculatePercentile(metrics.responseTimes, 95);
  const p99 = calculatePercentile(metrics.responseTimes, 99);
  const max = Math.max(...metrics.responseTimes);

  console.log('\n========== VOCALIA SMOKE TEST RESULTS ==========\n');
  console.log(`Configuration:`);
  console.log(`  Base URL: ${BASE_URL}`);
  console.log(`  Concurrent Users: ${CONCURRENT_USERS}`);
  console.log(`  Duration: ${DURATION_SECONDS}s`);
  console.log(`  Total Duration: ${duration.toFixed(2)}s\n`);

  console.log(`Request Metrics:`);
  console.log(`  Total Requests: ${metrics.totalRequests}`);
  console.log(`  Successful: ${metrics.successfulRequests}`);
  console.log(`  Failed: ${metrics.failedRequests}`);
  console.log(`  Requests/sec: ${rps.toFixed(2)}`);
  console.log(`  Error Rate: ${errorRate.toFixed(2)}%\n`);

  console.log(`Response Time (ms):`);
  console.log(`  Average: ${avg.toFixed(2)}`);
  console.log(`  Median (p50): ${p50.toFixed(2)}`);
  console.log(`  p95: ${p95.toFixed(2)}`);
  console.log(`  p99: ${p99.toFixed(2)}`);
  console.log(`  Max: ${max.toFixed(2)}\n`);

  // SLA checks
  console.log(`SLA Checks:`);
  const sla99 = p99 < 500;
  const slaError = errorRate < 1;
  console.log(`  ${sla99 ? '✅' : '❌'} p99 < 500ms: ${p99.toFixed(2)}ms`);
  console.log(`  ${slaError ? '✅' : '❌'} Error rate < 1%: ${errorRate.toFixed(2)}%`);

  console.log('\n================================================\n');

  // Exit with error code if SLA failed
  if (!sla99 || !slaError) {
    process.exit(1);
  }
}

async function main() {
  console.log('🚀 Starting VocalIA Smoke Test...');
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Users: ${CONCURRENT_USERS}`);
  console.log(`   Duration: ${DURATION_SECONDS}s\n`);

  // Check if API is reachable
  const healthCheck = await makeRequest('/health');
  if (!healthCheck.success) {
    console.error('❌ API is not reachable. Make sure voice-api-resilient.cjs is running.');
    console.error(`   Command: node core/voice-api-resilient.cjs`);
    process.exit(1);
  }
  console.log('✅ API is reachable\n');

  metrics.startTime = Date.now();

  // Start virtual users
  const users = [];
  for (let i = 0; i < CONCURRENT_USERS; i++) {
    users.push(runVirtualUser(i, DURATION_SECONDS * 1000));
  }

  // Wait for all users to complete
  await Promise.all(users);

  metrics.endTime = Date.now();

  printResults();
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
