#!/bin/bash

# Run E2E Tests Script
# Verifies E2E tests can run and reports results

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🧪 Running E2E Tests Verification...${NC}"
echo ""

# Check if Playwright is installed
if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ npx not found. Please install Node.js${NC}"
    exit 1
fi

# Check if Playwright browsers are installed
echo -e "${BLUE}1. Checking Playwright installation...${NC}"
if npx playwright --version > /dev/null 2>&1; then
    PLAYWRIGHT_VERSION=$(npx playwright --version)
    echo -e "${GREEN}✅ Playwright installed: $PLAYWRIGHT_VERSION${NC}"
else
    echo -e "${YELLOW}⚠️  Playwright not found. Installing...${NC}"
    npx playwright install --with-deps chromium
fi

# Check if browsers are installed
echo -e "${BLUE}2. Checking browser installation...${NC}"
if npx playwright install --dry-run chromium 2>&1 | grep -q "chromium"; then
    echo -e "${YELLOW}⚠️  Browsers not installed. Installing chromium...${NC}"
    npx playwright install chromium
else
    echo -e "${GREEN}✅ Browsers installed${NC}"
fi

echo ""

# Check server status
echo -e "${BLUE}3. Checking server status...${NC}"
SERVER_RUNNING=false
FRONTEND_RUNNING=false

if curl -s http://localhost:5001/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend server running on port 5001${NC}"
    SERVER_RUNNING=true
else
    echo -e "${YELLOW}⚠️  Backend server not running on port 5001${NC}"
    echo "   E2E tests may fail without server"
fi

if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend server running on port 3000${NC}"
    FRONTEND_RUNNING=true
else
    echo -e "${YELLOW}⚠️  Frontend server not running on port 3000${NC}"
    echo "   E2E tests may fail without frontend"
fi

echo ""

# List available E2E tests
echo -e "${BLUE}4. Available E2E Test Files:${NC}"
TEST_FILES=$(find tests/e2e -name "*.spec.js" -o -name "*.test.js" 2>/dev/null | sort)
if [ -z "$TEST_FILES" ]; then
    echo -e "${RED}❌ No E2E test files found${NC}"
    exit 1
else
    echo "$TEST_FILES" | while read -r test; do
        echo -e "  ${GREEN}✅${NC} $test"
    done
    TEST_COUNT=$(echo "$TEST_FILES" | wc -l | tr -d ' ')
    echo -e "${GREEN}   Total: $TEST_COUNT test files${NC}"
fi

echo ""

# Run critical flows test
echo -e "${BLUE}5. Running Critical Flows Test...${NC}"
echo ""

if [ "$SERVER_RUNNING" = false ] || [ "$FRONTEND_RUNNING" = false ]; then
    echo -e "${YELLOW}⚠️  Server not running. Running tests in dry-run mode...${NC}"
    echo ""
    npx playwright test tests/e2e/critical-flows.spec.js --dry-run --reporter=list
    echo ""
    echo -e "${YELLOW}⚠️  To run full tests, start server: npm run dev${NC}"
else
    echo -e "${GREEN}Running full E2E tests...${NC}"
    echo ""
    
    # Run tests with JSON output
    npx playwright test tests/e2e/critical-flows.spec.js \
        --reporter=list,json \
        --output=test-results/e2e-results.json \
        2>&1 | tee /tmp/e2e-test-output.log
    
    TEST_EXIT_CODE=$?
    
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}📊 Test Results${NC}"
    echo -e "${BLUE}========================================${NC}"
    
    if [ $TEST_EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}✅ All E2E tests passed!${NC}"
    else
        echo -e "${RED}❌ Some E2E tests failed${NC}"
        echo ""
        echo -e "${YELLOW}Last 20 lines of output:${NC}"
        tail -20 /tmp/e2e-test-output.log
    fi
    
    # Check for results file
    if [ -f test-results/e2e-results.json ]; then
        echo ""
        echo -e "${GREEN}✅ Test results saved to: test-results/e2e-results.json${NC}"
        
        # Extract summary
        if command -v jq &> /dev/null; then
            echo ""
            echo -e "${BLUE}Test Summary:${NC}"
            jq -r '.stats | "Total: \(.total) | Passed: \(.passed) | Failed: \(.failed) | Skipped: \(.skipped)"' test-results/e2e-results.json 2>/dev/null || echo "Could not parse results"
        fi
    fi
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}📋 Next Steps${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "To view test report:"
echo "  npx playwright show-report"
echo ""
echo "To run specific test:"
echo "  npx playwright test tests/e2e/critical-flows.spec.js"
echo ""
echo "To run all E2E tests:"
echo "  npm run test:e2e"
echo ""

exit $TEST_EXIT_CODE


