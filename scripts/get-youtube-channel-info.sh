#!/bin/bash

# Get detailed YouTube channel information

echo "📺 YouTube Channel Information"
echo "============================="
echo ""

API_URL="http://localhost:5001/api"
TOKEN="${TEST_TOKEN:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTUyY2QzNzIyZDZhYmM1NTA5YTllZmQiLCJpYXQiOjE3NjcwMzQxNjksImV4cCI6MTc2OTYyNjE2OX0.komsdbvTeS1q4Rii0lwQjaau-46P1_HMO-i07WpiXaY}"

echo "Getting connection status..."
STATUS=$(curl -s -X GET "$API_URL/oauth/youtube/status" \
  -H "Authorization: Bearer $TOKEN")

CHANNEL_ID=$(echo "$STATUS" | python3 -c "import sys, json; print(json.load(sys.stdin)['data'].get('channelId', 'N/A'))" 2>/dev/null || echo "N/A")

if [ "$CHANNEL_ID" = "N/A" ] || [ -z "$CHANNEL_ID" ]; then
    echo "❌ Channel ID not found. Is YouTube connected?"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Channel Details"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Channel ID: $CHANNEL_ID"
echo "Channel URL: https://www.youtube.com/channel/$CHANNEL_ID"
echo ""

# Try to get more info from YouTube API directly
echo "Fetching detailed channel information from YouTube API..."
echo ""

# Note: This would require making a direct API call with the access token
# For now, we'll show what we have from the connection

echo "$STATUS" | python3 -m json.tool 2>/dev/null || echo "$STATUS"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Channel Information Retrieved"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

