'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  History,
  Zap,
  Settings2,
  ChevronRight,
  Database,
  Activity,
  Cpu,
  Sparkles,
  Target,
  FlaskConical
} from 'lucide-react'
import { StyleProfile } from '../../../types/editor'

interface StyleVaultDashboardViewProps {
  onTrainNew: () => void
  onSelectProfile: (profile: StyleProfile) => void
  profiles: StyleProfile[]
  onApplyProfile: (profile: StyleProfile) => void
}

const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.6)]"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 100, damping: 20 }
  }
}

export const StyleVaultDashboardView: React.FC<StyleVaultDashboardViewProps> = ({
  onTrainNew,
  onSelectProfile,
  profiles = [],
  onApplyProfile
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  return (
    <div className="space-y-12 max-w-[1600px] mx-auto pb-20 relative px-4 xl:px-8 pt-8 overflow-hidden">
      {/* Dynamic Background Neural Network Vibe */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none flex items-center justify-center opacity-40">
        <svg width="100%" height="100%" className="absolute inset-0">
          <pattern id="neural-mesh" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="rgba(99, 102, 241, 0.2)" />
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(99, 102, 241, 0.05)" strokeWidth="0.5" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#neural-mesh)" />
        </svg>
      </div>

      <div className="absolute top-0 right-1/4 w-[800px] h-[800px] bg-blue-600/10 blur-[180px] rounded-full opacity-60 pointer-events-none animate-pulse" />
      <motion.div
        animate={{ opacity: [0.4, 0.6, 0.4] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-0 left-1/4 w-[700px] h-[700px] bg-indigo-600/10 blur-[180px] rounded-full pointer-events-none"
      />

      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-white/10 pb-12 relative z-10"
      >
        <div className="space-y-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.4em] shadow-[0_0_20px_rgba(99,102,241,0.2)]"
          >
            <Database className="w-4 h-4 animate-spin-slow" />
            Neural DNA Repository
          </motion.div>
          <h2 className="text-[5rem] md:text-[8rem] font-black tracking-tighter italic leading-[0.85] bg-gradient-to-br from-white via-indigo-200 to-blue-500 bg-clip-text text-transparent uppercase py-2">
            STYLE<br />ARCHIVE
          </h2>
          <p className="text-slate-500 font-medium max-w-xl text-lg italic uppercase tracking-widest bg-white/5 px-4 py-1.5 rounded-lg inline-block">
            Global Creative Intelligence <span className="text-indigo-400">Sync Active</span>
          </p>
        </div>

        <div className="flex gap-4">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className={`${glassStyle} px-10 py-8 rounded-[3rem] flex items-center gap-8 group hover:border-indigo-500/40 transition-all cursor-default relative overflow-hidden`}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-indigo-500/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all shadow-xl">
              <History className="w-7 h-7" />
            </div>
            <div>
              <div className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1 italic">Efficiency Delta</div>
              <div className="text-4xl font-black text-white italic tracking-tight">+142.5h <span className="text-indigo-400 text-sm">SAVED</span></div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Grid Section */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10 relative z-10"
      >
        {/* NEW STYLE CTA */}
        <motion.button
          variants={itemVariants}
          whileHover={{ scale: 1.02, y: -8, boxShadow: '0 20px 40px rgba(99,102,241,0.1)' }}
          whileTap={{ scale: 0.98 }}
          onClick={onTrainNew}
          className={`${glassStyle} p-12 rounded-[4rem] border-white/5 border-dashed border-2 flex flex-col items-center justify-center gap-10 group hover:border-indigo-500/40 hover:bg-indigo-600/[0.02] transition-all min-h-[450px] relative overflow-hidden`}
        >
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.1)_0%,transparent_70%)]" />
          <div className="w-28 h-28 rounded-[3rem] bg-indigo-600/20 flex items-center justify-center text-indigo-400 border border-indigo-500/30 group-hover:scale-110 group-hover:rotate-12 transition-all duration-700 shadow-[0_0_50px_rgba(99,102,241,0.3)]">
            <Plus className="w-12 h-12" />
          </div>
          <div className="text-center space-y-4 relative z-10">
            <h3 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">Train<br />New DNA</h3>
            <p className="text-slate-500 text-sm font-medium tracking-wide uppercase italic opacity-60">Extract parameters from performance winners</p>
          </div>
        </motion.button>

        {/* PROFILE CARDS */}
        {profiles.map((profile, i) => (
          <motion.div
            key={profile.id}
            variants={itemVariants}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
            whileHover={{ y: -12, scale: 1.01 }}
            onClick={() => onSelectProfile(profile)}
            className={`${glassStyle} p-10 rounded-[4rem] border-white/5 overflow-hidden group cursor-pointer flex flex-col justify-between min-h-[450px] relative transition-shadow hover:shadow-[0_40px_80px_rgba(0,0,0,0.4)]`}
          >
            {/* Nebula Glow Background */}
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-1000 bg-gradient-to-br ${i % 2 === 0 ? 'from-blue-600 via-indigo-500 to-transparent' : 'from-purple-600 via-pink-500 to-transparent'}`} />

            <div className="relative z-10 space-y-10">
              <div className="flex items-start justify-between">
                <motion.div
                  animate={hoveredIndex === i ? { rotate: 360 } : {}}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  className={`w-18 h-18 w-20 h-20 rounded-[2.5rem] flex items-center justify-center border border-white/10 shadow-2xl ${i % 2 === 0 ? 'bg-blue-600/20 text-blue-400' : 'bg-purple-600/20 text-purple-400'}`}
                >
                  <Cpu className="w-10 h-10" />
                </motion.div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic opacity-60">Neural Capture</span>
                  <span className="text-white font-black text-lg italic tracking-tighter">{new Date(profile.lastTrained).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-4xl font-black text-white italic tracking-tighter uppercase whitespace-nowrap">{profile.name}</h3>
                  <div className={`h-1 flex-1 bg-gradient-to-r ${i % 2 === 0 ? 'from-blue-500 to-transparent' : 'from-purple-500 to-transparent'} opacity-30 rounded-full`} />
                </div>
                <p className="text-slate-400 text-sm leading-relaxed line-clamp-2 italic font-medium">
                  {profile.description || "Synthetically extracted visual pacing & typographic DNA for high-velocity distribution."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="p-6 rounded-[2.5rem] bg-white/5 border border-white/5 group-hover:border-indigo-500/20 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-3 h-3 text-indigo-400" />
                    <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Pacing</span>
                  </div>
                  <span className="text-xl font-black text-white italic">{profile.pacing.medianClipLength}s Cuts</span>
                </div>
                <div className="p-6 rounded-[2.5rem] bg-white/5 border border-white/5 group-hover:border-indigo-500/20 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-3 h-3 text-indigo-400" />
                    <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Design</span>
                  </div>
                  <span className="text-xl font-black text-white italic truncate">{profile.assets.fontFamily}</span>
                </div>
              </div>
            </div>

            <div className="relative z-10 pt-8 flex items-center justify-between border-t border-white/10 group-hover:border-indigo-500/30 transition-colors">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                  e.stopPropagation()
                  onApplyProfile(profile)
                }}
                className="flex items-center gap-3 group/apply px-6 py-3 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 hover:bg-white hover:text-black hover:border-white transition-all shadow-xl"
              >
                <Zap className={`w-5 h-5 ${i % 2 === 0 ? 'text-blue-400' : 'text-purple-400'} group-hover/apply:text-black group-hover/apply:animate-pulse`} />
                <span className="text-[11px] font-black uppercase tracking-widest italic">Deploy Logic</span>
              </motion.button>
              <div className="flex items-center gap-2">
                 <span className="text-[10px] font-black text-slate-600 uppercase italic opacity-0 group-hover:opacity-100 transition-opacity">Expand Matrix</span>
                 <ChevronRight className="w-8 h-8 text-slate-700 group-hover:text-white group-hover:translate-x-2 transition-all duration-300" />
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
