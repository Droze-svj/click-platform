# 🔧 Render.com Environment Variables Setup

**Complete guide for setting up environment variables in Render.com**

---

## 📋 Quick Reference

### Required Variables (Must Have)
These are essential for the app to run:

1. `NODE_ENV=production`
2. `PORT=5001`
3. `MONGODB_URI=your-mongodb-atlas-connection-string`
4. `JWT_SECRET=your-generated-secret`
5. `FRONTEND_URL=https://your-app-name.onrender.com`

### OAuth Variables (You Have YouTube)
6. `YOUTUBE_CLIENT_ID=your-youtube-client-id`
7. `YOUTUBE_CLIENT_SECRET=your-youtube-client-secret`
8. `YOUTUBE_CALLBACK_URL=https://your-app-name.onrender.com/api/oauth/youtube/callback`

### Optional Variables (Add If You Have Them)
- `OPENAI_API_KEY=...` (for AI features)
- `REDIS_URL=...` (for caching)
- `AWS_ACCESS_KEY_ID=...` (for file storage)
- `AWS_SECRET_ACCESS_KEY=...`
- `AWS_S3_BUCKET=...`

---

## 🚀 Step-by-Step: Adding Variables in Render.com

### Step 1: Access Environment Variables

1. **Go to your Render.com dashboard**
2. **Click on your web service** (the one you created)
3. **Click "Environment" tab** (in the left sidebar)
4. **You'll see a list of environment variables**

---

## 📝 Required Variables (Copy These)

### 1. Server Configuration

```bash
NODE_ENV=production
PORT=5001
FRONTEND_URL=https://your-app-name.onrender.com
```

**How to get `FRONTEND_URL`**:
- After creating your service, Render gives you a URL like: `https://click-platform.onrender.com`
- Use that URL as your `FRONTEND_URL`

---

### 2. Database (You Already Have This!)

```bash
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
```

**How to get this**:
1. Open your local `.env` file
2. Find `MONGODB_URI=...`
3. Copy the entire value (everything after the `=`)
4. Paste it into Render.com

**Example**:
```
MONGODB_URI=mongodb+srv://click-user:MyPassword123@cluster0.xxxxx.mongodb.net/click?retryWrites=true&w=majority
```

---

### 3. Security - JWT Secret

```bash
JWT_SECRET=your-generated-secret-here
```

**How to generate**:
Run this command in your terminal:
```bash
openssl rand -base64 32
```

**Copy the output** and use it as your `JWT_SECRET`.

