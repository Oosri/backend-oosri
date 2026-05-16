#!/usr/bin/env bash
# Run all unit tests → write JSON results → open dashboard
# Usage: bash scripts/test-all.sh [--with-load]

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  oosri API — full test suite + dashboard"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Ensure output directory exists
mkdir -p test-reports

# ── 1. Unit tests ────────────────────────────────────────────────────────────
echo ""
echo "▶  Running unit tests…"
npx jest --runInBand --forceExit --json --outputFile=test-reports/jest-results.json || true
# (|| true so we proceed to dashboard even on test failures)

# ── 2. Load tests (opt-in) ───────────────────────────────────────────────────
if [[ "${1:-}" == "--with-load" ]]; then
  if ! command -v artillery &>/dev/null; then
    echo ""
    echo "⚠  artillery not found — install it: npm install -g artillery"
  else
    echo ""
    echo "▶  Running load tests (this may take ~3 minutes)…"
    API_URL="${API_URL:-http://localhost:3000}" \
      artillery run __tests__/load/plan.yml \
        --output test-reports/load-results.json || true
    echo "▶  Generating Artillery HTML report…"
    artillery report test-reports/load-results.json \
      --output test-reports/load-report.html || true
  fi
fi

# ── 3. Print quick summary ───────────────────────────────────────────────────
if [[ -f test-reports/jest-results.json ]]; then
  PASSED=$(node -e "const r=require('./test-reports/jest-results.json'); console.log(r.numPassedTests ?? 0)")
  FAILED=$(node -e "const r=require('./test-reports/jest-results.json'); console.log(r.numFailedTests ?? 0)")
  TOTAL=$(node  -e "const r=require('./test-reports/jest-results.json'); console.log(r.numTotalTests ?? 0)")
  echo ""
  echo "  Unit tests  ✓ ${PASSED} passed  ✗ ${FAILED} failed  (${TOTAL} total)"
fi

# ── 4. Launch dashboard ──────────────────────────────────────────────────────
echo ""
echo "▶  Starting dashboard…"
node scripts/serve-dashboard.js
