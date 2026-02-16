# Next steps — your setup

Your repo is set up for **both local and Render**.

---

## Your setup

| Environment | Backend (API) | Frontend | Config |
|-------------|----------------|----------|--------|
| **Local** | `http://localhost:5001` | `http://localhost:3010` | `.env` |
| **Render** | `https://click-platform.onrender.com` | Same URL or separate (Next.js) | Render Dashboard → Environment |

- **render.yaml** defines the **click-platform** web service (Node, `npm start` = backend).
- **client/next.config.js** uses `https://click-platform.onrender.com/api` as API URL for production.
- CORS in **server/index.js** allows `click-platform.onrender.com` and `*.onrender.com`.

So: **local** = you run backend + frontend on your machine. **Render** = backend (and possibly frontend) runs on Render at `click-platform.onrender.com`.

---

## Next steps: local only

You’re already in good shape:

1. **REDIS_URL** and **MONGODB_URI** are in `.env` ✅
2. Run:

   ```bash
   npm run verify:phase0
   npm run dev
   ```

3. Open **<http://localhost:3010>**.

No further steps required for local-only use.

---

## Next steps: also deploying to Render

Do these so the **click-platform** service on Render works like your local setup.

### 1. Set environment variables on Render

1. Go to **[Render Dashboard](https://dashboard.render.com)**.
2. Open the **click-platform** service.
3. Go to **Environment**.
4. Add or confirm (values from your working `.env`; **never commit real values to git**):

| Key | Required | Notes |
|-----|----------|--------|
| `NODE_ENV` | Yes | `production` (render.yaml may set this) |
| `MONGODB_URI` | Yes | Same Atlas URI as in `.env` |
| `REDIS_URL` | Yes | Same Redis Cloud URL as in `.env` (no quotes) |
| `JWT_SECRET` | Yes | Same as `.env` |
| `FRONTEND_URL` | Yes | `https://click-platform.onrender.com` (or your real frontend URL if different) |
| `SUPABASE_URL` | If you use Supabase | From `.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | If you use Supabase | From `.env` |
| OAuth / SendGrid / Sentry / etc. | Optional | Add any you use in production |

1. **Save**. Render will redeploy.

### 2. Deploy

- **Auto-deploy:** Push to the branch connected to Render (e.g. `main`).
- **Manual:** Render Dashboard → click-platform → **Manual Deploy** → **Deploy latest commit**.

### 3. Verify production

After the deploy is live:

```bash
BASE_URL=https://click-platform.onrender.com npm run verify:phase0
```

You should see:

- MongoDB: ✅
- Redis: ✅ (or ⚠️ if the script skips remote Redis check)
- API: ✅

### 4. Optional: frontend on Render

If the **frontend** is also on Render (separate service or same service serving the client):

- Set **Build Command** to something like: `npm run build` (so the client is built).
- Ensure that service’s **Environment** has the correct API URL (e.g. `NEXT_PUBLIC_API_URL=https://click-platform.onrender.com/api` if you use that in the client).

---

## Summary

- **Local only:** Use `.env` and `npm run dev`; you’re done.
- **Render as well:** Set the env vars above on the **click-platform** service (especially `MONGODB_URI`, `REDIS_URL`, `JWT_SECRET`, `FRONTEND_URL`), deploy, then run:

  ```bash
  BASE_URL=https://click-platform.onrender.com npm run verify:phase0
  ```

Use **NEXT_STEPS_CHECKLIST.md** for a short generic checklist; this file is the exact flow for your repo and Render service.
