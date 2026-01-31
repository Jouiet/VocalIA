/**
 * VocalIA Voice API Load Tests
 * Session 250.12 - P3 Task #39
 *
 * Run with: k6 run test/k6/voice-api-load.js
 *
 * Prerequisites:
 *   brew install k6  (macOS)
 *   npm install -g k6  (alternative)
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');
const successfulCalls = new Counter('successful_calls');
const failedCalls = new Counter('failed_calls');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3004';
const PERSONAS = ['AGENCY', 'DENTAL', 'PROPERTY', 'UNIVERSAL_ECOMMERCE', 'UNIVERSAL_SME'];
const LANGUAGES = ['fr', 'en', 'es', 'ar', 'ary'];

// Test scenarios
export const options = {
  scenarios: {
    // Scenario 1: Smoke test (sanity check)
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      startTime: '0s',
      tags: { scenario: 'smoke' },
    },
    // Scenario 2: Normal load (typical traffic)
    normal_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 10 },  // Ramp up to 10 users
        { duration: '3m', target: 10 },  // Stay at 10 users
        { duration: '1m', target: 0 },   // Ramp down
      ],
      startTime: '30s',
      tags: { scenario: 'normal' },
    },
    // Scenario 3: Stress test (peak hours)
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },   // Ramp up to 50 users
        { duration: '5m', target: 50 },   // Stay at 50 users
        { duration: '2m', target: 100 },  // Spike to 100 users
        { duration: '3m', target: 100 },  // Stay at 100 users
        { duration: '2m', target: 0 },    // Ramp down
      ],
      startTime: '6m',
      tags: { scenario: 'stress' },
    },
    // Scenario 4: Spike test (sudden traffic burst)
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 100 }, // Instant spike
        { duration: '1m', target: 100 },  // Hold spike
        { duration: '10s', target: 0 },   // Instant drop
      ],
      startTime: '20m',
      tags: { scenario: 'spike' },
    },
  },
  thresholds: {
    // SLA: 99% of requests under 500ms
    'http_req_duration': ['p(99)<500'],
    // SLA: Error rate below 1%
    'errors': ['rate<0.01'],
    // SLA: 95% of requests under 200ms
    'http_req_duration{scenario:normal}': ['p(95)<200'],
    // Stress test allows higher latency
    'http_req_duration{scenario:stress}': ['p(95)<1000'],
  },
};

// Test data generators
function randomPersona() {
  return PERSONAS[Math.floor(Math.random() * PERSONAS.length)];
}

function randomLanguage() {
  return LANGUAGES[Math.floor(Math.random() * LANGUAGES.length)];
}

function randomSessionId() {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

function randomUserMessage() {
  const messages = [
    'Bonjour, je voudrais prendre rendez-vous',
    'What are your business hours?',
    'Quel est le prix de vos services?',
    'I need help with my order',
    'Je cherche des informations sur vos produits',
    'Can I speak to a human?',
    'Merci, au revoir',
    'What services do you offer?',
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

// Main test function
export default function () {
  const sessionId = randomSessionId();
  const persona = randomPersona();
  const lang = randomLanguage();

  group('Health Check', function () {
    const healthRes = http.get(`${BASE_URL}/health`);

    check(healthRes, {
      'health check status is 200': (r) => r.status === 200,
      'health check response has status': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.status === 'healthy' || body.status === 'ok';
        } catch {
          return false;
        }
      },
    });

    responseTime.add(healthRes.timings.duration);
    errorRate.add(healthRes.status !== 200);
  });

  group('Voice Respond API', function () {
    const payload = JSON.stringify({
      message: randomUserMessage(),
      sessionId: sessionId,
      persona: persona,
      lang: lang,
      conversationHistory: [],
    });

    const params = {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: '10s',
    };

    const res = http.post(`${BASE_URL}/respond`, payload, params);

    const isSuccess = check(res, {
      'respond status is 200': (r) => r.status === 200,
      'respond has reply': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.reply && body.reply.length > 0;
        } catch {
          return false;
        }
      },
      'respond time under 500ms': (r) => r.timings.duration < 500,
    });

    responseTime.add(res.timings.duration);
    errorRate.add(res.status !== 200);

    if (isSuccess) {
      successfulCalls.add(1);
    } else {
      failedCalls.add(1);
    }
  });

  group('Dashboard Metrics API', function () {
    const metricsRes = http.get(`${BASE_URL}/dashboard/metrics`);

    check(metricsRes, {
      'metrics status is 200': (r) => r.status === 200,
      'metrics has stats': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.stats !== undefined;
        } catch {
          return false;
        }
      },
    });

    responseTime.add(metricsRes.timings.duration);
    errorRate.add(metricsRes.status !== 200);
  });

  group('Lead Qualification Flow', function () {
    // Simulate multi-turn conversation
    const turns = [
      'Bonjour, je suis intéressé par vos services',
      'Mon budget est de 5000 euros',
      'Je souhaite commencer le mois prochain',
      'Je suis le directeur commercial',
    ];

    let conversationHistory = [];

    for (let i = 0; i < Math.min(2, turns.length); i++) {
      const payload = JSON.stringify({
        message: turns[i],
        sessionId: sessionId,
        persona: 'AGENCY',
        lang: 'fr',
        conversationHistory: conversationHistory,
      });

      const res = http.post(`${BASE_URL}/respond`, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: '10s',
      });

      if (res.status === 200) {
        try {
          const body = JSON.parse(res.body);
          conversationHistory.push(
            { role: 'user', content: turns[i] },
            { role: 'assistant', content: body.reply }
          );
        } catch {
          // Continue anyway
        }
      }

      sleep(0.5); // Realistic delay between turns
    }
  });

  sleep(Math.random() * 2 + 1); // 1-3 second think time
}

// Setup function (runs once before tests)
export function setup() {
  console.log(`Starting load test against ${BASE_URL}`);

  // Verify API is reachable
  const healthRes = http.get(`${BASE_URL}/health`);
  if (healthRes.status !== 200) {
    console.error(`API health check failed: ${healthRes.status}`);
    console.error('Make sure the Voice API is running: node core/voice-api-resilient.cjs');
  }

  return { startTime: new Date().toISOString() };
}

// Teardown function (runs once after tests)
export function teardown(data) {
  console.log(`Load test completed. Started at: ${data.startTime}`);
  console.log(`Finished at: ${new Date().toISOString()}`);
}

// Custom summary
export function handleSummary(data) {
  return {
    'test/k6/results/summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

// Text summary helper
function textSummary(data, options) {
  const { metrics } = data;

  let output = '\n========== VOCALIA LOAD TEST SUMMARY ==========\n\n';

  output += '📊 Request Metrics:\n';
  output += `   Total Requests: ${metrics.http_reqs?.values?.count || 0}\n`;
  output += `   Successful: ${metrics.successful_calls?.values?.count || 0}\n`;
  output += `   Failed: ${metrics.failed_calls?.values?.count || 0}\n`;
  output += `   Error Rate: ${((metrics.errors?.values?.rate || 0) * 100).toFixed(2)}%\n\n`;

  output += '⏱️ Response Time:\n';
  output += `   Average: ${(metrics.http_req_duration?.values?.avg || 0).toFixed(2)}ms\n`;
  output += `   Median (p50): ${(metrics.http_req_duration?.values?.['p(50)'] || 0).toFixed(2)}ms\n`;
  output += `   p95: ${(metrics.http_req_duration?.values?.['p(95)'] || 0).toFixed(2)}ms\n`;
  output += `   p99: ${(metrics.http_req_duration?.values?.['p(99)'] || 0).toFixed(2)}ms\n`;
  output += `   Max: ${(metrics.http_req_duration?.values?.max || 0).toFixed(2)}ms\n\n`;

  output += '✅ Thresholds:\n';
  for (const [name, threshold] of Object.entries(data.root_group?.checks || {})) {
    const passed = threshold.passes || 0;
    const failed = threshold.fails || 0;
    const total = passed + failed;
    const status = failed === 0 ? '✅' : '❌';
    output += `   ${status} ${name}: ${passed}/${total} passed\n`;
  }

  output += '\n================================================\n';

  return output;
}
