'use client'

import React, { useState } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import {
  Music,
  Video,
  Smile,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Cpu,
  Brain
} from 'lucide-react'
import { apiPost } from '../../lib/api'
import { useStyleProfile, type StyleProfile } from '../../hooks/useStyleProfile'
import { useTranslation } from '../../hooks/useTranslation'

interface Suggestion {
  id: string
  type: 'music' | 'vibe' | 'hook' | 'broll' | 'gif'
  title: string
  description: string
  reason: string
  confidence: number
  metadata: any
}

interface AdaptiveCritiquePanelProps {
  videoId: string
  suggestions: Suggestion[]
  onOverride: (type: string, choice: any) => void
  showToast: (m: string, t: 'success' | 'info' | 'error') => void
}

// Facets of the real style profile (GET /api/style-profile) worth showing as
// "what Click has learned". Each is a list of { key, count } picks.
const LEARNED_FACETS: { facet: keyof Pick<StyleProfile, 'fonts' | 'captionStyles' | 'colorGrades' | 'transitions' | 'animations'>; labelKey: string }[] = [
  { facet: 'fonts', labelKey: 'adaptiveCritique.facetFonts' },
  { facet: 'captionStyles', labelKey: 'adaptiveCritique.facetCaptionStyles' },
  { facet: 'colorGrades', labelKey: 'adaptiveCritique.facetColorGrades' },
  { facet: 'transitions', labelKey: 'adaptiveCritique.facetTransitions' },
  { facet: 'animations', labelKey: 'adaptiveCritique.facetAnimations' },
]

