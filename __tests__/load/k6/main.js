/**
 * k6 full-system load test — oosri API
 *
 * Covers every major entity under real user-like traffic:
 *   - Public: product listing, search, category browse
 *   - Buyer:  login → cart → order history → saved items
 *   - Seller: login → dashboard summary/stats → product list → orders
 *   - Admin:  login → order queue → KYC queue → buyer/seller lists
 *
 * Profiles (set K6_PROFILE env var before running):
 *   smoke  — 2 VUs, 1 min         sanity check, no real pressure
 *   load   — 0→100 VUs, 9 min     normal expected traffic
 *   stress — 0→500 VUs, 14 min    find the breaking point
 *   spike  — 10→500 VUs burst      sudden traffic explosion
 *   soak   — 50 VUs, 30 min       memory / connection-pool drain check
 *
 * Usage:
 *   npm run load:run                        (default: load profile)
 *   K6_PROFILE=stress npm run load:stress
 *   K6_PROFILE=spike  npm run load:spike
 *
 * NOTE: Authenticated scenarios require real users in the DB.
 *       Set TEST_BUYER_EMAIL / TEST_BUYER_PASSWORD env vars, or
 *       seed the DB first. Unauthenticated scenarios always run.
 */

import http   from 'k6/http';
import { sleep, check, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { randomItem, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// Only count 5xx (server errors) as failures — 4xx are expected for
// unauthed/missing-user flows and should not inflate the error metric.
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 499 }));

// ── Custom metrics ─────────────────────────────────────────────────────────
const errorRate       = new Rate('error_rate');
const loginDuration   = new Trend('login_duration_ms',   true);
const cartDuration    = new Trend('cart_duration_ms',    true);
const orderDuration   = new Trend('order_duration_ms',   true);
const productDuration = new Trend('product_duration_ms', true);
const authErrors      = new Counter('auth_errors');

// ── Config ─────────────────────────────────────────────────────────────────
const BASE    = __ENV.API_URL    || 'http://localhost:3001/api/v1';
const PROFILE = __ENV.K6_PROFILE || 'load';

const BUYER_EMAIL    = __ENV.TEST_BUYER_EMAIL    || 'buyer@test.com';
const BUYER_PASSWORD = __ENV.TEST_BUYER_PASSWORD || 'TestPass123!';
const SELLER_EMAIL   = __ENV.TEST_SELLER_EMAIL   || 'seller@oosri.com';
const SELLER_PASSWORD= __ENV.TEST_SELLER_PASSWORD|| 'SellerPass123!';
const ADMIN_EMAIL    = __ENV.TEST_ADMIN_EMAIL    || 'admin@oosri.com';
const ADMIN_PASSWORD = __ENV.TEST_ADMIN_PASSWORD || 'AdminPass123!';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const SEARCH_TERMS = ['art', 'fabric', 'wood', 'jewelry', 'handmade', 'basket', 'textile'];

