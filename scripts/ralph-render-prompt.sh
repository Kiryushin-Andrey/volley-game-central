#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
exec npx --prefix "$ROOT/scripts/ralph" tsx "$ROOT/scripts/ralph/src/render-cli.ts" "$@"
