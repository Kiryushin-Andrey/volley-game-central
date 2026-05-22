import { CLOUD_MODEL_AUTO } from "./cloud.js";

export const RALPH_USAGE = `Ralph loop — child GitHub issues + optional final pass

Usage:
  ./scripts/ralph-loop.sh [options]
  ./scripts/ralph-once.sh [options]    # same flags + --once

Required:
  --parent-issue <N>       Epic / parent issue number
  --child-issues <n> ...   Dependency-ordered child issue numbers
  --branch <name>          Integration branch (cloud agents push here)
  --prd <path>             Epic PRD markdown path
  --e2e <path>             Browser E2E plan (Suites A–D gate)

Cloud backend:
  --backend cloud
  CURSOR_API_KEY             API key (or --cursor-api-key)
  --cloud-model <id>         Cursor model id (default: ${CLOUD_MODEL_AUTO} = UI Auto)
  RALPH_CLOUD_MODEL          Same as --cloud-model when flag omitted
  --cloud-env KEY=VAL        Session env vars (repeatable)
  --push                     Commit and push progress + code each pass

Other:
  --base <branch>            Merge base for sync (default: main)
  --once                     Single agent attempt per issue (HITL)
  --max-iterations <N>       Cap total agent runs (0 = unlimited)
  --max-slice <N>            Retries per issue pass (default: 5)
  --dry-run                  Print prompts, do not run agents
  --help, -h                 Show this help

List model ids: curl -u "$CURSOR_API_KEY:" https://api.cursor.com/v1/models
`;
