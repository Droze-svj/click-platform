# Render Pipeline Implementation Guide

How to implement the video render pipeline so that all editor features (filters, text overlays, shapes, transitions, LUT, etc.) are applied when exporting.

---

## Current State

| Component | Status |
|-----------|--------|
| **Client ExportView** | UI only – "START PRODUCTION RENDER" shows a toast; no API call |
| **Editor state** | Stored in `ModernVideoEditor`: `videoFilters`, `textOverlays`, `shapeOverlays`, `timelineSegments`, `timelineEffects`, `captionStyle`, `templateLayout`, etc. |
| **Server** | `aiVideoEditingService.autoEditVideo` – full FFmpeg pipeline (filters, drawtext, transitions, ducking); `professionalExportService` – preset/custom export; `manualVideoEditingService.applyManualEdits` – trim, speed, crop, basic filters; `/api/export` – generic job queue (content/analytics, not video) |
| **Gap** | No endpoint that accepts the full editor state and renders it with FFmpeg |

---

## Architecture Overview

```
┌─────────────────┐     POST /api/video/render      ┌──────────────────────┐
│  ExportView     │ ─────────────────────────────►  │  VideoRenderService  │
│  (editor state) │  { videoId, filters, overlays,  │  (FFmpeg pipeline)   │
└─────────────────┘   segments, exportOptions }     └──────────┬───────────┘
                                                               │
                                                               ▼
                                                    ┌──────────────────────┐
                                                    │  Output: MP4 file    │
                                                    │  Upload to storage   │
                                                    │  Return download URL │
                                                    └──────────────────────┘
```

---

## Phase 1: Minimal Pipeline (Filters + Text Overlays)

**Goal:** Apply `videoFilters` and `textOverlays` to the source video.

### 1.1 Create API endpoint

**Route:** `POST /api/video/:videoId/render` or `POST /api/video/render`

**Body:**

```json
{
  "videoFilters": { "brightness": 100, "contrast": 100, "saturation": 100, ... },
  "textOverlays": [
    { "text": "Subscribe", "x": 50, "y": 88, "fontSize": 28, "color": "#ffffff",
      "startTime": 0, "endTime": 5, "fontFamily": "Inter", "style": "shadow" }
  ],
  "exportOptions": {
    "resolution": { "width": 1920, "height": 1080 },
    "bitrateMbps": 8,
    "codec": "h264",
    "quality": "high"
  }
}
```

### 1.2 Map videoFilters to FFmpeg

| Filter property | FFmpeg equivalent |
|-----------------|-------------------|
| brightness (0–200, 100=neutral) | `eq=brightness=${(v-100)/100}` |
| contrast (0–200, 100=neutral) | `eq=contrast=${v/100}` |
| saturation (0–200, 100=neutral) | `eq=saturation=${v/100}` |
| hue (-180–180) | `hue=h=${v}` |
| temperature (50–150, 100=neutral) | Approx. via `colorbalance` or `curves` |
| sepia (0–100) | `colorchannelmixer=rr=.393:gg=.769:bb=.189` scaled |
| vignette (0–100) | `vignette=angle=PI/4` |
| blur (0–100) | `boxblur=lr=${v/10}:lp=1` |
| sharpen (0–100) | `unsharp=5:5:${v/20}:5:5:${v/20}` |
| highlights / shadows | `curves` or `eq` (approximate) |

**Combined filter chain example:**

```javascript
const vf = [
  `eq=brightness=${(filters.brightness-100)/100}:contrast=${filters.contrast/100}:saturation=${filters.saturation/100}`,
  filters.sepia > 0 ? `colorchannelmixer=rr=${1-filters.sepia/200}:gg=${1-filters.sepia/200}:bb=${1-filters.sepia/200}` : null,
  filters.vignette > 0 ? `vignette=angle=PI/4` : null,
  filters.blur > 0 ? `boxblur=lr=${filters.blur/10}:lp=1` : null,
].filter(Boolean).join(',');
```

### 1.3 Map textOverlays to FFmpeg drawtext

```javascript
textOverlays.forEach(o => {
  const x = `(w-text_w)*${o.x/100}`;
  const y = `(h-text_h)*${o.y/100}`;
  const enable = `between(t,${o.startTime},${o.endTime})`;
  // Font path: use system font or bundled font
  const fontfile = resolveFont(o.fontFamily);
  const filter = `drawtext=text='${o.text.replace(/'/g, "\\'")}':fontfile=${fontfile}:fontsize=${o.fontSize}:fontcolor=${o.color}:x=${x}:y=${y}:enable='${enable}'`;
  videoFilters.push(filter);
});
```

**Note:** FFmpeg `drawtext` does not support CSS animations (fade, pop, slide). Those are preview-only unless you pre-render text as images or use a more advanced pipeline (e.g. HTML5 Canvas → frames → ffmpeg).

### 1.4 Resolution and codec

```javascript
command
  .size(`${width}x${height}`)
  .videoCodec(exportOptions.codec === 'hevc' ? 'libx265' : 'libx264')
  .outputOptions([
    `-b:v ${bitrateMbps}M`,
    '-preset medium',
    '-crf 23',
    '-movflags +faststart',
  ])
  .audioCodec('aac')
  .outputOptions(['-b:a', '192k']);
