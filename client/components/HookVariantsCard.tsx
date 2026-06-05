'use client'

/**
 * HookVariantsCard — give a base hook, get back 3 niche-aware framings.
 *
 * Sits on the /dashboard/strategist page and writes the user's pick to their
 * weightedHooks style profile via /api/style-profile/pick. That signal feeds
 * the continuous-learning loop: hooks the user actually picks (and that
 * later perform) bias future Gemini calls.
 *
 * Anti-repetition is server-side — see filterDuplicates in
 * server/routes/intelligence.js.
 */

import { useState } from 'react'
import { Sparkles, Copy, Check, RefreshCw, Wand2 } from 'lucide-react'
import { apiPost } from '../lib/api'
import { useTranslation } from '@/hooks/useTranslation'

interface Variant {
  id: string
  framing: string
  text: string
  why: string
}

interface HookVariantsCardProps {
  niche: string
  platform: string
  className?: string
}

export default function HookVariantsCard({ niche, platform, className = '' }: HookVariantsCardProps) {
  const { t } = useTranslation()
  const [baseHook, setBaseHook] = useState('')
  const [variants, setVariants] = useState<Variant[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [pickedId, setPickedId] = useState<string | null>(null)

  const generate = async () => {
    if (!baseHook.trim() || baseHook.trim().length < 4) {
      setError(t('hookVariantsCard.errorMinLength'))
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data: any = await apiPost('/intelligence/strategist/variants', {
        baseHook: baseHook.trim(),
        niche,
        platform,
      })
      if (data?.success && Array.isArray(data.variants)) {
        setVariants(data.variants)
        setPickedId(null)
      } else {
        setError(data?.error || t('hookVariantsCard.errorNoVariants'))
      }
    } catch (err: any) {
      setError(err?.message || t('hookVariantsCard.errorGenerationFailed'))
    } finally {
      setLoading(false)
    }
  }

  const copy = async (variant: Variant) => {
    try {
      await navigator.clipboard.writeText(variant.text)
      setCopiedId(variant.id)
      setTimeout(() => setCopiedId(null), 1800)
    } catch { /* clipboard may be blocked in some sandboxes */ }
  }

  // Picking a variant records it as a `hooks` style-profile entry. The
  // weighted version updates later when the post tied to this hook ingests
  // analytics — the manual pick is enough signal for ordering today.
  const pick = async (variant: Variant) => {
    setPickedId(variant.id)
    try {
      await apiPost('/style-profile/pick', { facet: 'hooks' as any, key: variant.id })
    } catch { /* best-effort signal */ }
  }

  return (
    <section
      className={`rounded-3xl border border-[var(--glass-border)] bg-[var(--glass-surface)] backdrop-blur-md p-6 sm:p-8 ${className}`}
    >
      <header className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-[var(--tint-amber-bg)] border border-[var(--tint-amber-edge)] flex items-center justify-center">
          <Wand2 size={18} className="text-[var(--tint-amber-fg)]" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[var(--tint-amber-fg)]">{t('hookVariantsCard.abHookVariants')}</p>
          <h3 className="text-base font-bold text-[var(--text-main)] leading-tight">
            {t('hookVariantsCard.subtitle')}
          </h3>
        </div>
      </header>

      <label className="block">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-dim)] mb-2 inline-block">{t('hookVariantsCard.baseHookLabel')}</span>
        <textarea
          value={baseHook}
          onChange={(e) => setBaseHook(e.target.value)}
          placeholder={t('hookVariantsCard.baseHookPlaceholder')}
          maxLength={600}
          rows={2}
          className="w-full px-4 py-3 rounded-xl bg-[var(--glass-surface)] border border-[var(--glass-border)] text-sm text-[var(--text-main)] placeholder:text-[var(--text-dim)] focus:border-[var(--tint-amber-edge)] focus:outline-none resize-none"
        />
      </label>

      <div className="flex items-center justify-between gap-3 mt-3">
        <p className="text-[10px] text-[var(--text-dim)]">
          {t('hookVariantsCard.niche')} <span className="font-bold text-[var(--text-main)] capitalize">{niche}</span> · {t('hookVariantsCard.platform')} <span className="font-bold text-[var(--text-main)] capitalize">{platform}</span>
        </p>
        <button
         type="button"
          onClick={generate}
          disabled={loading || !baseHook.trim()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--tint-amber-fg)] text-[var(--page-bg)] text-[11px] font-black uppercase tracking-widest hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {loading ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {loading ? t('hookVariantsCard.generating') : t('hookVariantsCard.generateVariants')}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-xs text-[var(--tint-rose-fg)]">{error}</p>
      )}

      {variants.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-3">
          {variants.map((v) => {
            const isPicked = pickedId === v.id
            const isCopied = copiedId === v.id
            return (
              <article
                key={v.id}
                className={`p-5 rounded-2xl border transition-colors ${isPicked ? 'bg-[var(--tint-amber-bg)] border-[var(--tint-amber-edge)]' : 'bg-[var(--glass-surface)] border-[var(--glass-border)] hover:border-[var(--glass-border-strong)]'}`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--tint-amber-fg)]">{v.framing}</span>
                  <div className="flex items-center gap-2">
                    <button
                     type="button"
                      onClick={() => copy(v)}
                      aria-label={t('hookVariantsCard.copyVariant')}
                      className="w-8 h-8 rounded-lg bg-[var(--glass-surface)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-main)]"
                    >
                      {isCopied ? <Check size={14} className="text-[var(--tint-emerald-fg)]" /> : <Copy size={14} />}
                    </button>
                    <button
                     type="button"
                      onClick={() => pick(v)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-colors ${isPicked ? 'bg-[var(--tint-emerald-bg)] border-[var(--tint-emerald-edge)] text-[var(--tint-emerald-fg)]' : 'bg-[var(--glass-surface)] border-[var(--glass-border)] text-[var(--text-dim)] hover:text-[var(--text-main)]'}`}
                    >
                      {isPicked ? t('hookVariantsCard.picked') : t('hookVariantsCard.pick')}
                    </button>
                  </div>
                </div>
                <p className="text-base font-semibold text-[var(--text-main)] leading-snug mb-2">{v.text}</p>
                <p className="text-xs text-[var(--text-dim)] leading-relaxed">{v.why}</p>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
