#!/bin/bash

# Production Readiness Verification Script
# Checks if the application is ready for production deployment

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Production Readiness Check${NC}"
echo "=================================="
echo ""

# Track issues
ISSUES=0
WARNINGS=0

# Check 1: Production environment template
echo -e "${BLUE}1. Checking production environment template...${NC}"
if [ -f "env.production.template" ]; then
    echo -e "${GREEN}   ✅ Production template exists${NC}"
else
    echo -e "${RED}   ❌ Production template missing${NC}"
    ((ISSUES++))
fi

# Check 2: PM2 configuration
echo -e "${BLUE}2. Checking PM2 configuration...${NC}"
if [ -f "ecosystem.config.js" ]; then
    echo -e "${GREEN}   ✅ PM2 config exists${NC}"
else
    echo -e "${YELLOW}   ⚠️  PM2 config missing (optional for managed platforms)${NC}"
    ((WARNINGS++))
fi

# Check 3: Deployment scripts
echo -e "${BLUE}3. Checking deployment scripts...${NC}"
SCRIPTS=(
    "scripts/prepare-production-deployment.sh"
    "scripts/deploy-production.sh"
    "scripts/verify-deployment.sh"
)

for script in "${SCRIPTS[@]}"; do
    if [ -f "$script" ]; then
        echo -e "${GREEN}   ✅ $(basename $script) exists${NC}"
    else
        echo -e "${YELLOW}   ⚠️  $(basename $script) missing${NC}"
        ((WARNINGS++))
    fi
done

# Check 4: Package.json scripts
echo -e "${BLUE}4. Checking package.json scripts...${NC}"
if grep -q "prepare:production" package.json; then
    echo -e "${GREEN}   ✅ prepare:production script exists${NC}"
else
    echo -e "${YELLOW}   ⚠️  prepare:production script missing${NC}"
    ((WARNINGS++))
fi

# Check 5: OAuth status
echo -e "${BLUE}5. Checking OAuth configuration...${NC}"
if [ -f ".env" ]; then
    YOUTUBE_CONFIGURED=false
    if grep -q "YOUTUBE_CLIENT_ID=" .env && ! grep -q "YOUTUBE_CLIENT_ID=your-" .env; then
        YOUTUBE_CONFIGURED=true
    fi
    
    if [ "$YOUTUBE_CONFIGURED" = true ]; then
        echo -e "${GREEN}   ✅ YouTube OAuth configured${NC}"
    else
        echo -e "${YELLOW}   ⚠️  YouTube OAuth not configured${NC}"
        ((WARNINGS++))
    fi
else
    echo -e "${YELLOW}   ⚠️  .env file not found${NC}"
    ((WARNINGS++))
fi

# Check 6: Database models
echo -e "${BLUE}6. Checking database models...${NC}"
if [ -d "server/models" ] && [ "$(ls -A server/models/*.js 2>/dev/null | wc -l)" -gt 0 ]; then
    echo -e "${GREEN}   ✅ Database models exist${NC}"
else
    echo -e "${RED}   ❌ Database models missing${NC}"
    ((ISSUES++))
fi

# Check 7: Server entry point
echo -e "${BLUE}7. Checking server entry point...${NC}"
if [ -f "server/index.js" ]; then
    echo -e "${GREEN}   ✅ Server entry point exists${NC}"
else
    echo -e "${RED}   ❌ Server entry point missing${NC}"
    ((ISSUES++))
fi

# Check 8: Client build
echo -e "${BLUE}8. Checking client build configuration...${NC}"
if [ -f "client/package.json" ]; then
    if grep -q "\"build\"" client/package.json; then
        echo -e "${GREEN}   ✅ Client build script exists${NC}"
    else
        echo -e "${YELLOW}   ⚠️  Client build script missing${NC}"
        ((WARNINGS++))
    fi
else
    echo -e "${YELLOW}   ⚠️  Client directory not found${NC}"
    ((WARNINGS++))
fi

# Check 9: Health endpoint
echo -e "${BLUE}9. Checking health endpoint...${NC}"
if grep -r "health" server/routes/ 2>/dev/null | grep -q "router"; then
    echo -e "${GREEN}   ✅ Health endpoint exists${NC}"
else
    echo -e "${YELLOW}   ⚠️  Health endpoint not found${NC}"
    ((WARNINGS++))
fi

# Check 10: Environment validation
echo -e "${BLUE}10. Checking environment validation...${NC}"
if [ -f "scripts/validate-production-env.js" ] || [ -f "scripts/validate-env.js" ]; then
    echo -e "${GREEN}   ✅ Environment validation script exists${NC}"
else
    echo -e "${YELLOW}   ⚠️  Environment validation script missing${NC}"
    ((WARNINGS++))
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}📊 Summary${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $ISSUES -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Ready for production deployment.${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Choose deployment platform (Render/Railway/VPS)"
    echo "2. Set up MongoDB Atlas"
    echo "3. Configure environment variables"
    echo "4. Deploy application"
    echo ""
    echo "See PRODUCTION_DEPLOYMENT_ACTION_PLAN.md for detailed steps."
    exit 0
elif [ $ISSUES -eq 0 ]; then
    echo -e "${YELLOW}⚠️  $WARNINGS warning(s) found, but no critical issues.${NC}"
    echo -e "${GREEN}✅ Ready for production deployment with minor improvements.${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Review warnings above"
    echo "2. Choose deployment platform"
    echo "3. Follow PRODUCTION_DEPLOYMENT_ACTION_PLAN.md"
    exit 0
else
    echo -e "${RED}❌ $ISSUES critical issue(s) found.${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠️  $WARNINGS warning(s) also found.${NC}"
    fi
    echo ""
    echo "Please fix the issues above before deploying to production."
    exit 1
fi

