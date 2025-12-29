#!/bin/bash

# Railway.app Setup Script
# Prepares the project for Railway.app deployment

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Click - Railway.app Setup                              ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if railway.json exists
if [ -f railway.json ]; then
    echo -e "${GREEN}✅ railway.json already exists${NC}"
else
    echo -e "${BLUE}Creating railway.json...${NC}"
    
    cat > railway.json << 'RAILWAYEOF'
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install && cd client && npm install && npm run build"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
RAILWAYEOF
    
    echo -e "${GREEN}✅ railway.json created${NC}"
fi

# Create .railwayignore
echo -e "${BLUE}Creating .railwayignore...${NC}"

cat > .railwayignore << 'IGNOREEOF'
# Dependencies
node_modules/
client/node_modules/

# Environment files
.env.local
.env.development
.env.test

# Logs
*.log
logs/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Testing
coverage/
.nyc_output/
test-results/
playwright-report/

# Build outputs
dist/
build/
.next/
client/.next/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Git
.git/
.gitignore

# Documentation
*.md
docs/

# Scripts (optional - keep if needed)
# scripts/
IGNOREEOF

echo -e "${GREEN}✅ .railwayignore created${NC}"

# Verify package.json has start script
echo -e "${BLUE}Verifying package.json...${NC}"

if grep -q '"start"' package.json; then
    echo -e "${GREEN}✅ start script found in package.json${NC}"
else
    echo -e "${YELLOW}⚠️  Warning: 'start' script not found in package.json${NC}"
    echo -e "${YELLOW}   Railway needs a 'start' script to run your application${NC}"
fi

# Check if PORT is handled correctly
echo -e "${BLUE}Checking PORT configuration...${NC}"

if grep -q "process.env.PORT" server/index.js 2>/dev/null || grep -q "PORT" .env.production 2>/dev/null; then
    echo -e "${GREEN}✅ PORT configuration found${NC}"
    echo -e "${BLUE}   Note: Railway automatically sets PORT environment variable${NC}"
else
    echo -e "${YELLOW}⚠️  Warning: PORT configuration not found${NC}"
    echo -e "${YELLOW}   Railway sets PORT automatically, ensure your app uses process.env.PORT${NC}"
fi

# Create Railway deployment checklist
echo -e "${BLUE}Creating Railway deployment checklist...${NC}"

cat > RAILWAY_DEPLOYMENT_CHECKLIST.md << 'CHECKLISTEOF'
# ✅ Railway.app Deployment Checklist

## Pre-Deployment

- [ ] Railway.app account created (https://railway.app/)
- [ ] GitHub repository ready
- [ ] Free services configured:
  - [ ] MongoDB Atlas (M0 free tier)
  - [ ] Redis Cloud (30MB free tier)
  - [ ] AWS S3 (free tier)
  - [ ] Sentry (free tier)
- [ ] OAuth apps created (see OAUTH_APPS_SETUP_GUIDE.md)
- [ ] Environment variables prepared

## Railway Setup

- [ ] Sign in to Railway.app with GitHub
- [ ] Create new project
- [ ] Connect GitHub repository
- [ ] Verify build settings:
  - [ ] Build command: `npm install && cd client && npm install && npm run build`
  - [ ] Start command: `npm start`
- [ ] Add all environment variables (see RAILWAY_DEPLOYMENT_GUIDE.md)

## Environment Variables to Add

Copy from `.env.production` and add to Railway dashboard:

- [ ] NODE_ENV=production
- [ ] PORT=5001 (Railway sets this automatically, but good to have)
- [ ] FRONTEND_URL=https://your-app.railway.app
- [ ] APP_URL=https://your-app.railway.app
- [ ] MONGODB_URI=...
- [ ] REDIS_URL=...
- [ ] JWT_SECRET=...
- [ ] SESSION_SECRET=...
- [ ] AWS credentials
- [ ] OAuth credentials (all platforms)
- [ ] OPENAI_API_KEY=...
- [ ] SENTRY_DSN=...

## Deployment

- [ ] Initial deployment triggered
- [ ] Build successful (check logs)
- [ ] Application started successfully
- [ ] Health check passing: `https://your-app.railway.app/api/health`
- [ ] Frontend accessible: `https://your-app.railway.app`

## Post-Deployment

- [ ] Update OAuth callback URLs to Railway URL
- [ ] Test OAuth flows
- [ ] Test API endpoints
- [ ] Monitor logs for errors
- [ ] Set up custom domain (optional)
- [ ] Configure monitoring alerts

## Verification

- [ ] Application is accessible
- [ ] API endpoints respond
- [ ] Database connected
- [ ] Redis connected
- [ ] File uploads work (S3)
- [ ] OAuth connections work
- [ ] Logs are visible in Railway dashboard

CHECKLISTEOF

echo -e "${GREEN}✅ Railway deployment checklist created${NC}"

# Summary
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Railway.app Setup Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${CYAN}Files Created/Verified:${NC}"
echo "  ✅ railway.json"
echo "  ✅ .railwayignore"
echo "  ✅ RAILWAY_DEPLOYMENT_CHECKLIST.md"
echo ""
echo -e "${CYAN}Next Steps:${NC}"
echo "  1. Sign up at https://railway.app/"
echo "  2. Create new project and connect GitHub repo"
echo "  3. Add environment variables (see RAILWAY_DEPLOYMENT_GUIDE.md)"
echo "  4. Deploy!"
echo ""
echo -e "${BLUE}📚 See RAILWAY_DEPLOYMENT_GUIDE.md for detailed instructions${NC}"
echo ""


