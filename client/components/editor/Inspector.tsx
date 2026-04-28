'use client'

import React from 'react'
import { Type, Film, AlignLeft, Trash2, Lock, Unlock, X, type LucideIcon } from 'lucide-react'
import type { TextOverlay, TimelineSegment } from '../../types/editor'

/**
 * Inspector — single right-side panel that switches its body based on what
 * the user has selected in the editor. Replaces the per-view properties
 * patchwork with a consistent, keyboard-friendly surface.
 *
 * Selection routing
 * ─────────────────
 *   - A timeline segment id → ClipInspector
 *   - A text overlay id     → TextOverlayInspector
 *   - Nothing               → empty state with hints
 *
 * The Inspector is intentionally additive — existing views' properties
 * panels still work — so we can roll this out incrementally and let the
 * old surface deprecate naturally.
 */

export type InspectorSelection =
  | { kind: 'clip'; id: string }
  | { kind: 'text'; id: string }
  | { kind: 'none' }

interface Props {
  selection: InspectorSelection
  segments: TimelineSegment[]
  textOverlays: TextOverlay[]
  onUpdateSegment?: (id: string, updates: Partial<TimelineSegment>) => void
  onUpdateText?: (id: string, updates: Partial<TextOverlay>) => void
  onDeleteSegment?: (id: string) => void
  onDeleteText?: (id: string) => void
  onClose?: () => void
}

export default function Inspector({
  selection, segments, textOverlays,
  onUpdateSegment, onUpdateText, onDeleteSegment, onDeleteText, onClose,
}: Props) {
  return (
    <aside className="w-72 flex-shrink-0 bg-black/40 backdrop-blur-2xl border-l border-white/[0.06] flex flex-col">
      <header className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Inspector</h3>
        {onClose && (
          <button type="button" onClick={onClose} title="Close inspector"
            className="w-6 h-6 rounded-md text-slate-500 hover:text-white hover:bg-white/[0.06]">
            <X size={12} className="mx-auto" />
          </button>
        )}
      </header>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        {selection.kind === 'clip'
          ? <ClipInspector
              clip={segments.find(s => s.id === selection.id)}
              onUpdate={(u) => onUpdateSegment?.(selection.id, u)}
              onDelete={() => onDeleteSegment?.(selection.id)}
            />
          : selection.kind === 'text'
            ? <TextOverlayInspector
                overlay={textOverlays.find(t => t.id === selection.id)}
                onUpdate={(u) => onUpdateText?.(selection.id, u)}
                onDelete={() => onDeleteText?.(selection.id)}
              />
            : <EmptyInspector />}
      </div>
    </aside>
  )
}

// ── Clip Inspector ──────────────────────────────────────────────────────────
function ClipInspector({
  clip, onUpdate, onDelete,
}: { clip: TimelineSegment | undefined; onUpdate: (u: Partial<TimelineSegment>) => void; onDelete: () => void }) {
  if (!clip) return <EmptyInspector message="Clip not found" />
  const dur = clip.endTime - clip.startTime
  return (
    <div className="space-y-5">
      <SectionHeader icon={Film} label="Clip" hint={(clip as any).label || `Track ${(clip as any).track ?? 0}`} />
      <FieldRow label="Start" suffix="s">
        <NumberField value={clip.startTime} step={0.05} min={0}
          onChange={(v) => onUpdate({ startTime: v, endTime: v + dur, duration: dur } as any)} />
      </FieldRow>
      <FieldRow label="End" suffix="s">
        <NumberField value={clip.endTime} step={0.05} min={clip.startTime + 0.1}
          onChange={(v) => onUpdate({ endTime: v, duration: v - clip.startTime } as any)} />
      </FieldRow>
      <FieldRow label="Duration" suffix="s">
        <NumberField value={dur} step={0.05} min={0.1}
          onChange={(v) => onUpdate({ endTime: clip.startTime + v, duration: v } as any)} />
      </FieldRow>
      <FieldRow label="Speed" suffix="×">
        <NumberField value={(clip as any).playbackRate ?? 1} step={0.1} min={0.25} max={4}
          onChange={(v) => onUpdate({ playbackRate: v } as any)} />
      </FieldRow>
      <FieldRow label="Volume">
        <RangeField value={(clip as any).volume ?? 1} min={0} max={1} step={0.05}
          onChange={(v) => onUpdate({ volume: v } as any)} />
      </FieldRow>
      <FieldRow label="Locked">
        <ToggleField value={!!(clip as any).locked}
          onChange={(v) => onUpdate({ locked: v } as any)}
          onLabel={<Lock size={11} className="text-amber-300" />}
          offLabel={<Unlock size={11} className="text-slate-500" />} />
      </FieldRow>
      <DangerZone onDelete={onDelete} label="Delete clip" />
    </div>
  )
}

