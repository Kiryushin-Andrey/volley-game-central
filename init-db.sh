#!/bin/bash

# Script to initialize the database in production
# Created: $(date +"%Y-%m-%d")

# Colors for terminal output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.prod"
CONTAINER_NAME="volleybot"

echo -e "${YELLOW}Initializing database for production environment...${NC}"

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

# Check if the container is running
CONTAINER_ID=$(docker compose -f $COMPOSE_FILE --env-file $ENV_FILE ps -q $CONTAINER_NAME)
if [ -z "$CONTAINER_ID" ]; then
  echo -e "${RED}Error: Container $CONTAINER_NAME is not running. Start it first with ./up.sh${NC}"
  exit 1
fi

echo -e "${YELLOW}Running database migrations...${NC}"

# Execute the migration command inside the container
if docker exec -it $CONTAINER_ID sh -c "cd /app/backend && npm run migrate"; then
  echo -e "${GREEN}Database migrations completed successfully!${NC}"
else
  echo -e "${RED}Failed to run database migrations.${NC}"
  echo -e "${YELLOW}Trying alternative approach...${NC}"
  
  # Try with node directly if npm run migrate fails
  if docker exec -it $CONTAINER_ID sh -c "cd /app/backend && node dist/db/migrate.js"; then
    echo -e "${GREEN}Database migrations completed successfully with alternative approach!${NC}"
  else
    echo -e "${RED}All migration attempts failed. Please check the container logs for more details:${NC}"
    echo -e "${YELLOW}docker logs $CONTAINER_ID${NC}"
    exit 1
  fi
fi

echo -e "${GREEN}Database initialization complete. Your application should now work correctly.${NC}"
