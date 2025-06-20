#!/bin/bash

# Script to build and publish Docker image to Docker Hub
# Created: $(date +"%Y-%m-%d")

# Configuration
IMAGE_NAME="andreykir/volleybot"
TAG="1.2.1"

# Colors for terminal output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting Docker build and publish process...${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}Error: Docker is not running. Please start Docker and try again.${NC}"
  exit 1
fi

# Step 1: Set up Docker Buildx for multi-architecture builds
echo -e "${YELLOW}Step 1: Setting up Docker Buildx for multi-architecture builds...${NC}"

# Create a new builder instance if it doesn't exist
if ! docker buildx inspect mybuilder > /dev/null 2>&1; then
  docker buildx create --name mybuilder --use
fi

# Use the builder
docker buildx use mybuilder

# Bootstrap the builder
docker buildx inspect --bootstrap

# Step 2: Build and push the multi-architecture Docker image
echo -e "${YELLOW}Step 2: Building and pushing multi-architecture image ${IMAGE_NAME}:${TAG}...${NC}"
if docker buildx build --platform linux/amd64,linux/arm64 -t ${IMAGE_NAME}:${TAG} --push .; then
  echo -e "${GREEN}Multi-architecture build and push successful!${NC}"
else
  echo -e "${RED}Multi-architecture build failed. Exiting.${NC}"
  exit 1
fi

# Step 2: Check if user is logged in to Docker Hub
echo -e "${YELLOW}Step 2: Checking Docker Hub authentication...${NC}"
if ! docker info | grep -q "Username"; then
  echo -e "${YELLOW}You are not logged in to Docker Hub. Please log in:${NC}"
  docker login
  
  # Check if login was successful
  if [ $? -ne 0 ]; then
    echo -e "${RED}Docker Hub login failed. Exiting.${NC}"
    exit 1
  fi
fi

# Step 3: Push the image to Docker Hub
echo -e "${YELLOW}Step 3: Pushing ${IMAGE_NAME}:${TAG} to Docker Hub...${NC}"
if docker push ${IMAGE_NAME}:${TAG}; then
  echo -e "${GREEN}Successfully pushed ${IMAGE_NAME}:${TAG} to Docker Hub!${NC}"
else
  echo -e "${RED}Failed to push image to Docker Hub.${NC}"
  exit 1
fi

echo -e "${GREEN}Process completed successfully!${NC}"
echo -e "${YELLOW}Your image is now available at: ${GREEN}docker.io/${IMAGE_NAME}:${TAG}${NC}"