**Important**: 
- Generate a NEW secret for production (don't use your dev secret)
- Keep it secure (don't share it publicly)
- It should be at least 32 characters long

---

### 4. YouTube OAuth (You Already Have This!)

```bash
YOUTUBE_CLIENT_ID=your-youtube-client-id
YOUTUBE_CLIENT_SECRET=your-youtube-client-secret
YOUTUBE_CALLBACK_URL=https://your-app-name.onrender.com/api/oauth/youtube/callback
```

**How to get these**:
1. Open your local `.env` file
2. Find `YOUTUBE_CLIENT_ID=...` and `YOUTUBE_CLIENT_SECRET=...`
3. Copy those values
4. For `YOUTUBE_CALLBACK_URL`, use your Render.com URL + `/api/oauth/youtube/callback`

**Example**:
```
YOUTUBE_CLIENT_ID=236680378422-fac4iormhq73fmb0rhtr5si96am0ruis.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET=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
YOUTUBE_CALLBACK_URL=https://click-platform.onrender.com/api/oauth/youtube/callback
```

**Important**: After deployment, you'll also need to update the callback URL in Google Cloud Console to match your production URL.

---

## 🔧 Optional Variables (Add If You Have Them)

### OpenAI API Key (For AI Features)

```bash
OPENAI_API_KEY=sk-your-openai-api-key
```

**Only add if**:
- You want to use AI content generation
- You have an OpenAI API key

**How to get**:
- Go to https://platform.openai.com/api-keys
- Create a new API key
- Copy it

---

### Redis (For Caching - Optional)

```bash
REDIS_URL=redis://username:password@redis-host:6379
```

**Only add if**:
- You have a Redis instance set up
- You want caching enabled

**Free option**: Redis Cloud (30MB free tier)

---

### AWS S3 (For File Storage - Optional)

```bash
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_S3_BUCKET=your-bucket-name
AWS_REGION=us-east-1
```

**Only add if**:
- You want to store files in S3 (instead of local storage)
- You have AWS credentials

**Free option**: AWS S3 free tier (5GB for 12 months)

---

## 📋 Complete Environment Variables List

### Copy-Paste Ready (Fill in your values)

```bash
# Server Configuration
NODE_ENV=production
PORT=5001
FRONTEND_URL=https://your-app-name.onrender.com

# Database (from your .env file)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority

# Security (generate new one)
JWT_SECRET=paste-generated-secret-here

# YouTube OAuth (from your .env file)
YOUTUBE_CLIENT_ID=your-youtube-client-id
YOUTUBE_CLIENT_SECRET=your-youtube-client-secret
YOUTUBE_CALLBACK_URL=https://your-app-name.onrender.com/api/oauth/youtube/callback

# Optional: OpenAI (if you have it)
OPENAI_API_KEY=sk-your-openai-key

# Optional: Redis (if you have it)
REDIS_URL=redis://localhost:6379

# Optional: AWS S3 (if you have it)
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_S3_BUCKET=your-bucket-name
AWS_REGION=us-east-1
```

---

## 🎯 How to Add Variables in Render.com

### Method 1: Add One by One

1. **In Render.com dashboard** → Your service → "Environment" tab
2. **Click "Add Environment Variable"**
3. **Enter**:
   - **Key**: `NODE_ENV`
   - **Value**: `production`
4. **Click "Save Changes"**
5. **Repeat** for each variable

### Method 2: Bulk Add (Faster)

1. **In Render.com dashboard** → Your service → "Environment" tab
2. **Click "Add Environment Variable"** for each one
3. **Add all variables** before saving
4. **Click "Save Changes"** once at the end

---

## ✅ Verification Checklist

After adding all variables, verify:

- [ ] `NODE_ENV=production`
- [ ] `PORT=5001`
- [ ] `MONGODB_URI` = Your MongoDB Atlas connection string
- [ ] `JWT_SECRET` = Generated secret (32+ characters)
- [ ] `FRONTEND_URL` = Your Render.com URL
- [ ] `YOUTUBE_CLIENT_ID` = Your YouTube client ID
- [ ] `YOUTUBE_CLIENT_SECRET` = Your YouTube secret
- [ ] `YOUTUBE_CALLBACK_URL` = Your Render.com URL + `/api/oauth/youtube/callback`

---

## 🔍 Where to Find Your Values

### From Your Local `.env` File

Open your `.env` file and copy these:

```bash
# These you can copy directly:
MONGODB_URI=...
YOUTUBE_CLIENT_ID=...
YOUTUBE_CLIENT_SECRET=...
OPENAI_API_KEY=... (if you have it)
```

### Generate New

```bash
# JWT Secret
openssl rand -base64 32

# Copy the output
```

### Get from Render.com

```bash
# FRONTEND_URL
# After creating service, Render shows: https://your-app.onrender.com
# Use that as FRONTEND_URL

# YOUTUBE_CALLBACK_URL
# Same URL + /api/oauth/youtube/callback
```

---

## 🚨 Common Mistakes to Avoid

### ❌ Don't Do This:
- Don't include quotes around values: `JWT_SECRET="secret"` ❌
- Don't include spaces: `JWT_SECRET = secret` ❌
- Don't use your dev JWT secret in production ❌
- Don't forget to update callback URLs ❌

### ✅ Do This:
- No quotes: `JWT_SECRET=secret` ✅
- No spaces: `JWT_SECRET=secret` ✅
- Generate new JWT secret for production ✅
- Update OAuth callback URLs after deployment ✅

---

## 📝 Example: Complete Setup

Here's what your Render.com environment variables should look like:

```
NODE_ENV = production
PORT = 5001
FRONTEND_URL = https://click-platform.onrender.com
MONGODB_URI = mongodb+srv://user:pass@cluster.mongodb.net/click?retryWrites=true&w=majority
JWT_SECRET = aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890AbCdEfGhIjKlMnOpQrStUvWxYz
YOUTUBE_CLIENT_ID = 236680378422-fac4iormhq73fmb0rhtr5si96am0ruis.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET = 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
YOUTUBE_CALLBACK_URL = https://click-platform.onrender.com/api/oauth/youtube/callback
```

---

## 🎯 Quick Action Items

1. **Open your `.env` file** → Copy `MONGODB_URI`, `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`
2. **Generate JWT secret**: `openssl rand -base64 32`
3. **Get your Render.com URL** (after creating service)
4. **Add all variables** in Render.com dashboard
5. **Save and deploy**

---

## 🆘 Need Help?

**Can't find a value?**
- Check your local `.env` file
- Check MongoDB Atlas dashboard
- Check Google Cloud Console (for YouTube OAuth)

**Variable not working?**
- Make sure no quotes around values
- Make sure no extra spaces
- Check spelling of variable names
- Restart your Render service after adding variables

---

**Ready to add variables? Follow the steps above! 🚀**

