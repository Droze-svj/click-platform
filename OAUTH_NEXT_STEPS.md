# 🚀 OAuth Setup - Next Steps Action Plan

## Current Status ✅
- [x] OAuth structure verified (all services and routes in place)
- [x] `.env` file prepared with OAuth template
- [x] Documentation created
- [ ] **NEXT: Get credentials from platforms**

---

## 📋 Step-by-Step Action Plan

### Phase 1: Get Credentials (30-60 minutes)

#### 1. Twitter/X (5-10 min) 🔵
**Priority: Start here - usually fastest**

1. Go to: https://developer.twitter.com/en/portal/dashboard
2. Sign in with your Twitter account
3. Click "Create App" or use existing app
4. Go to "Keys and tokens" tab
5. Copy:
   - **API Key** → This is your `TWITTER_CLIENT_ID`
   - **API Secret** → This is your `TWITTER_CLIENT_SECRET`
6. Set callback URL: `http://localhost:5001/api/oauth/twitter/callback`
7. Update `.env` file with these values

**Status:** [ ] Not Started | [ ] In Progress | [ ] Complete

---

#### 2. LinkedIn (10-15 min) 🔵
**Priority: High - commonly used**

1. Go to: https://www.linkedin.com/developers/
2. Sign in with your LinkedIn account
3. Click "Create app"
4. Fill in app details (name, company page, privacy policy URL)
5. Go to "Auth" tab
6. Add redirect URL: `http://localhost:5001/api/oauth/linkedin/callback`
7. Request permissions:
   - `r_liteprofile` (Basic profile)
   - `r_emailaddress` (Email)
   - `w_member_social` (Post on behalf of user)
8. Copy:
   - **Client ID** → `LINKEDIN_CLIENT_ID`
   - **Client Secret** → `LINKEDIN_CLIENT_SECRET`
9. Update `.env` file

**Status:** [ ] Not Started | [ ] In Progress | [ ] Complete

---

#### 3. Facebook (15-20 min) 🔵
**Priority: High - also covers Instagram**

1. Go to: https://developers.facebook.com/
2. Click "My Apps" → "Create App"
3. Select "Business" as app type
4. Fill in app details
5. Add "Facebook Login" product
6. Go to "Facebook Login" → "Settings"
7. Add redirect URI: `http://localhost:5001/api/oauth/facebook/callback`
8. Go to "Settings" → "Basic"
9. Copy:
   - **App ID** → `FACEBOOK_APP_ID`
   - **App Secret** → `FACEBOOK_APP_SECRET` (click "Show")
10. Update `.env` file

**Note:** Instagram uses the same credentials - no separate setup needed!

**Status:** [ ] Not Started | [ ] In Progress | [ ] Complete

---

#### 4. YouTube (10-15 min) 🟡
**Priority: Medium - if you need video upload**

1. Go to: https://console.cloud.google.com/
2. Create a new project (or select existing)
3. Enable "YouTube Data API v3":
   - Go to "APIs & Services" → "Library"
   - Search "YouTube Data API v3"
   - Click "Enable"
4. Configure OAuth consent screen:
   - Go to "APIs & Services" → "OAuth consent screen"
   - Select "External" (or "Internal" for workspace)
   - Fill in required fields
   - Add scope: `https://www.googleapis.com/auth/youtube.upload`
5. Create OAuth credentials:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: "Web application"
   - Add redirect URI: `http://localhost:5001/api/oauth/youtube/callback`
6. Copy:
   - **Client ID** → `YOUTUBE_CLIENT_ID`
   - **Client secret** → `YOUTUBE_CLIENT_SECRET`
7. Update `.env` file

**Status:** [ ] Not Started | [ ] In Progress | [ ] Complete

---

#### 5. TikTok (10-15 min) 🟡
**Priority: Medium - if you need TikTok posting**

1. Go to: https://developers.tiktok.com/
2. Sign in with your TikTok account
3. Click "Create an app"
4. Fill in app details:
   - App name
   - Description
   - Category
   - Website URL
5. Go to "Basic Information" → "Platform"
6. Add redirect URI: `http://localhost:5001/api/oauth/tiktok/callback`
7. Request permissions:
   - `user.info.basic` (Basic user info)
   - `video.upload` (Upload videos)
   - `video.publish` (Publish videos)
8. Copy:
   - **Client Key** → `TIKTOK_CLIENT_KEY`
   - **Client Secret** → `TIKTOK_CLIENT_SECRET`
9. Update `.env` file

**Status:** [ ] Not Started | [ ] In Progress | [ ] Complete

---

### Phase 2: Update .env File (5 minutes)

1. Open `.env` file in your editor
2. Find the OAuth section (should be at the bottom)
3. Replace all placeholder values with actual credentials:
   ```bash
   # Replace these:
   TWITTER_CLIENT_ID=your-twitter-client-id
   # With:
   TWITTER_CLIENT_ID=abc123xyz789  # Your actual API Key
   ```
4. Save the file

**Status:** [ ] Not Started | [ ] Complete

---

### Phase 3: Verify Setup (2 minutes)

Run the verification script:

```bash
npm run verify:oauth
```

Expected output:
- ✅ All platforms configured
- ✅ Ready for testing

**Status:** [ ] Not Started | [ ] Complete

---

### Phase 4: Test OAuth Flows (Optional - 10-15 min)

Once verified, test the actual OAuth flows:

1. Start your server (if not running):
   ```bash
   npm run dev:server
   ```

2. Test authorization URLs:
   - Each platform should generate an authorization URL
   - You can test these in your browser

3. Complete OAuth flow:
   - Click authorization URL
   - Authorize the app
   - Verify callback is handled correctly

**Status:** [ ] Not Started | [ ] Complete

---

## 🎯 Recommended Order

**Start with these (easiest/fastest):**
1. Twitter/X ⚡ (5-10 min)
2. LinkedIn ⚡ (10-15 min)
3. Facebook ⚡ (15-20 min, covers Instagram too)

**Then add these if needed:**
4. YouTube (if you need video upload)
5. TikTok (if you need TikTok posting)

---

## 💡 Tips

1. **Start with one platform** - Get Twitter working first, then add others
2. **Use development mode** - All platforms allow testing without full approval
3. **Save credentials securely** - Use a password manager
4. **Test incrementally** - Verify each platform as you add it
5. **Check callback URLs** - Make sure they match exactly (no trailing slashes)

---

## 🆘 Need Help?

If you get stuck on any platform:
1. Check `OAUTH_SETUP_GUIDE.md` for detailed instructions
2. Check platform-specific error messages
3. Verify callback URLs match exactly
4. Make sure you've enabled the right permissions/scopes

---

## ✅ Completion Checklist

- [ ] Twitter/X credentials obtained and added to `.env`
- [ ] LinkedIn credentials obtained and added to `.env`
- [ ] Facebook credentials obtained and added to `.env`
- [ ] YouTube credentials obtained and added to `.env` (if needed)
- [ ] TikTok credentials obtained and added to `.env` (if needed)
- [ ] `.env` file saved with all credentials
- [ ] Ran `npm run verify:oauth` - all platforms verified
- [ ] Tested at least one OAuth flow end-to-end

---

## 🚀 Quick Commands

```bash
# Verify OAuth setup
npm run verify:oauth

# Check OAuth structure (no credentials needed)
npm run verify:oauth:structure

# View quick reference
cat OAUTH_QUICK_REFERENCE.md

# View detailed guide
cat OAUTH_SETUP_GUIDE.md
```

---

**Ready to start? Begin with Twitter/X - it's usually the quickest! 🐦**

