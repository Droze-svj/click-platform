'use client'
/**
 * ThemeToggle — Animated sun/moon toggle for Click platform
 * Integrates with ThemeProvider's useTheme() hook.
 * Shows system-preference option via long-press or right-click.
 */

import { useTheme } from './ThemeProvider'
import { motion, AnimatePresence } from 'framer-motion'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useState } from 'react'

type Size = 'sm' | 'md' | 'lg'

interface ThemeToggleProps {
  size?: Size
  showLabel?: boolean
  showSystem?: boolean
  className?: string
}

const SIZE_MAP = {
  sm: { btn: 'w-8 h-8',   icon: 12 },
  md: { btn: 'w-10 h-10', icon: 14 },
  lg: { btn: 'w-12 h-12', icon: 17 },
}

export default function ThemeToggle({ size = 'md', showLabel = false, showSystem = true, className = '' }: ThemeToggleProps) {
  const { resolvedTheme, theme, setTheme, toggle, isDark } = useTheme()
  const [showMenu, setShowMenu] = useState(false)
  const s = SIZE_MAP[size]

  const MODES = [
    { id: 'dark'   as const, label: 'Dark',   icon: Moon    },
    { id: 'light'  as const, label: 'Light',  icon: Sun     },
    { id: 'system' as const, label: 'System', icon: Monitor },
  ]

  return (
    <div className={`relative ${className}`}>
      {/* Toggle button */}
      <motion.button
        whileTap={{ scale: 0.88 }}
        whileHover={{ scale: 1.05 }}
        onClick={() => { if (showSystem) setShowMenu(m => !m); else toggle() }}
        onBlur={() => setTimeout(() => setShowMenu(false), 150)}
        aria-label={`Theme: ${resolvedTheme}. Click to change.`}
        className={`${s.btn} rounded-2xl flex items-center justify-center relative overflow-hidden transition-all duration-300 ${
          isDark
            ? 'bg-white/[0.07] border border-white/[0.12] text-slate-300 hover:bg-white/[0.12] hover:text-white'
            : 'bg-black/[0.06] border border-black/[0.1]  text-slate-700 hover:bg-black/[0.1]  hover:text-black'
        }`}
      >
        {/* Glow ring on active */}
        <motion.span
          animate={{ opacity: isDark ? 0.5 : 0 }}
          className="absolute inset-0 rounded-2xl bg-indigo-500/20 pointer-events-none"
        />

        {/* Icon swap */}
        <AnimatePresence mode="wait">
          <motion.span
            key={resolvedTheme}
            initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
            animate={{ rotate: 0,   opacity: 1, scale: 1 }}
            exit={{   rotate:  90,  opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="pointer-events-none"
          >
            {resolvedTheme === 'dark'
              ? <Moon size={s.icon} className="text-indigo-300" />
              : <Sun  size={s.icon} className="text-amber-500"  />
            }
          </motion.span>
        </AnimatePresence>
      </motion.button>

      {showLabel && (
        <span className={`text-[9px] font-black uppercase tracking-widest mt-1 block text-center ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
          {resolvedTheme}
        </span>
      )}

      {/* System/Light/Dark selector menu */}
      <AnimatePresence>
        {showMenu && showSystem && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{   opacity: 0, y: -6,  scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className={`absolute right-0 top-full mt-2 py-1.5 px-1.5 rounded-2xl border shadow-xl z-[9000] min-w-[120px] flex flex-col gap-0.5 ${
              isDark ? 'bg-[#10101a] border-white/[0.1]' : 'bg-white border-black/[0.1]'
            }`}
          >
            {MODES.map(m => (
              <button
                key={m.id}
                onClick={() => { setTheme(m.id); setShowMenu(false) }}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                  theme === m.id
                    ? isDark ? 'bg-indigo-600/20 text-indigo-300' : 'bg-indigo-50 text-indigo-600'
                    : isDark ? 'text-slate-600 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-black hover:bg-black/5'
                }`}
              >
                <m.icon size={10} />
                {m.label}
                {theme === m.id && <span className={`ml-auto w-1 h-1 rounded-full ${isDark ? 'bg-indigo-400' : 'bg-indigo-600'}`} />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
