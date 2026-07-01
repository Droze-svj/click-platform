# Money / state-integrity findings

From the deep bug-hunt (2026-06-30). Status (2026-07-01):

- **✅ FIXED — Promo `usedCount` reuse** (#1) — atomic `claimPromoCode` shipped + unit-tested.
- **✅ FIXED — `/api/posts` scheduled-post dead-queue** (#4) — lazy publish-on-read (PR #143).
- **⏳ STAGING-FLAGGED — costGuard TOCTOU (#2) + Whop webhook ordering/replay (#3):**
  both change **live billing / AI-gating** logic that can't be validated against the
  real integrations in CI, and are low-frequency; the exact ready implementations
  are below, to be applied + rehearsed on staging rather than shipped blind.

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

## 2. costGuard AI-budget check is TOCTOU — ✅ IMPLEMENTED (flag-gated OFF)
- **Where:** `middleware/costGuard.js` — reads the meter, decides allow, then later
  `$inc`s usage. Two concurrent AI calls both read remaining=$X, both pass, both
  execute → user overspends the budget by up to one concurrent call.
- **Severity:** low-ish — partially bounded by the per-call token cap; impact is a
  small overspend, not unbounded.
- **Status:** atomic reserve-then-settle shipped behind **`AI_BUDGET_ATOMIC_RESERVE`**
  (default OFF; when off, behaviour is byte-for-byte the old check-then-record).
  `reserveBudget` debits the estimate up-front via a single conditional
  `findOneAndUpdate` (`$expr` running-spend + estimate ≤ tier ceiling), so N racing
  calls can't collectively exceed budget; `settleReservation` corrects the meter to
  real usage; `releaseReservation` (fired on `res.finish`) refunds an unsettled
  reservation so an errored call can't leak a phantom debit. Covered by
  `tests/server/middleware/costGuardReserve.test.js` incl. a 2-way concurrency test.
  **To activate:** set `AI_BUDGET_ATOMIC_RESERVE=true` after a staging check.

## 3. Whop webhook out-of-order / replay can mis-set tier — ✅ IMPLEMENTED (flag-gated OFF)
- **Where:** `services/whopWebhookService.js` `processEvent` overwrites
  `user.subscription.status`/`plan` with **no ordering/staleness guard**. Two-phase
  idempotency (#123, `WebhookEvent.processed`) stops a *processed* event re-applying,
  but: (a) an event that crashes before `markProcessed` re-applies on retry, and
  (b) an out-of-order **older** `payment.succeeded` arriving after a `cancelled`
  re-grants the old tier.
- **Status:** ordering guard shipped behind **`WHOP_WEBHOOK_ORDERING_GUARD`** (default
  OFF). `getEventTime` extracts the event's source timestamp; `processEvent` stamps
  `user.subscription.lastEventAt` and drops any event provably older than the last
  applied — but **only** when both timestamps are known, so it never drops a
  first/only event or a timestamp-less provider's. Covered by
  `tests/services/whopWebhookOrdering.test.js` (incl. the older-payment-after-cancel
  case). **To activate:** set `WHOP_WEBHOOK_ORDERING_GUARD=true` after a staging check.
- **Original fix sketch:** stamp each event's source timestamp and apply conditionally
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
