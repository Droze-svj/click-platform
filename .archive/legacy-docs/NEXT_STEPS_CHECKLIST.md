# Next steps checklist

Use this after Phase 0 (MongoDB + Redis + API) is done.

---

## Local development

- [x] **REDIS_URL** in `.env` (Redis Cloud URL, no quotes)
- [x] **MONGODB_URI** in `.env`
- [x] Run `npm run verify:phase0` → MongoDB ✅, Redis ✅, API ✅
- [x] Run `npm run dev` → backend (port 5001) + frontend (port 3010)

**Open the app:** [http://localhost:3010](http://localhost:3010)

**Useful commands:**

- `npm run dev` — start backend + client
- `npm run verify:phase0` — check MongoDB, Redis, API
- `npm run test:unit` — run unit tests

---

## Production (Render)

1. **Environment**
   - Render Dashboard → your **service** → **Environment**
   - Add or confirm:
     - `MONGODB_URI` — Atlas connection string
     - `REDIS_URL` — same Redis Cloud URL as in `.env` (no quotes, no spaces)
     - `JWT_SECRET`, `FRONTEND_URL` / `APP_URL`, and any OAuth keys you use

2. **Deploy**
   - Push to the branch Render deploys from (e.g. `main`), or trigger a manual deploy.

3. **Verify**

   ```bash
   BASE_URL=https://your-app.onrender.com npm run verify:phase0
   ```

---

## Optional

- **Sentry:** Set `SENTRY_DSN` (and `NEXT_PUBLIC_SENTRY_DSN` for client) for error tracking.
- **Cloud storage:** Already in `.env.example` — set AWS or Cloudinary vars for production uploads.
- **Background workers:** If video processing jobs don’t run, check Render logs for Redis/BullMQ worker messages; ensure `REDIS_URL` is set in Render.
