# Runbook — userId `String → ObjectId` schema flip (staged)

**Status:** PLANNED — do NOT run against prod without completing every staging step below.

## Why this is deferred (the risk)

Click's canonical Mongo identity is `req.user._id` — a **deterministic ObjectId**
(`ensureObjectId(supabaseUUID)`, an MD5 hash → 24-hex). `req.user.id` /
`req.user.supabaseId` is the Supabase **UUID** (for Supabase tables only). The
hash is **one-way**. See [`server/utils/userKey.js`](../server/utils/userKey.js)
and the `identity-userid-normalization` project memory.

Several collections still store `userId` as a **String** (the hex form of the
ObjectId). Flipping the schema to `ObjectId` is desirable (type purity, one
identity everywhere) but RISKY because:

1. **35+ read sites resolve identity UUID-FIRST** — `req.user?.id || req.user?._id`
   (manual-editing, render, ai-editing, dashboard, competitive-benchmark, …).
   With an ObjectId schema, a UUID value hitting one of those queries is a
   **CastError → 500**.
2. `req.user.id`'s runtime form (UUID vs the Mongo `.id` hex virtual) depends on
   the **auth mode** (Supabase vs Mongoose fallback) — unverifiable without prod-like traffic.
3. The shared `getUserId()` (user.js, workflows/templates.js) is UUID-first AND
   feeds the **intentionally UUID-keyed** `UserSettings` / `UsageMeter` — so a
   blanket "use `_id` everywhere" change would orphan those.
4. **Stored-type vs schema-type must flip together.** A query value is cast per
   the *schema* type. With schema=ObjectId but stored values still String, every
   query (cast to ObjectId) fails to match String-stored docs → **all existing
   data goes invisible** until the data is converted to BSON ObjectId.

## Scope

**FLIP `userId` → `ObjectId`** (writers already use `req.user._id`):
`Content`, `ScheduledPost`, `VectorMemory`, `Workflow`, `AgenticJob`.

**NEVER flip** (verified):
- `UserSettings`, `UsageMeter` — **intentionally UUID-keyed** (readers use UUID-first `getUserId`).
- `EngagementQuality` — its `userId` is a nested *social-engager* id, not the owner.
- `Script`, `Achievement`, `SuggestionHistory`, `EditPlanMemory`, `Draft` — already ObjectId.

## Prerequisites

- A **staging MongoDB** seeded from a recent prod snapshot (real data shapes — both hex-form and any UUID-form `userId`s).
- Staging app deploy with prod-like auth mode (`ENABLE_SUPABASE_AUTH` set as prod).
- Integration coverage that exercises the 35+ read sites (editor load, render, dashboard stats, scheduling, vector-memory, agentic pipeline) — extend `tests/integration` as needed.
- A verified DB backup + tested restore (`scripts/backup-database.js`).

## Phase 1 — code: make ALL Mongo identity canonical-first (ship FIRST, no schema change)

Goal: every read/write of a flip-set collection resolves identity to the
canonical ObjectId (or its hex), so behavior is unchanged under the String schema
(hex stringifies the same) but the codebase is ready for the type flip.

1. Add the canonical resolver everywhere it's missing: replace `req.user?.id || req.user?._id` (UUID-first) with `req.user?._id || req.user?.id` (canonical-first) — or `require('../utils/userKey').mongoUserId(req)` — **only at sites querying a flip-set collection**. Leave Supabase queries (`posts.author_id`) and the UUID-keyed `getUserId` (UserSettings/UsageMeter) on the UUID.
2. The dashboard `/stats` fix (already shipped) is the template.
3. Grep guard: `grep -rn "req.user?.id || req.user?._id" server/routes server/services` and convert the flip-set ones. List each in the PR.
4. Verify on staging: editor/render/dashboard/scheduling/vector-memory/agentic all behave identically (still String schema). 808+ unit suite green.

## Phase 2 — data: normalize stored values to canonical hex (idempotent, safe)

[`scripts/migrate-userid-normalize.js`](../scripts/migrate-userid-normalize.js)
converts any stored UUID-form `userId` → canonical hex (string→string, no type
change). Already applied to prod (16 docs healed); re-run dry-run to confirm
**0 convertible** (idempotent).

```
NODE_ENV=production node scripts/migrate-userid-normalize.js --prod         # dry-run
NODE_ENV=production node scripts/migrate-userid-normalize.js --prod --apply  # if any remain
```

## Phase 3 — the flip (schema + BSON conversion, deployed in LOCKSTEP)

> The window where schema=ObjectId but data is still String makes data invisible.
> Keep it to seconds: convert the data with the raw driver, then deploy the
> flipped schema (or vice-versa within the same maintenance step).

1. **Backup** prod (and confirm restore works).
2. Write `scripts/migrate-userid-to-objectid.js` (mirror the dry-run/`--apply`/`--prod`/dbSafety-guarded pattern): for each flip-set collection, `bulkWrite` converting the String `userId` → **BSON ObjectId** via the raw driver (`new ObjectId(hex)` — every value is 24-hex after Phase 2). Idempotent (skip values already ObjectId).
3. **Flip the schemas** (`type: String` → `mongoose.Schema.Types.ObjectId`) on the 5 flip-set models. (The reverted Wave-2 comments in those models point here.)
4. **Run order on staging, timed:** apply the BSON conversion → deploy the schema-flip build → immediately verify reads. On prod, do the same in one maintenance step (small data — hundreds–thousands of docs, seconds).
5. Mongoose `autoIndex` rebuilds the `userId` indexes against the new type.

## Phase 4 — verify

- For a sample of real users: the SAME documents are returned by `Content.find({userId})`, `ScheduledPost.find({userId})`, etc. **before vs after** (assert count + ids match).
- Editor load, render, dashboard `/stats`, scheduling, vector-memory query, agentic pipeline all work end-to-end on staging.
- No CastError 500s in logs (search for `Cast to ObjectId failed` over the soak window).
- `/api/health/ready` green.

## Rollback

- If reads break post-flip: revert the schema-flip deploy (back to String schema) — the BSON-ObjectId data still reads correctly under a String schema *only if* re-converted back to hex (the String schema casts query ObjectId→hex, but stored BSON ObjectId ≠ hex string → mismatch). So the safe rollback is: **revert schema deploy AND run the inverse data migration** (ObjectId→hex string) — keep that inverse script ready.
- Because rollback is also a two-part (schema + data) step, prefer a **short staging soak** + a low-traffic maintenance window for the prod cut-over.

## Decision gate

Do not proceed to prod Phase 3 until: Phase 1 shipped + soaked on staging with zero CastErrors, Phase 2 shows 0 convertible, integration suite green, backup+restore verified, and the inverse (rollback) migration is written and tested on staging.
