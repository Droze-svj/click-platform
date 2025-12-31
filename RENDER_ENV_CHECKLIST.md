# ✅ Render.com Environment Variables Checklist

**Fix for "throw err;" error**

---

## 🚨 Required Variables (Must Have)

Your server **requires** these variables or it will crash:

### 1. `MONGODB_URI` ⚠️ CRITICAL
**What**: Your MongoDB Atlas connection string  
**Where to get**: Copy from your local `.env` file  
**Example**: `mongodb+srv://user:pass@cluster.mongodb.net/click?retryWrites=true&w=majority`

### 2. `JWT_SECRET` ⚠️ CRITICAL
**What**: Secret key for JWT tokens  
**How to generate**: Run `openssl rand -base64 32`  
**Must be**: At least 32 characters long

---

## 📋 Complete Environment Variables List

### Required (Server won't start without these):

```bash
NODE_ENV=production
PORT=5001
MONGODB_URI=mongodb+srv://... (your MongoDB Atlas connection string)
JWT_SECRET=... (generate with: openssl rand -base64 32)
FRONTEND_URL=https://your-app-name.onrender.com
```

### YouTube OAuth (You have these):

```bash
YOUTUBE_CLIENT_ID=... (from your .env)
YOUTUBE_CLIENT_SECRET=... (from your .env)
YOUTUBE_CALLBACK_URL=https://your-app-name.onrender.com/api/oauth/youtube/callback
```

---

## 🔧 How to Add in Render.com

1. **Go to Render.com Dashboard**
2. **Click on your service**
3. **Click "Environment" tab**
4. **Click "Add Environment Variable"** for each one
5. **Add all variables from the list above**
6. **Click "Save Changes"**
7. **Redeploy** (or wait for auto-deploy)

---

## ✅ Quick Verification

After adding variables, check:

- [ ] `MONGODB_URI` is set (copy from your `.env`)
- [ ] `JWT_SECRET` is set (generate new one)
- [ ] `NODE_ENV=production`
- [ ] `PORT=5001`
- [ ] `FRONTEND_URL` = your Render.com URL
- [ ] YouTube OAuth variables are set

---

## 🎯 Most Likely Issue

**90% chance**: `MONGODB_URI` or `JWT_SECRET` is missing.

**Check Render.com logs** - it will say:
- "Missing required environment variables: MONGODB_URI"
- Or "Missing required environment variables: JWT_SECRET"

---

## 📝 Step-by-Step Fix

1. **Open your local `.env` file**
2. **Copy `MONGODB_URI=...`** (everything after the `=`)
3. **Generate JWT secret**: `openssl rand -base64 32`
4. **Go to Render.com** → Your service → Environment
5. **Add**:
   - `MONGODB_URI` = (paste from .env)
   - `JWT_SECRET` = (paste generated secret)
   - `NODE_ENV` = `production`
   - `PORT` = `5001`
   - `FRONTEND_URL` = `https://your-app.onrender.com`
6. **Save and redeploy**

---

**Add these environment variables in Render.com and the error should be fixed! 🚀**

