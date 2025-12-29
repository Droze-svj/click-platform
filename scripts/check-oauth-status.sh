#!/bin/bash

# Check OAuth Configuration Status

echo "🔐 OAuth Configuration Status Check"
echo "===================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found"
    exit 1
fi

echo "📋 Checking OAuth credentials in .env file..."
echo ""

# Check each platform
platforms=(
    "TWITTER:TWITTER_CLIENT_ID:TWITTER_CLIENT_SECRET"
    "LINKEDIN:LINKEDIN_CLIENT_ID:LINKEDIN_CLIENT_SECRET"
    "FACEBOOK:FACEBOOK_APP_ID:FACEBOOK_APP_SECRET"
    "YOUTUBE:YOUTUBE_CLIENT_ID:YOUTUBE_CLIENT_SECRET"
    "TIKTOK:TIKTOK_CLIENT_KEY:TIKTOK_CLIENT_SECRET"
)

configured=0
not_configured=0

for platform_info in "${platforms[@]}"; do
    IFS=':' read -r platform key1 key2 <<< "$platform_info"
    
    # Check if keys exist and are not placeholders
    if grep -q "^${key1}=" .env && grep -q "^${key2}=" .env; then
        key1_value=$(grep "^${key1}=" .env | cut -d'=' -f2)
        key2_value=$(grep "^${key2}=" .env | cut -d'=' -f2)
        
        if [[ "$key1_value" == *"your-"* ]] || [[ "$key2_value" == *"your-"* ]]; then
            echo "⚠️  $platform: Placeholder values (not configured)"
            ((not_configured++))
        else
            echo "✅ $platform: Configured"
            ((configured++))
        fi
    else
        echo "❌ $platform: Missing from .env"
        ((not_configured++))
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary:"
echo "   ✅ Configured: $configured/5 platforms"
echo "   ⚠️  Not Configured: $not_configured/5 platforms"
echo ""

if [ $not_configured -gt 0 ]; then
    echo "📝 Next Steps:"
    echo "   1. Open OAUTH_NEXT_STEPS.md for step-by-step guide"
    echo "   2. Get credentials from developer portals"
    echo "   3. Update .env file with actual credentials"
    echo "   4. Run: npm run verify:oauth"
    echo ""
fi

if [ $configured -eq 5 ]; then
    echo "🎉 All platforms configured! Run verification:"
    echo "   npm run verify:oauth"
    echo ""
fi

