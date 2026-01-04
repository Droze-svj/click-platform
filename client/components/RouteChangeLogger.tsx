'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export default function RouteChangeLogger() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
  }, [pathname, searchParams])

  useEffect(() => {
  }, [pathname, searchParams])

  return null
}


