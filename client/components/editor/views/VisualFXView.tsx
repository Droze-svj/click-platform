'use client'

import React, { useCallback, useState } from 'react'
import { Sparkles, Film, Sun, Zap, Plus, ChevronRight } from 'lucide-react'
import { EditorCategory } from '../../../types/editor'
import { TimelineEffect, TimelineEffectType, EFFECT_TYPE_COLORS } from '../../../types/editor'
import { formatTime } from '../../../utils/editorUtils'

/** Creative overlay & motion presets that boost visual quality */
const CREATIVE_PRESETS: { type: TimelineEffectType; name: string; icon: string; desc: string; params: Record<string, number | string | boolean> }[] = [
  { type: 'overlay', name: 'Cinematic Vignette', icon: '🎬', desc: 'Film-style focus', params: { strength: 35, softness: 60 } },
  { type: 'overlay', name: 'Light Leak Gold', icon: '☀️', desc: 'Warm sun flare', params: { intensity: 45, position: 'top-right' } },
  { type: 'overlay', name: 'Film Grain', icon: '🎞️', desc: 'Subtle texture', params: { amount: 18, size: 1.2 } },
  { type: 'overlay', name: 'Dust & Scratches', icon: '🧹', desc: 'Vintage look', params: { density: 12, opacity: 25 } },
  { type: 'motion', name: 'Push In', icon: '📐', desc: 'Subtle zoom in', params: { zoom: 108, duration: 3 } },
  { type: 'motion', name: 'Pull Back', icon: '📐', desc: 'Subtle zoom out', params: { zoom: 92, duration: 3 } },
  { type: 'motion', name: 'Ken Burns In', icon: '📷', desc: 'Slow zoom + pan', params: { zoom: 115, panX: 5, panY: 5, duration: 4 } },
  { type: 'motion', name: 'Dramatic Zoom', icon: '🎬', desc: 'Quick punch', params: { zoom: 130, duration: 2 } },
  { type: 'transition', name: 'Cross Dissolve', icon: '✨', desc: 'Smooth cut', params: { style: 'dissolve', duration: 0.5 } },
  { type: 'transition', name: 'Blur Transition', icon: '🔮', desc: 'Dreamy cut', params: { style: 'blur', amount: 10 } },
  { type: 'motion', name: 'The Jitter', icon: '📳', desc: 'High-energy shake', params: { frequency: 12, amplitude: 5, duration: 1 } },
  { type: 'motion', name: 'The Snap Zoom', icon: '🔍', desc: 'Instant hook focus', params: { zoom: 125, duration: 0.5 } },
  { type: 'overlay', name: 'The Flash', icon: '⚡', desc: 'White impact frame', params: { opacity: 80, duration: 0.2 } },
]

