# Click — Launch Checklist (Render + OAuth + Whop + SendGrid)

This is the exact ordered set of external clicks that get Click from "code is on `main`" to "live with paying customers." Everything code-side is already done; this is the operations sequence only you can perform.

After every step, run `pnpm preflight` locally — it'll tell you exactly what's still missing.

Estimated total time: **3-5 hours active work spread over 1-6 weeks** (most of the wait is platform OAuth review time on the providers' side).

---

## Step 0 — Local sanity check (5 min)

```bash
pnpm preflight
```

Today this fails with **24 placeholder values in `.env.production`** + 6 optional missing items. That's the baseline you're starting from. Run this again after each step below to watch the failures shrink to 0.

---

## Step 1 — SendGrid (transactional email) · 30 min, free tier OK

**Why first**: the cheapest external service, unblocks real email verification for new signups, only thing standing between you and remote testers being able to register without `AUTO_VERIFY_EMAIL=true`.

1. Sign up: <https://signup.sendgrid.com> (Free tier = 100 emails/day, no card needed).
2. Verify your sending email: **Settings → Sender Authentication → Single Sender Verification** → add `noreply@<yourdomain>` (or any email you control) → click verification link they email you.
3. **Settings → API Keys → Create API Key**:
   - Name: `click-production`
   - Permissions: **Restricted Access** → enable only "Mail Send" (full access).
   - Copy the key (you only see it once).
4. Paste two env vars into `.env.production` and Render dashboard:
   ```bash
   SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   SENDGRID_FROM_EMAIL=noreply@yourdomain.com
   ```
5. Verify: `pnpm preflight` — the two SendGrid placeholder errors should be gone.

**Optional but recommended**: instead of Single Sender, do **Domain Authentication** (Settings → Sender Authentication → Authenticate Your Domain) and add the 3 CNAME records to your DNS. Better deliverability + you can send from any address `@yourdomain`.

---

## Step 2 — Whop products + webhook · 30-60 min, free seller account

**Why second**: this is what makes the upgrade buttons actually charge money. Without it, every "Upgrade to Pro" click is a dead end.

1. Sign up: <https://whop.com> → become a seller (free).
2. **Create your storefront** (one-time, takes 10 min) — pick a name, upload a logo.
3. **Products → Add Product**. Create six products:
   | Name | Billing | Price |
   |---|---|---|
   | Click — Creator | Monthly | $49 |
   | Click — Creator | Yearly | $470 (~20% off) |
   | Click — Pro | Monthly | $99 |
   | Click — Pro | Yearly | $950 |
   | Click — Agency | Monthly | $249 |
   | Click — Agency | Yearly | $2390 |
4. For each product, click into it → **Settings tab** → copy the **Product ID** (looks like `prod_aB1Cd2EfG3`). And click **"Get checkout link"** → copy the URL.
5. Paste 12 env vars:
   ```bash
   # 6 product IDs (server uses these to map webhook events to plan tiers)
   WHOP_PRODUCT_ID_CREATOR_MONTHLY=prod_aB1Cd...
   WHOP_PRODUCT_ID_CREATOR_YEARLY=prod_xY2Zw...
   WHOP_PRODUCT_ID_PRO_MONTHLY=prod_...
   WHOP_PRODUCT_ID_PRO_YEARLY=prod_...
   WHOP_PRODUCT_ID_AGENCY_MONTHLY=prod_...
   WHOP_PRODUCT_ID_AGENCY_YEARLY=prod_...

   # 6 checkout URLs (the landing-page pricing cards link to these)
   NEXT_PUBLIC_WHOP_URL_CREATOR_MONTHLY=https://whop.com/checkout/...
   NEXT_PUBLIC_WHOP_URL_CREATOR_YEARLY=https://whop.com/checkout/...
   NEXT_PUBLIC_WHOP_URL_PRO_MONTHLY=https://whop.com/checkout/...
   NEXT_PUBLIC_WHOP_URL_PRO_YEARLY=https://whop.com/checkout/...
   NEXT_PUBLIC_WHOP_URL_AGENCY_MONTHLY=https://whop.com/checkout/...
   NEXT_PUBLIC_WHOP_URL_AGENCY_YEARLY=https://whop.com/checkout/...
   ```
6. **Set up the webhook** (this is what flips a user's plan after payment succeeds):
   - Whop dashboard → **Settings → Webhooks → Add endpoint**.
   - Endpoint URL: `https://<your-render-domain>/api/webhooks/whop` (you'll have this after Step 4; for now, use a placeholder you'll edit later).
   - Subscribe to events: `payment.succeeded`, `membership.went_valid`, `membership.went_invalid`, `subscription.cancelled`, `payment.failed`.
   - Whop generates a **signing secret** → paste into env:
     ```bash
     WHOP_WEBHOOK_SECRET=whsec_...
     ```
7. Verify: `pnpm preflight` — 13 Whop-related placeholder errors should be gone.

---

## Step 3 — OAuth applications (the slow ones) · 2-6 weeks

Each platform has its own dev-portal process. Start them **in parallel** today — the review queues are independent.

### 3a · YouTube (Google) · fastest, often same-day verification

1. <https://console.cloud.google.com/> → create a new project named "Click".
2. **APIs & Services → Library** → search "YouTube Data API v3" → **Enable**.
3. **APIs & Services → OAuth consent screen**:
   - User type: **External**.
   - Fill app name "Click", support email, dev contact email.
   - **Scopes** → Add `https://www.googleapis.com/auth/youtube.upload` and `youtube.readonly`.
   - **Publishing status** → click **"Publish App"**. Google reviews sensitive scopes (the upload one); takes 1-7 days.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Authorized redirect URI: `https://<your-render-domain>/api/oauth/youtube/callback` (also add `http://localhost:5001/api/oauth/youtube/callback` for local testing).
   - Copy the client ID + secret.
5. Paste:
   ```bash
   YOUTUBE_CLIENT_ID=620....apps.googleusercontent.com
   YOUTUBE_CLIENT_SECRET=GOCSPX-...
   ```

### 3b · X (Twitter) · paid Basic tier required for write scopes

1. <https://developer.twitter.com/en/portal/projects-and-apps> → sign in with the X account that will own the app.
2. You'll be prompted to subscribe to the **Basic tier ($100/month)** to get write permissions. Free tier is read-only.
3. Create a new App → User authentication settings:
   - **App permissions**: Read + Write.
   - **Type**: Web App.
   - **Callback URI**: `https://<your-render-domain>/api/oauth/twitter/callback`
   - **Website URL**: your domain.
4. **Keys and tokens** tab → copy OAuth 2.0 Client ID and Client Secret.
5. Paste:
   ```bash
   TWITTER_CLIENT_ID=...
   TWITTER_CLIENT_SECRET=...
   ```

### 3c · TikTok · Content Posting API needs app review (1-3 weeks)

1. <https://developers.tiktok.com/apps> → register as a developer (free, requires phone verification).
2. **Manage apps → Connect an app**:
   - App name: "Click".
   - Category: "Productivity" or "Marketing".
   - **Add product**: **Login Kit** + **Content Posting API**.
3. **Content Posting API → Submit for Review**. Fill the use-case form (be specific: "Schedule and publish videos creators have edited in Click").
4. Wait. Approval typically 1-3 weeks. **Status**: track in the developer console.
5. Once approved, **Settings tab**:
   - **Redirect domain**: register `<your-render-domain>`.
   - **Login Kit redirect URI**: `https://<your-render-domain>/api/oauth/tiktok/callback`.
6. Copy Client Key + Client Secret.
7. Paste:
   ```bash
   TIKTOK_CLIENT_KEY=aw...
   TIKTOK_CLIENT_SECRET=...
   ```

### 3d · LinkedIn · company verification required (2-4 weeks)

1. <https://www.linkedin.com/developers/apps> → **Create app**.
2. Required: a **LinkedIn Company Page**. You can create one in 10 minutes; you don't need a registered legal entity, just a page that represents Click.
3. App settings:
   - Logo, app name, description.
   - **Products** → request "Share on LinkedIn" + "Sign In with LinkedIn".
4. **Auth tab**:
   - Redirect URLs: `https://<your-render-domain>/api/oauth/linkedin/callback`.
5. **Settings tab** → submit for verification. LinkedIn checks that the company page is real (2-4 weeks).
6. After approval, copy Client ID + Client Secret.
7. Paste:
   ```bash
   LINKEDIN_CLIENT_ID=...
   LINKEDIN_CLIENT_SECRET=...
   ```

### 3e · Meta (Reels via Instagram) · slowest, business verification (4-6 weeks)

1. <https://developers.facebook.com/> → **My Apps → Create App** → "Business" type.
2. **Add products**:
   - Facebook Login → set callback to `https://<your-render-domain>/api/oauth/facebook/callback`
   - Instagram Graph API → for Reels publishing.
3. **App Review → Permissions and Features**:
   - Request: `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`.
4. **Business Verification** (Settings → Basic → Business Verification): Meta requires this for any app touching content publishing. Provide: business legal name, business address, business phone, business website. Verification takes 1-4 weeks.
5. After verification + permissions approval, copy App ID + App Secret.
6. Paste:
   ```bash
   FACEBOOK_APP_ID=...
   FACEBOOK_APP_SECRET=...
   INSTAGRAM_CLIENT_ID=... # often the same as FACEBOOK_APP_ID
   INSTAGRAM_CLIENT_SECRET=...
   ```

---

## Step 4 — Render deploy · 1-2 hours first time

**Prereq**: Steps 1, 2 done. OAuth providers (Step 3) can keep maturing in parallel — deploy without them and add as each one approves.

1. Sign up: <https://render.com> → connect GitHub.
2. **New → Web Service** → select this repo (`WHOP_AI_V3`).
3. Settings:
   - **Branch**: `main`.
   - **Runtime**: `Docker` (auto-detected from `render.yaml`).
   - **Region**: `Oregon` (matches `render.yaml`).
   - **Instance Type**: start with **Starter ($7/mo)**. Upgrade to Standard ($25/mo) when you have real traffic.
   - **Auto-deploy**: On.
4. **Environment** tab → paste every var from `.env.production`. Critical:
   - All 7 SendGrid + Whop vars from Steps 1-2.
   - Whatever OAuth credentials you have so far (you can add the rest as they approve).
   - `NODE_ENV=production` (already in render.yaml).
   - `JWT_SECRET=<run `openssl rand -hex 64` and paste>`.
   - `MONGODB_URI=<your Atlas connection string>`.
   - `REDIS_URL=<your Upstash connection string>`.
   - `APP_URL=https://<the render domain Render gives you>` (you'll know this after first deploy; redeploy with it set).
   - **Do NOT set `AUTO_VERIFY_EMAIL=true`** in prod (that's the staging-only opt-out).
5. **Create Web Service** → Render builds the Docker image (~5-7 min first time).
6. Watch the build log. Look for:
   - `ffmpeg version <something with libfreetype + libfontconfig>` — confirms the GPL build that auto-edit needs.
   - `✓ Ready in <ms>` (Next) and `Server started on port 5001` (Node).
7. Once live, the URL is `https://<your-name>.onrender.com`. Hit `/api/health` — should be 200 with `status: "ok"` and all dependencies `connected: true`.
8. **Update the Whop webhook URL** (Step 2.6) to use this real domain.
9. **Custom domain** (optional): Render → Settings → Custom Domain → add `click.yourdomain.com`, point your DNS CNAME to Render's value, wait ~15 min for TLS cert.

---

## Step 5 — Final post-deploy verification · 30 min

1. Run `pnpm preflight` locally one more time — should be all-green (or only the OAuth providers still pending review).
2. From the live URL:
   - <https://your-domain>/api/health → 200, all deps connected
   - <https://your-domain>/login → register a fresh real user → verify the verification email arrives (proves SendGrid wired)
   - <https://your-domain>/#pricing → click "Upgrade to Pro" → lands at real Whop checkout (proves Whop product IDs wired)
3. **Whop webhook smoke**: create a test payment via Whop's test mode → check Render logs for `[whop-webhook] event-applied` log line → check user's `subscription.plan` flipped in MongoDB.
4. **For each OAuth provider that's now approved**: go to `/dashboard/social` → click Connect → complete the OAuth round-trip → see the green "Connected" badge.

---

## Step 6 — Things to do in your first week live

- Watch Render's metrics dashboard for memory/CPU spikes.
- Watch Sentry (if `SENTRY_DSN` is set) for unhandled errors.
- Watch logs for `learnFromPublishedClip` success rate — that's the AI learning loop telling you it's working.
- Once a few real publishes happen, switch `ACCESS_TTL = '1h'` in `server/utils/jwtTokens.js` and redeploy. Refresh-token loop has soaked enough by then.
- Run Phase 1.3 FFmpeg cleanup (KNOWN_DEFERRED.md) — 20 services need `finally` blocks. Do this after you have real render data to test against.

---

## Quick reference: env vars by category

| Category | Vars | Step | Required for |
|---|---|---|---|
| Core | `NODE_ENV` `PORT` `MONGODB_URI` `REDIS_URL` `JWT_SECRET` | 4 | Anything runs |
| AI | `GEMINI_API_KEY` (or `GOOGLE_AI_API_KEY`) | already done | AI auto-edit |
| Email | `SENDGRID_API_KEY` `SENDGRID_FROM_EMAIL` | 1 | New-user verification emails |
| Whop | `WHOP_API_KEY` `WHOP_WEBHOOK_SECRET` + 6 × `WHOP_PRODUCT_ID_*` + 6 × `NEXT_PUBLIC_WHOP_URL_*` | 2 | Paid upgrades |
| YouTube OAuth | `YOUTUBE_CLIENT_ID` `YOUTUBE_CLIENT_SECRET` | 3a | YouTube Shorts publishing |
| Twitter OAuth | `TWITTER_CLIENT_ID` `TWITTER_CLIENT_SECRET` | 3b | X publishing |
| TikTok OAuth | `TIKTOK_CLIENT_KEY` `TIKTOK_CLIENT_SECRET` | 3c | TikTok publishing |
| LinkedIn OAuth | `LINKEDIN_CLIENT_ID` `LINKEDIN_CLIENT_SECRET` | 3d | LinkedIn publishing |
| Meta OAuth | `FACEBOOK_APP_ID` `FACEBOOK_APP_SECRET` `INSTAGRAM_CLIENT_ID` `INSTAGRAM_CLIENT_SECRET` | 3e | Reels publishing |
| Observability | `SENTRY_DSN` `SENTRY_ORG` `SENTRY_PROJECT` | optional | Error tracking |

---

## Honest closer

You can ship Click TODAY with only Steps 1, 2, 4 done (SendGrid + Whop + Render). New users will register, get a real email, see real pricing, and click through to real Whop checkout. Their published clips will queue but won't fan out to TikTok/Reels/etc. until those OAuth approvals land (Step 3) — but the queue itself is fine; once you add the credentials to Render env vars, the queued posts catch up automatically.

So the launch path is:
1. SendGrid (30 min today)
2. Whop products (60 min today)
3. Render deploy (90 min today)
4. **Soft launch with email + payments working**
5. Each OAuth approval lands → add to Render → that platform's publishing is live

Run `pnpm preflight` after every step. It'll tell you exactly what's missing.
