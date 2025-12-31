#!/bin/bash

# Verify YouTube OAuth Configuration
SERVICE_URL="https://click-platform.onrender.com"

echo "🔍 Verifying YouTube OAuth Configuration"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Configuration Checklist"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "✅ You mentioned you already have:"
echo "   - Client ID configured"
echo "   - Callback URL configured"
echo ""

echo "📝 To complete setup, verify these in Render.com:"
echo ""
echo "1. Environment Variables (Render.com → Environment tab):"
echo "   - ${GREEN}YOUTUBE_CLIENT_ID${NC} = 236680378422-65cevaheb4nogc217jvsfa4jh7eg2r8g.apps.googleusercontent.com"
echo "   - ${GREEN}YOUTUBE_CLIENT_SECRET${NC} = (should start with GOCSPX-)"
echo "   - ${GREEN}YOUTUBE_CALLBACK_URL${NC} = https://click-platform.onrender.com/api/oauth/youtube/callback"
echo ""

echo "2. Google Cloud Console:"
echo "   - Go to: https://console.cloud.google.com/apis/credentials"
echo "   - Find your OAuth 2.0 Client"
echo "   - Under 'Authorized redirect URIs', verify:"
echo "     ${GREEN}https://click-platform.onrender.com/api/oauth/youtube/callback${NC}"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Testing Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test if authorize endpoint is accessible (will require auth, but we can check if it exists)
echo "Testing authorize endpoint..."
AUTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$SERVICE_URL/api/oauth/youtube/authorize")
if [ "$AUTH_RESPONSE" = "401" ] || [ "$AUTH_RESPONSE" = "403" ]; then
    echo -e "${GREEN}✅ Authorize endpoint exists (requires authentication)${NC}"
    echo "   HTTP Status: $AUTH_RESPONSE (expected - needs auth token)"
elif [ "$AUTH_RESPONSE" = "503" ]; then
    echo -e "${RED}❌ YouTube OAuth not configured${NC}"
    echo "   Check environment variables in Render.com"
else
    echo -e "${YELLOW}⚠️ Unexpected response: HTTP $AUTH_RESPONSE${NC}"
fi
echo ""

# Test callback endpoint (should be accessible)
echo "Testing callback endpoint..."
CALLBACK_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$SERVICE_URL/api/oauth/youtube/callback")
if [ "$CALLBACK_RESPONSE" = "200" ] || [ "$CALLBACK_RESPONSE" = "400" ]; then
    echo -e "${GREEN}✅ Callback endpoint is accessible${NC}"
    echo "   HTTP Status: $CALLBACK_RESPONSE"
else
    echo -e "${YELLOW}⚠️ Callback endpoint returned: HTTP $CALLBACK_RESPONSE${NC}"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Next Steps"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "1. ${BLUE}Verify Client Secret${NC}"
echo "   - Check Render.com → Environment → YOUTUBE_CLIENT_SECRET"
echo "   - Should start with 'GOCSPX-'"
echo "   - If missing, get it from Google Cloud Console"
echo ""

echo "2. ${BLUE}Verify Callback URL in Google Cloud${NC}"
echo "   - Go to: https://console.cloud.google.com/apis/credentials"
echo "   - Edit your OAuth 2.0 Client"
echo "   - Add: https://click-platform.onrender.com/api/oauth/youtube/callback"
echo ""

echo "3. ${BLUE}Test OAuth Flow${NC}"
echo "   - Once configured, test the authorization flow"
echo "   - See: YOUTUBE_OAUTH_WALKTHROUGH.md"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📖 Documentation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Full setup guide: YOUTUBE_OAUTH_RENDER_SETUP.md"
echo "OAuth walkthrough: YOUTUBE_OAUTH_WALKTHROUGH.md"
echo ""

