# Step-by-step launch walkthrough

Everything you need to do, in order, to take Click from "merged on main" to "publicly live, taking real payments". Total time: ~60–90 minutes.

If you only have 15 minutes, do **Phase 1 + Phase 2** — that's the conversion-critical path. OAuth callbacks (Phase 3) can wait until you actually need social posting.

## Pre-requisites — do you have these accounts?

- ✅ **Render** (you already have it — Click is rebuilding there now)
- ✅ **Whop** seller dashboard ([whop.com/dashboard](https://whop.com/dashboard))
- ✅ **Google AI Studio** API key ([aistudio.google.com/apikey](https://aistudio.google.com/apikey))
- ✅ **MongoDB Atlas** cluster (you've used this for the existing Mongo)
- For Phase 3: dev accounts at TikTok / YouTube / X / LinkedIn

If any are missing, sign up before continuing.

---

## Phase 1 — Whop setup (~15-25 min)

This is the blocker for paid signups. Without it, every "Get Pro" click ends in a dead checkout link.

### 1.1 Open Whop dashboard

Go to <https://whop.com/dashboard>. Make sure you're in the right "Whop" (Whop's word for company/seller). If you don't have one yet, create one — name it `Click` or your brand.

### 1.2 Create the 6 products

In the dashboard, **Products → New Product**. Make six of them:

| Product name | Pricing | Period |
|---|---|---|
| Click Creator (Monthly) | $49 / month | Monthly |
| Click Creator (Yearly) | $470 / year ($39.17/mo eff.) | Yearly |
| Click Pro (Monthly) | $149 / month | Monthly |
| Click Pro (Yearly) | $1430 / year ($119.17/mo eff.) | Yearly |
| Click Agency (Monthly) | $399 / month | Monthly |
| Click Agency (Yearly) | $3830 / year ($319.17/mo eff.) | Yearly |

For each product, set:
- **Type**: Subscription
- **Trial**: Off (or 7 days if you want a soft trial — your call)
- **Description**: copy from the matching tier in `client/lib/plans.ts` (the `features` list)

### 1.3 Capture each product's `product_id` and `checkout_url`

For each of the 6 products, you need two values:

- **`product_id`** — visible in the product's settings page or in the URL (something like `prod_abc123xyz`).
- **Checkout URL** — Whop's hosted checkout link. From the product page, find **Get checkout link** or similar (Whop's UI moves the button around). It looks like `https://whop.com/checkout/<id>`.

Open a temporary text file and paste the 12 values:

```
WHOP_PRODUCT_ID_CREATOR_MONTHLY=prod_xxx
WHOP_PRODUCT_ID_CREATOR_YEARLY=prod_xxx
WHOP_PRODUCT_ID_PRO_MONTHLY=prod_xxx
WHOP_PRODUCT_ID_PRO_YEARLY=prod_xxx
WHOP_PRODUCT_ID_AGENCY_MONTHLY=prod_xxx
WHOP_PRODUCT_ID_AGENCY_YEARLY=prod_xxx

NEXT_PUBLIC_WHOP_URL_CREATOR_MONTHLY=https://whop.com/checkout/...
NEXT_PUBLIC_WHOP_URL_CREATOR_YEARLY=https://whop.com/checkout/...
NEXT_PUBLIC_WHOP_URL_PRO_MONTHLY=https://whop.com/checkout/...
NEXT_PUBLIC_WHOP_URL_PRO_YEARLY=https://whop.com/checkout/...
NEXT_PUBLIC_WHOP_URL_AGENCY_MONTHLY=https://whop.com/checkout/...
NEXT_PUBLIC_WHOP_URL_AGENCY_YEARLY=https://whop.com/checkout/...
```

### 1.4 Configure the webhook

Still in the Whop dashboard:

1. Go to **Settings → Webhooks → Add endpoint** (the menu name varies — look for "Webhooks", "Developer", or "Integrations").
2. **Endpoint URL**: `https://YOUR-RENDER-URL.onrender.com/api/webhooks/whop`
   - Replace `YOUR-RENDER-URL` with your actual Render service URL. You can find it on Render → your service → top-right "Web Service" link.
3. **Events to subscribe** (select all that apply):
   - `payment.succeeded`
   - `membership.went_valid`
   - `membership.went_invalid`
   - `subscription.cancelled`
   - `payment.failed`
4. **Save**.
5. Whop will display a **signing secret** — looks like `whsec_...` or similar long random string. **Copy it** to the same temp file:

   ```
   WHOP_WEBHOOK_SECRET=whsec_...
   ```

### 1.5 Capture the API key (if you don't already have one)

In Whop dashboard → **Developer / API keys** (or Settings → API). Generate a key:

```
WHOP_API_KEY=...
```

You should now have **14 Whop-related values** in your temp file.

---

## Phase 2 — Render env vars (~10 min)

### 2.1 Open Render

Go to <https://dashboard.render.com>. Click on the **click-platform** service.

### 2.2 Environment tab

In the service's left sidebar, click **Environment**.

### 2.3 Paste each env var

You'll see a list of existing env vars. Click **Add Environment Variable** for each new one. Paste **every** value from your Phase 1 temp file, plus these critical ones if not already set:

```
GOOGLE_AI_API_KEY=<from https://aistudio.google.com/apikey>
JWT_SECRET=<openssl rand -hex 64 — generate ONE 64-char hex string>
NODE_ENV=production
PORT=10000
APP_URL=https://YOUR-RENDER-URL.onrender.com
NEXT_PUBLIC_APP_URL=https://YOUR-RENDER-URL.onrender.com
NEXT_PUBLIC_API_URL=https://YOUR-RENDER-URL.onrender.com/api

# Whop (the 14 values from Phase 1)
WHOP_API_KEY=...
WHOP_WEBHOOK_SECRET=whsec_...
WHOP_PRODUCT_ID_CREATOR_MONTHLY=prod_...
... (5 more product IDs)
NEXT_PUBLIC_WHOP_URL_CREATOR_MONTHLY=https://whop.com/checkout/...
... (5 more checkout URLs)
```

Recommended for full functionality:

```
REDIS_URL=<from Render Redis or Upstash>      # scheduling, queues
SUPABASE_URL=https://<project>.supabase.co    # analytics surface
SUPABASE_SERVICE_ROLE_KEY=<from Supabase>
SENTRY_DSN=<from Sentry>                      # observability
```

### 2.4 Save and watch the redeploy

Render auto-redeploys when env vars change (look for **Deploy** progress in the **Events** tab). Wait ~5-10 min.

### 2.5 Verify env wiring

Once the deploy is green, run from your local terminal (against your live URL):

```bash
curl https://YOUR-RENDER-URL.onrender.com/api/health
```

Expected: `200` with status JSON. Check the response includes:
- `"environment": "production"`
- `"redis": { "enabled": true, "connected": true, ... }` (if you configured Redis)
- `"database": { "connected": true, ... }` (if MongoDB is reachable)

Then the AI smoke test:

```bash
curl 'https://YOUR-RENDER-URL.onrender.com/api/marketing-intelligence/trend-report?niche=finance&platform=tiktok'
```

Expected: JSON with **`"source": "ai"`** (NOT `"fallback"`). If it says `fallback`, the `GOOGLE_AI_API_KEY` isn't reaching the runtime — re-check Render env vars and re-deploy.

---

## Phase 3 — OAuth callbacks (~30 min total, ~7 min per provider)

You'll register each provider's callback URL so Click can complete the OAuth round-trip back to your server. **Skip Meta — you said you're handling that separately.**

For each: replace `YOUR-RENDER-URL` with your actual Render origin.

### 3.1 TikTok (~7 min)

1. Open <https://developers.tiktok.com/apps>.
2. Pick (or create) your Click app.
3. **Settings → Login Kit → Redirect URLs** → Add:
   ```
   https://YOUR-RENDER-URL.onrender.com/api/oauth/tiktok/callback
   ```
4. Make sure you've **verified your domain** (TikTok requires this for production OAuth).
5. Required scopes: `user.info.basic`, `video.list`, `video.upload`.
6. Copy `Client Key` + `Client Secret` → Render env vars `TIKTOK_CLIENT_KEY` and `TIKTOK_CLIENT_SECRET`.
7. Save.

### 3.2 YouTube — Google Cloud Console (~10 min)

1. Open <https://console.cloud.google.com/apis/credentials>.
2. Pick your project (or create one for Click).
3. Find your OAuth 2.0 Client ID → **Edit**.
4. Under **Authorized redirect URIs**, add:
   ```
   https://YOUR-RENDER-URL.onrender.com/api/oauth/youtube/callback
   ```
5. Under **Authorized JavaScript origins**, add:
   ```
   https://YOUR-RENDER-URL.onrender.com
   ```
6. **Save**.
7. Copy Client ID + Client Secret → Render env `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET`.

If you want **upload** scope (vs read-only), publish your OAuth consent screen — Google verification can take days to weeks.

### 3.3 X / Twitter (~5 min)

1. Open <https://developer.twitter.com/en/portal/projects>.
2. Pick your project → your app.
3. **User authentication settings** → **Edit**.
4. Set **Type of App** to "Web App, Automated App or Bot".
5. Set **App permissions** to "Read and write".
6. **Callback URI / Redirect URL**:
   ```
   https://YOUR-RENDER-URL.onrender.com/api/oauth/twitter/callback
   ```
7. **Website URL**: `https://YOUR-RENDER-URL.onrender.com`
8. **Save**.
9. Under **Keys and tokens** → copy OAuth 2.0 Client ID + Client Secret → Render env `TWITTER_CLIENT_ID` and `TWITTER_CLIENT_SECRET`.

### 3.4 LinkedIn (~5 min)

1. Open <https://www.linkedin.com/developers/apps>.
2. Pick your app.
3. **Auth** tab → **OAuth 2.0 settings → Authorized redirect URLs for your app** → Add:
   ```
   https://YOUR-RENDER-URL.onrender.com/api/oauth/linkedin/callback
   ```
4. **Update**.
5. **Products** → Request **Marketing Developer Platform** if you want to post (`w_member_social`). Auto-approved scopes (`r_liteprofile`, `r_emailaddress`) work for connection-only.
6. **Auth tab → Application credentials** — copy Client ID + Primary Client Secret → Render env `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET`.

### 3.5 Final Render env-var pass

After registering all 4 callbacks, your Render env should have these 8 OAuth vars set:

```
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
```

Render auto-redeploys. Wait ~5 min.

---

## Phase 4 — End-to-end smoke test (~10 min)

Now verify the full conversion path actually converts:

### 4.1 Server health

```bash
curl https://YOUR-RENDER-URL.onrender.com/api/health
```

Should be 200, no errors. Look for OAuth providers showing `enabled: true, configured: true` in the response.

### 4.2 AI smoke

```bash
curl 'https://YOUR-RENDER-URL.onrender.com/api/marketing-intelligence/trend-report?niche=finance&platform=tiktok' | head -c 500
```

Look for `"source": "ai"`.

### 4.3 Public landing

Open `https://YOUR-RENDER-URL.onrender.com/` in a fresh browser (incognito).

Check:
- Hero loads, animations play
- Pricing section shows 4 tiers with the right prices ($0 / $49 / $149 / $399)
- Stats section shows numbers — bonus if it shows the green "Live · updated every 5 min" pill
- Click "Get Pro" → lands on `/register?plan=pro&period=monthly` with the "Signing up for Pro · $149/mo" badge

### 4.4 Real payment test

This is the critical one — the only way to know the webhook works:

1. Sign up with a real (or test) email on the registered page above.
2. After registration, you should be redirected to the Whop hosted checkout URL.
3. Complete payment using a Whop test card (Whop's docs explain how — usually `4242 4242 4242 4242`).
4. Whop redirects you back to Click.
5. Open `https://YOUR-RENDER-URL.onrender.com/api/auth/me` in the browser (with your auth cookie) — confirm `subscription.plan === "pro"` and `status === "active"`.

If `subscription.plan` is still `free` after a real-paid checkout: the webhook isn't firing. Check Whop's webhook log (Settings → Webhooks → your endpoint → Recent deliveries) for the failure reason. Common causes:
- URL typo
- Signing secret mismatch
- Render service was sleeping when the event arrived (Whop will retry)

### 4.5 OAuth round-trip

For each provider you want to test:

```
https://YOUR-RENDER-URL.onrender.com/api/oauth/twitter/connect
```

(Replace `twitter` with `youtube`, `tiktok`, `linkedin` for the others.)

You should be redirected to the provider's auth screen → approve → land on Click's dashboard with the connection logged.

If you get a `redirect_uri mismatch` error: the URL you pasted in the dev console doesn't byte-for-byte match what Click sends. Most common: trailing slash, http vs https, www vs apex.

---

## Done

If 4.1–4.5 all pass, **Click is live and taking payments**.

If something breaks, the most likely culprits in order:
1. Env-var typo in Render — re-check spelling against `.env.example`.
2. Render service still rebuilding (check **Events** tab).
3. MongoDB Atlas IP allowlist — Render's outbound IPs need to be in the cluster's allowlist.
4. Whop webhook endpoint mismatch — `https://` vs `http://`, missing `/api/webhooks/whop` path, etc.

For the conversion path specifically, the canonical check is:

```
register → see plan badge → submit → land on Whop checkout → pay → return to Click → /api/auth/me shows correct plan
```

Any link in that chain that breaks: open Whop's webhook delivery log + Render's request log + your browser's network tab simultaneously, and it'll be obvious where it stopped.
