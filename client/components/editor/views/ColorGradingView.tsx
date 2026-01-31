
import React from 'react'
import { Palette, Sparkles } from 'lucide-react'
import { VideoFilter } from '../../../types/editor'

interface ColorGradingViewProps {
    videoFilters: VideoFilter
    setVideoFilters: (v: any) => void
    colorGradeSettings: any
    setColorGradeSettings: (v: any) => void
    showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

const ColorGradingView: React.FC<ColorGradingViewProps> = ({
    videoFilters, setVideoFilters, colorGradeSettings, setColorGradeSettings, showToast
}) => {
    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-500" />
                    Color Presets
                    <span className="ml-auto text-[8px] bg-green-500 text-white px-1.5 py-0.5 rounded font-black uppercase">Elite</span>
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    {['WARM', 'COLD', 'RETRO', 'GLOOM'].map(p => (
                        <button key={p} className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl hover:border-purple-500 transition-all font-black text-[10px] uppercase tracking-widest text-gray-400">{p}</button>
                    ))}
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-sm font-black mb-4 uppercase text-gray-400 tracking-[3px]">Manual Controls</h3>
                <div className="space-y-4">
                    {['brightness', 'contrast', 'saturation'].map(f => (
                        <div key={f} className="space-y-2">
                            <div className="flex justify-between text-[10px] font-black uppercase">
                                <span className="text-gray-500">{f}</span>
                                <span className="text-purple-500">{(videoFilters as any)[f]}%</span>
                            </div>
                            <input
                                type="range" min="0" max="200"
                                value={(videoFilters as any)[f]}
                                onChange={(e) => setVideoFilters((prev: any) => ({ ...prev, [f]: parseInt(e.target.value) }))}
                                className="w-full accent-purple-500 h-1 bg-gray-100 dark:bg-gray-900 rounded-full appearance-none cursor-pointer"
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default ColorGradingView
