# 🧪 YouTube OAuth Testing Guide

**Status:** ✅ All credentials configured!

Now let's test the YouTube OAuth connection.

---

## ✅ What You Have Configured

- ✅ **Client ID:** `236680378422-65cevaheb4nogc217jvsfa4jh7eg2r8g.apps.googleusercontent.com`
- ✅ **Client Secret:** Configured in Render.com
- ✅ **Callback URL:** `https://click-platform.onrender.com/api/oauth/youtube/callback`

---

## 🔍 Final Verification

### 1. Verify Google Cloud Console

Make sure the callback URL is added:

1. **Go to:** https://console.cloud.google.com/apis/credentials
2. **Click your OAuth 2.0 Client**
3. **Check "Authorized redirect URIs":**
   - Should include: `https://click-platform.onrender.com/api/oauth/youtube/callback`
   - If missing, **add it** and **Save**

### 2. Verify Render.com Variables

In Render.com → Environment tab, verify:
- `YOUTUBE_CLIENT_ID` is set
- `YOUTUBE_CLIENT_SECRET` is set
- `YOUTUBE_CALLBACK_URL` is set to: `https://click-platform.onrender.com/api/oauth/youtube/callback`

---

## 🧪 Test OAuth Flow

### Step 1: Get Authorization URL

You'll need to be authenticated. Here's how to test:

**Option A: Using API (requires authentication token)**

1. **First, register/login to get a token:**
   ```bash
   # Register a test user
   curl -X POST https://click-platform.onrender.com/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "password": "Test123!@#",
       "name": "Test User"
     }'
   
   # Login to get token
   curl -X POST https://click-platform.onrender.com/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "password": "Test123!@#"
     }'
   ```

2. **Get authorization URL (use token from login):**
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://click-platform.onrender.com/api/oauth/youtube/authorize
   ```

3. **Visit the URL** in your browser to authorize

**Option B: Direct Browser Test**

1. **Register/Login** through your frontend (if available)
2. **Navigate to:** YouTube OAuth connection page
3. **Click "Connect YouTube"** button
4. **Complete OAuth flow**

---

## 📋 OAuth Flow Steps

1. **Get Authorization URL**
   - API returns: `{ url: "...", state: "..." }`
   - This is the Google OAuth URL

2. **Visit URL in Browser**
   - Google will ask for permissions
   - You'll be redirected to callback URL with `code` and `state`

3. **Complete Connection**
   - Call `/api/oauth/youtube/complete` with `code` and `state`
   - Or the callback will handle it automatically

4. **Verify Connection**
   - Check status: `/api/oauth/youtube/status`
   - Should show `connected: true`

---

## 🔍 Check Current Status

After setting up, you can check if YouTube OAuth is configured:

```bash
# This requires authentication, but will show if OAuth is set up
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://click-platform.onrender.com/api/oauth/youtube/status
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "connected": false,
    "configured": true,
    "connectedAt": null
  }
}
```

---

## ✅ Success Indicators

You'll know it's working when:

1. **Authorization URL is generated** (no 503 error)
2. **Google OAuth page loads** when visiting the URL
3. **Callback redirects successfully** after authorization
4. **Status shows `connected: true`** after completion

---

## 🆘 Troubleshooting

### "YouTube OAuth not configured" Error

- Check `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET` in Render.com
- Verify service has redeployed after adding variables

### "Invalid redirect URI" Error

- Check callback URL in Google Cloud Console
- Must match exactly: `https://click-platform.onrender.com/api/oauth/youtube/callback`
- No trailing slashes or extra characters

### "Access blocked" Error

- Add your email as a test user in Google Cloud Console
- Go to: OAuth Consent Screen → Test Users → Add Users

---

## 🎯 Next Steps

Once YouTube OAuth is working:

1. **Test Video Upload** (if implemented)
2. **Test Channel Info** retrieval
3. **Set Up Other OAuth Providers** (Twitter, LinkedIn, etc.)

---

**Ready to test?** Start with getting an authorization URL! 🚀

