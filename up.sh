#!/bin/bash

# Script to start Docker Compose services in production
# Created: $(date +"%Y-%m-%d")

# Colors for terminal output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.prod"

echo -e "${YELLOW}Starting production services using Docker Compose...${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}Error: Docker is not running. Please start Docker and try again.${NC}"
  exit 1
fi

# Check if the required files exist
if [ ! -f "$COMPOSE_FILE" ]; then
  echo -e "${RED}Error: $COMPOSE_FILE not found in the current directory.${NC}"
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}Error: $ENV_FILE not found in the current directory.${NC}"
  exit 1
fi

# Pull the latest images
echo -e "${YELLOW}Pulling the latest Docker images...${NC}"
docker compose -f $COMPOSE_FILE --env-file $ENV_FILE pull

# Check if environment variables are properly set in the .env file.
# The list of variables is derived from $COMPOSE_FILE itself so this check can
# never go stale when a variable is renamed: `${VAR:?...}` marks a required
# variable, while `${VAR}` and `${VAR:-default}` are optional.
echo -e "${YELLOW}Checking environment variables in $ENV_FILE...${NC}"
REQUIRED_VARS=$(grep -oE '\$\{[A-Za-z_][A-Za-z0-9_]*:\?' "$COMPOSE_FILE" | sed -e 's/^\${//' -e 's/:?$//' | sort -u)

MISSING_VARS=""
for var in $REQUIRED_VARS; do
  # Last assignment wins, matching how Docker Compose reads the env file.
  value=$(sed -n "s/^[[:space:]]*${var}=//p" "$ENV_FILE" | tail -n 1)
  if [ -z "$value" ] && [ -z "${!var}" ]; then
    MISSING_VARS="$MISSING_VARS $var"
  fi
done

if [ -n "$MISSING_VARS" ]; then
  echo -e "${RED}Warning: required environment variables are missing or empty in $ENV_FILE:${NC}"
  for var in $MISSING_VARS; do
    echo -e "${YELLOW}  - $var${NC}"
  done
  read -p "Do you want to continue anyway? (y/n): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Aborting.${NC}"
    exit 1
  fi
fi

# Start the services
echo -e "${YELLOW}Starting services...${NC}"
if docker compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d; then
  echo -e "${GREEN}Services started successfully!${NC}"
  
  # Verify environment variables were passed to the container
  echo -e "${YELLOW}Verifying environment variables in the container...${NC}"
  CONTAINER_ID=$(docker compose -f $COMPOSE_FILE --env-file $ENV_FILE ps -q volleybot)
  if [ ! -z "$CONTAINER_ID" ]; then
    echo -e "${YELLOW}Environment variables in the container:${NC}"
    docker exec $CONTAINER_ID env | grep -E 'TELEGRAM|MINI_APP|TWILIO'
  fi
  
  # Show running containers
  echo -e "${YELLOW}Running containers:${NC}"
  docker compose -f $COMPOSE_FILE --env-file $ENV_FILE ps
else
  echo -e "${RED}Failed to start services.${NC}"
  exit 1
fi

echo -e "${GREEN}Production environment is now running.${NC}"
