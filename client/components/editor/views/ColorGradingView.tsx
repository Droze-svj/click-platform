
import React from 'react'
import { Palette, Sparkles } from 'lucide-react'
import { VideoFilter } from '../../../types/editor'

/** Color swatch hint for each preset (Tailwind gradient) */
const COLOR_PRESETS: { id: string; label: string; f: Partial<VideoFilter>; desc: string; swatch?: string }[] = [
  { id: 'warm', label: 'Warm', f: { saturation: 110, temperature: 115, vibrance: 108 }, desc: 'Golden hour', swatch: 'from-amber-400 to-orange-500' },
  { id: 'cold', label: 'Cold', f: { saturation: 105, temperature: 85, tint: 8 }, desc: 'Cool tones', swatch: 'from-cyan-300 to-blue-600' },
  { id: 'retro', label: 'Retro', f: { sepia: 35, saturation: 80, contrast: 110, vignette: 25 }, desc: 'Vintage film', swatch: 'from-amber-800 to-yellow-700' },
  { id: 'gloom', label: 'Gloom', f: { contrast: 115, saturation: 85, vignette: 45 }, desc: 'Dark & moody', swatch: 'from-slate-700 to-slate-900' },
  { id: 'cinematic', label: 'Cinematic', f: { contrast: 108, saturation: 95, vignette: 35, sepia: 8 }, desc: 'Film look', swatch: 'from-amber-900/60 to-slate-800' },
  { id: 'teal-orange', label: 'Teal & Orange', f: { saturation: 120, temperature: 105, tint: -5, vibrance: 115 }, desc: 'Hollywood', swatch: 'from-teal-500 to-orange-500' },
  { id: 'vivid', label: 'Vivid', f: { saturation: 135, contrast: 108, vibrance: 125 }, desc: 'High pop', swatch: 'from-pink-400 via-purple-500 to-cyan-400' },
  { id: 'sunset', label: 'Sunset', f: { saturation: 120, temperature: 128, vibrance: 118, shadows: 18 }, desc: 'Golden hour', swatch: 'from-orange-400 to-rose-500' },
  { id: 'breeze', label: 'Breeze', f: { saturation: 95, temperature: 88, tint: 10, clarity: 112 }, desc: 'Cool & crisp', swatch: 'from-sky-300 to-blue-400' },
  { id: 'matte', label: 'Matte', f: { contrast: 92, saturation: 88, shadows: 28 }, desc: 'Flat & soft', swatch: 'from-gray-300 to-gray-500' },
  { id: 'neon', label: 'Neon', f: { saturation: 145, contrast: 115, vibrance: 135, hue: -12 }, desc: 'Pop colors', swatch: 'from-fuchsia-400 to-cyan-400' },
  { id: 'autumn', label: 'Autumn', f: { saturation: 118, temperature: 120, sepia: 10, vignette: 18 }, desc: 'Warm earth', swatch: 'from-amber-600 to-orange-700' },
  { id: 'winter', label: 'Winter', f: { saturation: 92, temperature: 80, tint: 12, clarity: 115 }, desc: 'Cool & clean', swatch: 'from-sky-200 to-blue-300' },
  { id: 'dreamy', label: 'Dreamy', f: { saturation: 82, contrast: 90, vibrance: 105, vignette: 38 }, desc: 'Soft pastel', swatch: 'from-rose-200 via-pink-200 to-amber-200' },
  { id: 'noir', label: 'Noir', f: { saturation: 0, contrast: 135, vignette: 55, brightness: 85 }, desc: 'B&W dramatic', swatch: 'from-gray-400 to-black' },
  { id: 'reset', label: 'Reset', f: { saturation: 100, contrast: 100, sepia: 0, vignette: 0, temperature: 100, tint: 0, vibrance: 100 }, desc: 'Default', swatch: 'from-gray-400 to-gray-600' },
]

