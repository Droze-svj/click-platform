# macOS Finder duplicate cleanup list

`git status` shows ~1,564 untracked files matching macOS-Finder duplicate patterns (`* 2.tsx`, `* 3.json`, `_stray_node_modules-*`, etc.). They were called out in PR #4's body as not staged. None of them are tracked by git, so they don't ship — but they pollute IDE search, slow down `find`, and confuse `git status`.

## What the list contains

- **864 files** matching `* 2.<ext>` — Finder's first-level duplicates.
- **699 files** matching `* 3.<ext>` — Finder's second-level duplicates.
- **1 directory** matching `_stray_node_modules-*`.
- A handful of `.archive/` and similar paths that are *deliberate* — review carefully.

## How to review + delete

This is destructive. Run these in order:

```bash
# 1. Generate fresh list from current working tree (this list may be
#    stale after subsequent file activity).
git ls-files --others --exclude-standard \
  | grep -E ' [0-9]+\.(tsx|ts|jsx|js|json|md|lock|yaml|yml|sh|css)$|_stray_node_modules|^uploads 2|_backup|^_trashed' \
  > /tmp/dup-list.txt
wc -l /tmp/dup-list.txt

# 2. Eyeball the first 100 entries to make sure nothing important is
#    in there. Most of these are clearly "<filename> 2.<ext>" patterns.
head -100 /tmp/dup-list.txt
sed -n '500,520p' /tmp/dup-list.txt
sed -n '1500,1564p' /tmp/dup-list.txt

# 3. (Optional, recommended) keep a backup tarball before deleting.
tar -czf ~/click-macos-dups-backup-$(date +%F).tar.gz -T /tmp/dup-list.txt 2>/dev/null

# 4. Delete from disk. These files are untracked, so `rm` (not `git rm`)
#    is the right tool.
xargs -d '\n' rm -rfv < /tmp/dup-list.txt
```

> Why `rm -rf` not `git rm`: every entry on the list is **untracked**, so git has no record of it. `git rm` would error.

## Specific patterns that are NOT junk

When you eyeball the list, leave these alone if they show up:

- `.env.production`, `.env.staging` (no trailing " 2") — real config.
- `client/.env.local` — your dev environment.
- Anything under `node_modules/` — already gitignored anyway, won't be in the list.
- `.archive/*` paths might be intentional archives. Spot-check before mass-delete.

## After deleting

```bash
git status -s | grep -c "^??"
# Should drop from ~2,128 to a much smaller number (just the .archive
# entries and any genuinely-untracked WIP).
```

Generated 2026-04-28. Will be stale within a few editor sessions; regenerate before running.
