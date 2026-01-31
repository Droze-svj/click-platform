'use client'

import React from 'react'
import { Filter, Type, Music } from 'lucide-react'
import { VideoFilter } from '../../types/editor'

interface EffectsViewProps {
    videoState: any
    setVideoFilters: (filters: any) => void
    setTextOverlays: (overlays: any) => void
    setActiveCategory: (cat: any) => void
    showToast: (message: string, type: 'success' | 'error' | 'info') => void
}

export const EffectsView: React.FC<EffectsViewProps> = ({
    videoState,
    setVideoFilters,
    setTextOverlays,
    setActiveCategory,
    showToast
}) => {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-6 rounded-xl border border-purple-200 dark:border-purple-700">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-purple-500 rounded-lg">
                            <Filter className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-purple-900 dark:text-purple-100">Visual Filters</h3>
                            <p className="text-sm text-purple-700 dark:text-purple-300">Enhance your video</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <button onClick={() => setActiveCategory('color')} className="w-full p-2 bg-white dark:bg-gray-800 rounded-lg text-sm hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors text-left font-medium">Brightness & Contrast</button>
                        <button onClick={() => setActiveCategory('color')} className="w-full p-2 bg-white dark:bg-gray-800 rounded-lg text-sm hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors text-left font-medium">Color Correction</button>
                        <button onClick={() => setActiveCategory('visual-fx')} className="w-full p-2 bg-white dark:bg-gray-800 rounded-lg text-sm hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors text-left font-medium">Advanced Filters</button>
                        <button
                            onClick={() => {
                                setVideoFilters((prev: any) => ({ ...prev, blur: prev.blur > 0 ? 0 : 20, sepia: prev.sepia > 0 ? 0 : 30 }))
                                showToast('Vintage filter applied', 'success')
                            }}
                            className="w-full p-2 bg-white dark:bg-gray-800 rounded-lg text-sm hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors text-left font-medium"
                        >
                            Apply Vintage Filter
                        </button>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-6 rounded-xl border border-blue-200 dark:border-blue-700">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-500 rounded-lg">
                            <Type className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-blue-900 dark:text-blue-100">Text & Titles</h3>
                            <p className="text-sm text-blue-700 dark:text-blue-300">Add overlays & captions</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <button
                            onClick={() => setTextOverlays((prev: any[]) => [...prev, {
                                id: Date.now().toString(),
                                text: 'Your Text Here',
                                x: 50,
                                y: 50,
                                fontSize: 24,
                                color: '#ffffff',
                                fontFamily: 'Arial',
                                startTime: videoState.currentTime,
                                endTime: videoState.currentTime + 5
                            }])}
                            className="w-full p-2 bg-white dark:bg-gray-800 rounded-lg text-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors font-medium"
                        >
                            Add Text Overlay
                        </button>
                        <button className="w-full p-2 bg-white dark:bg-gray-800 rounded-lg text-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors font-medium">Animated Text</button>
                        <button className="w-full p-2 bg-white dark:bg-gray-800 rounded-lg text-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors font-medium">Subtitles</button>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-6 rounded-xl border border-green-200 dark:border-green-700">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-green-500 rounded-lg">
                            <Music className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-green-900 dark:text-green-100">Audio & Music</h3>
                            <p className="text-sm text-green-700 dark:text-green-300">Enhance sound</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <button className="w-full p-2 bg-white dark:bg-gray-800 rounded-lg text-sm hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors font-medium">Background Music</button>
                        <button className="w-full p-2 bg-white dark:bg-gray-800 rounded-lg text-sm hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors font-medium">Voice Enhancement</button>
                        <button className="w-full p-2 bg-white dark:bg-gray-800 rounded-lg text-sm hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors font-medium">Audio Effects</button>
                    </div>
                </div>
            </div>
        </div>
    )
}
