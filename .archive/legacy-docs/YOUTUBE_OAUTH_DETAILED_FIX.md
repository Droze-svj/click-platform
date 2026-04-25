# 🔧 Detailed Fix for YouTube OAuth Issues

## Common Problems & Step-by-Step Solutions

---

## Problem 1: "Access blocked" Error

### Symptoms:
- You see "Access blocked: Click has not completed the Google verification process"
- Even after adding test users

### Solution:

#### Step 1: Verify OAuth Consent Screen Configuration
1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. Check these settings:

**Required Settings:**
- ✅ **App name**: Must be filled (e.g., "Click Content Platform")
- ✅ **User support email**: Your email address
- ✅ **Developer contact information**: Your email address
- ✅ **App domain**: Can be left blank for testing
- ✅ **Authorized domains**: Can be left blank for testing

#### Step 2: Check Publishing Status
1. Look for **"Publishing status"** at the top
2. Should say **"Testing"** (not "In production")
3. If it says "In production":
   - You MUST add test users
   - Or switch back to "Testing" mode

#### Step 3: Add Test Users (CRITICAL)
1. Scroll to **"Test users"** section
2. Click **"Add Users"**
3. **IMPORTANT**: Add the EXACT email you use to sign in
   - If you sign in with `yourname@gmail.com`, add `yourname@gmail.com`
   - If you sign in with `yourname@company.com`, add `yourname@company.com`
   - Check for typos!
4. Click **"Add"**
5. Click **"Save"** at the bottom of the page
6. **Wait 5-10 minutes** for changes to propagate

#### Step 4: Verify Scopes
1. In OAuth consent screen, check **"Scopes"** section
2. Should include:
   - `https://www.googleapis.com/auth/youtube.upload`
   - `https://www.googleapis.com/auth/youtube`
   - `https://www.googleapis.com/auth/youtube.force-ssl`

---

## Problem 2: Wrong Email or Account

### Symptoms:
- Test user added but still getting blocked
- Can't sign in with test user

### Solution:

1. **Check the exact email:**
   - Go to: https://myaccount.google.com/
   - See what email you're signed in with
   - Make sure this EXACT email is in test users list

2. **Common mistakes:**
   - `name@gmail.com` vs `name@googlemail.com` (different!)
   - `name@gmail.com` vs `Name@gmail.com` (case doesn't matter, but be consistent)
   - Personal email vs work email (must match exactly)

3. **Add all possible emails:**
   - If unsure, add both personal and work emails
   - Add any aliases you might use

---

## Problem 3: Redirect URI Mismatch

### Symptoms:
- Authorization works but callback fails
- "redirect_uri_mismatch" error

### Solution:

1. **Check your .env file:**
   ```bash
   YOUTUBE_CALLBACK_URL=http://localhost:5001/api/oauth/youtube/callback
   ```

2. **Verify in Google Cloud Console:**
   - Go to: https://console.cloud.google.com/apis/credentials
   - Click on your OAuth 2.0 Client ID
   - Check **"Authorized redirect URIs"**
   - Must include EXACTLY: `http://localhost:5001/api/oauth/youtube/callback`
   - **No trailing slash!**
   - **Exact match required!**

3. **Common mistakes:**
   - ❌ `http://localhost:5001/api/oauth/youtube/callback/` (trailing slash)
   - ❌ `https://localhost:5001/api/oauth/youtube/callback` (https instead of http)
   - ❌ `http://127.0.0.1:5001/api/oauth/youtube/callback` (127.0.0.1 instead of localhost)

---

## Problem 4: OAuth Consent Screen Not Complete

### Symptoms:
- Can't even get to authorization page
- Missing required fields error

### Solution:

1. **Complete OAuth Consent Screen:**
   - Go to: https://console.cloud.google.com/apis/credentials/consent
   - Fill in ALL required fields (marked with *)
   - At minimum:
     - App name
     - User support email
     - Developer contact email

2. **Add Scopes:**
   - Click "Add or Remove Scopes"
   - Search and add:
     - `https://www.googleapis.com/auth/youtube.upload`
     - `https://www.googleapis.com/auth/youtube`
   - Click "Update"
   - Save

---

## Problem 5: API Not Enabled

### Symptoms:
- "API not enabled" error
- Can't create OAuth credentials

### Solution:

1. **Enable YouTube Data API v3:**
   - Go to: https://console.cloud.google.com/apis/library
   - Search: "YouTube Data API v3"
   - Click on it
   - Click **"Enable"**
   - Wait for it to enable

---

## Problem 6: Changes Not Propagating

### Symptoms:
- Made changes but still seeing old errors
- Test user not working immediately

### Solution:

1. **Wait 5-10 minutes** after making changes
2. **Clear browser cache:**
   - Chrome: Ctrl+Shift+Delete (Windows) or Cmd+Shift+Delete (Mac)
   - Or use incognito/private mode
3. **Try different browser:**
   - Sometimes browser cache causes issues
4. **Sign out and sign back in:**
   - Sign out of Google completely
   - Sign back in with test user email

---

## Complete Verification Checklist

Before trying OAuth again, verify:

- [ ] OAuth consent screen is fully configured
- [ ] App is in "Testing" mode
- [ ] Your exact email is in test users list
- [ ] Waited 5-10 minutes after adding test user
- [ ] Redirect URI matches exactly in Google Cloud Console
- [ ] Redirect URI matches exactly in .env file
- [ ] YouTube Data API v3 is enabled
- [ ] OAuth client ID and Secret are correct in .env
- [ ] Using incognito/private browsing mode
- [ ] Signed in with the exact test user email
- [ ] Cleared browser cache

---

## Step-by-Step Retry Process

1. **Verify Google Cloud Console:**
   ```
   https://console.cloud.google.com/apis/credentials/consent
   ```
   - Check all settings above
   - Make sure test user is added
   - Save if you made changes

2. **Wait 5-10 minutes** (if you just made changes)

3. **Clear browser cache** or use incognito mode

4. **Get fresh authorization URL:**
   ```bash
   ./scripts/complete-youtube-oauth.sh
   ```

5. **Sign in with EXACT test user email**

6. **Authorize the app**

7. **Copy the authorization code from callback URL**

8. **Complete the connection:**
   ```bash
   ./scripts/finish-youtube-oauth.sh "YOUR_CODE" "YOUR_STATE"
   ```

---

## Still Not Working?

If you've tried everything above and it's still not working:

1. **Double-check the exact error message** - share it with me
2. **Verify you're in the right Google Cloud project**
3. **Check if there are multiple OAuth clients** - make sure you're using the right one
4. **Try creating a new OAuth client** (as last resort)

Let me know what specific error you're seeing and I can help further!

