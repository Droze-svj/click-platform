# 🐦 Twitter/X OAuth - Quick Start Guide

**Estimated Time**: 5-10 minutes  
**Difficulty**: ⭐ Easy  
**Status**: Ready to configure

---

## 🎯 Quick Steps

### 1. Get Twitter Developer Account (2 min)
1. Go to: https://developer.twitter.com/en/portal/dashboard
2. Sign in with your Twitter/X account
3. If prompted, apply for developer access (usually instant for basic access)

### 2. Create App (2 min)
1. Click **"Create App"** or **"Create Project"**
2. Fill in:
   - **App name**: `Click Platform` (or your preferred name)
   - **App description**: `Content management and social media posting platform`
3. Click **"Create"**

### 3. Get Credentials (2 min)
1. Once app is created, go to **"Keys and tokens"** tab
2. You'll see:
   - **API Key** → This is your `TWITTER_CLIENT_ID`
   - **API Secret Key** → This is your `TWITTER_CLIENT_SECRET`
3. Click **"Generate"** if keys don't exist
4. **Copy both values** (you'll need them in step 4)

### 4. Configure Callback URL (1 min)
1. Go to **"App settings"** or **"Settings"** tab
2. Find **"Callback URLs"** or **"Redirect URIs"**
3. Add: `http://localhost:5001/api/oauth/twitter/callback`
4. Click **"Save"**

### 5. Set Permissions (1 min)
1. Go to **"App permissions"** or **"Settings"** tab
2. Set permissions to:
   - ✅ **Read and Write** (needed for posting)
   - ✅ **Read users** (needed for profile info)
3. Click **"Save"**

### 6. Update .env File (1 min)
Open your `.env` file and update:

```bash
# Twitter/X OAuth
TWITTER_CLIENT_ID=your-api-key-here
TWITTER_CLIENT_SECRET=your-api-secret-here
```

Replace `your-api-key-here` and `your-api-secret-here` with the actual values from step 3.

### 7. Test (1 min)
Run the verification:
```bash
npm run verify:oauth
```

Or test specifically:
```bash
node scripts/verify-oauth-comprehensive.js twitter
```

---

## ✅ Verification Checklist

- [ ] Twitter Developer account created
- [ ] App created in Twitter Developer Portal
- [ ] API Key copied → `TWITTER_CLIENT_ID`
- [ ] API Secret copied → `TWITTER_CLIENT_SECRET`
- [ ] Callback URL added: `http://localhost:5001/api/oauth/twitter/callback`
- [ ] Permissions set to "Read and Write"
- [ ] `.env` file updated with credentials
- [ ] Verification script run successfully

---

## 🧪 Test OAuth Flow

Once configured, test the OAuth flow:

1. **Start your server** (if not running):
   ```bash
   npm run dev:server
   ```

2. **Get authorization URL**:
   ```bash
   curl http://localhost:5001/api/oauth/twitter/authorize \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

3. **Open the URL** in your browser and authorize

4. **Complete the flow** - you'll be redirected back with a code

---

## 🆘 Troubleshooting

### "Invalid callback URL"
- Make sure callback URL in Twitter dashboard matches exactly: `http://localhost:5001/api/oauth/twitter/callback`
- No trailing slashes
- Check for typos

### "Insufficient permissions"
- Make sure app permissions are set to "Read and Write"
- You may need to regenerate keys after changing permissions

### "Invalid credentials"
- Double-check that API Key and Secret are correct in `.env`
- Make sure there are no extra spaces or quotes
- Regenerate keys if needed

---

## 📝 Notes

- **Development Mode**: Twitter allows testing without full app approval
- **Rate Limits**: Free tier has rate limits (check Twitter docs)
- **Production**: For production, you'll need to add production callback URL later

---

## 🚀 Next Steps

After Twitter is configured:
1. Test the OAuth flow end-to-end
2. Set up LinkedIn OAuth (next recommended)
3. Set up Facebook OAuth (covers Instagram too)

---

**Ready to start? Follow the steps above! 🐦**

