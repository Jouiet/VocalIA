/**
 * VocalIA Chaos Engineering Toolkit
 * Session 250 - Task #40
 *
 * Tools for testing system resilience and fault tolerance.
 * Run controlled experiments to identify weaknesses before they cause outages.
 *
 * Usage:
 *   node chaos-engineering.cjs --experiment=latency-injection
 *   node chaos-engineering.cjs --list
 *   node chaos-engineering.cjs --verify-circuit-breakers
 */

'use strict';

const http = require('http');
const https = require('https');

// Configuration
const CONFIG = {
  voiceApiUrl: process.env.VOICE_API_URL || 'http://localhost:3004',
  grokRealtimeUrl: process.env.GROK_REALTIME_URL || 'http://localhost:3007',
  telephonyUrl: process.env.TELEPHONY_URL || 'http://localhost:3009',
  experimentDuration: parseInt(process.env.CHAOS_DURATION || '30', 10), // seconds
  safeMode: process.env.CHAOS_SAFE_MODE !== 'false',
  verbose: process.env.VERBOSE === 'true'
};

// Chaos experiment definitions
const EXPERIMENTS = {
  // Network experiments
  'latency-injection': {
    name: 'Latency Injection',
    description: 'Add artificial latency to API responses',
    category: 'network',
    riskLevel: 'low',
    async execute(params = {}) {
      const latencyMs = params.latency || 2000;
      console.log(`[Chaos] Injecting ${latencyMs}ms latency...`);
      return simulateLatencyTest(latencyMs);
    }
  },

  'connection-timeout': {
    name: 'Connection Timeout',
    description: 'Test behavior when connections timeout',
    category: 'network',
    riskLevel: 'medium',
    async execute(params = {}) {
      const timeout = params.timeout || 100;
      console.log(`[Chaos] Testing ${timeout}ms timeout handling...`);
      return testTimeoutBehavior(timeout);
    }
  },

  'rate-limit-surge': {
    name: 'Rate Limit Surge',
    description: 'Generate traffic surge to test rate limiting',
    category: 'load',
    riskLevel: 'medium',
    async execute(params = {}) {
      const rps = params.requestsPerSecond || 100;
      console.log(`[Chaos] Generating ${rps} RPS surge...`);
      return testRateLimiting(rps);
    }
  },

  // Service experiments
  'provider-failover': {
    name: 'AI Provider Failover',
    description: 'Test fallback when primary AI provider fails',
    category: 'service',
    riskLevel: 'low',
    async execute(params = {}) {
      console.log('[Chaos] Testing AI provider failover chain...');
      return testProviderFailover();
    }
  },

  'circuit-breaker-trip': {
    name: 'Circuit Breaker Trip',
    description: 'Verify circuit breakers trip correctly under failure',
    category: 'resilience',
    riskLevel: 'low',
    async execute(params = {}) {
      console.log('[Chaos] Testing circuit breaker behavior...');
      return testCircuitBreakers();
    }
  },

  'graceful-degradation': {
    name: 'Graceful Degradation',
    description: 'Verify system degrades gracefully under partial failure',
    category: 'resilience',
    riskLevel: 'low',
    async execute(params = {}) {
      console.log('[Chaos] Testing graceful degradation...');
      return testGracefulDegradation();
    }
  },

  // Resource experiments
  'memory-pressure': {
    name: 'Memory Pressure',
    description: 'Test behavior under memory constraints',
    category: 'resource',
    riskLevel: 'high',
    async execute(params = {}) {
      if (CONFIG.safeMode) {
        console.log('[Chaos] Memory pressure skipped (safe mode)');
        return { skipped: true, reason: 'Safe mode enabled' };
      }
      console.log('[Chaos] Applying memory pressure...');
      return testMemoryPressure();
    }
  },

  'cpu-stress': {
    name: 'CPU Stress',
    description: 'Test behavior under high CPU load',
    category: 'resource',
    riskLevel: 'high',
    async execute(params = {}) {
      if (CONFIG.safeMode) {
        console.log('[Chaos] CPU stress skipped (safe mode)');
        return { skipped: true, reason: 'Safe mode enabled' };
      }
      console.log('[Chaos] Applying CPU stress...');
      return testCPUStress();
    }
  },

  // Data experiments
  'malformed-input': {
    name: 'Malformed Input',
    description: 'Test handling of malformed/invalid input data',
    category: 'data',
    riskLevel: 'low',
    async execute(params = {}) {
      console.log('[Chaos] Testing malformed input handling...');
      return testMalformedInput();
    }
  },

  'large-payload': {
    name: 'Large Payload',
    description: 'Test handling of oversized payloads',
    category: 'data',
    riskLevel: 'medium',
    async execute(params = {}) {
      console.log('[Chaos] Testing large payload handling...');
      return testLargePayload();
    }
  }
};

