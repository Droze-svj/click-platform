'use client'

import React from 'react'
import { Volume2, Music, Mic, Sliders, Waves, RefreshCw } from 'lucide-react'
import type { AudioMix, AudioEQBand } from '../../types/editor'
import { Panel, Button, Slider, SectionHeader } from '../ui'
import { cn } from '../../lib/utils'

interface AudioPanelProps {
  audio: AudioMix
  onChange: (audio: AudioMix) => void
}

const VOICE_PRESETS: { id: NonNullable<AudioMix['audioPreset']>; label: string; desc: string }[] = [
  { id: 'podcast-clean', label: 'Podcast Clean', desc: 'Balanced, broadcast-clean voice' },
  { id: 'music-forward', label: 'Music Forward', desc: 'Lighter voice, louder music' },
  { id: 'voice-boost', label: 'Voice Boost', desc: 'Compressed, punchy voice' },
  { id: 'none', label: 'Raw', desc: 'No voice processing' },
]

// Fixed EQ bands (low / mid / high) — the master parametric EQ exposed in the UI.
const EQ_BANDS: { frequency: number; label: string }[] = [
  { frequency: 100, label: 'Low' },
  { frequency: 1000, label: 'Mid' },
  { frequency: 8000, label: 'High' },
]

export default function AudioPanel({ audio, onChange }: AudioPanelProps) {
  const a = audio || {}
  const [showPro, setShowPro] = React.useState(false)
  const update = (patch: Partial<AudioMix>) => onChange({ ...a, ...patch })

  const eqGain = (frequency: number): number => {
    const band = (a.eq?.bands || []).find((b) => b.frequency === frequency)
    return band ? band.gain : 0
  }
  const setEqGain = (frequency: number, gain: number) => {
    const others = (a.eq?.bands || []).filter((b) => b.frequency !== frequency)
    const bands: AudioEQBand[] = [...others, { frequency, gain, q: 1 }].sort((x, y) => x.frequency - y.frequency)
    update({ eq: { bands } })
  }

  const musicVolPct = Math.round((a.musicVolume ?? 1) * 100)
  const duck = a.duckingAmount ?? -12

  return (
    <div className="space-y-6 ds-anim-rise">
      {/* Music + mix */}
      <Panel variant="glass" className="p-6">
        <SectionHeader
          className="mb-5"
          title={<span className="flex items-center gap-2"><Music className="h-4 w-4 text-indigo-500" aria-hidden /> Music &amp; mix</span>}
          description="How background music sits under your voice"
        />
        <div className="space-y-5">
          <Row icon={<Volume2 className="h-4 w-4" aria-hidden />} label="Music volume" value={`${musicVolPct}%`} onReset={() => update({ musicVolume: 1 })}>
            <Slider min={0} max={200} value={musicVolPct} onValueChange={(v) => update({ musicVolume: v / 100 })} title="Music volume" aria-label="Music volume" />
          </Row>
          <Row icon={<Mic className="h-4 w-4" aria-hidden />} label="Duck under voice" value={`${duck} dB`} onReset={() => update({ duckingAmount: -12 })}>
            <Slider min={-40} max={0} value={duck} onValueChange={(v) => update({ duckingAmount: v })} title="Ducking amount" aria-label="Ducking amount" />
          </Row>
          <div className="grid grid-cols-2 gap-4">
            <Row label="Fade in" value={`${(a.fadeInSec ?? 0).toFixed(1)}s`} onReset={() => update({ fadeInSec: 0 })}>
              <Slider min={0} max={10} step={0.5} value={a.fadeInSec ?? 0} onValueChange={(v) => update({ fadeInSec: v })} title="Music fade in" aria-label="Music fade in" />
            </Row>
            <Row label="Fade out" value={`${(a.fadeOutSec ?? 0).toFixed(1)}s`} onReset={() => update({ fadeOutSec: 0 })}>
              <Slider min={0} max={10} step={0.5} value={a.fadeOutSec ?? 0} onValueChange={(v) => update({ fadeOutSec: v })} title="Music fade out" aria-label="Music fade out" />
            </Row>
          </div>
        </div>
      </Panel>

      {/* Voice preset */}
      <Panel variant="glass" className="p-6">
        <SectionHeader
          className="mb-4"
          title={<span className="flex items-center gap-2"><Mic className="h-4 w-4 text-fuchsia-500" aria-hidden /> Voice character</span>}
          description="One-click voice processing"
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {VOICE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => update({ audioPreset: p.id })}
              title={p.desc}
              className={cn(
                'flex flex-col items-start rounded-xl ds-surface-subtle p-3 text-left transition-colors hover:border-fuchsia-500/40',
                a.audioPreset === p.id && 'border-fuchsia-500/60 ring-1 ring-fuchsia-500/40',
              )}
            >
              <span className="ds-text-label text-theme-primary">{p.label}</span>
              <span className="mt-0.5 text-[11px] text-theme-muted">{p.desc}</span>
            </button>
          ))}
        </div>
      </Panel>

      {/* Pro audio (EQ / compression / reverb) */}
      <Panel variant="glass" className="p-6">
        <SectionHeader
          className="mb-4"
          title={<span className="flex items-center gap-2"><Sliders className="h-4 w-4 text-emerald-500" aria-hidden /> Pro audio</span>}
          description="Parametric EQ, compression &amp; reverb"
          actions={
            <Button variant={showPro ? 'primary' : 'secondary'} size="sm" onClick={() => setShowPro((s) => !s)}>
              {showPro ? 'Hide' : 'Show'}
            </Button>
          }
        />
        {showPro && (
          <div className="space-y-6">
            <div>
              <span className="ds-text-label text-theme-secondary">Equalizer</span>
              <div className="mt-3 grid grid-cols-3 gap-4">
                {EQ_BANDS.map((b) => (
                  <Row key={b.frequency} label={b.label} value={`${eqGain(b.frequency) > 0 ? '+' : ''}${eqGain(b.frequency)} dB`} onReset={() => setEqGain(b.frequency, 0)}>
                    <Slider min={-24} max={24} value={eqGain(b.frequency)} onValueChange={(v) => setEqGain(b.frequency, v)} title={`${b.label} EQ`} aria-label={`${b.label} EQ gain`} />
                  </Row>
                ))}
              </div>
            </div>

            <ToggleSection
              label="Compression"
              icon={<Waves className="h-4 w-4" aria-hidden />}
              enabled={!!a.compression}
              onToggle={(on) => update({ compression: on ? { threshold: -18, ratio: 3 } : undefined })}
            >
              {a.compression && (
                <div className="grid grid-cols-2 gap-4">
                  <Row label="Threshold" value={`${a.compression.threshold ?? -18} dB`}>
                    <Slider min={-60} max={0} value={a.compression.threshold ?? -18} onValueChange={(v) => update({ compression: { ...a.compression, threshold: v } })} title="Compression threshold" aria-label="Compression threshold" />
                  </Row>
                  <Row label="Ratio" value={`${a.compression.ratio ?? 3}:1`}>
                    <Slider min={1} max={20} value={a.compression.ratio ?? 3} onValueChange={(v) => update({ compression: { ...a.compression, ratio: v } })} title="Compression ratio" aria-label="Compression ratio" />
                  </Row>
                </div>
              )}
            </ToggleSection>

            <ToggleSection
              label="Reverb"
              icon={<Waves className="h-4 w-4" aria-hidden />}
              enabled={!!a.reverb}
              onToggle={(on) => update({ reverb: on ? { roomSize: 0.4 } : undefined })}
            >
              {a.reverb && (
                <Row label="Room size" value={`${Math.round((a.reverb.roomSize ?? 0.4) * 100)}%`}>
                  <Slider min={0} max={100} value={Math.round((a.reverb.roomSize ?? 0.4) * 100)} onValueChange={(v) => update({ reverb: { ...a.reverb, roomSize: v / 100 } })} title="Reverb room size" aria-label="Reverb room size" />
                </Row>
              )}
            </ToggleSection>
          </div>
        )}
      </Panel>
    </div>
  )
}

function Row({ icon, label, value, onReset, children }: { icon?: React.ReactNode; label: string; value: string; onReset?: () => void; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 ds-text-label text-theme-secondary">{icon}{label}</span>
        <div className="flex items-center gap-2">
          <span className="rounded-md ds-surface-subtle px-2 py-0.5 text-xs font-semibold tabular-nums text-theme-primary">{value}</span>
          {onReset && (
            <Button variant="ghost" size="sm" onClick={onReset} title="Reset" aria-label={`Reset ${label}`} className="h-7 w-7 p-0">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            </Button>
          )}
        </div>
      </div>
      {children}
    </div>
  )
}

function ToggleSection({ label, icon, enabled, onToggle, children }: { label: string; icon: React.ReactNode; enabled: boolean; onToggle: (on: boolean) => void; children: React.ReactNode }) {
  return (
    <div className="rounded-xl ds-surface-subtle p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 ds-text-label text-theme-primary">{icon}{label}</span>
        <Button variant={enabled ? 'primary' : 'secondary'} size="sm" onClick={() => onToggle(!enabled)}>
          {enabled ? 'On' : 'Off'}
        </Button>
      </div>
      {enabled && <div className="mt-4">{children}</div>}
    </div>
  )
}
