# Connection Troubleshooting Guide

## Issue: "Connection Lost" Error

If you're still seeing "connection lost" errors, try these steps:

## Step 1: Check Browser Console

1. Open your browser's Developer Tools (F12 or Cmd+Option+I)
2. Go to the **Console** tab
3. Try to register again
4. Look for error messages - they will show:
   - The actual API URL being used
   - The error code (ECONNREFUSED, timeout, etc.)
   - Network errors

## Step 2: Wake Up the Server

Render.com free tier services sleep after 15 minutes. Wake it up first:

```bash
curl https://click-platform.onrender.com/api/health
```

Wait 10-15 seconds, then try registering again.

## Step 3: Check Network Tab

1. Open Developer Tools (F12)
2. Go to **Network** tab
3. Try to register
4. Look for the request to `/auth/register`
5. Check:
   - **Status Code** (should be 200 or 201)
   - **Request URL** (should be `https://click-platform.onrender.com/api/auth/register`)
   - **Error message** if it failed

## Step 4: Verify API URL

The frontend should be using: `https://click-platform.onrender.com/api`

Check in browser console:
```javascript
console.log('API URL:', process.env.NEXT_PUBLIC_API_URL)
```

Or look at the Network tab to see what URL requests are going to.

## Step 5: Test Backend Directly

Test if the backend is working:

```bash
# Test registration
curl -X POST "https://click-platform.onrender.com/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#","name":"Test"}'
```

If this works, the backend is fine - the issue is with the frontend connection.

## Step 6: Clear Browser Cache

Sometimes the browser caches old API URLs:

1. Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
2. Or clear browser cache completely
3. Try again

## Step 7: Check CORS

If you see CORS errors in the console:

1. The backend should allow `http://localhost:3000`
2. Check if the error mentions CORS
3. If CORS is the issue, we need to update backend CORS config

## Common Error Messages

### "ECONNREFUSED" or "Network Error"
- **Cause**: Server is sleeping or unreachable
- **Fix**: Wake up server first (see Step 2)

### "Request timeout"
- **Cause**: Server took too long to respond (sleeping)
- **Fix**: Wait 30-60 seconds and try again, or wake up server

### "CORS error"
- **Cause**: Backend not allowing localhost:3000
- **Fix**: Check backend CORS configuration

### "404 Not Found"
- **Cause**: Wrong API URL
- **Fix**: Verify API URL is `https://click-platform.onrender.com/api`

## Quick Test

Run this in your browser console (on the register page):

```javascript
fetch('https://click-platform.onrender.com/api/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

If this works, the connection is fine - the issue is with the registration endpoint or request format.

## Still Not Working?

1. **Check the browser console** for specific error messages
2. **Check the Network tab** to see the actual request/response
3. **Share the error message** from the console
4. **Try a different browser** to rule out browser-specific issues

## Debug Information

When you try to register, check the browser console for:
- The API URL being used
- The full error message
- The error code
- The response (if any)

This will help identify the exact issue.

