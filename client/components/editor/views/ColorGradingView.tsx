'use client'

import React from 'react'
import { Palette, Sparkles, Filter, Activity, Zap, Layers, RefreshCw, CircleDot } from 'lucide-react'
import { VideoFilter } from '../../../types/editor'
import { motion, AnimatePresence } from 'framer-motion'

/** Color swatch hint for each preset (Tailwind gradient) */
const COLOR_PRESETS: { id: string; label: string; f: Partial<VideoFilter>; desc: string; swatch?: string; group: string }[] = [
  { id: 'warm', label: 'Warm', f: { saturation: 110, temperature: 115, vibrance: 108 }, desc: 'Golden hour', swatch: 'from-amber-400 to-orange-500', group: 'Atmosphere' },
  { id: 'cold', label: 'Cold', f: { saturation: 105, temperature: 85, tint: 8 }, desc: 'Cool tones', swatch: 'from-cyan-300 to-blue-600', group: 'Atmosphere' },
  { id: 'retro', label: 'Retro', f: { sepia: 35, saturation: 80, contrast: 110, vignette: 25 }, desc: 'Vintage film', swatch: 'from-amber-800 to-yellow-700', group: 'Cinematic' },
  { id: 'cinematic', label: 'Cinematic', f: { contrast: 108, saturation: 95, vignette: 35, sepia: 8 }, desc: 'Film look', swatch: 'from-amber-900/60 to-slate-800', group: 'Cinematic' },
  { id: 'teal-orange', label: 'Teal & Orange', f: { saturation: 120, temperature: 105, tint: -5, vibrance: 115 }, desc: 'Hollywood', swatch: 'from-teal-500 to-orange-500', group: 'Cinematic' },
  { id: 'cyberpunk', label: 'Cyberpunk', f: { saturation: 140, temperature: 80, tint: 25, contrast: 115, vibrance: 130 }, desc: 'Neon night', swatch: 'from-fuchsia-600 to-cyan-500', group: 'Cinematic' },
  { id: 'earthly', label: 'Earthly', f: { saturation: 90, temperature: 110, tint: -10, contrast: 105, shadows: 15 }, desc: 'Natural tones', swatch: 'from-emerald-800 to-amber-900', group: 'Atmosphere' },
  { id: 'vivid', label: 'Vivid', f: { saturation: 135, contrast: 108, vibrance: 125 }, desc: 'High pop', swatch: 'from-pink-400 via-purple-500 to-cyan-400', group: 'Vibrance' },
  { id: 'high-key', label: 'High Key', f: { brightness: 125, contrast: 90, shadows: -10, saturation: 105 }, desc: 'Bright & Airy', swatch: 'from-white to-slate-200', group: 'Stylistic' },
  { id: 'noir', label: 'Noir', f: { saturation: 0, contrast: 135, vignette: 55, brightness: 85 }, desc: 'B&W dramatic', swatch: 'from-gray-400 to-black', group: 'Stylistic' },
]

const INITIAL_FILTERS: VideoFilter = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  temperature: 100,
  vibrance: 100,
  sepia: 0,
  vignette: 0,
  tint: 0,
  shadows: 0,
  highlights: 100,
  exposure: 100,
  lift: { r: 127, g: 127, b: 127 },
  gamma: { r: 127, g: 127, b: 127 },
  gain: { r: 127, g: 127, b: 127 }
}

interface ColorGradingViewProps {
  videoFilters: VideoFilter
  setVideoFilters: (v: any) => void
  colorGradeSettings: any
  setColorGradeSettings: (v: any) => void
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-2xl"

interface ColorWheelProps {
  label: string
  desc: string
  colorClass: string
  value: { r: number; g: number; b: number }
  onChange: (v: { r: number; g: number; b: number }) => void
}

const ColorWheel: React.FC<ColorWheelProps> = ({ label, desc, colorClass, value, onChange }) => {
  const wheelRef = React.useRef<HTMLDivElement>(null)

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!wheelRef.current) return
    const rect = wheelRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    // Calculate normalized distance from center (-1 to 1)
    let dx = (clientX - centerX) / (rect.width / 2)
    let dy = (clientY - centerY) / (rect.height / 2)

