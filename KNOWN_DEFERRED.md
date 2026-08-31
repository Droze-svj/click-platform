# Known-Deferred Work — Click

Honest list of what is intentionally NOT done, with the reason for each. If it's
listed here it's a conscious deferral with a known impact, not an oversight.

**Last updated: 2026-08-30**, after the production-readiness pass.

> The previous revision of this file was dated 2026-05-17 and had drifted badly
> out of date — it claimed a 30-day access token (actually 1h since June), an
> unverified `c2patool` binary (installed in the Dockerfile), and deferred tus
> uploads (shipped). A readiness document that misreports readiness is itself a
> production risk, so the stale claims were removed rather than annotated.

---

## ✅ Verified closed (do not re-chase)

Each of these was tracked as open at some point and is now confirmed closed in
the current code. Evidence is given so nobody has to re-derive it.

| Item | Actual state |
|---|---|
| Public `/uploads` serving private media | `requireSignedMedia` is mounted *before* `express.static` and is **default-ON** (`REQUIRE_SIGNED_MEDIA !== 'false'`); HMAC `?exp&sig` required. `render.yaml` sets it true with a generated `MEDIA_URL_SECRET`. (`server/index.js`) |
| 30-day access token | Now `1h` access / `90d` refresh, with client auto-refresh on 401. (`server/utils/jwtTokens.js`) |
| Duplicate scheduler → double-posting | One publish cron, which atomically claims each row (`findOneAndUpdate` scheduled→publishing) before posting, so it is safe across instances. (`server/routes/scheduler.js`) |
| BullMQ failures disappearing silently | Final failure moves the job to a `DeadLetterJob` doc, notifies the user, and is manageable at `/dashboard/admin/dead-letter`. |
| FFmpeg temp-file leaks | `try/finally` cleanup on the high-traffic services (transcription, whisper, repurpose) plus a 6-hourly sweep of `uploads/temp` and `tmp`. |
| `c2patool` not installed in prod | Installed in the `Dockerfile` (v0.9.12), along with `ffmpeg`, `yt-dlp`, `edge-tts` and CJK/Arabic/Thai fonts. |
| tus resumable uploads | Shipped. |
| Publishing that faked success | `socialPublishingService.mockSuccess` returns `success: false, status: 'requires_setup'` — it never reports a post that didn't happen. |
| Fabricated analytics ("phantom data") | Purged. The last six surfaces (share of voice, competitor benchmarks, revenue impact, per-scene performance, sentiment risk, audience decline) were fixed in the 2026-08-30 pass — see "Honest by design" below. |
| Refunds reported without money moving | `processPaymentRefund` no longer synthesizes a `REF-…` id; a refund is only `processed` when Whop confirms it. |

---

## 🟢 Honest by design — unavailable, not broken

These features are wired and reachable but cannot produce a real number, because
Click has no data source for them. They return an explicit `available: false`
with a reason rather than an invented figure. **This is the intended state**, and
fabricating values to fill them in would be a regression.

| Surface | What's missing | What it still reports |
|---|---|---|
| Brand share of voice | Third-party mention ingestion + competitor volume (needs a social-listening vendor) | Its own published posts and hashtag counts, exactly |
| Competitor benchmarking | Any competitor data source; platform APIs don't expose rivals' private metrics | A real self-comparison against the account's own preceding period; industry figures labelled `source: 'static_reference'` |
| Template analytics | Nothing writes `Content.metadata.templateId` — the only AITemplate generation path lives behind the unmounted `ai-content` / `ai-enhanced` routes | Honest zeros, and correct numbers the moment tagged content exists |
| Music licensing / AI music providers | Epidemic Sound / Artlist / Mubert / Soundraw credentials, set per-workspace through the admin endpoints | Empty results and honest 503s, not errors |
| Refunds, without `WHOP_API_KEY` | Provider credentials | The refund is recorded as `failed` with a reason for an operator — never reported to the customer as processed |

Closing any of these is a **commercial** decision (buy a data source), not a
coding task.

### Made honest in 2026-08 — these used to report success

Three surfaces returned `success: true` for work they had not done. They now
fail with `501` and a message naming the alternative. This is a **deliberate**
state: the previous behaviour was worse than an error, because it was trusted.

| Surface | What it claimed | What actually happened | Now |
|---|---|---|---|
| `POST /api/reports/schedule` | Recurring report scheduled, recipients emailed | Job registration commented out; report generated once and discarded; `sendEmail` commented out | 501, pointing at `POST /api/reports/generate`, which works |
| `POST /api/disaster-recovery/backup` and `/restore` | Backup `completed` with a size; restore succeeded | `mongodump`, `mongorestore` and the file copies were all comments — the backup directory was empty | 501, pointing at `POST /api/backup/create` (a real per-user export) |
| `POST /api/video/manual-editing/marketplace/:id/download` for a premium template | Download allowed | The payment check was the comment `// For now, allow download`, so paid templates were free to everyone | 402 — there is no purchase flow to check against, and giving away content the platform priced misleads the seller |

