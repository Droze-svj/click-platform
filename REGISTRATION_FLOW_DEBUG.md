# Registration Flow Debug Guide

## The Problem
After registration, user is redirected back to login page.

## Root Cause Analysis

The `/auth/me` endpoint returns:
```json
{
  "user": { ... }
}
```

The dashboard expects this format and extracts it. The issue might be:
1. Token not stored properly
2. Token not being read correctly
3. `/auth/me` request failing
4. Response format mismatch

## Debug Steps

### Step 1: Check Browser Console

1. Open browser console (F12)
2. Go to Console tab
3. Try to register
4. Look for these messages:

**During Registration:**
```
🔍 Registration Debug Info:
  - API_URL: https://click-platform.onrender.com/api
  - Full endpoint: https://click-platform.onrender.com/api/auth/register
✅ Token stored in localStorage
```

**After Redirect to Dashboard:**
```
🔍 Loading user with token: eyJhbGciOiJIUzI1NiIs...
🔍 API URL: https://click-platform.onrender.com/api
✅ User loaded successfully: { user: { ... } }
✅ Extracted user data: { id: ..., email: ..., ... }
```

**If you see errors:**
```
❌ Failed to load user: [error details]
```

### Step 2: Check Network Tab

1. Open Developer Tools (F12)
2. Go to Network tab
3. Try to register
4. Look for:
   - `/auth/register` request - should be 200/201
   - `/auth/me` request - should be 200
   - Check the response for `/auth/me`

### Step 3: Check localStorage

1. Open Developer Tools (F12)
2. Go to Application tab (or Storage)
3. Click on Local Storage → http://localhost:3000
4. Look for `token` key
5. Check if it has a value

### Step 4: Manual Test

Run this in browser console (on the register page):

```javascript
// Test registration
fetch('https://click-platform.onrender.com/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'test-' + Date.now() + '@example.com',
    password: 'Test123!@#',
    name: 'Test User'
  })
})
.then(r => r.json())
.then(data => {
  console.log('Registration response:', data)
  const token = data.data?.token || data.token
  if (token) {
    localStorage.setItem('token', token)
    console.log('Token stored:', token.substring(0, 20) + '...')
    
    // Test /auth/me
    return fetch('https://click-platform.onrender.com/api/auth/me', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
  }
})
.then(r => r.json())
.then(data => {
  console.log('/auth/me response:', data)
  if (data.user) {
    console.log('✅ Success! User:', data.user.email)
  } else {
    console.log('❌ No user in response')
  }
})
.catch(err => console.error('Error:', err))
```

## Common Issues

### Issue 1: Token Not Stored
**Symptom:** No token in localStorage
**Fix:** Check registration response format

### Issue 2: /auth/me Fails
**Symptom:** Error in console when loading dashboard
**Fix:** Check CORS, API URL, token format

### Issue 3: Response Format Mismatch
**Symptom:** User data is null
**Fix:** Check response format from /auth/me

### Issue 4: Timing Issue
**Symptom:** Token stored but not read
**Fix:** Added delay before redirect (already fixed)

## Quick Fix to Try

1. **Clear browser cache and localStorage:**
   ```javascript
   // Run in browser console
   localStorage.clear()
   location.reload()
   ```

2. **Try registering again**

3. **Check console for debug messages**

## What to Share

If it still doesn't work, share:
1. Browser console errors
2. Network tab - `/auth/register` response
3. Network tab - `/auth/me` response (if it happens)
4. localStorage - token value (first 20 chars)

