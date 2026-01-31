'use client'

import React from 'react'
import { Sparkles, Zap } from 'lucide-react'
import SocialAccountManager from '../../components/SocialAccountManager'
import RemixHub from '../../components/RemixHub'
import DynamicSubtitleEngine from '../../components/DynamicSubtitleEngine'
import { EditorCategory } from '../../types/editor'

interface SocialVaultViewProps {
    category: EditorCategory
    currentTime: number
    videoId?: string
    setActiveCategory: (cat: EditorCategory) => void
    showToast: (message: string, type: 'success' | 'error' | 'info') => void
}

export const SocialVaultView: React.FC<SocialVaultViewProps> = ({
    category,
    currentTime,
    videoId,
    setActiveCategory,
    showToast
}) => {
    if (category === 'accounts') {
        return (
            <div className="space-y-6">
                <SocialAccountManager />
            </div>
        )
    }

    if (category === 'remix') {
        return (
            <RemixHub onRemix={(id) => {
                showToast(`Project ${id} remixed!`, 'success');
                setActiveCategory('edit');
            }} />
        )
    }

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-8 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                    <Sparkles className="w-24 h-24" />
                </div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2 uppercase tracking-tighter">Style Intelligence</h3>
                <p className="text-xs text-gray-500 mb-8 italic">Paste a reference URL to clone its creative aesthetic.</p>

                <div className="space-y-4">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Youtube / TikTok URL..."
                            className="w-full pl-4 pr-12 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 rounded-2xl font-bold text-sm focus:border-fuchsia-500 outline-none transition-all"
                        />
                        <Zap className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-fuchsia-500 animate-pulse" />
                    </div>
                    <button className="w-full py-4 bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-fuchsia-500/20 hover:scale-[1.02] transition-all uppercase tracking-widest text-xs">
                        Analyze Reference Pacing
                    </button>
                </div>
            </div>

            <DynamicSubtitleEngine
                currentTime={currentTime}
                words={[
                    { text: 'BUILDING', start: 0, end: 1 },
                    { text: 'THE', start: 1, end: 2 },
                    { text: 'FUTURE', start: 2, end: 3 },
                    { text: 'OF', start: 3, end: 4 },
                    { text: 'CONTENT', start: 4, end: 5 }
                ]}
            />
        </div>
    )
}