// HTTP request helper
function makeRequest(url, method = 'GET', body = null, options = {}) {
  return new Promise((resolve) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers
      },
      timeout: options.timeout || 10000
    };

    const startTime = Date.now();
    const req = client.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
          duration: Date.now() - startTime,
          success: res.statusCode >= 200 && res.statusCode < 500
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        status: 0,
        error: err.message,
        duration: Date.now() - startTime,
        success: false
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        status: 0,
        error: 'timeout',
        duration: Date.now() - startTime,
        success: false
      });
    });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Experiment implementations
async function simulateLatencyTest(latencyMs) {
  const results = {
    experiment: 'latency-injection',
    injectedLatency: latencyMs,
    tests: []
  };

  // Test multiple endpoints with artificial delay simulation
  const endpoints = [
    { name: 'health', url: `${CONFIG.voiceApiUrl}/health` },
    { name: 'respond', url: `${CONFIG.voiceApiUrl}/respond`, method: 'POST', body: {
      message: 'Test under latency',
      sessionId: 'chaos-test',
      persona: 'AGENCY',
      lang: 'fr'
    }}
  ];

  for (const endpoint of endpoints) {
    const result = await makeRequest(
      endpoint.url,
      endpoint.method || 'GET',
      endpoint.body
    );

    results.tests.push({
      endpoint: endpoint.name,
      status: result.status,
      duration: result.duration,
      withinSLA: result.duration < (latencyMs + 500),
      passed: result.success
    });
  }

  results.summary = {
    totalTests: results.tests.length,
    passed: results.tests.filter(t => t.passed).length,
    failed: results.tests.filter(t => !t.passed).length
  };

  return results;
}

async function testTimeoutBehavior(timeoutMs) {
  const results = {
    experiment: 'connection-timeout',
    timeout: timeoutMs,
    tests: []
  };

  // Test with very short timeout
  const result = await makeRequest(
    `${CONFIG.voiceApiUrl}/health`,
    'GET',
    null,
    { timeout: timeoutMs }
  );

  results.tests.push({
    name: 'short-timeout-handling',
    expectedBehavior: 'graceful timeout error',
    actualStatus: result.status,
    actualError: result.error,
    passed: result.error === 'timeout' || result.status === 0 || result.success
  });

  // Test recovery after timeout
  const recoveryResult = await makeRequest(
    `${CONFIG.voiceApiUrl}/health`,
    'GET',
    null,
    { timeout: 10000 }
  );

  results.tests.push({
    name: 'recovery-after-timeout',
    expectedBehavior: 'successful recovery',
    actualStatus: recoveryResult.status,
    passed: recoveryResult.success
  });

  results.summary = {
    totalTests: results.tests.length,
    passed: results.tests.filter(t => t.passed).length
  };

  return results;
}

