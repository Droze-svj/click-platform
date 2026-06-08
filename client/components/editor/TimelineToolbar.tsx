'use client'

import React, { useState } from 'react'
import {
  Scissors, Trash2, Lock, Unlock, VolumeX, Volume2, Magnet, Maximize2,
  ZoomIn, ZoomOut, Copy, ClipboardPaste, Undo2, Redo2, Music, MicOff, Mic,
  Layers, Eye, EyeOff, ArrowLeftRight, Play, Square, Plus, MoreHorizontal,
  Sparkles, Wand2, Repeat, FastForward, Rewind, ChevronDown, ChevronUp,
  Timer
} from 'lucide-react'
import { cn } from '../../lib/utils'

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
      ? 'ds-surface-subtle text-theme-muted cursor-not-allowed opacity-50'
      : variant === 'danger'
        ? 'bg-rose-500/10 text-rose-500 border border-rose-500/30 hover:bg-rose-500/20'
        : variant === 'magic'
          ? 'bg-primary text-primary-foreground border border-transparent hover:bg-primary/90 shadow-sm'
          : active
            ? 'bg-primary/10 text-primary border border-primary/30'
            : 'ds-surface-subtle text-theme-secondary border border-subtle hover:text-theme-primary'
  return (
    <button
     type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(btnBase, dims, tone)}
    >
      {children}
    </button>
  )
}

const Divider = () => <div className="w-px h-6 bg-border self-center" />
const GroupLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="ds-text-label text-theme-muted hidden xl:inline-block px-1">{children}</span>
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
    <div className="w-full flex flex-col ds-surface-card rounded-none border-x-0">
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
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-subtle text-[11px] font-mono text-theme-muted">
        <div className="flex items-center gap-3">
          <span className="text-primary">{fmt(currentTime)}</span>
          <span className="text-theme-muted">/</span>
          <span className="text-theme-secondary">{fmt(duration)}</span>
          <span className="text-theme-muted ml-2">·</span>
          <span className={hasSelection ? 'text-emerald-500' : 'text-theme-muted'}>
            {hasSelection ? `${selectedCount} selected` : 'no selection'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {snapToBeat && <span className="inline-flex items-center gap-1 text-amber-500"><Timer className="w-3 h-3" aria-hidden /> beat-sync</span>}
          {rippleDelete && <span className="inline-flex items-center gap-1 text-cyan-500"><ArrowLeftRight className="w-3 h-3" aria-hidden /> ripple</span>}
          {trackLocked && <span className="inline-flex items-center gap-1 text-rose-500"><Lock className="w-3 h-3" aria-hidden /> locked</span>}
          {trackMuted && <span className="inline-flex items-center gap-1 text-theme-muted"><VolumeX className="w-3 h-3" aria-hidden /> muted</span>}
          <span className="text-theme-secondary">zoom {Math.round(zoom * 100)}%</span>
        </div>
      </div>
    </div>
  )
}

export default TimelineToolbar
