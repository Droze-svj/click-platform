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

`npm run test:unit` intermittently fails **a different suite on each run** on a
loaded machine — observed failures were `socket hang up` on suites that boot the
app via supertest, a ~30s timeout, and suites that write fixtures into the
shared real `uploads/` directory. Every one of them passes when re-run in
isolation, and full green runs are common (238/238 and 239/239 were both
observed on the same commit).

`--runInBand` reduces it but does **not** eliminate it: a serial run also
produced two `socket hang up` failures. So this is resource contention on the
host, not purely jest parallelism. CI has been green throughout.

**Why deferred**: the likely fixes — giving the file-touching suites their own
temp directories, and reusing one app instance instead of booting per suite —
mean editing many test files for no behavior change. Worth doing before it
starts costing CI reruns. Until then, re-run a failing suite in isolation before
believing it: an assertion failure is real, a `socket hang up` almost certainly
is not.

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

## 🔵 Measured, not acted on — 266 unreachable client files (~2.3 MB)

Found while auditing client→server API paths in 2026-08. Building the import
graph from every Next.js entry point (`app/**/{page,layout,error,…}`, tests,
`middleware.ts`, the Sentry configs, and the two `new Worker(new URL(…))`
modules) leaves **266 of 810 client source files with no path from any entry
point**. They are compiled by `tsc`, linted, and shipped to nobody.

| Area | Files | Size |
|---|---|---|
| `components/` | 182 | 1.7 MB |
| `components/editor/` | 38 | 443 KB |
| `hooks/` | 19 | 44 KB |
| `lib/` | 13 | 31 KB |
| `utils/` | 10 | 86 KB |
| `app/`, `config/`, `i18n/` | 4 | 11 KB |

**Why this is listed rather than deleted.** These are not all rot. They fall
into at least three groups that need different decisions:

1. *Built but never wired* — `OnboardingWizard`, `CreatorDNA`,
   `AchievementSystem`, `HelpCenter`, `SmartSuggestions`, `MobileNavbar` and
   others are complete features waiting on a mount point. `NotificationBell` and
   `PerformanceMonitor` were in exactly this state and were wired up rather than
   deleted. Deleting these throws the work away; wiring them up is a product
   call, not a cleanup.
2. *Superseded* — an older implementation left behind when a newer one landed
   elsewhere.
3. *Genuinely dead* — experiments and probes (`InteractionProbe`,
   `NavigationProbe`, `StorageProbe`, `TokenStorageProbeFixed`).

Telling them apart needs a per-file judgement, and a 266-file deletion is not
something to do on inference.

**What WAS acted on**: the 22 files that shadowed a live file of the same name,
which is the actively harmful subset — the wrong copy is easy to edit by
mistake, and two of the broken API paths found in the same audit lived in one.
The entire `client/views/video-editor/` tree (12 stale copies of
`components/editor/views/`) went with it. See commit "fix: client calls that
pointed at endpoints the server never mounted".

**Cost of leaving it**: build time and repo noise, plus a real audit tax — a
broken API path or a dead socket listener in an unreachable component looks
exactly like a live bug until you check reachability. Both audits in this pass
had to filter for it.

**To regenerate the list**: build the import graph from the entry points above
and report files with no inbound path. The reachability question is the whole
job; a plain "who imports X" grep gets it wrong, because a file imported only by
another orphan is still an orphan.

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
