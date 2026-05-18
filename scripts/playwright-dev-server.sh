#!/usr/bin/env bash
set -euo pipefail

export DEV_MODE="${DEV_MODE:-true}"
export POSTGRES_HOST="${POSTGRES_HOST:-127.0.0.1}"
export POSTGRES_PORT="${POSTGRES_PORT:-5432}"
export POSTGRES_USER="${POSTGRES_USER:-postgres}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
export POSTGRES_DB="${POSTGRES_DB:-volley_game_central}"
export MINI_APP_URL="${MINI_APP_URL:-http://127.0.0.1:3001}"
export JWT_SECRET="${JWT_SECRET:-playwright-dev-secret}"

run_as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    echo "This script needs root privileges to install or start Docker." >&2
    exit 1
  fi
}

install_docker_if_missing() {
  if command -v docker >/dev/null 2>&1; then
    return
  fi

  if ! command -v apt-get >/dev/null 2>&1; then
    echo "Docker is required for Playwright E2E tests, but docker and apt-get were not found." >&2
    exit 1
  fi

  echo "Docker is not available; installing Docker for Playwright E2E tests..."
  run_as_root apt-get update
  run_as_root env DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io docker-compose-v2
}

ensure_docker_daemon() {
  if docker info >/dev/null 2>&1; then
    return
  fi

  if command -v service >/dev/null 2>&1; then
    run_as_root service docker start || true
  fi

  if ! docker info >/dev/null 2>&1 && command -v systemctl >/dev/null 2>&1; then
    run_as_root systemctl start docker || true
  fi

  if ! docker info >/dev/null 2>&1; then
    echo "Docker is installed, but the daemon is not reachable by the current user." >&2
    echo "Start Docker or grant this user access to the Docker daemon, then rerun the tests." >&2
    exit 1
  fi
}

install_docker_if_missing
ensure_docker_daemon

docker compose up -d postgres

npm run backend:build
npx concurrently "cd backend && npm run dev" "npm run tg-mini-app:dev"
