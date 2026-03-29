'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Camera, Zap, Terminal, Ghost } from 'lucide-react'

interface StylePivotsViewProps {
  currentPivot: 'imperfect' | 'chaos' | 'retro-futurism' | 'explorecore'
  onSelectPivot: (pivot: 'imperfect' | 'chaos' | 'retro-futurism' | 'explorecore') => void
}

const PIVOTS = [
  {
    id: 'imperfect',
    name: 'Imperfect by Design',
    description: 'Analog grain, handheld spontaneity, and raw authenticity.',
    icon: Camera,
    color: 'from-gray-400 to-gray-600',
    accent: 'text-gray-400',
    philosophy: 'Anti-perfection is the new luxury.'
  },
  {
    id: 'chaos',
    name: 'Chaos Packaging',
    description: 'Mixed-media collage and high-velocity sensory overload.',
    icon: Zap,
    color: 'from-fuchsia-500 to-purple-600',
    accent: 'text-fuchsia-400',
    philosophy: 'More is more. Sensory overload as a hook.'
  },
  {
    id: 'retro-futurism',
    name: 'Retro Futurism',
    description: 'Y3K chrome, silicon gradients, and high-gloss optimism.',
    icon: Terminal,
    color: 'from-cyan-400 to-blue-600',
    accent: 'text-cyan-400',
    philosophy: 'The future we were promised, rendered in 4K.'
  },
  {
    id: 'explorecore',
    name: 'Explorecore',
    description: 'Deep calming palettes and clean editorial typography.',
    icon: Ghost,
    color: 'from-emerald-500 to-teal-700',
    accent: 'text-emerald-400',
    philosophy: 'Minimalism for the overstimulated mind.'
  }
]

const StylePivotsView: React.FC<StylePivotsViewProps> = ({ currentPivot, onSelectPivot }) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-black text-white italic tracking-widest uppercase">Select Aesthetic Engine</h3>
        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black leading-tight">
          Sovereign 2026 Style Manifolds — Select to recalibrate visual DNA.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {PIVOTS.map((pivot) => {
          const Icon = pivot.icon
          const isActive = currentPivot === pivot.id

          return (
            <motion.button
              key={pivot.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelectPivot(pivot.id as any)}
              className={`group relative overflow-hidden rounded-[2rem] border transition-all duration-500 text-left ${
                isActive
                  ? 'bg-white/[0.05] border-white/20 shadow-2xl shadow-white/5'
                  : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10'
              }`}
            >
              {/* Animated Progress/Active bar */}
              {isActive && (
                <motion.div
                  layoutId="pivot-active-bar"
                  className={`absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b ${pivot.color}`}
                />
              )}

              <div className="p-6 flex items-start gap-5">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-700 ${
                  isActive ? `bg-white/10 ${pivot.accent} scale-110 rotate-3` : 'bg-white/5 text-slate-600 group-hover:bg-white/10'
                }`}>
                  <Icon className="w-6 h-6" />
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className={`text-[12px] font-black italic uppercase tracking-widest transition-colors ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'
                    }`}>
                      {pivot.name}
                    </span>
                    {isActive && (
                      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/10 text-[8px] font-black text-white italic uppercase tracking-tighter">
                        <Sparkles className="w-2.5 h-2.5" /> Deployed
                      </span>
                    )}
                  </div>
                  
                  <p className={`text-[10px] mt-1.5 font-medium leading-relaxed transition-colors ${
                    isActive ? 'text-slate-300' : 'text-slate-600 group-hover:text-slate-400'
                  }`}>
                    {pivot.description}
                  </p>

                  <div className={`mt-3 pt-3 border-t border-white/5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-2 group-hover:translate-y-0 ${isActive ? 'opacity-100 translate-y-0' : ''}`}>
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] italic">
                      {pivot.philosophy}
                    </span>
                  </div>
                </div>
              </div>

              {/* Decorative Mesh */}
              <div className={`absolute -right-4 -bottom-4 w-32 h-32 opacity-10 blur-3xl rounded-full bg-gradient-to-br ${pivot.color} pointer-events-none`} />
            </motion.button>
          )
        })}
      </div>

      <div className="p-6 rounded-[2rem] bg-indigo-500/5 border border-indigo-500/10 backdrop-blur-md">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-black text-indigo-300 italic uppercase tracking-widest">Sovereignty Tip</span>
            <p className="text-[10px] mt-1 text-indigo-300/60 leading-relaxed font-medium">
              Style Pivots affect your typography, color psychology, and cinematic pacing. The 2026 manifold adapts your Creator DNA to these high-resonance presets.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StylePivotsView
