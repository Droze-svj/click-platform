'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Users, MessageSquare, Send, Share2 } from 'lucide-react'
import { useTranslation } from '../../../hooks/useTranslation'
import { useCollaboration, PresenceUser } from '../../../hooks/useCollaboration'

interface CollaborateViewProps {
    videoId: string
    showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

const initialsFor = (u: PresenceUser): string => {
    const name = (u.name || '').trim()
    if (name) {
        const parts = name.split(/\s+/)
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
        return name.slice(0, 2).toUpperCase()
    }
    return (u.userId || 'U').slice(0, 2).toUpperCase()
}

const formatTime = (iso: string): string => {
    try {
        const d = new Date(iso)
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
        return ''
    }
}

const CollaborateView: React.FC<CollaborateViewProps> = ({ videoId, showToast }) => {
    const { t } = useTranslation()
    const glassStyle = 'backdrop-blur-3xl bg-white/[0.03] border border-white/10 shadow-2xl'

    // Local-draft (no saved project) cannot collaborate — there's no shared room.
    const hasProject = Boolean(videoId)
    const { connected, presence, peers, comments, sendComment } = useCollaboration(hasProject ? videoId : null)

    const [draft, setDraft] = useState('')
    const commentsEndRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [comments.length])

    const handleSend = () => {
        const text = draft.trim()
        if (!text) return
        const ok = sendComment(text)
        if (ok) {
            setDraft('')
        } else {
            showToast(t('modernVideoEditor.collabSendFailed'), 'error')
        }
    }

    // Honest empty state: no saved project means no one to collaborate with.
    if (!hasProject) {
        return (
            <div className="space-y-8">
                <div className={`${glassStyle} rounded-[2rem] p-10 flex flex-col items-center justify-center text-center gap-4`}>
                    <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                        <Share2 className="w-7 h-7 text-blue-400" />
                    </div>
                    <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-theme-primary">
                        {t('modernVideoEditor.collabNoProjectTitle')}
                    </h4>
                    <p className="text-[10px] text-theme-muted font-medium italic max-w-xs leading-relaxed">
                        {t('modernVideoEditor.collabNoProjectBody')}
                    </p>
                </div>
            </div>
        )
    }

    const onlineCount = presence.length

    return (
        <div className="space-y-8">
            {/* Real presence cluster */}
            <div className={`${glassStyle} rounded-[2rem] p-6 flex items-center justify-between`}>
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                        <Users className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-theme-primary">
                            {t('modernVideoEditor.collabActiveTitle')}
                        </h4>
                        <p className="text-[9px] text-theme-muted font-medium italic flex items-center gap-1.5">
                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                            {peers.length === 0
                                ? t('modernVideoEditor.collabSolo')
                                : t('modernVideoEditor.collabOnlineCount', { count: onlineCount })}
                        </p>
                    </div>
                </div>
                {presence.length > 0 && (
                    <div className="flex -space-x-3">
                        {presence.slice(0, 5).map((u) => (
                            <div
                                key={u.userId}
                                className="w-8 h-8 rounded-full border-2 border-slate-900 flex items-center justify-center text-[10px] font-black text-white shadow-xl"
                                style={{ backgroundColor: u.color || '#3b82f6' }}
                                title={u.name || u.userId}
                            >
                                {initialsFor(u)}
                            </div>
                        ))}
                        {presence.length > 5 && (
                            <div className="w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-400 shadow-xl">
                                +{presence.length - 5}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className={`${glassStyle} rounded-[2rem] p-8 overflow-hidden relative group`}>
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <MessageSquare className="w-32 h-32 text-blue-500" />
                </div>

                <h3 className="text-sm font-black mb-8 uppercase text-slate-500 tracking-[0.4em] italic leading-none flex items-center gap-4">
                    {t('modernVideoEditor.collabFeedbackTitle')}
                    <div className="h-px flex-1 bg-white/5" />
                </h3>

                <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                    {comments.length === 0 && (
                        <p className="text-[10px] text-theme-muted font-medium italic text-center py-6">
                            {t('modernVideoEditor.collabNoComments')}
                        </p>
                    )}
                    {comments.map((c) => (
                        <div
                            key={c.id}
                            className="flex gap-4 p-5 bg-black/40 rounded-[1.5rem] border border-white/5 hover:border-white/20 transition-all"
                        >
                            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-black text-xs border border-blue-500/20 shrink-0">
                                {(c.userName || 'U').slice(0, 1).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-1 gap-2">
                                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest truncate">
                                        {c.userName || t('modernVideoEditor.collabAnonymous')}
                                    </p>
                                    {c.createdAt && (
                                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest italic bg-white/5 px-2 py-0.5 rounded shrink-0">
                                            {formatTime(c.createdAt)}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs font-medium text-slate-400 leading-relaxed italic pr-4 break-words">{c.text}</p>
                            </div>
                        </div>
                    ))}
                    <div ref={commentsEndRef} />
                </div>

                <div className="relative mt-8 group/input">
                    <input
                        type="text"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
                        disabled={!connected}
                        placeholder={connected ? t('modernVideoEditor.collabInputPlaceholder') : t('modernVideoEditor.collabOffline')}
                        className="w-full bg-black/60 border border-white/5 rounded-[1.5rem] px-6 py-4 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 transition-all text-white placeholder-slate-700 disabled:opacity-50"
                        title={t('modernVideoEditor.collabInputPlaceholder')}
                    />
                    <button
                        type="button"
                        onClick={handleSend}
                        disabled={!connected || !draft.trim()}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/40 hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:hover:scale-100"
                        title={t('modernVideoEditor.collabSend')}
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    )
}

export default CollaborateView
