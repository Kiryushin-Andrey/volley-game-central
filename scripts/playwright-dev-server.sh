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

npm run db:up
npm run backend:build
npm run dev
