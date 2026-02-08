# Click Editing Section: Quality & Creativity Improvements

Recommendations for improving video content **quality** and **creativity** in the editing section. Ordered by impact and feasibility.

---

## Quality Improvements

### 1. **Full filter chain in preview**

**Current:** `RealTimeVideoPreview` applies only `brightness`, `contrast`, `saturation`, `hue`, `sepia`, `blur`. Properties like **highlights**, **shadows**, **clarity**, **dehaze**, **sharpen** are in the data model and Properties/Color panels but not in the preview CSS.

**Improvement:**

- Add **highlights** and **shadows** via CSS (e.g. `filter: brightness(...)` combined with a simple luminance mask or accept “preview approximation”).
- **Clarity** and **dehaze** are hard to mimic with CSS alone; either document “preview approximate, full in export” or add a small canvas/WebGL pass for a basic clarity effect.
- **Sharpen:** use `filter: contrast(...)` tweak or a minimal canvas sharpen so the preview matches export intent.

**Impact:** What users set in Color / Properties matches what they see, reducing rework and trust issues.

---

### 2. **Export quality controls**

**Current:** Export has presets (Shorts, Reels, 1080p, 4K) and a high/medium/low quality toggle. Resolution and bitrate are mostly implied.

**Improvement:**

- Explicit **resolution** (e.g. 1080×1920, 1920×1080, 4K) and **bitrate** (or “Quality” that maps to bitrate) in Export.
- Optional **codec** (e.g. H.264 vs HEVC) when the backend supports it.
- Short **“Quality vs file size”** hint (e.g. “Higher bitrate = better quality, larger file”).

**Impact:** Creators can match platform specs and choose quality vs file size consciously.

---

### 3. **LUT / professional color (optional)**

**Current:** Color is driven by sliders and presets (temperature, tint, saturation, etc.). No LUT support.

**Improvement:**

- Optional **LUT** (.cube) upload or selection from a small built-in library (e.g. “Cinematic”, “Bleach Bypass”, “Log to Rec.709”).
- Apply LUT in **export pipeline** (and in preview via canvas/WebGL if feasible).
- Keep existing sliders; LUT can be a “base look” with sliders on top.

**Impact:** More cinematic, pro-style looks without learning every slider.

---

### 4. **Consistent color pipeline (Edit vs Color tab)**

**Current:** BasicEditorView (Edit) has Quick filters; ColorGradingView (Color) has presets + sliders. Both write to the same `videoFilters`, but the UX is split.

**Improvement:**

- In **Edit**, add a “Open in Color tab” (or “Fine-tune in Color”) for the current look so power users can jump to sliders.
- In **Color**, show a “Quick filter” row that mirrors Edit’s most-used presets so both tabs feel like one pipeline.

**Impact:** Fewer “where do I change this?” moments; clearer path from quick look to fine-tuning.

---

## Creativity Improvements

### 5. **Text overlay animations**

**Current:** Text overlays have position, duration, and style (neon, shadow, etc.) but no enter/exit or in-clip animation.

**Improvement:**

- **Per-overlay animation:** e.g. Fade in, Fade out, Pop (scale), Slide (from top/bottom/left/right), Typewriter (optional).
- **Duration:** e.g. 0.2s, 0.5s, 1s for in/out.
- Stored in `TextOverlay` (e.g. `animationIn`, `animationOut`, `animationDuration`).
- Preview: implement with CSS `animation` or Framer Motion; export: same params passed to render pipeline.

**Impact:** More engaging captions and CTAs without leaving the editor.

---

### 6. **Segment transitions**

**Current:** Timeline has segments (video, audio, text, etc.) and effects; no explicit “transition” between adjacent segments.

**Improvement:**

- **Transition type** between two adjacent segments: None, Crossfade, Dip to black, Wipe (left/right/up/down), Zoom.
- **Duration:** e.g. 0.25s, 0.5s, 1s.
- Stored on the segment boundary or on a small “transition” block between segments.
- Preview: crossfade and dip are easy in a player; wipes/zoom need overlay or render.
- Export: backend applies the transition when concatenating segments.

**Impact:** Smoother, more intentional cuts; less “hard cut” feel.

---

### 7. **Effect keyframes in the UI**

**Current:** `TimelineEffect` and types support `keyframes` and easing; timeline supports effect duration and resizing. It’s unclear if users can **add keyframes** (e.g. “intensity 0% at start, 100% at 0.5s”).

**Improvement:**

- In **Effects** (or a dedicated “Effect details” panel), when an effect is selected:
  - Show a **simple keyframe timeline** (time vs intensity or one main param).
  - Add/remove keyframes; set value and optional easing between keyframes.
- Preview: interpolate effect params over time based on current playhead.
- Export: pass keyframe data so the renderer can apply the same curve.

