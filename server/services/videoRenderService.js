// Video Render Service
// Renders editor state (filters, overlays) to final video via FFmpeg

const ffmpeg = require('fluent-ffmpeg')
const path = require('path')
const fs = require('fs')
const os = require('os')
const crypto = require('crypto')
const { notoFontForText } = require('../utils/scriptFont')
let sharp = null
try { sharp = require('sharp') } catch (_) { /* sharp optional; svg/gradient overlays degrade gracefully */ }
const Content = require('../models/Content')
const logger = require('../utils/logger')
const videoEnhancer = require('../utils/videoEnhancer')
const c2paService = require('./c2paService')
const { toAbsolutePath } = require('../utils/pathUtils')
const urlGuard = require('../utils/urlGuard')

/**
 * Build FFmpeg video filter chain from editor videoFilters
 */
function buildVideoFilterChain(filters) {
  if (!filters || typeof filters !== 'object') return []
  const f = filters
  // These inputs are attacker-influenced (editor state from the request) and are
  // interpolated into the ffmpeg graph — clamp every numeric to a sane band before
  // use. clamp() returns the default for non-finite values.
  const clamp = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d }
  // ffmpeg eq brightness is only valid in [-1,1] — clamp the centered delta so an
  // extreme slider / payload can't emit an out-of-range (rejected) brightness.
  const brightness = Math.max(-1, Math.min(1, (clamp(f.brightness, 0, 300, 100) - 100) / 100))
  const contrast = clamp(f.contrast, 0, 300, 100) / 100
  // Vibrance (100-centered) gently amplifies saturation — folded in so warm/vivid/
  // neon grades that lean on it actually render in the export, not just the preview.
  const satBase = clamp(f.saturation, 0, 300, 100) / 100
  const vib = (clamp(f.vibrance, 0, 300, 100) - 100) / 100
  const saturation = Math.max(0, satBase * (1 + vib * 0.4))
  const filters_out = []

  const eqParts = []
  if (contrast !== 1) eqParts.push(`contrast=${contrast}`)
  if (saturation !== 1) eqParts.push(`saturation=${saturation}`)
  if (brightness !== 0) eqParts.push(`brightness=${brightness}`)
  if (eqParts.length > 0) {
    filters_out.push(`eq=${eqParts.join(':')}`)
  }

  const hue = clamp(f.hue, -180, 180, 0)
  if (hue !== 0) filters_out.push(`hue=h=${hue}`)

  // Temperature (100-centered) + tint (0-centered) via colorbalance: warmer = more
  // red / less blue; tint shifts green↔magenta. Previously ignored, so warm vs cool
  // grades looked identical in the export — now they don't.
  const temp = (clamp(f.temperature, 0, 200, 100) - 100) / 100
  const tint = clamp(f.tint, -100, 100, 0) / 100
  if (temp !== 0 || tint !== 0) {
    const rm = (temp * 0.3).toFixed(3)
    const gm = (tint * 0.3).toFixed(3)
    const bm = (-temp * 0.3).toFixed(3)
    filters_out.push(`colorbalance=rm=${rm}:gm=${gm}:bm=${bm}`)
  }

  // Real sepia: blend the classic warm sepia matrix by amount (the old rr=gg=bb
  // mixer just darkened uniformly with NO hue shift, so "vintage" wasn't warm).
  const sepia = clamp(f.sepia, 0, 100, 0) / 100
  if (sepia > 0) {
    const mix = (id, sep) => ((1 - sepia) * id + sepia * sep).toFixed(3)
    filters_out.push(
      `colorchannelmixer=rr=${mix(1, 0.393)}:rg=${mix(0, 0.769)}:rb=${mix(0, 0.189)}`
      + `:gr=${mix(0, 0.349)}:gg=${mix(1, 0.686)}:gb=${mix(0, 0.168)}`
      + `:br=${mix(0, 0.272)}:bg=${mix(0, 0.534)}:bb=${mix(1, 0.131)}`,
    )
  }

  // Vignette INTENSITY now scales (was a fixed angle=PI/4 for every value, so
  // noir/cinematic/low-key all darkened identically). Higher value → larger angle
  // → stronger corner darkening (ffmpeg vignette default is PI/5).
  const vignette = clamp(f.vignette, 0, 100, 0)
  if (vignette > 0) {
    const ang = (Math.PI / 5) + (vignette / 100) * (Math.PI / 2 - Math.PI / 5)
    filters_out.push(`vignette=angle=${ang.toFixed(4)}`)
  }

  // Shadows / highlights (0-centered) via curves; clarity (>100) via local-contrast
  // unsharp. Previously these rendered in the live preview but were dropped at export.
  const shadows = clamp(f.shadows, -100, 100, 0) / 100
  const highlights = clamp(f.highlights, -100, 100, 0) / 100
  if (shadows !== 0 || highlights !== 0) {
    const sp = Math.min(0.5, Math.max(0.05, 0.25 + shadows * 0.15)).toFixed(3)
    const hp = Math.min(0.95, Math.max(0.5, 0.75 + highlights * 0.15)).toFixed(3)
    filters_out.push(`curves=all='0/0 0.25/${sp} 0.75/${hp} 1/1'`)
  }
  const clarity = clamp(f.clarity, 0, 200, 0)
  if (clarity > 100) {
    filters_out.push(`unsharp=lx=5:ly=5:la=${Math.min(1.5, (clarity - 100) / 100).toFixed(2)}`)
  }

  const blur = clamp(f.blur, 0, 100, 0)
  if (blur > 0) filters_out.push(`boxblur=lr=${Math.max(1, Math.round(blur / 10))}:lp=1`)

  // 2026 Advanced Cinematic VFX Injections
  const vfx = f.vfx || []
  if (vfx.includes('vhs-glitch')) {
    filters_out.push('noise=alls=15:allf=p:enable=\'between(t,0,1000)\'', 'rgbashift=rh=-3:bv=3')
  }
  if (vfx.includes('chromatic-aberration') || vfx.includes('rgb-split')) {
    filters_out.push('rgbashift=rh=5:bv=-5')
  }
  if (vfx.includes('film-burn')) {
    filters_out.push('curves=m=\'0/0 0.5/0.1 1/1\':r=\'0/0 0.5/0.8 1/1\':g=\'0/0 0.5/0.4 1/1\'')
  }
  if (vfx.includes('film-grain')) {
    filters_out.push('noise=alls=8:allf=t+u')
  }

  return filters_out
}

const _audClamp = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d }

/**
 * Build the optional master audio-FX chain (EQ → compression → reverb) from a
 * sanitized AudioMix. EVERY numeric is clamped HERE before the (string-building)
 * audioEffectsService helpers interpolate it, so request data can never inject into
 * the ffmpeg filter graph. Returns '' when no FX requested. Pure + testable.
 */
function buildMasterFx(a = {}) {
  const parts = []
  let svc
  try { svc = require('./audioEffectsService') } catch (_) { return '' }
  if (a.eq && Array.isArray(a.eq.bands) && a.eq.bands.length) {
    const bands = a.eq.bands.slice(0, 8).map((b) => ({
      frequency: _audClamp(b.frequency, 20, 20000, 1000),
      gain: _audClamp(b.gain != null ? b.gain : b.g, -24, 24, 0),
      q: _audClamp(b.q, 0.1, 10, 1),
    }))
    parts.push(svc.buildEQFilter({ bands }))
  }
  if (a.compression && typeof a.compression === 'object') {
    parts.push(svc.buildCompressionFilter({
      threshold: _audClamp(a.compression.threshold, -60, 0, -12),
      ratio: _audClamp(a.compression.ratio, 1, 20, 4),
      attack: _audClamp(a.compression.attack, 0, 2000, 5),
      release: _audClamp(a.compression.release, 0, 5000, 50),
      makeupGain: _audClamp(a.compression.makeupGain, 0, 24, 0),
    }))
  }
  if (a.reverb && typeof a.reverb === 'object') {
    parts.push(svc.buildReverbFilter({
      roomSize: _audClamp(a.reverb.roomSize, 0, 1, 0.5),
      damping: _audClamp(a.reverb.damping, 0, 1, 0.5),
    }))
  }
  return parts.filter(Boolean).join(',')
}

// Voice-clarity chains per audio preset (the part after the de-hum aeval prefix).
const VOICE_PRESETS = {
  'podcast-clean': 'highpass=f=80,lowpass=f=12000,dynaudnorm=p=0.9:m=100',
  'music-forward': 'highpass=f=90,dynaudnorm=p=0.85:m=80',
  'voice-boost': 'highpass=f=80,lowpass=f=13000,dynaudnorm=p=0.95:m=120,acompressor=threshold=-18dB:ratio=3:attack=20:release=200:makeup=3',
  'none': 'anull',
}
const DEFAULT_VOICE = 'highpass=f=80,lowpass=f=12000,dynaudnorm=p=0.9:m=100'

/**
 * Resolve an AudioMix (from the RenderTree, attacker-influenced) into clamped,
 * splice-ready pieces. Absent/empty → all neutral so the rendered graph is BYTE-
 * IDENTICAL to the pre-feature behavior. Pure + exported for tests.
 *   musicVolume: number|null  (null → use the per-segment default)
 *   duckLevel:   number|null  (dB, null → exportOptions default)
 *   musicFade:   string       (',afade=…' to append to the music input, or '')
 *   voice:       string|null  (voice-clarity chain, null → DEFAULT_VOICE)
 *   masterFx:    string       ('eq…,acompressor…' or '')
 */
function buildAudioMix(audio, { duration } = {}) {
  const a = (audio && typeof audio === 'object') ? audio : {}
  const musicVolume = _audClamp(a.musicVolume, 0, 2, null)
  const duckLevel = _audClamp(a.duckingAmount, -40, 0, null)
  const fadeIn = _audClamp(a.fadeInSec, 0, 10, 0)
  const fadeOut = _audClamp(a.fadeOutSec, 0, 10, 0)
  const preset = Object.prototype.hasOwnProperty.call(VOICE_PRESETS, a.audioPreset) ? a.audioPreset : null
  let musicFade = ''
  if (fadeIn > 0) musicFade += `,afade=t=in:d=${fadeIn}`
  if (fadeOut > 0 && Number.isFinite(duration) && duration > fadeOut) {
    musicFade += `,afade=t=out:st=${(duration - fadeOut).toFixed(2)}:d=${fadeOut}`
  }
  return {
    musicVolume,
    duckLevel,
    musicFade,
    voice: preset ? VOICE_PRESETS[preset] : null,
    masterFx: buildMasterFx(a),
    preset,
  }
}

/**
 * Build LUT approximation filter (colorchannelmixer/curves) for preset LUTs
 * Uses FFmpeg colorchannelmixer/curves since we don't have .cube files
 */
function buildLUTApproximation(lutId) {
  if (!lutId || lutId === 'none') return []
  switch (lutId) {
  case 'cinematic':
    return ['colorchannelmixer=rr=0.95:gg=0.9:bb=0.85', 'eq=contrast=1.08:saturation=0.95']
  case 'bleach':
    return ['colorchannelmixer=rr=0.9:gg=0.88:bb=0.95', 'eq=contrast=1.12:saturation=0.7']
  case 'log709':
    return ['colorchannelmixer=rr=1.05:gg=1.02:bb=1.0', 'eq=contrast=1.05:brightness=0.02']
  default:
    return []
  }
}

/**
 * 2026 Caption Style Map — shared with Auto-Edit for consistency
 * Ensures manual edits look identical to AI auto-edits
 */
// fontSize values are the baseline for a 1080-WIDE frame; they are scaled to the
// real output width in buildDrawTextFilter so text is proportional on every
// aspect (9:16 / 1:1 / 16:9). y-offsets are expressed as a fraction of frame
// HEIGHT (not fixed px) so the vertical placement is correct on any frame
// height — a fixed `-360px` would land mid-frame on a 1080-tall output.
const CAPTION_STYLE_MAP = {
  hook:     { fontColor: '#FFD700', bgColor: 'black@0.9', fontSize: 82, y: 'h-text_h-(h*0.1875)', borderColor: '#FFD700', borderw: 4, shadow: 4 },
  stat:     { fontColor: '#00FFFF', bgColor: 'black@0.85', fontSize: 72, y: 'h-text_h-(h*0.1667)', borderColor: '#00FFFF', borderw: 3, shadow: 3 },
  question: { fontColor: '#FFFFFF', bgColor: 'black@0.85', fontSize: 64, y: 'h/2.2',                borderColor: '#FFFFFF', borderw: 2, shadow: 2 },
  punchline: { fontColor: '#FF3366', bgColor: 'black@0.9', fontSize: 76, y: 'h-text_h-(h*0.1667)', borderColor: '#FF3366', borderw: 3, shadow: 4 },
  CTA:      { fontColor: '#FFD700', bgColor: 'black@0.95', fontSize: 60, y: 'h-text_h-(h*0.125)',  borderColor: '#FFD700', borderw: 2, shadow: 2 },
  default:  { fontColor: '#FFFFFF', bgColor: 'black@0.8',  fontSize: 58, y: 'h-text_h-(h*0.1667)', borderColor: 'black',   borderw: 2, shadow: 2 },
};

/**
 * Resolves a valid TTF/OTF font file on the server's filesystem
 * to avoid FFmpeg drawtext crashes when Sans/Arial defaults are missing.
 */
