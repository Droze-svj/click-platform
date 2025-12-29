#!/bin/bash

# Start Server and Run Tests Script
# Starts the server, waits for it to be ready, then runs tests

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Starting Server and Running Tests...${NC}"
echo ""

# Check if server is already running
if curl -s http://localhost:5001/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Server is already running${NC}"
    SERVER_RUNNING=true
else
    echo -e "${YELLOW}📦 Starting server...${NC}"
    
    # Start server in background
    npm run dev:server > /tmp/click-server.log 2>&1 &
    SERVER_PID=$!
    
    echo -e "${BLUE}⏳ Waiting for server to start...${NC}"
    
    # Wait for server to be ready (max 60 seconds)
    MAX_WAIT=60
    WAITED=0
    SERVER_RUNNING=false
    
    while [ $WAITED -lt $MAX_WAIT ]; do
        if curl -s http://localhost:5001/api/health > /dev/null 2>&1; then
            SERVER_RUNNING=true
            break
        fi
        sleep 2
        WAITED=$((WAITED + 2))
        echo -n "."
    done
    
    echo ""
    
    if [ "$SERVER_RUNNING" = true ]; then
        echo -e "${GREEN}✅ Server is ready!${NC}"
    else
        echo -e "${RED}❌ Server failed to start within $MAX_WAIT seconds${NC}"
        echo -e "${YELLOW}📋 Server logs:${NC}"
        tail -30 /tmp/click-server.log
        kill $SERVER_PID 2>/dev/null || true
        exit 1
    fi
fi

echo ""

# Run OAuth Verification
echo -e "${BLUE}🔐 Running OAuth Verification...${NC}"
if [ -n "$TEST_TOKEN" ]; then
    node scripts/verify-oauth-comprehensive.js
    OAUTH_RESULT=$?
else
    echo -e "${YELLOW}⚠️  TEST_TOKEN not set. Skipping OAuth verification.${NC}"
    echo "   To test OAuth: export TEST_TOKEN='your-jwt-token'"
    OAUTH_RESULT=0
fi

echo ""

# Run E2E Tests (without webServer since we're running server manually)
echo -e "${BLUE}🧪 Running E2E Tests...${NC}"
E2E_BASE_URL=http://localhost:3000 E2E_API_URL=http://localhost:5001/api npx playwright test tests/e2e/critical-flows.spec.js --config=playwright.config.js
E2E_RESULT=$?

echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}📊 Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"

if [ $OAUTH_RESULT -eq 0 ]; then
    echo -e "${GREEN}✅ OAuth Verification: Passed${NC}"
else
    echo -e "${RED}❌ OAuth Verification: Failed${NC}"
fi

if [ $E2E_RESULT -eq 0 ]; then
    echo -e "${GREEN}✅ E2E Tests: Passed${NC}"
else
    echo -e "${RED}❌ E2E Tests: Failed${NC}"
fi

echo ""

# Cleanup
if [ -n "$SERVER_PID" ]; then
    echo -e "${YELLOW}🛑 Stopping server...${NC}"
    kill $SERVER_PID 2>/dev/null || true
fi

# Exit with error if any test failed
if [ $OAUTH_RESULT -ne 0 ] || [ $E2E_RESULT -ne 0 ]; then
    exit 1
fi

exit 0


