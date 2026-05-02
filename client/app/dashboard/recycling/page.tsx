'use client'

import { useEffect } from 'react'
import EntropyReversalNode from '../../../components/ContentRecyclingDashboard'
import { useAuth } from '../../../hooks/useAuth'
import { useRouter } from 'next/navigation'
import SectionHeader from '../../../components/dashboard/SectionHeader'
import { Recycle } from 'lucide-react'

export default function ContentRemixPage() {
  const router = useRouter()
  const { user } = useAuth()

  useEffect(() => {
    if (!user) router.push('/login')
  }, [user, router])

  if (!user) return null

  return (
    <div className="min-h-screen bg-[var(--page-bg)] selection:bg-indigo-500/30">
      <div className="max-w-[1600px] mx-auto px-10 pt-12 pb-32">
        <SectionHeader
          tone="publish"
          icon={Recycle}
          kicker="Publish · Content Remix"
          title="Content Remix"
          subtitle="Turn one piece of content into a dozen. Pick any past video and Click adapts it for new platforms, niches, or hooks — keeping the original intact."
        />
        <EntropyReversalNode />
      </div>
    </div>
  )
}
