#!/bin/bash

# Test Frontend Connection to Backend
# This script helps diagnose connection issues

echo "🔍 Testing Frontend Connection to Backend"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

BACKEND_URL="https://click-platform.onrender.com"
FRONTEND_ORIGIN="http://localhost:3000"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test 1: Health Check
echo -e "${BLUE}Test 1: Backend Health Check${NC}"
HEALTH=$(curl -s "${BACKEND_URL}/api/health")
if echo "$HEALTH" | grep -q "status.*ok"; then
    echo -e "${GREEN}✅ Backend is responding${NC}"
    RESPONSE_TIME=$(echo "$HEALTH" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('responseTime', 'N/A'))" 2>/dev/null)
    echo "   Response time: $RESPONSE_TIME"
else
    echo -e "${RED}❌ Backend is not responding${NC}"
    echo "   Response: $HEALTH"
fi
echo ""

# Test 2: CORS Preflight
echo -e "${BLUE}Test 2: CORS Preflight Check${NC}"
CORS_RESPONSE=$(curl -s -X OPTIONS "${BACKEND_URL}/api/auth/register" \
  -H "Origin: ${FRONTEND_ORIGIN}" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type" \
  -v 2>&1)

if echo "$CORS_RESPONSE" | grep -q "access-control-allow-origin"; then
    echo -e "${GREEN}✅ CORS is configured${NC}"
    ALLOW_ORIGIN=$(echo "$CORS_RESPONSE" | grep -i "access-control-allow-origin" | head -1)
    echo "   $ALLOW_ORIGIN"
else
    echo -e "${YELLOW}⚠️  CORS check inconclusive${NC}"
    echo "   (This is normal - CORS is checked on actual request)"
fi
echo ""

# Test 3: Registration Endpoint
echo -e "${BLUE}Test 3: Registration Endpoint${NC}"
TEST_EMAIL="test-connection-$(date +%s)@example.com"
REGISTER_RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/auth/register" \
  -H "Content-Type: application/json" \
  -H "Origin: ${FRONTEND_ORIGIN}" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"Test123!@#\",\"name\":\"Test User\"}")

if echo "$REGISTER_RESPONSE" | grep -q "success.*true\|token"; then
    echo -e "${GREEN}✅ Registration endpoint is working${NC}"
    echo "   Test user created: $TEST_EMAIL"
else
    echo -e "${RED}❌ Registration endpoint failed${NC}"
    echo "   Response: $REGISTER_RESPONSE" | head -5
fi
echo ""

# Test 4: Frontend Running
echo -e "${BLUE}Test 4: Frontend Check${NC}"
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend is running on http://localhost:3000${NC}"
else
    echo -e "${RED}❌ Frontend is not running${NC}"
    echo "   Start it with: cd client && npm run dev"
fi
echo ""

# Test 5: API URL Configuration
echo -e "${BLUE}Test 5: API URL Configuration${NC}"
if [ -f "client/.env.local" ]; then
    API_URL=$(grep "NEXT_PUBLIC_API_URL" client/.env.local | cut -d'=' -f2)
    echo "   .env.local: $API_URL"
    if [ "$API_URL" = "https://click-platform.onrender.com/api" ]; then
        echo -e "${GREEN}✅ API URL is correct${NC}"
    else
        echo -e "${YELLOW}⚠️  API URL might be incorrect${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  .env.local not found${NC}"
    echo "   Frontend will use default: https://click-platform.onrender.com/api"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}📋 Summary${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Backend URL: $BACKEND_URL"
echo "Frontend URL: http://localhost:3000"
echo ""
echo "If all tests pass but you still see 'connection lost':"
echo "1. Open browser console (F12)"
echo "2. Check for error messages"
echo "3. Check Network tab for failed requests"
echo "4. Try hard refresh (Cmd+Shift+R)"
echo ""

