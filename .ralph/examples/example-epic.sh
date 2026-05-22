#!/usr/bin/env bash
# Example Ralph loop flags for an epic. Discover and order child issues via ralph-cloud-loop skill.
# E2E defaults to docs/playwright-e2e-scenarios.md (project-wide Playwright).
# Usage:
#   ./scripts/ralph-loop.sh \
#     --parent-issue <EPIC_ISSUE> \
#     --child-issues <n1> <n2> ... \
#     --branch <integration-branch> \
#     --prd <path-to-epic-prd.md> \
#     --backend cloud --push

set -euo pipefail

RALPH_LOOP_ARGS=(
  --parent-issue 0          # replace with epic issue number
  --branch cursor/my-epic   # replace with your integration branch
  --prd docs/prd/my-epic.md
  --cloud-model default     # Cursor API Auto; or RALPH_CLOUD_MODEL / --cloud-model <id>
)

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  exec "$(git rev-parse --show-toplevel)/scripts/ralph-loop.sh" \
    "${RALPH_LOOP_ARGS[@]}" "$@"
fi
