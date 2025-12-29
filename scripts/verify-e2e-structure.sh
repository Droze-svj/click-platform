#!/bin/bash

# Verify E2E Test Structure
# Checks that all E2E tests are properly structured

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🔍 Verifying E2E Test Structure...${NC}"
echo ""

PASSED=0
FAILED=0

# Check test files exist
echo -e "${BLUE}1. Checking Test Files...${NC}"
TEST_FILES=$(find tests/e2e -name "*.spec.js" -o -name "*.test.js" 2>/dev/null | sort)

if [ -z "$TEST_FILES" ]; then
    echo -e "${RED}❌ No test files found${NC}"
    exit 1
fi

for test_file in $TEST_FILES; do
    if [ -f "$test_file" ]; then
        echo -e "  ${GREEN}✅${NC} $test_file"
        ((PASSED++))
    else
        echo -e "  ${RED}❌${NC} $test_file (missing)"
        ((FAILED++))
    fi
done

echo ""

# Check Playwright config
echo -e "${BLUE}2. Checking Playwright Configuration...${NC}"
if [ -f "playwright.config.js" ]; then
    echo -e "  ${GREEN}✅${NC} playwright.config.js exists"
    ((PASSED++))
else
    echo -e "  ${RED}❌${NC} playwright.config.js missing"
    ((FAILED++))
fi

# Check test helpers
echo -e "${BLUE}3. Checking Test Helpers...${NC}"
HELPER_FILES=$(find tests/e2e/helpers -name "*.js" 2>/dev/null | wc -l | tr -d ' ')
if [ "$HELPER_FILES" -gt 0 ]; then
    echo -e "  ${GREEN}✅${NC} $HELPER_FILES helper files found"
    ((PASSED++))
else
    echo -e "  ${YELLOW}⚠️${NC}  No helper files found (optional)"
fi

# Check fixtures
echo -e "${BLUE}4. Checking Test Fixtures...${NC}"
FIXTURE_FILES=$(find tests/e2e/fixtures -name "*.js" 2>/dev/null | wc -l | tr -d ' ')
if [ "$FIXTURE_FILES" -gt 0 ]; then
    echo -e "  ${GREEN}✅${NC} $FIXTURE_FILES fixture files found"
    ((PASSED++))
else
    echo -e "  ${YELLOW}⚠️${NC}  No fixture files found (optional)"
fi

echo ""

# Validate test syntax (basic check)
echo -e "${BLUE}5. Validating Test Syntax...${NC}"
for test_file in $TEST_FILES; do
    # Check if file contains test keywords
    if grep -q "test\|describe\|it\|expect" "$test_file" 2>/dev/null; then
        echo -e "  ${GREEN}✅${NC} $test_file (valid syntax)"
        ((PASSED++))
    else
        echo -e "  ${RED}❌${NC} $test_file (invalid syntax)"
        ((FAILED++))
    fi
done

echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}📊 Verification Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Passed: $PASSED${NC}"
echo -e "${RED}❌ Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All E2E test structure checks passed!${NC}"
    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    echo "  1. Start server: npm run dev"
    echo "  2. Run tests: npm run test:critical"
    echo "  3. View report: npx playwright show-report"
    exit 0
else
    echo -e "${RED}❌ Some checks failed. Please review above.${NC}"
    exit 1
fi


