# 🔧 Render.com Port Binding Fix

**Error**: "Port scan timeout reached, no open ports detected"

---

## 🎯 The Issue

Render.com can't detect that your server is listening on a port. This usually means:
1. **PORT environment variable not set** in Render.com
2. **Server crashing** before it can bind to the port
3. **Server taking too long** to start (timeout)

---

## ✅ Quick Fix

### Step 1: Verify PORT Environment Variable

1. **Go to**: Render.com → Your service → **Environment** tab
2. **Check** if `PORT` variable exists:
   - **Variable Name**: `PORT`
   - **Value**: `5001` (or let Render.com auto-assign)

3. **If it doesn't exist**, add it:
   ```
   Key: PORT
   Value: 5001
   ```

**OR** (Recommended): Let Render.com auto-assign the port:
- **Don't set PORT** - Render.com will automatically set it
- The code already handles this: `const PORT = process.env.PORT || 5001;`

---

### Step 2: Check Server Startup

The server should start and log:
```
🚀 Server running on port 5001
```

**If you don't see this**, the server is crashing before it can bind to the port.

---

### Step 3: Check Logs for Errors

1. **Go to**: Render.com → Your service → **Logs** tab
2. **Look for**:
   - ❌ **Errors** that prevent server from starting
   - ❌ **MongoDB connection errors**
   - ❌ **Missing environment variables**
   - ❌ **Syntax errors**

---

## 🔍 Common Causes

### Cause 1: Missing Required Environment Variables

**Check these are set:**
- `MONGODB_URI` (required)
- `JWT_SECRET` (required)
- `NODE_ENV` = `production`

**If missing**, the server will crash on startup.

---

### Cause 2: MongoDB Connection Failing

**Check logs for:**
```
❌ MongoDB connection error
```

**Fix**: Verify `MONGODB_URI` is correct in Render.com environment variables.

---

### Cause 3: Server Crashing During Startup

**Check logs for**:
- Stack traces
- Error messages
- "Process exited with code 1"

**Fix**: Address the specific error shown in logs.

---

### Cause 4: PORT Variable Conflict

**If you set PORT manually**, make sure:
- It's a valid port number (e.g., `5001`)
- It's not conflicting with Render.com's auto-assigned port

**Recommended**: **Remove PORT variable** and let Render.com auto-assign it.

---

## 🚀 Recommended Solution

### Option 1: Let Render.com Auto-Assign PORT (Recommended)

1. **Go to**: Render.com → Your service → Environment
2. **Remove** `PORT` variable if it exists
3. **Render.com will automatically** set `PORT` environment variable
4. **Your code already handles this**: `const PORT = process.env.PORT || 5001;`
5. **Redeploy** the service

---

### Option 2: Set PORT Manually

1. **Go to**: Render.com → Your service → Environment
2. **Add**:
   ```
   Key: PORT
   Value: 5001
   ```
3. **Save** and **redeploy**

---

## ✅ Verify Fix

After fixing, check logs for:

**Should see:**
```
🚀 Server running on port 5001
(Or whatever port Render.com assigned)
```

**Should NOT see:**
```
Port scan timeout reached, no open ports detected
```

---

## 🔍 Debug Steps

### Step 1: Check Environment Variables

**Required:**
- [ ] `MONGODB_URI` is set
- [ ] `JWT_SECRET` is set
- [ ] `NODE_ENV` = `production`

**Optional (but recommended):**
- [ ] `PORT` (or let Render.com auto-assign)
- [ ] `FRONTEND_URL`
- [ ] Other service variables

---

### Step 2: Check Server Logs

**Look for startup sequence:**
1. ✅ MongoDB connected
2. ✅ Email service initialized
3. ✅ Cache initialized
4. ✅ **Server running on port X**

**If any step fails**, that's the issue.

---

### Step 3: Check for Crashes

**Look for:**
- `Process exited with code 1`
- `Error: ...`
- Stack traces

**These indicate the server is crashing before it can bind to the port.**

---

## 🎯 Quick Checklist

- [ ] `MONGODB_URI` is set in Render.com
- [ ] `JWT_SECRET` is set in Render.com
- [ ] `NODE_ENV` = `production` in Render.com
- [ ] `PORT` is either set OR removed (let Render.com auto-assign)
- [ ] No errors in logs preventing server startup
- [ ] Server logs show "🚀 Server running on port X"
- [ ] Service redeployed after changes

---

## ⚠️ Important Notes

1. **Render.com automatically sets PORT** - you don't need to set it manually
2. **Your code handles PORT correctly**: `const PORT = process.env.PORT || 5001;`
3. **Server must bind to 0.0.0.0** (which it does: `const HOST = '0.0.0.0'`)
4. **Server must start within timeout** (usually 5-10 minutes)

---

## 🚀 Most Likely Fix

**Remove the PORT variable** and let Render.com auto-assign it:

1. **Go to**: Render.com → Your service → Environment
2. **Delete** `PORT` variable if it exists
3. **Save** and **redeploy**
4. **Check logs** - should see server running on auto-assigned port

---

**Follow these steps and the port binding issue should be resolved! 🚀**

