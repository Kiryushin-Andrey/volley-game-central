#!/usr/bin/env bash
# Ralph loop — player levels + game format (one combined PR)
#
# Iterates GitHub child issues in order, invoking Cursor Agent each round with
# CONTEXT.md + PRD inlined in the prompt. Does not run unless you execute it.
#
# Prerequisites:
#   - Cursor CLI: https://cursor.com/docs/cli/installation
#   - export CURSOR_API_KEY=...  (or logged-in agent auth)
#   - gh auth login
#   - Run from repository root
#
# Usage:
#   ./scripts/ralph-player-levels-loop.sh              # unlimited iterations per issue
#   ./scripts/ralph-player-levels-loop.sh --max 5      # max agent runs per issue
#   ./scripts/ralph-player-levels-loop.sh --dry-run    # print prompts only
#   ./scripts/ralph-player-levels-loop.sh --from 21    # skip completed issues < 21
#
# Stop:
#   Ctrl+C
#   Agent outputs: RALPH_ISSUE_COMPLETE #<number>
#   All issues + final integration promise (see FINAL_PROMISE)

set -euo pipefail

# --- configuration ----------------------------------------------------------

REPO="${RALPH_REPO:-Kiryushin-Andrey/volley-game-central}"
PARENT_ISSUE="${RALPH_PARENT_ISSUE:-8}"
ISSUE_NUMBERS=(20 21 22)   # vertical slices, dependency order
INTEGRATION_BRANCH="${RALPH_BRANCH:-cursor/player-levels-c8a4}"
BASE_BRANCH="${RALPH_BASE:-main}"

CONTEXT_FILE="${RALPH_CONTEXT:-CONTEXT.md}"
PRD_FILE="${RALPH_PRD:-docs/prd/player-levels-and-game-format.md}"
E2E_FILE="${RALPH_E2E:-docs/testing/e2e-player-levels-browser-agent.md}"
STATE_DIR="${RALPH_STATE_DIR:-.ralph}"
STATE_FILE="${STATE_DIR}/player-levels-state.json"
LOG_DIR="${STATE_DIR}/logs"
STEERING_FILE="${STATE_DIR}/STEERING.md"

AGENT_CMD="${RALPH_AGENT_CMD:-agent}"
AGENT_EXTRA_ARGS=(${RALPH_AGENT_EXTRA_ARGS:-})   # e.g. (-p --force)

MAX_PER_ISSUE=0          # 0 = unlimited runs per issue
DRY_RUN=false
FROM_ISSUE=0
GIT_PUSH=false
GIT_PUSH_REMOTE="origin"

# Per-issue completion token (agent must emit exactly on its own line)
issue_promise() { echo "RALPH_ISSUE_COMPLETE #${1}"; }
FINAL_PROMISE="RALPH_ALL_COMPLETE"

# --- parse args -------------------------------------------------------------

while [[ $# -gt 0 ]]; do
  case "$1" in
    --max|--max-per-issue)
      MAX_PER_ISSUE="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --from)
      FROM_ISSUE="$2"
      shift 2
      ;;
    --push)
      GIT_PUSH=true
      shift
      ;;
    --branch)
      INTEGRATION_BRANCH="$2"
      shift 2
      ;;
    -h|--help)
      sed -n '2,25p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

# --- helpers ----------------------------------------------------------------

repo_root() {
  git rev-parse --show-toplevel 2>/dev/null || pwd
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Error: '$1' not found in PATH" >&2
    exit 1
  }
}

check_promise_line() {
  local output_file="$1"
  local promise="$2"
  grep -qE "^[[:space:]]*${promise}[[:space:]]*$" "$output_file" 2>/dev/null
}

fetch_issue_body() {
  local num="$1"
  gh issue view "$num" --repo "$REPO" --json title,body --jq '"# Issue #\(.number): \(.title)\n\n\(.body)"'
}

read_file_or_die() {
  local path="$1"
  [[ -f "$path" ]] || { echo "Error: required file missing: $path" >&2; exit 1; }
  cat "$path"
}

