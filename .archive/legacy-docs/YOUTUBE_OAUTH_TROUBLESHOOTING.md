# YouTube OAuth Troubleshooting Guide

## Common Issues and Solutions

### 1. "An unexpected error occurred" / Internal Error

This usually means one of the following:

#### A. Redirect URI Mismatch
**Problem:** The callback URL used in authorization doesn't match the one used in token exchange.

**Solution:**
1. Check if `YOUTUBE_CALLBACK_URL` is set in Render.com
2. It should be: `https://click-platform.onrender.com/api/oauth/youtube/callback`
3. Make sure it matches exactly (including `https://`, no trailing slash)

**To verify:**
```bash
# Check what callback URL was used during authorization
# Look at the authorization URL - it should contain redirect_uri parameter
```

#### B. Authorization Code Expired
**Problem:** Authorization codes are only valid for a few minutes.

**Solution:** Start the OAuth flow again to get a fresh code.

#### C. State Mismatch
**Problem:** The state parameter doesn't match what was stored.

**Solution:** Make sure you're using the state from the same authorization session.

### 2. "Invalid OAuth state"

**Problem:** The state stored in the database doesn't match the state from the callback.

**Solution:**
1. Make sure you're using the state from the same authorization URL
2. Don't generate multiple authorization URLs - each one creates a new state
3. Complete the OAuth flow immediately after authorization

### 3. "redirect_uri_mismatch"

**Problem:** The redirect URI in the token exchange doesn't match what was registered in Google Cloud Console.

**Solution:**
1. Check Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs
2. Make sure the authorized redirect URI includes:
   - `https://click-platform.onrender.com/api/oauth/youtube/callback`
3. Make sure `YOUTUBE_CALLBACK_URL` in Render.com matches exactly

### 4. "invalid_grant"

**Problem:** The authorization code has expired or already been used.

**Solution:** Start a new OAuth flow to get a fresh authorization code.

## Step-by-Step Fix

1. **Verify Environment Variables in Render.com:**
   ```
   YOUTUBE_CLIENT_ID=your_client_id
   YOUTUBE_CLIENT_SECRET=your_client_secret
   YOUTUBE_CALLBACK_URL=https://click-platform.onrender.com/api/oauth/youtube/callback
   ```

2. **Verify Google Cloud Console:**
   - Go to Google Cloud Console
   - APIs & Services → Credentials
   - Click on your OAuth 2.0 Client ID
   - Under "Authorized redirect URIs", make sure you have:
     - `https://click-platform.onrender.com/api/oauth/youtube/callback`

3. **Start Fresh OAuth Flow:**
   ```bash
   ./scripts/complete-youtube-oauth-flow.sh
   ```

4. **Complete Immediately:**
   - After authorization, immediately run:
   ```bash
   ./scripts/finish-youtube-oauth.sh "CODE" "STATE"
   ```

## Debugging

### Check Connection Status
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://click-platform.onrender.com/api/oauth/youtube/status
```

### Check Server Logs
Look at Render.com logs for:
- `YouTube OAuth token exchange error`
- `YouTube OAuth completion error`
- Any specific error messages

### Test Token Exchange Manually
```bash
curl -X POST "https://click-platform.onrender.com/api/oauth/youtube/complete" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "YOUR_CODE",
    "state": "YOUR_STATE"
  }'
```

## Still Having Issues?

1. Check that all environment variables are set correctly
2. Verify the callback URL matches in both places (Render.com and Google Cloud Console)
3. Make sure you're using a fresh authorization code (codes expire quickly)
4. Check Render.com logs for detailed error messages
5. Try starting the OAuth flow from scratch

