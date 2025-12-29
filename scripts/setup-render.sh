#!/bin/bash

# Render.com Setup Script
# Prepares the project for Render.com deployment

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Click - Render.com Setup                               ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if render.yaml exists
if [ -f render.yaml ]; then
    echo -e "${GREEN}✅ render.yaml already exists${NC}"
    
    # Verify render.yaml content
    if grep -q "click-api" render.yaml; then
        echo -e "${GREEN}✅ render.yaml configured correctly${NC}"
    else
        echo -e "${YELLOW}⚠️  render.yaml exists but may need updates${NC}"
    fi
else
    echo -e "${BLUE}Creating render.yaml...${NC}"
    
    cat > render.yaml << 'RENDEREOF'
services:
  - type: web
    name: click-api
    env: node
    buildCommand: npm install && cd client && npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 5001
    healthCheckPath: /api/health
RENDEREOF
    
    echo -e "${GREEN}✅ render.yaml created${NC}"
fi

# Create .renderignore (if needed)
echo -e "${BLUE}Creating .renderignore...${NC}"

cat > .renderignore << 'IGNOREEOF'
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

# Build outputs (keep .next for production)
dist/
build/

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

# Documentation (optional - keep if needed)
# *.md
# docs/

# Scripts (optional - keep if needed)
# scripts/
IGNOREEOF

echo -e "${GREEN}✅ .renderignore created${NC}"

# Verify package.json has start script
echo -e "${BLUE}Verifying package.json...${NC}"

if grep -q '"start"' package.json; then
    echo -e "${GREEN}✅ start script found in package.json${NC}"
else
    echo -e "${YELLOW}⚠️  Warning: 'start' script not found in package.json${NC}"
    echo -e "${YELLOW}   Render needs a 'start' script to run your application${NC}"
fi

# Check if PORT is handled correctly
echo -e "${BLUE}Checking PORT configuration...${NC}"

if grep -q "process.env.PORT" server/index.js 2>/dev/null || grep -q "PORT" .env.production 2>/dev/null; then
    echo -e "${GREEN}✅ PORT configuration found${NC}"
    echo -e "${BLUE}   Note: Render automatically sets PORT environment variable${NC}"
else
    echo -e "${YELLOW}⚠️  Warning: PORT configuration not found${NC}"
    echo -e "${YELLOW}   Render sets PORT automatically, ensure your app uses process.env.PORT${NC}"
fi

# Create Render deployment checklist
echo -e "${BLUE}Creating Render deployment checklist...${NC}"

cat > RENDER_DEPLOYMENT_CHECKLIST.md << 'CHECKLISTEOF'
# ✅ Render.com Deployment Checklist

## Pre-Deployment

