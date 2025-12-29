# 🐦 Twitter/X OAuth Setup - Step-by-Step Walkthrough

## 📍 Step 1: Go to Twitter Developer Portal

**URL:** https://developer.twitter.com/en/portal/dashboard

1. Open the link above in your browser
2. Sign in with your Twitter/X account
3. If you don't have a developer account, you'll need to apply (usually instant approval)

---

## 📍 Step 2: Create or Select an App

### Option A: Create New App
1. Click **"Create App"** or **"New App"** button
2. Fill in the form:
   - **App name**: `Click Content Platform` (or your preferred name)
   - **App description**: Brief description of your app
   - **Website URL**: Your website URL (can be placeholder for now)
   - **Callback URLs**: `http://localhost:5001/api/oauth/twitter/callback`
   - **App permissions**: Select **"Read and Write"** (needed for posting)

### Option B: Use Existing App
1. If you already have an app, click on it from the dashboard
2. Make sure callback URL is set: `http://localhost:5001/api/oauth/twitter/callback`

---

## 📍 Step 3: Get Your Credentials

1. Once in your app, look for the **"Keys and tokens"** tab (usually in the left sidebar)
2. Click on **"Keys and tokens"**
3. You'll see:
   - **API Key** (also called Consumer Key)
   - **API Secret** (also called Consumer Secret)
   - **Bearer Token** (not needed for OAuth)

4. **Copy these values:**
   - **API Key** → This is your `TWITTER_CLIENT_ID`
   - **API Secret** → This is your `TWITTER_CLIENT_SECRET`

⚠️ **Important:** 
- The API Secret is only shown once when first created
- If you don't see it, you may need to regenerate it
- Keep these credentials secure - never share them publicly

---

## 📍 Step 4: Set Callback URL

1. In your app settings, find **"Callback URLs"** or **"Redirect URIs"**
2. Add: `http://localhost:5001/api/oauth/twitter/callback`
3. For production, you'll also add: `https://your-domain.com/api/oauth/twitter/callback`
4. Save the changes

---

## 📍 Step 5: Update .env File

Now you have:
- ✅ API Key (TWITTER_CLIENT_ID)
- ✅ API Secret (TWITTER_CLIENT_SECRET)
- ✅ Callback URL configured

**Next:** Update your `.env` file with these values.

---

## 🎯 What Your Credentials Look Like

- **API Key (TWITTER_CLIENT_ID)**: Usually starts with letters/numbers, ~25 characters
  - Example format: `AbC123XyZ789...` (not a real key)
  
- **API Secret (TWITTER_CLIENT_SECRET)**: Usually longer, ~50 characters
  - Example format: `aBcDeFgHiJkLmNoPqRsTuVwXyZ123456789...` (not a real secret)

---

## ✅ Verification Checklist

Before updating .env, make sure you have:
- [ ] API Key copied
- [ ] API Secret copied (or regenerated if needed)
- [ ] Callback URL set in Twitter app settings
- [ ] App permissions set to "Read and Write"

---

## 🚀 Ready to Update .env?

Once you have your credentials, I'll help you update the `.env` file!

**Tell me when you have:**
1. Your Twitter API Key
2. Your Twitter API Secret

Or run the helper script to update it interactively!

