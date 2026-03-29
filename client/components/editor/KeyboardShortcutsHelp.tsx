
import React from 'react'
import { X, Keyboard } from 'lucide-react'

interface KeyboardShortcutsHelpProps {
  isOpen?: boolean
  onClose: () => void
}

const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({ onClose }) => {
  const kbdClass = 'px-2 py-1 rounded-lg bg-surface-elevated border border-subtle text-[10px] font-black shrink-0 text-theme-primary'
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="w-full max-w-2xl editor-card overflow-hidden">
        <div className="p-6 border-b border-subtle flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-accent-violet">
              <Keyboard className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-theme-primary">Keyboard shortcuts</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-card-hover rounded-xl transition-colors text-theme-muted hover:text-theme-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-8 grid grid-cols-2 sm:grid-cols-3 gap-6 max-h-[65vh] overflow-y-auto custom-scrollbar">
          <div>
            <h3 className="text-xs font-bold uppercase text-violet-500 mb-4 tracking-widest">Workflow</h3>
            <div className="space-y-4">
              {[
                { k: 'Alt+1', d: 'Edit' },
                { k: 'Alt+2', d: 'Color' },
                { k: 'Alt+3', d: 'Effects' },
                { k: 'Alt+4', d: 'Timeline' },
                { k: 'Alt+5', d: 'Export' },
              ].map(s => (
                <div key={s.k} className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-theme-secondary">{s.d}</span>
                  <kbd className={kbdClass}>{s.k}</kbd>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase text-amber-500 mb-4 tracking-widest">Timeline</h3>
            <div className="space-y-4">
              {[
                { k: 'J / K / L', d: 'Back / Pause / Fwd' },
                { k: 'K', d: 'Add keyframe (Effects)' },
                { k: 'S', d: 'Split at playhead' },
                { k: 'M', d: 'Add marker' },
                { k: 'Ctrl+D', d: 'Duplicate selected' },
                { k: 'Alt+←/→', d: 'Nudge segment' },
                { k: 'I / O', d: 'Set In / Out' },
                { k: 'Shift+click', d: 'Multi-select segments' },
              ].map(s => (
                <div key={s.k} className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-theme-secondary">{s.d}</span>
                  <kbd className={kbdClass}>{s.k}</kbd>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase text-blue-500 mb-4 tracking-widest">Navigation</h3>
            <div className="space-y-4">
              {[
                { k: 'Space', d: 'Play / Pause' },
                { k: 'Left/Right', d: 'Seek 5 seconds' },
                { k: 'Up/Down', d: 'Adjust Volume' },
                { k: 'M', d: 'Toggle Mute' }
              ].map(s => (
                <div key={s.k} className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-theme-secondary">{s.d}</span>
                  <kbd className={kbdClass}>{s.k}</kbd>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase text-violet-500 mb-4 tracking-widest">Editing</h3>
            <div className="space-y-4">
              {[
                { k: 'Ctrl+Z', d: 'Undo Action' },
                { k: 'Ctrl+Y', d: 'Redo Action' },
                { k: 'Ctrl+Shift+T', d: 'Add text (focus custom text)' },
                { k: 'S', d: 'Split Clip' },
                { k: 'Del', d: 'Delete Selected' }
              ].map(s => (
                <div key={s.k} className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-theme-secondary">{s.d}</span>
                  <kbd className={kbdClass}>{s.k}</kbd>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase text-amber-500 mb-4 tracking-widest">Edit tab</h3>
            <div className="space-y-4">
              {[
                { k: 'Ctrl+0', d: 'Reset filter to default' },
                { k: 'Ctrl+←', d: 'Previous aspect ratio' },
                { k: 'Ctrl+→', d: 'Next aspect ratio' },
                { k: 'Compare btn', d: 'Before / After / Split view' }
              ].map(s => (
                <div key={s.k} className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-theme-secondary">{s.d}</span>
                  <kbd className={kbdClass}>{s.k}</kbd>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase text-emerald-500 mb-4 tracking-widest">Layout</h3>
            <div className="space-y-4">
              {[
                { k: 'F', d: 'Focus preview (hide panel)' },
                { k: 'T', d: 'Focus timeline' },
                { k: 'B', d: 'Balanced (show all)' },
                { k: 'View menu', d: 'Preview size, density, reset' }
              ].map(s => (
                <div key={s.k} className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-theme-secondary">{s.d}</span>
                  <kbd className={kbdClass}>{s.k}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 bg-surface-elevated/80 border-t border-subtle text-center">
          <p className="text-[10px] font-bold text-theme-muted uppercase tracking-wider">Press <kbd className={kbdClass}>?</kbd> to toggle · Ctrl+S save · Workflow strip: Alt+1–5</p>
        </div>
      </div>
    </div>
  )
}

export default KeyboardShortcutsHelp
