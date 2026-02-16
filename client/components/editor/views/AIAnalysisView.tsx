'use client'

import React, { useState } from 'react'
import { Scan, Scissors, Sparkles, TrendingUp, ChevronRight, Loader2 } from 'lucide-react'
import { EditorCategory } from '../../../types/editor'
import { TimelineSegment } from '../../../types/editor'

interface AIAnalysisViewProps {
  videoId: string
  videoDuration: number
  currentTime: number
  timelineSegments: TimelineSegment[]
  setTimelineSegments: React.Dispatch<React.SetStateAction<TimelineSegment[]>>
  setActiveCategory: (c: EditorCategory) => void
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

const AIAnalysisView: React.FC<AIAnalysisViewProps> = ({
  videoId,
  videoDuration,
  currentTime,
  timelineSegments,
  setTimelineSegments,
  setActiveCategory,
  showToast,
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [suggestions, setSuggestions] = useState<{ time: number; label: string; type: 'cut' | 'hook' | 'broll' }[]>([])

  const runSceneDetection = () => {
    if (videoDuration <= 0) {
      showToast('Load a video first', 'error')
      return
    }
    setIsAnalyzing(true)
    // Simulate scene detection: suggest segments every ~8–15s for variety
    setTimeout(() => {
      const segs: { time: number; label: string; type: 'cut' | 'hook' | 'broll' }[] = []
      let t = 5
      while (t < videoDuration - 3) {
        const step = 8 + Math.random() * 7
        t += step
        if (t >= videoDuration - 2) break
        const types: ('cut' | 'hook' | 'broll')[] = ['cut', 'hook', 'broll']
        segs.push({ time: t, label: `Suggested cut at ${t.toFixed(1)}s`, type: types[Math.floor(Math.random() * 3)] })
      }
      setSuggestions(segs)
      setIsAnalyzing(false)
      showToast(`Found ${segs.length} suggested edit points`, 'success')
    }, 1200)
  }

  const addSegmentFromSuggestion = (time: number) => {
    const duration = 5
    const end = Math.min(time + duration, videoDuration)
    const newSeg: TimelineSegment = {
      id: `seg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      startTime: time,
      endTime: end,
      duration: end - time,
      type: 'video',
      name: `Clip at ${time.toFixed(1)}s`,
      color: '#8B5CF6',
      track: 0,
    }
    setTimelineSegments((prev) => [...prev, newSeg].sort((a, b) => a.startTime - b.startTime))
    setSuggestions((prev) => prev.filter((s) => s.time !== time))
    showToast('Segment added to timeline', 'success')
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface-card rounded-xl border border-subtle p-5">
        <h3 className="text-sm font-bold text-theme-primary flex items-center gap-2 mb-2">
          <Scan className="w-4 h-4 text-violet-500" />
          Scene detection & edit suggestions
        </h3>
        <p className="text-xs text-theme-secondary mb-4">
          Get AI-suggested edit points to improve pacing and retention. For full transcript-based analysis, use Elite AI first.
        </p>

        <button
          type="button"
          onClick={runSceneDetection}
          disabled={isAnalyzing || videoDuration <= 0}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold text-sm transition-colors"
        >
          {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scan className="w-4 h-4" />}
          {isAnalyzing ? 'Analyzing...' : 'Suggest edit points'}
        </button>
      </div>

      {suggestions.length > 0 && (
        <div className="bg-surface-card rounded-xl border border-subtle p-5">
          <h4 className="text-xs font-bold text-theme-primary uppercase tracking-wider mb-3">Suggested edits</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
            {suggestions.map((s) => (
              <div
                key={s.time}
                className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-surface-elevated border border-subtle"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-mono text-theme-muted shrink-0">{s.time.toFixed(1)}s</span>
                  <span className="text-xs text-theme-primary truncate">{s.label}</span>
                </div>
                <button
                  type="button"
                  onClick={() => addSegmentFromSuggestion(s.time)}
                  className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-violet-600 text-white hover:bg-violet-700"
                >
                  <Scissors className="w-3 h-3" />
                  Add
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setActiveCategory('ai-edit')}
          className="flex items-center gap-3 p-4 rounded-xl bg-surface-card border border-subtle hover:bg-surface-card-hover transition-colors text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-fuchsia-500/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-fuchsia-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-theme-primary">Elite AI</p>
            <p className="text-[10px] text-theme-muted">Transcribe & semantic edit</p>
          </div>
          <ChevronRight className="w-4 h-4 text-theme-muted ml-auto" />
        </button>
        <button
          type="button"
          onClick={() => setActiveCategory('timeline')}
          className="flex items-center gap-3 p-4 rounded-xl bg-surface-card border border-subtle hover:bg-surface-card-hover transition-colors text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Scissors className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-theme-primary">Timeline</p>
            <p className="text-[10px] text-theme-muted">Precision cuts & segments</p>
          </div>
          <ChevronRight className="w-4 h-4 text-theme-muted ml-auto" />
        </button>
      </div>

      <div className="bg-surface-elevated rounded-xl border border-subtle p-4">
        <p className="text-[10px] text-theme-muted flex items-start gap-2">
          <TrendingUp className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          For best results: transcribe in Elite AI first, then use suggested edit points here to create clips. Add B-roll in Assets.
        </p>
      </div>
    </div>
  )
}

export default AIAnalysisView
