#!/usr/bin/env bash
set -euo pipefail

export DEV_MODE="${DEV_MODE:-true}"
export POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
export POSTGRES_PORT="${POSTGRES_PORT:-5432}"
export POSTGRES_USER="${POSTGRES_USER:-postgres}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
export POSTGRES_DB="${POSTGRES_DB:-volley_game_central}"
export MINI_APP_URL="${MINI_APP_URL:-http://127.0.0.1:3001}"
export JWT_SECRET="${JWT_SECRET:-playwright-dev-secret}"
export PLAYWRIGHT_PGDATA="${PLAYWRIGHT_PGDATA:-/tmp/volley-game-central-playwright-pgdata}"

if command -v docker >/dev/null 2>&1; then
  docker compose up -d postgres
else
  pg_bindir="$(pg_config --bindir 2>/dev/null || true)"
  if [ -n "$pg_bindir" ]; then
    export PATH="$pg_bindir:$PATH"
  fi

  if ! command -v initdb >/dev/null 2>&1 || ! command -v pg_ctl >/dev/null 2>&1 || ! command -v psql >/dev/null 2>&1; then
    echo "Docker is not available and local PostgreSQL tools were not found." >&2
    echo "Install PostgreSQL locally or run tests in an environment with Docker." >&2
    exit 1
  fi

  if [ ! -f "$PLAYWRIGHT_PGDATA/PG_VERSION" ]; then
    initdb -D "$PLAYWRIGHT_PGDATA" -U "$POSTGRES_USER" -A trust
  fi

  if ! pg_ctl -D "$PLAYWRIGHT_PGDATA" status >/dev/null 2>&1; then
    pg_ctl -D "$PLAYWRIGHT_PGDATA" -o "-p $POSTGRES_PORT -h 127.0.0.1" -l "$PLAYWRIGHT_PGDATA/server.log" start
  fi

  db_exists="$(psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$POSTGRES_DB'")"
  if [ "$db_exists" != "1" ]; then
    createdb -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" "$POSTGRES_DB"
  fi
fi

npm run backend:build
npx concurrently "cd backend && npm run dev" "npm run tg-mini-app:dev"
