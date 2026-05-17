/**
 * editorShortcuts.ts — single source of truth for keyboard shortcuts in
 * the Click editor. Both the active key handler and the visible
 * <ShortcutPalette /> read from this list, so adding a shortcut here
 * automatically documents it in the palette.
 */

export interface Shortcut {
  /** Display label, e.g. "Save edits" */
  label: string
  /** Group bucket for the palette UI */
  group: 'Playback' | 'Selection' | 'Editing' | 'Timeline' | 'View'
  /** Mac key combo (printed on macOS); falls back to Windows below if absent */
  mac: string
  /** Windows / Linux key combo */
  win: string
  /** Optional one-line note shown beside the combo */
  hint?: string
}

export const EDITOR_SHORTCUTS: Shortcut[] = [
  { label: 'Play / pause', group: 'Playback', mac: 'Space', win: 'Space' },
  { label: 'Step back 1 frame', group: 'Playback', mac: '←', win: '←' },
  { label: 'Step forward 1 frame', group: 'Playback', mac: '→', win: '→' },
  { label: 'Jump to start', group: 'Playback', mac: 'Home', win: 'Home' },
  { label: 'Jump to end', group: 'Playback', mac: 'End', win: 'End' },

  { label: 'Select all on track', group: 'Selection', mac: '⌘A', win: 'Ctrl+A' },
  { label: 'Deselect', group: 'Selection', mac: 'Esc', win: 'Esc' },

  { label: 'Undo', group: 'Editing', mac: '⌘Z', win: 'Ctrl+Z' },
  { label: 'Redo', group: 'Editing', mac: '⌘⇧Z', win: 'Ctrl+Shift+Z' },
  { label: 'Delete selected overlay', group: 'Editing', mac: 'Delete / Backspace', win: 'Delete / Backspace' },
  { label: 'Nudge selection 0.5%', group: 'Editing', mac: 'Arrow keys', win: 'Arrow keys' },
  { label: 'Nudge selection 5%', group: 'Editing', mac: 'Shift + Arrow', win: 'Shift + Arrow', hint: '10× the default step' },
  { label: 'Save caption edits', group: 'Editing', mac: '⌘S', win: 'Ctrl+S' },

  { label: 'Add edit at playhead', group: 'Timeline', mac: 'A', win: 'A' },
  { label: 'Split clip at playhead', group: 'Timeline', mac: '⌘K', win: 'Ctrl+K' },
  { label: 'Duplicate clip', group: 'Timeline', mac: '⌘D', win: 'Ctrl+D' },

  { label: 'Toggle preview fullscreen', group: 'View', mac: 'F', win: 'F' },
  { label: 'Show this palette', group: 'View', mac: '?', win: '?' },
]

export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPad|iPhone/i.test(navigator.platform || navigator.userAgent || '')
}
