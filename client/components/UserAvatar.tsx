'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'

interface UserAvatarProps {
  src?: string | null
  name?: string | null
  size?: number
  className?: string
  status?: 'active' | 'trial' | 'none'
}

export default function UserAvatar({ 
  src, 
  name, 
  size = 40, 
  className = '', 
  status = 'none' 
}: UserAvatarProps) {
  const initials = name?.charAt(0)?.toUpperCase() || 'U'
  
  // Deterministic unique color shift based on name
  const getUniqueShift = (str: string) => {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }
    return Math.abs(hash % 360)
  }
  
  const hueShift = name ? getUniqueShift(name) : 0
  
  // Dynamic border color based on status
  const statusColors = {
    active: 'from-emerald-400 via-teal-500 to-indigo-500',
    trial: 'from-amber-400 via-orange-500 to-rose-500',
    none: 'from-slate-400 via-slate-500 to-slate-600'
  }

  const borderGradient = statusColors[status] || statusColors.none

  return (
    <div 
      className={`relative group ${className} w-[var(--avatar-size)] h-[var(--avatar-size)]`} 
      style={{ '--avatar-size': `${size}px`, filter: `hue-rotate(${hueShift}deg)` } as any}
      title={name || 'User Avatar'}
    >
      {/* Outer Glow Ring */}
      <motion.div
        animate={{
          scale: [1, 1.05, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className={`absolute -inset-1.5 blur-md rounded-[35%] opacity-50 bg-gradient-to-tr ${borderGradient} pointer-events-none group-hover:opacity-80 transition-opacity duration-700`}
      />

      {/* Main Avatar Wrapper */}
      <div 
        className={`relative w-full h-full rounded-[30%] overflow-hidden border-[1.5px] border-white/20 bg-black/60 shadow-2xl backdrop-blur-xl group-hover:border-white/40 transition-all duration-700 p-[2px]`}
      >
        <div className={`w-full h-full rounded-[25%] overflow-hidden bg-gradient-to-br ${borderGradient} flex items-center justify-center relative`}>
          {src ? (
            <Image
              src={src}
              alt={name || 'User'}
              fill
              className="object-cover group-hover:scale-110 transition-transform duration-1000"
            />
          ) : (
            <span className="text-white font-black italic text-lg drop-shadow-md select-none">
              {initials}
            </span>
          )}
          
          {/* Internal Shimmer */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
        </div>
      </div>

      {/* Subscription Badge Ornament */}
      {status !== 'none' && (
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#020205] z-20 ${
            status === 'active' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 
            'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]'
          }`}
        />
      )}

      {/* Subtle Scanline Effect */}
      <motion.div
        animate={{ y: ['-100%', '200%'] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        className="absolute left-[10%] right-[10%] h-[1px] bg-white/20 blur-[1px] pointer-events-none z-10 opacity-30 group-hover:opacity-60"
      />
    </div>
  )
}
