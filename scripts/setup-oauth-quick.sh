#!/bin/bash

# Quick OAuth Setup Script
# This script helps you quickly set up OAuth credentials

echo "🔐 OAuth Credentials Quick Setup"
echo "================================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Creating from template..."
    cp env.production.template .env
    echo "✅ Created .env file"
fi

echo ""
echo "📋 OAuth Setup Checklist:"
echo ""
echo "1. Twitter/X:"
echo "   → https://developer.twitter.com/en/portal/dashboard"
echo "   → Create app → Keys and tokens"
echo ""
echo "2. LinkedIn:"
echo "   → https://www.linkedin.com/developers/"
echo "   → Create app → Auth tab"
echo ""
echo "3. Facebook (also for Instagram):"
echo "   → https://developers.facebook.com/"
echo "   → Create app → Add Facebook Login → Settings"
echo ""
echo "4. YouTube:"
echo "   → https://console.cloud.google.com/"
echo "   → Create project → Enable YouTube Data API → Create OAuth credentials"
echo ""
echo "5. TikTok:"
echo "   → https://developers.tiktok.com/"
echo "   → Create app → Basic Information"
echo ""
echo ""
echo "📝 After getting credentials, edit .env file and replace:"
echo "   - your-twitter-client-id"
echo "   - your-linkedin-client-id"
echo "   - your-facebook-app-id"
echo "   - your-youtube-client-id"
echo "   - your-tiktok-client-key"
echo ""
echo "✅ Then run: npm run verify:oauth"
echo ""
echo "📚 For detailed instructions, see: OAUTH_SETUP_GUIDE.md"
echo ""

