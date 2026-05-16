#!/usr/bin/env node
/**
 * Dashboard server — reads Jest JSON + Artillery JSON outputs and
 * serves them through a local Express app so the HTML dashboard
 * can fetch them via /api/jest and /api/load.
 *
 * Usage:  node scripts/serve-dashboard.js
 *         npm run dashboard
 */

const express  = require('express');
const fs       = require('fs');
const path     = require('path');
const { exec } = require('child_process');

const PORT         = process.env.DASHBOARD_PORT || 4321;
const REPORTS_DIR  = path.join(__dirname, '..', 'test-reports');
const JEST_FILE    = path.join(REPORTS_DIR, 'jest-results.json');
const LOAD_FILE    = path.join(REPORTS_DIR, 'load-results.json');
const DASHBOARD    = path.join(REPORTS_DIR, 'dashboard.html');

const app = express();

// ── static dashboard HTML ────────────────────────────────────────────────────
app.get('/', (req, res) => {
  if (!fs.existsSync(DASHBOARD)) {
    return res.status(404).send('dashboard.html not found — run npm run test:ci first');
  }
  res.sendFile(DASHBOARD);
});

// ── Jest results API ─────────────────────────────────────────────────────────
app.get('/api/jest', (req, res) => {
  if (!fs.existsSync(JEST_FILE)) {
    return res.json({ error: 'No Jest results found. Run: npm run test:ci' });
  }
  try {
    res.json(JSON.parse(fs.readFileSync(JEST_FILE, 'utf8')));
  } catch (e) {
    res.status(500).json({ error: `Failed to parse jest-results.json: ${e.message}` });
  }
});

// ── Load results API (handles both k6 summary-export and custom runner JSON) ──
app.get('/api/load', (req, res) => {
  if (!fs.existsSync(LOAD_FILE)) {
    return res.json({ error: 'No load test results found. Run: npm run load:run' });
  }
  try {
    const raw = JSON.parse(fs.readFileSync(LOAD_FILE, 'utf8'));

    // k6 --summary-export format: has top-level "metrics" key, no "aggregate"
    if (raw.metrics && !raw.aggregate) {
      const m = raw.metrics;
      const totalReqs  = m['http_reqs']?.values?.count        || 0;
      const failedReqs = m['http_req_failed']?.values?.passes || 0;
      const rps        = m['http_reqs']?.values?.rate         || 0;
      const dur        = m['http_req_duration']?.values || {};

      const normalized = {
        aggregate: {
          counters:  { 'http.requests': totalReqs, 'http.errors': failedReqs },
          rates:     { 'http.request_rate': rps },
          summaries: {
            'http.response_time': {
              p50: dur['p(50)'] || 0,
              p95: dur['p(95)'] || 0,
              p99: dur['p(99)'] || 0,
            },
          },
        },
        intermediate: [],
        _source: 'k6',
        _profile: raw.state?.testRunDurationMs ? `${(raw.state.testRunDurationMs / 1000).toFixed(0)}s run` : 'k6',
      };
      return res.json(normalized);
    }

    res.json(raw);
  } catch (e) {
    res.status(500).json({ error: `Failed to parse load-results.json: ${e.message}` });
  }
});

// ── health ───────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n  Test Dashboard → ${url}\n`);

  // Auto-open browser
  const opener =
    process.platform === 'darwin' ? `open "${url}"` :
    process.platform === 'win32'  ? `start "${url}"` :
                                    `xdg-open "${url}"`;
  exec(opener, (err) => {
    if (err) console.log(`  (could not auto-open browser — navigate to ${url} manually)`);
  });
});
