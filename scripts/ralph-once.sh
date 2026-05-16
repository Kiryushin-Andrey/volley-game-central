#!/usr/bin/env bash
# Human-in-the-loop Ralph: one agent attempt per pass (see --once).
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
exec npx --prefix "$ROOT/scripts/ralph" tsx "$ROOT/scripts/ralph/src/ralph-loop.ts" --once "$@"
