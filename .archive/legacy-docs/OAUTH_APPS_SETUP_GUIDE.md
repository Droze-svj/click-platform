# 🔐 OAuth Apps Setup Guide

**Date**: Current  
**Purpose**: Step-by-step guide for creating OAuth apps on each platform

---

## 📋 Overview

This guide will help you create OAuth applications for each social media platform. You'll need these credentials to configure Click for production.

**Estimated Time**: 30-60 minutes per platform

---

## 1. LinkedIn OAuth Setup

### Step 1: Create LinkedIn Developer Account

1. **Go to**: https://www.linkedin.com/developers/
2. **Sign in** with your LinkedIn account
3. **Create app**:
   - Click "Create app"
   - Fill in app details:
     - App name: "Click"
     - Company: Your company name
     - Privacy policy URL: `https://your-domain.com/privacy`
     - App logo: Upload your logo
   - Accept terms and create

### Step 2: Configure OAuth Settings

1. **Go to "Auth" tab**
2. **Add redirect URL**:
   ```
   https://your-domain.com/api/oauth/linkedin/callback
   ```
3. **Request permissions**:
   - `openid`
   - `profile`
   - `email`
   - `w_member_social` (for posting)

### Step 3: Get Credentials

1. **Go to "Auth" tab**
2. **Copy**:
   - Client ID
   - Client Secret

### Step 4: Add to Environment

```env
LINKEDIN_CLIENT_ID=your-client-id
LINKEDIN_CLIENT_SECRET=your-client-secret
LINKEDIN_CALLBACK_URL=https://your-domain.com/api/oauth/linkedin/callback
```

**Time**: ~15 minutes  
**Cost**: Free

---

## 2. Facebook OAuth Setup

### Step 1: Create Facebook App

1. **Go to**: https://developers.facebook.com/
2. **Click "My Apps" → "Create App"**
3. **Choose app type**: "Business"
4. **Fill in details**:
   - App name: "Click"
   - Contact email: Your email
   - Business account: (optional)

### Step 2: Add Facebook Login Product

1. **Go to App Dashboard**
2. **Click "Add Product"**
3. **Find "Facebook Login"** and click "Set Up"
4. **Choose "Web"** platform

### Step 3: Configure OAuth Settings

1. **Go to "Settings" → "Basic"**
2. **Add platform**: Web
3. **Site URL**: `https://your-domain.com`
4. **Valid OAuth Redirect URIs**:
   ```
   https://your-domain.com/api/oauth/facebook/callback
   ```

### Step 4: Request Permissions

1. **Go to "App Review" → "Permissions and Features"**
2. **Request permissions**:
   - `pages_manage_posts` (for posting to pages)
   - `pages_read_engagement` (for analytics)
   - `pages_show_list` (to list pages)
   - `public_profile` (basic profile)

### Step 5: Get Credentials

1. **Go to "Settings" → "Basic"**
2. **Copy**:
   - App ID
   - App Secret (click "Show")

### Step 6: Add to Environment

```env
FACEBOOK_APP_ID=your-app-id
FACEBOOK_APP_SECRET=your-app-secret
FACEBOOK_CALLBACK_URL=https://your-domain.com/api/oauth/facebook/callback
```

**Note**: Facebook app is also used for Instagram (via Facebook Graph API)

**Time**: ~20 minutes  
**Cost**: Free

---

## 3. Instagram OAuth Setup

### Prerequisites

- Facebook app must be created first
- Instagram Business account required
- Facebook Page linked to Instagram account

### Step 1: Link Instagram to Facebook Page

1. **Go to your Facebook Page**
2. **Settings → Instagram**
3. **Connect Instagram account**
4. **Convert to Business account** (if not already)

### Step 2: Configure Instagram Graph API

1. **Go to Facebook App Dashboard**
2. **Add Product**: "Instagram Graph API"
3. **Configure**:
   - Use case: "Manage Instagram content"
   - Business account: Select your account

### Step 3: Request Permissions

1. **Go to "App Review"**
2. **Request permissions**:
   - `instagram_basic`
   - `instagram_content_publish` (for posting)
   - `pages_read_engagement`

### Step 4: Test Instagram Connection

1. **Use Facebook app credentials** (same as Facebook)
2. **Test via Graph API Explorer**:
   ```
   GET /me/accounts
   GET /{page-id}?fields=instagram_business_account
   ```

**Time**: ~30 minutes (includes Facebook setup)  
**Cost**: Free

---

## 4. TikTok OAuth Setup

### Step 1: Create TikTok Developer Account

1. **Go to**: https://developers.tiktok.com/
2. **Sign in** with your TikTok account
3. **Create app**:
   - Click "Create an app"
   - Fill in details:
     - App name: "Click"
     - App description: "Content management platform"
     - Category: "Business"
     - Website: `https://your-domain.com`
   - Submit for review

### Step 2: Configure OAuth Settings

1. **Go to "Basic Information"**
2. **Add redirect URI**:
   ```
   https://your-domain.com/api/oauth/tiktok/callback
   ```
3. **Request scopes**:
   - `user.info.basic`
   - `video.upload`
   - `video.publish`

### Step 3: Get Credentials

1. **Go to "Basic Information"**
2. **Copy**:
   - Client Key
   - Client Secret

### Step 4: Add to Environment

```env
TIKTOK_CLIENT_KEY=your-client-key
TIKTOK_CLIENT_SECRET=your-client-secret
TIKTOK_CALLBACK_URL=https://your-domain.com/api/oauth/tiktok/callback
```

