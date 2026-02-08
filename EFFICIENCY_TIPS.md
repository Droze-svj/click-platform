# Efficiency Tips — Implemented & Ready to Use

All recommended optimizations for the Click platform.

---

## ⌨️ Keyboard Shortcuts (Cursor/VS Code)

| Shortcut | Action |
|----------|--------|
| `Cmd + Shift + B` | Run default build task (starts full dev stack) |
| `Cmd + Shift + P` → "Tasks: Run Task" | Run any task (sync, lint, test) |
| `Cmd + P` | Quick file open |
| `Cmd + Shift + F` | Search in files (excludes node_modules) |
| `Cmd + B` | Toggle sidebar |
| `Ctrl + `` ` | Toggle terminal |

**Add custom shortcut** (optional): `Cmd + K, Cmd + S` → search "Tasks: Run Task" → assign `Cmd + Shift + D`

---

## 📋 Tasks (Cmd + Shift + P → "Tasks: Run Task")

- **Dev: Start full stack** — Starts server + client (default build)
- **Sync: Push to GitHub** — Runs sync script
- **Sync: Pull latest** — git pull
- **Open: ROADMAP_STATUS** — Opens roadmap tracker
- **Test: Run unit** — Unit tests
- **Test: Run critical E2E** — Critical flow tests
- **Lint: Fix all** — Auto-fix ESLint

---

## 📦 Quick NPM Scripts

```bash
npm run dev          # Start everything
npm run sync         # Push to GitHub
npm run sync:pull    # Pull latest
npm run roadmap      # Open ROADMAP_STATUS (Mac)
npm run assign       # List assignments (pick # to assign)
npm run assign 1     # Generate ASSIGNMENT_READY.md for #1
npm run verify:phase0   # Verify MongoDB + Redis + API
```

---

## ⚙️ What's Configured

### Format on Save

- Automatically formats code when you save
- ESLint auto-fix on save
- Trailing whitespace trimmed

### Search Exclusions

- node_modules, .next, coverage, dist excluded from search
- Faster search results

### File Watcher Exclusions

- Less CPU usage, fewer reindexes
- node_modules, .next not watched

### Git

- Auto-fetch enabled
- Smart commit (stages all when committing)
- Branch protection reminder for main

### Editor

- Sticky scroll (headers stay visible)
- Inline suggestions
- Bracket pair colorization
- Tab size: 2, spaces

---

## 🔌 Recommended Extensions (Install When Prompted)

- **ESLint** — Linting
- **Prettier** — Formatting
- **Tailwind CSS IntelliSense** — Class autocomplete
- **GitHub Pull Requests and Issues** — PR review in IDE
- **GitLens** — Git blame, history
- **Error Lens** — Inline error display
- **Path Intellisense** — Path autocomplete

---

## 📁 Keep These Open

1. **ROADMAP_STATUS.md** — Pin the tab for visibility
2. **Terminal** — Split pane for quick commands
3. **Source Control** — See branch, changes, PRs

---

## 🔄 Daily Workflow

1. `npm run sync:pull` or Task: Sync Pull
2. Open ROADMAP_STATUS.md
3. Run `npm run dev` (or Cmd+Shift+B)
4. When done: `npm run sync` or Task: Sync Push

---

## ✅ EditorConfig

Consistent style across collaborators: 2 spaces, LF line endings, trim trailing whitespace. Works in VS Code, Cursor, and most editors.
