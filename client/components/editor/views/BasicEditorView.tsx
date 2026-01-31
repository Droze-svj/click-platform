'use client'

import React, { useState } from 'react'
import {
    Type,
    Edit3,
    Music,
    Scissors,
    Palette,
    Sparkles,
    Download,
    Cpu,
    Film,
    LayoutGrid,
} from 'lucide-react'
import { VideoFilter, TextOverlay, TemplateLayout, TEMPLATE_LAYOUTS } from '../../../types/editor'

type TextOverlayStyle = 'none' | 'neon' | 'minimal' | 'bold-kinetic' | 'outline' | 'shadow'

interface BasicEditorViewProps {
    videoFilters: VideoFilter
    setVideoFilters: (v: any) => void
    setColorGradeSettings: (v: any) => void
    setTextOverlays: (v: any) => void
    showToast: (m: string, t: 'success' | 'info' | 'error') => void
    setActiveCategory?: (category: import('../../../types/editor').EditorCategory) => void
    templateLayout?: TemplateLayout
    setTemplateLayout?: (t: TemplateLayout) => void
}

/** Preset-specific placement: x/y % (0–100), fontSize, style. Vertical layout uses lower default y. */
interface TextPresetConfig {
    label: string
    text: string
    x?: number
    y?: number
    fontSize?: number
    style?: TextOverlayStyle
    fontFamily?: string
}

const TEXT_PRESETS: TextPresetConfig[] = [
    { label: 'Title', text: 'Your Title Here', x: 50, y: 12, fontSize: 36, style: 'shadow' },
    { label: 'Subscribe', text: 'Subscribe for more', x: 50, y: 88, fontSize: 28, style: 'neon' },
    { label: 'Like & Subscribe', text: 'Like & Subscribe', x: 50, y: 85, fontSize: 26, style: 'shadow' },
    { label: 'Watch more', text: 'Watch more →', x: 50, y: 90, fontSize: 24, style: 'minimal' },
    { label: 'Comment', text: 'Comment below', x: 50, y: 92, fontSize: 22, style: 'minimal' },
    { label: 'Link in bio', text: 'Link in bio', x: 82, y: 94, fontSize: 20, style: 'outline' },
    { label: 'Caption', text: 'Add your caption', x: 50, y: 78, fontSize: 24, style: 'none' },
    { label: 'Follow', text: 'Follow for more', x: 50, y: 86, fontSize: 26, style: 'bold-kinetic' },
    { label: 'Custom', text: 'NEW TEXT', x: 50, y: 50, fontSize: 32, style: 'none' },
]

const FILTER_PRESETS = [
    { n: 'Vibrant', f: { saturation: 150, contrast: 110 }, desc: 'Punchy colors' },
    { n: 'Mono', f: { saturation: 0, contrast: 120 }, desc: 'B&W' },
    { n: 'Cinematic', f: { sepia: 20, vignette: 30 }, desc: 'Film look' },
    { n: 'Warm', f: { saturation: 110, temperature: 115 }, desc: 'Golden hour' },
    { n: 'Cool', f: { saturation: 105, temperature: 85, tint: 5 }, desc: 'Blue tones' },
    { n: 'Vintage', f: { sepia: 35, saturation: 80, contrast: 110 }, desc: 'Retro' },
    { n: 'Moody', f: { contrast: 115, saturation: 90, vignette: 40 }, desc: 'Dark & rich' },
    { n: 'Vivid', f: { saturation: 165, contrast: 108, vibrance: 120 }, desc: 'High pop' },
    { n: 'Reset', f: { saturation: 100, contrast: 100, sepia: 0, vignette: 0, temperature: 100, tint: 0, vibrance: 100 }, desc: 'Default' },
]

const QUICK_NAV = [
    { id: 'assets' as const, label: 'Music & B-Roll', icon: Music, color: 'from-indigo-500 to-purple-500' },
    { id: 'timeline' as const, label: 'Timeline', icon: Scissors, color: 'from-amber-500 to-orange-500' },
    { id: 'effects' as const, label: 'Effects', icon: Sparkles, color: 'from-violet-500 to-fuchsia-500' },
    { id: 'color' as const, label: 'Color', icon: Palette, color: 'from-pink-500 to-rose-500' },
    { id: 'ai-edit' as const, label: 'Transcribe & AI', icon: Cpu, color: 'from-fuchsia-500 to-purple-500' },
    { id: 'export' as const, label: 'Export', icon: Download, color: 'from-emerald-500 to-teal-500' },
]

/** Layout-aware y offset: vertical layouts use slightly higher y so overlays sit above typical thumb zone. */
function layoutAwareY(
    presetY: number,
    layout: TemplateLayout
): number {
    if (layout === 'vertical') return Math.max(10, Math.min(90, presetY - 4))
    if (layout === 'square') return presetY
    return presetY
}

