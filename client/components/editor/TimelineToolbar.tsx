'use client'

import React, { useState } from 'react'
import {
  Scissors, Trash2, Lock, Unlock, VolumeX, Volume2, Magnet, Maximize2,
  ZoomIn, ZoomOut, Copy, ClipboardPaste, Undo2, Redo2, Music, MicOff, Mic,
  Layers, Eye, EyeOff, ArrowLeftRight, Play, Square, Plus, MoreHorizontal,
  Sparkles, Wand2, Repeat, FastForward, Rewind, ChevronDown, ChevronUp
} from 'lucide-react'

export interface TimelineToolbarProps {
  // Selection
  hasSelection?: boolean
  selectedCount?: number
  // Playback / playhead
  currentTime?: number
  duration?: number
  // Track-level
  trackLocked?: boolean
  trackMuted?: boolean
  trackVisible?: boolean
  // Zoom
  zoom?: number               // 0..1
  // History
  canUndo?: boolean
  canRedo?: boolean
  // Snap
  snapToBeat?: boolean
  snapToGrid?: boolean
  rippleDelete?: boolean
  // Callbacks
  onSplit?: () => void
  onDelete?: () => void
  onRippleDelete?: () => void
  onDuplicate?: () => void
  onCopy?: () => void
  onPaste?: () => void
  onLockToggle?: () => void
  onMuteToggle?: () => void
  onVisibleToggle?: () => void
  onZoomIn?: () => void
  onZoomOut?: () => void
  onFitToContent?: () => void
  onUndo?: () => void
  onRedo?: () => void
  onSnapBeatToggle?: () => void
  onSnapGridToggle?: () => void
  onRippleDeleteToggle?: () => void
  onAddTrack?: () => void
  onJumpStart?: () => void
  onJumpEnd?: () => void
  // Fancy actions
  onAutoBeatSync?: () => void
  onAutoTranscribe?: () => void
  onMagicCut?: () => void
}

function fmt(t: number): string {
  if (!Number.isFinite(t)) return '0:00.0'
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  const ds = Math.floor((t * 10) % 10)
  return `${m}:${s.toString().padStart(2, '0')}.${ds}`
}

const btnBase =
  'inline-flex items-center justify-center transition-colors active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500/50'

const ToolButton: React.FC<React.PropsWithChildren<{
  title: string
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  variant?: 'default' | 'danger' | 'magic'
  size?: 'sm' | 'md'
}>> = ({ title, onClick, active, disabled, variant = 'default', size = 'md', children }) => {
  const dims = size === 'sm' ? 'w-8 h-8 rounded-lg' : 'w-9 h-9 rounded-xl'
  const tone =
    disabled
      ? 'bg-white/[0.02] text-slate-600 cursor-not-allowed'
      : variant === 'danger'
        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 hover:text-rose-300'
        : variant === 'magic'
          ? 'bg-gradient-to-br from-fuchsia-600 to-violet-700 text-white border border-fuchsia-400/40 hover:from-fuchsia-500 hover:to-violet-600 shadow-[0_8px_24px_rgba(217,70,239,0.25)]'
          : active
            ? 'bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/40'
            : 'bg-white/[0.03] text-slate-300 border border-white/10 hover:bg-white/[0.06] hover:text-white hover:border-white/20'
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`${btnBase} ${dims} ${tone}`}
    >
      {children}
    </button>
  )
}

const Divider = () => <div className="w-px h-6 bg-white/10 self-center" />
const GroupLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500 hidden xl:inline-block px-1">{children}</span>
)

/**
 * TimelineToolbar — practical actions for editing the timeline.
 * Drop above any timeline view; pass callbacks for whichever actions your
 * editor supports. Unbound callbacks render as disabled buttons.
 */