function getSystemFontPath() {
  const possiblePaths = [
    // macOS Supplemental Fonts
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/System/Library/Fonts/Supplemental/Helvetica.ttf',
    '/System/Library/Fonts/Supplemental/Verdana.ttf',
    '/System/Library/Fonts/Supplemental/Georgia.ttf',
    '/System/Library/Fonts/Supplemental/Impact.ttf',
    // macOS Core Fonts
    '/System/Library/Fonts/Helvetica.dfont',
    '/System/Library/Fonts/Arial.ttf',
    '/Library/Fonts/Arial.ttf',
    '/Library/Fonts/Microsoft/Arial.ttf',
    // Linux truetype Fonts
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    '/usr/share/fonts/truetype/msttcorefonts/Arial.ttf',
    '/usr/share/fonts/truetype/msttcorefonts/arial.ttf',
    // Windows Fonts
    'C:\\Windows\\Fonts\\arial.ttf'
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

// ── Emoji support ──────────────────────────────────────────────────────────
// Emoji are ALWAYS stripped from the main text drawtext so the body font never
// renders a tofu box; they're re-rendered as a separate drawtext using a colour
// emoji font ONLY when one is available (else honestly omitted on export — the
// editor preview still shows them via the browser).
const EMOJI_RE = /\p{Extended_Pictographic}/gu;
let _emojiFontResolved;
function getEmojiFontPath() {
  if (_emojiFontResolved !== undefined) return _emojiFontResolved;
  const candidates = [
    process.env.EMOJI_FONT_PATH,
    '/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf',
    '/usr/share/fonts/NotoColorEmoji.ttf',
    '/usr/share/fonts/google-noto-emoji/NotoColorEmoji.ttf',
    '/usr/share/fonts/truetype/ancient-scripts/Symbola_hint.ttf',
  ].filter(Boolean);
  _emojiFontResolved = null;
  for (const p of candidates) {
    try { if (fs.existsSync(p)) { _emojiFontResolved = p; break; } } catch (_) { /* ignore */ }
  }
  return _emojiFontResolved;
}
function stripEmoji(s) {
  return String(s == null ? '' : s).replace(EMOJI_RE, '').replace(/[️‍]/gu, '').replace(/\s+/g, ' ').trim();
}
function extractEmoji(s) {
  const m = String(s == null ? '' : s).match(EMOJI_RE);
  return m ? m.join('') : '';
}

/**
 * Safely escape text for FFmpeg drawtext filter.
 * Escapes characters like commas, semicolons, backticks, and brackets to prevent filtergraph breakups.
 */
function escapeFfmpegText(text) {
  return String(text || '')
    .replace(/[\r\n]+/g, ' ')          // newlines → space
    .replace(/\\/g, '\\\\')             // backslash first (everything below adds backslashes)
    .replace(/'/g, "’")               // single quote -> typographic quote
    .replace(/`/g, '\\`')               // backtick (command injection guard)
    .replace(/;/g, '\\;')               // semicolon (filter-graph separator guard)
    .replace(/,/g, '\\,')               // comma (drawtext arg separator guard)
    .replace(/\[/g, '\\[')              // brackets (filter-link labels guard)
    .replace(/\]/g, '\\]')
    .replace(/:/g, '\\:')               // colon (filter option separator guard)
    .replace(/%/g, '\\%')               // percent (drawtext format spec guard)
    .substring(0, 80)                   // hard-cap length to prevent filter overflow
}

/**
 * Build drawtext filter for a text overlay — fully 2026-compatible
 * Applies same visual treatment as AI auto-edit for brand consistency
 */
/**
 * Greedy word-wrap into at most `maxLines` lines of ≤ maxChars. The final line
 * absorbs any overflow so no words are dropped. Returns [] for empty input.
 */
function wrapTextToLines(text, maxChars, maxLines = 3) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const mc = Math.max(4, Math.round(maxChars))
  const lines = []
  let cur = ''
  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    const candidate = cur ? `${cur} ${word}` : word
    if (candidate.length <= mc || !cur) {
      cur = candidate
    } else {
      lines.push(cur)
      cur = word
      if (lines.length === maxLines - 1) {
        lines.push(words.slice(i).join(' '))
        return lines
      }
    }
  }
  if (cur) lines.push(cur)
  return lines.slice(0, maxLines)
}

// Power/curiosity words that earn an auto-highlight in a caption.
const POWER_RE = /\b(how|why|secret|proven|ultimate|fast|easy|free|best|stop|never|always|mistake|worst|insane|crazy|nobody|everyone|now|new|first|biggest|money|viral|hack|trick|truth|warning)\b/i

// Valid ffmpeg xfade modes + friendly-name aliases used by the editor.
const XFADE_OK = new Set(['fade', 'fadeblack', 'fadewhite', 'wipeleft', 'wiperight',
  'wipeup', 'wipedown', 'slideleft', 'slideright', 'slideup', 'slidedown', 'dissolve',
  'circleopen', 'circleclose', 'pixelize', 'radial', 'smoothleft', 'smoothright',
  'smoothup', 'smoothdown'])
const XFADE_ALIASES = {
  crossfade: 'fade', dip: 'fadeblack', 'dip-to-black': 'fadeblack',
  'wipe-left': 'wipeleft', 'wipe-right': 'wiperight', 'wipe-up': 'wipeup', 'wipe-down': 'wipedown',
  zoom: 'pixelize', whip: 'slideleft', 'whip-left': 'slideleft', 'whip-right': 'slideright',
  flash: 'fadewhite', 'slide-up': 'smoothup', 'slide-down': 'smoothdown',
  iris: 'circleopen', glitch: 'pixelize',
}

/**
 * PURE: resolve a transition name (raw xfade OR an editor friendly name) to a
 * VALID xfade mode, or null for none/empty (→ plain concat, no transition).
 */
function resolveXfadeName(name) {
  const n = String(name || '').toLowerCase().trim()
  if (!n || n === 'none') return null
  if (XFADE_OK.has(n)) return n
  if (XFADE_ALIASES[n]) return XFADE_ALIASES[n]
  return 'fade'
}

/** Normalize a word for keyword matching (lowercase, strip punctuation). */
function normWord(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * One drawtext for a caption's emoji, rendered with a colour emoji font BELOW
 * the caption. Returns null when there's no emoji OR no emoji font (honest skip
 * — never a tofu box). ctx provides the caption geometry/timing.
 */
function buildEmojiDrawtext(emoji, ctx) {
  if (!emoji) return null
  const fontPath = getEmojiFontPath()
  if (!fontPath) return null
  const safe = escapeFfmpegText(emoji)
  if (!safe) return null
  const fontfileOpt = `:fontfile='${fontPath.replace(/\\/g, '/').replace(/:/g, '\\:')}'`
  const size = Math.round(ctx.fontSize * 1.05)
  // Below the caption block, centered.
  const yExpr = `(${ctx.baseYExpr})+${Math.round(ctx.lineHeight * Math.max(1, ctx.lineCount) * 0.95)}`
  const safeY = ctx.safeZone === false ? yExpr : `max(h*0.04\\,min((${yExpr})\\,h*0.95-text_h))`
  return `drawtext=text='${safe}'${fontfileOpt}:fontsize=${size}:x='(w-text_w)/2':y='${safeY}':enable='between(t\\,${ctx.start}\\,${ctx.end})'`
}

/**
 * PURE: pick the most "punchy" words in a caption to auto-highlight (power words,
 * numbers, and longer content words). Returns up to `max` normalized words.
 */
function pickHighlightWords(text, max = 2) {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  const scored = words.map((w) => {
    const n = normWord(w)
    if (!n) return null
    let score = 0
    if (POWER_RE.test(w)) score += 3
    if (/\d/.test(w)) score += 3
    if (n.length >= 6) score += 2
    else if (n.length >= 4) score += 1
    if (w === w.toUpperCase() && n.length > 2) score += 1
    return { n, score }
  }).filter(Boolean).filter((x) => x.score > 0)
  scored.sort((a, b) => b.score - a.score)
  const out = []
  const seen = new Set()
  for (const s of scored) {
    if (seen.has(s.n)) continue
    seen.add(s.n)
    out.push(s.n)
    if (out.length >= Math.max(1, max)) break
  }
  return out
}

/**
 * Word-by-word ("karaoke") caption: each word flashes on, centered + synced to
 * its spoken timing — the viral single-word style. Reuses buildDrawTextFilter
 * per word so every word inherits the auto-fit / wrap / safe-zone treatment.
 * Designated keywords (overlay.highlightWords) render in overlay.highlightColor.
 */
function buildWordByWordFilter(overlay, dims) {
  const words = Array.isArray(overlay.words) ? overlay.words : []
  const highlightSet = new Set((Array.isArray(overlay.highlightWords) ? overlay.highlightWords : []).map(normWord).filter(Boolean))
  const highlightColor = overlay.highlightColor
  const filters = []
  for (const w of words) {
    if (!w) continue
    const text = stripEmoji(String(w.word ?? w.text ?? ''))
    if (!text) continue
    const start = Number(w.start ?? w.startTime)
    const end = Number(w.end ?? w.endTime ?? (start + 0.4))
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue
    // Keyword → highlight colour for this word; others keep the base colour.
    const isKey = highlightColor && highlightSet.has(normWord(text))
    // Strip the word-mode markers so the per-word call renders a normal caption.
    const single = {
      ...overlay, text, startTime: start, endTime: end,
      words: undefined, captionMode: undefined, karaoke: undefined, highlightWords: undefined, emoji: undefined,
      ...(isKey ? { color: highlightColor } : {}),
    }
    const f = buildDrawTextFilter(single, dims)
    if (f) filters.push(f)
  }

  // One emoji for the whole karaoke caption (spanning all words), below it.
  const emoji = overlay.emoji || extractEmoji(overlay.text)
  if (emoji && words.length) {
    const fw = Math.max(2, Math.round(Number(dims.width) || 1080))
    const starts = words.map((w) => Number(w && (w.start ?? w.startTime))).filter(Number.isFinite)
    const ends = words.map((w) => Number(w && (w.end ?? w.endTime))).filter(Number.isFinite)
    if (starts.length && ends.length) {
      const ef = buildEmojiDrawtext(emoji, {
        fontSize: Math.round((Number(overlay.fontSize) || 70) * (fw / 1080)),
        baseYExpr: 'h-text_h-(h*0.1667)', lineHeight: 0, lineCount: 0,
        start: Math.min(...starts).toFixed(3), end: Math.max(...ends).toFixed(3), safeZone: overlay.safeZone,
      })
      if (ef) filters.push(ef)
    }
  }
  return filters.length ? filters.join(',') : null
}

function buildDrawTextFilter(overlay, dims = {}) {
  // Word-by-word mode: expand into per-word, time-synced single-word captions.
  if (Array.isArray(overlay.words) && overlay.words.length &&
      (overlay.captionMode === 'word' || overlay.karaoke === true)) {
    return buildWordByWordFilter(overlay, dims)
  }

  // Strip emoji from the body text (rendered separately with an emoji font so the
  // body font never shows a tofu box). An overlay may also carry an explicit emoji.
  const overlayEmoji = overlay.emoji || extractEmoji(overlay.text)
  const rawText = stripEmoji((overlay.text || '').toUpperCase())
  if (!rawText) {
    // Emoji-only caption: render just the emoji (if a font exists), else nothing.
    const startN = Number(overlay.startTime ?? 0).toFixed(3)
    const endN = Number(overlay.endTime ?? (Number(overlay.startTime ?? 0) + 3)).toFixed(3)
    const fW = Math.max(2, Math.round(Number(dims.width) || 1080))
    const ef = overlayEmoji ? buildEmojiDrawtext(overlayEmoji, {
      fontSize: Math.round(58 * (fW / 1080)), baseYExpr: 'h-text_h-(h*0.1667)',
      lineHeight: 0, lineCount: 0, start: startN, end: endN, safeZone: overlay.safeZone,
    }) : null
    return ef
  }

  // Output frame dimensions — text auto-fits/auto-adjusts to these. Default to
  // the canonical 9:16 the px baselines were tuned for, so legacy callers that
  // don't pass dims are unchanged.
  const frameW = Math.max(2, Math.round(Number(dims.width) || 1080))
  const frameH = Math.max(2, Math.round(Number(dims.height) || 1920))

  const safeText = escapeFfmpegText(rawText)
  const textLen = safeText.length
  // captionPreset (editor's one-click caption style) takes precedence over the
  // generic visual `style`/`type` for the CAPTION_STYLE_MAP lookup.
  const style = overlay.captionPreset || overlay.style || overlay.type || 'default'
  const sty = CAPTION_STYLE_MAP[style] || CAPTION_STYLE_MAP.default

  // If manual color explicitly set, use it; otherwise use style preset. User
  // colors are whitelisted through cssColorToFfmpeg (→ safe 0xRRGGBB / [a-z]
  // name token) so they can't break out of the single-quoted filter option.
  const fontColor = overlay.color ? ffColor(overlay.color, sty.fontColor) : sty.fontColor
  const rawBg = overlay.backgroundColor || overlay.background || null
  const bgColor = rawBg ? ffColor(rawBg, sty.bgColor) : sty.bgColor

  // Positioning: explicit x/y (percentage-based from editor) or style defaults.
  // Percentages are clamped to a safe margin [2,98] so text never renders flush
  // to / off the frame edge. The (w-text_w)*pct form already keeps text on-frame
  // for pct in [0,100] (text_w is subtracted), so clamping the pct + fitting the
  // font width below guarantees text stays inside the frame on every aspect.
  const safePct = (v, def) => {
    const n = Number(v)
    return Math.max(2, Math.min(98, Number.isFinite(n) ? n : def))
  }
  const x = overlay.x !== undefined
    ? `(w-text_w)*${safePct(overlay.x, 50) / 100}`
    : '(w-text_w)/2'

  const y = overlay.y !== undefined
    ? `(h-text_h)*${safePct(overlay.y, 50) / 100}`
    : sty.y

  // ── Font size + multi-line WRAP: AUTO-FIT / AUTO-ADJUST to the output frame ──
  // 1) Desired display size = px baseline (tuned for 1080w) scaled to real width,
  //    so text is the same proportion on 9:16 / 1:1 / 16:9. Short single words
  //    get a punch; very-long single lines are handled by wrapping, not shrinking.
  // 2) Wrap into ≤3 big readable lines that each fit ~92% of the frame width
  //    (the pro caption look) instead of shrinking one long line to tiny text.
  // 3) Size the font to the LONGEST wrapped line so it always fits horizontally.
  // 4) Clamp to a readable floor (14) and a per-line ceiling (~1/7 frame height
  //    so up to 3 lines stay on-frame).
  const GLYPH_ADVANCE = 0.58 // uppercase bold ≈ 0.58em average advance
  let baseFont = (Number(overlay.fontSize) || sty.fontSize) * (frameW / 1080)
  if (textLen < 10) baseFont *= 1.2
  baseFont = Math.max(14, Math.min(baseFont, frameH / 7))

  const maxCharsPerLine = Math.max(8, Math.floor((frameW * 0.92) / (baseFont * GLYPH_ADVANCE)))
  const lines = wrapTextToLines(rawText, maxCharsPerLine, 3)
  const longestLen = lines.reduce((m, l) => Math.max(m, l.length), 1)

  // Shrink only if the longest line still can't fit (e.g. one very long word).
  const maxByWidth = (frameW * 0.92) / longestLen / GLYPH_ADVANCE
  let fontSize = Math.min(baseFont, maxByWidth)
  fontSize = Math.round(Math.max(14, Math.min(fontSize, frameH / 7)))
  const lineCount = Math.max(1, lines.length)
  const lineHeight = Math.round(fontSize * 1.22)

  const start = Number(overlay.startTime ?? 0).toFixed(3)
  const end   = Number(overlay.endTime   ?? (Number(overlay.startTime ?? 0) + 3)).toFixed(3)

  // Kinetic displacement for high-impact styles
  // 2026 Kinetic Typography: All manual text now organically breathes to feel alive
  let finalY = `(${y})-5*sin(t*3.5)`
  if (style === 'hook' || style === 'punchline') {
    // Snappy periodic bounce for high impact
    finalY = `(${y})-15*sin(2*PI*t/0.4)`
  }

  // Script-aware: a Noto font when the caption is CJK/Arabic/Thai/Devanagari and
  // one is installed, else the Latin default — so non-Latin captions aren't tofu.
  const fontPath = notoFontForText(rawText) || getSystemFontPath()
  const fontfileOpt = fontPath ? `:fontfile='${fontPath.replace(/\\/g, '/').replace(/:/g, '\\:')}'` : ''

  // ── Editor parity: animationIn/Out + per-overlay keyframes ──
  // Time-based ramps for fade (alpha), pop/scale/zoom/flip (fontsize), slide
  // (x/y offsets). When keyframes are present they additionally drive
  // x/y/scale/opacity across absolute time. Falls back to the existing kinetic
  // behavior when no animation/keyframe is set (no regression).
  const startN = Number(start)
  const endN = Number(end)
  const anim = buildTextAnimation(overlay, startN, endN)

  // Font size is INTENTIONALLY constant: animating drawtext's fontsize per
  // frame crashes ffmpeg in this pipeline (see buildTextAnimation safety note).
  // Scale-style animations and keyframe `scale` are expressed via alpha/opacity
  // instead. Keyframe x/y/opacity remain fully honored below.
  const fontSizeOpt = `fontsize=${fontSize}`
  let finalX = x
  let finalYExpr = finalY
  let alphaOpt = ''

  const kf = Array.isArray(overlay.keyframes) ? overlay.keyframes : null
  const kfOpacity = kf ? buildKeyframeExpr(kf, 'opacity', 1) : null
  const kfPx = kf ? buildKeyframeExpr(kf, 'positionX', 0) : null
  const kfPy = kf ? buildKeyframeExpr(kf, 'positionY', 0) : null

  // X/Y: combine base position with slide offsets (% of frame) and keyframe % offsets.
  if (anim.xOff || kfPx) {
    const slide = anim.xOff ? `+w*(${anim.xOff})` : ''
    const kfp = kfPx ? `+w*(${kfPx})/100` : ''
    finalX = `(${x})${slide}${kfp}`
  }
  if (anim.yOff || kfPy) {
    const slide = anim.yOff ? `+h*(${anim.yOff})` : ''
    const kfp = kfPy ? `+h*(${kfPy})/100` : ''
    finalYExpr = `(${finalY})${slide}${kfp}`
  }

  // Alpha: combine animation alpha and keyframe opacity (drawtext `alpha` opt).
  if (anim.alpha || kfOpacity) {
    const a = anim.alpha ? `(${anim.alpha})` : '1'
    const o = kfOpacity ? `(${kfOpacity})` : '1'
    alphaOpt = `:alpha='min(${a}\\,${o})'`
  }

  // Emit one drawtext per wrapped line, vertically centered around the base y so
  // a 2–3 line caption stays a tidy block. All lines share the size / color /
  // box / border / shadow / animation; only the text + y offset differ. Stacking
  // separate drawtext filters avoids the (filter-breaking) newline-in-text path.
  const renderLines = (lines.length ? lines : [rawText])
  const drawForLine = (lineText, idx) => {
    const safeLine = escapeFfmpegText(lineText)
    const offset = Math.round((idx - (renderLines.length - 1) / 2) * lineHeight)
    const lineY = offset === 0 ? finalYExpr : `(${finalYExpr})+(${offset})`
    // ── Safe-zone clamp ──
    // Keep every line inside [4%, 92%] of the frame height so captions never go
    // off the top or collide with the TikTok/Reels bottom UI band. Gentle: only
    // bites at the extremes; normal lower-third captions are unaffected. Opt out
    // with overlay.safeZone === false (explicit editor placement).
    const safeY = overlay.safeZone === false
      ? lineY
      : `max(h*0.04\\,min((${lineY})\\,h*0.92-text_h))`
    return `drawtext=text='${safeLine}'${fontfileOpt}:${fontSizeOpt}:fontcolor='${fontColor}':x='${finalX}':y='${safeY}'${alphaOpt}:box=1:boxcolor='${bgColor}':boxborderw=18:borderw=${sty.borderw || 2}:bordercolor='${sty.borderColor}':shadowcolor=black@0.8:shadowx=${sty.shadow || 0}:shadowy=${sty.shadow || 0}:enable='between(t\\,${start}\\,${end})'`
  }
  const out = renderLines.map(drawForLine)
  // Append the emoji (rendered with the emoji font, below the caption) — honest
  // no-op when there's no emoji or no emoji font.
  const ef = buildEmojiDrawtext(overlayEmoji, {
    fontSize, baseYExpr: finalYExpr, lineHeight, lineCount: renderLines.length, start, end, safeZone: overlay.safeZone,
  })
  if (ef) out.push(ef)
  return out.join(',')
}

/**
 * Build drawbox filter for a shape overlay
 */
function buildDrawBoxFilter(shape) {
  const start = Number(shape.startTime ?? shape.start ?? 0)
  const end = Number(shape.endTime ?? shape.end ?? 5)
  const enable = `between(t\\,${start.toFixed(3)}\\,${end.toFixed(3)})`
  // NOTE: in the drawbox filter, `w`/`h` resolve to the BOX width/height, not the
  // frame. Frame dimensions must be referenced as `iw`/`ih` (or in_w/in_h).
  // The earlier implementation used bare `w`/`h` here, which made ffmpeg fail to
  // evaluate the x/y expressions ("Error when evaluating the expression") and
  // silently aborted every shape-overlay render. Use iw/ih for frame dims.
  const x = shape.x !== undefined ? `(iw*${Number(shape.x) / 100})-(iw*${(Number(shape.width) || 20) / 100})/2` : '(iw-iw*0.2)/2'
  const y = shape.y !== undefined ? `(ih*${Number(shape.y) / 100})-(ih*${(Number(shape.height) || 20) / 100})/2` : '(ih-ih*0.2)/2'
  const w = `iw*${(Number(shape.width) || 20) / 100}`
  const h = shape.kind === 'line' ? (Number(shape.strokeWidth) || 2) : `ih*${(Number(shape.height) || 20) / 100}`
  const color = String(shape.color || '#ffffff').replace('#', '0x')
  let alpha = clampNum(shape.opacity, 0, 1, 0.5)

  // ── Editor parity: per-overlay keyframes ──
  // drawbox supports time EXPRESSIONS for x/y/w/h but its color `@alpha` MUST be
  // a CONSTANT ("Invalid alpha value specifier" otherwise). So we animate
  // position via keyframes, and approximate keyframed opacity by collapsing it
  // to the keyframes' average value (a constant) — documented limitation.
  const kf = Array.isArray(shape.keyframes) ? shape.keyframes : null
  let finalX = x
  let finalY = y
  if (kf) {
    const kfPx = buildKeyframeExpr(kf, 'positionX', 0)
    const kfPy = buildKeyframeExpr(kf, 'positionY', 0)
    if (kfPx) finalX = `(${x})+iw*(${kfPx})/100`
    if (kfPy) finalY = `(${y})+ih*(${kfPy})/100`
    const opVals = kf.filter(k => Number.isFinite(Number(k && k.opacity))).map(k => Number(k.opacity))
    if (opVals.length) alpha = clampNum(opVals.reduce((a, b) => a + b, 0) / opVals.length, 0, 1, alpha)
  }
  const colorOpt = `${color}@${alpha}`
  return `drawbox=x='${finalX}':y='${finalY}':w='${w}':h='${h}':color=${colorOpt}:t=fill:enable='${enable}'`
}

// ──────────────────────────────────────────────────────────────────────────
// Editor→Export parity helpers (image / svg / gradient overlays, transforms,
// keyframes, text animations). All coords are PERCENT (0–100); opacity 0–1;
// times absolute seconds. Every builder is defensive: malformed input is
// clamped or skipped (with a warn) so a single bad overlay never crashes a
// render.
// ──────────────────────────────────────────────────────────────────────────

/** Clamp n to [lo,hi]; returns fallback when not finite. */
function clampNum(n, lo, hi, fallback) {
  const v = Number(n)
  if (!Number.isFinite(v)) return fallback
  return Math.min(hi, Math.max(lo, v))
}

/** FFmpeg time-window expression, comma-escaped for inline use in a chain. */
function enableBetween(start, end) {
  const s = clampNum(start, 0, 1e6, 0)
  const e = clampNum(end, s, 1e6, s + 5)
  return `between(t\\,${s.toFixed(3)}\\,${e.toFixed(3)})`
}

/**
 * Build a piecewise-linear ffmpeg expression interpolating a single keyframe
 * property (positionX/positionY/scale/rotation/opacity) over absolute time `t`.
 * Returns null when there are <1 usable keyframes for the property.
 * Each keyframe time is absolute seconds. Segments lerp linearly; before the
 * first / after the last keyframe the value is held (clamped).
 */
function buildKeyframeExpr(keyframes, prop, fallback) {
  if (!Array.isArray(keyframes) || keyframes.length === 0) return null
  const pts = keyframes
    .filter(k => k && Number.isFinite(Number(k.time)) && Number.isFinite(Number(k[prop])))
    .map(k => ({ t: Number(k.time), v: Number(k[prop]) }))
    .sort((a, b) => a.t - b.t)
  if (pts.length === 0) return null
  if (pts.length === 1) return `(${pts[0].v})`

  // Build nested if(): held before first, lerp between, held after last.
  let expr = `(${pts[pts.length - 1].v})` // value after last kf (held)
  for (let i = pts.length - 1; i > 0; i--) {
    const a = pts[i - 1]
    const b = pts[i]
    const dt = (b.t - a.t) || 1e-6
    // linear: a.v + (t-a.t)/(b.t-a.t)*(b.v-a.v)
    const lerp = `(${a.v}+((t-${a.t.toFixed(3)})/${dt.toFixed(6)})*(${b.v - a.v}))`
    expr = `if(lt(t\\,${b.t.toFixed(3)})\\,${lerp}\\,${expr})`
  }
  // Held before first keyframe
  expr = `if(lt(t\\,${pts[0].t.toFixed(3)})\\,(${pts[0].v})\\,${expr})`
  void fallback
  return expr
}

/**
 * Build text in/out animation expressions for drawtext.
 * Returns { alpha, xOff, yOff } where each is an ffmpeg expression string (or
 * null when no animation affects that channel). Times are relative to the
 * overlay's startTime/endTime windows.
 *
 * IMPORTANT ffmpeg-safety note: a TIME-VARYING `fontsize` in drawtext is unsafe
 * on stable ffmpeg builds (5/6/8). Animating fontsize forces drawtext to
 * re-layout glyphs every frame; when its output feeds a downstream
 * scale/pad/denoise chain (as it does in this pipeline's upscale path) it
 * intermittently SIGSEGVs the filter thread and produces a 48-byte empty file.
 * We therefore implement ALL "scale-style" reveals (pop / scale-in / zoom-in /
 * bounce / blur-in / flip-in) via the rock-solid `alpha` channel instead of a
 * fontsize ramp. This is a deliberate, verified approximation:
 *   fade                                   → alpha ramps 0→1 in, 1→0 out
 *   pop / scale-in / zoom-in / bounce      → alpha reveal over animationInDuration
 *                                            (reads as a quick pop-in; the size
 *                                            "punch" is dropped for stability)
 *   blur-in                                → alpha reveal (true per-frame blur on
 *                                            text isn't cheaply expressible)
 *   flip-in                                → alpha reveal (drawtext can't 3D-rotate
 *                                            glyphs)
 *   slide-*                                → x/y offset ramps from off-position to
 *                                            0 during animationInDuration (stable)
 * Per-overlay keyframe `scale` is likewise NOT applied to fontsize (same crash
 * class); keyframes drive x/y/opacity which are safe.
 */
function buildTextAnimation(overlay, start, end) {
  const inAnim = overlay.animationIn || 'none'
  const outAnim = overlay.animationOut || 'none'
  const inDur = clampNum(overlay.animationInDuration ?? 0.4, 0.05, 5, 0.4)
  const outDur = clampNum(overlay.animationOutDuration ?? 0.4, 0.05, 5, 0.4)
  const inEnd = (start + inDur)
  const outStart = (end - outDur)

  let alpha = null
  let xOff = null
  let yOff = null

  // Linear ramps clamped to [0,1]
  const inRamp = `min(1\\,max(0\\,(t-${start.toFixed(3)})/${inDur.toFixed(3)}))`
  const outRamp = `min(1\\,max(0\\,(${end.toFixed(3)}-t)/${outDur.toFixed(3)}))`

  // Scale-style reveals are routed through alpha (see safety note above).
  const ALPHA_REVEAL_IN = ['fade', 'pop', 'scale-in', 'zoom-in', 'bounce', 'blur-in', 'flip-in']
  const ALPHA_REVEAL_OUT = ['fade', 'zoom-out', 'scale-out', 'bounce-out', 'flip-out']
  const inNeedsAlpha = ALPHA_REVEAL_IN.includes(inAnim)
  const outNeedsAlpha = ALPHA_REVEAL_OUT.includes(outAnim)
  if (inNeedsAlpha || outNeedsAlpha) {
    const inA = inNeedsAlpha ? inRamp : '1'
    const outA = outNeedsAlpha ? outRamp : '1'
    alpha = `min(${inA}\\,${outA})`
  }

  // Slide offsets (1 unit = full frame dim; caller multiplies by w/h).
  const slideAmt = 0.25 // 25% of frame travel
  const applySlide = (anim, ramp) => {
    const dir = `(1-${ramp})` // eases toward 0 within the window
    switch (anim) {
    case 'slide-top':    return [null, `(-${slideAmt}*${dir})`]
    case 'slide-bottom': return [null, `(${slideAmt}*${dir})`]
    case 'slide-left':   return [`(-${slideAmt}*${dir})`, null]
    case 'slide-right':  return [`(${slideAmt}*${dir})`, null]
    default: return [null, null]
    }
  }
  if (inAnim.startsWith('slide-')) {
    const [dx, dy] = applySlide(inAnim, inRamp)
    if (dx) xOff = `if(lt(t\\,${inEnd.toFixed(3)})\\,${dx}\\,0)`
    if (dy) yOff = `if(lt(t\\,${inEnd.toFixed(3)})\\,${dy}\\,0)`
  }
  if (outAnim.startsWith('slide-')) {
    const [dx, dy] = applySlide(outAnim, outRamp)
    const gate = `gt(t\\,${outStart.toFixed(3)})`
    if (dx) xOff = `(${xOff || '0'})+if(${gate}\\,${dx}\\,0)`
    if (dy) yOff = `(${yOff || '0'})+if(${gate}\\,${dy}\\,0)`
  }

  return { alpha, xOff, yOff }
}

/**
 * CSS color → ffmpeg color token. Handles #hex, rgb()/rgba(), 'transparent',
 * and named colors (passed through; ffmpeg knows the standard set).
 * Returns { color, alpha } with color as 0xRRGGBB or a name, alpha 0–1.
 */
function cssColorToFfmpeg(css) {
  const s = String(css || '').trim().toLowerCase()
  if (!s || s === 'transparent') return { color: '0x000000', alpha: 0 }
  let m = s.match(/^#([0-9a-f]{3})$/i)
  if (m) {
    const h = m[1]
    return { color: `0x${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`, alpha: 1 }
  }
  m = s.match(/^#([0-9a-f]{6})$/i)
  if (m) return { color: `0x${m[1]}`, alpha: 1 }
  m = s.match(/^#([0-9a-f]{8})$/i)
  if (m) return { color: `0x${m[1].slice(0, 6)}`, alpha: parseInt(m[1].slice(6), 16) / 255 }
  m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([0-9.]+)\s*)?\)$/i)
  if (m) {
    const r = clampNum(m[1], 0, 255, 0), g = clampNum(m[2], 0, 255, 0), b = clampNum(m[3], 0, 255, 0)
    const a = m[4] !== undefined ? clampNum(m[4], 0, 1, 1) : 1
    const hex = (n) => n.toString(16).padStart(2, '0')
    return { color: `0x${hex(r)}${hex(g)}${hex(b)}`, alpha: a }
  }
  // Named color — pass through; default fully opaque.
  return { color: s.replace(/[^a-z]/g, '') || 'white', alpha: 1 }
}

/**
 * User color → a single safe ffmpeg color token (`0xRRGGBB`, `name`, or
 * `token@alpha`), falling back to `fallbackToken` for empty input. Output is
 * whitelist-derived from cssColorToFfmpeg, so it never contains quotes/colons.
 */
function ffColor(css, fallbackToken) {
  if (css == null || css === '') return fallbackToken
  const { color, alpha } = cssColorToFfmpeg(css)
  return alpha < 1 ? `${color}@${alpha}` : color
}

/** Parse a css color to {r,g,b,a} for sharp raster generation. */
function cssColorToRgba(css) {
  const { color, alpha } = cssColorToFfmpeg(css)
  if (color.startsWith('0x')) {
    const h = color.slice(2)
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: alpha }
  }
  // Minimal named-color table for gradient fallbacks.
  const named = { black: [0, 0, 0], white: [255, 255, 255], red: [255, 0, 0], green: [0, 128, 0], blue: [0, 0, 255] }
  const c = named[color] || [0, 0, 0]
  return { r: c[0], g: c[1], b: c[2], a: alpha }
}

/**
 * Build a single overlay filter segment for an IMAGE/SVG input (already added
 * as ffmpeg input #inputIdx). Consumes the running [prevLabel] video and the
 * [inputIdx:v] image, producing [outLabel].
 *   - scales image to width%×height% of frame (W,H provided)
 *   - applies opacity via format=rgba,colorchannelmixer=aa
 *   - optional rotation
 *   - keyframed x/y/scale/opacity when overlay.keyframes present
 *   - gated by enable=between(start,end)
 */
function buildImageOverlaySegment(overlay, inputIdx, prevLabel, outLabel, W, H) {
  const start = clampNum(overlay.startTime, 0, 1e6, 0)
  const end = clampNum(overlay.endTime, start, 1e6, start + 5)
  const wPct = clampNum(overlay.width, 0.1, 100, 20) / 100
  const hPct = clampNum(overlay.height, 0.1, 100, 20) / 100
  const opacity = clampNum(overlay.opacity, 0, 1, 1)
  const rotation = clampNum(overlay.rotation, -360, 360, 0)
  const xPct = clampNum(overlay.x, -200, 300, 50) / 100
  const yPct = clampNum(overlay.y, -200, 300, 50) / 100

  const ow = Math.max(2, Math.round(W * wPct))
  const oh = Math.max(2, Math.round(H * hPct))

  const kf = Array.isArray(overlay.keyframes) ? overlay.keyframes : null
  const opacityExpr = kf ? buildKeyframeExpr(kf, 'opacity', opacity) : null
  const pxExpr = kf ? buildKeyframeExpr(kf, 'positionX', 0) : null // % offset
  const pyExpr = kf ? buildKeyframeExpr(kf, 'positionY', 0) : null
  const rotExpr = kf ? buildKeyframeExpr(kf, 'rotation', rotation) : null

  // Prepare the image label: scale → rgba → opacity → optional rotate.
  const imgParts = [`scale=${ow}:${oh}`, 'format=rgba']
  // Opacity: the `overlay` filter has no per-frame alpha multiply, so opacity is
  // baked into the image stream via colorchannelmixer=aa (a CONSTANT). For
  // keyframed opacity we collapse the keyframes to their average value — a
  // documented approximation (true per-frame overlay alpha is not version-robust
  // across ffmpeg 5/6/8). Position keyframes ARE applied per-frame via the
  // overlay x/y expressions below.
  let bakedOpacity = opacity
  if (opacityExpr) {
    const opVals = kf.filter(k => Number.isFinite(Number(k && k.opacity))).map(k => Number(k.opacity))
    if (opVals.length) bakedOpacity = clampNum(opVals.reduce((a, b) => a + b, 0) / opVals.length, 0, 1, opacity)
  }
  if (bakedOpacity < 1) {
    imgParts.push(`colorchannelmixer=aa=${bakedOpacity.toFixed(3)}`)
  }
  if (rotExpr) {
    // Keyframed rotation (degrees → radians). A time-varying `rotate` cannot use
    // rotw()/roth() for output sizing (they evaluate to NaN per-frame), so we
    // pin the output to a fixed square bounding box (the image diagonal) that
    // fits any rotation angle without clipping.
    const diag = Math.ceil(Math.sqrt(ow * ow + oh * oh))
    imgParts.push(`rotate='(${rotExpr})*PI/180':ow=${diag}:oh=${diag}:c=none`)
  } else if (rotation !== 0) {
    const rad = (rotation * Math.PI / 180).toFixed(6)
    imgParts.push(`rotate=${rad}:ow=rotw(${rad}):oh=roth(${rad}):c=none`)
  }
  const imgLabel = `ov${inputIdx}`
  const imgChain = `[${inputIdx}:v]${imgParts.join(',')}[${imgLabel}]`

  // Overlay position: center the image at (xPct*W, yPct*H), plus keyframe % offsets.
  let xExpr = `(main_w*${xPct.toFixed(4)})-(overlay_w/2)`
  let yExpr = `(main_h*${yPct.toFixed(4)})-(overlay_h/2)`
  if (pxExpr) xExpr = `(main_w*${xPct.toFixed(4)})-(overlay_w/2)+(main_w*(${pxExpr})/100)`
  if (pyExpr) yExpr = `(main_h*${yPct.toFixed(4)})-(overlay_h/2)+(main_h*(${pyExpr})/100)`

  const enable = enableBetween(start, end)
  const overlayChain = `[${prevLabel}][${imgLabel}]overlay=x='${xExpr}':y='${yExpr}':enable='${enable}'[${outLabel}]`

  return { chains: [imgChain, overlayChain] }
}

/**
 * Generate a gradient PNG (RGBA) at frame size honoring direction/region/stops.
 * Returns the temp file path. Uses sharp; throws if sharp unavailable.
 */
async function generateGradientPng(grad, W, H, tmpDir) {
  if (!sharp) throw new Error('sharp not available for gradient rasterization')
  const stops = Array.isArray(grad.colorStops) ? grad.colorStops : ['transparent', 'rgba(0,0,0,0.8)']
  const c0 = cssColorToRgba(stops[0] ?? 'transparent')
  const c1 = cssColorToRgba(stops[1] ?? 'rgba(0,0,0,0.8)')
  const opacity = clampNum(grad.opacity, 0, 1, 1)
  const region = grad.region || 'full'
  const direction = grad.direction || 'top-to-bottom'

  // Region band within the frame.
  let bandY0 = 0, bandY1 = H
  if (region === 'lower-third') { bandY0 = Math.round(H * 0.67); bandY1 = H }
  else if (region === 'top-bar') { bandY0 = 0; bandY1 = Math.round(H * 0.20) }
  else if (region === 'top-half') { bandY0 = 0; bandY1 = Math.round(H * 0.5) }
  else if (region === 'bottom-half') { bandY0 = Math.round(H * 0.5); bandY1 = H }

  const buf = Buffer.alloc(W * H * 4, 0) // transparent
  const lerp = (a, b, t) => Math.round(a + (b - a) * t)
  const cx = W / 2, cy = (bandY0 + bandY1) / 2
  const maxR = Math.sqrt(Math.max(cx, W - cx) ** 2 + Math.max(cy - bandY0, bandY1 - cy) ** 2) || 1

  for (let y = bandY0; y < bandY1; y++) {
    for (let x = 0; x < W; x++) {
      let t
      switch (direction) {
      case 'bottom-to-top': t = 1 - (y - bandY0) / Math.max(1, bandY1 - bandY0); break
      case 'left-to-right': t = x / Math.max(1, W - 1); break
      case 'right-to-left': t = 1 - x / Math.max(1, W - 1); break
      case 'radial': t = Math.min(1, Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxR); break
      case 'top-to-bottom':
      default: t = (y - bandY0) / Math.max(1, bandY1 - bandY0); break
      }
      const i = (y * W + x) * 4
      buf[i] = lerp(c0.r, c1.r, t)
      buf[i + 1] = lerp(c0.g, c1.g, t)
      buf[i + 2] = lerp(c0.b, c1.b, t)
      const a = (c0.a + (c1.a - c0.a) * t) * opacity
      buf[i + 3] = Math.round(clampNum(a, 0, 1, 0) * 255)
    }
  }

  const outPath = path.join(tmpDir, `grad-${crypto.randomBytes(6).toString('hex')}.png`)
  await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).png().toFile(outPath)
  return outPath
}