export default function AdaptiveCritiquePanel({ videoId, suggestions, onOverride, showToast }: AdaptiveCritiquePanelProps) {
  const { t } = useTranslation()
  const { profile, loaded } = useStyleProfile()
  const [learningFeedback, setLearningFeedback] = useState<Record<string, 'positive' | 'negative' | null>>({})
  const [activeTab, setActiveTab] = useState<'current' | 'learned'>('current')

  const handleFeedback = async (suggestionId: string, type: string, action: 'positive' | 'negative', original: any) => {
    const previous = learningFeedback[suggestionId] ?? null
    setLearningFeedback(prev => ({ ...prev, [suggestionId]: action }))

    try {
      // POST /ai/adaptive/feedback does not exist. /api/ai/feedback does, and is
      // explicitly the ONE endpoint for every AI surface — it upweights the trait
      // on positive feedback and records the reason on negative, which is exactly
      // this panel's job. A second feedback path would split the learning loop
      // the universal endpoint was built to close.
      await apiPost('/ai/feedback', {
        surface: 'adaptive-critique',
        itemType: type,
        action: action === 'positive' ? 'thumbs_up' : 'thumbs_down',
        contentId: videoId,
        value: suggestionId,
        reason: action === 'negative' ? original?.reason || original?.action : undefined,
      })

      showToast(
        action === 'positive'
          ? t('adaptiveCritique.feedbackPositive')
          : t('adaptiveCritique.feedbackNegative'),
        'success'
      )
    } catch (err) {
      console.error(err)
      setLearningFeedback(prev => ({ ...prev, [suggestionId]: previous }))
      showToast(t('adaptiveCritique.feedbackFailed'), 'error')
    }
  }

  const learned = LEARNED_FACETS
    .map(({ facet, labelKey }) => {
      const top = (profile[facet] || []).slice().sort((a, b) => (b.count || 0) - (a.count || 0))[0]
      return top && top.count > 0 ? { facet, labelKey, key: top.key, count: top.count } : null
    })
    .filter((x): x is { facet: typeof LEARNED_FACETS[number]['facet']; labelKey: string; key: string; count: number } => !!x)

  return (
    <div className="lumina-card p-8 space-y-8 relative overflow-hidden group">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8 relative z-10">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/20 rounded-2xl text-emerald-400 border border-emerald-500/30">
            <Cpu className="w-6 h-6" aria-hidden />
          </div>
          <div>
            <h3 className="text-xl font-bold text-[var(--text-main)] tracking-tight leading-none">{t('adaptiveCritique.title')}</h3>
            <span className="text-xs text-slate-500 mt-1 block">{t('adaptiveCritique.subtitle')}</span>
          </div>
        </div>

        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab('current')}
            className={`px-4 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${activeTab === 'current' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-white'}`}
          >
            {t('adaptiveCritique.tabSuggestions')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('learned')}
            className={`px-4 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${activeTab === 'learned' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-white'}`}
          >
            {t('adaptiveCritique.tabLearned')}
          </button>
        </div>
      </div>

      <div className="space-y-4 relative z-10">
        <AnimatePresence mode="wait">
          {activeTab === 'current' ? (
            <m.div
              key="current"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              {suggestions.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-500">{t('adaptiveCritique.noSuggestions')}</p>
              )}
              {suggestions.map((s) => (
                <div key={s.id} className="p-6 bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-emerald-500/30 rounded-[2rem] transition-all flex flex-wrap items-center justify-between gap-4 group/item">
                  <div className="flex items-center gap-6">
                    <div className="w-14 h-14 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center text-emerald-400">
                      {s.type === 'music' && <Music className="w-6 h-6" aria-hidden />}
                      {s.type === 'hook' && <Sparkles className="w-6 h-6" aria-hidden />}
                      {s.type === 'gif' && <Smile className="w-6 h-6" aria-hidden />}
                      {s.type === 'broll' && <Video className="w-6 h-6" aria-hidden />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[var(--text-main)] tracking-tight leading-none mb-2">
                        {s.title}
                        {typeof s.confidence === 'number' && Number.isFinite(s.confidence) && (
                          <span className="ml-3 px-2 py-0.5 rounded-full bg-emerald-500/20 text-[10px] font-semibold text-emerald-400">
                            {t('adaptiveCritique.confidence', { score: Math.round(Math.min(1, Math.max(0, s.confidence)) * 100) })}
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-500 font-medium max-w-sm">{s.reason}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <m.button
                      type="button"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleFeedback(s.id, s.type, 'positive', s)}
                      aria-label={t('adaptiveCritique.thumbsUp')}
                      title={t('adaptiveCritique.thumbsUp')}
                      className={`p-3 rounded-xl border transition-all ${learningFeedback[s.id] === 'positive' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-white/5 text-slate-500 border-white/5 hover:text-emerald-400 hover:border-emerald-500/30'}`}
                    >
                      <ThumbsUp className="w-4 h-4" aria-hidden />
                    </m.button>
                    <m.button
                      type="button"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleFeedback(s.id, s.type, 'negative', s)}
                      aria-label={t('adaptiveCritique.thumbsDown')}
                      title={t('adaptiveCritique.thumbsDown')}
                      className={`p-3 rounded-xl border transition-all ${learningFeedback[s.id] === 'negative' ? 'bg-rose-600 text-white border-rose-500' : 'bg-white/5 text-slate-500 border-white/5 hover:text-rose-400 hover:border-rose-500/30'}`}
                    >
                      <ThumbsDown className="w-4 h-4" aria-hidden />
                    </m.button>
                    <div className="w-px h-6 bg-white/10 mx-1" />
                    <button
                      type="button"
                      onClick={() => onOverride(s.type, s)}
                      className="px-4 py-2 bg-white/10 hover:bg-white text-slate-400 hover:text-black rounded-xl text-[11px] font-semibold transition-all"
                    >
                      {t('adaptiveCritique.override')}
                    </button>
                  </div>
                </div>
              ))}
            </m.div>
          ) : (
            // Real data only: the top pick per facet from the creator's saved
            // style profile. This tab used to show a hard-coded "learned 4
            // stylistic nuances / +12% Energy Preference / Sarcastic bias".
            <m.div
              key="learned"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6 space-y-6"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 flex items-center justify-center">
                  <Brain className="w-6 h-6 text-emerald-400" aria-hidden />
                </div>
                <div>
                  <h4 className="text-base font-bold text-[var(--text-main)]">{t('adaptiveCritique.learnedTitle')}</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {!loaded
                      ? t('adaptiveCritique.learnedLoading')
                      : learned.length === 0
                        ? t('adaptiveCritique.learnedEmpty')
                        : t('adaptiveCritique.learnedFrom', { count: profile.totalPicks })}
                  </p>
                </div>
              </div>
              {learned.length > 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {learned.map(item => (
                    <div key={item.facet} className="p-4 bg-white/5 rounded-2xl border border-white/10 text-left">
                      <span className="text-[11px] font-semibold text-emerald-400 block mb-2">{t(item.labelKey)}</span>
                      <p className="text-sm text-white font-semibold truncate" title={item.key}>{item.key}</p>
                      <p className="text-[11px] text-slate-500 mt-1">{t('adaptiveCritique.pickedTimes', { count: item.count })}</p>
                    </div>
                  ))}
                </div>
              )}
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