function addOverlay(
    setTextOverlays: (fn: (prev: TextOverlay[]) => TextOverlay[]) => void,
    input: string | TextPresetConfig,
    showToast: (m: string, t: 'success' | 'info' | 'error') => void,
    templateLayout: TemplateLayout = 'standard'
) {
    const isConfig = typeof input === 'object'
    const text = isConfig ? input.text : input
    const x = (isConfig && input.x != null) ? input.x : 50
    const y = isConfig ? layoutAwareY(input.y ?? 50, templateLayout) : 50
    const fontSize = (isConfig && input.fontSize != null) ? input.fontSize : 32
    const style = (isConfig && input.style) ? input.style : 'none'
    const fontFamily = (isConfig && input.fontFamily) ? input.fontFamily : 'Inter, system-ui, sans-serif'

    setTextOverlays((prev) => [
        ...prev,
        {
            id: Date.now().toString(),
            text,
            x,
            y,
            fontSize,
            color: '#ffffff',
            fontFamily,
            startTime: 0,
            endTime: 5,
            style,
        },
    ])
    showToast('Text overlay added', 'success')
}

const BasicEditorView: React.FC<BasicEditorViewProps> = ({
    videoFilters,
    setVideoFilters,
    setColorGradeSettings,
    setTextOverlays,
    showToast,
    setActiveCategory,
    templateLayout = 'standard',
    setTemplateLayout,
}) => {
    const [textCustom, setTextCustom] = useState('')

    return (
        <div className="space-y-6 pb-4">
            {/* Template layout styles */}
            <div className="bg-white dark:bg-gray-800/80 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                    <LayoutGrid className="w-3.5 h-3.5" />
                    Template layout
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {TEMPLATE_LAYOUTS.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => {
                                setTemplateLayout?.(t.id)
                                showToast(`${t.label} (${t.desc})`, 'success')
                            }}
                            className={`p-3 rounded-xl border text-left transition-all ${
                                templateLayout === t.id
                                    ? 'bg-violet-100 dark:bg-violet-900/40 border-violet-500 dark:border-violet-400'
                                    : 'bg-gray-50 dark:bg-gray-900/80 hover:bg-gray-100 dark:hover:bg-gray-800 border-gray-200 dark:border-gray-700'
                            }`}
                        >
                            <span className="block text-xs font-bold text-gray-800 dark:text-gray-200">{t.label}</span>
                            <span className="block text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{t.desc}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Quick nav */}
            <div className="bg-white dark:bg-gray-800/80 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                    Jump to
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {QUICK_NAV.map(({ id, label, icon: Icon, color }) => (
                        <button
                            key={id}
                            onClick={() => setActiveCategory?.(id)}
                            className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900/80 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-all text-left group"
                        >
                            <div className={`p-1.5 rounded-lg bg-gradient-to-br ${color} text-white`}>
                                <Icon className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white truncate">
                                {label}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Music, Images & B-Roll */}
            <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/20 rounded-xl shadow-lg border-2 border-indigo-500/30 dark:border-indigo-400/30 p-5">
                <div className="flex items-center gap-2 mb-2">
                    <Film className="w-5 h-5 text-indigo-500" />
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">Music, Images & B-Roll</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Add background music, stock images, or B-roll clips to boost quality and engagement.
                </p>
                <button
                    onClick={() => setActiveCategory?.('assets')}
                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                    <Music className="w-4 h-4" />
                    Open Music, Images & B-Roll
                </button>
            </div>

            {/* Text Mastery */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="text-base font-bold mb-3 text-gray-900 dark:text-white flex items-center gap-2">
                    <Type className="w-5 h-5 text-blue-500" />
                    Text overlays
                </h3>
                <div className="flex flex-wrap gap-2 mb-3">
                    {TEXT_PRESETS.map((p) => (
                        <button
                            key={p.label}
                            onClick={() => addOverlay(setTextOverlays, p.text, showToast)}
                            className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-900 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500 transition-all"
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={textCustom}
                        onChange={(e) => setTextCustom(e.target.value)}
                        placeholder="Custom text…"
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                        onClick={() => {
                            const t = textCustom.trim() || 'NEW TEXT'
                            addOverlay(setTextOverlays, t, showToast)
                            setTextCustom('')
                        }}
                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center gap-1.5 shrink-0"
                    >
                        <Edit3 className="w-4 h-4" />
                        Add
                    </button>
                </div>
            </div>

            {/* Quick Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="text-base font-bold mb-3 text-gray-900 dark:text-white">Quick filters</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {FILTER_PRESETS.map((preset) => (
                        <button
                            key={preset.n}
                            onClick={() => {
                                setVideoFilters((prev: any) => ({ ...prev, ...preset.f }))
                                showToast(`${preset.n} applied`, 'success')
                            }}
                            className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900/80 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-all text-left group"
                        >
                            <span className="block text-xs font-bold text-gray-800 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white">
                                {preset.n}
                            </span>
                            <span className="block text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                                {preset.desc}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default BasicEditorView
