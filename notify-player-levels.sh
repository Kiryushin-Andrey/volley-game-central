#!/bin/bash

# One-off: broadcast the player-level info message to recent registrants.
#
# Runs the compiled script (backend/dist/scripts/notifyPlayerLevels.js) in a throwaway
# container spun up from the same service definition as production, so it inherits the
# same env (secrets) and the internal Docker network (Postgres). The container is removed
# on exit and does NOT publish port 80, so the live bot container is left untouched.
#
# Prerequisite: the deployed image must already contain the script, i.e. it was built from
# a commit that includes backend/src/scripts/notifyPlayerLevels.ts (run build-and-publish.sh
# and ./up.sh first). tsx is not present in the prod image, so we run the compiled JS.
#
# Usage:
#   ./notify-player-levels.sh                        # dry run, full audience (default)
#   ./notify-player-levels.sh --user <id>            # dry run for a single player
#   ./notify-player-levels.sh --user <id> --send     # send to a single player (test first!)
#   ./notify-player-levels.sh --send                 # real broadcast to everyone
#
# --user accepts an internal users.id (numeric) or a Telegram id (string).
# All arguments are forwarded verbatim to the Node script.

set -euo pipefail

# Colors for terminal output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.prod"
SERVICE="volleybot"
SCRIPT_PATH="dist/scripts/notifyPlayerLevels.js"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}Error: Docker is not running. Please start Docker and try again.${NC}"
  exit 1
fi

# Check that the required files exist
if [ ! -f "$COMPOSE_FILE" ]; then
  echo -e "${RED}Error: $COMPOSE_FILE not found in the current directory.${NC}"
  exit 1
fi
if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}Error: $ENV_FILE not found in the current directory.${NC}"
  exit 1
fi

# Detect whether this is a real send (any --send in the forwarded args)
IS_SEND=false
for arg in "$@"; do
  if [ "$arg" = "--send" ]; then
    IS_SEND=true
  fi
done

if [ "$IS_SEND" = true ]; then
  echo -e "${RED}This will SEND real Telegram messages using the production bot token.${NC}"
  echo -e "${YELLOW}Args: ${*}${NC}"
  read -p "Are you sure you want to continue? (y/n): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Aborting.${NC}"
    exit 1
  fi
else
  echo -e "${YELLOW}Dry run (no messages will be sent). Pass --send to actually deliver.${NC}"
fi

echo -e "${YELLOW}Running player-level broadcast in a one-off container...${NC}"

# `run --rm` starts a throwaway container from the volleybot service definition (same env
# and network, depends_on postgres), overrides the command to run just our script, and
# removes the container afterwards. Args are forwarded via "$@" (positional $0 = "notify").
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm "$SERVICE" \
  sh -c "cd /app/backend && exec node \"$SCRIPT_PATH\" \"\$@\"" notify "$@"

echo -e "${GREEN}Done.${NC}"
