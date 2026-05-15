#!/usr/bin/env bash
# ------------------------------------------------------------------------------
# Ralph loop — autonomous implementation driver for a parent GitHub issue
# ------------------------------------------------------------------------------
#
# What this script does (high level):
#
#   1. Finds child slice issues linked to a parent issue (e.g. #8) on GitHub.
#   2. For each child, in order:
#        a) Runs Cursor Agent to implement the slice (code + unit tests).
#        b) Runs Cursor Agent again to execute the matching browser E2E suite.
#   3. Runs a final Agent pass: Suite D regression, one combined PR.
#
# The script does NOT embed the PRD or task details. Each Agent pass is told
# which repo files to read (CONTEXT.md, PRD, E2E plan, GitHub issue URL).
#
# Progress is gated by magic lines the Agent must print when done:
#   RALPH_ISSUE_COMPLETE #<n>     — implementation for child issue n
#   RALPH_E2E_COMPLETE SUITE_X     — browser E2E suite X (A/B/C per child order)
#   RALPH_ALL_COMPLETE            — final integration + PR
#
# Prerequisites: git, gh, jq, Cursor CLI (`agent`), CURSOR_API_KEY if needed.
#
# Usage:
#   ./scripts/ralph-player-levels-loop.sh
#   ./scripts/ralph-player-levels-loop.sh --dry-run    # print prompts only
#   ./scripts/ralph-player-levels-loop.sh --skip-e2e   # skip browser verification
#   ./scripts/ralph-player-levels-loop.sh --from 21  # skip lower-numbered children
#   ./scripts/ralph-player-levels-loop.sh --max 5    # cap retries per implementation pass
#   ./scripts/ralph-player-levels-loop.sh --push     # git push after each milestone
#
# Environment overrides: RALPH_PARENT_ISSUE, RALPH_BRANCH, RALPH_CHILD_ISSUES, etc.
# See .ralph/README.md for state files and screenshots.
# ------------------------------------------------------------------------------

set -euo pipefail

# --- Configuration (override with RALPH_* env vars) ---------------------------

REPO="${RALPH_REPO:-Kiryushin-Andrey/volley-game-central}"
PARENT_ISSUE="${RALPH_PARENT_ISSUE:-8}"          # Epic / PRD issue on GitHub
ISSUE_NUMBERS=()                                  # Filled by load_child_issues()
BRANCH="${RALPH_BRANCH:-cursor/player-levels-c8a4}" # Single integration branch → one PR
BASE="${RALPH_BASE:-main}"

# Docs the Agent must read each pass (paths only — content stays in repo)
CONTEXT="${RALPH_CONTEXT:-CONTEXT.md}"
PRD="${RALPH_PRD:-docs/prd/player-levels-and-game-format.md}"
E2E="${RALPH_E2E:-docs/testing/e2e-player-levels-browser-agent.md}"

# Local progress tracking between loop iterations
STATE_DIR="${RALPH_STATE_DIR:-.ralph}"
STATE="${STATE_DIR}/player-levels-state.json"    # completed issues / E2E suites
LOGS="${STATE_DIR}/logs"                         # Agent stdout per run
STEERING="${STATE_DIR}/STEERING.md"              # Optional human overrides
SCREENSHOTS="${STATE_DIR}/screenshots"           # E2E artifacts (Agent-written)

AGENT="${RALPH_AGENT_CMD:-agent}"                # Cursor CLI

# Retry limits (0 = unlimited for implementation passes)
MAX_IMPL=0
MAX_E2E=5
DRY_RUN=false
SKIP_E2E=false
FROM=0          # Skip child issues with number < FROM (resume aid)
PUSH=false

# --- CLI argument parsing -----------------------------------------------------

while [[ $# -gt 0 ]]; do
  case "$1" in
    --max) MAX_IMPL="$2"; shift 2 ;;
    --max-e2e) MAX_E2E="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    --skip-e2e) SKIP_E2E=true; shift ;;
    --from) FROM="$2"; shift 2 ;;
    --push) PUSH=true; shift ;;
    --branch) BRANCH="$2"; shift 2 ;;
    -h|--help) sed -n '2,32p' "$0"; exit 0 ;;
    *) echo "Unknown: $1" >&2; exit 1 ;;
  esac
done

# --- GitHub: child issues under the parent ------------------------------------

issue_url() { echo "https://github.com/${REPO}/issues/$1"; }

