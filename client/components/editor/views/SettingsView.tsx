'use client'

import React from 'react'
import { Settings, Keyboard, Layout, Monitor, Palette, Zap, ChevronRight } from 'lucide-react'
import type { EditorLayoutPreferences } from '../../../types/editor'
import type { EditorCategory } from '../../../types/editor'

interface SettingsViewProps {
  layoutPrefs: EditorLayoutPreferences
  onLayoutChange: (patch: Partial<EditorLayoutPreferences>) => void
  setShowKeyboardHelp: () => void
  setActiveCategory: (c: EditorCategory) => void
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

const FOCUS_OPTIONS: { id: EditorLayoutPreferences['focusMode']; label: string; key: string }[] = [
  { id: 'balanced', label: 'Balanced', key: 'B' },
  { id: 'preview', label: 'Focus preview', key: 'F' },
  { id: 'timeline', label: 'Focus timeline', key: 'T' },
]

const DENSITY_OPTIONS: { id: EditorLayoutPreferences['timelineDensity']; label: string }[] = [
  { id: 'compact', label: 'Compact' },
  { id: 'comfortable', label: 'Comfortable' },
  { id: 'expanded', label: 'Expanded' },
]

const SettingsView: React.FC<SettingsViewProps> = ({
  layoutPrefs,
  onLayoutChange,
  setShowKeyboardHelp,
  setActiveCategory,
  showToast,
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-surface-card rounded-xl border border-subtle p-5">
        <h3 className="text-sm font-bold text-theme-primary flex items-center gap-2 mb-4">
          <Layout className="w-4 h-4 text-violet-500" />
          Workspace layout
        </h3>
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-semibold text-theme-muted uppercase tracking-wider mb-2">Focus mode</p>
            <div className="flex flex-wrap gap-2">
              {FOCUS_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => { onLayoutChange({ focusMode: opt.id }); showToast(`Focus: ${opt.label}`, 'info') }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${layoutPrefs.focusMode === opt.id
                    ? 'bg-accent-violet text-white'
                    : 'bg-surface-elevated border border-subtle text-theme-secondary hover:bg-surface-card-hover'
                    }`}
                >
                  {opt.label} <kbd className="ml-1 opacity-80 text-[10px]">{opt.key}</kbd>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-theme-muted uppercase tracking-wider mb-2">Timeline density</p>
            <div className="flex flex-wrap gap-2">
              {DENSITY_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => { onLayoutChange({ timelineDensity: opt.id }); showToast(`Timeline: ${opt.label}`, 'info') }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${layoutPrefs.timelineDensity === opt.id
                    ? 'bg-violet-600 text-white'
                    : 'bg-surface-elevated border border-subtle text-theme-secondary hover:bg-surface-card-hover'
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface-card rounded-xl border border-subtle p-5">
        <h3 className="text-sm font-bold text-theme-primary flex items-center gap-2 mb-4">
          <Keyboard className="w-4 h-4 text-amber-500" />
          Keyboard shortcuts
        </h3>
        <p className="text-xs text-theme-secondary mb-3">Speed up your workflow with these keys (when not typing in an input).</p>
        <ul className="text-[11px] text-theme-secondary space-y-1.5 mb-4">
          <li><kbd className="px-1.5 py-0.5 rounded bg-surface-elevated border border-subtle font-mono">?</kbd> Show all shortcuts</li>
          <li><kbd className="px-1.5 py-0.5 rounded bg-surface-elevated border border-subtle font-mono">Ctrl+K</kbd> Command palette</li>
          <li><kbd className="px-1.5 py-0.5 rounded bg-surface-elevated border border-subtle font-mono">Ctrl+J</kbd> AI Assistant</li>
          <li><kbd className="px-1.5 py-0.5 rounded bg-surface-elevated border border-subtle font-mono">Ctrl+S</kbd> Save / autosave</li>
          <li><kbd className="px-1.5 py-0.5 rounded bg-surface-elevated border border-subtle font-mono">Ctrl+Z</kbd> Undo · <kbd className="px-1.5 py-0.5 rounded bg-surface-elevated border border-subtle font-mono">Ctrl+Shift+Z</kbd> Redo</li>
        </ul>
        <button
          type="button"
          onClick={setShowKeyboardHelp}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-surface-elevated border border-subtle text-theme-primary hover:bg-surface-card-hover transition-colors text-sm font-medium"
        >
          Open full shortcuts panel
          <ChevronRight className="w-4 h-4 text-theme-muted" />
        </button>
      </div>

      <div className="bg-surface-card rounded-xl border border-subtle p-5">
        <h3 className="text-sm font-bold text-theme-primary flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-emerald-500" />
          Quick jump to tools
        </h3>
        <div className="grid grid-cols-1 gap-2">
          {[
            { id: 'edit' as EditorCategory, label: 'Edit', desc: 'Layout, filters, text overlays' },
            { id: 'color' as EditorCategory, label: 'Color', desc: 'Grading & LUTs' },
            { id: 'effects' as EditorCategory, label: 'Effects', desc: 'Filters, transitions, motion' },
            { id: 'timeline' as EditorCategory, label: 'Timeline', desc: 'Segments & precision' },
            { id: 'export' as EditorCategory, label: 'Export', desc: 'Render & publish' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveCategory(item.id)}
              className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-surface-elevated border border-subtle text-left hover:bg-surface-card-hover hover:border-default transition-all group"
            >
              <div>
                <p className="text-sm font-semibold text-theme-primary group-hover:text-violet-600 dark:group-hover:text-violet-400">{item.label}</p>
                <p className="text-[10px] text-theme-muted">{item.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-theme-muted shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default SettingsView
