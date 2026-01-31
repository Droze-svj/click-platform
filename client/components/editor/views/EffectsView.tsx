
import React from 'react'
import { Zap, Sparkles, Filter, Type, Music } from 'lucide-react'
import { EditorCategory } from '../../../types/editor'

interface EffectsViewProps {
    videoState: any
    setVideoFilters: (v: any) => void
    setTextOverlays: (v: any) => void
    setActiveCategory: (v: EditorCategory) => void
    showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

const EffectsView: React.FC<EffectsViewProps> = ({
    videoState, setVideoFilters, setTextOverlays, setActiveCategory, showToast
}) => {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {[
                    { id: 'color', label: 'Color Correction', icon: Filter, color: 'text-purple-500', desc: 'Surgical grading control' },
                    { id: 'edit', label: 'Typography', icon: Type, color: 'text-blue-500', desc: 'Cinematic title engine' },
                    { id: 'automate', label: 'Sonic Energy', icon: Music, color: 'text-orange-500', desc: 'AI music & voiceover' }
                ].map(e => (
                    <button
                        key={e.id}
                        onClick={() => { setActiveCategory(e.id as EditorCategory); showToast(`Opening ${e.label}`, 'info') }}
                        className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xl hover:scale-[1.02] transition-all text-left group"
                    >
                        <div className={`p-3 rounded-xl bg-gray-50 dark:bg-gray-900 mb-4 inline-block ${e.color} group-hover:scale-110 transition-transform`}><e.icon className="w-5 h-5" /></div>
                        <h4 className="font-black text-xs uppercase tracking-widest text-gray-900 dark:text-white mb-1">{e.label}</h4>
                        <p className="text-[10px] text-gray-400 font-medium">{e.desc}</p>
                    </button>
                ))}
            </div>
        </div>
    )
}

export default EffectsView