// ── Text Overlay Inspector ──────────────────────────────────────────────────
function TextOverlayInspector({
  overlay, onUpdate, onDelete,
}: { overlay: TextOverlay | undefined; onUpdate: (u: Partial<TextOverlay>) => void; onDelete: () => void }) {
  if (!overlay) return <EmptyInspector message="Text overlay not found" />
  return (
    <div className="space-y-5">
      <SectionHeader icon={Type} label="Text" hint={(overlay.text || '').slice(0, 24) || '—'} />
      <FieldRow label="Content" stack>
        <textarea
          value={overlay.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
          rows={2}
          aria-label="Text overlay content"
          placeholder="Caption text"
          className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-[12px] text-white focus:border-fuchsia-500/40 focus:outline-none resize-none"
        />
      </FieldRow>
      <FieldRow label="Font size" suffix="px">
        <NumberField value={overlay.fontSize} step={1} min={8} max={200}
          onChange={(v) => onUpdate({ fontSize: Math.round(v) })} />
      </FieldRow>
      <FieldRow label="Color">
        <input type="color" value={overlay.color}
          onChange={(e) => onUpdate({ color: e.target.value })}
          aria-label="Text colour"
          className="h-8 w-12 bg-transparent border border-white/10 rounded cursor-pointer" />
      </FieldRow>
      <FieldRow label="X" suffix="%">
        <NumberField value={overlay.x} step={1} min={0} max={100}
          onChange={(v) => onUpdate({ x: Math.round(v) })} />
      </FieldRow>
      <FieldRow label="Y" suffix="%">
        <NumberField value={overlay.y} step={1} min={0} max={100}
          onChange={(v) => onUpdate({ y: Math.round(v) })} />
      </FieldRow>
      <FieldRow label="Start" suffix="s">
        <NumberField value={overlay.startTime} step={0.1} min={0}
          onChange={(v) => onUpdate({ startTime: v })} />
      </FieldRow>
      <FieldRow label="End" suffix="s">
        <NumberField value={overlay.endTime} step={0.1} min={overlay.startTime + 0.1}
          onChange={(v) => onUpdate({ endTime: v })} />
      </FieldRow>
      <DangerZone onDelete={onDelete} label="Delete text" />
    </div>
  )
}

// ── Empty state ──────────────────────────────────────────────────────────────
function EmptyInspector({ message }: { message?: string } = {}) {
  return (
    <div className="text-center py-12 text-slate-500">
      <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center">
        <AlignLeft size={16} className="text-slate-600" />
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
        {message || 'Nothing selected'}
      </p>
      <p className="text-[10px] text-slate-600 mt-2 leading-relaxed max-w-[200px] mx-auto">
        Click a clip on the timeline or a caption on the canvas to edit its properties.
      </p>
    </div>
  )
}

// ── Subcomponents ───────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, label, hint }: { icon: LucideIcon; label: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b border-white/[0.06]">
      <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center flex-shrink-0">
        <Icon size={12} className="text-fuchsia-300" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black text-white uppercase tracking-[0.22em]">{label}</p>
        {hint && <p className="text-[9px] text-slate-500 truncate">{hint}</p>}
      </div>
    </div>
  )
}

function FieldRow({ label, suffix, stack, children }: { label: string; suffix?: string; stack?: boolean; children: React.ReactNode }) {
  if (stack) {
    return (
      <div className="space-y-1.5">
        <label className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-500">{label}</label>
        {children}
      </div>
    )
  }
  return (
    <div className="flex items-center gap-3">
      <label className="text-[10px] font-bold text-slate-400 w-16 flex-shrink-0">{label}</label>
      <div className="flex-1 flex items-center gap-2">
        {children}
        {suffix && <span className="text-[9px] text-slate-600">{suffix}</span>}
      </div>
    </div>
  )
}

function NumberField({ value, onChange, step, min, max, label }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; label?: string }) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      step={step}
      min={min}
      max={max}
      aria-label={label || 'Numeric value'}
      placeholder="0"
      onChange={(e) => {
        const v = parseFloat(e.target.value)
        if (Number.isFinite(v)) onChange(v)
      }}
      className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[12px] text-white text-right tabular-nums focus:border-fuchsia-500/40 focus:outline-none"
    />
  )
}

function RangeField({ value, onChange, min, max, step }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number }) {
  return (
    <div className="flex items-center gap-2 flex-1">
      <input type="range" value={value} onChange={(e) => onChange(parseFloat(e.target.value))}
        min={min} max={max} step={step}
        aria-label="value"
        className="flex-1 accent-fuchsia-500" />
      <span className="text-[10px] tabular-nums text-slate-400 w-8 text-right">{value.toFixed(2)}</span>
    </div>
  )
}

function ToggleField({ value, onChange, onLabel, offLabel }: { value: boolean; onChange: (v: boolean) => void; onLabel: React.ReactNode; offLabel: React.ReactNode }) {
  return (
    <button type="button" onClick={() => onChange(!value)} aria-pressed={value ? 'true' : 'false'}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold border transition-all ${
        value ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-white/[0.02] border-white/10 text-slate-500 hover:text-white'
      }`}>
      {value ? onLabel : offLabel}
      {value ? 'Locked' : 'Unlocked'}
    </button>
  )
}

function DangerZone({ onDelete, label }: { onDelete: () => void; label: string }) {
  return (
    <div className="pt-3 border-t border-white/[0.06]">
      <button type="button" onClick={onDelete}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-rose-500/20 bg-rose-500/[0.04] text-rose-300 text-[10px] font-bold uppercase tracking-[0.22em] hover:bg-rose-500/10 hover:border-rose-500/40">
        <Trash2 size={11} /> {label}
      </button>
    </div>
  )
}

// ── Convenience: derive selection from current editor state ─────────────────
export function deriveSelection(
  selectedSegmentId: string | null,
  selectedTextOverlayId: string | null,
): InspectorSelection {
  if (selectedTextOverlayId) return { kind: 'text', id: selectedTextOverlayId }
  if (selectedSegmentId)     return { kind: 'clip', id: selectedSegmentId }
  return { kind: 'none' }
}
