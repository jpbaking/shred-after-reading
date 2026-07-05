#!/bin/bash
# End-to-end SAR smoke test against the Docker stack:
# login -> create plain + password SAR -> list -> public share (metadata,
# content, password flow) -> change expiry -> delete -> gone states.
# Requires a verified user; run scripts/smoke-auth.sh first or reuse its user.
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
EMAIL="sar-smoke-$(date +%s)@example.com"
PASSWORD="smoke-test-password"
JAR=$(mktemp)

step() { echo "== $1"; }

step "register + verify + login ($EMAIL)"
curl -sf -X POST "$BASE/api/auth/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" > /dev/null
sleep 1
MSG_ID=$(curl -sf "$MAILPIT/api/v1/search?query=to:$EMAIL" | python3 -c 'import sys,json; print(json.load(sys.stdin)["messages"][0]["ID"])')
TOKEN=$(curl -sf "$MAILPIT/api/v1/message/$MSG_ID" | python3 -c '
import sys, json, re, urllib.parse
html = json.load(sys.stdin)["HTML"]
link = re.search(r"href=\"([^\"]*verify-email[^\"]*)\"", html).group(1)
print(urllib.parse.parse_qs(urllib.parse.urlparse(link).query)["token"][0])')
curl -sf "$BASE/api/auth/verify-email?token=$(python3 -c "import urllib.parse;print(urllib.parse.quote('$TOKEN'))")" > /dev/null
curl -sf -c "$JAR" -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" > /dev/null
echo "ok"

step "create a plain SAR"
PLAIN_ID=$(curl -sf -b "$JAR" -X POST "$BASE/api/sars" -H 'Content-Type: application/json' \
  -d '{"content":"plain smoke note","expiry":{"amount":2,"unit":"hours"}}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["sar"]["id"])')
echo "id: $PLAIN_ID"

step "create a password-protected Markdown SAR"
LOCKED_ID=$(curl -sf -b "$JAR" -X POST "$BASE/api/sars" -H 'Content-Type: application/json' \
  -d '{"content":"# locked\n\nsecret","isMarkdown":true,"password":"sesame"}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["sar"]["id"])')
echo "id: $LOCKED_ID"

step "owner list shows both"
LIST=$(curl -sf -b "$JAR" "$BASE/api/sars")
echo "$LIST" | grep -q "$PLAIN_ID" && echo "$LIST" | grep -q "$LOCKED_ID" || { echo "FAIL: $LIST"; exit 1; }
echo "ok"

step "share page URL serves the React app"
curl -sf "$BASE/sar/$PLAIN_ID" | grep -q '<div id="root">' || { echo "FAIL"; exit 1; }
echo "ok"

step "public metadata + content for plain SAR"
curl -sf "$BASE/api/public/sars/$PLAIN_ID" | grep -q '"passwordRequired":false' || { echo "FAIL"; exit 1; }
curl -sf -X POST "$BASE/api/public/sars/$PLAIN_ID/content" -H 'Content-Type: application/json' -d '{}' \
  | grep -q 'plain smoke note' || { echo "FAIL"; exit 1; }
echo "ok"

step "password flow: 401 missing, 403 wrong, 200 correct"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/public/sars/$LOCKED_ID/content" -H 'Content-Type: application/json' -d '{}')
[ "$CODE" = "401" ] || { echo "FAIL: $CODE"; exit 1; }
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/public/sars/$LOCKED_ID/content" -H 'Content-Type: application/json' -d '{"password":"wrong"}')
[ "$CODE" = "403" ] || { echo "FAIL: $CODE"; exit 1; }
curl -sf -X POST "$BASE/api/public/sars/$LOCKED_ID/content" -H 'Content-Type: application/json' -d '{"password":"sesame"}' \
  | grep -q 'secret' || { echo "FAIL"; exit 1; }
echo "ok"

step "change expiry"
curl -sf -b "$JAR" -X PATCH "$BASE/api/sars/$PLAIN_ID/expiry" -H 'Content-Type: application/json' \
  -d '{"expiry":{"amount":1,"unit":"minutes"}}' | grep -q '"expiresAt"' || { echo "FAIL"; exit 1; }
echo "ok"

step "delete locked SAR -> public 410"
curl -sf -b "$JAR" -X DELETE "$BASE/api/sars/$LOCKED_ID" > /dev/null
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/public/sars/$LOCKED_ID")
[ "$CODE" = "410" ] || { echo "FAIL: $CODE"; exit 1; }
echo "ok"

step "unknown and malformed ids"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/public/sars/01890000-0000-7000-8000-000000000000")
[ "$CODE" = "404" ] || { echo "FAIL: $CODE"; exit 1; }
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/public/sars/not-a-uuid")
[ "$CODE" = "422" ] || { echo "FAIL: $CODE"; exit 1; }
echo "ok"

rm -f "$JAR"
echo
echo "SAR SMOKE TEST PASSED"
