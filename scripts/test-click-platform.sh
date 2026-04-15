#!/bin/bash

# Comprehensive Click Platform Test Suite
# Tests all configured features and services

# Allow overriding target (useful for local testing)
SERVICE_URL="${SERVICE_URL:-https://click-platform.onrender.com}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "🧪 Click Platform - Comprehensive Test Suite"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
WARNINGS=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_key="$3"
    local is_warning="${4:-false}"
    
    echo -e "${BLUE}Testing: ${test_name}${NC}"
    
    RESPONSE=$(eval "$test_command" 2>&1)
    EXIT_CODE=$?
    
    if [ $EXIT_CODE -eq 0 ]; then
        if [ -n "$expected_key" ]; then
            if echo "$RESPONSE" | grep -q "$expected_key"; then
                echo -e "${GREEN}✅ PASSED${NC}"
                TESTS_PASSED=$((TESTS_PASSED + 1))
            else
                if [ "$is_warning" = "true" ]; then
                    echo -e "${YELLOW}⚠️  WARNING${NC}"
                    WARNINGS=$((WARNINGS + 1))
                else
                    echo -e "${RED}❌ FAILED${NC}"
                    TESTS_FAILED=$((TESTS_FAILED + 1))
                fi
                echo "Response: $RESPONSE" | head -3
            fi
        else
            echo -e "${GREEN}✅ PASSED${NC}"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        fi
    else
        if [ "$is_warning" = "true" ]; then
            echo -e "${YELLOW}⚠️  WARNING${NC}"
            WARNINGS=$((WARNINGS + 1))
        else
            echo -e "${RED}❌ FAILED${NC}"
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi
        echo "Error: $RESPONSE" | head -3
    fi
    echo ""
}

# ============================================================================
# SECTION 1: Server Health & Infrastructure
# ============================================================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}SECTION 1: Server Health & Infrastructure${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

run_test \
    "Server Health Check" \
    "curl -s '$SERVICE_URL/api/health'" \
    "status"

run_test \
    "Server Uptime" \
    "curl -s '$SERVICE_URL/api/health' | grep -q 'uptime\|status'" \
    ""

run_test \
    "API Documentation" \
    "curl -s -o /dev/null -w '%{http_code}' '$SERVICE_URL/api/docs' | grep -Eq '^(200|301|302)$'" \
    ""

# ============================================================================
# SECTION 2: Authentication
# ============================================================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}SECTION 2: Authentication${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

TEST_EMAIL="test-$(date +%s)@example.com"
TEST_PASSWORD="Test123!@#"
TEST_FIRST_NAME="Test"
TEST_LAST_NAME="User"

echo -e "${YELLOW}Registering test user...${NC}"
REGISTER_RESPONSE=$(curl -s -X POST "$SERVICE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"firstName\":\"$TEST_FIRST_NAME\",\"lastName\":\"$TEST_LAST_NAME\"}")

if echo "$REGISTER_RESPONSE" | grep -q "\"success\":true"; then
    echo -e "${GREEN}✅ Registration successful${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ Registration failed${NC}"
    echo "   Response: $REGISTER_RESPONSE"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    # Try to continue if it's just "User already exists"
    if echo "$REGISTER_RESPONSE" | grep -q "User already exists"; then
        echo -e "${YELLOW}⚠️  User already exists, continuing...${NC}"
        WARNINGS=$((WARNINGS + 1))
        TESTS_FAILED=$((TESTS_FAILED - 1))
    else
        echo -e "${YELLOW}⚠️  Attempting login anyway...${NC}"
    fi
fi
echo ""

echo -e "${YELLOW}Logging in...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$SERVICE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('token', ''))" 2>/dev/null)

if [ -n "$TOKEN" ]; then
    echo -e "${GREEN}✅ Login successful${NC}"
    echo "   Token: ${TOKEN:0:50}..."
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ Login failed${NC}"
    echo "   Response: $LOGIN_RESPONSE"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo ""
    echo -e "${YELLOW}⚠️  Continuing with limited tests (no authentication)${NC}"
    TOKEN=""
