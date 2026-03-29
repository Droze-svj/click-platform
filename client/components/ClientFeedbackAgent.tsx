'use client'

import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, CheckCircle2, X, Loader2, Zap, MessageSquare, ChevronRight } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface ParsedAction {
  action: string | null
  timestamp: number | null
  parameter: string | null
  parseable: boolean
}

interface ClientFeedbackAgentProps {
  commentId: string
  commentText: string
  authorName: string
  onAccept?: (action: ParsedAction) => void
  onDecline?: () => void
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

const ACTION_LABELS: Record<string, string> = {
  lower_music: 'Lower music volume',
  remove_silence: 'Remove silent pause',
  speed_ramp: 'Speed up section',
  cut_segment: 'Cut this segment',
  adjust_captions: 'Adjust caption style',
}

const ACTION_DESCRIPTIONS: Record<string, string> = {
  lower_music: 'Reduces background music by −6 dB on audio track A1',
  remove_silence: 'Applies silence removal at the detected timestamp',
  speed_ramp: 'Ramps playback speed to 1.25× at this point',
  cut_segment: 'Marks segment for deletion on ghost layer',
  adjust_captions: 'Opens caption settings for review',
}

// ── Component ────────────────────────────────────────────────────────────────

const ClientFeedbackAgent: React.FC<ClientFeedbackAgentProps> = ({
  commentId,
  commentText,
  authorName,
  onAccept,
  onDecline,
  showToast,
}) => {
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState<ParsedAction | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [applied, setApplied] = useState(false)

  const parseComment = useCallback(async () => {
    setParsing(true)
    try {
      const res = await fetch('/api/agentic/parse-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: commentText }),
      })

      if (res.ok) {
        const data: ParsedAction = await res.json()
        setParsed(data)
      } else {
        // Client-side fallback heuristic
        const lower = commentText.toLowerCase()
        const hasMusicRef = lower.includes('music') && (lower.includes('quiet') || lower.includes('lower'))
        const hasPause = lower.includes('pause') || lower.includes('silence')
        const timeMatch = lower.match(/(\d+):(\d+)/)
        const timestamp = timeMatch ? parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]) : null

        setParsed({
          action: hasMusicRef ? 'lower_music' : hasPause ? 'remove_silence' : null,
          timestamp,
          parameter: hasMusicRef ? '-6dB' : null,
          parseable: hasMusicRef || hasPause,
        })
      }
    } catch {
      setParsed({ action: null, timestamp: null, parameter: null, parseable: false })
    } finally {
      setParsing(false)
    }
  }, [commentText])

  // Auto-parse when comment is submitted (called on mount if needed)
  React.useEffect(() => {
    if (commentText && !parsed && !parsing) {
      parseComment()
    }
  }, [commentText, parsed, parsing, parseComment])

  const handleAccept = () => {
    if (!parsed) return
    setApplied(true)
    onAccept?.(parsed)
    showToast(`✓ AI edit applied — ${ACTION_LABELS[parsed.action ?? ''] ?? 'Edit applied'}`, 'success')
  }

  const handleDecline = () => {
    setDismissed(true)
    onDecline?.()
  }

  if (dismissed || applied) return null
  if (!parsed || !parsed.parseable) return null

  const actionLabel = ACTION_LABELS[parsed.action ?? ''] ?? parsed.action
  const actionDesc = ACTION_DESCRIPTIONS[parsed.action ?? ''] ?? 'Apply AI-suggested edit'
  const formattedTime = parsed.timestamp !== null
    ? `${Math.floor((parsed.timestamp ?? 0) / 60)}:${String((parsed.timestamp ?? 0) % 60).padStart(2, '0')}`
    : null

  return (
    <AnimatePresence>
      <motion.div
        key={commentId}
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        className="mt-2 rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/5 backdrop-blur-sm overflow-hidden"
      >
        <div className="flex items-start gap-3 p-4">
          {/* AI Badge */}
          <div className="w-8 h-8 rounded-xl bg-fuchsia-500/20 flex items-center justify-center shrink-0">
            {parsing
              ? <Loader2 className="w-4 h-4 text-fuchsia-400 animate-spin" />
              : <Bot className="w-4 h-4 text-fuchsia-400" />
            }
          </div>

          <div className="flex-1 min-w-0">
            {parsing ? (
              <p className="text-[10px] text-slate-500 italic">Analyzing comment…</p>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-[10px] font-black text-fuchsia-400 uppercase tracking-wider">
                    🤖 AI Draft Ready
                  </p>
                  <span className="text-[8px] text-slate-600">from {authorName}&apos;s comment</span>
                </div>

                <div className="flex items-start gap-2 mb-3">
                  <MessageSquare className="w-3 h-3 text-slate-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-slate-500 italic line-clamp-2">&ldquo;{commentText}&rdquo;</p>
                </div>

                {/* Proposed action */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/5 mb-3">
                  <Zap className="w-3 h-3 text-fuchsia-400 shrink-0" />
                  <div>
                    <p className="text-[10px] font-black text-white">{actionLabel}</p>
                    <p className="text-[9px] text-slate-600">
                      {actionDesc}
                      {formattedTime && ` at ${formattedTime}`}
                      {parsed.parameter && ` (${parsed.parameter})`}
                    </p>
                  </div>
                  <ChevronRight className="w-3 h-3 text-slate-700 ml-auto shrink-0" />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleAccept}
                    className="flex-1 py-2 rounded-xl bg-fuchsia-600 text-white font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3 h-3" /> Accept Ghost Edit
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleDecline}
                    className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-500 font-black text-[9px] uppercase tracking-widest flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Decline
                  </motion.button>
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

export default ClientFeedbackAgent
