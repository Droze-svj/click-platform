'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Trophy,
    Star,
    Zap,
    Target,
    Award,
    CheckCircle2,
    X,
    Sparkles
} from 'lucide-react'

interface Achievement {
    id: string
    title: string
    description: string
    icon: any
    color: string
}

const ACHIEVEMENTS: Record<string, Achievement> = {
    'first_edit': {
        id: 'first_edit',
        title: 'Precision Cutter',
        description: 'Applied your first manual split with clinical timing.',
        icon: Trophy,
        color: 'from-blue-500 to-indigo-500'
    },
    'ai_master': {
        id: 'ai_master',
        title: 'AI Visionary',
        description: 'Leveraged the Global AI Edit to master your content.',
        icon: Zap,
        color: 'from-yellow-400 to-orange-500'
    },
    'viral_potential': {
        id: 'viral_potential',
        title: 'Viral Architect',
        description: 'Hit a 90% viral probability score on a single project.',
        icon: Star,
        color: 'from-fuchsia-500 to-purple-600'
    }
}

export default function AchievementSystem() {
    const [unlocked, setUnlocked] = useState<Achievement | null>(null)

    useEffect(() => {
        // Listen for achievement events from the global bus
        const handleAchievement = (e: any) => {
            const ach = ACHIEVEMENTS[e.detail.id]
            if (ach) {
                setUnlocked(ach)
                setTimeout(() => setUnlocked(null), 5000) // Auto hide after 5s
            }
        }

        window.addEventListener('click-achievement-unlocked', handleAchievement as any)
        return () => window.removeEventListener('click-achievement-unlocked', handleAchievement as any)
    }, [])

    return (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none">
            <AnimatePresence>
                {unlocked && (
                    <motion.div
                        initial={{ opacity: 0, y: -50, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.9 }}
                        className="pointer-events-auto"
                    >
                        <div className="bg-white dark:bg-gray-900 border-2 border-white/20 rounded-3xl shadow-2xl overflow-hidden min-w-[320px] max-w-[400px]">
                            <div className={`h-2 bg-gradient-to-r ${unlocked.color}`} />
                            <div className="p-6 flex items-center gap-6">
                                <div className={`p-4 rounded-2xl bg-gradient-to-br ${unlocked.color} shadow-lg shadow-indigo-500/20 text-white relative`}>
                                    <unlocked.icon className="w-8 h-8" />
                                    <div className="absolute -top-1 -right-1">
                                        <Sparkles className="w-4 h-4 animate-spin text-white" />
                                    </div>
                                </div>

                                <div className="flex-1">
                                    <p className="text-[10px] font-black uppercase tracking-[3px] text-gray-400 mb-1">Achievement Unlocked</p>
                                    <h4 className="text-xl font-black text-gray-900 dark:text-white leading-tight mb-1">{unlocked.title}</h4>
                                    <p className="text-xs text-gray-500 font-medium">{unlocked.description}</p>
                                </div>

                                <button
                                    onClick={() => setUnlocked(null)}
                                    className="p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-full transition-colors"
                                >
                                    <X className="w-4 h-4 text-gray-400" />
                                </button>
                            </div>

                            <div className="px-6 pb-6 pt-2">
                                <div className="flex items-center justify-between text-[10px] font-bold text-gray-500 mb-2">
                                    <span>LEVEL PROGRESS</span>
                                    <span className="text-blue-500">+500 XP</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: '85%' }}
                                        className={`h-full bg-gradient-to-r ${unlocked.color}`}
                                    />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

/**
 * Utility to trigger achievement from anywhere
 */
export const triggerAchievement = (id: string) => {
    window.dispatchEvent(new CustomEvent('click-achievement-unlocked', { detail: { id } }))
}
