# 📺 YouTube OAuth Setup for Render.com

**Your Client ID:** `236680378422-65cevaheb4nogc217jvsfa4jh7eg2r8g.apps.googleusercontent.com`

---

## ✅ Step 1: Add to Render.com Environment Variables

### Add YouTube Client ID

1. **Go to Render.com Dashboard**
   - Visit: https://dashboard.render.com
   - Click your service: **click-platform**

2. **Navigate to Environment Variables**
   - Click **Environment** tab
   - Scroll to see existing variables

3. **Add YouTube Client ID**
   - Click **Add Environment Variable**
   - **Key:** `YOUTUBE_CLIENT_ID`
   - **Value:** `236680378422-65cevaheb4nogc217jvsfa4jh7eg2r8g.apps.googleusercontent.com`
   - Click **Save Changes**

### Add YouTube Client Secret

You'll need your **Client Secret** from Google Cloud Console:

1. **Get Client Secret**
   - Go to: https://console.cloud.google.com/apis/credentials
   - Find your OAuth 2.0 Client (the one with the Client ID above)
   - Click on it to view details
   - Copy the **Client Secret** (if it's masked, you may need to create a new one)

2. **Add to Render.com**
   - Click **Add Environment Variable**
   - **Key:** `YOUTUBE_CLIENT_SECRET`
   - **Value:** Your client secret (starts with `GOCSPX-`)
   - Click **Save Changes**

### Add Callback URL

1. **Add Callback URL Variable**
   - Click **Add Environment Variable**
   - **Key:** `YOUTUBE_CALLBACK_URL`
   - **Value:** `https://click-platform.onrender.com/api/oauth/youtube/callback`
   - Click **Save Changes**

---

## ✅ Step 2: Update Google Cloud Console

### Update Authorized Redirect URIs

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/apis/credentials
   - Find your OAuth 2.0 Client
   - Click on it to edit

2. **Add Production Callback URL**
   - Under **Authorized redirect URIs**, click **Add URI**
   - Add: `https://click-platform.onrender.com/api/oauth/youtube/callback`
   - Click **Save**

3. **Update Authorized JavaScript Origins** (if needed)
   - Add: `https://click-platform.onrender.com`
   - Click **Save**

---

## ✅ Step 3: Wait for Redeploy

Render.com will automatically redeploy after you add environment variables (2-3 minutes).

---

## ✅ Step 4: Verify Setup

### Check YouTube OAuth Status

After deployment, test:

```bash
curl https://click-platform.onrender.com/api/oauth/youtube/status
```

**Expected:** Should show YouTube OAuth is configured (may require authentication token).

### Test Authorization URL

```bash
# Get authorization URL (requires user authentication)
curl https://click-platform.onrender.com/api/oauth/youtube/authorize
```

---

## 📋 Environment Variables Summary

Add these to Render.com:

| Variable | Value |
|----------|-------|
| `YOUTUBE_CLIENT_ID` | `236680378422-65cevaheb4nogc217jvsfa4jh7eg2r8g.apps.googleusercontent.com` |
| `YOUTUBE_CLIENT_SECRET` | `GOCSPX-...` (get from Google Cloud Console) |
| `YOUTUBE_CALLBACK_URL` | `https://click-platform.onrender.com/api/oauth/youtube/callback` |

---

## 🔍 Where to Find Client Secret

If you don't have the Client Secret:

1. Go to: https://console.cloud.google.com/apis/credentials
2. Find your OAuth 2.0 Client
3. Click on it
4. The Client Secret should be visible (or masked)
5. If masked, you may need to:
   - Create a new OAuth client, OR
   - Reset the secret (creates a new one)

---

## ✅ Quick Checklist

- [ ] `YOUTUBE_CLIENT_ID` added to Render.com
- [ ] `YOUTUBE_CLIENT_SECRET` added to Render.com
- [ ] `YOUTUBE_CALLBACK_URL` added to Render.com
- [ ] Callback URL added to Google Cloud Console
- [ ] Service redeployed
- [ ] YouTube OAuth status verified

---

## 🎯 Next Steps After Setup

Once YouTube OAuth is configured:

1. **Test OAuth Flow**
   - Initiate authorization
   - Complete OAuth flow
   - Verify connection

2. **Test YouTube Features**
   - Upload video
   - Get channel info
   - Manage playlists

3. **Set Up Other OAuth Providers**
   - Twitter/X
   - LinkedIn
   - Facebook

---

**Need the Client Secret?** Check Google Cloud Console → APIs & Services → Credentials → Your OAuth Client

