# Secrets rotation runbook

Click's `.env` holds live production credentials: the prod Atlas `MONGODB_URI`,
`JWT_SECRET`, `GOOGLE_AI_API_KEY` (Gemini), `REDIS_URL` (Upstash), OAuth client
secrets (YouTube/LinkedIn/TikTok/Twitter/Facebook), `SUPABASE_SERVICE_ROLE_KEY`,
and `OAUTH_ENCRYPTION_KEY`. `.env` is gitignored and CI (`scripts/check-secrets.js`,
wired into the `security` job) fails if any real `.env`/key material is committed.

## Where prod secrets should live
- **Not** in a deployed `.env` file. The deploy platform (Render/Fly) injects them
  as environment variables from its own secret store. The repo `.env` is for
  LOCAL dev only, and the dev DB-safety guards (`server/utils/dbSafety.js`,
  `tests/setup-env.js`) stop any non-prod process from touching the prod DB.

## When to rotate
- A secret appeared in a commit, log, screenshot, backup, or a shared machine.
- A developer with access offboards.
- Routine: at least annually for long-lived keys (OAuth secrets, encryption key).

## Rotation order (least-disruptive first)
1. **GOOGLE_AI_API_KEY** — issue a new key in Google AI Studio, update the deploy
   env var, redeploy, then revoke the old key. (Stateless — zero downtime.)
2. **REDIS_URL** — provision a new Upstash DB or rotate the password, update env,
   redeploy. Queues/cache/rate-limit reconnect; in-flight jobs may retry.
3. **JWT_SECRET** — rotating invalidates all existing access tokens (users must
   re-login). Schedule for a low-traffic window, or support dual-secret
   verification during a grace period if added.
4. **OAUTH_ENCRYPTION_KEY** — encrypts social tokens at rest (GCM). Rotating
   requires re-encrypting stored tokens: run `server/scripts/encryptSocialTokens.js`
   with the old+new key (decrypt-with-old, encrypt-with-new). Never rotate without
   the re-encrypt step or all linked social accounts break.
5. **OAuth client secrets** (per platform) — rotate in each provider's developer
   console, update env, redeploy. Existing user tokens keep working; only new
   auth flows need the new secret.
6. **SUPABASE_SERVICE_ROLE_KEY** — rotate in the Supabase dashboard, update env,
   redeploy. High blast radius (full DB access) — rotate immediately on any
   suspected exposure.
7. **MONGODB_URI** — rotate the Atlas DB user password, update env, redeploy.

## If a secret was committed to git history
1. Rotate the secret first (assume it's compromised the moment it's in history).
2. Purge it from history (`git filter-repo` / BFG) and force-push, or — if the
   repo is private and low-risk — accept the historical exposure but ensure the
   key is now revoked.
3. Confirm `node scripts/check-secrets.js` passes.

## Verify after rotation
- App boots (env validation: `node scripts/validate-production-env.js`).
- `/api/health` deep probe is green (DB + Redis reachable).
- A test login + a test AI generation + a social-account relink succeed.
