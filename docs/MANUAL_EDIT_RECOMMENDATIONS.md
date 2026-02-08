# Manual Edit Section – Recommendations

Recommendations for improving the **Manual Edit** experience (BasicEditorView + related flows) in the video editor.

---

## 1. **UX & Information Architecture**

### 1.1 Clear section identity

- **Add a short intro** at the top of the Manual Edit panel: e.g. “Layout, text, and quick looks. Use the sidebar for timeline, effects, and color.”
- **Rename or clarify** “Canvas layout” → “Aspect ratio & export format” so it’s obvious this affects output format.

### 1.2 Reorder for common workflows

- Put **Canvas layout** first (already there).
- Then **Platform presets** (TikTok, YouTube, etc.) so users pick format early.
- Then **Style bundles** for full look.
- Then **Quick filters** for color only.
- Then **Text overlays**.
- **Quick nav** can stay as a sticky or collapsible “Jump to” so power users don’t scroll.

### 1.3 Reduce cognitive load

- **Collapsible sections** (e.g. “Style bundles”, “Quick filters”) with “Expand all / Collapse all” so the page isn’t overwhelming.
- **“Recently used”** for filters and style bundles (e.g. last 3–5), so repeat actions are one click.

---

## 2. **Text Overlays**

### 2.1 Timing in Manual Edit

- Text presets currently use fixed `startTime: 0`, `endTime: 5`. Either:
  - **Pass `videoState.currentTime`** into BasicEditorView and set new overlays to start at playhead and end at e.g. `currentTime + 5`, or
  - Add a small **“Duration (seconds)”** input (e.g. 3 / 5 / 10 / full) when adding from Manual Edit.
- **Hint under “Add”**: e.g. “Tip: Set in/out on the Timeline tab.”

### 2.2 Preset discovery

- **Search or filter** text presets (e.g. by “title”, “CTA”, “lower third”).
- **Preview on hover**: show a tiny preview of the preset (text + style) in a tooltip or popover.

### 2.3 Custom text defaults

- **Remember last custom text** (e.g. in `localStorage`) so “Add” without typing adds the previous line again if desired.
- **Font picker** in Manual Edit (or a link to Properties Panel) so users know they can change font per overlay.

---

## 3. **Filters & Styles**

### 3.1 Before/after

- **Before/after toggle** (or split view) for the current frame so users can compare “No filter” vs “Current filter” without removing it.
- If RealTimeVideoPreview already supports a “compare” mode, expose it from Manual Edit (e.g. “Compare” next to Quick filters).

### 3.2 Strength slider

- **Global “Filter strength”** (0–100%) that scales the active quick filter so users can do “Vibrant at 50%” without opening Color tab.
- Could live above or below the Quick filters grid.

### 3.3 Style bundles

- **Preview thumbnail**: small frame preview per style bundle (could be a static gradient or a real frame from the video).
- **“Save my style”**: let users save current layout + filter as a custom bundle (name + optional thumbnail) and list it under Style bundles.

---

## 4. **Platform Presets**

### 4.1 More context

- **Short description** per platform (e.g. “9:16, best for Reels & TikTok”) – you have `desc`; ensure it’s visible.
- **Optional “Copy link” or “Export for [platform]”** that sets layout + filter and optionally opens Export with a platform-specific preset.

### 4.2 Safe area hint

- For vertical/portrait, a small **“Thumb-safe zone”** note or graphic so users know where to avoid critical text/graphics.

---

## 5. **Cross-linking & Consistency**

### 5.1 Link to Timeline & Effects

- In Manual Edit, **explicit links**: “Add this text with timing on the **Timeline**” and “More effects (fades, motion) in **Effects**.”
- Same in reverse: in Effects/Timeline, “Change layout & quick look in **Manual Edit**.”

### 5.2 One source of truth for “current look”

- Ensure **Style bundles** and **Color** tab don’t fight: e.g. applying a style bundle updates the same `videoFilters` that Color grading uses, and vice versa. Document or enforce “last applied wins” or “merge” so behavior is predictable.

---

## 6. **Performance & Polish**

### 6.1 Preset application

- When applying a **filter or style bundle**, avoid full-page re-renders: ensure only the preview and filter state update (e.g. state in ModernVideoEditor, not unnecessary parent re-renders).
- **Debounce** rapid preset clicks if you ever add analytics or heavy logic on apply.

### 6.2 Keyboard & a11y

- **Keyboard shortcuts** for “Add text”, “Reset filter”, “Next/previous layout” (and document in Keyboard Shortcuts help).
- **Focus management**: after “Add” text, focus the new overlay in the list or the preview so keyboard users know where they are.
- **ARIA labels** for “Canvas layout”, “Style bundles”, “Quick filters” (e.g. `aria-label` or `role="group"` + `aria-labelledby`).

---

## 7. **Quick Wins (high impact, low effort)**

| Priority | Action |
|----------|--------|
| 1 | Add **videoState** (or at least `currentTime`) to BasicEditorView and use it for new text overlay `startTime`/`endTime`. |
| 2 | Add **“Filter strength”** (0–100%) above or below Quick filters. |
| 3 | **Collapsible sections** for Style bundles, Platform presets, Quick filters (default: first open, rest closed). |
| 4 | **“Recently used”** row for Quick filters (e.g. last 3, stored in `localStorage`). |
| 5 | Short **intro line** at top of Manual Edit: “Set aspect ratio, style, and text. Use Timeline and Effects for timing and advanced effects.” |
| 6 | **Before/after** toggle for filters (if not already in Color/Preview). |

---

## 8. **Larger Enhancements (medium effort)**

- **“Save my style”** (custom style bundle from current layout + filter).
- **Text preset search** and hover preview.
- **Thumb-safe zone** visual for vertical/portrait in layout picker or Platform presets.
- **Undo/redo** scoped to Manual Edit actions (layout, filter, add/remove text) with clear feedback.

---

## 9. **Summary**

- **Manual Edit** is the place for layout, platform format, style bundles, quick filters, and text. Keep that role clear and make navigation to Timeline/Effects/Color obvious.
- Biggest UX gains: **text timing** (playhead or duration), **filter strength**, **before/after**, and **collapsible + recent** to reduce clutter and repetition.
- Small copy and structure tweaks (intro, section order, links to other tabs) will make the section feel more guided and professional.
