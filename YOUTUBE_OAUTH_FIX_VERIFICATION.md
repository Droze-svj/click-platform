# 🔧 Fix: "Access blocked: Click has not completed the Google verification process"

## Problem
You're seeing: **"Access blocked: Click has not completed the Google verification process"**

This happens because your Google OAuth app needs to be configured for testing.

---

## ✅ Quick Fix (For Development/Testing)

### Step 1: Go to OAuth Consent Screen
1. Open: https://console.cloud.google.com/apis/credentials/consent
2. Make sure you're in the correct project

### Step 2: Configure for Testing
1. You should see your OAuth consent screen configuration
2. Look for **"Publishing status"** section
3. It should say **"Testing"** (not "In production")

### Step 3: Add Test Users
1. Scroll down to **"Test users"** section
2. Click **"Add Users"**
3. Add your Google account email address (the one you're using to test)
4. Click **"Add"**
5. **Save** the changes

### Step 4: Try Again
1. Go back to the authorization URL
2. Sign in with the test user email you added
3. You should now be able to authorize the app

---

## 📋 Detailed Steps

### Option A: Add Yourself as Test User (Recommended for Development)

1. **Go to OAuth Consent Screen:**
   - URL: https://console.cloud.google.com/apis/credentials/consent
   - Select your project

2. **Check Publishing Status:**
   - Should be "Testing" (not "In production")
   - If it's "In production", you'll need to add test users

3. **Add Test Users:**
   - Scroll to "Test users" section
   - Click "Add Users"
   - Enter your Google account email
   - Click "Add"
   - Click "Save" at the bottom

4. **Wait a few minutes** for changes to propagate

5. **Try the OAuth flow again**

---

### Option B: Publish for Production (Not Recommended for Testing)

⚠️ **Note:** This requires Google verification which can take days/weeks.

1. Go to OAuth Consent Screen
2. Click "Publish App"
3. Fill out verification forms
4. Wait for Google approval

**For development, use Option A instead!**

---

## 🔍 Verify Your Configuration

### Check These Settings:

1. **OAuth Consent Screen:**
   - ✅ App name is set
   - ✅ User support email is set
   - ✅ Developer contact email is set
   - ✅ Scopes are added (youtube.upload, youtube, etc.)
   - ✅ Test users are added (YOUR email)

2. **OAuth Client:**
   - ✅ Client ID is correct
   - ✅ Client Secret is correct
   - ✅ Redirect URI matches: `http://localhost:5001/api/oauth/youtube/callback`

---

## 🚨 Common Issues

### Issue: "User type not supported"
- **Fix:** Make sure you selected "External" when creating the consent screen
- If you selected "Internal", only users in your Google Workspace can use it

### Issue: "App is in production mode"
- **Fix:** Add test users (see Option A above)
- Or switch back to "Testing" mode

### Issue: "Test user not working"
- **Fix:** 
  - Make sure you added the exact email you're signing in with
  - Wait 5-10 minutes after adding test users
  - Try clearing browser cache/cookies
  - Use incognito/private browsing mode

---

## ✅ After Adding Test Users

1. **Wait 2-5 minutes** for changes to take effect
2. **Clear browser cache** or use incognito mode
3. **Try the OAuth flow again:**
   ```bash
   ./scripts/complete-youtube-oauth.sh
   ```
4. Sign in with the **exact email** you added as a test user

---

## 📝 Quick Checklist

- [ ] OAuth consent screen is configured
- [ ] App is in "Testing" mode (not "In production")
- [ ] Your email is added as a test user
- [ ] Waited 2-5 minutes after adding test user
- [ ] Using the exact email that was added
- [ ] Redirect URI is correct in OAuth client settings

---

## 🎯 Next Steps

Once you've added yourself as a test user:

1. Wait a few minutes
2. Run the OAuth flow again:
   ```bash
   ./scripts/complete-youtube-oauth.sh
   ```
3. Sign in with your test user email
4. You should now be able to authorize!

---

**Need help?** Let me know once you've added the test user and we can try again!

