#!/bin/bash

# Complete YouTube OAuth Flow Helper
# This script guides you through the complete OAuth flow

echo "📺 YouTube OAuth Flow - Complete Guide"
echo "======================================="
echo ""

API_URL="http://localhost:5001/api"
TOKEN="${TEST_TOKEN}"

# Get or create token
if [ -z "$TOKEN" ]; then
    echo "⚠️  TEST_TOKEN not set. Getting a test token..."
    RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
        -H "Content-Type: application/json" \
        -d '{"email":"youtube-oauth@example.com","password":"Test123!@#","name":"YouTube OAuth Test"}')
    
    TOKEN=$(echo $RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    
    if [ -z "$TOKEN" ]; then
        echo "❌ Failed to get token. Please set TEST_TOKEN manually."
        exit 1
    fi
    
    echo "✅ Got test token"
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 1: Get Authorization URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

AUTH_RESPONSE=$(curl -s -X GET "$API_URL/oauth/youtube/authorize" \
    -H "Authorization: Bearer $TOKEN")

AUTH_URL=$(echo "$AUTH_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['url'])" 2>/dev/null)
STATE=$(echo "$AUTH_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['state'])" 2>/dev/null)

if [ -z "$AUTH_URL" ]; then
    echo "❌ Failed to get authorization URL"
    echo "Response: $AUTH_RESPONSE"
    exit 1
fi

echo "✅ Authorization URL generated"
echo ""
echo "🔗 URL:"
echo "$AUTH_URL"
echo ""
echo "📝 State: $STATE"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 2: Open in Browser"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Detect OS and open browser
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🌐 Opening in default browser..."
    open "$AUTH_URL"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "🌐 Opening in default browser..."
    xdg-open "$AUTH_URL" 2>/dev/null || sensible-browser "$AUTH_URL" 2>/dev/null
else
    echo "⚠️  Please manually open this URL in your browser:"
    echo "$AUTH_URL"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 3: Authorize the App"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 What to do:"
echo "   1. Sign in with your Google/YouTube account"
echo "   2. Review the permissions requested"
echo "   3. Click 'Allow' to authorize the app"
echo "   4. You'll be redirected to a callback URL"
echo ""
echo "⚠️  After authorization, you'll be redirected to:"
echo "   http://localhost:5001/api/oauth/youtube/callback?code=...&state=..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 4: Get Authorization Code"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "After authorization, copy the 'code' parameter from the URL."
echo ""
echo "The URL will look like:"
echo "http://localhost:5001/api/oauth/youtube/callback?code=4/0AeanS...&state=$STATE"
echo ""
read -p "Paste the authorization CODE here (or press Enter to skip): " CODE

if [ -z "$CODE" ]; then
    echo ""
    echo "⏭️  Skipping automatic completion."
    echo ""
    echo "📋 To complete manually, use:"
    echo "   curl -X POST '$API_URL/oauth/youtube/complete' \\"
    echo "     -H 'Authorization: Bearer $TOKEN' \\"
    echo "     -H 'Content-Type: application/json' \\"
    echo "     -d '{\"code\": \"YOUR_CODE\", \"state\": \"$STATE\"}'"
    echo ""
    exit 0
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 5: Complete OAuth Connection"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

COMPLETE_RESPONSE=$(curl -s -X POST "$API_URL/oauth/youtube/complete" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"code\": \"$CODE\", \"state\": \"$STATE\"}")

echo "Response:"
echo "$COMPLETE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$COMPLETE_RESPONSE"
echo ""

SUCCESS=$(echo "$COMPLETE_RESPONSE" | grep -o '"success":true' || echo "")

if [ -n "$SUCCESS" ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ OAuth Flow Completed Successfully!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    echo "Checking connection status..."
    STATUS_RESPONSE=$(curl -s -X GET "$API_URL/oauth/youtube/status" \
        -H "Authorization: Bearer $TOKEN")
    
    echo "$STATUS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$STATUS_RESPONSE"
    echo ""
else
    echo "⚠️  OAuth completion may have failed. Check the response above."
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