    // Constrain to circle
    const distance = Math.sqrt(dx * dx + dy * dy)
    if (distance > 1) {
      dx /= distance
      dy /= distance
    }

    // Convert X/Y to color shifts (simplified: X shifts between Cyan/Red, Y between Yellow/Blue)
    // This is a common way to represent color wheels in simplified UIs
    onChange({
      r: Math.max(0, Math.min(255, 127 + dx * 127)),
      g: Math.max(0, Math.min(255, 127 + (-dx/2 - dy/2) * 127)),
      b: Math.max(0, Math.min(255, 127 + dy * 127)),
    })
  }

  // Calculate joystick position from RGB values (reverse of above)
  // Simplified: dx = (r-127)/127, dy = (b-127)/127
  const dx = (value.r - 127) / 127
  const dy = (value.b - 127) / 127

  return (
    <div className="flex flex-col items-center gap-6 group/wheel">
      <div className="text-center">
        <span className={`block text-xs font-black italic tracking-widest ${colorClass}`}>{label}</span>
        <span className="text-[9px] text-slate-600 uppercase font-bold">{desc}</span>
      </div>
      <div
        ref={wheelRef}
        onMouseDown={(e) => {
          handleMove(e)
          const onMove = (me: MouseEvent) => handleMove(me as any)
          const onUp = () => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
          }
          window.addEventListener('mousemove', onMove)
          window.addEventListener('mouseup', onUp)
        }}
        className="w-48 h-48 rounded-full bg-black/40 border border-white/5 relative flex items-center justify-center shadow-2xl overflow-hidden group-hover/wheel:border-white/10 transition-colors cursor-crosshair"
      >
        <div className="absolute inset-0 bg-[conic-gradient(from_0deg,red,yellow,lime,aqua,blue,magenta,red)] opacity-20 blur-xl" />
        <div className="w-40 h-40 rounded-full border border-white/5 relative bg-black/20">
           <motion.div
            animate={{ x: dx * 80, y: dy * 80 }}
            className="absolute top-1/2 left-1/2 w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)] border-2 border-slate-900 pointer-events-none"
           />
        </div>
        <div className="absolute bottom-4 inset-x-0 text-center">
          <span className="text-[10px] font-mono text-slate-500">R:{Math.round(value.r)} G:{Math.round(value.g)} B:{Math.round(value.b)}</span>
        </div>
      </div>
      <div className="w-full space-y-2">
          <input
            type="range" min="0" max="200"
            value={((value.r + value.g + value.b) / 3 / 127) * 100}
            onChange={(e) => {
               const factor = parseInt(e.target.value) / 100
               onChange({ r: 127 * factor, g: 127 * factor, b: 127 * factor })
            }}
            title={`Adjust ${label} Offset`}
            aria-label={`Adjust ${label} Offset`}
            className="w-full h-1 bg-white/5 rounded-full appearance-none cursor-pointer accent-white/20"
          />
          <div className="flex justify-between">
            <span className="text-[9px] text-slate-600 font-black italic">Master Balance</span>
            <span className="text-[9px] text-white font-mono">{Math.round(((value.r + value.g + value.b) / 3 / 127) * 100)}%</span>
          </div>
      </div>
    </div>
  )
}

