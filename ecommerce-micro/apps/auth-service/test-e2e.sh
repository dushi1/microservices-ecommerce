#!/bin/bash
# End-to-end test of the auth service. Expects it running on :3001.
set -e
BASE=http://localhost:3001/api/v1

echo "== 1. register =="
TOKENS=$(curl -s -X POST $BASE/auth/register -H "Content-Type: application/json" \
  -d '{"email":"jane@example.com","password":"password123","displayName":"Jane"}')
echo "$TOKENS" | head -c 160; echo

echo "== 2. duplicate register (expect 409) =="
curl -s -o /dev/null -w "%{http_code}\n" -X POST $BASE/auth/register -H "Content-Type: application/json" \
  -d '{"email":"jane@example.com","password":"password123","displayName":"Jane"}'

echo "== 3. login =="
TOKENS=$(curl -s -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d '{"email":"jane@example.com","password":"password123"}')
echo "$TOKENS" | head -c 160; echo
ACCESS=$(echo "$TOKENS" | node -pe 'JSON.parse(require("fs").readFileSync(0)).accessToken')
REFRESH=$(echo "$TOKENS" | node -pe 'JSON.parse(require("fs").readFileSync(0)).refreshToken')

echo "== 4. me =="
curl -s $BASE/auth/me -H "Authorization: Bearer $ACCESS"; echo

echo "== 5. refresh (rotate) =="
NEW=$(curl -s -X POST $BASE/auth/refresh -H "Content-Type: application/json" -d "{\"refreshToken\":\"$REFRESH\"}")
echo "$NEW" | head -c 160; echo

echo "== 6. reuse OLD refresh token (expect 401) =="
curl -s -o /dev/null -w "%{http_code}\n" -X POST $BASE/auth/refresh -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH\"}"

echo "== 7. wrong password (expect 401) =="
curl -s -o /dev/null -w "%{http_code}\n" -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d '{"email":"jane@example.com","password":"wrongpass99"}'

echo "== 8. invalid body (expect 422) =="
curl -s -o /dev/null -w "%{http_code}\n" -X POST $BASE/auth/register -H "Content-Type: application/json" \
  -d '{"email":"not-an-email","password":"short","displayName":""}'

echo "== 9. me without token (expect 401) =="
curl -s -o /dev/null -w "%{http_code}\n" $BASE/auth/me
