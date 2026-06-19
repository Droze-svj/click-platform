# Click — Competitive Upgrade: Features & Autonomy (Phases A–E)

Delivered over a sequenced, merged roadmap. Each phase shipped on its own branch,
verified (unit + fidelity/E2E + lint), and `--no-ff` merged to `main`. Default
autonomy posture is **human-approve-before-publish**; full-auto is a per-workspace
opt-in behind the existing master kill-switch (`cronLock.autonomousModeEnabled`).

The core principle throughout: **reuse the existing world-class services**; most of
this is orchestration + a few targeted net-new capabilities, each with tests, and
external-provider features behind flags with honest "unavailable" fallbacks
(never a fabricated URL/asset).

---

## Phase A — Batch auto-clip + virality ranking (creator headline)

- `aiVideoEditingService.buildClipPlan(keyMoments, options)` — PURE virality
  ranking over the AI's already-computed `clipSuggestions` + `hookScore`
  (`0.6*hookScore + 0.25*peakBoost + triggerBoost`), clamped to length/bounds,
  ranked, top-N with `{rank, startTime, endTime, viralityScore, hook,
  triggerType, reason}` (transparency competitors don't surface).
- `autoClipService.generateAutoClips(videoId, options)` — orchestrator with
  ownership check; transcript → `detectKeyMoments` → `buildClipPlan`.
- `POST /api/video/:contentId/auto-clip` (maxClips clamped 1..20).

## Phase B — Autonomous publishing engine (human-approve default)

- `autopilotPlanService` — PURE `buildAutopilotPlan` (per-platform optimal
  hour-of-day + cadence staggering) + `createAutopilotPlan` /
  `approveAutopilotPlan` / `cancelAutopilotPlan`.
- **Human-approve gate:** plan lands as `ScheduledPost` rows with status
  `pending_approval`; the scheduler cron only fires `scheduled`, so nothing goes
  live until a human approves (or a workspace opts into `full_auto`). Proven by
  an E2E test that zero live posts exist pre-approval.
- `POST /api/autopilot`, `/:planId/approve`, `/:planId/cancel`.

## Phase C — Agency power-tools

- **Tier enforcement** (`middleware/tierEnforcement.js`): PURE `evaluateTierLimit`
  + `requireTierLimit` → clean 402 + upgrade payload at the API boundary
  (add_client/profile/team_member/api_call/report, ai_minutes), pay-as-you-go
  when overage>0, fails OPEN on infra error. No silent overselling.
- **Inline approval collaboration** (`approvalCollaborationService` +
  `ContentApproval.comments[]` / `.revisions[]`): threaded, per-field,
  resolvable comments + versioned creator re-submissions.
  `POST /api/approvals/:id/comments`, `/comments/:cid/resolve`, `/revisions`.
- **Unified calendar capacity** (`agencyCalendarService.analyzeCalendar`): PURE
  cross-client conflicts + per-client/platform/day capacity overflow + team
  workload/busiest assignee. `GET /api/agency/:id/calendar/capacity`.
- **Scheduled white-label reports**: wired `scheduledReportService.processScheduledReports()`
  into an hourly cron, switched delivery to the project `emailService` with a
  **branded** HTML email (agency logo/name/accent + client name from Workspace
  branding). **Fixed a hidden recurrence bug**: quarterly/yearly frequencies
  (valid enum values) fell through the switch and returned a *past*
  `nextGeneration` → the report (and its emails) re-fired on every cron tick.
  Now every frequency returns a strictly-future time; period bounds never undefined.

## Phase D — Net-new AI capabilities (behind flags where external)

- **Trend-jacking quick-repurpose** (`trendJackService`): PURE
  `buildTrendRepurposePlan` ranks live trends (score+velocity), pairs each with a
  recent clip, emits draft caption + merged/deduped hashtags. Orchestrator pulls
  REAL trends via `liveTrendService` (`available:false` fallback — never
  fabricated). `GET /api/trends/repurpose`.
- **Hook/CTA A/B auto-generation** (`hookExperimentService`): three angles
  (curiosity/authority/FOMO); PURE `distributeSlots` (optimal windows or
  staggered), PURE `evaluateHookExperiment` (winner by engagement rate + lift +
  confidence floor). `generateHookExperiment` uses `aiRouter` then falls back to
  deterministic angle templates (never fabricated metrics).
  `POST /api/productive/ab-testing/hook-experiment` (+ `/evaluate`).
- **AI B-roll text-to-video** (`textToVideoService`): flag-gated Replicate
  provider; PURE `buildProviderRequest` + `parseProviderResponse`; honest
  `status:'unavailable'` when `TTV_PROVIDER`/key/model unset — **never a fake URL**.
  `magicBRollFill` now delegates to it. Multi-language dubbing
  (`aiGenerativeDubbingService`, ElevenLabs) was already provider-wired with an
  honest `not_configured` fallback — left intact.

## Phase E — Verification

Final double-run (this increment):

| Gate | Result |
|------|--------|
| `test:unit` ×2 | 559 passed, 21 skipped, **0 failed** (89 suites) |
| `test:fidelity` ×2 | 13 passed |
| `smoke:full` ×2 | passed |
| `eslint server/` | **0 errors** (warnings pre-existing, none from new files) |
| client `tsc --noEmit` | **0 errors** |
| module load smoke | all new services/routes require cleanly |

New unit tests added this roadmap: buildClipPlan (5), autopilot planner + E2E
gate (6), tier enforcement (5), approval collaboration (5), calendar capacity
(5), scheduled-report recurrence (8), trend-jacking (5), hook experiment (6),
text-to-video (9).

## Feature flags / provider keys (honest fallbacks)

- `TTV_PROVIDER=replicate` + `REPLICATE_API_TOKEN` + `TTV_MODEL_VERSION` — AI B-roll.
- `ELEVENLABS_API_KEY` — multi-language dubbing.
- `AGENT_AUTORUN` / `AGENT_AUTOPUBLISH` — hands-off content agent (default OFF).
- Per-workspace `autonomyMode` (`human_approve` | `full_auto`) +
  `cronLock.autonomousModeEnabled` master kill-switch.

Without a key/flag, each feature returns an honest "unavailable" state rather
than failing or fabricating output.
