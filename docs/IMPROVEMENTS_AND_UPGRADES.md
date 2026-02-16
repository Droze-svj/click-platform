# Improvements & Upgrades — Prioritized List

A single reference for what to fix, upgrade, or build next. Sourced from ROADMAP_STATUS, CLICK_NEXT_ACTIONS, edit verification, and codebase TODOs.

**Recently implemented:** Route-aware timeouts, LinkedIn token refresh, .env Cloudinary, requestTimeout unit tests, DB_INDEXES.md, PHASES_IMPLEMENTATION_SUMMARY.md. See [docs/PHASES_IMPLEMENTATION_SUMMARY.md](./PHASES_IMPLEMENTATION_SUMMARY.md).

---

## Phase 0: Blockers (Do First — ~30 min)

| Item | Why | Action |
|------|-----|--------|
| **MongoDB Atlas IP whitelist** | DB rejects connections from Render | Atlas → Network Access → Add `0.0.0.0/0` |
| **Redis URL in Render** | Workers use localhost instead of Redis Cloud | Render → Env → Set `REDIS_URL` (from Redis Cloud) |

**Verify:** `npm run verify:phase0` (local) or `BASE_URL=<your-api> npm run verify:phase0` (production).
**Guide:** [PHASE_0_FIX_GUIDE.md](../PHASE_0_FIX_GUIDE.md)

**Optional:** If the project is on iCloud Drive and you see ETIMEDOUT, move the project to a local folder (see PHASE_0_FIX_GUIDE §4).

---

## Phase 1: Core Working (1–2 weeks)

| # | Item | Effort | Impact | Notes |
|---|------|--------|--------|-------|
| 1 | **Testing & QA** | 3–5 days | Critical | Unit (auth, content, video), integration, E2E critical flows. `npm run assign 5` |
| 2 | **OAuth token refresh** | 2 days | Core | Twitter, LinkedIn, Facebook/Instagram refresh + error handling. Can't post without it. `npm run assign 6` |
| 3 | **Cloud storage (S3/Cloudinary)** | 2–3 days | Production | Replace local uploads for scale. `npm run assign 7` |
| 4 | **Request timeout middleware** | 1 day | UX | Stop hanging requests; add server-side timeout. |
| 5 | **File upload progress** | 2 days | UX | Real-time progress and cancellation for large uploads. |

---

## Edit & Editor Section

### Already verified/fixed

- Edit page: analysis error feedback, progress result shape, sync/async completion, failed progress → error UI.
- VideoProgressTracker: `jobId` in deps, normalized `onComplete`.

### Remaining / optional

| Item | Priority | Notes |
|------|----------|--------|
| **Download from cross-origin URL** | Low | "Download" may open in browser for cross-origin edited video. Fix: blob fetch + download link or document behavior. |
| **Progress API for async auto-edit** | When you add async | Ensure progress API returns `editedVideoUrl` / `editsApplied` on `completed` and `message`/`error` on `failed`. |
| **Video render pipeline** | High for editor value | ExportView is UI only; no API sends full editor state to FFmpeg. See [docs/RENDER_PIPELINE_IMPLEMENTATION.md](./RENDER_PIPELINE_IMPLEMENTATION.md) for phases (filters + text overlays → segments → LUT, etc.). |
| **Save edited captions API** | Medium | `VideoCaptionEditor.tsx` has a TODO: implement save edited captions API call. |

---

## Known code TODOs / stubs

| Location | Item | Notes |
|----------|------|--------|
| `server/routes/oauth-new.js` | Other platforms | "Add other platforms when implemented"; LinkedIn/Facebook/Instagram flags set to false. |
| `server/routes/posts.js` | Scheduling | "Implement scheduling logic" and "Implement actual scheduling logic (queue job, etc.)". |
| `server/services/tokenRefreshService.js` | LinkedIn refresh | "LinkedIn token refresh not implemented yet". |
| `server/services/contentPerformancePredictionService.js` | Prediction | Stub when not fully implemented. |
| `server/services/contentGenerationService.js` | Content gen | Stub for crossClientTemplateService / gapFillingService. |
| `server/services/reportBuilderService.js` | Performance metrics | getPerformanceMetrics service not created. |
| `server/services/musicComplianceReportService.js` | PDF | "PDF generation not implemented". |
| `server/services/freeAIModelKeyManager.js` / `freeAIModelService.js` | Provider support | Key validation / provider not implemented for some providers. |
| `server/services/modelVersionManager.js` | Upgrade check | "Upgrade check not implemented for provider". |

---

## Phase 2: Optimum performance (2–3 weeks)

| Item | Effort | Impact |
|------|--------|--------|
| Background job queue (Bull/BullMQ) | 3–5 days | Video processing, retries, non-blocking |
| Content approval workflows | 2–3 days | Multi-stage approval, routing, notifications |
| Content recycling / auto-repost | 1 week | High performers, evergreen, repost rules |
| Advanced search (AI, filters, saved) | 3–4 days | Productivity |
| Video transcripts (e.g. Whisper) | 1–2 days | Core feature |
| DB query optimization | 2–3 days | Indexes, slow query fix |
| Monitoring & alerts (Sentry, APM) | 3–5 days | Observability |

---

## Phase 3: Best-in-class (3–4 weeks)

- Content performance benchmarking
- Automated content curation (AI)
- Advanced audience insights
- Content compliance & brand safety
- Multi-language content
- Advanced scheduling (recurring, conflict detection)

---

## Quick reference

- **Roadmap status:** [ROADMAP_STATUS.md](../ROADMAP_STATUS.md)
- **Next actions (phases):** [CLICK_NEXT_ACTIONS.md](../CLICK_NEXT_ACTIONS.md)
- **Full improvement list:** [COMPREHENSIVE_IMPROVEMENT_ROADMAP.md](../COMPREHENSIVE_IMPROVEMENT_ROADMAP.md)
- **Edit verification:** [EDIT_SECTION_VERIFICATION.md](./EDIT_SECTION_VERIFICATION.md)
- **Render pipeline (editor → FFmpeg):** [RENDER_PIPELINE_IMPLEMENTATION.md](./RENDER_PIPELINE_IMPLEMENTATION.md)

**Commands:**
`npm run assign` — list assignments
`npm run assign 5` — Testing
`npm run assign 6` — OAuth refresh
`npm run verify:phase0` — Verify Phase 0
