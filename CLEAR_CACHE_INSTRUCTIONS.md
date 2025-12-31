# Clear Browser Cache Instructions

## The Issue
The "Connection lost" message is still showing because your browser has cached the old JavaScript code.

## Solution: Hard Refresh

### On Mac (Chrome/Safari/Firefox):
1. Press `Cmd + Shift + R`
2. OR `Cmd + Option + R`
3. OR Hold `Shift` and click the refresh button

### On Windows/Linux (Chrome/Firefox):
1. Press `Ctrl + Shift + R`
2. OR `Ctrl + F5`
3. OR Hold `Shift` and click the refresh button

### Alternative: Clear Cache Manually

**Chrome:**
1. Press `F12` to open DevTools
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

**Firefox:**
1. Press `Ctrl+Shift+Delete` (Windows) or `Cmd+Shift+Delete` (Mac)
2. Select "Cache"
3. Click "Clear Now"
4. Refresh the page

**Safari:**
1. Press `Cmd + Option + E` to clear cache
2. Refresh the page

## After Clearing Cache

1. Go to: http://localhost:3001/register
2. The "Connection lost" message should be gone
3. Try registering

## If Still Seeing the Message

1. **Check browser console (F12):**
   - Look for any errors
   - Check the Network tab to see if the new code is loading

2. **Verify the frontend is running:**
   ```bash
   curl http://localhost:3001
   ```

3. **Restart the frontend:**
   ```bash
   # Stop the current process (Ctrl+C)
   cd client && npm run dev
   ```

## What Was Fixed

- `RealtimeConnection` component now hides on `/login` and `/register` pages
- It only shows for logged-in users
- It waits 3 seconds before showing the warning
- Uses production WebSocket URL instead of localhost

The registration form should work perfectly now!

