#!/usr/bin/env bash
# Post-deployment smoke tests.
# Usage: VERCEL_URL=my-app.vercel.app ./scripts/post-deploy.sh
# Vercel automatically sets VERCEL_URL in the deployment environment.
set -euo pipefail

# ── Resolve base URL ───────────────────────────────────────────────────────────
if [[ -z "${VERCEL_URL:-}" ]]; then
  BASE_URL="${BASE_URL:-http://localhost:3000}"
else
  # VERCEL_URL has no scheme
  BASE_URL="https://${VERCEL_URL}"
fi

echo "Smoke tests → $BASE_URL"
PASS=0
FAIL=0

# ── Helpers ────────────────────────────────────────────────────────────────────
check() {
  local label="$1"
  local url="$2"
  local expected_status="${3:-200}"
  local extra_flags="${4:-}"

  # shellcheck disable=SC2086
  actual=$(curl -s -o /dev/null -w "%{http_code}" $extra_flags "$url")
  if [[ "$actual" == "$expected_status" ]]; then
    echo "  ✓ $label ($actual)"
    ((PASS++))
  else
    echo "  ✗ $label — expected $expected_status, got $actual"
    ((FAIL++))
  fi
}

check_json_field() {
  local label="$1"
  local url="$2"
  local field="$3"
  local expected="$4"

  actual=$(curl -sf "$url" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('$field',''))" 2>/dev/null || echo "")
  if [[ "$actual" == "$expected" ]]; then
    echo "  ✓ $label ($field=$actual)"
    ((PASS++))
  else
    echo "  ✗ $label — expected $field=$expected, got '$actual'"
    ((FAIL++))
  fi
}

# ── Tests ──────────────────────────────────────────────────────────────────────
echo ""
echo "── Availability ──────────────────────────────────────────────────────────"
check "Homepage loads"              "$BASE_URL/"
check "Health endpoint returns 200" "$BASE_URL/api/health"
check_json_field "Health status=ok" "$BASE_URL/api/health" "status" "ok"

echo ""
echo "── API endpoints ─────────────────────────────────────────────────────────"
# POST with empty body should return 400, not 500 — proves route is reachable
check "Export route reachable"      "$BASE_URL/api/export"   "405"   # GET not allowed
check "Share route reachable"       "$BASE_URL/api/share"    "405"   # GET not allowed

echo ""
echo "── Security headers ──────────────────────────────────────────────────────"
x_frame=$(curl -sI "$BASE_URL/" | grep -i "x-frame-options" | tr -d '[:space:]')
if [[ "$x_frame" == *"DENY"* ]]; then
  echo "  ✓ X-Frame-Options: DENY present"
  ((PASS++))
else
  echo "  ✗ X-Frame-Options: DENY missing (got: $x_frame)"
  ((FAIL++))
fi

x_cto=$(curl -sI "$BASE_URL/" | grep -i "x-content-type-options" | tr -d '[:space:]')
if [[ "$x_cto" == *"nosniff"* ]]; then
  echo "  ✓ X-Content-Type-Options: nosniff present"
  ((PASS++))
else
  echo "  ✗ X-Content-Type-Options missing (got: $x_cto)"
  ((FAIL++))
fi

# ── Summary ────────────────────────────────────────────────────────────────────
echo ""
echo "── Results: $PASS passed, $FAIL failed ───────────────────────────────────"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
