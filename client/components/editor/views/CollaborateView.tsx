'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Users, MessageSquare, Send, Share2 } from 'lucide-react'
import { useTranslation } from '../../../hooks/useTranslation'
import { useCollaboration, PresenceUser } from '../../../hooks/useCollaboration'
import { Panel, Button, EmptyState, Input } from '../../ui'
import { cn } from '../../../lib/utils'

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
            <div className="ds-anim-fade-in">
                <Panel variant="glass" className="p-0">
                    <EmptyState
                        icon={Share2}
                        title={t('modernVideoEditor.collabNoProjectTitle')}
                        description={t('modernVideoEditor.collabNoProjectBody')}
                    />
                </Panel>
            </div>
        )
    }

    const onlineCount = presence.length

    return (
        <div className="space-y-6 ds-anim-fade-in">
            {/* Real presence cluster */}
            <Panel variant="glass" className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                        <Users className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                        <h4 className="ds-text-label text-theme-primary truncate">
                            {t('modernVideoEditor.collabActiveTitle')}
                        </h4>
                        <p className="ds-text-caption flex items-center gap-1.5">
                            <span className={cn('inline-block h-1.5 w-1.5 rounded-full', connected ? 'bg-emerald-500' : 'bg-slate-500')} />
                            {peers.length === 0
                                ? t('modernVideoEditor.collabSolo')
                                : t('modernVideoEditor.collabOnlineCount', { count: onlineCount })}
                        </p>
                    </div>
                </div>
                {presence.length > 0 && (
                    <div className="flex -space-x-3 shrink-0">
                        {presence.slice(0, 5).map((u) => (
                            <div
                                key={u.userId}
                                className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background text-[10px] font-semibold text-white ds-elev-1"
                                style={{ backgroundColor: u.color || '#6366f1' }}
                                title={u.name || u.userId}
                            >
                                {initialsFor(u)}
                            </div>
                        ))}
                        {presence.length > 5 && (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-accent text-[10px] font-semibold text-theme-muted ds-elev-1">
                                +{presence.length - 5}
                            </div>
                        )}
                    </div>
                )}
            </Panel>

            <Panel variant="glass" className="relative overflow-hidden">
                <h3 className="ds-text-h3 text-theme-primary mb-6 flex items-center gap-3">
                    <MessageSquare className="h-5 w-5 text-theme-muted" aria-hidden />
                    {t('modernVideoEditor.collabFeedbackTitle')}
                    <span className="h-px flex-1 bg-border" />
                </h3>

                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {comments.length === 0 && (
                        <p className="ds-text-caption text-center py-6">
                            {t('modernVideoEditor.collabNoComments')}
                        </p>
                    )}
                    {comments.map((c) => (
                        <div
                            key={c.id}
                            className="flex gap-3 rounded-xl border border-border bg-background/40 p-4 transition-colors hover:border-primary/30"
                        >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-xs font-semibold text-primary">
                                {(c.userName || 'U').slice(0, 1).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="mb-1 flex items-center justify-between gap-2">
                                    <p className="ds-text-label truncate text-primary">
                                        {c.userName || t('modernVideoEditor.collabAnonymous')}
                                    </p>
                                    {c.createdAt && (
                                        <span className="ds-text-caption shrink-0">
                                            {formatTime(c.createdAt)}
                                        </span>
                                    )}
                                </div>
                                <p className="ds-text-body break-words text-theme-secondary">{c.text}</p>
                            </div>
                        </div>
                    ))}
                    <div ref={commentsEndRef} />
                </div>

                <div className="relative mt-6">
                    <Input
                        type="text"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
                        disabled={!connected}
                        placeholder={connected ? t('modernVideoEditor.collabInputPlaceholder') : t('modernVideoEditor.collabOffline')}
                        className="h-12 pr-14"
                        title={t('modernVideoEditor.collabInputPlaceholder')}
                    />
                    <Button
                        type="button"
                        size="sm"
                        onClick={handleSend}
                        disabled={!connected || !draft.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 p-0"
                        title={t('modernVideoEditor.collabSend')}
                        aria-label={t('modernVideoEditor.collabSend')}
                    >
                        <Send className="h-4 w-4" aria-hidden />
                    </Button>
                </div>
            </Panel>
        </div>
    )
}

export default CollaborateView
