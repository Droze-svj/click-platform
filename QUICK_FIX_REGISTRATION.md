# Quick Fix for Registration Issue

## Try This First

### Step 1: Clear Everything
1. Open browser console (F12)
2. Run this command:
   ```javascript
   localStorage.clear()
   sessionStorage.clear()
   location.reload()
   ```

### Step 2: Wake Up Server
```bash
curl https://click-platform.onrender.com/api/health
```

Wait 10 seconds.

### Step 3: Register Again
1. Go to http://localhost:3000/register
2. Fill in the form
3. Submit
4. **Watch the browser console** for debug messages

### Step 4: Check What Happens

**If you see in console:**
- `✅ Token stored in localStorage` - Good!
- `🔍 Loading user with token` - Good!
- `✅ User loaded successfully` - Should work!

**If you see errors:**
- Share the error message from console
- Check Network tab for failed requests

## Alternative: Test Directly

Open browser console and run:

```javascript
// Register
const registerResponse = await fetch('https://click-platform.onrender.com/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'direct-test-' + Date.now() + '@example.com',
    password: 'Test123!@#',
    name: 'Direct Test'
  })
})

const registerData = await registerResponse.json()
console.log('Registration:', registerData)

const token = registerData.data?.token || registerData.token
if (token) {
  localStorage.setItem('token', token)
  console.log('✅ Token stored')
  
  // Test /auth/me
  const meResponse = await fetch('https://click-platform.onrender.com/api/auth/me', {
    headers: { 'Authorization': 'Bearer ' + token }
  })
  
  const meData = await meResponse.json()
  console.log('/auth/me response:', meData)
  
  if (meData.user) {
    console.log('✅ Success! Redirecting to dashboard...')
    window.location.href = '/dashboard'
  } else {
    console.log('❌ No user in response')
  }
}
```

If this works, the issue is with the registration form. If it doesn't, share the error.

