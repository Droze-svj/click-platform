'use client'

import React, { useState } from 'react'
import {
  Film,
  Smartphone,
  Youtube,
  Instagram,
  LayoutGrid,
  Scissors,
  Clock,
  Sparkles,
  Zap,
  Target,
  ArrowUpRight,
  type LucideIcon,
} from 'lucide-react'
import { TemplateLayout, getDefaultTrackForSegmentType } from '../../../types/editor'
import { Panel, Button, Badge, SectionHeader } from '../../ui'
import { cn } from '../../../lib/utils'

const PLATFORM_PRESETS: { id: string; label: string; layout: TemplateLayout; icon: LucideIcon; color: string; exportPreset: string }[] = [
  { id: 'tiktok', label: 'TikTok', layout: 'vertical', icon: Smartphone, color: 'from-pink-500 to-rose-600', exportPreset: 'tiktok' },
  { id: 'reels', label: 'Reels', layout: 'vertical', icon: Instagram, color: 'from-purple-500 via-pink-500 to-orange-500', exportPreset: 'reels' },
  { id: 'shorts', label: 'Shorts', layout: 'vertical', icon: Youtube, color: 'from-red-600 to-red-700', exportPreset: 'shorts' },
  { id: 'feed', label: 'Feed', layout: 'square', icon: LayoutGrid, color: 'from-blue-600 to-indigo-600', exportPreset: 'reels' },
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
  transcript: any
}

