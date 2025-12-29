#!/bin/bash

# Finish YouTube OAuth - Complete the token exchange
# Usage: ./scripts/finish-youtube-oauth.sh <AUTHORIZATION_CODE> <STATE>

if [ $# -lt 2 ]; then
    echo "📺 Finish YouTube OAuth Connection"
    echo "==================================="
    echo ""
    echo "Usage: $0 <AUTHORIZATION_CODE> <STATE>"
    echo ""
    echo "Example:"
    echo "  $0 \"4/0AeanS...\" \"b034eada70865dada09fe32f8b42257b2d45db57f350289f4eb5d6be158864e9\""
    echo ""
    echo "Or run interactively:"
    read -p "Enter authorization CODE: " CODE
    read -p "Enter STATE: " STATE
    
    if [ -z "$CODE" ] || [ -z "$STATE" ]; then
        echo "❌ Both CODE and STATE are required"
        exit 1
    fi
else
    CODE=$1
    STATE=$2
fi

API_URL="http://localhost:5001/api"
TOKEN="${TEST_TOKEN:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTUyY2QzNzIyZDZhYmM1NTA5YTllZmQiLCJpYXQiOjE3NjcwMzQxNjksImV4cCI6MTc2OTYyNjE2OX0.komsdbvTeS1q4Rii0lwQjaau-46P1_HMO-i07WpiXaY}"

echo "🔐 Completing YouTube OAuth connection..."
echo ""

RESPONSE=$(curl -s -X POST "$API_URL/oauth/youtube/complete" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"code\": \"$CODE\", \"state\": \"$STATE\"}")

echo "Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

SUCCESS=$(echo "$RESPONSE" | grep -o '"success":true' || echo "")

if [ -n "$SUCCESS" ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ YouTube OAuth Connection Successful!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    echo "Checking connection status..."
    STATUS=$(curl -s -X GET "$API_URL/oauth/youtube/status" \
        -H "Authorization: Bearer $TOKEN")
    
    echo "$STATUS" | python3 -m json.tool 2>/dev/null || echo "$STATUS"
    echo ""
    echo "🎉 Your YouTube account is now connected!"
else
    echo "❌ Connection failed. Check the error above."
    exit 1
fi