/**
 * Rasterize an SVG (http(s) url | /uploads local file | inline/data-URL) to a
 * PNG at the overlay's target pixel size. Returns the temp PNG path.
 */
async function rasterizeSvgToPng(svgOverlay, W, H, tmpDir) {
  if (!sharp) throw new Error('sharp not available for svg rasterization')
  const url = String(svgOverlay.url || '')
  let svgBuf
  if (/^https?:\/\//i.test(url)) {
    await assertSafeRemote(url) // SSRF: block private/internal targets before fetch
    const res = await fetch(url)
    if (!res.ok) throw new Error(`svg fetch ${res.status}`)
    svgBuf = Buffer.from(await res.arrayBuffer())
  } else if (/^data:image\/svg\+xml/i.test(url)) {
    const comma = url.indexOf(',')
    const payload = url.slice(comma + 1)
    svgBuf = url.slice(0, comma).includes('base64')
      ? Buffer.from(payload, 'base64')
      : Buffer.from(decodeURIComponent(payload), 'utf8')
  } else if (url.trim().startsWith('<svg') || url.trim().startsWith('<?xml')) {
    svgBuf = Buffer.from(url, 'utf8')
  } else {
    // /uploads local file
    const local = toAbsolutePath(url)
    svgBuf = fs.readFileSync(local)
  }
  const ow = Math.max(2, Math.round(W * clampNum(svgOverlay.width, 0.1, 100, 20) / 100))
  const oh = Math.max(2, Math.round(H * clampNum(svgOverlay.height, 0.1, 100, 20) / 100))
  const outPath = path.join(tmpDir, `svg-${crypto.randomBytes(6).toString('hex')}.png`)
  await sharp(svgBuf, { density: 200 }).resize(ow, oh, { fit: 'fill' }).png().toFile(outPath)
  return outPath
}

