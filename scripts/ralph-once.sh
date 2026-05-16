#!/usr/bin/env bash
# Human-in-the-loop Ralph: one agent attempt per pass (see --once in ralph-loop.py).
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
exec python3 "$ROOT/scripts/ralph-loop.py" --once "$@"
