# YouTube OAuth Callback URL Setup

## The Problem

The "An unexpected error occurred" error is most likely due to a **redirect URI mismatch**. This happens when:

1. The authorization URL uses one callback URL
2. The token exchange uses a different callback URL
3. Google rejects the token exchange because the URLs don't match

## The Solution

You need to set `YOUTUBE_CALLBACK_URL` in Render.com to ensure both the authorization and token exchange use the same URL.

## Step-by-Step Instructions

### 1. Add Environment Variable to Render.com

1. Go to [Render.com Dashboard](https://dashboard.render.com)
2. Click on your **click-platform** web service
3. Go to **Environment** tab
4. Click **Add Environment Variable**
5. Add:
   - **Key:** `YOUTUBE_CALLBACK_URL`
   - **Value:** `https://click-platform.onrender.com/api/oauth/youtube/callback`
6. Click **Save Changes**
7. **Wait for the service to redeploy** (this is important!)

### 2. Verify in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project
3. Go to **APIs & Services** → **Credentials**
4. Click on your OAuth 2.0 Client ID
5. Under **Authorized redirect URIs**, make sure you have:
   - `https://click-platform.onrender.com/api/oauth/youtube/callback`
6. If it's not there, click **Add URI** and add it
7. Click **Save**

### 3. Start Fresh OAuth Flow

After the service redeploys:

1. **Get a new authorization URL:**
   ```bash
   ./scripts/complete-youtube-oauth-flow.sh
   ```

2. **Complete the authorization in your browser**

3. **Immediately complete the connection:**
   ```bash
   ./scripts/finish-youtube-oauth.sh "NEW_CODE" "NEW_STATE"
   ```

## Why This Fixes It

- **Before:** The code might use different callback URLs for authorization vs token exchange
- **After:** Both use the exact same `YOUTUBE_CALLBACK_URL` from environment variables
- **Result:** Google accepts the token exchange because the redirect URI matches

## Verification

After setting `YOUTUBE_CALLBACK_URL` and redeploying, you can verify:

1. Check the authorization URL - it should use the production callback URL
2. The token exchange will use the same URL
3. The connection should complete successfully

## Important Notes

- ⚠️ **Wait for redeploy:** After adding the environment variable, Render.com will redeploy your service. Wait for this to complete before trying again.
- ⚠️ **Use fresh codes:** Authorization codes expire quickly. After redeploying, get a new authorization code.
- ⚠️ **Exact match:** The callback URL must match exactly in:
  - Render.com environment variable
  - Google Cloud Console authorized redirect URIs
  - The actual URL used in the OAuth flow

## Still Having Issues?

If you're still getting errors after setting `YOUTUBE_CALLBACK_URL`:

1. Check Render.com logs for the specific error message
2. Verify the environment variable is set correctly (no extra spaces, correct URL)
3. Make sure the service has redeployed after adding the variable
4. Try getting a fresh authorization code after redeploy