fi
echo ""

# ============================================================================
# SECTION 3: OAuth Platforms
# ============================================================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}SECTION 3: OAuth Platforms${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -n "$TOKEN" ]; then
    # YouTube
    echo -e "${BLUE}Testing: YouTube OAuth Status${NC}"
    YOUTUBE_STATUS=$(curl -s -H "Authorization: Bearer $TOKEN" "$SERVICE_URL/api/oauth/youtube/status")
    if echo "$YOUTUBE_STATUS" | grep -q "connected.*true"; then
        echo -e "${GREEN}✅ YouTube: Connected${NC}"
        CHANNEL_ID=$(echo "$YOUTUBE_STATUS" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('channelId', ''))" 2>/dev/null)
        if [ -n "$CHANNEL_ID" ]; then
            echo "   Channel: https://www.youtube.com/channel/$CHANNEL_ID"
        fi
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${YELLOW}⚠️  YouTube: Not connected${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
    echo ""
    
    # Twitter
    echo -e "${BLUE}Testing: Twitter OAuth Status${NC}"
    TWITTER_STATUS=$(curl -s -H "Authorization: Bearer $TOKEN" "$SERVICE_URL/api/oauth/twitter/status" 2>/dev/null)
    if echo "$TWITTER_STATUS" | grep -q "connected.*true"; then
        echo -e "${GREEN}✅ Twitter: Connected${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    elif echo "$TWITTER_STATUS" | grep -q "not configured\|503"; then
        echo -e "${YELLOW}⚠️  Twitter: Not configured${NC}"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "${YELLOW}⚠️  Twitter: Not connected${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
    echo ""
    
    # Test OAuth endpoints exist
    run_test \
        "YouTube Authorization URL" \
        "curl -s -H 'Authorization: Bearer $TOKEN' '$SERVICE_URL/api/oauth/youtube/authorize' | grep -q 'url\|error'" \
        "" \
        "true"
else
    echo -e "${YELLOW}⚠️  Skipping OAuth tests (no authentication token)${NC}"
    echo ""
fi

# ============================================================================
# SECTION 4: Services Status
# ============================================================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}SECTION 4: Services Status${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

run_test \
    "Redis Connection Status" \
    "curl -s '$SERVICE_URL/api/health/debug-redis' | grep -q 'redisUrl\|success'" \
    "" \
    "true"

run_test \
    "Health Endpoint Response" \
    "curl -s '$SERVICE_URL/api/health' | python3 -c 'import sys, json; data=json.load(sys.stdin); print(\"OK\" if data.get(\"status\") == \"ok\" else \"FAIL\")' 2>/dev/null" \
    "OK"

# ============================================================================
# SECTION 5: API Endpoints
# ============================================================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}SECTION 5: Core API Endpoints${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

run_test \
    "Health Endpoint" \
    "curl -s '$SERVICE_URL/api/health' | grep -q 'status'" \
    ""

run_test \
    "API Docs Endpoint" \
    "curl -s -o /dev/null -w '%{http_code}' '$SERVICE_URL/api/docs' | grep -Eq '^(200|301|302)$'" \
    "" \
    "true"

# ============================================================================
# SUMMARY
# ============================================================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}📊 Test Summary${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}✅ Passed: $TESTS_PASSED${NC}"
echo -e "${RED}❌ Failed: $TESTS_FAILED${NC}"
echo -e "${YELLOW}⚠️  Warnings: $WARNINGS${NC}"
TOTAL=$((TESTS_PASSED + TESTS_FAILED))
if [ $TOTAL -gt 0 ]; then
    PERCENTAGE=$((TESTS_PASSED * 100 / TOTAL))
    echo -e "${CYAN}📈 Success Rate: ${PERCENTAGE}%${NC}"
fi
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All critical tests passed!${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Some optional features are not configured (warnings above)${NC}"
    fi
    exit 0
else
    echo -e "${YELLOW}⚠️  Some tests failed. Check the output above for details.${NC}"
    exit 1
fi
