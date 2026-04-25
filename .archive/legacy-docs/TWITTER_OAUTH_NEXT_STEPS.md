# Twitter/X OAuth Setup - Next Steps

## 🎯 Current Status

- ✅ Twitter OAuth service implemented
- ✅ Twitter OAuth routes configured
- ✅ Setup scripts created
- ⏳ **Waiting for credentials**

## 📋 What You Need

To complete Twitter/X OAuth setup, you need:

1. **Twitter Developer Account**
   - Go to: https://developer.twitter.com/
   - Sign in with your Twitter/X account
   - Apply for developer access (usually instant)

2. **Create OAuth App**
   - Create a new app in Twitter Developer Portal
   - Get API Key (Client ID)
   - Get API Secret (Client Secret)

3. **Set Callback URL**
   - Add to Twitter app: `https://click-platform.onrender.com/api/oauth/twitter/callback`
   - Also add for local dev: `http://localhost:5001/api/oauth/twitter/callback`

## 🚀 Quick Setup Guide

### Step 1: Get Twitter Credentials

1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Create a new app or select existing app
3. Go to "Keys and tokens" tab
4. Copy:
   - **API Key** → `TWITTER_CLIENT_ID`
   - **API Secret** → `TWITTER_CLIENT_SECRET`

### Step 2: Add to Render.com

Add these environment variables to Render.com:

```
TWITTER_CLIENT_ID=your_api_key_here
TWITTER_CLIENT_SECRET=your_api_secret_here
TWITTER_CALLBACK_URL=https://click-platform.onrender.com/api/oauth/twitter/callback
```

### Step 3: Set Callback URL in Twitter App

1. In Twitter Developer Portal, go to your app
2. Find "Callback URLs" or "Redirect URIs"
3. Add: `https://click-platform.onrender.com/api/oauth/twitter/callback`
4. Save

### Step 4: Test OAuth Flow

After adding credentials and redeploying:

```bash
# Start OAuth flow
./scripts/complete-twitter-oauth-flow.sh

# After authorizing, verify connection
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://click-platform.onrender.com/api/oauth/twitter/status

# Test features
./scripts/test-twitter-features.sh YOUR_TOKEN
```

## 📝 Available Features

Once connected, you can:

1. **Post Tweets**
   - Text tweets (up to 280 characters)
   - Tweets with media
   - Reply to tweets

2. **Get User Info**
   - Username
   - User ID
   - Profile information

3. **Manage Connection**
   - Check connection status
   - Disconnect account

## 🔗 API Endpoints

### Get Authorization URL
```bash
GET /api/oauth/twitter/authorize
Authorization: Bearer YOUR_TOKEN
```

### OAuth Callback
```
GET /api/oauth/twitter/callback?code=...&state=...
```

### Post Tweet
```bash
POST /api/oauth/twitter/post
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "text": "Your tweet text here",
  "replyTo": "optional_tweet_id",
  "mediaIds": ["optional_media_id"]
}
```

### Check Status
```bash
GET /api/oauth/twitter/status
Authorization: Bearer YOUR_TOKEN
```

### Disconnect
```bash
DELETE /api/oauth/twitter/disconnect
Authorization: Bearer YOUR_TOKEN
```

## 📚 Documentation

- `TWITTER_OAUTH_WALKTHROUGH.md` - Detailed setup walkthrough
- `OAUTH_SETUP_GUIDE.md` - General OAuth setup guide

## ✅ Ready to Set Up?

Once you have your Twitter credentials, let me know and I'll help you:
1. Add them to Render.com
2. Test the OAuth flow
3. Verify all features work