If any of these is implemented for real, delete its row.

---

## 🟡 Deferred — with reason

### Two 0-byte route files

`music-licensing.js` and `automation-analytics.js` are committed as empty files.
`require()` on one yields `{}`, and `app.use(path, {})` throws at boot — the
`featureRoutes` registry now fails with a message naming the file rather than a
bare TypeError. Neither has any content to mount; the music-licensing *feature*
lives in the ten `music-licensing-*.js` files, which are mounted.

### Music clusters are mounted but inert until configured

The `music-licensing*` (10) and `ai-music-*` (6) clusters are now mounted — 71
endpoints, with the `GET /providers` and `/playlists*` collisions separated by
sub-prefixes and `costGuard` added to the seven paid generation endpoints. They
return empty results and honest 503s until an admin configures a provider
(Epidemic Sound / Artlist / Mubert / Soundraw), because credentials live in Mongo
(`MusicProviderConfig` / `AIMusicProviderConfig`) and are set through the admin
endpoints rather than env vars.

**What's deferred**: no client surface links to these endpoints yet, and no
provider adapter beyond the DB-config pattern has been written against a specific
vendor SDK.

### Deliberately unmounted duplicates — do not "fix" by mounting

- `admin-new.js` — same route paths as the live `admin.js`; mounting both means
  one silently shadows the other. Reconcile any wanted delta into `admin.js`.
- `videoSharing.js` — its `GET /accounts` is a hardcoded placeholder AND collides
  with the real `GET /api/social/accounts`. Its genuine `POST /share` belongs in
  `social.js`.
- `v1/index.js` / `v2/index.js` — byte-identical re-export shells over routers
  already live at `/api/*`. `middleware/apiVersioning.js` tags `req.apiVersion`
  but nothing routes on it, so mounting these adds maintenance surface and no
  capability.

These are tracked in the `KNOWN_DEAD` set in `tests/server/routeMounts.test.js`,
which fails if a route file is neither mounted nor listed.

### Google Calendar sync

`googleapis` is installed and `googleOAuthService` is real, but its
`DEFAULT_SCOPE` carries no calendar scope. Adding one forces every already-
connected user to re-consent, so it needs to run as its own migration rather
than being slipped into an unrelated change.

ICS/JSON **import and export both work today** — import parses the same ICS the
exporter writes, and creates posts as `pending_approval` so a calendar file can
never silently queue posts to a real social account.

### Unit suite flakes under machine load

Intermittently fails **a different suite on each run** on a loaded machine —
observed as `socket hang up` on suites that boot the app via supertest, and ~30s
timeouts. Every one passes when re-run in isolation.

**Measured 2026-08-31**, trying to pin it down: three idle runs green, one run
under six CPU-saturating processes green, one under eight green. One run *did*
fail with 9 tests across several suites — during residual load, and it was not
captured. So it is real, load-dependent, and rarer than this note used to imply.

Ruled out along the way:
- **Not the jest timeout.** `testTimeout: 30000` is set per project and jest 29
  warns `Unknown option "testTimeout"` while still honouring it — verified with a
  deliberate 7-second test, which passes. (The root-level `testTimeout` WAS dead
  with `projects` and has been removed; the warning comes from the project
  configs and is cosmetic.)
- **Not the app listening.** `server/index.js` gates its whole boot block —
  listen, crons, shutdown hooks — on `JEST_WORKER_ID`.

**Why still deferred**: the remaining candidates (per-suite app boot, and suites
sharing the real `uploads/` directory) mean editing many test files, and without
a captured failure there is nothing to confirm a fix against. One cause WAS
found and fixed: `routeShadowing.test.js` created its user in `beforeAll` while
other suites call an unscoped `User.deleteMany({})` in `afterEach`; it now
upserts per test.

Until reproduced: re-run a failing suite in isolation before believing it. An
assertion failure is real; a `socket hang up` almost certainly is not.

### Coverage is a ratchet, not a target

Real measured coverage is **32% statements / 58% branches / 22% functions**
(unit + integration). `coverageThreshold` is set just below those so it can't
regress; the old 70/70/70/70 was never enforced because coverage silently
reported 0/0 for a long time (a tree-wide `minimatch: ^10` security override
broke `test-exclude` inside `babel-plugin-istanbul`; the v8 provider now sidesteps
it). Raise the ratchet as coverage improves — never lower it to green a build.

### Mongoose ↔ Prisma duality

Prisma is vestigial: one guarded `$connect()` and no route or service reads or
writes through it (`DATABASE_URL` is unset in every environment). Mongoose is the
sole active ORM. Removing the dependency is cleanup, not a fix.

### Longer tail (unchanged, still deliberate)

- **82 English-only pages** — 4 of 86 client pages call `useTranslation`. Full
  translation is a multi-week, ~2000-string project across 18 locales. Click is
  English-first until revenue justifies it.
- **Mobile video editor** — the timeline/drag UI is desktop-built; mobile gets an
  honest "Desktop recommended" gate rather than a broken editor.
