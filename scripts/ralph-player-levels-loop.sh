#!/usr/bin/env bash
# Ralph loop — player levels + game format (one combined PR)
#
# For each GitHub slice (#20 → #21 → #22):
#   1. Implementation agent (CONTEXT.md + PRD + issue body)
#   2. E2E verification agent (docs/testing/e2e-player-levels-browser-agent.md)
# Final pass: unit tests + Suite D + one draft PR.
#
# Does not run unless you execute it.
#
# Prerequisites:
#   - Cursor CLI: https://cursor.com/docs/cli/installation
#   - export CURSOR_API_KEY=...  (or logged-in agent auth)
#   - gh auth login
#   - Run from repository root
#
# Usage:
#   ./scripts/ralph-player-levels-loop.sh
#   ./scripts/ralph-player-levels-loop.sh --max 5
#   ./scripts/ralph-player-levels-loop.sh --dry-run
#   ./scripts/ralph-player-levels-loop.sh --from 21
#   ./scripts/ralph-player-levels-loop.sh --skip-e2e   # implementation only (not recommended)
#
# Promises (agent must output on its own line):
#   RALPH_ISSUE_COMPLETE #<issue>
#   RALPH_E2E_COMPLETE SUITE_A|SUITE_B|SUITE_C|SUITE_D
#   RALPH_ALL_COMPLETE

set -euo pipefail

# --- configuration ----------------------------------------------------------

REPO="${RALPH_REPO:-Kiryushin-Andrey/volley-game-central}"
PARENT_ISSUE="${RALPH_PARENT_ISSUE:-8}"
ISSUE_NUMBERS=(20 21 22)
INTEGRATION_BRANCH="${RALPH_BRANCH:-cursor/player-levels-c8a4}"
BASE_BRANCH="${RALPH_BASE:-main}"

CONTEXT_FILE="${RALPH_CONTEXT:-CONTEXT.md}"
PRD_FILE="${RALPH_PRD:-docs/prd/player-levels-and-game-format.md}"
E2E_FILE="${RALPH_E2E:-docs/testing/e2e-player-levels-browser-agent.md}"
STATE_DIR="${RALPH_STATE_DIR:-.ralph}"
STATE_FILE="${STATE_DIR}/player-levels-state.json"
LOG_DIR="${STATE_DIR}/logs"
E2E_SCREENSHOT_DIR="${STATE_DIR}/screenshots"
STEERING_FILE="${STATE_DIR}/STEERING.md"

MINI_APP_URL="${RALPH_MINI_APP_URL:-http://127.0.0.1:3001}"
BACKEND_URL="${RALPH_BACKEND_URL:-http://localhost:3000}"

AGENT_CMD="${RALPH_AGENT_CMD:-agent}"
AGENT_EXTRA_ARGS=(${RALPH_AGENT_EXTRA_ARGS:-})

MAX_PER_ISSUE=0
MAX_E2E_PER_SUITE=5
DRY_RUN=false
SKIP_E2E=false
FROM_ISSUE=0
GIT_PUSH=false

issue_promise() { echo "RALPH_ISSUE_COMPLETE #${1}"; }
e2e_promise()   { echo "RALPH_E2E_COMPLETE SUITE_${1}"; }
FINAL_PROMISE="RALPH_ALL_COMPLETE"

# Issue → E2E suite letter
e2e_suite_for_issue() {
  case "$1" in
    20) echo "A" ;;
    21) echo "B" ;;
    22) echo "C" ;;
    *)  echo "" ;;
  esac
}

# --- parse args -------------------------------------------------------------

while [[ $# -gt 0 ]]; do
  case "$1" in
    --max|--max-per-issue) MAX_PER_ISSUE="$2"; shift 2 ;;
    --max-e2e)             MAX_E2E_PER_SUITE="$2"; shift 2 ;;
    --dry-run)             DRY_RUN=true; shift ;;
    --skip-e2e)            SKIP_E2E=true; shift ;;
    --from)                FROM_ISSUE="$2"; shift 2 ;;
    --push)                GIT_PUSH=true; shift ;;
    --branch)              INTEGRATION_BRANCH="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,35p' "$0"
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

# --- helpers ----------------------------------------------------------------

repo_root() { git rev-parse --show-toplevel 2>/dev/null || pwd; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "Error: '$1' not found" >&2; exit 1; }
}

check_promise_line() {
  local output_file="$1" local promise="$2"
  grep -qF "$promise" "$output_file" 2>/dev/null && \
    grep -qE "^[[:space:]]*$(printf '%s' "$promise" | sed 's/[.[\*^$()+?{|]/\\&/g')[[:space:]]*$" "$output_file" 2>/dev/null
}

