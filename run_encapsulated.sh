#!/bin/bash

# Ion Dashboard - Encapsulated Installer & Runner for Ubuntu/Linux
# This script ensures Docker is available, builds the application, and runs it.

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🚀 Ion Dashboard Encapsulated Run${NC}"
echo "========================================"

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker is not installed.${NC}"
    echo "This encapsulated setup requires Docker to run cleanly without polluting your system."
    echo "Please install Docker and Docker Compose plugin."
    echo "  sudo apt update"
    echo "  sudo apt install docker.io docker-compose-plugin"
    exit 1
fi

# Check for Docker Compose
if ! docker compose version &> /dev/null; then
     if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}Docker Compose is not found.${NC}"
        exit 1
     fi
fi

echo -e "${GREEN}📦 Building and Starting Container...${NC}"

# Stop existing if any
docker compose down 2>/dev/null || true

# Build and Up
docker compose up -d --build

echo ""
echo -e "${GREEN}✅ Application is running!${NC}"
echo -e "   Access at: ${BLUE}http://localhost:3001${NC}"
echo ""
echo "To stop the application, run: docker compose down"
