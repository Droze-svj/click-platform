# Assignment Workflow — Autonomous & Fixed Templates

**3 steps only.** Use the assign script for copy-paste ready content.

---

## Quick Assign (Autonomous)

```bash
# 1. List available assignments
npm run assign

# 2. Pick one (e.g. #1) → generates ASSIGNMENT_READY.md
npm run assign 1

# 3. Open ASSIGNMENT_READY.md → follow 3 steps (copy-paste)
```

---

## The 3 Steps

| Step | What you do | Time |
|------|-------------|------|
| **1** | Create GitHub issue — copy title + body from ASSIGNMENT_READY.md → assign collaborator → submit | 1 min |
| **2** | Add row to ROADMAP_STATUS.md (Next Up) — copy from ASSIGNMENT_READY.md, replace XX with issue # | 30 sec |
| **3** | Send message to collaborator — copy from ASSIGNMENT_READY.md, replace XX with issue # | 30 sec |

**Done.** No decisions, no typing from scratch.

---

## Fixed Templates

### Assignments Bank

Pre-defined items in `scripts/assignments-bank.json`:

- 10 ready-to-assign items from your roadmaps
- Each has: title, tasks, files, effort, branch name
- Run `npm run assign` to see the list
- Run `npm run assign 3` to generate assignment #3

### Generated Output (ASSIGNMENT_READY.md)

Each run creates:

1. **GitHub issue body** — Copy-paste ready, fixed structure
2. **ROADMAP_STATUS row** — Ready for Next Up table
3. **Collaborator message** — Ready to send (Slack, Live Share, etc.)

---

## Full Flow (After Quick Assign)

| When | Action |
|------|--------|
| **Collaborator starts** | Move item from Next Up → In Progress in ROADMAP_STATUS |
| **Collaborator opens PR** | Move item from In Progress → In Review, add PR link |
| **You merge** | Move item from In Review → Recently Completed |
| **Both** | `git pull origin main` |

---

## Adding New Assignments to the Bank

Edit `scripts/assignments-bank.json`:

```json
{
  "id": 11,
  "title": "Your New Feature",
  "effort": "2 days",
  "source": "COMPREHENSIVE_IMPROVEMENT_ROADMAP.md",
  "section": "Section name",
  "tasks": ["Task 1", "Task 2", "Task 3"],
  "files": ["server/routes/xxx.js", "client/components/xxx.tsx"],
  "branch": "feature/your-feature"
}
```

Then run `npm run assign 11`.

---

## Commands

| Command | Action |
|---------|--------|
| `npm run assign` | List all assignments |
| `npm run assign 1` | Generate ASSIGNMENT_READY.md for assignment #1 |
| `npm run roadmap` | Open ROADMAP_STATUS.md |

---

## Links

- **Assignments Bank** — `scripts/assignments-bank.json`
- **ROADMAP_STATUS** — [ROADMAP_STATUS.md](./ROADMAP_STATUS.md)
- **Create Issue** — <https://github.com/Droze-svj/click-platform/issues/new>
