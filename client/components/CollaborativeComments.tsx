'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Send, X, User } from 'lucide-react'
import { apiGet, apiPost } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { useSocket } from '../hooks/useSocket'
import { useToast } from '../contexts/ToastContext'

interface Comment {
  _id: string
  userName: string
  text: string
  createdAt: string
}

export default function CollaborativeComments({ entityId, teamId, title }: { entityId: string, teamId: string, title: string }) {
  const { user } = useAuth()
  const { on, off, socket } = useSocket(user?.id)
  const { showToast } = useToast()

  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadComments()
  }, [entityId])

  useEffect(() => {
    if (!socket || !entityId) return

    const handleNewComment = (comment: Comment) => {
      setComments(prev => [...prev, comment])
      setTimeout(scrollToBottom, 100)
    }

    on(`comment:${entityId}`, handleNewComment)

    return () => {
      off(`comment:${entityId}`, handleNewComment)
    }
  }, [socket, entityId, on, off])

  const loadComments = async () => {
    setLoading(true)
    try {
      const res = await apiGet(`/comments?entityId=${entityId}`)
      setComments((res as any)?.data || [])
      setTimeout(scrollToBottom, 100)
    } catch (err) {
      console.error('Failed to load comments', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async () => {
    if (!newComment.trim() || !user || !teamId) return
    setSending(true)
    try {
      const res = await apiPost('/comments', {
        teamId,
        entityId,
        entityType: 'operation',
        text: newComment.trim(),
        userName: user.name
      })

      const comment = (res as any)?.data
      if (comment) {
        setNewComment('')
        // Pulse to ticker
        socket?.emit('activity:pulse', {
          teamId,
          pulse: {
            userName: user.name,
            action: 'Commented on',
            target: title,
            type: 'collaboration'
          }
        })
      }
    } catch (err) {
      showToast('Failed to send comment', 'error')
    } finally {
      setSending(false)
    }
  }

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }

  return (
    <div className="flex flex-col h-[400px] bg-black/40 border border-white/5 rounded-[2.5rem] overflow-hidden backdrop-blur-3xl">
      <div className="p-6 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-4 h-4 text-indigo-500" />
          <h3 className="text-xs font-black uppercase tracking-widest text-white italic">Neural Feedback Thread</h3>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-600 text-[10px] uppercase font-bold tracking-[0.2em] animate-pulse">
            Retrieving Transmissions...
          </div>
        ) : comments.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-700 text-[10px] uppercase font-bold tracking-[0.2em] italic">
            No active signals in this frequency
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {comments.map((comment) => (
              <motion.div
                key={comment._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-1"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-indigo-400 uppercase italic">{comment.userName}</span>
                  <span className="text-[8px] font-bold text-slate-600 uppercase tabular-nums">
                    {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-sm text-slate-300 leading-relaxed">
                  {comment.text}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      <div className="p-6 bg-white/[0.01] border-t border-white/5">
        <div className="relative">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Inject feedback..."
            className="w-full bg-black/40 border border-white/10 rounded-2xl pl-4 pr-12 py-4 text-xs text-white placeholder:text-slate-700 focus:outline-none focus:border-indigo-500 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={sending || !newComment.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500 hover:text-white transition-all disabled:opacity-30"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
