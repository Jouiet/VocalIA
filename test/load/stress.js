/**
 * VocalIA k6 Stress Test
 * Session 250.65
 *
 * Stress testing - find system breaking point
 * Run: k6 run test/load/stress.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

// Configuration - aggressive ramp up
export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp to 100 users
    { duration: '5m', target: 100 },  // Hold at 100
    { duration: '2m', target: 200 },  // Ramp to 200 users
    { duration: '5m', target: 200 },  // Hold at 200
    { duration: '2m', target: 300 },  // Ramp to 300 users
    { duration: '5m', target: 300 },  // Hold at 300
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'], // 95% under 5s (stress conditions)
    http_req_failed: ['rate<0.10'],    // Less than 10% failures
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

const endpoints = [
  '/',
  '/features/',
  '/pricing/',
  '/about/',
  '/contact/',
  '/docs/',
  '/products/voice-widget/',
  '/products/voice-telephony/',
];

export default function() {
  const path = endpoints[Math.floor(Math.random() * endpoints.length)];

  const res = http.get(`${BASE_URL}${path}`, {
    timeout: '10s',
    tags: { endpoint: path },
  });

  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 5s': (r) => r.timings.duration < 5000,
  });

  if (!success) {
    errorRate.add(1);
    if (res.status >= 500) {
      console.log(`Server error: ${res.status} on ${path}`);
    }
  }

  sleep(Math.random() * 2); // 0-2 seconds
}