const ShortClipsView: React.FC<ShortClipsViewProps> = ({
  videoState,
  templateLayout,
  setTemplateLayout,
  timelineSegments,
  setTimelineSegments,
  setActiveCategory,
  showToast,
  transcript,
}) => {
  const { currentTime, duration } = videoState
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)

  const suggestedHooks = React.useMemo(() => {
    if (!transcript?.words?.length) return []
    const words = transcript.words
    const hooks: any[] = []

    // Semantic peak detection — scan transcript for high-intent marker words.
    const markers = ['why', 'how', 'secret', 'never', 'don\'t', 'stop', 'finally', 'massive', 'incredible']

    for (let i = 0; i < words.length; i++) {
      const w = words[i]
      if (markers.includes(w.text.toLowerCase().replace(/[^a-z]/g, '')) && w.start > 5) {
        hooks.push({
          id: `hook-peak-${i}`,
          startTime: Math.max(0, w.start - 2),
          endTime: Math.min(duration, w.start + 15),
          text: `Peak: "${w.text}..."`,
        })
        i += 100 // Skip ahead to find the next distinct peak
      }
      if (hooks.length >= 4) break
    }
    return hooks
  }, [transcript, duration])

  const handlePlatformSelect = (preset: typeof PLATFORM_PRESETS[0]) => {
    setTemplateLayout(preset.layout)
    setSelectedPlatform(preset.id)
    showToast(`${preset.label} layout active`, 'success')
  }

  const handleApplyHook = (hook: any) => {
    const id = `neural-hook-${Date.now()}`
    setTimelineSegments((prev: any[]) => [...prev, {
      id,
      startTime: hook.startTime,
      endTime: hook.endTime,
      duration: hook.endTime - hook.startTime,
      type: 'video',
      name: `Hook: ${hook.text.slice(0, 20)}`,
      color: '#ec4899',
      track: getDefaultTrackForSegmentType('video')
    }])
    setTemplateLayout('vertical')
    showToast(`Hook added to timeline: ${hook.text}`, 'success')
    setActiveCategory('timeline')
  }

  const handleCreateClipFromPlayhead = (seconds: number) => {
    const start = currentTime
    const end = Math.min(currentTime + seconds, duration)
    if (end - start < 1) {
      showToast('Selected range is too short', 'error')
      return
    }
    const id = `short-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    setTimelineSegments((prev: any[]) => [...prev, {
      id,
      startTime: start,
      endTime: end,
      duration: end - start,
      type: 'video',
      name: `${seconds}s Clip`,
      color: '#fb7185',
      track: getDefaultTrackForSegmentType('video')
    }])
    setTemplateLayout('vertical')
    showToast(`${seconds}s clip added to timeline`, 'success')
    setActiveCategory('timeline')
  }

  const goToExportWithPreset = (presetId: string) => {
    try { sessionStorage.setItem('export-preferred-preset', presetId) } catch { /* ignore */ }
    setActiveCategory('export')
    showToast('Switching to Export', 'info')
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 py-4 ds-anim-rise">
      {/* Header */}
      <Badge variant="outline" className="gap-2 border-rose-500/30 text-rose-500">
        <Film className="h-3.5 w-3.5" aria-hidden />
        Short Clips
      </Badge>
      <SectionHeader
        as="h1"
        title="Clips Studio"
        description="Repurpose your video into vertical clips for Reels, Shorts and TikTok with calibrated framing."
      />

      {/* Hook Intelligence — derived from real transcript */}
      {suggestedHooks.length > 0 && (
        <Panel variant="glass" className="space-y-5 p-6">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-rose-500" aria-hidden />
            <span className="ds-text-label text-theme-primary">Hook Intelligence</span>
            <span className="ds-text-caption text-theme-muted">— semantic peaks in your transcript</span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {suggestedHooks.map((hook) => (
              <div
                key={hook.id}
                className="flex flex-col gap-4 rounded-xl border border-subtle ds-surface-subtle p-5 transition-colors hover:border-border"
              >
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="gap-1 border-rose-500/30 text-rose-500">
                    Hook
                  </Badge>
                  <span className="ds-text-caption tabular-nums text-theme-muted">@{hook.startTime.toFixed(1)}s</span>
                </div>
                <p className="text-base font-semibold leading-snug text-theme-primary">{hook.text}</p>
                <div className="mt-auto flex items-center justify-between border-t border-subtle pt-3">
                  <span className="ds-text-caption text-theme-muted">{(hook.endTime - hook.startTime).toFixed(0)}s segment</span>
                  <Button size="sm" onClick={() => handleApplyHook(hook)} leftIcon={<Scissors className="h-3.5 w-3.5" aria-hidden />}>
                    Add to timeline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Format Matrix */}
      <Panel variant="glass" className="space-y-5 p-6">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-indigo-500" aria-hidden />
          <span className="ds-text-label text-theme-primary">Format</span>
          <span className="ds-text-caption text-theme-muted">— one-click layout calibration</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLATFORM_PRESETS.map((preset) => {
            const Icon = preset.icon
            const isSelected = templateLayout === preset.layout && selectedPlatform === preset.id
            return (
              <div
                key={preset.id}
                className={cn(
                  'flex flex-col items-center gap-4 rounded-xl border p-5 transition-colors',
                  isSelected ? 'border-rose-500 ds-surface-subtle' : 'border-subtle ds-surface-subtle hover:border-border'
                )}
              >
                <button
                  type="button"
                  onClick={() => handlePlatformSelect(preset)}
                  title={`Calibrate for ${preset.label}`}
                  className="w-full space-y-3 text-center"
                >
                  <div className={cn('mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br', preset.color)}>
                    <Icon className="h-8 w-8 text-white" aria-hidden />
                  </div>
                  <div className="space-y-0.5">
                    <div className="ds-text-label text-theme-primary">{preset.label}</div>
                    <div className="ds-text-caption text-theme-muted">
                      {preset.layout === 'vertical' ? '9:16' : '1:1'}
                    </div>
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => goToExportWithPreset(preset.exportPreset)}
                  title={`Export as ${preset.label}`}
                  className="w-full text-rose-500"
                  rightIcon={<ArrowUpRight className="h-3.5 w-3.5" aria-hidden />}
                >
                  Export
                </Button>
              </div>
            )
          })}
        </div>
      </Panel>

      {/* Clip from playhead */}
      <Panel variant="glass" className="space-y-5 p-6">
        <div className="flex items-center gap-2">
          <Scissors className="h-4 w-4 text-rose-500" aria-hidden />
          <span className="ds-text-label text-theme-primary">Clip from playhead</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-subtle ds-surface-subtle p-4">
          <div className="flex items-center gap-3">
            <Target className="h-5 w-5 text-theme-muted" aria-hidden />
            <p className="text-sm text-theme-secondary">
              Playhead at <span className="font-semibold tabular-nums text-theme-primary">@{currentTime.toFixed(1)}s</span>
            </p>
          </div>
          <Badge variant="outline" className="border-rose-500/30 text-rose-500">Auto 9:16</Badge>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {CLIP_DURATIONS.map((sec) => {
            const end = Math.min(currentTime + sec, duration)
            const valid = end - currentTime >= 1
            return (
              <button
                key={sec}
                type="button"
                onClick={() => handleCreateClipFromPlayhead(sec)}
                disabled={!valid}
                title={valid ? `Create ${sec}s clip from playhead` : 'Timeline end reached'}
                className="flex items-center justify-center gap-3 rounded-xl border border-subtle ds-surface-subtle py-6 transition-colors hover:border-rose-500/50 disabled:opacity-40"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/10">
                  <Clock className="h-5 w-5 text-rose-500" aria-hidden />
                </div>
                <div className="text-left">
                  <span className="ds-text-h3 tabular-nums text-theme-primary">{sec}s</span>
                  <span className="block ds-text-caption text-theme-muted">clip</span>
                </div>
              </button>
            )
          })}
        </div>
      </Panel>

      {/* Advisory */}
      <Panel variant="subtle" className="flex items-start gap-4 p-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10">
          <Sparkles className="h-5 w-5 text-indigo-500" aria-hidden />
        </div>
        <div className="space-y-1">
          <p className="ds-text-label text-theme-primary">Tip</p>
          <p className="text-sm leading-relaxed text-theme-secondary">
            Open the{' '}
            <button type="button" onClick={() => setActiveCategory('ai-edit')} className="font-semibold text-indigo-500 underline-offset-4 hover:underline">
              AI Hub
            </button>{' '}
            to find viral moments, then refine cuts, captions and B-roll. Test hook variations before exporting.
          </p>
        </div>
      </Panel>
    </div>
  )
}

export default ShortClipsView
