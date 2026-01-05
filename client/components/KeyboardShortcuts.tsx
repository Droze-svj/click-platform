'use client'

interface KeyboardShortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  description: string
  action: () => void
  category: string
}

interface KeyboardShortcutsProps {
  shortcuts: KeyboardShortcut[]
  enabled?: boolean
}

interface KeyboardShortcutsHelpProps {
  shortcuts: KeyboardShortcut[]
  isOpen: boolean
  onClose: () => void
}

interface VideoEditorShortcuts {
  playPause: () => void
  seekForward: (seconds?: number) => void
  seekBackward: (seconds?: number) => void
  volumeUp: () => void
  volumeDown: () => void
  toggleMute: () => void
  fullscreen: () => void
  undo: () => void
  redo: () => void
  cut: () => void
  copy: () => void
  paste: () => void
  delete: () => void
  selectAll: () => void
  split: () => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  fitToScreen: () => void
  toggleFullscreen: () => void
  skipToStart: () => void
  skipToEnd: () => void
  increaseVolume: () => void
  decreaseVolume: () => void
  setPlaybackSpeed: (speed: number) => void
  addTextOverlay: () => void
  addVideoFilter: () => void
  exportVideo: () => void
  saveProject: () => void
  newProject: () => void
  openProject: () => void
  showKeyboardHelp: () => void
}

export function createVideoEditorShortcuts(callbacks: VideoEditorShortcuts): KeyboardShortcut[] {
  return [
    {
      key: ' ',
      description: 'Play/Pause',
      action: callbacks.playPause,
      category: 'Playback'
    },
    {
      key: 'ArrowRight',
      description: 'Seek Forward 5s',
      action: () => callbacks.seekForward(5),
      category: 'Playback'
    },
    {
      key: 'ArrowLeft',
      description: 'Seek Backward 5s',
      action: () => callbacks.seekBackward(5),
      category: 'Playback'
    },
    {
      key: 'ArrowUp',
      description: 'Volume Up',
      action: callbacks.volumeUp,
      category: 'Audio'
    },
    {
      key: 'ArrowDown',
      description: 'Volume Down',
      action: callbacks.volumeDown,
      category: 'Audio'
    },
    {
      key: 'm',
      description: 'Toggle Mute',
      action: callbacks.toggleMute,
      category: 'Audio'
    },
    {
      key: 'f',
      description: 'Toggle Fullscreen',
      action: callbacks.fullscreen,
      category: 'View'
    },
    {
      key: 'z',
      ctrl: true,
      description: 'Undo',
      action: callbacks.undo,
      category: 'Edit'
    },
    {
      key: 'y',
      ctrl: true,
      description: 'Redo',
      action: callbacks.redo,
      category: 'Edit'
    },
    {
      key: 'x',
      ctrl: true,
      description: 'Cut',
      action: callbacks.cut,
      category: 'Edit'
    },
    {
      key: 'c',
      ctrl: true,
      description: 'Copy',
      action: callbacks.copy,
      category: 'Edit'
    },
    {
      key: 'v',
      ctrl: true,
      description: 'Paste',
      action: callbacks.paste,
      category: 'Edit'
    },
    {
      key: 'Delete',
      description: 'Delete',
      action: callbacks.delete,
      category: 'Edit'
    },
    {
      key: 's',
      description: 'Split Clip',
      action: callbacks.split,
      category: 'Edit'
    },
    {
      key: '=',
      ctrl: true,
      description: 'Zoom In',
      action: callbacks.zoomIn,
      category: 'View'
    },
    {
      key: '-',
      ctrl: true,
      description: 'Zoom Out',
      action: callbacks.zoomOut,
      category: 'View'
    },
    {
      key: '0',
      ctrl: true,
      description: 'Reset Zoom',
      action: callbacks.resetZoom,
      category: 'View'
    }
  ]
}

// KeyboardShortcuts component disabled to prevent crashes
export default function KeyboardShortcuts({ shortcuts = [], enabled = true }: KeyboardShortcutsProps) {
  // Component disabled - keyboard shortcuts are handled by the useKeyboardShortcuts hook instead
  return null
}

export function KeyboardShortcutsHelp({ shortcuts, isOpen, onClose }: KeyboardShortcutsHelpProps) {
  if (!isOpen) return null

  // Group shortcuts by category
  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = []
    }
    acc[shortcut.category].push(shortcut)
    return acc
  }, {} as Record<string, KeyboardShortcut[]>)

  const formatKeyCombo = (shortcut: KeyboardShortcut) => {
    const parts = []
    if (shortcut.ctrl) parts.push('Ctrl')
    if (shortcut.alt) parts.push('Alt')
    if (shortcut.shift) parts.push('Shift')
    parts.push(shortcut.key.toUpperCase())
    return parts.join(' + ')
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Keyboard Shortcuts
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Master your workflow with these keyboard shortcuts
          </p>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-96">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
              <div key={category} className="space-y-3">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm uppercase tracking-wider">
                  {category}
                </h3>
                <div className="space-y-2">
                  {categoryShortcuts.map((shortcut, index) => (
                    <div key={index} className="flex items-center justify-between py-1">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {shortcut.description}
                      </span>
                      <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded text-xs font-mono">
                        {formatKeyCombo(shortcut)}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>Tip: Shortcuts work when not typing in text fields</span>
            <span>Press <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-xs">?</kbd> to show this dialog</span>
          </div>
        </div>
      </div>
    </div>
  )
}