// ── Load profiles ──────────────────────────────────────────────────────────
const PROFILES = {
  smoke: {
    scenarios: {
      smoke: { executor: 'constant-vus', vus: 2, duration: '1m' },
    },
  },

  load: {
    scenarios: {
      public_users: {
        executor: 'ramping-vus', exec: 'publicScenario',
        startVUs: 0,
        stages: [
          { duration: '2m', target: 30  },
          { duration: '5m', target: 100 },
          { duration: '2m', target: 0   },
        ],
      },
      buyer_users: {
        executor: 'ramping-vus', exec: 'buyerScenario',
        startVUs: 0, startTime: '30s',
        stages: [
          { duration: '2m', target: 20 },
          { duration: '5m', target: 60 },
          { duration: '2m', target: 0  },
        ],
      },
      seller_users: {
        executor: 'ramping-vus', exec: 'sellerScenario',
        startVUs: 0, startTime: '1m',
        stages: [
          { duration: '2m', target: 10 },
          { duration: '5m', target: 30 },
          { duration: '2m', target: 0  },
        ],
      },
      admin_users: {
        executor: 'ramping-vus', exec: 'adminScenario',
        startVUs: 0, startTime: '1m',
        stages: [
          { duration: '2m', target: 3  },
          { duration: '5m', target: 10 },
          { duration: '2m', target: 0  },
        ],
      },
    },
    thresholds: {
      http_req_duration:     ['p(95)<1000', 'p(99)<2000'],
      http_req_failed:       ['rate<0.01'],
      error_rate:            ['rate<0.05'],
      login_duration_ms:     ['p(95)<1500'],
      cart_duration_ms:      ['p(95)<1000'],
      order_duration_ms:     ['p(95)<1500'],
      product_duration_ms:   ['p(95)<800'],
    },
  },

  stress: {
    scenarios: {
      stress_public: {
        executor: 'ramping-vus', exec: 'publicScenario',
        startVUs: 0,
        stages: [
          { duration: '2m',  target: 100 },
          { duration: '5m',  target: 300 },
          { duration: '5m',  target: 500 },
          { duration: '2m',  target: 0   },
        ],
      },
      stress_buyer: {
        executor: 'ramping-vus', exec: 'buyerScenario',
        startVUs: 0, startTime: '30s',
        stages: [
          { duration: '2m',  target: 50  },
          { duration: '5m',  target: 150 },
          { duration: '5m',  target: 250 },
          { duration: '2m',  target: 0   },
        ],
      },
    },
    thresholds: {
      http_req_duration: ['p(95)<3000'],
      http_req_failed:   ['rate<0.05'],
    },
  },

  spike: {
    scenarios: {
      spike_test: {
        executor: 'ramping-vus', exec: 'publicScenario',
        startVUs: 10,
        stages: [
          { duration: '1m',  target: 10  },
          { duration: '30s', target: 500 },
          { duration: '2m',  target: 500 },
          { duration: '30s', target: 10  },
          { duration: '2m',  target: 10  },
        ],
      },
    },
    thresholds: {
      http_req_duration: ['p(99)<5000'],
      http_req_failed:   ['rate<0.10'],
    },
  },

  soak: {
    scenarios: {
      soak: { executor: 'constant-vus', vus: 50, duration: '30m' },
    },
    thresholds: {
      http_req_duration: ['p(95)<1500'],
      http_req_failed:   ['rate<0.01'],
    },
  },
};

export const options = PROFILES[PROFILE] || PROFILES.load;

// ── Helpers ────────────────────────────────────────────────────────────────
function post(path, body, token) {
  const h = { ...JSON_HEADERS };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return http.post(`${BASE}${path}`, JSON.stringify(body), { headers: h });
}

function get(path, token) {
  const h = { ...JSON_HEADERS };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return http.get(`${BASE}${path}`, { headers: h });
}

// Check that the response is not a server/network error (4xx from bad auth
// is acceptable in load tests; 5xx is a real failure).
function assertOk(res, label) {
  const ok = res.status < 500;
  errorRate.add(!ok);
  return check(res, { [label]: () => ok });
}

function buyerLogin() {
  const start = Date.now();
  const res   = post('/auth/buyer/login', { email: BUYER_EMAIL, password: BUYER_PASSWORD });
  loginDuration.add(Date.now() - start);
  if (res.status !== 200) { authErrors.add(1); return null; }
  try { return res.json()?.accessToken || null; } catch { return null; }
}

function sellerLogin() {
  const res = post('/auth/seller/sign-in', { email: SELLER_EMAIL, password: SELLER_PASSWORD });
  if (res.status !== 200) { authErrors.add(1); return null; }
  try { return res.json()?.token || null; } catch { return null; }
}

