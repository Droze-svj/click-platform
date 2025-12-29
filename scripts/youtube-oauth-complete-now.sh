#!/bin/bash

# Complete YouTube OAuth in one go - generates URL and waits for code

echo "📺 YouTube OAuth - Complete Flow"
echo "================================="
echo ""

API_URL="http://localhost:5001/api"
TOKEN="${TEST_TOKEN:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTUyY2QzNzIyZDZhYmM1NTA5YTllZmQiLCJpYXQiOjE3NjcwMzQxNjksImV4cCI6MTc2OTYyNjE2OX0.komsdbvTeS1q4Rii0lwQjaau-46P1_HMO-i07WpiXaY}"

echo "Step 1: Generating authorization URL..."
AUTH_RESPONSE=$(curl -s -X GET "$API_URL/oauth/youtube/authorize" \
  -H "Authorization: Bearer $TOKEN")

AUTH_URL=$(echo "$AUTH_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['url'])" 2>/dev/null)
STATE=$(echo "$AUTH_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['state'])" 2>/dev/null)

if [ -z "$AUTH_URL" ]; then
    echo "❌ Failed to get authorization URL"
    exit 1
fi

echo "✅ Authorization URL generated"
echo ""
echo "🔗 Opening in browser..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    open "$AUTH_URL"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open "$AUTH_URL" 2>/dev/null || sensible-browser "$AUTH_URL" 2>/dev/null
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 IMPORTANT:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "State: $STATE"
echo ""
echo "After you authorize, you'll see a page with your code."
echo "Copy BOTH the code AND make sure the state matches above."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "Paste the authorization CODE here: " CODE

if [ -z "$CODE" ]; then
    echo "❌ Code is required"
    exit 1
fi

echo ""
echo "Completing OAuth connection..."
RESPONSE=$(curl -s -X POST "$API_URL/oauth/youtube/complete" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"code\": \"$CODE\", \"state\": \"$STATE\"}")

echo ""
echo "Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"

SUCCESS=$(echo "$RESPONSE" | grep -o '"success":true' || echo "")

if [ -n "$SUCCESS" ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ YouTube OAuth Connection Successful!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    echo "Checking connection status..."
    STATUS=$(curl -s -X GET "$API_URL/oauth/youtube/status" \
        -H "Authorization: Bearer $TOKEN")
    
    echo "$STATUS" | python3 -m json.tool 2>/dev/null || echo "$STATUS"
else
    echo ""
    echo "❌ Connection failed. Error details above."
fi