/**
 * Build the BASE video transform chain (crop → scale → pad → rotate) from
 * videoTransform + videoCrop. Supports keyframed scale/position/rotation via
 * videoTransformKeyframes (interpolated with ffmpeg time expressions).
 * Returns an array of filter strings to prepend to the base [0:v] chain
 * (AFTER the mandatory scale=W:H that the caller emits).
 */
function buildVideoTransformChain(videoTransform, videoCrop, videoTransformKeyframes, W, H) {
  const out = []
  // Crop first (static — % insets relative to frame).
  if (videoCrop && typeof videoCrop === 'object') {
    const cx = clampNum(videoCrop.x, 0, 100, 0) / 100
    const cy = clampNum(videoCrop.y, 0, 100, 0) / 100
    const cw = clampNum(videoCrop.width, 1, 100, 100) / 100
    const ch = clampNum(videoCrop.height, 1, 100, 100) / 100
    out.push(`crop=iw*${cw.toFixed(4)}:ih*${ch.toFixed(4)}:iw*${cx.toFixed(4)}:ih*${cy.toFixed(4)}`)
    // Re-scale back to target so downstream overlays use full-frame coords.
    out.push(`scale=${W}:${H}`)
  }

  const kf = Array.isArray(videoTransformKeyframes) ? videoTransformKeyframes : null
  const t = videoTransform && typeof videoTransform === 'object' ? videoTransform : {}

  const scaleKf = kf ? buildKeyframeExpr(kf, 'scale', 1) : null
  const rotKf = kf ? buildKeyframeExpr(kf, 'rotation', 0) : null
  const pxKf = kf ? buildKeyframeExpr(kf, 'positionX', 0) : null
  const pyKf = kf ? buildKeyframeExpr(kf, 'positionY', 0) : null

  const scaleConst = clampNum(t.scale, 0.05, 10, 1)
  const rotConst = clampNum(t.rotation, -360, 360, 0)
  const pxConst = clampNum(t.positionX, -200, 200, 0)
  const pyConst = clampNum(t.positionY, -200, 200, 0)

  // Zoom/scale + position via zoompan is fiddly; use scale (keyframed via
  // expression on a 2x supersample then crop) — but to stay version-robust we
  // implement scale+pan with the `scale`+`crop` pair when keyframed, and a
  // simple scale+pad+crop for the constant case.
  const hasKf = !!(scaleKf || rotKf || pxKf || pyKf)

  if (hasKf) {
    // Scale up to the keyframed factor by rendering on a padded canvas and
    // cropping a moving window. We scale the source by max factor then crop a
    // W×H window whose origin moves with position/scale keyframes.
    const sExpr = scaleKf || `${scaleConst}`
    const pxExpr = pxKf || `${pxConst}`
    const pyExpr = pyKf || `${pyConst}`
    // Upscale to (W*maxScale)… but ffmpeg scale can't take time expr for size.
    // Robust approach: scale to a fixed 2x canvas, then crop a moving/zooming
    // window via crop with time-expr x/y/w/h.
    const canvas = 2
    out.push(`scale=${W * canvas}:${H * canvas}`)
    // window size shrinks as scale grows: winW = W*canvas/scale
    const winW = `(${W * canvas}/(${sExpr}))`
    const winH = `(${H * canvas}/(${sExpr}))`
    // center + position offset (% of frame → px on the canvas)
    const ox = `((${W * canvas}-${winW})/2)+(${W * canvas}*(${pxExpr})/100)`
    const oy = `((${H * canvas}-${winH})/2)+(${H * canvas}*(${pyExpr})/100)`
    out.push(`crop=w='${winW}':h='${winH}':x='${ox}':y='${oy}'`)
    out.push(`scale=${W}:${H}`)
    if (rotKf) {
      out.push(`rotate='${rotKf}*PI/180':ow=${W}:oh=${H}:c=none`)
    } else if (rotConst !== 0) {
      out.push(`rotate=${(rotConst * Math.PI / 180).toFixed(6)}:ow=${W}:oh=${H}:c=none`)
    }
  } else {
    // Constant transform.
    if (scaleConst !== 1) {
      const sw = Math.max(2, Math.round(W * scaleConst))
      const sh = Math.max(2, Math.round(H * scaleConst))
      out.push(`scale=${sw}:${sh}`)
      if (scaleConst > 1) {
        // crop back to frame, honoring position offset
        const ox = `(in_w-${W})/2+(in_w*${(pxConst / 100).toFixed(4)})`
        const oy = `(in_h-${H})/2+(in_h*${(pyConst / 100).toFixed(4)})`
        out.push(`crop=${W}:${H}:x='${ox}':y='${oy}'`)
      } else {
        // pad back to frame (zoom out), centered + offset
        const padX = `(${W}-iw)/2+(${W}*${(pxConst / 100).toFixed(4)})`
        const padY = `(${H}-ih)/2+(${H}*${(pyConst / 100).toFixed(4)})`
        out.push(`pad=${W}:${H}:x='${padX}':y='${padY}':color=black`)
      }
    } else if (pxConst !== 0 || pyConst !== 0) {
      // pure pan: pad+crop trick to translate without zoom
      out.push(`pad=${W}:${H}:x='${W}*${(pxConst / 100).toFixed(4)}':y='${H}*${(pyConst / 100).toFixed(4)}':color=black`)
    }
    if (rotConst !== 0) {
      out.push(`rotate=${(rotConst * Math.PI / 180).toFixed(6)}:ow=${W}:oh=${H}:c=none`)
    }
  }
  return out
}

