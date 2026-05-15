#!/usr/bin/env bash
# Example Ralph loop flags for the player-levels epic (parent #8).
# Discover children first (ralph-cloud-loop skill), then pass --child-issues.
# Usage:
#   source .ralph/examples/player-levels.sh
#   python3 scripts/ralph-loop.py "${RALPH_LOOP_ARGS[@]}" --child-issues 20 21 22 --backend cloud --push

set -euo pipefail

RALPH_LOOP_ARGS=(
  --parent-issue 8
  --branch cursor/player-levels-c8a4
  --prd docs/prd/player-levels-and-game-format.md
  --e2e docs/testing/e2e-player-levels-browser-agent.md
)

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  exec python3 "$(git rev-parse --show-toplevel)/scripts/ralph-loop.py" \
    "${RALPH_LOOP_ARGS[@]}" "$@"
fi
