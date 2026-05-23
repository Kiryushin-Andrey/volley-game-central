import { CURSOR_MODEL_AUTO } from "./agents/factory.js";
import { WORKER_KINDS } from "./workers/registry.js";

export const RALPH_USAGE = `Ralph loop — child GitHub issues + optional final pass

Usage:
  ./scripts/ralph-loop.sh [options]
  ./scripts/ralph-once.sh [options]    # same flags + --once

Required:
  --parent-issue <N>       Epic / parent issue number
  --child-issues <n> ...   Dependency-ordered child issue numbers
  --branch <name>          Integration branch
  --prd <path>             Epic PRD markdown path
  --e2e <path>             Browser E2E plan (Suites A–D gate)

Worker (--worker) — where each slice iteration runs (CLI must be on PATH for local-*):
  local-cursor             Cursor CLI (\`agent\`) — default
  local-claude             Claude Code CLI (\`claude\`)
  local-codex              OpenAI Codex CLI (\`codex exec\`)
  remote-cursor            Cursor Cloud Agents API
  remote-oz                Warp Oz Platform

  --push                   Required for remote-* resume (agents push progress + code)
  --cloud-poll-interval N  Poll remote runs when streaming unavailable (default: 15)

  remote-cursor:
    CURSOR_API_KEY           (or --cursor-api-key)
    --cloud-model <id>       default: ${CURSOR_MODEL_AUTO} (Auto)
    --cloud-env KEY=VAL      session env vars (repeatable)

  remote-oz:
    WARP_API_KEY             (or --warp-api-key)
    OZ_ENVIRONMENT_ID        (or --oz-environment-id)
    --oz-model-id, --oz-config-name
    See https://docs.warp.dev/agent-platform/cloud-agents/overview/

Deprecated (mapped to --worker with a warning):
  --backend local|cloud, --cloud-provider cursor|oz, --agent-cmd

Other:
  --base <branch>            Merge base for sync (default: main)
  --once                     Single worker attempt per issue (HITL)
  --max-iterations <N>       Cap total worker runs (0 = unlimited)
  --max-slice <N>            Retries per issue pass (default: 5)
  --dry-run                  Print prompts, do not run workers
  --help, -h                 Show this help

All workers: ${WORKER_KINDS.join(", ")}
`;
