#!/bin/bash

# Automated Deployment Verification Script
# This script will verify your Render.com deployment

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Automated Deployment Verification${NC}"
echo ""

# Try to detect service URL from common sources
SERVICE_URL=""

# Check if URL is provided as argument
if [ ! -z "$1" ]; then
    SERVICE_URL="$1"
    echo -e "${GREEN}✅ Using provided URL: $SERVICE_URL${NC}"
elif [ ! -z "$RENDER_SERVICE_URL" ]; then
    SERVICE_URL="$RENDER_SERVICE_URL"
    echo -e "${GREEN}✅ Using RENDER_SERVICE_URL: $SERVICE_URL${NC}"
else
    # Prompt for URL
    echo -e "${YELLOW}📝 Please provide your Render.com service URL${NC}"
    echo "   Example: https://click-platform.onrender.com"
    echo ""
    read -p "Enter your service URL: " SERVICE_URL
    
    if [ -z "$SERVICE_URL" ]; then
        echo -e "${RED}❌ No URL provided. Exiting.${NC}"
        exit 1
    fi
fi

# Remove trailing slash
SERVICE_URL="${SERVICE_URL%/}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}🚀 Verifying: $SERVICE_URL${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected="$3"
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    echo -e "${BLUE}Testing: $test_name${NC}"
    
    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS: $test_name${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL: $test_name${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Test 1: Health Endpoint
echo "1️⃣ Health Check Endpoint"
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$SERVICE_URL/api/health" 2>/dev/null || echo -e "\n000")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
BODY=$(echo "$HEALTH_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "503" ]; then
    echo -e "${GREEN}✅ Health endpoint is accessible (HTTP $HTTP_CODE)${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    
    # Try to parse JSON
    if command -v jq &> /dev/null; then
        STATUS=$(echo "$BODY" | jq -r '.status' 2>/dev/null || echo "unknown")
        echo "   Status: $STATUS"
        
        if [ "$STATUS" = "ok" ]; then
            echo -e "${GREEN}   ✅ Service is healthy${NC}"
        elif [ "$STATUS" = "degraded" ]; then
            echo -e "${YELLOW}   ⚠️ Service is degraded (some features may not work)${NC}"
        else
            echo -e "${YELLOW}   ⚠️ Status: $STATUS${NC}"
        fi
    fi
else
    echo -e "${RED}❌ Health endpoint failed (HTTP $HTTP_CODE)${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))
echo ""

# Test 2: Redis Debug
echo "2️⃣ Redis Connection Check"
REDIS_RESPONSE=$(curl -s "$SERVICE_URL/api/health/debug-redis" 2>/dev/null || echo "ERROR")

if [[ "$REDIS_RESPONSE" == *"redisUrl"* ]]; then
    echo -e "${GREEN}✅ Redis debug endpoint is accessible${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    
    if command -v jq &> /dev/null; then
        REDIS_EXISTS=$(echo "$REDIS_RESPONSE" | jq -r '.redisUrl.exists' 2>/dev/null || echo "unknown")
        REDIS_VALID=$(echo "$REDIS_RESPONSE" | jq -r '.redisUrl.isValid' 2>/dev/null || echo "unknown")
        CONTAINS_LOCALHOST=$(echo "$REDIS_RESPONSE" | jq -r '.redisUrl.containsLocalhost' 2>/dev/null || echo "unknown")
        
        echo "   Redis URL exists: $REDIS_EXISTS"
        echo "   Redis URL valid: $REDIS_VALID"
        echo "   Contains localhost: $CONTAINS_LOCALHOST"
        
        if [ "$REDIS_VALID" = "true" ] && [ "$CONTAINS_LOCALHOST" = "false" ]; then
            echo -e "${GREEN}   ✅ Redis is properly configured${NC}"
        elif [ "$CONTAINS_LOCALHOST" = "true" ]; then
            echo -e "${RED}   ❌ Redis is connecting to localhost (should use Redis Cloud)${NC}"
        else
            echo -e "${YELLOW}   ⚠️ Redis configuration needs attention${NC}"
        fi
    fi
else
    echo -e "${RED}❌ Redis debug endpoint failed${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))
echo ""

# Test 3: Response Time
echo "3️⃣ Response Time Test"
START_TIME=$(date +%s.%N)
curl -s -o /dev/null "$SERVICE_URL/api/health" > /dev/null 2>&1
END_TIME=$(date +%s.%N)
RESPONSE_TIME=$(echo "$END_TIME - $START_TIME" | bc 2>/dev/null || echo "0")

if (( $(echo "$RESPONSE_TIME > 0" | bc -l 2>/dev/null || echo 0) )); then
    echo -e "${GREEN}✅ Server is responding${NC}"
    printf "   Response time: %.2fs\n" "$RESPONSE_TIME"
    
    if (( $(echo "$RESPONSE_TIME < 2.0" | bc -l 2>/dev/null || echo 0) )); then
        echo -e "${GREEN}   ✅ Response time is good${NC}"
    elif (( $(echo "$RESPONSE_TIME < 5.0" | bc -l 2>/dev/null || echo 0) )); then
        echo -e "${YELLOW}   ⚠️ Response time is acceptable (may be cold start)${NC}"
    else
        echo -e "${YELLOW}   ⚠️ Response time is slow (may be cold start on free tier)${NC}"
    fi
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ Server is not responding${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))
echo ""

# Test 4: API Documentation
echo "4️⃣ API Documentation Check"
DOCS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$SERVICE_URL/api-docs" 2>/dev/null || echo "000")

if [ "$DOCS_CODE" = "200" ]; then
    echo -e "${GREEN}✅ API documentation is available${NC}"
    echo "   URL: $SERVICE_URL/api-docs"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${YELLOW}⚠️ API documentation not available (may be disabled)${NC}"
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))
echo ""

# Test 5: HTTPS
echo "5️⃣ HTTPS/SSL Check"
if [[ "$SERVICE_URL" == https://* ]]; then
    echo -e "${GREEN}✅ Using HTTPS${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${YELLOW}⚠️ Not using HTTPS${NC}"
fi
TESTS_TOTAL=$((TESTS_TOTAL + 1))
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}📊 Verification Summary${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Service URL: $SERVICE_URL"
echo "Tests Passed: $TESTS_PASSED / $TESTS_TOTAL"
echo "Tests Failed: $TESTS_FAILED / $TESTS_TOTAL"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed! Your deployment is working correctly.${NC}"
    exit 0
elif [ $TESTS_PASSED -gt 0 ]; then
    echo -e "${YELLOW}⚠️ Some tests failed. Check the details above.${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Check Render.com logs for errors"
    echo "2. Verify environment variables are set correctly"
    echo "3. Check Redis connection (should not be localhost)"
    echo "4. Review POST_DEPLOYMENT_NEXT_STEPS.md for detailed troubleshooting"
    exit 1
else
    echo -e "${RED}❌ All tests failed. Your service may not be deployed correctly.${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "1. Verify your service URL is correct"
    echo "2. Check Render.com dashboard - is the service running?"
    echo "3. Check Render.com logs for startup errors"
    echo "4. Verify the service is not sleeping (free tier spins down after inactivity)"
    exit 2
fi

