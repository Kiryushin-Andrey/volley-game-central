#!/bin/bash

# Script to build and publish Docker image to Docker Hub
# Works with any Docker daemon (Docker Desktop, OrbStack, Colima, plain dockerd).

set -euo pipefail

# Configuration
IMAGE_NAME="andreykir/volleybot"
TAG="1.5.0"
BUILDER="mybuilder"
PLATFORMS="linux/amd64,linux/arm64"

# Colors for terminal output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting Docker build and publish process...${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}Error: Docker is not running. Start Docker Desktop (or your Docker daemon) and try again.${NC}"
  exit 1
fi

DOCKER_CONTEXT_NAME="$(docker context show)"
DOCKER_CONTEXT_HOST="$(docker context inspect "${DOCKER_CONTEXT_NAME}" --format '{{.Endpoints.docker.Host}}')"
echo -e "${YELLOW}Using Docker context: ${GREEN}${DOCKER_CONTEXT_NAME}${NC} (${DOCKER_CONTEXT_HOST})"

# Step 1: Set up Docker Buildx for multi-architecture builds
echo -e "${YELLOW}Step 1: Setting up Docker Buildx for multi-architecture builds...${NC}"

# A builder created against a different Docker runtime keeps pointing at that
# runtime's context. `docker buildx inspect` still exits 0 for such a builder
# and only reports the broken node in its output, so check the output itself
# and rebuild the builder when it is no longer usable here.
builder_is_usable() {
  local out node_endpoint
  out="$(docker buildx inspect "${BUILDER}" 2>&1)" || return 1
  if grep -q '^Error:' <<< "${out}"; then
    return 1
  fi
  node_endpoint="$(awk '/^Endpoint:/ {print $2; exit}' <<< "${out}")"
  [[ "${node_endpoint}" == "${DOCKER_CONTEXT_NAME}" || "${node_endpoint}" == "${DOCKER_CONTEXT_HOST}" ]]
}

if builder_is_usable; then
  echo -e "${GREEN}Reusing existing builder '${BUILDER}'.${NC}"
else
  if docker buildx inspect "${BUILDER}" > /dev/null 2>&1; then
    echo -e "${YELLOW}Builder '${BUILDER}' is not usable with the current Docker context. Recreating it...${NC}"
    # A node bound to a Docker runtime that is gone cannot be stopped, so `rm`
    # may report an error while still dropping the builder from the config.
    docker buildx rm -f "${BUILDER}" > /dev/null 2>&1 || true
    if docker buildx inspect "${BUILDER}" > /dev/null 2>&1; then
      echo -e "${RED}Could not remove builder '${BUILDER}'. Remove it manually with 'docker buildx rm -f ${BUILDER}' and re-run.${NC}"
      exit 1
    fi
  fi
  docker buildx create --name "${BUILDER}" --driver docker-container "${DOCKER_CONTEXT_NAME}" > /dev/null
  echo -e "${GREEN}Created builder '${BUILDER}'.${NC}"
fi

# Use the builder
docker buildx use "${BUILDER}"

# Bootstrap the builder
docker buildx inspect --bootstrap "${BUILDER}"

# Step 2: Check if user is logged in to Docker Hub
echo -e "${YELLOW}Step 2: Checking Docker Hub authentication...${NC}"

# Docker Desktop keeps credentials in the OS keychain, so `docker info` never
# reports a Username there. Ask the configured credential helper instead, and
# fall back to the auths recorded in config.json.
logged_in_to_docker_hub() {
  local config="${DOCKER_CONFIG:-${HOME}/.docker}/config.json"

  if docker info 2>/dev/null | grep -q 'Username'; then
    return 0
  fi

  [ -f "${config}" ] || return 1

  local creds_store
  creds_store="$(sed -n 's/.*"credsStore"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "${config}")"
  if [ -n "${creds_store}" ] && command -v "docker-credential-${creds_store}" > /dev/null 2>&1; then
    if "docker-credential-${creds_store}" list 2>/dev/null | grep -q 'index.docker.io'; then
      return 0
    fi
  fi

  grep -q 'index.docker.io' "${config}"
}

if logged_in_to_docker_hub; then
  echo -e "${GREEN}Docker Hub credentials found.${NC}"
else
  echo -e "${YELLOW}You are not logged in to Docker Hub. Please log in:${NC}"
  if ! docker login; then
    echo -e "${RED}Docker Hub login failed. Exiting.${NC}"
    exit 1
  fi
fi

# Step 3: Build and push the multi-architecture Docker image
echo -e "${YELLOW}Step 3: Building and pushing multi-architecture image ${IMAGE_NAME}:${TAG}...${NC}"
if docker buildx build --builder "${BUILDER}" --platform "${PLATFORMS}" -t "${IMAGE_NAME}:${TAG}" --push .; then
  echo -e "${GREEN}Multi-architecture build and push successful!${NC}"
  echo -e "${GREEN}Process completed successfully!${NC}"
  echo -e "${YELLOW}Your image is now available at: ${GREEN}docker.io/${IMAGE_NAME}:${TAG}${NC}"
else
  echo -e "${RED}Multi-architecture build and push failed. Exiting.${NC}"
  exit 1
fi
