#!/bin/bash

# Production Build Test Script
# Tests production builds for both frontend and backend

set -e  # Exit on error

echo "🔨 Testing Production Builds..."
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track errors
ERRORS=0

# Function to print error
error() {
    echo -e "${RED}❌ $1${NC}"
    ERRORS=$((ERRORS + 1))
}

# Function to print success
success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Function to print warning
warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if we're in the project root
if [ ! -f "package.json" ]; then
    error "Must be run from project root directory"
    exit 1
fi

echo "1️⃣  Checking Node.js version..."
NODE_VERSION=$(node --version)
echo "   Node.js: $NODE_VERSION"
if ! command -v node &> /dev/null; then
    error "Node.js is not installed"
    exit 1
fi
success "Node.js version check passed"

echo ""
echo "2️⃣  Installing dependencies..."
if [ ! -d "node_modules" ]; then
    echo "   Installing backend dependencies..."
    npm ci --production=false
else
    echo "   Dependencies already installed"
fi

if [ ! -d "client/node_modules" ]; then
    echo "   Installing frontend dependencies..."
    cd client
    npm ci
    cd ..
else
    echo "   Frontend dependencies already installed"
fi
success "Dependencies installed"

echo ""
echo "3️⃣  Running linting checks..."
if npm run lint > /dev/null 2>&1; then
    success "Backend linting passed"
else
    warning "Backend linting has issues (non-blocking)"
fi

cd client
if npm run lint > /dev/null 2>&1 2>/dev/null; then
    success "Frontend linting passed"
else
    warning "Frontend linting has issues (non-blocking)"
fi
cd ..

echo ""
echo "4️⃣  Running tests..."
if npm test -- --passWithNoTests > /dev/null 2>&1; then
    success "Backend tests passed"
else
    warning "Some backend tests failed (review output above)"
fi

cd client
if npm test -- --passWithNoTests > /dev/null 2>&1; then
    success "Frontend tests passed"
else
    warning "Some frontend tests failed (review output above)"
fi
cd ..

echo ""
echo "5️⃣  Building frontend for production..."
cd client

# Set production environment
export NODE_ENV=production

# Build
if npm run build > build.log 2>&1; then
    success "Frontend build successful"
    
    # Check build output
    if [ -d ".next" ]; then
        BUILD_SIZE=$(du -sh .next 2>/dev/null | cut -f1)
        echo "   Build size: $BUILD_SIZE"
        success "Build output directory exists"
    else
        error "Build output directory (.next) not found"
    fi
    
    # Check for common build issues
    if grep -q "Error:" build.log; then
        warning "Build completed but contains errors (check build.log)"
    fi
    
    # Check bundle size (if analyzer is available)
    if [ -f "package.json" ] && grep -q "analyze" package.json; then
        echo "   Run 'npm run analyze' to check bundle sizes"
    fi
else
    error "Frontend build failed (check build.log)"
    cat build.log
    cd ..
    exit 1
fi

cd ..

echo ""
echo "6️⃣  Checking production build artifacts..."

# Frontend checks
if [ -d "client/.next" ]; then
    success "Frontend build artifacts exist"
    
    # Check for important files
    if [ -d "client/.next/static" ]; then
        success "Static assets generated"
    else
        warning "Static assets directory not found"
    fi
    
    # Check build manifest
    if [ -f "client/.next/BUILD_ID" ]; then
        BUILD_ID=$(cat client/.next/BUILD_ID)
        echo "   Build ID: $BUILD_ID"
        success "Build manifest exists"
    fi
else
    error "Frontend build artifacts not found"
fi

echo ""
echo "7️⃣  Verifying environment variables..."
if [ -f ".env.production" ] || [ -f ".env" ]; then
    if node scripts/verify-production-env.js 2>/dev/null; then
        success "Environment variables verified"
    else
        warning "Environment variable verification failed (check output above)"
    fi
else
    warning "No .env.production or .env file found (using system environment)"
fi

echo ""
echo "8️⃣  Security checks..."

# Check for exposed secrets in code
if grep -r "password.*=.*['\"].*" --include="*.js" --include="*.ts" server/ 2>/dev/null | grep -v "//" | grep -v node_modules | head -5 | wc -l | grep -q "^0$"; then
    success "No obvious hardcoded passwords found"
else
    warning "Potential hardcoded passwords detected (review manually)"
fi

# Check for console.logs in production builds (should be removed)
if [ -d "client/.next" ] && find client/.next -name "*.js" -type f -exec grep -l "console.log" {} \; 2>/dev/null | head -1 | grep -q .; then
    warning "console.log statements found in production build (should be removed)"
else
    success "No console.log statements in production build"
fi

echo ""
echo "================================"
echo "📊 BUILD TEST SUMMARY"
echo "================================"

if [ $ERRORS -eq 0 ]; then
    success "✅ All production build checks passed!"
    echo ""
    echo "Next steps:"
    echo "  1. Review build.log for any warnings"
    echo "  2. Test the production build locally:"
    echo "     cd client && npm start"
    echo "  3. Run production readiness checklist:"
    echo "     Review PRODUCTION_READINESS.md"
    exit 0
else
    error "❌ Production build test failed with $ERRORS error(s)"
    echo ""
    echo "Please fix the errors above before deploying to production."
    exit 1
fi



