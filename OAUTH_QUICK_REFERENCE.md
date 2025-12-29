# 🚀 OAuth Credentials Quick Reference

## 📍 Where to Get Credentials

| Platform | Developer Portal | What You Need |
|----------|-----------------|---------------|
| **Twitter/X** | [developer.twitter.com](https://developer.twitter.com/en/portal/dashboard) | API Key, API Secret |
| **LinkedIn** | [linkedin.com/developers](https://www.linkedin.com/developers/) | Client ID, Client Secret |
| **Facebook** | [developers.facebook.com](https://developers.facebook.com/) | App ID, App Secret |
| **Instagram** | (Uses Facebook credentials) | Same as Facebook |
| **YouTube** | [console.cloud.google.com](https://console.cloud.google.com/) | Client ID, Client Secret |
| **TikTok** | [developers.tiktok.com](https://developers.tiktok.com/) | Client Key, Client Secret |

## 🔑 Environment Variables

Add these to your `.env` file:

```bash
# Twitter/X
TWITTER_CLIENT_ID=your-api-key
TWITTER_CLIENT_SECRET=your-api-secret
TWITTER_CALLBACK_URL=http://localhost:5001/api/oauth/twitter/callback

# LinkedIn
LINKEDIN_CLIENT_ID=your-client-id
LINKEDIN_CLIENT_SECRET=your-client-secret
LINKEDIN_CALLBACK_URL=http://localhost:5001/api/oauth/linkedin/callback

# Facebook (also for Instagram)
FACEBOOK_APP_ID=your-app-id
FACEBOOK_APP_SECRET=your-app-secret
FACEBOOK_CALLBACK_URL=http://localhost:5001/api/oauth/facebook/callback

# YouTube
YOUTUBE_CLIENT_ID=your-client-id
YOUTUBE_CLIENT_SECRET=your-client-secret
YOUTUBE_CALLBACK_URL=http://localhost:5001/api/oauth/youtube/callback

# TikTok
TIKTOK_CLIENT_KEY=your-client-key
TIKTOK_CLIENT_SECRET=your-client-secret
TIKTOK_CALLBACK_URL=http://localhost:5001/api/oauth/tiktok/callback
```

## ✅ Verify Setup

```bash
npm run verify:oauth
```

## 📚 Full Guide

See `OAUTH_SETUP_GUIDE.md` for detailed step-by-step instructions.

