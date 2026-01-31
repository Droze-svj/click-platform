
import React, { useState, useEffect } from 'react'
import { Calendar as CalendarIcon, Clock, Share2, Filter, ChevronLeft, ChevronRight, Plus, AlertTriangle, CheckCircle2, Globe } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiGet } from '../../../lib/api'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths } from 'date-fns'

interface SchedulingViewProps {
    showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

const SchedulingView: React.FC<SchedulingViewProps> = ({ showToast }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [scheduledPosts, setScheduledPosts] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const fetchScheduledPosts = async () => {
        try {
            setIsLoading(true)
            await apiGet('/oauth/accounts')

            // Clinical Mock Data for the V3 Elite Pro Scheduling
            setScheduledPosts([
                { id: '1', date: new Date(), platform: 'tiktok', title: 'AI Automation Hook', status: 'ready' },
                { id: '2', date: new Date(), platform: 'youtube', title: 'V3 Platform Deepdive', status: 'draft' },
                { id: '3', date: new Date(Date.now() + 86400000), platform: 'instagram', title: 'Neon Text Reveal', status: 'ready' }
            ])
        } catch (error) {
            console.error('Failed to fetch schedule', error)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchScheduledPosts()
    }, [currentMonth])

    const days = eachDayOfInterval({
        start: startOfMonth(currentMonth),
        end: endOfMonth(currentMonth)
    })

    const PLATFORM_COLORS: any = {
        tiktok: 'bg-pink-500',
        youtube: 'bg-red-600',
        instagram: 'bg-purple-600',
        twitter: 'bg-slate-800'
    }

    return (
        <div className="space-y-8 h-full flex flex-col pb-10">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Pro Scheduling Hub</h3>
                    <p className="text-xs text-gray-500 font-medium italic">Clinical content distribution and strategic calendar management.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1">
                        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-white/5 rounded-xl transition-all text-gray-400 hover:text-white">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <div className="px-4 py-2 text-[10px] font-black uppercase text-white tracking-[2px] min-w-[140px] text-center">
                            {format(currentMonth, 'MMMM yyyy')}
                        </div>
                        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-white/5 rounded-xl transition-all text-gray-400 hover:text-white">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                    <button className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:scale-105 transition-all">
                        <Plus className="w-4 h-4" />
                        New Blast
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-white/5 border border-white/10 rounded-[40px] p-6 overflow-hidden flex flex-col">
                <div className="grid grid-cols-7 gap-4 mb-4">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} className="text-center text-[10px] font-black uppercase text-gray-500 tracking-widest">{d}</div>
                    ))}
                </div>

                <div className="flex-1 grid grid-cols-7 grid-rows-5 gap-2 custom-scrollbar overflow-y-auto pr-2">
                    {days.map((day, i) => {
                        const dayPosts = scheduledPosts.filter(p => format(new Date(p.date), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'))

                        return (
                            <div
                                key={i}
                                className={`min-h-[120px] p-3 rounded-2xl border transition-all ${isToday(day) ? 'bg-white/10 border-blue-500/40 shadow-lg shadow-blue-500/5' : 'bg-black/20 border-white/5 hover:border-white/10'}`}
                            >
                                <div className="flex justify-between items-center mb-3">
                                    <span className={`text-xs font-black ${isToday(day) ? 'text-blue-500' : 'text-gray-600'}`}>{format(day, 'd')}</span>
                                    {dayPosts.length > 0 && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />}
                                </div>

                                <div className="space-y-1.5">
                                    {dayPosts.map(post => (
                                        <div key={post.id} className="p-2 bg-black/40 border border-white/5 rounded-lg group cursor-pointer hover:border-blue-500/30 transition-all">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <div className={`w-1.5 h-1.5 rounded-full ${PLATFORM_COLORS[post.platform]}`} />
                                                <span className="text-[8px] font-black uppercase text-gray-500 tracking-tighter truncate">{post.platform}</span>
                                            </div>
                                            <p className="text-[10px] font-bold text-white truncate group-hover:text-blue-400 transition-colors">{post.title}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col justify-between">
                    <div>
                        <h4 className="text-[10px] font-black uppercase text-blue-500 tracking-[3px] mb-4">Neural Strategy</h4>
                        <p className="text-xs text-gray-300 font-medium leading-relaxed">Engagement forecast suggests optimal posting between 18:00 and 20:00 for your current TikTok profile linked in the Social Vault.</p>
                    </div>
                    <div className="mt-6 flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg"><Globe className="w-4 h-4 text-blue-500" /></div>
                        <div>
                            <p className="text-[10px] font-black text-white uppercase">Global Coverage</p>
                            <p className="text-[8px] font-bold text-gray-500 uppercase">Synced across 4 Timezones</p>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-3xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h4 className="text-[10px] font-black uppercase text-orange-500 tracking-[3px]">Active Production Pipeline</h4>
                        <span className="px-2 py-1 bg-orange-500/10 text-orange-500 rounded text-[8px] font-black uppercase tracking-widest">3 Tasks Pending</span>
                    </div>
                    <div className="space-y-3">
                        {[
                            { l: '4K Render: AI Workflow', p: 85, s: 'In Progress' },
                            { l: 'Subtitles: Viral Quotes', p: 40, s: 'Processing' }
                        ].map(job => (
                            <div key={job.l} className="p-3 bg-black/40 border border-white/5 rounded-2xl flex items-center justify-between">
                                <div className="flex items-center gap-4 flex-1">
                                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-[10px] font-black text-gray-500 uppercase">MOV</div>
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-white mb-1">{job.l}</p>
                                        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-500" style={{ width: `${job.p}%` }} />
                                        </div>
                                    </div>
                                </div>
                                <div className="ml-6 text-right">
                                    <p className="text-[8px] font-black text-blue-500 uppercase mb-0.5">{job.s}</p>
                                    <p className="text-[10px] font-black text-white">{job.p}%</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SchedulingView
