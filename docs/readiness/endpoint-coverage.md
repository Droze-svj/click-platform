# Click — Endpoint / AI / Edit / Workflow Coverage

Companion to [GO-NO-GO.md](./GO-NO-GO.md). Records the full verification + hardening
pass that proved which of Click's ~2,375 mounted endpoints actually work, and the
fixes that drove the defect count down.

## The harness (durable regression net)

Two jest artifacts boot the app in-memory (on the DB-safety guard in
`tests/setup-env.js`) and exercise real HTTP:

| Tool | What | Run |
|---|---|---|
| `tests/server/routes/smokeCore.test.js` | **Gating** — the core tester flow (auth/me, content, video, analytics, AI generators). Fails on any 5xx/wrong-status. | part of `npm run test:unit` |
| `tests/smoke/smokeFull.test.js` | **Breadth sweep** — walks `app._router` (`tests/smoke/walkRoutes.js`), calls every safe GET with seeded fixtures, categorizes, writes `tests/reports/endpoint-smoke.json`. Ratchet ceiling on 5xx. | `npm run smoke:full` |
| `tests/smoke/writeSweep.js` | **Write breadth sweep** — the same walker over every mounted POST/PUT/PATCH/DELETE. Seeds two users, fires each write, retries 5xx once, probes cross-user write IDOR (user B against user A's ids), runs DELETEs against throwaway ids only. Standalone Node (not jest) so post-response background rejections are attributed to the process, not a test. Writes `tests/reports/endpoint-writes.json`. Exit 0 = 0 real 5xx / 0 IDOR / 0 malformed. | `npm run smoke:writes` |
| `scripts/ai-smoke.js` | Live-AI smoke against a running env (`BASE=… [TOKEN=…]`). | `npm run smoke:ai` |

## Sweep result (984 GET endpoints called)

| Category | Count | Meaning |
|---|---|---|
| OK | **482** | healthy 2xx |
| NOT_FOUND | 92 | correct 404 (the sweep uses random ids) |
| AUTH | 320 | correct 401/403 |
| BAD_REQUEST | 71 | correct 400 (validation) |
| NOT_IMPLEMENTED | 4 | honest 501 (disabled features) |
| SERVICE_UNAVAILABLE | 4 | dependency off in test env (Redis/ES) |
| **SERVER_ERROR** | **2–3** | down from **49** at baseline |
| MALFORMED | **0** | down from 52 (all were legit non-envelope responses) |

## What was fixed (by phase, all merged to `main`)

- **A/B core flow:** `extract-highlights` now uses real AI (was always falling back on a
  wrong-arg crash); `generate-captions` uses the real transcript instead of fabricated
  `"Sample caption N"`; UserAction enum completed (7 actions were silently dropped).
- **C — AI accuracy:** all user-text prompt inputs bounded via `capForPrompt` (anti
  truncation/injection); `count` clamped; live-AI smoke (prod `liveTest=ok`).
- **D — edit/render/workflow:** verified the watchdog, c2pa temp cleanup, webhook awaiting,
  and rate-limiting are **already hardened** by prior rounds.
- **E — auth Mongoose-mode 500s:** `/api/auth/{2fa/status,sessions,security-events,
  security-status}` crashed on `supabase.*` in prod's Mongoose-mode → graceful guards.
- **E2 — status mapping:** `errorHandler` + `utils/response.sendError` now downgrade a
  hand-rolled 5xx to the right status from its message (not-found→404, token→401,
  denied→403, "not available yet"→501, "not configured"→503, duplicate→409). This one
  chokepoint corrected the whole not-found-as-500 cluster (~30 endpoints).
- **E3 — build/disable:** built `getSearchFilters` + `getPluginCategories`; honestly 501'd
  the template/export analytics that need real data pipelines.
- **F — revived 5 routes** the frontend already calls but were never mounted (so the UI
  404'd): `digital-twin`, `retention-heatmap`, `trust`, `toolbox`, `dubbing`.

## Residual / deliberately-deferred (honest list)

1. **2–3 edge 5xx** remain (random-token `verify-email`, a `style-profile` GET-create
   dup-key race, a captions precondition). Not on the core flow; low impact.
2. **Dead routes kept:** ~22 music-* / ai-music-* (unfinished subsystem) + a handful the UI
   never references (creatorDna, hookEnsemble, remix, style-vault, videoSharing). Unreachable
   (404), guarded by `routeMounts.test.js`. Revive when their features are wanted.
3. **costGuard** not wired on the legacy video/quote AI routes (they sit behind the global
   rate limiter) — wiring `assertBudget` risks false 402s for testers; do it with tier testing.
4. **Render quality:** vertical `smartReframe`-by-default and FFmpeg-logs→`logs/` are
   deliberately **not** flipped blind before testing — they change render output and need
   real-render verification.
5. **POST/PUT/PATCH/DELETE now swept** by `writeSweep.js` (1,180 write endpoints). Baseline
   found **22 real 5xx + 5 real cross-user IDOR**; all fixed → **0 5xx / 0 IDOR / 0 malformed**.
   Fixes: supabase-off crashes (auth logout/2fa, posts CRUD → honest 200/503/404); business-rule
   errors surfaced as 500 (pipeline/forecast/sync/pulse/aeo/analytics/cloud-restore → 4xx/409/422
   via the errorHandler message map + `statusCode` tags); a circular-require in
   `freeAIModelRateLimiter`; unguarded destructures (`manual-editing` track/restore → 400);
   two latent process-crash bugs — `videoProgressService.fail()` emitting `'error'` with no
   listener, and `/library/.../duplicate` serializing Map fields via `toObject()`
   (`val.keys is not a function`). `aiLimiter` now skips non-production like its sibling
   limiters (was locking out dev/test — and the sweep — after 50 AI calls).

### Write-sweep residual known-non-bugs (NOT defects)

- **SERVICE_UNAVAILABLE (11):** dependency-off-in-test 503s (Supabase/monitoring alert relay).
- **OTHER (3):** correct **409 Conflict** — `POST /api/pipeline/:id/refresh`,
  `/api/pipeline/:id/schedule-optimal` (pipeline not completed), `/api/pricing/resume`
  (subscription not paused). These are honest business-rule statuses, not failures.
- **Skipped by design:** external publish/send/push, `/api/backup` (restore overwrites),
  `/api/video/render`+`/advanced`, webhooks/oauth/billing (see `SKIP_PREFIXES` in the script).
- **IDOR allowlist (2):** `POST /api/help/articles/:id/helpful`, `POST /api/moderation/flag/:contentId`
  are cross-user **by design** (public vote / abuse report).

### User-profile accuracy (identity-key split — fixed)

`UserPreferences.userId` is `Mixed`, and callers keyed it inconsistently (ObjectId vs hex
string), so **a user's settings reached a different document than the AI read**. Fixed:
`creatorDna`/`digitalTwin` now use the canonical `_id` key; `personalizationService.getPersona`
reads both id-forms (`$in` legacy fallback, no destructive migration), bridges `videoEditing`
from **both** `UserSettings` and `UserPreferences` (prefs win on conflict), and guards the
prefs read. Verified by `tests/server/personalizationAccuracy.test.js` (5 tests: Settings→AI
bridge, legacy-key fallback, precedence, cross-user isolation, one-doc-per-user). Out of scope
(documented follow-up): the ~17 AI surfaces that bypass `personalizationService` entirely.

## Bottom line

Core flow is solid and gated. The GET surface went from **49 server-errors + 52 malformed**
to **2–3 edge 5xx + 0 malformed**; the write surface (never swept before) went from **22 5xx +
5 IDOR** to **0 / 0 / 0**. Both now have a permanent harness (`smoke:full`, `smoke:writes`).
