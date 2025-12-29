#!/bin/bash

# Quick YouTube OAuth Credentials Updater
# Usage: ./scripts/update-youtube-env.sh <CLIENT_ID> <CLIENT_SECRET>

if [ $# -lt 2 ]; then
    echo "📺 YouTube OAuth Credentials Updater"
    echo "===================================="
    echo ""
    echo "Usage: $0 <CLIENT_ID> <CLIENT_SECRET>"
    echo ""
    echo "Example:"
    echo "  $0 123456789-abc.apps.googleusercontent.com GOCSPX-xyz123"
    echo ""
    echo "Or run interactively:"
    echo "  ./scripts/update-oauth-credentials.sh"
    exit 1
fi

CLIENT_ID=$1
CLIENT_SECRET=$2

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    exit 1
fi

echo "📺 Updating YouTube OAuth credentials..."
echo ""

# Update YOUTUBE_CLIENT_ID
if grep -q "^YOUTUBE_CLIENT_ID=" .env; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|^YOUTUBE_CLIENT_ID=.*|YOUTUBE_CLIENT_ID=${CLIENT_ID}|" .env
    else
        sed -i "s|^YOUTUBE_CLIENT_ID=.*|YOUTUBE_CLIENT_ID=${CLIENT_ID}|" .env
    fi
    echo "✅ Updated YOUTUBE_CLIENT_ID"
else
    echo "YOUTUBE_CLIENT_ID=${CLIENT_ID}" >> .env
    echo "✅ Added YOUTUBE_CLIENT_ID"
fi

# Update YOUTUBE_CLIENT_SECRET
if grep -q "^YOUTUBE_CLIENT_SECRET=" .env; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|^YOUTUBE_CLIENT_SECRET=.*|YOUTUBE_CLIENT_SECRET=${CLIENT_SECRET}|" .env
    else
        sed -i "s|^YOUTUBE_CLIENT_SECRET=.*|YOUTUBE_CLIENT_SECRET=${CLIENT_SECRET}|" .env
    fi
    echo "✅ Updated YOUTUBE_CLIENT_SECRET"
else
    echo "YOUTUBE_CLIENT_SECRET=${CLIENT_SECRET}" >> .env
    echo "✅ Added YOUTUBE_CLIENT_SECRET"
fi

echo ""
echo "✅ YouTube credentials updated successfully!"
echo ""
echo "🔍 Verify with:"
echo "   npm run verify:oauth"
echo "   ./scripts/check-oauth-status.sh"
echo ""

