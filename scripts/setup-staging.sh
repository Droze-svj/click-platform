#!/bin/bash

# Staging Environment Setup Script
# This script sets up a staging environment for Click

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🎭 Setting up staging environment...${NC}"

# Check if .env.staging exists
if [ ! -f .env.staging ]; then
    echo -e "${YELLOW}⚠️  .env.staging file not found!${NC}"
    echo "Creating from template..."
    
    if [ -f env.staging.template ]; then
        cp env.staging.template .env.staging
        echo -e "${GREEN}✅ Created .env.staging from template${NC}"
        echo -e "${YELLOW}⚠️  Please edit .env.staging with your staging values${NC}"
    else
        echo -e "${RED}❌ env.staging.template not found!${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Environment file found${NC}"

# Validate environment variables
echo "🔍 Validating staging environment variables..."
node scripts/validate-env.js staging

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Environment validation failed!${NC}"
    echo "Continuing anyway for staging..."
fi

# Check Node.js version
echo "📦 Checking Node.js version..."
NODE_VERSION=$(node -v)
echo "Node.js version: $NODE_VERSION"

# Check if MongoDB is running (local)
echo "🗄️  Checking MongoDB connection..."
if command -v mongosh &> /dev/null; then
    mongosh --eval "db.adminCommand('ping')" --quiet > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ MongoDB is running${NC}"
    else
        echo -e "${YELLOW}⚠️  MongoDB is not running locally${NC}"
        echo "Make sure MongoDB is running or use MongoDB Atlas"
    fi
else
    echo -e "${YELLOW}⚠️  mongosh not found. Skipping MongoDB check.${NC}"
fi

# Check if Redis is running (optional)
echo "🔴 Checking Redis connection..."
if command -v redis-cli &> /dev/null; then
    redis-cli ping > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Redis is running${NC}"
    else
        echo -e "${YELLOW}⚠️  Redis is not running locally${NC}"
        echo "Redis is optional but recommended for caching"
    fi
else
    echo -e "${YELLOW}⚠️  redis-cli not found. Skipping Redis check.${NC}"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ npm install failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Dependencies installed${NC}"

# Install client dependencies
echo "📦 Installing client dependencies..."
cd client
npm ci
cd ..

echo -e "${GREEN}✅ Client dependencies installed${NC}"

# Create staging directories
echo "📁 Creating staging directories..."
mkdir -p logs/staging
mkdir -p uploads/staging
mkdir -p dist/staging

echo -e "${GREEN}✅ Staging directories created${NC}"

# Build frontend for staging
echo "🏗️  Building frontend for staging..."
cd client
npm run build
cd ..

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Frontend build failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Frontend built successfully${NC}"

# Create staging PM2 ecosystem config
echo "⚙️  Creating staging PM2 config..."
cat > ecosystem.staging.config.js << 'EOF'
// PM2 Ecosystem Configuration for Staging

module.exports = {
  apps: [
    {
      name: 'click-api-staging',
      script: './server/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'staging',
        PORT: 5002,
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 5002,
      },
      // Logging
      error_file: './logs/staging/pm2-error.log',
      out_file: './logs/staging/pm2-out.log',
      log_file: './logs/staging/pm2-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Auto restart
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      
      // Advanced PM2 features
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
    },
  ],
};
EOF

echo -e "${GREEN}✅ Staging PM2 config created${NC}"

# Display staging setup checklist
echo ""
echo -e "${YELLOW}📋 Staging Setup Checklist:${NC}"
echo "  [ ] .env.staging configured with staging values"
echo "  [ ] MongoDB staging database created"
echo "  [ ] Redis configured (optional)"
echo "  [ ] Staging domain configured (staging.your-domain.com)"
echo "  [ ] SSL certificate for staging domain"
echo "  [ ] OAuth apps configured for staging URLs"
echo "  [ ] AWS S3 staging bucket created (if using)"
echo "  [ ] Sentry staging project configured"
echo ""

echo -e "${GREEN}✅ Staging environment setup complete!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Edit .env.staging with your staging values"
echo "  2. Start staging: npm run start:staging"
echo "  3. Or use PM2: pm2 start ecosystem.staging.config.js --env staging"
echo "  4. Health check: curl http://localhost:5002/api/health"
echo ""


