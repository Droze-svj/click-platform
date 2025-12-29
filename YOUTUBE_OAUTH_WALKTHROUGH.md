# 📺 YouTube OAuth Setup - Step-by-Step Walkthrough

## 📍 Step 1: Go to Google Cloud Console

**URL:** https://console.cloud.google.com/

1. Open the link above in your browser
2. Sign in with your Google account
3. If you don't have a Google Cloud account, you'll need to create one (free tier available)

---

## 📍 Step 2: Create or Select a Project

### Option A: Create New Project
1. Click the project dropdown at the top (next to "Google Cloud")
2. Click **"New Project"**
3. Fill in:
   - **Project name**: `Click Content Platform` (or your preferred name)
   - **Organization**: (optional)
   - **Location**: (optional)
4. Click **"Create"**
5. Wait a few seconds for the project to be created
6. Select your new project from the dropdown

### Option B: Use Existing Project
1. Click the project dropdown
2. Select your existing project

---

## 📍 Step 3: Enable YouTube Data API v3

1. In the Google Cloud Console, go to **"APIs & Services"** → **"Library"**
   - Or use this direct link: https://console.cloud.google.com/apis/library
2. In the search bar, type: **"YouTube Data API v3"**
3. Click on **"YouTube Data API v3"** from the results
4. Click the **"Enable"** button
5. Wait for it to enable (usually takes a few seconds)

✅ **Important:** Make sure you see "API enabled" confirmation

---

## 📍 Step 4: Configure OAuth Consent Screen

1. Go to **"APIs & Services"** → **"OAuth consent screen"**
   - Or use: https://console.cloud.google.com/apis/credentials/consent
2. Select **"External"** (unless you're using Google Workspace, then select "Internal")
3. Click **"Create"**
4. Fill in the required information:
   - **App name**: `Click Content Platform` (or your preferred name)
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
   - **App logo**: (optional - can skip)
5. Click **"Save and Continue"**
6. **Scopes** (Step 2):
   - Click **"Add or Remove Scopes"**
   - Search for and add:
     - `https://www.googleapis.com/auth/youtube.upload` (Upload videos)
     - `https://www.googleapis.com/auth/youtube` (Manage YouTube account)
   - Click **"Update"** then **"Save and Continue"**
7. **Test users** (Step 3):
   - For development, you can add your email as a test user
   - Click **"Add Users"** → Enter your email → **"Add"**
   - Click **"Save and Continue"**
8. **Summary** (Step 4):
   - Review and click **"Back to Dashboard"**

---

## 📍 Step 5: Create OAuth 2.0 Credentials

1. Go to **"APIs & Services"** → **"Credentials"**
   - Or use: https://console.cloud.google.com/apis/credentials
2. Click **"Create Credentials"** at the top
3. Select **"OAuth client ID"**
4. If prompted, select **"Web application"** as the application type
5. Fill in the form:
   - **Name**: `Click YouTube OAuth` (or your preferred name)
   - **Authorized JavaScript origins**: 
     - `http://localhost:5001` (for development)
     - `https://your-domain.com` (for production - add later)
   - **Authorized redirect URIs**:
     - `http://localhost:5001/api/oauth/youtube/callback` (for development)
     - `https://your-domain.com/api/oauth/youtube/callback` (for production - add later)
6. Click **"Create"**

---

## 📍 Step 6: Get Your Credentials

After clicking "Create", a popup will appear with:
- **Your Client ID** → This is your `YOUTUBE_CLIENT_ID`
- **Your Client Secret** → This is your `YOUTUBE_CLIENT_SECRET`

⚠️ **Important:** 
- Copy these values immediately - the secret won't be shown again!
- You can view them later in the Credentials page, but the secret will be masked

**Copy these values:**
- **Client ID** → `YOUTUBE_CLIENT_ID`
- **Client Secret** → `YOUTUBE_CLIENT_SECRET`

---

## 📍 Step 7: Update .env File

Now you have:
- ✅ Client ID (YOUTUBE_CLIENT_ID)
- ✅ Client Secret (YOUTUBE_CLIENT_SECRET)
- ✅ OAuth consent screen configured
- ✅ YouTube Data API v3 enabled
- ✅ Redirect URI configured

**Next:** Update your `.env` file with these values.

---

## 🎯 What Your Credentials Look Like

- **Client ID (YOUTUBE_CLIENT_ID)**: Usually ends with `.apps.googleusercontent.com`
  - Example format: `123456789-abcdefghijklmnop.apps.googleusercontent.com`
  
- **Client Secret (YOUTUBE_CLIENT_SECRET)**: Usually starts with `GOCSPX-` followed by random characters
  - Example format: `GOCSPX-abcdefghijklmnopqrstuvwxyz123456` (not a real secret)

---

## ✅ Verification Checklist

Before updating .env, make sure you have:
- [ ] Google Cloud project created
- [ ] YouTube Data API v3 enabled
- [ ] OAuth consent screen configured
- [ ] OAuth client ID created
- [ ] Client ID copied
- [ ] Client Secret copied
- [ ] Redirect URI set: `http://localhost:5001/api/oauth/youtube/callback`

---

## 🚨 Common Issues & Solutions

### Issue: "OAuth client ID creation failed"
- **Solution:** Make sure OAuth consent screen is configured first (Step 4)

### Issue: "Redirect URI mismatch"
- **Solution:** Make sure the redirect URI in Google Cloud Console matches exactly:
  - `http://localhost:5001/api/oauth/youtube/callback`
  - No trailing slashes, exact match required

### Issue: "Access blocked: This app's request is invalid"
- **Solution:** 
  - Make sure you added yourself as a test user (Step 4, Test users)
  - Or publish the app (requires verification for production)

### Issue: "API not enabled"
- **Solution:** Go back to Step 3 and make sure YouTube Data API v3 is enabled

---

## 🚀 Ready to Update .env?

Once you have your credentials, I'll help you update the `.env` file!

**Tell me when you have:**
1. Your YouTube Client ID
2. Your YouTube Client Secret

Or run the helper script to update it interactively!

---

## 📚 Additional Resources

- [Google Cloud Console](https://console.cloud.google.com/)
- [YouTube Data API Documentation](https://developers.google.com/youtube/v3)
- [OAuth 2.0 Setup Guide](https://developers.google.com/identity/protocols/oauth2)