interface ColorGradingViewProps {
  videoFilters: VideoFilter
  setVideoFilters: (v: any) => void
  colorGradeSettings: any
  setColorGradeSettings: (v: any) => void
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

const ColorGradingView: React.FC<ColorGradingViewProps> = ({
  videoFilters, setVideoFilters, colorGradeSettings, setColorGradeSettings, showToast
}) => {
  const applyPreset = (preset: typeof COLOR_PRESETS[0]) => {
    setVideoFilters((prev: any) => ({ ...prev, ...preset.f }))
    showToast(`${preset.label} applied`, 'success')
  }

  const sliders = [
    { key: 'brightness', min: 0, max: 200, reset: 100 },
    { key: 'contrast', min: 0, max: 200, reset: 100 },
    { key: 'saturation', min: 0, max: 200, reset: 100 },
    { key: 'temperature', min: 50, max: 150, reset: 100 },
    { key: 'tint', min: 80, max: 120, reset: 100 },
    { key: 'vibrance', min: 0, max: 200, reset: 100 },
    { key: 'sepia', min: 0, max: 100, reset: 0 },
    { key: 'vignette', min: 0, max: 100, reset: 0 },
    { key: 'hue', min: -30, max: 30, reset: 0 },
  ]

  const QUICK_FILTERS = [
    { id: 'vibrant', label: 'Vibrant', f: { saturation: 150, contrast: 110 } },
    { id: 'mono', label: 'Mono', f: { saturation: 0, contrast: 120 } },
    { id: 'cinematic', label: 'Cinematic', f: { sepia: 20, vignette: 30 } },
    { id: 'warm', label: 'Warm', f: { saturation: 110, temperature: 115 } },
    { id: 'cool', label: 'Cool', f: { saturation: 105, temperature: 85, tint: 5 } },
    { id: 'reset', label: 'Reset', f: { saturation: 100, contrast: 100, sepia: 0, vignette: 0, temperature: 100, tint: 0, vibrance: 100 } },
  ]

  return (
    <div className="space-y-6">
      <div className="bg-surface-card rounded-xl shadow-theme-card border border-subtle p-6">
        <h3 className="text-xs font-black uppercase text-theme-muted mb-2 tracking-widest">Quick filters (same as Edit tab)</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {QUICK_FILTERS.map((q) => (
            <button
              key={q.id}
              onClick={() => { setVideoFilters((prev: any) => ({ ...prev, ...q.f })); showToast(`${q.label} applied`, 'success') }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-surface-elevated border border-subtle text-theme-primary hover:border-default hover:bg-surface-card-hover transition-all"
            >
              {q.label}
            </button>
          ))}
        </div>
        <h3 className="text-lg font-semibold mb-4 text-theme-primary flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          Color Presets
          <span className="ml-auto text-[8px] bg-green-500 text-white px-1.5 py-0.5 rounded font-black uppercase">Pro</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {COLOR_PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => applyPreset(p)}
              className="p-4 bg-surface-elevated border border-subtle rounded-xl hover:border-default hover:bg-surface-card-hover transition-all text-left group"
            >
              {p.swatch && (
                <div className={`h-1.5 w-full rounded-full mb-2 bg-gradient-to-r ${p.swatch}`} />
              )}
              <span className="block font-bold text-xs text-theme-primary group-hover:text-purple-600 dark:group-hover:text-purple-400">{p.label}</span>
              <span className="block text-[10px] text-theme-muted mt-0.5">{p.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-surface-card rounded-xl shadow-theme-card border border-subtle p-6">
        <h3 className="text-xs font-black uppercase text-theme-muted mb-2 tracking-widest">LUT (professional color)</h3>
        <p className="text-[10px] text-theme-secondary mb-3">Apply a cinematic color look. Applied in preview and export.</p>
        <select
          value={(videoFilters as any).lutId ?? 'none'}
          onChange={(e) => setVideoFilters((prev: any) => ({ ...prev, lutId: e.target.value === 'none' ? null : e.target.value }))}
          className="w-full px-3 py-2 rounded-lg border border-subtle bg-surface-elevated text-sm text-theme-primary mb-6"
        >
          <option value="none">None</option>
          <option value="cinematic">Cinematic</option>
          <option value="bleach">Bleach Bypass</option>
          <option value="log709">Log to Rec.709</option>
        </select>

        <h3 className="text-sm font-black mb-4 uppercase text-theme-muted tracking-[3px]">Manual Controls</h3>
        <div className="space-y-4">
          {sliders.map(({ key, min, max, reset }) => (
            <div key={key} className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-theme-muted">{key}</span>
                <div className="flex items-center gap-2">
                  <span className="text-purple-500 font-bold text-xs">{(videoFilters as any)[key] ?? reset}</span>
                  <button
                    onClick={() => setVideoFilters((prev: any) => ({ ...prev, [key]: reset }))}
                    className="text-[9px] text-theme-muted hover:text-purple-500 transition-colors"
                  >
                    Reset
                  </button>
                </div>
              </div>
              <input
                type="range" min={min} max={max}
                value={(videoFilters as any)[key] ?? reset}
                onChange={(e) => setVideoFilters((prev: any) => ({ ...prev, [key]: parseInt(e.target.value) }))}
                className="w-full accent-purple-500 h-2 bg-surface-elevated rounded-full appearance-none cursor-pointer"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ColorGradingView
