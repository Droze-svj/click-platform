# Collaboration Guide - Click Platform

Sync your project with GitHub and work simultaneously with your team.

## Quick Sync (First Time)

Run this to push all your local work to GitHub:

```bash
./sync-to-github.sh
```

Or manually:

```bash
git fetch origin
git add -A
git commit -m "Sync: Full project update"
git push origin main
```

## Daily Workflow

### Before you start working
```bash
git pull origin main
```

### When you finish a feature
```bash
git add -A
git commit -m "Descriptive message of what you changed"
git push origin main
```

## Working with Branches (Recommended for Teams)

### Create a feature branch
```bash
git checkout -b feature/my-feature-name
# Make changes...
git add -A
git commit -m "Add my feature"
git push origin feature/my-feature-name
```

### Merge back to main (after review)
```bash
git checkout main
git pull origin main
git merge feature/my-feature-name
git push origin main
```

## Conflict Resolution

If `git pull` shows conflicts:

1. Open the conflicted files (marked with `<<<<<<<`, `=======`, `>>>>>>>`)
2. Resolve the conflicts manually
3. Run: `git add .` then `git commit -m "Resolve merge conflicts"`

## Repository Info

- **URL**: https://github.com/Droze-svj/click-platform
- **Branch**: main

## Tips for Simultaneous Work

1. **Pull often** - Run `git pull` before starting and whenever you switch tasks
2. **Commit small** - Smaller, focused commits reduce merge conflicts
3. **Use branches** - Keep `main` stable; develop features in branches
4. **Communication** - Coordinate with collaborators on who edits which files
