'use client'

import ClickErrorRecovery from '@/components/click/ClickErrorRecovery'

export default function NicheError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ClickErrorRecovery {...props} scope="niche" />
}
