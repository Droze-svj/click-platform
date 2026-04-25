# Port Binding Troubleshooting Guide

## Current Issue
Render.com reports: "Port scan timeout reached, no open ports detected"

This means the server is crashing or exiting before it can bind to a port.

## Most Common Causes

### 1. Missing Required Environment Variables
The server requires these variables to start:
- `MONGODB_URI` - Your MongoDB Atlas connection string
- `JWT_SECRET` - A secure random string (at least 32 characters)
- `NODE_ENV` - Should be set to `production`

**Fix:** Add these to Render.com → Environment tab

### 2. MongoDB Connection Failing
If MongoDB connection fails and exits the process.

**Fix:** The server now continues even if MongoDB fails. Check your `MONGODB_URI` format.

### 3. Production Config Validation Failing
If `initProduction()` throws an error.

**Fix:** The server now continues even if production config fails. Check logs for specific errors.

## How to Debug

### Step 1: Check Render.com Logs
1. Go to Render.com → Your service → Logs
2. Look for:
   - `❌ Missing required environment variables`
   - `❌ MongoDB connection error`
   - `❌ Production environment initialization failed`
   - `❌ Uncaught Exception`
   - `❌ Unhandled Rejection`

### Step 2: Verify Environment Variables
In Render.com → Environment tab, ensure you have:

```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/click?retryWrites=true&w=majority
JWT_SECRET=your-secret-at-least-32-characters-long
NODE_ENV=production
PORT=5001
```

### Step 3: Check for Syntax Errors
Look in logs for:
- `SyntaxError`
- `ReferenceError`
- `TypeError`
- `Cannot find module`

### Step 4: Verify Server Startup Sequence
The server should log these messages in order:
1. `✅ Environment variables validated` (or warnings)
2. `✅ MongoDB connected` (or warnings)
3. `🚀 Server running on port 5001`
4. `✅ Server bound to port 5001 on 0.0.0.0`

If you don't see `🚀 Server running on port 5001`, the server is crashing before binding.

## Quick Fix Checklist

- [ ] `MONGODB_URI` is set in Render.com
- [ ] `JWT_SECRET` is set in Render.com (at least 32 characters)
- [ ] `NODE_ENV` is set to `production`
- [ ] `PORT` is set (or defaults to 5001)
- [ ] No syntax errors in logs
- [ ] MongoDB connection string is valid
- [ ] Service has been redeployed after adding variables

## Expected Log Output

**✅ Success:**
```
✅ Environment variables validated
✅ MongoDB connected
🚀 Server running on port 5001
✅ Server bound to port 5001 on 0.0.0.0
```

**⚠️ Partial Success (server still starts):**
```
⚠️ Missing required environment variables: MONGODB_URI
⚠️ Continuing despite validation errors. Check logs for missing variables.
⚠️ MongoDB connection error: ...
⚠️ Server will start without database. MongoDB connection will retry in background.
🚀 Server running on port 5001
✅ Server bound to port 5001 on 0.0.0.0
```

**❌ Failure (server doesn't start):**
```
❌ Missing required environment variables: MONGODB_URI, JWT_SECRET
❌ Uncaught Exception: ...
```

## Still Not Working?

1. **Check the exact error** in Render.com logs
2. **Copy the full error message** and check what's missing
3. **Verify MongoDB URI format** - should start with `mongodb+srv://` or `mongodb://`
4. **Test locally** - try running `npm start` locally to see if it works
5. **Check package.json** - ensure `start` script is correct: `node server/index.js`

## Contact Support

If the server still doesn't bind after:
- Adding all required environment variables
- Checking logs for errors
- Verifying MongoDB connection string

Then there may be a deeper issue. Check Render.com logs for the exact error message.

