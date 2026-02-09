'use client'

import React, { useState } from 'react'
import {
  Film,
  Smartphone,
  Youtube,
  Instagram,
  LayoutGrid,
  Scissors,
  Download,
  Clock,
  Sparkles,
  ChevronRight,
  Zap
} from 'lucide-react'
import { TemplateLayout, getDefaultTrackForSegmentType } from '../../../types/editor'

const PLATFORM_PRESETS: { id: string; label: string; layout: TemplateLayout; icon: any; color: string; exportPreset: string }[] = [
  { id: 'tiktok', label: 'TikTok', layout: 'vertical', icon: Smartphone, color: 'from-slate-800 to-slate-900 dark:from-white dark:to-slate-200', exportPreset: 'tiktok' },
  { id: 'reels', label: 'Reels', layout: 'vertical', icon: Instagram, color: 'from-pink-500 to-purple-600', exportPreset: 'reels' },
  { id: 'shorts', label: 'Shorts', layout: 'vertical', icon: Youtube, color: 'from-red-600 to-red-700', exportPreset: 'shorts' },
  { id: 'feed', label: 'Feed', layout: 'square', icon: LayoutGrid, color: 'from-amber-500 to-orange-500', exportPreset: 'reels' },
]

const CLIP_DURATIONS = [15, 30, 60] as const

interface ShortClipsViewProps {
  videoState: { currentTime: number; duration: number }
  templateLayout: TemplateLayout
  setTemplateLayout: (l: TemplateLayout) => void
  timelineSegments: any[]
  setTimelineSegments: (v: any[] | ((prev: any[]) => any[])) => void
  setActiveCategory: (c: any) => void
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

const ShortClipsView: React.FC<ShortClipsViewProps> = ({
  videoState,
  templateLayout,
  setTemplateLayout,
  timelineSegments,
  setTimelineSegments,
  setActiveCategory,
  showToast
}) => {
  const { currentTime, duration } = videoState
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)

  const handlePlatformSelect = (preset: typeof PLATFORM_PRESETS[0]) => {
    setTemplateLayout(preset.layout)
    setSelectedPlatform(preset.id)
    showToast(`${preset.label} format (${preset.layout === 'vertical' ? '9:16' : '1:1'}) applied`, 'success')
  }

  const handleCreateClipFromPlayhead = (seconds: number) => {
    const start = currentTime
    const end = Math.min(currentTime + seconds, duration)
    if (end - start < 1) {
      showToast('Clip would be too short. Move playhead or pick a shorter duration.', 'error')
      return
    }
    const id = `short-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    setTimelineSegments((prev: any[]) => [...prev, {
      id,
      startTime: start,
      endTime: end,
      duration: end - start,
      type: 'video',
      name: `${seconds}s short`,
      color: '#ec4899',
      track: getDefaultTrackForSegmentType('video')
    }])
    setTemplateLayout('vertical')
    showToast(`${seconds}s clip added from playhead. Trim in Timeline.`, 'success')
    setActiveCategory('timeline')
  }

  const goToExportWithPreset = (presetId: string) => {
    try {
      sessionStorage.setItem('export-preferred-preset', presetId)
    } catch { /* ignore */ }
    setActiveCategory('export')
    showToast('Export panel opened with platform preset', 'info')
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-br from-rose-500/10 via-pink-500/10 to-fuchsia-500/10 dark:from-rose-900/20 dark:via-pink-900/20 dark:to-fuchsia-900/20 rounded-2xl border border-rose-200/50 dark:border-rose-800/50 p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-rose-500/20 rounded-xl">
            <Film className="w-6 h-6 text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Short Clips</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Repurpose for Reels, Shorts & TikTok — better than Opus</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
          One-click formats, clip from playhead, and export presets. Use <strong>Elite AI</strong> for transcripts and suggested moments—then choose segments by <strong>strategy</strong>, not only viral score.
        </p>
        <p className="text-xs text-sky-600 dark:text-sky-400">AI = assistant: refine cuts, framing, captions, and B-roll. Test hook variants and different first 3s; keep what performs.</p>
      </div>

      {/* One-click formats */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <Zap className="w-4 h-4 text-rose-500" />
          <h4 className="font-semibold text-gray-900 dark:text-white">One-click format</h4>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          {PLATFORM_PRESETS.map((preset) => {
            const Icon = preset.icon
            const isSelected = templateLayout === preset.layout && selectedPlatform === preset.id
            return (
              <div
                key={preset.id}
                className={`rounded-xl border-2 p-4 transition-all cursor-pointer ${isSelected
                  ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-rose-300 dark:hover:border-rose-700'
                  }`}
              >
                <button
                  type="button"
                  onClick={() => handlePlatformSelect(preset)}
                  className="w-full text-left"
                >
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${preset.color} flex items-center justify-center mb-2`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="font-semibold text-gray-900 dark:text-white text-sm">{preset.label}</div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">
                    {preset.layout === 'vertical' ? '9:16' : '1:1'}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => goToExportWithPreset(preset.exportPreset)}
                  className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                >
                  Export <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Create short from playhead */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <Scissors className="w-4 h-4 text-rose-500" />
          <h4 className="font-semibold text-gray-900 dark:text-white">Create short from playhead</h4>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Playhead at <strong>{currentTime.toFixed(1)}s</strong>. Adds a segment and switches to 9:16. Trim in Timeline.
          </p>
          <div className="flex flex-wrap gap-2">
            {CLIP_DURATIONS.map((sec) => {
              const end = Math.min(currentTime + sec, duration)
              const valid = end - currentTime >= 1
              return (
                <button
                  key={sec}
                  type="button"
                  onClick={() => handleCreateClipFromPlayhead(sec)}
                  disabled={!valid}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-gray-900 dark:text-white font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Clock className="w-4 h-4 text-rose-500" />
                  {sec}s
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Pro tips */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20">
        <Sparkles className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-sm text-gray-700 dark:text-gray-300">
          <p className="font-medium text-amber-800 dark:text-amber-200 mb-1">Pro tip</p>
          <p className="text-xs">
            Use <button type="button" onClick={() => setActiveCategory('ai-edit')} className="font-semibold text-amber-600 dark:text-amber-400 hover:underline">Elite AI</button> to transcribe and find moments—choose segments by strategy, not only score. Refine cuts, captions, and B-roll in the timeline. Test multiple hook/caption variants and keep what performs. <button type="button" onClick={() => setActiveCategory('export')} className="font-semibold text-amber-600 dark:text-amber-400 hover:underline">Export</button> for platform presets.
          </p>
        </div>
      </div>
    </div>
  )
}

export default ShortClipsView
