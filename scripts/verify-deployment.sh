#!/bin/bash

# Quick Deployment Verification Script
# Usage: ./scripts/verify-deployment.sh [your-service-url]

set -e

SERVICE_URL="${1:-https://click-platform.onrender.com}"

echo "🔍 Verifying deployment at: $SERVICE_URL"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Health Check
echo "1️⃣ Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s "$SERVICE_URL/api/health" || echo "ERROR")
if [[ "$HEALTH_RESPONSE" == *"status"* ]]; then
    echo -e "${GREEN}✅ Health endpoint is working${NC}"
    echo "   Response: $(echo $HEALTH_RESPONSE | jq -r '.status' 2>/dev/null || echo 'ok')"
else
    echo -e "${RED}❌ Health endpoint failed${NC}"
    echo "   Response: $HEALTH_RESPONSE"
fi
echo ""

# Test 2: Redis Debug
echo "2️⃣ Testing Redis connection..."
REDIS_RESPONSE=$(curl -s "$SERVICE_URL/api/health/debug-redis" || echo "ERROR")
if [[ "$REDIS_RESPONSE" == *"redisUrl"* ]]; then
    REDIS_VALID=$(echo $REDIS_RESPONSE | jq -r '.redisUrl.isValid' 2>/dev/null || echo "unknown")
    if [[ "$REDIS_VALID" == "true" ]]; then
        echo -e "${GREEN}✅ Redis connection is valid${NC}"
    else
        echo -e "${YELLOW}⚠️ Redis connection may have issues${NC}"
    fi
    echo "   Redis URL exists: $(echo $REDIS_RESPONSE | jq -r '.redisUrl.exists' 2>/dev/null || echo 'unknown')"
    echo "   Contains localhost: $(echo $REDIS_RESPONSE | jq -r '.redisUrl.containsLocalhost' 2>/dev/null || echo 'unknown')"
else
    echo -e "${RED}❌ Redis debug endpoint failed${NC}"
fi
echo ""

# Test 3: API Documentation (if available)
echo "3️⃣ Testing API documentation..."
DOCS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$SERVICE_URL/api-docs" || echo "000")
if [[ "$DOCS_RESPONSE" == "200" ]]; then
    echo -e "${GREEN}✅ API documentation is available${NC}"
    echo "   URL: $SERVICE_URL/api-docs"
else
    echo -e "${YELLOW}⚠️ API documentation not available (may be disabled)${NC}"
fi
echo ""

# Test 4: Response Time
echo "4️⃣ Testing response time..."
RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$SERVICE_URL/api/health" || echo "0")
if (( $(echo "$RESPONSE_TIME > 0" | bc -l) )); then
    echo -e "${GREEN}✅ Server is responding${NC}"
    echo "   Response time: ${RESPONSE_TIME}s"
else
    echo -e "${RED}❌ Server is not responding${NC}"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Deployment Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Service URL: $SERVICE_URL"
echo ""
echo "Next steps:"
echo "1. Check Render.com logs for any errors"
echo "2. Verify all environment variables are set"
echo "3. Test OAuth integrations (if configured)"
echo "4. Test core API endpoints"
echo "5. Set up monitoring and alerts"
echo ""
echo "📖 See POST_DEPLOYMENT_NEXT_STEPS.md for detailed guide"
