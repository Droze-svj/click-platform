# Click — Private Beta Launch Runbook (5 testers)

Goal: get Click live on one URL so 5 testers can sign up and use the real
product (no fake data, no paywall) and you can collect genuine feedback.

Architecture for the beta: **one Render service, one URL**. The Express server
serves both the API (`/api/*`) and the Next.js app (everything else) in a single
process. Media is stored in **Cloudinary** so uploads survive restarts.

---

## 1. One-time setup

### 1a. Cloudinary (media storage — required)
1. Sign up free at https://cloudinary.com/users/register_free
2. On the dashboard, copy three values: **Cloud name**, **API Key**, **API Secret**.
3. You'll paste them into Render in step 2 as `CLOUDINARY_CLOUD_NAME`,
   `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. (When these are set the server
   automatically stores uploads/exports in Cloudinary instead of local disk.)

### 1b. Gemini AI key (required for AI features)
- Get a key at https://aistudio.google.com/apikey → set as `GOOGLE_AI_API_KEY`.

### 1c. MongoDB + Redis (required)
- **MongoDB**: a free Atlas cluster (https://www.mongodb.com/atlas) → connection
  string → `MONGODB_URI`.
- **Redis**: Upstash free tier (https://upstash.com) → `rediss://...` URL →
  `REDIS_URL`. **Do not wrap the value in quotes.**

### 1d. Secrets
- `JWT_SECRET`: a random 32+ char string (`openssl rand -hex 32`).
- `OAUTH_ENCRYPTION_KEY`: another random 32+ char string.

---

## 2. Set environment variables in Render

In the Render dashboard for the service (Settings → Environment), set the
`sync: false` vars from `render.yaml`. **Minimum to launch the beta:**

| Var | Value | Why |
|-----|-------|-----|
| `MONGODB_URI` | your Atlas URI | data store (fatal if missing) |
| `JWT_SECRET` | random 32+ chars | auth (fatal if missing) |
| `GOOGLE_AI_API_KEY` | Gemini key | AI features |
| `REDIS_URL` | `rediss://…` (no quotes) | job queue + rate limits |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | from 1a | persistent media |
| `OAUTH_ENCRYPTION_KEY` | random 32+ chars | encrypts OAuth tokens |

Already pinned in `render.yaml` (no action needed): `NODE_ENV=production`,
`PORT=5001`, `FRONTEND_URL` + `APP_URL` (= the Render URL), `AUTO_VERIFY_EMAIL=true`.

**Important — auth store:** leave Supabase vars UNSET for the beta (the server
then uses its built-in MongoDB auth). If you set `SUPABASE_URL` +
`SUPABASE_SERVICE_ROLE_KEY`, the server runs a boot probe and **exits if it
fails** — only set them if you've actually configured Supabase auth.

Optional (only if testers will use them): social OAuth client IDs/secrets,
`SENDGRID_API_KEY` (transactional email), `WHOP_*` (real payments), `SENTRY_DSN`
(already set — error monitoring).

---

## 3. Deploy

> ⚠️ Click is its **own** Render service — do **not** reuse
> `sovereign-platform.onrender.com` (that URL hosts a different product,
> "Sovereign Trading"). `render.yaml` is named `click-platform`.

**Create Click's Render service (one time):**
1. Render → **New → Blueprint** → connect the **`Droze-svj/click-platform`** GitHub
   repo. Render reads `render.yaml` and proposes a `click-platform` web service
   (Docker). Approve it. It deploys to e.g. `https://click-platform.onrender.com`.
2. If Render assigns a different URL (suffix), update `FRONTEND_URL` + `APP_URL` in
   the service's env to that exact URL, and redeploy.
3. Set the secret env vars (section 2) — most values are in your `.env.production`;
   add the 3 Cloudinary vars.
4. Confirm auto-deploy is on `main`. Future pushes to `main` redeploy automatically.

The build uses `./Dockerfile` (builds the Next app, installs ffmpeg/yt-dlp/c2patool,
runs `node server/index.js`). Health check = `/api/health/light` (200 when up).

