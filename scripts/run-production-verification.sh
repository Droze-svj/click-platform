#!/bin/bash

# Comprehensive Production Verification Script
# Runs all production verification checks in sequence

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}🔍 Production Verification Suite${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Track overall status
OVERALL_STATUS=0

# 1. Environment Variables Verification
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}1️⃣  Verifying Production Environment Variables...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if node scripts/verify-production-env.js; then
    echo -e "${GREEN}✅ Environment variables verification passed${NC}"
else
    echo -e "${RED}❌ Environment variables verification failed${NC}"
    OVERALL_STATUS=1
fi
echo ""

# 2. Security Verification
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}2️⃣  Running Security Verification...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if node scripts/verify-security.js; then
    echo -e "${GREEN}✅ Security verification passed${NC}"
else
    echo -e "${RED}❌ Security verification failed${NC}"
    OVERALL_STATUS=1
fi
echo ""

# 3. Production Build Test
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}3️⃣  Testing Production Build...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}⚠️  This may take several minutes...${NC}"
if bash scripts/test-production-build.sh; then
    echo -e "${GREEN}✅ Production build test passed${NC}"
else
    echo -e "${RED}❌ Production build test failed${NC}"
    OVERALL_STATUS=1
fi
echo ""

# Final Summary
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}📊 VERIFICATION SUMMARY${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

if [ $OVERALL_STATUS -eq 0 ]; then
    echo -e "${GREEN}✅ All production verification checks passed!${NC}"
    echo ""
    echo -e "${GREEN}Your application is ready for production deployment.${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Review PRODUCTION_READINESS.md for deployment checklist"
    echo "  2. Deploy to your hosting platform"
    echo "  3. Set up SSL/HTTPS certificates"
    echo "  4. Configure monitoring and alerts"
    echo "  5. Run post-deployment tests"
    exit 0
else
    echo -e "${RED}❌ Some verification checks failed${NC}"
    echo ""
    echo -e "${YELLOW}Please fix the errors above before deploying to production.${NC}"
    echo ""
    echo "Common issues:"
    echo "  - Missing or invalid environment variables (check .env.production)"
    echo "  - Security vulnerabilities (run 'npm audit fix')"
    echo "  - Build errors (check build logs)"
    exit 1
fi



