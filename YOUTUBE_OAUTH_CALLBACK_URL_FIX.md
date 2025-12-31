# 🔧 YouTube OAuth Callback URL Fix

## ⚠️ Issue Found

The authorization URL is using `localhost:5001` instead of your Render.com URL.

**Current (Wrong):**
```
http://localhost:5001/api/oauth/youtube/callback
```

**Should Be:**
```
https://click-platform.onrender.com/api/oauth/youtube/callback
```

---

## ✅ Solution: Add YOUTUBE_CALLBACK_URL to Render.com

### Step 1: Add Environment Variable

1. **Go to Render.com Dashboard**
   - Visit: https://dashboard.render.com
   - Click your service: **click-platform**

2. **Add YOUTUBE_CALLBACK_URL**
   - Click **Environment** tab
   - Click **Add Environment Variable**
   - **Key:** `YOUTUBE_CALLBACK_URL`
   - **Value:** `https://click-platform.onrender.com/api/oauth/youtube/callback`
   - Click **Save Changes**

3. **Wait for Redeploy**
   - Render.com will auto-redeploy (2-3 minutes)

---

## ✅ Step 2: Update Google Cloud Console

Make sure the callback URL is also added in Google Cloud:

1. **Go to:** https://console.cloud.google.com/apis/credentials
2. **Click your OAuth 2.0 Client**
3. **Under "Authorized redirect URIs":**
   - Add: `https://click-platform.onrender.com/api/oauth/youtube/callback`
   - **Also add:** `http://localhost:5001/api/oauth/youtube/callback` (for local testing)
   - Click **Save**

---

## ✅ Step 3: Test Again

After adding `YOUTUBE_CALLBACK_URL` and redeploying:

1. **Run the script again:**
   ```bash
   ./scripts/complete-youtube-oauth-flow.sh
   ```

2. **The authorization URL should now use:**
   ```
   https://click-platform.onrender.com/api/oauth/youtube/callback
   ```

3. **Complete the OAuth flow** as before

---

## 🔍 Why This Happened

The code falls back to `req.get('host')` if `YOUTUBE_CALLBACK_URL` is not set. In some cases, this can return `localhost` instead of the actual domain.

**Fix:** Always set `YOUTUBE_CALLBACK_URL` in production to avoid this issue.

---

## 📋 Quick Checklist

- [ ] `YOUTUBE_CALLBACK_URL` added to Render.com
- [ ] Service redeployed
- [ ] Callback URL added to Google Cloud Console
- [ ] Test authorization URL (should use Render.com URL now)

---

**After adding the environment variable, the authorization URL will use the correct callback!** 🚀