const ColorGradingView: React.FC<ColorGradingViewProps> = ({
  videoFilters, setVideoFilters, colorGradeSettings, setColorGradeSettings, showToast
}) => {
  const [isComparing, setIsComparing] = React.useState(false)
  const [preCompareFilters, setPreCompareFilters] = React.useState<VideoFilter | null>(null)

  const toggleComparison = () => {
    if (!isComparing) {
      setPreCompareFilters({ ...videoFilters })
      setVideoFilters(INITIAL_FILTERS)
      setIsComparing(true)
      showToast('Viewing Original (No Grade)', 'info')
    } else {
      if (preCompareFilters) setVideoFilters(preCompareFilters)
      setIsComparing(false)
      setPreCompareFilters(null)
      showToast('Grade Re-applied', 'success')
    }
  }

  const applyPreset = (preset: typeof COLOR_PRESETS[0]) => {
    setVideoFilters((prev: any) => ({ ...prev, ...preset.f }))
    showToast(`${preset.label} applied`, 'success')
  }

  const sliders = [
    { key: 'brightness', label: 'Luminosity', min: 0, max: 200, reset: 100 },
    { key: 'contrast', label: 'Linear Contrast', min: 0, max: 200, reset: 100 },
    { key: 'saturation', label: 'Chroma Saturation', min: 0, max: 200, reset: 100 },
    { key: 'temperature', label: 'Kelvin Factor', min: 50, max: 150, reset: 100 },
    { key: 'vibrance', label: 'Intelligence Vibrance', min: 0, max: 200, reset: 100 },
    { key: 'vignette', label: 'Cinematic Falloff', min: 0, max: 100, reset: 0 },
  ]

  const wheels = [
    { id: 'lift', label: 'LIFT', desc: 'Shadow Control', color: 'text-indigo-400' },
    { id: 'gamma', label: 'GAMMA', desc: 'Midtone Control', color: 'text-amber-400' },
    { id: 'gain', label: 'GAIN', desc: 'Highlight Control', color: 'text-rose-400' }
  ]

  return (
    <div className="space-y-12">
      {/* Neural Chroma Presets */}
      <div className={`${glassStyle} rounded-[2.5rem] p-10 overflow-hidden relative group`}>
        <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity">
          <Palette className="w-40 h-40 text-indigo-500" />
        </div>

        <div className="flex items-center justify-between mb-12 relative z-10">
          <div className="flex items-center gap-6">
            <div className="p-4 rounded-[1.2rem] bg-indigo-500/10 border border-indigo-500/20 shadow-xl">
              <Sparkles className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-white tracking-tighter italic leading-none">CHROMA MATRIX</h2>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2 block">Premium Graded Presets</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
               onClick={toggleComparison}
               title={isComparing ? "Apply Grade" : "Compare with Original"}
               className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all text-[9px] font-black uppercase tracking-widest ${isComparing ? 'bg-amber-500 border-amber-400 text-white shadow-[0_0_15px_rgba(245,158,11,0.4)]' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}
            >
               <RefreshCw className={`w-3 h-3 ${isComparing ? 'animate-spin' : ''}`} />
               {isComparing ? 'Original Active' : 'Before / After'}
            </button>
            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 italic">Validated</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 relative z-10">
          {COLOR_PRESETS.map((p, idx) => (
            <motion.button
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => applyPreset(p)}
              title={`Apply ${p.label} Color Preset`}
              className="group relative flex flex-col items-start p-6 rounded-[1.8rem] bg-white/[0.02] border border-white/5 hover:border-indigo-500/30 hover:bg-white/[0.05] transition-all duration-500 text-left overflow-hidden"
            >
              {p.swatch && (
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${p.swatch} opacity-10 blur-3xl group-hover:opacity-20 transition-opacity`} />
              )}
              <div className="flex items-center justify-between w-full mb-4">
                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{p.group}</span>
                <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${p.swatch} shadow-[0_0_10px_rgba(255,255,255,0.2)]`} />
              </div>
              <span className="block font-black text-xl text-white italic tracking-tight group-hover:text-indigo-400 transition-colors uppercase">{p.label}</span>
              <span className="block text-[10px] text-slate-500 font-medium mt-1 uppercase tracking-widest opacity-60 italic">{p.desc}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Manual Synthesis Controls */}
      <div className={`${glassStyle} rounded-[2.5rem] p-10 overflow-hidden relative`}>
        <div className="flex items-center gap-6 mb-12">
          <div className="p-4 rounded-[1.2rem] bg-fuchsia-500/10 border border-fuchsia-500/20 shadow-xl">
            <Activity className="w-6 h-6 text-fuchsia-400" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-white tracking-tighter italic leading-none">SYNTHESIS</h2>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2 block">Linear Neural Adjustments</span>
          </div>
        </div>

        <div className="space-y-10">
          {sliders.map(({ key, label, min, max, reset }) => (
            <div key={key} className="space-y-4">
              <div className="flex justify-between items-center group/label">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/10 group-hover/label:bg-fuchsia-500 transition-colors" />
                  <span className="text-[10px] font-black text-slate-500 group-hover/label:text-white transition-colors uppercase tracking-[0.2em]">{label}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-white font-black text-xs italic tabular-nums bg-white/5 px-3 py-1 rounded-lg border border-white/5">{(videoFilters as any)[key] ?? reset}</span>
                  <button
                    onClick={() => setVideoFilters((prev: any) => ({ ...prev, [key]: reset }))}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-fuchsia-500/20 text-slate-600 hover:text-fuchsia-400 transition-all border border-transparent hover:border-fuchsia-500/20"
                    title="Reset to default"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="relative flex items-center h-6">
                <div className="absolute inset-x-0 h-1 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-fuchsia-600 to-indigo-500"
                    style={{ width: `${(((videoFilters as any)[key] ?? reset) - min) / (max - min) * 100}%` }}
                  />
                </div>
                <input
                  type="range" min={min} max={max}
                  value={(videoFilters as any)[key] ?? reset}
                  onChange={(e) => setVideoFilters((prev: any) => ({ ...prev, [key]: parseInt(e.target.value) }))}
                  title={`Adjust ${label}`}
                  aria-label={`Adjust ${label}`}
                  className="absolute inset-x-0 w-full opacity-0 cursor-pointer h-full z-10"
                />
                <motion.div
                  className="absolute w-5 h-5 bg-white rounded-full shadow-[0_0_20px_rgba(255,255,255,0.4)] pointer-events-none z-0 border-2 border-fuchsia-500"
                  style={{ left: `calc(${(((videoFilters as any)[key] ?? reset) - min) / (max - min) * 100}% - 10px)` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Neural Footer */}
        <div className="mt-12 pt-8 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Layers className="w-4 h-4 text-slate-700" />
            <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest italic">Core Layer: Multi-Pass Matrix</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest italic">Matrix Synchronized</span>
          </div>
        </div>
      </div>

      {/* Pro Color Wheels (Lift, Gamma, Gain) */}
      <div className={`${glassStyle} rounded-[2.5rem] p-10 overflow-hidden relative`}>
        <div className="flex items-center gap-6 mb-12">
          <div className="p-4 rounded-[1.2rem] bg-amber-500/10 border border-amber-500/20 shadow-xl">
            <CircleDot className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-white tracking-tighter italic leading-none">PRIMARY WHEELS</h2>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2 block">Surgical Chromatic Balance</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {wheels.map((wheel) => (
             <ColorWheel
              key={wheel.id}
              label={wheel.label}
              desc={wheel.desc}
              colorClass={wheel.color}
              value={(videoFilters as any)[wheel.id] ?? { r: 127, g: 127, b: 127 }}
              onChange={(v) => setVideoFilters((prev: any) => ({ ...prev, [wheel.id]: v }))}
             />
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-white/5 flex items-center justify-between">
           <p className="text-[10px] text-slate-500 font-medium italic max-w-md">Precision grading enabled. Move the central reticle to shift the color balance of specific luminance ranges. Master Balance adjusts global luminosity for the target range.</p>
            <button
              title="Match Color Node"
              className="px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all"
            >
              Match Node
            </button>
        </div>
      </div>
    </div>
  )
}

export default ColorGradingView
