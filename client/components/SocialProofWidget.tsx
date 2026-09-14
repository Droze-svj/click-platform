'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck, Users, Sparkles } from 'lucide-react'
import { apiGet } from '../lib/api'
import { useTranslation } from '@/hooks/useTranslation'

type SocialProofData = {
  available: boolean
  creators?: number
  publishedPosts?: number
  verifiedC2PA?: boolean
  soc2?: string
}

export default function SocialProofWidget({ className }: { className?: string }) {
  const { t } = useTranslation()
  const [data, setData] = useState<SocialProofData | null>(null)

  useEffect(() => {
    let cancelled = false
    apiGet<{ data: SocialProofData }>('/trust/social-proof')
      .then((res) => {
        if (!cancelled) setData((res as any)?.data || null)
      })
      .catch(() => {
        /* widget is optional — fail silent */
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!data || !data.available) return null

  // `soc2` is a status CODE from /api/trust/social-proof, not display text — it is
  // 'not-certified' today, because Click holds no SOC 2 certification. Never print
  // the raw code to visitors; show the same "pending" wording the README uses, and
  // pass through any other status the API reports.
  const soc2Status = data.soc2 && data.soc2 !== 'not-certified'
    ? data.soc2
    : t('socialProofWidget.pending')

  return (
    <div
      role="region"
      aria-label={t('socialProofWidget.regionLabel')}
      className={
        className ||
        'rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-surface)] backdrop-blur-md px-5 py-4 grid grid-cols-3 gap-4'
      }
    >
      <div className="flex flex-col items-start gap-1">
        <Users size={16} className="text-[var(--text-muted)]" />
        <p className="text-2xl font-bold text-[var(--text-main)]">
          {Intl.NumberFormat().format(data.creators || 0)}
        </p>
        <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{t('socialProofWidget.creators')}</p>
      </div>
      <div className="flex flex-col items-start gap-1">
        <Sparkles size={16} className="text-[var(--text-muted)]" />
        <p className="text-2xl font-bold text-[var(--text-main)]">
          {Intl.NumberFormat().format(data.publishedPosts || 0)}
        </p>
        <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{t('socialProofWidget.postsPublished')}</p>
      </div>
      <div className="flex flex-col items-start gap-1">
        {/* The shield was always green, even beside "unsigned" — a verified look
            for an unverified state. It is only green when something is signed. */}
        <ShieldCheck
          size={16}
          className={data.verifiedC2PA ? 'text-emerald-500' : 'text-[var(--text-muted)]'}
        />
        <p className="text-sm font-bold text-[var(--text-main)]">
          {data.verifiedC2PA ? t('socialProofWidget.c2paSigned') : t('socialProofWidget.unsigned')}
        </p>
        <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
          {t('socialProofWidget.soc2', { status: soc2Status })}
        </p>
      </div>
    </div>
  )
}