# Slice issues created via /to-issues include:
#   ## Parent
#   https://github.com/<org>/<repo>/issues/<PARENT_ISSUE>
discover_child_issues() {
  gh issue list --repo "$REPO" --state all --limit 200 --json number,body \
    | jq -r --argjson parent "$PARENT_ISSUE" '
        .[]
        | select(.number != $parent)
        | select(.body | test("## Parent[\\s\\S]*?/issues/" + ($parent | tostring) + "\\b"))
        | .number
      ' | sort -n
}

load_child_issues() {
  if [[ -n "${RALPH_CHILD_ISSUES:-}" ]]; then
    # Manual override when discovery is not desired
    read -ra ISSUE_NUMBERS <<<"$RALPH_CHILD_ISSUES"
    return
  fi
  mapfile -t ISSUE_NUMBERS < <(discover_child_issues)
  if [[ ${#ISSUE_NUMBERS[@]} -eq 0 ]]; then
    echo "No child issues found for parent #${PARENT_ISSUE} (expected ## Parent link in body)." >&2
    exit 1
  fi
}

# E2E doc maps 1st child → Suite A, 2nd → B, 3rd → C (see ${E2E} §11)
issue_suite_index() {
  local target="$1" i=0 n
  for n in "${ISSUE_NUMBERS[@]}"; do
    [[ "$n" == "$target" ]] && { echo "$i"; return 0; }
    i=$((i + 1))
  done
  return 1
}

suite_for() {
  local idx
  idx="$(issue_suite_index "$1")" || return 1
  printf '%c' $((65 + idx))   # 0→A, 1→B, 2→C
}

# For the final PR body: "Closes #20, Closes #21, …"
closes_clause() {
  local parts=() n
  for n in "${ISSUE_NUMBERS[@]}"; do parts+=("Closes #${n}"); done
  local IFS=', '
  echo "${parts[*]}"
}

# --- Completion detection -----------------------------------------------------
# Agent must emit the promise on its own line (see header). We scan the log.

has_promise() {
  local log="$1" promise="$2"
  local esc; esc="$(sed 's/[.[\*^$()+?{|]/\\&/g' <<<"$promise")"
  grep -qE "^[[:space:]]*${esc}[[:space:]]*$" "$log" 2>/dev/null
}

# --- Persistent state (.ralph/player-levels-state.json) -----------------------

write_state() { local tmp; tmp="$(mktemp)"; cat >"$tmp"; mv "$tmp" "$STATE"; }

init_state() {
  mkdir -p "$STATE_DIR" "$LOGS" "$SCREENSHOTS"
  if [[ ! -f "$STATE" ]]; then
    write_state <<EOF
{"parent_issue":$PARENT_ISSUE,"branch":"$BRANCH","completed_issues":[],"completed_e2e_suites":[],"final_complete":false}
EOF
  fi
  # Migrate older state files missing completed_e2e_suites
  if ! jq -e '.completed_e2e_suites' "$STATE" >/dev/null 2>&1; then
    jq '. + {completed_e2e_suites: []}' "$STATE" | write_state
  fi
}

jq_done_issue() { jq -e --argjson n "$1" '.completed_issues | index($n) != null' "$STATE" >/dev/null; }
jq_done_suite() { jq -e --arg s "$1" '.completed_e2e_suites | index($s) != null' "$STATE" >/dev/null; }
mark_issue() { jq --argjson n "$1" '.completed_issues += [$n] | .completed_issues |= unique' "$STATE" | write_state; }
mark_suite() { jq --arg s "$1" '.completed_e2e_suites += [$s] | .completed_e2e_suites |= unique' "$STATE" | write_state; }
mark_final() { jq '.final_complete = true' "$STATE" | write_state; }

# --- Cursor Agent invocation --------------------------------------------------

run_agent() {
  local title="$1" prompt="$2" log="$3"
  if $DRY_RUN; then echo "=== $title ==="; printf '%s\n' "$prompt"; return 0; fi
  echo "=== $title ==="
  # -p --force: non-interactive; apply file edits without confirmation
  # shellcheck disable=SC2086
  $AGENT -p --force -- "$prompt" 2>&1 | tee "$log"
}

maybe_push() {
  if $DRY_RUN || ! $PUSH; then return 0; fi
  git push -u origin "$BRANCH" || echo "warn: push failed" >&2
}

# --- Prompt builders (thin: file paths + promises only) -----------------------

# Shared "read these files" block for every Agent pass
refs_block() {
  local issue="${1:-}"
  cat <<EOF
Read in the repo (required):
- ${CONTEXT}
- ${PRD}  (parent #${PARENT_ISSUE})
- ${E2E}
$([ -f "$STEERING" ] && echo "- ${STEERING}  (steering — highest priority)" || true)
$([ -n "$issue" ] && echo "- GitHub issue #${issue}: $(issue_url "$issue")" || true)
Work on branch ${BRANCH} (base ${BASE}). One PR for parent #${PARENT_ISSUE}.
EOF
}

prompt_impl() {
  local n="$1" s; s="$(suite_for "$n")"
  cat <<EOF
Ralph loop — implementation pass, issue #${n}.

$(refs_block "$n")

Implement per that issue and ${PRD}. Follow ${CONTEXT} for terms.
Commit and push to ${BRANCH}. Next automated step: E2E Suite ${s} (${E2E}).

Output on its own line when done:
RALPH_ISSUE_COMPLETE #${n}
EOF
}

prompt_e2e() {
  local suite="$1" n="$2"
  cat <<EOF
Ralph loop — E2E pass, Suite ${suite}.

$(refs_block "$n")

Execute Suite ${suite} from ${E2E} (§6–§8). Screenshots: ${SCREENSHOTS}/.
Minimal fixes on ${BRANCH} only; commit and push if you change code.

Output on its own line when all Suite ${suite} tests pass:
RALPH_E2E_COMPLETE SUITE_${suite}
EOF
}

prompt_final() {
  cat <<EOF
Ralph loop — final pass.

$(refs_block)

Run unit tests; Suite D in ${E2E}; one draft PR ${BRANCH} → ${BASE} ($(closes_clause)).
Progress: ${STATE}

Output on its own lines when done:
RALPH_E2E_COMPLETE SUITE_D
RALPH_ALL_COMPLETE
EOF
}

# --- Retry loop: call Agent until it prints the expected promise --------------

LAST_LOG=""

run_until_promise() {
  local max="$1" title="$2" promise="$3"
  shift 3
  local build=("$@")   # e.g. prompt_impl 20
  local i=1 prompt log
  while true; do
    if [[ "$max" -gt 0 && "$i" -gt "$max" ]]; then
      echo "max iterations: $title" >&2
      return 1
    fi
    prompt="$("${build[@]}")"
    log="${LOGS}/${title}-iter${i}-$(date +%Y%m%d-%H%M%S).log"
    run_agent "${title}-iter${i}" "$prompt" "$log" || true
    LAST_LOG="$log"
    if [[ -f "$log" ]] && has_promise "$log" "$promise"; then
      echo "OK: $promise"
      return 0
    fi
    echo "missing: $promise (see $log)"
    i=$((i + 1))
    sleep 3
  done
}

# --- Main orchestration -------------------------------------------------------

main() {
  command -v git gh jq >/dev/null || { echo "need: git gh jq" >&2; exit 1; }
  $DRY_RUN || command -v "$AGENT" >/dev/null || { echo "need: $AGENT" >&2; exit 1; }

  cd "$(git rev-parse --show-toplevel)"
  for f in "$CONTEXT" "$PRD" "$E2E"; do
    [[ -f "$f" ]] || { echo "missing: $f" >&2; exit 1; }
  done
  init_state
  load_child_issues
  echo "Parent #${PARENT_ISSUE} → child issues: ${ISSUE_NUMBERS[*]}"

  if ! $DRY_RUN; then
    git fetch origin "$BASE" "$BRANCH" 2>/dev/null || true
    git checkout "$BRANCH" 2>/dev/null || git checkout -B "$BRANCH" "origin/${BASE}"
  fi

  # --- Per child issue: implement, then browser E2E -------------------------
  local n s
  for n in "${ISSUE_NUMBERS[@]}"; do
    [[ "$n" -lt "$FROM" ]] && continue
    jq_done_issue "$n" && continue   # already finished in a previous run

    s="$(suite_for "$n")"

    run_until_promise "$MAX_IMPL" "issue-${n}-impl" "RALPH_ISSUE_COMPLETE #${n}" prompt_impl "$n" || exit 1
    maybe_push

    if ! $SKIP_E2E; then
      run_until_promise "$MAX_E2E" "e2e-${s}" "RALPH_E2E_COMPLETE SUITE_${s}" prompt_e2e "$s" "$n" || exit 1
      mark_suite "$s"
      maybe_push
    fi

    mark_issue "$n"
  done

  # --- Final: Suite D + single PR -------------------------------------------
  if jq -e '.final_complete == true' "$STATE" >/dev/null 2>&1; then
    exit 0
  fi

  run_until_promise 10 "final" "RALPH_ALL_COMPLETE" prompt_final || exit 1
  if has_promise "$LAST_LOG" "RALPH_E2E_COMPLETE SUITE_D"; then
    mark_suite D
  fi
  mark_final
  maybe_push
}

main "$@"
