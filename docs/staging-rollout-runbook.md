# Staging → Prod Rollout Runbook (gated flags & migrations)

Master index + procedures for the shipped-but-OFF flags and the gated one-time
migration scripts. Every item here is **implemented, tested, and merged**; the
only remaining action is a rehearsal in staging followed by an env-store flip (or
a `--apply` run) in production. All flags default **OFF** — flipping is reversible
by unsetting the env var (no redeploy needed if the env store is live-reloaded;
otherwise a restart).

> Standing rule: `.env` `MONGODB_URI` is the **live prod Atlas DB**. Migration
> scripts are dry-run by default and refuse a remote/prod URI unless BOTH
> `NODE_ENV=production` AND `--prod` are passed. Never weaken those guards.

## Index

| Item | Env var / script | Default | Runbook |
|------|------------------|---------|---------|
| AI budget atomic reserve (TOCTOU) | `AI_BUDGET_ATOMIC_RESERVE` | OFF | §1 (below) |
| Whop webhook ordering guard | `WHOP_WEBHOOK_ORDERING_GUARD` | OFF | §2 (below) |
| OAuth server-side code exchange | `OAUTH_SERVER_SIDE_EXCHANGE` | OFF | §3 (below) |
| Purge orphaned dead-letters | `scripts/purge-orphaned-deadletters.js` | dry-run | §4 (below) |
| Signed-media enforcement | `REQUIRE_SIGNED_MEDIA` | OFF | [signed-media-enablement-runbook.md](./signed-media-enablement-runbook.md) |
| userId String→hex normalize | `scripts/migrate-userid-normalize.js` | dry-run | [userid-objectid-flip-runbook.md](./userid-objectid-flip-runbook.md) |
| Weekly digest generation cron | `ENABLE_DIGEST_CRONS` | OFF | §5 (below) |
| Social reply sending | `SOCIAL_REPLY_SEND` | OFF | §6 (below) |

General flip protocol (applies to every flag): rehearse in staging → run the
item's Jest suite in CI → set the env var in the **staging** env store → smoke
the listed surfaces → set it in **prod** → watch the listed signal for 24h →
roll back by unsetting the var if the signal regresses.

---

## §1 — `AI_BUDGET_ATOMIC_RESERVE`

**What it changes.** OFF = the legacy check-then-act budget path
(`assertBudget()` then `recordUsage()`), which can overshoot under concurrent AI
calls (TOCTOU). ON = atomic reserve-then-settle: `reserveBudget()` debits the
estimate up front with a conditional `$inc` (`$expr` guard so the meter can't
exceed the tier budget), `settleReservation()` corrects to real usage, and a
`res.on('finish')` hook auto-refunds any unsettled reservation.

- Read site: `server/middleware/costGuard.js` (`atomicEnabled()` → `AI_BUDGET_ATOMIC_RESERVE === 'true'`).
- Tests: `tests/server/middleware/costGuardReserve.test.js` (reserve/settle/release + the two-concurrent-0.6×-budget race → exactly one wins).
- Blast radius: every `costGuard()`-wrapped route — `/api/ai/*`, `/api/hookEnsemble`, `/api/ai/factory/create`, `/api/video/{tools,transcription,chapters,neural}`.

**Rehearsal (staging)**
1. `npx jest --selectProjects unit costGuardReserve` → green.
2. Set `AI_BUDGET_ATOMIC_RESERVE=true` in the staging env store; restart.
3. Fire N concurrent AI calls for one user whose remaining budget only covers ~1: confirm exactly one 200 and the rest 402, and the `UsageMeter.aiSpendUsd` never exceeds the tier budget.
4. Kill a request mid-flight (or force a downstream error): confirm the reservation is released (meter returns to pre-call value) rather than leaking.

**Flip (prod)**: set `AI_BUDGET_ATOMIC_RESERVE=true`. **Watch**: 402 rate on
`/api/ai/*` and meter coherence for 24h. **Rollback**: unset the var.

---

## §2 — `WHOP_WEBHOOK_ORDERING_GUARD`

