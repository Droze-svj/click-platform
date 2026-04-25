# Legacy docs archive

This directory holds 400+ markdown files that previously lived at the repo root —
session notes, planning docs, `*_COMPLETE.md` artifacts, setup guides, and
similar. They were archived (not deleted) on 2026-04-25 to make the repo root
navigable again.

## Why archive instead of delete

- Some files may contain unique context or decisions that aren't captured in code.
- Git history alone isn't enough: searching by filename is easier when the files
  still exist on disk in one predictable place.
- Reversal is one `mv` command away.

## Restoring a file

```sh
mv .archive/legacy-docs/SOME_FILE.md .
```

## What was kept at root

- `CLAUDE.md` — project instructions for Claude Code
- `README.md` — public repo readme
- `.aider.instructions.md` — aider tool config

Everything else was moved here.

## Recommendation

Before un-archiving any file, ask: is this still true? Most of these were
written during scope-explosion phases and describe features that either
shipped, never shipped, or shipped differently. Trust the code, not these docs.
