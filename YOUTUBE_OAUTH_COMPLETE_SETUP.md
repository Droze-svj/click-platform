# ✅ YouTube OAuth - Complete Setup Checklist

Since you already have the Client ID and Callback URL configured, let's verify everything is complete:

---

## ✅ What You Have

- ✅ **Client ID:** `236680378422-65cevaheb4nogc217jvsfa4jh7eg2r8g.apps.googleusercontent.com`
- ✅ **Callback URL:** Configured in Render.com

---

## 🔍 Verify in Render.com

Go to **Render.com → Your Service → Environment** tab and check:

### Required Variables:

1. **YOUTUBE_CLIENT_ID**
   - ✅ Should be: `236680378422-65cevaheb4nogc217jvsfa4jh7eg2r8g.apps.googleusercontent.com`

2. **YOUTUBE_CLIENT_SECRET** ⚠️ **CHECK THIS**
   - Should start with: `GOCSPX-`
   - If missing or empty, you need to add it
   - Get it from: Google Cloud Console → APIs & Services → Credentials

3. **YOUTUBE_CALLBACK_URL**
   - ✅ Should be: `https://click-platform.onrender.com/api/oauth/youtube/callback`

---

## 🔍 Verify in Google Cloud Console

1. **Go to:** https://console.cloud.google.com/apis/credentials
2. **Find your OAuth 2.0 Client** (the one with Client ID: `236680378422-65cevaheb4nogc217jvsfa4jh7eg2r8g...`)
3. **Click on it** to view/edit
4. **Check "Authorized redirect URIs":**
   - Should include: `https://click-platform.onrender.com/api/oauth/youtube/callback`
   - If missing, **add it** and click **Save**

---

## ✅ Quick Verification

### Test 1: Check if Client Secret is Set

The YouTube OAuth requires both Client ID and Client Secret. If you're missing the secret:

1. **Get Client Secret from Google Cloud:**
   - Go to: https://console.cloud.google.com/apis/credentials
   - Click your OAuth 2.0 Client
   - Copy the **Client Secret** (starts with `GOCSPX-`)

2. **Add to Render.com:**
   - Go to Render.com → Environment
   - Add: `YOUTUBE_CLIENT_SECRET` = (your secret)
   - Save (auto-redeploys)

### Test 2: Verify Callback URL in Google Cloud

Make sure the callback URL is added in Google Cloud Console:
- `https://click-platform.onrender.com/api/oauth/youtube/callback`

---

## 🧪 Test OAuth Flow

Once everything is configured:

### Option 1: Test via API (requires authentication)

```bash
# 1. Register/Login to get a token
# 2. Get authorization URL
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://click-platform.onrender.com/api/oauth/youtube/authorize

# 3. Visit the URL in browser
# 4. Complete OAuth flow
# 5. Check status
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://click-platform.onrender.com/api/oauth/youtube/status
```

### Option 2: Use Helper Scripts

See `YOUTUBE_OAUTH_WALKTHROUGH.md` for detailed testing steps.

---

## 📋 Final Checklist

- [ ] `YOUTUBE_CLIENT_ID` in Render.com ✅ (you have this)
- [ ] `YOUTUBE_CLIENT_SECRET` in Render.com ⚠️ (verify this)
- [ ] `YOUTUBE_CALLBACK_URL` in Render.com ✅ (you have this)
- [ ] Callback URL added to Google Cloud Console ⚠️ (verify this)
- [ ] Service redeployed after adding variables
- [ ] OAuth flow tested

---

## 🎯 Most Likely Missing

Based on your setup, you probably need to:

1. **Add `YOUTUBE_CLIENT_SECRET` to Render.com**
   - Get it from Google Cloud Console
   - Add to Render.com environment variables

2. **Verify callback URL in Google Cloud Console**
   - Make sure it's added to "Authorized redirect URIs"

---

## ✅ Once Complete

After adding the Client Secret and verifying the callback URL:

1. **Wait for redeploy** (2-3 minutes)
2. **Test OAuth flow** (see YOUTUBE_OAUTH_WALKTHROUGH.md)
3. **Verify connection** works

---

**Quick Question:** Do you have the `YOUTUBE_CLIENT_SECRET` added to Render.com? That's usually what's missing! 🔑