**What it changes.** OFF = idempotency stops *reprocessing* the same event but a
delayed older event (e.g. a late `payment.succeeded` arriving after `cancelled`)
can still re-grant a tier. ON = drop any event provably older than
`user.subscription.lastEventAt` — only when both timestamps are known; the first
event and timestamp-less providers are never dropped.

- Read site: `server/services/whopWebhookService.js` (`orderingGuard = WHOP_WEBHOOK_ORDERING_GUARD === 'true'`).
- Schema: `User.subscription.lastEventAt` (Date) persists the newest applied event time.
- Tests: `tests/services/whopWebhookOrdering.test.js` (OFF applies older; ON drops older-after-newer, accepts first, accepts timestamp-less).
- Webhook route: `POST /api/webhooks/whop`.

**Rehearsal (staging)**
1. `npx jest --selectProjects unit whopWebhookOrdering` → green.
2. Set `WHOP_WEBHOOK_ORDERING_GUARD=true`; restart.
3. From the Whop staging dashboard (or a replayer), deliver a newer `cancelled`, then re-deliver an older `payment.succeeded`. Confirm the stale event is logged `dropping out-of-order event` and the user stays cancelled (no re-grant).
4. Confirm a normal in-order upgrade still applies and stamps `lastEventAt`.

**Flip (prod)**: set `WHOP_WEBHOOK_ORDERING_GUARD=true`. **Watch**: `dropping
out-of-order event` logs + entitlement changes for 24h. **Rollback**: unset.

---

## §3 — `OAUTH_SERVER_SIDE_EXCHANGE`

**What it changes.** OFF = the provider callback redirects the authorization
`code` in the URL query (lands in browser history / Referer). ON = the callback
redirects only a success flag; the server exchanges the code using a signed
`state` blob carrying `userId` + provider + inner nonce (`unwrapCallbackState`
verifies + rejects tampering).

- Read site: `server/utils/oauthServerSideExchange.js` (`serverSideExchangeEnabled()`), `wrapAuthorizeUrl` / `unwrapCallbackState`.
- Tests: `tests/server/oauthServerSideExchange.test.js` (defaults OFF, wrap→unwrap round-trip, rejects tampered state).
- **Roll out per-platform.** Signed state is longer than a bare nonce — verify each provider accepts the length before flipping it.

**Rehearsal (staging)**
1. `npx jest --selectProjects unit oauthServerSideExchange` → green.
2. Flag OFF: confirm google / facebook / linkedin connect normally (baseline).
3. Set `OAUTH_SERVER_SIDE_EXCHANGE=true`; re-connect google, then facebook, then linkedin. For each: confirm the final redirect URL has **no** `code=` / raw `state=`, and a `SocialConnection` row is created.
4. Tamper the `state` param → confirm an error redirect (no connection).
5. Watch for provider state-length rejections; a provider that rejects stays OFF.

**Flip (prod)**: enable per validated platform. **Watch**: OAuth connect
success rate per provider. **Rollback**: unset (reverts to code-in-URL).

---

## §4 — `scripts/purge-orphaned-deadletters.js`

