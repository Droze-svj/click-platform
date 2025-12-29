#!/bin/bash

# Quick Twitter OAuth Credentials Updater
# Usage: ./scripts/update-twitter-env.sh <API_KEY> <API_SECRET>

if [ $# -lt 2 ]; then
    echo "🔐 Twitter OAuth Credentials Updater"
    echo "===================================="
    echo ""
    echo "Usage: $0 <API_KEY> <API_SECRET>"
    echo ""
    echo "Example:"
    echo "  $0 AbC123XyZ789 aBcDeFgHiJkLmNoPqRsTuVwXyZ123456789"
    echo ""
    echo "Or run interactively:"
    echo "  ./scripts/update-oauth-credentials.sh"
    exit 1
fi

API_KEY=$1
API_SECRET=$2

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    exit 1
fi

echo "🔐 Updating Twitter OAuth credentials..."
echo ""

# Update TWITTER_CLIENT_ID
if grep -q "^TWITTER_CLIENT_ID=" .env; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|^TWITTER_CLIENT_ID=.*|TWITTER_CLIENT_ID=${API_KEY}|" .env
    else
        sed -i "s|^TWITTER_CLIENT_ID=.*|TWITTER_CLIENT_ID=${API_KEY}|" .env
    fi
    echo "✅ Updated TWITTER_CLIENT_ID"
else
    echo "TWITTER_CLIENT_ID=${API_KEY}" >> .env
    echo "✅ Added TWITTER_CLIENT_ID"
fi

# Update TWITTER_CLIENT_SECRET
if grep -q "^TWITTER_CLIENT_SECRET=" .env; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|^TWITTER_CLIENT_SECRET=.*|TWITTER_CLIENT_SECRET=${API_SECRET}|" .env
    else
        sed -i "s|^TWITTER_CLIENT_SECRET=.*|TWITTER_CLIENT_SECRET=${API_SECRET}|" .env
    fi
    echo "✅ Updated TWITTER_CLIENT_SECRET"
else
    echo "TWITTER_CLIENT_SECRET=${API_SECRET}" >> .env
    echo "✅ Added TWITTER_CLIENT_SECRET"
fi

echo ""
echo "✅ Twitter credentials updated successfully!"
echo ""
echo "🔍 Verify with:"
echo "   npm run verify:oauth"
echo "   ./scripts/check-oauth-status.sh"
echo ""

