'use client'

import ClickErrorRecovery from '@/components/click/ClickErrorRecovery'

export default function Phase8Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ClickErrorRecovery {...props} scope="phase8" />
}
