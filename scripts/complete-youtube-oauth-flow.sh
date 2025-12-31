#!/bin/bash

# Complete YouTube OAuth Flow Automation
# This script automates the registration, login, and authorization URL generation

SERVICE_URL="https://click-platform.onrender.com"
TEST_EMAIL="youtube-test-$(date +%s)@example.com"
TEST_PASSWORD="Test123!@#"
TEST_NAME="YouTube Test User"

echo "🚀 Starting YouTube OAuth Flow"
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
    # Maybe user already exists, try login
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
echo "3️⃣ Getting YouTube authorization URL..."
AUTH_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "$SERVICE_URL/api/oauth/youtube/authorize")

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
    echo "  - YouTube OAuth not configured (check YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET)"
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
echo "2. ${YELLOW}Authorize with Google${NC}"
echo "   - Google will ask for permissions"
echo "   - Click 'Allow'"
echo ""
echo "3. ${YELLOW}You'll be redirected to callback${NC}"
echo "   - The callback page will show an authorization code"
echo "   - Copy the code and state"
echo ""
echo "4. ${YELLOW}Complete the connection${NC}"
echo "   Run this command (replace CODE and STATE):"
echo ""
echo "   curl -X POST $SERVICE_URL/api/oauth/youtube/complete \\"
echo "     -H 'Authorization: Bearer $TOKEN' \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"code\": \"CODE_FROM_CALLBACK\", \"state\": \"STATE_FROM_CALLBACK\"}'"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 Saved Information"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Token: $TOKEN"
echo "State: $STATE"
echo ""
echo "Save these for completing the OAuth flow!"
echo ""

# Try to open URL in browser (macOS)
if command -v open &> /dev/null; then
    echo "🌐 Opening authorization URL in browser..."
    open "$AUTH_URL"
    echo ""
    echo "✅ Browser opened! Complete the authorization, then come back here."
else
    echo "💡 Copy the URL above and open it in your browser"
fi

