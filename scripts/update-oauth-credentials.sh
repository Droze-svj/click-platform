#!/bin/bash

# Interactive OAuth Credentials Updater
# Helps you update .env file with OAuth credentials

echo "🔐 OAuth Credentials Updater"
echo "============================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Creating from template..."
    cp env.production.template .env
    echo "✅ Created .env file"
fi

# Function to update a credential
update_credential() {
    local key=$1
    local description=$2
    local current_value=$(grep "^${key}=" .env | cut -d'=' -f2- | tr -d '"')
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📝 ${description}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if [[ "$current_value" == *"your-"* ]] || [ -z "$current_value" ]; then
        echo "Current: ⚠️  Not configured (placeholder)"
    else
        echo "Current: ✅ Configured (${current_value:0:20}...)"
    fi
    
    echo ""
    read -p "Enter new value (or press Enter to skip): " new_value
    
    if [ -n "$new_value" ]; then
        # Escape special characters for sed
        escaped_value=$(printf '%s\n' "$new_value" | sed 's/[[\.*^$()+?{|]/\\&/g')
        
        # Update the value in .env
        if grep -q "^${key}=" .env; then
            # Update existing line
            if [[ "$OSTYPE" == "darwin"* ]]; then
                # macOS
                sed -i '' "s|^${key}=.*|${key}=${escaped_value}|" .env
            else
                # Linux
                sed -i "s|^${key}=.*|${key}=${escaped_value}|" .env
            fi
            echo "✅ Updated ${key}"
        else
            # Add new line
            echo "${key}=${new_value}" >> .env
            echo "✅ Added ${key}"
        fi
    else
        echo "⏭️  Skipped ${key}"
    fi
}

# Main menu
echo "Select platform to configure:"
echo ""
echo "1. Twitter/X"
echo "2. LinkedIn"
echo "3. Facebook (also for Instagram)"
echo "4. YouTube"
echo "5. TikTok"
echo "6. Update all platforms"
echo "7. Exit"
echo ""

read -p "Enter choice (1-7): " choice

case $choice in
    1)
        echo ""
        echo "🐦 Twitter/X OAuth Setup"
        update_credential "TWITTER_CLIENT_ID" "Twitter API Key (Client ID)"
        update_credential "TWITTER_CLIENT_SECRET" "Twitter API Secret (Client Secret)"
        update_credential "TWITTER_CALLBACK_URL" "Twitter Callback URL"
        ;;
    2)
        echo ""
        echo "💼 LinkedIn OAuth Setup"
        update_credential "LINKEDIN_CLIENT_ID" "LinkedIn Client ID"
        update_credential "LINKEDIN_CLIENT_SECRET" "LinkedIn Client Secret"
        update_credential "LINKEDIN_CALLBACK_URL" "LinkedIn Callback URL"
        ;;
    3)
        echo ""
        echo "📘 Facebook OAuth Setup (also for Instagram)"
        update_credential "FACEBOOK_APP_ID" "Facebook App ID"
        update_credential "FACEBOOK_APP_SECRET" "Facebook App Secret"
        update_credential "FACEBOOK_CALLBACK_URL" "Facebook Callback URL"
        ;;
    4)
        echo ""
        echo "📺 YouTube OAuth Setup"
        update_credential "YOUTUBE_CLIENT_ID" "YouTube Client ID"
        update_credential "YOUTUBE_CLIENT_SECRET" "YouTube Client Secret"
        update_credential "YOUTUBE_CALLBACK_URL" "YouTube Callback URL"
        ;;
    5)
        echo ""
        echo "🎵 TikTok OAuth Setup"
        update_credential "TIKTOK_CLIENT_KEY" "TikTok Client Key"
        update_credential "TIKTOK_CLIENT_SECRET" "TikTok Client Secret"
        update_credential "TIKTOK_CALLBACK_URL" "TikTok Callback URL"
        ;;
    6)
        echo ""
        echo "🔄 Updating All Platforms"
        echo "Twitter/X:"
        update_credential "TWITTER_CLIENT_ID" "Twitter API Key"
        update_credential "TWITTER_CLIENT_SECRET" "Twitter API Secret"
        update_credential "TWITTER_CALLBACK_URL" "Twitter Callback URL"
        
        echo ""
        echo "LinkedIn:"
        update_credential "LINKEDIN_CLIENT_ID" "LinkedIn Client ID"
        update_credential "LINKEDIN_CLIENT_SECRET" "LinkedIn Client Secret"
        update_credential "LINKEDIN_CALLBACK_URL" "LinkedIn Callback URL"
        
        echo ""
        echo "Facebook:"
        update_credential "FACEBOOK_APP_ID" "Facebook App ID"
        update_credential "FACEBOOK_APP_SECRET" "Facebook App Secret"
        update_credential "FACEBOOK_CALLBACK_URL" "Facebook Callback URL"
        
        echo ""
        echo "YouTube:"
        update_credential "YOUTUBE_CLIENT_ID" "YouTube Client ID"
        update_credential "YOUTUBE_CLIENT_SECRET" "YouTube Client Secret"
        update_credential "YOUTUBE_CALLBACK_URL" "YouTube Callback URL"
        
        echo ""
        echo "TikTok:"
        update_credential "TIKTOK_CLIENT_KEY" "TikTok Client Key"
        update_credential "TIKTOK_CLIENT_SECRET" "TikTok Client Secret"
        update_credential "TIKTOK_CALLBACK_URL" "TikTok Callback URL"
        ;;
    7)
        echo "👋 Exiting..."
        exit 0
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Done! Credentials updated in .env file"
echo ""
echo "🔍 Next steps:"
echo "   1. Verify: npm run verify:oauth"
echo "   2. Check status: ./scripts/check-oauth-status.sh"
echo ""