/**
 * Resolve input path from Content or videoUrl
 */
function isRemoteUrl(p) {
  return typeof p === 'string' && /^https?:\/\//i.test(p)
}

// SSRF guard: any http(s) URL ffmpeg/fetch will reach must resolve to a PUBLIC
// address. urlGuard.assertPublicUrl resolves every DNS record and throws a
// BlockedUrlError on private/loopback/link-local/metadata ranges. Local paths
// (already resolved to absolute) pass straight through. Returns the input so it
// can be used inline: `const s = await assertSafeRemote(url)`.
async function assertSafeRemote(u) {
  if (isRemoteUrl(u)) await urlGuard.assertPublicUrl(u)
  return u
}

async function resolveInputPath(videoId, videoUrl) {
  // ffmpeg can read http(s) URLs directly (e.g. Cloudinary/S3). Pass them
  // through untouched — toAbsolutePath() would otherwise mangle
  // "https://host/x.mp4" into "<cwd>/https:/host/x.mp4" and the file would
  // then look like a missing local path.
  if (videoUrl) return isRemoteUrl(videoUrl) ? await assertSafeRemote(videoUrl) : toAbsolutePath(videoUrl);
  if (!videoId) throw new Error('Video not found: provide videoId or videoUrl')
  const content = await Content.findById(videoId)
  if (!content || !content.originalFile?.url) {
    throw new Error('Video not found in database')
  }
  const url = content.originalFile.url
  return isRemoteUrl(url) ? await assertSafeRemote(url) : toAbsolutePath(url);
}

/**
 * Render video from editor state
 * @param {Object} options
 * @param {string} options.videoId - Content ID
 * @param {string} [options.videoUrl] - Optional video URL (override)
 * @param {Object} options.videoFilters - Editor video filters
 * @param {Array} options.textOverlays - Text overlays
 * @param {Array} [options.shapeOverlays] - Shape overlays
 * @param {Object} options.exportOptions - { width, height, bitrateMbps, codec, duckMusicWhenVoiceover, duckLevel }
 * @param {Array} [options.timelineSegments] - Timeline segments (for music mixing + ducking)
 * @returns {Promise<{ outputPath: string, url?: string }>}
 */

// Compile the editor's `timelineEffects[]` into time-gated FFmpeg video filters.
// Each effect applies only within its [startTime,endTime] window via the filter
// `enable='between(t,a,b)'` option, so multiple effects coexist without changing
// the timeline structure or duration. Maps the color/overlay FX that translate
// cleanly to single-pass filters (vignette, grain, chromatic aberration, glow,
// flash/brightness, generic color). Motion/zoom/transition/speed effects need
// structural changes (stitch/transition path) and are skipped here with a log,
// not silently — so they never corrupt the graph.
function compileTimelineEffects(effects) {
  if (!Array.isArray(effects) || effects.length === 0) return []
  const out = []
  for (const e of effects.slice(0, 50)) {
    if (!e || e.enabled === false) continue
    const start = Number(e.startTime) || 0
    const end = Number.isFinite(Number(e.endTime)) ? Number(e.endTime) : start + 3
    if (!(end > start)) continue
    const en = `enable='between(t\\,${start.toFixed(3)}\\,${end.toFixed(3)})'`
    const k = Math.max(0, Math.min(100, Number(e.intensity ?? 100))) / 100
    const p = (e && e.params) || {}
    const name = String((e && e.name) || '').toLowerCase()
    const type = String((e && e.type) || '').toLowerCase()
    try {
      if (/vignette/.test(name)) {
        out.push(`vignette=angle=${(Math.PI / 5 + (Math.PI / 6) * k).toFixed(4)}:${en}`)
      } else if (/grain|film/.test(name)) {
        const amt = Math.round(8 + 32 * k * (Number(p.amount) ? Number(p.amount) / 30 : 1))
        out.push(`noise=alls=${Math.max(1, Math.min(60, amt))}:allf=t+u:${en}`)
      } else if (/chromat|aberration|rgb/.test(name)) {
        const off = Math.max(1, Math.min(12, Math.round(Number(p.offset) || (3 + 3 * k))))
        out.push(`rgbashift=rh=${off}:bv=${-off}:${en}`)
      } else if (/glow|bloom|neural/.test(name)) {
        out.push(`gblur=sigma=${(1 + 3 * k).toFixed(2)}:${en}`)
      } else if (/flash|leak|light/.test(name)) {
        out.push(`eq=brightness=${(0.25 * k).toFixed(3)}:saturation=${(1 + 0.3 * k).toFixed(3)}:${en}`)
      } else if (type === 'filter' || type === 'style' || type === 'retention') {
        const b = Number.isFinite(Number(p.brightness)) ? Number(p.brightness) : 0
        const c = Number.isFinite(Number(p.contrast)) ? Number(p.contrast) : 1
        const s = Number.isFinite(Number(p.saturation)) ? Number(p.saturation) : 1 + 0.1 * k
        out.push(`eq=brightness=${b.toFixed(3)}:contrast=${c.toFixed(3)}:saturation=${s.toFixed(3)}:${en}`)
      } else if (type === 'audio' || type === 'motion' || type === 'transition' || type === 'speed') {
        logger.info('[render] timelineEffect skipped in video-filter pass', { type, name })
      } else {
        logger.info('[render] timelineEffect unmapped, skipped', { type, name })
      }
    } catch (err) {
      logger.warn('[render] timelineEffect compile failed', { error: err.message, name })
    }
  }
  return out
}

