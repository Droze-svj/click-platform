'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  RotateCw,
  Download,
  RefreshCw,
  LayoutGrid,
  Check,
  Cpu,
  Activity,
  Radio,
  Target,
  Brain,
  TrendingUp,
  Flame,
} from 'lucide-react'
import { EditorCategory } from '../../types/editor'
import type { EditorLayoutPreferences, PreviewSize, TimelineDensity, FocusMode } from '../../types/editor'
import { Button, IconButton, Badge } from '../ui'
import { cn } from '../../lib/utils'

interface EditorHeaderProps {
  projectName: string
  setProjectName: (name: string) => void
  autosaveStatus: {
    status: 'idle' | 'saving' | 'saved' | 'error'
    lastSaved: Date | null
    message?: string
  }
  getStatusIcon: () => React.ReactNode
  retrySave?: () => void
  historyIndex: number
  historyLength: number
  handleUndo: () => void
  handleRedo: () => void
  setShowKeyboardHelp: (show: boolean) => void
  contentPanelCollapsed: boolean
  setContentPanelCollapsed: (collapsed: boolean) => void
  activeCategory: EditorCategory
  activeCategoryLabel?: string
  featuresCount: number
  isOledTheme?: boolean
  videoId?: string
  layoutPrefs?: EditorLayoutPreferences
  onLayoutChange?: (patch: Partial<EditorLayoutPreferences>) => void
  defaultLayout?: EditorLayoutPreferences
  viralScore?: number
  scoreTrend?: 'up' | 'down' | 'flat'
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  projectName,
  setProjectName,
  autosaveStatus,
  getStatusIcon,
  historyIndex,
  historyLength,
  handleUndo,
  handleRedo,
  setShowKeyboardHelp,
  contentPanelCollapsed,
  setContentPanelCollapsed,
  activeCategory,
  activeCategoryLabel,
  featuresCount,
  isOledTheme,
  videoId,
  layoutPrefs,
  onLayoutChange,
  defaultLayout,
  viralScore = 72,
  scoreTrend = 'flat',
}) => {
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false)
  const layoutMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (layoutMenuRef.current && !layoutMenuRef.current.contains(e.target as Node)) setLayoutMenuOpen(false)
    }
    if (layoutMenuOpen) document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [layoutMenuOpen])

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < historyLength - 1

  const scoreTone =
    viralScore >= 85 ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500'
    : viralScore >= 65 ? 'border-amber-500/40 bg-amber-500/10 text-amber-500'
    : 'border-rose-500/40 bg-rose-500/10 text-rose-500'

  return (
    <header className="relative z-50 p-3 flex items-center justify-between gap-4">
      {/* Principal Navigation Cluster */}
      <div className="ds-surface-card flex items-center gap-4 flex-1 px-4 py-3">
        <IconButton
          aria-label={contentPanelCollapsed ? 'Expand panel' : 'Collapse panel'}
          variant="secondary"
          onClick={() => setContentPanelCollapsed(!contentPanelCollapsed)}
        >
          {contentPanelCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </IconButton>

        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="font-medium normal-case">
              <Activity className="w-3.5 h-3.5 mr-1.5" aria-hidden />
              Workspace
            </Badge>
            {autosaveStatus.status === 'saving' && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-amber-500">
                <RefreshCw className="w-3 h-3 animate-spin" aria-hidden />
                Saving
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-2">
            <h1
              contentEditable
              onBlur={(e) => setProjectName(e.currentTarget.textContent || 'Untitled project')}
              suppressContentEditableWarning
              className="ds-text-h2 text-theme-primary truncate outline-none focus:text-primary transition-colors cursor-text rounded"
            >
              {projectName}
            </h1>
            {activeCategoryLabel && (
              <Badge variant="outline" className="font-medium normal-case">
                {activeCategoryLabel}
              </Badge>
            )}
          </div>
        </div>

        {/* Diagnostics — only real data: active feature count + viral score */}
        <div className="hidden 2xl:flex items-center gap-6 pl-6 border-l border-subtle">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-primary" aria-hidden />
            <span className="text-xs font-medium text-theme-secondary">{featuresCount} tools active</span>
          </div>
          {/* Live AI Viral Score Badge — `viralScore` is supplied by the editor */}
          <div className="flex flex-col items-center gap-1 pl-6 border-l border-subtle">
            <div className={cn('w-12 h-12 rounded-full border-2 flex items-center justify-center', scoreTone)}>
              <span className="text-base font-semibold tabular-nums">{viralScore}</span>
            </div>
            <div className="flex items-center gap-1">
              <Brain className="w-2.5 h-2.5 text-primary" aria-hidden />
              <span className="text-[10px] text-theme-muted">Score</span>
              {scoreTrend === 'up' && <TrendingUp className="w-2.5 h-2.5 text-emerald-500" aria-hidden />}
              {scoreTrend === 'down' && <Flame className="w-2.5 h-2.5 text-rose-500" aria-hidden />}
            </div>
          </div>
        </div>
      </div>

      {/* Action Command Cluster */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 p-1 rounded-xl ds-surface-subtle">
          <IconButton aria-label="Undo" variant="ghost" onClick={handleUndo} disabled={!canUndo}>
            <RotateCcw className="w-5 h-5" />
          </IconButton>
          <IconButton aria-label="Redo" variant="ghost" onClick={handleRedo} disabled={!canRedo}>
            <RotateCw className="w-5 h-5" />
          </IconButton>
        </div>

        {layoutPrefs && onLayoutChange && (
          <div className="relative" ref={layoutMenuRef}>
            <Button
              variant={layoutMenuOpen ? 'primary' : 'secondary'}
              onClick={() => setLayoutMenuOpen((o) => !o)}
              leftIcon={<LayoutGrid className="w-4 h-4" />}
            >
              Layout
            </Button>

            {layoutMenuOpen && (
              <div className="ds-surface-elevated ds-anim-rise absolute right-0 top-full mt-2 w-72 p-4 z-[100]">
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center gap-2 px-1 pb-2">
                      <Target className="w-4 h-4 text-primary" aria-hidden />
                      <span className="ds-text-label text-theme-muted">Preview size</span>
                    </div>
                    <div className="space-y-1">
                      {([
                        { id: 'auto' as const, label: 'Adaptive' },
                        { id: 'small' as const, label: 'Compact' },
                        { id: 'medium' as const, label: 'Balanced' },
                        { id: 'large' as const, label: 'Large' },
                        { id: 'fill' as const, label: 'Fill' },
                      ]).map(({ id, label }) => (
                        <button type="button" key={id} onClick={() => onLayoutChange({ previewSize: id })} className={cn('w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors', layoutPrefs.previewSize === id ? 'bg-primary text-primary-foreground' : 'text-theme-secondary hover:bg-accent hover:text-accent-foreground')}>
                          <span className="font-medium">{label}</span>
                          {layoutPrefs.previewSize === id && <Check className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-subtle">
                    <div className="flex items-center gap-2 px-1 pb-2">
                      <Radio className="w-4 h-4 text-primary" aria-hidden />
                      <span className="ds-text-label text-theme-muted">Focus mode</span>
                    </div>
                    <div className="space-y-1">
                      {([
                        { id: 'balanced' as const, label: 'Balanced' },
                        { id: 'preview' as const, label: 'Preview' },
                        { id: 'timeline' as const, label: 'Timeline' },
                      ]).map(({ id, label }) => (
                        <button type="button" key={id} onClick={() => onLayoutChange({ focusMode: id })} className={cn('w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors', layoutPrefs.focusMode === id ? 'bg-primary text-primary-foreground' : 'text-theme-secondary hover:bg-accent hover:text-accent-foreground')}>
                          <span className="font-medium">{label}</span>
                          {layoutPrefs.focusMode === id && <Check className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <Button variant="primary" leftIcon={<Download className="w-4 h-4" />}>
          Export
        </Button>
      </div>
    </header>
  )
}
