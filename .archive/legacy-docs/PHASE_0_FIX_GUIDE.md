# Phase 0 Fix Guide — MongoDB + Redis

**Goal:** Fix MongoDB and Redis so Click works in production and collaborators can test.

---

## 1️⃣ Fix MongoDB Atlas IP Whitelist (~5 min)

**Problem:** MongoDB Atlas rejects connections from Render because Render's IPs aren't whitelisted.

### Steps

1. Go to **<https://cloud.mongodb.com>** and sign in
2. Select your project → **Network Access** (left sidebar)
3. Click **Add IP Address**
4. Click **Allow Access from Anywhere** (adds `0.0.0.0/0`)
   - Or manually enter: `0.0.0.0/0`
5. Click **Confirm**
6. Wait **1–2 minutes** for changes to apply

### Verify

- Redeploy your Render service (or wait for next deploy)
- Check Render logs — you should see: `✅ MongoDB connected successfully`

---

## 2️⃣ Fix Redis URL in Render (~5 min)

**Problem:** Workers try to connect to `127.0.0.1:6379` instead of Redis Cloud.

### Steps

1. Go to **<https://dashboard.render.com>**
2. Select your **Click** web service
3. Click **Environment** (left sidebar)
4. Find **REDIS_URL**:
   - If missing: Click **Add Environment Variable**
   - Key: `REDIS_URL`
   - Value: `redis://default:YOUR_PASSWORD@redis-HOST:PORT`
     - Get this from [Redis Cloud](https://app.redislabs.com) → Your database → Connect
5. **Important:**
   - No quotes around the value
   - No extra spaces before/after
   - Must start with `redis://` or `rediss://`
6. Click **Save Changes**
7. Render will auto-redeploy

### Example REDIS_URL

```
redis://default:NjVtJYF66oFrxmRDf6ebOinB7Rdavz9t@redis-10560.c270.us-east-1-3.ec2.cloud.redislabs.com:10560
```

### Verify

- After deploy, check Render logs
- You should see: `✅ Creating worker for video-processing with valid Redis connection`

---

## 3️⃣ Verify Phase 0

### Local (tests your .env)

```bash
npm run verify:phase0
```

### Production (tests live API)

```bash
BASE_URL=https://click-platform.onrender.com npm run verify:phase0
```

Expected:

- MongoDB: ✅
- Redis: ✅ (or ⚠️ if not set locally)
- API: ✅

---

## 4️⃣ ETIMEDOUT when project is on iCloud Drive (optional)

**Problem:** `Error: ETIMEDOUT: connection timed out, read` when running `npm run dev:client` — Node/Next.js time out reading files from the project path.

**Cause:** The project lives in **iCloud Drive** (`~/Library/Mobile Documents/com~apple~CloudDocs/...`). Sync and network delays make synchronous file reads time out.

### Recommended fix: move project to a local folder

1. Copy or clone the project to a **local** path, e.g.:

   ```bash
   cp -R "/Users/you/Library/Mobile Documents/com~apple~CloudDocs/WHOP AI V3" ~/Projects/WHOP-AI-V3
   cd ~/Projects/WHOP-AI-V3
   ```

2. Run from the new path:

   ```bash
   npm run dev:client
   ```

3. Keep using iCloud for backup (e.g. git push, sync another copy) — just don’t run Node/Next from inside the iCloud folder.

### If you must run from iCloud

- Try Turbopack (different I/O path, may avoid some timeouts):

  ```bash
  npm run dev:client:turbo
  ```

- Ensure **node_modules** is fully on disk: run `npm install` in project root and in `client/`, then wait for iCloud to finish syncing before starting dev.
- Use a fast, stable network; avoid putting the Mac to sleep while dev is running.

---

## Summary

| Issue | Where to Fix | Time |
|-------|--------------|------|
| MongoDB IP | MongoDB Atlas → Network Access → Add 0.0.0.0/0 | 5 min |
| Redis URL | Render → Environment → REDIS_URL | 5 min |

After both fixes, Click is ready for production and collaborator testing.
