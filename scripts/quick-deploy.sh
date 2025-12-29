#!/bin/bash

# Quick Deployment Script
# Streamlined deployment for production

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DEPLOY_DIR="/var/www/click"

echo -e "${BLUE}🚀 Quick Production Deployment${NC}"
echo ""

# Check if running as deploy user or with sudo
if [ "$USER" != "deploy" ] && [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run as 'deploy' user or with sudo${NC}"
    exit 1
fi

# Navigate to deployment directory
if [ ! -d "$DEPLOY_DIR" ]; then
    echo -e "${RED}❌ Deployment directory not found: $DEPLOY_DIR${NC}"
    exit 1
fi

cd "$DEPLOY_DIR"

# Check for .env.production
if [ ! -f ".env.production" ]; then
    echo -e "${RED}❌ .env.production not found!${NC}"
    echo "Please create .env.production first."
    exit 1
fi

# Load environment
export $(cat .env.production | grep -v '^#' | xargs)

# Step 1: Pull latest code
echo -e "${YELLOW}1. Pulling latest code...${NC}"
if [ -d ".git" ]; then
    git fetch origin
    git reset --hard origin/main
    echo -e "  ${GREEN}✅ Code updated${NC}"
else
    echo -e "  ${YELLOW}⚠️  Not a git repository, skipping${NC}"
fi

# Step 2: Install dependencies
echo -e "${YELLOW}2. Installing dependencies...${NC}"
npm ci --production
cd client && npm ci && npm run build && cd ..
echo -e "  ${GREEN}✅ Dependencies installed${NC}"

# Step 3: Run migrations
echo -e "${YELLOW}3. Running database migrations...${NC}"
if node scripts/migrate-database.js; then
    echo -e "  ${GREEN}✅ Migrations completed${NC}"
else
    echo -e "  ${YELLOW}⚠️  Migration failed or no migrations needed${NC}"
fi

# Step 4: Create backup
echo -e "${YELLOW}4. Creating database backup...${NC}"
if node scripts/backup-database.js; then
    echo -e "  ${GREEN}✅ Backup created${NC}"
else
    echo -e "  ${YELLOW}⚠️  Backup failed or skipped${NC}"
fi

# Step 5: Reload application
echo -e "${YELLOW}5. Reloading application...${NC}"
if pm2 list | grep -q "click-api"; then
    pm2 reload ecosystem.config.js --env production
    echo -e "  ${GREEN}✅ Application reloaded${NC}"
else
    pm2 start ecosystem.config.js --env production
    pm2 save
    echo -e "  ${GREEN}✅ Application started${NC}"
fi

# Step 6: Wait for health check
echo -e "${YELLOW}6. Waiting for health check...${NC}"
sleep 5

MAX_RETRIES=12
RETRY_COUNT=0
HEALTHY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -f http://localhost:5001/api/health > /dev/null 2>&1; then
        HEALTHY=true
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo -n "."
    sleep 5
done

echo ""

if [ "$HEALTHY" = true ]; then
    echo -e "  ${GREEN}✅ Health check passed${NC}"
else
    echo -e "  ${RED}❌ Health check failed!${NC}"
    echo -e "  ${YELLOW}⚠️  Check logs: pm2 logs click-api${NC}"
    exit 1
fi

# Step 7: Verify deployment
echo -e "${YELLOW}7. Verifying deployment...${NC}"
if bash scripts/verify-deployment.sh; then
    echo -e "  ${GREEN}✅ Deployment verified${NC}"
else
    echo -e "  ${YELLOW}⚠️  Some verification checks failed${NC}"
fi

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo -e "${BLUE}📊 Quick Status:${NC}"
pm2 list | grep click
echo ""
echo -e "${BLUE}📝 Useful Commands:${NC}"
echo "  View logs: pm2 logs click-api"
echo "  Monitor: pm2 monit"
echo "  Restart: pm2 restart click-api"
echo "  Health: curl http://localhost:5001/api/health"



