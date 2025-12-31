# 🔧 Fix: "Cannot find module '/opt/render/project/src/index.js'"

**Problem**: Render.com is looking for the wrong entry point file.

---

## 🎯 The Issue

Render.com is trying to find: `/opt/render/project/src/index.js`  
But your app's entry point is: `server/index.js`

---

## ✅ Solution: Fix Start Command in Render.com

### Step 1: Go to Render.com Dashboard

1. **Go to your Render.com dashboard**
2. **Click on your web service**
3. **Go to "Settings" tab**

### Step 2: Update Start Command

Find the **"Start Command"** field and change it to:

```bash
npm start
```

**Or explicitly**:

```bash
node server/index.js
```

---

## 📋 Complete Render.com Configuration

Make sure these settings are correct:

| Setting | Value |
|---------|-------|
| **Environment** | `Node` |
| **Build Command** | `npm install && cd client && npm install && npm run build` |
| **Start Command** | `npm start` |
| **Root Directory** | (leave empty or `/`) |

---

## 🔍 Verify Your package.json

Your `package.json` should have:

```json
{
  "main": "server/index.js",
  "scripts": {
    "start": "node server/index.js"
  }
}
```

This is correct - the issue is just that Render needs the right start command.

---

## 🚀 Quick Fix Steps

1. **Render.com Dashboard** → Your service → **Settings**
2. **Find "Start Command"**
3. **Change to**: `npm start`
4. **Save Changes**
5. **Redeploy** (or it will auto-redeploy)

---

## ⚠️ Common Mistakes

### ❌ Wrong Start Commands:
- `node index.js` ❌ (file doesn't exist)
- `node src/index.js` ❌ (wrong path)
- `npm run dev` ❌ (development mode)

### ✅ Correct Start Command:
- `npm start` ✅
- `node server/index.js` ✅

---

## 📝 Alternative: Create render.yaml (Optional)

You can also create a `render.yaml` file in your project root:

```yaml
services:
  - type: web
    name: click-platform
    env: node
    buildCommand: npm install && cd client && npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 5001
```

This ensures Render always uses the correct commands.

---

## ✅ Verification

After updating the start command:

1. **Save settings** in Render.com
2. **Check build logs** - should show successful build
3. **Check runtime logs** - should show server starting
4. **Test health endpoint**: `https://your-app.onrender.com/api/health`

---

## 🆘 If Still Not Working

### Check Build Logs:
- Look for errors during build
- Verify `server/index.js` exists
- Check Node.js version compatibility

### Check Runtime Logs:
- Look for "Cannot find module" errors
- Verify the start command is correct
- Check file paths

### Verify File Structure:
```
project-root/
├── server/
│   └── index.js  ← This should exist
├── client/
├── package.json
└── ...
```

---

## 🎯 Summary

**The Fix**: Change Render.com start command to `npm start`

**Why**: Your app entry point is `server/index.js`, not `src/index.js`

**How**: Render.com Dashboard → Settings → Start Command → `npm start`

---

**Update the start command in Render.com and redeploy! 🚀**

