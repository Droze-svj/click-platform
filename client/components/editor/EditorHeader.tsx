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
  Check
} from 'lucide-react'
import { EditorCategory } from '../../types/editor'
import type { EditorLayoutPreferences, PreviewSize, TimelineDensity, FocusMode } from '../../types/editor'

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
  featuresCount: number
  isOledTheme?: boolean
  videoId?: string
  layoutPrefs?: EditorLayoutPreferences
  onLayoutChange?: (patch: Partial<EditorLayoutPreferences>) => void
  defaultLayout?: EditorLayoutPreferences
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  projectName,
  setProjectName,
  autosaveStatus,
  getStatusIcon,
  retrySave,
  historyIndex,
  historyLength,
  handleUndo,
  handleRedo,
  setShowKeyboardHelp,
  contentPanelCollapsed,
  setContentPanelCollapsed,
  activeCategory,
  featuresCount,
  isOledTheme,
  videoId,
  layoutPrefs,
  onLayoutChange,
  defaultLayout
}) => {
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false)
  const [showShortcutsHint, setShowShortcutsHint] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('click-editor-shortcuts-hint-dismissed') !== 'true'
  })
  const layoutMenuRef = useRef<HTMLDivElement>(null)
  const onOpenShortcuts = () => {
    setShowShortcutsHint(false)
    try { localStorage.setItem('click-editor-shortcuts-hint-dismissed', 'true') } catch { /* ignore */ }
    setShowKeyboardHelp(true)
  }
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (layoutMenuRef.current && !layoutMenuRef.current.contains(e.target as Node)) setLayoutMenuOpen(false)
    }
    if (layoutMenuOpen) document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [layoutMenuOpen])
  return (
    <div className={`${isOledTheme ? 'bg-black/80 border-slate-800/50' : 'bg-white/90 dark:bg-slate-800/90 border-slate-200/50 dark:border-slate-700/50'} backdrop-blur-lg border-b p-3 flex-shrink-0 z-30 transition-colors duration-300`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setContentPanelCollapsed(!contentPanelCollapsed)}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title={contentPanelCollapsed ? 'Show editor panel' : 'Hide editor panel'}
          >
            {contentPanelCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <span
              contentEditable
              onBlur={(e) => setProjectName(e.currentTarget.textContent || 'Untitled Project')}
              suppressContentEditableWarning
              className="hover:bg-gray-100 dark:hover:bg-gray-800 px-2 rounded-md cursor-text outline-none focus:ring-2 focus:ring-blue-500"
            >
              {projectName}
            </span>
            <div className="h-4 w-[1px] bg-gray-300 dark:bg-gray-700 mx-1"></div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] font-bold text-gray-500 dark:text-gray-400">
              {getStatusIcon()}
              <span className="uppercase tracking-tighter">{autosaveStatus.status}</span>
            </div>
          </h1>
          {/* Autosave Status Indicator */}
          {(videoId || autosaveStatus.status !== 'idle') && (
            <div className="flex items-center gap-2 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg flex-shrink-0">
              {getStatusIcon()}
              <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                {autosaveStatus.message ||
                  (autosaveStatus.status === 'saving' && 'Saving...') ||
                  (autosaveStatus.status === 'saved' && 'Saved') ||
                  (autosaveStatus.status === 'error' && 'Error') ||
                  (autosaveStatus.status === 'idle' && autosaveStatus.lastSaved
                    ? `Saved ${new Date(autosaveStatus.lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : '')}
              </span>
              {autosaveStatus.status === 'error' && retrySave && (
                <button
                  onClick={retrySave}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 text-xs font-medium transition-colors"
                  title="Retry save"
                >
                  <RefreshCw className="w-3 h-3" />
                  Retry
                </button>
              )}
            </div>
          )}
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
            {featuresCount} Features
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Undo/Redo Buttons */}
          <div className="hidden sm:flex items-center gap-0.5 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
            <button
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className={`p-1.5 rounded transition-colors ${historyIndex <= 0
                ? 'opacity-50 cursor-not-allowed text-gray-400 dark:text-gray-500'
                : 'hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                }`}
              title="Undo (Ctrl+Z)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= historyLength - 1}
              className={`p-1.5 rounded transition-colors ${historyIndex >= historyLength - 1
                ? 'opacity-50 cursor-not-allowed text-gray-400 dark:text-gray-500'
                : 'hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                }`}
              title="Redo (Ctrl+Shift+Z)"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {showShortcutsHint && (
              <span className="hidden sm:inline text-[10px] text-gray-500 dark:text-gray-400 animate-in fade-in duration-300">
                New? Press <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-600 rounded font-mono">?</kbd> for shortcuts
              </span>
            )}
            <button
              onClick={onOpenShortcuts}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium transition-colors"
              title="Keyboard shortcuts (Press ?)"
            >
              <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-[10px]">?</kbd>
              Shortcuts
            </button>
          </div>
          {/* View / Layout menu - adaptable workspace */}
          {layoutPrefs && onLayoutChange && (
            <div className="relative hidden sm:block" ref={layoutMenuRef}>
              <button
                onClick={() => setLayoutMenuOpen((o) => !o)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium transition-colors"
                title="Layout & view options (F / T / B for focus)"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                View
              </button>
              {layoutMenuOpen && (
                <div className="absolute right-0 top-full mt-1 py-2 w-60 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Preview size</div>
                  {([
                    { id: 'auto' as const, label: 'Auto', hint: 'Adjust to viewport (default)' },
                    { id: 'small' as const, label: 'Small', hint: '640px max' },
                    { id: 'medium' as const, label: 'Medium', hint: '800px max' },
                    { id: 'large' as const, label: 'Large', hint: '1000px max' },
                    { id: 'fill' as const, label: 'Fill', hint: 'Use all space' },
                  ]).map(({ id, label, hint }) => (
                    <button key={id} onClick={() => onLayoutChange({ previewSize: id })} className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 text-left text-sm">
                      <span>{label} <span className="text-gray-400 dark:text-gray-500 font-normal text-xs">({hint})</span></span>
                      {layoutPrefs.previewSize === id && <Check className="w-4 h-4 text-blue-500 shrink-0" />}
                    </button>
                  ))}
                  <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Timeline density</div>
                  {(['compact', 'comfortable', 'expanded'] as TimelineDensity[]).map((d) => (
                    <button key={d} onClick={() => onLayoutChange({ timelineDensity: d })} className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 text-left text-sm">
                      <span className="capitalize">{d}</span>
                      {layoutPrefs.timelineDensity === d && <Check className="w-4 h-4 text-blue-500" />}
                    </button>
                  ))}
                  <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Focus mode</div>
                  {([
                    { id: 'balanced' as const, label: 'Balanced', kbd: 'B' },
                    { id: 'preview' as const, label: 'Focus preview', kbd: 'F' },
                    { id: 'timeline' as const, label: 'Focus timeline', kbd: 'T' },
                  ]).map(({ id, label, kbd }) => (
                    <button key={id} onClick={() => onLayoutChange({ focusMode: id })} className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 text-left text-sm">
                      <span>{label} <kbd className="ml-1 px-1 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-[10px]">{kbd}</kbd></span>
                      {layoutPrefs.focusMode === id && <Check className="w-4 h-4 text-blue-500 shrink-0" />}
                    </button>
                  ))}
                  {defaultLayout && (
                    <>
                      <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                      <button onClick={() => onLayoutChange(defaultLayout)} className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 text-left text-sm text-gray-600 dark:text-gray-400">
                        Reset layout to default
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          <button className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-lg text-xs font-medium transition-all duration-200 shadow-md">
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>
      </div>
    </div>
  )
}