**Impact:** Effects that “build” or “fade” over time (e.g. vignette in, blur pulse) become possible without more preset types.

---

### 8. **More text styling and fonts**

**Current:** Text overlays have font family, size, color, and a fixed set of styles (neon, minimal, shadow, etc.). Captions have a separate font list.

**Improvement:**

- **Unified font list** for overlays and captions (or shared subset) and 2–3 “display” fonts for titles.
- **Per-overlay color** picker (already in model); ensure it’s visible in the Properties panel.
- **Outline** color (e.g. for “outline” style) and optional **background** (pill/rectangle) with color + padding.
- Optional **letter-spacing** and **line height** for short blocks of text.

**Impact:** More distinct, on-brand text without needing external design tools.

---

### 9. **Stickers, shapes, and simple graphics**

**Current:** Only text overlays and timeline effects (filter/motion/overlay) are in the flow. No first-class “sticker” or “shape” assets.

**Improvement:**

- **Shapes:** rectangle, circle, line (e.g. for lower-third underlines). Color, opacity, border, position, size, in/out time.
- **Stickers / emoji:** small library (or upload) with position, scale, rotation, duration.
- Stored as a new overlay type (e.g. `ShapeOverlay`, `StickerOverlay`) or under a generic “GraphicOverlay” with a `type` field.
- Preview: render as divs/svg; export: same data to backend for compositing.

**Impact:** Quick visual emphasis and lower-thirds without leaving Click.

---

### 10. **Audio ducking (music vs voice)**

**Current:** Timeline has segments and possibly audio tracks; no explicit “duck music when voiceover plays.”

**Improvement:**

- When **voiceover** or **dialogue** segments exist, offer an option: “Duck music” with **target level** (e.g. -12 dB) and **fade duration**.
- Either automatic (detect voice segments) or manual (user marks “dialogue” or “voice” segments).
- Export: backend applies gain curves on the music track where dialogue is present.

**Impact:** Clearer dialogue and more professional mix without a separate DAW.

---

### 11. **Speed ramping on the timeline**

**Current:** Playback speed is global; no per-segment or per-range speed (e.g. slow-mo for 2 seconds).

**Improvement:**

- **Per-segment speed** (e.g. 0.5x, 1x, 1.5x, 2x) on video segments.
- Optional **speed ramp:** start and end speed with duration (e.g. 1x → 0.25x over 1s).
- Stored in segment `properties` or a small “speed” effect.
- Preview: adjust `playbackRate` for the segment’s range; export: backend applies time remapping.

**Impact:** Simple slow-mo and speed changes without a separate NLE.

---

### 12. **“Mood” or “style” quick packs**

**Current:** Style bundles and platform presets combine layout + filter; Quick filters are filter-only.

**Improvement:**

- **Mood packs:** e.g. “Calm”, “Urgent”, “Luxury” = filter + 1–2 suggested text styles + optional default transition (e.g. crossfade).
- One click applies filter + sets a “suggested” text style (user can still change).
- Stored as small JSON presets (filter + metadata); no new backend required.

**Impact:** Faster, more consistent “vibe” across videos.

---

## Suggested order of work

| Priority | Item | Reason |
|----------|------|--------|
| **P0** | Full filter chain in preview (§1) | Quality: preview matches export intent. |
| **P0** | Export quality controls (§2) | Quality: correct resolution/bitrate per platform. |
| **P1** | Text overlay animations (§5) | Creativity: high impact, contained scope. |
| **P1** | Segment transitions (§6) | Creativity: professional feel between cuts. |
| **P2** | Effect keyframes in UI (§7) | Creativity: use existing types, add UI. |
| **P2** | More text styling & fonts (§8) | Creativity: quick win for branding. |
| **P2** | Consistent color pipeline (§4) | UX: one clear color story (Edit + Color). |
| **P3** | LUT support (§3) | Quality: pro option when backend ready. |
| **P3** | Stickers & shapes (§9) | Creativity: expands overlay toolkit. |
| **P3** | Audio ducking (§10) | Quality: better mix. |
| **P3** | Speed ramping (§11) | Creativity: more dynamic pacing. |
| **P3** | Mood packs (§12) | Creativity: fast consistency. |

---

## Summary

- **Quality:** Make the preview use the full filter set (highlights, shadows, clarity, dehaze, sharpen where possible), add explicit export resolution/bitrate, then consider LUT and a unified Edit + Color pipeline.
- **Creativity:** Add text overlay animations and segment transitions first, then effect keyframes, richer text styling, and optional stickers/shapes, audio ducking, speed ramping, and mood packs.

This keeps the editing section aligned with creator expectations for both **technical quality** and **creative expression** inside Click.
