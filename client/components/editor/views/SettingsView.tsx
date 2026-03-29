'use client'

import React, { useState, useEffect } from 'react'
import { Settings, Keyboard, Layout, Palette, Zap, ChevronRight, Download, Sparkles, MessageCircle, ThumbsUp, ThumbsDown } from 'lucide-react'
import type { EditorLayoutPreferences, EditorCategory, EditorContentPreferences } from '../../../types/editor'
import { loadEditorContentPreferences, saveEditorContentPreferences } from '../../../utils/editorUtils'

interface SettingsViewProps {
  layoutPrefs: EditorLayoutPreferences
  onLayoutChange: (patch: Partial<EditorLayoutPreferences>) => void
  setShowKeyboardHelp: () => void
  setActiveCategory: (c: EditorCategory) => void
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
  onContentPrefsChange?: (patch: Partial<EditorContentPreferences>) => void
  onResetTimelineHint?: () => void
}

const EXPORT_PRESET_OPTIONS: { id: string; label: string }[] = [
  { id: '1080p', label: '1080p HD' },
  { id: 'shorts', label: 'YT Shorts' },
  { id: 'reels', label: 'IG Reels' },
  { id: 'tiktok', label: 'TikTok' },
  { id: '4k', label: '4K Master' },
  { id: 'best', label: 'Best quality' },
]

