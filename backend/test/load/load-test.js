// ChefChek API Load Testing Configuration
// Run with: k6 run test/load/load-test.js

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate } from 'k6/metrics';

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 10 },    // Stay at 10 users
    { duration: '30s', target: 50 },   // Ramp up to 50 users
    { duration: '1m', target: 50 },    // Stay at 50 users
    { duration: '30s', target: 100 },  // Ramp up to 100 users
    { duration: '2m', target: 100 },   // Stay at 100 users
    { duration: '30s', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% under 500ms, 99% under 1s
    http_req_failed: ['rate<0.01'],          // Less than 1% failures
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3001';

// Helper functions
function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${__ENV.AUTH_TOKEN || 'test-token'}`,
  };
}

// Test data
const testTenant = {
  name: 'Load Test Restaurant',
  slug: 'load-test-restaurant',
  isActive: true,
};

export default function () {
  // Scenario 1: Health check
  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/health`, {
      tags: { name: 'Health' },
    });

    check(res, {
      'Health check status is 200': (r) => r.status === 200,
      'Health check response time < 100ms': (r) => r.timings.duration < 100,
    });
  });

  // Scenario 2: Authentication flow
  group('Authentication Flow', () => {
    // Login
    const loginRes = http.post(
      `${BASE_URL}/api/v1/auth/login`,
      JSON.stringify({
        email: __ENV.TEST_EMAIL || 'load-test@example.com',
        password: __ENV.TEST_PASSWORD || 'TestPass123!',
        tenantSlug: 'load-test-restaurant',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'Login' },
      }
    );

    check(loginRes, {
      'Login returns 201': (r) => r.status === 201,
      'Login returns token': (r) =>
        r.json('data.token').length > 0,
      'Login response time < 500ms': (r) => r.timings.duration < 500,
    });

    const token = loginRes.json('data.token');

    // Validate session
    if (token) {
      const validateRes = http.get(
        `${BASE_URL}/api/v1/auth/validate`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          tags: { name: 'Validate Session' },
        }
      );

      check(validateRes, {
        'Session validation passes': (r) => r.status === 200,
        'Session validation time < 200ms': (r) => r.timings.duration < 200,
      });
    }
  });

  // Scenario 3: Products CRUD
  group('Products CRUD', () => {
    const authToken = __ENV.AUTH_TOKEN || 'test-token';

    // Create product
    const createRes = http.post(
      `${BASE_URL}/api/v1/products`,
      JSON.stringify({
        name: `Load Test Product ${Math.random().toString(36).substring(7)}`,
        description: 'Product created during load test',
        tenantId: 'test-tenant',
        purchaseUnit: 'kg',
        storageUnit: 'kg',
        recipeUnit: 'g',
        purchasePrice: 5.50,
        netPrice: 7.00,
        category: 'Vegetables',
      }),
      {
        headers: getAuthHeaders(),
        tags: { name: 'Create Product' },
      }
    );

    check(createRes, {
      'Create product returns 201': (r) => r.status === 201,
      'Create product response time < 300ms': (r) => r.timings.duration < 300,
    });

    // Read products
    const readRes = http.get(
      `${BASE_URL}/api/v1/products`,
      {
        headers: getAuthHeaders(),
        tags: { name: 'List Products' },
      }
    );

    check(readRes, {
      'List products returns 200': (r) => r.status === 200,
      'List products response time < 200ms': (r) => r.timings.duration < 200,
    });

    sleep(1);
  });

  // Scenario 4: Menu operations
  group('Menu Operations', () => {
    const authToken = __ENV.AUTH_TOKEN || 'test-token';

    // Create menu
    const createMenuRes = http.post(
      `${BASE_URL}/api/v1/menus`,
      JSON.stringify({
        name: `Load Test Menu ${Math.random().toString(36).substring(7)}`,
        tenantId: 'test-tenant',
        portions: 100,
      }),
      {
        headers: getAuthHeaders(),
        tags: { name: 'Create Menu' },
      }
    );

    check(createMenuRes, {
      'Create menu returns 201': (r) => r.status === 201,
      'Create menu response time < 300ms': (r) => r.timings.duration < 300,
    });

    // Get menu
    const getMenuRes = http.get(
      `${BASE_URL}/api/v1/menus`,
      {
        headers: getAuthHeaders(),
        tags: { name: 'Get Menu' },
      }
    );

    check(getMenuRes, {
      'Get menu returns 200': (r) => r.status === 200,
      'Get menu response time < 200ms': r => r.timings.duration < 200,
    });

    sleep(1);
  });

  // Scenario 5: Dashboard metrics
  group('Dashboard Metrics', () => {
    const authToken = __ENV.AUTH_TOKEN || 'test-token';

    // Get processing stats
    const statsRes = http.get(
      `${BASE_URL}/api/v1/ingesta/stats`,
      {
        headers: getAuthHeaders(),
        tags: { name: 'Ingesta Stats' },
      }
    );

    check(statsRes, {
      'Get stats returns 200': (r) => r.status === 200,
      'Get stats response time < 500ms': (r) => r.timings.duration < 500,
    });

    // Get sala stats
    const salaStatsRes = http.get(
      `${BASE_URL}/api/v1/sala/stats`,
      {
        headers: getAuthHeaders(),
        tags: { name: 'Sala Stats' },
      }
    );

    check(salaStatsRes, {
      'Get sala stats returns 200': (r) => r.status === 200,
      'Get sala stats response time < 300ms': (r) => r.timings.duration < 300,
    });

    // Get dashboard metrics
    const dashboardRes = http.get(
      `${BASE_URL}/api/v1/dashboard/metrics`,
      {
        headers: getAuthHeaders(),
        tags: { name: 'Dashboard Metrics' },
      }
    );

    check(dashboardRes, {
      'Get dashboard metrics returns 200': (r) => r.status === 200,
      'Get dashboard metrics response time < 400ms': (r) => r.timings.duration < 400,
    });
  });

  // Scenario 6: Concurrent QR scans
  group('QR Scanning Load', () => {
    const digitalMenuId = __ENV.DIGITAL_MENU_ID || 'test-menu';

    // Validate QR
    const qrRes = http.post(
      `${BASE_URL}/api/v1/sala/qr/validate`,
      JSON.stringify({
        qrCode: digitalMenuId,
        ipAddress: '127.0.0.1',
        userAgent: 'Load Test Client',
        language: 'es',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'Validate QR' },
      }
    );

    check(qrRes, {
      'QR validation returns 200': (r) => r.status === 200,
      'QR validation response time < 200ms': (r) => r.timings.duration < 200,
    });

    // Track interaction
    const interactionRes = http.post(
      `${BASE_URL}/api/v1/sala/interaction`,
      JSON.stringify({
        digitalMenuId,
        interactionType: 'view',
        menuItemId: 'test-item',
        ipAddress: '127.0.0.1',
        userAgent: 'Load Test Client',
        language: 'es',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'Track Interaction' },
      }
    );

    check(interactionRes, {
      'Track interaction returns 201': (r) => r.status === 201,
      'Track interaction response time < 200ms': (r) => r.timings.duration < 200,
    });

    sleep(0.5);
  });

  // Scenario 7: Feedback submission
  group('Feedback Submission', () => {
    const digitalMenuId = __ENV.DIGITAL_MENU_ID || 'test-menu';

    const feedbackRes = http.post(
      `${BASE_URL}/api/v1/sala/feedback`,
      JSON.stringify({
        digitalMenuId,
        type: 'RATING',
        menuItemId: 'test-dish',
        rating: Math.floor(Math.random() * 5) + 1,
        comment: 'Load test feedback',
        category: 'FOOD_QUALITY',
        customerName: 'Load Test User',
        customerEmail: 'load-test@example.com',
        ipAddress: '127.0.0.1',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'Submit Feedback' },
      }
    );

    check(feedbackRes, {
      'Submit feedback returns 201': (r) => r.status === 201,
      'Submit feedback response time < 300ms': (r) => r.timings.duration < 300,
    });
  });

  // Scenario 8: Document ingestion
  group('Document Ingestion', () => {
    const authToken = __ENV.AUTH_TOKEN || 'test-token';

    // Create document
    const docRes = http.post(
      `${BASE_URL}/api/v1/ingesta/document`,
      JSON.stringify({
        tenantId: 'test-tenant',
        documentType: 'RECEIPT',
        fileUrl: 'https://example.com/receipt.pdf',
        source: 'api',
      }),
      {
        headers: getAuthHeaders(),
        tags: { name: 'Create Document' },
      }
    );

    check(docRes, {
      'Create document returns 201': (r) => r.status === 201,
      'Create document response time < 500ms': (r) => r.timings.duration < 500,
    });

    // Get documents
    const docsRes = http.get(
      `${BASE_URL}/api/v1/ingesta/documents`,
      {
        headers: getAuthHeaders(),
        tags: { name: 'List Documents' },
      }
    );

    check(docsRes, {
      'List documents returns 200': (r) => r.status === 200,
      'List documents response time < 300ms': (r) => r.timings.duration < 300,
    });

    sleep(2);
  });

  // Scenario 9: Tenant operations
  group('Tenant Operations', () => {
    // Get tenant
    const tenantRes = http.get(`${BASE_URL}/api/v1/tenants`, {
      tags: { name: 'List Tenants' },
    });

    check(tenantRes, {
      'List tenants returns 200': (r) => r.status === 200,
      'List tenants response time < 300ms': (r) => r.timings.duration < 300,
    });

    sleep(0.5);
  });

  // Scenario 10: Error handling
  group('Error Handling', () => {
    // Invalid login
    const invalidLoginRes = http.post(
      `${BASE_URL}/api/v1/auth/login`,
      JSON.stringify({
        email: 'invalid@example.com',
        password: 'wrong-password',
        tenantSlug: 'invalid-tenant',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'Invalid Login' },
      }
    );

    check(invalidLoginRes, {
      'Invalid login returns 401': (r) => r.status === 401,
      'Invalid login response time < 500ms': (r) => r.timings.duration < 500,
    });

    // Invalid QR code
    const invalidQrRes = http.post(
      `${BASE_URL}/api/v1/sala/qr/validate`,
      JSON.stringify({
        qrCode: 'invalid-qr',
        ipAddress: '127.0.0.1',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'Invalid QR' },
      }
    );

    check(invalidQrRes, {
      'Invalid QR returns 200': (r) => r.status === 200,
      'Invalid QR is not valid': (r) => r.json('isValid') === false,
      'Invalid QR response time < 200ms': (r) => r.timings.duration < 200,
    });

    // Unauthorized access
    const unauthorizedRes = http.post(
      `${BASE_URL}/api/v1/products`,
      JSON.stringify({
        name: 'Unauthorized Product',
        tenantId: 'test-tenant',
        purchaseUnit: 'kg',
        storageUnit: 'kg',
        recipeUnit: 'g',
        purchasePrice: 5.0,
        netPrice: 6.0,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'Unauthorized Access' },
      }
    );

    check(unauthorizedRes, {
      'Unauthorized access returns 401': (r) => r.status === 401,
      'Unauthorized response time < 100ms': (r) => r.timings.duration < 100,
    });
  });
}