```

---

## Phase 2: Shape Overlays

FFmpeg has `drawbox` for rectangles. For circles, use `geq` or pre-render as PNG and overlay.

**Rectangle:**

```javascript
// drawbox=x:y:w:h:color@opacity:t=fill
`drawbox=x='(w*${x/100})-${w/2}':y='(h*${y/100})-${h/2}':w='w*${width/100}':h='h*${height/100}':color=${color}@${opacity}:t=fill:enable='between(t,${start},${end})'`
```

**Circle:** Use `drawbox` with rounded corners (limited) or generate a circular mask PNG and overlay with `overlay` filter.

**Line:** `drawbox` with very small height: `drawbox=x=...:y=...:w=...:h=2:color=...`.

---

## Phase 3: Segment Transitions

Transitions between segments require a **multi-input** FFmpeg setup. You need to:

1. Split the source video into segments according to `timelineSegments`.
2. Apply each segment’s `playbackSpeed` via `setpts` and `atempo`.
3. Join segments with `xfade` (crossfade) or `blend` for wipes.

**Example (crossfade between two segments):**

```javascript
// Two inputs: segment1.mp4, segment2.mp4
// xfade=transition=fade:duration=0.5:offset=4.5 (offset = seg1_duration - overlap)
ffmpeg()
  .input(segment1Path)
  .input(segment2Path)
  .complexFilter([
    '[0:v][1:v]xfade=transition=fade:duration=0.5:offset=4.5[outv]',
    '[0:a][1:a]acrossfade=d=0.5[outa]'
  ], ['outv'], ['outa'])
```

This is more complex because you must first extract segments, then concatenate with transitions. A simpler approach: **single continuous video** with no cuts, and apply transitions only at cut points if you implement a full NLE-style pipeline.

---

## Phase 4: Timeline Effects (Filter/Motion/Overlay)

`timelineEffects` have `startTime`, `endTime`, `intensity`, `keyframes`, `fadeIn`, `fadeOut`. To apply:

- **Filter effects:** Build a filter that changes over time using `enable='between(t,start,end)'` and intensity based on keyframes (interpolate).
- **Overlay effects (vignette, etc.):** Same idea – apply only when `t` is in range, with intensity modulation.

Example for a vignette effect with fade-in:

```javascript
// Intensity ramps from 0 to 100 over fadeIn seconds
// enable='between(t,start,end)' and use expressions for intensity
```

FFmpeg expressions can get complex. An alternative: **precompute keyframes** and use multiple filter passes, or use a frame-accurate script (e.g. Node + FFmpeg frame-by-frame) for full keyframe support.

---

## Phase 5: LUT (Look-Up Table)

```javascript
if (filters.lutUrl) {
  // FFmpeg lut3d or colorkey for .cube files
  videoFilters.push(`lut3d=file='${lutPath}'`);
}
```

Ensure the LUT file is accessible (uploaded or from a built-in library path).

---

## Phase 6: Audio Ducking

When "Duck music when voiceover" is enabled:

1. Identify voiceover/dialogue segments (from transcript or manual markers).
2. Apply `volume` filter with `enable` expressions to lower music during those segments.

```javascript
// Example: lower volume between t=10 and t=15
audioFilters.push(`volume='if(between(t,10,15),0.25,1)':eval=frame`);
```

Or use `pan` / sidechain compression if you have separate voice and music tracks.

---

## Phase 7: Per-Segment Speed (Speed Ramping)

For each segment with `playbackSpeed !== 1`:

```javascript
// setpts and atempo for speed change
videoFilters.push(`setpts='if(between(t,${start},${end}),${1/speed}*PTS,PTS)'`);
audioFilters.push(`atempo='if(between(t,${start},${end}),${speed},1)'`);
```

For smooth ramps, you need more complex expressions or multiple filter passes.

---

## Recommended Implementation Order

| Phase | Feature | Complexity | Dependencies |
|-------|---------|------------|--------------|
| 1 | Filters + text overlays + resolution/codec | Medium | FFmpeg, font resolution |
| 2 | Shape overlays (rect, line) | Low | Phase 1 |
| 3 | LUT | Low | Phase 1 |
| 4 | Audio ducking | Medium | Transcript or markers |
| 5 | Per-segment speed | Medium | Segment boundaries |
| 6 | Segment transitions | High | Segment splitting, multi-input |
| 7 | Timeline effects + keyframes | High | Expression-heavy or frame script |

---

## File Structure Suggestion

```
server/
  services/
    videoRenderService.js     # Main orchestrator
    ffmpegFilterBuilder.js    # Maps editor state → FFmpeg filters
  routes/
    video/
      render.js               # POST /api/video/:videoId/render
```

---

## Client Integration

1. **ExportView** – Collect full editor state from `ModernVideoEditor` (via props or context).
2. **Call API** – `POST /api/video/:videoId/render` with `{ videoFilters, textOverlays, shapeOverlays, timelineSegments, timelineEffects, exportOptions }`.
3. **Poll or WebSocket** – For long renders, use job queue + status polling (`GET /api/export/:jobId`) or WebSocket progress.
4. **Download** – When complete, open/download the returned URL.

**Props to pass to ExportView:**

- `videoFilters`, `textOverlays`, `shapeOverlays`
- `timelineSegments`, `timelineEffects`
- `captionStyle`, `templateLayout`
- `exportOptions` (from ExportView state: preset, quality, codec, duckMusic, duckLevel)

---

## Existing Code to Reuse

- **manualVideoEditingService.applyManualEdits** – Trim, speed, crop, basic eq filters.
- **aiVideoEditingService.autoEditVideo** – Full filter chain, drawtext, ducking, music mix.
- **professionalExportService.exportWithPreset** – Resolution, codec, bitrate.
- **advancedTransitionsService** – Crossfade, wipes between clips.

You can either extend `aiVideoEditingService` with a new `renderFromEditorState(editorState)` function or create a dedicated `videoRenderService.js` that composes these pieces.

---

## Summary

Start with **Phase 1** (filters + text overlays + export options), wire ExportView to the new API, and verify end-to-end. Then add shapes, LUT, ducking, and speed. Transitions and full keyframe effects are the most complex and can come last or be approximated (e.g. global crossfade instead of per-segment).
