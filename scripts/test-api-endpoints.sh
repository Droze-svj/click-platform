#!/bin/bash

# Test Core API Endpoints
# This script tests your deployed API

SERVICE_URL="https://click-platform.onrender.com"

echo "🧪 Testing API Endpoints"
echo "Service: $SERVICE_URL"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test 1: Health Check
echo "1️⃣ Testing Health Endpoint..."
HEALTH=$(curl -s "$SERVICE_URL/api/health")
if [[ "$HEALTH" == *"status"* ]]; then
    STATUS=$(echo "$HEALTH" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    echo -e "${GREEN}✅ Health check passed${NC}"
    echo "   Status: $STATUS"
else
    echo -e "${RED}❌ Health check failed${NC}"
fi
echo ""

# Test 2: Redis Debug
echo "2️⃣ Testing Redis Connection..."
REDIS=$(curl -s "$SERVICE_URL/api/health/debug-redis")
if [[ "$REDIS" == *"isValid"* ]]; then
    IS_VALID=$(echo "$REDIS" | grep -o '"isValid":[^,]*' | cut -d':' -f2)
    CONTAINS_LOCALHOST=$(echo "$REDIS" | grep -o '"containsLocalhost":[^,]*' | cut -d':' -f2)
    echo -e "${GREEN}✅ Redis debug endpoint accessible${NC}"
    echo "   Valid: $IS_VALID"
    echo "   Contains localhost: $CONTAINS_LOCALHOST"
    if [ "$IS_VALID" = "true" ] && [ "$CONTAINS_LOCALHOST" = "false" ]; then
        echo -e "${GREEN}   ✅ Redis is properly configured${NC}"
    fi
else
    echo -e "${RED}❌ Redis debug failed${NC}"
fi
echo ""

# Test 3: API Docs
echo "3️⃣ Testing API Documentation..."
DOCS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$SERVICE_URL/api-docs")
if [ "$DOCS_CODE" = "200" ] || [ "$DOCS_CODE" = "301" ]; then
    echo -e "${GREEN}✅ API documentation available${NC}"
    echo "   URL: $SERVICE_URL/api-docs"
else
    echo -e "${YELLOW}⚠️ API documentation not available (HTTP $DOCS_CODE)${NC}"
fi
echo ""

# Test 4: Response Time
echo "4️⃣ Testing Response Time..."
START=$(date +%s.%N)
curl -s "$SERVICE_URL/api/health" > /dev/null
END=$(date +%s.%N)
TIME=$(echo "$END - $START" | bc)
echo "   Response time: ${TIME}s"
if (( $(echo "$TIME < 2.0" | bc -l) )); then
    echo -e "${GREEN}   ✅ Response time is good${NC}"
else
    echo -e "${YELLOW}   ⚠️ Response time is slow (may be cold start)${NC}"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ API Testing Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

