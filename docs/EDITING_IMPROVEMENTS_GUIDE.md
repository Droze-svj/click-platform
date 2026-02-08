# Editing Improvements Guide

This guide summarizes improvements for **templates**, **caption font styles**, **AI auto-edit** (precise scene capture), and **professional editing in accordance with user style**.

---

## 1. Templates

### What was improved

- **Text overlay font variety**: Templates now use distinct font families (Impact, Montserrat, Inter, Georgia) so style presets feel different. Examples:
  - Viral Hook / Trending Reels: **Impact** or **Montserrat** for bold hooks.
  - Educational Clean: **Inter** for clean titles.
  - Business Professional: **Georgia** for lower-third name/title.
- **More templates with text overlays**: Educational Clean and Business Professional include optional title/lower-third overlays so users get a full “look” in one click.
- **Personalization**: The VideoTemplates component supports `customColor` and `customFont`; when “Personalize” is used, templates can respect brand font/color.

### How to extend

- Add more templates in `client/components/VideoTemplates.tsx` with `textOverlays` and different `fontFamily` values.
- Reuse or align with `client/types/editor.ts` `CAPTION_FONTS` for consistency (Inter, Montserrat, Playfair Display, etc.).
- For backend-saved templates, use `server/models/Template.js` and ensure `settings` includes `textOverlays` with `fontFamily`.

---

## 2. Caption text & font styles

### What was improved

- **AI smart captions** (`server/services/aiVideoEditingService.js`):
  - **Caption styles**: `modern`, `bold`, `minimal`, `tiktok`, `youtube`, `outline`, `professional`, each with a dedicated **font family** (e.g. modern → Inter, bold → Montserrat, tiktok → Impact, professional → Georgia).
  - **User brand override**: If the user has `brandSettings.font`, it is passed as `captionFontFamily` and applied on top of the chosen style.
- **Caption service** (`server/services/videoCaptionService.js`):
  - `generateAutoCaptions(videoId, options)` builds caption segments from transcript (uses `content.captions.segments` when available, otherwise splits transcript over duration).
  - `styleCaptions(captions, styleOptions)` attaches style (fontSize, fontColor, backgroundColor, outline, position, **fontFamily**) to each segment for burn-in.
- **Editor UI**: In the dashboard video edit page, a **Caption style** dropdown (Modern, Bold, Minimal, TikTok, YouTube, Outline, Professional) controls which style is sent as `captionStyle` when “Add captions” is on. The full-screen editor already has **Caption font** and **Caption text style** in the Properties panel (`client/components/editor/PropertiesPanel.tsx` and `client/types/editor.ts` CAPTION_FONTS / CAPTION_TEXT_STYLES).

### How to extend

- Add a new named style in `aiVideoEditingService.js` inside `generateAndApplySmartCaptions` (in the `styleOptions` object) with its own `fontSize`, `fontColor`, `fontFamily`, etc.
- Add the same option to the dashboard edit page **Caption style** dropdown and to the editor Properties panel if you want it in the timeline preview.
- For FFmpeg burn-in, `fontFamily` is in the style object; if you need custom font files, map `fontFamily` to a path in `manualVideoEditingService.js` or in the drawtext filter builder in `aiVideoEditingService.js`.

---

## 3. AI auto-edit: precise scene capture & professional editing

### Scene detection

- **Configurable FFmpeg threshold**: `editingOptions.sceneThreshold` (default `0.3`) and `minSceneLength` (default `1.0` s) control classic FFmpeg scene detection and merging of very short scenes.
- **Multi-modal scene detection** (optional): When `editingOptions.useMultiModalScenes === true`, the service uses `multiModalSceneDetection.detectScenesMultiModal()` (visual + audio fusion) for more accurate boundaries. Presets can set this to `true` (e.g. Cinematic, Vlog, TikTok, YouTube).
- **Workflow type**: `editingOptions.workflowType` (`'tiktok'`, `'youtube'`, `'general'`) is passed into multi-modal detection for workflow-specific constraints (e.g. shorter min scene for TikTok).

### Style-aware editing

- **Edit presets**: In `server/services/aiVideoEditingService.js`, `EDIT_PRESETS` (cinematic, vlog, podcast, tiktok, youtube) now include:
  - `enableSmartCaptions` and `captionStyle` (e.g. tiktok → `tiktok`, podcast → `minimal`, youtube → `youtube`).
  - `useMultiModalScenes`, `sceneThreshold`, `minSceneLength`, `workflowType` where relevant.
- **User style resolution** (`server/routes/video/ai-editing.js`):
  - Request body can send `preset` (or `editPreset`). The route calls `resolveEditingOptions()`, which applies the preset via `applyPresetToOptions()` and then optionally overlays **user brand** (e.g. `User.brandSettings.font` → `captionFontFamily`).
  - So “user style” = preset + brand font when available.

### Dashboard UI

