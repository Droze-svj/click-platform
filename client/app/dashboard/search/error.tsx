'use client'

import ClickErrorRecovery from '@/components/click/ClickErrorRecovery'

export default function SearchError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ClickErrorRecovery {...props} scope="search" />
}
