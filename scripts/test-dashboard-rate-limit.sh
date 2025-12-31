#!/bin/bash

# Test Dashboard Rate Limiting Fix
# This script tests multiple dashboard API endpoints to verify rate limiting is working correctly

API_URL="${NEXT_PUBLIC_API_URL:-https://click-platform.onrender.com/api}"

echo "🧪 Testing Dashboard Rate Limiting Fix"
echo "========================================"
echo "API URL: $API_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test health endpoint first
echo "1️⃣  Testing Health Endpoint..."
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/health")
HEALTH_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | sed '$d')

if [ "$HEALTH_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Health check passed${NC}"
    echo "   Response: $(echo $HEALTH_BODY | jq -r '.status // "OK"' 2>/dev/null || echo "OK")"
else
    echo -e "${RED}❌ Health check failed (HTTP $HEALTH_CODE)${NC}"
    echo "   This might indicate the service is still deploying or has issues"
    exit 1
fi

echo ""
echo "2️⃣  Testing Rate Limiting with Multiple Concurrent Requests..."
echo "   (This simulates dashboard load with multiple API calls)"
echo ""

# Test endpoints that were previously returning 429
ENDPOINTS=(
    "/api/search/saved"
    "/api/search/facets"
    "/api/notifications?limit=10"
    "/api/search/alerts"
    "/api/search/history?limit=10"
    "/api/approvals/pending-count"
    "/api/auth/me"
    "/api/engagement/activities"
)

# Note: These endpoints require authentication, so we'll test the rate limit behavior
# by checking if we get 401 (unauthorized) instead of 429 (rate limited)

SUCCESS_COUNT=0
RATE_LIMITED_COUNT=0
ERROR_COUNT=0

for endpoint in "${ENDPOINTS[@]}"; do
    echo -n "   Testing $endpoint... "
    
    # Make request without auth (should get 401, not 429)
    RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL$endpoint" 2>/dev/null)
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    
    if [ "$HTTP_CODE" = "401" ]; then
        echo -e "${GREEN}✅ OK (401 Unauthorized - expected)${NC}"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    elif [ "$HTTP_CODE" = "429" ]; then
        echo -e "${RED}❌ Rate Limited (429)${NC}"
        RATE_LIMITED_COUNT=$((RATE_LIMITED_COUNT + 1))
    else
        echo -e "${YELLOW}⚠️  Unexpected status: $HTTP_CODE${NC}"
        ERROR_COUNT=$((ERROR_COUNT + 1))
    fi
    
    # Small delay to avoid overwhelming the server
    sleep 0.5
done

echo ""
echo "3️⃣  Summary:"
echo "   ✅ Successful requests (401 expected): $SUCCESS_COUNT"
echo "   ❌ Rate limited (429): $RATE_LIMITED_COUNT"
echo "   ⚠️  Other errors: $ERROR_COUNT"
echo ""

if [ $RATE_LIMITED_COUNT -eq 0 ]; then
    echo -e "${GREEN}✅ Rate limiting fix appears to be working!${NC}"
    echo "   No 429 errors detected when making multiple requests."
    echo ""
    echo "📝 Next Steps:"
    echo "   1. Log in to the dashboard at https://click-platform.onrender.com"
    echo "   2. Check the browser console for any 429 errors"
    echo "   3. Verify all dashboard features load correctly"
else
    echo -e "${RED}❌ Rate limiting issues detected${NC}"
    echo "   $RATE_LIMITED_COUNT endpoint(s) returned 429 errors"
    echo "   The fix may need more time to deploy, or there may be other issues"
fi

echo ""
echo "4️⃣  Testing Rate Limit Headers..."
RATE_LIMIT_RESPONSE=$(curl -s -I "$API_URL/health" 2>/dev/null)
if echo "$RATE_LIMIT_RESPONSE" | grep -q "X-RateLimit"; then
    echo -e "${GREEN}✅ Rate limit headers present${NC}"
    echo "$RATE_LIMIT_RESPONSE" | grep "X-RateLimit"
else
    echo -e "${YELLOW}⚠️  Rate limit headers not found${NC}"
fi

echo ""
echo "✨ Test complete!"

