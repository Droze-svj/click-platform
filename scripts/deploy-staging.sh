#!/bin/bash

# Staging Deployment Script
# This script helps deploy the application to staging

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🎭 Starting staging deployment...${NC}"

# Check if .env.staging exists
if [ ! -f .env.staging ]; then
    echo -e "${RED}❌ .env.staging file not found!${NC}"
    echo "Please create .env.staging with all required environment variables."
    echo "You can copy from template: cp env.staging.template .env.staging"
    exit 1
fi

echo -e "${GREEN}✅ Environment file found${NC}"

# Validate environment variables
echo "🔍 Validating staging environment variables..."
node scripts/validate-env.js staging

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Environment validation failed!${NC}"
    echo "Continuing anyway for staging..."
fi

# Run tests (optional for staging, but recommended)
echo "🧪 Running tests..."
npm test || echo -e "${YELLOW}⚠️  Some tests failed, continuing...${NC}"

# Build frontend
echo "🏗️  Building frontend for staging..."
cd client
npm ci
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Frontend build failed!${NC}"
    exit 1
fi

cd ..
echo -e "${GREEN}✅ Frontend built successfully${NC}"

# Run linting (optional for staging)
echo "🔍 Running linter..."
npm run lint || echo -e "${YELLOW}⚠️  Linter found issues. Continuing...${NC}"

# Create staging build directory
echo "📦 Creating staging build..."
mkdir -p dist/staging
cp -r server dist/staging/
cp -r client/.next dist/staging/client-next 2>/dev/null || true
cp package.json dist/staging/
cp package-lock.json dist/staging/
cp .env.staging dist/staging/.env
cp ecosystem.staging.config.js dist/staging/ecosystem.config.js 2>/dev/null || cp ecosystem.config.js dist/staging/

echo -e "${GREEN}✅ Staging build created${NC}"

# Create deployment package
echo -e "${YELLOW}📦 Creating staging deployment package...${NC}"
DEPLOY_DIR="deploy-staging-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEPLOY_DIR"

# Copy necessary files
cp -r server "$DEPLOY_DIR/"
cp -r client/.next "$DEPLOY_DIR/client-next" 2>/dev/null || true
cp -r client/public "$DEPLOY_DIR/client-public" 2>/dev/null || true
cp package.json "$DEPLOY_DIR/"
cp package-lock.json "$DEPLOY_DIR/"
cp ecosystem.staging.config.js "$DEPLOY_DIR/ecosystem.config.js" 2>/dev/null || cp ecosystem.config.js "$DEPLOY_DIR/"
cp .env.staging "$DEPLOY_DIR/.env" 2>/dev/null || echo -e "${YELLOW}⚠️  .env.staging not found, create it manually${NC}"

# Create deployment script
cat > "$DEPLOY_DIR/deploy.sh" << 'DEPLOYSCRIPT'
#!/bin/bash
set -e
echo "🎭 Deploying staging application..."
npm ci --production
cd client && npm ci && npm run build && cd ..
pm2 reload ecosystem.config.js --env staging || pm2 start ecosystem.config.js --env staging
echo "✅ Staging deployment complete!"
DEPLOYSCRIPT
chmod +x "$DEPLOY_DIR/deploy.sh"

# Create tarball
echo -e "${YELLOW}📦 Creating deployment archive...${NC}"
tar -czf "${DEPLOY_DIR}.tar.gz" "$DEPLOY_DIR"
rm -rf "$DEPLOY_DIR"

echo -e "${GREEN}✅ Staging deployment package created: ${DEPLOY_DIR}.tar.gz${NC}"

# Display deployment checklist
echo ""
echo -e "${YELLOW}📋 Pre-deployment Checklist:${NC}"
echo "  [ ] Staging database migrations run (if needed)"
echo "  [ ] SSL certificates installed for staging domain"
echo "  [ ] Staging domain configured (staging.your-domain.com)"
echo "  [ ] CDN configured (if using)"
echo "  [ ] Monitoring set up (Sentry staging project)"
echo "  [ ] Backups configured"
echo "  [ ] Environment variables set on staging server"
echo "  [ ] Process manager configured (PM2)"
echo "  [ ] Log rotation configured"
echo "  [ ] Firewall rules configured"
echo ""

echo -e "${GREEN}✅ Staging deployment package ready!${NC}"
echo "📦 Package: ${DEPLOY_DIR}.tar.gz"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Upload ${DEPLOY_DIR}.tar.gz to your staging server"
echo "  2. Extract: tar -xzf ${DEPLOY_DIR}.tar.gz"
echo "  3. Run: cd ${DEPLOY_DIR} && bash deploy.sh"
echo "  4. Monitor: pm2 logs click-api-staging"
echo "  5. Health check: curl http://localhost:5002/api/health"
echo ""


