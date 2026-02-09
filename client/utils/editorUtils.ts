import { TimelineSegmentType } from '../types/editor'

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
