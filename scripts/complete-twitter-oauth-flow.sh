#!/bin/bash

# Complete Twitter/X OAuth Flow Automation
# This script automates the registration, login, and authorization URL generation

SERVICE_URL="https://click-platform.onrender.com"
TEST_EMAIL="twitter-test-$(date +%s)@example.com"
TEST_PASSWORD="Test123!@#"
TEST_NAME="Twitter Test User"

echo "🐦 Starting Twitter/X OAuth Flow"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Step 1: Register
echo "1️⃣ Registering test user..."
REGISTER_RESPONSE=$(curl -s -X POST "$SERVICE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\",
    \"name\": \"$TEST_NAME\"
  }")

if echo "$REGISTER_RESPONSE" | grep -q "success\|token"; then
    echo -e "${GREEN}✅ User registered${NC}"
    echo "   Email: $TEST_EMAIL"
else
    echo -e "${YELLOW}⚠️ Registration response: $REGISTER_RESPONSE${NC}"
    echo "   Trying login instead..."
fi

# Step 2: Login
echo ""
echo "2️⃣ Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$SERVICE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\"
  }")

# Extract token
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    # Try alternative JSON parsing
    TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('token', ''))" 2>/dev/null)
fi

if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ Failed to get token${NC}"
    echo "   Response: $LOGIN_RESPONSE"
    echo ""
    echo "Please try manually:"
    echo "1. Register: curl -X POST $SERVICE_URL/api/auth/register -H 'Content-Type: application/json' -d '{\"email\":\"test@example.com\",\"password\":\"Test123!@#\",\"name\":\"Test\"}'"
    echo "2. Login: curl -X POST $SERVICE_URL/api/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"test@example.com\",\"password\":\"Test123!@#\"}'"
    echo "3. Copy the token from the response"
    exit 1
fi

echo -e "${GREEN}✅ Login successful${NC}"
echo "   Token: ${TOKEN:0:50}..."
echo ""

# Step 3: Get Authorization URL
echo "3️⃣ Getting Twitter/X authorization URL..."
AUTH_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "$SERVICE_URL/api/oauth/twitter/authorize")

# Extract URL and state
AUTH_URL=$(echo "$AUTH_RESPONSE" | grep -o '"url":"[^"]*"' | cut -d'"' -f4)
STATE=$(echo "$AUTH_RESPONSE" | grep -o '"state":"[^"]*"' | cut -d'"' -f4)

if [ -z "$AUTH_URL" ]; then
    # Try alternative JSON parsing
    AUTH_URL=$(echo "$AUTH_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('url', ''))" 2>/dev/null)
    STATE=$(echo "$AUTH_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('data', {}).get('state', ''))" 2>/dev/null)
fi

if [ -z "$AUTH_URL" ]; then
    echo -e "${RED}❌ Failed to get authorization URL${NC}"
    echo "   Response: $AUTH_RESPONSE"
    echo ""
    echo "Possible issues:"
    echo "  - Twitter OAuth not configured (check TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET)"
    echo "  - Token expired or invalid"
    exit 1
fi

echo -e "${GREEN}✅ Authorization URL generated${NC}"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}📋 Next Steps (Manual - Requires Browser)${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. ${YELLOW}Visit this URL in your browser:${NC}"
echo ""
echo -e "${GREEN}$AUTH_URL${NC}"
echo ""
echo "2. ${YELLOW}Authorize with Twitter/X${NC}"
echo "   - Twitter will ask for permissions"
echo "   - Click 'Authorize app'"
echo ""
echo "3. ${YELLOW}You'll be redirected to callback${NC}"
echo "   - The callback will complete automatically"
echo "   - Check connection status after redirect"
echo ""
echo "4. ${YELLOW}Verify connection${NC}"
echo "   Run this command:"
echo ""
echo "   curl -H 'Authorization: Bearer $TOKEN' $SERVICE_URL/api/oauth/twitter/status"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 Saved Information"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Token: $TOKEN"
echo "State: $STATE"
echo ""
echo "Save these for verifying the connection!"
echo ""

# Try to open URL in browser (macOS)
if command -v open &> /dev/null; then
    echo "🌐 Opening authorization URL in browser..."
    open "$AUTH_URL"
    echo ""
    echo "✅ Browser opened! Complete the authorization, then verify the connection."
else
    echo "💡 Copy the URL above and open it in your browser"
fi

