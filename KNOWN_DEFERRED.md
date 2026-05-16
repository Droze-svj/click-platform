# Known-Deferred Work — Click Pre-Launch

Honest list of what's intentionally NOT done yet, with the reason for each. This file is the antidote to "is this ready?" anxiety: if it's listed here, it's a conscious deferral with a known impact, not an oversight.

Last updated: 2026-05-16, after the full polish + verification sweep.

---

## ✅ Verified working

- Auth chain: register → login → /auth/me → silent refresh → logout. Both tokens issued on every login path. 10/10 E2E cases pass.
- Cold-start analytics: every endpoint a brand-new paying user touches returns honest zeros + `isFallback: true`. The 4 phantom-data leaks (SPECTRE_SIMULATION 4.5M views, hardcoded "Future of AI Architecture" posts, +120 spectral gravity, Math.random AI predictions) are all removed.
- /api/video/render mounted (was orphaned — would have 404'd in production).
- /verify-email page built (was 404 — every new user clicking the verification link would have hit a blank page).
- error.tsx coverage: 51/51 dashboard pages have error boundaries using the Click voice.
- i18n interpolation supported, 18 locales all carry the new keys, RTL-breaking concatenations fixed.
- Whop webhook idempotency (replay-safe).
- Per-endpoint rate limits on auth, AI, render endpoints.
- Hardcoded admin/test credentials removed from auth.js.
- Draft autosave model + /api/drafts route + hook + scripts editor wired.
- ClickVoice + ClickPresence + ClickEmptyState + ClickLoadingState + ClickErrorRecovery + ClickAutosaveBadge all built and adopted in 8+ pages.
- /dashboard/click-learning page (shows what Click has learned per user).
- Mobile gate on heavy video editor.
- BullMQ workers connected to Upstash Redis, MongoDB Atlas connected, Supabase connected, Gemini connected.

---

## 🟡 Deferred — with reason

### Phase 1.3 — FFmpeg temp-file cleanup audit (20+ services)

**What's left**: 20+ services touch FFmpeg and write temp files but don't have `finally`-block cleanup. Risk of disk leaks on render failures.

**Why deferred**: touching 20 service files without integration tests is risky right before launch — a botched cleanup edit can break the render pipeline silently. The hot-path render endpoint (`/api/video/render`) DOES persist output by design (downloadable), so the temp-leak issue is in intermediate transcode/transcribe services and won't affect a paying user's primary export.

**Recommendation**: post-launch, do this with integration tests. Order by call frequency: aiTranscriptionService, whisperService, advancedVideoProcessingService first. Pattern is "wrap the body in try/finally and call cleanupTempFiles() in the finally."

### Phase 1.5 — Shorten access token from 30d to 1h

**What's left**: the refresh-token infrastructure is fully wired (server issues pair on every login, client interceptor refreshes on 401 and replays). What's NOT changed: the access token still has a 30-day lifetime. Industry standard is 1 hour.

**Why deferred**: shortening to 1h forces every existing session to hit /refresh within an hour. If anything's subtly wrong with the client interceptor (concurrent refreshes, race conditions, edge browsers), every user gets logged out mid-session. Safer to let the refresh loop run in production for a week first, observe metrics, then drop the access token TTL.

**Recommendation**: after the public soft-launch, edit `server/utils/jwtTokens.js` line 26: `const ACCESS_TTL = '1h'`. One-line change once we've watched the refresh loop work for a week.

### Phase 2.2 — Resumable uploads (tus protocol)

**What's left**: a 2GB upload that drops at 1.9GB starts over from zero. No resumption.

**Why deferred**: tus introduces a new protocol + 2 new dependencies (tus-js-client, @tus/server). Real-world testing requires actual large files and bandwidth throttling. The friction is real but only hurts users uploading >1GB on flaky wifi.

**Recommendation**: phase-2 post-launch when we have data on actual upload-size distribution. Most early users upload <500MB and don't experience the resume need.

### Phase 2.4 — BullMQ dead-letter queue with user-facing surface

**What's left**: jobs that fail 3 times currently disappear silently. Users don't see "Click hit a snag rendering Clip 4 — retry?" alerts.

**Why deferred**: needs a real failure to test meaningfully. Implementation is straightforward (BullMQ has `failed` events + persistent failed jobs) but the UI integration touches the notifications system, which itself needs a polish pass.

**Recommendation**: implement after the first 100 real renders so we have actual failure modes to surface, not speculative ones.

### Phase 3.2 — Loading skeletons

**What's left**: most fetch states still show spinners (now via `ClickLoadingState`) rather than content-shaped skeleton placeholders.

**Why deferred**: ClickLoadingState gives personality and information ("Click is analyzing your style…"). Skeletons would replace personality with grey rectangles. Modern UX research is mixed on which is better. Not worth duplicating the work without a clear preference signal from users.

**Recommendation**: keep as-is unless user feedback specifically asks for skeletons.

### Phase 3.3 — Full mobile rebuild of video editor

**What's left**: the 1001-line video editor is desktop-built. We added a "Desktop recommended" mobile gate as a polite fallback, but the timeline + drag UI itself doesn't have a mobile-native layout.

**Why deferred**: full mobile editor is a multi-week design + build effort. The gate is the honest interim — users on phones see a clear "switch to desktop" message rather than a broken UI.

**Recommendation**: dedicated mobile-editor sprint post-launch. Possibly as a separate "Click Lite" mobile app rather than retrofitting the web editor.

### Phase 5.1 — C2PA signing environment verification

**What's left**: the `c2paService` is called from the render endpoint but the actual `c2patool` / `c2pa-node` binary may not be installed on the production host.

**Why deferred**: this is an env-side verification (does the binary exist on Render?), not a code change. Easy to verify by `which c2patool` on the prod host. The current code is best-effort: if signing fails, the render returns the unsigned MP4 with a warning rather than throwing.

**Recommendation**: SSH into prod once deployed, confirm `c2patool --version`. Document the install command if missing.

### Phase 5.3 — Observability + auto-rollback automation

**What's left**: `scripts/production-monitoring.js` and `scripts/rollback-deployment.sh` exist but are manual — not wired into a systemd unit or auto-rollback on health-check failure.

**Why deferred**: production infrastructure can only be validated in production. Local testing of cron-on-systemd / auto-rollback would burn time on yak-shaving.

**Recommendation**: post-deploy, wire `scripts/production-monitoring.js` into a Render cron-job or systemd unit. Add a Render auto-deploy hook that watches `/api/health` failure rate.

### Phase 5.5 — 48-hour staging soak test

**What's left**: load the platform with synthetic users for 48 hours, watch for orphaned jobs, lost drafts, memory leaks.

**Why deferred**: literally a 48-hour wait. Not parallelizable with development.

**Recommendation**: run after deploying the polish work to a Render staging environment. Synthetic load: 10 video uploads, 50 scheduled posts, 3 webhook replays, 2 forced dyno restarts.

### Translation completeness for 82 untranslated pages

**What's left**: 4 of 86 client pages call `useTranslation`. The other 82 (including the entire landing page, most dashboard pages, all legal pages) are English-only.

**Why deferred**: that's a multi-week translation project for ~2000+ strings across 18 locales. The 4 translated pages happen to be the most-touched (auth, settings, content detail) so the cold-start translation experience is reasonable.

**Recommendation**: declare the platform "English-first with 4 internationalized pages" until there's revenue justifying a real translation budget. Add a small "Translations expanding" note in Settings next to the language picker.

---

## Bugs I deliberately did NOT touch (out of scope or higher-risk than reward)

- **Mongoose ↔ Prisma duality**: the codebase has both ORMs. Picking one and migrating is a separate architecture decision.
- **The various `phase8`, `phase9`, `overlord`, `governance`, `compliance` dashboard pages**: these are clearly experimental/internal. They render 200 and don't crash, but their data flows weren't audited.
- **OAuth signup with Google/GitHub**: backend has the connect routes; the marketing copy doesn't promise it; safer to ship without it than to ship a half-wired flow.

---

## How to interpret this list

If you ship today with everything above deferred:
- **Paying customers will not see fake metrics, broken auth, blank error pages, broken email-verification links, or wrong-language UI in the 4 translated pages.**
- **They WILL see**: English UI on most pages, a "Desktop recommended" message on mobile editor, occasional disk pressure if many transcodes fail without finally-cleanup, and no auto-rollback if the prod node crashes.

Each deferred item has a clear recommendation. Pick them off in the order listed (Phase 1.3 → 1.5 → 5.1 → 5.3 → 5.5 → mobile, with 2.2/2.4/3.2/3.3/translations as longer-tail).