**Note**: TikTok app review may take 1-3 business days

**Time**: ~20 minutes + review time  
**Cost**: Free

---

## 5. YouTube OAuth Setup

### Step 1: Create Google Cloud Project

1. **Go to**: https://console.cloud.google.com/
2. **Create project**:
   - Project name: "Click"
   - Organization: (optional)
   - Location: (optional)

### Step 2: Enable YouTube Data API

1. **Go to "APIs & Services" → "Library"**
2. **Search for "YouTube Data API v3"**
3. **Click "Enable"**

### Step 3: Create OAuth Credentials

1. **Go to "APIs & Services" → "Credentials"**
2. **Click "Create Credentials" → "OAuth client ID"**
3. **Configure consent screen** (if first time):
   - User type: External
   - App name: "Click"
   - User support email: Your email
   - Developer contact: Your email
   - Scopes: Add YouTube Data API v3 scopes
4. **Create OAuth client**:
   - Application type: Web application
   - Name: "Click Web Client"
   - Authorized redirect URIs:
     ```
     https://your-domain.com/api/oauth/youtube/callback
     ```

### Step 4: Get Credentials

1. **Go to "Credentials"**
2. **Click on your OAuth client**
3. **Copy**:
   - Client ID
   - Client Secret

### Step 5: Add to Environment

```env
YOUTUBE_CLIENT_ID=your-client-id
YOUTUBE_CLIENT_SECRET=your-client-secret
YOUTUBE_CALLBACK_URL=https://your-domain.com/api/oauth/youtube/callback
```

**Time**: ~20 minutes  
**Cost**: Free (with quotas)

---

## 6. Twitter/X OAuth Setup

### Step 1: Create Twitter Developer Account

1. **Go to**: https://developer.twitter.com/
2. **Sign in** with your Twitter account
3. **Apply for developer access**:
   - Fill in application form
   - Explain use case: "Content management and scheduling platform"
   - Wait for approval (usually instant to 24 hours)

### Step 2: Create App

1. **Go to Developer Portal**
2. **Click "Create App"**
3. **Fill in details**:
   - App name: "Click"
   - App description: "Content management platform"
   - Website: `https://your-domain.com`
   - Callback URL:
     ```
     https://your-domain.com/api/oauth/twitter/callback
     ```

### Step 3: Configure Permissions

1. **Go to "App Settings"**
2. **Set app permissions**:
   - Read and Write (for posting)
   - Request email (optional)

### Step 4: Get Credentials

1. **Go to "Keys and Tokens"**
2. **Copy**:
   - API Key (Client ID)
   - API Secret (Client Secret)
   - Bearer Token (optional)

### Step 5: Add to Environment

```env
TWITTER_CLIENT_ID=your-api-key
TWITTER_CLIENT_SECRET=your-api-secret
TWITTER_CALLBACK_URL=https://your-domain.com/api/oauth/twitter/callback
```

**Time**: ~15 minutes + approval time  
**Cost**: Free (with rate limits)

---

## 7. Quick Setup Checklist

### OAuth Apps Checklist

- [ ] LinkedIn app created
- [ ] LinkedIn credentials obtained
- [ ] Facebook app created
- [ ] Facebook credentials obtained
- [ ] Instagram connected to Facebook
- [ ] TikTok app created
- [ ] TikTok credentials obtained
- [ ] YouTube OAuth client created
- [ ] YouTube credentials obtained
- [ ] Twitter developer account approved
- [ ] Twitter app created
- [ ] Twitter credentials obtained

### Configuration Checklist

- [ ] All credentials added to `.env.production`
- [ ] Callback URLs configured correctly
- [ ] Permissions requested and approved
- [ ] Test OAuth configuration: `npm run test:oauth:all`

---

## 8. Testing OAuth Configuration

After setting up all OAuth apps:

```bash
# Test all OAuth configurations
npm run test:oauth:all

# Test specific platform
npm run test:oauth linkedin
npm run test:oauth facebook
npm run test:oauth tiktok
npm run test:oauth youtube
```

---

## 9. Common Issues

### Issue: "Invalid redirect URI"
**Solution**: 
- Ensure callback URL matches exactly in OAuth app settings
- Check for trailing slashes
- Verify HTTPS is used

### Issue: "App not approved"
**Solution**:
- Complete app review process
- Provide detailed use case
- Wait for approval (can take 1-3 days)

### Issue: "Insufficient permissions"
**Solution**:
- Request required permissions in app settings
- Complete app review for sensitive permissions
- Verify permissions are granted

### Issue: "Rate limit exceeded"
**Solution**:
- Check platform rate limits
- Implement rate limiting in your app
- Request higher limits if needed

---

## 10. Production vs Development

### Development
- Use `http://localhost:5001` for callbacks
- Test with development credentials
- Use sandbox/test environments when available

### Production
- Use `https://your-domain.com` for callbacks
- Use production credentials
- Complete app review process
- Monitor rate limits

---

## 📚 Platform-Specific Resources

- **LinkedIn**: https://docs.microsoft.com/en-us/linkedin/
- **Facebook**: https://developers.facebook.com/docs/
- **Instagram**: https://developers.facebook.com/docs/instagram-api/
- **TikTok**: https://developers.tiktok.com/doc/
- **YouTube**: https://developers.google.com/youtube/v3
- **Twitter**: https://developer.twitter.com/en/docs

---

**Last Updated**: Current  
**Status**: Ready for Use


