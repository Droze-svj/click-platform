# Audit Batch 4 (top-level N–Z) — confirmed findings ledger

Exhaustive per-route audit, 74 files, **17 confirmed** (verify partially rate-limited — some real findings may hide in the refuted set; re-verify pending).

**Fixed:** report-builder + phase16 remediation (#166), portal activity + ab-test (#167), pricing ticket IDOR + pipeline clamp (this PR). All 4 criticals CLOSED.

| # | file | sev | class | route | fix |
|---|------|-----|-------|-------|-----|
| 1 | phase16_18.js | critical | IDOR / broken obje | POST /api/phase16/remediation/process | In the route (or at the top of processAutonomousRemediation) load the content scoped to the caller: `const content = await Content.findOne({ _id: cont |
| 2 | portal-enhanced.js | critical | IDOR / broken obje | GET/PUT /api/client-portal/:portalId/activity (G | Load the WhiteLabelPortal by :portalId and verify the authenticated caller's authorized workspace matches portal.workspaceId (agency) or portal.client |
| 3 | portal-enhanced.js | critical | IDOR / cross-tenan | POST /api/agency/:agencyWorkspaceId/links/ab-tes | In createABTest, scope both lookups to the workspace: BrandedLink.findOne({ _id: variantA, agencyWorkspaceId }) and reject with 404 if either link doe |
| 4 | report-builder.js | critical | IDOR / mass-assign | POST POST /api/reports/templates (also mounted a | In the /templates POST handler, require agencyWorkspaceId in the body and call verifyWorkspaceAccess(req.user._id, req.body.agencyWorkspaceId) (403 on |
| 5 | pipeline.js | high | AI cost / fan-out | POST /api/pipeline/:contentId/variations | Clamp count at the route (e.g. `const count = clampInt(req.body.count, 3, 5, 1)` using utils/pagination.clampInt) and add `aiLimiter` + `costGuard()`  |
| 6 | pricing-enhanced.js | high | idor | POST /api/pricing/support/tickets/:ticketId/resp | In the respond route, fetch the ticket and verify ownership before writing — mirror the GET handler's check (compare ticket.userId to req.user._id, al |
| 7 | recycling-advanced.js | high | IDOR / broken obje | POST POST /api/recycling-advanced/ab-variants/au | Before the findByIdAndUpdate, scope the write to the caller: pass req.user._id into autoSelectWinner and change the deploy to `Content.findOneAndUpdat |
| 8 | recycling.js | high | IDOR / broken obje | POST POST /api/recycling/alerts | In createRepostAlert (server/services/repostAlertService.js) validate ownership before saving: e.g. `if (alertData.recycleId && !(await ContentRecycle |
| 9 | phase13_15.js | medium | logic/correctness | POST /api/phase13/bridge/pulse (also /bridge/hea | Pass req.user._id (the canonical ObjectId) instead of req.user.id in all three handlers (lines 15, 26, 37), matching the FleetNode userId ObjectId typ |
| 10 | phase16_18.js | medium | NoSQL operator inj | POST /api/phase16/remediation/process | String()-cast the id before use (e.g. `const contentId = String(req.body.contentId//'')`) and validate it is a 24-char hex ObjectId (mongoose.Types.Ob |
| 11 | pipeline.js | medium | AI cost / fan-out | POST /api/pipeline/batch | Clamp contentIds.length (e.g. reject/slice to a small max like 20) and mount `aiLimiter` + `costGuard()` on the /batch (and /process, /variations, /re |
| 12 | playbooks.js | medium | crash-safety / log | POST /api/playbooks/:playbookId/apply | Remove the conflicting operator: increment stats.timesUsed with $inc and update stats.clientsUsed with a single operator only — e.g. { $inc: { 'stats. |
| 13 | push.js | medium | SSRF | POST /api/push/subscribe | Before storing/sending in /subscribe, call `await assertPublicUrl(subscription.endpoint)` (server/utils/urlGuard.js) and reject non-https or private/l |
| 14 | recycling-advanced.js | medium | IDOR / broken obje | POST POST /api/recycling-advanced/ab-variants/pr | Thread req.user._id into predictVariantPerformance and scope both queries: `Content.findOne({ _id: baseContentId, userId: req.user._id })` (404 if mis |
| 15 | playbooks.js | low | IDOR / info-leak | GET /api/playbooks/:playbookId/performance | Scope the Content query to the caller/owner: add userId (or agencyWorkspaceId) to the filter, and/or match on metadata.playbookId (as getPlaybookAnaly |
| 16 | recurring.js | low | crash-safety | POST /api/recurring | Validate cadence.timezone (and timeOfDay) at the route before calling computeNextFireAt — e.g. reject with 400 CADENCE_INVALID when a lightweight tz c |
| 17 | recycling-advanced.js | low | IDOR / broken obje | POST POST /api/recycling-advanced/evergreen/fres | Pass req.user._id into calculateContentFreshness and add `userId: req.user._id` (String()-cast) to the ScheduledPost.find filter, returning a not-foun |

## Remaining (to fix — patterns proven in batches 1-3)
- **recycling-advanced.js** auto-winner/predict/freshness + **recycling.js** /alerts — owner-scope Content/ScheduledPost/recycleId (service-level).
- **push.js** /subscribe — SSRF: assertPublicUrl on subscription.endpoint.
- **playbooks.js** apply (always-500 $inc+$set same path) + performance cross-tenant count; **pipeline.js** /batch cap; **phase13_15.js** wrong userId key; **phase16** comment NoSQL scope; **recurring.js** timezone 400-not-500.
