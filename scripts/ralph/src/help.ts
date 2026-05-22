import { CURSOR_MODEL_AUTO } from "./agents/factory.js";

export const RALPH_USAGE = `Ralph loop — child GitHub issues + optional final pass

Usage:
  ./scripts/ralph-loop.sh [options]
  ./scripts/ralph-once.sh [options]    # same flags + --once

Required:
  --parent-issue <N>       Epic / parent issue number
  --child-issues <n> ...   Dependency-ordered child issue numbers
  --branch <name>          Integration branch (remote agents push here)
  --prd <path>             Epic PRD markdown path
  --e2e <path>             Browser E2E plan (Suites A–D gate)

Remote backend (--backend cloud):
  --cloud-provider <name>  cursor (default) | oz (Warp Oz Platform)
  --push                   Commit and push progress + code each pass
  --cloud-poll-interval N  Poll interval seconds when streaming unavailable (default: 15)

  Cursor (--cloud-provider cursor):
    CURSOR_API_KEY           API key (or --cursor-api-key)
    --cloud-model <id>       Model id (default: ${CURSOR_MODEL_AUTO} = UI Auto)
    RALPH_CLOUD_MODEL        Same as --cloud-model when flag omitted
    --cloud-env KEY=VAL      Session env vars (repeatable)

  Oz / Warp (--cloud-provider oz):
    WARP_API_KEY             Oz Cloud API key (or --warp-api-key)
    OZ_ENVIRONMENT_ID        Cloud environment UID (or --oz-environment-id)
    --oz-model-id <id>       Optional LLM model for the environment
    --oz-config-name <name>  AmbientAgentConfig.name (default: ralph-loop)
    RALPH_OZ_MODEL_ID        Same as --oz-model-id
    See https://docs.warp.dev/agent-platform/cloud-agents/overview/

Other:
  --base <branch>            Merge base for sync (default: main)
  --once                     Single agent attempt per issue (HITL)
  --max-iterations <N>       Cap total agent runs (0 = unlimited)
  --max-slice <N>            Retries per issue pass (default: 5)
  --dry-run                  Print prompts, do not run agents
  --help, -h                 Show this help

Cursor models: curl -u "$CURSOR_API_KEY:" https://api.cursor.com/v1/models
`;