**What it does.** One-time cleanup of orphaned `content-generation` dead-letter
jobs created when E2E/dev runs hit the prod DB and their Content was wiped by
teardown (worker's `Content.findById` throws → all retries fail → dead-letter).
See [generate-content-deadletter-rootcause](../memory) for the root cause.

- Filter (tight): `{ originalQueueName: 'content-generation', failedReason: /Content not found/i, retried: { $ne: true } }`.
- Gating: dry-run unless `--apply`; refuses a remote URI unless `NODE_ENV=production` **and** `--prod` (via `dbSafety.assertSafeScriptDbUri`).
- No real-user impact (targets only Content-not-found, never-retried jobs).

**Procedure**
1. Dry-run local: `node scripts/purge-orphaned-deadletters.js`
2. Dry-run vs prod: `NODE_ENV=production node scripts/purge-orphaned-deadletters.js --prod` — review the matched count; confirm every match is `Content not found`.
3. Apply: `NODE_ENV=production node scripts/purge-orphaned-deadletters.js --prod --apply`
4. Verify the dead-letter count drops and no real content-generation jobs were touched.

Safe to re-run (filter is idempotent — already-purged jobs won't re-match).

---

## §5 — `ENABLE_DIGEST_CRONS`

**What it changes.** OFF = the Weekly Performance Digest cron never runs (the
`/api/digest` read endpoints still work; there is just nothing to read). ON = a
weekly cron generates a per-user `PerformanceDigest` (top wins, week-over-week
engagement trend, platform breakdown, next-best actions).

- Read site: `server/services/weeklyDigestService.js` (`digestEnabled()` →
  `ENABLE_DIGEST_CRONS === 'true'` **AND** `autonomousModeEnabled()`).
- Schedule: Mondays 08:00, cronLock-guarded (multi-instance safe); per-user
  iteration is keyset-paged + memory-bounded.
- Tests: `tests/services/weeklyDigest.test.js` (pure builder).
- Cost: reads only (no AI in generation) — analytics aggregates + the existing
  next-best engine; safe to run.

**Rehearsal (staging)**
1. `npx jest --selectProjects unit weeklyDigest` → green.
2. Set `ENABLE_DIGEST_CRONS=true`; restart. Either wait for Monday 08:00 or invoke
   `generateWeeklyDigests()` once from a node REPL against staging.
3. `GET /api/digest/latest` for a seeded user → confirm the digest shape + that
   `hasData`/`trend` reflect the account's real activity (empty accounts → `new`).
4. Confirm only ONE instance generates (cronLock) and the run logs
   `[digest] weekly generation complete { processed, ok, failed }`.

**Flip (prod)**: set `ENABLE_DIGEST_CRONS=true`. **Watch**: the weekly completion
log + `PerformanceDigest` insert volume. **Rollback**: unset (generation stops;
existing digests remain readable).

---

## §6 — `SOCIAL_REPLY_SEND`

**What it changes.** OFF = the AI Comment/DM Responder drafts + queues + approves
replies, but `POST /api/responder/:id/send` returns **501** (nothing is posted to
a real platform). ON = an approved reply *may* be sent — but only if a real
per-platform adapter is wired; the default sender still refuses (`501`/`400`)
rather than fake a post.

- Read site: `server/services/socialResponderService.js` (`sendApprovedReply` →
  `SOCIAL_REPLY_SEND === 'true'`, then a `sender` adapter).
- ⚠ **Do not flip this until a real platform reply/DM adapter is implemented and
  wired as the `sender`.** With the flag on and no adapter, sends fail closed
  (the reply is marked `failed` with `sendError`) — safe, but pointless. The flag
  is a second lock in front of that integration, not a feature toggle on its own.
- Tests: `tests/services/socialResponder.test.js` (pure draft/approve logic; send
  path is guarded).

**Rehearsal (staging)** — only once an adapter exists:
1. Wire the per-platform adapter as the `sender` and unit-test it in isolation.
2. Set `SOCIAL_REPLY_SEND=true` in staging; draft → approve → send to a **test**
   account; confirm the reply appears on-platform and the record flips to `sent`.
3. Force an adapter error → confirm the record flips to `failed` with `sendError`
   and nothing double-posts.

**Flip (prod)**: set `SOCIAL_REPLY_SEND=true` after the adapter is proven.
**Watch**: `sent` vs `failed` ratio + platform API error logs. **Rollback**:
unset (sends 501 again; drafts/approvals unaffected).

---

## Rollback summary

| Item | Rollback |
|------|----------|
| Any flag (`*_RESERVE`, `*_ORDERING_GUARD`, `*_SERVER_SIDE_EXCHANGE`, `REQUIRE_SIGNED_MEDIA`) | Unset the env var → behavior reverts to the OFF/legacy path. No data migration to undo. |
| `purge-orphaned-deadletters` | Deletions are permanent, but only orphaned test jobs are removed — nothing to restore. |
| `migrate-userid-normalize` | String→String, idempotent; no BSON type change, so no read-invisibility window and nothing to revert. |
