# Roadmap Workflow Guide — Test → Work → Review → Next Stage

A setup for roadmap-driven collaboration where you control what gets merged.

---

## Overview

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  ROADMAP    │───►│  Collaborator│───►│  You Review │───►│  Next Stage │
│  (Next Up)  │    │  Works on   │    │  & Approve  │    │  in IDE     │
│             │    │  Copy of    │    │  (PR)       │    │             │
│             │    │  Latest     │    │             │    │             │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

---

## Step 1: VS Code / Cursor Setup (See Everything in IDE)

### Install extensions

1. Open Extensions: `Cmd + Shift + X` (Mac) or `Ctrl + Shift + X` (Windows)
2. Install:
   - **GitHub Pull Requests and Issues** (Microsoft)
   - **GitHub** (optional, for Projects)

### What you get

- **Source Control panel** — See branches, PRs
- **GitHub** icon in sidebar — Issues, PRs, your reviews
- **"Pull Requests"** — PRs needing your review
- **ROADMAP_STATUS.md** — Keep open in a tab for next stages

### Pin ROADMAP_STATUS.md

1. Open `ROADMAP_STATUS.md`
2. Right-click tab → **Pin Tab** (or keep it in a split pane)

You can always see what’s next and what’s in review.

---

## Step 2: GitHub Project (Optional Kanban Board)

1. Go to: <https://github.com/orgs/Droze-svj/projects> (or repo **Projects**)
2. **New project** → **Board**
3. Name: `Click Roadmap`
4. Add columns:
   - **📋 Backlog** — Future items
   - **🔜 Next Up** — Ready for collaborator
   - **🔄 In Progress** — Being worked on
   - **👀 In Review** — PR open, awaiting your approval
   - **✅ Done** — Merged

5. Create **Project** from **Issues** and drag items between columns

---

## Assignment Workflow (Step 1 + 2 Combined)

**See [ASSIGNMENT_WORKFLOW.md](./ASSIGNMENT_WORKFLOW.md)** for the full host workflow:

- Add to ROADMAP_STATUS (Next Up)
- Create GitHub Issue with **Roadmap task** template
- Assign collaborator
- Link Issue # in ROADMAP_STATUS

---

## Step 3: Turn Roadmap Items Into Issues

For each item from your roadmaps:

1. Go to: <https://github.com/Droze-svj/click-platform/issues>
2. **New issue**
3. Title: e.g. `[Roadmap] Advanced Content Approval Workflows`
4. Body: Copy description from `COMPREHENSIVE_IMPROVEMENT_ROADMAP.md` or `NEXT_STEPS_PRIORITIZED.md`
5. Labels (optional): `roadmap`, `priority: high`, `phase: 1`
6. Create issue

---

## Step 4: Workflow (Collaborator + You)

### A. You assign work

1. Choose item from **ROADMAP_STATUS.md** → “Next Up” or from GitHub Issues
2. Share with collaborator (Live Share, Slack, etc.)
3. In **ROADMAP_STATUS.md**: move item to “In Progress”
4. Collaborator pulls latest: `git pull origin main`

### B. Collaborator works

1. `git checkout -b feature/short-description` (e.g. `feature/content-approval`)
2. Implement based on issue/roadmap
3. `git add -A` → `git commit -m "..."` → `git push origin feature/short-description`
4. Open PR on GitHub, link the issue: `Closes #123`

### C. You review

1. In Cursor: GitHub icon → **Pull Requests** (or open PR on GitHub)
2. Review **Files changed**
3. Optional: leave comments
4. **Approve** or **Request changes**
5. If approved: **Merge pull request**
6. Update **ROADMAP_STATUS.md**:
   - Remove from “In Review”
   - Add to “Recently Completed”
   - Add next item to “Next Up”

### D. Both sync

```bash
git checkout main
git pull origin main
```

---

## Step 5: Analyze Progress

### Weekly review

1. Open **ROADMAP_STATUS.md** and “Recently Completed”
2. Count: items merged this week
3. Identify: blockers, slow items, repriorities
4. Update “Next focus” and “Next Up”

### GitHub Insights (optional)

- <https://github.com/Droze-svj/click-platform/pulse>
  - Merged PRs, closed issues

---

## Quick Reference

| Task | Where | Action |
|------|-------|--------|
| See next stages | Cursor tab | Open **ROADMAP_STATUS.md** |
| See PRs to review | Cursor | GitHub → Pull Requests |
| Assign work | ROADMAP_STATUS.md or Issues | Update “Next Up” / create issue |
| Track progress | ROADMAP_STATUS.md | Update sections after each merge |
| Source details | Project root | COMPREHENSIVE_IMPROVEMENT_ROADMAP.md, etc. |

---

## More Efficiency Tips

See **[EFFICIENCY_TIPS.md](./EFFICIENCY_TIPS.md)** for:

- Keyboard shortcuts, tasks, npm scripts
- Format on save, search exclusions
- Recommended extensions

---

## Tips for This Workflow

1. **Pin ROADMAP_STATUS.md** — Always visible in Cursor
2. **One item per PR** — Easier to review and track
3. **Link PR to Issue** — Use `Closes #N` for traceability
4. **Short review cycles** — Review often instead of in big batches
5. **Update status right after merge** — Keeps ROADMAP_STATUS.md accurate
