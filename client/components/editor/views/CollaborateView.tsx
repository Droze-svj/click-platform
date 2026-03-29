
import React from 'react'
import { Users, MessageSquare, Send } from 'lucide-react'

interface CollaborateViewProps {
    videoId: string
    showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

const CollaborateView: React.FC<CollaborateViewProps> = ({ videoId, showToast }) => {
    const glassStyle = "backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-2xl"

    return (
        <div className="space-y-8">
            {/* Multiplayer Presence Cluster */}
            <div className={`${glassStyle} rounded-[2rem] p-6 flex items-center justify-between`}>
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                        <Users className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-theme-primary">Active Collaboration</h4>
                        <p className="text-[9px] text-theme-muted font-medium italic">3 Nodes currently synchronized</p>
                    </div>
                </div>
                <div className="flex -space-x-3">
                    {[
                        { n: 'Sarah', c: 'bg-blue-500' },
                        { n: 'Mike', c: 'bg-emerald-500' },
                        { n: 'Alex', c: 'bg-amber-500' }
                    ].map((u, i) => (
                        <div key={i} className={`w-8 h-8 rounded-full border-2 border-slate-900 ${u.c} flex items-center justify-center text-[10px] font-black text-white shadow-xl`} title={u.n}>
                            {u.n[0]}
                        </div>
                    ))}
                    <div className="w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-400 shadow-xl">
                        +1
                    </div>
                </div>
            </div>

            <div className={`${glassStyle} rounded-[2rem] p-8 overflow-hidden relative group`}>
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <MessageSquare className="w-32 h-32 text-blue-500" />
                </div>

                <h3 className="text-sm font-black mb-8 uppercase text-slate-500 tracking-[0.4em] italic leading-none flex items-center gap-4">
                    EDITORIAL FEEDBACK
                    <div className="h-px flex-1 bg-white/5" />
                </h3>

                <div className="space-y-4">
                    {[
                        { u: 'Sarah (Director)', t: '00:15', m: 'Tighter cut here. The pacing drops.', c: 'shadow-[0_0_20px_rgba(59,130,246,0.1)] border-blue-500/10' },
                        { u: 'Mike (Editor)', t: '00:42', m: 'Adjusted B-roll to match the hook.', c: 'shadow-[0_0_20px_rgba(16,185,129,0.1)] border-emerald-500/10' }
                    ].map((c, i) => (
                        <div key={i} className={`flex gap-4 p-5 bg-black/40 rounded-[1.5rem] border ${c.c} group/msg hover:border-white/20 transition-all`}>
                            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-black text-xs border border-blue-500/20 group-hover:scale-110 transition-transform">{c.u[0]}</div>
                            <div className="flex-1">
                                <div className="flex justify-between items-center mb-1">
                                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{c.u}</p>
                                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest italic bg-white/5 px-2 py-0.5 rounded">@{c.t}</span>
                                </div>
                                <p className="text-xs font-medium text-slate-400 leading-relaxed italic pr-4">{c.m}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="relative mt-8 group/input">
                    <input type="text" placeholder="Initialize global feedback..." className="w-full bg-black/60 border border-white/5 rounded-[1.5rem] px-6 py-4 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 transition-all text-white placeholder-slate-700" title="Feedback input" />
                    <button className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/40 hover:scale-105 active:scale-95 transition-all" title="Send feedback"><Send className="w-4 h-4" /></button>
                </div>
            </div>
        </div>
    )
}

export default CollaborateView
