#!/usr/bin/env bash
# Example Ralph loop flags for the player-levels epic (parent #8).
# Order children by dependency (ralph-cloud-loop skill steps 1–2), then pass --child-issues.
# Usage:
#   source .ralph/examples/player-levels.sh
#   ./scripts/ralph-loop.sh "${RALPH_LOOP_ARGS[@]}" --child-issues 20 21 22 --backend cloud --push

set -euo pipefail

RALPH_LOOP_ARGS=(
  --parent-issue 8
  --branch cursor/player-levels-c8a4
  --prd docs/prd/player-levels-and-game-format.md
  --e2e docs/testing/e2e-player-levels-browser-agent.md
)

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  exec "$(git rev-parse --show-toplevel)/scripts/ralph-loop.sh" \
    "${RALPH_LOOP_ARGS[@]}" "$@"
fi
