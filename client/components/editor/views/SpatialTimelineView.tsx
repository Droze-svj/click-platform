'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Layers, Box, Eye, Sliders, Download, Info,
  Cpu, Sparkles, Move3D, ZoomIn, ZoomOut, RotateCcw
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────
interface SpatialLayer {
  id: string
  name: string
  type: 'text' | 'graphic' | 'video' | 'object'
  depth: number       // –10 (far background) → +10 (close foreground)
  x: number           // % of canvas
  y: number
  opacity: number
  color: string
}

interface SpatialTimelineViewProps {
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

// ── Constants ────────────────────────────────────────────────────────────────
const glassStyle = 'backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-2xl'

const EXPORT_FORMATS = [
  { id: 'mv-hevc', label: 'MV-HEVC', desc: 'Apple Vision Pro Native', color: 'from-blue-600 to-cyan-600', badge: 'Vision Pro' },
  { id: 'sbs', label: 'SBS Stereo', desc: 'Side-by-Side for Meta Quest', color: 'from-purple-600 to-fuchsia-600', badge: 'Quest 3' },
  { id: 'monoscopic', label: 'Mono 360', desc: 'Standard 360° video', color: 'from-emerald-600 to-teal-600', badge: '360°' },
  { id: 'flat', label: 'Flat Export', desc: 'Standard 16:9 / 9:16', color: 'from-slate-600 to-gray-600', badge: 'Classic' },
]

const DEFAULT_LAYERS: SpatialLayer[] = [
  { id: 'bg', name: 'Background Scene', type: 'video', depth: -8, x: 50, y: 50, opacity: 1, color: '#6366f1' },
  { id: 'mid', name: 'Product Showcase', type: 'graphic', depth: 0, x: 50, y: 60, opacity: 1, color: '#f59e0b' },
  { id: 'text1', name: 'Headline Text', type: 'text', depth: 4, x: 50, y: 30, opacity: 1, color: '#ef4444' },
  { id: 'cta', name: 'CTA Button', type: 'graphic', depth: 7, x: 50, y: 80, opacity: 0.95, color: '#10b981' },
]

// ── Spatial Viewport (mock Vision Pro display) ───────────────────────────────
function SpatialViewport({ layers }: { layers: SpatialLayer[] }) {
  return (
    <div
      className="relative w-full rounded-[2rem] overflow-hidden border border-white/10 [background:radial-gradient(ellipse_at_50%_40%,#0f0a2e_0%,#050311_100%)] [perspective:800px] [aspect-ratio:16/9]"
    >
      {/* Spatial grid */}
      <div className="absolute inset-0 opacity-10 [background-image:linear-gradient(rgba(99,102,241,0.4)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.4)_1px,transparent_1px)] [background-size:40px_40px]" />

      {/* Vision Pro pill chrome */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full bg-black/60 border border-white/10 flex items-center gap-3 backdrop-blur-xl z-50">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[9px] font-black text-white/60 uppercase tracking-[0.4em]">Apple Vision Pro · Spatial Display</span>
      </div>

      {/* Depth-sorted layers */}
      {[...layers].sort((a, b) => a.depth - b.depth).map(layer => {
        const zScale = 1 + layer.depth * 0.025
        const zBlur = layer.depth < -4 ? Math.abs(layer.depth + 4) * 0.4 : 0
        return (
          <motion.div
            key={layer.id}
            className="absolute flex items-center justify-center"
            style={{
              left: `${layer.x}%`,
              top: `${layer.y}%`,
              transform: `translate(-50%, -50%) scale(${zScale}) translateZ(${layer.depth * 8}px)`,
              opacity: layer.opacity,
              filter: zBlur > 0 ? `blur(${zBlur}px)` : undefined,
              zIndex: Math.round(layer.depth + 10),
              '--layer-color': layer.color,
            } as React.CSSProperties}
            initial={{ opacity: 0 }}
            animate={{ opacity: layer.opacity }}
          >
            <div
              className="px-4 py-2 rounded-xl text-white text-xs font-black uppercase tracking-wider border border-white/20 [background:color-mix(in_srgb,var(--layer-color)_19%,transparent)] [box-shadow:0_0_20px_color-mix(in_srgb,var(--layer-color)_25%,transparent)] backdrop-blur-[8px]"
            >
              {layer.name}
            </div>
          </motion.div>
        )
      })}

      {/* Depth indicator axis */}
      <div className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/40 border border-white/10">
        <Move3D className="w-3 h-3 text-indigo-400" />
        <span className="text-[8px] font-black text-white/50 uppercase tracking-widest">Z-Axis Active</span>
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────
const SpatialTimelineView: React.FC<SpatialTimelineViewProps> = ({ showToast }) => {
  const [layers, setLayers] = useState<SpatialLayer[]>(DEFAULT_LAYERS)
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>('text1')
  const [selectedFormat, setSelectedFormat] = useState('mv-hevc')
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const selectedLayer = layers.find(l => l.id === selectedLayerId)

  const updateLayer = (id: string, updates: Partial<SpatialLayer>) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l))
  }

  const addLayer = () => {
    const newLayer: SpatialLayer = {
      id: `layer-${Date.now()}`,
      name: `Layer ${layers.length + 1}`,
      type: 'text',
      depth: 0,
      x: 50,
      y: 50,
      opacity: 1,
      color: '#8b5cf6',
    }
    setLayers(prev => [...prev, newLayer])
    setSelectedLayerId(newLayer.id)
    showToast('New spatial layer created', 'success')
  }

  const handleAnalyzeSpatial = async () => {
    setIsAnalyzing(true)
    showToast('Analyzing scene for optimal depth placement…', 'info')
    await new Promise(r => setTimeout(r, 2200))
    setIsAnalyzing(false)
    showToast('AI depth analysis complete — layers auto-placed', 'success')
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8 max-w-[1400px] mx-auto pb-20 px-4 py-8"
    >
      {/* Header */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-8">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-[0.5em]">
            <Box className="w-3.5 h-3.5 animate-pulse" />
            Spatial & Immersive Editor — 2026
          </div>
          <h1 className="text-6xl font-black text-white italic tracking-tighter uppercase leading-[0.9]">
            Spatial<br />Timeline
          </h1>
          <p className="text-slate-500 text-sm max-w-sm leading-relaxed">
            Place text, graphics, and objects across the <span className="text-white font-black">Z-axis</span>. Export natively for <span className="text-blue-400 font-black">Apple Vision Pro</span> and <span className="text-purple-400 font-black">Meta Quest 3</span>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleAnalyzeSpatial}
            disabled={isAnalyzing}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-50"
          >
            {isAnalyzing
              ? <><Cpu className="w-4 h-4 animate-spin" /> Analyzing…</>
              : <><Sparkles className="w-4 h-4" /> AI Depth Analysis</>
            }
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={addLayer}
            className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-white/10 transition-all"
          >
            <Layers className="w-4 h-4" /> Add Layer
          </motion.button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-8">
        {/* ── Left: Viewport + Layer Stack ── */}
        <div className="space-y-6">
          {/* Spatial Viewport */}
          <div className={`${glassStyle} rounded-[2.5rem] p-6`}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <Eye className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-black text-white uppercase tracking-wider">Spatial Preview</span>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all" title="Zoom in"><ZoomIn className="w-3.5 h-3.5 text-white/60" /></button>
                <button className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all" title="Zoom out"><ZoomOut className="w-3.5 h-3.5 text-white/60" /></button>
                <button className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all" onClick={() => setLayers(DEFAULT_LAYERS)} title="Reset layers"><RotateCcw className="w-3.5 h-3.5 text-white/60" /></button>
              </div>
            </div>
            <SpatialViewport layers={layers} />
          </div>

          {/* Layer Stack */}
          <div className={`${glassStyle} rounded-[2.5rem] p-6 space-y-4`}>
            <div className="flex items-center gap-3 mb-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-black text-white uppercase tracking-wider">Depth Layer Stack</span>
              <span className="ml-auto text-[9px] font-black text-slate-600 uppercase tracking-widest">Drag to reorder</span>
            </div>

            {[...layers].sort((a, b) => b.depth - a.depth).map(layer => (
              <motion.div
                key={layer.id}
                layout
                onClick={() => setSelectedLayerId(layer.id)}
                className={`flex items-center gap-4 px-5 py-4 rounded-2xl transition-all cursor-pointer border ${
                  selectedLayerId === layer.id
                    ? 'border-indigo-500/40 bg-indigo-500/10'
                    : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]'
                }`}
              >
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: layer.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-white uppercase truncate">{layer.name}</p>
                  <p className="text-[9px] text-slate-600 uppercase">{layer.type}</p>
                </div>
                {/* Depth badge */}
                <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${
                  layer.depth > 3 ? 'bg-blue-500/20 text-blue-400' :
                  layer.depth < -3 ? 'bg-slate-700 text-slate-500' :
                  'bg-white/5 text-slate-400'
                }`}>
                  Z: {layer.depth > 0 ? '+' : ''}{layer.depth}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Right: Properties + Export ── */}
        <div className="space-y-6">
          {/* Layer Properties */}
          <AnimatePresence mode="wait">
            {selectedLayer && (
              <motion.div
                key={selectedLayer.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`${glassStyle} rounded-[2.5rem] p-6 space-y-6`}
              >
                <div className="flex items-center gap-3">
                  <Sliders className="w-4 h-4 text-fuchsia-400" />
                  <span className="text-sm font-black text-white uppercase tracking-wider">Layer Properties</span>
                </div>

                {/* Name */}
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-2">Name</label>
                  <input
                    title="Layer name"
                    placeholder="Enter layer name"
                    className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white outline-none focus:border-indigo-500/50 transition-all"
                    value={selectedLayer.name}
                    onChange={e => updateLayer(selectedLayer.id, { name: e.target.value })}
                  />
                </div>

                {/* Z-Axis Depth Slider */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Z-Axis Depth</label>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-white/40">Background</span>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black ${
                        selectedLayer.depth > 3 ? 'bg-blue-500/20 text-blue-400' :
                        selectedLayer.depth < -3 ? 'bg-slate-700 text-slate-400' :
                        'bg-white/10 text-white'
                      }`}>
                        {selectedLayer.depth > 0 ? '+' : ''}{selectedLayer.depth}
                      </span>
                      <span className="text-[9px] font-black text-white/40">Foreground</span>
                    </div>
                  </div>
                  <input
                    type="range" min={-10} max={10} step={0.5}
                    value={selectedLayer.depth}
                    onChange={e => updateLayer(selectedLayer.id, { depth: parseFloat(e.target.value) })}
                    className="w-full accent-blue-500"
                    title="Z-axis depth"
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-[8px] text-slate-700">−10 Far</span>
                    <span className="text-[8px] text-slate-700">0 Mid</span>
                    <span className="text-[8px] text-slate-700">+10 Near</span>
                  </div>
                </div>

                {/* Opacity */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Opacity</label>
                    <span className="text-[10px] font-black text-white">{Math.round(selectedLayer.opacity * 100)}%</span>
                  </div>
                  <input
                    type="range" min={0} max={1} step={0.01}
                    value={selectedLayer.opacity}
                    onChange={e => updateLayer(selectedLayer.id, { opacity: parseFloat(e.target.value) })}
                    className="w-full accent-indigo-500"
                    title="Layer opacity"
                  />
                </div>

                {/* Color accent */}
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-2">Accent Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={selectedLayer.color}
                      onChange={e => updateLayer(selectedLayer.id, { color: e.target.value })}
                      className="w-10 h-10 rounded-xl border border-white/10 cursor-pointer bg-transparent"
                      title="Layer color"
                    />
                    <span className="text-xs font-mono text-white/40">{selectedLayer.color}</span>
                  </div>
                </div>

                {/* Info */}
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10">
                  <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Layers with <strong className="text-white">Z &gt; +5</strong> appear floating close to the viewer in Vision Pro. Layers at <strong className="text-white">Z &lt; −5</strong> recede into the depth of the scene.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Export Formats */}
          <div className={`${glassStyle} rounded-[2.5rem] p-6 space-y-4`}>
            <div className="flex items-center gap-3">
              <Download className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-black text-white uppercase tracking-wider">Spatial Export</span>
            </div>

            {EXPORT_FORMATS.map(fmt => (
              <motion.div
                key={fmt.id}
                whileHover={{ x: 4 }}
                onClick={() => setSelectedFormat(fmt.id)}
                className={`flex items-center gap-4 px-5 py-4 rounded-2xl cursor-pointer transition-all border ${
                  selectedFormat === fmt.id
                    ? 'border-indigo-500/40 bg-indigo-500/10'
                    : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]'
                }`}
              >
                <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${fmt.color} shrink-0`} />
                <div className="flex-1">
                  <p className="text-xs font-black text-white">{fmt.label}</p>
                  <p className="text-[9px] text-slate-600">{fmt.desc}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[8px] font-black bg-gradient-to-r ${fmt.color} text-white`}>
                  {fmt.badge}
                </span>
              </motion.div>
            ))}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => showToast(`Spatial export queued as ${EXPORT_FORMATS.find(f => f.id === selectedFormat)?.label}`, 'success')}
              className="w-full py-4 mt-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
            >
              <Download className="w-4 h-4" /> Export Spatial Video
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default SpatialTimelineView