init_state() {
  mkdir -p "$STATE_DIR" "$LOG_DIR"
  if [[ ! -f "$STATE_FILE" ]]; then
    cat >"$STATE_FILE" <<EOF
{
  "parent_issue": ${PARENT_ISSUE},
  "branch": "${INTEGRATION_BRANCH}",
  "completed_issues": [],
  "final_complete": false
}
EOF
  fi
}

issue_completed() {
  local num="$1"
  jq -e --argjson n "$num" '.completed_issues | index($n) != null' "$STATE_FILE" >/dev/null 2>&1
}

mark_issue_complete() {
  local num="$1"
  local tmp
  tmp="$(mktemp)"
  jq --argjson n "$num" '.completed_issues += [$n] | .completed_issues |= unique' "$STATE_FILE" >"$tmp"
  mv "$tmp" "$STATE_FILE"
}

mark_final_complete() {
  local tmp
  tmp="$(mktemp)"
  jq '.final_complete = true' "$STATE_FILE" >"$tmp"
  mv "$tmp" "$STATE_FILE"
}

all_issues_complete() {
  local n
  for n in "${ISSUE_NUMBERS[@]}"; do
    issue_completed "$n" || return 1
  done
  return 0
}

# --- prompt (embedded) ------------------------------------------------------
# Built each iteration; includes full CONTEXT + PRD + current GitHub issue.