async function renderFromEditorState(options) {
  const {
    videoId,
    videoUrl,
    videoFilters = {},
    textOverlays: _textOverlaysRaw = [],
    shapeOverlays: _shapeOverlaysRaw = [],
    imageOverlays = [],
    svgOverlays = [],
    gradientOverlays = [],
    videoTransform = null,
    videoTransformKeyframes = [],
    videoCrop = null,
    exportOptions = {},
    timelineSegments = [],
    timelineEffects = [],
    chromaKey = null,
    colorGrade = null,
    audio = null,
    userId,
  } = options

  // Resource caps — these inputs are attacker-influenced (editor state from the
  // request), so bound them before they reach the ffmpeg filter graph. Without
  // this, thousands of overlays build a multi-MB complexFilter that explodes
  // ffmpeg memory/parse time. MAX_OVERLAYS (30) already caps image/svg/gradient
  // inputs further down; these cap the drawtext/drawbox chains.
  const MAX_OVERLAYS_PER_KIND = 100
  const _txtRaw = Array.isArray(_textOverlaysRaw) ? _textOverlaysRaw : []
  const _shpRaw = Array.isArray(_shapeOverlaysRaw) ? _shapeOverlaysRaw : []
  if (_txtRaw.length > MAX_OVERLAYS_PER_KIND) logger.warn('[render] textOverlays capped', { from: _txtRaw.length, to: MAX_OVERLAYS_PER_KIND })
  if (_shpRaw.length > MAX_OVERLAYS_PER_KIND) logger.warn('[render] shapeOverlays capped', { from: _shpRaw.length, to: MAX_OVERLAYS_PER_KIND })
  const textOverlays = _txtRaw.slice(0, MAX_OVERLAYS_PER_KIND)
  const shapeOverlays = _shpRaw.slice(0, MAX_OVERLAYS_PER_KIND)

  // Playback speed (global). Clamp to ffmpeg-sane bounds. setpts scales video PTS;
  // atempo handles audio (chained for factors outside 0.5–2.0).
  const playbackSpeed = (() => {
    const s = Number(exportOptions.playbackSpeed ?? options.playbackSpeed ?? 1)
    return Number.isFinite(s) && s > 0 ? Math.max(0.25, Math.min(4, s)) : 1
  })()
  // Single-clip reverse: when the timeline is effectively one segment and it's
  // flagged reversed, reverse the whole render. (Multi-segment per-clip reverse +
  // transitions require segment-concat rendering — handled in the timeline rebuild.)
  const reverseWhole = Array.isArray(timelineSegments)
    && timelineSegments.length <= 1
    && timelineSegments.some(s => s && s.reversed)

  // Clamp dimensions to sane bounds (even-numbered, ≤ 4096) — an unclamped
  // width/height (e.g. via the manual-editing route) makes ffmpeg allocate
  // enormous frame buffers. Round to even for yuv420p.
  const clampDim = (v, def) => {
    const n = Math.round(Number(v) || def)
    return Math.max(16, Math.min(4096, n)) & ~1
  }
  const width = clampDim(exportOptions.width, 1920)
  const height = clampDim(exportOptions.height, 1080)
  // smartReframe: the caller (Repurpose Studio) has already cover-scaled + crop-
  // framed the source to this exact target aspect in a pre-pass, so we must NOT
  // re-apply the legacy forced center/Lissajous crop below — that would override
  // the subject-aware framing AND upscale tier-clamped exports back to 1080x1920.
  const smartReframe = exportOptions.smartReframe === true
  // A user-set crop (from the editor, {x,y,width,height} in %) means the framing
  // is already decided — the legacy vertical center-crop below must NOT override
  // it. A full-frame 0/0/100/100 is "no crop" and doesn't count.
  const hasManualCrop = !!(videoCrop && typeof videoCrop === 'object' && (
    Number(videoCrop.x) > 0 || Number(videoCrop.y) > 0 ||
    (Number(videoCrop.width) > 0 && Number(videoCrop.width) < 100) ||
    (Number(videoCrop.height) > 0 && Number(videoCrop.height) < 100)
  ))
  const isBestQuality = exportOptions.quality === 'best'
  const isProres = exportOptions.codec === 'prores'
  let bitrateMbps = exportOptions.bitrateMbps ?? 8
  let codec = 'libx264'
  if (exportOptions.codec === 'hevc') codec = 'libx265'
  else if (isProres) codec = 'prores_ks'
  let crf = 23
  let preset = 'medium'
  let audioBitrate = '192k'

  if (isBestQuality && !isProres) {
    bitrateMbps = Math.max(bitrateMbps, 20)
    crf = 18
    preset = 'slow'
    audioBitrate = '320k'
  }
  if (isProres) {
    bitrateMbps = Math.max(bitrateMbps, 50) // ProRes is high bitrate
  }

  const inputPath = await resolveInputPath(videoId, videoUrl)

  if (!inputPath.startsWith('http') && !fs.existsSync(inputPath)) {
    throw new Error(`Input video not found: ${inputPath}`)
  }

  const outputDir = path.join(__dirname, '../../uploads/exports')
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })
  const ext = isProres ? 'mov' : 'mp4'
  const outputFilename = `render-${videoId || 'export'}-${Date.now()}.${ext}`
  const outputPath = path.join(outputDir, outputFilename)

  // Named color grade (shared registry): merge its VideoFilter deltas + vfx INTO the
  // editor filters before building the chain, so a grade renders identically to the
  // manual preview. Explicit `colorGrade` deltas layer on top of any baked filters.
  let effectiveFilters = videoFilters
  if (colorGrade) {
    try {
      const { gradeToVideoFilter } = require('./colorGradeRegistry')
      const g = gradeToVideoFilter(colorGrade)
      const { vfx: gradeVfx, ...gradeFields } = g
      effectiveFilters = {
        ...videoFilters,
        ...gradeFields,
        vfx: [...(Array.isArray(videoFilters.vfx) ? videoFilters.vfx : []), ...(Array.isArray(gradeVfx) ? gradeVfx : [])],
      }
    } catch (e) {
      logger.warn('[render] color grade merge failed', { colorGrade, error: e.message })
    }
  }

  const videoFilters_ff = buildVideoFilterChain(effectiveFilters)
  const lutFilters = buildLUTApproximation(videoFilters.lutId)

  // ── Editor parity: BASE video transform / crop (applied to [0:v] before
  // text/shape/overlay layers). Constant or keyframed scale/position/rotation. ──
  const hasTransform = (videoTransform && typeof videoTransform === 'object') ||
    (videoCrop && typeof videoCrop === 'object') ||
    (Array.isArray(videoTransformKeyframes) && videoTransformKeyframes.length > 0)
  if (hasTransform) {
    try {
      const xform = buildVideoTransformChain(videoTransform, videoCrop, videoTransformKeyframes, width, height)
      // Prepend so transform happens first (right after the mandatory scale=W:H).
      videoFilters_ff.unshift(...xform)
    } catch (e) {
      logger.warn('Skip videoTransform', { error: e.message })
    }
  }

  // ── Editor parity: chroma key, whole-clip reverse, and playback speed ──
  // Applied to the base video before overlays. Order: reverse → chromakey → setpts.
  const basePre = []
  if (reverseWhole) basePre.push('reverse')
  if (chromaKey && chromaKey.enabled && chromaKey.color) {
    const hex = String(chromaKey.color).replace('#', '0x')
    let tol = Number(chromaKey.tolerance)
    if (!Number.isFinite(tol)) tol = 0.3
    if (tol > 1) tol = tol / 100 // editor stores 0-100 in some paths, 0-1 in others
    const similarity = Math.max(0.01, Math.min(1, tol))
    let edge = Number(chromaKey.edge)
    const blend = Number.isFinite(edge) ? Math.max(0, Math.min(1, (edge > 1 ? edge / 100 : edge))) : 0.1
    basePre.push(`chromakey=${hex}:${similarity.toFixed(3)}:${blend.toFixed(3)}`)
  }
  if (playbackSpeed !== 1) basePre.push(`setpts=${(1 / playbackSpeed).toFixed(4)}*PTS`)
  if (basePre.length > 0) videoFilters_ff.unshift(...basePre)

  // Audio speed/reverse suffix injected at the [aout] tail (one consistent point).
  const aSuffixParts = []
  if (reverseWhole) aSuffixParts.push('areverse')
  if (playbackSpeed !== 1) {
    // atempo only accepts 0.5–2.0; chain factors outside that range.
    let s = playbackSpeed
    while (s > 2.0) { aSuffixParts.push('atempo=2.0'); s /= 2.0 }
    while (s < 0.5) { aSuffixParts.push('atempo=0.5'); s /= 0.5 }
    aSuffixParts.push(`atempo=${s.toFixed(4)}`)
  }
  const aSuffix = aSuffixParts.length > 0 ? ',' + aSuffixParts.join(',') : ''

  // Text + shape overlays drawn in EDITOR z-order. Previously ALL text was drawn
  // before ALL shapes, so a shape the user placed behind text rendered on top
  // (and vice versa). Merge both kinds and stable-sort by layer/zIndex so the
  // export matches the editor's stacking (equal layers keep insertion order).
  const _drawnOverlays = []
  ; (textOverlays || []).forEach((o) => {
    try {
      _drawnOverlays.push({ layer: Number(o.layer ?? o.zIndex ?? 0) || 0, f: buildDrawTextFilter(o, { width, height }) })
    } catch (e) {
      logger.warn('Skip text overlay', { error: e.message, overlay: o })
    }
  })
  ; (shapeOverlays || []).forEach((s) => {
    try {
      _drawnOverlays.push({ layer: Number(s.layer ?? s.zIndex ?? 0) || 0, f: buildDrawBoxFilter(s) })
    } catch (e) {
      logger.warn('Skip shape overlay', { error: e.message, shape: s })
    }
  })
  _drawnOverlays.sort((a, b) => a.layer - b.layer)
  // Drop null/empty filters — a builder returns null for empty text or an
  // all-invalid word list. An unfiltered null becomes a `,,` in the joined
  // filter chain, which is invalid ffmpeg and crashes the ENTIRE export (taking
  // down every other valid overlay), so it must never reach the join.
  const overlayFilters = _drawnOverlays.map((d) => d.f).filter(Boolean)
  
  // 🌿 2026 Comfort-Aesthetic Settings (Prevents sensory overstimulation by default for Manual Edits)
  // By default, manual edits are designed to be clean, stable, and highly organized.
  // The user can opt-in to auto-injected cinematic shakes/glitches by passing `comfortMode: false`.
  const comfortMode = exportOptions.comfortMode !== false && videoFilters.comfortMode !== false;

  let cinematicEQ = '1.0';
  let brightnessEQ = '0.0';
  let saturationVal = '1.0';

  if (!comfortMode) {
    // Cinematic high-contrast mode only if requested
    cinematicEQ = '1.15';
    brightnessEQ = '0.02';
    saturationVal = '1.25';
  } else {
    // Standard clean, balanced natural color grading for comfort
    cinematicEQ = '1.02';
    brightnessEQ = '0.0';
    saturationVal = '1.05';
  }

  // Flash Cuts and Camera Shakes based on Manual Text Overlays
  let shakeX = '0';
  let shakeY = '0';
  let glitchEnable = '';
  let telephoneEQ = '';

  (textOverlays || []).forEach(o => {
    const s = Number(o.startTime ?? 0);
    if (isNaN(s)) return;

    // Check if the word implies a 'Secret' or 'Hack' for the Telephone EQ
    const rawText = (o.text || '').toUpperCase();
    if (rawText.includes('SECRET') || rawText.includes('HACK') || rawText.includes('TRUTH')) {
      telephoneEQ += (telephoneEQ ? '+' : '') + `between(t,${s.toFixed(2)},${(s+2).toFixed(2)})`;
    }

    if (!comfortMode) {
      const eFlash = s + 0.15; // 150ms flash
      cinematicEQ = `if(between(t,${s.toFixed(2)},${eFlash.toFixed(2)}),1.8,${cinematicEQ})`;
      brightnessEQ = `if(between(t,${s.toFixed(2)},${eFlash.toFixed(2)}),0.3,${brightnessEQ})`;

      // Only shake & glitch on high-impact styles (captionPreset included, so a
      // one-click Hook/Punch preset gets the frame kinetics too).
      const hi = o.captionPreset || o.style || o.type
      if (hi === 'hook' || hi === 'punchline') {
        const eShake = s + 0.4; // 400ms shake
        const jitterX = `(random(1)*40-20)`;
        const jitterY = `(random(1)*40-20)`;
        shakeX = `if(between(t,${s.toFixed(2)},${eShake.toFixed(2)}),${jitterX},${shakeX})`;
        shakeY = `if(between(t,${s.toFixed(2)},${eShake.toFixed(2)}),${jitterY},${shakeY})`;

        if (o.style === 'punchline') {
          glitchEnable += (glitchEnable ? '+' : '') + `between(t,${s.toFixed(2)},${(s+0.2).toFixed(2)})`;
        }
      }
    }
  });

  videoFilters_ff.push(`eq=contrast='${cinematicEQ}':brightness='${brightnessEQ}':saturation=${saturationVal}`);

  if (glitchEnable && !comfortMode) {
    videoFilters_ff.push(`noise=alls=100:allf=t+u:enable='${glitchEnable}',rgbashift=rh=15:bv=-15:enable='${glitchEnable}'`);
  }

  if (!comfortMode) {
    // Inject 2026 Chromatic Aberration as a baseline 'depth' layer only if comfortMode is off
    videoFilters_ff.push('rgbashift=rh=1:bv=-1');
  }

  // Inject Dynamic Cameraman Drift & Shake if video is vertical.
  // Skipped entirely under smartReframe: the source was already cover-scaled and
  // subject-cropped to this aspect upstream, so re-cropping here would discard
  // that framing and ignore the tier resolution clamp.
  if (height > width && !smartReframe && !hasManualCrop) {
    if (comfortMode) {
      // 🌿 Steady, smooth, perfectly centered professional crop (No motion sickness, no drift)
      videoFilters_ff.push('scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920');
    } else {
      // Uses non-repeating Lissajous curves to perfectly simulate a human cameraman.
      videoFilters_ff.push(`scale=1150:2044:force_original_aspect_ratio=increase,crop=1080:1920:x='(iw-1080)/2+25*sin(t/3.14)+10*sin(t/5.2)+${shakeX}':y='(ih-1920)/2+15*cos(t/2.71)+8*cos(t/4.5)+${shakeY}'`);
    }
  }

  // Inject Progress Bar if explicitly requested, or if not in comfort mode
  const enableProgressBar = exportOptions.progressBar === true || videoFilters.progressBar === true || (!comfortMode);
  if (enableProgressBar) {
    const estimatedDuration = exportOptions.duration || 60;
    overlayFilters.push(`drawbox=x=0:y=h-15:w='iw*(t/${estimatedDuration})':h=15:color=#00FFFF@0.9:t=fill`);
  }

  // Time-gated timeline effects (vignette/grain/chromatic/glow/flash/color). These
  // were previously built in the editor's EffectsView but never reached the render
  // — the whole effects layer was dropped. Each applies only within its window.
  const timelineEffectFilters = compileTimelineEffects(timelineEffects)

  const allVideoFilters = [...videoFilters_ff, ...timelineEffectFilters, ...lutFilters, ...overlayFilters]
  const firstMusic = timelineSegments.find(s => s.type === 'audio' && s.sourceUrl)
  // music volume is read where it's applied — inside the `if (hasMusic)` audio
  // graph below (firstMusic.properties.volume), not here.
  const hasMusic = !!firstMusic

  // ── Editor parity: prepare multi-input visual overlays (image / svg /
  // gradient). Each becomes an extra ffmpeg .input(); the overlay graph is
  // chained in the complexFilter video branch. SVG/gradient are rasterized to
  // temp PNGs (cleaned up after render). All overlays sorted by `layer` so draw
  // order matches the editor. ──
  const MAX_OVERLAYS = 30
  const tmpRenderDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrender-'))
  const tmpFiles = [] // temp PNGs to clean up post-render
  /** @type {{kind:string, source:string, spec:object, layer:number}[]} */
  const overlayInputs = []

  // Collect raw overlays tagged with kind + layer.
  const rawOverlays = []
  ;(imageOverlays || []).forEach((o) => {
    if (!o || !o.url) { logger.warn('Skip image overlay: missing url'); return }
    rawOverlays.push({ kind: 'image', spec: o, layer: clampNum(o.layer, -1e4, 1e4, 0) })
  })
  ;(svgOverlays || []).forEach((o) => {
    if (!o || !o.url) { logger.warn('Skip svg overlay: missing url'); return }
    rawOverlays.push({ kind: 'svg', spec: o, layer: clampNum(o.layer, -1e4, 1e4, 0) })
  })
  ;(gradientOverlays || []).forEach((o) => {
    if (!o) { logger.warn('Skip gradient overlay: empty'); return }
    rawOverlays.push({ kind: 'gradient', spec: o, layer: clampNum(o.layer, -1e4, 1e4, 0) })
  })
  rawOverlays.sort((a, b) => a.layer - b.layer)

  if (rawOverlays.length > MAX_OVERLAYS) {
    logger.warn('Overlay count exceeds cap; truncating', { count: rawOverlays.length, cap: MAX_OVERLAYS })
    rawOverlays.length = MAX_OVERLAYS
  }

  // Resolve each overlay to a concrete ffmpeg input source (path/url) + spec.
  for (const ro of rawOverlays) {
    try {
      if (ro.kind === 'image') {
        const url = String(ro.spec.url)
        const source = isRemoteUrl(url) ? await assertSafeRemote(url) : toAbsolutePath(url)
        overlayInputs.push({ kind: 'image', source, spec: ro.spec })
      } else if (ro.kind === 'svg') {
        const png = await rasterizeSvgToPng(ro.spec, width, height, tmpRenderDir)
        tmpFiles.push(png)
        // Treat as image overlay; svg already rasterized to target size, so
        // pass width/height through (re-scale is idempotent/fill).
        overlayInputs.push({ kind: 'image', source: png, spec: ro.spec })
      } else if (ro.kind === 'gradient') {
        const png = await generateGradientPng(ro.spec, width, height, tmpRenderDir)
        tmpFiles.push(png)
        // Gradient PNG is full-frame; overlay at 0,0 covering the whole frame.
        overlayInputs.push({
          kind: 'image',
          source: png,
          spec: {
            x: 50, y: 50, width: 100, height: 100,
            opacity: 1, // alpha already baked into the PNG
            startTime: ro.spec.startTime, endTime: ro.spec.endTime,
          },
        })
      }
    } catch (e) {
      logger.warn(`Skip ${ro.kind} overlay`, { error: e.message })
    }
  }
  const hasVisualOverlays = overlayInputs.length > 0

  // Best-effort cleanup of temp rasterized PNGs + dir. rmSync(recursive,force)
  // removes the dir even if an unlink above failed (rmdirSync needs it empty)
  // and never throws on an already-gone dir, so it is safe to call twice.
  const cleanupTmp = () => {
    for (const f of tmpFiles) { try { fs.unlinkSync(f) } catch (_) { /* noop */ } }
    try { fs.rmSync(tmpRenderDir, { recursive: true, force: true }) } catch (_) { /* noop */ }
  }

  const { renderQueue, optimizeFFmpegCommand } = require('./performanceOptimizationService')

  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    // Guard the whole async executor: a throw during command/filter building
    // would otherwise become an unhandled rejection (the no-async-promise-
    // executor footgun) — the outer Promise would never settle (render hangs)
    // and tmpRenderDir would leak. Catch → cleanup + reject so it fails fast.
    try {
    // 🛸 Phase 14: Neural Enhancement Scan
      let enhancementFilters = []
      let hasAudio = false
      try {
        const metadata = await new Promise((res, rej) => {
          ffmpeg.ffprobe(inputPath, (err, data) => err ? rej(err) : res(data))
        })
        enhancementFilters = videoEnhancer.getEnhancementFilters(metadata)
        hasAudio = Array.isArray(metadata.streams) && metadata.streams.some(s => s.codec_type === 'audio')
      } catch (err) {
        logger.warn('Quality scan failed, proceeding with baseline', { error: err.message })
      }

      let command = ffmpeg(inputPath)
      if (hasMusic) {
      // Resolve the music source the same way as the main input: pass remote
      // http(s) URLs through untouched, but turn a relative "/uploads/..." URL
      // into a real absolute filesystem path (raw "/uploads/x.mp3" would be read
      // by ffmpeg as a non-existent absolute path).
        const musicInput = isRemoteUrl(firstMusic.sourceUrl)
          ? await assertSafeRemote(firstMusic.sourceUrl)
          : toAbsolutePath(firstMusic.sourceUrl)
        command = command.input(musicInput)
      }

      const finalFilterList = [...allVideoFilters, ...enhancementFilters]
    
      // 🌍 Phase 15: Global Subtitle Burn-in
      if (exportOptions.subtitlePath && fs.existsSync(exportOptions.subtitlePath)) {
        logger.info('Injecting Neural Subtitles', { path: exportOptions.subtitlePath });
        const subPath = exportOptions.subtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:');
        finalFilterList.push(`ass='${subPath}'`);
      }

      // 🎬 Phase 16: Cinematic Film Grain (2026 Hollywood Standard)
      // Automatically injects a subtle dynamic noise overlay to remove the 'digital/cheap' look
      if (!comfortMode) {
        finalFilterList.push('noise=alls=8:allf=t+u');
      } else {
      // Subtle organic dither to avoid compression banding but remain comfortable
        finalFilterList.push('noise=alls=2:allf=t+u');
      }

      // 💰 Phase 17: Autonomous Commerce Inlays
      if (exportOptions.monetizationPlan && exportOptions.monetizationPlan.triggers) {
        const commerceAssetService = require('./commerceAssetService');
        const filteredTriggers = exportOptions.monetizationPlan.triggers.filter(t => (t.intentScore || 0) >= 0.85);
      
        for (const trigger of filteredTriggers) {
          try {
            logger.info('Neural Commerce: Generating High-Intent Inlay', { productId: trigger.productId });
            const overlayUrl = await commerceAssetService.generateNeuralCommerceOverlay({
              name: trigger.productName,
              price: trigger.productPrice,
              checkoutUrl: trigger.checkoutUrl,
              id: trigger.productId
            });

            // DISABLED: this can't be expressed in finalFilterList (which is
            // comma-joined into ONE chain). The previous push referenced an
            // UNDEFINED [qv] label + a hardcoded input index (every inlay used the
            // same index), which corrupts the whole filter graph when a
            // monetizationPlan is supplied. A multi-input overlay must go through
            // the overlayGraph/image-overlay path. Skip cleanly until rewired so a
            // monetizationPlan can never break the export. (overlayUrl is already
            // generated above; not added as an input here.)
            void overlayUrl;
            logger.warn('Commerce inlay requested but not wired (needs overlay-input path) — skipping', { productId: trigger.productId });
          } catch (err) {
            logger.warn('Failed to inject commerce inlay', { error: err.message });
          }
        }
      }

      // 🕰️ Phase 19: Long-Tail Resurrection (Hook Injection)
      if (exportOptions.resurrectionHookPath && fs.existsSync(exportOptions.resurrectionHookPath)) {
        // DISABLED: the hook was added as an input but NEVER mapped/concatenated
        // into the output (a dangling unused input → the hook never appeared).
        // Prepending it needs a concat-demuxer/filter pass. Skip cleanly rather
        // than add a dead input.
        logger.warn('Resurrection hook requested but concat not wired — skipping', { path: exportOptions.resurrectionHookPath });
      }

      const finalFilterStr = finalFilterList.length > 0 ? finalFilterList.join(',') : null;

      // ── Editor parity: register visual overlay inputs (image/svg/gradient) and
      // build their chained overlay graph. These inputs are added AFTER any music
      // / commerce / resurrection inputs so we don't shift those hardcoded
      // indices. We snapshot the current input count to compute our base index. ──
      let overlayGraph = '' // chains appended to the video branch; consumes/ends [vout]
      if (hasVisualOverlays) {
      // fluent-ffmpeg tracks inputs on command._inputs.
        let baseIdx = Array.isArray(command._inputs) ? command._inputs.length : (hasMusic ? 2 : 1)
        const chains = []
        let prevLabel = 'vbase' // base text/shape chain will be relabeled to [vbase]
        overlayInputs.forEach((ov, i) => {
          try {
            command = command.input(ov.source)
            const inputIdx = baseIdx + i
            const isLast = i === overlayInputs.length - 1
            const outLabel = isLast ? 'vout' : `vo${i}`
            const seg = buildImageOverlaySegment(ov.spec, inputIdx, prevLabel, outLabel, width, height)
            chains.push(...seg.chains)
            prevLabel = outLabel
          } catch (e) {
            logger.warn('Skip visual overlay input', { error: e.message })
          }
        })
        if (chains.length > 0) {
          overlayGraph = ';' + chains.join(';')
        }
      }
      const hasOverlayGraph = overlayGraph.length > 0

      // When a complexFilter maps an explicit [vout], scaling is done INSIDE the
      // filtergraph (scale=W:H prepended to the video chain). In that case we must
      // NOT also call .size() (-s W:H) on the mapped output — applying -s on top of
      // a filtergraph-mapped pad fails on some modern ffmpeg builds with
      // "Error opening output file: Invalid argument" (exit 234). We track this so
      // the size() call below only runs for the non-complexFilter branches.
      let videoMappedViaFiltergraph = false

      // Base video label: when visual overlays are chained, the base text/shape
      // chain must terminate at [vbase] and the overlay graph carries it to [vout].
      const baseVidLabel = hasOverlayGraph ? 'vbase' : 'vout'

      // Pro audio mix (music volume / ducking / fades / voice preset / EQ-comp-reverb)
      // resolved from the RenderTree. Neutral when `audio` is absent, so the rendered
      // graph stays byte-identical to the prior behavior.
      const audioMix = buildAudioMix(audio, { duration: exportOptions.duration })
      const _voice = audioMix.voice || DEFAULT_VOICE
      const _masterFx = audioMix.masterFx ? `${audioMix.masterFx},` : ''

      if (hasMusic) {
        const musicVolume = audioMix.musicVolume != null ? audioMix.musicVolume : (firstMusic?.properties?.volume ?? 0.5)
        const duckLevel = audioMix.duckLevel != null ? audioMix.duckLevel : (exportOptions.duckLevel ?? -12)
        const vidFilterPart = finalFilterStr ? `,${finalFilterStr}` : ''
        const vidPart = `[0:v]scale=${width}:${height}${vidFilterPart}[${baseVidLabel}]${overlayGraph}`
        videoMappedViaFiltergraph = true
        const teleFilter = telephoneEQ ? `highpass=f=400:enable='${telephoneEQ}',lowpass=f=3000:enable='${telephoneEQ}',` : '';

        if (hasAudio) {
        // Source has audio + background music added -> map both with sidechain compression
          let audPart = `[1:a]volume=${musicVolume}${audioMix.musicFade}[music];[music][0:a]sidechaincompress=threshold=${duckLevel}dB:ratio=4:attack=50:release=200[ducked];[0:a]aeval=val(0)+0.0004*sin(random(1)*6.28):c=same,${_voice}[clarity];[clarity][ducked]amix=inputs=2:duration=first:dropout_transition=1,${_masterFx}${teleFilter}loudnorm=I=-16:TP=-1.5:LRA=11${aSuffix}[aout]`
          const complexStr = `${vidPart};${audPart}`
          command = command
            .complexFilter(complexStr)
            .outputOptions(['-map', '[vout]', '-map', '[aout]'])
        } else {
        // Silent source + background music added -> map only music track directly (skip sidechain amix)
          let audPart = `[1:a]volume=${musicVolume}${audioMix.musicFade},${_masterFx}${teleFilter}loudnorm=I=-16:TP=-1.5:LRA=11${aSuffix}[aout]`
          const complexStr = `${vidPart};${audPart}`
          command = command
            .complexFilter(complexStr)
            .outputOptions(['-map', '[vout]', '-map', '[aout]'])
        }
      } else {
        const teleFilter = telephoneEQ ? `highpass=f=400:enable='${telephoneEQ}',lowpass=f=3000:enable='${telephoneEQ}',` : '';

        if (hasAudio) {
          if (finalFilterStr || hasOverlayGraph) {
          // Source has audio, no music, with video filters/overlays -> map with
          // complex filter. Scale INSIDE the filtergraph (see
          // videoMappedViaFiltergraph note) so we don't also need .size(), which
          // would error on the mapped [vout] pad.
            const vidFilterPart = finalFilterStr ? `,${finalFilterStr}` : ''
            const vidPart = `[0:v]scale=${width}:${height}${vidFilterPart}[${baseVidLabel}]${overlayGraph}`
            command = command.complexFilter(`${vidPart};[0:a]aeval=val(0)+0.0004*sin(random(1)*6.28):c=same,${_voice},${_masterFx}${teleFilter}loudnorm=I=-16:TP=-1.5:LRA=11${aSuffix}[aout]`)
              .outputOptions(['-map', '[vout]', '-map', '[aout]'])
            videoMappedViaFiltergraph = true
          } else {
          // Source has audio, no music, no video filters -> apply audioFilters directly.
          // No complexFilter here, so .size() (-s W:H) below performs the scaling.
            command = command.audioFilters(`${_voice},${_masterFx}${teleFilter}loudnorm=I=-16:TP=-1.5:LRA=11${aSuffix}`)
          }
        } else {
        // Source is completely silent and no background music added -> render as video only
          if (finalFilterStr || hasOverlayGraph) {
            const vidFilterPart = finalFilterStr ? `,${finalFilterStr}` : ''
            const vidPart = `[0:v]scale=${width}:${height}${vidFilterPart}[${baseVidLabel}]${overlayGraph}`
            command = command.complexFilter(vidPart)
              .outputOptions(['-map', '[vout]'])
            videoMappedViaFiltergraph = true
          }
          command = command.noAudio()
        }
      }

      const videoOutputOptions = isProres
        ? ['-profile:v', '3', '-vendor', 'apl0'] // ProRes 422 HQ
        : [`-b:v ${bitrateMbps}M`, `-preset ${preset}`, `-crf ${crf}`, '-movflags +faststart']

      const commandChain = command
        .videoCodec(codec)
        .outputOptions(videoOutputOptions)

      // Only apply -s W:H when scaling was NOT already done inside a filtergraph that
      // maps [vout]. Applying -s on a filtergraph-mapped output can fail on modern
      // ffmpeg ("Invalid argument", exit 234); the complexFilter branches above
      // already prepend scale=W:H to the video chain instead.
      if (!videoMappedViaFiltergraph) {
        commandChain.size(`${width}x${height}`)
      }

      if (hasAudio || hasMusic) {
        commandChain
          .audioCodec('aac')
          .outputOptions(['-b:a', audioBitrate])
      }

      commandChain.output(outputPath)

      // Optimize for this specific machine
      optimizeFFmpegCommand(commandChain)

      const job = {
        execute: () => {
          return new Promise((jobResolve, jobReject) => {
            commandChain
              .on('start', () => {
                logger.info('Neural Node Dispatch: Render Process Initialized', {
                  videoId,
                  outputPath,
                  node: 'Alpha-1'
                })
              })
              .on('progress', (p) => {
                if (p.percent) logger.debug('Render progress', { percent: p.percent.toFixed(1) })
              })
              .on('end', async () => {
                try {
                  cleanupTmp() // remove temp rasterized overlay PNGs
                  if (!fs.existsSync(outputPath)) {
                    return jobReject(new Error('Neural Node Error: Output Fragment Missing'))
                  }
                  // Defensive: ffmpeg can exit 0 with a near-empty file under
                  // OOM / codec bailout / aborted-mid-write conditions. Treat
                  // anything under 1KB as a failed render so the client
                  // doesn't hand the user a zero-byte download.
                  const size = fs.statSync(outputPath).size
                  if (size <= 1024) {
                    try { fs.unlinkSync(outputPath) } catch (_) { /* best effort cleanup */ }
                    return jobReject(new Error(`Neural Node Error: ffmpeg produced an empty/truncated file (${size} bytes) — likely OOM or codec failure`))
                  }

                  // C2PA provenance signing — best-effort, never blocks or fails the render.
                  // signRender() handles its own graceful degradation: tries c2pa-node,
                  // falls back to c2patool CLI, and if neither is present returns
                  // { signed: false } with a warning rather than throwing.
                  const c2paJobId = outputFilename.replace(/\.[^.]+$/, '')
                  let c2paResult = { signed: false, sha256: null, sizeBytes: size }
                  try {
                    c2paResult = await c2paService.signRender({
                      inputPath: outputPath,
                      tree: null,
                      jobId: c2paJobId,
                      userId: userId || null,
                    })
                  } catch (err) {
                    logger.warn('[render] C2PA signing threw; export will be unsigned', {
                      error: err.message,
                      videoId,
                    })
                  }
                  // Persist the authenticity record without blocking the render response.
                  c2paService.persistAuthenticity({
                    contentId: videoId || null,
                    userId: userId || null,
                    jobId: c2paJobId,
                    signed: c2paResult.signed,
                    manifest: c2paResult.manifest || null,
                    signer: c2paResult.signer || null,
                    sha256: c2paResult.sha256 || null,
                    reason: c2paResult.reason || null,
                  }).catch((err) => {
                    logger.warn('[render] persistAuthenticity threw', { jobId: c2paJobId, error: err.message })
                  })

                  // Default to the local URL. On hosts with cloud storage configured
                  // (Cloudinary/S3) the local uploads dir is ephemeral, so push the
                  // export to cloud and hand back the durable URL instead. This is
                  // best-effort: any failure falls back to the local URL so the user
                  // can still download within the current process lifetime.
                  let url = `/uploads/exports/${outputFilename}`
                  try {
                    const storageService = require('./storageService')
                    if (storageService.isCloudStorageEnabled && storageService.isCloudStorageEnabled()) {
                      const contentType = ext === 'mov' ? 'video/quicktime' : 'video/mp4'
                      const uploaded = await storageService.uploadFile(
                        outputPath,
                        `exports/${outputFilename}`,
                        contentType
                      )
                      if (uploaded?.url) {
                        url = uploaded.url
                        logger.info('[render] Export uploaded to cloud storage', {
                          videoId,
                          storage: uploaded.storage,
                          url,
                        })
                      }
                    }
                  } catch (err) {
                    logger.warn('[render] Cloud upload of export failed; serving local URL', {
                      error: err.message,
                      videoId,
                    })
                  }

                  logger.info('Neural Node Handoff: Render Complete', {
                    videoId,
                    url,
                    bytes: size,
                    signed: c2paResult.signed,
                    signer: c2paResult.signer || null,
                  })
                  jobResolve({ outputPath, url, signed: c2paResult.signed })
                } catch (e) {
                // A throw after existsSync (e.g. statSync race) must reject the
                // job, not become an unhandled rejection that hangs the render.
                  cleanupTmp()
                  logger.error('Neural Node Failure (post-render)', { error: e.message, videoId })
                  jobReject(e)
                }
              })
              .on('error', (err) => {
                cleanupTmp() // remove temp rasterized overlay PNGs
                logger.error('Neural Node Failure', { error: err.message, videoId })
                jobReject(err)
              })
              .run()
          })
        }
      }

      renderQueue.add({
        ...job,
        execute: async () => {
          const res = await job.execute()
          return res
        },
        onComplete: (res) => resolve(res),
        onError: (err) => reject(err)
      })
    } catch (err) {
      cleanupTmp() // never leak the temp dir on a build-time failure
      reject(err)
    }
  })
}

