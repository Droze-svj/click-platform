# 📋 Roadmap Status — Keep Open in Cursor

> **Single source of truth** for what's next. Update after each review.
>
> **Assigning work?** → Run \`npm run assign\` → pick # → follow ASSIGNMENT_READY.md

---

## 🔴 In Review (Awaiting Your Approval)

| Item | PR Link | Branch | Last Updated |
|------|---------|--------|--------------|
| *None* | — | — | — |

---

## 🟡 Next Up (Ready for Collaborator)

| # | Item | Issue | Effort | Notes |
|---|------|-------|--------|-------|
| 1 | Fix MongoDB/Redis (Phase 0) | — | 30 min | See [PHASE_0_FIX_GUIDE.md](./PHASE_0_FIX_GUIDE.md). Local Phase 0 verified ✅ |
| 2 | Testing & QA | `npm run assign 5` | 3–5 days | Unit, integration, E2E. See [PHASE1_KICKOFF.md](./PHASE1_KICKOFF.md) |
| 3 | OAuth Token Refresh | `npm run assign 6` | 2 days | Core posting fix. See [docs/PHASE1_OAUTH_CONTEXT.md](./docs/PHASE1_OAUTH_CONTEXT.md) |
| 4 | Cloud Storage (S3/Cloudinary) | `npm run assign 7` | 2–3 days | Production scale. See [docs/PHASE1_CLOUD_STORAGE_CONTEXT.md](./docs/PHASE1_CLOUD_STORAGE_CONTEXT.md) |

---

## 🟢 In Progress (Collaborator Working)

| Item | Branch | Started | Expected |
|------|--------|---------|----------|
| *None* | — | — | — |

---

## ✅ Recently Completed

| Item | Merged | Notes |
|------|--------|-------|
| Server bug-fix pass (42 real bugs) | `production-release-stable` (879d78c0) | 30 no-undef, 8 no-unreachable, dup keys, parse errors in scheduler, etc. All non-OAuth. |
| Server lint config tightening | `production-release-stable` (879d78c0) | Rule overrides in server/.eslintrc.js; down to 1 remaining error (OAuth). |
| Repo hygiene | `production-release-stable` | Removed stray `layout.tsx:`; renamed `node_modules_slow`/`.node_modules_backup` etc. → `_stray_*`; expanded .gitignore for pid/log/tsbuildinfo/ffmpeg/playwright artifacts. |
| Deployment fix | `production-release-stable` | Track `pnpm-workspace.yaml` — was untracked but required for Render pnpm install. |
| Request Timeout Middleware | — | Already in server (route-aware 30s/5m/10m). |
| Content & edit UX (sharpening, visual polish, Brand kit, premium audio, platform-native, AI-assistant) | **merged to main** (df3ff91) | Guides + UI, Phase 1 kickoff, PR description. |

---

## 📊 Progress Snapshot

- **This week:** Server bug-fix pass complete (42 real errors → 0 non-OAuth errors). Repo hygiene + deployment fix landed.
- **Next focus:** OAuth Token Refresh (`twitterOAuthService.refreshAccessToken` undefined at server/services/twitterOAuthService.js:219) is the only real-bug blocker left. Then Phase 1 Testing & QA, Cloud Storage.
- **Follow-up actions needed from owner:** (1) Client `node_modules` reinstall — `rm node_modules && pnpm install` from root (the symlink to `node_modules_slow` has truncated/corrupt files). (2) Review `.env.production` / `.env.nosync` for real secrets that shouldn't be tracked and rotate if so.

---

## 📚 Detailed Roadmaps

- **[CLICK_NEXT_ACTIONS.md](./CLICK_NEXT_ACTIONS.md)** — Start here: prioritized phases for Click at its best
- [COMPREHENSIVE_IMPROVEMENT_ROADMAP.md](./COMPREHENSIVE_IMPROVEMENT_ROADMAP.md) — Full improvement list
- [NEXT_STEPS_PRIORITIZED.md](./NEXT_STEPS_PRIORITIZED.md) — Phase-by-phase actions

---

## 🔄 How to Update This File

**Assigning work:** See [ASSIGNMENT_WORKFLOW.md](./ASSIGNMENT_WORKFLOW.md) — add to Next Up → create Issue → assign

**When collaborator starts:** Move item from "Next Up" → "In Progress"

**When collaborator opens PR:** Move item from "In Progress" → "In Review"

**After you approve a PR:** Move item from "In Review" → "Recently Completed"
