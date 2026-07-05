#!/bin/bash
# End-to-end admin smoke test against the Docker stack:
# admin login -> verify user -> ban/unban -> user SAR creation ->
# admin SAR search/detail/delete -> global expiry update and clamp check.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a
fi

PORT="${APP_PORT:-8080}"
USER_BASE="http://localhost:${PORT}"
ADMIN_BASE="$USER_BASE"
MAILPIT="http://localhost:8025"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-changeme}"
USER_EMAIL="admin-smoke-$(date +%s)@example.com"
USER_PASSWORD="smoke-test-password"
ADMIN_JAR="$(mktemp)"
USER_JAR="$(mktemp)"
ORIGINAL_LIMIT_AMOUNT=""
ORIGINAL_LIMIT_UNIT=""

cleanup() {
  if [[ -n "$ORIGINAL_LIMIT_AMOUNT" && -n "$ORIGINAL_LIMIT_UNIT" && -f "$ADMIN_JAR" ]]; then
    curl -sf -b "$ADMIN_JAR" -X PATCH "$ADMIN_BASE/api/admin/settings/expiry" \
      -H 'Content-Type: application/json' \
      -d "{\"expiry\":{\"amount\":$ORIGINAL_LIMIT_AMOUNT,\"unit\":\"$ORIGINAL_LIMIT_UNIT\"}}" > /dev/null || true
  fi
  rm -f "$ADMIN_JAR" "$USER_JAR"
}
trap cleanup EXIT

step() { echo "== $1"; }

json_get() {
  local expr="$1"
  python3 -c "import json,sys; print($expr)"
}

step "admin route serves the React app"
curl -sf "$ADMIN_BASE/administration" | grep -q '<div id="root">' || { echo "FAIL: admin route not served"; exit 1; }
echo "ok"

step "register user $USER_EMAIL"
curl -sf -X POST "$USER_BASE/api/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$USER_EMAIL\",\"password\":\"$USER_PASSWORD\"}" > /dev/null
echo "ok"

step "admin login"
curl -sf -c "$ADMIN_JAR" -X POST "$ADMIN_BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\",\"rememberMe\":true}" \
  | grep -q "\"email\":\"$ADMIN_EMAIL\"" || { echo "FAIL: admin login"; exit 1; }
SETTINGS_JSON=$(curl -sf -b "$ADMIN_JAR" "$ADMIN_BASE/api/admin/settings/expiry")
ORIGINAL_LIMIT_AMOUNT=$(echo "$SETTINGS_JSON" | json_get 'json.load(sys.stdin)["settings"]["globalExpiryLimit"]["amount"]')
ORIGINAL_LIMIT_UNIT=$(echo "$SETTINGS_JSON" | json_get 'json.load(sys.stdin)["settings"]["globalExpiryLimit"]["unit"]')
echo "ok"

step "admin finds and verifies the new user"
USER_ROW=$(curl -sf -b "$ADMIN_JAR" "$ADMIN_BASE/api/admin/users?q=$USER_EMAIL")
USER_ID=$(echo "$USER_ROW" | json_get 'next(u["id"] for u in json.load(sys.stdin)["users"] if u["email"] == "'"$USER_EMAIL"'")')
echo "$USER_ROW" | grep -q "\"emailVerified\":false" || { echo "FAIL: expected unverified user"; exit 1; }
curl -sf -b "$ADMIN_JAR" -X POST "$ADMIN_BASE/api/admin/users/$USER_ID/verify" > /dev/null
echo "ok"

step "admin bans then unbans the user"
curl -sf -b "$ADMIN_JAR" -X PATCH "$ADMIN_BASE/api/admin/users/$USER_ID/ban" \
  -H 'Content-Type: application/json' -d '{"banned":true}' | grep -q '"isBanned":true' || { echo "FAIL: ban"; exit 1; }
curl -sf -b "$ADMIN_JAR" -X PATCH "$ADMIN_BASE/api/admin/users/$USER_ID/ban" \
  -H 'Content-Type: application/json' -d '{"banned":false}' | grep -q '"isBanned":false' || { echo "FAIL: unban"; exit 1; }
echo "ok"

step "verified user can now log in"
curl -sf -c "$USER_JAR" -X POST "$USER_BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$USER_EMAIL\",\"password\":\"$USER_PASSWORD\"}" \
  | grep -q "\"email\":\"$USER_EMAIL\"" || { echo "FAIL: user login"; exit 1; }
echo "ok"

step "user creates two SARs"
FIRST_SAR=$(curl -sf -b "$USER_JAR" -X POST "$USER_BASE/api/sars" \
  -H 'Content-Type: application/json' \
  -d '{"content":"admin smoke plain note","expiry":{"amount":2,"unit":"days"}}')
FIRST_SAR_ID=$(echo "$FIRST_SAR" | json_get 'json.load(sys.stdin)["sar"]["id"]')
SECOND_SAR=$(curl -sf -b "$USER_JAR" -X POST "$USER_BASE/api/sars" \
  -H 'Content-Type: application/json' \
  -d '{"content":"admin smoke limited note","expiry":{"amount":7,"unit":"days"},"password":"shield"}')
SECOND_SAR_ID=$(echo "$SECOND_SAR" | json_get 'json.load(sys.stdin)["sar"]["id"]')
echo "ok"

step "admin can search SARs, inspect detail, and delete one"
SAR_LIST=$(curl -sf -b "$ADMIN_JAR" "$ADMIN_BASE/api/admin/sars?q=admin%20smoke&status=active")
echo "$SAR_LIST" | grep -q "$FIRST_SAR_ID" || { echo "FAIL: first SAR missing"; exit 1; }
echo "$SAR_LIST" | grep -q '"passwordRequired":true' || { echo "FAIL: password flag missing"; exit 1; }
curl -sf -b "$ADMIN_JAR" "$ADMIN_BASE/api/admin/sars/$FIRST_SAR_ID" | grep -q 'admin smoke plain note' || { echo "FAIL: SAR detail"; exit 1; }
curl -sf -b "$ADMIN_JAR" -X DELETE "$ADMIN_BASE/api/admin/sars/$FIRST_SAR_ID" | grep -q '"status":"deleted"' || { echo "FAIL: admin delete"; exit 1; }
echo "ok"

step "admin lowers the global expiry limit to 1 day"
curl -sf -b "$ADMIN_JAR" -X PATCH "$ADMIN_BASE/api/admin/settings/expiry" \
  -H 'Content-Type: application/json' \
  -d '{"expiry":{"amount":1,"unit":"days"}}' | grep -q '"amount":1' || { echo "FAIL: settings update"; exit 1; }
echo "ok"

step "later SAR creation is clamped by the new global limit"
CLAMPED=$(curl -sf -b "$USER_JAR" -X POST "$USER_BASE/api/sars" \
  -H 'Content-Type: application/json' \
  -d '{"content":"admin smoke clamp check","expiry":{"amount":5,"unit":"days"}}')
CLAMPED_EXPIRES=$(echo "$CLAMPED" | json_get 'json.load(sys.stdin)["sar"]["expiresAt"]')
python3 - "$CLAMPED_EXPIRES" <<'PY'
import datetime, sys
expires = datetime.datetime.fromisoformat(sys.argv[1].replace("Z", "+00:00"))
delta = expires - datetime.datetime.now(datetime.timezone.utc)
days = delta.total_seconds() / 86400
if not (0.9 < days < 1.1):
    raise SystemExit(f"FAIL: expected ~1 day clamp, got {days:.3f} days")
PY
echo "ok"

echo
echo "ADMIN SMOKE TEST PASSED"
