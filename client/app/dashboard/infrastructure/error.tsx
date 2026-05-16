'use client'

import ClickErrorRecovery from '@/components/click/ClickErrorRecovery'

export default function InfrastructureError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ClickErrorRecovery {...props} scope="infrastructure" />
}
