#!/usr/bin/env bash
# Seed data for player-levels E2E (dev mode)
set -euo pipefail
API="${API:-http://127.0.0.1:3000}"
COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT

dev_login() {
  local phone="$1" name="$2" admin="${3:-false}"
  curl -sS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X POST "$API/auth/dev-login" \
    -H 'Content-Type: application/json' \
    -d "{\"phoneNumber\":\"$phone\",\"displayName\":\"$name\",\"isAdmin\":$admin}"
}

echo "=== Admin login ==="
ADMIN_JSON=$(dev_login '+31600000001' 'E2E Admin' true)
ADMIN_ID=$(echo "$ADMIN_JSON" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).user.id')
echo "Admin id: $ADMIN_ID"

echo "=== Create test users ==="
BEGINNER_JSON=$(dev_login '+31600000002' 'E2E Beginner' false)
BEGINNER_ID=$(echo "$BEGINNER_JSON" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).user.id')
echo "Beginner id: $BEGINNER_ID"

BLOCKED_JSON=$(dev_login '+31600000003' 'E2E Blocked' false)
BLOCKED_ID=$(echo "$BLOCKED_JSON" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).user.id')
echo "Blocked id: $BLOCKED_ID"

echo "=== Set player levels (admin session) ==="
dev_login '+31600000001' 'E2E Admin' true > /dev/null
curl -sS -b "$COOKIE_JAR" -X PATCH "$API/admin/users/$BEGINNER_ID/level" \
  -H 'Content-Type: application/json' \
  -d '{"playerLevel":"beginner"}' | head -c 200
echo

echo "=== Block user ==="
curl -sS -b "$COOKIE_JAR" -X POST "$API/users/admin/id/$BLOCKED_ID/block" \
  -H 'Content-Type: application/json' \
  -d '{"reason":"E2E test block — please contact admin"}' | head -c 200
echo

echo "=== Create 5-1 game (with_positions) ==="
GAME_DATE=$(node -pe "new Date(Date.now()+14*24*60*60*1000).toISOString()")
GAME_JSON=$(curl -sS -b "$COOKIE_JAR" -X POST "$API/games/admin" \
  -H 'Content-Type: application/json' \
  -d "{\"dateTime\":\"$GAME_DATE\",\"maxPlayers\":12,\"playMode\":\"with_positions\",\"paymentAmount\":5,\"locationName\":\"E2E Hall\",\"title\":\"E2E 5-1 Test\"}")
GAME_ID=$(echo "$GAME_JSON" | node -pe 'const j=JSON.parse(require("fs").readFileSync(0,"utf8")); j.id ?? j.game?.id ?? ""')
echo "Game id: $GAME_ID"
echo "$GAME_JSON" | head -c 300
echo

echo "SEED_ADMIN_ID=$ADMIN_ID"
echo "SEED_BEGINNER_ID=$BEGINNER_ID"
echo "SEED_BLOCKED_ID=$BLOCKED_ID"
echo "SEED_GAME_ID=$GAME_ID"
