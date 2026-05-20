#!/usr/bin/env node
/**
 * Load test runner — uses autocannon to hit public API endpoints
 * and writes an Artillery-compatible JSON to test-reports/load-results.json
 *
 * Usage: node scripts/run-load.js
 *        npm run load:run
 */

const autocannon = require('autocannon');
const fs         = require('fs');
const path       = require('path');

const BASE    = process.env.API_URL || 'http://localhost:3001';
const OUTFILE = path.join(__dirname, '..', 'test-reports', 'load-results.json');

const SCENARIOS = [
  { name: 'Product Browse',  url: '/api/v1/buyer/products?page=1&limit=12', weight: 50 },
  { name: 'Product Search',  url: '/api/v1/buyer/products/search?query=art&page=1&limit=12', weight: 30 },
  { name: 'Category List',   url: '/api/v1/buyer/categories', weight: 20 },
];

async function runScenario(scenario, duration = 15, connections = 10) {
  return new Promise((resolve, reject) => {
    const instance = autocannon({
      url:         BASE + scenario.url,
      duration,
      connections,
      pipelining:  1,
      timeout:     10,
    }, (err, result) => {
      if (err) return reject(err);
      resolve({ scenario, result });
    });

    autocannon.track(instance, { renderProgressBar: true, renderResultsTable: false });
    process.stdout.write(`\n  ▶ ${scenario.name}\n`);
  });
}

async function main() {
  console.log(`\n  oosri load test → ${BASE}\n`);

  const phases = [
    { name: 'warm-up',   duration: 10, connections: 5  },
    { name: 'ramp-up',   duration: 15, connections: 15 },
    { name: 'sustained', duration: 15, connections: 25 },
  ];

  const intermediate = [];
  const allResults   = [];

  for (const phase of phases) {
    console.log(`\n  Phase: ${phase.name} (${phase.duration}s, ${phase.connections} connections)`);
    for (const scenario of SCENARIOS) {
      const { result } = await runScenario(scenario, phase.duration, phase.connections);
      allResults.push({ phase: phase.name, scenario: scenario.name, result });

      intermediate.push({
        rates:     { 'http.request_rate': result.requests.mean },
        summaries: { 'http.response_time': { p50: result.latency.p50, p95: result.latency.p99, p99: result.latency.max } },
        counters:  {
          'http.requests':   result.requests.total,
          'http.errors':     result.errors,
          [`scenarios.${scenario.name}`]: result.requests.total,
        },
      });
    }
  }

  // Aggregate across all runs
  const totalRequests = allResults.reduce((s, r) => s + r.result.requests.total, 0);
  const totalErrors   = allResults.reduce((s, r) => s + r.result.errors, 0);
  const avgRps        = allResults.reduce((s, r) => s + r.result.requests.mean, 0) / allResults.length;
  const p50s          = allResults.map(r => r.result.latency.p50);
  const p95s          = allResults.map(r => r.result.latency.p99);
  const p99s          = allResults.map(r => r.result.latency.max);
  const median        = arr => { const s = [...arr].sort((a,b)=>a-b); return s[Math.floor(s.length/2)]; };

  const scenarioCounts = {};
  for (const s of SCENARIOS) scenarioCounts[`scenarios.${s.name}`] = 0;
  for (const r of allResults) scenarioCounts[`scenarios.${r.scenario}`] = (scenarioCounts[`scenarios.${r.scenario}`] || 0) + r.result.requests.total;

  const output = {
    aggregate: {
      counters:  { 'http.requests': totalRequests, 'http.errors': totalErrors, ...scenarioCounts },
      rates:     { 'http.request_rate': avgRps },
      summaries: { 'http.response_time': { p50: median(p50s), p95: median(p95s), p99: median(p99s) } },
    },
    intermediate,
  };

  fs.writeFileSync(OUTFILE, JSON.stringify(output, null, 2));

  const errRate = totalRequests ? ((totalErrors / totalRequests) * 100).toFixed(2) : 0;
  console.log(`\n  ── Summary ──────────────────────────────`);
  console.log(`  Total requests : ${totalRequests.toLocaleString()}`);
  console.log(`  Avg req/sec    : ${avgRps.toFixed(1)}`);
  console.log(`  Error rate     : ${errRate}%`);
  console.log(`  Latency p50    : ${median(p50s)}ms`);
  console.log(`  Latency p95    : ${median(p95s)}ms`);
  console.log(`  Latency p99    : ${median(p99s)}ms`);
  console.log(`\n  Results written → test-reports/load-results.json\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
