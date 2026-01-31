
import React from 'react'
import { Flame, Sparkles, Zap, Award, LineChart as ChartIcon, TrendingUp } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'

interface GrowthInsightsViewProps {
    isOledTheme: boolean
}

const DATA = [
    { time: '0s', prob: 20 },
    { time: '5s', prob: 45 },
    { time: '10s', prob: 84 },
    { time: '15s', prob: 60 },
    { time: '20s', prob: 75 },
    { time: '25s', prob: 90 },
]

const GrowthInsightsView: React.FC<GrowthInsightsViewProps> = ({ isOledTheme }) => {
    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2 uppercase tracking-tighter">
                                <Flame className="w-5 h-5 text-orange-500" />
                                Viral Probability
                            </h3>
                            <p className="text-[10px] text-gray-500 font-bold opacity-60">Neural Engine v3.0 Prediction</p>
                        </div>
                        <div className="text-4xl font-black text-emerald-500 tracking-tighter">84.2%</div>
                    </div>

                    <div className="h-4 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden mb-6 relative border dark:border-slate-800">
                        <div className="h-full bg-gradient-to-r from-orange-500 via-emerald-400 to-blue-500 w-[84%] transition-all duration-1000 shadow-[0_0_20px_rgba(59,130,246,0.5)]" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-white/5 flex flex-col items-center">
                            <TrendingUp className="w-4 h-4 text-emerald-500 mb-2" />
                            <p className="text-[8px] font-black uppercase text-gray-400 mb-1">Retention Index</p>
                            <p className="text-sm font-black text-gray-900 dark:text-white">OPTIMAL</p>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-white/5 flex flex-col items-center">
                            <Zap className="w-4 h-4 text-orange-500 mb-2" />
                            <p className="text-[8px] font-black uppercase text-gray-400 mb-1">Hook Energy</p>
                            <p className="text-sm font-black text-gray-900 dark:text-white">EXTREME</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 flex flex-col">
                    <h3 className="text-xs font-black mb-4 uppercase text-gray-400 tracking-widest flex items-center gap-2">
                        <ChartIcon className="w-4 h-4 text-blue-500" />
                        Retention Forecast
                    </h3>
                    <div className="flex-1 min-h-[150px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={DATA}>
                                <defs>
                                    <linearGradient id="colorProb" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <Area type="monotone" dataKey="prob" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorProb)" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#000', border: 'none', borderRadius: '12px', fontSize: '10px', color: '#fff' }}
                                    itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 overflow-hidden">
                <h3 className="text-xs font-black mb-6 uppercase tracking-widest text-slate-500 flex items-center justify-between">
                    <span>Neural Strategic Feed</span>
                    <span className="px-2 py-0.5 bg-blue-500 text-white rounded text-[8px] tracking-[2px]">SYNCED</span>
                </h3>
                <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar">
                    {[
                        { icon: Sparkles, color: 'text-indigo-500', bg: 'bg-indigo-500/10', title: 'Content Amplification', text: 'Apply energetical jumpcuts at 00:12 to match the trending audio pattern.' },
                        { icon: Zap, color: 'text-yellow-500', bg: 'bg-yellow-500/10', title: 'Hook Optimization', text: 'Primary hook detected. Suggesting motion-blur overlay for visual punch.' },
                        { icon: Award, color: 'text-emerald-500', bg: 'bg-emerald-500/10', title: 'Production Milestone', text: 'Consistency score: 98%. You are in the top 1% of Creator Retention today.' }
                    ].map((tip, i) => (
                        <div key={i} className="flex gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/50 hover:scale-[1.01] transition-all border border-transparent hover:border-white/5">
                            <div className={`p-3 rounded-xl ${tip.bg} ${tip.color} shrink-0`}>
                                <tip.icon className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase text-gray-500 mb-1 tracking-widest">{tip.title}</p>
                                <p className="text-xs text-gray-600 dark:text-gray-300 font-medium leading-relaxed">{tip.text}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default GrowthInsightsView
