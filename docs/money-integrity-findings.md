# Money / state-integrity findings (verified, NOT auto-fixed)

From the deep bug-hunt (2026-06-30). These are **real** but sit in either
**incomplete** or **concurrency/ordering-sensitive** billing paths — the kind of
change that should be made with billing context + a staging rehearsal, not a
hasty autonomous edit. Documented here with the exact fix so they can be reviewed
and shipped deliberately. (The clear, low-risk bugs from the same hunt WERE fixed:
IDOR #135, billing-500 #136, crash-hardening #137.)

## 1. Promo `usedCount` never incremented → single-use promos infinitely reusable
- **Where:** `services/billingService.js` — `applyPromoCode` validates against
  `usedCount >= maxUses` but **nothing ever increments `usedCount`** (grep: only
  reads, never writes). So a `maxUses: 1` promo passes the check forever.
- **Caveat (why not auto-fixed):** the real apply path (`processSubscriptionChange`)
  creates a `SubscriptionChange` whose `/complete` route is **retired (410)** — the
  live grant is the Whop webhook, which doesn't carry our promo. So today the promo
  discount never reduces a real payment; the leak is latent until that flow is wired.
- **Fix when wired:** at the genuine redemption point, atomically claim one use
  (race-safe, also closes the TOCTOU in #2-adjacent):
  ```js
  const claimed = await PromoCode.findOneAndUpdate(
    { code, $or: [{ maxUses: -1 }, { $expr: { $lt: ['$usedCount', '$maxUses'] } }] },
    { $inc: { usedCount: 1 } },
  );
  if (!claimed) { /* exhausted between validate and apply — reject */ }
  ```
  Do NOT increment in `POST /billing/promo-code/validate` (preview only).

## 2. costGuard AI-budget check is TOCTOU
- **Where:** `middleware/costGuard.js` — reads the meter, decides allow, then later
  `$inc`s usage. Two concurrent AI calls both read remaining=$X, both pass, both
  execute → user overspends the budget by up to one concurrent call.
- **Severity:** low-ish — partially bounded by the per-call token cap; impact is a
  small overspend, not unbounded. Fix needs an atomic reserve-then-settle (debit a
  reservation up-front via `findOneAndUpdate` conditional on remaining budget).

## 3. Whop webhook out-of-order / replay can mis-set tier
- **Where:** `services/whopWebhookService.js` `processEvent` overwrites
  `user.subscription.status`/`plan` with **no ordering/staleness guard**. Two-phase
  idempotency (#123, `WebhookEvent.processed`) stops a *processed* event re-applying,
  but: (a) an event that crashes before `markProcessed` re-applies on retry, and
  (b) an out-of-order **older** `payment.succeeded` arriving after a `cancelled`
  re-grants the old tier.
- **Fix:** stamp each event's source timestamp and apply conditionally
  (`only set if incoming.eventTime >= user.subscription.lastEventTime`), or guard
  state transitions (don't let an upgrade event overwrite a newer cancellation).

## 4. Scheduled-post path via `/api/posts` enqueues to a DEAD queue
- **Where:** `routes/posts.js:170,419` call `addScheduledPostJob({ postId, userId })`
  → `QUEUE_NAMES.SCHEDULED_POSTS` ('scheduled-posts'), but **no worker consumes that
  queue** (workers are on video-processing / content-generation / social-posting /
  …; `socialPostProcessor` is on `social-posting`). So posts scheduled through the
  Supabase `/api/posts` create page **never publish**, yet the route logs "scheduled
  successfully". (The Mongo `/api/scheduler` path is separate and works — its cron
  publishes `ScheduledPost` docs directly.)
- **Fix options (architectural — needs a decision):** (a) route `/api/posts`
  scheduling through the working Mongo `ScheduledPost` + cron path; or (b) register
  a consumer for `scheduled-posts`; or (c) if `/api/posts` scheduling is deprecated,
  stop enqueuing + drop the misleading "scheduled successfully" log so the UI/users
  aren't told a post will publish when it won't.

## Not bugs (verified, do NOT "fix")
- `getRevenueMetrics` `ensureObjectId(userId)` and dashboard `uidObj` are correct —
  they query **BillingHistory / AudienceGrowth**, which ARE ObjectId-keyed.
- The scheduled-post **claim** (`findOneAndUpdate status scheduled→publishing`) is
  atomic — no double-pickup across cron ticks. (Double-post only on a crash AFTER
  the platform call but BEFORE `post.save()`; guard with a persisted `platformPostId`
  check before re-publish if that proves to happen.)
