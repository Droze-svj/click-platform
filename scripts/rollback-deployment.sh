#!/bin/bash

# Rollback Deployment Script
# Rolls back to previous deployment version

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

DEPLOY_DIR="/var/www/click"
BACKUP_DIR="$DEPLOY_DIR/backups"
CURRENT_DIR="$DEPLOY_DIR/current"
PREVIOUS_DIR="$DEPLOY_DIR/previous"

echo -e "${YELLOW}🔄 Starting rollback...${NC}"

# Check if previous version exists
if [ ! -d "$PREVIOUS_DIR" ]; then
    echo -e "${RED}❌ No previous version found!${NC}"
    exit 1
fi

# Create backup of current version
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="rollback_backup_$TIMESTAMP"
echo -e "${YELLOW}📦 Creating backup of current version...${NC}"
cp -r "$CURRENT_DIR" "$BACKUP_DIR/$BACKUP_NAME"

# Stop application
echo -e "${YELLOW}⏸️  Stopping application...${NC}"
pm2 stop click-api click-worker || true

# Rollback to previous version
echo -e "${YELLOW}🔄 Rolling back to previous version...${NC}"
rm -rf "$CURRENT_DIR"
cp -r "$PREVIOUS_DIR" "$CURRENT_DIR"

# Restore environment
if [ -f "$BACKUP_DIR/.env.backup" ]; then
    echo -e "${YELLOW}📝 Restoring environment variables...${NC}"
    cp "$BACKUP_DIR/.env.backup" "$CURRENT_DIR/.env"
fi

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
cd "$CURRENT_DIR"
npm ci --production

# Restart application
echo -e "${YELLOW}🚀 Restarting application...${NC}"
pm2 reload ecosystem.config.js --env production

# Wait for health check
echo -e "${YELLOW}⏳ Waiting for health check...${NC}"
sleep 10

# Check health
HEALTH_URL="http://localhost:5001/api/health"
if curl -f "$HEALTH_URL" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Rollback successful!${NC}"
    echo -e "${GREEN}✅ Application is healthy${NC}"
else
    echo -e "${RED}❌ Health check failed!${NC}"
    echo -e "${YELLOW}⚠️  Consider manual intervention${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Rollback completed successfully${NC}"