When live, open the URL — you should see the **Click** app (login / landing). If you
see a debug/status page, `NODE_ENV` isn't `production`. If you see "Sovereign
Trading", you opened the wrong service.

### Verify the deploy (2-min smoke test)
- `GET /api/health/light` → 200.
- `GET /api/health` → shows integrations (mongo/redis/gemini/c2pa) status.
- Open `/` → app loads. `/register` → can create an account.
- Upload a short video on `/dashboard/video` → it processes → AI auto-edit
  produces a clip you can play/download.

---

## 4. Onboard the 5 testers

### (Optional) Close sign-up to just your testers
By default anyone with the URL can register. To gate it, set EITHER in Render:
- `BETA_ALLOWED_EMAILS` = comma-separated tester emails (only those can register), or
- `BETA_INVITE_CODE` = a shared code you give testers (the register page shows an
  "Invite code" field when this is set).

Leave both unset for open registration. The server enforces the gate; the UI shows
the invite-code field automatically when a code is configured.

### Steps
1. Send them the Render URL and have each **register** at `/register`
   (with the invite gate on, they use an invited email or the invite code).
   - New accounts automatically get a **14-day trial** with pro-level features,
     so they can start immediately.
2. To give testers **full, year-long access to every feature** (best for
   feedback), comp their accounts after they register:
   ```bash
   # from the project root, with MONGODB_URI set in your env/.env
   node scripts/comp-beta-testers.js tester1@email.com tester2@email.com ...
   # or: BETA_TESTERS="a@x.com,b@y.com" node scripts/comp-beta-testers.js
   ```
   This sets each to `active` / `agency` plan (top "elite" tier) for 1 year.
   Re-runnable; tells you which emails weren't found (register first).
   - You can run this locally (it connects straight to MongoDB) or via a Render
     one-off shell.

---

## 5. Watch feedback & errors

- **Errors**: client + server errors flow to **Sentry** (DSN already configured).
  Watch the Sentry project while testers use the app.
- **Health/integrations**: `GET /api/health` shows live dependency status.
- Ask testers to report: what they tried, what they expected, what happened.

---

## 6. Email & password reset (optional but recommended)

Transactional email (verification + password reset) is OFF until you set a
provider. Beta accounts are auto-verified (`AUTO_VERIFY_EMAIL=true`), so email is
NOT required for sign-in — but without it, password reset emails won't send.

To enable it, set ONE of:
- **SendGrid** (default): `SENDGRID_API_KEY` + `SENDGRID_FROM_EMAIL` (a verified
  sender). Uses SendGrid's SMTP relay.
- **Any SMTP**: `EMAIL_PROVIDER=smtp` + `SMTP_HOST` + `SMTP_PORT` + `SMTP_USER` +
  `SMTP_PASS` (auto-detected if `SMTP_HOST` is set even without `EMAIL_PROVIDER`).
- Also set `EMAIL_FROM` + `EMAIL_FROM_NAME` for the From header.

Once set: registration sends a real verification email, and **Forgot password →
/reset-password** works end-to-end (the reset page now exists; link expires in 1h).
If email is off and a tester forgets their password, reset it manually (re-run the
comp script or update the user in MongoDB).

## 7. Known beta notes (tell your testers)

- **Export works**: the manual editor's Export renders a real MP4 (filters, text
  & shape overlays, trims, music) via ffmpeg and downloads it. AI-edited clips are
  also downloadable from the video page.
- **Translations** in non-English locales are machine-quality (no human review).
- **Social publishing** requires connecting a real account (OAuth creds set);
  without it the publish UI tells the user to connect first.

---

## 7. Before public launch (post-beta hardening)

- Set up real email (SendGrid) + the password-reset page; turn OFF
  `AUTO_VERIFY_EMAIL`.
- Add a beta/invite gate if you don't want fully-open registration.
- Enable + verify the full Export render pipeline (Remotion + headless Chromium).
- Tighten CORS to the exact domain; review rate limits for real traffic.
- Consider a separate worker dyno if upload/processing volume grows (currently
  workers run in the web process).
