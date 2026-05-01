'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, Bot, User, Wand2 } from 'lucide-react'

interface AiTimelineChatProps {
  onApplyLUT: (filterName: string) => void
  onChangeAspectRatio: (ratio: string) => void
  onAddText: (text: string) => void
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
  actionApplied?: string
}

export default function AiTimelineChat({
  onApplyLUT,
  onChangeAspectRatio,
  onAddText
}: AiTimelineChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', text: "I'm your AI Copilot. How should we edit this timeline?" }
  ])
  const [input, setInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || isProcessing) return

    const userText = input.trim()
    setInput('')
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text: userText }])
    setIsProcessing(true)

    // Simulate LLM Function Calling Processing
    setTimeout(() => {
      const lower = userText.toLowerCase()
      let actionStr = ''
      let replyText = 'I made that change for you.'

      if (lower.includes('cinematic') || lower.includes('lut') || lower.includes('moody')) {
        onApplyLUT('cinematic')
        actionStr = 'Applied Cinematic LUT'
      } else if (lower.includes('tiktok') || lower.includes('vertical') || lower.includes('9:16')) {
        onChangeAspectRatio('9:16')
        actionStr = 'Changed Aspect Ratio to 9:16'
      } else if (lower.includes('title') || lower.includes('text') || lower.includes('caption')) {
        const textMatch = userText.match(/\"([^\"]+)\"/) || userText.match(/\'([^\']+)\'/)
        const textToAdd = textMatch ? textMatch[1] : 'Epic Title'
        onAddText(textToAdd)
        actionStr = `Added Text: "${textToAdd}"`
      } else {
        replyText = "I'm not sure how to do that yet. Try asking me to make it cinematic, format for TikTok, or add a title."
      }

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        text: replyText,
        actionApplied: actionStr
      }])
      setIsProcessing(false)
    }, 1200)
  }

  return (
    <div className="flex flex-col h-full w-[320px] bg-black/40 backdrop-blur-xl border-l border-white/10 rounded-r-[2.5rem] overflow-hidden shrink-0">
      {/* Header */}
      <div className="px-4 py-3 bg-white/[0.02] border-b border-white/10 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-indigo-400" />
        <span className="text-[10px] font-black uppercase tracking-widest text-white">Timeline Copilot</span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
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
        {isProcessing && (
          <div className="flex items-start max-w-[90%]">
            <div className="px-3 py-2 rounded-2xl text-[11px] bg-white/5 text-slate-400 rounded-bl-sm border border-white/10 flex gap-1">
              <span className="animate-bounce">.</span><span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span><span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 bg-black/50 border-t border-white/10">
        <form onSubmit={handleSend} className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="e.g. Make it cinematic..."
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-3 pr-10 text-[11px] text-white placeholder-slate-500 outline-none focus:border-indigo-500/50 transition-colors"
          />
          <button 
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="absolute right-2 p-1.5 text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  )
}
