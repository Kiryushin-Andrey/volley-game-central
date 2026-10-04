#!/usr/bin/env bash
# Run backend unit tests with node:test via tsx.
#
# Why globstar: tests may live more than one directory under src/
# (e.g. src/services/bunq/*.test.ts). Without globstar, bash treats **
# like a single *, so nested suites are never passed to tsx.
#
# DB defaults match .github/workflows/backend-unit.yml (trust auth).
# Do not default POSTGRES_PASSWORD — leave unset for trust, or set in the
# environment when the local Postgres requires a password.
set -euo pipefail
cd "$(dirname "$0")/.."

export POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
export POSTGRES_PORT="${POSTGRES_PORT:-5432}"
export POSTGRES_USER="${POSTGRES_USER:-postgres}"
export POSTGRES_DB="${POSTGRES_DB:-volley_game_central}"

shopt -s globstar nullglob
exec npx tsx --test src/**/*.test.ts
