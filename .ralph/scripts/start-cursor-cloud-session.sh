#!/usr/bin/env bash
# Start a new Cursor Cloud Agent session (POST /v1/agents).
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: start-cursor-cloud-session.sh [options] "prompt text"

Options:
  --branch NAME          Git branch (default: current branch)
  --repo-url URL         GitHub repo URL (default: from git remote origin)
  --work-on-branch       Push to starting ref instead of cursor/* branch (default: on)
  --no-work-on-branch    Use auto-generated cursor/* branch
  --auto-pr              Open PR when run completes
  --model ID             Model id (default: default = Auto)
  --env KEY=VAL          Session env var (repeatable)
  -h, --help             Show this help

Requires: CURSOR_API_KEY, git, curl, jq
EOF
}

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

BRANCH="$(git branch --show-current)"
REPO_URL=""
WORK_ON_BRANCH=true
AUTO_PR=false
MODEL="default"
declare -a ENV_PAIRS=()
PROMPT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --branch) BRANCH="${2:?}"; shift 2 ;;
    --repo-url) REPO_URL="${2:?}"; shift 2 ;;
    --work-on-branch) WORK_ON_BRANCH=true; shift ;;
    --no-work-on-branch) WORK_ON_BRANCH=false; shift ;;
    --auto-pr) AUTO_PR=true; shift ;;
    --model) MODEL="${2:?}"; shift 2 ;;
    --env) ENV_PAIRS+=("${2:?}"); shift 2 ;;
    --) shift; PROMPT="${*:-}"; break ;;
    -*) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
    *)
      if [[ -z "$PROMPT" ]]; then
        PROMPT="$1"
        shift
      else
        PROMPT="$PROMPT $1"
        shift
      fi
      ;;
  esac
done

if [[ -z "$PROMPT" ]]; then
  echo "error: prompt required" >&2
  usage >&2
  exit 1
fi

if [[ -z "${CURSOR_API_KEY:-}" ]]; then
  echo "error: set CURSOR_API_KEY (Cursor Dashboard → Integrations)" >&2
  exit 1
fi

if [[ -z "$REPO_URL" ]]; then
  ORIGIN="$(git remote get-url origin)"
  if [[ "$ORIGIN" =~ github\.com[:/]([^/]+)/([^/.]+) ]]; then
    REPO_URL="https://github.com/${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
  else
    echo "error: pass --repo-url (could not parse GitHub origin)" >&2
    exit 1
  fi
fi

API_BASE="${CURSOR_API_BASE:-https://api.cursor.com}"

ENV_JSON="{}"
for pair in "${ENV_PAIRS[@]}"; do
  KEY="${pair%%=*}"
  VAL="${pair#*=}"
  ENV_JSON="$(jq -n --argjson base "$ENV_JSON" --arg k "$KEY" --arg v "$VAL" '$base + {($k): $v}')"
done

BODY="$(jq -n \
  --arg text "$PROMPT" \
  --arg url "$REPO_URL" \
  --arg ref "$BRANCH" \
  --arg model "$MODEL" \
  --argjson workOn "$WORK_ON_BRANCH" \
  --argjson autoPr "$AUTO_PR" \
  --argjson envVars "$ENV_JSON" \
  '{
    prompt: { text: $text },
    model: { id: $model },
    repos: [{ url: $url, startingRef: $ref }],
    workOnCurrentBranch: $workOn,
    autoCreatePR: $autoPr
  }
  + (if ($envVars | length) > 0 then { envVars: $envVars } else {} end)')"

RESP="$(curl -fsS -u "${CURSOR_API_KEY}:" \
  -H "Content-Type: application/json" \
  -X POST "${API_BASE%/}/v1/agents" \
  -d "$BODY")"

AGENT_URL="$(echo "$RESP" | jq -r '.agent.url // empty')"
AGENT_ID="$(echo "$RESP" | jq -r '.agent.id // empty')"
RUN_ID="$(echo "$RESP" | jq -r '.run.id // empty')"

if [[ -z "$AGENT_URL" && -n "$AGENT_ID" ]]; then
  AGENT_URL="https://cursor.com/agents?id=${AGENT_ID}"
fi

echo "agent_id=${AGENT_ID}"
echo "run_id=${RUN_ID}"
echo "url=${AGENT_URL}"
echo ""
echo "$AGENT_URL"
