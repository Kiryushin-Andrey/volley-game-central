#!/usr/bin/env bash
# Start a new Oz (Warp) cloud agent run (POST /agent/run).
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: start-oz-cloud-session.sh [options] "prompt text"

Options:
  --title TITLE          Run title (default: first 80 chars of prompt)
  --environment-id ID    Oz environment UID (default: OZ_ENVIRONMENT_ID)
  --config-name NAME     Oz config name (default: ad-hoc)
  --model-id ID          Optional model id
  --auto-pr              Request PR creation when run completes
  -h, --help             Show this help

Requires: WARP_API_KEY, OZ_ENVIRONMENT_ID (or --environment-id), curl, jq
EOF
}

OZ_API_BASE="${OZ_API_BASE:-https://app.warp.dev/api/v1}"
ENV_ID="${OZ_ENVIRONMENT_ID:-}"
CONFIG_NAME="ad-hoc"
MODEL_ID=""
AUTO_PR=false
TITLE=""
PROMPT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --title) TITLE="${2:?}"; shift 2 ;;
    --environment-id) ENV_ID="${2:?}"; shift 2 ;;
    --config-name) CONFIG_NAME="${2:?}"; shift 2 ;;
    --model-id) MODEL_ID="${2:?}"; shift 2 ;;
    --auto-pr) AUTO_PR=true; shift ;;
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

if [[ -z "${WARP_API_KEY:-}" ]]; then
  echo "error: set WARP_API_KEY" >&2
  exit 1
fi

if [[ -z "$ENV_ID" ]]; then
  echo "error: set OZ_ENVIRONMENT_ID or pass --environment-id (https://oz.warp.dev/)" >&2
  exit 1
fi

if [[ -z "$TITLE" ]]; then
  TITLE="${PROMPT:0:80}"
fi

CONFIG="$(jq -n \
  --arg env "$ENV_ID" \
  --arg name "$CONFIG_NAME" \
  --arg model "$MODEL_ID" \
  '{ environment_id: $env, name: $name }
   + (if $model != "" then { model_id: $model } else {} end)')"

BODY="$(jq -n \
  --arg prompt "$PROMPT" \
  --arg title "$TITLE" \
  --argjson config "$CONFIG" \
  --argjson createPr "$AUTO_PR" \
  '{ prompt: $prompt, title: $title, config: $config, create_pr: $createPr }')"

RESP="$(curl -fsS \
  -H "Authorization: Bearer ${WARP_API_KEY}" \
  -H "Content-Type: application/json" \
  -X POST "${OZ_API_BASE%/}/agent/run" \
  -d "$BODY")"

RUN_ID="$(echo "$RESP" | jq -r '.run_id // empty')"
SESSION_URL="$(echo "$RESP" | jq -r '.session_link // empty')"
STATE="$(echo "$RESP" | jq -r '.state // empty')"

if [[ -z "$SESSION_URL" && -n "$RUN_ID" ]]; then
  SESSION_URL="https://oz.warp.dev/runs/${RUN_ID}"
fi

echo "run_id=${RUN_ID}"
echo "state=${STATE}"
echo "url=${SESSION_URL}"
echo ""
echo "$SESSION_URL"
