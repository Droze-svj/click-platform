# Deploying Click

This file lists the environment variables Click needs to run end-to-end, grouped
by what fails if you miss them. The server reads ~186 distinct env vars in
total — most are optional integrations. The minimum viable set to "users can
sign up, upload, edit, and export" is at the top.

## Minimum viable production set

Without all of these, core flows fail.

| Var | What | Where to get it |
| --- | --- | --- |
| `MONGODB_URI` | App database (users, content, scheduled posts, etc.) | MongoDB Atlas free tier or self-hosted Mongo |
| `JWT_SECRET` | Signs session tokens | `openssl rand -hex 64` |
| `GOOGLE_AI_API_KEY` | The only AI provider Click uses (transcription, captions, hook analysis, content suggestions) | https://aistudio.google.com/apikey |
| `APP_URL` | Public-facing client URL, used in emails and OAuth redirects | Your Vercel/Render URL, e.g. `https://click.example.com` |
| `BACKEND_URL` | Public-facing API URL | Same as `APP_URL` if frontend+API share a domain, otherwise the API host |
| `CORS_ORIGIN` | Allowed origin for browser requests | Same as `APP_URL` |
| `NODE_ENV` | `production` for prod deploys | Set to `production` |

Either Cloudinary OR AWS S3 is required for media storage:

| Var | What |
| --- | --- |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Cloudinary path |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET` | S3 path |

## Auth: pick one

Click supports either Mongo-backed local auth (uses `MONGODB_URI` + `JWT_SECRET`)
or Supabase. If you use Supabase, add:

| Var | What |
| --- | --- |
| `SUPABASE_URL` | From Supabase project settings |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role API key |
| `SUPABASE_ANON_KEY` | Public anon key (also needed in client) |

## Background jobs

Without Redis, scheduled posts won't auto-publish, video processing queues
won't drain, transcription/email won't dispatch.

| Var | What |
| --- | --- |
| `REDIS_URL` | Redis connection string (e.g. Upstash, Render Redis, Redis Cloud) |

## Social publishing (OAuth credentials)

You can deploy without these — Click will throw an explicit "Account not
linked" error per platform until creds are configured. Set per platform you
want to support:

| Var(s) | Where |
| --- | --- |
| `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | https://developers.tiktok.com/ |
| `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` | https://console.cloud.google.com/ |
| `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET` | https://developer.twitter.com/ |
| `INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET` | https://developers.facebook.com/ |
| `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | https://www.linkedin.com/developers/ |
| `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` | https://developers.facebook.com/ |

Each platform also needs a redirect URL configured in its developer console.
The pattern is `${APP_URL}/api/oauth/<platform>/callback`.

For local development without real OAuth, set `MOCK_PUBLISHING=1` to make all
publishing services return mock success responses.

## Email (transactional)

Click sends verification + password-reset emails. Without SMTP, those flows
break for new users.

Either SendGrid:

| Var | |
| --- | --- |
| `SENDGRID_API_KEY` | API key |
| `EMAIL_FROM` | Verified sender |
| `EMAIL_FROM_NAME` | Display name |

Or AWS SES:

| Var | |
| --- | --- |
| `AWS_SES_REGION` | e.g. `us-east-1` |
| `EMAIL_FROM` | SES-verified sender |

## Optional but recommended

| Var | What | Notes |
| --- | --- | --- |
| `SENTRY_DSN` | Error tracking | Skip locally; required for production observability |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Billing | Only if monetizing |
| `OPENAI_API_KEY` | Will be **ignored** by default (Click is configured for Gemini-only). Set `AI_GEMINI_ONLY=0` to opt out. | |

## Where to put these

| Host | How |
| --- | --- |
| **Vercel** | Project → Settings → Environment Variables. Set for Production, Preview, Development as needed. |
| **Render** | Service → Environment → Add Environment Variable. |
| **Fly.io** | `flyctl secrets set MONGODB_URI=... JWT_SECRET=... ...` |
| **Local dev** | Copy `.env.example` → `.env.local`. Never commit `.env.local`. |

## Smoke checklist after deploy

After your first prod deploy with the minimum viable set:

1. `GET /api/health` → returns `{status:"active"}` (proves server is up).
2. `POST /api/auth/register` with a real email → succeeds, verification email arrives.
3. `POST /api/upload/chunked/init` (auth'd) → returns `{uploadId}` (proves storage path is wired).
4. Open the editor for any video → preview plays (proves the editor pipeline is wired).
5. Schedule a post for "1 minute from now" with a connected platform → cron fires, post status moves to `posted` or `needs_reconnect` honestly.

If any of the above fails, the env-var section above tells you which var to check.

## Known endpoints with no server-side implementation

These client paths exist but the server has no matching route file. The UI
will get a 404 if hit. Either implement the route or remove the client call:

- `POST /api/captions-spatial/detect` (used by `DynamicSubtitleEngine.tsx`)
- `POST /api/monetization/plan` (used by `MonetizationHub.tsx` — note: the
  similar `/api/video/advanced/monetization-plan` does exist)
- `POST /api/phase8/spatial`
- `POST /api/sovereign/insights`, `POST /api/sovereign/swarm`
