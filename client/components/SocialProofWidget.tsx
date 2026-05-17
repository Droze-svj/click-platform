'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck, Users, Sparkles } from 'lucide-react'
import { apiGet } from '../lib/api'

type SocialProofData = {
  available: boolean
  creators?: number
  publishedPosts?: number
  verifiedC2PA?: boolean
  soc2?: string
}

export default function SocialProofWidget({ className }: { className?: string }) {
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

  return (
    <div
      role="region"
      aria-label="Platform credibility"
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
        <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">creators</p>
      </div>
      <div className="flex flex-col items-start gap-1">
        <Sparkles size={16} className="text-[var(--text-muted)]" />
        <p className="text-2xl font-bold text-[var(--text-main)]">
          {Intl.NumberFormat().format(data.publishedPosts || 0)}
        </p>
        <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">posts published</p>
      </div>
      <div className="flex flex-col items-start gap-1">
        <ShieldCheck size={16} className="text-emerald-500" />
        <p className="text-sm font-bold text-[var(--text-main)]">
          {data.verifiedC2PA ? 'C2PA signed' : 'unsigned'}
        </p>
        <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
          SOC 2: {data.soc2 || 'pending'}
        </p>
      </div>
    </div>
  )
}
