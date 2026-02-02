/**
 * VocalIA k6 Spike Test
 * Session 250.65
 *
 * Spike testing - sudden traffic burst simulation
 * Run: k6 run test/load/spike.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

// Configuration - sudden spike
export const options = {
  stages: [
    { duration: '10s', target: 10 },   // Normal load
    { duration: '1m', target: 10 },    // Stay normal
    { duration: '10s', target: 500 },  // SPIKE! 500 users
    { duration: '3m', target: 500 },   // Hold spike
    { duration: '10s', target: 10 },   // Back to normal
    { duration: '1m', target: 10 },    // Recovery period
    { duration: '10s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(99)<10000'], // 99% under 10s during spike
    http_req_failed: ['rate<0.15'],     // Up to 15% failures during spike
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

// Critical pages only for spike test
const criticalPages = ['/', '/pricing/', '/contact/'];

export default function() {
  const path = criticalPages[Math.floor(Math.random() * criticalPages.length)];

  const res = http.get(`${BASE_URL}${path}`, {
    timeout: '15s',
    tags: { page: path },
  });

  const success = check(res, {
    'status is 200': (r) => r.status === 200,
  });

  if (!success) {
    errorRate.add(1);
  }

  sleep(Math.random() * 0.5); // Fast requests during spike
}

export function setup() {
  console.log('╔═══════════════════════════════════════╗');
  console.log('║     VocalIA SPIKE Test Starting       ║');
  console.log('║  WARNING: Will simulate 500 users!    ║');
  console.log('╚═══════════════════════════════════════╝');
}
