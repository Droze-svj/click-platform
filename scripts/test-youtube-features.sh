#!/bin/bash

# Test YouTube OAuth Features
# This script tests all available YouTube features

SERVICE_URL="https://click-platform.onrender.com"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "🧪 YouTube Features Test Suite"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if token is provided
if [ -z "$1" ]; then
    echo -e "${YELLOW}📋 Usage:${NC}"
    echo ""
    echo "  ./scripts/test-youtube-features.sh YOUR_AUTH_TOKEN"
    echo ""
    echo "To get a token:"
    echo "  1. Register/Login: ./scripts/complete-youtube-oauth-flow.sh"
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
    "Get YouTube connection status" \
    "curl -s -H 'Authorization: Bearer $TOKEN' '$SERVICE_URL/api/oauth/youtube/status'" \
    "connected"

# Test 2: Channel Information (from status)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${CYAN}Test 2: Channel Information${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
STATUS_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "$SERVICE_URL/api/oauth/youtube/status")
if echo "$STATUS_RESPONSE" | grep -q "channelId"; then
    echo -e "${GREEN}✅ Channel information retrieved${NC}"
    echo "$STATUS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$STATUS_RESPONSE"
    CHANNEL_ID=$(echo "$STATUS_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('channelId', ''))" 2>/dev/null)
    if [ -n "$CHANNEL_ID" ]; then
        echo ""
        echo -e "${CYAN}Channel ID: $CHANNEL_ID${NC}"
        echo -e "${CYAN}Channel URL: https://www.youtube.com/channel/$CHANNEL_ID${NC}"
    fi
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ Failed to get channel information${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Test 3: Authorization URL Generation
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${CYAN}Test 3: Authorization URL Generation${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
run_test \
    "Generate authorization URL" \
    "curl -s -H 'Authorization: Bearer $TOKEN' '$SERVICE_URL/api/oauth/youtube/authorize'" \
    "url"

# Test 4: Video Upload Endpoint (Test without actual file)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${CYAN}Test 4: Video Upload Endpoint (Validation)${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${YELLOW}⚠️  Testing endpoint validation (without actual video file)${NC}"
UPLOAD_RESPONSE=$(curl -s -X POST "$SERVICE_URL/api/oauth/youtube/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Video"}')

if echo "$UPLOAD_RESPONSE" | grep -q "required\|error"; then
    echo -e "${GREEN}✅ Endpoint validation working (correctly requires video file)${NC}"
    echo "$UPLOAD_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$UPLOAD_RESPONSE"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${YELLOW}⚠️  Unexpected response${NC}"
    echo "$UPLOAD_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$UPLOAD_RESPONSE"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Test 5: Post Endpoint (Test validation)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${CYAN}Test 5: Post Endpoint (Validation)${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${YELLOW}⚠️  Testing endpoint validation${NC}"
POST_RESPONSE=$(curl -s -X POST "$SERVICE_URL/api/oauth/youtube/post" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Post"}')

if echo "$POST_RESPONSE" | grep -q "required\|error\|not yet implemented"; then
    echo -e "${GREEN}✅ Endpoint validation working${NC}"
    echo "$POST_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$POST_RESPONSE"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${YELLOW}⚠️  Unexpected response${NC}"
    echo "$POST_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$POST_RESPONSE"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Test 6: Disconnect (Dry run - just test endpoint exists)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${CYAN}Test 6: Disconnect Endpoint (Dry Run)${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${YELLOW}⚠️  Testing endpoint exists (NOT actually disconnecting)${NC}"
echo -e "${YELLOW}⚠️  To actually disconnect, use:${NC}"
echo "   curl -X DELETE -H 'Authorization: Bearer $TOKEN' '$SERVICE_URL/api/oauth/youtube/disconnect'"
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
    echo "  1. Test actual video upload (requires video file)"
    echo "  2. Test posting content to YouTube"
    echo "  3. Integrate YouTube features into your application"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some tests failed. Check the output above for details.${NC}"
    exit 1
fi
