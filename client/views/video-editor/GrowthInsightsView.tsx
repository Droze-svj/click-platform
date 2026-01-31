'use client'

import React from 'react'
import { Flame, Sparkles, Zap, Award } from 'lucide-react'

interface GrowthInsightsViewProps {
    isOledTheme?: boolean
}

export const GrowthInsightsView: React.FC<GrowthInsightsViewProps> = ({ isOledTheme }) => {
    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2 uppercase tracking-tighter">
                            <Flame className="w-5 h-5 text-orange-500" />
                            Viral Probability
                        </h3>
                        <p className="text-[10px] text-gray-500 font-bold opacity-60">AI Predictor Engine v2.4</p>
                    </div>
                    <div className="text-3xl font-black text-emerald-500">84%</div>
                </div>

                <div className="h-4 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden mb-6 relative border dark:border-slate-800">
                    <div className="h-full bg-gradient-to-r from-orange-400 via-emerald-400 to-emerald-600 w-[84%] transition-all duration-1000 shadow-[0_0_20px_rgba(16,185,129,0.4)]" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                        <p className="text-[8px] font-black uppercase text-gray-400 mb-1">Hook Strength</p>
                        <p className="text-sm font-black text-gray-900 dark:text-white">EXTREME</p>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                        <p className="text-[8px] font-black uppercase text-gray-400 mb-1">Pacing Var</p>
                        <p className="text-sm font-black text-gray-900 dark:text-white">OPTIMAL</p>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-xs font-black mb-4 uppercase tracking-widest text-slate-500">AI Growth Insights</h3>
                <div className="space-y-4">
                    {[
                        { icon: Sparkles, color: 'text-indigo-500', text: 'Add energetic B-roll at 00:24 to maintain 100% viewer retention.' },
                        { icon: Zap, color: 'text-yellow-500', text: 'Your call-to-action has high audio clarity. Trending result expected.' },
                        { icon: Award, color: 'text-emerald-500', text: 'Variety engine usage detected. Unique edit footprint unlocked.' }
                    ].map((tip, i) => (
                        <div key={i} className="flex gap-4 group">
                            <div className={`p-2 rounded-lg bg-gray-50 dark:bg-gray-900 group-hover:scale-110 transition-transform ${tip.color}`}>
                                <tip.icon className="w-4 h-4" />
                            </div>
                            <p className="text-[11px] text-gray-600 dark:text-gray-400 font-medium leading-relaxed">{tip.text}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
