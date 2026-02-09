
import React, { useState, useCallback, useMemo } from 'react'
import { Zap, Sparkles, Filter, Type, Music, Plus, Trash2, Clock, ChevronDown, ChevronRight, ToggleLeft, ToggleRight, Copy, Settings2, Search, Layers, Lock, Unlock, MoveUp, MoveDown, Clipboard, ClipboardPaste, Save, FolderOpen, X, GripVertical, Link, Unlink, SlidersHorizontal, BookmarkPlus } from 'lucide-react'
import { EditorCategory, TimelineEffect, TimelineEffectType, EFFECT_PRESETS, EFFECT_TYPE_COLORS, EffectEasing, EFFECT_EASINGS, EffectTemplate } from '../../../types/editor'
import { formatTime } from '../../../utils/editorUtils'

interface EffectsViewProps {
  videoState: any
  setVideoFilters: (v: any) => void
  setTextOverlays: (v: any) => void
  setActiveCategory: (v: EditorCategory) => void
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
  // Timeline effects management
  timelineEffects?: TimelineEffect[]
  setTimelineEffects?: React.Dispatch<React.SetStateAction<TimelineEffect[]>>
  selectedEffectId?: string | null
  setSelectedEffectId?: (id: string | null) => void
}

const EFFECT_CATEGORIES: { type: TimelineEffectType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: 'filter', label: 'Filters', icon: Filter },
  { type: 'transition', label: 'Transitions', icon: Zap },
  { type: 'motion', label: 'Motion', icon: Sparkles },
  { type: 'overlay', label: 'Overlays', icon: Settings2 },
  { type: 'speed', label: 'Speed', icon: Clock },
  { type: 'audio', label: 'Audio FX', icon: Music },
]

const QUICK_DURATIONS = [
  { label: '0.5s', value: 0.5 },
  { label: '1s', value: 1 },
  { label: '2s', value: 2 },
  { label: '3s', value: 3 },
  { label: '5s', value: 5 },
  { label: '10s', value: 10 },
]

