#!/bin/bash

# Finish YouTube OAuth Connection
# Usage: ./scripts/finish-youtube-oauth.sh <code> <state>

SERVICE_URL="https://click-platform.onrender.com"
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTU1MzY1OTVjOWNiMTBjMmIzZDkyZGYiLCJpYXQiOjE3NjcxOTIxNTgsImV4cCI6MTc2OTc4NDE1OH0.RYDWrLZl0poAEmnJObt1iad316_hYWie7bcPsarpiHo"
STATE="cc457a042ec42c7660b323bb2796b95cafcceb5821348c724cd2b20decfab969"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "🔗 Completing YouTube OAuth Connection"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if code is provided as argument
if [ -z "$1" ]; then
    echo -e "${YELLOW}📋 Instructions:${NC}"
    echo ""
    echo "After authorizing with Google, you were redirected to a callback page."
    echo "That page should show an authorization code."
    echo ""
    echo "1. Look at the callback URL in your browser"
    echo "   It should look like:"
    echo "   https://click-platform.onrender.com/api/oauth/youtube/callback?code=4/0Axxx...&state=..."
    echo ""
    echo "2. Copy the code from the URL (the part after code=)"
    echo ""
    echo "3. Run this script with the code:"
    echo "   ./scripts/finish-youtube-oauth.sh '4/0Axxx...'"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Or if you have both code and state:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "   ./scripts/finish-youtube-oauth.sh 'CODE' 'STATE'"
    echo ""
    exit 0
fi

CODE="$1"
NEW_STATE="${2:-$STATE}"

echo "Using:"
echo "  Code: ${CODE:0:30}..."
echo "  State: ${NEW_STATE:0:30}..."
echo ""

echo "🔄 Completing OAuth connection..."
COMPLETE_RESPONSE=$(curl -s -X POST "$SERVICE_URL/api/oauth/youtube/complete" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"code\": \"$CODE\",
    \"state\": \"$NEW_STATE\"
  }")

if echo "$COMPLETE_RESPONSE" | grep -q "success\|connected"; then
    echo -e "${GREEN}✅ YouTube OAuth connection completed successfully!${NC}"
    echo ""
    echo "$COMPLETE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$COMPLETE_RESPONSE"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🧪 Verify Connection"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Check connection status:"
    echo "curl -H 'Authorization: Bearer $TOKEN' $SERVICE_URL/api/oauth/youtube/status"
    echo ""
else
    echo -e "${RED}❌ Connection failed${NC}"
    echo ""
    echo "Response:"
    echo "$COMPLETE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$COMPLETE_RESPONSE"
    echo ""
    echo "Possible issues:"
    echo "  - Code expired (codes are only valid for a few minutes)"
    echo "  - State mismatch (make sure you use the state from the same session)"
    echo "  - Invalid code format"
    echo ""
    echo "Try getting a new authorization URL and starting over."
fi
