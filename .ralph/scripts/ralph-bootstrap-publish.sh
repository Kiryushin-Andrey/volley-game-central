#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
exec npx --prefix "$ROOT/.ralph/scripts/ralph" tsx "$ROOT/.ralph/scripts/ralph/src/bootstrap-publish.ts" "$@"
