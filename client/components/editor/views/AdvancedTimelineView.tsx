
import React, { useState } from 'react'
import { Clock, Plus, Trash2, Play, Copy, Scissors, Pencil, ChevronUp, ChevronDown, Merge, Music2 } from 'lucide-react'
import { TimelineSegment, getDefaultTrackForSegmentType } from '../../../types/editor'
import { formatTime, parseTime } from '../../../utils/editorUtils'

function SegmentRow({
  segment: s,
  duration,
  formatTime,
  parseTime,
  onUpdateTime,
  onJumpTo,
  onRemove,
  onSetIn,
  onSetOut,
  onDuplicate,
  onSplit,
  onRename,
  onMerge,
  onReorder,
  onTypeChange,
  canMerge,
  canMoveUp,
  canMoveDown,
  isSelected,
  onSelect,
  playhead
}: {
  segment: TimelineSegment
  duration: number
  formatTime: (t: number) => string
  parseTime: (v: string) => number
  onUpdateTime: (id: string, field: 'startTime' | 'endTime', value: number) => void
  onJumpTo: (t: number) => void
  onRemove: (id: string) => void
  onSetIn: () => void
  onSetOut: () => void
  onDuplicate: () => void
  onSplit: () => void
  onRename: (name: string) => void
  onMerge?: () => void
  onReorder?: (dir: -1 | 1) => void
  onTypeChange?: (type: import('../../../types/editor').TimelineSegmentType) => void
  canMerge?: boolean
  canMoveUp?: boolean
  canMoveDown?: boolean
  isSelected?: boolean
  onSelect?: () => void
  playhead: number
}) {
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(s.name)
  const canSplit = playhead > s.startTime && playhead < s.endTime
  const barLeft = duration > 0 ? (s.startTime / duration) * 100 : 0
  const barWidth = duration > 0 ? ((s.endTime - s.startTime) / duration) * 100 : 0
  const playheadPos = duration > 0 ? (playhead / duration) * 100 : 0

  return (
    <div
      onClick={(e) => { if (!(e.target as HTMLElement).closest('button') && !(e.target as HTMLElement).closest('input') && !(e.target as HTMLElement).closest('select')) onSelect?.() }}
      className={`p-4 rounded-xl space-y-2 cursor-pointer transition-all ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500 dark:border-blue-400 ring-2 ring-blue-500/30' : 'bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          {onTypeChange ? (
            <select
              value={s.type}
              onChange={(e) => onTypeChange(e.target.value as import('../../../types/editor').TimelineSegmentType)}
              className="w-9 h-9 rounded-lg bg-blue-500/20 font-black text-blue-600 text-[10px] uppercase shrink-0 border-0 cursor-pointer px-1"
              title="Segment type"
            >
              {['video', 'audio', 'text', 'transition', 'image'].map((t) => (
                <option key={t} value={t}>{t[0].toUpperCase()}</option>
              ))}
            </select>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center font-black text-blue-600 text-[10px] uppercase shrink-0">{s.type[0]}</div>
          )}
          {editingName ? (
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={() => { onRename(nameInput); setEditingName(false) }}
              onKeyDown={(e) => e.key === 'Enter' && (onRename(nameInput), setEditingName(false))}
              className="w-32 px-2 py-1 text-[11px] font-bold rounded border border-blue-500 bg-white dark:bg-gray-800"
              autoFocus
            />
          ) : (
            <span
              onClick={() => { setEditingName(true); setNameInput(s.name) }}
              className="text-[11px] font-bold text-gray-700 dark:text-gray-300 truncate cursor-pointer hover:text-blue-600 flex items-center gap-1"
              title="Click to rename"
            >
              {s.name}
              <Pencil className="w-3 h-3 opacity-50" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <label className="text-[9px] font-bold text-gray-500 uppercase">Start</label>
            <input
              type="text"
              value={formatTime(s.startTime)}
              onChange={(e) => onUpdateTime(s.id, 'startTime', parseTime(e.target.value))}
              className="w-14 px-2 py-1 text-[10px] font-mono rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="0:00"
              title="Start time (e.g. 1:30 or 90)"
            />
          </div>
          <button onClick={onSetIn} className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-green-500 hover:text-white text-[9px] font-bold" title="Set start to playhead">
            In
          </button>
          <span className="text-gray-400">–</span>
          <div className="flex items-center gap-1">
            <label className="text-[9px] font-bold text-gray-500 uppercase">End</label>
            <input
              type="text"
              value={formatTime(s.endTime)}
              onChange={(e) => onUpdateTime(s.id, 'endTime', parseTime(e.target.value))}
              className="w-14 px-2 py-1 text-[10px] font-mono rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="0:00"
              title="End time (e.g. 2:00 or 120)"
            />
          </div>
          <button onClick={onSetOut} className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-green-500 hover:text-white text-[9px] font-bold" title="Set end to playhead">
            Out
          </button>
          <span className="text-[10px] font-mono text-gray-400">({s.duration.toFixed(1)}s)</span>
          <button onClick={() => onJumpTo(s.startTime)} className="p-1.5 rounded bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 hover:text-white" title="Jump to start">
            <Play className="w-3 h-3" />
          </button>
          {canSplit && (
            <button onClick={onSplit} className="p-1.5 rounded bg-gray-200 dark:bg-gray-700 hover:bg-amber-500 hover:text-white" title="Split at playhead">
              <Scissors className="w-3 h-3" />
            </button>
          )}
          <button onClick={onDuplicate} className="p-1.5 rounded bg-gray-200 dark:bg-gray-700 hover:bg-indigo-500 hover:text-white" title="Duplicate segment">
            <Copy className="w-3 h-3" />
          </button>
          {canMerge && onMerge && (
            <button onClick={onMerge} className="p-1.5 rounded bg-gray-200 dark:bg-gray-700 hover:bg-emerald-500 hover:text-white" title="Merge with next">
              <Merge className="w-3 h-3" />
            </button>
          )}
          {canMoveUp && onReorder && (
            <button onClick={() => onReorder(-1)} className="p-1.5 rounded bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 hover:text-white" title="Move up">
              <ChevronUp className="w-3 h-3" />
            </button>
          )}
          {canMoveDown && onReorder && (
            <button onClick={() => onReorder(1)} className="p-1.5 rounded bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 hover:text-white" title="Move down">
              <ChevronDown className="w-3 h-3" />
            </button>
          )}
          <button onClick={() => onRemove(s.id)} className="p-1.5 rounded bg-gray-200 dark:bg-gray-700 hover:bg-red-500 hover:text-white" title="Remove segment">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
      <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full relative overflow-hidden">
        <div
          className="absolute h-full bg-blue-500 rounded-full"
          style={{ left: `${barLeft}%`, width: `${barWidth}%` }}
        />
        {playhead >= s.startTime && playhead <= s.endTime && (
          <div
            className="absolute top-0 w-0.5 h-full bg-white shadow-sm z-10"
            style={{ left: `${playheadPos}%` }}
            title={`Playhead ${formatTime(playhead)}`}
          />
        )}
      </div>
    </div>
  )
}

interface AdvancedTimelineViewProps {
  useProfessionalTimeline: boolean
  setUseProfessionalTimeline: (v: boolean) => void
  videoState: any
  setVideoState: (v: any) => void
  timelineSegments: TimelineSegment[]
  setTimelineSegments: (v: any) => void
  selectedSegmentId?: string | null
  onSegmentSelect?: (id: string | null) => void
  videoUrl: string
  aiSuggestions: any[]
  showAiPreviews: boolean
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

const AdvancedTimelineView: React.FC<AdvancedTimelineViewProps> = ({
  useProfessionalTimeline, setUseProfessionalTimeline, videoState, setVideoState, timelineSegments, setTimelineSegments, selectedSegmentId = null, onSegmentSelect, aiSuggestions, showToast
}) => {
  const duration = videoState?.duration ?? 60

  const updateSegmentTime = (id: string, field: 'startTime' | 'endTime', value: number) => {
    setTimelineSegments((prev: TimelineSegment[]) => prev.map(s => {
      if (s.id !== id) return s
      const next = { ...s, [field]: Math.max(0, Math.min(duration, value)) }
      if (field === 'startTime' && next.startTime >= next.endTime) next.endTime = Math.min(duration, next.startTime + 1)
      if (field === 'endTime' && next.endTime <= next.startTime) next.startTime = Math.max(0, next.endTime - 1)
      next.duration = next.endTime - next.startTime
      return next
    }))
  }

  const addSegment = () => {
    const start = videoState?.currentTime ?? 0
    const end = Math.min(duration, start + 5)
    const seg: TimelineSegment = {
      id: `seg-${Date.now()}`,
      startTime: start,
      endTime: end,
      duration: end - start,
      type: 'video',
      name: 'New Segment',
      color: '#3B82F6',
      track: 0
    }
    setTimelineSegments((prev: TimelineSegment[]) => [...prev, seg])
    showToast('Segment added — edit timestamps below', 'success')
  }

  const removeSegment = (id: string) => {
    setTimelineSegments((prev: TimelineSegment[]) => prev.filter(s => s.id !== id))
    showToast('Segment removed', 'info')
  }

  const jumpTo = (time: number) => {
    setVideoState((prev: any) => ({ ...prev, currentTime: time }))
    showToast(`Jumped to ${formatTime(time)}`, 'info')
  }

  const setFromPlayhead = (id: string, field: 'startTime' | 'endTime') => {
    const t = videoState?.currentTime ?? 0
    updateSegmentTime(id, field, t)
    showToast(`${field === 'startTime' ? 'In' : 'Out'} point set to ${formatTime(t)}`, 'success')
  }

  const duplicateSegment = (s: TimelineSegment) => {
    const dup: TimelineSegment = {
      ...s,
      id: `seg-${Date.now()}`,
      name: s.name + ' (copy)',
      startTime: s.endTime,
      endTime: Math.min(duration, s.endTime + s.duration),
      duration: s.duration
    }
    setTimelineSegments((prev: TimelineSegment[]) => [...prev, dup])
    showToast('Segment duplicated', 'success')
  }

  const splitAtPlayhead = (id: string) => {
    const playhead = videoState?.currentTime ?? 0
    setTimelineSegments((prev: TimelineSegment[]) => {
      const seg = prev.find((x) => x.id === id)
      if (!seg || playhead <= seg.startTime || playhead >= seg.endTime) return prev
      const a: TimelineSegment = { ...seg, endTime: playhead, duration: playhead - seg.startTime }
      const b: TimelineSegment = {
        ...seg,
        id: `seg-${Date.now()}`,
        startTime: playhead,
        endTime: seg.endTime,
        duration: seg.endTime - playhead,
        name: seg.name + ' (2)'
      }
      return prev.map((x) => (x.id === id ? a : x)).concat(b)
    })
    showToast('Segment split at playhead', 'success')
  }

  const updateSegmentName = (id: string, name: string) => {
    setTimelineSegments((prev: TimelineSegment[]) => prev.map((s) => (s.id === id ? { ...s, name: name || s.name } : s)))
  }

  const updateSegmentType = (id: string, type: import('../../../types/editor').TimelineSegmentType) => {
    setTimelineSegments((prev: TimelineSegment[]) => prev.map((s) => (s.id === id ? { ...s, type, track: getDefaultTrackForSegmentType(type) } : s)))
  }

  const mergeWithNext = (id: string) => {
    const idx = timelineSegments.findIndex((x) => x.id === id)
    if (idx < 0 || idx >= timelineSegments.length - 1) return
    const a = timelineSegments[idx]
    const b = timelineSegments[idx + 1]
    const merged: TimelineSegment = {
      ...a,
      endTime: b.endTime,
      duration: b.endTime - a.startTime,
      name: `${a.name}+${b.name}`
    }
    setTimelineSegments((prev: TimelineSegment[]) => prev.filter((_, i) => i !== idx + 1).map((seg, i) => (i === idx ? merged : seg)))
    showToast('Segments merged', 'success')
  }

  const reorderSegment = (id: string, dir: -1 | 1) => {
    const idx = timelineSegments.findIndex((x) => x.id === id)
    if (idx < 0) return
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= timelineSegments.length) return
    const arr = [...timelineSegments]
      ;[arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]]
    setTimelineSegments(arr)
    showToast(dir === -1 ? 'Moved up' : 'Moved down', 'info')
  }

  const suggestCutsToBeat = (intervalSeconds = 2) => {
    setTimelineSegments((prev: TimelineSegment[]) => {
      let videoSegments = prev.filter((s) => s.type === 'video' || s.type === 'image')
      let longest: TimelineSegment
      if (videoSegments.length === 0) {
        longest = {
          id: `seg-main-${Date.now()}`,
          startTime: 0,
          endTime: duration,
          duration,
          type: 'video',
          name: 'Main Video',
          color: '#3B82F6',
          track: getDefaultTrackForSegmentType('video'),
        }
      } else {
        longest = videoSegments.reduce((a, b) => (b.duration > a.duration ? b : a))
      }
      const start = longest.startTime
      const end = longest.endTime
      const segDuration = end - start
      if (segDuration < intervalSeconds * 2) {
        showToast(`Segment too short (${segDuration.toFixed(1)}s). Use interval ≤ ${(segDuration / 2).toFixed(1)}s`, 'error')
        return prev
      }
      const cutTimes: number[] = []
      for (let t = start + intervalSeconds; t < end - 0.1; t += intervalSeconds) {
        cutTimes.push(t)
      }
      if (cutTimes.length === 0) {
        showToast(`Segment too short for ${intervalSeconds}s interval`, 'info')
        return prev
      }
      let result = prev.filter((s) => s.id !== longest.id)
      let lastStart = start
      const baseId = Date.now()
      cutTimes.forEach((t, i) => {
        result = [...result, {
          ...longest,
          id: `seg-${baseId}-${i}`,
          startTime: lastStart,
          endTime: t,
          duration: t - lastStart,
          name: `${longest.name} (${i + 1})`,
        }]
        lastStart = t
      })
      result = [...result, {
        ...longest,
        id: `seg-${baseId}-${cutTimes.length}`,
        startTime: lastStart,
        endTime: end,
        duration: end - lastStart,
        name: `${longest.name} (${cutTimes.length + 1})`,
      }]
      showToast(`Split into ${cutTimes.length + 1} segments at ${intervalSeconds}s intervals (beat sync)`, 'success')
      return result
    })
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-semibold text-gray-900 dark:text-white">Timeline Orchestration</h3>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-gray-500 uppercase">Beat sync</span>
            {[1, 2, 4].map((interval) => (
              <button
                key={interval}
                onClick={() => suggestCutsToBeat(interval)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-100 dark:bg-violet-900/30 hover:bg-violet-200 dark:hover:bg-violet-900/50 text-violet-700 dark:text-violet-300 text-xs font-bold transition-all"
                title={`Split longest video segment every ${interval}s (beat-aligned cuts)`}
              >
                <Music2 className="w-3.5 h-3.5" />
                {interval}s
              </button>
            ))}
          </div>
          <div className="flex bg-gray-100 dark:bg-gray-950 p-1 rounded-xl">
            <button
              onClick={() => setUseProfessionalTimeline(false)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${!useProfessionalTimeline ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-600' : 'text-gray-400'}`}
            >Basic</button>
            <button
              onClick={() => setUseProfessionalTimeline(true)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${useProfessionalTimeline ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-600' : 'text-gray-400'}`}
            >Pro</button>
          </div>
        </div>
        <p className="text-[10px] text-gray-500 font-medium">Toggle between rapid assembly and precision multi-track orchestration.</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-black uppercase text-gray-400 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" />
            Active Segments ({timelineSegments.length})
            {selectedSegmentId && (
              <span className="text-[9px] font-normal text-blue-600 dark:text-blue-400">· Click row to select · Del to remove</span>
            )}
          </h4>
          <button
            onClick={addSegment}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-500 text-white rounded-lg text-[10px] font-bold hover:bg-blue-600 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Segment
          </button>
        </div>
        <div className="space-y-3">
          {timelineSegments.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
              <p className="text-sm font-medium">No segments yet</p>
              <p className="text-[10px] mt-1">Add a segment to specify start and end timestamps</p>
              <button onClick={addSegment} className="mt-3 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-600">
                Add Segment
              </button>
            </div>
          ) : (
            timelineSegments.map((s, idx) => (
              <SegmentRow
                key={s.id}
                segment={s}
                duration={duration}
                formatTime={formatTime}
                parseTime={(v: string) => parseTime(v, duration)}
                onUpdateTime={updateSegmentTime}
                onJumpTo={jumpTo}
                onRemove={removeSegment}
                onSetIn={() => setFromPlayhead(s.id, 'startTime')}
                onSetOut={() => setFromPlayhead(s.id, 'endTime')}
                onDuplicate={() => duplicateSegment(s)}
                onSplit={() => splitAtPlayhead(s.id)}
                onRename={(name) => updateSegmentName(s.id, name)}
                onMerge={() => mergeWithNext(s.id)}
                onReorder={(dir) => reorderSegment(s.id, dir)}
                onTypeChange={(type) => updateSegmentType(s.id, type)}
                canMerge={idx < timelineSegments.length - 1}
                canMoveUp={idx > 0}
                canMoveDown={idx < timelineSegments.length - 1}
                isSelected={selectedSegmentId === s.id}
                onSelect={() => onSegmentSelect?.(selectedSegmentId === s.id ? null : s.id)}
                playhead={videoState?.currentTime ?? 0}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default AdvancedTimelineView
