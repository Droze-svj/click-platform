'use client'

import ClickErrorRecovery from '@/components/click/ClickErrorRecovery'

export default function RecyclingError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ClickErrorRecovery {...props} scope="recycling" />
}
