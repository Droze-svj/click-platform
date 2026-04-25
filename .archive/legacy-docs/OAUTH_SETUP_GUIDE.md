# 🔐 OAuth Credentials Setup Guide

This guide will help you set up OAuth credentials for all social media platforms.

## 📋 Quick Setup Checklist

- [ ] Twitter/X OAuth App
- [ ] LinkedIn OAuth App
- [ ] Facebook OAuth App (also used for Instagram)
- [ ] YouTube OAuth App
- [ ] TikTok OAuth App

---

## 1. Twitter/X OAuth Setup

### Step 1: Create Twitter Developer Account
1. Go to [Twitter Developer Portal](https://developer.twitter.com/)
2. Sign in with your Twitter account
3. Apply for a developer account (if needed)

### Step 2: Create an App
1. Go to [Twitter Developer Portal > Apps](https://developer.twitter.com/en/portal/dashboard)
2. Click "Create App" or "New App"
3. Fill in:
   - **App name**: Your app name (e.g., "Click Content Platform")
   - **App description**: Brief description
   - **Website URL**: Your website URL
   - **Callback URLs**: `http://localhost:5001/api/oauth/twitter/callback` (for dev)
   - **App permissions**: Read and Write

### Step 3: Get Credentials
1. Go to "Keys and tokens" tab
2. Copy:
   - **API Key** → `TWITTER_CLIENT_ID`
   - **API Secret** → `TWITTER_CLIENT_SECRET`
3. Set callback URL: `http://localhost:5001/api/oauth/twitter/callback` (or your production URL)

### Step 4: Add to .env
```bash
TWITTER_CLIENT_ID=your-api-key-here
TWITTER_CLIENT_SECRET=your-api-secret-here
TWITTER_CALLBACK_URL=http://localhost:5001/api/oauth/twitter/callback
```

---

## 2. LinkedIn OAuth Setup

### Step 1: Create LinkedIn App
1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/)
2. Sign in with your LinkedIn account
3. Click "Create app"

### Step 2: Configure App
1. Fill in app details:
   - **App name**: Your app name
   - **LinkedIn Page**: Select your company page
   - **Privacy policy URL**: Your privacy policy URL
   - **App logo**: Upload logo (optional)
2. Go to "Auth" tab
3. Add redirect URLs:
   - `http://localhost:5001/api/oauth/linkedin/callback` (for development)
   - `https://your-domain.com/api/oauth/linkedin/callback` (for production)
4. Request permissions:
   - `r_liteprofile` (Basic profile)
   - `r_emailaddress` (Email)
   - `w_member_social` (Post on behalf of user)

### Step 3: Get Credentials
1. In "Auth" tab, copy:
   - **Client ID** → `LINKEDIN_CLIENT_ID`
   - **Client Secret** → `LINKEDIN_CLIENT_SECRET`

### Step 4: Add to .env
```bash
LINKEDIN_CLIENT_ID=your-client-id-here
LINKEDIN_CLIENT_SECRET=your-client-secret-here
LINKEDIN_CALLBACK_URL=http://localhost:5001/api/oauth/linkedin/callback
```

---

## 3. Facebook OAuth Setup (also used for Instagram)

### Step 1: Create Facebook App
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Click "My Apps" → "Create App"
3. Select "Business" as app type
4. Fill in app details:
   - **App name**: Your app name
   - **App contact email**: Your email
   - **Business account**: Select or create

### Step 2: Add Products
1. Add "Facebook Login" product
2. Add "Instagram Basic Display" product (for Instagram)
3. Add "Instagram Graph API" product (for Instagram posting)

### Step 3: Configure OAuth
1. Go to "Facebook Login" → "Settings"
2. Add Valid OAuth Redirect URIs:
   - `http://localhost:5001/api/oauth/facebook/callback`
   - `https://your-domain.com/api/oauth/facebook/callback`
3. Go to "Settings" → "Basic"
4. Copy:
   - **App ID** → `FACEBOOK_APP_ID`
   - **App Secret** → `FACEBOOK_APP_SECRET` (click "Show")

### Step 4: Configure Instagram (if needed)
1. Go to "Instagram Basic Display" → "Basic Display"
2. Add redirect URI: `http://localhost:5001/api/oauth/instagram/callback`
3. Instagram uses the same Facebook App ID and Secret

### Step 5: Add to .env
```bash
FACEBOOK_APP_ID=your-app-id-here
FACEBOOK_APP_SECRET=your-app-secret-here
FACEBOOK_CALLBACK_URL=http://localhost:5001/api/oauth/facebook/callback
```

**Note**: Instagram uses the same credentials as Facebook.

---

## 4. YouTube OAuth Setup

### Step 1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable "YouTube Data API v3"

### Step 2: Create OAuth Credentials
1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure OAuth consent screen:
   - **User Type**: External (or Internal for workspace)
   - **App name**: Your app name
   - **User support email**: Your email
   - **Developer contact**: Your email
   - **Scopes**: Add `https://www.googleapis.com/auth/youtube.upload`
4. Create OAuth client:
   - **Application type**: Web application
   - **Name**: Your app name
   - **Authorized redirect URIs**:
     - `http://localhost:5001/api/oauth/youtube/callback`
     - `https://your-domain.com/api/oauth/youtube/callback`

### Step 3: Get Credentials
1. After creating, copy:
   - **Client ID** → `YOUTUBE_CLIENT_ID`
   - **Client secret** → `YOUTUBE_CLIENT_SECRET`

### Step 4: Add to .env
```bash
YOUTUBE_CLIENT_ID=your-client-id-here
YOUTUBE_CLIENT_SECRET=your-client-secret-here
YOUTUBE_CALLBACK_URL=http://localhost:5001/api/oauth/youtube/callback
```

---

## 5. TikTok OAuth Setup

### Step 1: Create TikTok App
1. Go to [TikTok Developers](https://developers.tiktok.com/)
2. Sign in with your TikTok account
3. Click "Create an app"
4. Fill in:
   - **App name**: Your app name
   - **App description**: Brief description
   - **Category**: Select appropriate category
   - **Website URL**: Your website URL

### Step 2: Configure OAuth
1. Go to "Basic Information" → "Platform"
2. Add redirect URI:
   - `http://localhost:5001/api/oauth/tiktok/callback`
   - `https://your-domain.com/api/oauth/tiktok/callback`
3. Request permissions:
   - `user.info.basic` (Basic user info)
   - `video.upload` (Upload videos)
   - `video.publish` (Publish videos)

### Step 3: Get Credentials
1. In "Basic Information", copy:
   - **Client Key** → `TIKTOK_CLIENT_KEY`
   - **Client Secret** → `TIKTOK_CLIENT_SECRET`

### Step 4: Add to .env
```bash
TIKTOK_CLIENT_KEY=your-client-key-here
TIKTOK_CLIENT_SECRET=your-client-secret-here
TIKTOK_CALLBACK_URL=http://localhost:5001/api/oauth/tiktok/callback
```

---

## 📝 Complete .env Example

Here's a complete example of all OAuth variables in your `.env` file:

```bash
# ============================================
# OAUTH - TWITTER/X
# ============================================
TWITTER_CLIENT_ID=your-twitter-client-id
TWITTER_CLIENT_SECRET=your-twitter-client-secret
TWITTER_CALLBACK_URL=http://localhost:5001/api/oauth/twitter/callback

# ============================================
# OAUTH - LINKEDIN
# ============================================
LINKEDIN_CLIENT_ID=your-linkedin-client-id
LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret
LINKEDIN_CALLBACK_URL=http://localhost:5001/api/oauth/linkedin/callback

# ============================================
# OAUTH - FACEBOOK (also used for Instagram)
# ============================================
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
FACEBOOK_CALLBACK_URL=http://localhost:5001/api/oauth/facebook/callback

# ============================================
# OAUTH - YOUTUBE
# ============================================
YOUTUBE_CLIENT_ID=your-youtube-client-id
YOUTUBE_CLIENT_SECRET=your-youtube-client-secret
YOUTUBE_CALLBACK_URL=http://localhost:5001/api/oauth/youtube/callback

# ============================================
# OAUTH - TIKTOK
# ============================================
TIKTOK_CLIENT_KEY=your-tiktok-client-key
TIKTOK_CLIENT_SECRET=your-tiktok-client-secret
TIKTOK_CALLBACK_URL=http://localhost:5001/api/oauth/tiktok/callback
```

---

## ✅ Verification

After adding credentials, verify the setup:

```bash
# Run OAuth verification
npm run verify:oauth
```

This will check:
- ✅ All credentials are configured
- ✅ OAuth services are working
- ✅ Endpoints are accessible

---

## 🔒 Security Best Practices

1. **Never commit `.env` to git** - It's already in `.gitignore`
2. **Use different credentials for dev/staging/production**
3. **Rotate secrets regularly** (every 90 days recommended)
4. **Use environment-specific callback URLs**
5. **Keep secrets secure** - Use a password manager or secrets manager

---

## 🚨 Troubleshooting

### "Invalid redirect URI"
- Make sure the callback URL in `.env` matches exactly what's configured in the platform
- Check for trailing slashes
- Verify protocol (http vs https)

### "App not approved"
- Some platforms require app review for production use
- Use development/test mode for initial setup
- Check platform-specific requirements

### "Rate limit exceeded"
- OAuth platforms have rate limits
- Wait and retry
- Consider implementing retry logic

---

## 📚 Additional Resources

- [Twitter API Docs](https://developer.twitter.com/en/docs)
- [LinkedIn API Docs](https://docs.microsoft.com/en-us/linkedin/)
- [Facebook Graph API](https://developers.facebook.com/docs/graph-api)
- [YouTube Data API](https://developers.google.com/youtube/v3)
- [TikTok API Docs](https://developers.tiktok.com/doc/)

---

## 🎯 Next Steps

Once credentials are configured:
1. ✅ Run `npm run verify:oauth` to verify setup
2. ✅ Test OAuth flows end-to-end
3. ✅ Test posting functionality
4. ✅ Set up production credentials
5. ✅ Configure token refresh mechanisms

