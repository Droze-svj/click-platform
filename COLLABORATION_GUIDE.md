# Collaboration Guide - Click Platform

A protected workflow where **you review and approve all changes** before they go to GitHub.

---

## Step 1: Set Up GitHub Branch Protection (One-Time)

Go to: **https://github.com/Droze-svj/click-platform/settings/branches**

1. Click **Add branch protection rule**
2. Branch name pattern: `main`
3. Check these options:
   - ✅ **Require a pull request before merging**
   - ✅ **Require approvals** → Set to `1`
   - ✅ **Dismiss stale pull request approvals when new commits are pushed**
4. Click **Create** or **Save changes**

Now no one (including collaborators) can push directly to `main`. All changes must go through a Pull Request that **you approve**.

---

## Step 2: Start a Cursor Live Share Session

### You (the owner) start the session:

1. Open Cursor
2. Press `Cmd + Shift + P` (Mac) or `Ctrl + Shift + P` (Windows)
3. Type: **Live Share: Start collaboration session**
4. Copy the session link
5. Send the link to your collaborator

### Collaborator joins:

1. Open Cursor
2. Press `Cmd + Shift + P`
3. Type: **Live Share: Join collaboration session**
4. Paste your link

Now you're both editing the same workspace in real-time.

---

## Step 3: The Protected Workflow

### When collaborator wants to make changes:

```bash
# 1. Create a feature branch (NOT main)
git checkout -b feature/collaborator-changes

# 2. Make their changes...

# 3. Commit changes
git add -A
git commit -m "Add feature X"

# 4. Push to GitHub (creates branch, not touching main)
git push origin feature/collaborator-changes
```

### Then collaborator creates a Pull Request:

1. Go to: https://github.com/Droze-svj/click-platform
2. Click **Compare & pull request** (appears after pushing)
3. Add a description of changes
4. Click **Create pull request**

### You (owner) review and approve:

1. Go to the Pull Request on GitHub
2. Click **Files changed** — review every change
3. If approved: Click **Review changes** → **Approve** → **Submit review**
4. Click **Merge pull request** → **Confirm merge**

Only after YOUR approval do changes go to `main`.

---

## Step 4: Sync After Merge

After you merge a PR, both of you run:

```bash
git checkout main
git pull origin main
```

---

## Quick Reference

| Who | Action | Command |
|-----|--------|---------|
| **Collaborator** | Create branch | `git checkout -b feature/name` |
| **Collaborator** | Push branch | `git push origin feature/name` |
| **Collaborator** | Create PR | On GitHub website |
| **You** | Review PR | On GitHub → Pull Requests |
| **You** | Approve & Merge | Click Merge after review |
| **Both** | Sync after merge | `git pull origin main` |

---

## Live Share Tips

- **Follow mode**: Click collaborator's name to follow their cursor
- **Shared terminal**: Both can run commands
- **Audio call**: Built-in voice chat in Live Share
- **Read-only guests**: You can set collaborators to view-only if needed

---

## Repository

- **URL**: https://github.com/Droze-svj/click-platform
- **Protected branch**: `main` (requires your approval)

---

## Summary

```
┌─────────────────────────────────────────────────────────┐
│  Collaborator makes changes on feature branch           │
│                        ↓                                │
│  Collaborator pushes branch & creates Pull Request      │
│                        ↓                                │
│  YOU review the changes on GitHub                       │
│                        ↓                                │
│  YOU approve and merge (or request changes)             │
│                        ↓                                │
│  Changes go to main — GitHub updated safely             │
└─────────────────────────────────────────────────────────┘
```

No overwrites. No corruption. You control what goes to `main`.
