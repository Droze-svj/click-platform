
import React from 'react'
import { Keyboard } from 'lucide-react'
import { Modal } from '../ui'

interface KeyboardShortcutsHelpProps {
  isOpen?: boolean
  onClose: () => void
}

const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({ isOpen = true, onClose }) => {
  const kbdClass = 'px-2 py-1 rounded-md ds-surface-subtle border border-subtle text-[10px] font-medium shrink-0 text-theme-primary'

  const groups: { title: string; items: { k: string; d: string }[] }[] = [
    {
      title: 'Workflow',
      items: [
        { k: 'Alt+1', d: 'Edit' },
        { k: 'Alt+2', d: 'Color' },
        { k: 'Alt+3', d: 'Effects' },
        { k: 'Alt+4', d: 'Timeline' },
        { k: 'Alt+5', d: 'Export' },
      ],
    },
    {
      title: 'Timeline',
      items: [
        { k: 'J / K / L', d: 'Back / Pause / Fwd' },
        { k: 'K', d: 'Add keyframe (Effects)' },
        { k: 'S', d: 'Split at playhead' },
        { k: 'M', d: 'Add marker' },
        { k: 'Ctrl+D', d: 'Duplicate selected' },
        { k: 'Alt+←/→', d: 'Nudge segment' },
        { k: 'I / O', d: 'Set In / Out' },
        { k: 'Shift+click', d: 'Multi-select segments' },
      ],
    },
    {
      title: 'Navigation',
      items: [
        { k: 'Space', d: 'Play / Pause' },
        { k: 'Left/Right', d: 'Seek 5 seconds' },
        { k: 'Up/Down', d: 'Adjust Volume' },
        { k: 'M', d: 'Toggle Mute' },
      ],
    },
    {
      title: 'Editing',
      items: [
        { k: 'Ctrl+Z', d: 'Undo Action' },
        { k: 'Ctrl+Y', d: 'Redo Action' },
        { k: 'Ctrl+Shift+T', d: 'Add text (focus custom text)' },
        { k: 'S', d: 'Split Clip' },
        { k: 'Del', d: 'Delete Selected' },
      ],
    },
    {
      title: 'Edit tab',
      items: [
        { k: 'Ctrl+0', d: 'Reset filter to default' },
        { k: 'Ctrl+←', d: 'Previous aspect ratio' },
        { k: 'Ctrl+→', d: 'Next aspect ratio' },
        { k: 'Compare btn', d: 'Before / After / Split view' },
      ],
    },
    {
      title: 'Layout',
      items: [
        { k: 'F', d: 'Focus preview (hide panel)' },
        { k: 'T', d: 'Focus timeline' },
        { k: 'B', d: 'Balanced (show all)' },
        { k: 'View menu', d: 'Preview size, density, reset' },
      ],
    },
  ]

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      className="max-w-2xl p-0 overflow-hidden"
    >
      <div className="p-6 border-b border-subtle flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-violet text-white shrink-0">
          <Keyboard className="w-5 h-5" aria-hidden />
        </div>
        <h2 className="ds-text-h3 text-theme-primary">Keyboard shortcuts</h2>
      </div>

      <div className="p-8 grid grid-cols-2 sm:grid-cols-3 gap-6 max-h-[65vh] overflow-y-auto custom-scrollbar">
        {groups.map((group) => (
          <div key={group.title}>
            <h3 className="ds-text-label text-theme-muted mb-4">{group.title}</h3>
            <div className="space-y-4">
              {group.items.map((s) => (
                <div key={`${group.title}-${s.k}-${s.d}`} className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-theme-secondary">{s.d}</span>
                  <kbd className={kbdClass}>{s.k}</kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="p-6 ds-surface-subtle border-t border-subtle text-center">
        <p className="text-[11px] text-theme-muted">
          Press <kbd className={kbdClass}>?</kbd> to toggle · Ctrl+S save · Workflow strip: Alt+1–5
        </p>
      </div>
    </Modal>
  )
}

export default KeyboardShortcutsHelp
