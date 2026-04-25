# Frontend Running on Port 3001

## Important Note

Your frontend is running on **port 3001** (not 3000) because port 3000 was already in use.

## Access URLs

- **Frontend:** http://localhost:3001
- **Test Registration Page:** http://localhost:3001/test-registration
- **Backend API:** https://click-platform.onrender.com/api

## Testing Registration

1. **Go to:** http://localhost:3001/register

2. **Fill in the form:**
   - Name
   - Email
   - Password

3. **Submit and watch the browser console (F12)**

4. **Expected console messages:**
   ```
   🔍 Registration Debug Info:
     - API_URL: https://click-platform.onrender.com/api
     - Full endpoint: https://click-platform.onrender.com/api/auth/register
   ✅ Token stored in localStorage
   ✅ Token verified in localStorage: eyJhbGciOiJIUzI1NiIs...
   🔄 Redirecting to dashboard...
   🔍 [useAuth] Checking auth with token: eyJhbGciOiJIUzI1NiIs...
   ✅ [useAuth] User loaded: { user: { ... } }
   ```

## If Still Having Issues

1. **Clear browser cache and localStorage:**
   ```javascript
   // Run in browser console (F12)
   localStorage.clear()
   location.reload()
   ```

2. **Use the test page:**
   - Go to: http://localhost:3001/test-registration
   - Click "Run Full Registration Flow Test"
   - Share the logs

3. **Check Network tab:**
   - Open Developer Tools (F12)
   - Go to Network tab
   - Try registering
   - Look for `/auth/register` and `/auth/me` requests
   - Check their status codes and responses

## Port 3000 Already in Use

If you want to use port 3000 instead:

1. **Find what's using port 3000:**
   ```bash
   lsof -i :3000
   ```

2. **Kill the process:**
   ```bash
   kill -9 <PID>
   ```

3. **Restart frontend:**
   ```bash
   cd client && npm run dev
   ```

But **port 3001 works fine** - just make sure you're accessing http://localhost:3001 instead of http://localhost:3000!

