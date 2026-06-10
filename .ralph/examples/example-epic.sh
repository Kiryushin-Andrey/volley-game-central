#!/usr/bin/env bash
# Example ralph.config.json fields for a recursive epic.
# Discover and order child issues via the ralph skill, then write
# .ralph/tasks/<slug>/ralph.config.json (slug derived from parent issue title).
#
# Bootstrap:
#   mkdir -p .ralph/tasks/<slug>
#   echo '<slug>' > .ralph/.current-task
#   # write config, progress, sessions under .ralph/tasks/<slug>/
#   ./.ralph/scripts/ralph-chain-next.sh --bootstrap
#
# Resume / manual next session:
#   ./.ralph/scripts/ralph-chain-next.sh

set -euo pipefail

cat <<'EOF'
Example ralph.config.json (edit paths and numbers):
Lives at .ralph/tasks/<slug>/ralph.config.json

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

Then: ./.ralph/scripts/ralph-chain-next.sh --bootstrap
EOF
