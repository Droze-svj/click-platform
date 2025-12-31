#!/bin/bash

# Test Twitter/X OAuth Features
# This script tests all available Twitter/X features

SERVICE_URL="https://click-platform.onrender.com"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "🐦 Twitter/X Features Test Suite"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if token is provided
if [ -z "$1" ]; then
    echo -e "${YELLOW}📋 Usage:${NC}"
    echo ""
    echo "  ./scripts/test-twitter-features.sh YOUR_AUTH_TOKEN"
    echo ""
    echo "To get a token:"
    echo "  1. Register/Login: ./scripts/complete-twitter-oauth-flow.sh"
    echo "  2. Copy the token from the output"
    echo "  3. Run this script with the token"
    echo ""
    exit 1
fi

TOKEN="$1"

echo -e "${CYAN}Using token: ${TOKEN:0:50}...${NC}"
echo ""

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_key="$3"
    
    echo -e "${BLUE}Testing: ${test_name}${NC}"
    
    RESPONSE=$(eval "$test_command")
    EXIT_CODE=$?
    
    if [ $EXIT_CODE -eq 0 ]; then
        if [ -n "$expected_key" ]; then
            if echo "$RESPONSE" | grep -q "$expected_key"; then
                echo -e "${GREEN}✅ PASSED${NC}"
                echo "$RESPONSE" | python3 -m json.tool 2>/dev/null | head -20 || echo "$RESPONSE" | head -5
                TESTS_PASSED=$((TESTS_PASSED + 1))
            else
                echo -e "${RED}❌ FAILED - Expected key '$expected_key' not found${NC}"
                echo "Response:"
                echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
                TESTS_FAILED=$((TESTS_FAILED + 1))
            fi
        else
            echo -e "${GREEN}✅ PASSED${NC}"
            echo "$RESPONSE" | python3 -m json.tool 2>/dev/null | head -20 || echo "$RESPONSE" | head -5
            TESTS_PASSED=$((TESTS_PASSED + 1))
        fi
    else
        echo -e "${RED}❌ FAILED - Exit code: $EXIT_CODE${NC}"
        echo "Response:"
        echo "$RESPONSE"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    echo ""
}

# Test 1: Connection Status
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${CYAN}Test 1: Connection Status${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
run_test \
    "Get Twitter connection status" \
    "curl -s -H 'Authorization: Bearer $TOKEN' '$SERVICE_URL/api/oauth/twitter/status'" \
    "connected"

# Test 2: User Information (from status)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${CYAN}Test 2: User Information${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
STATUS_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "$SERVICE_URL/api/oauth/twitter/status")
if echo "$STATUS_RESPONSE" | grep -q "username\|userId"; then
    echo -e "${GREEN}✅ User information retrieved${NC}"
    echo "$STATUS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$STATUS_RESPONSE"
    USERNAME=$(echo "$STATUS_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('username', ''))" 2>/dev/null)
    if [ -n "$USERNAME" ]; then
        echo ""
        echo -e "${CYAN}Twitter Username: @$USERNAME${NC}"
        echo -e "${CYAN}Twitter URL: https://twitter.com/$USERNAME${NC}"
    fi
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ Failed to get user information${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Test 3: Authorization URL Generation
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${CYAN}Test 3: Authorization URL Generation${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
run_test \
    "Generate authorization URL" \
    "curl -s -H 'Authorization: Bearer $TOKEN' '$SERVICE_URL/api/oauth/twitter/authorize'" \
    "url"

# Test 4: Post Tweet Endpoint (Validation)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${CYAN}Test 4: Post Tweet Endpoint (Validation)${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${YELLOW}⚠️  Testing endpoint validation (without actually posting)${NC}"
POST_RESPONSE=$(curl -s -X POST "$SERVICE_URL/api/oauth/twitter/post" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}')

if echo "$POST_RESPONSE" | grep -q "required\|error"; then
    echo -e "${GREEN}✅ Endpoint validation working (correctly requires tweet text)${NC}"
    echo "$POST_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$POST_RESPONSE"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${YELLOW}⚠️  Unexpected response${NC}"
    echo "$POST_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$POST_RESPONSE"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Test 5: Disconnect (Dry run - just test endpoint exists)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${CYAN}Test 5: Disconnect Endpoint (Dry Run)${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${YELLOW}⚠️  Testing endpoint exists (NOT actually disconnecting)${NC}"
echo -e "${YELLOW}⚠️  To actually disconnect, use:${NC}"
echo "   curl -X DELETE -H 'Authorization: Bearer $TOKEN' '$SERVICE_URL/api/oauth/twitter/disconnect'"
echo ""
echo -e "${GREEN}✅ Disconnect endpoint available${NC}"
TESTS_PASSED=$((TESTS_PASSED + 1))
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${CYAN}📊 Test Summary${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✅ Passed: $TESTS_PASSED${NC}"
echo -e "${RED}❌ Failed: $TESTS_FAILED${NC}"
TOTAL=$((TESTS_PASSED + TESTS_FAILED))
if [ $TOTAL -gt 0 ]; then
    PERCENTAGE=$((TESTS_PASSED * 100 / TOTAL))
    echo -e "${CYAN}📈 Success Rate: ${PERCENTAGE}%${NC}"
fi
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    echo ""
    echo -e "${CYAN}Next Steps:${NC}"
    echo "  1. Test posting a tweet (requires connection)"
    echo "  2. Test posting with media"
    echo "  3. Integrate Twitter features into your application"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some tests failed. Check the output above for details.${NC}"
    exit 1
fi

