#!/bin/bash

# YouTube OAuth Test Script
# Tests YouTube OAuth endpoints

echo "📺 YouTube OAuth Test"
echo "===================="
echo ""

API_URL="http://localhost:5001/api"
TOKEN="${TEST_TOKEN}"

if [ -z "$TOKEN" ]; then
    echo "⚠️  TEST_TOKEN not set. Getting a test token..."
    echo ""
    echo "Registering test user..."
    RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
        -H "Content-Type: application/json" \
        -d '{"email":"youtube-test@example.com","password":"Test123!@#","name":"YouTube Test User"}')
    
    TOKEN=$(echo $RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    
    if [ -z "$TOKEN" ]; then
        echo "❌ Failed to get token. Trying login..."
        RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
            -H "Content-Type: application/json" \
            -d '{"email":"youtube-test@example.com","password":"Test123!@#"}')
        TOKEN=$(echo $RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    fi
    
    if [ -z "$TOKEN" ]; then
        echo "❌ Failed to authenticate. Please set TEST_TOKEN manually."
        exit 1
    fi
    
    echo "✅ Got test token"
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Testing YouTube OAuth Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

STATUS_RESPONSE=$(curl -s -X GET "$API_URL/oauth/youtube/status" \
    -H "Authorization: Bearer $TOKEN")

echo "Response:"
echo "$STATUS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$STATUS_RESPONSE"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. Testing YouTube OAuth Authorization URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

AUTH_RESPONSE=$(curl -s -X GET "$API_URL/oauth/youtube/authorize" \
    -H "Authorization: Bearer $TOKEN")

echo "Response:"
echo "$AUTH_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$AUTH_RESPONSE"
echo ""

# Extract URL if available
AUTH_URL=$(echo "$AUTH_RESPONSE" | grep -o '"url":"[^"]*' | cut -d'"' -f4)

if [ -n "$AUTH_URL" ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ Authorization URL Generated!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "🔗 Authorization URL:"
    echo "$AUTH_URL"
    echo ""
    echo "📋 Next Steps:"
    echo "   1. Open the URL above in your browser"
    echo "   2. Sign in with your YouTube/Google account"
    echo "   3. Authorize the app"
    echo "   4. You'll be redirected back with a code"
    echo ""
    echo "💡 To open automatically (macOS):"
    echo "   open '$AUTH_URL'"
    echo ""
else
    echo "⚠️  Could not extract authorization URL from response"
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

