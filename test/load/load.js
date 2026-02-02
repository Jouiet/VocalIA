/**
 * VocalIA k6 Load Test
 * Session 250.65
 *
 * Normal load testing - simulate typical production traffic
 * Run: k6 run test/load/load.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const pageLoadTime = new Trend('page_load_time');

// Configuration - ramp up to 50 users
export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Ramp up to 10 users
    { duration: '3m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% requests under 2s
    http_req_failed: ['rate<0.05'],    // Less than 5% failures
    errors: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const API_URL = __ENV.API_URL || 'http://localhost:3004';

// Page weights (realistic traffic distribution)
const pages = [
  { path: '/', weight: 30 },
  { path: '/features/', weight: 20 },
  { path: '/pricing/', weight: 25 },
  { path: '/about/', weight: 10 },
  { path: '/contact/', weight: 10 },
  { path: '/docs/', weight: 5 },
];

function selectPage() {
  const total = pages.reduce((sum, p) => sum + p.weight, 0);
  let random = Math.random() * total;
  for (const page of pages) {
    random -= page.weight;
    if (random <= 0) return page.path;
  }
  return '/';
}

export default function() {
  // Select random page based on weight
  const path = selectPage();
  const start = Date.now();

  const res = http.get(`${BASE_URL}${path}`, {
    tags: { page: path },
  });

  const loadTime = Date.now() - start;
  pageLoadTime.add(loadTime);

  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 2s': (r) => r.timings.duration < 2000,
  });

  if (!success) {
    errorRate.add(1);
  }

  // Simulate user think time
  sleep(Math.random() * 3 + 1); // 1-4 seconds
}

// Setup - verify endpoints before load test
export function setup() {
  console.log('VocalIA Load Test Starting...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`API URL: ${API_URL}`);

  // Quick health check
  const res = http.get(`${BASE_URL}/`);
  if (res.status !== 200) {
    console.error('WARNING: Homepage not accessible');
  }

  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`\nLoad test completed in ${duration.toFixed(1)}s`);
}
