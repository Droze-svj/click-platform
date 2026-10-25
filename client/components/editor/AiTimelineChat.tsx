'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, Wand2 } from 'lucide-react'
import { COLOR_GRADES } from '../../lib/colorGrades'
import { useTranslation } from '../../hooks/useTranslation'

interface AiTimelineChatProps {
  /** Apply a colour grade by registry id. Returns false when it couldn't. */
  onApplyGrade: (gradeId: string) => boolean
  /** Add a title at the playhead. */
  onAddText: (text: string) => void
  /** Set the whole-clip playback speed. Returns false when it couldn't. */
  onSetSpeed?: (speed: number) => boolean
  /** Open the Export panel (where the frame shape / aspect ratio is chosen). */
  onOpenExport?: () => void
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
  actionApplied?: string
}

export type TimelineIntent =
  | { kind: 'grade'; gradeId: string; label: string }
  | { kind: 'aspect'; ratio: string }
  | { kind: 'text'; text: string | null }
  | { kind: 'speed'; speed: number }
  | { kind: 'none' }

// Grades matched longest name first so "film noir" wins over "noir" and
// "luma cinematic" over "cinematic".
const GRADE_NAMES = COLOR_GRADES
  .flatMap((g) => {
    const names = new Set([g.id.replace(/-/g, ' '), g.label.toLowerCase().replace('&', 'and')])
    if (g.id === 'bw') { names.add('black and white'); names.add('b&w'); names.add('monochrome') }
    if (g.id === 'cinematic') { names.add('lut'); names.add('film look') }
    return Array.from(names).map((name) => ({ name, id: g.id, label: g.label }))
  })
  .sort((a, b) => b.name.length - a.name.length)

/**
 * Map a request to one editor action. Deterministic keyword matching — no
 * model is called — so the reply can say exactly what was (or wasn't) done.
 */
export function parseTimelineIntent(input: string): TimelineIntent {
  const raw = input.trim()
  const lower = raw.toLowerCase().replace('&', 'and')

  // A title request first: its quoted text may itself mention "TikTok" etc.
  if (/\b(title|text|caption)\b/.test(lower)) {
    const quoted = raw.match(/"([^"]+)"|“([^”]+)”|'([^']+)'/)
    const text = quoted ? (quoted[1] || quoted[2] || quoted[3]).trim() : null
    return { kind: 'text', text: text || null }
  }

  const ratio = lower.match(/(^|[^\d])(9:16|16:9|1:1|4:5)([^\d]|$)/)?.[2]
    || (/\b(vertical|tiktok|reels?|shorts|portrait)\b/.test(lower) ? '9:16'
      : /\bsquare\b/.test(lower) ? '1:1'
        : /\b(horizontal|landscape|widescreen)\b/.test(lower) ? '16:9' : null)
  if (ratio) return { kind: 'aspect', ratio }

  const speedX = lower.match(/(\d+(?:\.\d+)?)\s*x\b/)
  if (speedX) {
    const n = Number(speedX[1])
    if (Number.isFinite(n) && n > 0) return { kind: 'speed', speed: Math.min(2, Math.max(0.25, n)) }
  }
  if (/\bslow[\s-]?mo(tion)?\b/.test(lower)) return { kind: 'speed', speed: 0.5 }
  if (/\bnormal speed\b/.test(lower)) return { kind: 'speed', speed: 1 }
  if (/\b(faster|speed (it )?up)\b/.test(lower)) return { kind: 'speed', speed: 1.25 }

  for (const g of GRADE_NAMES) {
    const re = new RegExp(`(^|[^a-z])${g.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`)
    if (re.test(lower)) return { kind: 'grade', gradeId: g.id, label: g.label }
  }

  return { kind: 'none' }
}

export default function AiTimelineChat({
  onApplyGrade,
  onAddText,
  onSetSpeed,
  onOpenExport
}: AiTimelineChatProps) {
  const { t } = useTranslation()
  const [messages, setMessages] = useState<Message[]>(() => [
    { id: 'greeting', role: 'assistant', text: t('aiTimelineChat.greeting') }
  ])
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim()) return

    const userText = input.trim()
    setInput('')

    // Each branch calls the real editor setter and reports what actually
    // happened. (This used to wait 1.2s and reply "I made that change for
    // you" — even for the aspect ratio, which only showed a toast.)
    const intent = parseTimelineIntent(userText)
    let reply = t('aiTimelineChat.notUnderstood')
    let action: string | undefined

    if (intent.kind === 'grade') {
      if (onApplyGrade(intent.gradeId)) {
        reply = t('aiTimelineChat.appliedGrade', { grade: intent.label })
        action = t('aiTimelineChat.badgeGrade', { grade: intent.label })
      } else {
        reply = t('aiTimelineChat.gradeNotApplied', { grade: intent.label })
      }
    } else if (intent.kind === 'aspect') {
      if (onOpenExport) {
        onOpenExport()
        reply = t('aiTimelineChat.aspectOpenExport', { ratio: intent.ratio })
        action = t('aiTimelineChat.badgeExport')
      } else {
        reply = t('aiTimelineChat.aspectNoExport', { ratio: intent.ratio })
      }
    } else if (intent.kind === 'text') {
      if (intent.text) {
        onAddText(intent.text)
        reply = t('aiTimelineChat.addedText', { text: intent.text })
        action = t('aiTimelineChat.badgeText')
      } else {
        reply = t('aiTimelineChat.textNeedsQuotes')
      }
    } else if (intent.kind === 'speed') {
      if (onSetSpeed && onSetSpeed(intent.speed)) {
        reply = t('aiTimelineChat.speedSet', { speed: intent.speed })
        action = t('aiTimelineChat.badgeSpeed', { speed: intent.speed })
      } else {
        reply = t('aiTimelineChat.notUnderstood')
      }
    }

    const now = Date.now()
    setMessages(prev => [
      ...prev,
      { id: `u-${now}`, role: 'user', text: userText },
      { id: `a-${now}`, role: 'assistant', text: reply, actionApplied: action },
    ])
  }

  return (
    <div className="flex flex-col h-full w-[320px] bg-black/40 backdrop-blur-xl border-l border-white/10 rounded-r-[2.5rem] overflow-hidden shrink-0">
      {/* Header */}
      <div className="px-4 py-3 bg-white/[0.02] border-b border-white/10 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-indigo-400" />
        <span className="text-[10px] font-black uppercase tracking-widest text-white">{t('aiTimelineChat.title')}</span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-4" aria-live="polite">
        {messages.map(m => (
          <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} max-w-[90%]`}>
            <div className={`px-3 py-2 rounded-2xl text-[11px] ${
              m.role === 'user'
                ? 'bg-indigo-500/20 text-indigo-100 rounded-br-sm border border-indigo-500/30'
                : 'bg-white/5 text-slate-300 rounded-bl-sm border border-white/10'
            }`}>
              {m.text}
            </div>
            {m.actionApplied && (
              <div className="mt-1.5 flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <Wand2 className="w-3 h-3 text-emerald-400" />
                <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">{m.actionApplied}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-3 bg-black/50 border-t border-white/10">
        <form onSubmit={handleSend} className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={t('aiTimelineChat.placeholder')}
            aria-label={t('aiTimelineChat.placeholder')}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-3 pr-10 text-[11px] text-white placeholder-slate-500 outline-none focus:border-indigo-500/50 transition-colors"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            title={t('aiTimelineChat.send')}
            aria-label={t('aiTimelineChat.send')}
            className="absolute right-2 p-1.5 text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  )
}
