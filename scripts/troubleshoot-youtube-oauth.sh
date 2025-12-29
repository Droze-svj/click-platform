#!/bin/bash

# YouTube OAuth Troubleshooting Script

echo "🔍 YouTube OAuth Troubleshooting"
echo "================================"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Checking OAuth Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check .env file
if [ -f .env ]; then
    echo "✅ .env file exists"
    
    YT_CLIENT_ID=$(grep "^YOUTUBE_CLIENT_ID=" .env | cut -d'=' -f2)
    YT_CLIENT_SECRET=$(grep "^YOUTUBE_CLIENT_SECRET=" .env | cut -d'=' -f2)
    YT_CALLBACK=$(grep "^YOUTUBE_CALLBACK_URL=" .env | cut -d'=' -f2)
    
    if [[ "$YT_CLIENT_ID" == *"your-"* ]] || [ -z "$YT_CLIENT_ID" ]; then
        echo "❌ YOUTUBE_CLIENT_ID: Not configured (placeholder)"
    else
        echo "✅ YOUTUBE_CLIENT_ID: Configured"
        echo "   Value: ${YT_CLIENT_ID:0:30}..."
    fi
    
    if [[ "$YT_CLIENT_SECRET" == *"your-"* ]] || [ -z "$YT_CLIENT_SECRET" ]; then
        echo "❌ YOUTUBE_CLIENT_SECRET: Not configured (placeholder)"
    else
        echo "✅ YOUTUBE_CLIENT_SECRET: Configured"
        echo "   Value: ${YT_CLIENT_SECRET:0:15}..."
    fi
    
    if [ -z "$YT_CALLBACK" ]; then
        echo "❌ YOUTUBE_CALLBACK_URL: Not set"
    else
        echo "✅ YOUTUBE_CALLBACK_URL: $YT_CALLBACK"
    fi
else
    echo "❌ .env file not found"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. Checking Server Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if curl -s http://localhost:5001/api/health > /dev/null 2>&1; then
    echo "✅ Server is running on port 5001"
else
    echo "❌ Server is not running on port 5001"
    echo "   Start it with: npm run dev:server"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. Common Issues & Solutions"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cat << 'EOF'
Issue 1: "Access blocked" error
Solution:
  • Go to: https://console.cloud.google.com/apis/credentials/consent
  • Make sure "Publishing status" is "Testing" (not "In production")
  • Scroll to "Test users" section
  • Add your Google account email EXACTLY as you sign in
  • Wait 5-10 minutes after adding
  • Try in incognito/private browsing mode

Issue 2: Wrong email
Solution:
  • Use the EXACT email you added as test user
  • Check for typos (gmail.com vs googlemail.com)
  • Make sure you're signed into the right Google account

Issue 3: OAuth consent screen not configured
Solution:
  • Go to: https://console.cloud.google.com/apis/credentials/consent
  • Complete all required fields:
    - App name
    - User support email
    - Developer contact email
  • Add scopes: youtube.upload, youtube
  • Save changes

Issue 4: Redirect URI mismatch
Solution:
  • Go to: https://console.cloud.google.com/apis/credentials
  • Click on your OAuth 2.0 Client ID
  • Check "Authorized redirect URIs"
  • Must include: http://localhost:5001/api/oauth/youtube/callback
  • No trailing slashes, exact match required

Issue 5: App not in testing mode
Solution:
  • Go to OAuth consent screen
  • If it says "In production", you need to add test users
  • Or switch back to "Testing" mode

EOF

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. Quick Checklist"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cat << 'EOF'
□ OAuth consent screen is configured
□ App is in "Testing" mode
□ Your email is added as test user (exact match)
□ Waited 5-10 minutes after adding test user
□ Using incognito/private browsing mode
□ Signed in with the exact test user email
□ Redirect URI matches exactly in Google Cloud Console
□ YouTube Data API v3 is enabled
□ OAuth client credentials are correct

EOF

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. Verification Links"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cat << 'EOF'
🔗 OAuth Consent Screen:
   https://console.cloud.google.com/apis/credentials/consent

🔗 OAuth Credentials:
   https://console.cloud.google.com/apis/credentials

🔗 APIs & Services:
   https://console.cloud.google.com/apis/dashboard

EOF

echo ""

