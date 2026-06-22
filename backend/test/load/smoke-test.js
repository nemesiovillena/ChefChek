// ChefChek Smoke Test - Quick health check for CI
// Run: k6 run test/load/smoke-test.js

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 5 },
    { duration: '20s', target: 5 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'],
    http_req_failed: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3001';

export default function () {
  // Health check
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health is 200': (r) => r.status === 200,
    'health < 50ms': (r) => r.timings.duration < 50,
  });

  // Login attempt (expected 401 with bad creds)
  const loginRes = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email: 'smoke@test.com', password: 'wrong', tenantId: 'none' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(loginRes, {
    'login rejects bad creds': (r) => r.status === 401 || r.status === 400 || r.status === 404,
    'login < 500ms': (r) => r.timings.duration < 500,
  });

  // Unauthenticated product list
  const productsRes = http.get(`${BASE_URL}/api/v1/products`);
  check(productsRes, {
    'products requires auth': (r) => r.status === 401 || r.status === 403,
    'products < 200ms': (r) => r.timings.duration < 200,
  });

  sleep(1);
}
