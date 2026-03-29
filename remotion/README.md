# Remotion stub for Click

Minimal Remotion composition for **React → video** export. Use when you want to render editor state (keyframes, overlays) to video from React.

## Quick start

```bash
# From project root
npm install remotion @remotion/cli
npx remotion studio remotion/Root.tsx
```

Then render:

```bash
npx remotion render remotion/Root.tsx ClickComposition out/video.mp4
```

## Files

- **Root.tsx** – Registers the composition (duration, fps, width, height).
- **ClickComposition.tsx** – Example composition: takes `frame` and `fps` (from Remotion’s `useCurrentFrame()` / `useVideoConfig()` when running in Remotion) and renders an animated layer. Copy this into a Remotion project and replace the placeholder with your editor state (e.g. overlays + keyframes).

## Integration with Click editor

1. Export editor state (segments, overlays, keyframes) as JSON.
2. In Remotion, load that JSON and pass it to your composition.
3. For each frame, compute overlay positions from keyframes (same logic as `client/utils/keyframeEasing.ts`) and render.

See `docs/WEB_TECH_STACK.md` for when to use Remotion vs Canvas vs server FFmpeg.
