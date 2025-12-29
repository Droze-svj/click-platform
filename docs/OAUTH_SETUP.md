# OAuth Integration Setup Guide

This guide will help you set up OAuth integrations for LinkedIn, Facebook, Instagram, and Twitter.

---

## 📋 Prerequisites

1. Developer accounts for each platform:
   - [Twitter Developer Portal](https://developer.twitter.com/)
   - [LinkedIn Developer Portal](https://www.linkedin.com/developers/)
   - [Facebook Developer Portal](https://developers.facebook.com/)

2. A registered application on each platform

---

## 🔐 Environment Variables

Add these to your `.env` file:

### Twitter/X OAuth
```env
TWITTER_CLIENT_ID=your_twitter_client_id
TWITTER_CLIENT_SECRET=your_twitter_client_secret
TWITTER_CALLBACK_URL=https://yourdomain.com/api/oauth/twitter/callback
```

### LinkedIn OAuth
```env
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
LINKEDIN_CALLBACK_URL=https://yourdomain.com/api/oauth/linkedin/callback
```

### Facebook OAuth (also used for Instagram)
```env
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
FACEBOOK_CALLBACK_URL=https://yourdomain.com/api/oauth/facebook/callback
```

### Frontend URL
```env
FRONTEND_URL=https://yourdomain.com
```

---

## 🐦 Twitter/X Setup

### 1. Create Twitter App
1. Go to [Twitter Developer Portal](https://developer.twitter.com/)
2. Create a new app or use an existing one
3. Navigate to **Settings** → **User authentication settings**

### 2. Configure OAuth 2.0
- **App permissions**: Read and write
- **Type of App**: Web App, Automated App or Bot
- **Callback URI**: `https://yourdomain.com/api/oauth/twitter/callback`
- **Website URL**: `https://yourdomain.com`

### 3. Get Credentials
- Copy **Client ID** and **Client Secret**
- Add to `.env` file

### 4. Required Scopes
- `tweet.read`
- `tweet.write`
- `users.read`
- `offline.access`

---

## 💼 LinkedIn Setup

### 1. Create LinkedIn App
1. Go to [LinkedIn Developer Portal](https://www.linkedin.com/developers/)
2. Create a new app
3. Go to **Auth** tab

### 2. Configure OAuth
- **Authorized redirect URLs**: `https://yourdomain.com/api/oauth/linkedin/callback`
- **Products**: Request access to "Sign In with LinkedIn using OpenID Connect"

### 3. Get Credentials
- Copy **Client ID** and **Client Secret**
- Add to `.env` file

### 4. Required Scopes
- `openid`
- `profile`
- `email`
- `w_member_social` (for posting)

---

## 📘 Facebook Setup

### 1. Create Facebook App
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app
3. Add **Facebook Login** product

### 2. Configure OAuth
- **Valid OAuth Redirect URIs**: `https://yourdomain.com/api/oauth/facebook/callback`
- **App Domains**: `yourdomain.com`

### 3. Get Credentials
- Copy **App ID** and **App Secret**
- Add to `.env` file

### 4. Required Permissions
- `pages_manage_posts`
- `pages_read_engagement`
- `pages_show_list`
- `public_profile`

### 5. For Instagram (requires Facebook)
- Connect a Facebook Page to your app
- The page must have an Instagram Business account linked
- Instagram posting uses Facebook Graph API

---

## 📷 Instagram Setup (via Facebook)

Instagram OAuth is handled through Facebook:

1. **Connect Facebook** (see above)
2. **Link Instagram Business Account**:
   - Go to Facebook Page Settings
   - Connect Instagram Business account
   - Ensure the account is a Business or Creator account

3. **Get Instagram Account ID**:
   - Use the `/api/oauth/instagram/accounts` endpoint
   - This will list all connected Instagram Business accounts

---

## 📺 YouTube Setup

### 1. Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **YouTube Data API v3**

### 2. Configure OAuth
- Go to **APIs & Services** → **Credentials**
- Create **OAuth 2.0 Client ID**
- Application type: **Web application**
- **Authorized redirect URIs**: `https://yourdomain.com/api/oauth/youtube/callback`

### 3. Get Credentials
- Copy **Client ID** and **Client Secret**
- Add to `.env` file

### 4. Required Scopes
- `https://www.googleapis.com/auth/youtube.upload`
- `https://www.googleapis.com/auth/youtube`
- `https://www.googleapis.com/auth/youtube.force-ssl`

---

## 🎵 TikTok Setup

### 1. Create TikTok App
1. Go to [TikTok Developers](https://developers.tiktok.com/)
2. Create a new app
3. Add **Video Upload** and **Video Publish** products

### 2. Configure OAuth
- Go to **Basic Information**
- Add **Redirect URI**: `https://yourdomain.com/api/oauth/tiktok/callback`
- Request permissions: `user.info.basic`, `video.upload`, `video.publish`

### 3. Get Credentials
- Copy **Client Key** and **Client Secret**
- Add to `.env` file

### 4. Required Scopes
- `user.info.basic`
- `video.upload`
- `video.publish`

---

## 🧪 Testing

### Test OAuth Flow
1. Start your server: `npm run dev`
2. Navigate to `/dashboard/social`
3. Click "Connect" on a platform
4. Complete OAuth flow
5. Verify connection status

### Test Endpoints
```bash
# Check status
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5001/api/oauth/twitter/status

# Get authorization URL
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5001/api/oauth/linkedin/authorize

# Check health
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5001/api/oauth/health
```

---

## 🔧 Troubleshooting

### Common Issues

**1. "OAuth not configured" error**
- Check that environment variables are set
- Restart server after adding env vars

**2. "Invalid redirect URI"**
- Ensure callback URL matches exactly in developer portal
- Check for trailing slashes
- Verify HTTPS in production

**3. "Token expired"**
- LinkedIn and Twitter tokens auto-refresh
- Facebook tokens are long-lived (60 days)
- Reconnect if refresh fails

**4. Instagram not showing**
- Requires Facebook connection first
- Instagram account must be Business/Creator
- Page must be linked to Instagram account

---

## 📚 API Endpoints

### Twitter
- `GET /api/oauth/twitter/authorize` - Get auth URL
- `GET /api/oauth/twitter/callback` - OAuth callback
- `POST /api/oauth/twitter/post` - Post tweet
- `DELETE /api/oauth/twitter/disconnect` - Disconnect
- `GET /api/oauth/twitter/status` - Get status

### LinkedIn
- `GET /api/oauth/linkedin/authorize` - Get auth URL
- `GET /api/oauth/linkedin/callback` - OAuth callback
- `POST /api/oauth/linkedin/complete` - Complete connection
- `POST /api/oauth/linkedin/post` - Post to LinkedIn
- `DELETE /api/oauth/linkedin/disconnect` - Disconnect
- `GET /api/oauth/linkedin/status` - Get status

### Facebook
- `GET /api/oauth/facebook/authorize` - Get auth URL
- `GET /api/oauth/facebook/callback` - OAuth callback
- `POST /api/oauth/facebook/complete` - Complete connection
- `GET /api/oauth/facebook/pages` - Get pages
- `POST /api/oauth/facebook/post` - Post to Facebook
- `DELETE /api/oauth/facebook/disconnect` - Disconnect
- `GET /api/oauth/facebook/status` - Get status

### Instagram
- `GET /api/oauth/instagram/accounts` - Get accounts
- `POST /api/oauth/instagram/post` - Post image
- `DELETE /api/oauth/instagram/disconnect` - Disconnect
- `GET /api/oauth/instagram/status` - Get status

### Health Check
- `GET /api/oauth/health` - Check all connections
- `POST /api/oauth/health/refresh` - Refresh expired tokens

---

## ✅ Checklist

- [ ] Twitter app created and configured
- [ ] LinkedIn app created and configured
- [ ] Facebook app created and configured
- [ ] Instagram Business account linked to Facebook Page
- [ ] All environment variables set
- [ ] Callback URLs configured correctly
- [ ] OAuth flows tested
- [ ] Posting functionality tested
- [ ] Health checks working

---

## 🚀 Production Deployment

1. **Update Callback URLs** to production domain
2. **Set environment variables** in production environment
3. **Test OAuth flows** in production
4. **Monitor health checks** regularly
5. **Set up alerts** for token expiration

---

## 📞 Support

For issues or questions:
- Check logs: `logs/error.log`
- Review OAuth health: `/api/oauth/health`
- Check platform-specific error messages



