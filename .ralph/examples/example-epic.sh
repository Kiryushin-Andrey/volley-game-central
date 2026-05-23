#!/usr/bin/env bash
# Example ralph.config.json fields for a recursive epic.
# Discover and order child issues via the ralph skill, then write .ralph/ralph.config.json.
#
# Bootstrap:
#   ./scripts/ralph-chain-next.sh --bootstrap
#
# Resume / manual next session:
#   ./scripts/ralph-chain-next.sh

set -euo pipefail

cat <<'EOF'
Example ralph.config.json (edit paths and numbers):

{
  "version": 1,
  "parentIssue": 0,
  "childIssues": [0, 0],
  "branch": "cursor/my-epic",
  "base": "main",
  "prd": "docs/prd/my-epic.md",
  "worker": "remote-cursor",
  "push": true
}

Then: ./scripts/ralph-chain-next.sh --bootstrap
EOF
