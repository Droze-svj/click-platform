'use client'

import React from 'react'
import { Type, Film, AlignLeft, Trash2, Lock, Unlock, X, type LucideIcon } from 'lucide-react'
import type { TextOverlay, TimelineSegment, CaptionPreset } from '../../types/editor'
import { Button, IconButton, Input, Textarea, Slider, Switch, EmptyState } from '../ui'
import { pickHighlightWords, DEFAULT_HIGHLIGHT_COLOR } from '../../lib/captions'

// Viral caption presets (mirror the render CAPTION_STYLE_MAP). The colour is the
// preset's signature fill — used as a live swatch in the picker.
const CAPTION_PRESETS: { key: CaptionPreset; label: string; color: string }[] = [
  { key: 'hook', label: 'Hook', color: '#FFD700' },
  { key: 'stat', label: 'Stat', color: '#00FFFF' },
  { key: 'question', label: 'Question', color: '#FFFFFF' },
  { key: 'punchline', label: 'Punch', color: '#FF3366' },
  { key: 'CTA', label: 'CTA', color: '#FFD700' },
  { key: 'default', label: 'Clean', color: '#FFFFFF' },
]

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
    <aside className="w-72 flex-shrink-0 ds-surface-card rounded-none border-y-0 border-r-0 flex flex-col">
      <header className="px-4 py-3 border-b border-subtle flex items-center justify-between">
        <h3 className="ds-text-label text-theme-secondary">Inspector</h3>
        {onClose && (
          <IconButton aria-label="Close inspector" size="sm" variant="ghost" onClick={onClose} title="Close inspector">
            <X size={14} />
          </IconButton>
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
        <Textarea
          value={overlay.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
          rows={2}
          aria-label="Text overlay content"
          placeholder="Caption text"
          className="min-h-0 resize-none text-[12px]"
        />
      </FieldRow>

      {/* One-click viral caption presets — live colour swatch per preset. */}
      <FieldRow label="Caption style" stack>
        <div className="grid grid-cols-3 gap-1.5">
          {CAPTION_PRESETS.map((p) => {
            const active = (overlay.captionPreset || 'default') === p.key
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => onUpdate({ captionPreset: p.key })}
                title={`${p.label} caption style`}
                aria-label={`${p.label} caption style${active ? ' (selected)' : ''}`}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                  active ? 'border-primary ds-surface-subtle text-theme-primary' : 'border-subtle text-theme-secondary hover:text-theme-primary'
                }`}
              >
                <span className="h-3 w-3 rounded-full border border-black/20 flex-shrink-0" style={{ backgroundColor: p.color }} />
                {p.label}
              </button>
            )
          })}
        </div>
      </FieldRow>

      {/* Word-by-word (karaoke) — only meaningful when word timings exist. */}
      <FieldRow label="Word-by-word">
        <Switch
          checked={overlay.captionMode === 'word'}
          onCheckedChange={(v: boolean) => onUpdate({ captionMode: v ? 'word' : 'block' })}
          aria-label="Word-by-word karaoke captions"
        />
      </FieldRow>
      {overlay.captionMode === 'word' && !(overlay.words && overlay.words.length) && (
        <p className="text-[10px] text-theme-muted -mt-3">Add auto-captions to get word timings for karaoke.</p>
      )}

      {/* Safe-zone: keep clear of the platform UI band (default on). */}
      <FieldRow label="Safe zone">
        <Switch
          checked={overlay.safeZone !== false}
          onCheckedChange={(v: boolean) => onUpdate({ safeZone: v })}
          aria-label="Keep caption inside the platform safe zone"
        />
      </FieldRow>

      {/* Keyword highlight — pops the punchy words in an accent colour (karaoke). */}
      <FieldRow label="Highlight">
        <Switch
          checked={!!(overlay.highlightWords && overlay.highlightWords.length && overlay.highlightColor)}
          onCheckedChange={(v: boolean) => onUpdate(v
            ? { highlightWords: pickHighlightWords(overlay.text || '', 2), highlightColor: overlay.highlightColor || DEFAULT_HIGHLIGHT_COLOR }
            : { highlightWords: [] })}
          aria-label="Highlight keywords in an accent colour"
        />
      </FieldRow>
      {overlay.highlightWords && overlay.highlightWords.length > 0 && (
        <FieldRow label="Accent">
          <input type="color" value={overlay.highlightColor || DEFAULT_HIGHLIGHT_COLOR}
            onChange={(e) => onUpdate({ highlightColor: e.target.value })}
            aria-label="Keyword highlight colour"
            className="h-8 w-12 bg-transparent border border-subtle rounded cursor-pointer" />
        </FieldRow>
      )}

      <FieldRow label="Font size" suffix="px">
        <NumberField value={overlay.fontSize} step={1} min={8} max={200}
          onChange={(v) => onUpdate({ fontSize: Math.round(v) })} />
      </FieldRow>
      <FieldRow label="Letter Spacing" suffix="px">
        <NumberField value={overlay.letterSpacing || 0} step={0.5} min={-5} max={20}
          onChange={(v) => onUpdate({ letterSpacing: v })} />
      </FieldRow>
      <FieldRow label="Line Height">
        <NumberField value={overlay.lineHeight || 1.2} step={0.05} min={0.5} max={3}
          onChange={(v) => onUpdate({ lineHeight: v })} />
      </FieldRow>
      <FieldRow label="Color">
        <input type="color" value={overlay.color}
          onChange={(e) => onUpdate({ color: e.target.value })}
          aria-label="Text colour"
          className="h-8 w-12 bg-transparent border border-subtle rounded cursor-pointer" />
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
    <EmptyState
      icon={AlignLeft}
      title={message || 'Nothing selected'}
      description="Click a clip on the timeline or a caption on the canvas to edit its properties."
      className="py-12"
    />
  )
}

// ── Subcomponents ───────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, label, hint }: { icon: LucideIcon; label: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b border-subtle">
      <div className="w-7 h-7 rounded-lg ds-surface-subtle flex items-center justify-center flex-shrink-0">
        <Icon size={12} className="text-theme-primary" />
      </div>
      <div className="min-w-0">
        <p className="ds-text-label text-theme-primary">{label}</p>
        {hint && <p className="text-[11px] text-theme-muted truncate">{hint}</p>}
      </div>
    </div>
  )
}

function FieldRow({ label, suffix, stack, children }: { label: string; suffix?: string; stack?: boolean; children: React.ReactNode }) {
  if (stack) {
    return (
      <div className="space-y-1.5">
        <label className="ds-text-label text-theme-muted">{label}</label>
        {children}
      </div>
    )
  }
  return (
    <div className="flex items-center gap-3">
      <label className="text-[11px] font-medium text-theme-secondary w-16 flex-shrink-0">{label}</label>
      <div className="flex-1 flex items-center gap-2">
        {children}
        {suffix && <span className="text-[11px] text-theme-muted">{suffix}</span>}
      </div>
    </div>
  )
}

function NumberField({ value, onChange, step, min, max, label }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; label?: string }) {
  return (
    <Input
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
      className="h-9 px-2 py-1.5 text-[12px] text-right tabular-nums"
    />
  )
}

function RangeField({ value, onChange, min, max, step }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number }) {
  return (
    <div className="flex items-center gap-2 flex-1">
      <Slider value={value} onValueChange={onChange}
        min={min} max={max} step={step}
        aria-label="value"
        className="flex-1" />
      <span className="text-[11px] tabular-nums text-theme-secondary w-8 text-right">{value.toFixed(2)}</span>
    </div>
  )
}

function ToggleField({ value, onChange, onLabel, offLabel }: { value: boolean; onChange: (v: boolean) => void; onLabel: React.ReactNode; offLabel: React.ReactNode }) {
  const ariaProps = { 'aria-pressed': value }
  return (
    <button type="button" onClick={() => onChange(!value)} {...ariaProps}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
        value ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'ds-surface-subtle text-theme-muted hover:text-theme-primary'
      }`}>
      {value ? onLabel : offLabel}
      {value ? 'Locked' : 'Unlocked'}
    </button>
  )
}

function DangerZone({ onDelete, label }: { onDelete: () => void; label: string }) {
  return (
    <div className="pt-3 border-t border-subtle">
      <Button type="button" variant="destructive" onClick={onDelete} leftIcon={<Trash2 size={14} />} className="w-full">
        {label}
      </Button>
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
