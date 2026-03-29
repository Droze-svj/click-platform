# Next Improvements — Editor, Stack & Product

Prioritized ideas for what to do next, after keyframes, motion graphics, compounds, ProRes export, and the web tech stack (Framer Motion, GSAP, rAF, MotionPanel, etc.).

---

## High impact, low–medium effort

| # | Improvement | Effort | Why |
|---|-------------|--------|-----|
| 1 | **Go to next/prev keyframe** | ½ day | In Effects → Keyframe Properties, add “Previous keyframe” / “Next keyframe” that seek the playhead to the previous/next keyframe time. Improves keyframe editing flow. |
| 2 | **Snap playhead to keyframes** | ½ day | When scrubbing the timeline (or entering a time), optionally snap to the nearest keyframe of the selected segment/effect (toggle in timeline toolbar or Settings). |
| 3 | **Unit tests for keyframe easing** | ½ day | Test `applyEasing()`, `interpolateTransformAtTime()`, `interpolateEffectTransformAtTime()` in `client/utils/keyframeEasing.ts` (linear, ease-in-out, bounce, edge cases). Prevents regressions. |
| 4 | **Image overlay keyframe UI** | 1 day | In Edit view (overlays section), when an image overlay is selected, show the same Keyframe Properties pattern (stopwatch, position/scale/rotation/opacity) or a link to “Animate in Effects” with that overlay focused. Today image overlays support keyframes in preview but the UI to add them is in Effects for segments/effects only. |

---

## Medium impact, medium effort

| # | Improvement | Effort | Why |
|---|-------------|--------|-----|
| 5 | **Copy/paste keyframes** | 1 day | Copy keyframes from the selected segment or effect and paste onto another (same type). Store in clipboard (e.g. same pattern as effects copy/paste). |
| 6 | **Undo/redo for keyframe edits** | 1–2 days | Integrate keyframe changes (add/remove/change value) into the editor undo stack so users can undo keyframe edits. |
| 7 | **Remotion stub or minimal composition** | 1–2 days | Add a minimal Remotion composition (e.g. in `remotion/` or `client/remotion/`) that reads a simplified editor state (one composition, one overlay with keyframes) and renders to video. Proves the path from React + keyframes → video without replacing the current FFmpeg export. |
| 8 | **Keyboard shortcut hints** | ½ day | Show “K = add keyframe” in the keyboard overlay or timeline hint (already in Keyframe Properties header; ensure it’s in the central shortcut list if one exists). Add J/K/L (back/play-pause/forward) and I/O (in/out) to the hint if not already there. |

---

## Nice to have

| # | Improvement | Effort | Why |
|---|-------------|--------|-----|
| 9 | **Timeline: waveform on primary track** | 2–3 days | Draw audio waveform for the main video (or first segment) on the timeline so users can cut to the beat or avoid speech. Requires waveform data (e.g. from server or client decode). |
| 10 | **Client-side “record preview”** | 2–3 days | Use Canvas API + `useProgrammaticKeyframeLoop` (or current DOM preview) + `captureStream()` + `MediaRecorder` to let users download a short “preview” recording from the current view (e.g. 30s max). Complements server export. |
| 11 | **Virtualized timeline** | 1–2 days | If a project has many segments/effects, virtualize the track content so only visible blocks are rendered. Improves scroll performance. |
| 12 | **Keyframe badges on overlay blocks** | ½ day | If text/image overlay blocks are shown on a timeline track, show a small “n KF” badge when that overlay has keyframes (like segment/effect blocks). |

---

## Align with existing roadmap

These stay important from **ROADMAP_STATUS** and **CLICK_NEXT_ACTIONS**:

- **Phase 0:** MongoDB/Redis (production blockers).
- **Phase 1:** Testing & QA, OAuth token refresh, Cloud storage (S3/Cloudinary).
- **Phase 2:** Job queue, transcripts (Whisper), DB optimization, monitoring.

The table above focuses on **editor, keyframes, and web stack** improvements that build on what’s already in place. Use **ROADMAP_STATUS.md** and **CLICK_NEXT_ACTIONS.md** for platform-wide priorities.

---

## Quick reference

- **Keyframes & preview:** `client/utils/keyframeEasing.ts`, `client/components/editor/RealTimeVideoPreview.tsx`, `client/components/editor/views/EffectsView.tsx`, `client/components/editor/ResizableTimeline.tsx`
- **Web stack:** `docs/WEB_TECH_STACK.md`, `client/components/ui/MotionPanel.tsx`, `client/hooks/useProgrammaticKeyframeLoop.ts`, `client/utils/gsapKeyframes.ts`
- **Export:** `client/components/editor/views/ExportView.tsx`, `server/services/videoRenderService.js` (ProRes + .mov)
