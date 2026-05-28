# Click — Final AI/Intelligence Polish for Live Test (v4)

## Context

Gemini 2.5 Flash is now live (billing enabled, 1.3s p50). json2video transcription works end-to-end. Boot is clean. But three parallel audits surfaced real gaps between the marketing copy ("best edits, best captions, thumbnails, titles, marketing intelligence") and what actually lands in front of a user.

Conflicting agent claims were resolved by reading the actual code. Confirmed truths:

- **Engagement feedback loop IS wired** — `platformIngestionCronService` starts at boot ([server/index.js:399](server/index.js#L399)), polls every 15 min, calls `syncAllUserAnalytics → ingestPostPerformance → UserStyleProfile.recordPerformance`. Style learning closes the loop. (Agent 2 was wrong, Agent 3 right.)
- **Marketing knowledge IS wired** — `reformatService.js:19` imports `buildSystemPrompt` from `marketingKnowledge`. Hook frameworks + niche playbooks reach Gemini prompts. (Agent 1 was wrong.)
- **Thumbnails ARE stubs** — `aiThumbnailService.generateAThumbnail` returns a hardcoded URL with NO ffmpeg/sharp frame extraction. The thumbnail file at `/uploads/thumbnails/...` doesn't exist on disk. `smartThumbnailService` only suggests timestamps. (Agent 1 right.)
- **3 caption variants are generated, only [0] persists** — `smartPublishService.js:146` writes `p.captions[0]` to the flat `captions` object. The full `perPlatform` array exists in the response (line 173) but `ai-editing.js:400` only persists the top-1. Client type at `ClipCard.tsx:62` is `{ tiktok?: string; ... }` — single string per platform, no A/B surface.
- **Scheduler fake-success on no-connection** — [scheduler.js:346](server/routes/scheduler.js#L346) marks posts as `posted` with `platformPostId = mock-${Date.now()}` when the user has no SocialConnection. The analytics cron correctly skips these (`/^mock-/` blacklist), so engagement never arrives. User believes a post worked when nothing was published. (Agent 3 flagged this as Break #1 — confirmed.)
- **Mock fallback analytics** — [analytics/core.js:487](server/routes/analytics/core.js#L487) returns 4.5M views + 284K engagement with `isFallback: true` when the user has no data, but the client doesn't read the flag. Tester sees fabricated growth.

This plan is **5 surgical fixes + 1 prompt extension** to close the gaps without scope-creep. Out of scope (deliberate): real DALL-E/Imagen image-generation thumbnails (use ffmpeg frame extract + text overlay instead — same UX, zero extra API cost); rebuilding all 3 hook generators into one (works fine fragmented for the demo); platform-side webhook receivers (the 15-min poll closes the loop adequately for live testing).

---

## A1 — Stop the scheduler fake-success on no-connection

**Problem**: [server/routes/scheduler.js:346-358](server/routes/scheduler.js#L346) — when the cron picks up a scheduled post and the user has no `SocialConnection.isActive=true` for that platform, the code marks `post.status = 'posted'` with a synthetic `mock-${Date.now()}` platformPostId. The analytics cron then ignores it (mock-prefix blacklist), so engagement never arrives. The user sees "Posted ✓" with zero engagement forever.

**Fix**:
```js
} else {
  post.status = 'failed';
  post.error = `No active ${post.platform} connection. Reconnect in /dashboard/integrations.`;
  await post.save();
  // Surface to user via the existing notification path — see A6
}
```

This converts a silent fake-success into a visible failure. The post enters the existing `failed` status path that A6 will surface.

---

## A2 — Real thumbnail generation (ffmpeg frame + overlay text)

**Problem**: [aiThumbnailService.js:46-62](server/services/aiThumbnailService.js#L46) — `generateAThumbnail` does `return { thumbnailUrl: '/uploads/thumbnails/${videoId}_ai_vibrant.jpg' }` without ever invoking ffmpeg. The file doesn't exist on disk; the URL 404s. [smartThumbnailService.js](server/services/smartThumbnailService.js) is similar — only suggests timestamps via Gemini.

**Fix**: Wire `aiThumbnailService.generateAThumbnail` to actually render. The pipeline already exists in `videoRenderService.js` for ffmpeg overlay rendering — reuse the drawtext filter chain. Steps:

1. Use ffmpeg `-ss <timestamp> -frames:v 1` to extract a still frame to `/uploads/thumbnails/${videoId}_${idx}.jpg`.
2. Use Gemini (already wired) to generate a 3-5 word punchy overlay text from the clip caption.
3. Re-encode with `drawtext` filter for the overlay (yellow text + black outline + center-bottom position — same style our caption renderer uses).
4. Return the real path; verify with `fs.existsSync` before returning success.

For viral thumbnail variant generation, expose 3 candidates (3 different timestamps + 3 different overlay angles) so the user can pick. `smartThumbnailService` already returns candidate timestamps from Gemini — wire its output as input to the new render path.

---

## A3 — Persist + surface all 3 caption variants per platform

**Problem**: Gemini generates 3 distinct angles (curiosity-gap / value / contrarian) per platform via `reformatService`, but `smartPublishService.js:146` only stores `captions[platform] = variants[0]`, throwing away the other two. The client type at [ClipCard.tsx:62](client/components/clips/ClipCard.tsx#L62) is `{ tiktok?: string }` — single string. The drawer at [SchedulePublishDrawer.tsx:108](client/components/clips/SchedulePublishDrawer.tsx#L108) reads only that single field. Result: "best captions" is one bland default, not three angles.

**Fix** — three small edits:

1. [server/services/smartPublishService.js:145-150](server/services/smartPublishService.js#L145) — also build `captionVariants[platform] = p.captions.slice(0, 3)` (alongside the existing `captions[platform] = p.captions[0]` for back-compat).
2. [server/routes/video/ai-editing.js:400](server/routes/video/ai-editing.js#L400) — extend the `$set` to also persist `recommendedCaptionVariants`.
3. [client/components/clips/ClipCard.tsx:62](client/components/clips/ClipCard.tsx#L62) + [SchedulePublishDrawer.tsx](client/components/clips/SchedulePublishDrawer.tsx) — extend Clip type with `recommendedCaptionVariants?: { tiktok?: string[]; shorts?: string[]; reels?: string[] }`. Add an A/B/C tab strip above the caption textarea that swaps in the picked variant; the user's pick (kept-as-is or rewrites) still feeds the existing delta-capture learning loop unchanged.

---

## A4 — Inject trend context into caption prompts

**Problem**: [globalMarketingIntelligenceService.js](server/services/globalMarketingIntelligenceService.js) generates niche-specific trend reports via Gemini AND has a `getKnowledgeSlice()` exporter that surfaces 2026 trends per niche. But it's never called from the caption pipeline — `reformatService` only injects hook frameworks via `buildSystemPrompt`, no trending-now context. So when a fitness creator publishes today, captions can't reference "cold-plunge week" or whatever's hot this cycle.

**Fix**: Extend `marketingKnowledge.buildSystemPrompt(niche, platform)` to also pull the cached trend slice from `globalMarketingIntelligenceService.getCachedTrends(niche)` (already cached per `marketingIntelligence.js:90-129`'s 24h cache). The system prompt gets one extra section: `"Current 2026 trends in ${niche}: ${trends.join(', ')}. Reference one if it fits the clip — never force it."` That's a 5-line edit to one function. Captions automatically inherit niche-aware trend context with no per-platform code change.

---

## A5 — Replace mock fallback analytics with honest empty-state

**Problem**: [server/routes/analytics/core.js:487-506](server/routes/analytics/core.js#L487) — `/api/analytics/dashboard` returns 4.5M views, 284K engagement, 6.2% rate when the user has no real data. Marked `isFallback: true` server-side, but the client at [app/dashboard/analytics/page.tsx:52-53](client/app/dashboard/analytics/page.tsx#L52) does `setData(res.overview)` without checking the flag. Live tester sees professional growth charts that have nothing to do with their account.

**Fix** — two-line edit on each side:
1. Server keeps the `isFallback` flag, but flatten the fallback object to all-zeros: `{ totalViews: 0, totalEngagement: 0, ..., isFallback: true }`. Don't lie with phantom 4.5M numbers.
2. Client at [analytics/page.tsx](client/app/dashboard/analytics/page.tsx) — when `data.isFallback === true`, render an empty-state card ("Connect a social account and publish a clip to see real metrics here") instead of the chart. Existing patterns in the codebase already do this — mirror them.

Same fix applies to `/api/analytics/performance`, `/api/analytics/creator/stats`, and the real-time engagement command center, all of which have similar `isFallback`-gated mock data ([core.js:682-695, 914-916, 995-1004](server/routes/analytics/core.js#L682)).

---

## A6 — Surface scheduler failures via the existing notification path

**Problem**: When a scheduled post fails ([scheduler.js:342](server/routes/scheduler.js#L342) sets `post.status = 'failed'`), the post-save hook fires the calendar realtime update — but no in-app notification is created. The user has to manually navigate to the scheduler page to discover the failure.

**Fix**: After `post.status = 'failed'` (and after A1's no-connection branch fix), call `notificationService.create(userId, { type: 'error', title: 'Scheduled post failed', message: post.error || 'See scheduler for details', link: '/dashboard/scheduler' })`. The notification system already exists ([server/services/notification*](server/services/) — verify exact path) and the bell icon in the dashboard header already polls notifications. Real-time toast falls out for free.

---

## Verification

After each fix lands, I'll run end-to-end against the live server. Full happy-path:

1. **A1**: Schedule a post for `now+1m` to a platform the test user hasn't connected. Wait for cron tick. Confirm `ScheduledPost.status === 'failed'`, `error` field populated, NO `mock-...` platformPostId.
2. **A2**: Run auto-edit on a 30s clip → request `autoGenerateViralThumbnails`. Confirm 3 jpg files exist on disk at returned URLs, each is >5KB (real frame + overlay), and the URLs render in `<img>`.
3. **A3**: Re-publish a clip → drawer shows A/B/C variant tabs above the caption textarea. Switch tabs → caption text changes to the picked variant. Submit → server-side log shows the picked angle (curiosity/value/contrarian) in the delta-capture record.
4. **A4**: Run `buildPublishSuggestion` for niche='fitness'. Confirm at least one caption variant references a current 2026 trend (cold-plunge, zone-2 cardio, sleep-architecture, etc.). Cache hit on second call.
5. **A5**: Hit `/api/analytics/dashboard` as a fresh user (no posts). Confirm response has all-zero metrics + `isFallback: true`. Open the page → empty-state card renders, no fake chart.
6. **A6**: Trigger A1's failure path. Confirm notification record in Mongo with `type: 'error'`, link `/dashboard/scheduler`. Notification bell badge increments.
7. **End-to-end check**: Run `pnpm exec tsc --noEmit` (client) → exit 0. Restart Click → boot log clean. Hit `/api/health` → 200.

---

## Critical files to modify

**Server**:
- `server/routes/scheduler.js` — A1 (no-connection → failed) + A6 (notification on fail)
- `server/services/aiThumbnailService.js` — A2 (real ffmpeg frame extract + drawtext)
- `server/services/smartPublishService.js` — A3 (also write captionVariants)
- `server/routes/video/ai-editing.js` — A3 (persist recommendedCaptionVariants)
- `server/services/marketingKnowledge.js` — A4 (extend system prompt with trends)
- `server/routes/analytics/core.js` — A5 (zero-out fallback data, keep isFallback flag)

**Client**:
- `client/components/clips/ClipCard.tsx` — A3 (extend Clip type)
- `client/components/clips/SchedulePublishDrawer.tsx` — A3 (variant A/B/C picker UI)
- `client/app/dashboard/analytics/page.tsx` — A5 (empty-state when isFallback)

**Reused (no changes)**:
- `videoRenderService.buildDrawTextFilter` — A2 reuses the existing overlay filter chain
- `globalMarketingIntelligenceService.getCachedTrends` — A4 reuses the existing 24h cache
- `notificationService.create` — A6 reuses the existing in-app notification path
- `platformIngestionCronService` — engagement loop already wired, no change

---

## What's intentionally NOT in this slice

| Thing | Why deferred |
|---|---|
| Real AI image generation for thumbnails (DALL-E / Imagen) | Adds OpenAI dependency. ffmpeg frame + overlay is the industry standard for short-form anyway (MrBeast / Hormozi do this) |
| Unified hook framework (3 → 1 generator) | Refactor; works correctly fragmented for the demo |
| Platform-side webhook receivers (Twitter/Meta/etc.) | The 15-min `platformIngestionCronService` poll closes the loop fast enough for testing |
| Replacing the niche-playbook static config with live trend scraping | A4 covers the user-visible benefit; live scraping is multi-day |
| Token rotation backoff (one-shot retry → exponential) | Existing retry-once is sufficient for transient 401s in a closed live test |

---

## Sequencing

1. A1 scheduler fake-success — 10 min
2. A6 notification on fail — 15 min (do it right after A1 since they share the failure branch)
3. A5 empty-state analytics — 25 min
4. A3 caption variants end-to-end — 60 min
5. A4 trend injection into captions — 30 min
6. A2 real thumbnails — 60 min (last, biggest)
7. Verification end-to-end — 30 min

**Total: ~3.5h focused.** Single-PR-able. After this lands, the demo path delivers what the marketing copy promises: real captions with three angles, real thumbnails with extracted frames + overlay text, real analytics (or honest empty-state), publish failures the user can actually see, and niche-aware trend-tuned copy.
