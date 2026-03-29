'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'

interface AgentAvatarProps {
  agentId: string
  size?: number
  className?: string
  glowColor?: string
}

const AGENT_ASSETS: Record<string, { src: string; alt: string; color: string; accent: string }> = {
  'ora-1': { 
    src: '/images/agents/sovereign_ai_avatar_main_1774616980452.png', 
    alt: 'Oracle of Intent', 
    color: '#6366f1',
    accent: 'rgba(99, 102, 241, 0.4)'
  },
  'dna-4': { 
    src: '/images/agents/dna_weaver_avatar_1774617088934.png', 
    alt: 'Loom of Stylistic DNA', 
    color: '#a855f7',
    accent: 'rgba(168, 85, 247, 0.4)'
  },
  'vis-x': { 
    src: '/images/agents/visual_synthesizer_avatar_1774617185205.png', 
    alt: 'Spectral Forge', 
    color: '#3b82f6',
    accent: 'rgba(59, 130, 246, 0.4)'
  },
  'mon-9': { 
    src: '/images/agents/retention_critic_avatar_1774617270436.png', 
    alt: 'Arbiter of Attention', 
    color: '#f59e0b',
    accent: 'rgba(245, 158, 11, 0.4)'
  },
  'adm-0': { 
    src: '/images/agents/sovereign_ai_avatar_main_1774616980452.png', 
    alt: 'Custodian of Outcomes', 
    color: '#10b981',
    accent: 'rgba(16, 185, 129, 0.4)'
  },
}

export default function AgentAvatar({ agentId, size = 100, className = '', glowColor }: AgentAvatarProps) {
  const asset = AGENT_ASSETS[agentId] || AGENT_ASSETS['ora-1']
  const color = glowColor || asset.color
  const accent = asset.accent

  return (
    <div 
      className={`relative group ${className} w-[var(--agent-size)] h-[var(--agent-size)]`} 
      style={{ '--agent-size': `${size}px`, '--glow-color': color } as any}
      title={asset.alt}
    >
      {/* Background Pulse Glow */}
      <motion.div
        animate={{
          scale: [1, 1.25, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute inset-[-10%] blur-3xl rounded-full pointer-events-none z-0 bg-[var(--glow-color)]"
      />

      {/* Holographic Ring Inner */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
        className="absolute inset-[-5%] rounded-[3rem] border border-white/10 pointer-events-none overflow-hidden z-10"
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent blur-[1px]" />
      </motion.div>

      {/* Main Avatar Container */}
      <div className="relative w-full h-full rounded-[3rem] overflow-hidden border-[1.5px] border-white/20 bg-black/40 shadow-2xl backdrop-blur-2xl group-hover:border-white/40 transition-all duration-700 p-[3px] z-20">
        <div className="relative w-full h-full rounded-[2.8rem] overflow-hidden bg-black/60">
          <Image
            src={asset.src}
            alt={asset.alt}
            fill
            className="object-cover group-hover:scale-110 transition-transform duration-1000 grayscale-[0.2] group-hover:grayscale-0"
          />
          
          {/* Shimmer Overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
          
          {/* Holographic Scanline */}
          <motion.div
            animate={{ y: ['-100%', '300%'] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
            className="absolute left-0 right-0 h-[2px] bg-white/30 blur-[2px] pointer-events-none z-10 opacity-40"
          />
        </div>
      </div>

      {/* External Orbit / Accents */}
      <motion.div 
        animate={{ rotate: -360 }}
        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
        className="absolute -inset-4 border border-white/5 rounded-[3.5rem] pointer-events-none group-hover:scale-110 transition-transform duration-1000 z-0"
      >
        <div className="absolute top-[10%] left-[10%] w-2 h-2 rounded-full border border-white/20 bg-white/10 blur-[1px]" />
        <div className="absolute bottom-[20%] right-[15%] w-1.5 h-1.5 rounded-full border border-white/20 bg-white/5 blur-[1.5px]" />
      </motion.div>

      {/* Dynamic Agent Name Tooltip (Desktop) */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-500 pointer-events-none scale-90 group-hover:scale-100 z-30">
        <div className="px-3 py-1 bg-black/80 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] italic text-white whitespace-nowrap">{asset.alt.toUpperCase()}</p>
        </div>
      </div>
    </div>
  )
}