- **Loading skeletons** — `ClickLoadingState` gives voice ("Click is analyzing
  your style…"); skeletons would replace that with grey rectangles. Intentional.
- **48-hour staging soak** — a wait, not a task. Run it against staging with
  synthetic load before a major launch.

---

## 🟢 Cron services that exist but are deliberately not started

Nineteen files call `cron.schedule`. Sixteen are registered at boot in
`server/index.js`. The remaining three are **not** oversights:

| Service | Why it stays off |
|---|---|
| `jobSchedulerService` | Superseded. Its alert/curation/goal automation was rebuilt as `alertSweepCronService`, which IS registered — see the comment at its registration. |
| `exportEnhancementService` | Its `scheduleExportJob()` is an explicit, self-documented placeholder ("would integrate with cron/scheduler"). Honest, not broken. |
| `automatedSurveyService` | Monthly NPS surveys plus follow-up reminders. The feature has **no client surface at all** — "survey" appears in exactly one route file and nowhere in `client/`. Starting a cron that generates and chases surveys for a feature with no UI would be building a feature, not fixing a bug. |

`audienceGrowthCronService` used to be a fourth. It is now started — the daily
sync had never run, so follower/subscriber trends only moved when a user
happened to hit the manual sync endpoint, and the growth charts were flat by
construction rather than by fact. It was rewritten first: the original loaded
every active `SocialConnection` in one query, deduped in JS and synced every
user serially with no cap and no lock, so every replica would have run the whole
fan-out at once. It now matches `performanceLearningCron` — cursor pagination,
`AUDIENCE_GROWTH_MAX_USERS_PER_TICK`, the shared `cronLock`, and the
autonomous-mode kill switch.

---

## 🔵 Unreachable client files — 211 left, down from 266

Building the import graph from every Next.js entry point leaves 211 client
source files with no path from any entry point (was 266 at the start of the
2026-08 pass).

**Closed since:** the 22 shadow duplicates, 16 files of dead development
instrumentation, and — the big one — **36 of the 47 components that were fully
built, called live endpoints, and were imported by nothing**. Wiring those moved
39 files onto the reachable graph.

Where they went: new routes `/dashboard/ops` (eleven operational HUDs as tabs),
`/dashboard/content/operations`, `/dashboard/toolbox`, `/dashboard/neural`,
`/dashboard/suggestions`, `/dashboard/onboarding/wizard`; panels added to
`/dashboard/{overlord,governance,insights,library,templates,workflows,`
`achievements,billing,scheduler,posts/create,content/[id],onboarding}`; and two
new editor categories (AI Assist, Monetize).

**The 11 that were NOT wired, and why.** Each duplicates a surface that already
ships. Mounting them would give the product two competing UIs for one job, which
is worse than leaving them unreachable:

| Component | Superseded by |
|---|---|
| `NeuralWorkspaceHub` | `/dashboard/workspaces` — same `/api/enterprise/workspaces` |
| `Phase10Dashboard` | `Click12Dashboard` on `/dashboard/overlord` — 3 of its 4 endpoints |
| `DashboardOverview` | the dashboard home itself |
| `SmartSuggestions`, `ContentSuggestions` | `EnhancedContentSuggestions` on `/dashboard/suggestions` (richest family; the only one with viral prediction) |
| `ProfileHUD` | `/dashboard/settings/profile`, which also handles the avatar |
| `CollaborativeComments` | `/dashboard/approvals/collaborate` has its own thread. It also needs a `teamId` no page can supply, and returns empty without one |
| `TeamPresence`, `ProjectBrowser` | the live teams / projects pages — no endpoint of their own |
| `SocialVaultView` | `DistributionHubView` in the same editor — same `/api/oauth/accounts` |
| `SocialPublishingView` | the Export → Scheduler bridge. It also needs `/api/social/publish`, and building a second publish path would reverse the deliberate consolidation onto one scheduling model |

Deleting these is a reasonable follow-up; it is not a bug that they exist.

**Still unreachable and NOT superseded**: `AIContentAnalysis` and
`AdaptiveCritiquePanel` call endpoints that do not exist
(`/api/ai/analyze-video`, `/api/ai/adaptive/feedback`). Wiring either means
building its endpoint first — they are listed in the accept-list of
`tests/server/clientApiContract.test.js` so that mounting one surfaces the
missing route immediately.

The remaining ~200 files make no API calls at all: presentational fragments,
alternate layouts and small primitives. None is provably rot.

---

## How to interpret this list

Ship today and paying customers will not see fake metrics, broken auth, blank
error pages, unsigned private media, a publish that lied about succeeding, or a
refund that claimed to have moved money.

They **will** see English UI on most pages, a "Desktop recommended" message on
the mobile editor, and explicit "not available" states on the four surfaces in
the *Honest by design* table above.

Verification for any change here: `npm run preflight`, then `npm run smoke:full`
(every GET, ceiling of 0 server errors) and `npm run smoke:writes` (every write
plus a cross-tenant IDOR probe). Both now run as blocking CI jobs.
