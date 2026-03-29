# Click Web Tech Stack

How Click uses **Remotion / Canvas API**, **Framer Motion**, and **GSAP** in the Next.js client for video editing, UI animations, and programmatic keyframes.

---

## Quick start

| Goal | Use | Quick start |
|------|-----|-------------|
| **React → video export** (server/headless) | Remotion | Add Remotion project, composition with `useCurrentFrame()` + `interpolate()`, render via `npx remotion render`. |
| **In-browser frame-by-frame** (Canvas, MediaRecorder) | Canvas + rAF | Use `useProgrammaticKeyframeLoop(callback, true)`; in callback draw to canvas or update DOM; optional `canvas.captureStream()` for export. |
| **UI enter/exit, panels, lists** | Framer Motion | `<MotionPanel isOpen={open}>` or `<motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.3 }}>`. |
| **Timeline tweens, easing preview** | GSAP | `gsap.to(el, { rotation: 360, duration: 2, ease: 'power2.inOut' })`; use `keyframeEasingToGsap(easing)` for editor easing. |

---

## Remotion vs Canvas: when to use which

| Use case | Prefer | Why |
|----------|--------|-----|
| Final export (ProRes, H.264) from React components | **Remotion** | Frame-accurate, server-side, no browser limits. |
| Custom drawing (particles, shapes, text on canvas) | **Canvas + rAF** | Full control per pixel, `useProgrammaticKeyframeLoop`. |
| In-browser “record preview” (MediaRecorder) | **Canvas** | `canvas.captureStream(fps)` + `MediaRecorder`. |
| Quick exports (existing pipeline) | **Server FFmpeg** | Already in place; no new stack. |

---

## 1. Video rendering: Remotion or Canvas API

### Remotion (React → video)

Use **Remotion** when you need **server-side or headless video export** from React components and programmatic keyframes.

- **What it is:** React-based video generation. You define a composition (duration, fps, dimensions) and render frames in Node or Lambda; Remotion calls your React tree per frame and composites to video.
- **When to use:** High-quality export (ProRes, H.264) with full control over every frame; reusable React components for lower-thirds, captions, motion graphics; timeline-driven animations via `useCurrentFrame()` and `interpolate()`.
- **Integration:** Add a Remotion project (or subfolder) and a composition that reads editor state (segments, overlays, keyframes). Render via `npx remotion render` or Remotion Lambda. The existing server FFmpeg pipeline can remain for quick exports; use Remotion for “final master” or template-based exports.
- **Example pattern:**
  ```tsx
  // Remotion composition (conceptual)
  export const ClickComposition = () => {
    const frame = useCurrentFrame()
    const fps = useVideoConfig().fps
    const t = frame / fps
    const scale = interpolate(t, [0, 30], [1, 1.1], { easing: Easing.bezier(0.4, 0, 0.2, 1) })
    return <div style={{ transform: `scale(${scale})` }}>...</div>
  }
  ```

### Canvas API + requestAnimationFrame

Use the **Canvas API** when you need **client-side, frame-by-frame control** (e.g. custom drawing, particles, or a path to `MediaRecorder` / `canvas.captureStream()` for in-browser export).

- **What we do today:** The editor uses **requestAnimationFrame** in `RealTimeVideoPreview` to sync the playhead with video `currentTime` and drive the DOM (CSS transforms/opacity) from keyframe interpolation in `keyframeEasing.ts`. Overlays are DOM elements, not canvas-drawn.
- **When to add Canvas:** Custom effects (gradients, shapes, text rendered to canvas), or a client-side export path that draws each frame to a canvas and records via `MediaRecorder` or exports frames.
- **Pattern:** Use the **`useProgrammaticKeyframeLoop`** hook (see below) to drive a canvas (or ref) at 60fps with `(time, delta)`; draw from editor state and keyframes. For export, use `canvas.captureStream(fps)` and `MediaRecorder`, or upload frames to the server.

---

## 2. Framer Motion (React UI animations)

**Framer Motion** is already in the stack (`framer-motion`) and used across the app (ExportView, ModernVideoEditor, AssetLibraryView, CommandK, AiAssistant, etc.).

### Declarative pattern

Wrap UI elements in `<motion.*>` with `initial`, `animate`, and `transition` for enter/exit and state changes:

