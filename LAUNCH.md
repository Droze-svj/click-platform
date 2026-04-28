# Launch checklist

Post-merge steps to take Click from "code is on main" to "users can sign up and edit a video." Run top to bottom.

## 1. Wait for the platform builds (≤ 10 min)

After every merge to `main`:
- **Render** rebuilds the Docker image (defined in `Dockerfile`, configured by `render.yaml`).
- **Vercel** rebuilds the four `click-platform-*` previews (Next.js client).

Watch the Render dashboard for build completion. The Dockerfile fails fast if ffmpeg is missing required filters — if it errors at the "Verify ffmpeg" step, the platform's auto-edit pipeline can't run, and the deploy is broken before it starts.

## 2. Set the env vars in Render

These are *required* for the platform to do real work. Set them in **Render dashboard → click-platform service → Environment**.

```
GOOGLE_AI_API_KEY=<from https://aistudio.google.com/apikey>
JWT_SECRET=<openssl rand -hex 64>
MONGODB_URI=<from MongoDB Atlas>
NODE_ENV=production
PORT=10000
APP_URL=https://<your-render-domain>
NEXT_PUBLIC_API_URL=https://<your-render-domain>/api
```

Recommended for full functionality:

```
REDIS_URL=<from Render Redis or Upstash>     # scheduling, queues
SUPABASE_URL=<https://<project>.supabase.co> # analytics surface
SUPABASE_SERVICE_ROLE_KEY=<from Supabase>
SENTRY_DSN=<from Sentry project>             # observability
```

OAuth providers (set per-platform you want users to publish to):

```
TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET            # tiktok.com/developers
YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET           # console.cloud.google.com
TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET           # developer.twitter.com
LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET         # linkedin.com/developers
INSTAGRAM_CLIENT_ID, INSTAGRAM_CLIENT_SECRET       # developers.facebook.com
```

For each OAuth provider, the redirect URL pattern is `${APP_URL}/api/oauth/<platform>/callback`. The exact URLs to paste into each dev console (TikTok / YouTube / Twitter / LinkedIn) — plus per-provider gotchas — are documented in [docs/oauth-redirect-urls.md](docs/oauth-redirect-urls.md).

### Whop checkout URLs (paid pricing tiers)

The pricing cards on the public landing read each plan's hosted checkout URL from `NEXT_PUBLIC_WHOP_URL_*` env vars. Paste the URLs from your Whop dashboard (Products → click the product → "Get checkout link"):

```
NEXT_PUBLIC_WHOP_URL_CREATOR_MONTHLY=https://whop.com/checkout/...
NEXT_PUBLIC_WHOP_URL_CREATOR_YEARLY=https://whop.com/checkout/...
NEXT_PUBLIC_WHOP_URL_PRO_MONTHLY=https://whop.com/checkout/...
NEXT_PUBLIC_WHOP_URL_PRO_YEARLY=https://whop.com/checkout/...
NEXT_PUBLIC_WHOP_URL_AGENCY_MONTHLY=https://whop.com/checkout/...
NEXT_PUBLIC_WHOP_URL_AGENCY_YEARLY=https://whop.com/checkout/...
```

Empty values fall back to `/register?plan=<id>` — the user registers but never reaches checkout. Set these before the public launch.

### Whop webhook (so payments actually update the user's plan)

Once you've configured Whop checkout URLs above, wire the inbound webhook so payment events flip the user's `subscription.plan` server-side:

1. In your Whop dashboard, **Settings → Webhooks → Add endpoint**.
2. Endpoint URL: `${APP_URL}/api/webhooks/whop`
3. Subscribe to (at minimum): `payment.succeeded`, `membership.went_valid`, `membership.went_invalid`, `subscription.cancelled`, `payment.failed`.
4. Copy the signing secret Whop generates → paste into Render env as `WHOP_WEBHOOK_SECRET`.
5. Paste each plan's product ID into Render env:

```
WHOP_PRODUCT_ID_CREATOR_MONTHLY=<product_id from Whop>
WHOP_PRODUCT_ID_CREATOR_YEARLY=<product_id>
WHOP_PRODUCT_ID_PRO_MONTHLY=<product_id>
WHOP_PRODUCT_ID_PRO_YEARLY=<product_id>
WHOP_PRODUCT_ID_AGENCY_MONTHLY=<product_id>
WHOP_PRODUCT_ID_AGENCY_YEARLY=<product_id>
```

Without these IDs, the webhook still records a payment as "active" but can't pick the right plan tier. With them, the flow is end-to-end: checkout → webhook → user's plan updates → dashboard reflects the new tier on next refresh.

## 3. Verify env wiring

Once Render has rebuilt with the new env vars, run the verification script:

```bash
npm run verify:production:env
```

It walks every required + recommended var, validates format, and prints exactly what's missing. Iterate until clean.

## 4. Smoke-test the live deploy

In order, hit:

| Check | URL | Expected |
|---|---|---|
| Health | `${APP_URL}/api/health` | 200 with status JSON |
| Trend report (AI key wired) | `${APP_URL}/api/marketing-intelligence/trend-report?niche=finance&platform=tiktok` | `source: "ai"` (NOT `"fallback"`) |
| Auto-edit (the original bug) | Sign in → upload a clip → run "Make it great" | The four stage chips advance, `editsApplied` non-empty, output video plays |
| OAuth | `/api/oauth/connections` (after connecting one provider) | Returns the connection in the list |

If `trend-report` returns `source: "fallback"`, `GOOGLE_AI_API_KEY` isn't reaching the runtime. If "Make it great" returns `Filter not found`, ffmpeg in the Render image is wrong (re-check Dockerfile build log).

## 5. Post-launch hygiene

Run these once for the first deploy, then ignore unless something changes:

```bash
node scripts/verify-security.js          # confirms helmet / CORS / rate-limit are all live
npm audit --omit=dev --audit-level=high  # should report 0 vulnerabilities
```

## What's intentionally not automated

These need human eyes:

- The `* 2.tsx` / `_stray_node_modules-*` macOS-Finder duplicates in the working tree. Run `git status -s | grep "^??"` after a clean checkout, eyeball the list, then `git clean -fd` only if you've decided every untracked file is junk.
- The integration test suite (~75 broken tests) — currently `continue-on-error` in CI. Each file has bugs at the test-content level (wrong API shapes, missing service references). Fix per-file or delete.
- The remaining e2e specs that pass — only ~12 of the surviving tests assert against real UX. The rest can be rewritten when the corresponding screens stabilize.
