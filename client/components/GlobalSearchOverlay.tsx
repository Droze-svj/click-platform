"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import AdvancedSearch from './AdvancedSearch'
import { X } from 'lucide-react'

export default function GlobalSearchOverlay() {
  const [isOpen, setIsOpen] = useState(false)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Cmd+K or Ctrl+K
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setIsOpen(prev => !prev)
    }
    // Escape to close
    if (e.key === 'Escape' && isOpen) {
      setIsOpen(false)
    }
  }, [isOpen])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] px-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-3xl bg-[#0a0a1a]/95 border border-white/10 rounded-3xl shadow-2xl shadow-blue-500/10 overflow-hidden backdrop-blur-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Neural Discovery Engine</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 px-2 py-1 bg-white/5 rounded-md border border-white/10">
                  <span className="text-[10px] font-bold text-gray-500">ESC</span>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="max-h-[70vh] overflow-hidden">
              <AdvancedSearch
                onResultSelect={() => setIsOpen(false)}
              />
            </div>

            <div className="px-6 py-3 border-t border-white/5 bg-black/40 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <kbd className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-gray-500 font-bold">↑↓</kbd>
                  <span className="text-[10px] text-gray-600 font-bold uppercase">Navigate</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <kbd className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-gray-500 font-bold">↵</kbd>
                  <span className="text-[10px] text-gray-600 font-bold uppercase">Select</span>
                </div>
              </div>
              <div className="text-[10px] text-gray-600 font-bold uppercase tracking-tighter">
                Powered by Gemini 1.5 Flash Neural Engine
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
