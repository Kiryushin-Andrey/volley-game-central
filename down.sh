#!/bin/bash

# Script to stop Docker Compose services in production
# Created: $(date +"%Y-%m-%d")

# Colors for terminal output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.prod"

echo -e "${YELLOW}Stopping production services...${NC}"

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
  echo -e "${YELLOW}Warning: $ENV_FILE not found in the current directory.${NC}"
  echo -e "${YELLOW}Will proceed without environment file.${NC}"
  USE_ENV_FILE=false
else
  USE_ENV_FILE=true
fi

# Stop the services
echo -e "${YELLOW}Stopping services...${NC}"

if [ "$USE_ENV_FILE" = true ]; then
  # Use environment file if available
  if docker compose -f $COMPOSE_FILE --env-file $ENV_FILE down; then
    echo -e "${GREEN}Services stopped successfully!${NC}"
  else
    echo -e "${RED}Failed to stop services.${NC}"
    exit 1
  fi
else
  # Proceed without environment file
  if docker compose -f $COMPOSE_FILE down; then
    echo -e "${GREEN}Services stopped successfully!${NC}"
  else
    echo -e "${RED}Failed to stop services.${NC}"
    exit 1
  fi
fi

echo -e "${GREEN}Production environment has been shut down.${NC}"
