# User journeys (CI gate)

Real end-to-end journeys through the UI, run on every PR by `.github/workflows/e2e.yml`
right after the smoke check. They drive a running backend (`NODE_ENV=test`, so AI is
mocked and deterministic) and a production build of the client.

| Spec | What it proves |
| --- | --- |
| `01-signup` | 2-step sign-up → caption onboarding → dashboard greets the user by first name; niche saved |
| `02-profile` | name/bio with `'` `"` `&` `<>` and a URL save, survive a reload, and are stored unescaped |
| `03-auth` | sign out → protected page → `/login?next=…` → sign in lands back; wrong password error; forgot-password message (honest "can't send" without an email provider) |
| `04-every-page` | every static page in `client/app` (crawled at run time) loads signed-in: no page error, no console error, no 5xx, no bounce to `/login`, no form field shorter than its font, no API request loop |
| `05-upload-manual-edit-export` | upload `tests/fixtures/journey-clip.mp4` through the Studio → editor → split at 5 s, delete the first part → Export → Render: the file is 3 s ±0.3 and starts at the right place (silence gap check) |
| `06-ai-auto-edit` | Analyze → Compose: the auto edit returns an `editedVideoUrl` that is a real video, and opens in the editor |
| `07-generators-and-scheduler` | scheduler with no connected TikTok says so and refuses to queue; content generator shows posts; script writer generates or fails honestly |
| `08-settings-billing` | a notification toggle survives save + reload; billing lists the plans and never says "Upgrade started" without a checkout |

## Run locally

Use your own ports so you don't collide with a dev stack on :5001/:3000:

```sh
# backend (in-memory Mongo, no Redis/Supabase/Gemini)
NODE_ENV=test PORT=5201 MONGODB_URI=mongodb://127.0.0.1:1/journey JWT_SECRET=journey-test-secret \
  INMEMORY_DB_PATH=.journey-db AUTO_VERIFY_EMAIL=true DRY_RUN_PUBLISH=true \
  REDIS_URL= GOOGLE_AI_API_KEY= SUPABASE_URL= SUPABASE_ANON_KEY= SUPABASE_SERVICE_ROLE_KEY= \
  node server/index.js

# client (BACKEND_ORIGIN points the /api + /uploads proxy at that backend)
cd client && BACKEND_ORIGIN=http://localhost:5201 NEXT_PUBLIC_API_URL=http://localhost:5201/api npx next build \
  && BACKEND_ORIGIN=http://localhost:5201 NEXT_PUBLIC_API_URL=http://localhost:5201/api npx next start --port 3201

# suite
E2E_BASE_URL=http://localhost:3201 E2E_API_URL=http://localhost:5201/api \
  npx playwright test --config=playwright.config.journeys.js
```

`next dev` works too, but dev-only React warnings show up as console errors in `04-every-page`.
The video journeys need `ffmpeg`/`ffprobe` on the PATH (for the server's renders and the duration checks).