- [ ] Render.com account created (https://render.com/)
- [ ] GitHub repository ready
- [ ] Free services configured:
  - [ ] MongoDB Atlas (M0 free tier) OR Render PostgreSQL
  - [ ] Redis Cloud (30MB free tier)
  - [ ] AWS S3 (free tier)
  - [ ] Sentry (free tier)
- [ ] OAuth apps created (see OAUTH_APPS_SETUP_GUIDE.md)
- [ ] Environment variables prepared

## Render Setup

- [ ] Sign in to Render.com with GitHub
- [ ] Create new Web Service
- [ ] Connect GitHub repository
- [ ] Verify build settings:
  - [ ] Build command: `npm install && cd client && npm install && npm run build`
  - [ ] Start command: `npm start`
  - [ ] Health check path: `/api/health`
- [ ] Add all environment variables (see RENDER_DEPLOYMENT_GUIDE.md)

## Environment Variables to Add

Copy from `.env.production` and add to Render dashboard:

- [ ] NODE_ENV=production
- [ ] PORT=5001 (Render sets this automatically, but good to have)
- [ ] FRONTEND_URL=https://your-app.onrender.com
- [ ] APP_URL=https://your-app.onrender.com
- [ ] MONGODB_URI=...
- [ ] REDIS_URL=...
- [ ] JWT_SECRET=...
- [ ] SESSION_SECRET=...
- [ ] AWS credentials
- [ ] OAuth credentials (all platforms)
- [ ] OPENAI_API_KEY=...
- [ ] SENTRY_DSN=...

**Important**: Update all callback URLs to Render URL:
```
https://your-app.onrender.com/api/oauth/{platform}/callback
```

## Deployment

- [ ] Initial deployment triggered
- [ ] Build successful (check logs)
- [ ] Application started successfully
- [ ] Health check passing: `https://your-app.onrender.com/api/health`
- [ ] Frontend accessible: `https://your-app.onrender.com`

## Post-Deployment

- [ ] Update OAuth callback URLs to Render URL
- [ ] Test OAuth flows
- [ ] Test API endpoints
- [ ] Monitor logs for errors
- [ ] Set up custom domain (optional)
- [ ] Set up keep-alive service (free tier - UptimeRobot)
- [ ] Configure monitoring alerts

## Free Tier Optimization

- [ ] Set up UptimeRobot to ping `/api/health` every 5 minutes
- [ ] This keeps service awake (prevents 15-min spin-down)
- [ ] Or upgrade to Starter ($7/month) for always-on

## Verification

- [ ] Application is accessible
- [ ] API endpoints respond
- [ ] Database connected
- [ ] Redis connected
- [ ] File uploads work (S3)
- [ ] OAuth connections work
- [ ] Logs are visible in Render dashboard
- [ ] Service stays awake (if using keep-alive)

CHECKLISTEOF

echo -e "${GREEN}✅ Render deployment checklist created${NC}"

# Create keep-alive guide
echo -e "${BLUE}Creating free tier keep-alive guide...${NC}"

cat > RENDER_KEEP_ALIVE_SETUP.md << 'KEEPALIVEEOF'
# 🔄 Render.com Free Tier - Keep Service Awake

## Problem

Render.com free tier **spins down** after 15 minutes of inactivity. This means:
- First request after sleep takes 30-60 seconds
- Bad user experience
- OAuth flows may timeout

## Solution: Keep Service Awake

### Option 1: UptimeRobot (Recommended - Free)

1. **Sign up**: https://uptimerobot.com/ (free)
2. **Add Monitor**:
   - Monitor Type: HTTP(s)
   - Friendly Name: Click Keep-Alive
   - URL: `https://your-app.onrender.com/api/health`
   - Monitoring Interval: 5 minutes
3. **Save**
4. **Service stays awake** (pings every 5 minutes)

**Cost**: Free

### Option 2: Cron-Job.org (Free)

1. **Sign up**: https://cron-job.org/ (free)
2. **Create Cron Job**:
   - URL: `https://your-app.onrender.com/api/health`
   - Schedule: Every 5 minutes
3. **Service stays awake**

**Cost**: Free

### Option 3: Upgrade to Starter

1. **Go to Render dashboard**
2. **Upgrade service** to Starter ($7/month)
3. **Service always-on** (no spin-down)

**Cost**: $7/month

## Recommendation

**Use UptimeRobot** (free) to keep service awake. It's:
- ✅ Free
- ✅ Reliable
- ✅ Easy to set up
- ✅ No code changes needed

KEEPALIVEEOF

echo -e "${GREEN}✅ Keep-alive guide created${NC}"

# Summary
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Render.com Setup Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${CYAN}Files Created/Verified:${NC}"
echo "  ✅ render.yaml"
echo "  ✅ .renderignore"
echo "  ✅ RENDER_DEPLOYMENT_CHECKLIST.md"
echo "  ✅ RENDER_KEEP_ALIVE_SETUP.md"
echo ""
echo -e "${CYAN}Next Steps:${NC}"
echo "  1. Sign up at https://render.com/"
echo "  2. Create new Web Service and connect GitHub repo"
echo "  3. Add environment variables (see RENDER_DEPLOYMENT_GUIDE.md)"
echo "  4. Deploy!"
echo "  5. Set up keep-alive service (see RENDER_KEEP_ALIVE_SETUP.md)"
echo ""
echo -e "${BLUE}📚 See RENDER_DEPLOYMENT_GUIDE.md for detailed instructions${NC}"
echo -e "${YELLOW}💡 Tip: Set up UptimeRobot to keep service awake on free tier${NC}"
echo ""