const DEFAULT_SECTION_OPTIONS: { id: EditorCategory; label: string }[] = [
  { id: 'ai-edit', label: 'Elite AI' },
  { id: 'edit', label: 'Edit' },
  { id: 'color', label: 'Color' },
  { id: 'effects', label: 'Effects' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'export', label: 'Export' },
]

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
  onContentPrefsChange,
  onResetTimelineHint,
}) => {
  const [contentPrefs, setContentPrefs] = useState<EditorContentPreferences>(() => loadEditorContentPreferences())
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [feedbackComment, setFeedbackComment] = useState('')

  useEffect(() => {
    setContentPrefs(loadEditorContentPreferences())
  }, [])

  const updateContentPref = (patch: Partial<EditorContentPreferences>) => {
    const next = { ...contentPrefs, ...patch }
    setContentPrefs(next)
    saveEditorContentPreferences(patch)
    onContentPrefsChange?.(patch)
    showToast('Preferences saved', 'success')
  }

  const sendFeedback = (helpful: boolean) => {
    try {
      const payload = { helpful, comment: feedbackComment || undefined, at: new Date().toISOString() }
      const key = 'editor-feedback'
      const existing = typeof window !== 'undefined' ? localStorage.getItem(key) : null
      const list = existing ? JSON.parse(existing) : []
      list.push(payload)
      if (typeof window !== 'undefined') localStorage.setItem(key, JSON.stringify(list.slice(-20)))
      setFeedbackSent(true)
      setFeedbackComment('')
      showToast(helpful ? 'Thanks! We\'re glad it helps.' : 'Thanks for your feedback—we\'ll use it to improve.', 'success')
    } catch {
      showToast('Feedback saved locally. Thank you!', 'success')
      setFeedbackSent(true)
    }
  }

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
        {onResetTimelineHint && (
          <button
            type="button"
            onClick={() => { try { localStorage.removeItem('editor-timeline-hint-dismissed') } catch { /* ignore */ }; onResetTimelineHint(); showToast('Timeline hint will show again when you open Timeline', 'success'); setActiveCategory('timeline') }}
            className="mt-2 w-full flex items-center justify-between px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-theme-primary hover:bg-amber-500/20 transition-colors text-sm font-medium"
          >
            Show timeline shortcuts hint again
            <ChevronRight className="w-4 h-4 text-theme-muted" />
          </button>
        )}
      </div>

      <div className="bg-surface-card rounded-xl border border-subtle p-5">
        <h3 className="text-sm font-bold text-theme-primary flex items-center gap-2 mb-4">
          <Download className="w-4 h-4 text-blue-500" />
          Content & quality defaults
        </h3>
        <p className="text-xs text-theme-secondary mb-3">These apply when you open Export and when you open the editor.</p>
        <div className="space-y-3">
          <div>
            <p className="text-[10px] font-semibold text-theme-muted uppercase tracking-wider mb-1">Default export preset</p>
            <select
              value={contentPrefs.defaultExportPreset ?? '1080p'}
              onChange={(e) => updateContentPref({ defaultExportPreset: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-subtle bg-surface-elevated text-sm text-theme-primary"
            >
              {EXPORT_PRESET_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className="text-[10px] font-semibold text-theme-muted uppercase tracking-wider self-center">Quality:</span>
            {(['high', 'medium', 'low'] as const).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => updateContentPref({ defaultExportQuality: q })}
                className={`px-2.5 py-1 rounded text-xs font-medium ${contentPrefs.defaultExportQuality === q ? 'bg-blue-600 text-white' : 'bg-surface-elevated border border-subtle text-theme-secondary hover:bg-surface-card-hover'}`}
              >
                {q === 'high' ? 'High' : q === 'medium' ? 'Medium' : 'Low'}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className="text-[10px] font-semibold text-theme-muted uppercase tracking-wider self-center">Codec:</span>
            {(['h264', 'hevc'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => updateContentPref({ defaultExportCodec: c })}
                className={`px-2.5 py-1 rounded text-xs font-medium ${contentPrefs.defaultExportCodec === c ? 'bg-blue-600 text-white' : 'bg-surface-elevated border border-subtle text-theme-secondary hover:bg-surface-card-hover'}`}
              >
                {c === 'h264' ? 'H.264' : 'HEVC'}
              </button>
            ))}
          </div>
          <div>
            <p className="text-[10px] font-semibold text-theme-muted uppercase tracking-wider mb-1">Open this section when entering editor</p>
            <select
              value={contentPrefs.defaultOpenSection ?? 'ai-edit'}
              onChange={(e) => updateContentPref({ defaultOpenSection: e.target.value as EditorCategory })}
              className="w-full px-3 py-2 rounded-lg border border-subtle bg-surface-elevated text-sm text-theme-primary"
            >
              {DEFAULT_SECTION_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-surface-card rounded-xl border border-subtle p-5">
        <h3 className="text-sm font-bold text-theme-primary flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-amber-500" />
          Experience
        </h3>
        <div className="space-y-3">
          <div>
            <p className="text-[10px] font-semibold text-theme-muted uppercase tracking-wider mb-1">Preview quality</p>
            <div className="flex gap-2">
              {(['draft', 'full'] as const).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => updateContentPref({ previewQuality: q })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${contentPrefs.previewQuality === q ? 'bg-amber-600 text-white' : 'bg-surface-elevated border border-subtle text-theme-secondary hover:bg-surface-card-hover'}`}
                >
                  {q === 'draft' ? 'Draft (faster scrubbing)' : 'Full (best quality)'}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={contentPrefs.showExportPlatformHints !== false}
              onChange={(e) => updateContentPref({ showExportPlatformHints: e.target.checked })}
              className="rounded accent-violet-500"
            />
            <span className="text-xs text-theme-secondary">Show platform hints in Export (Reels, Shorts, TikTok tips)</span>
          </label>
        </div>
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

      <div className="bg-surface-card rounded-xl border border-subtle p-5">
        <h3 className="text-sm font-bold text-theme-primary flex items-center gap-2 mb-4">
          <MessageCircle className="w-4 h-4 text-sky-500" />
          Feedback
        </h3>
        <p className="text-xs text-theme-secondary mb-3">Help us improve the editor. Your preferences and feedback shape what we build next.</p>
        {feedbackSent ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Thank you for your feedback.</p>
        ) : (
          <>
            <p className="text-[10px] font-semibold text-theme-muted uppercase tracking-wider mb-2">How&apos;s the editor?</p>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => sendFeedback(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-elevated border border-subtle text-theme-primary hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:border-emerald-500/50 transition-colors"
              >
                <ThumbsUp className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-medium">Helpful</span>
              </button>
              <button
                type="button"
                onClick={() => sendFeedback(false)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-elevated border border-subtle text-theme-primary hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:border-amber-500/50 transition-colors"
              >
                <ThumbsDown className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-medium">Could be better</span>
              </button>
            </div>
            <textarea
              placeholder="Optional: what would make it better?"
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-subtle bg-surface-elevated text-sm text-theme-primary placeholder:text-theme-muted resize-none h-20"
              maxLength={500}
            />
          </>
        )}
      </div>
    </div>
  )
}

export default SettingsView
