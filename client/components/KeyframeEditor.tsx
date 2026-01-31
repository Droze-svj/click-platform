'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Plus,
  Trash2,
  Move,
  Settings2,
  Spline as SplineIcon,
  Activity
} from 'lucide-react'

interface Keyframe {
  id: string
  time: number
  value: number
  easing: 'linear' | 'ease-in' | 'ease-out' | 'bezier'
}

interface KeyframeEditorProps {
  clipId: string
  property: string
  keyframes: Keyframe[]
  onUpdate: (keyframes: Keyframe[]) => void
  duration: number
}

export default function KeyframeEditor({ clipId, property, keyframes, onUpdate, duration }: KeyframeEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const addKeyframe = (e: React.MouseEvent) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = 1 - (e.clientY - rect.top) / rect.height

    const newKeyframe: Keyframe = {
      id: `kf-${Date.now()}`,
      time: x * duration,
      value: y * 100,
      easing: 'bezier'
    }

    onUpdate([...keyframes, newKeyframe].sort((a, b) => a.time - b.time))
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 flex flex-col h-[300px]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500 rounded-lg text-white">
            <SplineIcon className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tighter">Curve Editor: {property}</p>
            <p className="text-[10px] text-gray-500 uppercase font-bold opacity-60">Manual override active</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 transition-colors">
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 bg-gray-50 dark:bg-black rounded-xl border border-gray-100 dark:border-gray-800 relative cursor-crosshair overflow-hidden"
        onDoubleClick={addKeyframe}
      >
        {/* Grid Lines */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="h-full w-[1px] bg-gray-400 absolute left-1/4" />
          <div className="h-full w-[1px] bg-gray-400 absolute left-2/4" />
          <div className="h-full w-[1px] bg-gray-400 absolute left-3/4" />
          <div className="w-full h-[1px] bg-gray-400 absolute top-1/4" />
          <div className="w-full h-[1px] bg-gray-400 absolute top-2/4" />
          <div className="w-full h-[1px] bg-gray-400 absolute top-3/4" />
        </div>

        {/* The Curve Visual (Simplified Line for now) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <polyline
            points={keyframes.map(k => `${(k.time / duration) * 100}%,${100 - k.value}%`).join(' ')}
            fill="none"
            stroke="url(#curve-gradient)"
            strokeWidth="2"
            className="transition-all duration-300"
          />
          <defs>
            <linearGradient id="curve-gradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#8B5CF6" />
            </linearGradient>
          </defs>
        </svg>

        {/* Keyframe Handles */}
        {keyframes.map(kf => (
          <motion.div
            key={kf.id}
            drag
            dragConstraints={containerRef}
            dragMomentum={false}
            onDrag={(e, info) => {
              // Logic to update time/value based on drag
            }}
            style={{
              left: `${(kf.time / duration) * 100}%`,
              top: `${100 - kf.value}%`
            }}
            className={`absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full border-2 border-white shadow-lg cursor-pointer transition-all ${selectedId === kf.id ? 'bg-blue-500 scale-125' : 'bg-gray-400 hover:bg-blue-400'}`}
            onClick={() => setSelectedId(kf.id)}
          />
        ))}

        <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
          <Activity className="w-3 h-3 text-blue-400" />
          <span className="text-[10px] font-black text-white uppercase tracking-widest">Double-click to add point</span>
        </div>
      </div>
    </div>
  )
}
