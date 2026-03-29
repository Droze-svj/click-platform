'use client'

import { useState, useEffect } from 'react'
import EntropyReversalNode from '../../../components/ContentRecyclingDashboard'
import { useAuth } from '../../../hooks/useAuth'
import { useRouter } from 'next/navigation'

export default function ReversalNodePage() {
  const router = useRouter()
  const { user } = useAuth()

  useEffect(() => {
    if (!user) {
      router.push('/login')
    }
  }, [user, router])

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-[#020205] selection:bg-indigo-500/30">
      <div className="max-w-[1600px] mx-auto px-10 pb-32">
        <EntropyReversalNode />
      </div>
    </div>
  )
}