build_prompt() {
  local issue_num="$1"
  local issue_markdown="$2"
  local promise
  promise="$(issue_promise "$issue_num")"
  local context prd e2e steering

  context="$(read_file_or_die "$CONTEXT_FILE")"
  prd="$(read_file_or_die "$PRD_FILE")"
  e2e=""
  [[ -f "$E2E_FILE" ]] && e2e="$(cat "$E2E_FILE")"
  steering=""
  [[ -f "$STEERING_FILE" ]] && steering="$(cat "$STEERING_FILE")"

  cat <<PROMPT_EOF
# Ralph loop iteration — implement one vertical slice

You are an autonomous coding agent working in the **volley-game-central** repository.
This is one iteration of a Ralph loop. Work until this slice is **fully done** or you
are blocked; the shell will re-run you if the completion promise is missing.

## Mission (parent)

Implement parent PRD GitHub issue #${PARENT_ISSUE} as **one combined PR** on branch \`${INTEGRATION_BRANCH}\` (base: \`${BASE_BRANCH}\`).
Do **not** open separate PRs per child issue. Commit and push to \`${INTEGRATION_BRANCH}\` each iteration.

Repository: https://github.com/${REPO}

## Current slice (this iteration)

${issue_markdown}

## Domain glossary (CONTEXT.md)

\`\`\`markdown
${context}
\`\`\`

## Full PRD

\`\`\`markdown
${prd}
\`\`\`

PROMPT_EOF

  if [[ -n "$e2e" ]]; then
    cat <<PROMPT_EOF

## E2E testing plan (use when slice needs verification)

\`\`\`markdown
${e2e}
\`\`\`

PROMPT_EOF
  fi

  if [[ -n "$steering" ]]; then
    cat <<PROMPT_EOF

## Steering (human mid-flight overrides — highest priority)

\`\`\`markdown
${steering}
\`\`\`

PROMPT_EOF
  fi

  cat <<PROMPT_EOF

## Implementation rules

1. **Read the current slice issue** acceptance criteria; satisfy every checkbox.
2. **Follow CONTEXT.md vocabulary** (Positions game, game format, player level, etc.).
3. Work only on branch \`${INTEGRATION_BRANCH}\`. Checkout/create if needed:
   \`git fetch origin && git checkout ${INTEGRATION_BRANCH} || git checkout -b ${INTEGRATION_BRANCH} origin/${BASE_BRANCH}\`
4. **Order awareness:** #20 game format → #21 player levels admin → #22 restrictions.
   Do not implement #22 before #20/#21 are merged into this branch.
5. **One PR:** do not create per-slice PRs; push to \`${INTEGRATION_BRANCH}\`.
6. Add/update unit tests where the PRD specifies (eligibility + game format helpers).
7. Run migrations and relevant tests before claiming done.
8. Do not interview the user. If blocked, state blockers clearly and still omit the promise.

## Slice-specific hints

### If issue #20 (game format)
- Replace \`withPositions\` + \`withPriorityPlayers\` with \`game_format\`: \`recreational\` | \`positions\` | \`priority_players\`.
- \`priority_players\` is **not** a positions game. \`true/true\` legacy → \`recreational\`.
- Game form: single three-option select, not two toggles.

### If issue #21 (player levels admin)
- Global admin only (\`isAdmin\`). Players hub \`/players\`, player levels \`/player-levels\`.
- List order: unassigned → advanced → intermediate → beginner; pills green/yellow/red; no pill if unassigned.
- Dialog: immediate save; no clear-to-unassigned. **No registration enforcement yet.**

### If issue #22 (restrictions)
- Env: \`POSITIONS_GAME_LEVEL_RESTRICTIONS_ENABLED\` (default off).
- Pure eligibility module; only **positions** games; hide join button (no level in UI).
- Grandfather registrations; no self-serve re-join when blocked; guests follow host.

## Completion contract

When **and only when** this slice's acceptance criteria are met on \`${INTEGRATION_BRANCH}\`
(committed, pushed, tests pass for what you added):

Output this exact line on its own (no backticks):

${promise}

If not complete, do **not** output that line.

PROMPT_EOF
}

build_final_prompt() {
  local context prd e2e
  context="$(read_file_or_die "$CONTEXT_FILE")"
  prd="$(read_file_or_die "$PRD_FILE")"
  e2e=""
  [[ -f "$E2E_FILE" ]] && e2e="$(cat "$E2E_FILE")"

  cat <<PROMPT_EOF
# Ralph loop — final integration pass

All child issues (#20, #21, #22) are marked complete in ${STATE_FILE}.
Parent: #${PARENT_ISSUE}. Branch: \`${INTEGRATION_BRANCH}\`.

## Tasks

1. Rebase/sync \`${INTEGRATION_BRANCH}\` with \`${BASE_BRANCH}\` if needed; resolve conflicts.
2. Verify **entire** parent PRD #${PARENT_ISSUE} end-to-end on one branch.
3. Run unit tests + E2E Suites A–D from the testing plan (DEV_MODE, http://127.0.0.1:3001).
4. Open **one** draft PR to \`${BASE_BRANCH}\` titled for parent #${PARENT_ISSUE}.
   Body: link #8, list Closes #20, Closes #21, Closes #22.
5. Fix any gaps found in review.

## CONTEXT.md

\`\`\`markdown
${context}
\`\`\`

## PRD

\`\`\`markdown
${prd}
\`\`\`

PROMPT_EOF

  if [[ -n "$e2e" ]]; then
    cat <<PROMPT_EOF

## E2E plan

\`\`\`markdown
${e2e}
\`\`\`

PROMPT_EOF
  fi

  cat <<PROMPT_EOF

When everything is done, output on its own line:

${FINAL_PROMISE}

PROMPT_EOF
}

run_agent() {
  local prompt="$1"
  local log_file="$2"
  local title="$3"

  if $DRY_RUN; then
    echo "=== DRY RUN: would invoke agent ($title) ==="
    printf '%s\n' "$prompt"
    return 0
  fi

  echo "=== Agent: $title ==="
  # shellcheck disable=SC2086
  ${AGENT_CMD} -p --force "${AGENT_EXTRA_ARGS[@]}" -- "$prompt" 2>&1 | tee "$log_file"
  return "${PIPESTATUS[0]}"
}

ensure_branch() {
  if $DRY_RUN; then return 0; fi
  git fetch origin "$BASE_BRANCH" "$INTEGRATION_BRANCH" 2>/dev/null || git fetch origin
  if git show-ref --verify --quiet "refs/heads/${INTEGRATION_BRANCH}"; then
    git checkout "$INTEGRATION_BRANCH"
  elif git show-ref --verify --quiet "refs/remotes/origin/${INTEGRATION_BRANCH}"; then
    git checkout -B "$INTEGRATION_BRANCH" "origin/${INTEGRATION_BRANCH}"
  else
    git checkout -B "$INTEGRATION_BRANCH" "origin/${BASE_BRANCH}"
  fi
}

maybe_push() {
  if $DRY_RUN || ! $GIT_PUSH; then return 0; fi
  echo "=== git push ==="
  git push -u origin "$INTEGRATION_BRANCH" || echo "Warning: push failed"
}

# --- main -------------------------------------------------------------------

main() {
  require_cmd git
  require_cmd gh
  require_cmd jq
  if ! $DRY_RUN; then
    require_cmd "$AGENT_CMD"
  fi

  cd "$(repo_root)"
  read_file_or_die "$CONTEXT_FILE"
  read_file_or_die "$PRD_FILE"
  init_state
  ensure_branch

  echo "=== Ralph loop: player levels ==="
  echo "Repo:      $REPO"
  echo "Parent:    #$PARENT_ISSUE"
  echo "Issues:    ${ISSUE_NUMBERS[*]}"
  echo "Branch:    $INTEGRATION_BRANCH"
  echo "State:     $STATE_FILE"
  echo "Dry run:   $DRY_RUN"
  echo ""

  # --- per-issue loop ---
  local issue_num
  for issue_num in "${ISSUE_NUMBERS[@]}"; do
    if [[ "$issue_num" -lt "$FROM_ISSUE" ]]; then
      echo "Skipping #$issue_num (--from $FROM_ISSUE)"
      continue
    fi
    if issue_completed "$issue_num"; then
      echo "Skipping #$issue_num (already complete in state)"
      continue
    fi

    local iter=1
    local issue_md
    issue_md="$(fetch_issue_body "$issue_num")"
    local promise
    promise="$(issue_promise "$issue_num")"

    while true; do
      if [[ "$MAX_PER_ISSUE" -gt 0 ]] && [[ "$iter" -gt "$MAX_PER_ISSUE" ]]; then
        echo "Max iterations ($MAX_PER_ISSUE) reached for issue #$issue_num" >&2
        exit 1
      fi

      echo ""
      echo "=== Issue #$issue_num — iteration $iter ==="
      local prompt
      prompt="$(build_prompt "$issue_num" "$issue_md")"
      local log="${LOG_DIR}/issue-${issue_num}-iter${iter}-$(date +%Y%m%d-%H%M%S).log"

      run_agent "$prompt" "$log" "issue-${issue_num}-iter${iter}" || true

      if [[ -f "$log" ]] && check_promise_line "$log" "$promise"; then
        echo "Detected: $promise"
        mark_issue_complete "$issue_num"
        maybe_push
        break
      fi

      echo "Promise not found ($promise); will retry after 3s..."
      iter=$((iter + 1))
      sleep 3
    done
  done

  # --- final integration ---
  if ! all_issues_complete; then
    echo "Not all issues complete; skipping final pass." >&2
    exit 1
  fi

  if jq -e '.final_complete == true' "$STATE_FILE" >/dev/null 2>&1; then
    echo "Final pass already marked complete."
    exit 0
  fi

  echo ""
  echo "=== Final integration pass ==="
  local final_iter=1
  while true; do
    local fprompt flog
    fprompt="$(build_final_prompt)"
    flog="${LOG_DIR}/final-iter${final_iter}-$(date +%Y%m%d-%H%M%S).log"
    run_agent "$fprompt" "$flog" "final-iter${final_iter}" || true

    if [[ -f "$flog" ]] && check_promise_line "$flog" "$FINAL_PROMISE"; then
      echo "Detected: $FINAL_PROMISE"
      mark_final_complete
      maybe_push
      echo ""
      echo "=== Ralph loop finished ==="
      echo "Open draft PR: ${INTEGRATION_BRANCH} -> ${BASE_BRANCH}"
      exit 0
    fi

    final_iter=$((final_iter + 1))
    if [[ "$final_iter" -gt 10 ]]; then
      echo "Final pass did not complete after 10 iterations" >&2
      exit 1
    fi
    sleep 3
  done
}

main "$@"
