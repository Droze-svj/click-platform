
import React from 'react'
import { Users, MessageSquare, Send } from 'lucide-react'

interface CollaborateViewProps {
    videoId: string
    showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

const CollaborateView: React.FC<CollaborateViewProps> = ({ videoId, showToast }) => {
    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-sm font-black mb-4 uppercase text-slate-500 tracking-[3px]">Editorial Real-Time</h3>
                <div className="space-y-4 mb-6">
                    {[
                        { u: 'Sarah (Director)', t: '00:15', m: 'Tighter cut here. The pacing drops.' },
                        { u: 'Mike (Editor)', t: '00:42', m: 'Adjusted B-roll to match the hook.' }
                    ].map((c, i) => (
                        <div key={i} className="flex gap-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
                            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-[10px]">{c.u[0]}</div>
                            <div>
                                <p className="text-[10px] font-black text-blue-600 uppercase">{c.u} <span className="text-gray-400 ml-2">@{c.t}</span></p>
                                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-1">{c.m}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="relative">
                    <input type="text" placeholder="Add feedback..." className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" />
                    <button className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-lg"><Send className="w-3 h-3" /></button>
                </div>
            </div>
        </div>
    )
}

export default CollaborateView
