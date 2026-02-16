'use client'

import React from 'react'
import { Sparkles, Type, Film, Target, Zap, ChevronRight, CheckCircle2 } from 'lucide-react'
import { EditorCategory } from '../../../types/editor'

const CREATIVITY_TIPS = [
  { icon: Target, title: 'Hook in first 3 seconds', desc: 'Grab attention with a question, bold claim, or visual punch. Use Edit → Viral Hooks.', id: 'edit' as EditorCategory },
  { icon: Type, title: 'Clear CTAs', desc: 'Add "Subscribe", "Follow", "Link in bio" as text overlays. Use Edit → Text overlays.', id: 'edit' as EditorCategory },
  { icon: Film, title: 'Pacing & B-roll', desc: 'Cut to the beat. Add B-roll in Assets and place on Timeline.', id: 'assets' as EditorCategory },
  { icon: Zap, title: 'Transcribe & trim', desc: 'Use Elite AI to transcribe, then trim dead air and add captions.', id: 'ai-edit' as EditorCategory },
]

interface AIAssistViewProps {
  setActiveCategory: (c: EditorCategory) => void
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

const AIAssistView: React.FC<AIAssistViewProps> = ({ setActiveCategory, showToast }) => {
  return (
    <div className="space-y-6">
      <div className="bg-surface-card rounded-xl border border-subtle p-5">
        <h3 className="text-sm font-bold text-theme-primary flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-emerald-500" />
          AI editing insights
        </h3>
        <p className="text-xs text-theme-secondary mb-4">
          Quick checks to boost creativity and quality. Click a tip to jump to the right tool.
        </p>

        <div className="space-y-3">
          {CREATIVITY_TIPS.map((tip) => {
            const Icon = tip.icon
            return (
              <button
                key={tip.title}
                type="button"
                onClick={() => { setActiveCategory(tip.id); showToast(`Opening ${tip.id}`, 'info') }}
                className="w-full flex items-start gap-3 p-3 rounded-xl bg-surface-elevated border border-subtle hover:bg-surface-card-hover hover:border-default transition-all text-left group"
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/30">
                  <Icon className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-theme-primary">{tip.title}</p>
                  <p className="text-[10px] text-theme-muted mt-0.5">{tip.desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-theme-muted shrink-0" />
              </button>
            )
          })}
        </div>
      </div>

      <div className="bg-surface-elevated rounded-xl border border-subtle p-4">
        <p className="text-[10px] text-theme-muted flex items-start gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-500" />
          For full AI workflows (transcription, viral quotes, auto-segments), use <strong className="text-theme-primary">Elite AI</strong>.
        </p>
        <button
          type="button"
          onClick={() => setActiveCategory('ai-edit')}
          className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-xs font-semibold"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Open Elite AI
        </button>
      </div>
    </div>
  )
}

export default AIAssistView
