#!/bin/bash

# Finish YouTube OAuth Connection
# Usage: ./scripts/finish-youtube-oauth.sh <code> <state>

SERVICE_URL="https://click-platform.onrender.com"
# Token and state should be provided as environment variables or arguments
# Default to empty - user should provide via environment or get from complete-youtube-oauth-flow.sh
TOKEN="${YOUTUBE_OAUTH_TOKEN:-}"
STATE="${YOUTUBE_OAUTH_STATE:-}"

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
AUTH_TOKEN="${3:-$TOKEN}"

if [ -z "$AUTH_TOKEN" ]; then
    echo -e "${RED}❌ Error: Authentication token is required${NC}"
    echo ""
    echo "Usage:"
    echo "  ./scripts/finish-youtube-oauth.sh 'CODE' 'STATE' 'TOKEN'"
    echo ""
    echo "Or set environment variables:"
    echo "  export YOUTUBE_OAUTH_TOKEN='your_token'"
    echo "  export YOUTUBE_OAUTH_STATE='your_state'"
    echo "  ./scripts/finish-youtube-oauth.sh 'CODE'"
    echo ""
    exit 1
fi

echo "Using:"
echo "  Code: ${CODE:0:30}..."
echo "  State: ${NEW_STATE:0:30}..."
echo ""

echo "🔄 Completing OAuth connection..."
COMPLETE_RESPONSE=$(curl -s -X POST "$SERVICE_URL/api/oauth/youtube/complete" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
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
    echo "curl -H 'Authorization: Bearer $AUTH_TOKEN' $SERVICE_URL/api/oauth/youtube/status"
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
