# 🔍 Debug Server Startup Issues

## Current Issue
Server is not binding to port even though environment variables are set.

## What to Check in Render.com Logs

### Step 1: Check for Errors Before Server Starts

Look for these error patterns in Render.com logs:

1. **Syntax Errors**
   ```
   SyntaxError: ...
   ReferenceError: ...
   TypeError: ...
   ```

2. **Module Not Found**
   ```
   Error: Cannot find module '...'
   ```

3. **Database Connection Errors**
   ```
   ❌ MongoDB connection error
   ```

4. **Uncaught Exceptions**
   ```
   ❌ Uncaught Exception: ...
   ```

5. **Unhandled Rejections**
   ```
   ❌ Unhandled Rejection: ...
   ```

### Step 2: Check Server Startup Sequence

The server should log these messages in order:

1. ✅ `✅ Environment variables validated`
2. ✅ `✅ MongoDB connected` (or warning if connection fails)
3. ✅ `🚀 Server running on port 5001`
4. ✅ `✅ Server bound to port 5001 on 0.0.0.0`

**If you don't see `🚀 Server running on port 5001`, the server is crashing before binding.**

### Step 3: Check for Process Exits

Look for:
```
process.exit(1)
Exited with status 1
```

### Step 4: Check Module Loading

The server might be crashing during module loading. Check if you see:
- Any error messages before "Environment variables validated"
- Import/require errors
- Dependency errors

---

## Common Causes (Even With Variables Set)

### 1. MongoDB Connection String Format
**Issue:** MongoDB URI might be malformed or incorrect

**Check:**
- Does it start with `mongodb+srv://` or `mongodb://`?
- Are there any special characters that need encoding?
- Is the password URL-encoded?

**Fix:** Verify the connection string format in MongoDB Atlas

### 2. Module Import Errors
**Issue:** A required module might be missing or have errors

**Check logs for:**
```
Error: Cannot find module '...'
Error: Cannot resolve module '...'
```

**Fix:** Ensure all dependencies are installed (`npm install`)

### 3. Production Config Validation
**Issue:** `initProduction()` might be throwing an error

**Check logs for:**
```
❌ Production environment initialization failed
```

**Note:** The code now continues even if this fails, but check logs for the specific error.

### 4. Port Already in Use
**Issue:** Port 5001 might already be in use (unlikely on Render.com)

**Check logs for:**
```
❌ Port 5001 is already in use
```

### 5. Missing Dependencies
**Issue:** A package might not be installed

**Check:** Render.com build logs for:
```
npm ERR!
Error installing dependencies
```

---

## How to Get Detailed Logs

### Option 1: Check Render.com Logs
1. Go to Render.com → Your service
2. Click **Logs** tab
3. Look for errors (red text)
4. Scroll to the beginning of the deployment

### Option 2: Add More Logging
The server now logs at each step. Check if you see:
- `Global error handlers initialized`
- `✅ Environment variables validated`
- `✅ MongoDB connected` (or warning)
- `🚀 Server running on port...`

---

## Quick Diagnostic Questions

1. **Do you see "Environment variables validated"?**
   - ✅ Yes → Variables are being read
   - ❌ No → Server crashing before validation

2. **Do you see "MongoDB connected"?**
   - ✅ Yes → Database connection works
   - ❌ No → Check MongoDB URI format

3. **Do you see "Server running on port"?**
   - ✅ Yes → Server is binding (check port number)
   - ❌ No → Server crashing before binding

4. **What's the last log message you see?**
   - This tells you where the server is failing

---

## What to Share for Help

If you need help debugging, share:
1. **Last 20-30 lines of Render.com logs**
2. **Any error messages** (especially red text)
3. **The last successful log message** before it stops
4. **Build logs** (if deployment fails during build)

---

## Quick Fixes to Try

### Fix 1: Force Redeploy
1. Render.com → Your service
2. Click **Manual Deploy** → **Deploy latest commit**
3. Watch logs in real-time

### Fix 2: Check Build Logs
1. Render.com → Your service
2. Click **Events** tab
3. Check if build succeeded
4. Look for npm install errors

### Fix 3: Verify Start Command
In Render.com → Settings, verify:
- **Start Command:** `npm start`
- **Build Command:** `npm install && cd client && npm install && npm run build`

---

## Expected Log Flow

Here's what you should see in order:

```
==> Building...
==> npm install
==> cd client && npm install && npm run build
==> Deploying...
==> Running 'npm start'
Global error handlers initialized
✅ Environment variables validated
✅ MongoDB connected
✅ Email service initialized (SendGrid)
✅ Cloud storage (Cloudinary) configured
⚠️ Redis not configured for job queues. Workers will be disabled.
🚀 Initializing all job queue workers...
⚠️ Redis not configured. Workers will not be initialized.
✅ Job queue system initialized
🚀 Server running on port 5001
✅ Server bound to port 5001 on 0.0.0.0
```

**If the logs stop before "Server running on port", that's where the issue is.**

---

## Still Not Working?

1. **Copy the full error message** from Render.com logs
2. **Check the exact line** where it stops
3. **Verify all dependencies** are in package.json
4. **Check if there are any syntax errors** in the code

The server should now be more resilient and log errors instead of silently exiting.

