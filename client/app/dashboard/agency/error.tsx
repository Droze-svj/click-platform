'use client'

import ClickErrorRecovery from '@/components/click/ClickErrorRecovery'

export default function AgencyError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ClickErrorRecovery {...props} scope="agency" />
}
