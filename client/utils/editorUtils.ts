import { TimelineSegmentType, EditorContentPreferences, EditorCategory, EDITOR_CONTENT_PREFS_KEY, TimelineSegment } from '../types/editor'

/** Format seconds as M:SS, or H:MM:SS for long videos */
export const formatTime = (time: number): string => {
  if (!isFinite(time) || time < 0) return '0:00'
  const hours = Math.floor(time / 3600)
  const minutes = Math.floor((time % 3600) / 60)
  const seconds = Math.floor(time % 60)
  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/** Format seconds as M:SS.ms (e.g. 1:30.500) */
export const formatTimeDetailed = (time: number): string => {
  if (!isFinite(time) || time < 0) return '0:00.0'
  const minutes = Math.floor(time / 60)
  const secs = time % 60
  const seconds = Math.floor(secs)
  const ms = Math.round((secs - seconds) * 10)
  if (ms > 0) return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms}`
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/** Format with decimal seconds for precision (e.g. 1:23.4) */
export const formatTimePrecise = (time: number, decimals = 1): string => {
  if (!isFinite(time) || time < 0) return '0:00.0'
  const minutes = Math.floor(time / 60)
  const secs = time % 60
  if (decimals <= 0) return `${minutes}:${Math.floor(secs).toString().padStart(2, '0')}`
  const secInt = Math.floor(secs)
  const frac = secs - secInt
  const fracStr = frac.toFixed(decimals).slice(1)
  return `${minutes}:${secInt.toString().padStart(2, '0')}${fracStr}`
}

/** Format as M:SS:ff (frames at given fps, e.g. 1:02:15 @ 30fps) */
export const formatTimeFrames = (time: number, fps: 24 | 30 = 30): string => {
  if (!isFinite(time) || time < 0) return fps === 30 ? '0:00:00' : '0:00:00'
  const totalFrames = Math.round(time * fps)
  const minutes = Math.floor(totalFrames / (fps * 60))
  const remainder = totalFrames % (fps * 60)
  const seconds = Math.floor(remainder / fps)
  const frames = remainder % fps
  return `${minutes}:${seconds.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`
}

/** Snap options for timeline (seconds). Includes frame-accurate 1/24 and 1/30. */
export const SNAP_STEPS = [1 / 30, 1 / 24, 0.25, 0.5, 1, 2, 5, 10] as const

/** Snap time to nearest value in a list of edges (e.g. segment boundaries) if within threshold seconds */
export function snapToNearestEdge(
  time: number,
  edges: number[],
  thresholdSeconds: number
): number {
  if (edges.length === 0) return time
  const sorted = Array.from(new Set(edges)).sort((a, b) => a - b)
  let best = time
  let bestDist = thresholdSeconds + 1
  for (const edge of sorted) {
    const d = Math.abs(time - edge)
    if (d < bestDist) {
      bestDist = d
      best = edge
    }
  }
  return bestDist <= thresholdSeconds ? best : time
}

/** Parse timestamp string to seconds. Accepts: "1:30", "1:30:15", "1:30.5", "90", "0:05", "1:" (=60) */
export const parseTime = (input: string, maxDuration: number = Infinity): number => {
  const s = String(input).trim().replace(/,/g, '.')
  if (!s) return 0
  const hms = s.match(/^(\d+):(\d+):(\d+)(?:\.(\d+))?$/)
  if (hms) {
    const t = parseInt(hms[1], 10) * 3600 + parseInt(hms[2], 10) * 60 + parseInt(hms[3], 10) + (hms[4] ? parseFloat('0.' + hms[4]) : 0)
    return Math.max(0, Math.min(maxDuration, t))
  }
  const match = s.match(/^(?:(\d+):)?(\d*)(?:\.(\d+))?$/)
  if (match) {
    const minutes = match[1] ? parseInt(match[1], 10) : 0
    const seconds = match[2] ? parseInt(match[2], 10) : 0
    const frac = match[3] ? parseFloat('0.' + match[3]) : 0
    const t = minutes * 60 + seconds + frac
    return Math.max(0, Math.min(maxDuration, t))
  }
  const num = parseFloat(s)
  if (!isNaN(num) && num >= 0) return Math.min(maxDuration, num)
  return 0
}

/** Snap time to nearest grid step (e.g. 5 for 5-second marks) */
export const snapToGrid = (time: number, step: number): number => Math.round(time / step) * step

/**
 * Returns true when a timed item [itemStart, itemEnd] intersects the visible
 * window [winStart, winEnd]. Used by the timeline to virtualize lanes — items
 * that touch the window (even partially) are kept mounted. A `null` window
 * (range not yet measured) is treated as "everything visible" so nothing is
 * culled before the first scroll/resize measurement.
 */
export function intersectsRange(
  itemStart: number,
  itemEnd: number,
  win: { start: number; end: number } | null
): boolean {
  if (!win) return true
  return itemEnd >= win.start && itemStart <= win.end
}

export const getSegmentColor = (type: TimelineSegmentType | string): string => {
  const colors: { [key: string]: string } = {
    video: '#3B82F6',
    audio: '#10B981',
    text: '#F59E0B',
    transition: '#8B5CF6',
    image: '#EC4899'
  }
  return colors[type] || '#6B7280'
}

export const getCategoryColor = (category: string): string => {
  const colors: { [key: string]: string } = {
    'ai-edit': 'from-fuchsia-600 to-purple-600',
    'edit': 'from-blue-500 to-blue-600',
    'effects': 'from-purple-500 to-purple-600',
    'color': 'from-indigo-500 to-indigo-600',
    'chromakey': 'from-emerald-500 to-emerald-600',
    'visual-fx': 'from-cyan-500 to-blue-500',
    'automate': 'from-orange-500 to-red-500',
    'ai-analysis': 'from-pink-500 to-purple-500',
    'collaborate': 'from-green-500 to-teal-500',
    'timeline': 'from-yellow-500 to-orange-500',
    'assets': 'from-indigo-500 to-purple-500',
    'ai': 'from-emerald-500 to-teal-500',
    'export': 'from-red-500 to-pink-500',
    'growth': 'from-emerald-500 to-teal-500',
    'remix': 'from-orange-500 to-amber-500'
  }
  return colors[category] || 'from-gray-500 to-gray-600'
}

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'saving': return 'text-blue-500'
    case 'saved': return 'text-green-500'
    case 'error': return 'text-red-500'
    default: return 'text-gray-400'
  }
}

const VALID_PRESETS = ['shorts', 'reels', 'tiktok', '1080p', '4k', 'best']
const VALID_QUALITY = ['high', 'medium', 'low'] as const
const VALID_CODEC = ['h264', 'hevc'] as const
const VALID_PREVIEW = ['draft', 'full'] as const

const DEFAULT_CONTENT_PREFS: EditorContentPreferences = {
  defaultExportPreset: '1080p',
  defaultExportQuality: 'high',
  defaultExportCodec: 'h264',
  defaultOpenSection: 'edit',
  previewQuality: 'full',
  showExportPlatformHints: true,
  recentSections: [],
}

/** Load editor content/quality preferences from localStorage */
export function loadEditorContentPreferences(): EditorContentPreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_CONTENT_PREFS }
  try {
    const raw = localStorage.getItem(EDITOR_CONTENT_PREFS_KEY)
    if (!raw) return { ...DEFAULT_CONTENT_PREFS }
    const parsed = JSON.parse(raw) as Partial<EditorContentPreferences>
    return {
      ...DEFAULT_CONTENT_PREFS,
      ...parsed,
      defaultExportPreset: VALID_PRESETS.includes(parsed.defaultExportPreset ?? '') ? parsed.defaultExportPreset : DEFAULT_CONTENT_PREFS.defaultExportPreset,
      defaultExportQuality: VALID_QUALITY.includes(parsed.defaultExportQuality as any) ? parsed.defaultExportQuality : DEFAULT_CONTENT_PREFS.defaultExportQuality,
      defaultExportCodec: VALID_CODEC.includes(parsed.defaultExportCodec as any) ? parsed.defaultExportCodec : DEFAULT_CONTENT_PREFS.defaultExportCodec,
      previewQuality: VALID_PREVIEW.includes(parsed.previewQuality as any) ? parsed.previewQuality : DEFAULT_CONTENT_PREFS.previewQuality,
      recentSections: Array.isArray(parsed.recentSections) ? parsed.recentSections.slice(0, 5) : DEFAULT_CONTENT_PREFS.recentSections,
    }
  } catch {
    return { ...DEFAULT_CONTENT_PREFS }
  }
}

/** Save editor content preferences to localStorage */
export function saveEditorContentPreferences(patch: Partial<EditorContentPreferences>): void {
  if (typeof window === 'undefined') return
  try {
    const current = loadEditorContentPreferences()
    const next = { ...current, ...patch }
    localStorage.setItem(EDITOR_CONTENT_PREFS_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
}

/** Push a category to recent list (max 5), persist */
export function pushRecentSection(category: EditorCategory): void {
  const prefs = loadEditorContentPreferences()
  const recent = prefs.recentSections ?? []
  const filtered = recent.filter(c => c !== category)
  const next = [category, ...filtered].slice(0, 5)
  saveEditorContentPreferences({ recentSections: next })
}

/**
 * True ripple delete across ALL tracks: removes a time range [rangeStart, rangeEnd]
 * and shifts every segment that starts at/after rangeEnd to the left by the gap,
 * regardless of which track it lives on. Segments that straddle the deleted range
 * are trimmed (their end is pulled in by the overlapping amount) but never inverted.
 *
 * `excludeIds` are segments that have already been removed by the caller (e.g. the
 * deleted selection) and must not be shifted.
 */
export function rippleDeleteAcrossTracks(
  segments: TimelineSegment[],
  rangeStart: number,
  rangeEnd: number,
  excludeIds: string[] = []
): TimelineSegment[] {
  const gap = rangeEnd - rangeStart
  if (gap <= 0) return segments
  const excluded = new Set(excludeIds)
  return segments.map((seg) => {
    if (excluded.has(seg.id)) return seg
    // Segment entirely after the removed range → shift left by the full gap.
    if (seg.startTime >= rangeEnd) {
      const newStart = Math.max(0, seg.startTime - gap)
      const newEnd = Math.max(newStart, seg.endTime - gap)
      return { ...seg, startTime: newStart, endTime: newEnd, duration: newEnd - newStart }
    }
    // Segment overlaps the removed range → trim the overlapping tail, keep start.
    if (seg.endTime > rangeStart && seg.startTime < rangeEnd) {
      const overlap = Math.min(seg.endTime, rangeEnd) - Math.max(seg.startTime, rangeStart)
      const newEnd = Math.max(seg.startTime, seg.endTime - overlap)
      return { ...seg, endTime: newEnd, duration: newEnd - seg.startTime }
    }
    return seg
  })
}

/**
 * Resolves overlap collisions on a given timeline track by rippling/shifting subsequent segments to the right.
 * Also deduplicates exact visual duplicates on the same track.
 */
export function resolveTimelineOverlaps(
  segments: TimelineSegment[],
  draggedId: string,
  proposedStart: number,
  proposedEnd: number,
  proposedTrack: number
): TimelineSegment[] {
  const duration = Math.max(0.1, proposedEnd - proposedStart)
  const finalStart = Math.max(0, proposedStart)
  const finalEnd = finalStart + duration

  // 1. Separate the dragged/edited segment from all other segments
  const otherSegments = segments.filter(s => s.id !== draggedId)

  // 2. Extract and sort other segments on the target track
  const trackSegments = otherSegments
    .filter(s => (s.track ?? 0) === proposedTrack)
    .sort((a, b) => a.startTime - b.startTime)

  // 3. Find the original dragged segment to clone its properties
  const draggedSegment = segments.find(s => s.id === draggedId)
  if (!draggedSegment) return segments

  const tempDragged: TimelineSegment = {
    ...draggedSegment,
    startTime: finalStart,
    endTime: finalEnd,
    duration,
    track: proposedTrack
  }

  // 4. Combine and sort all segments on this track
  const combined = [...trackSegments, tempDragged].sort((a, b) => a.startTime - b.startTime)

  // 5. Cascade overlap resolution: shift overlapping segments to the right
  for (let i = 1; i < combined.length; i++) {
    const prev = combined[i - 1]
    const curr = combined[i]
    if (curr.startTime < prev.endTime) {
      const dur = Math.max(0.1, curr.endTime - curr.startTime)
      curr.startTime = prev.endTime
      curr.endTime = curr.startTime + dur
      curr.duration = dur
    }
  }

  // 6. Deduplicate: remove any exact visual duplicates (same start and end times)
  const uniqueTrackSegments: TimelineSegment[] = []
  const seen = new Set<string>()
  for (const s of combined) {
    const key = `${s.startTime.toFixed(3)}-${s.endTime.toFixed(3)}`
    if (!seen.has(key)) {
      seen.add(key)
      uniqueTrackSegments.push(s)
    }
  }

  // 7. Reconstruct the final timeline segment list
  return segments
    .map(s => {
      if (s.id === draggedId) {
        const resolved = uniqueTrackSegments.find(x => x.id === draggedId)
        return resolved ? resolved : { ...s, startTime: finalStart, endTime: finalEnd, duration, track: proposedTrack }
      }
      
      if ((s.track ?? 0) === proposedTrack) {
        // If it was on the same track, return the resolved version (shifted and deduplicated)
        const resolved = uniqueTrackSegments.find(x => x.id === s.id)
        if (!resolved) return null // Removed as duplicate
        return resolved
      }
      
      return s
    })
    .filter((s): s is TimelineSegment => s !== null)
}