fetch_issue_body() {
  gh issue view "$1" --repo "$REPO" --json title,body \
    --jq '"# Issue #\(.number): \(.title)\n\n\(.body)"'
}

read_file_or_die() {
  [[ -f "$1" ]] || { echo "Error: required file missing: $1" >&2; exit 1; }
  cat "$1"
}

init_state() {
  mkdir -p "$STATE_DIR" "$LOG_DIR" "$E2E_SCREENSHOT_DIR"
  if [[ ! -f "$STATE_FILE" ]]; then
    cat >"$STATE_FILE" <<EOF
{
  "parent_issue": ${PARENT_ISSUE},
  "branch": "${INTEGRATION_BRANCH}",
  "completed_issues": [],
  "completed_e2e_suites": [],
  "final_complete": false
}
EOF
  fi
  # Ensure key exists on older state files
  if ! jq -e '.completed_e2e_suites' "$STATE_FILE" >/dev/null 2>&1; then
    local tmp; tmp="$(mktemp)"
    jq '. + {completed_e2e_suites: []}' "$STATE_FILE" >"$tmp" && mv "$tmp" "$STATE_FILE"
  fi
}

issue_completed() {
  jq -e --argjson n "$1" '.completed_issues | index($n) != null' "$STATE_FILE" >/dev/null 2>&1
}

e2e_suite_completed() {
  jq -e --arg s "$1" '.completed_e2e_suites | index($s) != null' "$STATE_FILE" >/dev/null 2>&1
}

mark_issue_complete() {
  local tmp; tmp="$(mktemp)"
  jq --argjson n "$1" '.completed_issues += [$n] | .completed_issues |= unique' "$STATE_FILE" >"$tmp"
  mv "$tmp" "$STATE_FILE"
}

mark_e2e_suite_complete() {
  local tmp; tmp="$(mktemp)"
  jq --arg s "$1" '.completed_e2e_suites += [$s] | .completed_e2e_suites |= unique' "$STATE_FILE" >"$tmp"
  mv "$tmp" "$STATE_FILE"
}

mark_final_complete() {
  local tmp; tmp="$(mktemp)"
  jq '.final_complete = true' "$STATE_FILE" >"$tmp"
  mv "$tmp" "$STATE_FILE"
}

all_issues_complete() {
  local n; for n in "${ISSUE_NUMBERS[@]}"; do issue_completed "$n" || return 1; done
  return 0
}

all_slice_e2e_complete() {
  $SKIP_E2E && return 0
  e2e_suite_completed "A" && e2e_suite_completed "B" && e2e_suite_completed "C"
}

# --- implementation prompt --------------------------------------------------

