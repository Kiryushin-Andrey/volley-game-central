#!/bin/bash

# Dev mode startup script for Volley Game Central
# This script sets DEV_MODE=true and starts the application
# Usage: ./dev-start.sh [preview-host]
# Example: ./dev-start.sh example.com

echo "🏐 Starting Volley Game Central in DEV MODE"
echo "============================================"
echo ""
echo "Dev mode features:"
echo "  ✓ Simplified authentication (phone + name, no SMS)"
echo "  ✓ All Telegram notifications suppressed"
echo "  ✓ All SMS notifications suppressed"
echo ""

# Set dev mode environment variable
export DEV_MODE=true

# Accept preview host as parameter
if [ -n "$1" ]; then
  export PREVIEW_HOST="$1"
  echo "Preview host set to: $PREVIEW_HOST"
  echo ""
fi

# Start the database
echo "Starting PostgreSQL database..."
docker compose up -d postgres

# Wait a moment for database to be ready
sleep 2

# Start backend and frontend concurrently
echo ""
echo "Starting backend and frontend..."
echo ""
npm run dev
