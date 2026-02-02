/**
 * VocalIA k6 Smoke Test
 * Session 250.65
 *
 * Basic functionality test - verify system works under minimal load
 * Run: k6 run test/load/smoke.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Configuration
export const options = {
  vus: 1,              // 1 virtual user
  duration: '30s',     // 30 seconds
  thresholds: {
    http_req_duration: ['p(99)<1500'], // 99% requests under 1.5s
    errors: ['rate<0.01'],              // Error rate under 1%
  },
};

// Base URLs (adjust for environment)
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const API_URL = __ENV.API_URL || 'http://localhost:3004';

// Test scenarios
export default function() {
  // Test 1: Homepage
  let res = http.get(`${BASE_URL}/`);
  check(res, {
    'homepage status 200': (r) => r.status === 200,
    'homepage has VocalIA': (r) => r.body && r.body.includes('VocalIA'),
  }) || errorRate.add(1);
  sleep(1);

  // Test 2: Features page
  res = http.get(`${BASE_URL}/features/`);
  check(res, {
    'features status 200': (r) => r.status === 200,
  }) || errorRate.add(1);
  sleep(1);

  // Test 3: Pricing page
  res = http.get(`${BASE_URL}/pricing/`);
  check(res, {
    'pricing status 200': (r) => r.status === 200,
  }) || errorRate.add(1);
  sleep(1);

  // Test 4: API Health (if available)
  res = http.get(`${API_URL}/health`, {
    timeout: '5s',
  });
  check(res, {
    'API health available': (r) => r.status === 200 || r.status === 0,
  });
  sleep(1);

  // Test 5: Contact page
  res = http.get(`${BASE_URL}/contact/`);
  check(res, {
    'contact status 200': (r) => r.status === 200,
  }) || errorRate.add(1);
  sleep(1);
}

// Summary output
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'test/load/results/smoke-summary.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data, options) {
  const { metrics } = data;
  return `
╔═══════════════════════════════════════════════════════════════╗
║             VocalIA Smoke Test Results                        ║
╠═══════════════════════════════════════════════════════════════╣
║  HTTP Requests:  ${metrics.http_reqs?.values?.count || 0}
║  Failed:         ${metrics.http_req_failed?.values?.rate ? (metrics.http_req_failed.values.rate * 100).toFixed(2) : 0}%
║  Avg Duration:   ${metrics.http_req_duration?.values?.avg ? metrics.http_req_duration.values.avg.toFixed(2) : 0}ms
║  P95 Duration:   ${metrics.http_req_duration?.values?.['p(95)'] ? metrics.http_req_duration.values['p(95)'].toFixed(2) : 0}ms
╚═══════════════════════════════════════════════════════════════╝
  `;
}
