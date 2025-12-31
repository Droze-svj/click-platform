# 🔍 Render.com Error Debugging Guide

**Error**: `throw err;` - Generic Node.js error

---

## 🎯 Common Causes & Fixes

### 1. Missing Environment Variables ⚠️ MOST COMMON

**Error**: Usually happens when required env vars are missing

**Fix**: Make sure these are set in Render.com:
- `NODE_ENV=production`
- `PORT=5001`
- `MONGODB_URI=...` (your MongoDB Atlas connection string)
- `JWT_SECRET=...` (generated secret)

**Check**: Render.com Dashboard → Your service → Environment tab

---

### 2. Database Connection Error

**Error**: MongoDB connection fails

**Fix**:
1. Verify `MONGODB_URI` is correct in Render.com
2. Check MongoDB Atlas Network Access allows all IPs (`0.0.0.0/0`)
3. Verify database credentials are correct

**Test**: Try connecting from your local machine with the same URI

---

### 3. Missing Dependencies

**Error**: Module not found

**Fix**: Check build logs in Render.com
- Look for "npm install" errors
- Verify all dependencies are in `package.json`
- Check if build completed successfully

---

### 4. Port Already in Use

**Error**: Port conflict

**Fix**: Make sure `PORT=5001` is set in environment variables
- Render.com uses the PORT env var automatically
- Don't hardcode port in code

---

### 5. Missing Required Files

**Error**: Cannot find module or file

**Fix**: Verify these files exist:
- `server/index.js` ✅
- `package.json` ✅
- `client/package.json` ✅

---

## 🔍 How to Debug

### Step 1: Check Render.com Logs

1. **Go to Render.com Dashboard**
2. **Click on your service**
3. **Click "Logs" tab**
4. **Look for the actual error message** (not just "throw err;")
5. **Scroll up** to see the full error stack trace

### Step 2: Check Build Logs

1. **In Render.com**, go to "Events" or "Logs"
2. **Look for build errors**:
   - npm install failures
   - Build command errors
   - Missing files

### Step 3: Check Runtime Logs

1. **Look for startup errors**:
   - Database connection errors
   - Missing environment variables
   - Module not found errors

---

## 📋 Quick Checklist

- [ ] All environment variables set in Render.com
- [ ] MongoDB Atlas network access allows all IPs
- [ ] Build completed successfully (check build logs)
- [ ] `render.yaml` is committed and pushed
- [ ] Start command is `npm start`
- [ ] PORT environment variable is set

---

## 🚨 Most Likely Issue: Missing Environment Variables

**90% of "throw err" errors are from missing env vars.**

### Required Variables (Check These First):

```bash
NODE_ENV=production
PORT=5001
MONGODB_URI=mongodb+srv://... (your connection string)
JWT_SECRET=... (generated secret)
FRONTEND_URL=https://your-app.onrender.com
```

**Add these in Render.com**:
1. Dashboard → Your service → Environment tab
2. Add each variable
3. Save
4. Redeploy

---

## 🔧 Quick Fix Steps

1. **Check Render.com Logs** for actual error message
2. **Verify Environment Variables** are all set
3. **Check MongoDB Connection** (if error mentions database)
4. **Verify Build Succeeded** (check build logs)
5. **Redeploy** after fixing issues

---

## 📝 Common Error Messages & Fixes

### "Cannot find module 'dotenv'"
**Fix**: Add to package.json dependencies, rebuild

### "MongoServerError: Authentication failed"
**Fix**: Check MongoDB credentials in MONGODB_URI

### "EADDRINUSE: address already in use"
**Fix**: Set PORT=5001 in environment variables

### "JWT_SECRET is required"
**Fix**: Add JWT_SECRET to environment variables

### "MongoNetworkError: failed to connect"
**Fix**: Check MongoDB Atlas network access settings

---

## 🆘 Need More Help?

**Share the full error from Render.com logs:**
1. Go to Render.com → Your service → Logs
2. Copy the full error message (not just "throw err;")
3. Look for lines that say "Error:", "at", or show file paths

The actual error message will tell us exactly what's wrong!

---

**Check your Render.com logs and share the full error message for specific help! 🔍**

