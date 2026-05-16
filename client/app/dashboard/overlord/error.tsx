'use client'

import ClickErrorRecovery from '@/components/click/ClickErrorRecovery'

export default function OverlordError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ClickErrorRecovery {...props} scope="overlord" />
}
