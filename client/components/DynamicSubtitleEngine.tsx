'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Type,
    Palette,
    Zap,
    Sparkles,
    Type as FontIcon,
    Layout
} from 'lucide-react'

interface SubtitleWord {
    text: string
    start: number
    end: number
    color?: string
}

interface SubtitlePreset {
    id: string
    name: string
    font: string
    color: string
    highlightColor: string
    animation: 'pop' | 'glow' | 'bounce'
}

const PRESETS: SubtitlePreset[] = [
    { id: 'hormozi', name: 'Viral Impact', font: 'font-black', color: 'text-white', highlightColor: 'text-yellow-400', animation: 'pop' },
    { id: 'beast', name: 'Retention Glow', font: 'font-bolditalics', color: 'text-white', highlightColor: 'text-emerald-400', animation: 'glow' },
    { id: 'minimal', name: 'Clean Studio', font: 'font-medium', color: 'text-white', highlightColor: 'text-blue-400', animation: 'bounce' }
]

export default function DynamicSubtitleEngine({ currentTime, words }: { currentTime: number, words: SubtitleWord[] }) {
    const [activePreset, setActivePreset] = useState<SubtitlePreset>(PRESETS[0])

    // Find current active word
    const activeWordIndex = words.findIndex(w => currentTime >= w.start && currentTime <= w.end)
    const currentChunk = activeWordIndex !== -1 ? words.slice(Math.max(0, activeWordIndex - 2), activeWordIndex + 3) : []

    return (
        <div className="flex flex-col gap-6">
            {/* Preset Selector */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-xl">
                <h3 className="text-sm font-black text-gray-900 dark:text-white mb-4 uppercase tracking-[2px] flex items-center gap-2">
                    <Palette className="w-4 h-4 text-indigo-500" />
                    Aesthetic Presets
                </h3>
                <div className="grid grid-cols-3 gap-3">
                    {PRESETS.map(preset => (
                        <button
                            key={preset.id}
                            onClick={() => setActivePreset(preset)}
                            className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${activePreset.id === preset.id ? 'border-indigo-500 bg-indigo-500/5' : 'border-transparent bg-gray-50 dark:bg-gray-900'}`}
                        >
                            <span className={`text-lg uppercase tracking-tighter ${preset.font} ${activePreset.id === preset.id ? 'text-indigo-500' : 'text-gray-400'}`}>Aa</span>
                            <span className="text-[9px] font-black uppercase text-gray-500">{preset.name}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Real-time Preview Engine (Visual Only) */}
            <div className="aspect-video bg-black rounded-3xl relative overflow-hidden group border-4 border-white/5">
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

                <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
                    <div className="flex flex-wrap justify-center gap-x-2 gap-y-1">
                        <AnimatePresence mode="popLayout">
                            {currentChunk.map((word, idx) => {
                                const isActive = words.indexOf(word) === activeWordIndex
                                return (
                                    <motion.span
                                        key={`${word.text}-${word.start}`}
                                        initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                        animate={{
                                            opacity: 1,
                                            scale: isActive ? 1.4 : 1,
                                            y: 0,
                                            rotate: isActive ? [-1, 1, -1] : 0
                                        }}
                                        transition={{ duration: 0.15 }}
                                        className={`text-2xl uppercase ${activePreset.font} transition-colors duration-200 ${isActive ? `${activePreset.highlightColor} drop-shadow-[0_0_15px_rgba(251,191,36,0.5)] z-10` : 'text-white opacity-40'}`}
                                    >
                                        {word.text}
                                    </motion.span>
                                )
                            })}
                        </AnimatePresence>
                    </div>
                </div>

                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
                    <p className="text-[8px] font-black text-white/50 uppercase tracking-widest flex items-center gap-2">
                        <Zap className="w-3 h-3 text-yellow-400" />
                        Real-time Subtitle Engine Active
                    </p>
                </div>
            </div>

            {/* Engine Controls */}
            <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
                    <label className="text-[10px] font-black text-gray-500 uppercase mb-2 block tracking-widest">Global Font</label>
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-900 dark:text-white uppercase">Inter Black Italics</span>
                        <FontIcon className="w-4 h-4 text-gray-400" />
                    </div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
                    <label className="text-[10px] font-black text-gray-500 uppercase mb-2 block tracking-widest">Motion Profile</label>
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-900 dark:text-white uppercase">Elastic Pop</span>
                        <Layout className="w-4 h-4 text-gray-400" />
                    </div>
                </div>
            </div>
        </div>
    )
}
