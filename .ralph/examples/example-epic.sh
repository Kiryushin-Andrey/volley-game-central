#!/usr/bin/env bash
# Example Ralph loop flags for an epic. Discover and order child issues via ralph-cloud-loop skill.
# Usage:
#   ./scripts/ralph-loop.sh \
#     --parent-issue <EPIC_ISSUE> \
#     --child-issues <n1> <n2> ... \
#     --branch <integration-branch> \
#     --prd <path-to-prd.md> \
#     --e2e <path-to-e2e-plan.md> \
#     --backend cloud --push

set -euo pipefail

RALPH_LOOP_ARGS=(
  --parent-issue 0          # replace with epic issue number
  --branch cursor/my-epic   # replace with your integration branch
  --prd docs/prd/my-epic.md
  --e2e docs/testing/e2e-my-epic.md
)

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  exec "$(git rev-parse --show-toplevel)/scripts/ralph-loop.sh" \
    "${RALPH_LOOP_ARGS[@]}" "$@"
fi