```tsx
import { motion, AnimatePresence } from 'framer-motion'

// Simple enter animation
<motion.div
  initial={{ scale: 0 }}
  animate={{ scale: 1 }}
  transition={{ duration: 0.3 }}
>
  Panel content
</motion.div>

// With exit (use AnimatePresence as parent)
<AnimatePresence>
  {isOpen && (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      Ready to publish
    </motion.div>
  )}
</AnimatePresence>
```

### Reusable component

Use **`MotionPanel`** (see `client/components/ui/MotionPanel.tsx`) for consistent panel open/close and list stagger. Use **Framer Motion** for:

- Panel expand/collapse
- Modal and dropdown enter/exit
- List item stagger (e.g. preset cards, compound list)
- Micro-interactions (buttons, toggles)

Avoid using Framer Motion for **timeline-driven overlay animation** in the preview; that stays with the existing keyframe interpolation and `requestAnimationFrame` sync so it stays in sync with video time.

---

## 3. GSAP (Timeline and tween animations)

**GSAP** is used for **timeline-based animations** and precise easing (e.g. power2.inOut, custom curves). Typical use: scrubber-driven tweens, “animate this element over 2s with this ease,” or building a timeline of sequenced tweens.

### Install

```bash
cd client && npm install gsap
```

### Example

```tsx
import gsap from 'gsap'

// Single tween
gsap.to(elementRef.current, {
  rotation: 360,
  duration: 2,
  ease: 'power2.inOut',
})

// Timeline
const tl = gsap.timeline()
tl.to(el1, { x: 100, duration: 0.5 })
  .to(el2, { scale: 1.2, duration: 0.3 }, '-=0.2')
  .to(el1, { opacity: 0, duration: 0.2 })
```

### Where we use it in Click

- **Effects / keyframe presets:** Optional GSAP-driven preview for “preview this preset” on a dummy element (e.g. in the Effects panel).
- **Timeline UI:** Optional smooth scrub or playhead motion (e.g. `gsap.to(playheadRef, { x: pixelPosition, duration: 0.15 })`).
- **Motion graphics:** Converting our keyframe model to GSAP tweens for a layer when you want GSAP’s easing and timeline control instead of our custom interpolator.

The existing **keyframe system** (`keyframeEasing.ts`, `TransformKeyframe`, easing presets) remains the source of truth for **video-time** animation (position, scale, rotation, opacity). GSAP complements it for **UI-time** animations and for optional “preview in a sandbox” behavior.

---

## 4. Summary

| Concern | Technology | Use in Click |
|--------|------------|--------------|
| **Video export (programmatic keyframes)** | Remotion or Canvas + rAF | Remotion: React→video export. Canvas: custom draw + optional client export. |
| **Preview sync with video time** | requestAnimationFrame + keyframe interpolation | Already in `RealTimeVideoPreview` and `keyframeEasing.ts`. |
| **React UI animations** | Framer Motion | Panels, modals, list stagger, buttons; `MotionPanel` for consistency. |
| **Timeline / tween animations** | GSAP | UI scrubbing, preset preview, or converting keyframes to GSAP for designer-friendly tweens. |

---

## 5. File reference

- **Keyframe interpolation:** `client/utils/keyframeEasing.ts`
- **Preview (rAF + DOM keyframes):** `client/components/editor/RealTimeVideoPreview.tsx`
- **Framer Motion panel pattern:** `client/components/ui/MotionPanel.tsx`
- **Programmatic keyframe loop (Canvas / rAF):** `client/hooks/useProgrammaticKeyframeLoop.ts`
- **GSAP helpers (optional):** `client/utils/gsapKeyframes.ts`
- **GSAP in editor:** Effects view → Keyframe Properties panel → “Preview GSAP” runs `gsap.to(box, { rotation: 360, duration: 2, ease: 'power2.inOut' })`.
- **MotionPanel in editor:** BasicEditorView → Compounds section uses `<MotionPanel isOpen={savedCompounds.length > 0}>` for the “My compounds” list enter/exit; list items use **MotionList** with stagger.

### Optional: FPS cap and external time

- **`useProgrammaticKeyframeLoop(callback, active, { maxFps: 30 })`** – Caps callback to ~30fps to save CPU when drawing to canvas.
- **Video-time driven:** For overlays that must follow video `currentTime`, keep using the existing preview sync in `RealTimeVideoPreview` (no loop needed). Use the hook only for **free-running** animations (e.g. particles, UI).
