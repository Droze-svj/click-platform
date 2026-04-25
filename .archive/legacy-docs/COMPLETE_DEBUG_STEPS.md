# Complete Debug Steps - Registration Not Working

## Step 1: Check if Services Are Running

### Frontend Check:
```bash
curl http://localhost:3001
```
If this fails, restart frontend:
```bash
cd client && npm run dev
```

### Backend Check:
```bash
curl https://click-platform.onrender.com/api/health
```
Should return: `{"status":"ok",...}`

## Step 2: Try the Simple Registration Page

Go to: **http://localhost:3001/simple-register**

This is a minimal page with no dependencies - just pure fetch API.

## Step 3: Check Browser Console

1. Open Developer Tools (F12)
2. Go to Console tab
3. Try registering
4. **Copy ALL console messages** and share them

## Step 4: Check Network Tab

1. Open Developer Tools (F12)
2. Go to Network tab
3. Try registering
4. Look for `/auth/register` request
5. Click on it and check:
   - Status code
   - Response body
   - Request headers
   - **Share a screenshot or copy the details**

## Step 5: Test Direct API Call

Open browser console (F12) and run:

```javascript
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
  console.log('SUCCESS:', data)
  if (data.data?.token) {
    localStorage.setItem('token', data.data.token)
    console.log('Token stored!')
    window.location.href = '/dashboard'
  }
})
.catch(err => console.error('ERROR:', err))
```

**What happens when you run this?**

## Step 6: Check localStorage

In browser console, run:
```javascript
console.log('Token:', localStorage.getItem('token'))
```

**What does it show?**

## Common Issues

### Issue 1: "Network Error" or "Failed to fetch"
- **Cause:** Server is sleeping (Render.com free tier)
- **Fix:** Wait 30-60 seconds, then try again
- **Test:** Run `curl https://click-platform.onrender.com/api/health` first

### Issue 2: "CORS error"
- **Cause:** Backend CORS not configured
- **Fix:** Check server CORS settings

### Issue 3: "Token stored but redirect doesn't work"
- **Cause:** Dashboard redirecting back to login
- **Fix:** Check dashboard auth logic

### Issue 4: "Nothing happens when clicking button"
- **Cause:** JavaScript error preventing form submission
- **Fix:** Check browser console for errors

## What I Need From You

Please share:

1. **Browser console output** (F12 → Console) when you try to register
2. **Network tab details** for the `/auth/register` request
3. **What happens** when you run the direct API call in console
4. **localStorage token value** (first 20 chars)
5. **Any error messages** you see

This will help me identify the exact issue!

