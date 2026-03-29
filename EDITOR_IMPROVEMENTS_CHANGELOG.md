# Editor improvements changelog

Summary of video editor and timeline improvements for use in a feature branch or PR.

## Workflow & navigation

- **Workflow strip** — Edit → Color → Effects → Timeline → Export with one-click jump; current step highlighted.
- **Alt+1–5** — Keyboard shortcuts to jump to Edit, Color, Effects, Timeline, Export (when not in an input).
- **Scroll to top** — Content panel scrolls to top when switching section (smooth or instant when reduced motion).
- **Header section label** — Shows current section next to project name (e.g. "Untitled Project · Timeline").
- **Visited steps** — Workflow strip shows a dot for sections you’ve already opened this session.
- **Next-step links** — Edit: "Next: Timeline" / "Next: Export"; Timeline: "Next: Export"; Export: "Back to: Edit" / "Back to: Timeline".

## Timeline

- **Multi-select** — Shift+click segments to add/remove from selection; click without Shift sets single selection.
- **"N selected" bar** — When 2+ segments selected: Clear, Delete all, Duplicate all.
- **Ripple delete** — Toolbar toggle "Ripple On/Off"; when On, deleting segments closes the gap (shifts following content left).
- **Zoom to multi-selection** — Zoom to selection fits the range of all selected segments when multiple are selected.
- **Markers** — Add at playhead (M); optional name via prompt; persisted with project; violet dots on ruler; names shown when zoom ≥ 1.5x; right-click to remove.
- **In/Out points** — Set In/Out at playhead (I/O); Go In / Go Out; green/red markers on ruler.
- **Trim to playhead** — Trim start/end of selected segment to playhead (toolbar + context menu).
- **Split at playhead** — S or toolbar when playhead is inside a segment.
- **Duplicate** — Ctrl+D or context menu; multi-selection duplicates all selected.
- **Nudge** — Alt+←/→ moves selected segment(s) by step amount.
- **Context menu** — Right-click segment: Split at playhead, Trim start/end to playhead, Duplicate, Delete.
- **Persistence** — Zoom and snap on/off restored from localStorage; markers in project autosave.

## UX & polish

- **Keyboard overlay** — "?" opens panel with Workflow (Alt+1–5), Timeline (J/K/L, S, M, etc.), Navigation, Editing, Layout.
- **Timeline hint** — Dismissible bar when on Timeline: "J/K/L jog · S split · M marker · Alt+4 jump here"; **Settings → Show timeline shortcuts hint again** to re-enable.
- **Error boundaries** — Content panel, preview, and timeline each wrapped in ErrorBoundary with retry.
- **Reduce motion** — Section transitions and timeline hint respect `prefers-reduced-motion`; sidebar pulse uses `motion-safe:animate-pulse`.

## Suggested next steps (backlog)

- Undo/redo for timeline (segment/marker changes in history).
- Throttle timeline `onTimeUpdate` during scrub for heavy previews.
- Virtualize segment list in AdvancedTimelineView for very long timelines.
- E2E test: open editor → Alt+4 → add marker → workflow strip click.

---

**Branch suggestion:** `feat/editor-workflow-timeline` or similar. Update ROADMAP_STATUS.md when merging.
