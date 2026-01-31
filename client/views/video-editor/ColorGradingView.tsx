'use client'

import React from 'react'
import { Sparkles, Filter } from 'lucide-react'
import FilterPresets from '../../components/FilterPresets'
import AdvancedColorGrading from '../../components/AdvancedColorGrading'
import { VideoFilter } from '../../types/editor'

interface ColorGradingViewProps {
    videoFilters: VideoFilter
    setVideoFilters: (filters: any) => void
    colorGradeSettings: any
    setColorGradeSettings: (settings: any) => void
    showToast: (message: string, type: 'success' | 'error' | 'info') => void
}

export const ColorGradingView: React.FC<ColorGradingViewProps> = ({
    videoFilters,
    setVideoFilters,
    colorGradeSettings,
    setColorGradeSettings,
    showToast
}) => {
    return (
        <div className="space-y-6">
            {/* Filter Presets */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-500" />
                    Filter Presets
                    <span className="ml-auto text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">Quick Apply</span>
                </h3>
                <FilterPresets
                    onApplyPreset={(presetFilters) => {
                        setVideoFilters((prev: any) => ({
                            ...prev,
                            ...presetFilters
                        }))
                        setColorGradeSettings((prev: any) => ({
                            ...prev,
                            ...presetFilters
                        }))
                        showToast('Filter preset applied', 'success')
                    }}
                    currentFilters={videoFilters}
                />
            </div>

            {/* Color grading info */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-6">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Advanced color grading allows you to adjust brightness, contrast, and more for each clip.
                </p>
            </div>

            {/* Advanced Color Grading */}
            <AdvancedColorGrading
                currentSettings={{
                    ...colorGradeSettings,
                    brightness: videoFilters.brightness,
                    contrast: videoFilters.contrast,
                    saturation: videoFilters.saturation,
                    hue: videoFilters.hue,
                    temperature: videoFilters.temperature,
                    tint: videoFilters.tint,
                    highlights: videoFilters.highlights,
                    shadows: videoFilters.shadows,
                    clarity: videoFilters.clarity,
                    dehaze: videoFilters.dehaze
                }}
                onSettingsChange={(newSettings) => {
                    console.log('AdvancedColorGrading: Settings changed:', newSettings)
                    setColorGradeSettings((prev: any) => ({ ...prev, ...newSettings }))
                    setVideoFilters((prev: any) => ({
                        ...prev,
                        brightness: newSettings.brightness ?? prev.brightness,
                        contrast: newSettings.contrast ?? prev.contrast,
                        saturation: newSettings.saturation ?? prev.saturation,
                        hue: newSettings.hue ?? prev.hue,
                        temperature: newSettings.temperature ?? prev.temperature,
                        tint: newSettings.tint ?? prev.tint,
                        highlights: newSettings.highlights ?? prev.highlights,
                        shadows: newSettings.shadows ?? prev.shadows,
                        clarity: newSettings.clarity ?? prev.clarity,
                        dehaze: newSettings.dehaze ?? prev.dehaze
                    }))
                    showToast('Color grading updated', 'success')
                }}
            />
        </div>
    )
}