const EffectsView: React.FC<EffectsViewProps> = ({
  videoState, setVideoFilters, setTextOverlays, setActiveCategory, showToast,
  timelineEffects = [], setTimelineEffects, selectedEffectId, setSelectedEffectId
}) => {
  const [expandedCategory, setExpandedCategory] = useState<TimelineEffectType | null>('filter')
  const [customDuration, setCustomDuration] = useState(3)
  const [searchQuery, setSearchQuery] = useState('')
  const [multiSelectIds, setMultiSelectIds] = useState<Set<string>>(new Set())
  const [clipboardEffects, setClipboardEffects] = useState<TimelineEffect[]>([])
  const [savedTemplates, setSavedTemplates] = useState<EffectTemplate[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('effectTemplates')
      return saved ? JSON.parse(saved) : []
    }
    return []
  })
  const [showTemplates, setShowTemplates] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [draggedPreset, setDraggedPreset] = useState<typeof EFFECT_PRESETS[number] | null>(null)
  const [showAdvancedPanel, setShowAdvancedPanel] = useState(false)

  // Filter effects by search
  const filteredPresets = useMemo(() => {
    if (!searchQuery.trim()) return EFFECT_PRESETS
    const q = searchQuery.toLowerCase()
    return EFFECT_PRESETS.filter((p) =>
      p.name.toLowerCase().includes(q) || p.type.toLowerCase().includes(q)
    )
  }, [searchQuery])

  // Group effects by category for filtered view
  const filteredByCategory = useMemo(() => {
    const result: Record<TimelineEffectType, typeof EFFECT_PRESETS> = {
      filter: [], transition: [], motion: [], overlay: [], speed: [], audio: []
    }
    filteredPresets.forEach((p) => result[p.type].push(p))
    return result
  }, [filteredPresets])

  const addEffectToTimeline = useCallback((preset: typeof EFFECT_PRESETS[number], atTime?: number) => {
    if (!setTimelineEffects) return
    const currentTime = atTime ?? videoState?.currentTime ?? 0
    const duration = videoState?.duration || 60
    const effectDuration = Math.min(customDuration, duration - currentTime)
    const maxLayer = timelineEffects.reduce((max, e) => Math.max(max, e.layer || 0), 0)

    const newEffect: TimelineEffect = {
      id: `effect-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type: preset.type,
      name: preset.name,
      startTime: currentTime,
      endTime: Math.min(currentTime + effectDuration, duration),
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
  }, [setTimelineEffects, videoState, customDuration, timelineEffects, showToast])

  const deleteEffect = useCallback((id: string) => {
    if (!setTimelineEffects) return
    setTimelineEffects((prev) => prev.filter((e) => e.id !== id))
    if (selectedEffectId === id) setSelectedEffectId?.(null)
    showToast('Effect removed', 'info')
  }, [setTimelineEffects, selectedEffectId, setSelectedEffectId, showToast])

  const duplicateEffect = useCallback((id: string) => {
    if (!setTimelineEffects) return
    setTimelineEffects((prev) => {
      const effect = prev.find((e) => e.id === id)
      if (!effect) return prev
      const duration = videoState?.duration || 60
      const newEffect: TimelineEffect = {
        ...effect,
        id: `effect-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        startTime: Math.min(effect.endTime, duration - 1),
        endTime: Math.min(effect.endTime + (effect.endTime - effect.startTime), duration),
      }
      return [...prev, newEffect]
    })
    showToast('Effect duplicated', 'success')
  }, [setTimelineEffects, videoState, showToast])

  const toggleEffect = useCallback((id: string) => {
    if (!setTimelineEffects) return
    setTimelineEffects((prev) => prev.map((e) => e.id === id ? { ...e, enabled: !e.enabled } : e))
  }, [setTimelineEffects])

  const updateEffectIntensity = useCallback((id: string, intensity: number) => {
    if (!setTimelineEffects) return
    setTimelineEffects((prev) => prev.map((e) => e.id === id ? { ...e, intensity } : e))
  }, [setTimelineEffects])

  const updateEffectTiming = useCallback((id: string, field: 'startTime' | 'endTime', value: number) => {
    if (!setTimelineEffects) return
    const duration = videoState?.duration || 60
    setTimelineEffects((prev) => prev.map((e) => {
      if (e.id !== id) return e
      if (field === 'startTime') {
        return { ...e, startTime: Math.max(0, Math.min(value, e.endTime - 0.1)) }
      }
      return { ...e, endTime: Math.max(e.startTime + 0.1, Math.min(value, duration)) }
    }))
  }, [setTimelineEffects, videoState])

  // Multi-select toggle
  const toggleMultiSelect = useCallback((id: string, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      setMultiSelectIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    } else if (e.shiftKey && selectedEffectId) {
      // Range select
      const sortedEffects = [...timelineEffects].sort((a, b) => a.startTime - b.startTime)
      const startIdx = sortedEffects.findIndex((e) => e.id === selectedEffectId)
      const endIdx = sortedEffects.findIndex((e) => e.id === id)
      const [min, max] = [Math.min(startIdx, endIdx), Math.max(startIdx, endIdx)]
      const ids = sortedEffects.slice(min, max + 1).map((e) => e.id)
      setMultiSelectIds(new Set(ids))
    } else {
      setMultiSelectIds(new Set())
      setSelectedEffectId?.(id)
    }
  }, [selectedEffectId, timelineEffects, setSelectedEffectId])

  // Select all effects
  const selectAll = useCallback(() => {
    setMultiSelectIds(new Set(timelineEffects.map((e) => e.id)))
  }, [timelineEffects])

  // Clear selection
  const clearSelection = useCallback(() => {
    setMultiSelectIds(new Set())
    setSelectedEffectId?.(null)
  }, [setSelectedEffectId])

  // Copy selected effects
  const copySelected = useCallback(() => {
    const ids = multiSelectIds.size > 0 ? multiSelectIds : (selectedEffectId ? new Set([selectedEffectId]) : new Set())
    const toCopy = timelineEffects.filter((e) => ids.has(e.id))
    if (toCopy.length === 0) return
    setClipboardEffects(toCopy)
    showToast(`Copied ${toCopy.length} effect(s)`, 'success')
  }, [multiSelectIds, selectedEffectId, timelineEffects, showToast])

  // Paste effects at current time
  const pasteEffects = useCallback(() => {
    if (!setTimelineEffects || clipboardEffects.length === 0) return
    const currentTime = videoState?.currentTime || 0
    const duration = videoState?.duration || 60
    // Calculate offset from earliest copied effect
    const minStart = Math.min(...clipboardEffects.map((e) => e.startTime))
    const maxLayer = timelineEffects.reduce((max, e) => Math.max(max, e.layer || 0), 0)

    const pasted = clipboardEffects.map((e, i) => ({
      ...e,
      id: `effect-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      startTime: Math.min(currentTime + (e.startTime - minStart), duration - 0.1),
      endTime: Math.min(currentTime + (e.endTime - minStart), duration),
      layer: maxLayer + i + 1,
    }))

    setTimelineEffects((prev) => [...prev, ...pasted])
    showToast(`Pasted ${pasted.length} effect(s)`, 'success')
  }, [setTimelineEffects, clipboardEffects, videoState, timelineEffects, showToast])

  // Delete selected (multi or single)
  const deleteSelected = useCallback(() => {
    if (!setTimelineEffects) return
    const ids = multiSelectIds.size > 0 ? multiSelectIds : (selectedEffectId ? new Set([selectedEffectId]) : new Set())
    if (ids.size === 0) return
    setTimelineEffects((prev) => prev.filter((e) => !ids.has(e.id) && !e.locked))
    setMultiSelectIds(new Set())
    setSelectedEffectId?.(null)
    showToast(`Deleted ${ids.size} effect(s)`, 'info')
  }, [setTimelineEffects, multiSelectIds, selectedEffectId, setSelectedEffectId, showToast])

  // Lock/unlock effect
  const toggleLock = useCallback((id: string) => {
    if (!setTimelineEffects) return
    setTimelineEffects((prev) => prev.map((e) => e.id === id ? { ...e, locked: !e.locked } : e))
  }, [setTimelineEffects])

  // Move layer up/down
  const moveLayer = useCallback((id: string, direction: 'up' | 'down') => {
    if (!setTimelineEffects) return
    setTimelineEffects((prev) => {
      const effect = prev.find((e) => e.id === id)
      if (!effect) return prev
      const currentLayer = effect.layer || 0
      const newLayer = direction === 'up' ? currentLayer + 1 : Math.max(0, currentLayer - 1)
      return prev.map((e) => e.id === id ? { ...e, layer: newLayer } : e)
    })
  }, [setTimelineEffects])

  // Update fade settings
  const updateFade = useCallback((id: string, field: 'fadeIn' | 'fadeOut' | 'fadeInEasing' | 'fadeOutEasing', value: number | EffectEasing) => {
    if (!setTimelineEffects) return
    setTimelineEffects((prev) => prev.map((e) => e.id === id ? { ...e, [field]: value } : e))
  }, [setTimelineEffects])

  // Save template
  const saveAsTemplate = useCallback(() => {
    if (!newTemplateName.trim()) {
      showToast('Please enter a template name', 'error')
      return
    }
    const ids = multiSelectIds.size > 0 ? multiSelectIds : (selectedEffectId ? new Set([selectedEffectId]) : new Set())
    const toSave = timelineEffects.filter((e) => ids.has(e.id))
    if (toSave.length === 0) {
      showToast('Select effects to save as template', 'error')
      return
    }

    const template: EffectTemplate = {
      id: `template-${Date.now()}`,
      name: newTemplateName.trim(),
      description: `${toSave.length} effect(s)`,
      effects: toSave.map(({ id, startTime, endTime, ...rest }) => rest),
      createdAt: Date.now(),
    }

    const updated = [...savedTemplates, template]
    setSavedTemplates(updated)
    localStorage.setItem('effectTemplates', JSON.stringify(updated))
    setNewTemplateName('')
    showToast(`Saved template "${template.name}"`, 'success')
  }, [newTemplateName, multiSelectIds, selectedEffectId, timelineEffects, savedTemplates, showToast])

  // Apply template
  const applyTemplate = useCallback((template: EffectTemplate) => {
    if (!setTimelineEffects) return
    const currentTime = videoState?.currentTime || 0
    const duration = videoState?.duration || 60
    const maxLayer = timelineEffects.reduce((max, e) => Math.max(max, e.layer || 0), 0)

    const newEffects = template.effects.map((e, i) => ({
      ...e,
      id: `effect-${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${i}`,
      startTime: currentTime,
      endTime: Math.min(currentTime + customDuration, duration),
      layer: maxLayer + i + 1,
    })) as TimelineEffect[]

    setTimelineEffects((prev) => [...prev, ...newEffects])
    showToast(`Applied template "${template.name}"`, 'success')
    setShowTemplates(false)
  }, [setTimelineEffects, videoState, customDuration, timelineEffects, showToast])

  // Delete template
  const deleteTemplate = useCallback((id: string) => {
    const updated = savedTemplates.filter((t) => t.id !== id)
    setSavedTemplates(updated)
    localStorage.setItem('effectTemplates', JSON.stringify(updated))
    showToast('Template deleted', 'info')
  }, [savedTemplates, showToast])

  // Apply to full video
  const applyToFullVideo = useCallback((id: string) => {
    if (!setTimelineEffects) return
    const duration = videoState?.duration || 60
    setTimelineEffects((prev) => prev.map((e) => e.id === id ? { ...e, startTime: 0, endTime: duration } : e))
    showToast('Applied to full video', 'success')
  }, [setTimelineEffects, videoState, showToast])

  // Match to segment (placeholder - would need segment data)
  const extendToEnd = useCallback((id: string) => {
    if (!setTimelineEffects) return
    const duration = videoState?.duration || 60
    setTimelineEffects((prev) => prev.map((e) => e.id === id ? { ...e, endTime: duration } : e))
  }, [setTimelineEffects, videoState])

  const selectedEffect = timelineEffects.find((e) => e.id === selectedEffectId)
  const effectsSelected = multiSelectIds.size > 0 ? multiSelectIds.size : (selectedEffectId ? 1 : 0)

  return (
    <div className="space-y-6">
      <p className="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/80 rounded-xl px-3 py-2 border border-gray-200 dark:border-gray-700">
        <strong>Visual polish:</strong> Prefer simple, clean transitions (fade, cut) that serve the message. Use motion (zooms, push-ins) to emphasize key words or reactions—not constant movement.
      </p>
      {/* Quick navigation cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[
          { id: 'color', label: 'Color Correction', icon: Filter, color: 'text-purple-500', desc: 'Surgical grading control' },
          { id: 'edit', label: 'Typography', icon: Type, color: 'text-blue-500', desc: 'Cinematic title engine' },
          { id: 'automate', label: 'Sonic Energy', icon: Music, color: 'text-orange-500', desc: 'AI music & voiceover' }
        ].map(e => (
          <button
            key={e.id}
            onClick={() => { setActiveCategory(e.id as EditorCategory); showToast(`Opening ${e.label}`, 'info') }}
            className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xl hover:scale-[1.02] transition-all text-left group"
          >
            <div className={`p-3 rounded-xl bg-gray-50 dark:bg-gray-900 mb-4 inline-block ${e.color} group-hover:scale-110 transition-transform`}><e.icon className="w-5 h-5" /></div>
            <h4 className="font-black text-xs uppercase tracking-widest text-gray-900 dark:text-white mb-1">{e.label}</h4>
            <p className="text-[10px] text-gray-400 font-medium">{e.desc}</p>
          </button>
        ))}
      </div>

      {/* Selection toolbar - shows when effects are selected */}
      {effectsSelected > 0 && (
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 text-white">
            <span className="text-sm font-bold">{effectsSelected} effect{effectsSelected > 1 ? 's' : ''} selected</span>
            <span className="text-xs opacity-70">Ctrl/Cmd+Click for multi-select · Shift+Click for range</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={selectAll} className="px-3 py-1.5 text-xs font-bold bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors">
              Select All
            </button>
            <button type="button" onClick={copySelected} className="p-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors" title="Copy (Ctrl+C)">
              <Clipboard className="w-4 h-4" />
            </button>
            {clipboardEffects.length > 0 && (
              <button type="button" onClick={pasteEffects} className="p-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors" title="Paste (Ctrl+V)">
                <ClipboardPaste className="w-4 h-4" />
              </button>
            )}
            <button type="button" onClick={deleteSelected} className="p-2 bg-red-500/80 text-white rounded-lg hover:bg-red-500 transition-colors" title="Delete">
              <Trash2 className="w-4 h-4" />
            </button>
            <button type="button" onClick={clearSelection} className="p-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors" title="Clear selection">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Effect duration + Templates bar */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-purple-500" />
            <span className="text-xs font-black uppercase tracking-widest text-gray-500">Duration</span>
            <div className="flex items-center gap-1">
              {QUICK_DURATIONS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setCustomDuration(d.value)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${customDuration === d.value
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Save as template */}
            {effectsSelected > 0 && (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="Template name..."
                  className="w-28 px-2 py-1 text-[10px] rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={saveAsTemplate}
                  className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                  title="Save selected as template"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Templates button */}
            <button
              type="button"
              onClick={() => setShowTemplates(!showTemplates)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${showTemplates
                ? 'bg-amber-500 text-white'
                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 hover:bg-amber-200'
                }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Templates ({savedTemplates.length})
            </button>
          </div>
        </div>

        <p className="text-[10px] text-gray-400">
          Adding at {formatTime(videoState?.currentTime || 0)} · {customDuration}s duration
          {clipboardEffects.length > 0 && ` · ${clipboardEffects.length} in clipboard`}
        </p>

        {/* Templates dropdown */}
        {showTemplates && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            {savedTemplates.length === 0 ? (
              <p className="text-[11px] text-gray-400 text-center py-4">No saved templates. Select effects and save them as a template.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {savedTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 group hover:border-amber-400 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-gray-900 dark:text-white truncate">{template.name}</span>
                      <button
                        type="button"
                        onClick={() => deleteTemplate(template.id)}
                        className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-[9px] text-gray-400 mb-2">{template.description}</p>
                    <button
                      type="button"
                      onClick={() => applyTemplate(template)}
                      className="w-full px-2 py-1 text-[9px] font-bold bg-amber-500 text-white rounded hover:bg-amber-600 transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Effects library - by category */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-purple-500" />
            <span className="text-xs font-black uppercase tracking-widest text-gray-500">Effects Library</span>
            <span className="text-[10px] text-gray-400 ml-auto">Click to add · Drag to timeline</span>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search effects..."
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {searchQuery && (
            <p className="text-[10px] text-gray-400 mt-2">Found {filteredPresets.length} effect{filteredPresets.length !== 1 ? 's' : ''}</p>
          )}
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-80 overflow-y-auto custom-scrollbar">
          {EFFECT_CATEGORIES.map((cat) => {
            const presets = filteredByCategory[cat.type]
            if (searchQuery && presets.length === 0) return null
            const isExpanded = expandedCategory === cat.type || !!searchQuery
            const Icon = cat.icon
            return (
              <div key={cat.type}>
                <button
                  type="button"
                  onClick={() => !searchQuery && setExpandedCategory(isExpanded ? null : cat.type)}
                  className={`w-full px-4 py-3 flex items-center justify-between transition-colors ${!searchQuery ? 'hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer' : 'cursor-default'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: `${EFFECT_TYPE_COLORS[cat.type]}20` }}>
                      <span style={{ color: EFFECT_TYPE_COLORS[cat.type] }}><Icon className="w-4 h-4" /></span>
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{cat.label}</span>
                    <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{presets.length}</span>
                  </div>
                  {!searchQuery && (isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />)}
                </button>

                {isExpanded && presets.length > 0 && (
                  <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {presets.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        draggable
                        onDragStart={() => setDraggedPreset(preset)}
                        onDragEnd={() => setDraggedPreset(null)}
                        onClick={() => addEffectToTimeline(preset)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all text-left group cursor-grab active:cursor-grabbing"
                      >
                        <GripVertical className="w-3 h-3 text-gray-300 group-hover:text-gray-400 shrink-0" />
                        <span className="text-lg shrink-0">{preset.icon}</span>
                        <div className="flex-1 min-w-0">
                          <span className="text-[11px] font-bold text-gray-900 dark:text-white block truncate">{preset.name}</span>
                          <span className="text-[9px] text-gray-400 uppercase">{preset.type}</span>
                        </div>
                        <Plus className="w-3 h-3 text-gray-400 group-hover:text-purple-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Active timeline effects */}
      {timelineEffects.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-black uppercase tracking-widest text-gray-500">Active Effects</span>
              <span className="text-[10px] bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full font-bold">{timelineEffects.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400">Ctrl+Click multi · Shift+Click range</span>
              <button
                type="button"
                onClick={() => setShowAdvancedPanel(!showAdvancedPanel)}
                className={`p-1.5 rounded-lg transition-colors ${showAdvancedPanel ? 'bg-purple-500 text-white' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                title="Toggle advanced controls"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-96 overflow-y-auto custom-scrollbar">
            {[...timelineEffects].sort((a, b) => (b.layer || 0) - (a.layer || 0)).map((effect) => {
              const isSelected = selectedEffectId === effect.id
              const isMultiSelected = multiSelectIds.has(effect.id)
              return (
                <div
                  key={effect.id}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => toggleMultiSelect(effect.id, e)}
                  className={`p-3 transition-colors cursor-pointer ${isSelected || isMultiSelected ? 'bg-purple-50 dark:bg-purple-900/20 ring-1 ring-purple-500' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'} ${!effect.enabled ? 'opacity-50' : ''} ${effect.locked ? 'border-l-2 border-amber-500' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    {/* Layer indicator + drag handle */}
                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                      <span className="text-[8px] font-mono text-gray-400">L{effect.layer || 0}</span>
                      <GripVertical className="w-3 h-3 text-gray-300" />
                    </div>

                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 relative"
                      style={{ backgroundColor: effect.color }}
                    >
                      {effect.type.slice(0, 2).toUpperCase()}
                      {effect.locked && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                          <Lock className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900 dark:text-white truncate">{effect.name}</span>
                        <span className="text-[9px] uppercase text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{effect.type}</span>
                        {(effect.fadeIn || 0) > 0 && <span className="text-[8px] text-blue-500">↗{effect.fadeIn}s</span>}
                        {(effect.fadeOut || 0) > 0 && <span className="text-[8px] text-orange-500">↘{effect.fadeOut}s</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-gray-500 font-mono">{formatTime(effect.startTime)} – {formatTime(effect.endTime)}</span>
                        <span className="text-[10px] text-purple-500 font-bold">{effect.intensity}%</span>
                        <span className="text-[9px] text-gray-400">({(effect.endTime - effect.startTime).toFixed(1)}s)</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
                      {/* Layer controls */}
                      <div className="flex flex-col gap-0.5 mr-1">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); moveLayer(effect.id, 'up') }}
                          className="p-0.5 rounded text-gray-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                          title="Move layer up"
                        >
                          <MoveUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); moveLayer(effect.id, 'down') }}
                          className="p-0.5 rounded text-gray-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                          title="Move layer down"
                        >
                          <MoveDown className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleLock(effect.id) }}
                        className={`p-1.5 rounded-lg transition-colors ${effect.locked ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                        title={effect.locked ? 'Unlock' : 'Lock'}
                      >
                        {effect.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleEffect(effect.id) }}
                        className={`p-1.5 rounded-lg transition-colors ${effect.enabled ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                        title={effect.enabled ? 'Disable' : 'Enable'}
                      >
                        {effect.enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); duplicateEffect(effect.id) }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        title="Duplicate"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      {!effect.locked && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); deleteEffect(effect.id) }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded edit panel when selected */}
                  {isSelected && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 space-y-3" onClick={(e) => e.stopPropagation()}>
                      {/* Intensity slider */}
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-gray-500 w-16">Intensity</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={effect.intensity}
                          onChange={(e) => updateEffectIntensity(effect.id, Number(e.target.value))}
                          className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-purple-500"
                          disabled={effect.locked}
                        />
                        <span className="text-[10px] font-mono text-gray-500 w-10 text-right">{effect.intensity}%</span>
                      </div>

                      {/* Timing inputs */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-gray-500 w-10">Start</span>
                          <input
                            type="number"
                            step={0.1}
                            min={0}
                            max={effect.endTime - 0.1}
                            value={effect.startTime.toFixed(1)}
                            onChange={(e) => updateEffectTiming(effect.id, 'startTime', Number(e.target.value))}
                            className="flex-1 px-2 py-1 text-[11px] font-mono rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white"
                            disabled={effect.locked}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-gray-500 w-10">End</span>
                          <input
                            type="number"
                            step={0.1}
                            min={effect.startTime + 0.1}
                            max={videoState?.duration || 60}
                            value={effect.endTime.toFixed(1)}
                            onChange={(e) => updateEffectTiming(effect.id, 'endTime', Number(e.target.value))}
                            className="flex-1 px-2 py-1 text-[11px] font-mono rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white"
                            disabled={effect.locked}
                          />
                        </div>
                      </div>

                      {/* Advanced panel toggle */}
                      {showAdvancedPanel && (
                        <>
                          {/* Fade settings */}
                          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                            <div>
                              <span className="text-[9px] font-bold text-gray-500 uppercase mb-1 block">Fade In</span>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  step={0.1}
                                  min={0}
                                  max={effect.endTime - effect.startTime}
                                  value={effect.fadeIn || 0}
                                  onChange={(e) => updateFade(effect.id, 'fadeIn', Number(e.target.value))}
                                  className="w-14 px-2 py-1 text-[10px] font-mono rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                                  disabled={effect.locked}
                                />
                                <select
                                  value={effect.fadeInEasing || 'linear'}
                                  onChange={(e) => updateFade(effect.id, 'fadeInEasing', e.target.value as EffectEasing)}
                                  className="flex-1 px-1 py-1 text-[10px] rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                                  disabled={effect.locked}
                                >
                                  {EFFECT_EASINGS.map((ease) => (
                                    <option key={ease.id} value={ease.id}>{ease.icon} {ease.label}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-gray-500 uppercase mb-1 block">Fade Out</span>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  step={0.1}
                                  min={0}
                                  max={effect.endTime - effect.startTime}
                                  value={effect.fadeOut || 0}
                                  onChange={(e) => updateFade(effect.id, 'fadeOut', Number(e.target.value))}
                                  className="w-14 px-2 py-1 text-[10px] font-mono rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                                  disabled={effect.locked}
                                />
                                <select
                                  value={effect.fadeOutEasing || 'linear'}
                                  onChange={(e) => updateFade(effect.id, 'fadeOutEasing', e.target.value as EffectEasing)}
                                  className="flex-1 px-1 py-1 text-[10px] rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                                  disabled={effect.locked}
                                >
                                  {EFFECT_EASINGS.map((ease) => (
                                    <option key={ease.id} value={ease.id}>{ease.icon} {ease.label}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>

                          {/* Keyframe intensity (start/end) */}
                          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                            <div>
                              <span className="text-[9px] font-bold text-gray-500 uppercase mb-1 block">Intensity at start</span>
                              <input
                                type="range"
                                min={0}
                                max={100}
                                value={effect.keyframes?.find((k) => k.time === 0) ? (effect.keyframes.find((k) => k.time === 0)!.params as any).intensity : effect.intensity}
                                onChange={(e) => {
                                  const v = Number(e.target.value)
                                  setTimelineEffects?.((prev) => prev.map((ef) => {
                                    if (ef.id !== effect.id) return ef
                                    const endKf = ef.keyframes?.find((k) => k.time >= 0.99)
                                    const endVal = endKf ? (endKf.params as any).intensity : ef.intensity
                                    return {
                                      ...ef,
                                      keyframes: [
                                        { id: 'k-start', time: 0, params: { intensity: v }, easing: 'linear' as EffectEasing },
                                        { id: 'k-end', time: 1, params: { intensity: endVal }, easing: 'linear' as EffectEasing },
                                      ],
                                    }
                                  }))
                                }}
                                className="w-full h-1.5 accent-purple-500"
                                disabled={effect.locked}
                              />
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-gray-500 uppercase mb-1 block">Intensity at end</span>
                              <input
                                type="range"
                                min={0}
                                max={100}
                                value={effect.keyframes?.find((k) => k.time >= 0.99) ? (effect.keyframes.find((k) => k.time >= 0.99)!.params as any).intensity : effect.intensity}
                                onChange={(e) => {
                                  const v = Number(e.target.value)
                                  setTimelineEffects?.((prev) => prev.map((ef) => {
                                    if (ef.id !== effect.id) return ef
                                    const startKf = ef.keyframes?.find((k) => k.time === 0 || k.time < 0.1)
                                    const startVal = startKf ? (startKf.params as any).intensity : ef.intensity
                                    return {
                                      ...ef,
                                      keyframes: [
                                        { id: 'k-start', time: 0, params: { intensity: startVal }, easing: 'linear' as EffectEasing },
                                        { id: 'k-end', time: 1, params: { intensity: v }, easing: 'linear' as EffectEasing },
                                      ],
                                    }
                                  }))
                                }}
                                className="w-full h-1.5 accent-purple-500"
                                disabled={effect.locked}
                              />
                            </div>
                          </div>

                          {/* Notes */}
                          <div>
                            <span className="text-[9px] font-bold text-gray-500 uppercase mb-1 block">Notes</span>
                            <input
                              type="text"
                              value={effect.notes || ''}
                              onChange={(e) => setTimelineEffects?.((prev) => prev.map((ef) => ef.id === effect.id ? { ...ef, notes: e.target.value } : ef))}
                              placeholder="Add notes..."
                              className="w-full px-2 py-1 text-[10px] rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white"
                              disabled={effect.locked}
                            />
                          </div>
                        </>
                      )}

                      {/* Quick actions */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => updateEffectTiming(effect.id, 'startTime', videoState?.currentTime || 0)}
                          className="px-2 py-1 text-[9px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                          disabled={effect.locked}
                        >
                          Start → Now
                        </button>
                        <button
                          type="button"
                          onClick={() => updateEffectTiming(effect.id, 'endTime', videoState?.currentTime || 0)}
                          className="px-2 py-1 text-[9px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                          disabled={effect.locked}
                        >
                          End → Now
                        </button>
                        <button
                          type="button"
                          onClick={() => applyToFullVideo(effect.id)}
                          className="px-2 py-1 text-[9px] font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                          disabled={effect.locked}
                        >
                          Full Video
                        </button>
                        <button
                          type="button"
                          onClick={() => extendToEnd(effect.id)}
                          className="px-2 py-1 text-[9px] font-bold bg-green-100 dark:bg-green-900/30 text-green-600 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                          disabled={effect.locked}
                        >
                          Extend to End
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {timelineEffects.length === 0 && (
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl border border-dashed border-purple-200 dark:border-purple-800 p-8 text-center">
          <Sparkles className="w-10 h-10 text-purple-400 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">No Effects on Timeline</h4>
          <p className="text-[11px] text-gray-500 mb-4">Click any effect above to add it at the current playhead position</p>
          <p className="text-[10px] text-purple-500">Tip: You can drag the edges of effects in the timeline to adjust their duration</p>
        </div>
      )}
    </div>
  )
}

export default EffectsView
