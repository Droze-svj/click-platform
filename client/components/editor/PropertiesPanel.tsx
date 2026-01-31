'use client'

import React from 'react'
import { Settings, X, Filter, Type, Subtitles } from 'lucide-react'
import { VideoFilter, TextOverlay, CaptionStyle, CaptionSize, CaptionLayout, CaptionTextStyle, CAPTION_FONTS, CAPTION_TEXT_STYLES } from '../../types/editor'
import { formatTime } from '../../utils/editorUtils'

const CAPTION_LAYOUTS: { id: CaptionLayout; label: string }[] = [
    { id: 'bottom-center', label: 'Bottom center' },
    { id: 'lower-third', label: 'Lower third' },
    { id: 'top-center', label: 'Top center' },
    { id: 'full-width-bottom', label: 'Full width bottom' }
]

interface PropertiesPanelProps {
    isOpen: boolean
    setIsOpen: (open: boolean) => void
    videoFilters: VideoFilter
    setVideoFilters: (filters: any) => void
    textOverlays: TextOverlay[]
    setTextOverlays: (overlays: any) => void
    captionStyle: CaptionStyle | null
    setCaptionStyle: (s: CaptionStyle | null) => void
    isOledTheme?: boolean
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
    isOpen,
    setIsOpen,
    videoFilters,
    setVideoFilters,
    textOverlays,
    setTextOverlays,
    captionStyle,
    setCaptionStyle,
    isOledTheme
}) => {
    const cap = captionStyle ?? { enabled: false, size: 'medium' as CaptionSize, font: 'Inter, sans-serif', layout: 'bottom-center' as CaptionLayout, textStyle: 'default' as CaptionTextStyle, emojisEnabled: false }
    if (!isOpen) return null

    const FilterSlider = ({ label, value, min, max, field, resetValue = 100 }: { label: string, value: number, min: number, max: number, field: keyof VideoFilter, resetValue?: number }) => (
        <div>
            <label className="block text-xs text-purple-700 dark:text-purple-300 mb-1.5 flex items-center justify-between">
                <span>{label}: {value}{field === 'hue' ? '°' : '%'}</span>
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => setVideoFilters((prev: any) => ({ ...prev, [field]: resetValue }))}
                        className="text-[10px] text-purple-500 hover:text-purple-700 dark:hover:text-purple-300 transition-colors px-1"
                    >
                        Reset
                    </button>
                    <span className="text-[10px] text-purple-500 dark:text-purple-400">● Live</span>
                </div>
            </label>
            <input
                type="range"
                min={min}
                max={max}
                value={value}
                onChange={(e) => setVideoFilters((prev: any) => ({ ...prev, [field]: parseInt(e.target.value) }))}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-full accent-purple-500 cursor-grab active:cursor-grabbing h-1.5"
            />
        </div>
    )

    return (
        <div className={`${isOledTheme ? 'bg-black/95 border-slate-800' : 'bg-white/95 dark:bg-gray-800/95 border-gray-200/50 dark:border-gray-700/50'} backdrop-blur-lg border-l flex flex-col shadow-xl flex-shrink-0 overflow-hidden transition-all duration-300`}
            style={{ width: 'clamp(280px, 20vw, 320px)' }}>
            <div className="p-2 border-b border-gray-200/50 dark:border-gray-700/50 flex items-center justify-between flex-shrink-0">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 text-sm">
                    <Settings className="w-4 h-4" />
                    Properties
                </h3>
                <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                    <X className="w-3 h-3" />
                </button>
            </div>
            <div className="flex-1 p-3 overflow-y-auto">
                <div className="space-y-4">
                    <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-3 rounded-xl border border-purple-200/50 dark:border-purple-700/50">
                        <h4 className="font-semibold mb-3 text-purple-900 dark:text-purple-100 flex items-center gap-2 text-sm">
                            <Filter className="w-4 h-4" />
                            Global Filters
                        </h4>
                        <div className="space-y-3">
                            <FilterSlider label="Brightness" value={videoFilters.brightness} min={0} max={200} field="brightness" />
                            <FilterSlider label="Contrast" value={videoFilters.contrast} min={0} max={200} field="contrast" />
                            <FilterSlider label="Saturation" value={videoFilters.saturation} min={0} max={200} field="saturation" />
                            <FilterSlider label="Hue" value={videoFilters.hue} min={-180} max={180} field="hue" resetValue={0} />
                            <FilterSlider label="Temperature" value={videoFilters.temperature} min={0} max={200} field="temperature" />
                            <FilterSlider label="Vibrance" value={videoFilters.vibrance} min={0} max={200} field="vibrance" />
                            <FilterSlider label="Clarity" value={videoFilters.clarity} min={-100} max={100} field="clarity" resetValue={0} />
                            <FilterSlider label="Dehaze" value={videoFilters.dehaze} min={-100} max={100} field="dehaze" resetValue={0} />
                            <FilterSlider label="Vignette" value={videoFilters.vignette} min={0} max={100} field="vignette" resetValue={0} />
                            <FilterSlider label="Blur" value={videoFilters.blur} min={0} max={100} field="blur" resetValue={0} />
                        </div>
                    </div>

                    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-800/20 p-4 rounded-xl border border-emerald-200/50 dark:border-emerald-700/50">
                        <h4 className="font-semibold mb-4 text-emerald-900 dark:text-emerald-100 flex items-center gap-2 text-sm">
                            <Subtitles className="w-4 h-4" />
                            Transcript captions
                        </h4>
                        <div className="space-y-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={cap.enabled}
                                    onChange={(e) => setCaptionStyle({ ...cap, enabled: e.target.checked })}
                                    className="rounded accent-emerald-500"
                                />
                                <span className="text-xs font-medium text-emerald-900 dark:text-emerald-100">Show captions</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={!!cap.emojisEnabled}
                                    onChange={(e) => setCaptionStyle({ ...cap, emojisEnabled: e.target.checked })}
                                    className="rounded accent-emerald-500"
                                />
                                <span className="text-xs font-medium text-emerald-900 dark:text-emerald-100">Matching emojis</span>
                            </label>
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 -mt-1.5">
                                Add contextually relevant emojis to captions for more engagement. Toggle off to remove.
                            </p>
                            <div>
                                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase block mb-1.5">Size</span>
                                <div className="flex gap-1.5 flex-wrap">
                                    {(['small', 'medium', 'large'] as CaptionSize[]).map((s) => (
                                        <button
                                            key={s}
                                            onClick={() => setCaptionStyle({ ...cap, size: s })}
                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${cap.size === s ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-gray-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30'}`}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase block mb-1.5">Font</span>
                                <select
                                    value={CAPTION_FONTS.find((f) => f.family === cap.font)?.id ?? 'Inter'}
                                    onChange={(e) => {
                                        const f = CAPTION_FONTS.find((x) => x.id === e.target.value)
                                        if (f) setCaptionStyle({ ...cap, font: f.family })
                                    }}
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-700 bg-white dark:bg-gray-800 text-emerald-900 dark:text-emerald-100 text-xs font-medium"
                                >
                                    {CAPTION_FONTS.map((f) => (
                                        <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase block mb-1.5">Layout</span>
                                <div className="flex flex-col gap-1">
                                    {CAPTION_LAYOUTS.map((l) => (
                                        <button
                                            key={l.id}
                                            onClick={() => setCaptionStyle({ ...cap, layout: l.id })}
                                            className={`px-2.5 py-1.5 rounded-lg text-left text-[10px] font-bold transition-all ${cap.layout === l.id ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-gray-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30'}`}
                                        >
                                            {l.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase block mb-1.5">Text style</span>
                                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mb-1.5">Word-level transcript; style applies to captions.</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {CAPTION_TEXT_STYLES.map((s) => (
                                        <button
                                            key={s.id}
                                            onClick={() => setCaptionStyle({ ...cap, textStyle: s.id })}
                                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${(cap.textStyle ?? 'default') === s.id ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-gray-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30'}`}
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {textOverlays.length > 0 && (
                        <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-4 rounded-xl border border-blue-200/50 dark:border-blue-700/50">
                            <h4 className="font-semibold mb-4 text-blue-900 dark:text-blue-100 flex items-center gap-2 text-sm">
                                <Type className="w-4 h-4" />
                                Text Overlays ({textOverlays.length})
                            </h4>
                            <div className="space-y-3">
                                {textOverlays.map(overlay => (
                                    <div key={overlay.id} className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-700">
                                        <div className="font-medium text-xs mb-1 text-blue-900 dark:text-blue-100 truncate">{overlay.text}</div>
                                        <div className="text-[10px] text-blue-700 dark:text-blue-300 mb-2">
                                            {formatTime(overlay.startTime)} - {formatTime(overlay.endTime)}
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setTextOverlays((prev: any[]) => prev.filter(o => o.id !== overlay.id))}
                                                className="text-[10px] px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
