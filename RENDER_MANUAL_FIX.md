# 🔧 Manual Fix: "Cannot find module '/opt/render/project/src/index.js'"

**Render.com is still using the wrong start command**

---

## 🎯 The Problem

Even with `render.yaml`, Render.com might still be using old settings. You need to **manually update the start command** in Render.com dashboard.

---

## ✅ Solution: Update Start Command Manually

### Step 1: Go to Render.com Settings

1. **Go to**: https://dashboard.render.com
2. **Click on your web service** (click-platform or whatever you named it)
3. **Click "Settings" tab** (in the left sidebar)

### Step 2: Find and Update Start Command

1. **Scroll down** to find "Start Command" field
2. **Delete** whatever is there (probably `node src/index.js` or empty)
3. **Type exactly**: `npm start`
4. **Click "Save Changes"** (at the bottom)

### Step 3: Verify Build Command

While you're there, also check "Build Command" is:
```
npm install && cd client && npm install && npm run build
```

---

## 📋 Complete Settings Checklist

In Render.com Settings tab, verify:

| Setting | Should Be |
|---------|-----------|
| **Environment** | `Node` |
| **Build Command** | `npm install && cd client && npm install && npm run build` |
| **Start Command** | `npm start` |
| **Root Directory** | (empty or `/`) |

---

## 🚀 After Updating

1. **Save changes** in Render.com
2. **Go to "Events" tab**
3. **Click "Manual Deploy"** → "Deploy latest commit"
4. **Watch the logs** - should now show `npm start` running
5. **Check for errors** - should start from `server/index.js`

---

## ✅ Verification

After deployment, check logs should show:

```
> click@1.0.0 start
> node server/index.js

🚀 Server running on port 5001
```

**Not**:
```
Error: Cannot find module '/opt/render/project/src/index.js'
```

---

## 🆘 If Still Not Working

### Option 1: Delete and Recreate Service

1. **Delete** the current service in Render.com
2. **Create new service** from same GitHub repo
3. **Render will auto-detect** `render.yaml` this time
4. **Add environment variables**
5. **Deploy**

### Option 2: Check render.yaml Location

Make sure `render.yaml` is in the **root** of your repository:
```
click-platform/
├── render.yaml  ← Should be here
├── package.json
├── server/
└── client/
```

---

## 📝 Quick Fix Commands

If you need to verify render.yaml is correct:

```bash
cd "/Users/orlandhino/WHOP AI V3"
cat render.yaml
```

Should show:
```yaml
services:
  - type: web
    name: click-platform
    env: node
    buildCommand: npm install && cd client && npm install && npm run build
    startCommand: npm start
```

---

## 🎯 Most Important Step

**Go to Render.com → Settings → Start Command → Change to `npm start` → Save**

This will fix it immediately!

---

**Update the start command manually in Render.com settings! 🚀**

