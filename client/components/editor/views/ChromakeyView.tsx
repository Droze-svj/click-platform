'use client'

import React, { useState } from 'react'
import { Pipette, Sparkles, RotateCcw } from 'lucide-react'

export interface ChromaKeySettings {
  enabled: boolean
  color: string
  tolerance: number
  spill: number
  edge: number
  opacity: number
}

const DEFAULT_CHROMA: ChromaKeySettings = {
  enabled: false,
  color: '#00ff00',
  tolerance: 40,
  spill: 50,
  edge: 25,
  opacity: 100,
}

const PRESET_COLORS = [
  { name: 'Green', hex: '#00ff00' },
  { name: 'Blue', hex: '#0000ff' },
  { name: 'Magenta', hex: '#ff00ff' },
  { name: 'Custom', hex: '' },
]

interface ChromakeyViewProps {
  chromaKey: ChromaKeySettings
  setChromaKey: (v: ChromaKeySettings | ((prev: ChromaKeySettings) => ChromaKeySettings)) => void
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

const ChromakeyView: React.FC<ChromakeyViewProps> = ({ chromaKey, setChromaKey, showToast }) => {
  const [customColor, setCustomColor] = useState(chromaKey.color)

  const setPreset = (hex: string) => {
    if (hex) {
      setChromaKey((prev) => ({ ...prev, color: hex }))
      setCustomColor(hex)
      showToast('Key color updated', 'info')
    }
  }

  const reset = () => {
    setChromaKey(DEFAULT_CHROMA)
    setCustomColor(DEFAULT_CHROMA.color)
    showToast('Chroma key reset', 'info')
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface-card rounded-xl border border-subtle p-5">
        <h3 className="text-sm font-bold text-theme-primary flex items-center gap-2 mb-4">
          <Pipette className="w-4 h-4 text-emerald-500" />
          Green screen / Chroma key
        </h3>
        <p className="text-xs text-theme-secondary mb-4">
          Remove a solid background (green, blue, or custom) so you can composite your subject over another layer. Best with even lighting.
        </p>

        <label className="flex items-center gap-3 cursor-pointer mb-4">
          <input
            type="checkbox"
            checked={chromaKey.enabled}
            onChange={(e) => setChromaKey((prev) => ({ ...prev, enabled: e.target.checked }))}
            className="rounded accent-emerald-500"
          />
          <span className="text-sm font-medium text-theme-primary">Enable chroma key</span>
        </label>

        <div className="space-y-3">
          <p className="text-[10px] font-semibold text-theme-muted uppercase tracking-wider">Key color</p>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.filter((p) => p.hex).map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => setPreset(p.hex)}
                className={`w-10 h-10 rounded-xl border-2 transition-all ${chromaKey.color.toLowerCase() === p.hex.toLowerCase() ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'border-subtle hover:border-default'}`}
                style={{ backgroundColor: p.hex }}
                title={p.name}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-theme-muted">Custom</span>
            <input
              type="color"
              value={chromaKey.color}
              onChange={(e) => { setChromaKey((prev) => ({ ...prev, color: e.target.value })); setCustomColor(e.target.value) }}
              className="w-10 h-8 rounded border border-subtle cursor-pointer"
            />
            <input
              type="text"
              value={chromaKey.color}
              onChange={(e) => { const v = e.target.value; if (/^#[0-9A-Fa-f]{6}$/.test(v)) { setChromaKey((prev) => ({ ...prev, color: v })); setCustomColor(v) } }}
              className="flex-1 px-2 py-1 rounded border border-subtle bg-surface-elevated text-theme-primary text-xs font-mono"
              placeholder="#00ff00"
            />
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-theme-muted">Tolerance</span>
              <span className="text-theme-primary font-mono">{chromaKey.tolerance}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={chromaKey.tolerance}
              onChange={(e) => setChromaKey((prev) => ({ ...prev, tolerance: Number(e.target.value) }))}
              className="w-full accent-emerald-500 h-2 rounded-full"
            />
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-theme-muted">Spill suppression</span>
              <span className="text-theme-primary font-mono">{chromaKey.spill}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={chromaKey.spill}
              onChange={(e) => setChromaKey((prev) => ({ ...prev, spill: Number(e.target.value) }))}
              className="w-full accent-emerald-500 h-2 rounded-full"
            />
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-theme-muted">Edge softness</span>
              <span className="text-theme-primary font-mono">{chromaKey.edge}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={chromaKey.edge}
              onChange={(e) => setChromaKey((prev) => ({ ...prev, edge: Number(e.target.value) }))}
              className="w-full accent-emerald-500 h-2 rounded-full"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={reset}
          className="mt-4 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-elevated border border-subtle text-theme-secondary hover:bg-surface-card-hover"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset to default
        </button>
      </div>

      <div className="bg-surface-elevated rounded-xl border border-subtle p-4">
        <p className="text-[10px] text-theme-muted flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5" />
          Tip: For best results use even green/blue lighting and avoid wrinkles in the backdrop. Export applies the key during render.
        </p>
      </div>
    </div>
  )
}

export default ChromakeyView