build_impl_prompt() {
  local issue_num="$1" issue_markdown="$2"
  local promise; promise="$(issue_promise "$issue_num")"
  local context prd e2e steering suite
  suite="$(e2e_suite_for_issue "$issue_num")"

  context="$(read_file_or_die "$CONTEXT_FILE")"
  prd="$(read_file_or_die "$PRD_FILE")"
  e2e="$(read_file_or_die "$E2E_FILE")"
  steering=""; [[ -f "$STEERING_FILE" ]] && steering="$(cat "$STEERING_FILE")"

  cat <<PROMPT_EOF
# Ralph loop — IMPLEMENTATION pass (issue #${issue_num})

Implement the slice below. After this pass, a separate **E2E browser pass** will run
**Suite ${suite}** from \`${E2E_FILE}\` — build so those scenarios can pass.

## Mission

Parent #${PARENT_ISSUE}, one PR on branch \`${INTEGRATION_BRANCH}\` (base \`${BASE_BRANCH}\`).
Repo: https://github.com/${REPO}

## Current slice

${issue_markdown}

## CONTEXT.md

\`\`\`markdown
${context}
\`\`\`

## PRD

\`\`\`markdown
${prd}
\`\`\`

## E2E plan (read now; you will be verified against Suite ${suite})

\`\`\`markdown
${e2e}
\`\`\`

PROMPT_EOF

  if [[ -n "$steering" ]]; then
    cat <<PROMPT_EOF

## Steering (highest priority)

\`\`\`markdown
${steering}
\`\`\`

PROMPT_EOF
  fi

  cat <<PROMPT_EOF

## Rules

1. Satisfy all acceptance criteria on \`${INTEGRATION_BRANCH}\`.
2. Follow CONTEXT.md vocabulary.
3. Commit and push to \`${INTEGRATION_BRANCH}\`.
4. Unit tests per PRD (game format helpers / eligibility module when applicable).
5. Do **not** output the E2E promise — implementation only.

### Slice #20
\`game_format\`: recreational | positions | priority_players. priority_players ≠ positions.

### Slice #21
Players hub, player levels admin, pills, dialog — **no** registration enforcement.

### Slice #22
\`POSITIONS_GAME_LEVEL_RESTRICTIONS_ENABLED\`; hide join button; positions games only.

## Implementation complete

When code + unit tests for this slice are done, output on its own line:

${promise}

PROMPT_EOF
}

# --- E2E verification prompt ------------------------------------------------

suite_checklist() {
  case "$1" in
    A) cat <<'EOF'
Run every test; all must PASS:
- A1: Admin create game — one select (3 formats), not two toggles
- A2: Create recreational game (future date)
- A3: Create positions game — DB game_format = positions
- A4: Create priority_players game — not a positions game
- A5: Existing migrated game loads correctly
- A6: Priority players game — priority window smoke (unassigned player)
- A7: Skip if #22 not merged; else recreational + beginner + restrictions on → join allowed
Demo: three formats in DB; "Show all scheduled games" shows them.
EOF
    ;;
    B) cat <<'EOF'
Restrictions env OFF. Run every test; all must PASS:
- B1: Players toolbar → Players hub (two links)
- B2: Link → Game administrators
- B3: Link → Player levels — unassigned group first
- B4: Unassigned Player — no pill
- B5: Assign Beginner in dialog — immediate save, red pill
- B6: Name filter works
- B7: Beginner → Advanced — green pill
- B8: Non-admin cannot access /players or /player-levels
- B9: Non-admin — no level visible on game details
- B10: Beginner on positions game — Join Game still visible (no enforcement)
EOF
    ;;
    C) cat <<'EOF'
Pre: POSITIONS_GAME_LEVEL_RESTRICTIONS_ENABLED=true; restart backend.
Create POS-FAR (+7d), POS-NEAR (+2d), POS-ANY (+5d) positions games (admin + SQL if needed).
Run every test; all must PASS:
- C1: Beginner + POS-NEAR — no Join Game, no guest bypass
- C2: Advanced + POS-FAR — Join visible (if registration open)
- C3: Unassigned + POS-FAR — same as advanced
- C4: Intermediate + POS-FAR — no Join Game
- C5: Intermediate + POS-NEAR — Join visible
- C6: Beginner + priority_players game — join not level-blocked
- C7: Beginner + recreational — join not level-blocked
- C8: Advanced join/leave POS-NEAR — may re-join
- C9: Beginner on roster with restrictions off → turn on → still listed (grandfather)
- C10: After C9 unregister — cannot self-rejoin
- C11: Beginner — guest registration hidden
- C12: Advanced — guest flow smoke
- C13: Restrictions off — beginner sees Join on new positions game
No level text in player UI. Screenshot each C* join-button state.
EOF
    ;;
    D) cat <<'EOF'
Run every test; all must PASS:
- D1: Admin manual add participant (past/readonly, no payment requests) for Beginner
- D2: Edit game format recreational ↔ positions saves correctly
- D3: Player levels list sort: unassigned → advanced → intermediate → beginner, A–Z
- D4: Legacy true/true row → recreational (if seeded)
EOF
    ;;
  esac
}

build_e2e_prompt() {
  local suite="$1" issue_num="${2:-}"
  local promise; promise="$(e2e_promise "$suite")"
  local e2e context checklist
  e2e="$(read_file_or_die "$E2E_FILE")"
  context="$(read_file_or_die "$CONTEXT_FILE")"
  checklist="$(suite_checklist "$suite")"

  cat <<PROMPT_EOF
# Ralph loop — E2E VERIFICATION pass (Suite ${suite})

You are verifying implementation on branch \`${INTEGRATION_BRANCH}\` using the **browser**.
Do not implement large features unless a small fix is required for a failing test.

**Authoritative plan:** \`${E2E_FILE}\` (full text below).

## Environment

1. From repo root, ensure stack is running:
   \`\`\`bash
   ./dev-start.sh
   \`\`\`
   Mini-app: **${MINI_APP_URL}** | Backend: **${BACKEND_URL}** | DEV_MODE=true

2. Use **${MINI_APP_URL}** (not localhost) in the browser.

3. Screenshots → \`${E2E_SCREENSHOT_DIR}/\` (name: \`${suite}-<test-id>.png\`)

PROMPT_EOF

  if [[ "$suite" == "C" ]]; then
    cat <<PROMPT_EOF
4. **Suite C only:** backend must have \`POSITIONS_GAME_LEVEL_RESTRICTIONS_ENABLED=true\`
   (restart backend after exporting).

PROMPT_EOF
  fi

  if [[ "$suite" == "B" || "$suite" == "A" ]]; then
    cat <<PROMPT_EOF
4. **Suite ${suite}:** restrictions should be **off** (unset env; restart backend).

PROMPT_EOF
  fi

  cat <<PROMPT_EOF

## Personas (dev login — logout between users)

| Persona | Phone digits | Admin checkbox |
|---------|--------------|----------------|
| Global Admin | 610000001 | yes |
| Unassigned | 610000002 | no |
| Advanced | 610000003 | no |
| Intermediate | 610000004 | no |
| Beginner | 610000005 | no |
| Non-admin | 610000006 | no |

Pre-seed levels via Player levels UI or SQL (see E2E doc §3).

## Suite ${suite} checklist

${checklist}

## Reporting (required)

Print a table:

\`\`\`
| ID | Pass/Fail | Notes |
|----|-----------|-------|
\`\`\`

Use the template from E2E doc §8. If any test fails, fix minimally on \`${INTEGRATION_BRANCH}\`, re-run, commit, push.

## CONTEXT.md (domain terms)

\`\`\`markdown
${context}
\`\`\`

## Full E2E plan

\`\`\`markdown
${e2e}
\`\`\`

## E2E pass complete

When **every** test in Suite ${suite} passes, output on its own line:

${promise}

If anything fails and cannot be fixed this iteration, do **not** output that line.

PROMPT_EOF
}

build_final_prompt() {
  local context prd e2e
  context="$(read_file_or_die "$CONTEXT_FILE")"
  prd="$(read_file_or_die "$PRD_FILE")"
  e2e="$(read_file_or_die "$E2E_FILE")"

  cat <<PROMPT_EOF
# Ralph loop — FINAL pass (integration + Suite D + PR)

Child issues #20–#22 and E2E Suites A–B–C should be complete (see ${STATE_FILE}).

## Tasks (order)

1. Sync \`${INTEGRATION_BRANCH}\` with \`${BASE_BRANCH}\` if needed.
2. Run backend unit tests (game format + eligibility modules).
3. **E2E Suite D** — full regression per \`${E2E_FILE}\` (browser, ${MINI_APP_URL}).
4. Fix failures; commit; push.
5. Open **one** draft PR → \`${BASE_BRANCH}\` for parent #${PARENT_ISSUE}.
   Body: Closes #20, Closes #21, Closes #22.

## Suite D checklist

$(suite_checklist D)

## CONTEXT.md

\`\`\`markdown
${context}
\`\`\`

## PRD

\`\`\`markdown
${prd}
\`\`\`

## E2E plan

\`\`\`markdown
${e2e}
\`\`\`

When unit tests pass, Suite D passes, and draft PR is open, output:

${FINAL_PROMISE}

Also output: RALPH_E2E_COMPLETE SUITE_D

PROMPT_EOF
}

run_agent() {
  local prompt="$1" log_file="$2" title="$3"
  if $DRY_RUN; then
    echo "=== DRY RUN: $title ==="
    printf '%s\n' "$prompt"
    return 0
  fi
  echo "=== Agent: $title ==="
  # shellcheck disable=SC2086
  ${AGENT_CMD} -p --force "${AGENT_EXTRA_ARGS[@]}" -- "$prompt" 2>&1 | tee "$log_file"
  return "${PIPESTATUS[0]}"
}

ensure_branch() {
  $DRY_RUN && return 0
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
  git push -u origin "$INTEGRATION_BRANCH" || echo "Warning: push failed"
}

run_impl_loop() {
  local issue_num="$1" issue_md="$2"
  local promise iter=1
  promise="$(issue_promise "$issue_num")"

  while true; do
    [[ "$MAX_PER_ISSUE" -gt 0 && "$iter" -gt "$MAX_PER_ISSUE" ]] && {
      echo "Max impl iterations ($MAX_PER_ISSUE) for #$issue_num" >&2; exit 1; }
    echo ""
    echo "=== Issue #$issue_num IMPLEMENTATION — iter $iter ==="
    local prompt log
    prompt="$(build_impl_prompt "$issue_num" "$issue_md")"
    log="${LOG_DIR}/issue-${issue_num}-impl-iter${iter}-$(date +%Y%m%d-%H%M%S).log"
    run_agent "$prompt" "$log" "impl-${issue_num}-${iter}" || true
    if [[ -f "$log" ]] && check_promise_line "$log" "$promise"; then
      echo "Detected: $promise"
      return 0
    fi
    echo "Missing $promise; retry in 3s..."
    iter=$((iter + 1)); sleep 3
  done
}

run_e2e_loop() {
  local suite="$1" issue_num="${2:-}"
  local promise iter=1
  promise="$(e2e_promise "$suite")"

  while true; do
    [[ "$MAX_E2E_PER_SUITE" -gt 0 && "$iter" -gt "$MAX_E2E_PER_SUITE" ]] && {
      echo "Max E2E iterations ($MAX_E2E_PER_SUITE) for Suite $suite" >&2; exit 1; }
    echo ""
    echo "=== E2E Suite ${suite} (issue #${issue_num}) — iter $iter ==="
    local prompt log
    prompt="$(build_e2e_prompt "$suite" "$issue_num")"
    log="${LOG_DIR}/e2e-suite-${suite}-iter${iter}-$(date +%Y%m%d-%H%M%S).log"
    run_agent "$prompt" "$log" "e2e-${suite}-${iter}" || true
    if [[ -f "$log" ]] && check_promise_line "$log" "$promise"; then
      echo "Detected: $promise"
      mark_e2e_suite_complete "$suite"
      return 0
    fi
    echo "Missing $promise; retry in 5s..."
    iter=$((iter + 1)); sleep 5
  done
}

# --- main -------------------------------------------------------------------

main() {
  require_cmd git; require_cmd gh; require_cmd jq
  $DRY_RUN || require_cmd "$AGENT_CMD"

  cd "$(repo_root)"
  read_file_or_die "$CONTEXT_FILE"
  read_file_or_die "$PRD_FILE"
  read_file_or_die "$E2E_FILE"
  init_state
  ensure_branch

  echo "=== Ralph loop: player levels ==="
  echo "Repo:       $REPO"
  echo "Parent:     #$PARENT_ISSUE"
  echo "Issues:     ${ISSUE_NUMBERS[*]}"
  echo "Branch:     $INTEGRATION_BRANCH"
  echo "E2E doc:    $E2E_FILE"
  echo "Screenshots $E2E_SCREENSHOT_DIR"
  echo "Skip E2E:   $SKIP_E2E"
  echo "Dry run:    $DRY_RUN"
  echo ""

  local issue_num suite issue_md
  for issue_num in "${ISSUE_NUMBERS[@]}"; do
    [[ "$issue_num" -lt "$FROM_ISSUE" ]] && continue
    issue_completed "$issue_num" && { echo "Skip #$issue_num (done)"; continue; }

    suite="$(e2e_suite_for_issue "$issue_num")"
    issue_md="$(fetch_issue_body "$issue_num")"

    run_impl_loop "$issue_num" "$issue_md"
    maybe_push

    if ! $SKIP_E2E; then
      e2e_suite_completed "$suite" || run_e2e_loop "$suite" "$issue_num"
      maybe_push
    else
      echo "Skipping E2E Suite $suite (--skip-e2e)"
    fi

    mark_issue_complete "$issue_num"
    echo "Issue #$issue_num complete (impl + E2E Suite $suite)."
  done

  all_issues_complete || { echo "Not all issues done." >&2; exit 1; }
  $SKIP_E2E || all_slice_e2e_complete || { echo "Not all E2E suites A–C done." >&2; exit 1; }

  jq -e '.final_complete == true' "$STATE_FILE" >/dev/null 2>&1 && exit 0

  echo ""
  echo "=== FINAL integration + Suite D ==="
  local final_iter=1
  while [[ "$final_iter" -le 10 ]]; do
    local fprompt flog
    fprompt="$(build_final_prompt)"
    flog="${LOG_DIR}/final-iter${final_iter}-$(date +%Y%m%d-%H%M%S).log"
    run_agent "$fprompt" "$flog" "final-${final_iter}" || true

    if [[ -f "$flog" ]] && check_promise_line "$flog" "$(e2e_promise D)"; then
      mark_e2e_suite_complete "D"
    fi

    if [[ -f "$flog" ]] && check_promise_line "$flog" "$FINAL_PROMISE"; then
      mark_final_complete
      maybe_push
      echo ""
      echo "=== Ralph loop finished ==="
      echo "PR: ${INTEGRATION_BRANCH} → ${BASE_BRANCH}"
      echo "E2E suites: $(jq -r '.completed_e2e_suites | join(", ")' "$STATE_FILE")"
      exit 0
    fi
    final_iter=$((final_iter + 1)); sleep 5
  done
  echo "Final pass failed after 10 iterations" >&2
  exit 1
}

main "$@"
