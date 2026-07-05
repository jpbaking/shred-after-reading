#!/bin/bash
# End-to-end auth smoke test: register -> Mailpit -> verify -> login -> /me -> /app
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
BASE="http://localhost:${PORT}"
MAILPIT="http://localhost:8025"
EMAIL="smoke-$(date +%s)@example.com"
PASSWORD="smoke-test-password"

step() { echo "== $1"; }

step "landing page serves React app with design assets"
LANDING=$(curl -sf "$BASE/")
echo "$LANDING" | grep -q '/design/styles.css' || { echo "FAIL: no design css"; exit 1; }
curl -sf -o /dev/null "$BASE/design/styles.css" || { echo "FAIL: styles.css not served"; exit 1; }
curl -sf -o /dev/null "$BASE/favicon.svg" || { echo "FAIL: favicon missing"; exit 1; }
echo "ok"

step "register $EMAIL"
REG=$(curl -sf -X POST "$BASE/api/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
echo "$REG" | grep -q '"emailSent":true' || { echo "FAIL: register response: $REG"; exit 1; }
echo "ok"

step "login before verification must be rejected with 403"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
[ "$CODE" = "403" ] || { echo "FAIL: expected 403, got $CODE"; exit 1; }
echo "ok"

step "read verification link from Mailpit"
sleep 1
MSG_ID=$(curl -sf "$MAILPIT/api/v1/search?query=to:$EMAIL" | python3 -c 'import sys,json; print(json.load(sys.stdin)["messages"][0]["ID"])')
LINK=$(curl -sf "$MAILPIT/api/v1/message/$MSG_ID" | python3 -c '
import sys, json, re
html = json.load(sys.stdin)["HTML"]
m = re.search(r"href=\"([^\"]*verify-email[^\"]*)\"", html)
print(m.group(1))')
echo "link: $LINK"
TOKEN=$(python3 -c "import urllib.parse,sys; print(urllib.parse.parse_qs(urllib.parse.urlparse('$LINK').query)['token'][0])")

step "verification link points at this deployment and serves the React page"
echo "$LINK" | grep -q "^$BASE/verify-email" || { echo "FAIL: link is $LINK"; exit 1; }
curl -sf "$LINK" | grep -q '<div id="root">' || { echo "FAIL: verify page not served"; exit 1; }
echo "ok"

step "verify email via API"
VERIFY=$(curl -sf "$BASE/api/auth/verify-email?token=$TOKEN")
echo "$VERIFY" | grep -q '"verified":true' || { echo "FAIL: $VERIFY"; exit 1; }
echo "ok"

step "login"
JAR=$(mktemp)
LOGIN=$(curl -sf -c "$JAR" -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"rememberMe\":true}")
echo "$LOGIN" | grep -q "\"email\":\"$EMAIL\"" || { echo "FAIL: $LOGIN"; exit 1; }
grep -q 'session_token' "$JAR" || { echo "FAIL: no session cookie"; exit 1; }
grep 'session_token' "$JAR" | grep -q 'HttpOnly' || { echo "FAIL: cookie not HttpOnly"; exit 1; }
echo "ok"

step "/api/auth/me with session"
ME=$(curl -sf -b "$JAR" "$BASE/api/auth/me")
echo "$ME" | grep -q "\"email\":\"$EMAIL\"" || { echo "FAIL: $ME"; exit 1; }
echo "ok"

step "/app serves the React app (history fallback)"
curl -sf "$BASE/app" | grep -q '<div id="root">' || { echo "FAIL: /app fallback broken"; exit 1; }
echo "ok"

step "logout invalidates session"
curl -sf -b "$JAR" -X POST "$BASE/api/auth/logout" > /dev/null
CODE=$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" "$BASE/api/auth/me")
[ "$CODE" = "401" ] || { echo "FAIL: expected 401 after logout, got $CODE"; exit 1; }
echo "ok"

rm -f "$JAR"
echo
echo "SMOKE TEST PASSED: register -> mailpit -> verify -> login -> me -> /app -> logout"
