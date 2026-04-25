# Registration Troubleshooting Guide

## If Registration Doesn't Redirect to Dashboard

### Step 1: Check Browser Console

1. Open Developer Tools (F12)
2. Go to Console tab
3. Try registering
4. Look for these messages:

**Expected Console Messages:**
```
🔍 Registration Debug Info:
  - API_URL: https://click-platform.onrender.com/api
  - Full endpoint: https://click-platform.onrender.com/api/auth/register
✅ Token stored in localStorage
✅ Token verified in localStorage: eyJhbGciOiJIUzI1NiIs...
⏳ Waiting before redirect...
🔄 Redirecting to dashboard...
🔍 Loading user with token: eyJhbGciOiJIUzI1NiIs...
✅ User loaded successfully: { user: { ... } }
```

**If you see errors:**
- Share the error message
- Check the Network tab for failed requests

### Step 2: Check Network Tab

1. Open Developer Tools (F12)
2. Go to Network tab
3. Try registering
4. Look for:
   - `/auth/register` request - should be 200/201
   - `/auth/me` request (after redirect) - should be 200
   - Check responses for both

### Step 3: Check localStorage

1. Open Developer Tools (F12)
2. Go to Application tab (or Storage)
3. Click on Local Storage → http://localhost:3001
4. Look for `token` key
5. Check if it has a value

### Step 4: Manual Test

Run this in browser console (on the register page):

```javascript
// Test registration
const test = async () => {
  try {
    const response = await fetch('https://click-platform.onrender.com/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test-' + Date.now() + '@example.com',
        password: 'Test123!@#',
        name: 'Test User'
      })
    })
    
    const data = await response.json()
    console.log('Registration response:', data)
    
    const token = data.data?.token || data.token
    if (token) {
      localStorage.setItem('token', token)
      console.log('✅ Token stored:', token.substring(0, 30))
      
      // Test /auth/me
      const meResponse = await fetch('https://click-platform.onrender.com/api/auth/me', {
        headers: { 'Authorization': 'Bearer ' + token }
      })
      
      const meData = await meResponse.json()
      console.log('/auth/me response:', meData)
      
      if (meData.user) {
        console.log('✅ Success! Redirecting...')
        window.location.href = '/dashboard'
      }
    }
  } catch (err) {
    console.error('Error:', err)
  }
}
test()
```

## Common Issues

### Issue 1: "Nothing happens" after clicking Sign Up
**Possible causes:**
- Request is timing out (server sleeping)
- Network error
- JavaScript error preventing submission

**Solution:**
- Check browser console for errors
- Wait 30-60 seconds and try again (Render.com free tier)
- Check Network tab to see if request was sent

### Issue 2: Redirects back to login immediately
**Possible causes:**
- Token not stored properly
- `/auth/me` request failing
- Dashboard auth check too strict

**Solution:**
- Check localStorage for token
- Check Network tab for `/auth/me` request
- Check console for auth errors

### Issue 3: Stuck on "Creating account..."
**Possible causes:**
- Request timed out
- Server not responding
- Network issue

**Solution:**
- Wait 60 seconds (Render.com free tier can be slow)
- Check Network tab for pending requests
- Try refreshing and registering again

## Quick Fixes

1. **Clear everything and try again:**
   ```javascript
   // Run in browser console
   localStorage.clear()
   sessionStorage.clear()
   location.reload()
   ```

2. **Wake up the server:**
   ```bash
   curl https://click-platform.onrender.com/api/health
   ```
   Wait 10 seconds, then try registering.

3. **Use the test page:**
   - Go to: http://localhost:3001/test-registration
   - Click "Run Full Registration Flow Test"
   - See detailed logs

## What to Share

If it still doesn't work, share:
1. Browser console errors (F12 → Console)
2. Network tab - `/auth/register` request details
3. Network tab - `/auth/me` request details (if it happens)
4. localStorage - token value (first 20 chars)

