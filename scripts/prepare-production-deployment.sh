#!/bin/bash

# Production Deployment Preparation Script
# This script prepares the application for production deployment

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Preparing for Production Deployment...${NC}"
echo ""

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo -e "${RED}❌ .env.production file not found!${NC}"
    echo "Creating from template..."
    
    if [ -f env.production.template ]; then
        cp env.production.template .env.production
        echo -e "${GREEN}✅ Created .env.production from template${NC}"
        echo -e "${YELLOW}⚠️  Please edit .env.production with your production values${NC}"
    else
        echo -e "${RED}❌ env.production.template not found!${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Environment file found${NC}"

# Validate environment variables
echo "🔍 Validating production environment variables..."
node scripts/validate-env.js production

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Environment validation failed!${NC}"
    echo "Please fix the errors above before deploying."
    exit 1
fi

echo -e "${GREEN}✅ Environment variables validated${NC}"

# Run tests
echo "🧪 Running tests..."
npm test

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Tests failed! Fix tests before deploying.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All tests passed${NC}"

# Run E2E tests (optional but recommended)
read -p "Run E2E tests? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🧪 Running E2E tests..."
    npm run test:e2e || {
        echo -e "${YELLOW}⚠️  Some E2E tests failed. Continue anyway? (y/n)${NC}"
        read -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    }
fi

# Build frontend
echo "🏗️  Building frontend for production..."
cd client
npm ci
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Frontend build failed!${NC}"
    exit 1
fi

cd ..
echo -e "${GREEN}✅ Frontend built successfully${NC}"

# Run linting
echo "🔍 Running linter..."
npm run lint || {
    echo -e "${YELLOW}⚠️  Linter found issues. Continue anyway? (y/n)${NC}"
    read -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
}

# Check OAuth configuration
echo "🔐 Checking OAuth configuration..."
bash scripts/verify-oauth.sh

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  OAuth configuration incomplete. Continue anyway? (y/n)${NC}"
    read -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Create production checklist
echo ""
echo -e "${BLUE}📋 Production Deployment Checklist${NC}"
echo "=========================================="
echo ""
echo "Before deploying, ensure:"
echo ""
echo "  [ ] .env.production configured with all values"
echo "  [ ] Database migrations run (if needed)"
echo "  [ ] MongoDB production database created"
echo "  [ ] Redis production instance configured"
echo "  [ ] AWS S3 bucket created and configured"
echo "  [ ] SSL certificates obtained and installed"
echo "  [ ] Domain DNS configured"
echo "  [ ] OAuth apps configured with production URLs"
echo "  [ ] Sentry project created and DSN configured"
echo "  [ ] Monitoring set up (PM2, health checks)"
echo "  [ ] Backups configured"
echo "  [ ] Firewall rules configured"
echo "  [ ] CDN configured (if using)"
echo "  [ ] Error tracking configured (Sentry)"
echo "  [ ] Log rotation configured"
echo "  [ ] Process manager configured (PM2)"
echo "  [ ] All tests passing"
echo "  [ ] E2E tests passing"
echo "  [ ] OAuth flows tested"
echo ""
echo -e "${YELLOW}⚠️  Review the checklist above before proceeding${NC}"
echo ""

read -p "Continue with deployment package creation? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment preparation cancelled."
    exit 0
fi

# Create deployment package
echo "📦 Creating production deployment package..."
bash scripts/deploy-production.sh

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Deployment package creation failed!${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Production deployment preparation complete!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Review the deployment package"
echo "  2. Upload to production server"
echo "  3. Run deployment script on server"
echo "  4. Monitor deployment logs"
echo "  5. Verify health endpoint"
echo "  6. Test OAuth flows"
echo ""