// ──────────────────────────────────────────────────────────────────────────
// MULTI-CLIP TIMELINE STITCHING (low-risk PRE-PASS)
//
// This is a SEPARATE pass that runs BEFORE renderFromEditorState. It stitches
// the primary VIDEO track's segments into ONE intermediate MP4 honoring:
//   - per-segment SOURCE trim   ([sourceStartTime, sourceEndTime])
//   - per-segment reverse       (reverse / areverse)
//   - per-segment playbackSpeed (setpts / atempo)
//   - cross-segment transitions (xfade + acrossfade) when transitionOut +
//     transitionDuration are set, else plain concat
//
// The existing single-source render then runs on that intermediate so overlays/
// filters/global-speed/chroma still apply on top — that pipeline is UNTOUCHED.
//
// DEFERRED (NOT implemented here — see TODOs below):
//   - freezeFrame segments (hold a frame for N seconds)
//   - J-cut / L-cut audio leads & tails (audio of one clip overlapping the
//     neighbouring clip's video). True J/L cuts need per-segment audio offset
//     handling that the current straight concat/acrossfade does not model.
// ──────────────────────────────────────────────────────────────────────────

/** Segment types that contribute to the primary visual track. */
const PRIMARY_VIDEO_TYPES = new Set(['video', 'broll'])

/** Clamp a per-segment playback speed to ffmpeg-sane bounds. */
function normSegSpeed(v) {
  const s = Number(v)
  return Number.isFinite(s) && s > 0 ? Math.max(0.25, Math.min(4, s)) : 1
}

