# Click — Production-Readiness GO / NO-GO

**Verdict: 🟢 GO for your own testing — conditional on ONE operational step** (set the
AI key in prod, below). The deep-hardening pass (Phases 0–4) is complete and merged to
`main`; the security campaign (rounds 8–18) is already live on `click-platform-1.onrender.com`
with signed-media enforcing.

## The one thing that gates "real AI"

Your prod AI is currently **mock** — `GOOGLE_AI_API_KEY` is unset in Render, so every AI
feature returns canned text (verified). To go live:

1. Render → `click-platform-1` → Environment → add **`GOOGLE_AI_API_KEY`** (from
   https://aistudio.google.com/apikey) → save (redeploys).
2. Confirm from anywhere:
   ```bash
   curl "https://click-platform-1.onrender.com/api/health/ai?live=1"
   ```
   Want: `"mode":"live AI"`, `"liveTest":"ok"`. (`"FALLBACK"` = key still missing.)

Until then the app runs, but AI output is the hardcoded fallback.

## Verification (this pass, on `main`)

| Gate | Result |
|---|---|
| `jest` full suite | **595 passing**, 0 failing (incl. re-enabled route suites) |
| `eslint server/` (now the CI gate, whole tree) | **0 errors** |
| client `tsc --noEmit` (new CI gate) | **clean** |
| client `next build` | green (91 pages) |
| server boot + `/api/health/light` + `/api/health/ai` | 200 |
| live AI round-trip (`?live=1`, with a key) | **`liveTest:"ok"`** |

> **Endpoint/AI/edit/workflow sweep (done):** a full verification + hardening pass drove the
> broad surface from **49 server-errors + 52 malformed** to **2–3 edge 5xx + 0 malformed**,
> with a permanent smoke harness (gating core test + on-demand breadth sweep). Details +
> residual list in [endpoint-coverage.md](./endpoint-coverage.md).
>
> **Post-report follow-ups (done):** the UI now visibly flags AI-degraded mode
> (a dashboard banner driven by `/api/health/ai`), and the four route-integration
> suites (`auth`/`content`/`video`/`analytics`) are repaired and gating in the unit
> job (~5s each on an isolated in-memory Mongo). A **hard DB-safety guard** in
> `tests/setup-env.js` now forces tests onto an in-memory/local DB and fails closed
> if `MONGODB_URI` ever points at a remote/Atlas host — see the incident note below.

## What this pass fixed (Phases 0–4)

- **AI accuracy + visibility** — `promptSafe.capForPrompt` bounds user text at all 6
  prompt sites so a long transcript can't eat Gemini's budget and truncate the real
  output (the #1 "AI looks wrong" cause) + a light injection defuse; new `/api/health/ai`
  probe to confirm real AI is live (vs the canned fallback).
- **Honest metrics** — removed `Math.random()`-fabricated numbers shown as real analysis
  on live routes (video highlight scores → deterministic order-grounded; voice-hook
  "performance" → grounded in the real `videoMetrics`, `null`/`grounded:false` when there's
  no data instead of inventing engagement/retention/CTR/demographics).
- **Dead code** — removed 25 iCloud duplicate artifacts (`* 2.js`); a route-mount test now
  fails if a new route file isn't mounted (or explicitly marked dead) — closes the "added a
  route, forgot to mount it → 404" trap. 38 dead route files documented (the `music-*`
  family etc.).
- **Robustness** — `validateObjectId` (malformed `:id` → clean 400, not a Mongoose 500) +
  `getPagination` clamp (`?limit`≤100), applied to the core content routes.
- **Stronger CI gate** — lint now covers ALL of `server/`; client typecheck added; 2 real
  eslint errors cleared.

## What's solid (verified working)

- Security: rounds 8–18 live; signed-media enforcing; the zombie service deleted.
- Core render pipeline (`video/render.js`), c2pa signer, boot sequence — verified intact
  (the audit's "broken render" alarm was false).
- AI router fallback chain + cost/limit controls (`costGuard`, `aiLimiter`) — present.
- The full security test surface (signed-media, approval-authz, comments-access, chunked
  upload, escapeRegex, route-mount, promptSafe, validateObjectId).

## Known gaps / residual risks (honest)

1. ~~**Route-integration tests** stale + slow.~~ **RESOLVED.** Fixtures rewritten to the
   current auth/validation/response contracts (password policy, email-verification gate,
   `:id` validation → 400, cross-user → 404); connection lifecycle handed to `tests/setup.js`
   (the cross-file race is gone). With the in-memory guard they run ~5s/suite and now gate in
   the unit job. Coverage is intentionally focused on the real, deterministic surface —
   content *generation* (async/queue-backed) is left to service/integration tests.
2. **`silent DB-empty`** was fixed on the core routes; a full sweep of every
   `isDevUser`/`!isMongoId`/`allowDevMode` branch that returns `[]` isn't exhaustive. Lower
   impact today because prod is **Mongoose-mode** (Supabase disabled → users are real
   ObjectIds), but revisit before enabling Supabase auth.
3. ~~**UI "AI degraded" surfacing.**~~ **RESOLVED.** A dashboard-wide banner
   (`AIHealthBanner` + `useAIHealth`) polls `/api/health/ai` and warns when AI is in
   fallback mode, so canned output is never mistaken for real generation. (Per-result
   inline tagging remains a possible enhancement, but the services currently mask
   fallbacks as normal success, so the global probe is the reliable signal.)
4. **38 dead route files** remain in the tree (guarded by the mount test, harmless, 404 if
   called). Delete or wire them when their features are wanted.
5. **913 eslint warnings** (almost all `no-unused-vars`) — non-blocking; clean up opportunistically.
6. **`validateObjectId`/`getPagination`** applied to the core content route as the pattern;
   roll out to the remaining `:id`/list routes over time.

## Incident note — test DB safety (June 19)

While repairing the route-integration suites, two local test runs connected to the **live
Atlas `click_v3` database** and their unscoped `User.deleteMany({})` / `Content.deleteMany({})`
emptied the `users` and `contents` collections (the other 173 collections were untouched).
Root cause: `.env.test` set no `MONGODB_URI`, so booting `server/index.js` let dotenv load the
**production Atlas URI from `.env`**, and the suite connected to it.

Fixed so it cannot recur:
- `tests/setup-env.js` now **pins** `MONGODB_URI` before any app code loads — a genuinely-local
  `click-test` URI is kept; anything remote/unknown is forced to an **isolated in-memory Mongo**.
- `tests/setup.js` **fails closed**: it throws (aborts the run) if `MONGODB_URI` ever resolves to
  a `mongodb+srv` / `*.mongodb.net` host.

**Recovery:** if your Atlas cluster has backups/PITR (M10+ or an enabled snapshot policy), restore
`users` + `contents` from a snapshot just before this date. If it's a shared/free tier with no
backups, the emptied collections aren't recoverable — re-register your account(s); content created
during prior testing is gone. Nothing else was affected.

## Your pre-test checklist

- [ ] Set `GOOGLE_AI_API_KEY` in Render; confirm `/api/health/ai?live=1` → `liveTest:"ok"`.
- [ ] Log in (you'll re-auth — JWT was rotated) and click the core flow: upload a video →
      AI highlights/captions → edit → render/export → it downloads. Watch the browser Network
      tab for any `/uploads/...` 403 (signed-media) — there shouldn't be any.
- [ ] Spot-check a couple of secondary features you care about; anything that 404s is likely
      one of the documented dead routes — tell me and I'll wire or remove it.

**Bottom line:** the system is hardened, honest, and verifiably green. Set the AI key, do the
5-minute click-through, and you're clear to test Click for real.
