#!/bin/bash

# Production Deployment Script
# This script helps deploy the application to production

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting production deployment...${NC}"

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo -e "${RED}❌ .env.production file not found!${NC}"
    echo "Please create .env.production with all required environment variables."
    exit 1
fi

echo -e "${GREEN}✅ Environment file found${NC}"

# Validate environment variables
echo "🔍 Validating environment variables..."
node scripts/validate-env.js production

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Environment validation failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Environment variables validated${NC}"

# Run tests
echo "🧪 Running tests..."
pnpm test

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Tests failed! Fix tests before deploying.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All tests passed${NC}"

# Build frontend
echo "🏗️  Building frontend..."
cd client
pnpm install --frozen-lockfile=false
pnpm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Frontend build failed!${NC}"
    exit 1
fi

cd ..
echo -e "${GREEN}✅ Frontend built successfully${NC}"

# Run linting
echo "🔍 Running linter..."
pnpm run lint

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Linter found issues. Continuing anyway...${NC}"
fi

# Create production build directory
echo "📦 Creating production build..."
mkdir -p dist
cp -r server dist/
cp -r client/.next dist/client-next 2>/dev/null || true
cp package.json dist/
cp pnpm-lock.yaml dist/
cp .env.production dist/.env

echo -e "${GREEN}✅ Production build created${NC}"

# Create deployment package
echo -e "${YELLOW}📦 Creating deployment package...${NC}"
DEPLOY_DIR="deploy-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEPLOY_DIR"

# Copy necessary files
cp -r server "$DEPLOY_DIR/"
cp -r client/.next "$DEPLOY_DIR/client-next" 2>/dev/null || true
cp -r client/public "$DEPLOY_DIR/client-public" 2>/dev/null || true
cp package.json "$DEPLOY_DIR/"
cp pnpm-lock.yaml "$DEPLOY_DIR/"
cp ecosystem.config.js "$DEPLOY_DIR/"
cp .env.production "$DEPLOY_DIR/.env" 2>/dev/null || echo -e "${YELLOW}⚠️  .env.production not found, create it manually${NC}"

# Create deployment script
cat > "$DEPLOY_DIR/deploy.sh" << 'DEPLOYSCRIPT'
#!/bin/bash
set -e
echo "🚀 Deploying application..."
pnpm install --prod --frozen-lockfile=false
cd client && pnpm install --frozen-lockfile=false && pnpm run build && cd ..
pm2 reload ecosystem.config.js --env production || pm2 start ecosystem.config.js --env production
echo "✅ Deployment complete!"
DEPLOYSCRIPT
chmod +x "$DEPLOY_DIR/deploy.sh"

# Create tarball
echo -e "${YELLOW}📦 Creating deployment archive...${NC}"
tar -czf "${DEPLOY_DIR}.tar.gz" "$DEPLOY_DIR"
rm -rf "$DEPLOY_DIR"

echo -e "${GREEN}✅ Deployment package created: ${DEPLOY_DIR}.tar.gz${NC}"

# Display deployment checklist
echo ""
echo -e "${YELLOW}📋 Pre-deployment Checklist:${NC}"
echo "  [ ] Database migrations run"
echo "  [ ] SSL certificates installed"
echo "  [ ] Domain configured"
echo "  [ ] CDN configured (if using)"
echo "  [ ] Monitoring set up (Sentry, etc.)"
echo "  [ ] Backups configured"
echo "  [ ] Environment variables set on server"
echo "  [ ] Process manager configured (PM2, etc.)"
echo "  [ ] Log rotation configured"
echo "  [ ] Firewall rules configured"
echo ""

echo -e "${GREEN}✅ Deployment package ready!${NC}"
echo "📦 Package: ${DEPLOY_DIR}.tar.gz"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Upload ${DEPLOY_DIR}.tar.gz to your server"
echo "  2. Extract: tar -xzf ${DEPLOY_DIR}.tar.gz"
echo "  3. Run: cd ${DEPLOY_DIR} && bash deploy.sh"
echo "  4. Monitor: pm2 logs click-api"
echo "  5. Health check: curl http://localhost:5001/api/health"