/**
 * Select + order the primary-video segments from a timeline. Ignores audio-only
 * and overlay segments (those are handled elsewhere / by the main render).
 * Returns segments sorted by startTime (stable for equal/missing startTimes).
 */
function selectPrimarySegments(timelineSegments) {
  if (!Array.isArray(timelineSegments)) return []
  return timelineSegments
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s && PRIMARY_VIDEO_TYPES.has(s.type))
    .sort((a, b) => {
      const ta = Number(a.s.startTime) || 0
      const tb = Number(b.s.startTime) || 0
      if (ta !== tb) return ta - tb
      return a.i - b.i
    })
    .map(({ s }) => s)
}

/** True when a segment carries a per-segment flag that the single-source render can't honor. */
function segmentHasSpecial(s) {
  if (!s) return false
  if (s.reversed) return true
  if (normSegSpeed(s.playbackSpeed) !== 1) return true
  if (s.transitionOut && s.transitionOut !== 'none' && Number(s.transitionDuration) > 0) return true
  // An explicit source-trim window (other than "from 0") also needs the pre-pass
  // to materialize the kept range before the main render.
  if (Number(s.sourceStartTime) > 0) return true
  if (Number.isFinite(Number(s.sourceEndTime))) return true
  // A per-segment crop or volume change also needs the stitch pre-pass to apply.
  if (s.crop && typeof s.crop === 'object' &&
    (Number(s.crop.left) || Number(s.crop.right) || Number(s.crop.top) || Number(s.crop.bottom))) return true
  if (Number.isFinite(Number(s.volume)) && Number(s.volume) !== 1) return true
  if (s.freezeFrame || s.freeze) return true
  if (Number.isFinite(Number(s.playbackSpeedStart)) && Number.isFinite(Number(s.playbackSpeedEnd)) &&
    Number(s.playbackSpeedStart) > 0 && Number(s.playbackSpeedStart) !== Number(s.playbackSpeedEnd)) return true
  return false
}

/**
 * Decide whether the timeline needs the stitch pre-pass. True when there are
 * 2+ primary video segments, OR a single segment carries reverse / per-segment
 * speed / a source-trim window (a transition needs a next segment, so it only
 * matters in the multi-segment case).
 */
function needsStitch(timelineSegments) {
  const segs = selectPrimarySegments(timelineSegments)
  if (segs.length >= 2) return true
  if (segs.length === 1) return segmentHasSpecial(segs[0])
  return false
}

/**
 * Probe whether a source has at least one audio stream. ffmpeg's `[i:a?]`
 * optional-reference does NOT synthesize silence — it simply produces nothing,
 * which breaks a labeled audio sub-graph feeding concat/acrossfade. So we detect
 * audio up front and substitute a dedicated anullsrc input for silent segments.
 * Best-effort: any probe failure assumes "has audio" (the common case) so we
 * never wrongly drop a real track.
 */
function probeHasAudio(src) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(src, (err, data) => {
      if (err || !data || !Array.isArray(data.streams)) return resolve(true)
      resolve(data.streams.some((s) => s && s.codec_type === 'audio'))
    })
  })
}

/**
 * Resolve a segment's concrete ffmpeg input (remote http(s) passthrough or
 * absolute local path). Falls back to the shared inputPath when the segment has
 * no own source (a trimmed view of the primary upload).
 */
function resolveSegmentSource(seg, fallbackInputPath) {
  const raw = seg.sourceUrl || seg.url || seg.src || null
  if (!raw) return fallbackInputPath
  return isRemoteUrl(raw) ? raw : toAbsolutePath(raw)
}

/**
 * Stitch primary video segments into a single intermediate MP4.
 *
 * @param {string} inputPath  shared/fallback source (already resolved abs/url)
 * @param {Array}  segments   raw timelineSegments (mixed types ok — filtered here)
 * @param {Object} opts       { width, height, fps }
 * @returns {Promise<string|null>} path to intermediate MP4, or null for no-op
 *          (single segment with no special flags → caller uses original source).
 */
async function stitchSegments(inputPath, segments, opts = {}) {
  const segs = selectPrimarySegments(segments)

  // No-op cases: nothing to stitch, or a single plain segment.
  if (segs.length === 0) return null
  if (segs.length === 1 && !segmentHasSpecial(segs[0])) return null

  const W = Math.max(2, Math.round(opts.width ?? 1920))
  const H = Math.max(2, Math.round(opts.height ?? 1080))
  const FPS = Math.max(1, Math.round(opts.fps ?? 30))

  // Build one ffmpeg invocation. Input index === segment index.
  const cmd = ffmpeg()
  const sources = segs.map((seg) => resolveSegmentSource(seg, inputPath))
  // SSRF: validate every remote segment source before it reaches ffmpeg.
  await Promise.all(sources.map((s) => assertSafeRemote(s)))
  for (const src of sources) cmd.input(src)

  // Probe audio presence in parallel. Silent segments synthesize their audio
  // with an in-graph `anullsrc` SOURCE FILTER (no extra input) — this avoids
  // fluent-ffmpeg rejecting `-f lavfi` inputs (lavfi is a device, not a demuxer
  // in its format whitelist) while staying version-robust across ffmpeg 5/6/8.
  const hasAudio = await Promise.all(sources.map((s) => probeHasAudio(s)))

  // Per-segment sub-graphs → normalized [vN]/[aN] labels with known durations.
  const graph = []
  /** kept (post-speed) duration of each segment, for xfade offset math. */
  const segDurations = []

  segs.forEach((seg, idx) => {
    const ss = Math.max(0, Number(seg.sourceStartTime) || 0)
    let se = Number(seg.sourceEndTime)
    if (!Number.isFinite(se)) {
      const dur = Number(seg.duration)
      se = Number.isFinite(dur) && dur > 0 ? ss + dur : null
    }
    // trimmed source length (pre-speed). Null → whole remaining stream.
    const trimLen = se != null && se > ss ? (se - ss) : null
    const speed = normSegSpeed(seg.playbackSpeed)
    const reversed = !!seg.reversed
    const isFreeze = !!(seg.freezeFrame || seg.freeze)
    const freezeDur = isFreeze
      ? Math.max(0.1, Number(seg.freezeDuration) || (trimLen != null ? trimLen : Number(seg.duration)) || 2)
      : 0
    // Speed ramp: when start/end speeds differ, approximate the segment as its
    // AVERAGE speed (correct overall timing; a true per-frame ramp needs a setpts
    // time-expression — tracked). J-cut/L-cut audio leads/tails (audio overlapping
    // the NEIGHBOUR clip) still need a cross-segment mixing model and remain
    // deferred — they can't be expressed in this per-segment concat fold.
    let effSpeed = speed
    {
      const sR0 = Number(seg.playbackSpeedStart), sR1 = Number(seg.playbackSpeedEnd)
      if (Number.isFinite(sR0) && Number.isFinite(sR1) && sR0 > 0 && sR1 > 0 && sR0 !== sR1) {
        effSpeed = normSegSpeed((sR0 + sR1) / 2)
      }
    }

    // ── VIDEO sub-graph ──
    const vParts = []
    if (isFreeze) {
      // Freeze-frame: hold one frame (at sourceStartTime) for freezeDur via a
      // tpad clone. A clip flagged freezeFrame now actually holds (was a no-op).
      vParts.push(`trim=start=${ss.toFixed(3)}:duration=${(1 / FPS).toFixed(4)}`)
      vParts.push('setpts=PTS-STARTPTS')
      vParts.push(`tpad=stop_mode=clone:stop_duration=${freezeDur.toFixed(3)}`)
    } else {
      if (trimLen != null) {
        vParts.push(`trim=start=${ss.toFixed(3)}:end=${se.toFixed(3)}`)
      } else if (ss > 0) {
        vParts.push(`trim=start=${ss.toFixed(3)}`)
      }
      vParts.push('setpts=PTS-STARTPTS')
      if (reversed) vParts.push('reverse')
      if (effSpeed !== 1) vParts.push(`setpts=${(1 / effSpeed).toFixed(6)}*PTS`)
    }
    // Per-segment CROP ({top,right,bottom,left} % insets from the editor). Was
    // defined on TimelineSegment but never applied. Crop the kept region BEFORE
    // the W:H normalization so it's then scaled to fill the frame.
    if (seg.crop && typeof seg.crop === 'object') {
      const fr = (v) => { const n = Number(v) || 0; return Math.max(0, Math.min(0.95, n > 1 ? n / 100 : n)) }
      const L = fr(seg.crop.left), R = fr(seg.crop.right), T = fr(seg.crop.top), B = fr(seg.crop.bottom)
      if ((L + R) < 0.99 && (T + B) < 0.99 && (L || R || T || B)) {
        vParts.push(`crop=w=iw*${(1 - L - R).toFixed(4)}:h=ih*${(1 - T - B).toFixed(4)}:x=iw*${L.toFixed(4)}:y=ih*${T.toFixed(4)}`)
      }
    }
    // Normalize geometry/timebase BEFORE concat/xfade (avoids size/SAR/fps
    // mismatch errors on stable ffmpeg). scale→pad keeps aspect, SAR=1, fps fixed.
    vParts.push(`scale=${W}:${H}:force_original_aspect_ratio=decrease`)
    vParts.push(`pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black`)
    vParts.push('setsar=1')
    vParts.push(`fps=${FPS}`)
    vParts.push('format=yuv420p')
    graph.push(`[${idx}:v]${vParts.join(',')}[v${idx}]`)

    // ── AUDIO sub-graph (always produce a track so concat/acrossfade is
    // uniform; silent segments synthesize silence via the anullsrc source filter). ──
    const isSilence = !hasAudio[idx]
    if (isSilence) {
      // anullsrc generates silence bounded to the kept length (or the freeze
      // duration) so it lines up with the video.
      const silLen = isFreeze ? freezeDur : (trimLen != null ? (trimLen / effSpeed) : 1)
      graph.push(
        `anullsrc=channel_layout=stereo:sample_rate=44100,` +
        `atrim=end=${silLen.toFixed(3)},asetpts=PTS-STARTPTS,` +
        `aformat=sample_fmts=fltp:channel_layouts=stereo[a${idx}]`
      )
    } else {
      const aParts = []
      if (isFreeze) {
        // Freeze holds the VIDEO frame but audio keeps playing: take the source
        // audio from sourceStartTime for freezeDur. (Also avoids the pure-silence
        // dynaudnorm NaN that broke the downstream render.)
        aParts.push(`atrim=start=${ss.toFixed(3)}:duration=${freezeDur.toFixed(3)}`)
        aParts.push('asetpts=PTS-STARTPTS')
      } else {
        if (trimLen != null) {
          aParts.push(`atrim=start=${ss.toFixed(3)}:end=${se.toFixed(3)}`)
        } else if (ss > 0) {
          aParts.push(`atrim=start=${ss.toFixed(3)}`)
        }
        aParts.push('asetpts=PTS-STARTPTS')
        if (reversed) aParts.push('areverse')
        if (effSpeed !== 1) {
          let s = effSpeed
          while (s > 2.0) { aParts.push('atempo=2.0'); s /= 2.0 }
          while (s < 0.5) { aParts.push('atempo=0.5'); s /= 0.5 }
          aParts.push(`atempo=${Math.max(0.5, Math.min(2.0, s)).toFixed(6)}`)
        }
      }
      // Per-segment VOLUME (0-1, or 0-100 if >2). Was defined on TimelineSegment
      // but never applied — a clip's level change had no effect on export.
      const segVol = Number(seg.volume)
      if (Number.isFinite(segVol) && segVol >= 0 && segVol !== 1) {
        aParts.push(`volume=${(segVol > 2 ? segVol / 100 : segVol).toFixed(3)}`)
      }
      aParts.push('aresample=44100')
      aParts.push('aformat=sample_fmts=fltp:channel_layouts=stereo')
      graph.push(`[${idx}:a]${aParts.join(',')}[a${idx}]`)
    }

    // Effective kept duration after speed (for xfade offset). When trimLen is
    // unknown we can't compute an xfade offset — those segments fall back to
    // plain concat (handled below).
    segDurations.push(isFreeze ? freezeDur : (trimLen != null ? trimLen / effSpeed : null))
  })

  // ── Concatenate, applying xfade/acrossfade where a transition is requested. ──
  // We fold left-to-right: acc holds the running [v]/[a] labels and the running
  // total video duration (needed to place each xfade offset).
  let accV = 'v0'
  let accA = 'a0'
  let accDur = segDurations[0]
  let lbl = 0 // unique label counter

  for (let i = 1; i < segs.length; i++) {
    const prev = segs[i - 1]
    const xt = resolveXfadeName(prev.transitionType || prev.transitionOut)
    const wantXfade = !!xt && Number(prev.transitionDuration) > 0
    const canXfade = wantXfade && Number.isFinite(accDur) && Number.isFinite(segDurations[i])

    const outV = `vx${lbl}`
    const outA = `ax${lbl}`
    lbl++

    if (canXfade) {
      const dur = Math.max(0.05, Math.min(Number(prev.transitionDuration),
        // keep transition shorter than either clip
        Math.max(0.05, Math.min(accDur, segDurations[i]) - 0.05)))
      const offset = Math.max(0, accDur - dur)
      graph.push(`[${accV}][v${i}]xfade=transition=${xt}:duration=${dur.toFixed(3)}:offset=${offset.toFixed(3)}[${outV}]`)
      graph.push(`[${accA}][a${i}]acrossfade=d=${dur.toFixed(3)}[${outA}]`)
      // xfade overlaps the two clips → combined dur = accDur + segDur - overlap.
      accDur = accDur + segDurations[i] - dur
    } else {
      graph.push(`[${accV}][${accA}][v${i}][a${i}]concat=n=2:v=1:a=1[${outV}][${outA}]`)
      accDur = (Number.isFinite(accDur) && Number.isFinite(segDurations[i]))
        ? accDur + segDurations[i] : null
    }
    accV = outV
    accA = outA
  }

  const outputDir = path.join(__dirname, '../../uploads/exports')
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })
  const outPath = path.join(outputDir, `stitch-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.mp4`)

  await new Promise((resolve, reject) => {
    cmd
      .complexFilter(graph, [accV, accA])
      .outputOptions([
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '20',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart',
      ])
      .on('error', (err) => reject(err))
      .on('end', () => resolve())
      .save(outPath)
  })

  return outPath
}

module.exports = {
  renderFromEditorState,
  stitchSegments,
  needsStitch,
  selectPrimarySegments,
  resolveInputPath,
  buildVideoFilterChain,
  buildAudioMix,
  buildMasterFx,
  buildDrawTextFilter,
  pickHighlightWords,
  resolveXfadeName,
  stripEmoji,
  extractEmoji,
  getEmojiFontPath,
  buildDrawBoxFilter,
  buildImageOverlaySegment,
  buildVideoTransformChain,
  buildKeyframeExpr,
  buildTextAnimation,
  generateGradientPng,
  rasterizeSvgToPng,
}