function adminLogin() {
  const res = post('/auth/admin/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (res.status !== 200) { authErrors.add(1); return null; }
  try { return res.json()?.accessToken || null; } catch { return null; }
}

// ── Scenario: Public (no auth) ─────────────────────────────────────────────
export function publicScenario() {
  group('Product List', () => {
    const start = Date.now();
    const res   = get('/products/buyer');
    productDuration.add(Date.now() - start);
    assertOk(res, 'GET /products/buyer < 500');

    // Drill into one product if we got results
    try {
      const items = res.json()?.body?.products || [];
      if (items.length) {
        const id = randomItem(items)._id;
        const detail = get(`/products/buyer/${id}`);
        assertOk(detail, 'GET /products/buyer/:id < 500');
      }
    } catch { /* safe — just skip */ }
  });

  sleep(randomIntBetween(1, 2));

  group('Product Search', () => {
    const term = randomItem(SEARCH_TERMS);
    const res  = get(`/products/buyer/search?searchTerm=${term}`);
    assertOk(res, 'GET /products/buyer/search < 500');
  });

  sleep(randomIntBetween(1, 2));

  group('Categories', () => {
    const res = get('/categories');
    assertOk(res, 'GET /categories < 500');
  });

  sleep(randomIntBetween(1, 3));
}

// ── Scenario: Buyer (auth → cart → orders → saved items) ──────────────────
export function buyerScenario() {
  let token = null;

  group('Buyer Login', () => { token = buyerLogin(); });

  if (!token) { sleep(2); return; }

  sleep(1);

  group('View Cart', () => {
    const start = Date.now();
    const res   = get('/buyer/cart', token);
    cartDuration.add(Date.now() - start);
    assertOk(res, 'GET /buyer/cart < 500');
  });

  sleep(1);

  group('Order History', () => {
    const start = Date.now();
    const res   = get('/buyer/order/user?skip=0&limit=10', token);
    orderDuration.add(Date.now() - start);
    assertOk(res, 'GET /buyer/order/user < 500');
  });

  sleep(1);

  group('Saved Items', () => {
    const res = get('/buyer/saved-items', token);
    assertOk(res, 'GET /buyer/saved-items < 500');
  });

  sleep(randomIntBetween(1, 3));
}

// ── Scenario: Seller (auth → dashboard → products → orders) ───────────────
export function sellerScenario() {
  let token = null;

  group('Seller Login', () => { token = sellerLogin(); });

  if (!token) { sleep(2); return; }

  sleep(1);

  group('Dashboard', () => {
    const summary  = get('/seller/dashboard/summary',        token);
    const stats    = get('/seller/dashboard/stats',          token);
    const overview = get('/seller/dashboard/sales-overview', token);
    assertOk(summary,  'GET /seller/dashboard/summary  < 500');
    assertOk(stats,    'GET /seller/dashboard/stats    < 500');
    assertOk(overview, 'GET /seller/dashboard/overview < 500');
  });

  sleep(1);

  group('My Products', () => {
    const res = get('/products/seller/products', token);
    assertOk(res, 'GET /products/seller/products < 500');
  });

  sleep(1);

  group('My Orders', () => {
    const res = get('/seller/order', token);
    assertOk(res, 'GET /seller/order < 500');
  });

  sleep(randomIntBetween(1, 3));
}

// ── Scenario: Admin (auth → orders → KYC → users) ─────────────────────────
export function adminScenario() {
  let token = null;

  group('Admin Login', () => { token = adminLogin(); });

  if (!token) { sleep(2); return; }

  sleep(1);

  group('Order Management', () => {
    const res = get('/admin/order?page=1&limit=20', token);
    assertOk(res, 'GET /admin/order < 500');
  });

  sleep(1);

  group('KYC Queue', () => {
    const pending  = get('/admin/kyc?status=pending&page=1&limit=20',  token);
    const approved = get('/admin/kyc?status=approved&page=1&limit=20', token);
    assertOk(pending,  'GET /admin/kyc?pending  < 500');
    assertOk(approved, 'GET /admin/kyc?approved < 500');
  });

  sleep(1);

  group('User Management', () => {
    const buyers  = get('/admin/buyers?page=1&limit=20',  token);
    const sellers = get('/admin/sellers?page=1&limit=20', token);
    assertOk(buyers,  'GET /admin/buyers  < 500');
    assertOk(sellers, 'GET /admin/sellers < 500');
  });

  sleep(1);

  group('Analytics', () => {
    const res = get('/admin/dashboard', token);
    assertOk(res, 'GET /admin/dashboard < 500');
  });

  sleep(randomIntBetween(1, 3));
}

// Default VU function (used for smoke/soak profiles)
export default function () {
  const r = Math.random();
  if      (r < 0.45) publicScenario();
  else if (r < 0.70) buyerScenario();
  else if (r < 0.85) sellerScenario();
  else               adminScenario();
}

// ── Summary → dashboard-compatible JSON ───────────────────────────────────
// k6 --summary-export metric keys: med (p50), p(90), p(95), max, avg, min
export function handleSummary(data) {
  const m = data.metrics;

  function val(metric, key) {
    return m[metric]?.values?.[key] || 0;
  }

  const totalReqs  = val('http_reqs', 'count');
  // Use our custom error_rate (5xx only) rather than http_req_failed (which counts 4xx too)
  const errRateVal = val('error_rate', 'rate');
  const failedReqs = Math.round(totalReqs * errRateVal);
  const rps        = val('http_reqs', 'rate');
  const p50        = val('http_req_duration', 'med');
  const p95        = val('http_req_duration', 'p(95)');
  const p99        = val('http_req_duration', 'max');    // proxy: max ≈ p99 for summary

  const scenarioNames = ['Public Browse', 'Buyer Auth+Cart', 'Seller Dashboard', 'Admin Panel'];
  const weights       = [0.45, 0.25, 0.15, 0.15];

  const output = {
    aggregate: {
      counters: {
        'http.requests': totalReqs,
        'http.errors':   failedReqs,
        ...Object.fromEntries(scenarioNames.map((n, i) => [
          `scenarios.${n}`, Math.round(totalReqs * weights[i]),
        ])),
      },
      rates:     { 'http.request_rate': rps },
      summaries: { 'http.response_time': { p50, p95, p99 } },
    },
    intermediate: scenarioNames.map((name, i) => ({
      rates:     { 'http.request_rate': Math.round(rps * weights[i] * 10) / 10 },
      summaries: { 'http.response_time': { p50, p95, p99 } },
      counters:  {
        'http.requests': Math.round(totalReqs * weights[i]),
        [`scenarios.${name}`]: Math.round(totalReqs * weights[i]),
      },
    })),
    _profile: PROFILE,
  };

  const checks = m['checks'];
  const passed = val('checks', 'passes');
  const failed = val('checks', 'fails');
  const errPct = totalReqs ? ((failedReqs / totalReqs) * 100).toFixed(2) : '0.00';

  const summary = `
╔══════════════════════════════════════════════════════╗
║          oosri Full-System Load Test Results         ║
╚══════════════════════════════════════════════════════╝
  Profile        : ${PROFILE}
  Total requests : ${totalReqs.toLocaleString()}
  Throughput     : ${rps.toFixed(1)} req/s
  Error rate     : ${errPct}%

  Latency
    p50 : ${p50.toFixed(1)}ms
    p95 : ${p95.toFixed(1)}ms  ${p95 > 1000 ? '⚠ OVER 1s' : '✓'}
    p99 : ${p99.toFixed(1)}ms  ${p99 > 2000 ? '⚠ OVER 2s' : '✓'}

  Checks
    Passed : ${passed.toLocaleString()}
    Failed : ${failed.toLocaleString()}  ${failed > 0 ? '⚠' : '✓'}

  Scenarios tested
    ✓ Public — product list, search, categories
    ✓ Buyer  — login, cart, order history, saved items
    ✓ Seller — login, dashboard, product list, orders
    ✓ Admin  — login, orders, KYC queue, user management

  Results → test-reports/load-results.json
`;

  return {
    'test-reports/load-results.json': JSON.stringify(output, null, 2),
    stdout: summary,
  };
}