const TimelineToolbar: React.FC<TimelineToolbarProps> = ({
  hasSelection = false,
  selectedCount = 0,
  currentTime = 0,
  duration = 0,
  trackLocked = false,
  trackMuted = false,
  trackVisible = true,
  zoom = 0.5,
  canUndo = false,
  canRedo = false,
  snapToBeat = false,
  snapToGrid = true,
  rippleDelete = false,
  onSplit,
  onDelete,
  onRippleDelete,
  onDuplicate,
  onCopy,
  onPaste,
  onLockToggle,
  onMuteToggle,
  onVisibleToggle,
  onZoomIn,
  onZoomOut,
  onFitToContent,
  onUndo,
  onRedo,
  onSnapBeatToggle,
  onSnapGridToggle,
  onRippleDeleteToggle,
  onAddTrack,
  onJumpStart,
  onJumpEnd,
  onAutoBeatSync,
  onAutoTranscribe,
  onMagicCut,
}) => {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="w-full flex flex-col bg-[#0a0a14]/95 backdrop-blur-2xl border-y border-white/5">
      <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto custom-scrollbar">
        {/* History */}
        <GroupLabel>History</GroupLabel>
        <ToolButton title="Undo (⌘Z)"        onClick={onUndo} disabled={!canUndo}><Undo2 className="w-4 h-4" /></ToolButton>
        <ToolButton title="Redo (⌘⇧Z)"      onClick={onRedo} disabled={!canRedo}><Redo2 className="w-4 h-4" /></ToolButton>

        <Divider />

        {/* Edit on selection */}
        <GroupLabel>Edit</GroupLabel>
        <ToolButton title="Split at playhead (S)" onClick={onSplit}><Scissors className="w-4 h-4" /></ToolButton>
        <ToolButton title="Duplicate (⌘D)"        onClick={onDuplicate} disabled={!hasSelection}><Layers className="w-4 h-4" /></ToolButton>
        <ToolButton title="Copy (⌘C)"             onClick={onCopy}      disabled={!hasSelection}><Copy className="w-4 h-4" /></ToolButton>
        <ToolButton title="Paste (⌘V)"            onClick={onPaste}><ClipboardPaste className="w-4 h-4" /></ToolButton>
        <ToolButton title="Delete (⌫)"            onClick={onDelete}    disabled={!hasSelection} variant="danger"><Trash2 className="w-4 h-4" /></ToolButton>
        <ToolButton title="Ripple delete — close gap after delete" onClick={onRippleDelete} disabled={!hasSelection} variant={rippleDelete ? 'magic' : 'default'}>
          <ArrowLeftRight className="w-4 h-4" />
        </ToolButton>

        <Divider />

        {/* Snap */}
        <GroupLabel>Snap</GroupLabel>
        <ToolButton title="Snap to grid"  onClick={onSnapGridToggle} active={snapToGrid}>
          <Magnet className="w-4 h-4" />
        </ToolButton>
        <ToolButton title="Snap to beat — sync cuts to detected audio downbeats" onClick={onSnapBeatToggle} active={snapToBeat} variant={snapToBeat ? 'magic' : 'default'}>
          <Music className="w-4 h-4" />
        </ToolButton>
        <ToolButton title={rippleDelete ? 'Ripple delete: ON' : 'Ripple delete: OFF'} onClick={onRippleDeleteToggle} active={rippleDelete}>
          <Repeat className="w-4 h-4" />
        </ToolButton>

        <Divider />

        {/* Track */}
        <GroupLabel>Track</GroupLabel>
        <ToolButton title={trackLocked ? 'Unlock track' : 'Lock track'} onClick={onLockToggle} active={trackLocked} variant={trackLocked ? 'danger' : 'default'}>
          {trackLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
        </ToolButton>
        <ToolButton title={trackMuted ? 'Unmute' : 'Mute'} onClick={onMuteToggle} active={trackMuted}>
          {trackMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </ToolButton>
        <ToolButton title={trackVisible ? 'Hide track' : 'Show track'} onClick={onVisibleToggle} active={!trackVisible}>
          {trackVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </ToolButton>
        <ToolButton title="Add new track" onClick={onAddTrack}>
          <Plus className="w-4 h-4" />
        </ToolButton>

        <Divider />

        {/* Playhead jumps */}
        <GroupLabel>Playhead</GroupLabel>
        <ToolButton title="Jump to start (Home)" onClick={onJumpStart}><Rewind className="w-4 h-4" /></ToolButton>
        <ToolButton title="Jump to end (End)"    onClick={onJumpEnd}><FastForward className="w-4 h-4" /></ToolButton>

        <Divider />

        {/* Zoom */}
        <GroupLabel>Zoom</GroupLabel>
        <ToolButton title="Zoom out (⌘-)"       onClick={onZoomOut}><ZoomOut className="w-4 h-4" /></ToolButton>
        <ToolButton title="Fit to content (⌘0)"onClick={onFitToContent}><Maximize2 className="w-4 h-4" /></ToolButton>
        <ToolButton title="Zoom in (⌘+)"        onClick={onZoomIn}><ZoomIn className="w-4 h-4" /></ToolButton>

        {/* Pulled right: AI magic */}
        <div className="ml-auto flex items-center gap-1.5">
          <GroupLabel>AI</GroupLabel>
          <ToolButton title="Auto beat-sync — place cuts on detected beats" onClick={onAutoBeatSync} variant="magic"><Sparkles className="w-4 h-4" /></ToolButton>
          <ToolButton title="Magic cut — remove silence + tighten pacing" onClick={onMagicCut} variant="magic"><Wand2 className="w-4 h-4" /></ToolButton>
          <ToolButton title="Auto-transcribe (captions + chapters)"     onClick={onAutoTranscribe}><Mic className="w-4 h-4" /></ToolButton>
        </div>
      </div>

      {/* Status bar — playhead time, duration, selection, zoom */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-white/5 bg-black/40 text-[10px] font-mono text-slate-400">
        <div className="flex items-center gap-3">
          <span className="text-fuchsia-400">{fmt(currentTime)}</span>
          <span className="text-slate-600">/</span>
          <span>{fmt(duration)}</span>
          <span className="text-slate-600 ml-2">·</span>
          <span className={hasSelection ? 'text-emerald-400' : 'text-slate-500'}>
            {hasSelection ? `${selectedCount} selected` : 'no selection'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {snapToBeat && <span className="text-amber-400">⏱ beat-sync</span>}
          {rippleDelete && <span className="text-cyan-400">↔ ripple</span>}
          {trackLocked && <span className="text-rose-400">🔒 locked</span>}
          {trackMuted && <span className="text-slate-500">🔇 muted</span>}
          <span>zoom {Math.round(zoom * 100)}%</span>
        </div>
      </div>
    </div>
  )
}

export default TimelineToolbar