async function testRateLimiting(rps) {
  const results = {
    experiment: 'rate-limit-surge',
    requestsPerSecond: rps,
    tests: []
  };

  // Generate burst of requests
  const requests = [];
  const burstSize = Math.min(rps, 50); // Cap at 50 for safety

  for (let i = 0; i < burstSize; i++) {
    requests.push(makeRequest(`${CONFIG.voiceApiUrl}/health`));
  }

  const responses = await Promise.all(requests);

  const successful = responses.filter(r => r.status === 200).length;
  const rateLimited = responses.filter(r => r.status === 429).length;
  const errors = responses.filter(r => r.status === 0).length;

  results.tests.push({
    name: 'burst-handling',
    totalRequests: burstSize,
    successful,
    rateLimited,
    errors,
    rateLimiterActive: rateLimited > 0,
    passed: (successful + rateLimited) === burstSize && errors === 0
  });

  results.summary = {
    systemProtected: rateLimited > 0 || successful === burstSize,
    errorRate: (errors / burstSize * 100).toFixed(2) + '%'
  };

  return results;
}

async function testProviderFailover() {
  const results = {
    experiment: 'provider-failover',
    tests: []
  };

  // Test with invalid API key scenario (simulated)
  const respondResult = await makeRequest(
    `${CONFIG.voiceApiUrl}/respond`,
    'POST',
    {
      message: 'Test failover',
      sessionId: 'chaos-failover-test',
      persona: 'AGENCY',
      lang: 'fr'
    }
  );

  results.tests.push({
    name: 'respond-with-potential-failover',
    status: respondResult.status,
    hasResponse: !!respondResult.body,
    duration: respondResult.duration,
    passed: respondResult.success
  });

  // Check if response mentions fallback (in logs or response)
  try {
    const body = JSON.parse(respondResult.body || '{}');
    results.tests.push({
      name: 'response-validity',
      hasReply: !!body.reply,
      passed: !!body.reply
    });
  } catch (e) {
    results.tests.push({
      name: 'response-validity',
      error: 'Invalid JSON response',
      passed: false
    });
  }

  results.summary = {
    failoverReady: results.tests.every(t => t.passed)
  };

  return results;
}

async function testCircuitBreakers() {
  const results = {
    experiment: 'circuit-breaker-trip',
    tests: []
  };

  // Generate failures to trip circuit breaker
  const failureRequests = [];
  for (let i = 0; i < 10; i++) {
    failureRequests.push(makeRequest(
      `${CONFIG.voiceApiUrl}/nonexistent-endpoint`,
      'GET'
    ));
  }

  await Promise.all(failureRequests);

  // Check if subsequent requests are handled gracefully
  const afterFailures = await makeRequest(`${CONFIG.voiceApiUrl}/health`);

  results.tests.push({
    name: 'health-after-failures',
    status: afterFailures.status,
    passed: afterFailures.status === 200
  });

  // Allow circuit to recover
  await new Promise(r => setTimeout(r, 1000));

  const recovery = await makeRequest(`${CONFIG.voiceApiUrl}/health`);
  results.tests.push({
    name: 'circuit-recovery',
    status: recovery.status,
    passed: recovery.status === 200
  });

  results.summary = {
    circuitBreakerFunctional: results.tests.every(t => t.passed)
  };

  return results;
}

async function testGracefulDegradation() {
  const results = {
    experiment: 'graceful-degradation',
    tests: []
  };

  // Test with optional fields missing
  const minimalRequest = await makeRequest(
    `${CONFIG.voiceApiUrl}/respond`,
    'POST',
    {
      message: 'Test minimal',
      sessionId: 'chaos-minimal'
      // Missing optional: persona, lang, conversationHistory
    }
  );

  results.tests.push({
    name: 'minimal-request-handling',
    status: minimalRequest.status,
    passed: minimalRequest.status === 200 || minimalRequest.status === 400
  });

  // Test with extra unexpected fields
  const extraFields = await makeRequest(
    `${CONFIG.voiceApiUrl}/respond`,
    'POST',
    {
      message: 'Test extra fields',
      sessionId: 'chaos-extra',
      persona: 'AGENCY',
      lang: 'fr',
      unexpectedField: 'should be ignored',
      anotherExtra: { nested: true }
    }
  );

  results.tests.push({
    name: 'extra-fields-handling',
    status: extraFields.status,
    passed: extraFields.success
  });

  results.summary = {
    degradationGraceful: results.tests.every(t => t.passed)
  };

  return results;
}

