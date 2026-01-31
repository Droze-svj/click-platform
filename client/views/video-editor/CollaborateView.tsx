'use client'

import React from 'react'
import { MessageSquare } from 'lucide-react'
import CollaborativeEditing from '../../components/CollaborativeEditing'

interface CollaborateViewProps {
    videoId?: string
    showToast: (message: string, type: 'success' | 'error' | 'info') => void
}

export const CollaborateView: React.FC<CollaborateViewProps> = ({ videoId, showToast }) => {
    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-sm font-black mb-4 uppercase text-slate-500 tracking-[3px]">Editorial Comments</h3>
                <div className="space-y-4 mb-6">
                    {[
                        { user: 'Sarah (Director)', time: '00:15', text: 'Tighter cut here. The pacing drops.', avatar: '/avatars/1.jpg' },
                        { user: 'Mike (Editor)', time: '00:42', text: 'Adjusted B-roll to match the hook.', avatar: '/avatars/2.jpg' }
                    ].map((comment, i) => (
                        <div key={i} className="flex gap-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
                            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px] font-black">{comment.user[0]}</div>
                            <div>
                                <p className="text-[10px] font-black text-blue-500 uppercase">{comment.user} <span className="text-gray-400 ml-2">@{comment.time}</span></p>
                                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-1">{comment.text}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Add feedback at current time..."
                        className="w-full bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-800 rounded-xl px-4 py-3 text-xs font-bold outline-none ring-2 ring-transparent focus:ring-blue-500 transition-all"
                    />
                    <button className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-lg shadow-lg">
                        <MessageSquare className="w-3 h-3" />
                    </button>
                </div>
            </div>
            <CollaborativeEditing
                sessionId={`session-${videoId}`}
                currentUser={{
                    id: 'user-1',
                    name: 'You'
                }}
                onSessionUpdate={(session) => {
                    showToast(`Session updated: ${session.participants.length} participants`, 'info')
                }}
                onCommentAdd={(comment) => {
                    showToast('Comment added to collaborative session', 'success')
                }}
                onCursorMove={(userId, position) => {
                    // Handle cursor movement updates
                }}
            />
        </div>
    )
}
