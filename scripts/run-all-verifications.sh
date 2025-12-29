#!/bin/bash

# Run All Verifications Script
# Tests OAuth integrations, E2E tests, and production preparation

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 Running All Verifications...${NC}"
echo ""

# Track results
PASSED=0
FAILED=0
WARNINGS=0

# Function to log results
log_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
        ((PASSED++))
    else
        echo -e "${RED}❌ $2${NC}"
        ((FAILED++))
    fi
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    ((WARNINGS++))
}

# 1. Check if server is running
echo -e "${BLUE}1. Checking Server Status...${NC}"
if curl -s http://localhost:5001/api/health > /dev/null 2>&1; then
    log_result 0 "Server is running on port 5001"
    SERVER_RUNNING=true
elif curl -s http://localhost:5002/api/health > /dev/null 2>&1; then
    log_result 0 "Server is running on port 5002 (staging)"
    SERVER_RUNNING=true
    export API_URL="http://localhost:5002/api"
else
    log_warning "Server is not running. Some tests will be skipped."
    SERVER_RUNNING=false
fi
echo ""

# 2. Check environment files
echo -e "${BLUE}2. Checking Environment Files...${NC}"
if [ -f .env ]; then
    log_result 0 ".env file exists"
else
    log_result 1 ".env file missing"
fi

if [ -f .env.staging ]; then
    log_result 0 ".env.staging file exists"
else
    log_warning ".env.staging file missing (run: npm run setup:staging)"
fi

if [ -f .env.production ]; then
    log_result 0 ".env.production file exists"
else
    log_warning ".env.production file missing (will be created)"
fi
echo ""

# 3. Check OAuth configuration files
echo -e "${BLUE}3. Checking OAuth Service Files...${NC}"
OAUTH_SERVICES=(
    "server/services/twitterOAuthService.js"
    "server/services/linkedinOAuthService.js"
    "server/services/facebookOAuthService.js"
    "server/services/instagramOAuthService.js"
    "server/services/youtubeOAuthService.js"
    "server/services/tiktokOAuthService.js"
)

for service in "${OAUTH_SERVICES[@]}"; do
    if [ -f "$service" ]; then
        log_result 0 "$(basename $service) exists"
    else
        log_result 1 "$(basename $service) missing"
    fi
done
echo ""

# 4. Check OAuth route files
echo -e "${BLUE}4. Checking OAuth Route Files...${NC}"
OAUTH_ROUTES=(
    "server/routes/oauth/twitter.js"
    "server/routes/oauth/linkedin.js"
    "server/routes/oauth/facebook.js"
    "server/routes/oauth/instagram.js"
    "server/routes/oauth/youtube.js"
    "server/routes/oauth/tiktok.js"
)

for route in "${OAUTH_ROUTES[@]}"; do
    if [ -f "$route" ]; then
        log_result 0 "$(basename $route) exists"
    else
        log_result 1 "$(basename $route) missing"
    fi
done
echo ""

# 5. Check E2E test files
echo -e "${BLUE}5. Checking E2E Test Files...${NC}"
E2E_TESTS=(
    "tests/e2e/critical-flows.spec.js"
    "tests/e2e/auth-flow.spec.js"
    "tests/e2e/oauth-flow.spec.js"
    "tests/e2e/content-creation-flow.spec.js"
    "tests/e2e/complete-user-journey.spec.js"
)

for test in "${E2E_TESTS[@]}"; do
    if [ -f "$test" ]; then
        log_result 0 "$(basename $test) exists"
    else
        log_result 1 "$(basename $test) missing"
    fi
done
echo ""

# 6. Check Playwright configuration
echo -e "${BLUE}6. Checking Test Configuration...${NC}"
if [ -f "playwright.config.js" ]; then
    log_result 0 "Playwright config exists"
else
    log_result 1 "Playwright config missing"
fi

if [ -f "package.json" ] && grep -q "@playwright/test" package.json; then
    log_result 0 "Playwright installed"
else
    log_result 1 "Playwright not installed"
fi
echo ""

# 7. Validate environment variables (if .env exists)
if [ -f .env ]; then
    echo -e "${BLUE}7. Validating Environment Variables...${NC}"
    node scripts/validate-env.js 2>&1 | tail -20
    echo ""
fi

# 8. Run OAuth verification (if server is running)
if [ "$SERVER_RUNNING" = true ]; then
    echo -e "${BLUE}8. Running OAuth Verification...${NC}"
    echo "   (Requires JWT token - set TEST_TOKEN env var)"
    if [ -n "$TEST_TOKEN" ]; then
        node scripts/verify-oauth-comprehensive.js 2>&1 | tail -30
    else
        log_warning "TEST_TOKEN not set. Skipping OAuth verification."
        echo "   To test OAuth: export TEST_TOKEN='your-jwt-token' && npm run verify:oauth"
    fi
    echo ""
else
    log_warning "Skipping OAuth verification (server not running)"
    echo ""
fi

# 9. Check deployment scripts
echo -e "${BLUE}9. Checking Deployment Scripts...${NC}"
DEPLOY_SCRIPTS=(
    "scripts/deploy-production.sh"
    "scripts/deploy-staging.sh"
    "scripts/prepare-production-deployment.sh"
    "scripts/setup-staging.sh"
    "scripts/verify-oauth.sh"
)

for script in "${DEPLOY_SCRIPTS[@]}"; do
    if [ -f "$script" ] && [ -x "$script" ]; then
        log_result 0 "$(basename $script) exists and is executable"
    elif [ -f "$script" ]; then
        log_warning "$(basename $script) exists but not executable"
        chmod +x "$script"
        log_result 0 "$(basename $script) made executable"
    else
        log_result 1 "$(basename $script) missing"
    fi
done
echo ""

# 10. Check configuration files
echo -e "${BLUE}10. Checking Configuration Files...${NC}"
CONFIG_FILES=(
    "ecosystem.config.js"
    "ecosystem.staging.config.js"
    "docker-compose.yml"
    "docker-compose.staging.yml"
    "nginx.conf"
)

for config in "${CONFIG_FILES[@]}"; do
    if [ -f "$config" ]; then
        log_result 0 "$config exists"
    else
        log_warning "$config missing (optional)"
    fi
done
echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}📊 Verification Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Passed: $PASSED${NC}"
echo -e "${RED}❌ Failed: $FAILED${NC}"
echo -e "${YELLOW}⚠️  Warnings: $WARNINGS${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All critical checks passed!${NC}"
    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    echo "  1. Start server: npm run dev"
    echo "  2. Run OAuth verification: npm run verify:oauth"
    echo "  3. Run E2E tests: npm run test:critical"
    echo "  4. Prepare production: npm run prepare:production"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some checks failed. Please review above.${NC}"
    exit 1
fi