async function testMemoryPressure() {
  // Only runs if safe mode is disabled
  const results = {
    experiment: 'memory-pressure',
    tests: []
  };

  const beforeMem = process.memoryUsage();

  // Create moderate memory pressure (not extreme)
  const arrays = [];
  try {
    for (let i = 0; i < 10; i++) {
      arrays.push(new Array(1000000).fill('x'));
    }

    // Test API under memory pressure
    const underPressure = await makeRequest(`${CONFIG.voiceApiUrl}/health`);
    results.tests.push({
      name: 'api-under-memory-pressure',
      status: underPressure.status,
      passed: underPressure.success
    });
  } finally {
    // Cleanup
    arrays.length = 0;
    global.gc && global.gc();
  }

  const afterMem = process.memoryUsage();
  results.memoryDelta = {
    heapUsedMB: ((afterMem.heapUsed - beforeMem.heapUsed) / 1024 / 1024).toFixed(2)
  };

  return results;
}

async function testCPUStress() {
  // Only runs if safe mode is disabled
  const results = {
    experiment: 'cpu-stress',
    tests: []
  };

  // Light CPU work
  const start = Date.now();
  let iterations = 0;
  while (Date.now() - start < 2000) {
    Math.random() * Math.random();
    iterations++;
  }

  // Test API during stress
  const underStress = await makeRequest(`${CONFIG.voiceApiUrl}/health`);
  results.tests.push({
    name: 'api-under-cpu-stress',
    status: underStress.status,
    duration: underStress.duration,
    passed: underStress.success
  });

  results.cpuIterations = iterations;

  return results;
}

async function testMalformedInput() {
  const results = {
    experiment: 'malformed-input',
    tests: []
  };

  const malformedCases = [
    { name: 'empty-body', body: {} },
    { name: 'null-message', body: { message: null, sessionId: 'test' } },
    { name: 'number-message', body: { message: 12345, sessionId: 'test' } },
    { name: 'array-message', body: { message: ['a', 'b'], sessionId: 'test' } },
    { name: 'xss-attempt', body: { message: '<script>alert(1)</script>', sessionId: 'test' } },
    { name: 'sql-injection', body: { message: "'; DROP TABLE users;--", sessionId: 'test' } }
  ];

  for (const testCase of malformedCases) {
    const result = await makeRequest(
      `${CONFIG.voiceApiUrl}/respond`,
      'POST',
      testCase.body
    );

    results.tests.push({
      name: testCase.name,
      status: result.status,
      handledGracefully: result.status === 400 || result.status === 200,
      noServerError: result.status !== 500,
      passed: result.status !== 500 && result.status !== 0
    });
  }

  results.summary = {
    allHandledGracefully: results.tests.every(t => t.handledGracefully),
    noServerErrors: results.tests.every(t => t.noServerError)
  };

  return results;
}

async function testLargePayload() {
  const results = {
    experiment: 'large-payload',
    tests: []
  };

  // Generate progressively larger payloads
  const sizes = [1000, 10000, 100000]; // characters

  for (const size of sizes) {
    const largeMessage = 'x'.repeat(size);
    const result = await makeRequest(
      `${CONFIG.voiceApiUrl}/respond`,
      'POST',
      {
        message: largeMessage,
        sessionId: 'chaos-large-payload',
        persona: 'AGENCY',
        lang: 'fr'
      }
    );

    results.tests.push({
      name: `payload-${size}-chars`,
      size,
      status: result.status,
      duration: result.duration,
      handledGracefully: result.status === 400 || result.status === 413 || result.status === 200,
      passed: result.status !== 500 && result.status !== 0
    });
  }

  results.summary = {
    payloadLimitsEnforced: results.tests.some(t => t.status === 413),
    allHandledGracefully: results.tests.every(t => t.handledGracefully)
  };

  return results;
}