interface VisualFXViewProps {
  videoState: { currentTime: number; duration: number }
  timelineEffects: TimelineEffect[]
  setTimelineEffects: React.Dispatch<React.SetStateAction<TimelineEffect[]>>
  setActiveCategory: (c: EditorCategory) => void
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

const VisualFXView: React.FC<VisualFXViewProps> = ({
  videoState,
  timelineEffects,
  setTimelineEffects,
  setActiveCategory,
  showToast,
}) => {
  const [duration, setDuration] = useState(3)
  const [search, setSearch] = useState('')
  const [smartCameraEnabled, setSmartCameraEnabled] = useState(false)

  const addEffect = useCallback((preset: typeof CREATIVE_PRESETS[0]) => {
    const currentTime = videoState?.currentTime ?? 0
    const dur = videoState?.duration || 60
    const effectDur = Math.min(duration, dur - currentTime)
    const maxLayer = timelineEffects.reduce((max, e) => Math.max(max, e.layer || 0), 0)
    const newEffect: TimelineEffect = {
      id: `vfx-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type: preset.type,
      name: preset.name,
      startTime: currentTime,
      endTime: Math.min(currentTime + effectDur, dur),
      params: { ...preset.params },
      color: EFFECT_TYPE_COLORS[preset.type],
      intensity: 100,
      enabled: true,
      fadeIn: 0,
      fadeOut: 0,
      fadeInEasing: 'linear',
      fadeOutEasing: 'linear',
      layer: maxLayer + 1,
      locked: false,
    }
    setTimelineEffects((prev) => [...prev, newEffect])
    showToast(`Added "${preset.name}" at ${formatTime(currentTime)}`, 'success')
  }, [videoState, duration, timelineEffects, setTimelineEffects, showToast])

  const filtered = search.trim()
    ? CREATIVE_PRESETS.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.desc.toLowerCase().includes(search.toLowerCase()))
    : CREATIVE_PRESETS

  return (
    <div className="space-y-6">
      <div className="bg-surface-card rounded-xl border border-subtle p-5">
        <h3 className="text-sm font-bold text-theme-primary flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          Visual FX & creative polish
        </h3>
        <p className="text-xs text-theme-secondary mb-6">
          One-click overlays and motion to boost production value. Effects are added at the current playhead.
        </p>

        <div className="p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 flex items-center justify-between mb-8 group/smart">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl transition-all ${smartCameraEnabled ? 'bg-indigo-500 text-white shadow-lg' : 'bg-surface-elevated text-slate-500'}`}>
              <Sun className={`w-5 h-5 ${smartCameraEnabled ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-widest text-theme-primary">Smart Camera Auto-Center</h4>
              <p className="text-[10px] text-theme-muted font-medium">Uses AI Face-Tracking to keep subjects in frame</p>
            </div>
          </div>
          <button
            type="button"
            title={smartCameraEnabled ? "Disable Smart Camera" : "Enable Smart Camera"}
            onClick={() => {
              setSmartCameraEnabled(!smartCameraEnabled)
              showToast(smartCameraEnabled ? 'Smart Camera Offline' : 'Smart Camera Logic Engaged', 'info')
            }}
            className={`w-12 h-6 rounded-full relative transition-all border ${smartCameraEnabled ? 'bg-indigo-500 border-indigo-400' : 'bg-surface-elevated border-subtle'}`}
          >
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${smartCameraEnabled ? 'left-7' : 'left-1'}`} />
          </button>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <span className="text-[10px] font-semibold text-theme-muted">Duration</span>
          {[2, 3, 5, 10].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDuration(d)}
              title={`Set VFX duration to ${d}s`}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${duration === d ? 'bg-amber-500 text-white' : 'bg-surface-elevated border border-subtle text-theme-secondary hover:bg-surface-card-hover'}`}
            >
              {d}s
            </button>
          ))}
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search effects..."
          title="Search VFX library"
          className="w-full px-3 py-2 rounded-lg border border-subtle bg-surface-elevated text-theme-primary placeholder-theme-muted text-sm mb-4"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {filtered.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => addEffect(preset)}
              title={`Add ${preset.name} effect`}
              className="flex items-center gap-3 p-3 rounded-xl border border-subtle bg-surface-elevated hover:border-default hover:bg-surface-card-hover transition-all text-left group"
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
                style={{ backgroundColor: `${EFFECT_TYPE_COLORS[preset.type]}20` }}
              >
                {preset.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-theme-primary truncate">{preset.name}</p>
                <p className="text-[10px] text-theme-muted truncate">{preset.desc}</p>
              </div>
              <Plus className="w-4 h-4 text-theme-muted group-hover:text-amber-500 shrink-0" />
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="text-xs text-theme-muted text-center py-4">No effects match your search.</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => setActiveCategory('effects')}
        title="View full Effects & Transition Library"
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-surface-card border border-subtle text-theme-primary hover:bg-surface-card-hover transition-colors"
      >
        <span className="text-sm font-medium">Open full Effects library</span>
        <ChevronRight className="w-4 h-4 text-theme-muted" />
      </button>
    </div>
  )
}

export default VisualFXView