- **Style preset** dropdown: Custom, Cinematic, Vlog, Podcast, TikTok Ready, YouTube Optimized. When a preset is selected, the backend merges that preset’s options with the request.
- **Caption style** dropdown: Modern, Bold, Minimal, TikTok, YouTube, Outline, Professional. Used when “Add captions” is on.
- Simple toggles are **mapped** to full backend options (e.g. addCaptions → `enableSmartCaptions`, enhanceColor → `enableColorGrading`, stabilizeVideo → `enableStabilization`).

---

## 4. Quick reference

| Area | Where | Key options / types |
|------|--------|----------------------|
| Templates | `client/components/VideoTemplates.tsx` | `textOverlays[].fontFamily`, filters |
| Caption styles (AI) | `server/services/aiVideoEditingService.js` | `styleOptions` in `generateAndApplySmartCaptions`, `captionStyle`, `captionFontFamily` |
| Caption generation | `server/services/videoCaptionService.js` | `generateAutoCaptions`, `styleCaptions` |
| Scene detection | `server/services/aiVideoEditingService.js` | `sceneThreshold`, `minSceneLength`, `useMultiModalScenes`, `workflowType` |
| Presets & user style | `server/services/aiVideoEditingService.js` (EDIT_PRESETS), `server/routes/video/ai-editing.js` (resolveEditingOptions) | `preset`, `captionStyle`, User.brandSettings.font |
| Dashboard edit UI | `client/app/dashboard/video/edit/[videoId]/page.tsx` | `editPreset`, `captionStyle`, mapping to backendOptions |

---

## 5. Further improvements (implemented)

- **Word-level captions**: When `content.captions.words` exists (e.g. Whisper verbose_json), `generateAutoCaptions` groups words into readable lines (~2–4s or max 6 words) for accurate timing.
- **ClientGuidelines**: In `resolveEditingOptions(editingOptions, userId, videoId)`, the route loads the video's `workspaceId`, fetches `ClientGuidelines` for that workspace, and merges `branding.font` / `fontFamily` into `captionFontFamily` and (when platform matches) `platformSpecific[platform].captionStyle` into `captionStyle`.
- **Dashboard**: Preset and caption style are persisted in localStorage; an **Advanced (scene detection)** section adds **Precise scene detection** (useMultiModalScenes) and **Min scene length (sec)**. A tip explains that Profile → Brand font is used for captions when set.
- **Templates**: The last applied template ID is stored in localStorage and shown as a **Recently used** badge on that template card.
- **Caption drawtext**: Smart caption filters now support `outlineWidth` and optional transparent background; bottom position uses `h-text_h-50`.
- **Neon & pill caption styles**: AI smart captions support `neon` (cyan, transparent bg, outline) and `pill` (white on dark pill); dashboard Caption style dropdown includes them.
- **Keyboard shortcut**: Ctrl+Shift+T in Manual Edit opens the Text overlays section and focuses the custom text input (documented in Keyboard Shortcuts help). Compare button (Before/After/Split) is documented there too.
- **Export for platform**: In Manual Edit → Platform presets, each preset has an “Export for [platform] →” link that applies layout + filter and opens the Export tab.
- **Request timeout**: Single global timeout middleware (default 30s, overridable via `REQUEST_TIMEOUT` env).

**Note:** BasicEditorView already implements filter strength (0–100%), Before/After/Split compare, collapsible sections (Expand all / Collapse all), intro line with links to Timeline/Effects/Color, recently used filters and styles, text overlay timing from playhead (Duration 3/5/10s or Full), Save my style, text preset search, thumb-safe zone for vertical/portrait, and undo for Manual Edit actions.

### Latest (further pass)

- **Caption style preview**: On the dashboard video edit page, a small “Sample caption” preview below the Caption style dropdown reflects the selected style (modern, bold, neon, pill, etc.).
- **Quick filters open by default**: Manual Edit opens with the Quick filters section expanded so Filter strength and Compare are visible without an extra click. Intro line now mentions the Compare button.
- **Expand overlays after add**: After adding a text overlay, the “Current text overlays” section auto-expands so the new overlay is visible.
- **Export for platform → preset**: Clicking “Export for [platform] →” in Platform presets sets `sessionStorage`; when the Export tab opens, it pre-selects the matching export preset (e.g. TikTok → tiktok, YouTube Shorts → shorts, Reels/Feed/Portrait → reels).
- **Analysis quick suggestions**: After “Analyze video”, the analysis panel shows a “Quick suggestions” block using `suggestedLength` and `recommendedCuts` (e.g. optimal length, number of cuts, and a tip to enable Add captions).

## 6. Optional next steps

- **Before/after filter toggle**: Per `docs/MANUAL_EDIT_RECOMMENDATIONS.md`, expose a compare mode in Manual Edit so users can see “No filter” vs “Current filter” without removing it.
- **Filter strength**: Add a global “Filter strength” (0–100%) that scales the active quick filter.
- **Neon / pill caption styles**: Add matching styles in AI smart captions to align with the editor's CaptionTextStyle (neon, pill).