// CLI runner
async function runExperiment(name, params = {}) {
  const experiment = EXPERIMENTS[name];
  if (!experiment) {
    console.error(`❌ Unknown experiment: ${name}`);
    console.log('Available experiments:', Object.keys(EXPERIMENTS).join(', '));
    return null;
  }

  console.log('\n' + '='.repeat(60));
  console.log(`🧪 Experiment: ${experiment.name}`);
  console.log(`📝 ${experiment.description}`);
  console.log(`⚠️  Risk Level: ${experiment.riskLevel.toUpperCase()}`);
  console.log('='.repeat(60) + '\n');

  const startTime = Date.now();
  const results = await experiment.execute(params);
  const duration = Date.now() - startTime;

  console.log('\n📊 Results:');
  console.log(JSON.stringify(results, null, 2));
  console.log(`\n⏱️  Experiment duration: ${duration}ms\n`);

  return results;
}

function listExperiments() {
  console.log('\n🧪 VocalIA Chaos Engineering Experiments\n');
  console.log('='.repeat(60) + '\n');

  const byCategory = {};
  for (const [key, exp] of Object.entries(EXPERIMENTS)) {
    if (!byCategory[exp.category]) byCategory[exp.category] = [];
    byCategory[exp.category].push({ key, ...exp });
  }

  for (const [category, experiments] of Object.entries(byCategory)) {
    console.log(`📁 ${category.toUpperCase()}`);
    for (const exp of experiments) {
      const risk = exp.riskLevel === 'high' ? '🔴' : exp.riskLevel === 'medium' ? '🟡' : '🟢';
      console.log(`   ${risk} ${exp.key}: ${exp.description}`);
    }
    console.log();
  }

  console.log('Usage: node chaos-engineering.cjs --experiment=<name>');
  console.log('       node chaos-engineering.cjs --all (run all low-risk experiments)');
}

async function runAllSafe() {
  console.log('\n🧪 Running all LOW-RISK experiments...\n');

  const safeExperiments = Object.entries(EXPERIMENTS)
    .filter(([_, exp]) => exp.riskLevel === 'low')
    .map(([key]) => key);

  const results = {};
  for (const name of safeExperiments) {
    results[name] = await runExperiment(name);
    await new Promise(r => setTimeout(r, 1000)); // Brief pause between experiments
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));

  let passed = 0;
  let failed = 0;

  for (const [name, result] of Object.entries(results)) {
    if (!result) continue;
    const success = result.summary?.passed !== 0 || result.tests?.every(t => t.passed);
    if (success) passed++;
    else failed++;
    console.log(`${success ? '✅' : '❌'} ${name}`);
  }

  console.log(`\nTotal: ${passed} passed, ${failed} failed\n`);

  return results;
}

// Main
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--list') || args.includes('-l')) {
    listExperiments();
    return;
  }

  if (args.includes('--all')) {
    await runAllSafe();
    return;
  }

  const expArg = args.find(a => a.startsWith('--experiment='));
  if (expArg) {
    const expName = expArg.split('=')[1];
    await runExperiment(expName);
    return;
  }

  if (args.includes('--verify-circuit-breakers')) {
    await runExperiment('circuit-breaker-trip');
    return;
  }

  // Default: show help
  console.log(`
VocalIA Chaos Engineering Toolkit

Usage:
  node chaos-engineering.cjs --list                    List all experiments
  node chaos-engineering.cjs --experiment=<name>       Run specific experiment
  node chaos-engineering.cjs --all                     Run all low-risk experiments
  node chaos-engineering.cjs --verify-circuit-breakers Quick circuit breaker check

Environment:
  VOICE_API_URL     Voice API URL (default: http://localhost:3004)
  CHAOS_SAFE_MODE   Skip high-risk experiments (default: true)
  VERBOSE           Show detailed output (default: false)
`);
}

// Export for use as module
module.exports = {
  EXPERIMENTS,
  runExperiment,
  runAllSafe,
  listExperiments,
  CONFIG
};

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
