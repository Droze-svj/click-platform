
import React from 'react'
import { X, Keyboard } from 'lucide-react'

interface KeyboardShortcutsHelpProps {
  shortcuts: any[]
  onClose: () => void
}

const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden border border-white/10">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <Keyboard className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight text-gray-900 dark:text-white">Keyboard Ecosystem</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-8 grid grid-cols-2 gap-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
          <div>
            <h3 className="text-xs font-black uppercase text-blue-500 mb-4 tracking-widest">Navigation</h3>
            <div className="space-y-4">
              {[
                { k: 'Space', d: 'Play / Pause' },
                { k: 'Left/Right', d: 'Seek 5 seconds' },
                { k: 'Up/Down', d: 'Adjust Volume' },
                { k: 'M', d: 'Toggle Mute' }
              ].map(s => (
                <div key={s.k} className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-400">{s.d}</span>
                  <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-[10px] font-black">{s.k}</kbd>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-black uppercase text-purple-500 mb-4 tracking-widest">Editing</h3>
            <div className="space-y-4">
              {[
                { k: 'Ctrl+Z', d: 'Undo Action' },
                { k: 'Ctrl+Y', d: 'Redo Action' },
                { k: 'Ctrl+Shift+T', d: 'Add text (focus custom text)' },
                { k: 'S', d: 'Split Clip' },
                { k: 'Del', d: 'Delete Selected' }
              ].map(s => (
                <div key={s.k} className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-400">{s.d}</span>
                  <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-[10px] font-black">{s.k}</kbd>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-black uppercase text-amber-500 mb-4 tracking-widest">Edit tab</h3>
            <div className="space-y-4">
              {[
                { k: 'Ctrl+0', d: 'Reset filter to default' },
                { k: 'Ctrl+←', d: 'Previous aspect ratio' },
                { k: 'Ctrl+→', d: 'Next aspect ratio' },
                { k: 'Compare btn', d: 'Before / After / Split view' }
              ].map(s => (
                <div key={s.k} className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-400">{s.d}</span>
                  <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-[10px] font-black">{s.k}</kbd>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-black uppercase text-emerald-500 mb-4 tracking-widest">Layout</h3>
            <div className="space-y-4">
              {[
                { k: 'F', d: 'Focus preview (hide panel)' },
                { k: 'T', d: 'Focus timeline' },
                { k: 'B', d: 'Balanced (show all)' },
                { k: 'View menu', d: 'Preview size, density, reset' }
              ].map(s => (
                <div key={s.k} className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-400">{s.d}</span>
                  <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-[10px] font-black">{s.k}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 bg-blue-50 dark:bg-blue-900/10 text-center">
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-[2px]">Press <kbd>?</kbd> to toggle this menu anytime</p>
        </div>
      </div>
    </div>
  )
}

export default KeyboardShortcutsHelp
